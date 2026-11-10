// Lista diagnosticos das placas (travamentos, quedas de MQTT).
// Uso (na VPS):  node scripts/print-diagnostics.js [--hours 24] [--serial 288485495464] [--kind lag]
// Normalmente executado pelo workflow manual ".github/workflows/diagnostics.yml".
import 'dotenv/config';
import mysql from 'mysql2/promise';

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const hours = Math.min(Math.max(parseInt(arg('hours', '24'), 10) || 24, 1), 24 * 30);
const serial = arg('serial', '').trim().toUpperCase();
const kind = arg('kind', '').trim();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'brewbrother'
});

try {
    const where = ['received_at >= NOW() - INTERVAL ? HOUR'];
    const params = [hours];
    if (serial) { where.push('serial_code = ?'); params.push(serial); }
    if (kind) { where.push('kind = ?'); params.push(kind); }
    const [rows] = await pool.query(
        `SELECT received_at, serial_code, kind, duration_ms, details FROM device_diagnostics
         WHERE ${where.join(' AND ')} ORDER BY received_at ASC LIMIT 1000`, params);

    console.log(`=== Diagnosticos: ultimas ${hours}h${serial ? ` | ${serial}` : ''}${kind ? ` | ${kind}` : ''} | ${rows.length} evento(s) ===`);
    for (const r of rows) {
        const when = new Date(r.received_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const details = typeof r.details === 'string' ? r.details : JSON.stringify(r.details);
        console.log(`${when} | ${r.serial_code} | ${r.kind.padEnd(14)} | ${String(r.duration_ms ?? '').padStart(6)} ms | ${details}`);
    }
    const [summary] = await pool.query(
        `SELECT serial_code, kind, COUNT(*) n, MAX(duration_ms) max_ms, ROUND(AVG(duration_ms)) avg_ms
         FROM device_diagnostics WHERE ${where.join(' AND ')} GROUP BY serial_code, kind`, params);
    if (summary.length) {
        console.log('=== Resumo ===');
        for (const s of summary) console.log(`${s.serial_code} | ${s.kind.padEnd(14)} | ${s.n} evento(s) | max ${s.max_ms} ms | media ${s.avg_ms} ms`);
    }

    // Disponibilidade e sinal do Wi-Fi, hora a hora, a partir da telemetria gravada
    const devWhere = serial ? 'WHERE d.serial_code = ?' : '';
    const devParams = serial ? [serial] : [];
    const [devs] = await pool.query(`SELECT d.id, d.serial_code, d.last_seen, d.firmware_version FROM devices d ${devWhere}`, devParams);
    for (const d of devs) {
        const last = d.last_seen ? new Date(d.last_seen).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca';
        console.log(`=== ${d.serial_code} | fw ${d.firmware_version || '?'} | ultimo contato: ${last} ===`);
        const [hoursRows] = await pool.query(
            `SELECT DATE_FORMAT(CONVERT_TZ(recorded_at, @@session.time_zone, '-03:00'), '%d/%m %H:00') h,
                    COUNT(*) n, MIN(rssi) rssi_min, ROUND(AVG(rssi)) rssi_avg, MAX(rssi) rssi_max
             FROM telemetry WHERE device_id = ? AND recorded_at >= NOW() - INTERVAL ? HOUR
             GROUP BY h ORDER BY MIN(recorded_at)`, [d.id, hours]);
        if (!hoursRows.length) console.log('  (sem telemetria gravada no periodo)');
        for (const r of hoursRows) {
            console.log(`  ${r.h} | ${String(r.n).padStart(4)} leituras | RSSI min ${r.rssi_min ?? '?'} / media ${r.rssi_avg ?? '?'} / max ${r.rssi_max ?? '?'} dBm`);
        }
    }
} catch (err) {
    console.error('Erro ao consultar diagnosticos:', err.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
