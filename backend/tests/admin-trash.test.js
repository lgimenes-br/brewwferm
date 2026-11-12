// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerAdminRoutes } from '../routes/adminRoutes.js';

// Banco falso: so as queries de contas usadas pela lixeira
const createFake = () => {
    const db = {
        users: [
            { id: 1, name: 'Admin', email: 'admin@x.com', role: 'admin', plan_type: 'free', deleted_at: null },
            { id: 2, name: 'Ana', email: 'ana@x.com', role: 'user', plan_type: 'free', deleted_at: null },
        ],
        deletedDevices: [], audit: [],
    };
    const pool = {
        db,
        async execute(sql, params = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.startsWith('SELECT id, email, deleted_at FROM users WHERE id')) return [db.users.filter(u => u.id === params[0])];
            if (q.startsWith('UPDATE users SET deleted_at = NOW()')) { db.users.filter(u => u.id === params[0]).forEach(u => { u.deleted_at = new Date(); }); return [{}]; }
            if (q.startsWith('UPDATE users SET deleted_at = NULL')) {
                const u = db.users.find(x => x.id === params[0] && x.deleted_at);
                if (u) u.deleted_at = null;
                return [{ affectedRows: u ? 1 : 0 }];
            }
            if (q.includes('WHERE u.deleted_at IS NULL')) return [db.users.filter(u => !u.deleted_at).map(u => ({ ...u, device_count: 0 }))];
            if (q.includes('WHERE u.deleted_at IS NOT NULL')) return [db.users.filter(u => u.deleted_at).map(u => ({ ...u, device_count: 0, days_left: 30 }))];
            if (q.startsWith('SELECT id, serial_code FROM devices WHERE user_id')) return [[{ id: 50 + params[0], serial_code: `SERIAL${params[0]}` }]];
            if (q.startsWith('DELETE FROM users WHERE id')) { db.users = db.users.filter(u => u.id !== params[0]); return [{}]; }
            if (q.startsWith('DELETE FROM') ) return [{}];
            if (q.startsWith('SELECT id, email FROM users WHERE deleted_at IS NOT NULL AND deleted_at <')) {
                return [db.users.filter(u => u.deleted_at && u.deleted_at < new Date(Date.now() - 30 * 864e5)).map(u => ({ id: u.id, email: u.email }))];
            }
            throw new Error('Query nao mockada: ' + q);
        }
    };
    return pool;
};

const start = async () => {
    const pool = createFake();
    const trashed = new Set();
    const audit = [];
    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        if (trashed.has(id)) return res.status(401).json({ error: 'Conta desativada' });
        req.user = { id };
        next();
    };
    const requireAdmin = (req, res, next) => (req.user.id === 1 ? next() : res.sendStatus(403));
    const api = registerAdminRoutes({
        app, pool, authenticateToken, requireAdmin,
        deleteDeviceCascade: async (id) => { pool.db.deletedDevices.push(id); },
        loadActiveBatches: async () => {},
        sendPushToUser: async () => {},
        audit: async (req, action, details) => { audit.push({ by: req?.user?.id ?? null, action, details }); },
        onTrash: (id) => trashed.add(id),
        onRestore: (id) => trashed.delete(id),
    });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, path, user = 1) => {
        const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${user}` } });
        return { status: res.status, body: await res.json().catch(() => null) };
    };
    return { server, call, pool, audit, trashed, api };
};

test('lixeira: excluir guarda a conta, derruba a sessao e da para restaurar', async () => {
    const { server, call, pool, audit, trashed } = await start();
    try {
        // Ana consegue usar a sessao antes
        assert.notEqual((await call('GET', '/api/admin/users', 2)).status, 401);

        let r = await call('DELETE', '/api/admin/users/2');
        assert.equal(r.status, 200);
        assert.ok(pool.db.users.find(u => u.id === 2).deleted_at, 'marcada, nao apagada');
        assert.equal(pool.db.deletedDevices.length, 0, 'aparelhos e historico intactos');
        assert.ok(trashed.has(2));
        assert.equal((await call('GET', '/api/admin/users', 2)).status, 401, 'sessao da Ana derrubada');

        // Some da lista e aparece na lixeira
        r = await call('GET', '/api/admin/users');
        assert.deepEqual(r.body.map(u => u.id), [1]);
        r = await call('GET', '/api/admin/users/trash');
        assert.deepEqual(r.body.map(u => u.id), [2]);

        // Restaurar
        r = await call('POST', '/api/admin/users/2/restore');
        assert.equal(r.status, 200);
        assert.equal(pool.db.users.find(u => u.id === 2).deleted_at, null);
        assert.ok(!trashed.has(2));
        assert.equal((await call('POST', '/api/admin/users/2/restore')).status, 404, 'nao esta mais na lixeira');

        assert.deepEqual(audit.map(a => a.action), ['TRASH_USER', 'RESTORE_USER']);
        assert.ok(audit.every(a => a.by === 1));
    } finally { server.close(); }
});

test('lixeira: excluir definitivamente so depois de ir para a lixeira; admin nao exclui a si mesmo', async () => {
    const { server, call, pool, audit } = await start();
    try {
        assert.equal((await call('DELETE', '/api/admin/users/1')).status, 400, 'a propria conta');
        assert.equal((await call('DELETE', '/api/admin/users/2?permanent=1')).status, 409, 'precisa estar na lixeira');
        assert.equal((await call('DELETE', '/api/admin/users/99')).status, 404);

        await call('DELETE', '/api/admin/users/2');
        const r = await call('DELETE', '/api/admin/users/2?permanent=1');
        assert.equal(r.status, 200);
        assert.equal(pool.db.users.some(u => u.id === 2), false);
        assert.deepEqual(pool.db.deletedDevices, [52], 'aparelhos apagados junto');
        assert.deepEqual(audit.map(a => a.action), ['TRASH_USER', 'PURGE_USER']);
    } finally { server.close(); }
});

test('lixeira: apaga sozinha as contas com mais de 30 dias', async () => {
    const { server, pool, audit, api } = await start();
    try {
        pool.db.users.find(u => u.id === 2).deleted_at = new Date(Date.now() - 31 * 864e5);
        assert.equal(await api.purgeExpiredTrash(), 1);
        assert.equal(pool.db.users.some(u => u.id === 2), false);
        assert.equal(audit.at(-1).action, 'PURGE_USER_AUTO');
        assert.equal(audit.at(-1).by, null, 'acao do sistema');
        assert.equal(await api.purgeExpiredTrash(), 0);
    } finally { server.close(); }
});
