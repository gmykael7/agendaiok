import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({
  stdin: { contents: "export * from './src/utils/cloudReconciliation';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const helpers = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);

const basePayload = () => ({
  org: { id: 'org', email: 'teste@agendai.invalid', slug: 'teste', name: 'Barbearia', phone: '', primary_color: '#10b981' },
  savedOrgs: [],
  services: [{ id: 'service-a', name: 'Corte', price: 40, duration_minutes: 30, category: 'Cabelo', active: true }],
  barbers: [],
  appointments: [{ id: 'appointment-a', client_name: 'Ana', client_phone: '84999999999', service_name: 'Corte', barber_id: 'barber-a', barber_name: 'João', start_time: '10:00', price: 40, status: 'scheduled' }],
  clients: [],
  notifications: [],
  products: [],
  productSales: [],
  updated_at: '2026-09-07T10:00:00.000Z',
});

test('concilia automaticamente alterações independentes de aparelhos diferentes', () => {
  const base = basePayload();
  const local = structuredClone(base);
  local.org.name = 'Novo nome';
  local.appointments[0].status = 'confirmed';

  const remote = structuredClone(base);
  remote.updated_at = '2026-09-07T10:01:00.000Z';
  remote.appointments.push({ id: 'appointment-b', client_name: 'Bia', client_phone: '84988888888', service_name: 'Corte', barber_id: 'barber-a', barber_name: 'João', start_time: '11:00', price: 40, status: 'scheduled' });

  const result = helpers.reconcileCloudPayload(base, local, remote, 'local');
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.payload.org.name, 'Novo nome');
  assert.equal(result.payload.appointments.find(item => item.id === 'appointment-a').status, 'confirmed');
  assert.ok(result.payload.appointments.some(item => item.id === 'appointment-b'));
  assert.equal(result.payload.updated_at, remote.updated_at);
});

test('detecta a edição do mesmo campo e respeita a escolha do usuário', () => {
  const base = basePayload();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.appointments[0].status = 'confirmed';
  remote.appointments[0].status = 'canceled';
  remote.updated_at = '2026-09-07T10:01:00.000Z';

  const keepLocal = helpers.reconcileCloudPayload(base, local, remote, 'local');
  const keepRemote = helpers.reconcileCloudPayload(base, local, remote, 'remote');
  assert.deepEqual(keepLocal.conflicts, ['appointments.appointment-a.status']);
  assert.equal(keepLocal.payload.appointments[0].status, 'confirmed');
  assert.equal(keepRemote.payload.appointments[0].status, 'canceled');
});

test('preserva uma exclusão local e uma inclusão remota feitas em itens diferentes', () => {
  const base = basePayload();
  const local = structuredClone(base);
  local.services = [];
  const remote = structuredClone(base);
  remote.services.push({ id: 'service-b', name: 'Barba', price: 30, duration_minutes: 20, category: 'Barba', active: true });
  remote.updated_at = '2026-09-07T10:01:00.000Z';

  const result = helpers.reconcileCloudPayload(base, local, remote, 'local');
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.payload.services.map(item => item.id), ['service-b']);
});
