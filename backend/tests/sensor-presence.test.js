import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humidityInPayload, ispindelEpochInPayload, tempSlotsInPayload } from '../services/deviceRegistry.js';

test('umidade: leitura valida ou modulo detectado', () => {
    assert.equal(humidityInPayload({ ext_s: { hum: 61.2 } }), true);
    assert.equal(humidityInPayload({ ext_s: { hum: null }, mods: ['tela35', 'ds18b20:2', 'dht22'] }), true);
    assert.equal(humidityInPayload({ ext_s: { hum: null }, mods: ['tela35', 'ds18b20:0'] }), false);
    assert.equal(humidityInPayload({}), false);
});

test('iSpindel: epoch valido (fw novo) ou densidade (fw antigo)', () => {
    const now = Date.UTC(2026, 10, 23, 12) ;
    assert.equal(ispindelEpochInPayload({ is_epc: 1795000000 }, now), 1795000000);
    assert.equal(ispindelEpochInPayload({ is_epc: 0, is_sg: 1.012 }, now), 0, 'fw novo sem leitura');
    assert.equal(ispindelEpochInPayload({ is_epc: now / 1000 + 3600 }, now), 0, 'epoch no futuro');
    assert.equal(ispindelEpochInPayload({ is_sg: 1.012 }, now), Math.floor(now / 1000));
    assert.equal(ispindelEpochInPayload({ is_sg: 0 }, now), 0);
});

test('sensores 2-4: lista t (null = sem leitura) ou amb no firmware antigo', () => {
    assert.deepEqual(tempSlotsInPayload({ t: [18.5, 4.2, null, null] }), [true, false, false]);
    assert.deepEqual(tempSlotsInPayload({ t: [18.5, null, 20.1, -127] }), [false, true, false]);
    assert.deepEqual(tempSlotsInPayload({ amb: 4.2 }), [true, false, false]);
    assert.deepEqual(tempSlotsInPayload({ amb: 0 }), [false, false, false]);
});
