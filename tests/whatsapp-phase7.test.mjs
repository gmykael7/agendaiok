import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

async function compile(contents) {
  const output = await build({
    stdin: { contents, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}

const { default: worker } = await compile("export { default } from './src/worker';");
const { processWhatsAppEvent } = await compile("export { processWhatsAppEvent } from './src/integrations/whatsapp/processor';");
const {
  resolveTenantSlug,
  connectTenantWhatsApp,
  disconnectTenantWhatsApp,
  getTenantWhatsAppConnection,
} = await compile("export { resolveTenantSlug, connectTenantWhatsApp, disconnectTenantWhatsApp, getTenantWhatsAppConnection } from './src/integrations/whatsapp/tenant';");

function withMockedFetch(t, handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

function setupMultiTenantDb(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());

  const now = Date.now();

  const addTenant = (slug, email, name) => {
    const payload = {
      org: { email, slug, name, open_hour: '09:00', close_hour: '19:00' },
      services: [{ id: 'svc1', name: 'Corte', price: 40, duration_minutes: 30, active: true }],
      barbers: [{ id: 'b1', full_name: `Barbeiro de ${name}`, active: true }],
      appointments: [],
      clients: [],
      notifications: [],
      updated_at: new Date().toISOString(),
    };
    sql.prepare('INSERT INTO app_store (key, value, expires_at, updated_at) VALUES (?, ?, NULL, ?)').run(`slug:${slug}`, email, now);
    sql.prepare('INSERT INTO app_store (key, value, expires_at, updated_at) VALUES (?, ?, NULL, ?)').run(`user:${email}`, JSON.stringify(payload), now);
  };

  addTenant('barbearia-alfa', 'alfa@teste.com', 'Barbearia Alfa');
  addTenant('barbearia-beta', 'beta@teste.com', 'Barbearia Beta');

  const DB = {
    prepare(query) {
      const stmt = sql.prepare(query);
      let params = [];
      const args = () => /\?\d/.test(query) ? [Object.fromEntries(params.map((val, idx) => [`?${idx + 1}`, val]))] : params;
      return {
        bind(...values) { params = values; return this; },
        first() { return stmt.get(...args()) ?? null; },
        run() { return stmt.run(...args()); },
        all() { return { results: stmt.all(...args()) }; },
      };
    },
  };
  return { DB, sql };
}

function getStoredPayload(DB, email) {
  const row = DB.prepare('SELECT value FROM app_store WHERE key = ?').bind(`user:${email}`).first();
  return JSON.parse(row.value);
}

test('Fase 7: conexão dinâmica de múltiplos estabelecimentos e roteamento multi-tenant', async (t) => {
  withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB } = setupMultiTenantDb(t);
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'token',
  };

  // 1. Conecta o WhatsApp da Barbearia Alfa (número 111000)
  await connectTenantWhatsApp(env, 'barbearia-alfa', {
    phoneNumberId: 'phone-alfa-111000',
    displayPhoneNumber: '(11) 91111-0000',
    verifiedName: 'Barbearia Alfa Oficial',
  });

  // 2. Conecta o WhatsApp da Barbearia Beta (número 222000)
  await connectTenantWhatsApp(env, 'barbearia-beta', {
    phoneNumberId: 'phone-beta-222000',
    displayPhoneNumber: '(21) 92222-0000',
    verifiedName: 'Barbearia Beta Oficial',
  });

  // 3. Valida se o resolveTenantSlug mapeia dinamicamente cada número
  assert.equal(await resolveTenantSlug(env, 'phone-alfa-111000'), 'barbearia-alfa');
  assert.equal(await resolveTenantSlug(env, 'phone-beta-222000'), 'barbearia-beta');

  // 4. Mensagem recebida no número da Alfa agenda na Alfa
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: 'phone-alfa-111000',
    messageId: 'wamid.alfa-1',
    from: '5511999990001',
    profileName: 'Cliente Alfa',
    text: 'quero corte amanha às 10:00',
    timestamp: '1726000000',
  });

  // 5. Mensagem recebida no número da Beta agenda na Beta
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: 'phone-beta-222000',
    messageId: 'wamid.beta-1',
    from: '5521999990002',
    profileName: 'Cliente Beta',
    text: 'quero corte amanha às 11:00',
    timestamp: '1726000001',
  });

  // 6. Confirma isolamento multi-tenant
  const payloadAlfa = getStoredPayload(DB, 'alfa@teste.com');
  const payloadBeta = getStoredPayload(DB, 'beta@teste.com');

  assert.equal(payloadAlfa.appointments.length, 1);
  assert.equal(payloadAlfa.appointments[0].client_name, 'Cliente Alfa');
  assert.equal(payloadAlfa.appointments[0].start_time, '10:00');

  assert.equal(payloadBeta.appointments.length, 1);
  assert.equal(payloadBeta.appointments[0].client_name, 'Cliente Beta');
  assert.equal(payloadBeta.appointments[0].start_time, '11:00');
});

test('Fase 7: desconexão de WhatsApp remove mapeamento no banco', async (t) => {
  const { DB } = setupMultiTenantDb(t);
  const env = { DB };

  await connectTenantWhatsApp(env, 'barbearia-alfa', {
    phoneNumberId: 'phone-disconnect-test',
    displayPhoneNumber: '(11) 99999-8888',
  });

  let connection = await getTenantWhatsAppConnection(env, 'barbearia-alfa');
  assert.equal(connection.status, 'connected');
  assert.equal(connection.phoneNumberId, 'phone-disconnect-test');

  // Desconecta
  await disconnectTenantWhatsApp(env, 'barbearia-alfa');

  connection = await getTenantWhatsAppConnection(env, 'barbearia-alfa');
  assert.equal(connection.status, 'disconnected');

  // O mapeamento não deve mais resolver para o slug
  const resolved = await resolveTenantSlug(env, 'phone-disconnect-test');
  assert.notEqual(resolved, 'barbearia-alfa');
});

test('Fase 7: endpoints de API do painel administrativo (/api/whatsapp/connect e /api/whatsapp/connection)', async (t) => {
  const { DB, sql } = setupMultiTenantDb(t);
  const env = { DB };

  // Cria sessão autenticada para o proprietário da Alfa
  const token = 'session-token-test-123';
  const sessionRecord = {
    email: 'alfa@teste.com',
    role: 'owner',
    expires_at: Date.now() + 600000,
  };
  sql.prepare('INSERT INTO app_store (key, value, expires_at, updated_at) VALUES (?, ?, NULL, ?)').run(`session:${token}`, JSON.stringify(sessionRecord), Date.now());

  // Conecta via POST /api/whatsapp/connect
  const connectReq = new Request('https://agendai.test/api/whatsapp/connect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumberId: 'phone-api-123',
      businessAccountId: 'waba-api-456',
      displayPhoneNumber: '(84) 99999-0000',
      verifiedName: 'Barbearia Alfa API',
    }),
  });

  const connectRes = await worker.fetch(connectReq, env);
  assert.equal(connectRes.status, 200);
  const connectBody = await connectRes.json();
  assert.equal(connectBody.success, true);
  assert.equal(connectBody.connection.status, 'connected');
  assert.equal(connectBody.connection.phoneNumberId, 'phone-api-123');

  // Consulta status via GET /api/whatsapp/connection
  const getReq = new Request('https://agendai.test/api/whatsapp/connection', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const getRes = await worker.fetch(getReq, env);
  assert.equal(getRes.status, 200);
  const getBody = await getRes.json();
  assert.equal(getBody.connection.status, 'connected');
  assert.equal(getBody.connection.verifiedName, 'Barbearia Alfa API');

  // Desconecta via POST /api/whatsapp/disconnect
  const disconnectReq = new Request('https://agendai.test/api/whatsapp/disconnect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const disconnectRes = await worker.fetch(disconnectReq, env);
  assert.equal(disconnectRes.status, 200);
  const disconnectBody = await disconnectRes.json();
  assert.equal(disconnectBody.connection.status, 'disconnected');
});
