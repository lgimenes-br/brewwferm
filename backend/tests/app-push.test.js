import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { isValidExpoToken, sendAppPushToUser, registerAppPushRoutes } from '../services/appPush.js';

const TOKEN = 'ExponentPushToken[abcdefghijklmnop12]';

// Banco falso: guarda tokens em memoria e entende as consultas usadas pelo modulo
const fakePool = () => {
    const rows = [];
    let nextId = 1;
    return {
        rows,
        execute: async (sql, params = []) => {
            if (sql.startsWith('CREATE TABLE')) return [[]];
            if (sql.startsWith('SELECT id, token FROM app_push_tokens')) {
                return [rows.filter(r => r.user_id === params[0]).map(r => ({ id: r.id, token: r.token }))];
            }
            if (sql.startsWith('INSERT INTO app_push_tokens')) {
                const [userId, token, platform] = params;
                const found = rows.find(r => r.token === token);
                if (found) Object.assign(found, { user_id: userId, platform });
                else rows.push({ id: nextId++, user_id: userId, token, platform });
                return [{}];
            }
            if (sql.startsWith('DELETE FROM app_push_tokens WHERE id')) {
                const i = rows.findIndex(r => r.id === params[0]);
                if (i >= 0) rows.splice(i, 1);
                return [{}];
            }
            if (sql.startsWith('DELETE FROM app_push_tokens WHERE token')) {
                const i = rows.findIndex(r => r.token === params[0] && r.user_id === params[1]);
                if (i >= 0) rows.splice(i, 1);
                return [{}];
            }
            throw new Error('SQL inesperado: ' + sql);
        },
    };
};

test('isValidExpoToken', () => {
    assert.equal(isValidExpoToken(TOKEN), true);
    assert.equal(isValidExpoToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]'), true);
    assert.equal(isValidExpoToken('ExponentPushToken[]'), false);
    assert.equal(isValidExpoToken('https://evil.example'), false);
    assert.equal(isValidExpoToken(undefined), false);
});

test('envia para os tokens do usuario e apaga os que nao existem mais', async () => {
    const pool = fakePool();
    pool.rows.push({ id: 1, user_id: 7, token: TOKEN }, { id: 2, user_id: 7, token: 'ExponentPushToken[zzzzzzzzzzzzzzzzzz]' }, { id: 3, user_id: 8, token: 'ExponentPushToken[otheruser00000000]' });
    let sentBody;
    const fetchImpl = async (_url, opts) => {
        sentBody = JSON.parse(opts.body);
        return {
            ok: true,
            json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
        };
    };
    const { sent } = await sendAppPushToUser(pool, 7, 'Titulo', 'Corpo', { url: '/' }, fetchImpl);
    assert.equal(sent, 1);
    assert.equal(sentBody.length, 2);
    assert.equal(sentBody[0].title, 'Titulo');
    assert.deepEqual(pool.rows.map(r => r.id), [1, 3]); // o token 2 foi apagado; o de outro usuario ficou
});

test('sem tokens nao chama a Expo', async () => {
    const pool = fakePool();
    let called = false;
    const { sent } = await sendAppPushToUser(pool, 7, 't', 'b', {}, async () => { called = true; });
    assert.equal(sent, 0);
    assert.equal(called, false);
});

test('rotas: registrar, mover de conta, remover e testar', async () => {
    const pool = fakePool();
    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        req.user = { id };
        next();
    };
    const sendPush = async (p, userId) => ({ sent: p.rows.filter(r => r.user_id === userId).length });
    registerAppPushRoutes(app, { pool, authenticateToken, sendPush });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (method, path, user, body) =>
        fetch(base + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
    try {
        assert.equal((await call('POST', '/api/push/app-token', null, { token: TOKEN })).status, 401);
        assert.equal((await call('POST', '/api/push/app-token', 1, { token: 'lixo' })).status, 400);
        assert.equal((await call('POST', '/api/push/app-test', 1)).status, 404);

        assert.equal((await call('POST', '/api/push/app-token', 1, { token: TOKEN, platform: 'ios' })).status, 200);
        assert.equal(pool.rows.length, 1);
        assert.equal((await call('POST', '/api/push/app-test', 1)).status, 200);

        // Mesmo celular entra com outra conta: o token passa para a nova conta
        assert.equal((await call('POST', '/api/push/app-token', 2, { token: TOKEN, platform: 'ios' })).status, 200);
        assert.equal(pool.rows.length, 1);
        assert.equal(pool.rows[0].user_id, 2);

        // Usuario 1 nao consegue apagar o token que agora e do usuario 2
        await call('DELETE', '/api/push/app-token', 1, { token: TOKEN });
        assert.equal(pool.rows.length, 1);
        await call('DELETE', '/api/push/app-token', 2, { token: TOKEN });
        assert.equal(pool.rows.length, 0);
    } finally {
        server.close();
    }
});
