// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerLibraryRoutes, sanitizeSharedProfile, LIBRARY } from '../routes/libraryRoutes.js';

const STEPS = [{ name: 'Fermentação', temperature: 18, duration: 7 }, { name: 'Cold crash', temperature: 2, duration: 2, triggerGravity: 1.012 }];

test('perfil compartilhado: valida nome, etapas, temperatura e duração', () => {
    assert.match(sanitizeSharedProfile({ name: 'x', steps: STEPS }).error, /nome/);
    assert.match(sanitizeSharedProfile({ name: 'IPA', steps: [] }).error, /etapa/);
    assert.match(sanitizeSharedProfile({ name: 'IPA', steps: [{ temperature: 50, duration: 1 }] }).error, /temperatura/);
    assert.match(sanitizeSharedProfile({ name: 'IPA', steps: [{ temperature: 18, duration: 0 }] }).error, /duração/);
    assert.match(sanitizeSharedProfile({ name: 'IPA', steps: Array(LIBRARY.maxSteps + 1).fill(STEPS[0]) }).error, /No máximo/);
    const { profile } = sanitizeSharedProfile({ name: '  IPA\n Citra  ', style: 'IPA', description: 'a'.repeat(400), og: '1,060', fg: 2, steps: STEPS });
    assert.equal(profile.name, 'IPA Citra');
    assert.equal(profile.description.length, LIBRARY.descMax);
    assert.equal(profile.og, 1.06);
    assert.equal(profile.fg, null, 'densidade fora da faixa vira vazia');
    assert.equal(profile.steps[1].triggerGravity, 1.012);
});

// Banco falso: so as queries da biblioteca
const createFake = () => {
    const db = { users: [{ id: 1, name: 'Ana Souza', email: 'ana@x.com', role: 'user' }, { id: 2, name: 'Bruno Lima', email: 'b@x.com', role: 'admin' }, { id: 3, name: 'Caio', email: 'c@x.com', role: 'user' }],
        profiles: [], uses: [], reports: [] };
    let nextId = 1;
    const pool = {
        db,
        async execute(sql, params = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.startsWith('SELECT COUNT(*) AS n FROM shared_profiles WHERE user_id')) return [[{ n: db.profiles.filter(p => p.user_id === params[0]).length }]];
            if (q.startsWith('INSERT INTO shared_profiles')) {
                const [user_id, name, style, description, og, fg, steps] = params;
                db.profiles.push({ id: nextId, user_id, name, style, description, og, fg, steps, uses_count: 0, hidden: 0, created_at: new Date() });
                return [{ insertId: nextId++ }];
            }
            if (q.startsWith('SELECT sp.*, u.name AS author_name FROM shared_profiles')) {
                return [db.profiles.filter(p => !p.hidden).sort((a, b) => b.uses_count - a.uses_count)
                    .map(p => ({ ...p, author_name: db.users.find(u => u.id === p.user_id).name }))];
            }
            if (q.startsWith('SELECT id FROM shared_profiles WHERE id = ? AND hidden = 0')) return [db.profiles.filter(p => p.id === Number(params[0]) && !p.hidden)];
            if (q.startsWith('INSERT IGNORE INTO shared_profile_uses')) {
                const dup = db.uses.some(u => u.p === Number(params[0]) && u.u === params[1]);
                if (!dup) db.uses.push({ p: Number(params[0]), u: params[1] });
                return [{ affectedRows: dup ? 0 : 1 }];
            }
            if (q.startsWith('UPDATE shared_profiles SET uses_count')) { db.profiles.find(p => p.id === Number(params[0])).uses_count++; return [{}]; }
            if (q.startsWith('SELECT id, name, user_id FROM shared_profiles')) return [db.profiles.filter(p => p.id === Number(params[0]))];
            if (q.startsWith('INSERT IGNORE INTO shared_profile_reports')) {
                const dup = db.reports.some(r => r.p === Number(params[0]) && r.u === params[1]);
                if (!dup) db.reports.push({ p: Number(params[0]), u: params[1], reason: params[2] });
                return [{ affectedRows: dup ? 0 : 1 }];
            }
            if (q.startsWith('SELECT name FROM shared_profiles WHERE id')) return [db.profiles.filter(p => p.id === Number(params[0]))];
            if (q.startsWith('UPDATE shared_profiles SET hidden')) { db.profiles.find(p => p.id === Number(params[1])).hidden = params[0]; return [{}]; }
            if (q.startsWith('DELETE FROM shared_profiles')) {
                const before = db.profiles.length;
                db.profiles = db.profiles.filter(p => !(p.id === Number(params[0]) && p.user_id === params[1]));
                return [{ affectedRows: before - db.profiles.length }];
            }
            throw new Error('Query nao mockada: ' + q);
        },
    };
    return pool;
};

const start = async () => {
    const pool = createFake();
    const reported = [], audit = [];
    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => { const id = Number(String(req.headers.authorization || '').split(' ')[1]); if (!id) return res.sendStatus(401); req.user = { id }; next(); };
    const requireAdmin = (req, res, next) => (req.user.id === 2 ? next() : res.sendStatus(403));
    registerLibraryRoutes(app, { pool, authenticateToken, requireAdmin, audit: async (req, a) => audit.push(a), onReport: (p) => reported.push(p.name) });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, path, user, body) => {
        const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, body: await res.json().catch(() => null) };
    };
    return { server, call, pool, reported, audit };
};

test('biblioteca: publica, lista com o primeiro nome do autor, conta uso uma vez por pessoa', async () => {
    const { server, call } = await start();
    try {
        assert.equal((await call('GET', '/api/library')).status, 401, 'precisa de login');
        assert.equal((await call('POST', '/api/library', 1, { name: 'x', steps: STEPS })).status, 400);
        let r = await call('POST', '/api/library', 1, { name: 'IPA Citra', style: 'IPA', steps: STEPS });
        assert.equal(r.status, 201);
        const id = r.body.id;
        r = await call('GET', '/api/library', 3);
        assert.equal(r.body.length, 1);
        assert.equal(r.body[0].author, 'Ana', 'só o primeiro nome');
        assert.equal(r.body[0].mine, false);
        assert.equal(r.body[0].steps.length, 2);
        assert.equal((await call('GET', '/api/library', 1)).body[0].mine, true);
        await call('POST', `/api/library/${id}/use`, 3);
        await call('POST', `/api/library/${id}/use`, 3);
        assert.equal((await call('GET', '/api/library', 3)).body[0].uses, 1, 'a mesma pessoa conta uma vez');
    } finally { server.close(); }
});

test('biblioteca: denúncia avisa uma vez, o admin esconde, o autor remove o próprio', async () => {
    const { server, call, reported, audit } = await start();
    try {
        const id = (await call('POST', '/api/library', 1, { name: 'Lager lenta', steps: STEPS })).body.id;
        assert.equal((await call('POST', `/api/library/${id}/report`, 1, { reason: 'x' })).status, 400, 'não denuncia o próprio');
        await call('POST', `/api/library/${id}/report`, 3, { reason: 'Temperatura perigosa' });
        await call('POST', `/api/library/${id}/report`, 3, { reason: 'de novo' });
        assert.deepEqual(reported, ['Lager lenta'], 'um aviso por pessoa');
        assert.equal((await call('POST', `/api/admin/library/${id}/hidden`, 3, { hidden: true })).status, 403);
        assert.equal((await call('POST', `/api/admin/library/${id}/hidden`, 2, { hidden: true })).status, 200);
        assert.equal((await call('GET', '/api/library', 3)).body.length, 0, 'escondido some da lista');
        assert.equal((await call('POST', `/api/library/${id}/use`, 3)).status, 404);
        assert.deepEqual(audit, ['LIBRARY_HIDE']);
        assert.equal((await call('DELETE', `/api/library/${id}`, 3)).status, 404, 'só o autor remove');
        assert.equal((await call('DELETE', `/api/library/${id}`, 1)).status, 200);
    } finally { server.close(); }
});
