import { Appointment, Organization } from '../types';

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * Converte data e hora de agendamento em objetos Date de início e fim.
 */
export function getAppointmentDateRange(app: Appointment): { start: Date; end: Date } {
  const dateStr = app.date || new Date().toISOString().split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (app.start_time || '10:00').split(':').map(Number);

  const start = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
  const duration = app.duration_minutes || (app.services?.reduce((acc, s) => acc + (s.duration_minutes || 30), 0)) || 30;
  const end = new Date(start.getTime() + duration * 60_000);

  return { start, end };
}

/**
 * Formata data e hora para o formato padrão do Google Calendar (YYYYMMDDTHHmmss).
 */
export function formatGoogleCalendarDate(date: Date): string {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  const h = padZero(date.getHours());
  const min = padZero(date.getMinutes());
  const s = padZero(date.getSeconds());
  return `${y}${m}${d}T${h}${min}${s}`;
}

/**
 * Formata data e hora para o formato universal iCalendar RFC 5545 (YYYYMMDDTHHmmssZ em UTC).
 */
export function formatIcsDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = padZero(date.getUTCMonth() + 1);
  const d = padZero(date.getUTCDate());
  const h = padZero(date.getUTCHours());
  const min = padZero(date.getUTCMinutes());
  const s = padZero(date.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Gera URL universal para adicionar o agendamento ao Google Agenda com 1 clique.
 */
export function buildGoogleCalendarUrl(org: Organization, app: Appointment): string {
  const { start, end } = getAppointmentDateRange(app);
  const startStr = formatGoogleCalendarDate(start);
  const endStr = formatGoogleCalendarDate(end);

  const title = `${app.service_name || 'Atendimento'} - ${org.name}`;
  const details = [
    `💈 Atendimento na ${org.name}`,
    `👤 Profissional: ${app.barber_name}`,
    `✂️ Serviço: ${app.service_name}`,
    `💰 Valor: R$ ${Number(app.price || 0).toFixed(2)}`,
    app.client_name ? `Cliente: ${app.client_name}` : '',
    org.phone ? `Contato da barbearia: ${org.phone}` : '',
    org.address ? `Endereço: ${org.address}` : '',
    '',
    `Agendado via AgendAI (https://meuagendai.fun/agendar/${org.slug || ''})`,
  ].filter(Boolean).join('\n');

  const location = org.address || org.name;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startStr}/${endStr}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Gera o conteúdo do arquivo universal iCalendar (.ics) compatível com Apple Calendar e Outlook.
 */
export function generateIcsContent(org: Organization, app: Appointment): string {
  const { start, end } = getAppointmentDateRange(app);
  const startUtc = formatIcsDate(start);
  const endUtc = formatIcsDate(end);
  const stampUtc = formatIcsDate(new Date());

  const title = `${app.service_name || 'Atendimento'} - ${org.name}`.replace(/[\\;,]/g, ' ');
  const location = (org.address || org.name).replace(/[\\;,]/g, ' ');
  const details = [
    `Atendimento na ${org.name}`,
    `Profissional: ${app.barber_name}`,
    `Servico: ${app.service_name}`,
    `Valor: R$ ${Number(app.price || 0).toFixed(2)}`,
    app.client_name ? `Cliente: ${app.client_name}` : '',
    org.phone ? `Telefone: ${org.phone}` : '',
    `Agendado via AgendAI`,
  ].filter(Boolean).join('\\n');

  const uid = `${app.id || 'app-' + Date.now()}@meuagendai.fun`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AgendAI//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stampUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete de agendamento na barbearia em 1 hora',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Dispara o download ou abertura nativa do arquivo .ics para Apple Calendar (iPhone/Mac).
 */
export function downloadIcsFile(org: Organization, app: Appointment): void {
  const ics = generateIcsContent(org, app);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `agendamento-${org.slug || 'barbearia'}-${app.date || 'data'}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
