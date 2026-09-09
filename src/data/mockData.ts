import { Organization, Service, Barber, Appointment, Client } from '../types';

const today = new Date().toISOString().split('T')[0];

export const INITIAL_ORG: Organization = {
  id: 'org-1',
  name: 'Barbearia Vanguarda',
  owner_name: 'Felipe Mateus',
  email: 'admin@barbeariavanguarda.com',
  slug: 'barbearia-vanguarda',
  phone: '(84) 99999-8888',
  address: 'Rua Central, 120 - Centro',
  primary_color: '#10b981',
  open_hour: '08:00',
  close_hour: '20:00',
  break_enabled: true,
  break_start: '12:00',
  break_end: '14:00',
  closed_periods: [],
  tv_enabled: false,
  tv_media_type: 'institutional',
  tv_visual_mode: 'brand_products_queue',
  tv_animations: true,
  tv_show_client_names: false,
  tv_show_prices: false,
  tv_sound_enabled: true,
  tv_sound_volume: 70,
  tv_sound_style: 'bell',
  tv_notice: 'Obrigado pela preferência. Aguarde seu atendimento e fique à vontade!',
};

export const INITIAL_SERVICES: Service[] = [
  { id: '1', org_id: 'org-1', name: 'Corte Cabelo Executivo', price: 50.00, duration_minutes: 30, category: 'Cabelo', active: true },
  { id: '2', org_id: 'org-1', name: 'Barba Completa com Toalha Quente', price: 40.00, duration_minutes: 30, category: 'Barba', active: true },
  { id: '3', org_id: 'org-1', name: 'Combo Cabelo + Barba Premium', price: 80.00, duration_minutes: 60, category: 'Combos', active: true },
  { id: '4', org_id: 'org-1', name: 'Design de Sobrancelha Navalhada', price: 25.00, duration_minutes: 15, category: 'Estética', active: true },
];

export const INITIAL_BARBERS: Barber[] = [
  { 
    id: 'b1',
    org_id: 'org-1',
    full_name: 'Lucas Silva (Mestre)', 
    role: 'Barbeiro Sênior', 
    commission_rate: 50, 
    phone: '(84) 98888-7777', 
    active: true,
  },
  { 
    id: 'b2', 
    org_id: 'org-1',
    full_name: 'Gabriel Santos', 
    role: 'Especialista em Barba', 
    commission_rate: 45, 
    phone: '(84) 97777-6666', 
    active: true,
  },
];

export const INITIAL_CLIENTS: Client[] = [
  { id: 'c1', org_id: 'org-1', name: 'Carlos Oliveira', phone: '(84) 99111-2222', total_visits: 5, total_spent: 250.00, last_visit: 'Hoje' },
  { id: 'c2', org_id: 'org-1', name: 'Roberto Mendes', phone: '(84) 99222-3333', total_visits: 3, total_spent: 240.00, last_visit: 'Hoje' },
  { id: 'c3', org_id: 'org-1', name: 'Eduardo Lima', phone: '(84) 99333-4444', total_visits: 2, total_spent: 80.00, last_visit: 'Ontem' },
  { id: 'c4', org_id: 'org-1', name: 'Marcos Vinicius', phone: '(84) 99444-5555', total_visits: 1, total_spent: 50.00, last_visit: '12/08/2026' },
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  { 
    id: 'a1', 
    org_id: 'org-1',
    client_name: 'Carlos Oliveira', 
    client_phone: '(84) 99111-2222', 
    service_id: '1', 
    service_name: 'Corte Cabelo Executivo', 
    barber_id: 'b1', 
    barber_name: 'Lucas Silva (Mestre)', 
    start_time: '10:00', 
    price: 50.00, 
    status: 'completed',
    payment_method: 'pix',
    date: today,
    created_at: new Date().toISOString(),
  },
  { 
    id: 'a2', 
    org_id: 'org-1',
    client_name: 'Roberto Mendes', 
    client_phone: '(84) 99222-3333', 
    service_id: '3', 
    service_name: 'Combo Cabelo + Barba Premium', 
    barber_id: 'b2', 
    barber_name: 'Gabriel Santos', 
    start_time: '14:00', 
    price: 80.00, 
    status: 'scheduled',
    date: today,
    created_at: new Date().toISOString(),
  },
  { 
    id: 'a3', 
    org_id: 'org-1',
    client_name: 'Eduardo Lima', 
    client_phone: '(84) 99333-4444', 
    service_id: '2', 
    service_name: 'Barba Completa com Toalha Quente', 
    barber_id: 'b1', 
    barber_name: 'Lucas Silva (Mestre)', 
    start_time: '15:30', 
    price: 40.00, 
    status: 'scheduled',
    date: today,
    created_at: new Date().toISOString(),
  },
];
