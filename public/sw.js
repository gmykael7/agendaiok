const OFFICIAL_APP_URL = 'https://meuagendai.fun/';

self.addEventListener('push', (event) => {
  const options = {
    body: 'Um novo horário foi reservado. Abra o AgendAI para ver os detalhes.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'agendai-new-appointment',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: OFFICIAL_APP_URL },
  };

  event.waitUntil(
    self.registration.showNotification('Novo agendamento • AgendAI', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(OFFICIAL_APP_URL); } catch {}
        }
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(OFFICIAL_APP_URL);
  })());
});
