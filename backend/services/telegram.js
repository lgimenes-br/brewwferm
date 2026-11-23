// Telegram pelo bot do Breww (um so, para todos). Antes cada pessoa criava o proprio bot e colava token e
// Chat ID; agora: "Conectar Telegram" no app ou site abre t.me/<bot>?start=<codigo>, a pessoa toca em Iniciar
// e o Telegram manda o codigo para o nosso webhook, que liga aquele chat a conta.
// Guardado por conta: so o numero do chat (users.telegram_chat_id). O token do bot fica no .env do servidor.
//
// .env: TELEGRAM_BOT_TOKEN (do @BotFather), TELEGRAM_BOT_USERNAME (sem @),
//       TELEGRAM_WEBHOOK_SECRET (qualquer texto longo; o Telegram devolve no cabecalho de cada chamada).

import crypto from 'crypto';

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
const USERNAME = () => (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
const SECRET = () => process.env.TELEGRAM_WEBHOOK_SECRET || '';
const LINK_TTL_MIN = 15;

export const telegramEnabled = () => !!(TOKEN() && USERNAME());

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const api = async (method, body, fetchImpl = fetch) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
};

export const ensureTelegramSchema = async (pool, runMigration) => {
    await runMigration('ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(32) DEFAULT NULL');
    await pool.execute(`CREATE TABLE IF NOT EXISTS telegram_links (
        token CHAR(32) PRIMARY KEY,
        user_id INT NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX idx_telegram_links_user (user_id)
    )`);
    // O modelo antigo (bot proprio de cada pessoa) saiu: tira token e Chat ID guardados nas regras de alerta
    await pool.execute(`UPDATE users SET alert_config = JSON_REMOVE(alert_config, '$.telegramBotToken', '$.telegramChatId')
        WHERE alert_config IS NOT NULL AND JSON_VALID(alert_config)
          AND (JSON_CONTAINS_PATH(alert_config, 'one', '$.telegramBotToken', '$.telegramChatId'))`).catch(() => {});
};

/** Manda uma mensagem (HTML) para o chat ligado a conta. Chat que bloqueou o bot e desligado. */
export const sendTelegramToUser = async (pool, userId, title, body) => {
    if (!TOKEN() || !userId) return false;
    const [rows] = await pool.execute('SELECT telegram_chat_id FROM users WHERE id = ?', [userId]);
    const chatId = rows?.[0]?.telegram_chat_id;
    if (!chatId) return false;
    try {
        const { status, data } = await api('sendMessage', {
            chat_id: chatId,
            text: `🍺 <b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`,
            parse_mode: 'HTML',
        });
        if (status === 403 || (status === 400 && /chat not found/i.test(data?.description || ''))) {
            // Bloqueou o bot ou apagou a conversa: para de tentar
            await pool.execute('UPDATE users SET telegram_chat_id = NULL WHERE id = ? AND telegram_chat_id = ?', [userId, chatId]);
            return false;
        }
        if (status !== 200) console.warn(`[Telegram] envio falhou: HTTP ${status} ${data?.description || ''}`);
        return status === 200;
    } catch (e) {
        console.warn('[Telegram] envio falhou:', e?.message || e);
        return false;
    }
};

/** Mensagem que chegou ao bot (webhook). Funcao separada para teste. */
export const handleTelegramUpdate = async (pool, update) => {
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    if (!chatId || msg.chat.type !== 'private') return;
    const text = String(msg.text || '').trim();
    const reply = (t) => api('sendMessage', { chat_id: chatId, text: t, parse_mode: 'HTML' }).catch(() => {});

    const start = text.match(/^\/start(?:@\w+)?\s+([a-f0-9]{32})$/i);
    if (start) {
        const token = start[1].toLowerCase();
        const [rows] = await pool.execute(
            'SELECT l.user_id, u.name FROM telegram_links l JOIN users u ON u.id = l.user_id WHERE l.token = ? AND l.expires_at > NOW()',
            [token]
        );
        await pool.execute('DELETE FROM telegram_links WHERE token = ? OR expires_at < NOW()', [token]);
        if (!rows.length) {
            return reply('Este link expirou ou já foi usado. No app ou no site do Breww, toque em <b>Conectar Telegram</b> de novo.');
        }
        // Um chat por conta, e um chat liga uma conta so (o ultimo vinculo vale)
        await pool.execute('UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = ?', [String(chatId)]);
        await pool.execute('UPDATE users SET telegram_chat_id = ? WHERE id = ?', [String(chatId), rows[0].user_id]);
        return reply(`Pronto, ${escapeHtml(rows[0].name || 'cervejeiro')}! Os avisos do Breww vão chegar aqui: temperatura fora do alvo, densidade, mudança de etapa e aparelho offline.\n\nPara parar, mande /parar ou desconecte no app.`);
    }
    if (/^\/(parar|stop)\b/i.test(text)) {
        const [r] = await pool.execute('UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = ?', [String(chatId)]);
        return reply(r.affectedRows ? 'Desconectado. Você não vai mais receber os avisos do Breww aqui.' : 'Este chat não está ligado a nenhuma conta do Breww.');
    }
    return reply('Este é o bot de avisos do Breww. Para receber os avisos, abra o app ou o site, vá em <b>Alertas</b> e toque em <b>Conectar Telegram</b>.');
};

export const registerTelegramRoutes = (app, { pool, authenticateToken }) => {
    // Estado da conexao (o app/site consulta enquanto a pessoa esta no Telegram)
    app.get('/api/user/telegram', authenticateToken, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT telegram_chat_id FROM users WHERE id = ?', [req.user.id]);
            res.json({ available: telegramEnabled(), connected: !!rows?.[0]?.telegram_chat_id, bot: USERNAME() || null });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // Link de uso unico (15 min) que abre o bot ja com o codigo da conta
    app.post('/api/user/telegram/link', authenticateToken, async (req, res) => {
        if (!telegramEnabled()) return res.status(503).json({ error: 'Telegram indisponível no momento.' });
        try {
            const token = crypto.randomBytes(16).toString('hex');
            await pool.execute('DELETE FROM telegram_links WHERE user_id = ? OR expires_at < NOW()', [req.user.id]);
            await pool.execute(`INSERT INTO telegram_links (token, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ${LINK_TTL_MIN} MINUTE)`, [token, req.user.id]);
            res.json({ url: `https://t.me/${USERNAME()}?start=${token}`, expiresInMin: LINK_TTL_MIN });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.post('/api/user/telegram/test', authenticateToken, async (req, res) => {
        try {
            const ok = await sendTelegramToUser(pool, req.user.id, 'Breww', 'Teste: os avisos do Breww estão chegando aqui.');
            if (!ok) return res.status(400).json({ error: 'Não consegui enviar. Conecte o Telegram de novo.' });
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.delete('/api/user/telegram', authenticateToken, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT telegram_chat_id FROM users WHERE id = ?', [req.user.id]);
            const chatId = rows?.[0]?.telegram_chat_id;
            await pool.execute('UPDATE users SET telegram_chat_id = NULL WHERE id = ?', [req.user.id]);
            if (chatId && TOKEN()) api('sendMessage', { chat_id: chatId, text: 'Telegram desconectado da sua conta Breww.' }).catch(() => {});
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    // Webhook do Telegram: so aceita com o segredo combinado no setWebhook
    app.post('/api/telegram/webhook', async (req, res) => {
        const secret = SECRET();
        const got = String(req.headers['x-telegram-bot-api-secret-token'] || '');
        if (!secret || got.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
            return res.status(401).end();
        }
        res.status(200).end(); // responde ja; o Telegram reenvia se demorar
        try { await handleTelegramUpdate(pool, req.body); } catch (e) { console.warn('[Telegram] webhook:', e?.message || e); }
    });
};

/** Liga o webhook no Telegram ao subir (idempotente). */
export const setupTelegramWebhook = async (publicUrl) => {
    if (!telegramEnabled() || !SECRET()) {
        if (TOKEN()) console.warn('[Telegram] falta TELEGRAM_BOT_USERNAME ou TELEGRAM_WEBHOOK_SECRET no .env');
        return;
    }
    try {
        const { status, data } = await api('setWebhook', {
            url: `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook`,
            secret_token: SECRET(),
            allowed_updates: ['message'],
            drop_pending_updates: false,
        });
        console.log(status === 200 ? '[Telegram] webhook ativo' : `[Telegram] setWebhook falhou: ${data?.description || status}`);
    } catch (e) { console.warn('[Telegram] setWebhook:', e?.message || e); }
};
