// Funil da instalacao (BI): o assistente do site registra as etapas de cada conta (placa detectada,
// falhas, gravacao, Wi-Fi, vinculo). Serve para melhorar o produto e para estatisticas agregadas;
// nada aqui sai da empresa por pessoa. O admin ve o funil dos ultimos dias.

export const INSTALL_EVENTS = [
    'login', 'connect_ok', 'connect_fail', 'existing_ok', 'existing_fail',
    'flash_ok', 'flash_fail', 'wifi_ok', 'wifi_fail', 'bind_ok', 'bind_fail', 'done',
];
const FUNNEL = ['login', 'connect_ok', 'flash_ok', 'wifi_ok', 'bind_ok'];
const MAX_PER_HOUR = 120;
export const RETENTION_MONTHS = 24;
export const LOG_RETENTION_DAYS = 90; // log tecnico da instalacao (diagnostico)
const MAX_LOG = 200000; // politica de privacidade: depois disso ficam so os numeros agregados

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/** Valida um evento enviado pelo assistente. Retorna { event } ou { error }. Funcao pura (testavel). */
export const sanitizeInstallEvent = (body) => {
    const b = body || {};
    if (!INSTALL_EVENTS.includes(b.event)) return { error: 'Evento inválido.' };
    const serial = clean(b.serial, 32).replace(/[^0-9A-Fa-f]/g, '').toUpperCase() || null;
    return {
        event: {
            event: b.event,
            board: clean(b.board, 24) || null,
            chip: clean(b.chip, 40) || null,
            detail: clean(b.detail, 160) || null,
            serial,
            session: clean(b.session, 40) || null,
        },
    };
};

export const registerInstallEventRoutes = (app, { pool, authenticateToken, requireAdmin }) => {
    const hits = new Map(); // limite simples por conta (memoria)
    const allowed = (userId) => {
        const now = Date.now();
        const h = (hits.get(userId) || []).filter(t => now - t < 3600000);
        if (h.length >= MAX_PER_HOUR) { hits.set(userId, h); return false; }
        h.push(now); hits.set(userId, h);
        return true;
    };

    const ensureTable = () => pool.execute(`CREATE TABLE IF NOT EXISTS install_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session VARCHAR(40) DEFAULT NULL,
        event VARCHAR(24) NOT NULL,
        board VARCHAR(24) DEFAULT NULL,
        chip VARCHAR(40) DEFAULT NULL,
        detail VARCHAR(160) DEFAULT NULL,
        serial VARCHAR(32) DEFAULT NULL,
        created_at DATETIME DEFAULT NOW(),
        INDEX idx_created (created_at),
        INDEX idx_user (user_id)
    )`);

    const ensureLogTable = () => pool.execute(`CREATE TABLE IF NOT EXISTS install_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session VARCHAR(40) NOT NULL,
        board VARCHAR(24) DEFAULT NULL,
        chip VARCHAR(40) DEFAULT NULL,
        text MEDIUMTEXT NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uq_session (user_id, session),
        INDEX idx_updated (updated_at)
    )`);

    // Log da instalacao (passos do assistente + serial da placa). Uma linha por sessao; cada envio
    // substitui o anterior (o texto e sempre o log inteiro ate aquele momento).
    app.post('/api/install/log', authenticateToken, async (req, res) => {
        const b = req.body || {};
        const session = clean(b.session, 40);
        const text = String(b.text ?? '').slice(-MAX_LOG);
        if (!session || !text.trim()) return res.status(400).json({ error: 'Log vazio.' });
        if (!allowed(req.user.id)) return res.status(429).json({ error: 'Muitos envios.' });
        try {
            await pool.execute(
                `INSERT INTO install_logs (user_id, session, board, chip, text) VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE text = VALUES(text), board = COALESCE(VALUES(board), board), chip = COALESCE(VALUES(chip), chip), updated_at = NOW()`,
                [req.user.id, session, clean(b.board, 24) || null, clean(b.chip, 40) || null, text]);
            res.status(201).json({ ok: true });
        } catch (e) { console.error('Log da instalação:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // Admin: instalacoes recentes (sem o texto) e o log de uma delas
    app.get('/api/admin/install-logs', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT l.id, l.session, l.board, l.chip, l.created_at, l.updated_at, LENGTH(l.text) AS size, u.email,
                        (SELECT e.event FROM install_events e WHERE e.user_id = l.user_id AND e.session = l.session ORDER BY e.id DESC LIMIT 1) AS last_event
                 FROM install_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.updated_at DESC LIMIT 50`);
            res.json(rows.map(r => ({ ...r, size: Number(r.size) })));
        } catch (e) { console.error('Log da instalação:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });
    app.get('/api/admin/install-logs/:id', authenticateToken, requireAdmin, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'ID inválido.' });
        try {
            const [rows] = await pool.execute('SELECT text FROM install_logs WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Log não encontrado.' });
            res.type('text/plain; charset=utf-8').send(rows[0].text);
        } catch (e) { console.error('Log da instalação:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/install/events', authenticateToken, async (req, res) => {
        const { event, error } = sanitizeInstallEvent(req.body);
        if (error) return res.status(400).json({ error });
        if (!allowed(req.user.id)) return res.status(429).json({ error: 'Muitos eventos.' });
        try {
            await pool.execute(
                'INSERT INTO install_events (user_id, session, event, board, chip, detail, serial) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, event.session, event.event, event.board, event.chip, event.detail, event.serial]);
            res.status(201).json({ ok: true });
        } catch (e) { console.error('Funil da instalação:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // Admin: funil (contas distintas por etapa), falhas mais comuns e placas detectadas
    app.get('/api/admin/install-funnel', authenticateToken, requireAdmin, async (req, res) => {
        const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
        try {
            const [counts] = await pool.execute(
                `SELECT event, COUNT(DISTINCT user_id) AS users, COUNT(*) AS total FROM install_events
                 WHERE created_at >= NOW() - INTERVAL ${days} DAY GROUP BY event`);
            const [fails] = await pool.execute(
                `SELECT event, detail, COUNT(*) AS total FROM install_events
                 WHERE created_at >= NOW() - INTERVAL ${days} DAY AND event LIKE '%_fail' GROUP BY event, detail ORDER BY total DESC LIMIT 10`);
            const [boards] = await pool.execute(
                `SELECT COALESCE(board, chip) AS board, COUNT(DISTINCT user_id) AS users FROM install_events
                 WHERE created_at >= NOW() - INTERVAL ${days} DAY AND event IN ('connect_ok', 'existing_ok') GROUP BY COALESCE(board, chip) ORDER BY users DESC`);
            const by = Object.fromEntries(counts.map(r => [r.event, { users: Number(r.users), total: Number(r.total) }]));
            res.json({
                days,
                funnel: FUNNEL.map(e => ({ event: e, users: by[e]?.users || 0 })),
                events: by,
                fails: fails.map(f => ({ event: f.event, detail: f.detail, total: Number(f.total) })),
                boards: boards.map(b => ({ board: b.board, users: Number(b.users) })),
            });
        } catch (e) { console.error('Funil da instalação:', e.message); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    /** Apaga as etapas com mais de 24 meses (chamado 1x por dia). */
    const purgeOld = async () => {
        const [r] = await pool.execute(`DELETE FROM install_events WHERE created_at < NOW() - INTERVAL ${RETENTION_MONTHS} MONTH`);
        const [l] = await pool.execute(`DELETE FROM install_logs WHERE updated_at < NOW() - INTERVAL ${LOG_RETENTION_DAYS} DAY`);
        return (r?.affectedRows || 0) + (l?.affectedRows || 0);
    };

    return { ensureTable: async () => { await ensureTable(); await ensureLogTable(); }, purgeOld };
};
