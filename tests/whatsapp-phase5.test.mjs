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

test('Fase 5: consulta de agendamentos lista agendamentos futuros do cliente', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const existingAppt = {
    id: 'appt-1',
    date: tomorrow,
    start_time: '14:00',
    duration_minutes: 30,
    service_id: 'svc1',
    service_name: 'Corte',
    barber_id: 'b1',
    barber_name: 'Rafael Barbeiro',
    client_name: 'Lucas Ferreira',
    client_phone: '5584999991111',
    status: 'scheduled',
    price: 50,
  };

  const { DB, slug } = setupDbWithTenant(t, { appointments: [existingAppt] });
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.query-1',
    from: '5584999991111',
    text: 'quais meus agendamentos?',
    timestamp: '1726000000',
  });

  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /Seus próximos agendamentos/i);
  assert.match(reply, /Corte/);
  assert.match(reply, /Rafael Barbeiro/);
  assert.match(reply, /14:00/);
});

test('Fase 5: cancelamento de agendamento altera status e libera a vaga na agenda', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const existingAppt = {
    id: 'appt-cancel-test',
    date: tomorrow,
    start_time: '10:00',
    duration_minutes: 30,
    service_id: 'svc1',
    service_name: 'Corte',
    barber_id: 'b1',
    barber_name: 'Rafael Barbeiro',
    client_name: 'Lucas Ferreira',
    client_phone: '5584999992222',
    status: 'scheduled',
    price: 50,
  };

  const { DB, slug, email } = setupDbWithTenant(t, { appointments: [existingAppt] });
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  // Cliente solicita cancelamento
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.cancel-1',
    from: '5584999992222',
    text: 'quero cancelar meu horário',
    timestamp: '1726000010',
  });

  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /cancelado com sucesso/i);
  assert.match(reply, /10:00/);

  // Verifica no D1 se o agendamento foi marcado como canceled
  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  assert.equal(stored.appointments[0].status, 'canceled');

  // Notificação de cancelamento emitida
  assert.equal(stored.notifications.length, 1);
  assert.equal(stored.notifications[0].type, 'appointment_canceled');

  // Agora outro cliente consegue agendar no mesmo horário das 10:00!
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.new-client-booking',
    from: '5584999993333',
    profileName: 'Novo Cliente',
    text: 'quero corte amanha às 10:00',
    timestamp: '1726000020',
  });

  assert.equal(calls.length, 2);
  const replyNewClient = JSON.parse(calls[1].init.body).text.body;
  assert.match(replyNewClient, /Agendamento confirmado/);

  const finalStored = getStoredPayload(DB, email);
  // Total de agendamentos agora: 1 cancelado + 1 novo agendado
  assert.equal(finalStored.appointments.length, 2);
  assert.equal(finalStored.appointments[0].status, 'scheduled');
  assert.equal(finalStored.appointments[0].client_phone, '5584999993333');
});

test('Fase 5: reagendamento direto altera data/horário e notifica o painel', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const existingAppt = {
    id: 'appt-resched-test',
    date: tomorrow,
    start_time: '11:00',
    duration_minutes: 30,
    service_id: 'svc1',
    service_name: 'Corte',
    barber_id: 'b1',
    barber_name: 'Rafael Barbeiro',
    client_name: 'Bruno Lima',
    client_phone: '5584999994444',
    status: 'scheduled',
    price: 50,
  };

  const { DB, slug, email } = setupDbWithTenant(t, { appointments: [existingAppt] });
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  // Reagenda diretamente informando novo dia e hora
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.resched-direct',
    from: '5584999994444',
    text: 'quero reagendar para amanha às 15:00',
    timestamp: '1726000030',
  });

  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /reagendado com sucesso/i);
  assert.match(reply, /15:00/);

  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  assert.equal(stored.appointments[0].start_time, '15:00');
  assert.equal(stored.appointments[0].status, 'scheduled');

  // Notificação de reagendamento emitida
  assert.equal(stored.notifications.length, 1);
  assert.equal(stored.notifications[0].type, 'appointment_rescheduled');
});

test('Fase 5: reagendamento em etapas via sessão', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const existingAppt = {
    id: 'appt-resched-step',
    date: tomorrow,
    start_time: '09:30',
    duration_minutes: 30,
    service_id: 'svc1',
    service_name: 'Corte',
    barber_id: 'b1',
    barber_name: 'Rafael Barbeiro',
    client_name: 'Guilherme Santos',
    client_phone: '5584999995555',
    status: 'scheduled',
    price: 50,
  };

  const { DB, slug, email } = setupDbWithTenant(t, { appointments: [existingAppt] });
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  // Mensagem 1: Solicita reagendamento sem hora definida
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.resched-step-1',
    from: '5584999995555',
    text: 'preciso remarcar meu horário',
    timestamp: '1726000040',
  });

  assert.equal(calls.length, 1);
  const replyStep1 = JSON.parse(calls[0].init.body).text.body;
  assert.match(replyStep1, /Reagendamento de Horário/i);
  assert.match(replyStep1, /09:30/);

  // Mensagem 2: Informa a nova data e horário
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.resched-step-2',
    from: '5584999995555',
    text: 'amanha 16:30',
    timestamp: '1726000041',
  });

  assert.equal(calls.length, 2);
  const replyStep2 = JSON.parse(calls[1].init.body).text.body;
  assert.match(replyStep2, /reagendado com sucesso/i);
  assert.match(replyStep2, /16:30/);

  const stored = getStoredPayload(DB, email);
  assert.equal(stored.appointments.length, 1);
  assert.equal(stored.appointments[0].start_time, '16:30');
});

test('Fase 5: reagendamento recusa horário ocupado por outro cliente', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const myAppt = {
    id: 'appt-mine',
    date: tomorrow,
    start_time: '10:00',
    duration_minutes: 30,
    service_id: 'svc1',
    service_name: 'Corte',
    barber_id: 'b1',
    barber_name: 'Rafael Barbeiro',
    client_name: 'Meu Nome',
    client_phone: '5584999996666',
    status: 'scheduled',
    price: 50,
  };

  const otherAppt = {
    id: 'appt-other',
    date: tomorrow,
    start_time: '14:00',
    duration_minutes: 30,
    service_id: 'svc1',
    service_name: 'Corte',
    barber_id: 'b1',
    barber_name: 'Rafael Barbeiro',
    client_name: 'Outro Cliente',
    client_phone: '5584999997777',
    status: 'scheduled',
    price: 50,
  };

  const { DB, slug, email } = setupDbWithTenant(t, { appointments: [myAppt, otherAppt] });
  const env = {
    DB,
    WHATSAPP_ACCESS_TOKEN: 'test_token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_DEFAULT_TENANT_SLUG: slug,
  };

  // Tento reagendar para 14:00 (já ocupado por outro cliente)
  await processWhatsAppEvent(env, {
    type: 'message.received',
    phoneNumberId: '123456789',
    messageId: 'wamid.conflict-resched',
    from: '5584999996666',
    text: 'reagendar para amanha às 14:00',
    timestamp: '1726000050',
  });

  assert.equal(calls.length, 1);
  const reply = JSON.parse(calls[0].init.body).text.body;
  assert.match(reply, /não está disponível/i);

  // Meu horário original permanece intacto
  const stored = getStoredPayload(DB, email);
  const me = stored.appointments.find(a => a.id === 'appt-mine');
  assert.equal(me.start_time, '10:00');
});
