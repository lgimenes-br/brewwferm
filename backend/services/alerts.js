// Avisos da conta: catalogo dos tipos, regras de cada pessoa (o que receber, horario de silencio) e envio.
// Todo aviso de lote/aparelho passa por notify(): confere se o tipo esta ligado e, no horario de silencio,
// guarda os que nao sao urgentes e manda um resumo quando o silencio acaba.
// Os avisos novos que dependem de historico (fermentacao estabilizou, compressor ligando demais) rodam
// em startAlertJobs, a cada 30 min. "Uma vez por lote" fica gravado em alert_sent (sobrevive a reinicio).

// Tipo -> campo nas regras. urgent: passa mesmo no horario de silencio.
export const ALERT_TYPES = {
    temp_out: { field: 'tempDeviationEnabled', urgent: true },
    temp_back: { field: 'tempBackEnabled' },
    step_change: { field: 'stepChangeEnabled' },
    sg_target: { field: 'sgTargetEnabled' },
    forecast: { field: 'forecastEnabled' },
    stable: { field: 'stableEnabled' },
    profile_done: { field: 'profileDoneEnabled' },
    offline: { field: 'offlineEnabled', urgent: true },
    online: { field: 'onlineEnabled' },
    battery: { field: 'lowBatteryEnabled' },
    sensor_lost: { field: 'sensorLostEnabled', urgent: true },
    sensor_back: { field: 'sensorLostEnabled' },
    compressor: { field: 'compressorEnabled' },
};

export const OFFLINE_DELAYS = [10, 30, 60];

export const DEFAULT_ALERT_CONFIG = {
    lowBatteryEnabled: true,
    lowBatteryThreshold: 3.5,
    tempDeviationEnabled: true,
    tempDeviationMargin: 1.5,
    tempBackEnabled: true,
    stepChangeEnabled: true,
    sgTargetEnabled: true,
    sgTargetValue: null,
    forecastEnabled: true,
    stableEnabled: true,
    profileDoneEnabled: true,
    offlineEnabled: true,
    offlineDelayMin: 10,
    onlineEnabled: true,
    sensorLostEnabled: true,
    compressorEnabled: true,
    quietEnabled: false,
    quietStart: '23:00',
    quietEnd: '07:00',
    timeZone: 'America/Sao_Paulo',
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const validTimeZone = (tz) => {
    if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
    try { new Intl.DateTimeFormat('pt-BR', { timeZone: tz }); return true; } catch { return false; }
};

/**
 * Regras validadas. `input` = o que veio do app/site; `prev` = o que estava gravado. Campo que nao veio fica
 * como estava: o app antigo (so 3 alertas) nao apaga as escolhas novas ao salvar.
 */
export const normalizeAlertConfig = (input = {}, prev = {}) => {
    const base = { ...DEFAULT_ALERT_CONFIG, ...(prev && typeof prev === 'object' ? prev : {}) };
    const c = { ...base, ...(input && typeof input === 'object' ? input : {}) };
    const out = {};
    for (const k of Object.keys(DEFAULT_ALERT_CONFIG)) {
        if (typeof DEFAULT_ALERT_CONFIG[k] === 'boolean') out[k] = c[k] !== false && c[k] !== 'false';
    }
    out.lowBatteryThreshold = Math.max(2.8, Math.min(4.2, parseFloat(c.lowBatteryThreshold) || 3.5));
    out.tempDeviationMargin = Math.max(0.2, Math.min(10, parseFloat(c.tempDeviationMargin) || 1.5));
    const sg = parseFloat(c.sgTargetValue);
    const sgNorm = !isNaN(sg) && sg > 0 ? (sg > 500 ? sg / 1000 : sg) : null;
    out.sgTargetValue = sgNorm && sgNorm > 0.98 && sgNorm < 1.2 ? Math.round(sgNorm * 1000) / 1000 : null;
    const delay = parseInt(c.offlineDelayMin, 10);
    out.offlineDelayMin = OFFLINE_DELAYS.includes(delay) ? delay : 10;
    out.quietStart = HHMM.test(c.quietStart) ? c.quietStart : DEFAULT_ALERT_CONFIG.quietStart;
    out.quietEnd = HHMM.test(c.quietEnd) ? c.quietEnd : DEFAULT_ALERT_CONFIG.quietEnd;
    out.timeZone = validTimeZone(c.timeZone) ? c.timeZone : (validTimeZone(base.timeZone) ? base.timeZone : DEFAULT_ALERT_CONFIG.timeZone);
    return out;
};

export const alertEnabled = (cfg, type) => {
    const t = ALERT_TYPES[type];
    if (!t) return true; // tipo desconhecido (ex.: aviso da plataforma): sempre
    return cfg?.[t.field] !== false;
};

/** Minutos do dia (0-1439) no fuso da pessoa */
export const localMinutes = (timeZone, now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    return (h % 24) * 60 + m;
};

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Dentro do horario de silencio? Janela pode passar da meia-noite (23:00-07:00). */
export const inQuietHours = (cfg, now = new Date()) => {
    if (!cfg?.quietEnabled) return false;
    const start = toMin(HHMM.test(cfg.quietStart) ? cfg.quietStart : DEFAULT_ALERT_CONFIG.quietStart);
    const end = toMin(HHMM.test(cfg.quietEnd) ? cfg.quietEnd : DEFAULT_ALERT_CONFIG.quietEnd);
    if (start === end) return false;
    let tz = cfg.timeZone;
    if (!validTimeZone(tz)) tz = DEFAULT_ALERT_CONFIG.timeZone;
    const cur = localMinutes(tz, now);
    return start < end ? cur >= start && cur < end : cur >= start || cur < end;
};

/**
 * @param {object} deps { getConfig(userId) -> cfg, send(userId, title, body) }
 */
export const createNotifier = ({ getConfig, send, now = () => new Date() }) => {
    const held = new Map(); // userId -> [{title, body}]

    const notify = async (userId, type, title, body) => {
        if (!userId) return 'skip';
        const cfg = await getConfig(userId);
        if (!alertEnabled(cfg, type)) return 'off';
        if (!ALERT_TYPES[type]?.urgent && inQuietHours(cfg, now())) {
            const list = held.get(userId) || [];
            list.push({ title, body });
            held.set(userId, list.slice(-20));
            return 'held';
        }
        await send(userId, title, body);
        return 'sent';
    };

    // Fim do silencio: um resumo so com o que ficou guardado
    const flush = async () => {
        for (const [userId, list] of [...held.entries()]) {
            const cfg = await getConfig(userId);
            if (inQuietHours(cfg, now())) continue;
            held.delete(userId);
            if (!list.length) continue;
            if (list.length === 1) { await send(userId, list[0].title, list[0].body); continue; }
            const lines = list.map((a) => `• ${a.title}: ${a.body}`);
            let body = lines.join('\n');
            if (body.length > 1500) body = body.slice(0, 1490) + '…';
            await send(userId, `${list.length} avisos durante o horário de silêncio`, body);
        }
    };

    return { notify, flush, held };
};

// ---------------------------------------------------------------------------------------------------
// Avisos que dependem de historico
// ---------------------------------------------------------------------------------------------------

export const ensureAlertSchema = (pool) => pool.execute(`CREATE TABLE IF NOT EXISTS alert_sent (
    batch_id INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    sent_at DATETIME NOT NULL,
    PRIMARY KEY (batch_id, type)
)`);

/** true se pode mandar (e ja marca): uma vez por lote, ou de novo depois de `cooldownH` horas */
export const claimAlert = async (pool, batchId, type, cooldownH = null) => {
    const [rows] = await pool.execute('SELECT TIMESTAMPDIFF(MINUTE, sent_at, NOW()) AS age FROM alert_sent WHERE batch_id = ? AND type = ?', [batchId, type]);
    if (!rows.length) {
        await pool.execute('INSERT IGNORE INTO alert_sent (batch_id, type, sent_at) VALUES (?, ?, NOW())', [batchId, type]);
        return true;
    }
    if (cooldownH && Number(rows[0].age) >= cooldownH * 60) {
        await pool.execute('UPDATE alert_sent SET sent_at = NOW() WHERE batch_id = ? AND type = ?', [batchId, type]);
        return true;
    }
    return false;
};

const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Fermentacao estabilizou: densidade parada (variacao <= 0.001) por ~2 dias, depois de ter caido de verdade.
 * readings: [{ h: horas atras, sg }] das ultimas ~50 h; og = densidade inicial (do lote ou a 1a leitura).
 * Funcao pura (testavel).
 */
export const detectStable = (readings, og) => {
    const valid = readings.filter((r) => r.sg >= 0.99 && r.sg <= 1.15);
    if (valid.length < 8) return null;
    const oldest = Math.max(...valid.map((r) => r.h));
    if (oldest < 46) return null; // ainda nao tem 2 dias de leituras
    const start = valid.filter((r) => r.h >= oldest - 6).map((r) => r.sg);
    const end = valid.filter((r) => r.h <= 6).map((r) => r.sg);
    if (start.length < 2 || end.length < 2) return null;
    const sgStart = median(start);
    const sgEnd = median(end);
    if (Math.abs(sgStart - sgEnd) > 0.001) return null;
    const ogN = og > 500 ? og / 1000 : og;
    if (!(ogN > 1.0) || ogN - sgEnd < 0.008) return null; // nao fermentou o bastante (ou nao comecou)
    return { sg: Math.round(sgEnd * 1000) / 1000 };
};

export const COMPRESSOR_WINDOW_H = 6;
export const COMPRESSOR_MAX_STARTS = 15; // ~2,5 por hora; a analise do lote considera >2/h ciclo curto

export const startAlertJobs = ({ pool, notify, intervalMs = 30 * 60 * 1000 }) => {
    const run = async () => {
        let batches = [];
        try {
            [batches] = await pool.execute(
                `SELECT b.id, b.name, b.og, d.user_id FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1`);
        } catch (e) { console.warn('[Alertas] lotes:', e?.message || e); return; }
        for (const b of batches) {
            try {
                // Fermentacao estabilizou
                const [rows] = await pool.execute(
                    `SELECT TIMESTAMPDIFF(MINUTE, recorded_at, NOW()) / 60 AS h, gravity AS sg FROM telemetry
                     WHERE batch_id = ? AND recorded_at > NOW() - INTERVAL 50 HOUR AND gravity BETWEEN 0.99 AND 1.15`, [b.id]);
                let og = parseFloat(b.og);
                if (!(og > 0)) {
                    const [[first]] = await pool.execute('SELECT gravity FROM telemetry WHERE batch_id = ? AND gravity BETWEEN 0.99 AND 1.15 ORDER BY id LIMIT 1', [b.id]);
                    og = parseFloat(first?.gravity);
                }
                const st = detectStable(rows.map((r) => ({ h: Number(r.h), sg: Number(r.sg) })), og);
                if (st && await claimAlert(pool, b.id, 'stable')) {
                    await notify(b.user_id, 'stable', 'Fermentação estabilizou',
                        `A densidade de "${b.name}" está parada em ${st.sg.toFixed(3)} há 2 dias: a fermentação provavelmente terminou. Confira e planeje o cold crash ou o envase.`);
                }

                // Compressor ligando demais
                const [[relay]] = await pool.execute(
                    `SELECT SUM(status_op = 'Resfriando' AND (prev IS NULL OR prev <> 'Resfriando')) AS cool
                     FROM (SELECT status_op, LAG(status_op) OVER (ORDER BY id) AS prev FROM telemetry
                           WHERE batch_id = ? AND recorded_at > NOW() - INTERVAL ${COMPRESSOR_WINDOW_H} HOUR) x`, [b.id]);
                const starts = Number(relay?.cool) || 0;
                if (starts > COMPRESSOR_MAX_STARTS && await claimAlert(pool, b.id, 'compressor', 24)) {
                    await notify(b.user_id, 'compressor', 'Compressor ligando demais',
                        `O compressor ligou ${starts} vezes nas últimas ${COMPRESSOR_WINDOW_H} horas ("${b.name}"). Ciclos curtos gastam a geladeira: aumente a histerese ou a proteção do compressor nos ajustes.`);
                }
            } catch (e) { console.warn(`[Alertas] lote ${b.id}:`, e?.message || e); }
        }
    };
    const first = setTimeout(run, 2 * 60 * 1000);
    const timer = setInterval(run, intervalMs);
    return { run, stop() { clearTimeout(first); clearInterval(timer); } };
};
