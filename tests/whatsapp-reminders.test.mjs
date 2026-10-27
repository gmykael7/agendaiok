import { test } from 'node:test';
import assert from 'node:assert/strict';

function isWithinReminderWindow(startTimeStr, currentMinutes) {
  const [h, m] = startTimeStr.split(':').map(Number);
  const startMinutes = (h || 0) * 60 + (m || 0);
  const diffMinutes = startMinutes - currentMinutes;
  return diffMinutes >= 15 && diffMinutes <= 150;
}

function formatReminderMessage(template, appointment, orgName) {
  const dateFormatted = appointment.date ? appointment.date.split('-').reverse().join('/') : '';
  const priceFormatted = Number(appointment.price || 0).toFixed(2);
  let reminderBody = template || `Olá, *{cliente}*! 👋
Lembramos do seu agendamento na *{barbearia}*:
📅 *Data:* {data} às *{horario}*
✂️ *Serviço:* {servico}
💰 *Valor:* R$ {valor}

Responda *CONFIRMAR* para confirmar sua presença ou *CANCELAR* para liberar o horário.`;

  reminderBody = reminderBody
    .replace(/{cliente}/g, appointment.client_name)
    .replace(/{barbearia}/g, orgName)
    .replace(/{data}/g, dateFormatted)
    .replace(/{horario}/g, appointment.start_time)
    .replace(/{servico}/g, appointment.service_name || 'Atendimento')
    .replace(/{valor}/g, priceFormatted);

  return reminderBody;
}

test('janela de lembrete WhatsApp anti no-show (15min a 150min)', () => {
  // Simula 10:00 (600 minutos)
  const currentMinutes = 10 * 60; // 600

  // 12:00 -> 120 min de antecedência (dentro da janela de ~2h)
  assert.equal(isWithinReminderWindow('12:00', currentMinutes), true);

  // 10:30 -> 30 min de antecedência (dentro da janela)
  assert.equal(isWithinReminderWindow('10:30', currentMinutes), true);

  // 12:30 -> 150 min de antecedência (limite superior da janela)
  assert.equal(isWithinReminderWindow('12:30', currentMinutes), true);

  // 10:10 -> 10 min de antecedência (muito em cima da hora, ignorado)
  assert.equal(isWithinReminderWindow('10:10', currentMinutes), false);

  // 13:00 -> 180 min de antecedência (mais de 2h30, cedo demais)
  assert.equal(isWithinReminderWindow('13:00', currentMinutes), false);

  // 09:30 -> horário que já passou
  assert.equal(isWithinReminderWindow('09:30', currentMinutes), false);
});

test('idempotência do envio de lembrete (não envia duplicado)', () => {
  const app1 = {
    id: 'app-1',
    start_time: '12:00',
    date: '2026-10-26',
    status: 'scheduled',
    reminder_sent_at: '2026-10-26T10:05:00Z',
  };

  const app2 = {
    id: 'app-2',
    start_time: '12:00',
    date: '2026-10-26',
    status: 'scheduled',
  };

  const shouldSend = (app) => {
    if (app.reminder_sent_at) return false;
    return app.status === 'scheduled' || app.status === 'confirmed';
  };

  assert.equal(shouldSend(app1), false, 'Não deve reenviar para quem já recebeu reminder_sent_at');
  assert.equal(shouldSend(app2), true, 'Deve enviar para quem ainda não recebeu');
});

test('interpolação dinâmica de variáveis no lembrete', () => {
  const app = {
    id: 'app-123',
    client_name: 'Carlos Oliveira',
    start_time: '14:30',
    date: '2026-10-26',
    service_name: 'Corte Degradê + Barboterapia',
    price: 65,
  };

  const msg = formatReminderMessage(null, app, 'Barbearia Retrô');

  assert.ok(msg.includes('Carlos Oliveira'));
  assert.ok(msg.includes('Barbearia Retrô'));
  assert.ok(msg.includes('26/10/2026'));
  assert.ok(msg.includes('14:30'));
  assert.ok(msg.includes('Corte Degradê + Barboterapia'));
  assert.ok(msg.includes('65.00'));
  assert.ok(msg.includes('CONFIRMAR'));
  assert.ok(msg.includes('CANCELAR'));
});
