import type { Appointment, Barber, Organization, Service } from '../types';

export class BookingInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** O catálogo da barbearia, e não o navegador, define preço, duração e profissional. */
export function normalizePublicAppointment(input: unknown, catalog: { org: Organization; services: Service[]; barbers: Barber[] }): Appointment {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingInputError('Agendamento inválido.');
  const value = input as Record<string, unknown>;
  const field = (name: string, max: number) => {
    const item = value[name];
    if (typeof item !== 'string' || !item.trim() || item.length > max) throw new BookingInputError('Confira os dados obrigatórios do agendamento.');
    return item.trim();
  };
  const id = field('id', 160);
  if (!/^[a-z0-9_-]+$/i.test(id)) throw new BookingInputError('Identificador do agendamento inválido.');
  const date = field('date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new BookingInputError('Escolha uma data válida.');
  const start_time = field('start_time', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)) throw new BookingInputError('Escolha um horário válido.');
  const client_name = field('client_name', 120);
  const client_phone = field('client_phone', 40);
  if (client_name.length < 2 || !/^\d{10,15}$/.test(client_phone.replace(/\D/g, ''))) throw new BookingInputError('Informe seu nome e WhatsApp com DDD.');
  const barberId = field('barber_id', 160);
  const barber = catalog.barbers.find(item => item.id === barberId && item.active !== false);
  if (!barber) throw new BookingInputError('Este profissional não está disponível. Escolha outro.', 409);
  const ids = Array.isArray(value.services) && value.services.length ? value.services.map(item => item?.id) : [value.service_id];
  if (!ids.length || ids.length > 20 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new BookingInputError('Selecione serviços válidos.');
  const services = ids.map(id => {
    const service = catalog.services.find(item => item.id === id && item.active !== false);
    if (!service) throw new BookingInputError('Um dos serviços não está mais disponível. Atualize a página.', 409);
    const price = Number(service.price);
    const duration_minutes = Number(service.duration_minutes || 30);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(duration_minutes) || duration_minutes <= 0) throw new BookingInputError('Este serviço precisa ser revisado pela barbearia.', 409);
    return { id: service.id, name: service.name, price, duration_minutes, category: service.category };
  });
  return {
    id, org_id: catalog.org.id, client_name, client_phone, date, start_time,
    barber_id: barber.id, barber_name: barber.full_name,
    service_id: services[0].id, service_name: services.map(s => s.name).join(' + '), services,
    price: Number(services.reduce((sum, s) => sum + s.price, 0).toFixed(2)),
    duration_minutes: services.reduce((sum, s) => sum + s.duration_minutes, 0),
    status: 'scheduled', created_at: new Date().toISOString(),
  };
}
