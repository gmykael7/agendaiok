import { RecurringFrequency } from '../types';
import { getDayOfWeekLabel, getFrequencyLabel } from './recurringSchedules';

export interface CancelWeekBarberNotificationData {
  professional_name: string;
  client_name: string;
  client_phone: string;
  original_date: string;
  original_time: string;
  service_name: string;
  cancellation_feedback: string;
}

export interface CancelWeekClientNotificationData {
  client_name: string;
  barbershop_name: string;
  original_date: string;
  original_time: string;
  frequency_label: string;
  next_recurring_date: string;
}

export interface RescheduleWeekBarberNotificationData {
  professional_name: string;
  client_name: string;
  client_phone: string;
  original_date: string;
  original_time: string;
  new_date: string;
  new_time: string;
  service_name: string;
  cancellation_feedback: string;
}

export interface RescheduleWeekClientNotificationData {
  client_name: string;
  barbershop_name: string;
  new_date: string;
  new_time: string;
  professional_name: string;
  service_name: string;
  day_of_week_label: string;
  original_time: string;
}

export interface WelcomeRecurringClientNotificationData {
  client_name: string;
  barbershop_name: string;
  frequency_label: string;
  day_of_week_label: string;
  start_time: string;
  professional_name: string;
  service_name: string;
  first_date: string;
  public_page_url: string;
}

export interface BroadcastFreedSlotData {
  original_date: string;
  original_time: string;
  professional_name: string;
  barbershop_name: string;
  public_page_url: string;
}

/**
 * Converte data "YYYY-MM-DD" para formato brasileiro "DD/MM/YYYY"
 */
export const formatDateBR = (dateStr?: string): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0].split(' ')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

/**
 * Normaliza telefone para formato internacional com DDI 55
 */
export const normalizePhoneToInternational = (raw?: string): string => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length >= 11) digits = digits.slice(1);
  return `55${digits}`;
};

/**
 * Adiciona dias a uma data no formato "YYYY-MM-DD" sem sofrer desvios de fuso horário
 */
export const addDaysToDate = (dateStr: string, days: number): string => {
  const clean = String(dateStr).split('T')[0].split(' ')[0];
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return clean;
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const newY = dt.getUTCFullYear();
  const newM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const newD = String(dt.getUTCDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
};

/**
 * Calcula a próxima data de atendimento recorrente a partir da data atual liberada
 */
export const calculateNextRecurringDate = (
  currentDateStr: string,
  frequency: RecurringFrequency
): string => {
  const daysToAdd = frequency === 'BIWEEKLY' ? 14 : 7;
  const nextIso = addDaysToDate(currentDateStr, daysToAdd);
  return formatDateBR(nextIso);
};

/**
 * Constrói URL Click-to-Chat para envio no WhatsApp
 */
export const buildWhatsAppLink = (phone: string, text: string): string => {
  const intlPhone = normalizePhoneToInternational(phone);
  const normalizedText = text.normalize('NFC');
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(normalizedText)}`;
};

/**
 * Constrói URL do WhatsApp para compartilhamento geral (ex: Status ou Fila)
 */
export const buildWhatsAppShareLink = (text: string): string => {
  const normalizedText = text.normalize('NFC');
  return `https://wa.me/?text=${encodeURIComponent(normalizedText)}`;
};

// ===================================================================
// TEMPLATES OFICIAIS DE MENSAGENS AUTOMÁTICAS
// ===================================================================

/**
 * Cenário 1.1: Cliente Fixo cancelou o horário da semana -> Barbearia / Profissional
 */
export const formatCancelWeekBarberMessage = (data: CancelWeekBarberNotificationData): string => {
  const dateFormatted = formatDateBR(data.original_date);
  return [
    `⚠️ *HORÁRIO FIXO LIBERADO NA AGENDA*`,
    ``,
    `Olá, *${data.professional_name}*! O cliente fixo *${data.client_name}* (${data.client_phone}) avisou que não poderá comparecer nesta semana.`,
    ``,
    `📅 *Data liberada:* ${dateFormatted} às ${data.original_time}`,
    `✂️ *Serviço:* ${data.service_name}`,
    `💬 *Motivo enviado:* "${data.cancellation_feedback}"`,
    ``,
    `✅ *Ação automática:* Esse horário já foi aberto novamente na sua página pública para novos agendamentos!`,
  ].join('\n');
};

/**
 * Cenário 1.2: Cliente Fixo cancelou o horário da semana -> Cliente
 */
export const formatCancelWeekClientMessage = (data: CancelWeekClientNotificationData): string => {
  const dateFormatted = formatDateBR(data.original_date);
  const nextDateFormatted = formatDateBR(data.next_recurring_date);
  return [
    `Olá, *${data.client_name}*! Recebemos o seu aviso na *${data.barbershop_name}*. 👍`,
    ``,
    `❌ Seu atendimento de *${dateFormatted} às ${data.original_time}* foi cancelado apenas para esta semana.`,
    ``,
    `⭐ *Fique tranquilo(a):* Seu plano de *Cliente Fixo (${data.frequency_label})* continua 100% ativo! Seu próximo horário segue garantido para *${nextDateFormatted} às ${data.original_time}*.`,
  ].join('\n');
};

/**
 * Cenário 2.1: Cliente Fixo remarcou na agenda aberta -> Barbearia / Profissional
 */
export const formatRescheduleWeekBarberMessage = (data: RescheduleWeekBarberNotificationData): string => {
  const origDateFormatted = formatDateBR(data.original_date);
  const newDateFormatted = formatDateBR(data.new_date);
  return [
    `🔄 *TROCA DE HORÁRIO (CLIENTE FIXO)*`,
    ``,
    `Olá, *${data.professional_name}*! O cliente fixo *${data.client_name}* (${data.client_phone}) alterou o horário desta semana:`,
    ``,
    `🔓 *Horário que ficou LIVRE:* ${origDateFormatted} às ${data.original_time} *(Já aberto na página pública)*`,
    `📌 *NOVO horário reservado:* ${newDateFormatted} às ${data.new_time}`,
    `✂️ *Serviço:* ${data.service_name}`,
    `💬 *Motivo da troca:* "${data.cancellation_feedback}"`,
  ].join('\n');
};

/**
 * Cenário 2.2: Cliente Fixo remarcou na agenda aberta -> Cliente
 */
export const formatRescheduleWeekClientMessage = (data: RescheduleWeekClientNotificationData): string => {
  const newDateFormatted = formatDateBR(data.new_date);
  return [
    `Tudo certo, *${data.client_name}*! Sua troca de horário desta semana na *${data.barbershop_name}* foi confirmada. ✂️✅`,
    ``,
    `🔄 *Excepcionalmente nesta semana:*`,
    `📅 *Novo dia:* ${newDateFormatted} às ${data.new_time}`,
    `👤 *Profissional:* ${data.professional_name}`,
    `✂️ *Serviço:* ${data.service_name}`,
    ``,
    `⭐ *Lembrete:* Na próxima vez, seu horário fixo padrão (*${data.day_of_week_label} às ${data.original_time}*) volta ao normal!`,
  ].join('\n');
};

/**
 * Cenário 3.1: Boas-vindas ao novo Cliente Fixo -> Cliente
 */
export const formatWelcomeRecurringClientMessage = (data: WelcomeRecurringClientNotificationData): string => {
  const firstDateFormatted = formatDateBR(data.first_date);
  return [
    `🎉 *VOCÊ AGORA É CLIENTE FIXO NA ${data.barbershop_name}!*`,
    ``,
    `Olá, *${data.client_name}*! Seu horário fixo foi configurado com sucesso:`,
    ``,
    `🗓️ *Frequência:* ${data.frequency_label} (Toda ${data.day_of_week_label} às ${data.start_time})`,
    `👤 *Profissional:* ${data.professional_name}`,
    `✂️ *Serviço:* ${data.service_name}`,
    `🚀 *Próximo atendimento:* ${firstDateFormatted} às ${data.start_time}`,
    ``,
    `💡 *Como funciona:* Seu horário já fica reservado automaticamente. Quando acontecer algum imprevisto e não puder vir, basta acessar nossa página, informar seu número e clicar em *Remarcar esta semana* ou *Não poderei ir*:`,
    `🔗 ${data.public_page_url}`,
  ].join('\n');
};

/**
 * Cenário Extra: Divulgar Vaga Liberada no WhatsApp / Status
 */
export const formatBroadcastFreedSlotMessage = (data: BroadcastFreedSlotData): string => {
  const dateFormatted = formatDateBR(data.original_date);
  return [
    `🔥 *VAGA DE ÚLTIMA HORA LIBERADA!*`,
    `Acabou de abrir um horário para *${dateFormatted} às ${data.original_time}* com *${data.professional_name}* na *${data.barbershop_name}*!`,
    `Garanta agora antes que preencha: ${data.public_page_url}`,
  ].join('\n');
};
