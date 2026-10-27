import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

const keyFor = (request) => typeof request === 'string' ? request : new URL(request.url).pathname;

const setup = () => {
  const handlers = new Map();
  const entries = new Map();
  let online = true;
  const cache = {
    async add(path) {
      const response = await fetch(`https://meuagendai.fun${path}`);
      entries.set(path, response.clone());
    },
    async put(request, response) { entries.set(keyFor(request), response.clone()); },
    async match(request) { return entries.get(keyFor(request))?.clone(); },
  };
  const fetch = async (request) => {
    if (!online) throw new TypeError('Sem conexão');
    const path = keyFor(request);
    if (path === '/') return new Response('<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">', { status: 200 });
    if (path === '/assets/app.js' || path === '/assets/app.css') return new Response(path, { status: 200 });
    return new Response('ok', { status: 200 });
  };
  const context = {
    URL, Response, Request, Promise, console,
    fetch,
    caches: { open: async () => cache, keys: async () => ['agendai-app-shell-v1'], delete: async () => true },
    self: {
      location: { origin: 'https://meuagendai.fun' },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
      registration: { showNotification: async () => {} },
    },
  };
  vm.runInNewContext(source, context);
  const dispatch = async (name, event) => {
    let pending;
    handlers.get(name)({ ...event, waitUntil: (promise) => { pending = promise; }, respondWith: (promise) => { pending = promise; } });
    return pending && await pending;
  };
  return { entries, setOnline: (value) => { online = value; }, dispatch };
};

test('service worker guarda app e arquivos essenciais antes de ficar sem internet', async () => {
  const sw = setup();
  await sw.dispatch('install', {});
  assert.ok(sw.entries.has('/'));
  assert.ok(sw.entries.has('/index.html'));
  assert.ok(sw.entries.has('/assets/app.js'));
  assert.ok(sw.entries.has('/assets/app.css'));
});

test('service worker abre o app salvo quando a navegação acontece offline e não guarda API privada', async () => {
  const sw = setup();
  await sw.dispatch('install', {});
  sw.setOnline(false);
  const offlinePage = await sw.dispatch('fetch', { request: { method: 'GET', mode: 'navigate', url: 'https://meuagendai.fun/agenda' } });
  assert.match(await offlinePage.text(), /app\.js/);
  assert.equal(await sw.dispatch('fetch', { request: new Request('https://meuagendai.fun/api/sync') }), undefined);
});
