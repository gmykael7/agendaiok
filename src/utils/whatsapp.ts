import { Appointment, Organization } from '../types';

export type WhatsAppAction = 'confirm' | 'reminder' | 'thanks' | 'inactive';

const DEFAULTS: Record<WhatsAppAction, string> = {
  confirm: 'Olá {cliente}! Seu horário na {barbearia} está confirmado para {data} às {horario}. Serviço: {servico}. Valor: R$ {valor}.',
  reminder: 'Olá {cliente}! Passando para lembrar do seu horário na {barbearia} em {data} às {horario}. Serviço: {servico}.',
  thanks: 'Olá {cliente}! Obrigado por escolher a {barbearia}. Foi um prazer atender você. Até a próxima!',
  inactive: 'Olá {cliente}! Sentimos sua falta na {barbearia}. Que tal reservar seu próximo horário?',
};

export const normalizeWhatsAppPhone = (phone: string): string => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length >= 11) digits = digits.slice(1);
  return `55${digits}`;
};

export const buildWhatsAppUrl = (phone: string, text?: string): string => {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const normalizedText = text?.normalize('NFC');

  // Formato oficial de Click to Chat. A codificação explícita mantém cada byte
  // Unicode intacto no WhatsApp Web, inclusive emojis e quebras de linha.
  return `https://wa.me/${normalizedPhone}${normalizedText ? `?text=${encodeURIComponent(normalizedText)}` : ''}`;
};

export const formatAppointmentDate = (date?: string): string => {
  if (!date) return 'hoje';
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

export const getWhatsAppTemplate = (org: Organization, action: WhatsAppAction): string => {
  if (action === 'confirm') return org.whatsapp_confirm_template || DEFAULTS.confirm;
  if (action === 'reminder') return org.whatsapp_reminder_template || DEFAULTS.reminder;
  if (action === 'thanks') return org.whatsapp_thanks_template || DEFAULTS.thanks;
  return org.whatsapp_inactive_template || DEFAULTS.inactive;
};

export const applyWhatsAppTemplate = (
  template: string,
  data: {
    cliente: string;
    barbearia: string;
    data?: string;
    horario?: string;
    servico?: string;
    valor?: string;
  },
): string => {
  const replacements: Record<string, string> = {
    cliente: data.cliente || '',
    barbearia: data.barbearia || '',
    data: data.data || '',
    horario: data.horario || '',
    servico: data.servico || '',
    valor: data.valor || '',
  };

  return template.replace(/\{(cliente|barbearia|data|horario|servico|valor)\}/g, (_, key) => replacements[key] || '');
};

export const buildAppointmentWhatsAppUrl = (
  org: Organization,
  appointment: Appointment,
  action: WhatsAppAction,
): string => {
  const phone = normalizeWhatsAppPhone(appointment.client_phone);
  const text = applyWhatsAppTemplate(getWhatsAppTemplate(org, action), {
    cliente: appointment.client_name,
    barbearia: org.name,
    data: formatAppointmentDate(appointment.date),
    horario: appointment.start_time,
    servico: appointment.service_name,
    valor: appointment.price.toFixed(2),
  });
  return buildWhatsAppUrl(phone, text);
};

export const buildClientWhatsAppUrl = (
  org: Organization,
  client: { name: string; phone: string },
  action: WhatsAppAction,
  appointment?: Appointment,
): string => {
  const phone = normalizeWhatsAppPhone(client.phone);
  const text = applyWhatsAppTemplate(getWhatsAppTemplate(org, action), {
    cliente: client.name,
    barbearia: org.name,
    data: appointment ? formatAppointmentDate(appointment.date) : '',
    horario: appointment?.start_time || '',
    servico: appointment?.service_name || '',
    valor: appointment ? appointment.price.toFixed(2) : '',
  });
  return buildWhatsAppUrl(phone, text);
};
