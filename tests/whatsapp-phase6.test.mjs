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
const { handleAvailabilityRequest, handleWhatsAppFlowRequest } = await compile("export { handleAvailabilityRequest, handleWhatsAppFlowRequest } from './src/integrations/whatsapp/flow';");
const { assistantToday, assistantAddDays } = await compile("export { assistantToday, assistantAddDays } from './src/services/bookingAssistant';");
const tomorrow = assistantAddDays(assistantToday(), 1);

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

function setupDbWithTenant(t, { org = {}, services = [], barbers = [], appointments = [], clients = [] } = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());

  const email = 'barbearia@teste.com';
  const slug = 'barbearia-teste';
  const payload = {
    org: { email, slug, name: 'Barbearia Teste', open_hour: '09:00', close_hour: '19:00', ...org },
    services: services.length ? services : [{ id: 'svc1', name: 'Corte Masculino', price: 50, duration_minutes: 30, active: true }],
    barbers: barbers.length ? barbers : [{ id: 'b1', full_name: 'Rafael Barbeiro', active: true }],
    appointments,
    clients,
    notifications: [],
    updated_at: new Date().toISOString(),
  };

  const now = Date.now();
  sql.prepare('INSERT INTO app_store (key, value, expires_at, updated_at) VALUES (?, ?, NULL, ?)').run(`slug:${slug}`, email, now);
  sql.prepare('INSERT INTO app_store (key, value, expires_at, updated_at) VALUES (?, ?, NULL, ?)').run(`user:${email}`, JSON.stringify(payload), now);

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
  return { DB, slug, email, sql };
}

function getStoredPayload(DB, email) {
  const row = DB.prepare('SELECT value FROM app_store WHERE key = ?').bind(`user:${email}`).first();
  return JSON.parse(row.value);
}

test('Fase 6: endpoint GET /api/availability retorna horários livres reais para o Flow', async (t) => {
  const { DB, slug } = setupDbWithTenant(t);
  const env = { DB };

  const url = new URL(`https://agendai.test/api/availability?tenantSlug=${slug}&serviceId=svc1&date=${tomorrow}`);
  const response = await handleAvailabilityRequest(url, env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tenantSlug, slug);
  assert.equal(body.serviceId, 'svc1');
  assert.equal(body.date, tomorrow);
  assert.ok(Array.isArray(body.available));
  assert.ok(body.available.includes('09:00'));
  assert.ok(body.available.includes('09:30'));
});

test('Fase 6: endpoint POST /api/whatsapp/flow retorna dados da tela APPOINTMENT_SCREEN', async (t) => {
  const { DB, slug } = setupDbWithTenant(t);
  const env = { DB, WHATSAPP_DEFAULT_TENANT_SLUG: slug };

  const request = new Request('https://agendai.test/api/whatsapp/flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'INIT',
      data: { tenant_slug: slug },
    }),
  });

  const response = await handleWhatsAppFlowRequest(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.version, '3.0');
  assert.equal(body.screen, 'APPOINTMENT_SCREEN');
  assert.ok(Array.isArray(body.data.services));
  assert.equal(body.data.services[0].id, 'svc1');
  assert.ok(Array.isArray(body.data.barbers));
  assert.ok(Array.isArray(body.data.dates));
  assert.ok(Array.isArray(body.data.slots));
  assert.ok(body.data.slots.length > 0);
});

test('Fase 6: conclusão de WhatsApp Flow (nfm_reply) cria agendamento real e notifica painel', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB, slug, email } = setupDbWithTenant(t);
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  const evt = {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.flow-complete-1',
    from: '5584999998877',
    timestamp: '1726000000',
    interactive: {
      type: 'nfm_reply',
      flowResponse: {
        service_id: 'svc1',
        barber_id: 'b1',
        date: tomorrow,
        start_time: '10:30',
        client_name: 'Gabriel Martins',
      },
    },
  };

  await processWhatsAppEvent(env, evt);

  // 1. Cliente recebe confirmação do agendamento feito pelo Flow
  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /Agendamento confirmado via WhatsApp Flow/i);
  assert.match(reply, /Corte Masculino/);
  assert.match(reply, /Rafael Barbeiro/);
  assert.match(reply, /10:30/);

  // 2. Agendamento é salvo no banco D1
  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  const appt = stored.appointments[0];
  assert.equal(appt.start_time, '10:30');
  assert.equal(appt.client_name, 'Gabriel Martins');
  assert.equal(appt.client_phone, '5584999998877');
  assert.equal(appt.origin, 'whatsapp');
  assert.equal(appt.whatsappMessageId, 'wamid.flow-complete-1');

  // 3. CRM do cliente e notificações atualizados
  assert.equal(stored.clients.length, 1);
  assert.equal(stored.clients[0].name, 'Gabriel Martins');
  assert.equal(stored.notifications.length, 1);
  assert.equal(stored.notifications[0].type, 'new_appointment');
});

test('Fase 6: validação final de disponibilidade rejeita confirmação de Flow se vaga foi ocupada', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const existingAppt = {
    id: 'appt-already-taken',
    date: tomorrow,
    start_time: '10:30',
    duration_minutes: 30,
    service_id: 'svc1',
    barber_id: 'b1',
    client_name: 'Cliente Mais Rápido',
    client_phone: '5584999990000',
    status: 'scheduled',
  };

  const { DB, slug, email } = setupDbWithTenant(t, { appointments: [existingAppt] });
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  // Usuário submete o Flow para 10:30 (que já está ocupado)
  const evt = {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.flow-conflict',
    from: '5584999998877',
    timestamp: '1726000001',
    interactive: {
      type: 'nfm_reply',
      flowResponse: {
        service_id: 'svc1',
        barber_id: 'b1',
        date: tomorrow,
        start_time: '10:30',
        client_name: 'Cliente Atrasado',
      },
    },
  };

  await processWhatsAppEvent(env, evt);

  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /não está mais disponível|acabou de ser ocupado/i);

  const stored = getStoredPayload(DB, email);
  // Não duplicou agendamentos
  assert.equal(stored.appointments.length, 1);
  assert.equal(stored.appointments[0].client_name, 'Cliente Mais Rápido');
});
