import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ============================================================================
// Entrar com a Apple (app nativo)
//
// O app chama a Apple (expo-apple-authentication) com o SHA-256 de um nonce aleatorio
// e manda para ca o identityToken + o nonce original. Aqui:
//   - a assinatura e conferida com as chaves publicas da Apple (JWKS);
//   - iss = https://appleid.apple.com, aud = um dos bundle IDs aceitos, exp valido;
//   - nonce do token = SHA-256(nonce enviado) (impede reaproveitar um token capturado).
// A conta e ligada pelo "sub" da Apple (password_hash = apple_sso_<sub>) ou pelo e-mail.
// A Apple so manda o nome no primeiro login; depois disso usamos o que ja esta salvo.
// ============================================================================

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

/** Bundle IDs aceitos como audience. Expo Go assina como host.exp.Exponent. */
export const appleAudiences = (env = process.env) =>
    String(env.APPLE_CLIENT_IDS || 'host.exp.Exponent,live.breww.app')
        .split(',').map(s => s.trim()).filter(Boolean);

/** Busca e guarda (1 h) as chaves publicas da Apple. */
export const createAppleKeyStore = (fetchImpl = fetch, now = () => Date.now()) => {
    let cache = { at: 0, keys: [] };
    const load = async () => {
        const res = await fetchImpl(APPLE_KEYS_URL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error('apple keys unavailable');
        const { keys } = await res.json();
        cache = { at: now(), keys: Array.isArray(keys) ? keys : [] };
    };
    return async (kid) => {
        if (now() - cache.at > 60 * 60 * 1000) await load();
        let jwk = cache.keys.find(k => k.kid === kid);
        if (!jwk) { await load(); jwk = cache.keys.find(k => k.kid === kid); } // rotacao de chave
        if (!jwk) throw new Error('unknown apple key');
        return crypto.createPublicKey({ key: jwk, format: 'jwk' });
    };
};

/** Valida o identityToken. Retorna { sub, email, emailVerified } ou lanca erro. */
export const verifyAppleToken = async (identityToken, nonce, { getKey, audiences }) => {
    const decoded = jwt.decode(String(identityToken || ''), { complete: true });
    if (!decoded?.header?.kid) throw new Error('token malformado');
    const key = await getKey(decoded.header.kid);
    const claims = jwt.verify(identityToken, key, { algorithms: ['RS256'], issuer: APPLE_ISSUER, audience: audiences });
    const expectedNonce = crypto.createHash('sha256').update(String(nonce || '')).digest('hex');
    if (!nonce || claims.nonce !== expectedNonce) throw new Error('nonce invalido');
    if (!claims.sub) throw new Error('sem sub');
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    return { sub: String(claims.sub), email, emailVerified };
};

export const registerAppleAuthRoutes = (app, { pool, signToken, rateLimiter = (q, s, n) => n(), getKey = createAppleKeyStore(), audiences = appleAudiences() }) => {
    app.post('/api/auth/apple', rateLimiter, async (req, res) => {
        const { identityToken, nonce, fullName } = req.body || {};
        let info;
        try {
            info = await verifyAppleToken(identityToken, nonce, { getKey, audiences });
        } catch (e) {
            return res.status(401).json({ error: 'Não foi possível confirmar o login com a Apple.' });
        }
        try {
            const marker = 'apple_sso_' + info.sub;
            let [users] = await pool.execute('SELECT id, name, role FROM users WHERE password_hash = ? LIMIT 1', [marker]);
            if (users.length === 0 && info.email && info.emailVerified) {
                [users] = await pool.execute('SELECT id, name, role FROM users WHERE LOWER(email) = ? LIMIT 1', [info.email]);
            }
            let user = users[0];
            if (!user) {
                if (!info.email) return res.status(400).json({ error: 'A Apple não informou o e-mail. Tente de novo permitindo o compartilhamento do e-mail.' });
                const given = typeof fullName === 'string' ? fullName.trim().slice(0, 100) : '';
                const name = given.length >= 2 ? given : info.email.split('@')[0];
                const [r] = await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, info.email, marker]);
                user = { id: r.insertId, name, role: 'user' };
            }
            const role = user.role || 'user';
            res.json({ token: signToken({ id: user.id, name: user.name, role }), name: user.name, role });
        } catch (e) {
            console.error('Apple Auth Error:', e);
            res.status(500).json({ error: 'Falha na autenticação com a Apple' });
        }
    });
};
