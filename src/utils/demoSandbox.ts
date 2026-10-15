import { INITIAL_APPOINTMENTS, INITIAL_BARBERS, INITIAL_CLIENTS, INITIAL_ORG, INITIAL_SERVICES } from '../data/mockData';

/**
 * Modo demonstração: ativo só com ?demo=1.
 * - Armazenamento local vira memória: nada é gravado no navegador nem persiste entre recargas.
 * - Chamadas de gravação à API são aceitas e descartadas: nada chega à nuvem.
 * - A leitura da sessão devolve o snapshot de exemplo, então o painel abre já logado.
 */

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
export const IS_DEMO = params?.get('demo') === '1';

const KEYS = {
  CURRENT_ORG: 'agendai_current_org',
  ALL_ORGS: 'agendai_all_orgs',
  SERVICES: 'agendai_services',
  BARBERS: 'agendai_barbers',
  APPOINTMENTS: 'agendai_appointments',
  CLIENTS: 'agendai_clients',
  AUTH_SESSION: 'agendai_session_active',
  AUTH_TOKEN: 'agendai_auth_token',
};

/** Snapshot de exemplo, no mesmo formato que o servidor devolve em /api/sync. */
export const buildDemoSnapshot = () => ({
  org: INITIAL_ORG,
  savedOrgs: [INITIAL_ORG],
  services: INITIAL_SERVICES,
  barbers: INITIAL_BARBERS,
  appointments: INITIAL_APPOINTMENTS,
  clients: INITIAL_CLIENTS,
  notifications: [],
  products: [],
  product_sales: [],
  commands: [],
  waitlist: [],
  updated_at: new Date().toISOString(),
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

if (IS_DEMO && typeof window !== 'undefined') {
  // Marca o documento para o CSS deslocar o cabeçalho e a lateral abaixo da faixa de demonstração.
  document.documentElement.dataset.demo = 'on';
  const store = new Map<string, string>();
  const memoryStorage = {
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });

  const snapshot = buildDemoSnapshot();
  memoryStorage.setItem(KEYS.AUTH_SESSION, 'true');
  memoryStorage.setItem(KEYS.AUTH_TOKEN, 'demo-session');
  memoryStorage.setItem(KEYS.CURRENT_ORG, JSON.stringify(snapshot.org));
  memoryStorage.setItem(KEYS.ALL_ORGS, JSON.stringify(snapshot.savedOrgs));
  memoryStorage.setItem(KEYS.SERVICES, JSON.stringify(snapshot.services));
  memoryStorage.setItem(KEYS.BARBERS, JSON.stringify(snapshot.barbers));
  memoryStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(snapshot.appointments));
  memoryStorage.setItem(KEYS.CLIENTS, JSON.stringify(snapshot.clients));

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
    if (!url.includes('/api/')) return originalFetch(input, init);
    if (method !== 'GET') return Promise.resolve(jsonResponse({ ok: true, demo: true }));
    if (url.includes('/api/sync')) return Promise.resolve(jsonResponse(snapshot));
    if (url.includes('/api/notices')) return Promise.resolve(jsonResponse({ notices: [] }));
    return Promise.resolve(jsonResponse({ ok: true, demo: true }));
  };
}
