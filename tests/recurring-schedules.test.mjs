import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  stdin: {
    contents: "export * from './src/utils/recurringSchedules';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`;
const {
  isDateOccurrenceOfRecurring,
  getNextOccurrences,
  isRecurringSlotOccupied,
  hasRecurringConflict,
  getDayOfWeekFromDate,
  getDayOfWeekLabel,
  getFrequencyLabel,
} = await import(moduleUrl);

test('Clientes Fixos: cálculo de ocorrências semanais (WEEKLY)', () => {
  const schedule = {
    id: 'rec-1',
    tenant_id: 'org-test',
    client_name: 'Carlos Silva',
    client_phone: '84999990001',
    professional_id: 'barber-1',
    service_id: 'srv-1',
    day_of_week: 5, // Sexta
    start_time: '14:00',
    frequency: 'WEEKLY',
    anchor_date: '2026-11-06',
    status: 'ACTIVE',
  };

  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-06'), true);
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-13'), true);
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-20'), true);
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-07'), false);
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-10-30'), false);
});

test('Clientes Fixos: cálculo de ocorrências quinzenais (BIWEEKLY)', () => {
  const schedule = {
    id: 'rec-2',
    tenant_id: 'org-test',
    client_name: 'Marcos Souza',
    client_phone: '84999990002',
    professional_id: 'barber-1',
    service_id: 'srv-1',
    day_of_week: 5, // Sexta
    start_time: '15:00',
    frequency: 'BIWEEKLY',
    anchor_date: '2026-11-06',
    status: 'ACTIVE',
  };

  // Semana 0 (2026-11-06): diffWeeks = 0 (par) -> ATENDIMENTO
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-06'), true);
  // Semana 1 (2026-11-13): diffWeeks = 1 (ímpar) -> LIVRE
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-13'), false);
  // Semana 2 (2026-11-20): diffWeeks = 2 (par) -> ATENDIMENTO
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-20'), true);
  // Semana 3 (2026-11-27): diffWeeks = 3 (ímpar) -> LIVRE
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-11-27'), false);
  // Semana 4 (2026-12-04): diffWeeks = 4 (par) -> ATENDIMENTO
  assert.equal(isDateOccurrenceOfRecurring(schedule, '2026-12-04'), true);
});

test('Clientes Fixos: cancelamento pontual da semana libera o horário original', () => {
  const schedule = {
    id: 'rec-1',
    tenant_id: 'org-test',
    client_name: 'Carlos Silva',
    client_phone: '84999990001',
    professional_id: 'barber-1',
    service_id: 'srv-1',
    day_of_week: 5,
    start_time: '14:00',
    frequency: 'WEEKLY',
    anchor_date: '2026-11-06',
    status: 'ACTIVE',
  };

  const services = [{ id: 'srv-1', name: 'Corte', duration_minutes: 30, price: 40, active: true, category: 'Cabelo' }];

  // Sem cancelamento: o horário está ocupado
  const occupiedNormal = isRecurringSlotOccupied('14:00', 30, 'barber-1', '2026-11-06', [schedule], [], services);
  assert.equal(occupiedNormal, true);

  // Com cancelamento registrado apenas para 2026-11-06
  const cancellationAppt = {
    id: 'rec-cancel-rec-1-2026-11-06',
    recurring_id: 'rec-1',
    date: '2026-11-06',
    start_time: '14:00',
    barber_id: 'barber-1',
    status: 'canceled',
    cancellation_feedback: 'Imprevisto de trabalho',
  };

  // No dia cancelado, o horário fica LIVRE (false)
  const occupiedCanceled = isRecurringSlotOccupied('14:00', 30, 'barber-1', '2026-11-06', [schedule], [cancellationAppt], services);
  assert.equal(occupiedCanceled, false);

  // Na sexta-feira seguinte (2026-11-13), o horário continua OCUPADO (true)
  const occupiedNextWeek = isRecurringSlotOccupied('14:00', 30, 'barber-1', '2026-11-13', [schedule], [cancellationAppt], services);
  assert.equal(occupiedNextWeek, true);
});

test('Clientes Fixos: remarcação na semana libera o horário original e ocupa o novo', () => {
  const schedule = {
    id: 'rec-1',
    tenant_id: 'org-test',
    client_name: 'Carlos Silva',
    client_phone: '84999990001',
    professional_id: 'barber-1',
    service_id: 'srv-1',
    day_of_week: 5,
    start_time: '14:00',
    frequency: 'WEEKLY',
    anchor_date: '2026-11-06',
    status: 'ACTIVE',
  };

  const services = [{ id: 'srv-1', name: 'Corte', duration_minutes: 30, price: 40, active: true, category: 'Cabelo' }];

  const rescheduledAppt = {
    id: 'rec-resched-rec-1-2026-11-06',
    recurring_id: 'rec-1',
    is_rescheduled: 1,
    original_date: '2026-11-06 14:00',
    date: '2026-11-07',
    start_time: '10:00',
    barber_id: 'barber-1',
    status: 'scheduled',
    cancellation_feedback: 'Dentista na sexta',
  };

  // Na sexta 2026-11-06 às 14:00, o horário original fica LIVRE (false)
  const origFreed = isRecurringSlotOccupied('14:00', 30, 'barber-1', '2026-11-06', [schedule], [rescheduledAppt], services);
  assert.equal(origFreed, false);

  // Próximas ocorrências identificam a remarcação
  const occurrences = getNextOccurrences(schedule, 3, [rescheduledAppt], '2026-11-06');
  assert.equal(occurrences.length, 3);
  assert.equal(occurrences[0].status, 'rescheduled');
  assert.equal(occurrences[0].date, '2026-11-07');
  assert.equal(occurrences[0].start_time, '10:00');
  assert.equal(occurrences[0].cancellation_feedback, 'Dentista na sexta');

  // Próxima semana volta ao normal (scheduled em 2026-11-13 às 14:00)
  assert.equal(occurrences[1].status, 'scheduled');
  assert.equal(occurrences[1].date, '2026-11-13');
  assert.equal(occurrences[1].start_time, '14:00');
});

test('Clientes Fixos: detecção de conflitos para nova recorrência', () => {
  const existing = [
    {
      id: 'rec-1',
      tenant_id: 'org-test',
      client_name: 'Carlos Silva',
      client_phone: '84999990001',
      professional_id: 'barber-1',
      service_id: 'srv-1',
      day_of_week: 5,
      start_time: '14:00',
      frequency: 'WEEKLY',
      anchor_date: '2026-11-06',
      status: 'ACTIVE',
    },
  ];

  const services = [{ id: 'srv-1', name: 'Corte', duration_minutes: 30, price: 40, active: true, category: 'Cabelo' }];

  const conflicting = {
    tenant_id: 'org-test',
    client_name: 'Novo Cliente',
    client_phone: '84999990009',
    professional_id: 'barber-1',
    service_id: 'srv-1',
    day_of_week: 5,
    start_time: '14:00',
    frequency: 'WEEKLY',
    anchor_date: '2026-11-06',
    status: 'ACTIVE',
  };

  const check1 = hasRecurringConflict(conflicting, existing, [], services);
  assert.equal(check1.hasConflict, true);

  const noConflict = {
    ...conflicting,
    day_of_week: 4,
  };
  const check2 = hasRecurringConflict(noConflict, existing, [], services);
  assert.equal(check2.hasConflict, false);
});
