import type { Appointment, Client, Organization } from '../types';
import { createClientAppointmentsIndex, getClientCrmStats } from './clientCrm';
import { normalizeClientPhone } from './clients';
import { normalizeWhatsAppPhone } from './whatsapp';

export type CampaignAudience = 'inactive' | 'subscribers' | 'father-son' | 'all';
export const campaignTemplates: Record<CampaignAudience, string> = {
  inactive: 'Olá {cliente}! Sentimos sua falta na {barbearia}. Que tal reservar seu próximo horário?',
  subscribers: 'Olá {cliente}! Vamos aproveitar os benefícios do seu plano na {barbearia}? Fale conosco para reservar seu horário.',
  'father-son': 'Olá {cliente}! Que tal um momento Pai & Filho na {barbearia}? Fale conosco para conhecer as opções e os horários.',
  all: 'Olá {cliente}! Temos novidades na {barbearia}. Fale conosco para saber mais!',
};

export function selectCampaignClients(clients: Client[], appointments: Appointment[], org: Organization, audience: CampaignAudience, now = new Date()): Client[] {
  const index = createClientAppointmentsIndex(appointments);
  const fatherSon = /\bpai\s*(?:&|e)\s*filho\b/i;
  return clients.filter(client => {
    if (client.archived || !/^55[1-9]\d{9,10}$/.test(normalizeWhatsAppPhone(client.phone))) return false;
    if (audience === 'all') return true;
    const plan = org.subscription_plans?.find(item => item.id === client.subscription_plan_id && item.active !== false);
    if (audience === 'subscribers') return Boolean(plan);
    // Do not borrow the history of a namesake with a different phone.
    const history = index.get(`phone:${normalizeClientPhone(client.phone)}`) || [];
    const stats = getClientCrmStats(client, history, now, true);
    if (audience === 'inactive') return stats.daysSinceLastVisit !== null && stats.daysSinceLastVisit >= (org.crm_inactive_days || 30) && !stats.upcomingAppointment;
    return fatherSon.test(client.notes || '') || fatherSon.test(plan?.name || '') || stats.completedAppointments.some(item => fatherSon.test(item.service_name || '') || item.services?.some(service => fatherSon.test(service.name)));
  });
}
