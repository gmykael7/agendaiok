import { Appointment } from '../types';

export type AppointmentStatus = Appointment['status'];

export const OPEN_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'arrived',
  'in_progress',
];

export const appointmentStatusLabel = (status: AppointmentStatus): string => {
  switch (status) {
    case 'scheduled': return 'Agendado';
    case 'confirmed': return 'Confirmado';
    case 'arrived': return 'Chegou';
    case 'in_progress': return 'Em atendimento';
    case 'completed': return 'Concluído';
    case 'no_show': return 'Não compareceu';
    case 'canceled': return 'Cancelado';
    default: return 'Agendado';
  }
};

export const appointmentStatusClasses = (status: AppointmentStatus): string => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'canceled':
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    case 'no_show':
      return 'bg-orange-500/15 text-orange-300 border border-orange-500/30';
    case 'arrived':
      return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';
    case 'in_progress':
      return 'bg-blue-500/15 text-blue-300 border border-blue-500/30';
    case 'confirmed':
      return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
    default:
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  }
};

export const isOpenAppointmentStatus = (status: AppointmentStatus): boolean =>
  OPEN_APPOINTMENT_STATUSES.includes(status);

export const blocksAppointmentSlot = (status: AppointmentStatus): boolean =>
  status !== 'canceled' && status !== 'no_show';
