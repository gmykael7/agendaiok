import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ stdin: { contents: "export * from './src/utils/campaigns'; export { applyWhatsAppTemplate } from './src/utils/whatsapp';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const { selectCampaignClients, applyWhatsAppTemplate } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const now = new Date(2026, 8, 16, 12);
const org = { name: 'Barbearia', crm_inactive_days: 30, subscription_plans: [{ id: 'plan', name: 'Mensal', active: true }, { id: 'off', active: false }] };
const client = (id, extra = {}) => ({ id, name: 'Cliente', phone: `8499999000${id}`, ...extra });
const visit = (customer, date, extra = {}) => ({ client_name: customer.name, client_phone: customer.phone, date, start_time: '14:00', status: 'completed', service_name: 'Corte', ...extra });
const select = (clients, visits, audience, settings = org) => selectCampaignClients(clients, visits, settings, audience, now).map(c => c.id);

test('Todos inclui não assinantes e exclui arquivados e números inválidos', () => {
  assert.deepEqual(select([client('1'), client('2', { subscription_plan_id: 'plan' }), client('3', { archived: true }), client('4', { phone: '123' }), client('5', { phone: 'Não informado' })], [], 'all'), ['1', '2']);
});
test('Assinantes exige vínculo com plano existente e ativo', () => {
  assert.deepEqual(select([client('1'), client('2', { subscription_plan_id: 'plan' }), client('3', { subscription_plan_id: 'off' }), client('4', { subscription_plan_id: 'missing' })], [], 'subscribers'), ['2']);
});
test('Inativos usa última visita concluída e respeita limite configurado', () => {
  const a = client('1'), b = client('2'), c = client('3');
  const visits = [visit(a, '2026-08-17'), visit(b, '2026-08-18'), visit(c, '2026-07-01'), visit(c, '2026-09-10')];
  assert.deepEqual(select([a, b, c], visits, 'inactive'), ['1']);
  assert.deepEqual(select([a, b, c], visits, 'inactive', { ...org, crm_inactive_days: 45 }), []);
});
test('Sem histórico, homônimos e clientes com retorno marcado não entram em inativos', () => {
  const a = client('1'), b = client('2');
  assert.deepEqual(select([a], [visit(b, '2026-07-01')], 'inactive'), []);
  assert.deepEqual(select([a], [visit(a, '2026-07-01'), visit(a, '2026-09-17', { status: 'scheduled' })], 'inactive'), []);
  assert.deepEqual(select([a], [visit(a, '2026-07-01', { status: 'canceled' })], 'inactive'), []);
});
test('Pai & Filho exige expressão explícita ou serviço concluído correspondente', () => {
  const a = client('1', { notes: 'Gosta de paisagens' }), b = client('2', { notes: 'Pai e Filho' }), c = client('3');
  assert.deepEqual(select([a, b, c], [visit(c, '2026-09-10', { service_name: 'Combo Pai & Filho' })], 'father-son'), ['2', '3']);
});
test('Personalização mantém símbolos do nome literalmente', () => {
  assert.equal(applyWhatsAppTemplate('Olá {cliente}, {barbearia}!', { cliente: '$& João', barbearia: 'A&B' }), 'Olá $& João, A&B!');
});
