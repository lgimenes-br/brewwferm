import webpush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BL4hVT-vi0XvI2r0Lm91LlaxwNtrqf7gK56y4EjjckSURXsBxSj8EqqyoqZiZggjVLP7o2EhGnEk4ihB7A0VkFs';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'Z2BN640CrZ6wD2cVbSL4Ext1bA9h7LrXVzJMc1Okrv8';

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
  if (!vapidPublicKey || !vapidPrivateKey) return;
  
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
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Inscrição não é mais válida, vamos deletar do banco
          await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        } else {
          console.error('Push error:', err);
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar push subscriptions:', err);
  }
};
