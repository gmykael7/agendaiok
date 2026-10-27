const OFFICIAL_APP_URL = 'https://meuagendai.fun/';
const APP_SHELL_CACHE = 'agendai-app-shell-v1';

const isCacheableAppRequest = (request, url) =>
  request.method === 'GET'
  && url.origin === self.location.origin
  && !url.pathname.startsWith('/api/');

const cacheAppShell = async () => {
  const cache = await caches.open(APP_SHELL_CACHE);
  const response = await fetch('/', { cache: 'reload' });
  if (!response.ok) throw new Error('Não foi possível guardar o app para uso offline.');

  const page = response.clone();
  await Promise.all([cache.put('/', response), cache.put('/index.html', page.clone())]);

  const html = await page.text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
    .map((url) => url.pathname);

  await Promise.all(assetPaths.map(async (path) => {
    try { await cache.add(path); } catch { /* Um arquivo opcional não bloqueia o uso offline. */ }
  }));
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await cacheAppShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('agendai-app-shell-') && name !== APP_SHELL_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isCacheableAppRequest(request, url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) void cache.put('/', response.clone());
        return response;
      } catch {
        return (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) void cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});

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
