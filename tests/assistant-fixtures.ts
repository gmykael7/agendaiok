import type { AssistantData } from '../src/services/bookingAssistant';

export const fixture: AssistantData = {
  org: { id: 'assistant-demo', name: 'Barbearia de teste', slug: 'assistant-demo', phone: '', address: 'Endereço de demonstração', email: 'PRIVATE-EMAIL', primary_color: '#10b981', open_hour: '08:00', close_hour: '18:00', break_enabled: true, break_start: '12:00', break_end: '14:00', account_status: 'active' },
  services: [
    { id: 'cut', name: 'Corte', price: 40, duration_minutes: 30, category: 'Cabelo', active: true },
    { id: 'combo', name: 'Combo', price: 65, duration_minutes: 60, category: 'Combo', active: true },
    { id: 'hidden', name: 'Serviço oculto', price: 10, duration_minutes: 30, category: 'Outro', active: false },
  ],
  barbers: [
    { id: 'ana', full_name: 'Ana', role: 'Profissional', phone: 'PRIVATE-BARBER-PHONE', commission_rate: 50, active: true },
    { id: 'bia', full_name: 'Bia', role: 'Profissional', phone: '', commission_rate: 50, active: true },
    { id: 'hidden', full_name: 'Profissional inativo', role: 'Profissional', phone: '', commission_rate: 50, active: false },
  ],
  appointments: [
    { id: 'existing', date: '2026-09-02', start_time: '10:30', duration_minutes: 60, barber_id: 'ana', barber_name: 'Ana', client_name: 'PRIVATE-CLIENT', client_phone: 'PRIVATE-PHONE', service_name: 'Combo', price: 65, status: 'confirmed' },
  ],
};
