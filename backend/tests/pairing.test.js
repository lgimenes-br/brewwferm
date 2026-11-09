// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerPairingRoutes, maskEmail, normalizeIp, createPairingStore } from '../routes/pairingRoutes.js';

// Banco falso: so entende as queries usadas pelo modulo de pareamento
const createFakePool = () => {
    const db = {
        users: [{ id: 1, email: 'dono@example.com', max_devices: 2 }, { id: 2, email: 'intruso@example.com', max_devices: 2 }],
        devices: [],
        device_keys: [],
        audit: []
    };
    const pool = {
        db,
        async execute(sql, params = []) {
            if (sql.startsWith('SELECT key_hash FROM device_keys')) return [db.device_keys.filter(k => k.serial_code === params[0])];
            if (sql.startsWith('INSERT IGNORE INTO device_keys')) {
                if (!db.device_keys.some(k => k.serial_code === params[0])) db.device_keys.push({ serial_code: params[0], key_hash: params[1] });
                return [{}];
            }
            if (sql.startsWith('UPDATE device_keys')) return [{}];
            if (sql.startsWith('SELECT serial_code FROM device_keys')) return [db.device_keys.filter(k => k.serial_code === params[0])];
            if (sql.startsWith('SELECT id FROM devices WHERE serial_code')) return [db.devices.filter(d => d.serial_code === params[0])];
            if (sql.startsWith('SELECT serial_code FROM devices WHERE serial_code IN')) return [db.devices.filter(d => params.includes(d.serial_code))];
            if (sql.startsWith('SELECT email, max_devices FROM users') || sql.startsWith('SELECT max_devices FROM users')) return [db.users.filter(u => u.id === params[0])];
            if (sql.startsWith('SELECT COUNT(*) as count FROM devices')) return [[{ count: db.devices.filter(d => d.user_id === params[0]).length }]];
            if (sql.startsWith('INSERT INTO devices')) { db.devices.push({ serial_code: params[0], user_id: params[1], device_name: params[2] }); return [{}]; }
            if (sql.startsWith('INSERT INTO audit_logs')) { db.audit.push(params); return [{}]; }
            throw new Error('Query nao mockada: ' + sql);
        }
    };
    return pool;
};

const startServer = async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    const published = [];
    const pool = createFakePool();
    // Token falso: "Bearer <userId>"
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        req.user = { id };
        next();
    };
    const provisioned = [];
    const provisionMqtt = async (serial, key, opts) => { provisioned.push([serial, key, opts]); return true; };
    registerPairingRoutes(app, { pool, mqttClient: { publish: (t, m) => published.push([t, m]) }, authenticateToken, notifyUpdate: () => {}, provisionMqtt });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, path, { body, user, ip = '203.0.113.10' } = {}) => {
        const res = await fetch(base + path, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': ip,
                ...(user ? { Authorization: `Bearer ${user}` } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        return { status: res.status, body: await res.json().catch(() => null) };
    };
    return { server, call, pool, published, provisioned };
};

const SERIAL = '288485495464';
const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

test('helpers', () => {
    assert.equal(maskEmail('fulano@gmail.com'), 'fu****@gmail.com');
    assert.equal(maskEmail('a@x.com'), 'a*@x.com');
    assert.equal(normalizeIp('::ffff:10.0.0.1'), '10.0.0.1');
});

test('pedido expira apos o TTL', () => {
    let t = 0;
    const store = createPairingStore(() => t);
    const p = store.create({ serial: SERIAL, userId: 1, email: 'x@y.z' });
    t = 3 * 60 * 1000;
    assert.equal(store.get(p.id).status, 'expired');
    assert.equal(store.pendingForSerial(SERIAL), null);
});

test('fluxo completo: anuncio, descoberta por IP, pedido e confirmacao no aparelho', async () => {
    const { server, call, pool, published, provisioned } = await startServer();
    try {
        // Placa se anuncia (registra a chave no primeiro contato)
        let r = await call('POST', '/api/device/announce', { body: { serial: SERIAL, key: KEY, localIp: '192.168.0.20' } });
        assert.equal(r.status, 200);
        assert.equal(r.body.claimed, false);
        assert.equal(r.body.pairing, null);
        assert.equal(r.body.mqtt, true);
        assert.deepEqual(provisioned[0], [SERIAL, KEY, { force: true }], 'primeiro contato cria a credencial MQTT');

        // Mesmo IP publico ve o aparelho; outro IP nao
        r = await call('GET', '/api/discovery', { user: 1 });
        assert.deepEqual(r.body.map(d => d.ip), [SERIAL]);
        r = await call('GET', '/api/discovery', { user: 2, ip: '198.51.100.7' });
        assert.deepEqual(r.body, []);

        // Chave errada para o mesmo serial e recusada
        r = await call('POST', '/api/device/announce', { body: { serial: SERIAL, key: OTHER_KEY } });
        assert.equal(r.status, 403);

        // Usuario pede o vinculo -> pendente, placa recebe so um "acorde" sem dados
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL, name: 'Meu Breww' } });
        assert.equal(r.status, 202);
        const { pairingId } = r.body;
        assert.ok(published.some(([t, m]) => t === `brewbrother/${SERIAL}/command` && JSON.parse(m).cmd === 'pair_request' && !m.includes('@')));
        assert.equal(pool.db.devices.length, 0, 'nada e cadastrado antes da confirmacao');

        // Placa busca o pedido (email mascarado)
        r = await call('POST', '/api/device/announce', { body: { serial: SERIAL, key: KEY } });
        assert.equal(r.body.pairing.id, pairingId);
        assert.equal(r.body.pairing.email, 'do**@example.com');

        // Intruso nao consegue confirmar sem a chave da placa, nem ler o pedido de outro usuario
        r = await call('POST', '/api/device/pairing/respond', { body: { serial: SERIAL, key: OTHER_KEY, pairingId, accept: true } });
        assert.equal(r.status, 403);
        r = await call('GET', `/api/devices/pairing/${pairingId}`, { user: 2 });
        assert.equal(r.status, 404);

        // Confirmacao na tela do aparelho
        r = await call('POST', '/api/device/pairing/respond', { body: { serial: SERIAL, key: KEY, pairingId, accept: true } });
        assert.equal(r.body.status, 'confirmed');
        assert.deepEqual(pool.db.devices, [{ serial_code: SERIAL, user_id: 1, device_name: 'Meu Breww' }]);

        r = await call('GET', `/api/devices/pairing/${pairingId}`, { user: 1 });
        assert.equal(r.body.status, 'confirmed');

        // Depois de vinculado: some da descoberta e nao pode ser pedido de novo
        r = await call('GET', '/api/discovery', { user: 2 });
        assert.deepEqual(r.body, []);
        r = await call('POST', '/api/devices', { user: 2, body: { serialCode: SERIAL } });
        assert.equal(r.status, 409);
    } finally {
        server.close();
    }
});

test('recusa no aparelho e aparelho que nunca se conectou', async () => {
    const { server, call, pool } = await startServer();
    try {
        const neverSeen = await call('POST', '/api/devices', { user: 1, body: { serialCode: 'AABBCCDDEEFF' } });
        assert.equal(neverSeen.status, 422);
        await call('POST', '/api/device/announce', { body: { serial: SERIAL, key: KEY } });
        const created = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL } });
        const r = await call('POST', '/api/device/pairing/respond', { body: { serial: SERIAL, key: KEY, pairingId: created.body.pairingId, accept: false } });
        assert.equal(r.body.status, 'rejected');
        assert.equal(pool.db.devices.length, 0);
        const again = await call('POST', '/api/device/pairing/respond', { body: { serial: SERIAL, key: KEY, pairingId: created.body.pairingId, accept: true } });
        assert.equal(again.status, 410);
    } finally {
        server.close();
    }
});
