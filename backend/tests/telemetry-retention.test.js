import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTelemetryRetention, RETENTION } from '../services/telemetryRetention.js';

// Banco falso: registra as queries e simula contagens
const fakePool = ({ batchlessToDelete = 0, batches = [], counts = {} } = {}) => {
    let left = batchlessToDelete;
    const calls = [];
    return {
        calls,
        async execute(sql, params = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            calls.push({ q, params });
            if (q.startsWith('SELECT COUNT(*) AS n FROM telemetry WHERE batch_id IS NULL')) return [[{ n: left }]];
            if (q.startsWith('DELETE FROM telemetry WHERE batch_id IS NULL')) {
                const n = Math.min(left, RETENTION.deleteChunk); left -= n; return [{ affectedRows: n }];
            }
            if (q.startsWith('SELECT id FROM batches')) return [batches.map(id => ({ id }))];
            if (q.startsWith('SELECT COUNT(*) AS n FROM telemetry WHERE batch_id = ?')) return [[{ n: counts[params[0]]?.total ?? 0 }]];
            if (q.startsWith('SELECT COUNT(*) AS n FROM (')) return [[{ n: counts[params[0]]?.keep ?? 0 }]];
            if (q.startsWith('DELETE FROM telemetry WHERE batch_id = ? AND id NOT IN')) return [{ affectedRows: 1 }];
            if (q.startsWith('UPDATE batches SET telemetry_compacted_at')) return [{}];
            throw new Error('Query nao mockada: ' + q);
        }
    };
};

test('so contar (dryRun): conta tudo e nao apaga nem marca nada', async () => {
    const pool = fakePool({ batchlessToDelete: 12000, batches: [5, 6], counts: { 5: { total: 1440, keep: 96 }, 6: { total: 50, keep: 50 } } });
    const s = await runTelemetryRetention(pool, { dryRun: true });
    assert.deepEqual(s, { batchlessRemoved: 12000, batchesCompacted: 2, compactedRowsRemoved: 1344, dryRun: true });
    assert.equal(pool.calls.some(c => c.q.startsWith('DELETE') || c.q.startsWith('UPDATE')), false);
});

test('aplicar: apaga as leituras sem lote em pedacos e compacta os lotes antigos', async () => {
    const pool = fakePool({ batchlessToDelete: 12000, batches: [5, 6], counts: { 5: { total: 1440, keep: 96 }, 6: { total: 50, keep: 50 } } });
    const s = await runTelemetryRetention(pool);
    assert.equal(s.batchlessRemoved, 12000);
    assert.equal(pool.calls.filter(c => c.q.startsWith('DELETE FROM telemetry WHERE batch_id IS NULL')).length, 3, '5000 + 5000 + 2000');
    // Lote 5 perde linhas; lote 6 ja estava enxuto (sem DELETE), mas os dois ficam marcados
    const del = pool.calls.filter(c => c.q.startsWith('DELETE FROM telemetry WHERE batch_id = ?'));
    assert.deepEqual(del.map(c => c.params[0]), [5]);
    assert.deepEqual(pool.calls.filter(c => c.q.startsWith('UPDATE batches')).map(c => c.params[0]), [5, 6]);
    assert.equal(s.compactedRowsRemoved, 1344);
    // Mantem 1 por janela de 15 min e a ultima leitura do lote
    assert.match(del[0].q, /GROUP BY FLOOR\(UNIX_TIMESTAMP\(recorded_at\) \/ 900\)/);
    assert.match(del[0].q, /SELECT MAX\(id\) FROM telemetry WHERE batch_id = \?/);
});

test('so lotes finalizados ha mais de 30 dias e ainda nao compactados', async () => {
    const pool = fakePool();
    await runTelemetryRetention(pool, { dryRun: true });
    const sel = pool.calls.find(c => c.q.startsWith('SELECT id FROM batches')).q;
    assert.match(sel, /is_active = 0/);
    assert.match(sel, /telemetry_compacted_at IS NULL/);
    assert.match(sel, /INTERVAL 30 DAY/);
});
