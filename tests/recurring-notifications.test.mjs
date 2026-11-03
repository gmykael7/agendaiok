import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  stdin: {
    contents: "export * from './src/utils/recurringNotifications';",
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
  formatDateBR,
  normalizePhoneToInternational,
  addDaysToDate,
  calculateNextRecurringDate,
  buildWhatsAppLink,
  buildWhatsAppShareLink,
  formatCancelWeekBarberMessage,
  formatCancelWeekClientMessage,
  formatRescheduleWeekBarberMessage,
  formatRescheduleWeekClientMessage,
  formatWelcomeRecurringClientMessage,
  formatBroadcastFreedSlotMessage,
} = await import(moduleUrl);

test('Notificações de Clientes Fixos: formatação de datas e telefones BR', () => {
  assert.equal(formatDateBR('2026-11-06'), '06/11/2026');
  assert.equal(formatDateBR('2026-11-06T14:00:00Z'), '06/11/2026');
  assert.equal(formatDateBR('2026-11-06 14:00'), '06/11/2026');

  assert.equal(normalizePhoneToInternational('84999990001'), '5584999990001');
  assert.equal(normalizePhoneToInternational('(84) 99999-0001'), '5584999990001');
  assert.equal(normalizePhoneToInternational('5584999990001'), '5584999990001');
  assert.equal(normalizePhoneToInternational('084999990001'), '5584999990001');

  assert.equal(addDaysToDate('2026-11-06', 7), '2026-11-13');
  assert.equal(addDaysToDate('2026-11-06', 14), '2026-11-20');

  assert.equal(calculateNextRecurringDate('2026-11-06', 'WEEKLY'), '13/11/2026');
  assert.equal(calculateNextRecurringDate('2026-11-06', 'BIWEEKLY'), '20/11/2026');
});

test('Notificações de Clientes Fixos: links oficiais de WhatsApp wa.me', () => {
  const link = buildWhatsAppLink('84999990001', 'Olá, teste!');
  assert.equal(link.startsWith('https://wa.me/5584999990001?text='), true);
  assert.equal(link.includes(encodeURIComponent('Olá, teste!')), true);

  const shareLink = buildWhatsAppShareLink('🔥 VAGA LIBERADA!');
  assert.equal(shareLink.startsWith('https://wa.me/?text='), true);
  assert.equal(shareLink.includes(encodeURIComponent('🔥 VAGA LIBERADA!')), true);
});

test('Cenário 1: Mensagens de cancelamento da semana (Barbeiro e Cliente)', () => {
  // 1.1 Barbeiro
  const barberMsg = formatCancelWeekBarberMessage({
    professional_name: 'Gabriel Santos',
    client_name: 'Carlos Silva',
    client_phone: '(84) 99999-0001',
    original_date: '2026-11-06',
    original_time: '14:00',
    service_name: 'Corte Cabelo Executivo',
    cancellation_feedback: 'Imprevisto de trabalho',
  });

  assert.equal(barberMsg.includes('⚠️ *HORÁRIO FIXO LIBERADO NA AGENDA*'), true);
  assert.equal(barberMsg.includes('*Gabriel Santos*'), true);
  assert.equal(barberMsg.includes('*Carlos Silva*'), true);
  assert.equal(barberMsg.includes('06/11/2026 às 14:00'), true);
  assert.equal(barberMsg.includes('Corte Cabelo Executivo'), true);
  assert.equal(barberMsg.includes('"Imprevisto de trabalho"'), true);
  assert.equal(barberMsg.includes('Esse horário já foi aberto novamente na sua página pública'), true);

  // 1.2 Cliente
  const clientMsg = formatCancelWeekClientMessage({
    client_name: 'Carlos Silva',
    barbershop_name: 'Barbearia Vintage',
    original_date: '2026-11-06',
    original_time: '14:00',
    frequency_label: 'Semanal',
    next_recurring_date: '13/11/2026',
  });

  assert.equal(clientMsg.includes('Olá, *Carlos Silva*! Recebemos o seu aviso na *Barbearia Vintage*. 👍'), true);
  assert.equal(clientMsg.includes('06/11/2026 às 14:00* foi cancelado apenas para esta semana'), true);
  assert.equal(clientMsg.includes('Cliente Fixo (Semanal)* continua 100% ativo'), true);
  assert.equal(clientMsg.includes('13/11/2026 às 14:00*'), true);
});

test('Cenário 2: Mensagens de remarcação na agenda aberta (Barbeiro e Cliente)', () => {
  // 2.1 Barbeiro
  const barberMsg = formatRescheduleWeekBarberMessage({
    professional_name: 'Gabriel Santos',
    client_name: 'Carlos Silva',
    client_phone: '(84) 99999-0001',
    original_date: '2026-11-06',
    original_time: '14:00',
    new_date: '2026-11-07',
    new_time: '10:00',
    service_name: 'Corte Cabelo Executivo',
    cancellation_feedback: 'Dentista na sexta',
  });

  assert.equal(barberMsg.includes('🔄 *TROCA DE HORÁRIO (CLIENTE FIXO)*'), true);
  assert.equal(barberMsg.includes('*Gabriel Santos*'), true);
  assert.equal(barberMsg.includes('*Carlos Silva*'), true);
  assert.equal(barberMsg.includes('06/11/2026 às 14:00 *(Já aberto na página pública)*'), true);
  assert.equal(barberMsg.includes('07/11/2026 às 10:00'), true);
  assert.equal(barberMsg.includes('"Dentista na sexta"'), true);

  // 2.2 Cliente
  const clientMsg = formatRescheduleWeekClientMessage({
    client_name: 'Carlos Silva',
    barbershop_name: 'Barbearia Vintage',
    new_date: '2026-11-07',
    new_time: '10:00',
    professional_name: 'Gabriel Santos',
    service_name: 'Corte Cabelo Executivo',
    day_of_week_label: 'Sexta-feira',
    original_time: '14:00',
  });

  assert.equal(clientMsg.includes('Tudo certo, *Carlos Silva*! Sua troca de horário desta semana na *Barbearia Vintage* foi confirmada.'), true);
  assert.equal(clientMsg.includes('07/11/2026 às 10:00'), true);
  assert.equal(clientMsg.includes('Gabriel Santos'), true);
  assert.equal(clientMsg.includes('(*Sexta-feira às 14:00*)'), true);
});

test('Cenário 3: Mensagem de Boas-Vindas ao novo Cliente Fixo', () => {
  const welcomeMsg = formatWelcomeRecurringClientMessage({
    client_name: 'Marcos Souza',
    barbershop_name: 'Barbearia Vintage',
    frequency_label: 'Quinzenal',
    day_of_week_label: 'Sexta-feira',
    start_time: '15:00',
    professional_name: 'Gabriel Santos',
    service_name: 'Corte + Barba',
    first_date: '2026-11-06',
    public_page_url: 'https://meuagendai.fun/agendar/barbearia-vintage',
  });

  assert.equal(welcomeMsg.includes('🎉 *VOCÊ AGORA É CLIENTE FIXO NA Barbearia Vintage!*'), true);
  assert.equal(welcomeMsg.includes('Olá, *Marcos Souza*! Seu horário fixo foi configurado com sucesso:'), true);
  assert.equal(welcomeMsg.includes('Quinzenal (Toda Sexta-feira às 15:00)'), true);
  assert.equal(welcomeMsg.includes('Gabriel Santos'), true);
  assert.equal(welcomeMsg.includes('06/11/2026 às 15:00'), true);
  assert.equal(welcomeMsg.includes('https://meuagendai.fun/agendar/barbearia-vintage'), true);
});

test('Recurso Extra: Divulgar Vaga Liberada no WhatsApp / Status', () => {
  const broadcastMsg = formatBroadcastFreedSlotMessage({
    original_date: '2026-11-06',
    original_time: '14:00',
    professional_name: 'Gabriel Santos',
    barbershop_name: 'Barbearia Vintage',
    public_page_url: 'https://meuagendai.fun/agendar/barbearia-vintage',
  });

  assert.equal(broadcastMsg.includes('🔥 *VAGA DE ÚLTIMA HORA LIBERADA!*'), true);
  assert.equal(broadcastMsg.includes('06/11/2026 às 14:00'), true);
  assert.equal(broadcastMsg.includes('*Gabriel Santos*'), true);
  assert.equal(broadcastMsg.includes('*Barbearia Vintage*'), true);
  assert.equal(broadcastMsg.includes('Garanta agora antes que preencha: https://meuagendai.fun/agendar/barbearia-vintage'), true);
});
