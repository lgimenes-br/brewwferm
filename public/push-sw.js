self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'Breww', body: 'Nova notificação do sistema.' };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/mask-icon.svg',
      vibrate: [200, 100, 200],
      data: data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
