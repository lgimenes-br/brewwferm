import { Sentry, sentryEnabled } from './instrument.js'; // primeiro: monitor de erros (sem SENTRY_DSN, desligado)
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { exec } from 'child_process';
import util from 'util';
import 'dotenv/config'; // <--- ISSO CARREGA O ARQUIVO .ENV

const execPromise = util.promisify(exec);
import { sendPushToUser } from './pushService.js';
import { deviceRegistry } from './services/deviceRegistry.js';
import { runTelemetryRetention } from './services/telemetryRetention.js';
import { FREE_MAX_DEVICES } from './services/plans.js';
import { buildCarryCommands } from './services/carrySettings.js';
import { isSafeExternalWebhookUrl, authRateLimiter, securityHeadersMiddleware } from './utils/securityHelpers.js';
import { registerVoiceRoutes } from './routes/voiceRoutes.js';
import { registerIngredientRoutes } from './routes/ingredientRoutes.js';
import { registerAuthRecoveryRoutes } from './routes/authRecoveryRoutes.js';
import { registerAdminRoutes } from './routes/adminRoutes.js';
import { registerPairingRoutes } from './routes/pairingRoutes.js';
import { registerLiveRoutes } from './routes/liveRoutes.js';
import { registerFirmwareRoutes } from './routes/firmwareRoutes.js';
import { registerLibraryRoutes } from './routes/libraryRoutes.js';
import { createMqttProvisioner, removeMqttCredential } from './services/mqttCredentials.js';
import { registerDeviceDiagnostics } from './services/deviceDiagnostics.js';
import { registerAppAuthRoutes } from './routes/appAuthRoutes.js';
import { dropStaleIspindel } from './services/ispindelFreshness.js';
import { decideProfileSync, createProfileLiveStore, hasRemoteProfileSupport, toDeviceSteps, PROFILE_SYNC_MIN_INTERVAL_MS } from './services/profileSync.js';
import { registerAppleAuthRoutes, createAppleKeyStore, appleAudiences, verifyAppleToken } from './routes/appleAuthRoutes.js';
import { registerIdentityRoutes, ensureIdentityTable, findUserIdByIdentity, linkIdentity, hasRealPassword, verifyGoogleAccessToken, DEFAULT_GOOGLE_CLIENT_ID } from './routes/identityRoutes.js';
import { registerAppPushRoutes } from './services/appPush.js';
import { startSmartScheduler } from './services/smartScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET; // <--- Lê do .env

if (!process.env.DB_PASS || !process.env.JWT_SECRET) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente (.env) não configuradas.");
    process.exit(1);
}

app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '512kb' }));
app.use(securityHeadersMiddleware);

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

// Inicialização de Tabelas (Base Schema + Migrações Seguras)
// Contas na lixeira (ver loadTrashedUsers / authenticateToken)
const trashedUsers = new Set();
// Aparelhos substituidos com configuracoes a aplicar na primeira telemetria
const pendingCarry = new Set();

const runMigration = async (sql) => {
    try {
        await pool.execute(sql);
    } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_DUP_KEYNAME' && e.code !== 'ER_DUP_ENTRY') {
            console.error(`⚠️ [DB Migration] (${sql}):`, e.message);
        }
    }
};

const initDb = async () => {
    try {
        await pool.execute(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'user', plan_type ENUM('free', 'premium') DEFAULT 'free', max_devices INT DEFAULT ${FREE_MAX_DEVICES}, lat FLOAT DEFAULT NULL, lon FLOAT DEFAULT NULL, brewfather_webhook_url VARCHAR(255) DEFAULT NULL, alert_config JSON DEFAULT NULL, created_at DATETIME DEFAULT NOW())`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS devices (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, serial_code VARCHAR(100) NOT NULL UNIQUE, device_name VARCHAR(100), sensor1_name VARCHAR(50) DEFAULT 'Fermentador', sensor2_name VARCHAR(50) DEFAULT 'Geladeira', sensor_sg_name VARCHAR(50) DEFAULT 'Gravidade', chopp_name VARCHAR(100) DEFAULT 'Barril de Chopp', firmware_version VARCHAR(20) DEFAULT NULL, last_seen DATETIME DEFAULT NULL, created_at DATETIME DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS device_keys (serial_code VARCHAR(100) PRIMARY KEY, key_hash CHAR(64) NOT NULL, last_public_ip VARCHAR(64) DEFAULT NULL, last_seen DATETIME DEFAULT NULL, created_at DATETIME DEFAULT NOW())`);
        // Chaves ainda nao confirmadas no aparelho (pareamento seguro; ver routes/pairingRoutes.js)
        await pool.execute(`CREATE TABLE IF NOT EXISTS device_key_candidates (serial_code VARCHAR(100) NOT NULL, key_hash CHAR(64) NOT NULL, pair_code CHAR(8) NOT NULL, last_public_ip VARCHAR(64) DEFAULT NULL, first_seen DATETIME DEFAULT NOW(), last_seen DATETIME DEFAULT NOW(), PRIMARY KEY (serial_code, key_hash))`);
        // Limpeza pontual: serial ficticio registrado por engano num teste em producao (11/11/2026),
        // antes do pareamento seguro entrar no ar. So apaga se nao estiver vinculado a ninguem.
        for (const serial of ['TESTE0000001']) {
            const [owned] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? LIMIT 1', [serial]);
            if (!owned.length) {
                await pool.execute('DELETE FROM device_keys WHERE serial_code = ?', [serial]).catch(() => {});
                await pool.execute('DELETE FROM device_key_candidates WHERE serial_code = ?', [serial]).catch(() => {});
                await removeMqttCredential(serial).catch(e => console.error('Limpeza MQTT:', e?.message || e));
            }
        }
        // Candidatas abandonadas (nunca confirmadas) somem depois de 30 dias
        await pool.execute('DELETE FROM device_key_candidates WHERE last_seen < DATE_SUB(NOW(), INTERVAL 30 DAY)').catch(() => {});
        await pool.execute(`CREATE TABLE IF NOT EXISTS batches (id INT AUTO_INCREMENT PRIMARY KEY, device_id INT NOT NULL, name VARCHAR(150) NOT NULL, style VARCHAR(100), og VARCHAR(20), fg VARCHAR(20), volume FLOAT DEFAULT 20, profile JSON, ingredients JSON, public_token VARCHAR(64) DEFAULT NULL, current_step_index INT DEFAULT 0, step_started_at DATETIME DEFAULT NULL, started_at DATETIME DEFAULT NOW(), ended_at DATETIME DEFAULT NULL, is_active BOOLEAN DEFAULT 1, FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS telemetry (id INT AUTO_INCREMENT PRIMARY KEY, device_id INT NOT NULL, batch_id INT DEFAULT NULL, temp_ferm FLOAT, temp_amb FLOAT, target_temp FLOAT, gravity FLOAT, battery FLOAT, status_op VARCHAR(50), step_name VARCHAR(100), rssi INT DEFAULT NULL, extra_sensors JSON, recorded_at DATETIME DEFAULT NOW(), FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS batch_events (id INT AUTO_INCREMENT PRIMARY KEY, batch_id INT NOT NULL, event_type VARCHAR(50) NOT NULL, description TEXT, recorded_at DATETIME NOT NULL, FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS recipes (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, name VARCHAR(100) NOT NULL, style VARCHAR(100), est_og VARCHAR(10), est_fg VARCHAR(10), created_at DATETIME DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS recipe_steps (id INT AUTO_INCREMENT PRIMARY KEY, recipe_id INT NOT NULL, step_order INT NOT NULL, name VARCHAR(50), temperature FLOAT, days INT, trigger_gravity FLOAT DEFAULT NULL, FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, endpoint TEXT NOT NULL, p256dh VARCHAR(255), auth VARCHAR(255), created_at DATETIME DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS system_broadcasts (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), message TEXT NOT NULL, type VARCHAR(50) DEFAULT 'info', is_active BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT NOW())`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS audit_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, action VARCHAR(100) NOT NULL, details TEXT, ip_address VARCHAR(45), created_at DATETIME DEFAULT NOW())`);

        // Migrations for existing installations
        await runMigration('ALTER TABLE telemetry ADD COLUMN extra_sensors JSON');
        await runMigration('ALTER TABLE users ADD COLUMN plan_type ENUM("free", "premium") DEFAULT "free"');
        await runMigration('ALTER TABLE users ADD COLUMN max_devices INT DEFAULT 1');
        // Plano gratis: ate FREE_MAX_DEVICES aparelhos (era 1). Contas novas pelo padrao da coluna; as gratis existentes sobem.
        await runMigration(`ALTER TABLE users ALTER COLUMN max_devices SET DEFAULT ${FREE_MAX_DEVICES}`);
        await runMigration(`UPDATE users SET max_devices = ${FREE_MAX_DEVICES} WHERE plan_type = 'free' AND (max_devices IS NULL OR max_devices < ${FREE_MAX_DEVICES})`);
        await runMigration('ALTER TABLE telemetry ADD COLUMN rssi INT DEFAULT NULL');
        await runMigration('ALTER TABLE users ADD COLUMN lat FLOAT DEFAULT NULL');
        await runMigration('ALTER TABLE users ADD COLUMN lon FLOAT DEFAULT NULL');
        await runMigration('ALTER TABLE devices ADD COLUMN firmware_version VARCHAR(20) DEFAULT NULL');
        // Frota (admin): placa e hardware detectado, vindos da telemetria (firmware 2.9+)
        await runMigration('ALTER TABLE devices ADD COLUMN board VARCHAR(32) DEFAULT NULL');
        // Lixeira de contas (admin): conta "excluida" fica 30 dias sem login, podendo ser restaurada
        await runMigration('ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL');
        await loadTrashedUsers();
        await runMigration('ALTER TABLE devices ADD COLUMN hw_modules VARCHAR(255) DEFAULT NULL');
        // Substituir aparelho: configuracoes da placa antiga a aplicar na nova (services/carrySettings.js)
        await runMigration('ALTER TABLE devices ADD COLUMN pending_settings VARCHAR(255) DEFAULT NULL');
        try {
            const [ps] = await pool.execute('SELECT serial_code FROM devices WHERE pending_settings IS NOT NULL');
            for (const r of ps) pendingCarry.add(String(r.serial_code).toUpperCase());
        } catch (e) { console.error('pending_settings:', e.message); }
        await runMigration('ALTER TABLE batches ADD COLUMN public_token VARCHAR(64) DEFAULT NULL');
        await runMigration('ALTER TABLE batches ADD COLUMN volume FLOAT DEFAULT 20');
        await runMigration('ALTER TABLE recipe_steps ADD COLUMN trigger_gravity FLOAT DEFAULT NULL');
        await runMigration('ALTER TABLE users ADD COLUMN brewfather_webhook_url VARCHAR(255) DEFAULT NULL');
        await runMigration('ALTER TABLE users ADD COLUMN alert_config JSON DEFAULT NULL');
        await runMigration('ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(64) DEFAULT NULL');
        await runMigration('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL');
        await runMigration('ALTER TABLE batches ADD COLUMN ingredients JSON');
        await runMigration(`ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'`);
        await runMigration(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) DEFAULT NULL`);
        // Logins vinculados (Google/Apple) + migracao das contas antigas
        await ensureIdentityTable(pool).catch(e => console.error('⚠️ [DB Migration] user_identities:', e.message));
        await runMigration(`ALTER TABLE devices ADD COLUMN sensor1_name VARCHAR(50) DEFAULT 'Fermentador'`);
        await runMigration(`ALTER TABLE devices ADD COLUMN sensor2_name VARCHAR(50) DEFAULT 'Geladeira'`);
        await runMigration(`ALTER TABLE devices ADD COLUMN sensor_sg_name VARCHAR(50) DEFAULT 'Gravidade'`);
        await runMigration(`ALTER TABLE devices ADD COLUMN chopp_name VARCHAR(100) DEFAULT 'Barril de Chopp'`);
        await runMigration(`ALTER TABLE batches ADD COLUMN current_step_index INT DEFAULT 0`);
        await runMigration(`ALTER TABLE batches ADD COLUMN step_started_at DATETIME`);
        await runMigration(`CREATE INDEX idx_telemetry_batch ON telemetry(batch_id)`);
        await runMigration(`CREATE INDEX idx_telemetry_device ON telemetry(device_id)`);
        await runMigration(`CREATE INDEX idx_telemetry_device_id_desc ON telemetry(device_id, id)`);
        // Retencao da telemetria: lote ja compactado + indice para graficos/compactacao por lote
        await runMigration('ALTER TABLE batches ADD COLUMN telemetry_compacted_at DATETIME DEFAULT NULL');
        await runMigration(`CREATE INDEX idx_telemetry_batch_time ON telemetry(batch_id, recorded_at)`);
        await runMigration(`CREATE INDEX idx_batches_device_active ON batches(device_id, is_active)`);
        await runMigration(`CREATE INDEX idx_batches_public_token ON batches(public_token)`);
        await runMigration(`CREATE INDEX idx_batch_events_batch_recorded ON batch_events(batch_id, recorded_at)`);
        await runMigration(`CREATE UNIQUE INDEX idx_devices_serial_unique ON devices(serial_code)`);
        await runMigration(`DELETE FROM devices WHERE serial_code = 'ESP32-VIRTUAL-01'`);

        // Localizacao por IP (servico externo) removida em 12/11/2026: apaga as cidades guardadas antes
        await runMigration('UPDATE users SET lat = NULL, lon = NULL WHERE lat IS NOT NULL OR lon IS NOT NULL');
        console.log('✅ [DB] Schema base e migrações verificados.');
    } catch (e) { console.error('❌ Erro DB Init:', e); }
};
const dbReady = initDb();

let activeBatches = {};
const activeBatchesUserId = {}; // Para saber quem notificar
const alertState = {}; // Controle de alertas enviados

const loadActiveBatches = async () => {
    try {
        const [rows] = await pool.execute('SELECT b.id, d.user_id, d.serial_code FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1 ORDER BY b.id ASC');
        const newMap = {};
        for (const key in activeBatchesUserId) delete activeBatchesUserId[key];
        
        for (const row of rows) {
            if (row.serial_code) {
                const serial = row.serial_code.trim().toUpperCase();
                newMap[serial] = row.id;
                activeBatchesUserId[serial] = row.user_id;
            }
        }
        activeBatches = newMap;
        console.log('🍺 [System] Cache de Lotes:', activeBatches);
    } catch (e) { console.error('❌ Erro Cache:', e); }
};
loadActiveBatches();

const lastLogTimes = {};
const lastSeenTimes = {};
const lastBrewfatherPushTimes = {};
const userAlertConfigs = {};
const DEFAULT_ALERT_CONFIG = {
    lowBatteryEnabled: true,
    lowBatteryThreshold: 3.5,
    tempDeviationEnabled: true,
    tempDeviationMargin: 1.5,
    sgTargetEnabled: true,
    sgTargetValue: null,
    telegramBotToken: '',
    telegramChatId: ''
};
const getUserAlertConfig = async (userId) => {
    const cached = userAlertConfigs[userId];
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.cfg;
    try {
        const [rows] = await pool.execute('SELECT alert_config FROM users WHERE id = ?', [userId]);
        const raw = rows?.[0]?.alert_config;
        const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        const cfg = { ...DEFAULT_ALERT_CONFIG, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
        userAlertConfigs[userId] = { cfg, ts: Date.now() };
        return cfg;
    } catch (e) {
        return { ...DEFAULT_ALERT_CONFIG };
    }
};
const discoveredUnknowns = {}; // Cache for unknown devices detected via MQTT 
const sanitizeNum = (val, precision) => {
    const num = parseFloat(val);
    if (val === null || val === undefined || val === '' || isNaN(num) || !isFinite(num)) return null;
    return num.toFixed(precision);
};

// Shared Gravity Normalizer (converts > 500 e.g. 1050 -> 1.050)
const normalizeGravityVal = (val) => {
    const n = parseFloat(val);
    if (isNaN(n) || !isFinite(n) || n <= 0) return 0;
    return n > 500 ? n / 1000 : n;
};

// Shared Profile -> ESP32 Steps Converter ({ n, t, d: days * 24 })
const toEsp32Steps = (profile) => (Array.isArray(profile) ? profile : []).map(step => ({
    n: step.name || step.n,
    t: step.temperature ?? step.t,
    d: (step.duration !== undefined ? step.duration : (step.d || 1)) * 24 // ESP32 expects hours
}));

// Normalizes profile arrays coming from either the frontend ({ name, temperature, duration })
// or the ESP32 physical wizard ({ n, t, d } where d is in hours) into standard days-based steps
const normalizeIncomingProfile = (rawProfile) => {
    if (!rawProfile) return null;
    let arr = rawProfile;
    if (typeof rawProfile === 'string') {
        try { arr = JSON.parse(rawProfile); } catch (e) { return null; }
    }
    if (!Array.isArray(arr)) return null;
    return arr.map((step, idx) => {
        if (!step || typeof step !== 'object') return step;
        if (step.duration !== undefined) {
            return {
                ...step,
                id: step.id || String(idx + 1),
                name: step.name || step.n || `Etapa ${idx + 1}`,
                temperature: Number(step.temperature ?? step.t ?? 20),
                duration: Number(step.duration)
            };
        }
        // Step came from ESP32 in { n, t, d } format where d is in hours
        const rawHours = Number(step.d);
        const durationDays = !isNaN(rawHours) && rawHours > 0 ? Number((rawHours / 24).toFixed(4)) : 1;
        return {
            id: step.id || String(idx + 1),
            name: step.name || step.n || `Etapa ${idx + 1}`,
            temperature: Number(step.temperature ?? step.t ?? 20),
            duration: durationDays,
            ...(step.triggerGravity !== undefined || step.g !== undefined
                ? { triggerGravity: Number(step.triggerGravity ?? step.g) }
                : {})
        };
    });
};

// Shared Batch Step Advancement Helper (used by Smart Scheduler & live SG Trigger)
const advanceBatchStep = async ({ batchId, serialCode, userId, profile, newIndex, gravityTriggered, liveSgNorm, trigNorm }) => {
    const nextStep = profile[newIndex] || {};
    await pool.execute(
        'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
        [newIndex, batchId]
    );
    if (serialCode) {
        const payloadSteps = toEsp32Steps(profile);
        const stepCmd = {
            cmd: 'setProfile',
            type: 'setProfile',
            steps: payloadSteps,
            currentStep: newIndex,
            currStep: newIndex,
            stepTime: 0
        };
        const msg = JSON.stringify(stepCmd);
        mqttClient.publish(`brewbrother/${serialCode}/command`, msg);
        mqttClient.publish(`brewbrother/${serialCode}/comando`, msg);
    }
    const nextName = nextStep.name || nextStep.n || `Etapa ${newIndex + 1}`;
    const nextTemp = nextStep.temperature ?? nextStep.t ?? 0;
    if (serialCode) {
        const normSer = String(serialCode).trim().toUpperCase();
        alertState[normSer] = { ...(alertState[normSer] || {}), lastStep: nextName, lastStepIndex: newIndex, lastStepAdvanceTs: Date.now() };
    }
    const desc = gravityTriggered
        ? `Avançou automaticamente por densidade (SG ${Number(liveSgNorm || 0).toFixed(3)} <= ${Number(trigNorm || 0).toFixed(3)}) para a etapa: ${nextName} (${nextTemp}°C)`
        : `Avançou automaticamente para a etapa: ${nextName} (${nextTemp}°C)`;
    await pool.execute(
        'INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, ?, ?, NOW())',
        [batchId, 'SYSTEM_ACTION', desc]
    );
    if (userId) {
        sendPushToUser(pool, userId, gravityTriggered ? 'Avanço por Densidade Atingida 🎯' : 'Avanço Automático de Etapa', desc);
    }
    notifyUpdate(serialCode);
};


// --- 2. MQTT ---
const brokerUrl = process.env.VITE_MQTT_BROKER || 'mqtt://localhost:1883';
console.log(`🔌 [MQTT] Conectando a ${brokerUrl}...`);
if (!process.env.MQTT_USER || process.env.MQTT_USER === 'esp32user') {
    console.warn('⚠️ [MQTT] Backend usando a credencial compartilhada das placas (esp32user). Rode backend/mosquitto/setup-vps-mosquitto.sh para usar breww_server; o ACL atual nao permite que esp32user publique comandos.');
}

const mqttClient = mqtt.connect(brokerUrl, {
    clientId: 'server_pro_' + Math.random().toString(16).substr(2, 8),
    username: process.env.MQTT_USER || 'esp32user',
    password: process.env.MQTT_PASSWORD || 'esp32',
    reconnectPeriod: 5000
    // Note: MQTT.js handles ws/wss protocols automatically based on URL scheme
});

/** Placa nova (substituir aparelho) acabou de falar: manda modo/alvo/tipo de rele da antiga, uma vez. */
const applyCarriedSettings = async (serialCode, deviceId, payload) => {
    pendingCarry.delete(serialCode); // uma vez so, mesmo se algo falhar
    const [rows] = await pool.execute('SELECT pending_settings FROM devices WHERE id = ?', [deviceId]);
    let carry = null;
    try { carry = JSON.parse(rows[0]?.pending_settings || 'null'); } catch { carry = null; }
    await pool.execute('UPDATE devices SET pending_settings = NULL WHERE id = ?', [deviceId]);
    const cmds = buildCarryCommands(carry, { board: payload.board, hasActiveBatch: Boolean(activeBatches[serialCode]) });
    for (const c of cmds) {
        const msg = JSON.stringify(c);
        mqttClient.publish(`brewbrother/${serialCode}/command`, msg);
        mqttClient.publish(`brewbrother/${serialCode}/comando`, msg);
    }
    if (cmds.length) {
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [null, 'CARRY_SETTINGS', `${serialCode}: ${cmds.map(c => c.cmd).join(', ')}`, null]).catch(() => {});
        console.log(`🔁 [Substituir] ${serialCode}: configuracoes da placa antiga aplicadas (${cmds.map(c => c.cmd).join(', ')})`);
    }
};

const notifyUpdate = (serialCode) => {
    mqttClient.publish('brewbrother/global/update', JSON.stringify({
        ts: Date.now(),
        ...(serialCode ? { serial: String(serialCode).trim().toUpperCase() } : {})
    }));
};

// --- PERFIL NO CONTROLADOR (firmware 2.7.0+) ---
// Estado informado pelo controlador (pausa, etapa) e alinhamento com o lote do banco.
const profileLive = createProfileLiveStore();
const lastProfileSyncAt = {};
const syncDeviceProfile = async (serialCode, deviceId, payload, now) => {
    const key = String(serialCode).trim().toUpperCase();
    if (lastProfileSyncAt[key] && now - lastProfileSyncAt[key] < PROFILE_SYNC_MIN_INTERVAL_MS) return;
    const [rows] = await pool.execute(
        'SELECT id, profile, current_step_index, step_started_at FROM batches WHERE device_id = ? AND is_active = 1 LIMIT 1',
        [deviceId]
    );
    if (!rows.length) return;
    const profile = normalizeIncomingProfile(rows[0].profile);
    const decision = decideProfileSync({ payload, profile, dbStepIndex: rows[0].current_step_index, stepStartedAt: rows[0].step_started_at, now });
    if (!decision) return;
    lastProfileSyncAt[key] = now;
    const msg = JSON.stringify({
        cmd: 'setProfile', type: 'setProfile', steps: toDeviceSteps(profile),
        currentStep: decision.currentStep, currStep: decision.currentStep, stepTime: decision.stepTime,
    });
    mqttClient.publish(`brewbrother/${serialCode}/command`, msg);
    mqttClient.publish(`brewbrother/${serialCode}/comando`, msg);
    console.log(`🔁 [Perfil] ${key}: ${decision.reason}; enviado o perfil do lote ${rows[0].id} (etapa ${decision.currentStep}, ${decision.stepTime} h)`);
};

// --- SMART SCHEDULING & MAGIC PREDICTION ---
const smartScheduler = startSmartScheduler({
    pool,
    profileLive,
    advanceBatchStep,
    normalizeGravityVal,
    alertState,
    sendPushToUser
});

mqttClient.on('connect', () => {
    mqttClient.subscribe('brewbrother/+/status');
    mqttClient.subscribe('brewbrother/+/data'); // NOVO: as novas placas enviam para data
    mqttClient.subscribe('brewbrother/+/comando'); // <-- Intercept manual overrides
    mqttClient.subscribe('brewbrother/global/ping');
    mqttClient.subscribe('brewbrother/+/response'); // Para respostas de scan_sensors
    mqttClient.subscribe('brewbrother/+/device_action'); // Ações originadas pelo hardware (ex: iniciar lote)
});

mqttClient.on('message', async (topic, message, packet) => {
    try {
        if (packet && packet.retain) return;
        let payload;
        try { payload = JSON.parse(message.toString()); } catch (e) { return; }
        if (!payload || typeof payload !== 'object') return;
        
        // Intercept responses for Dashboard
        if (topic.endsWith('/response')) {
            return;
        }

        // Intercept actions originated FROM the ESP32 (e.g. physical screen Wizard)
        if (topic.endsWith('/device_action')) {
            const serialCode = topic.split('/')[1];
            const normalizedSerial = serialCode.trim().toUpperCase();
            if (payload.action === 'start_batch') {
                try {
                    const [devs] = await pool.execute('SELECT id, user_id FROM devices WHERE serial_code = ?', [serialCode]);
                    if (devs.length > 0) {
                        const deviceId = devs[0].id;
                        const userId = devs[0].user_id;
                        
                        // Terminar qualquer lote ativo
                        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE device_id = ? AND is_active = 1', [deviceId]);
                        
                        // Criar novo lote (normalizando perfil caso venha em horas {n, t, d} da tela do ESP32)
                        const normalizedProfile = normalizeIncomingProfile(payload.profile);
                        const profileJson = normalizedProfile ? JSON.stringify(normalizedProfile) : null;
                        const name = payload.name || `Lote Físico #${Math.floor(Math.random() * 1000)}`;
                        const style = payload.style || '';
                        
                        const [result] = await pool.execute(
                            'INSERT INTO batches (device_id, name, style, og, fg, profile, started_at, is_active, current_step_index, step_started_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, 0, NOW())',
                            [deviceId, name, style, null, null, profileJson]
                        );
                        
                        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [userId, 'START_BATCH_LOCAL', `Batch: ${name} (Device: ${serialCode})`, 'ESP32']);
                        
                        activeBatches[normalizedSerial] = result.insertId;
                        activeBatchesUserId[normalizedSerial] = userId;
                        notifyUpdate(normalizedSerial);
                        console.log(`🍺 [Device Action] Novo lote ${result.insertId} criado fisicamente na placa ${serialCode}`);
                    }
                } catch (e) {
                    console.error('Failed to create batch from device action:', e);
                }
            } else if (payload.action === 'stop_batch') {
                try {
                    const [devs] = await pool.execute('SELECT id, user_id FROM devices WHERE serial_code = ?', [serialCode]);
                    if (devs.length > 0) {
                        const deviceId = devs[0].id;
                        const activeBatchId = activeBatches[normalizedSerial];
                        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE device_id = ? AND is_active = 1', [deviceId]);
                        
                        delete activeBatches[normalizedSerial];
                        delete activeBatchesUserId[normalizedSerial];
                        if (activeBatchId) delete alertState[`magic_${activeBatchId}`];
                        notifyUpdate(normalizedSerial);
                        console.log(`🍺 [Device Action] Lote fisicamente encerrado na placa ${serialCode}`);
                    }
                } catch (err) {
                    console.error('Error handling stop_batch action:', err);
                }

            }
            return;
        }

        // Intercept Manual Overrides from frontend
        if (topic.endsWith('/comando')) {
            const serialCode = topic.split('/')[1];
            const normSerial = String(serialCode || '').trim().toUpperCase();
            if (payload.type === 'setProfile' && payload.currentStep !== undefined) {
                // Find active batch and update step_started_at only when the step actually changes
                const [batches] = await pool.execute(`
                    SELECT b.id, b.current_step_index FROM batches b JOIN devices d ON b.device_id = d.id 
                    WHERE d.serial_code = ? AND b.is_active = 1 LIMIT 1
                `, [serialCode]);
                if (batches.length > 0 && Number(batches[0].current_step_index) !== Number(payload.currentStep)) {
                    await pool.execute(
                        'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
                        [payload.currentStep, batches[0].id]
                    );
                    alertState[normSerial] = { ...(alertState[normSerial] || {}), lastStepIndex: Number(payload.currentStep), lastStepAdvanceTs: Date.now() };
                    console.log(`⏱️ [Manual Override] Lote ${batches[0].id} alterado para etapa ${payload.currentStep}`);
                }
            } else if (payload.type === 'skipStep') {
                const [batches] = await pool.execute(`
                    SELECT b.id, b.current_step_index FROM batches b JOIN devices d ON b.device_id = d.id 
                    WHERE d.serial_code = ? AND b.is_active = 1 LIMIT 1
                `, [serialCode]);
                if (batches.length > 0) {
                    const nextStep = (Number(batches[0].current_step_index) || 0) + 1;
                    await pool.execute(
                        'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
                        [nextStep, batches[0].id]
                    );
                    alertState[normSerial] = { ...(alertState[normSerial] || {}), lastStepIndex: nextStep, lastStepAdvanceTs: Date.now() };
                    console.log(`⏱️ [Manual Override] Lote ${batches[0].id} avançado para etapa ${nextStep}`);
                }
            }
            return;
        }

        const parts = topic.split('/');
        if (parts.length < 3) return;
        const serialCode = parts[1].trim().toUpperCase();

        // serial -> id em cache; last_seen no banco no maximo 1x/min, firmware so quando muda (services/deviceRegistry.js)
        const deviceId = await deviceRegistry.lookup(pool, serialCode);

        if (deviceId) {
            delete discoveredUnknowns[serialCode];
            await deviceRegistry.touch(pool, serialCode, deviceId, payload.fw || payload.ver, { board: payload.board, mods: payload.mods });
            if (pendingCarry.has(serialCode)) applyCarriedSettings(serialCode, deviceId, payload).catch(e => console.error('Carry:', e.message));

            const now = Date.now();
            lastSeenTimes[serialCode] = now;
            // iSpindel desligado: o controlador repete a ultima leitura; velha nao vale (historico,
            // avanco por densidade, alertas). O repasse ao vivo usa o pacote original.
            dropStaleIspindel(payload, now);
            // Firmware com perfil remoto: guarda pausa/etapa e mantem o controlador alinhado ao lote
            if (hasRemoteProfileSupport(payload)) {
                profileLive.update(serialCode, payload, now);
                syncDeviceProfile(parts[1], deviceId, payload, now).catch(e => console.error('Profile sync error:', e.message));
            }
            const lastLog = lastLogTimes[serialCode] || 0;
            const logInterval = payload.wi || 60000;

            let target = payload.fsm;
            if (payload.csp !== undefined) target = payload.csp;
            else if (payload.opm === 0 && payload.fermRun && payload.steps && payload.steps[payload.currStep]) {
                target = payload.steps[payload.currStep].t;
            }
            const currentBatchId = activeBatches[serialCode] || null;

            let stepSyncedInThisMessage = false;
            if (now - lastLog >= logInterval) {
                // Sync ESP32 step with Database
                if (currentBatchId && payload.currStep !== undefined && payload.opm === 0 && payload.fermRun) {
                    try {
                        const [bRows] = await pool.execute('SELECT current_step_index FROM batches WHERE id = ?', [currentBatchId]);
                        if (bRows.length > 0) {
                            const dbStep = bRows[0].current_step_index || 0;
                            if (payload.currStep > dbStep) {
                                await pool.execute('UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?', [payload.currStep, currentBatchId]);
                                console.log(`🔄 [Sync] Lote ${currentBatchId} sincronizado com ESP32 para etapa ${payload.currStep}`);
                                
                                const desc = `Sincronizado com o equipamento para a etapa: ${payload.profStat || payload.currStep}`;
                                await pool.execute(
                                    'INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, ?, ?, NOW())',
                                    [currentBatchId, 'SYSTEM_ACTION', desc]
                                );
                                stepSyncedInThisMessage = true;
                            }
                        }
                    } catch (e) { console.error('Sync error:', e); }
                }

                let finalGravity = sanitizeNum(payload.is_sg, 3);
                // O ESP32 envia 0 quando não tem leitura do iSpindel. Tratamos como nulo.
                if ((finalGravity === null || parseFloat(finalGravity) === 0) && currentBatchId) {
                    try {
                        const [lastRow] = await pool.execute('SELECT gravity FROM telemetry WHERE batch_id = ? AND gravity IS NOT NULL AND gravity > 0 ORDER BY id DESC LIMIT 1', [currentBatchId]);
                        if (lastRow.length > 0) {
                            finalGravity = lastRow[0].gravity;
                        }
                    } catch (err) {
                        console.error('Failed to get last gravity', err);
                    }
                }

                // Instant Gravity-Triggered Step Advancement on live SG reading
                if (currentBatchId && !stepSyncedInThisMessage && payload.isPaused !== true && payload.is_sg && parseFloat(payload.is_sg) > 0) {
                    try {
                        const liveSgNorm = normalizeGravityVal(payload.is_sg);
                        if (liveSgNorm > 0.980) {
                            const [bProfRows] = await pool.execute('SELECT profile, current_step_index FROM batches WHERE id = ?', [currentBatchId]);
                            if (bProfRows.length > 0 && bProfRows[0].profile) {
                                const prof = typeof bProfRows[0].profile === 'string' ? JSON.parse(bProfRows[0].profile) : bProfRows[0].profile;
                                const curIdx = Number(bProfRows[0].current_step_index) || 0;
                                if (Array.isArray(prof) && curIdx < prof.length - 1) {
                                    const curStepObj = prof[curIdx];
                                    const trigNorm = normalizeGravityVal(curStepObj?.triggerGravity ?? curStepObj?.g);
                                    if (trigNorm > 0 && liveSgNorm <= trigNorm) {
                                        const nextIdx = curIdx + 1;
                                        await advanceBatchStep({
                                            batchId: currentBatchId,
                                            serialCode: parts[1],
                                            userId: activeBatchesUserId[serialCode],
                                            profile: prof,
                                            newIndex: nextIdx,
                                            gravityTriggered: true,
                                            liveSgNorm,
                                            trigNorm
                                        });
                                        stepSyncedInThisMessage = true;
                                    }
                                }
                            }
                        }
                    } catch (gErr) {
                        console.error('Gravity trigger check error:', gErr);
                    }
                }

                let dateSQL = 'NOW()';
                let extraSensorsJSON = payload.ext_s ? JSON.stringify(payload.ext_s) : null;
                let queryArgs = [deviceId, currentBatchId, sanitizeNum(payload.ferm, 1), sanitizeNum(payload.amb, 1), sanitizeNum(target, 1), finalGravity, sanitizeNum(payload.is_bat, 2), payload.statOp ?? null, payload.profStat ?? null, payload.rssi ?? null, extraSensorsJSON];
                
                // Apenas confia no timestamp do ESP32 se ele for maior que o ano 2020 (NTP Sincronizado)
                if (payload.ts && payload.ts > 1600000000) {
                    dateSQL = 'FROM_UNIXTIME(?)';
                    queryArgs.push(payload.ts);
                }

                await pool.execute(
                    `INSERT INTO telemetry (device_id, batch_id, temp_ferm, temp_amb, target_temp, gravity, battery, status_op, step_name, rssi, extra_sensors, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${dateSQL})`,
                    queryArgs
                ).catch((err) => { 
                    console.error("❌ Telemetry Insert Error:", err.message); 
                });
                lastLogTimes[serialCode] = now;

                // Forward to Brewfather Custom Stream if user configured a webhook URL (every 15 mins per Brewfather rate limit)
                const bfOwnerId = activeBatchesUserId[serialCode];
                if (bfOwnerId && currentBatchId && (now - (lastBrewfatherPushTimes[serialCode] || 0) >= 15 * 60 * 1000)) {
                    lastBrewfatherPushTimes[serialCode] = now;
                    pool.execute('SELECT brewfather_webhook_url FROM users WHERE id = ?', [bfOwnerId])
                        .then(([uRows]) => {
                            const webhookUrl = uRows?.[0]?.brewfather_webhook_url;
                            if (webhookUrl && isSafeExternalWebhookUrl(webhookUrl)) {
                                const bfPayload = {
                                    name: `Breww-${serialCode}`,
                                    temp: parseFloat(sanitizeNum(payload.ferm, 1)) || 0,
                                    aux_temp: parseFloat(sanitizeNum(payload.amb, 1)) || 0,
                                    temp_unit: 'C',
                                    ...(finalGravity && parseFloat(finalGravity) > 0 ? { gravity: parseFloat(finalGravity), gravity_unit: 'G' } : {}),
                                    ...(payload.is_bat && parseFloat(payload.is_bat) > 0 ? { battery: parseFloat(sanitizeNum(payload.is_bat, 2)) } : {}),
                                    comment: payload.profStat || 'Breww Dashboard'
                                };
                                fetch(webhookUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(bfPayload)
                                }).catch(err => console.error('Brewfather webhook forward error:', err.message));
                            }
                        })
                        .catch(() => {});
                }
            }

            // --- Lógica de Alertas Push ---
            const userId = activeBatchesUserId[serialCode];
            if (userId) {
                if (!alertState[serialCode]) alertState[serialCode] = {};
                const userCfg = await getUserAlertConfig(userId);
                const tempMargin = Math.max(0.2, parseFloat(userCfg.tempDeviationMargin) || 1.5);
                
                // Alerta de Temperatura
                const tempFerm = parseFloat(payload.ferm);
                const targetTemp = parseFloat(sanitizeNum(target, 1));
                if (userCfg.tempDeviationEnabled !== false && !isNaN(tempFerm) && !isNaN(targetTemp) && payload.opm === 0) {
                    if (Math.abs(tempFerm - targetTemp) > tempMargin) {
                        if (!alertState[serialCode].tempAlertStartTime) {
                            alertState[serialCode].tempAlertStartTime = now;
                        } else if (now - alertState[serialCode].tempAlertStartTime > 15 * 60 * 1000) { // 15 min
                            if (!alertState[serialCode].tempAlertSent) {
                                sendPushToUser(pool, userId, 'Alerta de Temperatura', `Cerveja fora da temperatura alvo: ${tempFerm}ºC (Alvo: ${targetTemp}ºC ±${tempMargin}ºC)`);
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

                // Alerta de Bateria Fraca do iSpindel / Densímetro (< lowBatteryThreshold, padrão 3.5V)
                const batVal = parseFloat(payload.is_bat);
                const batThreshold = Math.max(2.8, Math.min(4.2, parseFloat(userCfg.lowBatteryThreshold) || 3.5));
                if (userCfg.lowBatteryEnabled !== false && !isNaN(batVal) && batVal > 2.0) {
                    if (batVal < batThreshold) {
                        if (!alertState[serialCode].lowBatAlertTime || (now - alertState[serialCode].lowBatAlertTime > 12 * 60 * 60 * 1000)) {
                            sendPushToUser(
                                pool,
                                userId,
                                'Alerta de Bateria Fraca 🪫',
                                `A bateria do densímetro (${serialCode}) caiu para ${batVal.toFixed(2)}V (Limite: ${batThreshold.toFixed(2)}V).`
                            );
                            alertState[serialCode].lowBatAlertTime = now;
                        }
                    } else if (batVal >= batThreshold + 0.1) {
                        alertState[serialCode].lowBatAlertTime = null;
                    }
                }

                // Alerta de Densidade Alvo Customizada
                const rawLiveSg = parseFloat(payload.is_sg);
                const liveSgVal = !isNaN(rawLiveSg) && rawLiveSg > 0 ? (rawLiveSg > 500 ? rawLiveSg / 1000 : rawLiveSg) : 0;
                const rawTargetSg = parseFloat(userCfg.sgTargetValue);
                const targetSgVal = !isNaN(rawTargetSg) && rawTargetSg > 0 ? (rawTargetSg > 500 ? rawTargetSg / 1000 : rawTargetSg) : 0;
                if (userCfg.sgTargetEnabled !== false && liveSgVal > 0.980 && targetSgVal > 0.980 && liveSgVal <= targetSgVal) {
                    if (alertState[serialCode].sgTargetAlertValue !== targetSgVal) {
                        sendPushToUser(
                            pool,
                            userId,
                            'Densidade Alvo Atingida 🎯',
                            `O mosto no controlador ${serialCode} atingiu SG ${liveSgVal.toFixed(3)} (Alvo configurado: ${targetSgVal.toFixed(3)}).`
                        );
                        alertState[serialCode].sgTargetAlertValue = targetSgVal;
                    }
                }

                // Alerta de Mudança de Passo (ignora eco imediato de avanço já registrado pelo servidor ou pela UI)
                if (payload.opm === 0 && payload.profStat) {
                    const alreadyHandledAdvance =
                        stepSyncedInThisMessage ||
                        (alertState[serialCode].lastStepAdvanceTs && (now - alertState[serialCode].lastStepAdvanceTs < 120000)) ||
                        (payload.currStep !== undefined && alertState[serialCode].lastStepIndex !== undefined && Number(payload.currStep) === Number(alertState[serialCode].lastStepIndex));
                    if (alertState[serialCode].lastStep && alertState[serialCode].lastStep !== payload.profStat && !alreadyHandledAdvance) {
                        sendPushToUser(pool, userId, 'Mudança de Passo', `O fermentador iniciou o passo: ${payload.profStat}`);
                        
                        // Sincroniza a mudança de passo com o Diário de Bordo (batch_events) apenas se não sincronizou acima
                        if (currentBatchId) {
                            await pool.execute(
                                'INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, ?, ?, NOW())',
                                [currentBatchId, 'SYSTEM_ACTION', `Avanço de Etapa: ${payload.profStat}`]
                            ).catch(e => console.error("Error inserting step event:", e));
                            
                            if (payload.currStep !== undefined) {
                                await pool.execute(
                                    'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
                                    [payload.currStep, currentBatchId]
                                ).catch(e => console.error("Error updating batch step:", e));
                            }
                        }
                    }
                    alertState[serialCode].lastStep = payload.profStat;
                    if (payload.currStep !== undefined) {
                        alertState[serialCode].lastStepIndex = Number(payload.currStep);
                    }
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
// Contas na lixeira (users.deleted_at): sessoes derrubadas na hora, sem consultar o banco a cada pedido
async function loadTrashedUsers() {
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE deleted_at IS NOT NULL');
        trashedUsers.clear();
        for (const r of rows) trashedUsers.add(Number(r.id));
    } catch (e) { console.error('Lixeira: falha ao carregar', e.message); }
}

/** Registro de auditoria (acoes de admin e operacoes sensiveis). req = null para acoes do sistema. */
const auditLog = async (req, action, details) => {
    try {
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [req?.user?.id ?? null, action, String(details ?? '').slice(0, 250), req ? (req.ip || null) : null]);
    } catch (e) { console.error('Auditoria:', e.message); }
};

// Registro de acesso (Marco Civil, art. 15: IP e horario de uso guardados por 6 meses ou mais).
// Um registro por usuario por hora, ou quando o IP muda; apagado depois de 12 meses (tarefa diaria).
const accessSeen = new Map();
const logAccess = (req) => {
    const id = Number(req.user?.id); if (!id) return;
    const ip = req.ip || null, now = Date.now(), prev = accessSeen.get(id);
    if (prev && prev.ip === ip && now - prev.t < 3600e3) return;
    accessSeen.set(id, { ip, t: now });
    pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [id, 'ACCESS', String(req.path || '').slice(0, 120), ip]).catch(() => {});
};
setInterval(() => {
    pool.execute("DELETE FROM audit_logs WHERE action = 'ACCESS' AND created_at < NOW() - INTERVAL 12 MONTH").catch(e => console.error('Registro de acesso:', e.message));
}, 24 * 60 * 60 * 1000).unref();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
        if (err) return res.sendStatus(403);
        if (trashedUsers.has(Number(user?.id))) return res.status(401).json({ error: 'Conta desativada' });
        req.user = user;
        logAccess(req);
        next();
    });
};

const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(403).json({ error: 'Acesso negado: Administrador necessário' });
        }
        const [rows] = await pool.execute('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        if (rows.length === 0 || rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado: Administrador necessário' });
        }
        req.user.role = 'admin';
        next();
    } catch (e) {
        return res.status(500).json({ error: 'Erro interno ao validar permissões' });
    }
};

app.post('/api/login', authRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos' });
        }
        if (users[0].deleted_at) return res.status(403).json({ error: 'Esta conta foi desativada. Fale com o suporte.' });
        if (users[0].password_hash && await bcrypt.compare(String(password), users[0].password_hash)) {
            const token = jwt.sign({ id: users[0].id, name: users[0].name, role: users[0].role }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
            
            // Log successful login
            const userIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || null;
            await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [users[0].id, 'LOGIN_SUCCESS', 'User logged in', userIp]);
            
            res.json({ token, name: users[0].name, role: users[0].role });
        } else { 
            await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [users[0].id, 'LOGIN_FAILED', 'Invalid password attempt', req.ip || null]);
            res.status(401).json({ error: 'E-mail ou senha incorretos' }); 
        }
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Erro interno ao realizar login' });
    }
});

// Monitor de Dispositivos Offline (baseado no último contato MQTT real, independente do intervalo de gravação no banco)
setInterval(() => {
    const now = Date.now();
    for (const serialCode in lastSeenTimes) {
        if (now - lastSeenTimes[serialCode] > 10 * 60 * 1000) { // 10 minutos sem nenhum contato MQTT
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

app.post('/api/register', authRateLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
        const hashedPassword = await bcrypt.hash(String(password), 10);
        await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword]);
        res.status(201).json({ message: 'Sucesso' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email já existe' });
        res.status(500).json({ error: 'Erro interno ao criar conta' });
    }
});

// Password Recovery & Reset Routes (/api/auth/forgot-password & /api/auth/reset-password)
registerAuthRecoveryRoutes(app, pool, authRateLimiter, sendPushToUser);

app.post('/api/auth/google', authRateLimiter, async (req, res) => {
    try {
        const { idToken } = req.body || {}; // Actually this is the access_token now from useGoogleLogin
        if (!idToken) return res.status(400).json({ error: 'Token é obrigatório' });

        // Validar audiência do access_token caso GOOGLE_CLIENT_ID esteja definido
        const expectedClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
        if (expectedClientId) {
            const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(String(idToken))}`);
            if (!tokenInfoRes.ok) {
                throw new Error('Token Google inválido');
            }
            const tokenInfo = await tokenInfoRes.json();
            if (tokenInfo.aud !== expectedClientId && tokenInfo.azp !== expectedClientId) {
                return res.status(403).json({ error: 'Token Google não pertence a este aplicativo' });
            }
        }
        
        // Obter dados do usuário no Google usando o access_token
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${idToken}` }
        });
        
        if (!googleRes.ok) {
            throw new Error('Token inválido ou expirado');
        }

        const payload = await googleRes.json();
        const email = payload.email;
        if (!email) return res.status(400).json({ error: 'Token não possui email' });
        const name = payload.name || email.split('@')[0] || 'Usuário Google';
        const googleId = payload.sub || '';
        // Foto do perfil Google (so URLs https do Google)
        const picture = typeof payload.picture === 'string' && /^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(payload.picture)
            ? payload.picture.slice(0, 512) : null;

        // 1) Google vinculado a uma conta; 2) mesmo e-mail (regra antiga)
        const linkedId = googleId ? await findUserIdByIdentity(pool, 'google', googleId) : null;
        let [users] = linkedId
            ? await pool.execute('SELECT id, name, email, role FROM users WHERE id = ?', [linkedId])
            : await pool.execute('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
        
        let userId;
        let userName = name;
        let userRole = 'user';

        if (users.length === 0) {
            // Cria usuário novo
            const [result] = await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, 'google_sso_' + googleId]);
            userId = result.insertId;
        } else {
            userId = users[0].id;
            userName = users[0].name;
            userRole = users[0].role;
        }

        if (googleId) await linkIdentity(pool, userId, 'google', googleId, email).catch(() => {}); // registra o vinculo
        if (picture) await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [picture, userId]).catch(() => {});
        const token = jwt.sign({ id: userId, name: userName, role: userRole }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
        res.json({ token, name: userName, role: userRole });
    } catch (err) { 
        console.error('Google Auth Error:', err);
        res.status(500).json({ error: 'Falha na autenticação com o Google' }); 
    }
});

// Perfil do usuario logado — usado pelo app (pagina "Minha conta")
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT u.name, u.email, u.avatar_url, u.password_hash, u.plan_type, u.max_devices, u.created_at,
                    (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id) AS device_count
             FROM users u WHERE u.id = ? LIMIT 1`,
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        const u = rows[0];
        res.json({
            name: u.name,
            email: u.email,
            avatarUrl: u.avatar_url || null,
            // Conta criada pelo Google tem uma senha interna aleatoria (nao serve para login por e-mail)
            hasPassword: hasRealPassword(u.password_hash),
            plan: u.plan_type || 'free',
            maxDevices: Number(u.max_devices ?? FREE_MAX_DEVICES),
            deviceCount: Number(u.device_count ?? 0),
            createdAt: u.created_at,
        });
    } catch (err) {
        console.error('me:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// Alterar o nome
app.put('/api/me', authenticateToken, async (req, res) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'O nome precisa ter entre 2 e 100 caracteres.' });
        await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
        res.json({ ok: true, name });
    } catch (err) {
        console.error('me update:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// Trocar a senha (com a atual) ou criar uma (conta que so entrava com Google)
app.post('/api/me/password', authRateLimiter, authenticateToken, async (req, res) => {
    try {
        const currentPassword = String(req.body?.currentPassword ?? '');
        const newPassword = String(req.body?.newPassword ?? '');
        if (newPassword.length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
        const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        const hash = String(rows[0].password_hash || '');
        const hasPassword = hasRealPassword(hash);
        if (hasPassword && !(await bcrypt.compare(currentPassword, hash))) {
            return res.status(400).json({ error: 'A senha atual está incorreta.' });
        }
        await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('me password:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// Excluir a propria conta (LGPD e exigencia das lojas): vai para a lixeira de 30 dias (como a do admin)
// e depois e apagada de vez. Conta com senha confirma com a senha; conta so do Google/Apple digita EXCLUIR.
app.delete('/api/me', authRateLimiter, authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, email, role, password_hash FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
        if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        const u = rows[0];
        if (u.role === 'admin') return res.status(400).json({ error: 'Conta de administrador: peça a outro admin para excluir.' });
        const hash = String(u.password_hash || '');
        if (hasRealPassword(hash)) {
            if (!(await bcrypt.compare(String(req.body?.password ?? ''), hash))) return res.status(400).json({ error: 'Senha incorreta.' });
        } else if (String(req.body?.confirm ?? '').trim().toUpperCase() !== 'EXCLUIR') {
            return res.status(400).json({ error: 'Digite EXCLUIR para confirmar.' });
        }
        await pool.execute('UPDATE users SET deleted_at = NOW() WHERE id = ?', [u.id]);
        trashedUsers.add(Number(u.id));
        await auditLog(req, 'SELF_DELETE', `Conta ${u.id} excluida pelo proprio usuario (lixeira de 30 dias)`);
        res.json({ ok: true, message: 'Conta excluída. Os dados são apagados de vez em 30 dias.' });
    } catch (err) {
        console.error('me delete:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

const deleteDeviceCascade = async (devId, serialCode) => {
    await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [devId]);
    const [batches] = await pool.execute('SELECT id FROM batches WHERE device_id = ?', [devId]);
    for (const b of batches) {
        delete alertState[`magic_${b.id}`];
    }
    await pool.execute('DELETE FROM batch_events WHERE batch_id IN (SELECT id FROM batches WHERE device_id = ?)', [devId]);
    await pool.execute('DELETE FROM batches WHERE device_id = ?', [devId]);
    await pool.execute('DELETE FROM devices WHERE id = ?', [devId]);
    if (serialCode) deviceRegistry.invalidate(serialCode);
    if (serialCode) {
        const normalizedSerial = String(serialCode).trim().toUpperCase();
        delete activeBatches[normalizedSerial];
        delete activeBatchesUserId[normalizedSerial];
        delete alertState[normalizedSerial];
    }
};

app.get('/api/devices', authenticateToken, async (req, res) => {
    try {
        const [devices] = await pool.execute(`
            SELECT d.*, d.chopp_name, (d.last_seen > NOW() - INTERVAL 30 SECOND) as is_online,
                   b.id as active_batch_id, b.name as active_batch_name, b.style as active_batch_style,
                   b.started_at as active_batch_start, b.step_started_at as active_batch_step_start,
                   b.profile as active_batch_profile, b.og as active_batch_og, b.fg as active_batch_fg,
                   b.volume as active_batch_volume, b.current_step_index as active_batch_current_step,
                   lt.last_temp, lt.last_temp2, lt.last_target, lt.last_status, lt.last_battery,
                   lt.last_rssi, lt.last_gravity, lt.last_extra_sensors
            FROM devices d
            LEFT JOIN batches b ON b.device_id = d.id AND b.is_active = 1
            LEFT JOIN (
                SELECT device_id,
                       temp_ferm as last_temp,
                       temp_amb as last_temp2,
                       target_temp as last_target,
                       status_op as last_status,
                       battery as last_battery,
                       rssi as last_rssi,
                       gravity as last_gravity,
                       extra_sensors as last_extra_sensors
                FROM telemetry
                WHERE id IN (SELECT MAX(id) FROM telemetry GROUP BY device_id)
            ) lt ON lt.device_id = d.id
            WHERE d.user_id = ?
        `, [req.user.id]);

        // Online e "visto por ultimo" pelo contato MQTT em memoria (o banco so recebe last_seen 1x/min)
        for (const d of devices) {
            d.is_online = deviceRegistry.isOnline(d.serial_code, 30 * 1000, d.is_online) ? 1 : 0;
            const mem = deviceRegistry.lastSeenMs(d.serial_code);
            if (mem && (!d.last_seen || mem > new Date(d.last_seen).getTime())) d.last_seen = new Date(mem);
        }
        res.json(devices);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

// Descoberta por rede (mesmo IP publico), pedido de vinculo e confirmacao na tela do aparelho
registerPairingRoutes(app, {
    pool, mqttClient, authenticateToken, notifyUpdate,
    provisionMqtt: createMqttProvisioner(),
    removeMqtt: (serial) => removeMqttCredential(serial),
    // Substituir aparelho: caches em memoria sao por serial
    onSerialChanged: async (oldSerial, newSerial) => {
        pendingCarry.add(String(newSerial).toUpperCase()); // aplica as configuracoes da antiga na 1a telemetria
        for (const map of [alertState, lastLogTimes, lastSeenTimes, lastBrewfatherPushTimes, lastProfileSyncAt]) {
            delete map[oldSerial];
            delete map[newSerial];
        }
        await loadActiveBatches(); // lote ativo passa a ser do serial novo
    }
});
// Fluxo ao vivo para o navegador (substitui a conexao MQTT direta do browser)
registerLiveRoutes(app, { pool, mqttClient, authenticateToken });
// Diagnosticos das placas (travamentos/quedas de MQTT), guardados 30 dias
registerDeviceDiagnostics({ pool, mqttClient });
// Login do app nativo pelo site (codigo de uso unico + PKCE)
registerAppAuthRoutes(app, {
    pool,
    authenticateToken,
    rateLimiter: authRateLimiter,
    signToken: (claims) => jwt.sign(claims, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' }),
});
// Entrar com a Apple (app nativo)
const appleKeys = createAppleKeyStore();
registerAppleAuthRoutes(app, {
    pool,
    getKey: appleKeys,
    rateLimiter: authRateLimiter,
    signToken: (claims) => jwt.sign(claims, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' }),
});
// Logins vinculados (e-mail, Google e Apple na mesma conta)
registerIdentityRoutes(app, {
    pool,
    authenticateToken,
    rateLimiter: authRateLimiter,
    verifyApple: (identityToken, nonce) => verifyAppleToken(identityToken, nonce, { getKey: appleKeys, audiences: appleAudiences() }),
    verifyGoogle: (accessToken) => verifyGoogleAccessToken(accessToken, { clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID }),
});
// Push do app nativo (tokens da Expo); os alertas usam sendPushToUser como antes
registerAppPushRoutes(app, { pool, authenticateToken });

app.put('/api/devices/:serial', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body || {};
        await pool.execute('UPDATE devices SET device_name = ? WHERE serial_code = ? AND user_id = ?', [name ?? null, req.params.serial, req.user.id]);
        notifyUpdate(req.params.serial);
        res.json({ message: 'Dispositivo atualizado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.put('/api/devices/:id/chopp_name', authenticateToken, async (req, res) => {
    try {
        const { choppName } = req.body || {};
        await pool.execute('UPDATE devices SET chopp_name = ? WHERE serial_code = ? AND user_id = ?', 
            [choppName ?? null, req.params.id, req.user.id]);
        notifyUpdate(req.params.id);
        res.json({ message: 'Chopp name atualizado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/devices/:id/sensors', authenticateToken, async (req, res) => {
    try {
        const { sensor1Name, sensor2Name, sensorSgName } = req.body || {};
        await pool.execute('UPDATE devices SET sensor1_name = COALESCE(?, sensor1_name), sensor2_name = COALESCE(?, sensor2_name), sensor_sg_name = COALESCE(?, sensor_sg_name) WHERE serial_code = ? AND user_id = ?', 
            [sensor1Name ?? null, sensor2Name ?? null, sensorSgName ?? null, req.params.id, req.user.id]);
        notifyUpdate(req.params.id);
        res.json({ message: 'Sensores atualizados no backend' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.delete('/api/devices/:serial', authenticateToken, async (req, res) => {
    try {
        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [req.params.serial, req.user.id]);
        if (devs.length === 0) return res.status(404).json({ error: 'Dispositivo não encontrado' });
        await deleteDeviceCascade(devs[0].id, req.params.serial);
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'DELETE_DEVICE', `Device: ${req.params.serial}`, req.ip || null]);
        notifyUpdate(req.params.serial);
        res.json({ message: 'Excluído' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.post('/api/devices/:serial/command', authenticateToken, async (req, res) => {
    try {
        const rawSerial = String(req.params.serial || '').trim();
        const normSerial = rawSerial.toUpperCase();
        if (!rawSerial) return res.status(400).json({ error: 'Serial inválido' });

        // Verify ownership (or admin privilege verified against DB)
        const [devs] = await pool.execute('SELECT id, user_id, serial_code FROM devices WHERE UPPER(serial_code) = ? LIMIT 1', [normSerial]);
        if (devs.length === 0) return res.status(404).json({ error: 'Dispositivo não encontrado' });

        if (Number(devs[0].user_id) !== Number(req.user.id)) {
            const [uRows] = await pool.execute('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
            if (!uRows.length || uRows[0].role !== 'admin') {
                return res.status(403).json({ error: 'Acesso negado a este equipamento' });
            }
        }

        const payload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
        const type = String(payload.type || payload.cmd || '').trim();
        if (!type) return res.status(400).json({ error: 'Tipo de comando obrigatório' });

        // Guard against arbitrary external URLs in update_firmware unless safe HTTP(S)
        if (type === 'update_firmware' && payload.url) {
            try {
                const parsedUrl = new URL(String(payload.url));
                if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                    return res.status(400).json({ error: 'URL de firmware inválida' });
                }
            } catch (e) {
                return res.status(400).json({ error: 'URL de firmware inválida' });
            }
        }

        const targetSerial = devs[0].serial_code || rawSerial;
        const cmdPayload = { ...payload, type, cmd: type };
        if (type === 'update_firmware') await auditLog(req, 'OTA_COMMAND', `${devs[0].serial_code}: ${String(payload.url || '').slice(0, 160)}`);
        const msg = JSON.stringify(cmdPayload);
        mqttClient.publish(`brewbrother/${targetSerial}/comando`, msg);
        mqttClient.publish(`brewbrother/${targetSerial}/command`, msg);

        // Keep step_started_at / current_step_index synchronized on manual step overrides
        if (type === 'setProfile' && payload.currentStep !== undefined) {
            const [batches] = await pool.execute(
                'SELECT id, current_step_index FROM batches WHERE device_id = ? AND is_active = 1 LIMIT 1',
                [devs[0].id]
            );
            if (batches.length > 0 && Number(batches[0].current_step_index) !== Number(payload.currentStep)) {
                await pool.execute(
                    'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
                    [payload.currentStep, batches[0].id]
                );
                alertState[normSerial] = { ...(alertState[normSerial] || {}), lastStepIndex: Number(payload.currentStep), lastStepAdvanceTs: Date.now() };
            }
        } else if (type === 'skipStep') {
            const [batches] = await pool.execute(
                'SELECT id, current_step_index FROM batches WHERE device_id = ? AND is_active = 1 LIMIT 1',
                [devs[0].id]
            );
            if (batches.length > 0) {
                const nextStep = (Number(batches[0].current_step_index) || 0) + 1;
                await pool.execute(
                    'UPDATE batches SET current_step_index = ?, step_started_at = NOW() WHERE id = ?',
                    [nextStep, batches[0].id]
                );
                alertState[normSerial] = { ...(alertState[normSerial] || {}), lastStepIndex: nextStep, lastStepAdvanceTs: Date.now() };
            }
        }

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao enviar comando' });
    }
});

app.post('/api/batch/start', authenticateToken, async (req, res) => {
    const { serialCode, name, style, og, fg, volume, profile, ingredients } = req.body || {};
    if (!serialCode || !name) return res.status(400).json({ error: 'serialCode e name são obrigatórios' });
    try {
        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
        if (devs.length === 0) return res.status(404).json({ error: 'Device não encontrado' });
        const deviceId = devs[0].id;
        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE device_id = ? AND is_active = 1', [deviceId]);

        // Store profile and ingredients as JSON string if provided
        const profileJson = profile ? JSON.stringify(profile) : null;
        const ingredientsJson = ingredients ? (typeof ingredients === 'string' ? ingredients : JSON.stringify(ingredients)) : null;
        const safeVol = volume !== undefined && volume !== null && !isNaN(parseFloat(volume)) ? parseFloat(volume) : 20;
        const [result] = await pool.execute(
            'INSERT INTO batches (device_id, name, style, og, fg, volume, profile, ingredients, started_at, is_active, current_step_index, step_started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, 0, NOW())',
            [deviceId, name, style || '', og || null, fg || null, safeVol, profileJson, ingredientsJson]
        );

        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'START_BATCH', `Batch: ${name} (Device: ${serialCode})`, req.ip || null]);

        const normalizedSerial = String(serialCode).trim().toUpperCase();
        activeBatches[normalizedSerial] = result.insertId;
        activeBatchesUserId[normalizedSerial] = req.user.id;

        if (Array.isArray(profile) && profile.length > 0) {
            const payloadSteps = toEsp32Steps(profile);
            const startCmd = {
                cmd: 'setProfile',
                type: 'setProfile',
                steps: payloadSteps,
                currentStep: 0,
                currStep: 0,
                stepTime: 0
            };
            const msg = JSON.stringify(startCmd);
            mqttClient.publish(`brewbrother/${serialCode}/command`, msg);
            mqttClient.publish(`brewbrother/${serialCode}/comando`, msg);
        }

        notifyUpdate(normalizedSerial);
        res.json({ message: 'Iniciado!', batchId: result.insertId });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.put('/api/batch/update', authenticateToken, async (req, res) => {
    try {
        const { serialCode, og, fg, name, profile, style, volume } = req.body || {};
        if (!serialCode) return res.status(400).json({ error: 'serialCode é obrigatório' });
        console.log(`📝 [API] /api/batch/update - Recebido:`, { serialCode, og, fg, name, hasProfile: profile !== undefined });

        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
        if (devs.length === 0) {
            console.log(`❌ [API] Device não encontrado: ${serialCode}`);
            return res.status(404).json({ error: 'Device não encontrado' });
        }

        // Build dynamic update query
        const updates = [];
        const params = [];
        if (og !== undefined) { updates.push('og = ?'); params.push(og); }
        if (fg !== undefined) { updates.push('fg = ?'); params.push(fg); }
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (profile !== undefined) {
            updates.push('profile = ?'); params.push(profile ? JSON.stringify(profile) : null);
            // Perfil com menos etapas: a etapa atual nao pode passar da ultima
            if (Array.isArray(profile) && profile.length > 0) {
                updates.push('current_step_index = LEAST(current_step_index, ?)'); params.push(profile.length - 1);
            }
        }
        if (style !== undefined) { updates.push('style = ?'); params.push(String(style).slice(0, 100)); }
        if (volume !== undefined && Number.isFinite(Number(volume)) && Number(volume) > 0) { updates.push('volume = ?'); params.push(Number(volume)); }

        if (updates.length > 0) {
            params.push(devs[0].id);
            const query = `UPDATE batches SET ${updates.join(', ')} WHERE device_id = ? AND is_active = 1`;
            await pool.execute(query, params);
        }

        notifyUpdate(serialCode);
        res.json({ message: 'Atualizado' });
    } catch (err) {
        console.error(`❌ [API] Erro ao atualizar batch:`, err.message);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.post('/api/batch/stop', authenticateToken, async (req, res) => {
    try {
        const serialCode = req.body?.serialCode;
        if (!serialCode) return res.status(400).json({ error: 'serialCode é obrigatório' });
        const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
        if (devs.length === 0) return res.status(404).json({ error: 'Device não encontrado' });
        await pool.execute('UPDATE batches SET is_active = 0, ended_at = NOW() WHERE device_id = ? AND is_active = 1', [devs[0].id]);
        await pool.execute('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.id, 'STOP_BATCH', `Device: ${serialCode}`, req.ip || null]);
        // Firmware 2.7.0+: o controlador para de seguir o perfil (o anterior ignora o comando)
        const stopMsg = JSON.stringify({ cmd: 'stopProfile', type: 'stopProfile' });
        mqttClient.publish(`brewbrother/${serialCode}/command`, stopMsg);
        mqttClient.publish(`brewbrother/${serialCode}/comando`, stopMsg);
        const normalizedSerial = String(serialCode).trim().toUpperCase();
        const stoppedBatchId = activeBatches[normalizedSerial];
        delete activeBatches[normalizedSerial];
        delete activeBatchesUserId[normalizedSerial];
        if (stoppedBatchId) delete alertState[`magic_${stoppedBatchId}`];
        notifyUpdate(normalizedSerial);
        res.json({ message: 'Finalizado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const { batchId, type, description, date } = req.body || {};
        if (!batchId || !type) return res.status(400).json({ error: 'batchId e type são obrigatórios' });
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [batchId, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        // O cliente manda ISO ("2026-11-11T18:55:13.450Z"), que o MariaDB recusa como DATETIME; um Date o mysql2 formata certo
        const recordedAt = date ? new Date(date) : new Date();
        if (Number.isNaN(recordedAt.getTime())) return res.status(400).json({ error: 'date inválida' });
        await pool.execute('INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, ?, ?, ?)', [batchId, type, description ?? null, recordedAt]);
        res.status(201).json({ message: 'Registrado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.get('/api/batch/:id/events', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        const [rows] = await pool.execute('SELECT * FROM batch_events WHERE batch_id = ? ORDER BY recorded_at ASC', [req.params.id]);
        res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT e.id FROM batch_events e JOIN batches b ON e.batch_id = b.id JOIN devices d ON b.device_id = d.id WHERE e.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        await pool.execute('DELETE FROM batch_events WHERE id = ?', [req.params.id]);
        res.json({ message: 'Apagado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.get('/api/recipes', authenticateToken, async (req, res) => {
    try {
        const [recipes] = await pool.execute('SELECT * FROM recipes WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
        if (recipes.length > 0) {
            const recipeIds = recipes.map(r => r.id);
            const placeholders = recipeIds.map(() => '?').join(',');
            const [allSteps] = await pool.execute(
                `SELECT recipe_id, step_order, name, temperature, days as duration, trigger_gravity as triggerGravity FROM recipe_steps WHERE recipe_id IN (${placeholders}) ORDER BY step_order ASC`,
                recipeIds
            );
            const stepsByRecipe = new Map();
            for (const s of allSteps) {
                const { recipe_id, ...stepRest } = s;
                if (!stepsByRecipe.has(recipe_id)) stepsByRecipe.set(recipe_id, []);
                stepsByRecipe.get(recipe_id).push(stepRest);
            }
            for (const r of recipes) {
                r.steps = stepsByRecipe.get(r.id) || [];
            }
        }
        res.json(recipes);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.post('/api/recipes', authenticateToken, async (req, res) => {
    const { name, style, og, fg, est_og, est_fg, steps } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nome do perfil/receita é obrigatório' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [resRecipe] = await conn.execute(
            'INSERT INTO recipes (user_id, name, style, est_og, est_fg) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, name, style ?? null, (og ?? est_og) ?? null, (fg ?? est_fg) ?? null]
        );
        const recipeId = resRecipe.insertId;
        if (Array.isArray(steps) && steps.length > 0) {
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i] || {};
                await conn.execute(
                    'INSERT INTO recipe_steps (recipe_id, step_order, name, temperature, days, trigger_gravity) VALUES (?, ?, ?, ?, ?, ?)',
                    [recipeId, i, (s.name ?? s.n) ?? `Etapa ${i + 1}`, (s.temperature ?? s.t) ?? 18, (s.duration ?? s.days ?? s.d) ?? 1, (s.triggerGravity ?? s.g) ?? null]
                );
            }
        }
        await conn.commit();
        res.status(201).json({ message: 'Salva', id: recipeId });
    } catch (err) { await conn.rollback(); console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); } finally { conn.release(); }
});

app.delete('/api/recipes/:id', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM recipe_steps WHERE recipe_id = ? AND recipe_id IN (SELECT id FROM recipes WHERE user_id = ?)', [req.params.id, req.user.id]);
        const [result] = await pool.execute('DELETE FROM recipes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Receita não encontrada' });
        res.json({ message: 'Apagada' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.get('/api/user/integrations', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT brewfather_webhook_url, alert_config FROM users WHERE id = ?', [req.user.id]);
        const rawCfg = rows?.[0]?.alert_config;
        const parsedCfg = rawCfg ? (typeof rawCfg === 'string' ? JSON.parse(rawCfg) : rawCfg) : {};
        res.json({
            brewfatherWebhookUrl: rows?.[0]?.brewfather_webhook_url || '',
            alertConfig: { ...DEFAULT_ALERT_CONFIG, ...(parsedCfg && typeof parsedCfg === 'object' ? parsedCfg : {}) }
        });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.put('/api/user/integrations', authenticateToken, async (req, res) => {
    try {
        const hasUrl = req.body?.brewfatherWebhookUrl !== undefined;
        const hasAlertCfg = req.body?.alertConfig !== undefined;
        const updates = [];
        const params = [];

        let rawUrl = '';
        if (hasUrl) {
            rawUrl = String(req.body.brewfatherWebhookUrl || '').trim();
            if (rawUrl && !isSafeExternalWebhookUrl(rawUrl)) {
                return res.status(400).json({ error: 'Informe uma URL externa pública válida (http:// ou https://)' });
            }
            updates.push('brewfather_webhook_url = ?');
            params.push(rawUrl || null);
        }

        let normalizedAlertCfg = undefined;
        if (hasAlertCfg && req.body.alertConfig && typeof req.body.alertConfig === 'object') {
            const c = req.body.alertConfig;
            const rawSg = parseFloat(c.sgTargetValue);
            const normSg = !isNaN(rawSg) && rawSg > 0 ? (rawSg > 500 ? rawSg / 1000 : rawSg) : null;
            normalizedAlertCfg = {
                lowBatteryEnabled: c.lowBatteryEnabled !== false,
                lowBatteryThreshold: Math.max(2.8, Math.min(4.2, parseFloat(c.lowBatteryThreshold) || 3.5)),
                tempDeviationEnabled: c.tempDeviationEnabled !== false,
                tempDeviationMargin: Math.max(0.2, Math.min(10, parseFloat(c.tempDeviationMargin) || 1.5)),
                sgTargetEnabled: c.sgTargetEnabled !== false,
                sgTargetValue: normSg,
                telegramBotToken: String(c.telegramBotToken || '').trim(),
                telegramChatId: String(c.telegramChatId || '').trim()
            };
            updates.push('alert_config = ?');
            params.push(JSON.stringify(normalizedAlertCfg));
            userAlertConfigs[req.user.id] = { cfg: normalizedAlertCfg, ts: Date.now() };
        }

        if (updates.length > 0) {
            params.push(req.user.id);
            await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        res.json({
            message: 'Integração atualizada com sucesso',
            ...(hasUrl ? { brewfatherWebhookUrl: rawUrl } : {}),
            ...(normalizedAlertCfg ? { alertConfig: normalizedAlertCfg } : {})
        });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.post('/api/user/integrations/test-telegram', authenticateToken, async (req, res) => {
    try {
        const botToken = String(req.body?.telegramBotToken || '').trim();
        const chatId = String(req.body?.telegramChatId || '').trim();
        if (!botToken || !chatId) {
            return res.status(400).json({ error: 'Informe o Bot Token e o Chat ID do Telegram' });
        }
        const tgRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: '🍺 <b>Breww Dashboard</b>\nNotificações via Telegram conectadas com sucesso!',
                parse_mode: 'HTML'
            })
        });
        if (!tgRes.ok) {
            return res.status(400).json({ success: false, status: tgRes.status, error: 'Falha ao enviar para o Telegram. Verifique o Bot Token e o Chat ID.' });
        }
        res.json({ success: true, status: tgRes.status });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.post('/api/user/integrations/test-brewfather', authenticateToken, async (req, res) => {
    try {
        let targetUrl = String(req.body?.brewfatherWebhookUrl || '').trim();
        if (!targetUrl) {
            const [rows] = await pool.execute('SELECT brewfather_webhook_url FROM users WHERE id = ?', [req.user.id]);
            targetUrl = rows?.[0]?.brewfather_webhook_url || '';
        }
        if (!targetUrl || !isSafeExternalWebhookUrl(targetUrl)) {
            return res.status(400).json({ error: 'Informe uma URL pública válida do Custom Stream do Brewfather' });
        }
        const samplePayload = {
            name: req.body?.deviceName ? `Breww-${req.body.deviceName}` : 'Breww-Controller',
            temp: 19.5,
            aux_temp: 15.0,
            temp_unit: 'C',
            gravity: 1.042,
            gravity_unit: 'G',
            battery: 4.05,
            comment: 'Teste de Conexão Breww Dashboard'
        };
        const bfRes = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(samplePayload)
        });
        if (!bfRes.ok) {
            return res.status(400).json({ success: false, status: bfRes.status, error: `O Brewfather recusou o pacote (HTTP ${bfRes.status}). Verifique a URL do Custom Stream.` });
        }
        res.json({ success: true, status: bfRes.status });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
    try {
        const { endpoint, keys } = req.body || {};
        if (!endpoint || !keys) {
            return res.status(400).json({ error: 'Endpoint e keys são obrigatórios.' });
        }
        
        // Verifica se já existe para evitar duplicatas (usando o endpoint)
        const [existing] = await pool.execute('SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [req.user.id, endpoint]);
        
        if (existing.length === 0) {
            await pool.execute('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)', [
                req.user.id, endpoint, keys.p256dh ?? null, keys.auth ?? null
            ]);
        }
        
        res.json({ message: 'Inscrição salva com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar inscrição Push:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.get('/api/history/batches', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT b.id, b.name, b.style, b.og, b.fg, b.profile, b.started_at, b.ended_at, b.is_active, b.ingredients, d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name, b.device_id as device_id, (SELECT gravity FROM telemetry t WHERE t.batch_id = b.id AND t.gravity IS NOT NULL AND t.gravity > 0 ORDER BY t.recorded_at DESC LIMIT 1) as last_gravity FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.user_id = ? AND b.is_active = 0 ORDER BY b.started_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.delete('/api/history/:serial', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [req.params.serial, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
        await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [rows[0].id]);
        res.json({ message: 'Apagado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.get('/api/export/:serial', authenticateToken, async (req, res) => {
    try {
        let [batches] = await pool.execute(`SELECT b.id, b.name, b.ended_at, b.is_active FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.serial_code = ? AND d.user_id = ? AND b.is_active = 1 LIMIT 1`, [req.params.serial, req.user.id]);
        if (batches.length === 0) [batches] = await pool.execute(`SELECT b.id, b.name, b.ended_at, b.is_active FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.serial_code = ? AND d.user_id = ? ORDER BY b.id DESC LIMIT 1`, [req.params.serial, req.user.id]);
        let queryWhere = ''; let fileName = 'log_geral'; let currentBatch = null;
        const queryParams = [req.params.serial, req.user.id];
        if (batches.length > 0) {
            currentBatch = batches[0];
            queryWhere = `AND t.batch_id = ?`;
            queryParams.push(currentBatch.id);
            fileName = (currentBatch.name || 'lote').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        } else {
            queryWhere = `AND t.recorded_at > NOW() - INTERVAL 30 DAY`;
        }
        const [rows] = await pool.execute(`SELECT t.recorded_at, t.temp_ferm, t.temp_amb, t.target_temp, t.gravity, t.battery, t.status_op, t.step_name, t.extra_sensors, b.name as batch_name FROM telemetry t JOIN devices d ON t.device_id = d.id LEFT JOIN batches b ON t.batch_id = b.id WHERE d.serial_code = ? AND d.user_id = ? ${queryWhere} ORDER BY t.recorded_at ASC`, queryParams);
        if (rows.length === 0) return res.status(404).send('Sem dados');
        if (rows.length > 1 && (rows[0].status_op || '').includes('CONCLU') && !(rows[1].status_op || '').includes('CONCLU')) rows.shift();
        if (currentBatch && !currentBatch.is_active && currentBatch.ended_at && rows.length > 0) { const last = rows[rows.length - 1]; rows.push({ recorded_at: currentBatch.ended_at, batch_name: last.batch_name, temp_ferm: last.temp_ferm, temp_amb: last.temp_amb, target_temp: last.target_temp, gravity: last.gravity, battery: last.battery, status_op: 'FINALIZADO', step_name: 'MANUAL' }); }
        let csv = 'Data/Hora,Lote,Temp Fermentador,Temp Ambiente,Alvo,Densidade (SG),Bateria,Status,Etapa\n';
        const f = (v) => v != null ? parseFloat(v).toFixed(1) : ''; const fs = (v) => v != null ? parseFloat(v).toFixed(3) : '';
        const esc = (s) => String(s ?? '').replace(/"/g, '""');
        rows.forEach(r => { csv += `"${new Date(r.recorded_at).toLocaleString('pt-BR')}","${esc(r.batch_name)}",${f(r.temp_ferm)},${f(r.temp_amb)},${f(r.target_temp)},${fs(r.gravity)},${f(r.battery)},"${esc(r.status_op)}","${esc(r.step_name)}"\n`; });
        res.header('Content-Type', 'text/csv'); res.attachment(`${fileName}.csv`); res.send(csv);
    } catch (err) { console.error(err); res.status(500).send('Erro ao exportar'); }
});

app.get('/api/batches/compare', authenticateToken, async (req, res) => {
    try {
        const { batch1, batch2 } = req.query;
        if (!batch1 || !batch2) return res.status(400).json({ error: 'Forneça batch1 e batch2' });

        // Ensure user owns both batches
        const [auth] = await pool.execute('SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id IN (?, ?) AND d.user_id = ?', [batch1, batch2, req.user.id]);
        if (auth.length !== 2) return res.status(403).json({ error: 'Acesso negado aos lotes' });

        const [[rows1], [rows2]] = await Promise.all([
            pool.execute('SELECT temp_ferm, gravity, recorded_at FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC', [batch1]),
            pool.execute('SELECT temp_ferm, gravity, recorded_at FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC', [batch2])
        ]);

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
                if (!isNaN(d.temp)) combined[h][`${prefix}_temp`] = d.temp;
                if (!isNaN(d.sg) && d.sg > 0) combined[h][`${prefix}_sg`] = d.sg;
            });
        };
        process(data1, 'b1');
        process(data2, 'b2');

        const result = Object.values(combined).sort((a, b) => a.hour - b.hour);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.get('/api/batches', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.execute(`SELECT b.id, b.name, b.style, b.og, b.fg, b.profile, b.started_at, b.ended_at, b.is_active, b.ingredients, d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name, b.device_id as device_id, (SELECT gravity FROM telemetry t WHERE t.batch_id = b.id AND t.gravity IS NOT NULL AND t.gravity > 0 ORDER BY t.recorded_at DESC LIMIT 1) as last_gravity FROM batches b JOIN devices d ON b.device_id = d.id WHERE d.user_id = ? ORDER BY b.started_at DESC`, [req.user.id]); res.json(rows); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

// Update batch ingredients
app.put('/api/batches/:id/ingredients', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        
        const { ingredients } = req.body || {};
        await pool.execute('UPDATE batches SET ingredients = ? WHERE id = ?', [ingredients !== undefined ? JSON.stringify(ingredients) : null, req.params.id]);
        res.json({ message: 'Ingredientes atualizados com sucesso' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.delete('/api/batches/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        await pool.execute('DELETE FROM telemetry WHERE batch_id = ?', [req.params.id]);
        await pool.execute('DELETE FROM batch_events WHERE batch_id = ?', [req.params.id]);
        await pool.execute('DELETE FROM batches WHERE id = ?', [req.params.id]);
        delete alertState[`magic_${req.params.id}`];
        await loadActiveBatches();
        res.json({ message: 'Batch deletado' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

// Public Live Spectator Share Token Generation / Retrieval
app.post('/api/batches/:id/share-token', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT b.id, b.public_token FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`,
            [req.params.id, req.user.id]
        );
        if (rows.length === 0) return res.status(403).json({ error: 'Não autorizado' });

        if (req.body?.revoke) {
            await pool.execute('UPDATE batches SET public_token = NULL WHERE id = ?', [req.params.id]);
            return res.json({ publicToken: null });
        }

        let token = rows[0].public_token;
        if (!token || req.body?.regenerate) {
            token = crypto.randomBytes(16).toString('hex');
            await pool.execute('UPDATE batches SET public_token = ? WHERE id = ?', [token, req.params.id]);
        }
        res.json({ publicToken: token });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

// Public Read-Only Live Spectator Endpoint (No Auth Required)
app.get('/api/public/batch/:token', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token || token.length < 8) return res.status(404).json({ error: 'Link público inválido' });

        const [batches] = await pool.execute(
            `SELECT b.id, b.name, b.style, b.og, b.fg, b.volume, b.profile, b.started_at, b.ended_at, b.is_active, b.current_step_index, b.step_started_at, b.ingredients,
                    d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name, (d.last_seen > NOW() - INTERVAL 2 MINUTE) as is_online, d.serial_code AS device_serial
             FROM batches b
             JOIN devices d ON b.device_id = d.id
             WHERE b.public_token = ? LIMIT 1`,
            [token]
        );
        if (batches.length === 0) return res.status(404).json({ error: 'Lote público não encontrado ou link revogado' });

        const batch = batches[0];
        batch.is_online = deviceRegistry.isOnline(batch.device_serial, 2 * 60 * 1000, batch.is_online) ? 1 : 0;
        delete batch.device_serial; // link publico nao expoe o serial
        const [rows] = await pool.execute(
            `SELECT temp_ferm, temp_amb, target_temp, gravity, battery, status_op, step_name, recorded_at
             FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC`,
            [batch.id]
        );

        let lastValidGravity = null;
        const filledRows = rows.map(row => {
            const currentGravity = row.gravity !== null ? parseFloat(row.gravity) : null;
            if (currentGravity !== null && !isNaN(currentGravity) && currentGravity > 0) {
                lastValidGravity = currentGravity;
            } else if (lastValidGravity !== null) {
                row.gravity = lastValidGravity;
            }
            return row;
        });

        let finalTelemetry = filledRows;
        const targetPoints = 400;
        if (filledRows.length > targetPoints) {
            const step = Math.ceil(filledRows.length / targetPoints);
            finalTelemetry = filledRows.filter((_, index) => index % step === 0 || index === filledRows.length - 1);
        }

        const [events] = await pool.execute(
            `SELECT id, event_type, description, recorded_at FROM batch_events WHERE batch_id = ? ORDER BY recorded_at ASC`,
            [batch.id]
        );

        res.json({
            batch,
            telemetry: finalTelemetry,
            events
        });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

// AI Brewing Advisor Endpoint (keeps Gemini API key server-side)
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: 'Chave de API do Gemini não configurada no servidor.' });
        }
        const { beerName, style, status, og, volume, targetTemp, beerTemp, fridgeTemp, gravity, readings } = req.body || {};
        const promptText = `
Aja como um Mestre Cervejeiro experiente e técnico. Analise os seguintes dados de fermentação para a cerveja "${beerName || 'Lote'}" (Estilo: ${style || 'Ale'}).
Estado Atual: ${status || 'Fermentando'} | OG: ${og || 1.050} | Volume: ${volume || 20}L | Setpoint: ${targetTemp || 18}°C
Sensores Atuais: Temp Mosto ${beerTemp || 0}°C, Temp Geladeira ${fridgeTemp || 0}°C, Gravidade Atual ${gravity || 0}
Histórico recente: ${JSON.stringify(Array.isArray(readings) ? readings.slice(-15) : [])}
Retorne APENAS um JSON válido com as chaves: "summary" (string), "health_score" (0-100), "estimated_completion_days" (number), "risk_level" ("low"|"medium"|"high"), "insights" (array de strings), "ideal_curve" (array de { "hours": number, "gravity": number }). Responda em Português do Brasil.`;

        const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
        let parsedResult = null;
        let lastErr = 'Falha ao consultar Gemini';

        for (const model of modelsToTry) {
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });
            const gData = await gRes.json().catch(() => ({}));
            if (!gRes.ok) {
                lastErr = gData?.error?.message || `HTTP ${gRes.status}`;
                continue;
            }
            const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (typeof text === 'string' && text.trim()) {
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                parsedResult = JSON.parse(cleanText);
                break;
            }
        }

        if (!parsedResult) {
            return res.status(502).json({ error: lastErr });
        }
        res.json(parsedResult);
    } catch (err) {
        console.error('AI Analyze Error:', err.message);
        res.status(500).json({ error: 'Erro interno ao processar análise de IA' });
    }
});

// Voice Assistant Endpoints (Alexa / Google Home)
registerVoiceRoutes(app, pool);

// Get batch telemetry data
app.get('/api/batch/:id/data', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.execute(`SELECT b.id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.id = ? AND d.user_id = ?`, [req.params.id, req.user.id]);
        if (check.length === 0) return res.status(403).json({ error: 'Não autorizado' });
        const [rows] = await pool.execute(`SELECT temp_ferm, temp_amb, target_temp, gravity, recorded_at, step_name, extra_sensors FROM telemetry WHERE batch_id = ? ORDER BY recorded_at ASC`, [req.params.id]);
        
        // Fill in missing/zero gravities with the previous valid value before downsampling so no valid reading is skipped
        let lastValidGravity = null;
        const filledRows = rows.map(row => {
            const currentGravity = row.gravity !== null ? parseFloat(row.gravity) : null;
            if (currentGravity !== null && !isNaN(currentGravity) && currentGravity > 0) {
                lastValidGravity = currentGravity;
            } else if (lastValidGravity !== null) {
                row.gravity = lastValidGravity;
            }
            return row;
        });

        let finalRows = filledRows;
        const targetPoints = 500;
        if (filledRows.length > targetPoints) {
            const step = Math.ceil(filledRows.length / targetPoints);
            finalRows = filledRows.filter((_, index) => index % step === 0 || index === filledRows.length - 1);
        }
        
        res.json(finalRows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

// ==========================================
// INGREDIENTS API (BeerJSON) & ADMIN INGREDIENTS
// ==========================================
registerIngredientRoutes(app, ingredientsPool, authenticateToken, requireAdmin, auditLog);

// ==========================================
// ADMIN API & BI ANALYTICS
// ==========================================
const adminApi = registerAdminRoutes({
    app,
    pool,
    authenticateToken,
    requireAdmin,
    deleteDeviceCascade,
    loadActiveBatches,
    sendPushToUser,
    audit: auditLog,
    onTrash: (id) => trashedUsers.add(Number(id)),
    onRestore: (id) => trashedUsers.delete(Number(id)),
});
// Biblioteca de perfis compartilhados (publica na hora; denuncia avisa os admins; o admin esconde)
const libraryApi = registerLibraryRoutes(app, {
    pool, authenticateToken, requireAdmin, audit: auditLog,
    onReport: async (profile) => {
        try {
            const [admins] = await pool.execute("SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL");
            for (const a of admins) sendPushToUser(pool, a.id, 'Perfil denunciado na biblioteca', `"${profile.name}": veja em Admin > Biblioteca`);
        } catch (e) { console.error('Biblioteca (aviso):', e.message); }
    },
});
dbReady.then(() => libraryApi.ensureTables()).catch(e => console.error('Biblioteca (tabelas):', e.message));

// Retencao da telemetria (services/telemetryRetention.js): 1x por dia, 10 min depois de ligar.
// TELEMETRY_RETENTION: 'on' aplica (padrao; ativado em 12/11/2026 apos conferencia) | 'dry' so conta | 'off'
const retentionMode = process.env.TELEMETRY_RETENTION || 'on';
const runRetention = () => {
    if (retentionMode === 'off') return;
    runTelemetryRetention(pool, { dryRun: retentionMode !== 'on', log: (m) => console.log('🧹 ' + m) })
        .catch(e => console.error('Retencao da telemetria:', e.message));
};
setTimeout(runRetention, 10 * 60 * 1000).unref();
setInterval(runRetention, 24 * 60 * 60 * 1000).unref();

// Lixeira: apaga de vez as contas com mais de 30 dias (1x por dia)
setInterval(() => {
    adminApi.purgeExpiredTrash()
        .then(n => { if (n) { console.log(`🗑️ [Lixeira] ${n} conta(s) apagadas apos 30 dias`); loadTrashedUsers(); } })
        .catch(e => console.error('Lixeira:', e.message));
}, 24 * 60 * 60 * 1000).unref();

// Firmware OTA: publicacao pelo GitHub Actions + arquivos servidos a placa (com x-MD5)
registerFirmwareRoutes(app, { firmwareDir: path.resolve(__dirname, 'firmware') });

app.get('/api/broadcasts/active', async (req, res) => {
    try {
        const [broadcasts] = await pool.execute('SELECT * FROM system_broadcasts WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
        res.json(broadcasts[0] || null);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno no servidor' }); }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint de API não encontrado' }));
app.use(express.static(path.join(__dirname, 'dist')));
// O site e servido pelo nginx; aqui o dist so existe em instalacoes locais. Sem ele, 404 em vez de erro ENOENT no log.
const spaIndex = path.join(__dirname, 'dist', 'index.html');
app.get(/(.*)/, (req, res) => (fs.existsSync(spaIndex) ? res.sendFile(spaIndex) : res.status(404).json({ error: 'Não encontrado' })));

if (sentryEnabled) Sentry.setupExpressErrorHandler(app);
const serverInstance = app.listen(PORT, () => { console.log(`🚀 Servidor BATCH MANAGER + RECIPES + REACTIVE rodando na porta ${PORT}`); });

// Graceful shutdown for PM2 / Docker / OS signals
const gracefulShutdown = (signal) => {
    console.log(`🛑 [${signal}] Encerrando servidor com segurança...`);
    try { smartScheduler.stop(); } catch (e) {}
    serverInstance.close(() => {
        try { mqttClient.end(true); } catch (e) {}
        Promise.allSettled([pool.end(), ingredientsPool.end()]).finally(() => {
            process.exit(0);
        });
    });
    // Conexoes keep-alive/SSE seguravam o close() e o PM2 matava com SIGKILL apos 1,6 s; fecha tudo na hora
    try { serverInstance.closeAllConnections(); } catch (e) {}
    setTimeout(() => process.exit(0), 1200).unref();
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
