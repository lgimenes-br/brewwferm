import bcrypt from 'bcryptjs';
import { exec } from 'child_process';
import util from 'util';
import { deviceRegistry } from '../services/deviceRegistry.js';

/**
 * Resumo da frota para o admin. rows: { board, firmware_version, hw_modules (JSON), online }.
 * Modulos "ds18b20:N" viram contagem de aparelhos por numero de sensores ("ds18b20 x2").
 */
export const summarizeFleet = (rows) => {
    const tally = (map, key, online) => {
        const e = map.get(key) || { name: key, count: 0, online: 0 };
        e.count++; if (online) e.online++;
        map.set(key, e);
    };
    const boards = new Map(), versions = new Map(), modules = new Map();
    for (const r of rows) {
        const online = Number(r.online) === 1;
        tally(boards, r.board || 'desconhecida', online);
        tally(versions, r.firmware_version || 'desconhecida', online);
        let mods = [];
        try { mods = JSON.parse(r.hw_modules || '[]'); } catch { mods = []; }
        for (const m of Array.isArray(mods) ? mods : []) {
            const ds = /^ds18b20:(\d+)$/.exec(String(m));
            if (ds) { if (Number(ds[1]) > 0) tally(modules, `ds18b20 x${ds[1]}`, online); }
            else tally(modules, String(m), online);
        }
    }
    const sorted = (map) => [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
        total: rows.length,
        online: rows.filter(r => Number(r.online) === 1).length,
        reporting: rows.filter(r => r.board).length, // ja mandam placa (firmware 2.8.3+)
        boards: sorted(boards),
        versions: sorted(versions),
        modules: sorted(modules),
    };
};

const execPromise = util.promisify(exec);

export const registerAdminRoutes = ({
    app,
    pool,
    authenticateToken,
    requireAdmin,
    deleteDeviceCascade,
    loadActiveBatches,
    sendPushToUser
}) => {
    app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(`
                SELECT u.id, u.name, u.email, u.role, u.plan_type, u.max_devices, u.created_at, COUNT(d.id) as device_count 
                FROM users u LEFT JOIN devices d ON u.id = d.user_id 
                GROUP BY u.id ORDER BY u.id DESC
            `);
            res.json(rows);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.put('/api/admin/users/:id/plan', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const plan_type = req.body?.plan_type === 'premium' ? 'premium' : 'free';
            const max_devices = plan_type === 'premium' ? 9999 : 1;
            await pool.execute('UPDATE users SET plan_type = ?, max_devices = ? WHERE id = ?', [plan_type, max_devices, req.params.id]);
            res.json({ message: 'Plano atualizado' });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(`
                SELECT d.id, d.serial_code, d.device_name, d.last_seen, d.user_id, u.name as owner_name, u.email as owner_email 
                FROM devices d JOIN users u ON d.user_id = u.id 
                ORDER BY d.id DESC
            `);
            res.json(rows);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { name, email, password, role } = req.body || {};
            const cleanName = String(name || '').trim();
            const cleanEmail = String(email || '').trim().toLowerCase();
            if (!cleanName || !cleanEmail || !password) return res.status(400).json({ error: 'Faltam dados obrigatórios' });
            const safeRole = role === 'admin' ? 'admin' : 'user';
            const hashedPassword = await bcrypt.hash(String(password), 10);
            await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [cleanName, cleanEmail, hashedPassword, safeRole]);
            res.status(201).json({ message: 'User created' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, email, role, password } = req.body || {};
            const cleanName = String(name || '').trim();
            const cleanEmail = String(email || '').trim().toLowerCase();
            if (!cleanName || !cleanEmail) return res.status(400).json({ error: 'Nome e email são obrigatórios' });
            const safeRole = role === 'admin' ? 'admin' : 'user';
            if (password) {
                const hashedPassword = await bcrypt.hash(String(password), 10);
                await pool.execute('UPDATE users SET name=?, email=?, role=?, password_hash=? WHERE id=?', [cleanName, cleanEmail, safeRole, hashedPassword, id]);
            } else {
                await pool.execute('UPDATE users SET name=?, email=?, role=? WHERE id=?', [cleanName, cleanEmail, safeRole, id]);
            }
            res.json({ message: 'User updated' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            // 1. Bulk delete recipe_steps & recipes without N+1 loop
            await pool.execute('DELETE FROM recipe_steps WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = ?)', [id]);
            await pool.execute('DELETE FROM recipes WHERE user_id = ?', [id]);

            // 2. Delete push_subscriptions
            await pool.execute('DELETE FROM push_subscriptions WHERE user_id = ?', [id]);

            // 3. Delete devices, batches, batch_events and readings
            const [devices] = await pool.execute('SELECT id, serial_code FROM devices WHERE user_id = ?', [id]);
            for (const dev of devices) {
                await deleteDeviceCascade(dev.id, dev.serial_code);
            }

            // 4. Finally delete the user
            await pool.execute('DELETE FROM users WHERE id = ?', [id]);
            await loadActiveBatches();

            res.json({ message: 'User and all related data deleted' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { serial_code, device_name, user_id } = req.body;
            if (!serial_code || !user_id) return res.status(400).json({ error: 'Faltam dados obrigatórios' });
            await pool.execute('INSERT INTO devices (serial_code, device_name, user_id) VALUES (?, ?, ?)', [serial_code.trim().toUpperCase(), device_name || null, user_id]);
            deviceRegistry.invalidate(serial_code);
            res.status(201).json({ message: 'Device created' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.put('/api/admin/devices/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { serial_code, device_name, user_id } = req.body;
            if (!serial_code || !user_id) return res.status(400).json({ error: 'Faltam dados obrigatórios' });
            const [prevDev] = await pool.execute('SELECT serial_code FROM devices WHERE id = ?', [id]);
            await pool.execute('UPDATE devices SET serial_code=?, device_name=?, user_id=? WHERE id=?', [serial_code.trim().toUpperCase(), device_name || null, user_id, id]);
            if (prevDev[0]) deviceRegistry.invalidate(prevDev[0].serial_code);
            deviceRegistry.invalidate(serial_code);
            await loadActiveBatches();
            res.json({ message: 'Device updated' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.delete('/api/admin/devices/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const [devs] = await pool.execute('SELECT serial_code FROM devices WHERE id = ?', [id]);
            await deleteDeviceCascade(id, devs[0]?.serial_code);
            await loadActiveBatches();
            res.json({ message: 'Device deleted' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // ==========================================
    // ADMIN E ESTATÍSTICAS (Parallelized with Promise.all)
    // ==========================================
    app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [
                [[{ total_users }]],
                [[{ total_devices }]],
                [[{ active_batches }]],
                [[{ online_devices }]]
            ] = await Promise.all([
                pool.execute('SELECT COUNT(*) as total_users FROM users'),
                pool.execute('SELECT COUNT(*) as total_devices FROM devices'),
                pool.execute('SELECT COUNT(*) as active_batches FROM batches WHERE is_active = 1'),
                pool.execute('SELECT COUNT(*) as online_devices FROM devices WHERE last_seen > NOW() - INTERVAL 1 HOUR')
            ]);
            res.json({ total_users, total_devices, active_batches, online_devices });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // Frota (Fase 5.3): aparelhos por placa, versao de firmware e hardware detectado
    app.get('/api/admin/fleet', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT board, firmware_version, hw_modules, (last_seen > NOW() - INTERVAL 1 HOUR) AS online FROM devices'
            );
            res.json(summarizeFleet(rows));
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/telemetry', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [devices] = await pool.execute(`
                SELECT d.id, d.serial_code, d.device_name, d.last_seen, u.name as owner_name,
                (d.last_seen > NOW() - INTERVAL 1 HOUR) as is_online,
                (SELECT temp_ferm FROM telemetry t WHERE t.device_id = d.id ORDER BY recorded_at DESC LIMIT 1) as last_temp,
                (SELECT battery FROM telemetry t WHERE t.device_id = d.id ORDER BY recorded_at DESC LIMIT 1) as last_battery,
                (SELECT rssi FROM telemetry t WHERE t.device_id = d.id ORDER BY recorded_at DESC LIMIT 1) as last_rssi
                FROM devices d
                JOIN users u ON d.user_id = u.id
                ORDER BY d.last_seen DESC
            `);
            res.json(devices);
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // SERVER TERMINAL & BACKLOG
    app.get('/api/admin/server/status', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { stdout } = await execPromise('pm2 jlist');
            const jsonStart = stdout.indexOf('[');
            res.json(JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout));
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Erro interno ao consultar status do servidor' });
        }
    });

    // ==========================================
    // BI & ANALYTICS (Parallelized with Promise.all)
    // ==========================================
    app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [
                [[{ mau }]],
                [[{ zombies }]],
                [growth],
                [firmwares]
            ] = await Promise.all([
                pool.execute('SELECT COUNT(DISTINCT user_id) as mau FROM devices WHERE last_seen > NOW() - INTERVAL 30 DAY'),
                pool.execute('SELECT COUNT(*) as zombies FROM devices WHERE last_seen < NOW() - INTERVAL 30 DAY OR last_seen IS NULL'),
                pool.execute("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as users FROM users GROUP BY month ORDER BY month ASC LIMIT 12"),
                pool.execute('SELECT firmware_version as name, COUNT(*) as count FROM devices WHERE firmware_version IS NOT NULL GROUP BY firmware_version')
            ]);
            res.json({ mau, zombies, growth, firmwares });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/financials', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [users] = await pool.execute('SELECT plan_type, COUNT(*) as count FROM users GROUP BY plan_type');
            let free = 0; let premium = 0;
            users.forEach(u => {
                if (u.plan_type === 'premium') premium += Number(u.count) || 0;
                else free += Number(u.count) || 0;
            });
            const mrr = premium * 29.90;
            res.json({ free, premium, mrr });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/batch-stats', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [
                [[{ total }]],
                [[{ success }]]
            ] = await Promise.all([
                pool.execute('SELECT COUNT(*) as total FROM batches WHERE is_active = 0'),
                pool.execute('SELECT COUNT(*) as success FROM batches WHERE is_active = 0 AND DATEDIFF(ended_at, started_at) > 1')
            ]);
            res.json({ total, success, abandoned: total - success });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/health-radar', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [devices] = await pool.execute(`
                SELECT d.serial_code, d.device_name, u.name as user_name, t.rssi, t.battery, t.recorded_at, d.last_seen 
                FROM devices d 
                JOIN users u ON d.user_id = u.id
                LEFT JOIN (SELECT device_id, rssi, battery, recorded_at FROM telemetry WHERE id IN (SELECT MAX(id) FROM telemetry GROUP BY device_id)) t ON t.device_id = d.id
                WHERE d.last_seen > NOW() - INTERVAL 7 DAY
                ORDER BY t.rssi ASC, t.battery ASC
                LIMIT 5
            `);
            res.json(devices);
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/push-stats', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [
                [[{ total_users }]],
                [[{ opt_in }]]
            ] = await Promise.all([
                pool.execute('SELECT COUNT(*) as total_users FROM users'),
                pool.execute('SELECT COUNT(DISTINCT user_id) as opt_in FROM push_subscriptions')
            ]);
            res.json({ total_users, opt_in });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/admin/broadcast-push', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { title, message } = req.body || {};
            if (!title || !message) return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
            const [subs] = await pool.execute('SELECT DISTINCT user_id FROM push_subscriptions');
            const results = await Promise.allSettled(
                subs.map(sub => sendPushToUser(pool, sub.user_id, title, message))
            );
            const sent = results.filter(r => r.status === 'fulfilled').length;
            res.json({ success: true, sent });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/community-trends', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [styles] = await pool.execute(`
                SELECT style as name, 
                       COUNT(*) as count, 
                       AVG(DATEDIFF(IFNULL(ended_at, NOW()), started_at)) as avg_days,
                       AVG(CASE WHEN CAST(og AS DECIMAL(10,4)) > 500 THEN CAST(og AS DECIMAL(10,4)) / 1000 ELSE CAST(og AS DECIMAL(10,4)) END) as avg_og,
                       AVG(CASE WHEN CAST(fg AS DECIMAL(10,4)) > 500 THEN CAST(fg AS DECIMAL(10,4)) / 1000 ELSE CAST(fg AS DECIMAL(10,4)) END) as avg_fg
                FROM batches 
                WHERE style IS NOT NULL AND style != "" 
                GROUP BY style 
                ORDER BY count DESC 
                LIMIT 10
            `);
            const enriched = styles.map(s => {
                let og = parseFloat(s.avg_og);
                let fg = parseFloat(s.avg_fg);
                if (og > 500) og /= 1000;
                if (fg > 500) fg /= 1000;
                let abv = 0;
                if (og > 1 && fg > 0.99 && og > fg) abv = (og - fg) * 131.25;
                return { ...s, abv: abv > 0 ? abv.toFixed(1) : '-' };
            });
            res.json(enriched);
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/trends', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [
                [[{ total_batches }]],
                [styles]
            ] = await Promise.all([
                pool.execute('SELECT COUNT(*) as total_batches FROM batches'),
                pool.execute('SELECT style as name, COUNT(*) as count FROM batches WHERE style IS NOT NULL AND style != "" GROUP BY style ORDER BY count DESC LIMIT 5')
            ]);
            res.json({ total_batches, styles });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/map', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [locations] = await pool.execute('SELECT u.name, IFNULL(u.lat, -23.5505) as lat, IFNULL(u.lon, -46.6333) as lon, MAX(d.last_seen) as last_seen FROM users u JOIN devices d ON u.id = d.user_id GROUP BY u.id');
            res.json(locations);
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/server/logs', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { stdout, stderr } = await execPromise('pm2 logs breww-server --nostream --lines 100');
            res.send(stdout + '\n' + stderr);
        } catch (e) {
            console.error(e);
            res.status(500).send('Erro interno ao consultar logs do servidor');
        }
    });

    // BROADCASTS & LOGS
    app.get('/api/admin/audit', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const safeLimit = 100;
            const [logs] = await pool.execute(`SELECT a.*, u.name as user_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ${safeLimit}`);
            res.json(logs);
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.get('/api/admin/broadcasts', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [broadcasts] = await pool.execute('SELECT * FROM system_broadcasts ORDER BY created_at DESC');
            res.json(broadcasts);
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/admin/broadcasts', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { title, message, type, is_active, send_push } = req.body || {};
            if (!message) return res.status(400).json({ error: 'Mensagem é obrigatória' });
            await pool.execute('INSERT INTO system_broadcasts (title, message, type, is_active) VALUES (?, ?, ?, ?)', [title ?? null, message, type || 'info', is_active ? 1 : 0]);
            await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'CREATE_BROADCAST', `Title: ${title || ''}`, req.ip || null]);

            if (send_push) {
                const [subs] = await pool.execute('SELECT DISTINCT user_id FROM push_subscriptions');
                await Promise.allSettled(
                    subs.map(sub => sendPushToUser(pool, sub.user_id, title || 'Aviso da Plataforma', message))
                );
            }
            res.status(201).json({ message: 'Enviado' });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.put('/api/admin/broadcasts/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { is_active } = req.body;
            await pool.execute('UPDATE system_broadcasts SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
            res.json({ message: 'Atualizado' });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });
};
