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

const productionServices = [
  { id: 'executivo', name: 'Corte Cabelo Executivo', price: 50, duration_minutes: 30, active: true },
  { id: 'barba', name: 'Barba Completa com Toalha Quente', price: 40, duration_minutes: 30, active: true },
  { id: 'combo', name: 'Combo Cabelo + Barba Premium', price: 80, duration_minutes: 60, active: true },
];

test('conversa mantém o dia e entende Corte de cabelo sem repetir as boas-vindas', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB, slug, email } = setupDbWithTenant(t, { services: productionServices });
  const env = { DB, WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_DEFAULT_TENANT_SLUG: slug };
  const from = '5584999990001';
  const send = async (text) => {
    await processWhatsAppEvent(env, {
      type: 'message.received', phoneNumberId: '123', from,
      messageId: `wamid.conversation-${calls.length}`, text, timestamp: '1726000000',
    });
    const body = JSON.parse(calls.at(-1).init.body);
    return body.text?.body ?? body.interactive.body.text;
  };

  assert.match(await send('oi'), /Bem-vindo/);
  assert.match(await send('Agendar'), /Para qual dia/);
  const chooseService = await send('amanhã');
  assert.match(await send('não sei'), /Qual serviço/);
  const serviceSelection = await send('Corte de cabelo');
  assert.match(serviceSelection, /Corte Cabelo Executivo/);
  assert.match(serviceSelection, /adicionar mais algum serviço|Escolher horário/i);
  assert.doesNotMatch(serviceSelection, /Bem-vindo/);
  const chooseTime = await send('1');
  assert.match(chooseTime, /horários livres para \*Corte Cabelo Executivo\*/);
  assert.doesNotMatch(chooseTime, /Bem-vindo/);
  const session = JSON.parse(DB.prepare('SELECT value FROM app_store WHERE key = ?').bind(`wa_session:${from}`).first().value);
  assert.equal(session.serviceId, 'executivo');
  assert.ok(chooseService.includes(session.date.split('-').reverse().join('/')));
  assert.match(await send('não entendi'), /horários livres/);
  assert.match(await send('Rafael Barbeiro'), /horários livres/);
  assert.equal(getStoredPayload(DB, email).appointments.length, 0);
  assert.match(await send('10:00'), /Agendamento confirmado/);
  assert.equal(getStoredPayload(DB, email).appointments[0].service_id, 'executivo');
});

test('nome parcial ambíguo pede o serviço completo sem reservar nem voltar ao início', async (t) => {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const { DB, slug, email } = setupDbWithTenant(t, { services: productionServices });
  const env = { DB, WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_DEFAULT_TENANT_SLUG: slug };
  const send = async (text) => {
    await processWhatsAppEvent(env, {
      type: 'message.received', phoneNumberId: '123', from: '5584999990002',
      messageId: `wamid.ambiguous-${calls.length}`, text, timestamp: '1726000000',
    });
    const body = JSON.parse(calls.at(-1).init.body);
    return body.text?.body ?? body.interactive.body.text;
  };
  await send('Corte Cabelo Executivo amanhã');
  const reply = await send('Barba às 10:00');
  assert.match(reply, /Barba Completa com Toalha Quente/);
  assert.match(reply, /Combo Cabelo \+ Barba Premium/);
  assert.doesNotMatch(reply, /Bem-vindo|Agendamento confirmado/);
  const barbaPrompt = await send('Barba Completa com Toalha Quente');
  assert.match(barbaPrompt, /Barba Completa com Toalha Quente/);
  assert.match(barbaPrompt, /adicionar mais algum serviço|Escolher horário/i);
  const barbaSlots = await send('1');
  assert.match(barbaSlots, /horários livres para \*(?:Corte Cabelo Executivo \+ )?Barba Completa/);
});

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

function conversationHarness(t, options = {}) {
  const calls = withMockedFetch(t, () => new Response('{}', { status: 200 }));
  const fixture = setupDbWithTenant(t, { services: productionServices, ...options });
  const env = { DB: fixture.DB, WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_DEFAULT_TENANT_SLUG: fixture.slug };
  const from = '5584999990003';
  return {
    ...fixture,
    async send(text, interactive) {
      await processWhatsAppEvent(env, {
        type: 'message.received', phoneNumberId: 'tenant-phone', from,
        messageId: `wamid.menu-${calls.length}`, text, interactive, timestamp: '1726000000',
      });
      return JSON.parse(calls.at(-1).init.body);
    },
    session() {
      return JSON.parse(fixture.DB.prepare('SELECT value FROM app_store WHERE key = ?').bind(`wa_session:${from}`).first().value);
    },
  };
}

const menuRows = body => body.interactive.action.sections[0].rows;
const replyText = body => body.text?.body ?? body.interactive.body.text;

test('menu premium aceita números de menu, dia, serviço e horário com contexto', async t => {
  const chat = conversationHarness(t);
  const welcome = await chat.send('menu');
  assert.equal(welcome.interactive.type, 'list');
  assert.equal(menuRows(welcome).length, 4);
  assert.match(replyText(welcome), /\*1 · Agendar um horário\*\n\n\*2/);
  const day = await chat.send('1');
  assert.equal(day.interactive.type, 'button');
  assert.equal(day.interactive.action.buttons.length, 3);
  const services = await chat.send('2');
  assert.ok(menuRows(services)[0].title.length <= 24);
  assert.match(menuRows(services)[0].description, /Corte Cabelo Executivo/);
  assert.match(replyText(services), /\*2 · Barba Completa com Toalha Quente\*\nR\$/);
  const addServicePrompt = await chat.send('2');
  assert.equal(chat.session().serviceId, 'barba');
  assert.equal(addServicePrompt.interactive.type, 'button');
  assert.match(replyText(addServicePrompt), /adicionar mais algum serviço/i);
  const slots = await chat.send('1');
  assert.equal(slots.interactive.type, 'list');
  assert.equal(getStoredPayload(chat.DB, chat.email).appointments.length, 0);
  const selected = chat.session().menu.choices[0].selection;
  const confirmed = await chat.send('1');
  assert.match(replyText(confirmed), /Agendamento confirmado/);
  const appointment = getStoredPayload(chat.DB, chat.email).appointments[0];
  assert.equal(appointment.service_id, 'barba');
  assert.equal(appointment.date, selected.date);
  assert.equal(appointment.barber_id, selected.barberId);
});

test('botões e listas usam ID da opção; cliques antigos e números inválidos não reservam', async t => {
  const chat = conversationHarness(t);
  const welcome = await chat.send('menu');
  const staleId = menuRows(welcome)[0].id;
  const day = await chat.send('', { type: 'list_reply', listId: staleId, listTitle: 'Título ignorado' });
  const tomorrow = day.interactive.action.buttons[1].reply.id;
  const services = await chat.send('', { type: 'button_reply', buttonId: tomorrow, buttonTitle: 'Cancelar' });
  const firstService = menuRows(services)[0].id;
  const slots = await chat.send('', { type: 'list_reply', listId: firstService, listTitle: 'Qualquer texto' });
  assert.equal(chat.session().serviceId, 'executivo');
  const date = chat.session().date;
  assert.match(replyText(await chat.send('99')), /Essa opção não está disponível/);
  assert.equal(chat.session().date, date);
  assert.equal(getStoredPayload(chat.DB, chat.email).appointments.length, 0);
  assert.match(replyText(await chat.send('', { type: 'list_reply', listId: staleId })), /Essa opção não está disponível/);
  const back = await chat.send('menu');
  assert.match(replyText(back), /Bem-vindo/);
  assert.equal(chat.session().serviceId, '');
  assert.equal(chat.session().date, '');
  assert.notEqual(menuRows(back)[0].id, staleId);
  assert.ok(slots.interactive);
});

test('catálogos longos têm paginação e a seleção numérica usa o serviço da página exibida', async t => {
  const services = Array.from({ length: 17 }, (_, i) => ({
    id: `s${i}`, name: `Serviço Especial ${i + 1}`, price: 50, duration_minutes: 30, active: true,
  }));
  const chat = conversationHarness(t, { services });
  const first = await chat.send('Serviços');
  assert.equal(menuRows(first).length, 9);
  const second = await chat.send('9');
  assert.ok(menuRows(second).length <= 10);
  assert.match(replyText(second), /1 · Serviço Especial 9/);
  await chat.send('1');
  assert.equal(chat.session().serviceId, 's8');
  assert.equal(getStoredPayload(chat.DB, chat.email).appointments.length, 0);
});

test('Outra data pede uma data escrita e conserva o serviço escolhido', async t => {
  const chat = conversationHarness(t);
  await chat.send('Serviços');
  await chat.send('1');
  const manualDate = await chat.send('3');
  assert.match(replyText(manualDate), /Escreva o dia e o mês/);
  assert.equal(chat.session().serviceId, 'executivo');
  assert.equal(chat.session().date, '');
  assert.equal(chat.session().menu, undefined);
});

test('fluxo passo a passo permite adicionar múltiplos serviços e soma tempo e valor', async t => {
  const chat = conversationHarness(t);
  await chat.send('menu');
  await chat.send('1');
  await chat.send('2');
  const prompt1 = await chat.send('2');
  assert.match(replyText(prompt1), /Barba Completa com Toalha Quente/);
  assert.match(replyText(prompt1), /adicionar mais algum serviço/i);
  const serviceList2 = await chat.send('2');
  assert.match(replyText(serviceList2), /Adicionar outro serviço/);
  const prompt2 = await chat.send('1');
  assert.match(replyText(prompt2), /Barba Completa com Toalha Quente/);
  assert.match(replyText(prompt2), /Corte Cabelo Executivo/);
  assert.match(replyText(prompt2), /90,00/);
  assert.match(replyText(prompt2), /60 min|1h/);
  const slots = await chat.send('1');
  assert.equal(slots.interactive.type, 'list');
  assert.match(replyText(slots), /horários livres/);
  assert.match(replyText(slots), /60 min/);
  const confirmed = await chat.send('1');
  assert.match(replyText(confirmed), /Agendamento confirmado/);
  assert.match(replyText(confirmed), /Barba Completa com Toalha Quente \+ Corte Cabelo Executivo/);
  assert.match(replyText(confirmed), /90,00/);
  assert.match(replyText(confirmed), /60 min/);
  const appt = getStoredPayload(chat.DB, chat.email).appointments[0];
  assert.equal(appt.price, 90);
  assert.equal(appt.duration_minutes, 60);
  assert.equal(appt.services.length, 2);
});
