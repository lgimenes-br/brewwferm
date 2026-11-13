// Lista de espera da home: quem quer o controlador pronto (ou o plano Pro) deixa o e-mail e e avisado
// quando sair. So o e-mail e o interesse; a resposta e a mesma para e-mail novo ou repetido (nao revela
// quem ja esta na lista). O admin ve e apaga.

export const WAITLIST_INTERESTS = ['pronto', 'pro'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida o pedido. Retorna { entry } ou { error }. Funcao pura (testavel). */
export const sanitizeWaitlist = (body) => {
    const b = body || {};
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!email || email.length > 190 || !EMAIL_RE.test(email)) return { error: 'Digite um e-mail válido.' };
    const interest = WAITLIST_INTERESTS.includes(b.interest) ? b.interest : 'pronto';
    return { entry: { email, interest } };
};

export const registerWaitlistRoutes = (app, { pool, authenticateToken, requireAdmin, rateLimiter, audit }) => {
    const limit = rateLimiter || ((req, res, next) => next());
    const ensureTable = () => pool.execute(`CREATE TABLE IF NOT EXISTS waitlist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL,
        interest VARCHAR(16) NOT NULL DEFAULT 'pronto',
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uniq_email_interest (email, interest)
    )`);

    app.post('/api/waitlist', limit, async (req, res) => {
        const { entry, error } = sanitizeWaitlist(req.body);
        if (error) return res.status(400).json({ error });
        try {
            await pool.execute('INSERT IGNORE INTO waitlist (email, interest) VALUES (?, ?)', [entry.email, entry.interest]);
            res.status(201).json({ ok: true });
        } catch (e) {
            console.error('Lista de espera:', e.message);
            res.status(500).json({ error: 'Não foi possível registrar agora. Tente de novo em instantes.' });
        }
    });

    app.get('/api/admin/waitlist', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT id, email, interest, created_at FROM waitlist ORDER BY created_at DESC LIMIT 1000');
            res.json(rows);
        } catch (e) { console.error('Lista de espera:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.delete('/api/admin/waitlist/:id', authenticateToken, requireAdmin, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Pedido inválido' });
        try {
            await pool.execute('DELETE FROM waitlist WHERE id = ?', [id]);
            if (audit) await audit(req, 'WAITLIST_DELETE', `Removido da lista de espera (id ${id})`);
            res.json({ ok: true });
        } catch (e) { console.error('Lista de espera:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    return { ensureTable };
};
