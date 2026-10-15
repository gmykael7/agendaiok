import { Appointment, Client } from '../types';
import { normalizeClientPhone } from './clients';
import { isOpenAppointmentStatus } from './appointmentStatus';

export interface ClientCrmStats {
  appointments: Appointment[];
  completedAppointments: Appointment[];
  upcomingAppointment?: Appointment;
  totalVisits: number;
  totalSpent: number;
  averageTicket: number;
  lastVisitDate?: string;
  lastVisitLabel: string;
  daysSinceLastVisit: number | null;
  favoriteService: string;
  favoriteBarber: string;
  noShowCount: number;
  canceledCount: number;
}

const appointmentDateTime = (appointment: Appointment): Date | null => {
  const date = appointment.date || '';
  if (!date) return null;
  const time = appointment.start_time || '00:00';
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const matchesClient = (client: Client, appointment: Appointment): boolean => {
  const clientPhone = normalizeClientPhone(client.phone);
  const appointmentPhone = normalizeClientPhone(appointment.client_phone);
  if (clientPhone && appointmentPhone) return clientPhone === appointmentPhone;
  return client.name.trim().toLowerCase() === String(appointment.client_name || '').trim().toLowerCase();
};

const mostFrequent = (values: string[]): string => {
  if (!values.length) return 'Ainda sem histórico';
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Ainda sem histórico';
};

const formatDate = (date?: string): string => {
  if (!date) return 'Nenhuma visita concluída';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Cria um índice O(A) para busca instantânea de agendamentos por cliente.
 * Evita filtros quadráticos O(C * A) no navegador.
 */
export const createClientAppointmentsIndex = (
  appointments: Appointment[]
): Map<string, Appointment[]> => {
  const index = new Map<string, Appointment[]>();
  for (const appointment of appointments) {
    const phone = normalizeClientPhone(appointment.client_phone);
    const name = String(appointment.client_name || '').trim().toLowerCase();

    if (phone) {
      const key = `phone:${phone}`;
      const list = index.get(key) || [];
      list.push(appointment);
      index.set(key, list);
    }
    if (name) {
      const key = `name:${name}`;
      const list = index.get(key) || [];
      list.push(appointment);
      index.set(key, list);
    }
  }
  return index;
};

/**
 * Recupera os agendamentos associados a um cliente utilizando o índice em tempo O(1).
 */
export const getClientAppointmentsFromIndex = (
  client: Client,
  index: Map<string, Appointment[]>
): Appointment[] => {
  const phone = normalizeClientPhone(client.phone);
  if (phone) {
    const found = index.get(`phone:${phone}`);
    if (found) return found;
  }
  const name = client.name.trim().toLowerCase();
  return index.get(`name:${name}`) || [];
};

export const getClientCrmStats = (
  client: Client,
  appointments: Appointment[],
  now = new Date(),
  isPreFiltered = false,
): ClientCrmStats => {
  const rawList = isPreFiltered
    ? appointments
    : appointments.filter((appointment) => matchesClient(client, appointment));

  const clientAppointments = [...rawList].sort((a, b) => {
    const aDate = appointmentDateTime(a)?.getTime() || 0;
    const bDate = appointmentDateTime(b)?.getTime() || 0;
    return bDate - aDate;
  });

  const completedAppointments = clientAppointments.filter((appointment) => appointment.status === 'completed');
  const totalSpent = completedAppointments.reduce((sum, appointment) => sum + Math.max(0, Number(appointment.price || 0)), 0);
  const totalVisits = completedAppointments.length;
  const averageTicket = totalVisits ? totalSpent / totalVisits : 0;

  const lastCompleted = completedAppointments[0];
  const lastVisitDate = lastCompleted?.date;
  let daysSinceLastVisit: number | null = null;
  if (lastVisitDate) {
    const last = new Date(`${lastVisitDate}T12:00:00`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    if (!Number.isNaN(last.getTime())) {
      daysSinceLastVisit = Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86_400_000));
    }
  }

  const upcomingAppointment = clientAppointments
    .filter((appointment) => isOpenAppointmentStatus(appointment.status))
    .filter((appointment) => {
      const value = appointmentDateTime(appointment);
      return value ? value.getTime() >= now.getTime() - 60 * 60 * 1000 : false;
    })
    .sort((a, b) => (appointmentDateTime(a)?.getTime() || 0) - (appointmentDateTime(b)?.getTime() || 0))[0];

  const favoriteService = mostFrequent(
    completedAppointments.map((appointment) =>
      appointment.services?.length
        ? appointment.services.map((service) => service.name).filter(Boolean).join(' + ')
        : appointment.service_name,
    ),
  );

  const favoriteBarber = mostFrequent(completedAppointments.map((appointment) => appointment.barber_name));
  const noShowCount = clientAppointments.filter((appointment) => appointment.status === 'no_show').length;
  const canceledCount = clientAppointments.filter((appointment) => appointment.status === 'canceled').length;

  return {
    appointments: clientAppointments,
    completedAppointments,
    upcomingAppointment,
    totalVisits,
    totalSpent,
    averageTicket,
    lastVisitDate,
    lastVisitLabel: formatDate(lastVisitDate),
    daysSinceLastVisit,
    favoriteService,
    favoriteBarber,
    noShowCount,
    canceledCount,
  };
};
