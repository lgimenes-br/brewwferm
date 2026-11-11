import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceRegistry, LAST_SEEN_FLUSH_MS } from '../services/deviceRegistry.js';

function fakePool(rowsBySerial = {}) {
  const calls = [];
  return {
    calls,
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id FROM devices')) {
        const id = rowsBySerial[params[0]];
        return [id ? [{ id }] : []];
      }
      return [{}];
    },
  };
}

const count = (pool, prefix) => pool.calls.filter((c) => c.sql.startsWith(prefix)).length;

test('lookup consulta o banco uma vez e usa o cache depois', async () => {
  let t = 1_000_000;
  const reg = createDeviceRegistry({ now: () => t });
  const pool = fakePool({ ABC123: 7 });
  assert.equal(await reg.lookup(pool, ' abc123 '), 7);
  t += 3000;
  assert.equal(await reg.lookup(pool, 'ABC123'), 7);
  assert.equal(count(pool, 'SELECT id FROM devices'), 1);
});

test('lookup expira o cache e serial desconhecido expira mais rapido', async () => {
  let t = 1_000_000;
  const reg = createDeviceRegistry({ now: () => t });
  const pool = fakePool({ KNOWN: 1 });
  await reg.lookup(pool, 'KNOWN');
  assert.equal(await reg.lookup(pool, 'NEW'), null);
  t += 31_000; // negativo expirou, positivo nao
  await reg.lookup(pool, 'KNOWN');
  await reg.lookup(pool, 'NEW');
  assert.equal(count(pool, 'SELECT id FROM devices'), 3);
  t += 5 * 60 * 1000;
  await reg.lookup(pool, 'KNOWN'); // positivo expirou tambem
  assert.equal(count(pool, 'SELECT id FROM devices'), 4);
});

test('invalidate forca nova consulta (aparelho pareado ou removido)', async () => {
  const reg = createDeviceRegistry({ now: () => 1_000_000 });
  const rows = {};
  const pool = fakePool(rows);
  assert.equal(await reg.lookup(pool, 'S1'), null);
  rows.S1 = 9; // pareou agora
  reg.invalidate('s1');
  assert.equal(await reg.lookup(pool, 'S1'), 9);
});

test('touch grava last_seen no maximo 1x por minuto, mas o contato em memoria e exato', async () => {
  let t = 1_000_000;
  const reg = createDeviceRegistry({ now: () => t });
  const pool = fakePool();
  for (let i = 0; i < 20; i++) { await reg.touch(pool, 'S1', 1); t += 3000; } // 60 s de pacotes
  assert.equal(count(pool, 'UPDATE devices SET last_seen'), 1);
  assert.equal(reg.lastSeenMs('S1'), t - 3000);
  await reg.touch(pool, 'S1', 1); // passou 1 min desde a gravacao
  assert.equal(count(pool, 'UPDATE devices SET last_seen'), 2);
  assert.ok(LAST_SEEN_FLUSH_MS === 60_000);
});

test('firmware so e gravado quando muda', async () => {
  let t = 1_000_000;
  const reg = createDeviceRegistry({ now: () => t });
  const pool = fakePool();
  await reg.touch(pool, 'S1', 1, '2.8.0'); t += 3000;
  await reg.touch(pool, 'S1', 1, '2.8.0'); t += 3000;
  await reg.touch(pool, 'S1', 1, '2.9.0');
  assert.equal(count(pool, 'UPDATE devices SET firmware_version'), 2);
});

test('isOnline usa a memoria e, sem ela, o valor do banco', async () => {
  let t = 1_000_000;
  const reg = createDeviceRegistry({ now: () => t });
  assert.equal(reg.isOnline('S1', 30_000, 1), true);  // recem-reiniciado: confia no banco
  assert.equal(reg.isOnline('S1', 30_000, 0), false);
  await reg.touch(fakePool(), 'S1', 1);
  t += 25_000;
  assert.equal(reg.isOnline('S1', 30_000, 0), true);  // banco atrasado nao derruba
  t += 10_000;
  assert.equal(reg.isOnline('S1', 30_000, 1), false); // sem pacote ha 35 s
});
