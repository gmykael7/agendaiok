const OFFICIAL_APP_URL = 'https://meuagendai.fun/';

const DEFAULT_PUSH = {
  title: 'Novo agendamento • AgendAI',
  body: 'Um novo horário foi reservado. Abra o AgendAI para ver os detalhes.',
  tag: 'agendai-new-appointment',
  url: OFFICIAL_APP_URL,
};

// Lê o payload cifrado enviado pelo servidor. Se não houver conteúdo ou não
// estiver em JSON válido, usa o texto padrão.
const readPushPayload = (event) => {
  try {
    const data = event.data ? event.data.json() : null;
    if (!data || typeof data !== 'object') return DEFAULT_PUSH;
    return {
      title: String(data.title || DEFAULT_PUSH.title).slice(0, 120),
      body: String(data.body || DEFAULT_PUSH.body).slice(0, 240),
      tag: String(data.tag || DEFAULT_PUSH.tag).slice(0, 120),
      url: typeof data.url === 'string' && data.url.startsWith('/')
        ? new URL(data.url, OFFICIAL_APP_URL).href
        : OFFICIAL_APP_URL,
    };
  } catch {
    return DEFAULT_PUSH;
  }
};

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag,
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: payload.url },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || OFFICIAL_APP_URL;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(targetUrl); } catch {}
        }
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(targetUrl);
  })());
});
