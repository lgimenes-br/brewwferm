import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { parseDiagTopic, normalizeDiagEvent, createRateLimiter, registerDeviceDiagnostics } from '../services/deviceDiagnostics.js';

test('parseDiagTopic / normalizeDiagEvent', () => {
    assert.equal(parseDiagTopic('brewbrother/abc123/diag'), 'ABC123');
    assert.equal(parseDiagTopic('brewbrother/abc123/data'), null);
    assert.deepEqual(normalizeDiagEvent({ type: 'lag', ms: 6120.4, net: 6050, reconnect: 6000 }),
        { kind: 'lag', durationMs: 6120, details: { net: 6050, reconnect: 6000 } });
    assert.equal(normalizeDiagEvent({ type: 'DROP TABLE', ms: 1 }), null);
    assert.equal(normalizeDiagEvent([1, 2]), null);
});

test('rate limit por aparelho', () => {
    let t = 0;
    const allow = createRateLimiter(2, () => t);
    assert.equal(allow('A'), true);
    assert.equal(allow('A'), true);
    assert.equal(allow('A'), false);
    assert.equal(allow('B'), true);
    t = 60000;
    assert.equal(allow('A'), true);
});

test('grava eventos recebidos no topico diag', async () => {
    const inserts = [];
    const pool = { execute: async (sql, params) => { if (sql.startsWith('INSERT')) inserts.push(params); return [{}]; } };
    const mqttClient = Object.assign(new EventEmitter(), { connected: true, subscribe: () => {} });
    registerDeviceDiagnostics({ pool, mqttClient });
    mqttClient.emit('message', 'brewbrother/288485495464/diag', Buffer.from(JSON.stringify({ type: 'mqtt_reconnect', ms: 4200, state: -2 })));
    mqttClient.emit('message', 'brewbrother/288485495464/diag', Buffer.from('nao e json'));
    await new Promise(r => setTimeout(r, 10));
    assert.equal(inserts.length, 1);
    assert.deepEqual(inserts[0].slice(0, 3), ['288485495464', 'mqtt_reconnect', 4200]);
});
