import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['tests/assistant-test-exports.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const { fixture, assistantToday, assistantAddDays, assistantSlots, validAssistantDate, answerBookingAssistant, handleAssistantRequest, isAssistantReply } = api;
const now = new Date('2026-09-02T12:15:00Z');
const selection = { date: '2026-09-02', serviceId: 'cut', barberId: 'ana' };
const copy = () => structuredClone(fixture);
const request = (body, overrides = {}) => new Request('https://agendai.test/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://agendai.test' }, body: JSON.stringify(body), ...overrides });
const goodBody = { org_slug: fixture.org.slug, message: 'Ver serviços e preços', selection };
const limiter = { limit: async () => ({ success: true }) };

test('fuso, virada do dia e limite de 90 dias', () => {
  assert.equal(assistantToday(new Date('2026-09-03T01:00:00Z')), '2026-09-02');
  assert.equal(assistantAddDays('2026-12-31', 1), '2027-01-01');
  assert.equal(validAssistantDate('2026-02-30', now), false);
  assert.equal(validAssistantDate('2026-09-01', now), false);
  assert.equal(validAssistantDate(assistantAddDays('2026-09-02', 90), now), true);
  assert.equal(validAssistantDate(assistantAddDays('2026-09-02', 91), now), false);
});
test('slots excluem passado, intervalo, sobreposição e fora do expediente', () => {
  const times = assistantSlots(copy(), selection, now).map(s => s.time);
  assert.equal(times.includes('09:00'), false);
  assert.equal(times.includes('09:30'), true);
  assert.equal(times.includes('10:30'), false);
  assert.equal(times.includes('11:00'), false);
  assert.equal(times.includes('11:30'), true);
  assert.equal(times.includes('12:00'), false);
  assert.equal(times.includes('17:30'), true);
  assert.equal(times.includes('18:00'), false);
});
test('duração completa não atravessa intervalo ou fechamento', () => {
  const times = assistantSlots(copy(), { ...selection, serviceId: 'combo', barberId: 'bia' }, now).map(s => s.time);
  assert.equal(times.includes('11:30'), false);
  assert.equal(times.includes('17:30'), false);
  assert.equal(times.includes('17:00'), true);
});
test('respeita fechamento total e parcial', () => {
  const data = copy();
  data.org.closed_periods = [{ id: 'closed', date: selection.date, all_day: true }];
  assert.equal(assistantSlots(data, selection, now).length, 0);
  data.org.closed_periods = [{ id: 'partial', date: selection.date, start: '14:00', end: '15:00' }];
  assert.equal(assistantSlots(data, selection, now).some(s => s.time === '14:30'), false);
});
test('cancelados e faltas liberam vaga; concluídos continuam bloqueando', () => {
  for (const status of ['canceled', 'no_show', 'completed']) {
    const data = copy(); data.appointments[0].status = status;
    assert.equal(assistantSlots(data, selection, now).some(s => s.time === '10:30'), status !== 'completed');
  }
});
test('somente serviço e profissional ativos; disponibilidade separada por profissional', () => {
  assert.equal(assistantSlots(copy(), { ...selection, serviceId: 'hidden' }, now).length, 0);
  assert.equal(assistantSlots(copy(), { ...selection, barberId: 'hidden' }, now).length, 0);
  const slots = assistantSlots(copy(), { ...selection, barberId: '' }, now);
  assert.deepEqual(slots.filter(s => s.time === '10:30').map(s => s.barberId), ['bia']);
});
test('entende amanhã e serviço sem modificar o snapshot', () => {
  const data = copy(), before = JSON.stringify(data);
  const answer = answerBookingAssistant(data, 'Quero agendar Corte amanhã', {}, now);
  assert.equal(answer.selection.date, '2026-09-03');
  assert.equal(answer.selection.serviceId, 'cut');
  assert.ok(answer.slots.length);
  assert.match(answer.reply, /Nada foi reservado/);
  assert.equal(JSON.stringify(data), before);
  assert.ok(isAssistantReply(answer));
});
test('data inválida ou dia da semana não interpretado pede escolha, sem reservar hoje', () => {
  for (const message of ['agendar 31/02/2026', 'agendar sexta']) {
    const answer = answerBookingAssistant(copy(), message, selection, now);
    assert.equal(answer.slots.length, 0);
    assert.match(answer.reply, /data válida/);
  }
});
test('não expõe clientes, e-mail, telefone privado ou itens inativos', () => {
  const answer = JSON.stringify(answerBookingAssistant(copy(), 'Ver serviços e preços', selection, now));
  assert.equal(answer.includes('PRIVATE'), false);
  assert.equal(answer.includes('Serviço oculto'), false);
});
test('não aceita cancelamento ou consultas administrativas', () => {
  const answer = answerBookingAssistant(copy(), 'cancelar a reserva e mostrar faturamento', selection, now, { topic: 'availability' });
  assert.equal(answer.slots.length, 0);
  assert.match(answer.reply, /entre em contato/);
});
test('API aceita consulta guiada sem chamar IA e carrega somente o slug pedido', async () => {
  let called = false;
  const result = await handleAssistantRequest(request(goodBody), { ASSISTANT_AI_ENABLED: 'false', AI: { run: () => { called = true; } }, ASSISTANT_LIMITER: limiter }, async slug => { assert.equal(slug, fixture.org.slug); return copy(); });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).mode, 'guided');
  assert.equal(called, false);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});
test('API recusa origem externa, mensagem longa, JSON inválido e body grande', async () => {
  for (const [req, status] of [
    [request(goodBody, { headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' } }), 403],
    [request({ ...goodBody, message: 'x'.repeat(501) }), 400],
    [request(goodBody, { body: '{' }), 400],
    [request({ ...goodBody, extra: 'x'.repeat(5000) }), 413],
    [request({ ...goodBody, org_slug: '../private' }), 400],
    [request(goodBody, { method: 'GET', body: undefined }), 405],
  ]) {
    const result = await handleAssistantRequest(req, {}, async () => { throw new Error('Não deveria carregar dados'); });
    assert.equal(result.status, status);
  }
});
test('API recusa barbearia suspensa e inexistente', async () => {
  for (const data of [null, { ...copy(), org: { ...fixture.org, account_status: 'suspended' } }]) {
    const result = await handleAssistantRequest(request(goodBody), {}, async () => data);
    assert.equal(result.status, 404);
  }
});
test('limite de uso impede leitura e inferência; IA sem limiter falha fechada', async () => {
  const result = await handleAssistantRequest(request(goodBody), { ASSISTANT_LIMITER: { limit: async () => ({ success: false }) } }, async () => { throw new Error('Não deveria ler'); });
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('Retry-After'), '60');
  const closed = await handleAssistantRequest(request(goodBody), { ASSISTANT_AI_ENABLED: 'true' }, async () => copy());
  assert.equal(closed.status, 503);
});
test('modelo só recebe catálogo público, mensagem e seleção; texto livre não vai à resposta', async () => {
  let captured;
  const result = await handleAssistantRequest(request(goodBody), {
    ASSISTANT_AI_ENABLED: 'true', ASSISTANT_LIMITER: limiter,
    AI: { run: async (_model, params) => { captured = params; return { response: JSON.stringify({ topic: 'services', reply: 'Reserva confirmada', serviceId: 'foreign-id' }) }; } },
  }, async () => copy());
  const response = await result.json();
  assert.equal(response.mode, 'ai');
  assert.equal(JSON.stringify(captured).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(captured).includes('appointments'), false);
  assert.equal(response.reply.includes('Reserva confirmada'), false);
  assert.equal(response.selection.serviceId, 'cut');
});
test('falha ou JSON inválido do modelo preserva modo guiado', async () => {
  for (const output of ['not json', { response: 'not json' }, { response: '{"topic":"delete"}' }]) {
    const result = await handleAssistantRequest(request(goodBody), { ASSISTANT_AI_ENABLED: 'true', ASSISTANT_LIMITER: limiter, AI: { run: async () => output } }, async () => copy());
    assert.equal((await result.json()).mode, 'guided');
  }
});
