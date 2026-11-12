import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFleet } from '../routes/adminRoutes.js';
import { createDeviceRegistry } from '../services/deviceRegistry.js';

test('frota: agrupa por placa, versao e modulos', () => {
    const f = summarizeFleet([
        { board: 's3-35', firmware_version: '2.9.0', hw_modules: '["tela35","ds18b20:2","dht22"]', online: 1 },
        { board: 'esp32-devkit', firmware_version: '2.9.0', hw_modules: '["oled","ds18b20:1","sht3x"]', online: 0 },
        { board: null, firmware_version: '2.6.0', hw_modules: null, online: 1 },
        { board: 'esp32-devkit', firmware_version: '2.8.7', hw_modules: '["ds18b20:0"]', online: 1 },
    ]);
    assert.equal(f.total, 4);
    assert.equal(f.online, 3);
    assert.equal(f.reporting, 3);
    assert.deepEqual(f.boards[0], { name: 'esp32-devkit', count: 2, online: 1 });
    assert.deepEqual(f.versions.find(v => v.name === '2.9.0'), { name: '2.9.0', count: 2, online: 1 });
    assert.ok(f.boards.some(b => b.name === 'desconhecida'));
    const mods = Object.fromEntries(f.modules.map(m => [m.name, m.count]));
    assert.deepEqual(mods, { tela35: 1, 'ds18b20 x2': 1, dht22: 1, oled: 1, 'ds18b20 x1': 1, sht3x: 1 });
});

test('registro: placa e modulos so vao ao banco quando mudam', async () => {
    let t = 1_000_000;
    const reg = createDeviceRegistry({ now: () => t });
    const calls = [];
    const pool = { async execute(sql, params) { calls.push([sql, params]); return [{}]; } };
    const info = { board: 's3-35', mods: ['tela35', 'ds18b20:2'] };
    await reg.touch(pool, 'S1', 1, '2.9.0', info); t += 3000;
    await reg.touch(pool, 'S1', 1, '2.9.0', info); t += 3000;
    await reg.touch(pool, 'S1', 1, '2.9.0', { board: 's3-35', mods: ['tela35', 'ds18b20:1'] });
    const n = (prefix) => calls.filter(([q]) => q.startsWith(prefix)).length;
    assert.equal(n('UPDATE devices SET board'), 1);
    assert.equal(n('UPDATE devices SET hw_modules'), 2);
    assert.deepEqual(calls.filter(([q]) => q.startsWith('UPDATE devices SET hw_modules')).at(-1)[1], ['["tela35","ds18b20:1"]', 1]);
});
