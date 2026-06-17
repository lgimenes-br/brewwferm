import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import crypto from 'crypto';
import 'dotenv/config'; // <--- ISSO CARREGA O ARQUIVO .ENV

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET; // <--- Lê do .env

if (!process.env.DB_PASS || !process.env.JWT_SECRET) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente (.env) não configuradas.");
    process.exit(1);
}

app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

// --- 1. BANCO DE DADOS (SEGURO) ---
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,       // <--- AGORA É SEGURO
    database: process.env.DB_NAME || 'brewbrother',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Inicialização de Tabelas
const initDb = async () => {
    try {
        await pool.execute(`CREATE TABLE IF NOT EXISTS batch_events (id INT AUTO_INCREMENT PRIMARY KEY, batch_id INT NOT NULL, event_type VARCHAR(50) NOT NULL, description TEXT, recorded_at DATETIME NOT NULL, FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS recipes (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, name VARCHAR(100) NOT NULL, style VARCHAR(100), est_og VARCHAR(10), est_fg VARCHAR(10), created_at DATETIME DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS recipe_steps (id INT AUTO_INCREMENT PRIMARY KEY, recipe_id INT NOT NULL, step_order INT NOT NULL, name VARCHAR(50), temperature FLOAT, days INT, FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE)`);
        console.log('✅ [DB] Tabelas verificadas.');
    } catch (e) { console.error('❌ Erro DB Init:', e); }
};
initDb();

// Cache de Lotes
const activeBatches = {};
const loadActiveBatches = async () => {
    try {
        const [rows] = await pool.execute(`SELECT b.id, d.serial_code FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1`);
        for (const key in activeBatches) delete activeBatches[key];
        rows.forEach(row => { activeBatches[row.serial_code.trim().toUpperCase()] = row.id; });
        console.log('🍺 [System] Cache de Lotes:', activeBatches);
    } catch (e) { console.error('❌ Erro Cache:', e); }
};
loadActiveBatches();

const lastLogTimes = {};
const discoveredUnknowns = {}; // Cache for unknown devices detected via MQTT 
const sanitizeNum = (val, precision) => {
    const num = parseFloat(val);
    if (val === null || val === undefined || val === '' || isNaN(num) || !isFinite(num)) return null;
    return num.toFixed(precision);
};

// --- 2. MQTT ---
const brokerUrl = process.env.VITE_MQTT_BROKER || 'mqtt://localhost:1883';
console.log(`🔌 [MQTT] Conectando a ${brokerUrl}...`);

const mqttClient = mqtt.connect(brokerUrl, {
    clientId: 'server_pro_' + Math.random().toString(16).substr(2, 8),
    username: 'esp32user', password: 'esp32', reconnectPeriod: 5000
    // Note: MQTT.js handles ws/wss protocols automatically based on URL scheme
});

const notifyUpdate = () => {
    mqttClient.publish('brewbrother/global/update', JSON.stringify({ ts: Date.now() }));
};

mqttClient.on('connect', () => { console.log('✅ [MQTT] Monitorando...'); mqttClient.subscribe('brewbrother/+/data'); });

mqttClient.on('message', async (topic, message) => {
    try {
        const parts = topic.split('/');
        if (parts.length < 3) return;
        const serialCode = parts[1].trim().toUpperCase();
        let payload;
        try { payload = JSON.parse(message.toString()); } catch (e) { return; }

        let deviceId = null;
        try {
            const [rows] = await pool.execute('SELECT id FROM devices WHERE serial_code = ?', [parts[1]]);
            if (rows.length > 0) deviceId = rows[0].id;
        } catch (dbErr) { /* Ignore DB error to allow discovery */ }

        if (deviceId) {
            delete discoveredUnknowns[serialCode];
            await pool.execute('UPDATE devices SET last_seen = NOW() WHERE id = ?', [deviceId]).catch(() => { });

            const now = Date.now();
            const lastLog = lastLogTimes[serialCode] || 0;
            const logInterval = payload.wi || 60000;

            if (now - lastLog >= logInterval) {
                let target = payload.fsm;
                if (payload.opm === 2) target = payload.csp;
                else if (payload.opm === 0 && payload.fermRun && payload.steps && payload.steps[payload.currStep]) {
                    target = payload.steps[payload.currStep].t;
                }
                const currentBatchId = activeBatches[serialCode] || null;
                await pool.execute(
                    `INSERT INTO telemetry (device_id, batch_id, temp_ferm, temp_amb, target_temp, gravity, battery, status_op, step_name, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [deviceId, currentBatchId, sanitizeNum(payload.ferm, 1), sanitizeNum(payload.amb, 1), sanitizeNum(target, 1), sanitizeNum(payload.is_sg, 3), sanitizeNum(payload.is_bat, 2), payload.statOp, payload.profStat]
                ).catch(() => { });
                lastLogTimes[serialCode] = now;
            }
        } else {
            // [NEW] Unknown (or DB down) - log it for discovery
            // console.log(`📡 [MQTT] Novo dispositivo detectado/cacheado: ${serialCode}`);
            if (!discoveredUnknowns[serialCode]) console.log(`✨ [Discovery] Novo item: ${serialCode}`);

            discoveredUnknowns[serialCode] = {
                ip: serialCode,
                type: 'Dispositivo MQTT',
                rssi: payload.rssi || -60,
                lastSeen: Date.now()
            };
        }
    } catch (err) { console.error("❌ Erro MQTT:", err.message); }
});

// --- 3. API ROUTES ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });
        if (await bcrypt.compare(password, users[0].password_hash)) {
            const token = jwt.sign({ id: users[0].id, name: users[0].name }, JWT_SECRET);
            res.json({ token, name: users[0].name });
        } else { res.status(403).json({ error: 'Senha incorreta' }); }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword]);
        res.status(201).json({ message: 'Sucesso' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email já existe' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        // MOCK: Verify token and find/create user
        if (!idToken) return res.status(400).json({ error: 'idToken é obrigatório' });
        
        // Simulating user retrieval
        const mockUser = { id: 999, name: 'Google User', email: 'user@google.com' };
        const token = jwt.sign({ id: mockUser.id, name: mockUser.name }, JWT_SECRET);
        res.json({ token, name: mockUser.name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROTAS DE COMPARTILHAMENTO (NOVO) ---
app.post('/api/batch/:id/share', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        const token = crypto.randomBytes(16).toString('hex');
        await pool.execute('UPDATE batches SET public_token = ? WHERE id = ?', [token, req.params.id]);
        res.json({ publicToken: token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/batch/:id/share', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        await pool.execute('UPDATE batches SET public_token = NULL WHERE id = ?', [req.params.id]);
        res.json({ message: 'Compartilhamento desativado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/public/batch/:token', async (req, res) => {
    try {
        // 1. Busca Lote e Device
        const [batches] = await pool.execute(
            `SELECT b.id, b.name, b.style, b.started_at, b.ended_at, b.is_active, b.og, b.fg, d.device_name 
             FROM batches b 
             JOIN devices d ON b.device_id = d.id 
             WHERE b.public_token = ?`,
            [req.params.token]
        );

        if (batches.length === 0) return res.status(404).json({ error: 'Link inválido ou expirado' });
        const batch = batches[0];

        // 2. Busca Telemetria
        const [logs] = await pool.execute(
            `SELECT temp_ferm, temp_amb, target_temp, gravity, recorded_at, step_name 
             FROM telemetry 
             WHERE batch_id = ? 
             ORDER BY recorded_at ASC`,
            [batch.id]
        );

        // 3. Busca Eventos (NOVO - Adicionado aqui)
        const [events] = await pool.execute(
            `SELECT event_type, description, recorded_at 
             FROM batch_events 
             WHERE batch_id = ? 
             ORDER BY recorded_at ASC`,
            [batch.id]
        );

        res.json({ meta: batch, logs: logs, events: events });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// ----------------------------------------

app.get('/api/devices', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT d.*, (d.last_seen > NOW() - INTERVAL 2 MINUTE) as is_online, b.id as active_batch_id, b.name as active_batch_name, b.style as active_batch_style, b.started_at as active_batch_start, b.profile as active_batch_profile, b.og as active_batch_og, b.fg as active_batch_fg FROM devices d LEFT JOIN batches b ON b.device_id = d.id AND b.is_active = 1 WHERE d.user_id = ?`, [req.user.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/discovery', async (req, res) => {
    try {
        const now = Date.now();
        console.log(`🔎 [API] /api/discovery solicitado. Cache atual: ${Object.keys(discoveredUnknowns).length} itens`);

        // Clean old
        for (const k in discoveredUnknowns) {
            if (now - discoveredUnknowns[k].lastSeen > 300000) delete discoveredUnknowns[k];
        }
        res.json(Object.values(discoveredUnknowns));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/devices', authenticateToken, async (req, res) => {
    try {
        await pool.execute('INSERT INTO devices (serial_code, user_id, device_name, created_at) VALUES (?, ?, ?, NOW())', [req.body.serialCode, req.user.id, req.body.name]);
        notifyUpdate();
        res.status(201).json({ message: 'Criado' });
    } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

app.delete('/api/devices/:serial', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM devices WHERE serial_code = ? AND user_id = ?', [req.params.serial, req.user.id]);
        delete activeBatches[req.params.serial.trim().toUpperCase()];
        notifyUpdate();
        res.json({ message: 'Removido' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/batch/start', authenticateToken, async (req, res) => {
    const { serialCode, name, style, og, fg, profile } = req.body;
    try {
        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
        if (devs.length === 0) return res.status(404).json({ error: 'Device não encontrado' });
        const deviceId = devs[0].id;
        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE device_id = ? AND is_active = 1', [deviceId]);

        // Store profile as JSON string if provided
        const profileJson = profile ? JSON.stringify(profile) : null;
        const [result] = await pool.execute(
            'INSERT INTO batches (device_id, name, style, og, fg, profile, started_at, is_active) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)',
            [deviceId, name, style || '', og || null, fg || null, profileJson]
        );

        activeBatches[serialCode.trim().toUpperCase()] = result.insertId;
        notifyUpdate();
        res.json({ message: 'Iniciado!', batchId: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/batch/update', authenticateToken, async (req, res) => {
    try {
        const { serialCode, og, fg, name } = req.body;
        console.log(`📝 [API] /api/batch/update - Recebido:`, { serialCode, og, fg, name });

        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
        if (devs.length === 0) {
            console.log(`❌ [API] Device não encontrado: ${serialCode}`);
            return res.status(404).json({ error: 'Device não encontrado' });
        }

        console.log(`✅ [API] Device encontrado, ID: ${devs[0].id}`);

        // Build dynamic update query
        const updates = [];
        const params = [];
        if (og !== undefined) { updates.push('og = ?'); params.push(og); }
        if (fg !== undefined) { updates.push('fg = ?'); params.push(fg); }
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }

        if (updates.length > 0) {
            params.push(devs[0].id);
            const query = `UPDATE batches SET ${updates.join(', ')} WHERE device_id = ? AND is_active = 1`;
            console.log(`🔄 [API] Executando query:`, query, params);
            const [result] = await pool.execute(query, params);
            console.log(`✅ [API] Query executada. Linhas afetadas:`, result.affectedRows);
        }

        notifyUpdate();
        res.json({ message: 'Atualizado' });
    } catch (err) {
        console.error(`❌ [API] Erro ao atualizar batch:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/batch/stop', authenticateToken, async (req, res) => {
    try {
        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [req.body.serialCode, req.user.id]);
        if (devs.length === 0) return res.status(404).json({ error: 'Device não encontrado' });
        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE device_id = ? AND is_active = 1', [devs[0].id]);
        delete activeBatches[req.body.serialCode.trim().toUpperCase()];
        notifyUpdate();
        res.json({ message: 'Finalizado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Finish batch by ID - mark as inactive and set end date
app.post('/api/batch/:id/finish', authenticateToken, async (req, res) => {
    try {
        // Verify ownership
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });

        // Mark batch as inactive and set end date
        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE id = ?', [req.params.id]);

        // Notify MQTT clients
        notifyUpdate();

        res.json({ message: 'Batch finalizado com sucesso' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.body.batchId, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        await pool.execute('INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, ?, ?, ?)', [req.body.batchId, req.body.type, req.body.description, req.body.date || new Date()]);
        res.status(201).json({ message: 'Registrado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/batch/:id/events', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        const [rows] = await pool.execute('SELECT * FROM batch_events WHERE batch_id = ? ORDER BY recorded_at ASC', [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT e.id FROM batch_events e JOIN batches b ON e.batch_id = b.id JOIN devices d ON b.device_id = d.id WHERE e.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        await pool.execute('DELETE FROM batch_events WHERE id = ?', [req.params.id]);
        res.json({ message: 'Apagado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/recipes', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM recipes WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/recipes/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute('SELECT id FROM recipes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(404).json({ error: 'Receita não encontrada' });
        const [steps] = await pool.execute('SELECT step_order, name as n, temperature as t, days as d FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order ASC', [req.params.id]);
        res.json(steps);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/recipes', authenticateToken, async (req, res) => {
    const { name, style, og, fg, steps } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [resRecipe] = await conn.execute('INSERT INTO recipes (user_id, name, style, est_og, est_fg) VALUES (?, ?, ?, ?, ?)', [req.user.id, name, style, og, fg]);
        const recipeId = resRecipe.insertId;
        if (steps && steps.length > 0) {
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                await conn.execute('INSERT INTO recipe_steps (recipe_id, step_order, name, temperature, days) VALUES (?, ?, ?, ?, ?)', [recipeId, i, s.n, s.t, s.d]);
            }
        }
        await conn.commit();
        notifyUpdate();
        res.status(201).json({ message: 'Salva', id: recipeId });
    } catch (err) { await conn.rollback(); res.status(500).json({ error: err.message }); } finally { conn.release(); }
});

app.delete('/api/recipes/:id', authenticateToken, async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM recipes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Receita não encontrada' });
        notifyUpdate();
        res.json({ message: 'Apagada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history/:serial', async (req, res) => {
    try {
        const { batch } = req.query;
        const limit = parseInt(req.query.limit) || 25;
        const safeLimit = limit > 5000 ? 5000 : limit;
        let query = `SELECT t.temp_ferm, t.temp_amb, t.target_temp, t.gravity, t.recorded_at FROM telemetry t JOIN devices d ON t.device_id = d.id WHERE d.serial_code = ? `;
        const params = [req.params.serial.trim().toUpperCase()];
        if (batch === 'active') {
            const [active] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.serial_code = ? AND b.is_active = 1 LIMIT 1`, [params[0]]);
            if (active.length > 0) { query += ` AND t.batch_id = ? `; params.push(active[0].id); } else return res.json([]);
        } else query += ` AND t.recorded_at > NOW() - INTERVAL 30 DAY `;
        query += ` ORDER BY t.recorded_at DESC LIMIT ?`;
        params.push(safeLimit);
        const [rows] = await pool.execute(query, params);
        res.json(rows.reverse());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/history/:serial', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [req.params.serial, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
        await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [rows[0].id]);
        res.json({ message: 'Apagado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/:serial', authenticateToken, async (req, res) => {
    try {
        let [batches] = await pool.execute(`SELECT b.id, b.name, b.ended_at, b.is_active FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.serial_code = ? AND b.is_active = 1 LIMIT 1`, [req.params.serial]);
        if (batches.length === 0) [batches] = await pool.execute(`SELECT b.id, b.name, b.ended_at, b.is_active FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.serial_code = ? ORDER BY b.id DESC LIMIT 1`, [req.params.serial]);
        let queryWhere = ''; let fileName = 'log_geral'; let currentBatch = null;
        if (batches.length > 0) { currentBatch = batches[0]; queryWhere = `AND t.batch_id = ${currentBatch.id}`; fileName = currentBatch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase(); } else { queryWhere = `AND t.recorded_at > NOW() - INTERVAL 30 DAY`; }
        const [rows] = await pool.execute(`SELECT t.recorded_at, t.temp_ferm, t.temp_amb, t.target_temp, t.gravity, t.battery, t.status_op, t.step_name, b.name as batch_name FROM telemetry t JOIN devices d ON t.device_id = d.id LEFT JOIN batches b ON t.batch_id = b.id WHERE d.serial_code = ? AND d.user_id = ? ${queryWhere} ORDER BY t.recorded_at ASC`, [req.params.serial, req.user.id]);
        if (rows.length === 0) return res.status(404).send('Sem dados');
        if (rows.length > 1 && (rows[0].status_op || '').includes('CONCLU') && !(rows[1].status_op || '').includes('CONCLU')) rows.shift();
        if (currentBatch && !currentBatch.is_active && currentBatch.ended_at && rows.length > 0) { const last = rows[rows.length - 1]; rows.push({ recorded_at: currentBatch.ended_at, batch_name: last.batch_name, temp_ferm: last.temp_ferm, temp_amb: last.temp_amb, target_temp: last.target_temp, gravity: last.gravity, battery: last.battery, status_op: 'FINALIZADO', step_name: 'MANUAL' }); }
        let csv = 'Data/Hora,Lote,Temp Fermentador,Temp Ambiente,Alvo,Densidade (SG),Bateria,Status,Etapa\n';
        const f = (v) => v != null ? parseFloat(v).toFixed(1) : ''; const fs = (v) => v != null ? parseFloat(v).toFixed(3) : '';
        rows.forEach(r => { csv += `"${new Date(r.recorded_at).toLocaleString('pt-BR')}","${r.batch_name || ''}",${f(r.temp_ferm)},${f(r.temp_amb)},${f(r.target_temp)},${fs(r.gravity)},${f(r.battery)},"${r.status_op || ''}","${r.step_name || ''}"\n`; });
        res.header('Content-Type', 'text/csv'); res.attachment(`${fileName}.csv`); res.send(csv);
    } catch (err) { res.status(500).send('Erro ao exportar'); }
});

app.get('/api/batches', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.execute(`SELECT b.id, b.name, b.style, b.og, b.fg, b.profile, b.started_at, b.ended_at, b.is_active, d.device_name, b.device_id as device_id FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.user_id = ? ORDER BY b.started_at DESC`, [req.user.id]); res.json(rows); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get batch details (metadata)
app.get('/api/batch/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.* FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        res.json(check[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/batches/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        await pool.execute('DELETE FROM telemetry WHERE batch_id = ?', [req.params.id]);
        await pool.execute('DELETE FROM batch_events WHERE batch_id = ?', [req.params.id]);
        await pool.execute('DELETE FROM batches WHERE id = ?', [req.params.id]);
        res.json({ message: 'Batch deletado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get batch telemetry data
app.get('/api/batch/:id/data', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        const [rows] = await pool.execute(`SELECT temp_ferm, temp_amb, target_temp, gravity, recorded_at, step_name FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC`, [req.params.id]);
        
        let finalRows = rows;
        const targetPoints = 500;
        if (rows.length > targetPoints) {
            const step = Math.ceil(rows.length / targetPoints);
            finalRows = rows.filter((_, index) => index % step === 0);
        }
        
        res.json(finalRows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/firmware/version.json', (req, res) => {
    res.sendFile('/var/www/breww-backend/firmware/version.json');
});

app.get('/firmware/update.bin', (req, res) => {
    res.download('/var/www/breww-backend/firmware/update.bin');
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get(/(.*)/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => { console.log(`🚀 Servidor BATCH MANAGER + RECIPES + REACTIVE rodando na porta ${PORT}`); });