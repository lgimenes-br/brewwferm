import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import 'dotenv/config'; // <--- ISSO CARREGA O ARQUIVO .ENV

const execPromise = util.promisify(exec);
import { sendPushToUser } from './pushService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
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

const ingredientsPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_INGREDIENTS_NAME || 'breww_ingredients',
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
        await pool.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, endpoint TEXT NOT NULL, p256dh VARCHAR(255), auth VARCHAR(255), created_at DATETIME DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        
        await pool.execute(`CREATE TABLE IF NOT EXISTS system_broadcasts (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), message TEXT NOT NULL, type VARCHAR(50) DEFAULT 'info', is_active BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT NOW())`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS audit_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, action VARCHAR(100) NOT NULL, details TEXT, ip_address VARCHAR(45), created_at DATETIME DEFAULT NOW())`);

        // Migrations (Ignoring errors if columns already exist)
        try { await pool.execute('ALTER TABLE users ADD COLUMN plan_type ENUM("free", "premium") DEFAULT "free"'); } catch (e) { }
        try { await pool.execute('ALTER TABLE users ADD COLUMN max_devices INT DEFAULT 1'); } catch (e) { }
        try { await pool.execute('ALTER TABLE telemetry ADD COLUMN rssi INT DEFAULT NULL'); } catch (e) { }
        try { await pool.execute('ALTER TABLE users ADD COLUMN lat FLOAT DEFAULT NULL'); } catch (e) { }
        try { await pool.execute('ALTER TABLE users ADD COLUMN lon FLOAT DEFAULT NULL'); } catch (e) { }
        try { await pool.execute('ALTER TABLE devices ADD COLUMN firmware_version VARCHAR(20) DEFAULT NULL'); } catch (e) { }
        
        console.log('Main DB tables initialized');
        
        // Add ingredients column safely
        try {
            await pool.execute(`ALTER TABLE batches ADD COLUMN ingredients JSON`);
            console.log('✅ [DB] Coluna ingredients adicionada em batches.');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') {
                console.error('Erro ao adicionar coluna ingredients:', e);
            }
        }

        try { await pool.execute(`ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'`); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error(e); }

        try { await pool.execute(`ALTER TABLE devices ADD COLUMN sensor1_name VARCHAR(50) DEFAULT 'Fermentador'`); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error(e); }
        try { await pool.execute(`ALTER TABLE devices ADD COLUMN sensor2_name VARCHAR(50) DEFAULT 'Geladeira'`); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error(e); }
        try { await pool.execute(`ALTER TABLE devices ADD COLUMN sensor_sg_name VARCHAR(50) DEFAULT 'Gravidade'`); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error(e); }
        
        // Smart Scheduling columns
        try { await pool.execute(`ALTER TABLE batches ADD COLUMN current_step_index INT DEFAULT 0`); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error(e); }
        try { await pool.execute(`ALTER TABLE batches ADD COLUMN step_started_at DATETIME`); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error(e); }
        
        // Performance Indexes
        try { await pool.execute(`CREATE INDEX idx_telemetry_batch ON telemetry(batch_id)`); } catch(e) { if(e.code !== 'ER_DUP_KEYNAME') console.error(e); }
        try { await pool.execute(`CREATE INDEX idx_telemetry_device ON telemetry(device_id)`); } catch(e) { if(e.code !== 'ER_DUP_KEYNAME') console.error(e); }
        
        console.log('✅ [DB] Verificacao de colunas de sensores e scheduling concluida.');
        
        console.log('✅ [DB] Tabelas verificadas.');
    } catch (e) { console.error('❌ Erro DB Init:', e); }
};
initDb();

let activeBatches = {};
const activeBatchesUserId = {}; // Para saber quem notificar
const alertState = {}; // Controle de alertas enviados

const refreshActiveBatches = async () => {
    try {
        const [rows] = await pool.execute('SELECT b.id, b.user_id, d.serial_code FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1 ORDER BY b.id ASC');
        const newMap = {};
        const newUserIdMap = {};
        for (const row of rows) {
            if (row.serial_code) {
                const serial = row.serial_code.trim().toUpperCase();
                newMap[serial] = row.id;
                newUserIdMap[serial] = row.user_id;
            }
        }
        activeBatches = newMap;
        for (const key in activeBatchesUserId) delete activeBatchesUserId[key];
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


// ==========================================
// WEBPUSH SUBSCRIPTION
// ==========================================

// --- 11. SMART SCHEDULING (Autonomous Profile Advancement) ---
setInterval(async () => {
    try {
        const [activeBatches] = await pool.execute(`
            SELECT b.id, b.profile, b.current_step_index, b.step_started_at, d.serial_code, d.user_id 
            FROM batches b 
            JOIN devices d ON b.device_id = d.id 
            WHERE b.is_active = 1 AND b.profile IS NOT NULL
        `);

        for (let batch of activeBatches) {
            if (!batch.profile || !batch.step_started_at) continue;
            let profile = [];
            try { profile = typeof batch.profile === 'string' ? JSON.parse(batch.profile) : batch.profile; } catch(e) { continue; }
            
            if (Array.isArray(profile) && batch.current_step_index < profile.length - 1) {
                const currentStep = profile[batch.current_step_index];
                if (!currentStep || !currentStep.duration) continue;

                const elapsedMs = Date.now() - new Date(batch.step_started_at).getTime();
                const durationMs = currentStep.duration * 24 * 60 * 60 * 1000;

                if (elapsedMs >= durationMs) {
                    const newIndex = batch.current_step_index + 1;
                    const nextStep = profile[newIndex];
                    
                    // Update DB
                    await pool.execute(
                        'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?', 
                        [newIndex, batch.id]
                    );

                    // Send MQTT
                    if (batch.serial_code) {
                        mqttClient.publish(`brewbrother/${batch.serial_code}/command`, JSON.stringify({
                            cmd: 'setProfile',
                            steps: profile,
                            currentStep: newIndex
                        }));
                    }

                    // Log Event
                    const desc = `Avançou automaticamente para a etapa: ${nextStep.name} (${nextStep.temperature}°C)`;
                    await pool.execute(
                        'INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, ?, ?, NOW())',
                        [batch.id, 'SYSTEM_ACTION', desc]
                    );

                    // Send Push Notification
                    if (batch.user_id) {
                        sendPushToUser(pool, batch.user_id, 'Avanço Automático de Etapa', desc);
                    }
                    
                    console.log(`🤖 [Smart Scheduler] Lote ${batch.id} avançou para etapa ${newIndex}`);
                }
            }
        }
    } catch (e) {
        console.error('Erro no Smart Scheduler:', e);
    }
}, 5 * 60 * 1000); // Roda a cada 5 minutos

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

mqttClient.on('connect', () => {
    mqttClient.subscribe('brewbrother/+/status');
    mqttClient.subscribe('brewbrother/+/data'); // NOVO: as novas placas enviam para data
    mqttClient.subscribe('brewbrother/+/comando'); // <-- Intercept manual overrides
    mqttClient.subscribe('brewbrother/global/ping');
});

mqttClient.on('message', async (topic, message) => {
    try {
        let payload;
        try { payload = JSON.parse(message.toString()); } catch (e) { return; }
        
        // Intercept Manual Overrides from frontend
        if (topic.endsWith('/comando')) {
            const serialCode = topic.split('/')[1];
            if (payload.type === 'setProfile' && payload.currentStep !== undefined) {
                // Find active batch and update step_started_at
                const [batches] = await pool.execute(`
                    SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id 
                    WHERE d.serial_code = ? AND b.is_active = 1 LIMIT 1
                `, [serialCode]);
                if (batches.length > 0) {
                    await pool.execute(
                        'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
                        [payload.currentStep, batches[0].id]
                    );
                    console.log(`⏱️ [Manual Override] Lote ${batches[0].id} alterado para etapa ${payload.currentStep}`);
                }
            }
            return;
        }

        const parts = topic.split('/');
        if (parts.length < 3) return;
        const serialCode = parts[1].trim().toUpperCase();

        let deviceId = null;
        try {
            const [rows] = await pool.execute('SELECT id FROM devices WHERE serial_code = ?', [parts[1]]);
            if (rows.length > 0) deviceId = rows[0].id;
        } catch (dbErr) { /* Ignore DB error to allow discovery */ }

        if (deviceId) {
            delete discoveredUnknowns[serialCode];
            await pool.execute('UPDATE devices SET last_seen = NOW() WHERE id = ?', [deviceId]).catch(() => { });
            if (payload.fw) {
                await pool.execute('UPDATE devices SET firmware_version = ? WHERE id = ?', [payload.fw, deviceId]).catch(() => { });
            }

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

                let finalGravity = sanitizeNum(payload.is_sg, 3);
                // O ESP32 envia 0 quando não tem leitura do iSpindel. Tratamos como nulo.
                if ((finalGravity === null || parseFloat(finalGravity) === 0) && currentBatchId) {
                    try {
                        const [lastRow] = await pool.execute('SELECT gravity FROM telemetry WHERE batch_id = ? AND gravity IS NOT NULL AND gravity > 0 ORDER BY recorded_at DESC LIMIT 1', [currentBatchId]);
                        if (lastRow.length > 0) {
                            finalGravity = lastRow[0].gravity;
                        }
                    } catch (err) {
                        console.error('Failed to get last gravity', err);
                    }
                }

                let dateSQL = 'NOW()';
                let queryArgs = [deviceId, currentBatchId, sanitizeNum(payload.ferm, 1), sanitizeNum(payload.amb, 1), sanitizeNum(target, 1), finalGravity, sanitizeNum(payload.is_bat, 2), payload.statOp, payload.profStat, payload.rssi || null];
                
                // Apenas confia no timestamp do ESP32 se ele for maior que o ano 2020 (NTP Sincronizado)
                if (payload.ts && payload.ts > 1600000000) {
                    dateSQL = 'FROM_UNIXTIME(?)';
                    queryArgs.push(payload.ts);
                }

                await pool.execute(
                    `INSERT INTO telemetry (device_id, batch_id, temp_ferm, temp_amb, target_temp, gravity, battery, status_op, step_name, rssi, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${dateSQL})`,
                    queryArgs
                ).catch((err) => { 
                    console.error("❌ Telemetry Insert Error:", err.message); 
                });
                lastLogTimes[serialCode] = now;
            }

            // --- Lógica de Alertas Push ---
            const userId = activeBatchesUserId[serialCode];
            if (userId) {
                if (!alertState[serialCode]) alertState[serialCode] = {};
                
                // Alerta de Temperatura
                const tempFerm = parseFloat(payload.ferm);
                const targetTemp = parseFloat(sanitizeNum(target, 1));
                if (tempFerm && targetTemp && payload.opm === 0) {
                    if (Math.abs(tempFerm - targetTemp) > 1.5) {
                        if (!alertState[serialCode].tempAlertStartTime) {
                            alertState[serialCode].tempAlertStartTime = now;
                        } else if (now - alertState[serialCode].tempAlertStartTime > 15 * 60 * 1000) { // 15 min
                            if (!alertState[serialCode].tempAlertSent) {
                                sendPushToUser(pool, userId, 'Alerta de Temperatura', `Cerveja fora da temperatura alvo: ${tempFerm}ºC (Alvo: ${targetTemp}ºC)`);
                                alertState[serialCode].tempAlertSent = true;
                            }
                        }
                    } else {
                        alertState[serialCode].tempAlertStartTime = null;
                        if (alertState[serialCode].tempAlertSent) {
                            sendPushToUser(pool, userId, 'Temperatura Normalizada', `A temperatura voltou ao alvo: ${tempFerm}ºC`);
                            alertState[serialCode].tempAlertSent = false;
                        }
                    }
                }

                // Alerta de Mudança de Passo
                if (payload.opm === 0 && payload.profStat) {
                    if (alertState[serialCode].lastStep && alertState[serialCode].lastStep !== payload.profStat) {
                        sendPushToUser(pool, userId, 'Mudança de Passo', `O fermentador iniciou o passo: ${payload.profStat}`);
                    }
                    alertState[serialCode].lastStep = payload.profStat;
                }
                
                // Recuperação de Offline
                if (alertState[serialCode].offlineAlertSent) {
                    sendPushToUser(pool, userId, 'Equipamento Online', 'O fermentador voltou a se comunicar com o servidor.');
                    alertState[serialCode].offlineAlertSent = false;
                }
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

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado: Administrador necessário' });
    }
    next();
};

const updateUserLocation = async (userId, req) => {
    let ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip;
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) return;
    try {
        const cleanIp = ip.includes('::ffff:') ? ip.split('::ffff:')[1] : ip;
        const res = await fetch(`http://ip-api.com/json/${cleanIp}`);
        const data = await res.json();
        if (data.status === 'success' && data.lat && data.lon) {
            await pool.execute('UPDATE users SET lat = ?, lon = ? WHERE id = ?', [data.lat, data.lon, userId]);
        }
    } catch (e) { console.error('Location fetch error:', e.message); }
};

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });
        if (await bcrypt.compare(password, users[0].password_hash)) {
            const token = jwt.sign({ id: users[0].id, name: users[0].name, role: users[0].role }, JWT_SECRET);
            
            // Log successful login
            const userIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip;
            await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [users[0].id, 'LOGIN_SUCCESS', 'User logged in', userIp]);
            updateUserLocation(users[0].id, req);
            
            res.json({ token, name: users[0].name, role: users[0].role });
        } else { 
            await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [users[0].id, 'LOGIN_FAILED', 'Invalid password attempt', req.ip]);
            res.status(403).json({ error: 'Senha incorreta' }); 
        }
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Monitor de Dispositivos Offline
setInterval(() => {
    const now = Date.now();
    for (const serialCode in lastLogTimes) {
        if (now - lastLogTimes[serialCode] > 10 * 60 * 1000) { // 10 minutos
            const userId = activeBatchesUserId[serialCode];
            if (userId) {
                if (!alertState[serialCode]) alertState[serialCode] = {};
                if (!alertState[serialCode].offlineAlertSent) {
                    sendPushToUser(pool, userId, 'Equipamento Offline', `Perdemos comunicação com o fermentador há mais de 10 minutos!`);
                    alertState[serialCode].offlineAlertSent = true;
                }
            }
        }
    }
}, 60000);

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
        const { idToken } = req.body; // Actually this is the access_token now from useGoogleLogin
        if (!idToken) return res.status(400).json({ error: 'Token é obrigatório' });
        
        // Obter dados do usuário no Google usando o access_token
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${idToken}` }
        });
        
        if (!googleRes.ok) {
            throw new Error('Token inválido ou expirado');
        }

        const payload = await googleRes.json();
        const email = payload.email;
        const name = payload.name;
        const googleId = payload.sub;

        if (!email) return res.status(400).json({ error: 'Token não possui email' });

        // Verifica se o usuário existe no DB
        let [users] = await pool.execute('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
        
        let userId;
        let userName = name;
        let userRole = 'user';

        if (users.length === 0) {
            // Cria usuário novo
            const [result] = await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, 'google_sso_' + googleId]);
            userId = result.insertId;
        } else {
            userId = users[0].id;
            userName = users[0].name;
            userRole = users[0].role;
        }

        const token = jwt.sign({ id: userId, name: userName, role: userRole }, JWT_SECRET);
        updateUserLocation(userId, req);
        res.json({ token, name: userName, role: userRole });
    } catch (err) { 
        console.error('Google Auth Error:', err);
        res.status(500).json({ error: 'Falha na autenticação com o Google' }); 
    }
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
        const [rows] = await pool.execute(`SELECT d.*, (d.last_seen > NOW() - INTERVAL 2 MINUTE) as is_online, b.id as active_batch_id, b.name as active_batch_name, b.style as active_batch_style, b.started_at as active_batch_start, b.profile as active_batch_profile, b.og as active_batch_og, b.fg as active_batch_fg, b.current_step_index as active_batch_current_step FROM devices d LEFT JOIN batches b ON b.device_id = d.id AND b.is_active = 1 WHERE d.user_id = ?`, [req.user.id]);
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
        const [[{ max_devices }]] = await pool.execute('SELECT max_devices FROM users WHERE id = ?', [req.user.id]);
        const [[{ count }]] = await pool.execute('SELECT COUNT(*) as count FROM devices WHERE user_id = ?', [req.user.id]);
        
        if (count >= max_devices) {
            return res.status(403).json({ error: 'Limite de equipamentos atingido. Atualize seu plano.' });
        }

        await pool.execute('INSERT INTO devices (serial_code, user_id, device_name, created_at) VALUES (?, ?, ?, NOW())', [req.body.serialCode, req.user.id, req.body.name]);
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'CREATE_DEVICE', `Device: ${req.body.serialCode}`, req.ip]);
        notifyUpdate();
        res.status(201).json({ message: 'Criado' });
    } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

app.put('/api/devices/:id/sensors', authenticateToken, async (req, res) => {
    try {
        const { sensor1Name, sensor2Name, sensorSgName } = req.body;
        await pool.execute('UPDATE devices SET sensor1_name = ?, sensor2_name = ?, sensor_sg_name = ? WHERE serial_code = ? AND user_id = ?', 
            [sensor1Name, sensor2Name, sensorSgName, req.params.id, req.user.id]);
        notifyUpdate();
        res.json({ message: 'Sensores atualizados no backend' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/devices/:serial', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM devices WHERE serial_code = ? AND user_id = ?', [req.params.serial, req.user.id]);
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'DELETE_DEVICE', `Device: ${req.params.serial}`, req.ip]);
        delete activeBatches[req.params.serial.trim().toUpperCase()];
        notifyUpdate();
        res.json({ message: 'Excluído' });
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
            'INSERT INTO batches (device_id, name, style, og, fg, profile, started_at, is_active, current_step_index, step_started_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, 0, NOW())',
            [deviceId, name, style || '', og || null, fg || null, profileJson]
        );

        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'START_BATCH', `Batch: ${name} (Device: ${serialCode})`, req.ip]);

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
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'STOP_BATCH', `Device: ${req.body.serialCode}`, req.ip]);
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

app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys) {
            return res.status(400).json({ error: 'Endpoint e keys são obrigatórios.' });
        }
        
        // Verifica se já existe para evitar duplicatas (usando o endpoint)
        const [existing] = await pool.execute('SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [req.user.id, endpoint]);
        
        if (existing.length === 0) {
            await pool.execute('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)', [
                req.user.id, endpoint, keys.p256dh, keys.auth
            ]);
        }
        
        res.json({ message: 'Inscrição salva com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar inscrição Push:', err);
        res.status(500).json({ error: err.message });
    }
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

app.get('/api/batches/compare', authenticateToken, async (req, res) => {
    try {
        const { batch1, batch2 } = req.query;
        if (!batch1 || !batch2) return res.status(400).json({ error: 'Forneça batch1 e batch2' });

        // Ensure user owns both batches
        const [auth] = await pool.execute('SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id IN (?, ?) AND d.user_id = ?', [batch1, batch2, req.user.id]);
        if (auth.length !== 2) return res.status(403).json({ error: 'Acesso negado aos lotes' });

        const [rows1] = await pool.execute('SELECT temp_ferm, gravity, recorded_at FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC', [batch1]);
        const [rows2] = await pool.execute('SELECT temp_ferm, gravity, recorded_at FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC', [batch2]);

        const normalize = (rows) => {
            if (rows.length === 0) return [];
            const t0 = new Date(rows[0].recorded_at).getTime();
            return rows.map(r => ({
                hour: (new Date(r.recorded_at).getTime() - t0) / (1000 * 60 * 60),
                temp: parseFloat(r.temp_ferm),
                sg: parseFloat(r.gravity)
            }));
        };

        const data1 = normalize(rows1);
        const data2 = normalize(rows2);

        const combined = {};
        const process = (data, prefix) => {
            data.forEach(d => {
                const h = Math.round(d.hour * 10) / 10;
                if (!combined[h]) combined[h] = { hour: h };
                if (d.temp) combined[h][`${prefix}_temp`] = d.temp;
                if (d.sg) combined[h][`${prefix}_sg`] = d.sg;
            });
        };
        process(data1, 'b1');
        process(data2, 'b2');

        const result = Object.values(combined).sort((a, b) => a.hour - b.hour);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/batches', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.execute(`SELECT b.id, b.name, b.style, b.og, b.fg, b.profile, b.started_at, b.ended_at, b.is_active, b.ingredients, d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name, b.device_id as device_id FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.user_id = ? ORDER BY b.started_at DESC`, [req.user.id]); res.json(rows); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get batch details (metadata)
app.get('/api/batch/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.* FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        res.json(check[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update batch ingredients
app.put('/api/batches/:id/ingredients', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        
        const { ingredients } = req.body;
        await pool.execute('UPDATE batches SET ingredients = ? WHERE id = ?', [JSON.stringify(ingredients), req.params.id]);
        res.json({ message: 'Ingredientes atualizados com sucesso' });
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

// Voice Assistant Endpoint (Alexa / Google Home)
app.get('/api/voice/status', async (req, res) => {
    try {
        const token = req.query.token;
        const voiceToken = process.env.VOICE_TOKEN || 'breww123';
        if (token !== voiceToken) return res.status(403).send('Acesso negado. Token inválido.');

        const [batches] = await pool.execute(`SELECT b.id, b.name, b.style, d.id as device_id, d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1 LIMIT 1`);
        if (batches.length === 0) {
            return res.send('Não há nenhum lote ativo no momento no Breww Dashboard.');
        }
        
        const batch = batches[0];
        const [telemetry] = await pool.execute(`SELECT temp_ferm, temp_amb, target_temp, gravity, status_op FROM telemetry WHERE batch_id = ? ORDER BY recorded_at DESC LIMIT 1`, [batch.id]);
        
        if (telemetry.length === 0) {
            return res.send(`O lote ${batch.name} está ativo, mas ainda não recebi dados de temperatura.`);
        }
        
        const t = telemetry[0];
        const tempFerm = t.temp_ferm ? t.temp_ferm.toString().replace('.', ' vírgula ') : 'desconhecida';
        const tempAmb = t.temp_amb ? t.temp_amb.toString().replace('.', ' vírgula ') : 'desconhecida';
        
        const s3 = batch.sensor_sg_name || 'Gravidade';
        let gravText = '';
        if (t.gravity) {
            const parts = t.gravity.toString().split('.');
            if (parts.length === 2) {
                // e.g., 1.015 -> "um ponto zero quinze"
                gravText = `e o ${s3} é ${parts[0]} ponto ${parts[1].split('').join(' ')}`; 
            }
        }

        const s1 = batch.sensor1_name || 'Fermentador';
        const s2 = batch.sensor2_name || 'Geladeira';
        const text = `O lote ${batch.name} está ativo. A temperatura do ${s1} é de ${tempFerm} graus, do ${s2} é ${tempAmb} graus, ${gravText}.`;
        
        res.send(text);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ocorreu um erro ao consultar o servidor.');
    }
});

// Native Alexa Custom Skill Endpoint
app.post('/api/voice/alexa', async (req, res) => {
    try {
        // Handle SessionEndedRequest (Alexa requires an empty response or it fails)
        if (req.body && req.body.request && req.body.request.type === 'SessionEndedRequest') {
            return res.json({ version: "1.0", response: { shouldEndSession: true } });
        }

        const token = req.query.token;
        const voiceToken = process.env.VOICE_TOKEN || 'breww123';
        
        // Return 200 with Alexa format even for auth errors, so Alexa reads the error aloud
        if (token !== voiceToken) {
            return res.json({ 
                version: "1.0", 
                response: { 
                    outputSpeech: { type: "PlainText", text: "Acesso negado. Verifique o token de segurança no aplicativo." }, 
                    shouldEndSession: true 
                } 
            });
        }

        const [batches] = await pool.execute(`SELECT b.id, b.name, b.style, d.id as device_id, d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1 ORDER BY b.id DESC LIMIT 1`);
        if (batches.length === 0) {
            return res.json({ version: "1.0", response: { outputSpeech: { type: "PlainText", text: "Não há nenhum lote ativo no momento no seu painel Breww." }, shouldEndSession: true } });
        }
        
        const batch = batches[0];
        const [telemetry] = await pool.execute(`SELECT temp_ferm, temp_amb, target_temp, gravity, status_op FROM telemetry WHERE batch_id = ? ORDER BY id DESC LIMIT 1`, [batch.id]);
        
        if (telemetry.length === 0) {
            return res.json({ version: "1.0", response: { outputSpeech: { type: "PlainText", text: `O lote ${batch.name} está ativo, mas ainda não recebi dados de telemetria.` }, shouldEndSession: true } });
        }
        
        const t = telemetry[0];
        const tempFerm = t.temp_ferm ? parseFloat(t.temp_ferm).toFixed(1).replace('.', ' vírgula ') : 'desconhecida';
        const tempAmb = t.temp_amb ? parseFloat(t.temp_amb).toFixed(1).replace('.', ' vírgula ') : 'desconhecida';
        
        const s3 = batch.sensor_sg_name || 'Gravidade';
        let gravText = '';
        if (t.gravity) {
            const gravFormatted = parseFloat(t.gravity).toFixed(3);
            const parts = gravFormatted.split('.');
            if (parts.length === 2) {
                gravText = `e o ${s3} é ${parts[0]} ponto ${parts[1].split('').join(' ')}`; 
            }
        }

        const s1 = batch.sensor1_name || 'Fermentador';
        const s2 = batch.sensor2_name || 'Geladeira';
        const text = `A temperatura do ${s1} é de ${tempFerm} graus, do ${s2} é ${tempAmb} graus, ${gravText}.`;
        
        res.json({
            version: "1.0",
            response: {
                outputSpeech: {
                    type: "PlainText",
                    text: text
                },
                shouldEndSession: true
            }
        });
    } catch (err) {
        console.error("Alexa Endpoint Error:", err);
        res.json({ version: "1.0", response: { outputSpeech: { type: "PlainText", text: "Ocorreu um erro interno ao consultar o servidor Breww." }, shouldEndSession: true } });
    }
});

app.get('/api/debug-alexa', async (req, res) => {
    try {
        const [batches] = await pool.execute(`SELECT b.id, b.name, b.is_active, d.serial_code FROM batches b JOIN devices d ON b.device_id = d.id`);
        const [telemetry] = await pool.execute(`SELECT id, batch_id, temp_ferm, temp_amb, gravity, recorded_at FROM telemetry ORDER BY id DESC LIMIT 5`);
        res.json({ batches, telemetry, activeBatchesCache: activeBatches, lastLogs: lastLogTimes });
    } catch (e) { res.status(500).json({error: e.message}); }
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

        // Fill in missing/zero gravities with the previous valid value so the chart doesn't drop
        let lastValidGravity = null;
        finalRows = finalRows.map(row => {
            const currentGravity = row.gravity !== null ? parseFloat(row.gravity) : null;
            if (currentGravity !== null && currentGravity > 0) {
                lastValidGravity = currentGravity;
            } else if (lastValidGravity !== null) {
                row.gravity = lastValidGravity;
            }
            return row;
        });
        
        res.json(finalRows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// INGREDIENTS API (BeerJSON)
// ==========================================
app.get('/api/ingredients/fermentables', authenticateToken, async (req, res) => {
    try {
        const [rows] = await ingredientsPool.execute('SELECT * FROM fermentables ORDER BY name ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ingredients/hops', authenticateToken, async (req, res) => {
    try {
        const [rows] = await ingredientsPool.execute('SELECT * FROM hops ORDER BY name ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ingredients/yeasts', authenticateToken, async (req, res) => {
    try {
        const [rows] = await ingredientsPool.execute('SELECT * FROM yeasts ORDER BY name ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ingredients/miscs', authenticateToken, async (req, res) => {
    try {
        const [rows] = await ingredientsPool.execute('SELECT * FROM miscs ORDER BY name ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ADMIN API
// ==========================================
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT u.id, u.name, u.email, u.role, u.plan_type, u.max_devices, u.created_at, COUNT(d.id) as device_count 
            FROM users u LEFT JOIN devices d ON u.id = d.user_id 
            GROUP BY u.id ORDER BY u.id DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/users/:id/plan', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { plan_type } = req.body;
        const max_devices = plan_type === 'premium' ? 9999 : 1;
        await pool.execute('UPDATE users SET plan_type = ?, max_devices = ? WHERE id = ?', [plan_type, max_devices, req.params.id]);
        res.json({ message: 'Plano atualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT d.id, d.serial_code, d.device_name, d.last_seen, d.user_id, u.name as owner_name, u.email as owner_email 
            FROM devices d JOIN users u ON d.user_id = u.id 
            ORDER BY d.id DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Faltam dados obrigatórios' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, role || 'user']);
        res.status(201).json({ message: 'User created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, password } = req.body;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.execute('UPDATE users SET name=?, email=?, role=?, password_hash=? WHERE id=?', [name, email, role, hashedPassword, id]);
        } else {
            await pool.execute('UPDATE users SET name=?, email=?, role=? WHERE id=?', [name, email, role, id]);
        }
        res.json({ message: 'User updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Delete recipe_steps
        const [recipes] = await pool.execute('SELECT id FROM recipes WHERE user_id = ?', [id]);
        for (let r of recipes) {
            await pool.execute('DELETE FROM recipe_steps WHERE recipe_id = ?', [r.id]);
        }
        
        // 2. Delete recipes
        await pool.execute('DELETE FROM recipes WHERE user_id = ?', [id]);
        
        // 3. Delete push_subscriptions
        await pool.execute('DELETE FROM push_subscriptions WHERE user_id = ?', [id]);
        
        // 4. Delete devices, batches, batch_events and readings
        const [devices] = await pool.execute('SELECT id FROM devices WHERE user_id = ?', [id]);
        for (let dev of devices) {
            // Delete telemetry
            await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [dev.id]);
            
            // Delete batch_events
            const [batches] = await pool.execute('SELECT id FROM batches WHERE device_id = ?', [dev.id]);
            for (let b of batches) {
                await pool.execute('DELETE FROM batch_events WHERE batch_id = ?', [b.id]);
            }
            
            // Delete batches
            await pool.execute('DELETE FROM batches WHERE device_id = ?', [dev.id]);
            
            // Delete device
            await pool.execute('DELETE FROM devices WHERE id = ?', [dev.id]);
        }
        
        // 5. Finally delete the user
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        
        res.json({ message: 'User and all related data deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { serial_code, device_name, user_id } = req.body;
        if (!serial_code || !user_id) return res.status(400).json({ error: 'Faltam dados obrigatórios' });
        await pool.execute('INSERT INTO devices (serial_code, device_name, user_id) VALUES (?, ?, ?)', [serial_code, device_name || null, user_id]);
        res.status(201).json({ message: 'Device created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/devices/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { serial_code, device_name, user_id } = req.body;
        await pool.execute('UPDATE devices SET serial_code=?, device_name=?, user_id=? WHERE id=?', [serial_code, device_name || null, user_id, id]);
        res.json({ message: 'Device updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/devices/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM readings WHERE device_id = ?', [id]);
        await pool.execute('DELETE FROM devices WHERE id = ?', [id]);
        res.json({ message: 'Device deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/ingredients/:table', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { table } = req.params;
        const validTables = ['fermentables', 'hops', 'yeasts', 'miscs'];
        if (!validTables.includes(table)) return res.status(400).json({ error: 'Tabela inválida' });
        
        const { name, name_pt } = req.body;
        const [result] = await ingredientsPool.execute(`INSERT INTO ${table} (name, name_pt) VALUES (?, ?)`, [name, name_pt]);
        res.json({ id: result.insertId, message: 'Ingrediente criado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/ingredients/:table/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { table, id } = req.params;
        const validTables = ['fermentables', 'hops', 'yeasts', 'miscs'];
        if (!validTables.includes(table)) return res.status(400).json({ error: 'Tabela inválida' });
        
        const { name, name_pt } = req.body;
        await ingredientsPool.execute(`UPDATE ${table} SET name = ?, name_pt = ? WHERE id = ?`, [name, name_pt, id]);
        res.json({ message: 'Ingrediente atualizado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/ingredients/:table/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { table, id } = req.params;
        const validTables = ['fermentables', 'hops', 'yeasts', 'miscs'];
        if (!validTables.includes(table)) return res.status(400).json({ error: 'Tabela inválida' });
        
        await ingredientsPool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
        res.json({ message: 'Ingrediente deletado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/firmware/version.json', (req, res) => {
    try {
        const filePath = path.resolve(__dirname, 'firmware/version.json');
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).json({ version: "0.0.0" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

app.get('/firmware/update.bin', (req, res) => {
    try {
        const filePath = path.resolve(__dirname, 'firmware/update.bin');
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).send('Firmware update not found');
        }
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// ==========================================
// ADMIN E ESTATÍSTICAS
// ==========================================

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[{ total_users }]] = await pool.execute('SELECT COUNT(*) as total_users FROM users');
        const [[{ total_devices }]] = await pool.execute('SELECT COUNT(*) as total_devices FROM devices');
        const [[{ active_batches }]] = await pool.execute('SELECT COUNT(*) as active_batches FROM batches WHERE is_active = 1');
        const [[{ online_devices }]] = await pool.execute('SELECT COUNT(*) as online_devices FROM devices WHERE last_seen > NOW() - INTERVAL 1 HOUR');
        res.json({ total_users, total_devices, active_batches, online_devices });
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(d.id) as device_count 
            FROM users u LEFT JOIN devices d ON u.id = d.user_id GROUP BY u.id ORDER BY u.id DESC
        `);
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
        res.status(201).json({ message: 'Criado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await pool.execute('UPDATE users SET name = ?, email = ?, password_hash = ?, role = ? WHERE id = ?', [name, email, hash, role, req.params.id]);
        } else {
            await pool.execute('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, req.params.id]);
        }
        res.json({ message: 'Atualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Cascade delete telemetry from this user's devices
        const [devices] = await pool.execute('SELECT id FROM devices WHERE user_id = ?', [req.params.id]);
        if (devices.length > 0) {
            const deviceIds = devices.map(d => d.id).join(',');
            await pool.execute(`DELETE FROM telemetry WHERE device_id IN (${deviceIds})`);
        }
        // DB constraints will cascade delete devices, batches, events
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deletado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [devices] = await pool.execute('SELECT * FROM devices');
        res.json(devices);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { serial_code, device_name, user_id } = req.body;
        await pool.execute('INSERT INTO devices (serial_code, device_name, user_id) VALUES (?, ?, ?)', [serial_code.trim().toUpperCase(), device_name, user_id]);
        res.status(201).json({ message: 'Criado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/devices/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { serial_code, device_name, user_id } = req.body;
        await pool.execute('UPDATE devices SET serial_code = ?, device_name = ?, user_id = ? WHERE id = ?', [serial_code.trim().toUpperCase(), device_name, user_id, req.params.id]);
        res.json({ message: 'Atualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/devices/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [req.params.id]);
        await pool.execute('DELETE FROM devices WHERE id = ?', [req.params.id]);
        res.json({ message: 'Removido' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SERVER TERMINAL & BACKLOG
app.get('/api/admin/server/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { stdout } = await execPromise('pm2 jlist');
        res.json(JSON.parse(stdout));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// BI & ANALYTICS
// ==========================================
app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[{ mau }]] = await pool.execute('SELECT COUNT(DISTINCT user_id) as mau FROM devices WHERE last_seen > NOW() - INTERVAL 30 DAY');
        const [[{ zombies }]] = await pool.execute('SELECT COUNT(*) as zombies FROM devices WHERE last_seen < NOW() - INTERVAL 30 DAY OR last_seen IS NULL');
        const [growth] = await pool.execute("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as users FROM users GROUP BY month ORDER BY month ASC LIMIT 12");
        const [firmwares] = await pool.execute('SELECT firmware_version as name, COUNT(*) as count FROM devices WHERE firmware_version IS NOT NULL GROUP BY firmware_version');
        res.json({ mau, zombies, growth, firmwares });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/financials', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT plan_type, COUNT(*) as count FROM users GROUP BY plan_type');
        let free = 0; let premium = 0;
        users.forEach(u => {
            if (u.plan_type === 'premium') premium = u.count;
            else free = u.count;
        });
        const mrr = premium * 29.90; // Exemplo: R$ 29,90 por premium
        res.json({ free, premium, mrr });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/batch-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM batches WHERE is_active = 0');
        const [[{ success }]] = await pool.execute('SELECT COUNT(*) as success FROM batches WHERE is_active = 0 AND DATEDIFF(ended_at, started_at) > 1');
        res.json({ total, success, abandoned: total - success });
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/push-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[{ total_users }]] = await pool.execute('SELECT COUNT(*) as total_users FROM users');
        const [[{ opt_in }]] = await pool.execute('SELECT COUNT(DISTINCT user_id) as opt_in FROM push_subscriptions');
        res.json({ total_users, opt_in });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/broadcast-push', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, message } = req.body;
        const [subs] = await pool.execute('SELECT user_id FROM push_subscriptions GROUP BY user_id');
        let sent = 0;
        for (const sub of subs) {
            await sendPushToUser(pool, sub.user_id, title, message);
            sent++;
        }
        res.json({ success: true, sent });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/community-trends', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [styles] = await pool.execute(`
            SELECT style as name, 
                   COUNT(*) as count, 
                   AVG(DATEDIFF(IFNULL(ended_at, NOW()), started_at)) as avg_days,
                   AVG(CAST(og AS FLOAT)) as avg_og,
                   AVG(CAST(fg AS FLOAT)) as avg_fg
            FROM batches 
            WHERE style IS NOT NULL AND style != "" 
            GROUP BY style 
            ORDER BY count DESC 
            LIMIT 10
        `);
        const enriched = styles.map(s => {
            const og = parseFloat(s.avg_og);
            const fg = parseFloat(s.avg_fg);
            let abv = 0;
            if (og > 1 && fg > 0.99) abv = (og - fg) * 131.25;
            return { ...s, abv: abv > 0 ? abv.toFixed(1) : '-' };
        });
        res.json(enriched);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/trends', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[{ total_batches }]] = await pool.execute('SELECT COUNT(*) as total_batches FROM batches');
        const [styles] = await pool.execute('SELECT style as name, COUNT(*) as count FROM batches WHERE style IS NOT NULL AND style != "" GROUP BY style ORDER BY count DESC LIMIT 5');
        res.json({ total_batches, styles });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/map', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Fallback para quem não tem localização (Média Brasil)
        const [locations] = await pool.execute('SELECT u.name, IFNULL(u.lat, -23.5505) as lat, IFNULL(u.lon, -46.6333) as lon, MAX(d.last_seen) as last_seen FROM users u JOIN devices d ON u.id = d.user_id GROUP BY u.id');
        res.json(locations);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/server/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { stdout, stderr } = await execPromise('pm2 logs breww-server --nostream --lines 100');
        res.send(stdout + '\n' + stderr);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// BROADCASTS & LOGS
app.get('/api/admin/audit', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [logs] = await pool.execute('SELECT a.*, u.name as user_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 100');
        res.json(logs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/broadcasts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [broadcasts] = await pool.execute('SELECT * FROM system_broadcasts ORDER BY created_at DESC');
        res.json(broadcasts);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/broadcasts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, message, type, is_active, send_push } = req.body;
        await pool.execute('INSERT INTO system_broadcasts (title, message, type, is_active) VALUES (?, ?, ?, ?)', [title, message, type, is_active ? 1 : 0]);
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'CREATE_BROADCAST', `Title: ${title}`, req.ip]);
        
        if (send_push) {
            // Find all active subscriptions and push
            const [subs] = await pool.execute('SELECT DISTINCT user_id FROM push_subscriptions');
            for (const sub of subs) {
                sendPushToUser(pool, sub.user_id, title || 'Aviso da Plataforma', message);
            }
        }
        res.status(201).json({ message: 'Enviado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/broadcasts/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        await pool.execute('UPDATE system_broadcasts SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
        res.json({ message: 'Atualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/broadcasts/active', async (req, res) => {
    try {
        const [broadcasts] = await pool.execute('SELECT * FROM system_broadcasts WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
        res.json(broadcasts[0] || null);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get(/(.*)/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// --- MAGIC PREDICTION (Fim da Fermentação) ---
const MAGIC_PREDICTION_INTERVAL = 60 * 60 * 1000; // Roda a cada 1 hora
setInterval(async () => {
    try {
        const [batches] = await pool.execute(`SELECT b.id, b.name, b.user_id, b.fg FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1`);
        
        for (const batch of batches) {
            if (!batch.fg) continue; // Sem FG esperado
            const targetFg = parseFloat(batch.fg);
            if (isNaN(targetFg)) continue;
            
            // Já alertou?
            if (alertState[`magic_${batch.id}`]) continue;
            
            // Pega dados das últimas 48h
            const [rows] = await pool.execute(`SELECT gravity, recorded_at FROM telemetry WHERE batch_id = ? AND gravity IS NOT NULL AND gravity > 0 AND recorded_at > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY recorded_at ASC`, [batch.id]);
            
            if (rows.length < 5) continue;
            
            const first = rows[0];
            const last = rows[rows.length - 1];
            
            const hoursDiff = (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / (1000 * 60 * 60);
            if (hoursDiff < 6) continue; // Precisa de pelo menos 6 horas de dados
            
            const sgDrop = first.gravity - last.gravity;
            if (sgDrop <= 0.001) continue; // Queda insignificante
            
            const dropRatePerHour = sgDrop / hoursDiff;
            const remainingDrop = last.gravity - targetFg;
            
            if (remainingDrop > 0 && dropRatePerHour > 0) {
                const hoursRemaining = remainingDrop / dropRatePerHour;
                
                // Se faltar 24h ou menos, avisa o usuário
                if (hoursRemaining > 0 && hoursRemaining <= 24) {
                    alertState[`magic_${batch.id}`] = true;
                    await sendPushToUser(batch.user_id, 'Previsão Mágica 🔮', `Atenção! Sua ${batch.name} deve atingir o FG esperado (${batch.fg}) nas próximas ${Math.round(hoursRemaining)} horas!`);
                    console.log(`[Magic Prediction] Alerta enviado para lote ${batch.id} (${batch.name}) - ETA: ${hoursRemaining}h`);
                }
            }
        }
    } catch (e) {
        console.error('Magic Prediction Error:', e);
    }
}, MAGIC_PREDICTION_INTERVAL);

app.listen(PORT, () => { console.log(`🚀 Servidor BATCH MANAGER + RECIPES + REACTIVE rodando na porta ${PORT}`); });