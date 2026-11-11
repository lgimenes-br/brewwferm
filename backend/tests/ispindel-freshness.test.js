import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIspindelFresh, dropStaleIspindel, ISPINDEL_STALE_MS } from '../services/ispindelFreshness.js';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const epc = msAgo => Math.floor((NOW - msAgo) / 1000);

test('isIspindelFresh', () => {
    assert.equal(isIspindelFresh({ is_sg: 1.05 }, NOW), null); // firmware antigo
    assert.equal(isIspindelFresh({ is_epc: 0 }, NOW), false); // desconhecido
    assert.equal(isIspindelFresh({ is_epc: 12345 }, NOW), false); // relogio sem sincronizar
    assert.equal(isIspindelFresh({ is_epc: epc(20 * 60 * 1000) }, NOW), true);
    assert.equal(isIspindelFresh({ is_epc: epc(ISPINDEL_STALE_MS + 1000) }, NOW), false);
    assert.equal(isIspindelFresh({ is_epc: epc(-60 * 1000) }, NOW), true); // relogio 1 min adiantado
    assert.equal(isIspindelFresh({ is_epc: epc(-60 * 60 * 1000) }, NOW), false); // futuro absurdo
});

test('dropStaleIspindel zera so leitura velha', () => {
    const old = { is_sg: 24.272, is_bat: 3.93, is_epc: epc(3 * 86400000) };
    assert.equal(dropStaleIspindel(old, NOW), true);
    assert.deepEqual([old.is_sg, old.is_bat], [0, 0]);
    const fresh = { is_sg: 1.032, is_bat: 3.9, is_epc: epc(60000) };
    assert.equal(dropStaleIspindel(fresh, NOW), false);
    assert.equal(fresh.is_sg, 1.032);
    const legacy = { is_sg: 1.032, is_bat: 3.9 };
    assert.equal(dropStaleIspindel(legacy, NOW), false);
    assert.equal(legacy.is_bat, 3.9);
});
