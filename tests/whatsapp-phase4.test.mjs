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

const { processWhatsAppEvent } = await compile("export { processWhatsAppEvent } from './src/integrations/whatsapp/processor';");
const { createWhatsAppBooking } = await compile("export { createWhatsAppBooking } from './src/integrations/whatsapp/booking';");

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
    services: services.length ? services : [{ id: 'svc1', name: 'Corte', price: 50, duration_minutes: 30, active: true }],
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

test('Fase 4: processWhatsAppEvent cria agendamento real com metadados corretos', async (t) => {
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
    messageId: 'wamid.p4-test-1',
    from: '5584999998888',
    profileName: 'Carlos Silva',
    text: 'quero corte amanha às 10:00',
    timestamp: '1726000000',
  };

  await processWhatsAppEvent(env, evt);

  // 1. Mensagem de resposta enviada ao cliente
  assert.equal(calls.length, 1);
  const sentBody = JSON.parse(calls[0].init.body);
  const replyText = sentBody.text.body;
  assert.match(replyText, /Agendamento confirmado/);
  assert.match(replyText, /Corte/);
  assert.match(replyText, /Rafael Barbeiro/);
  assert.match(replyText, /10:00/);
  assert.match(replyText, /50,00/);

  // 2. Agendamento persistido no D1
  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  const appt = stored.appointments[0];
  assert.equal(appt.start_time, '10:00');
  assert.equal(appt.client_phone, '5584999998888');
  assert.equal(appt.client_name, 'Carlos Silva');
  assert.equal(appt.origin, 'whatsapp');
  assert.equal(appt.whatsappMessageId, 'wamid.p4-test-1');
  assert.equal(appt.status, 'scheduled');

  // 3. CRM do cliente atualizado
  assert.equal(stored.clients.length, 1);
  assert.equal(stored.clients[0].total_visits, 1);
  assert.equal(stored.clients[0].total_spent, 50);

  // 4. Notificação criada para o painel administrativo
  assert.equal(stored.notifications.length, 1);
  assert.equal(stored.notifications[0].type, 'new_appointment');
  assert.match(stored.notifications[0].title, /WhatsApp/i);
});

test('Fase 4: fluxo em etapas com sessão retém serviço e agenda quando horário é enviado', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB, slug, email } = setupDbWithTenant(t);
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };
  const from = '5584988887777';

  // Etapa 1: Cliente escolhe o serviço
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.step-1',
    from,
    text: 'quero corte',
    timestamp: '1726000001',
  });

  // Etapa 2: Cliente escolhe o dia e horário
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.step-2',
    from,
    profileName: 'Mariana Lima',
    text: 'amanha 11:30',
    timestamp: '1726000002',
  });

  assert.equal(calls.length, 2);
  const secondReply = JSON.parse(calls[1].init.body).text.body;
  assert.match(secondReply, /Agendamento confirmado/);
  assert.match(secondReply, /11:30/);

  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  assert.equal(stored.appointments[0].start_time, '11:30');
  assert.equal(stored.appointments[0].client_name, 'Mariana Lima');
});

test('Fase 4: impede conflito de concorrência se o horário já estiver ocupado', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB, slug, email } = setupDbWithTenant(t);
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  // Cliente 1 agenda às 14:00 com sucesso
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.client-1',
    from: '5584911111111',
    profileName: 'Cliente 1',
    text: 'quero corte amanha às 14:00',
    timestamp: '1726000010',
  });

  const reply1 = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply1, /Agendamento confirmado/);

  // Cliente 2 tenta o mesmo horário (14:00)
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.client-2',
    from: '5584922222222',
    profileName: 'Cliente 2',
    text: 'quero corte amanha às 14:00',
    timestamp: '1726000011',
  });

  assert.equal(calls.length, 2);
  const reply2 = JSON.parse(calls[1].init.body).text.body;
  // Deve recusar e sugerir nova disponibilidade
  assert.match(reply2, /não está (mais )?disponível|não está livre|acabou de ser reservado/i);

  // Apenas 1 agendamento foi salvo
  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  assert.equal(stored.appointments[0].client_name, 'Cliente 1');
});

test('Fase 4: recusa horário inválido fora do expediente', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB, slug, email } = setupDbWithTenant(t);
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.night',
    from: '5584999990000',
    text: 'quero corte amanha às 03:00',
    timestamp: '1726000020',
  });

  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /não está livre|não está disponível/i);

  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 0);
});
