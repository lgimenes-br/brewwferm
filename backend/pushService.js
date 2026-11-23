import webpush from 'web-push';
import { sendAppPushToUser } from './services/appPush.js';
import { sendTelegramToUser } from './services/telegram.js';

// Chaves VAPID so pelo ambiente (.env escrito pelo deploy a partir dos segredos do GitHub)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
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
          // 410/404 = inscricao expirada; 403 = inscricao feita com outra chave VAPID (chaves trocadas)
          if (err?.statusCode === 410 || err?.statusCode === 404 || err?.statusCode === 403) {
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

  // 2. App nativo (iOS/Android) via servico de push da Expo
  try {
    await sendAppPushToUser(pool, userId, title, body, { url });
  } catch (err) {
    console.error('Erro no push do app:', err?.message || err);
  }

  // 3. Telegram pelo bot do Breww, se a pessoa conectou (services/telegram.js)
  try {
    await sendTelegramToUser(pool, userId, title, body);
  } catch (err) {
    console.error('Erro no Telegram:', err?.message || err);
  }
};
