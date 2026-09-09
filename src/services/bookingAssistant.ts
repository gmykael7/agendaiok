import type { Appointment, Barber, Organization, Service } from '../types';
import { generateBusinessSlots, isBookableBusinessDateTime, timeToMinutes } from '../utils/scheduling';

// O projeto ainda não tem fuso por estabelecimento. Este piloto usa Brasília/Fortaleza.
export const ASSISTANT_TIME_ZONE = 'America/Fortaleza';
export type AssistantSelection = { date: string; serviceId: string; barberId: string };
export type AssistantSlot = AssistantSelection & { time: string; barberName: string };
export type AssistantTopic = 'services' | 'availability' | 'hours' | 'contact' | 'help';
export type AssistantIntent = Partial<AssistantSelection> & { topic?: AssistantTopic };
export type AssistantReply = {
  reply: string;
  mode: 'guided' | 'ai';
  selection: AssistantSelection;
  slots: AssistantSlot[];
};
export type AssistantData = {
  org: Organization;
  services: Service[];
  barbers: Barber[];
  appointments: Appointment[];
};

export function isAssistantReply(value: unknown): value is AssistantReply {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Record<string, unknown>;
  const isSelection = (item: unknown): item is AssistantSelection => {
    if (!item || typeof item !== 'object') return false;
    const selection = item as Record<string, unknown>;
    return typeof selection.date === 'string' && typeof selection.serviceId === 'string' && typeof selection.barberId === 'string';
  };
  return typeof reply.reply === 'string' && (reply.mode === 'guided' || reply.mode === 'ai') && isSelection(reply.selection)
    && Array.isArray(reply.slots) && reply.slots.every(item => isSelection(item) && typeof (item as AssistantSlot).time === 'string' && typeof (item as AssistantSlot).barberName === 'string');
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const containsName = (text: string, name: string): boolean => {
  const words = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
  const target = words(name);
  return Boolean(target) && ` ${words(text)} `.includes(` ${target} `);
};
export const assistantToday = (now = new Date()): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: ASSISTANT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);
export const assistantAddDays = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const validAssistantDate = (date: string, now = new Date()): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) return false;
  const today = assistantToday(now);
  return date >= today && date <= assistantAddDays(today, 90);
};

export function sanitizeAssistantSelection(value: unknown, data: AssistantData, now = new Date()): AssistantSelection {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    date: typeof input.date === 'string' ? input.date : assistantToday(now),
    serviceId: data.services.some(s => s.active !== false && s.id === input.serviceId) ? String(input.serviceId) : '',
    barberId: data.barbers.some(b => b.active !== false && b.id === input.barberId) ? String(input.barberId) : '',
  };
}

// Regras locais permitem experimentar sem conta de IA, custo de inferência ou alterações no banco.
export function inferGuidedIntent(message: string, data: AssistantData, now = new Date()): AssistantIntent {
  const text = normalize(message);
  const intent: AssistantIntent = { topic: 'help' };
  if (/servico|preco|valor|quanto custa/.test(text)) intent.topic = 'services';
  if (/funciona|expediente|abre|fecha/.test(text)) intent.topic = 'hours';
  if (/contato|telefone|whatsapp|endereco|humano/.test(text)) intent.topic = 'contact';
  if (/agend|reserv|dispon|horario|amanha|hoje|dia \d/.test(text) && intent.topic === 'help') intent.topic = 'availability';
  const matches = data.services.filter(s => s.active !== false && containsName(text, s.name));
  if (matches.length === 1) {
    intent.serviceId = matches[0].id;
    if (intent.topic === 'help') intent.topic = 'availability';
  }
  if (matches.length > 1) { intent.topic = 'help'; intent.serviceId = ''; }
  const barbers = data.barbers.filter(b => b.active !== false && containsName(text, b.full_name));
  if (barbers.length === 1) intent.barberId = barbers[0].id;
  if (/qualquer profissional|qualquer barbeiro/.test(text)) intent.barberId = '';
  if (/depois de amanha/.test(text)) intent.date = assistantAddDays(assistantToday(now), 2);
  else if (/amanha/.test(text)) intent.date = assistantAddDays(assistantToday(now), 1);
  else if (/hoje/.test(text)) intent.date = assistantToday(now);
  const isoDate = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const shortDate = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (isoDate) intent.date = isoDate[0];
  else if (shortDate) intent.date = `${shortDate[3] || assistantToday(now).slice(0, 4)}-${shortDate[2].padStart(2, '0')}-${shortDate[1].padStart(2, '0')}`;
  else if (!intent.date && /segunda|terca|quarta|quinta|sexta|sabado|domingo|semana que vem/.test(text)) {
    // No modo guiado, uma data não compreendida nunca vira uma reserva para hoje.
    intent.topic = 'availability';
    intent.date = '';
  }
  if (intent.date && intent.topic === 'help') intent.topic = 'availability';
  return intent;
}

export function assistantSlots(data: AssistantData, selection: AssistantSelection, now = new Date()): AssistantSlot[] {
  if (!validAssistantDate(selection.date, now)) return [];
  const service = data.services.find(s => s.id === selection.serviceId && s.active !== false);
  if (!service || !Number.isFinite(service.duration_minutes) || service.duration_minutes <= 0) return [];
  const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: ASSISTANT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const today = assistantToday(now);
  const slots: AssistantSlot[] = [];
  for (const time of generateBusinessSlots(data.org, service.duration_minutes, 30)) {
    if (selection.date === today && timeToMinutes(time) <= timeToMinutes(nowTime)) continue;
    if (!isBookableBusinessDateTime(time, service.duration_minutes, selection.date, data.org)) continue;
    for (const barber of data.barbers.filter(b => b.active !== false && (!selection.barberId || b.id === selection.barberId))) {
      const start = timeToMinutes(time);
      const end = start + service.duration_minutes;
      const occupied = data.appointments.some(a => {
        if (a.barber_id !== barber.id || (a.date || today) !== selection.date || a.status === 'canceled' || a.status === 'no_show') return false;
        const otherStart = timeToMinutes(a.start_time);
        const duration = a.duration_minutes || a.services?.reduce((sum, item) => sum + (item.duration_minutes || 30), 0) || 30;
        return start < otherStart + duration && otherStart < end;
      });
      if (!occupied) slots.push({ ...selection, barberId: barber.id, barberName: barber.full_name, time });
    }
  }
  return slots;
}

export function answerBookingAssistant(data: AssistantData, message: string, input: unknown, now = new Date(), aiIntent?: AssistantIntent): AssistantReply {
  const guided = inferGuidedIntent(message, data, now);
  const intent = { ...guided, ...aiIntent };
  const selection = sanitizeAssistantSelection({ ...sanitizeAssistantSelection(input, data, now), ...intent }, data, now);
  const response: AssistantReply = { reply: '', mode: aiIntent ? 'ai' : 'guided', selection, slots: [] };
  // Nunca executa nem anuncia gravações, cancelamentos ou acesso administrativo.
  if (/cancel|remarc|fatur|receita|comiss|senha|outro cliente|lista de clientes/.test(normalize(message))) {
    response.reply = 'Neste piloto ajudo com serviços e novos horários. Para alterar uma reserva ou falar sobre sua conta, entre em contato com a barbearia.';
    return response;
  }
  if (intent.topic === 'services') {
    const services = data.services.filter(s => s.active !== false);
    response.reply = services.length ? services.map(s => `${s.name}: ${s.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • ${s.duration_minutes} min`).join('\n') + '\n\nEscolha um serviço nos campos abaixo para consultar os horários. Para combinar serviços, use o agendamento normal.' : 'Não há serviços disponíveis para agendamento agora.';
  } else if (intent.topic === 'hours') {
    response.reply = `O expediente cadastrado é ${data.org.open_hour || '08:00'} às ${data.org.close_hour || '20:00'}${data.org.break_enabled ? `, com intervalo de ${data.org.break_start} a ${data.org.break_end}` : ''}. Horário de Brasília. Fechamentos excepcionais são considerados ao consultar uma data.`;
  } else if (intent.topic === 'contact') {
    response.reply = [data.org.name, data.org.phone ? `Contato: ${data.org.phone}` : 'Contato não cadastrado.', data.org.address || ''].filter(Boolean).join('\n');
  } else if (intent.topic === 'availability') {
    if (!validAssistantDate(selection.date, now)) response.reply = 'Escolha uma data válida entre hoje e os próximos 90 dias.';
    else if (!selection.serviceId) response.reply = 'Qual serviço você deseja? Escolha um serviço abaixo e toque em Consultar horários.';
    else {
      response.slots = assistantSlots(data, selection, now);
      const service = data.services.find(s => s.id === selection.serviceId)!;
      const date = selection.date.split('-').reverse().join('/');
      response.reply = response.slots.length
        ? `Encontrei estas opções para ${service.name} em ${date}. Horário de Brasília. Escolha uma para revisar e informar seu contato. Nada foi reservado ainda; a disponibilidade será validada novamente na confirmação.`
        : `Não encontrei horário livre para ${service.name} em ${date} com essa seleção. Tente outra data ou profissional.`;
    }
  } else response.reply = 'Posso mostrar serviços e preços, consultar horários e ajudar a preparar um agendamento. Experimente “Quero agendar amanhã” ou use os campos abaixo. Para combinar serviços, use o agendamento normal.';
  return response;
}
