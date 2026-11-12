// Biblioteca de perfis compartilhados: um usuario publica um perfil de fermentacao (passos com
// temperatura e duracao) e qualquer um pode usar. Publica na hora; qualquer um denuncia; o admin esconde.
// O autor aparece so pelo primeiro nome.

export const LIBRARY = {
    maxSteps: 10,
    maxPerDay: 20,          // publicacoes por usuario por dia
    pageSize: 50,
    nameMax: 80,
    descMax: 280,
};

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')));
const gravity = (v) => { const n = num(v); return n > 0.99 && n < 1.2 ? Math.round(n * 1000) / 1000 : null; };

/** Valida e normaliza um perfil enviado pelo app. Retorna { profile } ou { error }. Funcao pura (testavel). */
export const sanitizeSharedProfile = (body) => {
    const b = body || {};
    const name = clean(b.name, LIBRARY.nameMax);
    if (name.length < 3) return { error: 'Dê um nome ao perfil (3 caracteres ou mais).' };
    const steps = Array.isArray(b.steps) ? b.steps : [];
    if (!steps.length) return { error: 'O perfil precisa de pelo menos uma etapa.' };
    if (steps.length > LIBRARY.maxSteps) return { error: `No máximo ${LIBRARY.maxSteps} etapas.` };
    const out = [];
    for (let i = 0; i < steps.length; i++) {
        const s = steps[i] || {};
        const t = num(s.temperature ?? s.t);
        const d = num(s.duration ?? s.days ?? s.d);
        if (!Number.isFinite(t) || t < -5 || t > 40) return { error: `Etapa ${i + 1}: temperatura entre −5 e 40 °C.` };
        if (!Number.isFinite(d) || d <= 0 || d > 120) return { error: `Etapa ${i + 1}: duração entre 0 e 120 dias.` };
        const step = { name: clean(s.name ?? s.n, 40) || `Etapa ${i + 1}`, temperature: Math.round(t * 10) / 10, duration: Math.round(d * 100) / 100 };
        const g = gravity(s.triggerGravity ?? s.g);
        if (g) step.triggerGravity = g;
        out.push(step);
    }
    return {
        profile: {
            name,
            style: clean(b.style, 40) || null,
            description: clean(b.description, LIBRARY.descMax) || null,
            og: gravity(b.og),
            fg: gravity(b.fg),
            steps: out,
        },
    };
};

const firstName = (full) => clean(full, 100).split(' ')[0] || 'Cervejeiro';

const toPublic = (r, userId) => ({
    id: Number(r.id),
    name: r.name,
    style: r.style || null,
    description: r.description || null,
    og: r.og != null ? Number(r.og) : null,
    fg: r.fg != null ? Number(r.fg) : null,
    steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : (r.steps || []),
    author: firstName(r.author_name),
    mine: userId != null && Number(r.user_id) === Number(userId),
    uses: Number(r.uses_count) || 0,
    createdAt: r.created_at,
});

export const registerLibraryRoutes = (app, { pool, authenticateToken, requireAdmin, audit = async () => {}, onReport = () => {} }) => {
    const ensureTables = async () => {
        await pool.execute(`CREATE TABLE IF NOT EXISTS shared_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, name VARCHAR(80) NOT NULL, style VARCHAR(40) NULL,
            description VARCHAR(280) NULL, og DECIMAL(4,3) NULL, fg DECIMAL(4,3) NULL, steps JSON NOT NULL,
            uses_count INT NOT NULL DEFAULT 0, hidden TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME DEFAULT NOW(),
            INDEX idx_sp_list (hidden, uses_count), INDEX idx_sp_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS shared_profile_uses (
            profile_id INT NOT NULL, user_id INT NOT NULL, created_at DATETIME DEFAULT NOW(), PRIMARY KEY (profile_id, user_id),
            FOREIGN KEY (profile_id) REFERENCES shared_profiles(id) ON DELETE CASCADE)`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS shared_profile_reports (
            profile_id INT NOT NULL, user_id INT NOT NULL, reason VARCHAR(200) NULL, created_at DATETIME DEFAULT NOW(), PRIMARY KEY (profile_id, user_id),
            FOREIGN KEY (profile_id) REFERENCES shared_profiles(id) ON DELETE CASCADE)`);
    };

    // ---- Lista publica (com login: o app sempre manda o token) ----
    app.get('/api/library', authenticateToken, async (req, res) => {
        try {
            const q = clean(req.query.q, 60);
            const style = clean(req.query.style, 40);
            const sort = req.query.sort === 'recent' ? 'sp.created_at DESC' : 'sp.uses_count DESC, sp.created_at DESC';
            const where = ['sp.hidden = 0'];
            const params = [];
            if (q) { where.push('(sp.name LIKE ? OR sp.description LIKE ? OR sp.style LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
            if (style) { where.push('sp.style = ?'); params.push(style); }
            const [rows] = await pool.execute(
                `SELECT sp.*, u.name AS author_name FROM shared_profiles sp JOIN users u ON u.id = sp.user_id
                 WHERE ${where.join(' AND ')} AND u.deleted_at IS NULL ORDER BY ${sort} LIMIT ${LIBRARY.pageSize}`, params);
            res.json(rows.map(r => toPublic(r, req.user.id)));
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // ---- Publicar ----
    app.post('/api/library', authenticateToken, async (req, res) => {
        try {
            const { profile, error } = sanitizeSharedProfile(req.body);
            if (error) return res.status(400).json({ error });
            const [[{ n }]] = await pool.execute('SELECT COUNT(*) AS n FROM shared_profiles WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 DAY', [req.user.id]);
            if (Number(n) >= LIBRARY.maxPerDay) return res.status(429).json({ error: `Você já publicou ${LIBRARY.maxPerDay} perfis hoje. Tente amanhã.` });
            const [r] = await pool.execute(
                'INSERT INTO shared_profiles (user_id, name, style, description, og, fg, steps) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, profile.name, profile.style, profile.description, profile.og, profile.fg, JSON.stringify(profile.steps)]);
            res.status(201).json({ id: r.insertId });
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // ---- Remover o proprio perfil ----
    app.delete('/api/library/:id', authenticateToken, async (req, res) => {
        try {
            const [r] = await pool.execute('DELETE FROM shared_profiles WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Perfil não encontrado' });
            res.json({ ok: true });
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // ---- Usou um perfil: conta uma vez por pessoa ----
    app.post('/api/library/:id/use', authenticateToken, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT id FROM shared_profiles WHERE id = ? AND hidden = 0', [req.params.id]);
            if (!rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });
            const [r] = await pool.execute('INSERT IGNORE INTO shared_profile_uses (profile_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
            if (r.affectedRows) await pool.execute('UPDATE shared_profiles SET uses_count = uses_count + 1 WHERE id = ?', [req.params.id]);
            res.json({ ok: true });
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // ---- Denunciar ----
    app.post('/api/library/:id/report', authenticateToken, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT id, name, user_id FROM shared_profiles WHERE id = ?', [req.params.id]);
            if (!rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });
            if (Number(rows[0].user_id) === Number(req.user.id)) return res.status(400).json({ error: 'Este perfil é seu: você pode removê-lo.' });
            const [r] = await pool.execute('INSERT IGNORE INTO shared_profile_reports (profile_id, user_id, reason) VALUES (?, ?, ?)',
                [req.params.id, req.user.id, clean(req.body?.reason, 200) || null]);
            if (r.affectedRows) onReport(rows[0]);
            res.json({ ok: true });
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // ---- Admin: tudo, com denuncias; esconder e mostrar ----
    app.get('/api/admin/library', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT sp.*, u.name AS author_name, u.email AS author_email,
                        (SELECT COUNT(*) FROM shared_profile_reports r WHERE r.profile_id = sp.id) AS reports,
                        (SELECT GROUP_CONCAT(r.reason SEPARATOR ' | ') FROM shared_profile_reports r WHERE r.profile_id = sp.id) AS reasons
                 FROM shared_profiles sp JOIN users u ON u.id = sp.user_id
                 ORDER BY reports DESC, sp.created_at DESC LIMIT 200`);
            res.json(rows.map(r => ({ ...toPublic(r, null), authorEmail: r.author_email, hidden: !!r.hidden, reports: Number(r.reports) || 0, reasons: r.reasons || '' })));
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/admin/library/:id/hidden', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const hidden = req.body?.hidden ? 1 : 0;
            const [rows] = await pool.execute('SELECT name FROM shared_profiles WHERE id = ?', [req.params.id]);
            if (!rows.length) return res.status(404).json({ error: 'Perfil não encontrado' });
            await pool.execute('UPDATE shared_profiles SET hidden = ? WHERE id = ?', [hidden, req.params.id]);
            await audit(req, hidden ? 'LIBRARY_HIDE' : 'LIBRARY_SHOW', `Perfil ${req.params.id}: ${rows[0].name}`);
            res.json({ ok: true, hidden: !!hidden });
        } catch (e) { console.error('Biblioteca:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    return { ensureTables };
};
