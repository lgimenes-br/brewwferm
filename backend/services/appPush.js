// Push para o app nativo (iOS/Android) pelo servico de push da Expo.
// O app registra o seu "Expo push token" (POST /api/push/app-token) e todos os alertas que ja
// passam por sendPushToUser (pushService.js) passam a chegar tambem no celular.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // limite da Expo por requisicao

const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;
export const isValidExpoToken = (token) => typeof token === 'string' && TOKEN_RE.test(token);

export const ensureAppPushTable = (pool) =>
    pool.execute(`CREATE TABLE IF NOT EXISTS app_push_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        platform VARCHAR(16) DEFAULT NULL,
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

/**
 * Envia uma notificacao a todos os celulares do usuario.
 * Tokens que a Expo diz nao existirem mais (DeviceNotRegistered) sao apagados.
 */
export const sendAppPushToUser = async (pool, userId, title, body, data = {}, fetchImpl = fetch) => {
    if (!userId) return { sent: 0 };
    const [rows] = await pool.execute('SELECT id, token FROM app_push_tokens WHERE user_id = ?', [userId]);
    if (!rows.length) return { sent: 0 };

    let sent = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK);
        const messages = batch.map(r => ({
            to: r.token,
            title,
            body,
            data,
            sound: 'default',
            priority: 'high',
            channelId: 'alerts',
        }));
        try {
            const res = await fetchImpl(EXPO_PUSH_URL, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(messages),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                console.error('[AppPush] Expo respondeu', res.status, JSON.stringify(json).slice(0, 300));
                continue;
            }
            const tickets = Array.isArray(json?.data) ? json.data : [];
            for (let k = 0; k < tickets.length; k++) {
                const t = tickets[k];
                if (t?.status === 'ok') sent++;
                else if (t?.details?.error === 'DeviceNotRegistered') {
                    await pool.execute('DELETE FROM app_push_tokens WHERE id = ?', [batch[k].id]).catch(() => {});
                } else if (t?.status === 'error') {
                    console.error('[AppPush] erro no envio:', t.message || t.details?.error);
                }
            }
        } catch (err) {
            console.error('[AppPush] falha de rede:', err?.message || err);
        }
    }
    return { sent };
};

export const registerAppPushRoutes = (app, { pool, authenticateToken, sendPush = sendAppPushToUser }) => {
    ensureAppPushTable(pool).catch(err => console.error('[AppPush] tabela:', err?.message || err));

    // Registra (ou move para esta conta) o token do celular
    app.post('/api/push/app-token', authenticateToken, async (req, res) => {
        const token = req.body?.token;
        if (!isValidExpoToken(token)) return res.status(400).json({ error: 'Token de push inválido.' });
        const platform = ['ios', 'android'].includes(req.body?.platform) ? req.body.platform : null;
        try {
            await pool.execute(
                `INSERT INTO app_push_tokens (user_id, token, platform) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform), updated_at = NOW()`,
                [req.user.id, token, platform]
            );
            res.json({ ok: true });
        } catch (err) {
            console.error('[AppPush] registrar:', err);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    // Ao sair da conta no app: para de mandar notificacoes para este celular
    app.delete('/api/push/app-token', authenticateToken, async (req, res) => {
        const token = req.body?.token;
        if (!isValidExpoToken(token)) return res.status(400).json({ error: 'Token de push inválido.' });
        try {
            await pool.execute('DELETE FROM app_push_tokens WHERE token = ? AND user_id = ?', [token, req.user.id]);
            res.json({ ok: true });
        } catch (err) {
            console.error('[AppPush] remover:', err);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    // Botao "Enviar notificação de teste" no app
    app.post('/api/push/app-test', authenticateToken, async (req, res) => {
        try {
            const { sent } = await sendPush(pool, req.user.id, 'Notificação de teste', 'Os alertas do Breww vão chegar assim. 🍺', { url: '/' });
            if (!sent) return res.status(404).json({ error: 'Nenhum celular registrado para notificações.' });
            res.json({ ok: true, sent });
        } catch (err) {
            console.error('[AppPush] teste:', err);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });
};
