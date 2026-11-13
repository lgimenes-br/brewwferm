// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerInstallEventRoutes, sanitizeInstallEvent } from '../routes/installEventsRoutes.js';

test('funil da instalação: valida o evento e limpa os campos', () => {
    assert.match(sanitizeInstallEvent({ event: 'qualquer' }).error, /inválido/);
    const { event } = sanitizeInstallEvent({ event: 'connect_ok', chip: 'ESP32-C3\n', serial: '28:84:85:49:54:64', detail: 'x'.repeat(300) });
    assert.equal(event.chip, 'ESP32-C3');
    assert.equal(event.serial, '288485495464');
    assert.equal(event.detail.length, 160);
});

const createApp = (role = 'user') => {
    const rows = [];
    const pool = {
        rows,
        async execute(sql, params = []) {
            if (sql.startsWith('INSERT INTO install_events')) { rows.push({ user_id: params[0], event: params[2], board: params[3], chip: params[4], detail: params[5] }); return [{}]; }
            if (sql.includes('GROUP BY event, detail')) return [rows.filter(r => r.event.endsWith('_fail')).map(r => ({ event: r.event, detail: r.detail, total: 1 }))];
            if (sql.includes('COALESCE(board, chip)')) return [[]];
            if (sql.includes('GROUP BY event')) {
                const m = {};
                for (const r of rows) { m[r.event] = m[r.event] || new Set(); m[r.event].add(r.user_id); }
                return [Object.entries(m).map(([event, s]) => ({ event, users: s.size, total: s.size }))];
            }
            return [[]];
        },
    };
    const app = express();
    app.use(express.json());
    let uid = 1;
    const authenticateToken = (req, res, next) => { req.user = { id: Number(req.headers['x-user'] || uid), role }; next(); };
    const requireAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Acesso negado' }));
    registerInstallEventRoutes(app, { pool, authenticateToken, requireAdmin });
    return { app, pool };
};
const listen = (app) => new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });

test('funil da instalação: grava eventos da conta e o admin vê o funil', async () => {
    const { app, pool } = createApp('admin');
    const s = await listen(app);
    const base = `http://127.0.0.1:${s.address().port}/api`;
    const post = (body, user = 1) => fetch(`${base}/install/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': String(user) }, body: JSON.stringify(body) });
    try {
        assert.equal((await post({ event: 'nada' })).status, 400);
        assert.equal((await post({ event: 'login' })).status, 201);
        assert.equal((await post({ event: 'login' }, 2)).status, 201);
        assert.equal((await post({ event: 'connect_ok', chip: 'ESP32-C3' })).status, 201);
        assert.equal((await post({ event: 'flash_fail', detail: 'cabo' }, 2)).status, 201);
        assert.equal(pool.rows.length, 4);
        const f = await (await fetch(`${base}/admin/install-funnel`)).json();
        assert.deepEqual(f.funnel.slice(0, 2), [{ event: 'login', users: 2 }, { event: 'connect_ok', users: 1 }]);
        assert.equal(f.fails[0].detail, 'cabo');
    } finally { s.close(); }
});

test('funil da instalação: quem não é admin não vê o funil', async () => {
    const { app } = createApp('user');
    const s = await listen(app);
    try { assert.equal((await fetch(`http://127.0.0.1:${s.address().port}/api/admin/install-funnel`)).status, 403); } finally { s.close(); }
});
