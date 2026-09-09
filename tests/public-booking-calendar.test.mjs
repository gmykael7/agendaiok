import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  stdin: {
    contents: "export * from './src/utils/publicBookingAvailability';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { getPublicBookingDateStatus } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

const org = {
  id: 'demo', name: 'Demo', slug: 'demo', phone: '84999999999', primary_color: '#10b981',
  open_hour: '08:00', close_hour: '09:00', closed_periods: [],
};
const services = [{ id: 'cut', name: 'Corte', price: 40, duration_minutes: 30, active: true }];
const barbers = [{ id: 'barber', full_name: 'Profissional', role: 'Barbeiro', active: true }];
const now = new Date('2026-10-01T07:00:00');

const status = (overrides = {}) => getPublicBookingDateStatus({
  org, services, barbers, appointments: [], dateStr: '2026-10-08', now, ...overrides,
});

test('calendário diferencia dia em que a barbearia não atende', () => {
  assert.equal(status({ org: { ...org, closed_periods: [{ id: 'closed', date: '2026-10-08', all_day: true }] } }), 'closed');
});

test('calendário marca sem horário somente quando todos os profissionais estão ocupados', () => {
  const appointments = [
    { id: 'a', date: '2026-10-08', start_time: '08:00', duration_minutes: 30, barber_id: 'barber', status: 'confirmed' },
    { id: 'b', date: '2026-10-08', start_time: '08:30', duration_minutes: 30, barber_id: 'barber', status: 'scheduled' },
  ];
  assert.equal(status({ appointments }), 'unavailable');
  assert.equal(status({ appointments: [...appointments, { ...appointments[0], id: 'c', barber_id: 'second' }], barbers: [...barbers, { ...barbers[0], id: 'second' }] }), 'available');
});

test('cancelamento ou falta devolvem o dia à disponibilidade', () => {
  const appointments = [
    { id: 'a', date: '2026-10-08', start_time: '08:00', duration_minutes: 30, barber_id: 'barber', status: 'canceled' },
    { id: 'b', date: '2026-10-08', start_time: '08:30', duration_minutes: 30, barber_id: 'barber', status: 'no_show' },
  ];
  assert.equal(status({ appointments }), 'available');
});
