import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

async function compile(contents) {
  const output = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}
const { default: worker } = await compile("export { default } from './src/worker';");
const helpers = await compile("export * from './src/utils/routes'; export * from './src/utils/storage'; export * from './src/utils/cloudReconciliation'; export * from './src/services/cloudSync';");
const EMAIL = 'auditoria@teste.invalid';
const DATE = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const snapshot = () => ({
  org: { id: 'qa-org', email: EMAIL, slug: 'auditoria', name: 'Auditoria local', open_hour: '08:00', close_hour: '20:00', account_status: 'active', timezone: 'America/Fortaleza' },
  services: [{ id: 'cut', name: 'Corte', price: 50, duration_minutes: 30, active: true }, { id: 'beard', name: 'Barba', price: 30, duration_minutes: 30, active: true }, { id: 'inactive', name: 'Inativo', price: 1, duration_minutes: 5, active: false }],
  barbers: [{ id: 'barber', full_name: 'Profissional', active: true }, { id: 'away', full_name: 'Inativo', active: false }],
  appointments: [], clients: [], notifications: [], products: [], productSales: [],
  updated_at: new Date(Date.now() - 60000).toISOString(),
});
const booking = (overrides = {}) => ({ id: crypto.randomUUID(), org_slug: 'auditoria', date: DATE, start_time: '09:00', barber_id: 'barber', service_id: 'cut', client_name: 'Cliente Teste', client_phone: '84999999999', ...overrides });

function setup(t, data = snapshot()) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const pending = [];
  t.after(async () => { await Promise.allSettled(pending); sql.close(); });
  t.mock.method(globalThis, 'fetch', async (_input, init = {}) => {
    const params = init.body instanceof URLSearchParams ? init.body : new URLSearchParams(String(init.body || ''));
    const token = params.get('response');
    const fixtures = {
      'booking-valid': { success: true, action: 'public_booking', hostname: 'auditoria.invalid' },
      'product-valid': { success: true, action: 'product_order', hostname: 'auditoria.invalid' },
      'wrong-action': { success: true, action: 'product_order', hostname: 'auditoria.invalid' },
      'wrong-host': { success: true, action: 'public_booking', hostname: 'outro.invalid' },
      'failed-challenge': { success: false, action: 'public_booking', hostname: 'auditoria.invalid' },
    };
    return Response.json(fixtures[token] || { success: false });
  });
  const put = (key, value, plain = false) => sql.prepare('INSERT INTO app_store VALUES (?, ?, NULL, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, plain ? value : JSON.stringify(value), Date.now());
  put(`user:${EMAIL}`, data);
  put('slug:auditoria', EMAIL, true);
  put(`backup:last:${EMAIL}`, { ...data, org: { ...data.org, name: 'Backup' } });
  for (const [role, permissions] of [['owner', {}], ['barber', {}], ['admin', { ajustes: false }]]) {
    put(`session:${role}`, { email: EMAIL, role, permissions, barber_id: 'barber', expires_at: Date.now() + 600000 });
  }
  const DB = { prepare(query) {
    const stmt = sql.prepare(query); let params = [];
    const args = () => /\?\d/.test(query) ? [Object.fromEntries(params.map((v, i) => [`?${i + 1}`, v]))] : params;
    return { bind(...values) { params = values; return this; }, async first() { return stmt.get(...args()) || null; }, async all() { return { results: stmt.all(...args()) }; }, async run() { const result = stmt.run(...args()); return { success: true, meta: { changes: Number(result.changes) } }; } };
  } };
  const call = (path, body, token) => {
    const protectedBody = body && typeof body === 'object' && !Array.isArray(body)
      ? {
          ...body,
          ...(!Object.hasOwn(body, 'cf-turnstile-response') && path === '/api/appointment' ? { 'cf-turnstile-response': 'booking-valid' } : {}),
          ...(!Object.hasOwn(body, 'cf-turnstile-response') && path === '/api/product-order' ? { 'cf-turnstile-response': 'product-valid' } : {}),
        }
      : body;
    return worker.fetch(new Request(`https://auditoria.invalid${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(protectedBody === undefined ? {} : { body: JSON.stringify(protectedBody) }),
  }), {
    DB,
    ASSETS: { fetch: async () => new Response('<html>app</html>') },
    TURNSTILE_SECRET: 'test-secret',
    TURNSTILE_HOSTNAMES: 'auditoria.invalid',
  }, { waitUntil: promise => pending.push(promise) });
  };
  const stored = () => JSON.parse(sql.prepare('SELECT value FROM app_store WHERE key = ?').get(`user:${EMAIL}`).value);
  return { sql, put, call, stored };
}

test('Turnstile bloqueia ausência, falha, ação divergente e hostname não autorizado antes de gravar', async t => {
  const { call, stored } = setup(t);
  for (const value of [null, 'failed-challenge', 'wrong-action', 'wrong-host']) {
    const response = await call('/api/appointment', booking({ 'cf-turnstile-response': value }));
    assert.equal(response.status, 403);
  }
  const productResponse = await call('/api/product-order', {
    org_slug: 'auditoria',
    customer_name: 'Teste',
    customer_phone: '84999999999',
    items: [{ product_id: 'inexistente', quantity: 1 }],
    'cf-turnstile-response': null,
  });
  assert.equal(productResponse.status, 403);
  assert.equal(stored().appointments.length, 0);
  assert.equal(stored().productSales.length, 0);
});

test('reserva pública usa preço, duração, profissional e status do catálogo; não aceita pagamento forjado', async t => {
  const { call, stored } = setup(t);
  const response = await call('/api/appointment', booking({ price: 0.01, duration_minutes: 1, status: 'completed', org_id: 'outra-conta', barber_name: 'Falso', payment_method: 'pix', services: [{ id: 'cut', price: 0.01 }, { id: 'beard', price: 0.01 }] }));
  assert.equal(response.status, 201);
  const canonical = (await response.json()).appointment;
  assert.equal(canonical.price, 80); assert.equal(canonical.duration_minutes, 60);
  assert.equal(canonical.status, 'scheduled'); assert.equal(canonical.org_id, 'qa-org');
  assert.equal(canonical.barber_name, 'Profissional'); assert.equal('payment_method' in canonical, false);
  assert.deepEqual(stored().appointments[0], canonical);
});

test('profissional e serviço precisam existir e estar ativos na própria barbearia', async t => {
  const { call, stored } = setup(t);
  for (const input of [{ barber_id: 'away' }, { barber_id: 'foreign' }, { service_id: 'inactive' }, { service_id: 'foreign' }]) {
    assert.equal((await call('/api/appointment', booking(input))).status, 409);
  }
  assert.equal(stored().appointments.length, 0);
});

test('datas impossíveis, horários inválidos, telefone curto e corpo malformado são rejeitados', async t => {
  const { call, stored } = setup(t);
  for (const input of [null, [], booking({ date: '2027-02-30' }), booking({ start_time: '25:30' }), booking({ client_phone: '999' }), booking({ services: [{ id: 'cut' }, { id: 'cut' }] })]) {
    assert.equal((await call('/api/appointment', input)).status, 400);
  }
  assert.equal(stored().appointments.length, 0);
});

test('pedidos simultâneos não vendem a mesma última unidade', async t => {
  const data = snapshot(); data.products = [{ id: 'p', name: 'Pomada', price: 35, stock: 1, active: true, public_visible: true }];
  const { call, stored } = setup(t, data);
  const order = { org_slug: 'auditoria', customer_name: 'Teste', customer_phone: '84999999999', items: [{ product_id: 'p', quantity: 1 }] };
  const responses = await Promise.all([call('/api/product-order', order), call('/api/product-order', order)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(stored().products[0].stock, 0); assert.equal(stored().productSales.length, 1);
});

test('quantidade inválida não corrompe preço, estoque nem pedido', async t => {
  const data = snapshot(); data.products = [{ id: 'p', name: 'Pomada', price: 35, stock: 5 }];
  const { call, stored } = setup(t, data);
  for (const quantity of ['abc', -1, 0, 1.5, null, 100]) {
    assert.equal((await call('/api/product-order', { org_slug: 'auditoria', customer_name: 'Teste', customer_phone: '84999999999', items: [{ product_id: 'p', quantity }] })).status, 400);
  }
  assert.equal((await call('/api/product-order', null)).status, 400);
  assert.equal(stored().products[0].stock, 5); assert.equal(stored().productSales.length, 0);
});

test('autosave antigo é rejeitado sem desfazer pedido público nem sua baixa de estoque', async t => {
  const data = snapshot(); data.products = [{ id: 'p', name: 'Pomada', price: 35, stock: 5 }];
  const { call, stored } = setup(t, data);
  await call('/api/product-order', { org_slug: 'auditoria', customer_name: 'Teste', customer_phone: '84999999999', items: [{ product_id: 'p', quantity: 2 }] });
  assert.equal((await call('/api/sync', { ...data, org: { ...data.org, name: 'Novo nome' } }, 'owner')).status, 409);
  assert.equal(stored().products[0].stock, 3); assert.equal(stored().productSales.length, 1);
  assert.equal(stored().org.name, data.org.name);
});

test('conflito usa duração real do combo, mesmo com duração falsa no navegador', async t => {
  const data = snapshot(); data.appointments.push(booking({ id: 'existing', start_time: '09:45', duration_minutes: 30, status: 'confirmed' }));
  const { call, stored } = setup(t, data);
  assert.equal((await call('/api/appointment', booking({ services: [{ id: 'cut' }, { id: 'beard' }], duration_minutes: 1 }))).status, 409);
  assert.equal(stored().appointments.length, 1);
});

test('fechamento excepcional é respeitado pelo servidor', async t => {
  const data = snapshot(); data.org.closed_periods = [{ date: DATE, all_day: true, reason: 'Manutenção' }];
  const { call } = setup(t, data);
  const response = await call('/api/appointment', booking());
  assert.equal(response.status, 409); assert.match((await response.json()).error, /Manutenção/);
});

test('repetir a mesma reserva não duplica agenda, cliente nem notificação', async t => {
  const { call, stored } = setup(t); const item = booking();
  assert.equal((await call('/api/appointment', item)).status, 201);
  const duplicate = await call('/api/appointment', item);
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(stored().appointments.length, 1); assert.equal(stored().clients[0].total_visits, 1); assert.equal(stored().notifications.length, 1);
  assert.equal((await call('/api/appointment', { ...item, client_name: 'Outro cliente' })).status, 409);
});

test('duas reservas simultâneas não sobrescrevem o snapshot e só uma ocupa o horário', async t => {
  const { call, stored } = setup(t);
  const responses = await Promise.all([call('/api/appointment', booking()), call('/api/appointment', booking({ client_name: 'Segundo cliente' }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(stored().appointments.length, 1); assert.equal(stored().clients.length, 1); assert.equal(stored().notifications.length, 1);
});

test('autosave anterior é rejeitado e preserva integralmente a nova reserva pública', async t => {
  const data = snapshot(); const { call, stored } = setup(t, data);
  await call('/api/appointment', booking());
  const response = await call('/api/sync', { ...data, org: { ...data.org, name: 'Nome atualizado' } }, 'owner');
  assert.equal(response.status, 409); assert.equal(stored().appointments.length, 1);
  assert.equal(stored().notifications.length, 1); assert.equal(stored().clients.length, 1); assert.equal(stored().org.name, data.org.name);
});

test('conciliação de três vias reaplica edição administrativa sem perder reserva pública', async t => {
  const base = snapshot(); const { call, stored } = setup(t, base);
  await call('/api/appointment', booking({ id: 'public-booking' }));
  const local = structuredClone(base);
  local.org.name = 'Nome atualizado no painel';

  assert.equal((await call('/api/sync', local, 'owner')).status, 409);
  const remoteResponse = await call(`/api/sync?email=${EMAIL}`, undefined, 'owner');
  assert.equal(remoteResponse.status, 200);
  const remote = await remoteResponse.json();
  const reconciled = helpers.reconcileCloudPayload(base, local, remote, 'local');
  assert.deepEqual(reconciled.conflicts, []);

  const saved = await call('/api/sync', reconciled.payload, 'owner');
  assert.equal(saved.status, 200);
  assert.equal(stored().org.name, 'Nome atualizado no painel');
  assert.ok(stored().appointments.some(item => item.id === 'public-booking'));
});

test('alterar o link não pode apropriar-se do link de outra barbearia', async t => {
  const data = snapshot(); const { call, put, stored, sql } = setup(t, data);
  put('slug:ocupado', 'outra@teste.invalid', true);
  const before = stored();
  assert.equal((await call('/api/sync', { ...data, org: { ...data.org, slug: 'ocupado' } }, 'owner')).status, 409);
  assert.deepEqual(stored(), before);
  assert.equal(sql.prepare("SELECT value FROM app_store WHERE key = 'slug:ocupado'").get().value, 'outra@teste.invalid');
});

test('barbeiro e admin sem Ajustes não restauram backup; proprietário pode restaurar', async t => {
  const { call, stored } = setup(t); const before = stored();
  for (const token of ['barber', 'admin']) assert.equal((await call('/api/sync/restore-last', {}, token)).status, 403);
  assert.deepEqual(stored(), before);
  assert.equal((await call('/api/sync/restore-last', {}, 'owner')).status, 200);
  assert.equal(stored().org.name, 'Backup');
});

test('Super Admin suspenso recupera o painel global sem liberar o app comum nem poder se suspender novamente', async t => {
  const data = snapshot();
  data.org.account_status = 'suspended';
  data.org.password = 'senha-segura';
  const { call, put, stored } = setup(t, data);
  put('superadmin:email', EMAIL, true);

  const regularLogin = await call('/api/auth/login', { email: EMAIL, password: 'senha-segura' });
  assert.equal(regularLogin.status, 403);

  const recoveryLogin = await call('/api/auth/login', { email: EMAIL, password: 'senha-segura', purpose: 'superadmin' });
  assert.equal(recoveryLogin.status, 200);
  const { token } = await recoveryLogin.json();
  assert.ok(token);

  const selfSuspend = await call('/api/superadmin/tenant', { email: EMAIL, status: 'suspended', plan: 'premium' }, token);
  assert.equal(selfSuspend.status, 400);

  const reactivate = await call('/api/superadmin/tenant', { email: EMAIL, status: 'active', plan: 'premium' }, token);
  assert.equal(reactivate.status, 200);
  assert.equal(stored().org.account_status, 'active');
});

test('rota de API desconhecida nunca responde com a página HTML do app', async t => {
  const { call } = setup(t); const response = await call('/api/nao-existe');
  assert.equal(response.status, 404); assert.match(response.headers.get('content-type'), /application\/json/);
});

test('salvamento do barbeiro preserva outros profissionais, seus avisos e campos omitidos da leitura', async t => {
  const data = snapshot();
  data.appointments = [booking({ id: 'mine', barber_id: 'barber', payment_method: 'pix', status: 'completed' }), booking({ id: 'other', barber_id: 'other-barber' })];
  data.notifications = [{ id: 'other-notice', org_id: 'qa-org', appointment_id: 'other', type: 'new_appointment', title: 'Outro profissional', message: 'Preservar', created_at: new Date().toISOString() }];
  const { call, stored } = setup(t, data);
  const privateResponse = await call(`/api/sync?email=${EMAIL}`, undefined, 'barber');
  const ownData = await privateResponse.json();
  assert.equal(ownData.appointments.length, 1); assert.equal('payment_method' in ownData.appointments[0], false);
  ownData.appointments[0].client_name = 'Nome atualizado';
  assert.equal((await call('/api/sync', ownData, 'barber')).status, 200);
  assert.equal(stored().appointments.length, 2);
  assert.equal(stored().appointments.find(a => a.id === 'mine').payment_method, 'pix');
  assert.ok(stored().notifications.some(n => n.id === 'other-notice'));
});

test('todos os formatos de links públicos ativam o isolamento do painel', () => {
  for (const suffix of ['/agendar/demo', '/booking/demo', '/#agendar/demo', '/#/booking/demo', '/?slug=demo', '/?org=demo', '/?agendar=demo', '/?booking=demo']) {
    const location = new URL(`https://teste.invalid${suffix}`);
    assert.equal(helpers.bookingSlugFromLocation(location), 'demo', suffix);
    assert.equal(helpers.isPublicBookingLocation(location), true, suffix);
  }
  assert.equal(helpers.isPublicBookingLocation(new URL('https://teste.invalid/?slug=%3Cbad%3E')), true);
  assert.equal(helpers.bookingSlugFromLocation(new URL('https://teste.invalid/?slug=%3Cbad%3E')), null);
  assert.equal(helpers.isPublicBookingLocation(new URL('https://teste.invalid/#login')), false);
});

test('cache inválido não derruba a inicialização nem é apagado pelo leitor', t => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => { if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage; });
  for (const raw of ['{', 'null', '{}', '"texto"']) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => raw, removeItem() { assert.fail('Não deve apagar cache'); } } });
    assert.deepEqual(helpers.readStoredArray('cache-local'), []);
  }
});

test('salvar e reservar exigem confirmação JSON explícita; HTML 200 não é sucesso', async t => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-token', removeItem() {} } });
  t.after(() => { if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage; });
  for (const body of ['<html>deploy incompleto</html>', '{}', '{"success":false}']) {
    t.mock.method(console, 'debug', () => {});
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    assert.equal((await helpers.saveBarbershopToCloudDetailed(snapshot())).ok, false);
    assert.equal((await helpers.pushAppointmentToCloud(booking(), 'auditoria', 'booking-valid')).ok, false);
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, updated_at: 'revision' }));
  assert.equal((await helpers.saveBarbershopToCloudDetailed(snapshot())).ok, true);
  assert.equal((await helpers.pushAppointmentToCloud(booking(), 'auditoria', 'booking-valid')).ok, true);
});
