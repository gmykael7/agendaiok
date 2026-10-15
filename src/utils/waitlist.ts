import { Organization, WaitlistEntry, WaitlistPeriod } from '../types';
import { buildWhatsAppUrl } from './whatsapp';

/**
 * Converte um horário HH:mm em período do dia ('morning' | 'afternoon' | 'evening').
 */
export function timeToPeriod(timeStr: string): 'morning' | 'afternoon' | 'evening' {
  if (!timeStr) return 'morning';
  const [h] = timeStr.split(':').map(Number);
  const hour = Number.isFinite(h) ? h : 10;
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Verifica se um horário específico atende ao período de preferência do cliente na lista de espera.
 */
export function matchesWaitlistPeriod(preferredPeriod: WaitlistPeriod | undefined, timeStr: string): boolean {
  if (!preferredPeriod || preferredPeriod === 'any') return true;
  return timeToPeriod(timeStr) === preferredPeriod;
}

/**
 * Encontra os clientes da lista de espera compatíveis com uma vaga recém-liberada.
 * Ordena por ordem de chegada (FIFO - mais antigo primeiro).
 */
export function findWaitlistMatches(
  waitlist: WaitlistEntry[],
  date: string,
  time: string,
  barberId?: string
): WaitlistEntry[] {
  if (!Array.isArray(waitlist)) return [];

  return waitlist
    .filter((entry) => {
      if (entry.status !== 'waiting') return false;
      if (entry.preferred_date !== date) return false;
      if (entry.barber_id && entry.barber_id !== 'any' && barberId && entry.barber_id !== barberId) {
        return false;
      }
      return matchesWaitlistPeriod(entry.preferred_period, time);
    })
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

/**
 * Rótulo amigável em português para o período preferido.
 */
export function waitlistPeriodLabel(period?: WaitlistPeriod): string {
  switch (period) {
    case 'morning':
      return 'Manhã (08h às 12h)';
    case 'afternoon':
      return 'Tarde (12h às 18h)';
    case 'evening':
      return 'Noite (18h às 21h)';
    case 'any':
    default:
      return 'Qualquer horário';
  }
}

/**
 * Gera a URL do WhatsApp com a mensagem persuasiva da Vaga Relâmpago para o cliente da lista.
 */
export function buildWaitlistWhatsAppUrl(
  org: Organization,
  entry: WaitlistEntry,
  slot: {
    date: string;
    time: string;
    barber_name: string;
    service_name?: string;
  }
): string {
  const cleanPhone = (entry.client_phone || '').replace(/\D/g, '');
  const targetPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const [y, m, d] = (slot.date || '').split('-');
  const formattedDate = (d && m && y) ? `${d}/${m}/${y}` : slot.date;

  const publicLink = `https://meuagendai.fun/agendar/${org.slug || ''}`;

  const textLines = [
    `⚡ *VAGA RELÂMPAGO NA ${org.name.toUpperCase()}!*`,
    '',
    `Fala, ${entry.client_name}! Tudo bem?`,
    `Acabou de surgir uma desistência de horário na nossa agenda:`,
    '',
    `📅 *Data:* ${formattedDate}`,
    `⏰ *Horário:* às ${slot.time}`,
    `💈 *Profissional:* ${slot.barber_name}`,
    `✂️ *Serviço:* ${slot.service_name || entry.service_name || 'Atendimento'}`,
    '',
    `Como você estava na nossa *Lista de Espera*, estamos avisando você em primeira mão!`,
    '',
    `Para garantir essa vaga antes de outro cliente, responda *"QUERO"* aqui no WhatsApp ou confirme no link:`,
    publicLink,
  ];

  return buildWhatsAppUrl(targetPhone, textLines.join('\n'));
}
