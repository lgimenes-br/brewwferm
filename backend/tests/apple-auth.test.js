import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { registerAppleAuthRoutes, verifyAppleToken, createAppleKeyStore } from '../routes/appleAuthRoutes.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const AUD = 'host.exp.Exponent';
const NONCE = 'raw-nonce-123';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const getKey = async kid => { if (kid !== 'k1') throw new Error('unknown'); return publicKey; };

const sign = (claims = {}, { key = privateKey, kid = 'k1' } = {}) => jwt.sign(
    { iss: 'https://appleid.apple.com', aud: AUD, sub: 'apple-sub-1', email: 'Cervejeiro@Example.com', email_verified: 'true', nonce: sha(NONCE), exp: Math.floor(Date.now() / 1000) + 300, ...claims },
    key, { algorithm: 'RS256', keyid: kid });

test('verifyAppleToken aceita token valido e recusa adulterados', async () => {
    const opts = { getKey, audiences: [AUD] };
    const ok = await verifyAppleToken(sign(), NONCE, opts);
    assert.deepEqual(ok, { sub: 'apple-sub-1', email: 'cervejeiro@example.com', emailVerified: true });
    await assert.rejects(verifyAppleToken(sign(), 'outro-nonce', opts));
    await assert.rejects(verifyAppleToken(sign(), '', opts));
    await assert.rejects(verifyAppleToken(sign({ aud: 'com.evil.app' }), NONCE, opts));
    await assert.rejects(verifyAppleToken(sign({ iss: 'https://evil.example' }), NONCE, opts));
    await assert.rejects(verifyAppleToken(sign({}, { key: other.privateKey }), NONCE, opts));
    await assert.rejects(verifyAppleToken(sign({}, { kid: 'k9' }), NONCE, opts));
    await assert.rejects(verifyAppleToken(sign({ exp: Math.floor(Date.now() / 1000) - 10 }), NONCE, opts));
    await assert.rejects(verifyAppleToken('lixo', NONCE, opts));
});

test('createAppleKeyStore busca JWKS e recarrega quando a chave muda', async () => {
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
    let calls = 0;
    const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ keys: calls > 1 ? [jwk] : [] }) }; };
    const store = createAppleKeyStore(fetchImpl);
    const key = await store('k1'); // 1a carga sem a chave -> recarrega
    assert.equal(calls, 2);
    assert.equal(key.asymmetricKeyType, 'rsa');
    await store('k1');
    assert.equal(calls, 2); // em cache
});

test('rota: cria conta, reaproveita pelo sub e recusa token invalido', async () => {
    const users = [];
    const pool = {
        execute: async (sql, p) => {
            if (sql.startsWith('SELECT') && sql.includes('password_hash = ?')) return [users.filter(u => u.password_hash === p[0])];
            if (sql.startsWith('SELECT') && sql.includes('LOWER(email)')) return [users.filter(u => u.email.toLowerCase() === p[0])];
            if (sql.startsWith('INSERT')) { users.push({ id: users.length + 1, name: p[0], email: p[1], password_hash: p[2], role: 'user' }); return [{ insertId: users.length }]; }
            throw new Error('sql inesperado ' + sql);
        },
    };
    const app = express();
    app.use(express.json());
    registerAppleAuthRoutes(app, { pool, getKey, audiences: [AUD], signToken: c => `jwt-${c.id}` });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const post = body => fetch(`http://127.0.0.1:${server.address().port}/api/auth/apple`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));
    try {
        assert.equal((await post({ identityToken: sign(), nonce: 'errado' })).status, 401);

        const first = await post({ identityToken: sign(), nonce: NONCE, fullName: 'Luiz Fernando' });
        assert.equal(first.status, 200);
        assert.deepEqual(first.body, { token: 'jwt-1', name: 'Luiz Fernando', role: 'user' });
        assert.equal(users[0].password_hash, 'apple_sso_apple-sub-1');

        // depois a Apple nao manda nome nem (as vezes) e-mail: acha pelo sub
        const again = await post({ identityToken: sign({ email: undefined }), nonce: NONCE });
        assert.equal(again.body.token, 'jwt-1');
        assert.equal(users.length, 1);

        // sem conta e sem e-mail: pede o e-mail
        assert.equal((await post({ identityToken: sign({ sub: 'novo', email: undefined }), nonce: NONCE })).status, 400);
    } finally {
        server.close();
    }
});
