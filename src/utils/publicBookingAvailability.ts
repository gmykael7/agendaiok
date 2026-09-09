import type { Appointment, Barber, Organization, Service } from '../types';
import { generateBusinessSlots, isBookableBusinessDateTime, timeToMinutes } from './scheduling';

export type PublicBookingDateStatus = 'available' | 'unavailable' | 'closed';

export const isPublicTimeSlotOccupied = (
  slotTime: string,
  candidateDurationMinutes: number,
  barberId: string,
  dateStr: string,
  appointments: Appointment[],
  excludeAppointmentId?: string,
): boolean => {
  const candidateStart = timeToMinutes(slotTime);
  const candidateEnd = candidateStart + (candidateDurationMinutes || 30);

  return appointments.some((appointment) => {
    if (excludeAppointmentId && appointment.id === excludeAppointmentId) return false;
    if (appointment.status === 'canceled' || appointment.status === 'no_show') return false;
    if (appointment.barber_id !== barberId) return false;
    if ((appointment.date || dateStr) !== dateStr) return false;

    const appointmentStart = timeToMinutes(appointment.start_time);
    const appointmentDuration = appointment.duration_minutes
      || appointment.services?.reduce((sum, service) => sum + (service.duration_minutes || 30), 0)
      || 30;
    const appointmentEnd = appointmentStart + appointmentDuration;
    return candidateStart < appointmentEnd && appointmentStart < candidateEnd;
  });
};

export const getPublicBookingDateStatus = ({
  org,
  services,
  barbers,
  appointments,
  dateStr,
  now = new Date(),
}: {
  org: Organization;
  services: Service[];
  barbers: Barber[];
  appointments: Appointment[];
  dateStr: string;
  now?: Date;
}): PublicBookingDateStatus => {
  if (org.closed_periods?.some((period) => period?.date === dateStr && period.all_day === true)) return 'closed';

  const activeServices = services.filter((service) => service.active !== false);
  const activeBarbers = barbers.filter((barber) => barber.active !== false);
  if (activeServices.length === 0 || activeBarbers.length === 0) return 'unavailable';

  // Antes da escolha do serviço, a menor duração revela se existe ao menos uma
  // possibilidade real no dia sem prometer que todos os serviços ainda cabem.
  const shortestDuration = Math.min(...activeServices.map((service) => Math.max(1, Number(service.duration_minutes) || 30)));
  const slots = generateBusinessSlots(org, shortestDuration, 30);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const hasAvailableSlot = activeBarbers.some((barber) => slots.some((time) => {
    if (dateStr === todayKey && timeToMinutes(time) <= currentMinutes) return false;
    if (!isBookableBusinessDateTime(time, shortestDuration, dateStr, org)) return false;
    return !isPublicTimeSlotOccupied(time, shortestDuration, barber.id, dateStr, appointments);
  }));

  return hasAvailableSlot ? 'available' : 'unavailable';
};
