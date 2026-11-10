// ============================================================================
// Diagnosticos enviados pelas placas (topico brewbrother/<SERIAL>/diag)
// Ex.: travamentos do loop principal ("lag") e quedas/reconexoes do MQTT.
// Guardados por 30 dias para investigar problemas intermitentes sem precisar
// do Serial Monitor. Consulta: backend/scripts/print-diagnostics.js
// ============================================================================

const DIAG_TOPIC_RE = /^brewbrother\/([^/]+)\/diag$/;
const RETENTION_DAYS = 30;
const MAX_EVENTS_PER_MINUTE = 60; // por aparelho (protecao contra flood)
const MAX_PAYLOAD_BYTES = 2048;

export const parseDiagTopic = (topic) => {
    const m = DIAG_TOPIC_RE.exec(topic);
    return m ? m[1].trim().toUpperCase() : null;
};

/** Normaliza o evento recebido. Retorna null se invalido. */
export const normalizeDiagEvent = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const kind = typeof raw.type === 'string' ? raw.type.slice(0, 32) : '';
    if (!/^[a-z_]+$/.test(kind)) return null;
    const durationMs = Number.isFinite(Number(raw.ms)) ? Math.max(0, Math.round(Number(raw.ms))) : null;
    const { type, ms, ...details } = raw;
    return { kind, durationMs, details };
};

export const createRateLimiter = (limit = MAX_EVENTS_PER_MINUTE, now = () => Date.now()) => {
    const buckets = new Map();
    return (key) => {
        const t = now();
        const b = buckets.get(key);
        if (!b || t - b.start >= 60000) { buckets.set(key, { start: t, count: 1 }); return true; }
        b.count += 1;
        return b.count <= limit;
    };
};

export const registerDeviceDiagnostics = ({ pool, mqttClient }) => {
    const allow = createRateLimiter();

    pool.execute(`CREATE TABLE IF NOT EXISTS device_diagnostics (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        serial_code VARCHAR(100) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        duration_ms INT DEFAULT NULL,
        details JSON,
        received_at DATETIME DEFAULT NOW(),
        INDEX idx_diag_serial_time (serial_code, received_at)
    )`).catch(err => console.error('❌ [Diag] Falha ao criar tabela:', err.message));

    const subscribe = () => mqttClient.subscribe('brewbrother/+/diag');
    if (mqttClient.connected) subscribe();
    mqttClient.on('connect', subscribe);

    mqttClient.on('message', async (topic, message) => {
        const serial = parseDiagTopic(topic);
        if (!serial) return;
        if (message.length > MAX_PAYLOAD_BYTES || !allow(serial)) return;
        let event;
        try {
            event = normalizeDiagEvent(JSON.parse(message.toString()));
        } catch {
            return;
        }
        if (!event) return;
        try {
            await pool.execute(
                'INSERT INTO device_diagnostics (serial_code, kind, duration_ms, details) VALUES (?, ?, ?, ?)',
                [serial, event.kind, event.durationMs, JSON.stringify(event.details)]
            );
            if (event.kind === 'lag' || event.kind === 'mqtt_reconnect') {
                console.log(`🩺 [Diag] ${serial} ${event.kind} ${event.durationMs ?? ''}ms ${JSON.stringify(event.details)}`);
            }
        } catch (err) {
            console.error('❌ [Diag] Falha ao gravar evento:', err.message);
        }
    });

    const prune = () => pool
        .execute(`DELETE FROM device_diagnostics WHERE received_at < NOW() - INTERVAL ${RETENTION_DAYS} DAY`)
        .catch(() => {});
    setInterval(prune, 6 * 60 * 60 * 1000).unref?.();
    setTimeout(prune, 60 * 1000).unref?.();
};
