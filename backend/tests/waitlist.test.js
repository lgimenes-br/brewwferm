// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerWaitlistRoutes, sanitizeWaitlist } from '../routes/waitlistRoutes.js';

test('lista de espera: valida e normaliza o e-mail e o interesse', () => {
    assert.match(sanitizeWaitlist({ email: 'sem-arroba' }).error, /e-mail/);
    assert.match(sanitizeWaitlist({}).error, /e-mail/);
    assert.match(sanitizeWaitlist({ email: `${'a'.repeat(190)}@x.com` }).error, /e-mail/);
    assert.deepEqual(sanitizeWaitlist({ email: '  Ana@Exemplo.COM ', interest: 'pro' }).entry, { email: 'ana@exemplo.com', interest: 'pro' });
    assert.equal(sanitizeWaitlist({ email: 'a@b.com', interest: 'outro' }).entry.interest, 'pronto');
});

const createApp = (role = 'admin') => {
    const rows = [];
    let nextId = 1;
    const pool = {
        rows,
        async execute(sql, params = []) {
            if (sql.startsWith('INSERT IGNORE INTO waitlist')) {
                const [email, interest] = params;
                if (!rows.some(r => r.email === email && r.interest === interest)) rows.push({ id: nextId++, email, interest, created_at: new Date() });
                return [{}];
            }
            if (sql.startsWith('SELECT id, email')) return [[...rows].reverse()];
            if (sql.startsWith('DELETE FROM waitlist')) { const i = rows.findIndex(r => r.id === params[0]); if (i >= 0) rows.splice(i, 1); return [{}]; }
            return [[]];
        },
    };
    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => { req.user = { id: 1, role }; next(); };
    const requireAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Acesso negado' }));
    registerWaitlistRoutes(app, { pool, authenticateToken, requireAdmin });
    return { app, pool };
};

const listen = (app) => new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });

test('lista de espera: registra uma vez, mesma resposta para repetido; admin lista e apaga', async () => {
    const { app, pool } = createApp();
    const s = await listen(app);
    const base = `http://127.0.0.1:${s.address().port}/api`;
    const post = (body) => fetch(`${base}/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
        assert.equal((await post({ email: 'x' })).status, 400);
        assert.equal((await post({ email: 'ana@exemplo.com' })).status, 201);
        assert.equal((await post({ email: 'ANA@exemplo.com' })).status, 201, 'repetido responde igual');
        assert.equal((await post({ email: 'ana@exemplo.com', interest: 'pro' })).status, 201);
        assert.equal(pool.rows.length, 2);
        const list = await (await fetch(`${base}/admin/waitlist`)).json();
        assert.equal(list.length, 2);
        assert.equal((await fetch(`${base}/admin/waitlist/${list[0].id}`, { method: 'DELETE' })).status, 200);
        assert.equal(pool.rows.length, 1);
    } finally { s.close(); }
});

test('lista de espera: quem nao e admin nao ve a lista', async () => {
    const { app } = createApp('user');
    const s = await listen(app);
    try {
        assert.equal((await fetch(`http://127.0.0.1:${s.address().port}/api/admin/waitlist`)).status, 403);
    } finally { s.close(); }
});
