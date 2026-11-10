import crypto from 'crypto';

// ============================================================================
// Login do app nativo pelo site (OAuth "authorization code" + PKCE)
//
// 1. O app abre https://breww.live/app-login?redirect_uri=...&code_challenge=...&state=...
//    numa janela segura do sistema. O usuario entra no site (Google ou e-mail).
// 2. A pagina chama POST /api/auth/app-code (com o JWT do site) e recebe um codigo
//    de uso unico (60 s), preso ao code_challenge e ao redirect_uri.
// 3. A pagina redireciona para o app (breww://... ou exp://... no Expo Go) com o codigo.
// 4. O app chama POST /api/auth/app-token com o codigo + code_verifier e recebe o JWT.
//
// PKCE: so quem gerou o code_verifier (o app) consegue trocar o codigo, mesmo que outro
// app intercepte o redirecionamento.
// ============================================================================

export const APP_CODE_TTL_MS = 60 * 1000;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;      // base64url(SHA-256) sem padding
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/; // RFC 7636

/** Esquemas de retorno aceitos: app instalado (breww://) e, se permitido, Expo Go (exp://). */
export const isAllowedRedirect = (uri, { allowExpoGo = true } = {}) => {
    if (typeof uri !== 'string' || uri.length > 300) return false;
    if (/^breww:\/\/[\w\-./]*$/.test(uri)) return true;
    if (allowExpoGo && /^exps?:\/\/[\w\-.:]+(\/[\w\-./]*)?$/.test(uri)) return true;
    return false;
};

export const challengeFromVerifier = (verifier) =>
    crypto.createHash('sha256').update(String(verifier)).digest('base64url');

export const createAppCodeStore = (now = () => Date.now()) => {
    const codes = new Map(); // code -> { userId, challenge, redirectUri, expires }
    const cleanup = () => {
        const t = now();
        for (const [k, v] of codes) if (v.expires < t) codes.delete(k);
    };
    return {
        issue(userId, challenge, redirectUri) {
            cleanup();
            const code = crypto.randomBytes(32).toString('base64url');
            codes.set(code, { userId, challenge, redirectUri, expires: now() + APP_CODE_TTL_MS });
            return code;
        },
        /** Consome o codigo (uso unico). Retorna o registro ou null. */
        consume(code) {
            const entry = codes.get(String(code || ''));
            if (!entry) return null;
            codes.delete(String(code));
            return entry.expires >= now() ? entry : null;
        },
    };
};

export const registerAppAuthRoutes = (app, {
    pool,
    authenticateToken,
    rateLimiter = (req, res, next) => next(),
    signToken,
    store = createAppCodeStore(),
    allowExpoGo = process.env.ALLOW_EXPO_GO_LOGIN !== '0',
}) => {
    app.post('/api/auth/app-code', authenticateToken, (req, res) => {
        const redirectUri = req.body?.redirect_uri;
        const challenge = req.body?.code_challenge;
        if (!isAllowedRedirect(redirectUri, { allowExpoGo })) {
            return res.status(400).json({ error: 'Endereço de retorno do app não permitido.' });
        }
        if (!CHALLENGE_RE.test(String(challenge || ''))) {
            return res.status(400).json({ error: 'code_challenge inválido.' });
        }
        res.json({ code: store.issue(req.user.id, challenge, redirectUri) });
    });

    app.post('/api/auth/app-token', rateLimiter, async (req, res) => {
        try {
            const { code, code_verifier: verifier, redirect_uri: redirectUri } = req.body || {};
            if (!VERIFIER_RE.test(String(verifier || ''))) return res.status(400).json({ error: 'code_verifier inválido.' });
            const entry = store.consume(code);
            if (!entry) return res.status(400).json({ error: 'Código inválido ou expirado. Tente entrar novamente.' });
            if (entry.redirectUri !== redirectUri || challengeFromVerifier(verifier) !== entry.challenge) {
                return res.status(400).json({ error: 'Código não corresponde a este app.' });
            }
            const [users] = await pool.execute('SELECT id, name, role FROM users WHERE id = ? LIMIT 1', [entry.userId]);
            if (!users.length) return res.status(400).json({ error: 'Usuário não encontrado.' });
            const u = users[0];
            res.json({ token: signToken({ id: u.id, name: u.name, role: u.role }), name: u.name, role: u.role });
        } catch (err) {
            console.error('❌ [AppAuth] app-token:', err);
            res.status(500).json({ error: 'Erro interno' });
        }
    });
};
