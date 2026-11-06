import webpush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BL4hVT-vi0XvI2r0Lm91LlaxwNtrqf7gK56y4EjjckSURXsBxSj8EqqyoqZiZggjVLP7o2EhGnEk4ihB7A0VkFs';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:contato@breww.live',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn('⚠️ [Push] VAPID keys not configured. Push notifications are disabled.');
}

export const sendPushToUser = async (pool, userId, title, body, url = '/') => {
  if (!userId) return;

  // 1. Disparo via WebPush (Navegador / PWA)
  if (vapidPublicKey && vapidPrivateKey) {
    try {
      const [rows] = await pool.execute('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
      const payload = JSON.stringify({ title, body, url });

      for (const sub of rows) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
        } catch (err) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
          } else {
            console.error('Push error:', err);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar push subscriptions:', err);
    }
  }

  // 2. Disparo opcional via Telegram Bot Webhook (se configurado nas Regras de Alerta do usuário)
  try {
    const [uRows] = await pool.execute('SELECT alert_config FROM users WHERE id = ?', [userId]);
    const rawCfg = uRows?.[0]?.alert_config;
    if (rawCfg) {
      const cfg = typeof rawCfg === 'string' ? JSON.parse(rawCfg) : rawCfg;
      const botToken = String(cfg?.telegramBotToken || '').trim();
      const chatId = String(cfg?.telegramChatId || '').trim();
      if (botToken && chatId) {
        const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🍺 <b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`,
            parse_mode: 'HTML'
          })
        }).catch(err => console.error('Telegram alert error:', err.message));
      }
    }
  } catch (err) {
    // Ignore if alert_config column not ready or invalid JSON
  }
};
