import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerIdentityRoutes, createLinkTicketStore, verifyGoogleAccessToken, hasRealPassword, linkIdentity, IdentityConflictError } from '../routes/identityRoutes.js';
import { createFakeUsersDb } from './helpers/fake-users-db.js';

const REDIRECT = 'exp://127.0.0.1:8082/--/link';

test('hasRealPassword ignora as marcas de SSO', () => {
    assert.equal(hasRealPassword('$2b$10$abc'), true);
    assert.equal(hasRealPassword('google_sso_123'), false);
    assert.equal(hasRealPassword('apple_sso_xyz'), false);
    assert.equal(hasRealPassword(''), false);
    assert.equal(hasRealPassword(null), false);
});

test('bilhete expira e e de uso unico', () => {
    let t = 0;
    const store = createLinkTicketStore(() => t);
    const a = store.issue(1, 'google', REDIRECT);
    assert.equal(store.peek(a).userId, 1);
    t = 5 * 60 * 1000 + 1;
    assert.equal(store.consume(a), null);
    t = 0;
    const b = store.issue(1, 'google', REDIRECT);
    assert.ok(store.consume(b));
    assert.equal(store.consume(b), null);
});

test('verifyGoogleAccessToken confere a audience', async () => {
    const fetchImpl = async (url) => ({
        ok: true,
        json: async () => url.includes('tokeninfo') ? { aud: 'outro-app' } : { sub: 'g1', email: 'A@B.com', email_verified: true },
    });
    await assert.rejects(verifyGoogleAccessToken('tok', { clientId: 'nosso-app', fetchImpl }), /não pertence/);
    const okFetch = async (url) => ({ ok: true, json: async () => url.includes('tokeninfo') ? { aud: 'nosso-app' } : { sub: 'g1', email: 'A@B.com' } });
    assert.equal((await verifyGoogleAccessToken('tok', { clientId: 'nosso-app', fetchImpl: okFetch })).email, 'a@b.com');
    await assert.rejects(verifyGoogleAccessToken('', { clientId: 'nosso-app', fetchImpl: okFetch }));
});

test('linkIdentity: idempotente para a mesma conta, conflito entre contas', async () => {
    const { pool, identities } = createFakeUsersDb();
    await linkIdentity(pool, 1, 'google', 'g1', 'a@b.com');
    await linkIdentity(pool, 1, 'google', 'g1', 'novo@b.com');
    assert.equal(identities.length, 1);
    assert.equal(identities[0].email, 'novo@b.com');
    await assert.rejects(linkIdentity(pool, 2, 'google', 'g1', null), IdentityConflictError);
    await assert.rejects(linkIdentity(pool, 1, 'google', 'g2', null), IdentityConflictError); // ja tem outro Google
});

test('rotas: vincular Apple e Google, conflito, desvincular com trava', async () => {
    const { pool, users, identities } = createFakeUsersDb();
    users.push({ id: 1, name: 'Libra', email: 'eu@breww.live', password_hash: '$2b$10$hash', role: 'user' });
    users.push({ id: 2, name: 'Outro', email: 'outro@breww.live', password_hash: 'google_sso_g-outro', role: 'user' });
    identities.push({ user_id: 2, provider: 'google', subject: 'g-outro', email: 'outro@gmail.com', created_at: 'x' });

    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        req.user = { id };
        next();
    };
    const verifyApple = async (tok, nonce) => { if (tok !== 'apple-ok' || nonce !== 'n') throw new Error('x'); return { sub: 'a1', email: 'relay@apple.com' }; };
    const verifyGoogle = async (tok) => {
        if (tok === 'g-meu') return { sub: 'g-meu', email: 'eu@gmail.com' };
        if (tok === 'g-outro') return { sub: 'g-outro', email: 'outro@gmail.com' };
        throw new Error('x');
    };
    registerIdentityRoutes(app, { pool, authenticateToken, verifyApple, verifyGoogle });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (method, path, body, user) => fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

    try {
        assert.equal((await call('GET', '/api/me/identities')).status, 401);
        assert.deepEqual((await call('GET', '/api/me/identities', null, 1)).body, { email: 'eu@breww.live', password: true, google: null, apple: null });

        // Apple
        assert.equal((await call('POST', '/api/me/identities/apple', { identityToken: 'ruim', nonce: 'n' }, 1)).status, 401);
        const apple = await call('POST', '/api/me/identities/apple', { identityToken: 'apple-ok', nonce: 'n' }, 1);
        assert.equal(apple.status, 200);
        assert.equal(apple.body.apple.email, 'relay@apple.com');

        // Google pelo bilhete
        assert.equal((await call('POST', '/api/me/link-ticket', { provider: 'google', redirect_uri: 'https://evil.example' }, 1)).status, 400);
        const { body: { ticket } } = await call('POST', '/api/me/link-ticket', { provider: 'google', redirect_uri: REDIRECT }, 1);
        const info = await call('GET', `/api/auth/link-ticket/${ticket}`);
        assert.deepEqual(info.body, { name: 'Libra', email: 'eu@breww.live', provider: 'google', redirectUri: REDIRECT });
        const linked = await call('POST', '/api/auth/link/google', { ticket, accessToken: 'g-meu' });
        assert.deepEqual(linked.body, { ok: true, redirectUri: REDIRECT });
        assert.equal((await call('POST', '/api/auth/link/google', { ticket, accessToken: 'g-meu' })).status, 400); // uso unico
        assert.equal((await call('GET', '/api/me/identities', null, 1)).body.google.email, 'eu@gmail.com');

        // Google de outra conta: conflito
        await call('DELETE', '/api/me/identities/google', null, 1);
        const { body: { ticket: t2 } } = await call('POST', '/api/me/link-ticket', { provider: 'google', redirect_uri: REDIRECT }, 1);
        const conflict = await call('POST', '/api/auth/link/google', { ticket: t2, accessToken: 'g-outro' });
        assert.equal(conflict.status, 409);
        assert.equal(conflict.body.redirectUri, REDIRECT);

        // Desvincular: conta 2 so tem o Google (sem senha) -> bloqueado
        const blocked = await call('DELETE', '/api/me/identities/google', null, 2);
        assert.equal(blocked.status, 400);
        assert.match(blocked.body.error, /único jeito/);
        // Conta 1 tem senha: pode tirar a Apple
        const unlinked = await call('DELETE', '/api/me/identities/apple', null, 1);
        assert.equal(unlinked.body.apple, null);
        assert.equal((await call('DELETE', '/api/me/identities/facebook', null, 1)).status, 400);
    } finally {
        server.close();
    }
});
