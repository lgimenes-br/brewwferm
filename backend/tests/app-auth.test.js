import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import { registerAppAuthRoutes, isAllowedRedirect, challengeFromVerifier, createAppCodeStore } from '../routes/appAuthRoutes.js';

const VERIFIER = crypto.randomBytes(32).toString('base64url'); // 43 chars
const CHALLENGE = challengeFromVerifier(VERIFIER);
const REDIRECT = 'exp://192.168.0.10:8081/--/auth';

test('isAllowedRedirect', () => {
    assert.equal(isAllowedRedirect('breww://auth'), true);
    assert.equal(isAllowedRedirect(REDIRECT), true);
    assert.equal(isAllowedRedirect(REDIRECT, { allowExpoGo: false }), false);
    assert.equal(isAllowedRedirect('https://evil.example/cb'), false);
    assert.equal(isAllowedRedirect('javascript:alert(1)'), false);
    assert.equal(isAllowedRedirect('breww://auth?x=<script>'), false);
});

test('codigo expira e e de uso unico', () => {
    let t = 0;
    const store = createAppCodeStore(() => t);
    const code = store.issue(1, CHALLENGE, REDIRECT);
    t = 61000;
    assert.equal(store.consume(code), null);
    t = 0;
    const code2 = store.issue(1, CHALLENGE, REDIRECT);
    assert.ok(store.consume(code2));
    assert.equal(store.consume(code2), null);
});

test('fluxo completo com PKCE', async () => {
    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        req.user = { id };
        next();
    };
    const pool = { execute: async (sql, p) => [[{ id: p[0], name: 'Libra', role: 'user' }]] };
    registerAppAuthRoutes(app, { pool, authenticateToken, signToken: c => `jwt-for-${c.id}` });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body, user) => fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) },
        body: JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
    try {
        assert.equal((await post('/api/auth/app-code', { redirect_uri: REDIRECT, code_challenge: CHALLENGE })).status, 401);
        assert.equal((await post('/api/auth/app-code', { redirect_uri: 'https://evil.example', code_challenge: CHALLENGE }, 7)).status, 400);

        const { body: { code } } = await post('/api/auth/app-code', { redirect_uri: REDIRECT, code_challenge: CHALLENGE }, 7);
        // verifier errado nao troca (e consome o codigo)
        const wrong = await post('/api/auth/app-token', { code, code_verifier: crypto.randomBytes(32).toString('base64url'), redirect_uri: REDIRECT });
        assert.equal(wrong.status, 400);
        assert.equal((await post('/api/auth/app-token', { code, code_verifier: VERIFIER, redirect_uri: REDIRECT })).status, 400);

        const { body: { code: code2 } } = await post('/api/auth/app-code', { redirect_uri: REDIRECT, code_challenge: CHALLENGE }, 7);
        const ok = await post('/api/auth/app-token', { code: code2, code_verifier: VERIFIER, redirect_uri: REDIRECT });
        assert.equal(ok.status, 200);
        assert.deepEqual(ok.body, { token: 'jwt-for-7', name: 'Libra', role: 'user' });
    } finally {
        server.close();
    }
});

test('renovar sessao: exige token valido e devolve um novo', async () => {
    const app = express();
    app.use(express.json());
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        req.user = { id };
        next();
    };
    const pool = { execute: async (sql, p) => [p[0] === 7 ? [{ id: 7, name: 'Libra', role: 'user' }] : []] };
    registerAppAuthRoutes(app, { pool, authenticateToken, signToken: c => `jwt-for-${c.id}` });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const renew = user => fetch(`http://127.0.0.1:${server.address().port}/api/auth/renew`, {
        method: 'POST', headers: user ? { Authorization: `Bearer ${user}` } : {},
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
    try {
        assert.equal((await renew()).status, 401);
        assert.deepEqual((await renew(7)).body, { token: 'jwt-for-7', name: 'Libra', role: 'user' });
        assert.equal((await renew(99)).status, 401); // conta removida
    } finally {
        server.close();
    }
});
