// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerPairingRoutes, maskEmail, normalizeIp, createPairingStore, derivePairCode, hashDeviceKey, MAX_KEY_CANDIDATES } from '../routes/pairingRoutes.js';

// Banco falso: so entende as queries usadas pelo modulo de pareamento
const createFakePool = () => {
    const db = {
        users: [{ id: 1, email: 'dono@example.com', max_devices: 2 }, { id: 2, email: 'intruso@example.com', max_devices: 2 }],
        devices: [],
        device_keys: [],
        candidates: [],
        audit: []
    };
    const pool = {
        db,
        async execute(sql, params = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.startsWith('SELECT key_hash FROM device_keys')) return [db.device_keys.filter(k => k.serial_code === params[0])];
            if (q.startsWith('INSERT IGNORE INTO device_keys')) {
                if (!db.device_keys.some(k => k.serial_code === params[0])) db.device_keys.push({ serial_code: params[0], key_hash: params[1] });
                return [{}];
            }
            if (q.startsWith('UPDATE device_keys SET key_hash')) {
                db.device_keys.filter(k => k.serial_code === params[1]).forEach(k => { k.key_hash = params[0]; });
                return [{}];
            }
            if (q.startsWith('UPDATE device_keys')) return [{}];
            if (q.startsWith('SELECT key_hash FROM device_key_candidates')) return [db.candidates.filter(c => c.serial_code === params[0])];
            if (q.startsWith('SELECT key_hash, pair_code FROM device_key_candidates')) return [db.candidates.filter(c => c.serial_code === params[0])];
            if (q.startsWith('INSERT IGNORE INTO device_key_candidates')) {
                if (!db.candidates.some(c => c.serial_code === params[0] && c.key_hash === params[1])) {
                    db.candidates.push({ serial_code: params[0], key_hash: params[1], pair_code: params[2] });
                }
                return [{}];
            }
            if (q.startsWith('UPDATE device_key_candidates')) return [{}];
            if (q.startsWith('DELETE FROM device_key_candidates')) { db.candidates = db.candidates.filter(c => c.serial_code !== params[0]); return [{}]; }
            if (q.startsWith('SELECT user_id FROM devices WHERE serial_code')) return [db.devices.filter(d => d.serial_code === params[0])];
            if (q.startsWith('SELECT id FROM devices WHERE serial_code')) return [db.devices.filter(d => d.serial_code === params[0])];
            if (q.startsWith('SELECT serial_code FROM devices WHERE serial_code IN')) return [db.devices.filter(d => params.includes(d.serial_code))];
            if (q.startsWith('SELECT email, max_devices FROM users') || q.startsWith('SELECT max_devices FROM users')) return [db.users.filter(u => u.id === params[0])];
            if (q.startsWith('SELECT COUNT(*) as count FROM devices')) return [[{ count: db.devices.filter(d => d.user_id === params[0]).length }]];
            if (q.startsWith('INSERT INTO devices')) { db.devices.push({ serial_code: params[0], user_id: params[1], device_name: params[2] }); return [{}]; }
            if (q.startsWith('INSERT INTO audit_logs')) { db.audit.push(params); return [{}]; }
            throw new Error('Query nao mockada: ' + q);
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
    const announce = (key, extra = {}) => call('POST', '/api/device/announce', { body: { serial: SERIAL, key, ...extra } });
    const respond = (key, pairingId, accept = true) => call('POST', '/api/device/pairing/respond', { body: { serial: SERIAL, key, pairingId, accept } });
    return { server, call, pool, published, provisioned, announce, respond };
};

const SERIAL = '288485495464';
const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);
const NEW_KEY = 'c'.repeat(64);

test('helpers', () => {
    assert.equal(maskEmail('fulano@gmail.com'), 'fu****@gmail.com');
    assert.equal(maskEmail('a@x.com'), 'a*@x.com');
    assert.equal(normalizeIp('::ffff:10.0.0.1'), '10.0.0.1');
    assert.match(derivePairCode(KEY), /^[0-9A-F]{8}$/);
    assert.notEqual(derivePairCode(KEY), derivePairCode(OTHER_KEY));
});

test('pedido expira apos o TTL', () => {
    let t = 0;
    const store = createPairingStore(() => t);
    const p = store.create({ serial: SERIAL, userId: 1, email: 'x@y.z' });
    t = 3 * 60 * 1000;
    assert.equal(store.get(p.id).status, 'expired');
    assert.equal(store.pendingForSerial(SERIAL), null);
});

test('fluxo com codigo: chave so vale (e so ganha MQTT) depois da confirmacao no aparelho', async () => {
    const { server, call, pool, published, provisioned, announce, respond } = await startServer();
    try {
        // Primeiro contato: chave CANDIDATA, sem credencial MQTT
        let r = await announce(KEY, { localIp: '192.168.0.20' });
        assert.equal(r.status, 200);
        assert.equal(r.body.mqtt, false);
        assert.equal(r.body.bound, false);
        assert.equal(r.body.pairCode, derivePairCode(KEY));
        assert.equal(provisioned.length, 0, 'nada de MQTT antes do vinculo');
        assert.equal(pool.db.device_keys.length, 0);

        // Descoberta por IP continua igual
        r = await call('GET', '/api/discovery', { user: 1 });
        assert.deepEqual(r.body.map(d => d.ip), [SERIAL]);
        r = await call('GET', '/api/discovery', { user: 2, ip: '198.51.100.7' });
        assert.deepEqual(r.body, []);

        // Codigo errado e recusado; o certo cria o pedido
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL, pairCode: '00000000' } });
        assert.equal(r.status, 422);
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL, pairCode: derivePairCode(KEY).toLowerCase(), name: 'Meu Breww' } });
        assert.equal(r.status, 202);
        const { pairingId } = r.body;
        assert.ok(published.some(([t, m]) => t === `brewbrother/${SERIAL}/command` && JSON.parse(m).cmd === 'pair_request' && !m.includes('@')));

        r = await announce(KEY);
        assert.equal(r.body.pairing.id, pairingId);
        assert.equal(r.body.pairing.email, 'do**@example.com');
        r = await call('GET', `/api/devices/pairing/${pairingId}`, { user: 2 });
        assert.equal(r.status, 404);

        // Confirmacao: vincula a chave, cria o MQTT e o aparelho
        r = await respond(KEY, pairingId);
        assert.equal(r.body.status, 'confirmed');
        assert.deepEqual(pool.db.device_keys, [{ serial_code: SERIAL, key_hash: hashDeviceKey(KEY) }]);
        assert.deepEqual(pool.db.devices, [{ serial_code: SERIAL, user_id: 1, device_name: 'Meu Breww' }]);
        assert.deepEqual(provisioned.at(-1), [SERIAL, KEY, { force: true }]);
        assert.equal(pool.db.candidates.length, 0);

        // Depois: chave vinculada ganha MQTT; outra chave e recusada; sai da descoberta
        r = await announce(KEY);
        assert.equal(r.body.mqtt, true);
        assert.equal(r.body.bound, true);
        r = await announce(OTHER_KEY);
        assert.equal(r.status, 403);
        r = await call('GET', '/api/discovery', { user: 2 });
        assert.deepEqual(r.body, []);
        r = await call('POST', '/api/devices', { user: 2, body: { serialCode: SERIAL } });
        assert.equal(r.status, 409);
    } finally {
        server.close();
    }
});

test('sequestro de serial: anunciar o MAC de outra pessoa primeiro nao da acesso', async () => {
    const { server, call, pool, provisioned, announce, respond } = await startServer();
    try {
        // Atacante anuncia o serial antes do aparelho real
        let r = await announce(OTHER_KEY);
        assert.equal(r.body.mqtt, false);
        r = await announce(KEY); // aparelho real
        assert.equal(r.status, 200);
        assert.equal(provisioned.length, 0);

        // Com duas candidatas, sem codigo nao da (precisa do codigo da tela)
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL } });
        assert.equal(r.status, 422);
        assert.equal(r.body.needsPairCode, true);

        // Dono usa o codigo da tela do aparelho real: so ele recebe e pode confirmar
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL, pairCode: derivePairCode(KEY) } });
        const { pairingId } = r.body;
        assert.equal((await announce(OTHER_KEY)).body.pairing, null);
        r = await respond(OTHER_KEY, pairingId);
        assert.equal(r.status, 403);
        assert.equal(pool.db.devices.length, 0);

        r = await respond(KEY, pairingId);
        assert.equal(r.body.status, 'confirmed');
        assert.equal(pool.db.device_keys[0].key_hash, hashDeviceKey(KEY));
        assert.equal((await announce(OTHER_KEY)).status, 403, 'atacante fica de fora');
    } finally {
        server.close();
    }
});

test('transicao: sem codigo so com uma candidata; ALLOW_LEGACY_PAIRING=0 desliga', async () => {
    const { server, call, announce, respond, pool } = await startServer();
    try {
        let r = await call('POST', '/api/devices', { user: 1, body: { serialCode: 'AABBCCDDEEFF' } });
        assert.equal(r.status, 422, 'aparelho que nunca se conectou');

        await announce(KEY);
        process.env.ALLOW_LEGACY_PAIRING = '0';
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL } });
        assert.equal(r.status, 422);
        delete process.env.ALLOW_LEGACY_PAIRING;

        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL } });
        assert.equal(r.status, 202);
        // Recusa no aparelho
        r = await respond(KEY, r.body.pairingId, false);
        assert.equal(r.body.status, 'rejected');
        assert.equal(pool.db.devices.length, 0);
    } finally {
        delete process.env.ALLOW_LEGACY_PAIRING;
        server.close();
    }
});

test('aparelho com chave vinculada antes desta mudanca continua pareando sem codigo', async () => {
    const { server, call, pool, announce, respond } = await startServer();
    try {
        pool.db.device_keys.push({ serial_code: SERIAL, key_hash: hashDeviceKey(KEY) });
        let r = await announce(KEY);
        assert.equal(r.body.mqtt, true);
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL } });
        assert.equal(r.status, 202);
        r = await respond(KEY, r.body.pairingId);
        assert.equal(r.body.status, 'confirmed');
        assert.equal(pool.db.devices.length, 1);
    } finally {
        server.close();
    }
});

test('troca de chave: aparelho resetado volta pelo dono com o codigo novo', async () => {
    const { server, call, pool, provisioned, announce, respond } = await startServer();
    try {
        pool.db.device_keys.push({ serial_code: SERIAL, key_hash: hashDeviceKey(KEY) });
        pool.db.devices.push({ serial_code: SERIAL, user_id: 1, device_name: 'Breww' });

        // Aparelho resetado gera chave nova: recusado, mas a chave fica candidata
        let r = await announce(NEW_KEY);
        assert.equal(r.status, 403);

        // Outro usuario nao pode; o dono sem codigo tambem nao
        r = await call('POST', '/api/devices', { user: 2, body: { serialCode: SERIAL, pairCode: derivePairCode(NEW_KEY) } });
        assert.equal(r.status, 409);
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL } });
        assert.equal(r.status, 409);

        // Dono com o codigo novo: a placa nova recebe o pedido e confirma
        r = await call('POST', '/api/devices', { user: 1, body: { serialCode: SERIAL, pairCode: derivePairCode(NEW_KEY) } });
        assert.equal(r.status, 202);
        const { pairingId } = r.body;
        r = await announce(NEW_KEY);
        assert.equal(r.status, 200);
        assert.equal(r.body.pairing.id, pairingId);
        r = await respond(NEW_KEY, pairingId);
        assert.equal(r.body.status, 'confirmed');
        assert.equal(pool.db.device_keys[0].key_hash, hashDeviceKey(NEW_KEY));
        assert.deepEqual(provisioned.at(-1), [SERIAL, NEW_KEY, { force: true }]);
        assert.equal(pool.db.devices.length, 1, 'continua o mesmo aparelho do dono');
        assert.equal((await announce(KEY)).status, 403, 'chave antiga deixa de valer');
    } finally {
        server.close();
    }
});

test('limite de chaves candidatas por serial', async () => {
    const { server, announce } = await startServer();
    try {
        for (let i = 0; i < MAX_KEY_CANDIDATES; i++) {
            assert.equal((await announce(String(i).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'd'))).status, 200);
        }
        assert.equal((await announce('e'.repeat(64))).status, 429);
    } finally {
        server.close();
    }
});
