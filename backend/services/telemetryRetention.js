// Retencao da telemetria (cada aparelho grava ~1 leitura/min: 1.440 linhas/dia).
//  - lote ativo: tudo, resolucao total
//  - lote finalizado ha menos de 30 dias: tudo, resolucao total
//  - lote finalizado ha mais de 30 dias: 1 ponto a cada 15 min (mais a ultima leitura), para sempre
//  - leituras sem lote (aparelho parado): 30 dias (o CSV sem lote exporta 30 dias)
// Roda em pedacos pequenos (nao trava o banco) e e idempotente. dryRun = so conta.

export const RETENTION = {
    batchlessDays: 30,
    compactAfterDays: 30,
    bucketSeconds: 15 * 60,
    deleteChunk: 5000,
    batchesPerRun: 200,
};

const pause = (ms) => new Promise(r => setTimeout(r, ms));

/** Linhas a manter de um lote compactado: a primeira de cada janela de 15 min e a ultima do lote. */
const KEEP_UNION = `
        SELECT MIN(id) AS keep_id FROM telemetry WHERE batch_id = ? GROUP BY FLOOR(UNIX_TIMESTAMP(recorded_at) / ${RETENTION.bucketSeconds})
        UNION
        SELECT MAX(id) FROM telemetry WHERE batch_id = ?`;
// Tabela derivada: o MariaDB nao deixa o DELETE ler a mesma tabela direto no subselect
const KEEP_SQL = `SELECT keep_id FROM (${KEEP_UNION}) k`;

export async function runTelemetryRetention(pool, { dryRun = false, log = () => {} } = {}) {
    const stats = { batchlessRemoved: 0, batchesCompacted: 0, compactedRowsRemoved: 0, dryRun };

    // 1) Leituras sem lote com mais de 30 dias
    if (dryRun) {
        const [[r]] = await pool.execute(`SELECT COUNT(*) AS n FROM telemetry WHERE batch_id IS NULL AND recorded_at < NOW() - INTERVAL ${RETENTION.batchlessDays} DAY`);
        stats.batchlessRemoved = Number(r.n);
    } else {
        for (;;) {
            const [res] = await pool.execute(`DELETE FROM telemetry WHERE batch_id IS NULL AND recorded_at < NOW() - INTERVAL ${RETENTION.batchlessDays} DAY LIMIT ${RETENTION.deleteChunk}`);
            stats.batchlessRemoved += res.affectedRows || 0;
            if ((res.affectedRows || 0) < RETENTION.deleteChunk) break;
            await pause(200);
        }
    }

    // 2) Lotes finalizados ha mais de 30 dias e ainda nao compactados
    const [batches] = await pool.execute(
        `SELECT id FROM batches
         WHERE is_active = 0 AND telemetry_compacted_at IS NULL
           AND COALESCE(ended_at, started_at) < NOW() - INTERVAL ${RETENTION.compactAfterDays} DAY
         ORDER BY id LIMIT ${RETENTION.batchesPerRun}`
    );
    for (const { id } of batches) {
        const [[t]] = await pool.execute('SELECT COUNT(*) AS n FROM telemetry WHERE batch_id = ?', [id]);
        const [[k]] = await pool.execute(`SELECT COUNT(*) AS n FROM (${KEEP_UNION}) k`, [id, id]);
        const remove = Math.max(0, Number(t.n) - Number(k.n));
        if (!dryRun) {
            if (remove > 0) {
                await pool.execute(`DELETE FROM telemetry WHERE batch_id = ? AND id NOT IN (${KEEP_SQL})`, [id, id, id]);
            }
            await pool.execute('UPDATE batches SET telemetry_compacted_at = NOW() WHERE id = ?', [id]);
            await pause(100);
        }
        stats.batchesCompacted++;
        stats.compactedRowsRemoved += remove;
    }

    log(`[Retencao] ${dryRun ? '(so contagem) ' : ''}sem lote: ${stats.batchlessRemoved} linhas; ` +
        `lotes compactados: ${stats.batchesCompacted} (${stats.compactedRowsRemoved} linhas)`);
    return stats;
}
