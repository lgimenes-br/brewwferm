import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCarry, buildCarryCommands } from '../services/carrySettings.js';

test('valida o que vem do app', () => {
    assert.deepEqual(sanitizeCarry({ mode: 1, setpoint: 4.04, relInv: 3 }), { mode: 1, setpoint: 4, relInv: 3 });
    assert.equal(sanitizeCarry({ mode: 9, setpoint: 99, relInv: 7 }), null);
    assert.equal(sanitizeCarry(null), null);
    assert.deepEqual(sanitizeCarry({ mode: 2, setpoint: null }), { mode: 2 });
});

test('placa sem tela -> sem tela: copia modo, tipo de rele e alvo (fora do fermentador)', () => {
    const c = buildCarryCommands({ mode: 1, setpoint: 4, relInv: 3 }, { board: 'esp32-devkit', hasActiveBatch: false });
    assert.deepEqual(c.map(x => x.cmd), ['setMode', 'set_relays', 'setManual']);
    assert.deepEqual(c[1], { cmd: 'set_relays', type: 'set_relays', heaterInverted: true, coolerInverted: true });
    assert.equal(c[2].val, 4);
});

test('placa nova com tela (s3-35): nunca copia o tipo de rele', () => {
    const c = buildCarryCommands({ mode: 2, setpoint: 3, relInv: 3 }, { board: 's3-35', hasActiveBatch: false });
    assert.deepEqual(c.map(x => x.cmd), ['setMode', 'setManual']);
});

test('fermentador com perfil ativo: nao copia o alvo (o perfil manda)', () => {
    const c = buildCarryCommands({ mode: 0, setpoint: 20, relInv: 0 }, { board: 'esp32-devkit', hasActiveBatch: true });
    assert.deepEqual(c.map(x => x.cmd), ['setMode', 'set_relays']);
    const sem = buildCarryCommands({ mode: 0, setpoint: 20 }, { board: 'esp32-devkit', hasActiveBatch: false });
    assert.deepEqual(sem.map(x => x.cmd), ['setMode', 'setManual']);
});
