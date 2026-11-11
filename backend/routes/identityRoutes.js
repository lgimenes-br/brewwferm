import crypto from 'crypto';

// ============================================================================
// Logins vinculados: a mesma conta pode entrar por e-mail e senha, Google e Apple.
//
// Tabela user_identities (provider + subject unicos): cada login externo aponta para um usuario.
// O login com Google/Apple procura primeiro aqui; so depois cai na regra antiga (mesmo e-mail).
//
// Vincular a Apple: o app manda o identityToken (nativo) para POST /api/me/identities/apple.
// Vincular o Google: o Google so roda no site, entao
//   1. o app pede um bilhete (POST /api/me/link-ticket) preso ao usuario, de uso unico, 5 min;
//   2. abre /app-login?mode=link&ticket=...&redirect_uri=... numa janela segura;
//   3. a pagina mostra a conta do bilhete (GET /api/auth/link-ticket/:t), o usuario confirma,
//      entra no Google e a pagina chama POST /api/auth/link/google { ticket, accessToken };
//   4. a pagina volta ao app com ?status=linked (ou ?error=...).
// Desvincular so e permitido se sobrar outra forma de entrar.
// ============================================================================

export const PROVIDERS = ['google', 'apple'];
export const LINK_TICKET_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_GOOGLE_CLIENT_ID = '186122113143-5ao2f53lkggo3a2jd3f5jo62v6tbc39j.apps.googleusercontent.com';

/** Conta criada so pelo Google/Apple guarda uma marca no lugar da senha (nao serve para login) */
export const hasRealPassword = (hash) => !!hash && !/^(google|apple)_sso_/.test(String(hash));

export const ensureIdentityTable = async (pool) => {
    await pool.execute(`CREATE TABLE IF NOT EXISTS user_identities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        provider VARCHAR(16) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uq_provider_subject (provider, subject),
        UNIQUE KEY uq_user_provider (user_id, provider),
        KEY idx_user (user_id)
    )`);
    // Contas antigas criadas pelo Google/Apple: a marca na senha vira um vinculo
    await pool.execute(`INSERT IGNORE INTO user_identities (user_id, provider, subject, email)
        SELECT id, 'google', SUBSTRING(password_hash, 12), email FROM users
        WHERE password_hash LIKE 'google\\_sso\\_%' AND CHAR_LENGTH(password_hash) > 11`);
    await pool.execute(`INSERT IGNORE INTO user_identities (user_id, provider, subject, email)
        SELECT id, 'apple', SUBSTRING(password_hash, 11), email FROM users
        WHERE password_hash LIKE 'apple\\_sso\\_%' AND CHAR_LENGTH(password_hash) > 10`);
};

export const findUserIdByIdentity = async (pool, provider, subject) => {
    if (!subject) return null;
    const [rows] = await pool.execute('SELECT user_id FROM user_identities WHERE provider = ? AND subject = ? LIMIT 1', [provider, String(subject)]);
    return rows.length ? rows[0].user_id : null;
};

export class IdentityConflictError extends Error {}

/**
 * Liga (provider, subject) ao usuario. Ja ligado a ele: ok (atualiza o e-mail).
 * Ligado a outra conta, ou o usuario ja tem outro login desse provedor: IdentityConflictError.
 */
export const linkIdentity = async (pool, userId, provider, subject, email) => {
    const owner = await findUserIdByIdentity(pool, provider, subject);
    if (owner && owner !== userId) throw new IdentityConflictError('Esse login já está vinculado a outra conta Breww.');
    if (owner === userId) {
        await pool.execute('UPDATE user_identities SET email = ? WHERE provider = ? AND subject = ?', [email || null, provider, String(subject)]);
        return;
    }
    const [mine] = await pool.execute('SELECT subject FROM user_identities WHERE user_id = ? AND provider = ? LIMIT 1', [userId, provider]);
    if (mine.length) throw new IdentityConflictError('Sua conta já tem outro login desse tipo vinculado. Desvincule o atual primeiro.');
    try {
        await pool.execute('INSERT INTO user_identities (user_id, provider, subject, email) VALUES (?, ?, ?, ?)', [userId, provider, String(subject), email || null]);
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') throw new IdentityConflictError('Esse login já está vinculado a outra conta Breww.');
        throw e;
    }
};

/**
 * Confere um access_token do Google (audience = nosso client id) e devolve o perfil.
 * clientId null pula a checagem de audience (comportamento antigo do login).
 */
export const verifyGoogleAccessToken = async (accessToken, { clientId, fetchImpl = fetch } = {}) => {
    const token = String(accessToken || '');
    if (!token) throw new Error('Token é obrigatório');
    if (clientId) {
        const infoRes = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
        if (!infoRes.ok) throw new Error('Token Google inválido');
        const info = await infoRes.json();
        if (info.aud !== clientId && info.azp !== clientId) throw new Error('Token Google não pertence a este aplicativo');
    }
    const res = await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Token inválido ou expirado');
    const p = await res.json();
    if (!p.sub) throw new Error('Token sem identificador');
    return {
        sub: String(p.sub),
        email: typeof p.email === 'string' ? p.email.trim().toLowerCase() : null,
        emailVerified: p.email_verified !== false,
        name: p.name || null,
        picture: p.picture || null,
    };
};

export const createLinkTicketStore = (now = () => Date.now()) => {
    const tickets = new Map(); // ticket -> { userId, provider, redirectUri, expires }
    const cleanup = () => { const t = now(); for (const [k, v] of tickets) if (v.expires < t) tickets.delete(k); };
    return {
        issue(userId, provider, redirectUri) {
            cleanup();
            const ticket = crypto.randomBytes(24).toString('base64url');
            tickets.set(ticket, { userId, provider, redirectUri, expires: now() + LINK_TICKET_TTL_MS });
            return ticket;
        },
        peek(ticket) {
            const v = tickets.get(String(ticket || ''));
            return v && v.expires >= now() ? v : null;
        },
        consume(ticket) {
            const v = this.peek(ticket);
            tickets.delete(String(ticket || ''));
            return v;
        },
    };
};

const isAllowedRedirect = (uri) =>
    typeof uri === 'string' && uri.length <= 300 && (/^breww:\/\/[\w\-./]*$/.test(uri) || /^exps?:\/\/[\w\-.:]+(\/[\w\-./]*)?$/.test(uri));

export const registerIdentityRoutes = (app, {
    pool, authenticateToken, rateLimiter = (q, s, n) => n(),
    verifyApple, verifyGoogle, tickets = createLinkTicketStore(),
}) => {
    const methods = async (userId) => {
        const [[u]] = await pool.execute('SELECT email, password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
        const [ids] = await pool.execute('SELECT provider, email, created_at FROM user_identities WHERE user_id = ?', [userId]);
        const pick = p => { const r = ids.find(i => i.provider === p); return r ? { email: r.email || null, linkedAt: r.created_at } : null; };
        return { email: u?.email ?? null, password: hasRealPassword(u?.password_hash), google: pick('google'), apple: pick('apple') };
    };

    app.get('/api/me/identities', authenticateToken, async (req, res) => {
        try { res.json(await methods(req.user.id)); } catch (e) {
            console.error('identities:', e);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    app.post('/api/me/identities/apple', rateLimiter, authenticateToken, async (req, res) => {
        let info;
        try { info = await verifyApple(req.body?.identityToken, req.body?.nonce); } catch {
            return res.status(401).json({ error: 'Não foi possível confirmar o login com a Apple.' });
        }
        try {
            await linkIdentity(pool, req.user.id, 'apple', info.sub, info.email);
            res.json(await methods(req.user.id));
        } catch (e) {
            if (e instanceof IdentityConflictError) return res.status(409).json({ error: e.message });
            console.error('link apple:', e);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    app.delete('/api/me/identities/:provider', rateLimiter, authenticateToken, async (req, res) => {
        const provider = String(req.params.provider);
        if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Login desconhecido.' });
        try {
            const m = await methods(req.user.id);
            if (!m[provider]) return res.json(m);
            const others = (m.password ? 1 : 0) + PROVIDERS.filter(p => p !== provider && m[p]).length;
            if (others === 0) return res.status(400).json({ error: 'Esse é seu único jeito de entrar. Crie uma senha ou vincule outro login antes de desvincular.' });
            await pool.execute('DELETE FROM user_identities WHERE user_id = ? AND provider = ?', [req.user.id, provider]);
            res.json(await methods(req.user.id));
        } catch (e) {
            console.error('unlink:', e);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    // Bilhete para vincular o Google pelo site (o app nao roda o Google sozinho)
    app.post('/api/me/link-ticket', rateLimiter, authenticateToken, (req, res) => {
        const provider = String(req.body?.provider || '');
        const redirectUri = req.body?.redirect_uri;
        if (provider !== 'google') return res.status(400).json({ error: 'Login desconhecido.' });
        if (!isAllowedRedirect(redirectUri)) return res.status(400).json({ error: 'Retorno inválido.' });
        res.json({ ticket: tickets.issue(req.user.id, provider, redirectUri), expiresIn: LINK_TICKET_TTL_MS / 1000 });
    });

    // A pagina mostra a qual conta o Google sera ligado, antes de confirmar
    app.get('/api/auth/link-ticket/:ticket', rateLimiter, async (req, res) => {
        const t = tickets.peek(req.params.ticket);
        if (!t) return res.status(404).json({ error: 'Link expirado. Volte ao app e tente de novo.' });
        try {
            const [[u]] = await pool.execute('SELECT name, email FROM users WHERE id = ? LIMIT 1', [t.userId]);
            if (!u) return res.status(404).json({ error: 'Conta não encontrada.' });
            res.json({ name: u.name, email: u.email, provider: t.provider, redirectUri: t.redirectUri });
        } catch (e) {
            console.error('link ticket:', e);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    app.post('/api/auth/link/google', rateLimiter, async (req, res) => {
        const t = tickets.consume(req.body?.ticket);
        if (!t || t.provider !== 'google') return res.status(400).json({ error: 'Link expirado. Volte ao app e tente de novo.' });
        let info;
        try { info = await verifyGoogle(req.body?.accessToken); } catch {
            return res.status(401).json({ error: 'Não foi possível confirmar o login com o Google.' });
        }
        try {
            await linkIdentity(pool, t.userId, 'google', info.sub, info.email);
            res.json({ ok: true, redirectUri: t.redirectUri });
        } catch (e) {
            if (e instanceof IdentityConflictError) return res.status(409).json({ error: e.message, redirectUri: t.redirectUri });
            console.error('link google:', e);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });
};
