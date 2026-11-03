import type { Appointment, RecurringFrequency, RecurringSchedule, Service } from '../types';
import { timeToMinutes } from './scheduling';

export const DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const DAY_SHORT_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/**
 * Normaliza o telefone do cliente mantendo apenas os dígitos essenciais (sem código do país se 55)
 */
export const normalizePhoneOnlyDigits = (raw: unknown): string => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length === 12) {
    digits = digits.slice(1);
  }
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }
  return digits;
};

/**
 * Retorna o dia da semana (0-6) para uma data YYYY-MM-DD
 */
export const getDayOfWeekFromDate = (dateStr: string): number => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return -1;
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return date.getDay();
};

/**
 * Retorna o nome do dia da semana
 */
export const getDayOfWeekLabel = (dayIndex: number, short = false): string => {
  if (dayIndex < 0 || dayIndex > 6) return '';
  return short ? DAY_SHORT_NAMES[dayIndex] : DAY_NAMES[dayIndex];
};

/**
 * Rótulo amigável da frequência
 */
export const getFrequencyLabel = (freq: RecurringFrequency): string => {
  return freq === 'WEEKLY' ? 'Semanal' : 'Quinzenal';
};

/**
 * Calcula se a data alvo (targetDate: "YYYY-MM-DD") é um dia de atendimento do contrato recorrente.
 * Regras:
 * 1. O contrato deve estar ativo (status === 'ACTIVE').
 * 2. targetDate deve ser maior ou igual a anchor_date.
 * 3. O dia da semana de targetDate deve coincidir com day_of_week.
 * 4. Se 'WEEKLY', é semana de atendimento.
 * 5. Se 'BIWEEKLY', calcula a diferença de semanas inteiras a partir da anchor_date.
 *    diffWeeks = Math.floor(diffDays / 7). Se diffWeeks % 2 === 0, é dia de atendimento.
 */
export const isDateOccurrenceOfRecurring = (
  schedule: RecurringSchedule,
  targetDate: string
): boolean => {
  if (schedule.status !== 'ACTIVE') return false;
  if (!targetDate || !schedule.anchor_date) return false;
  if (targetDate < schedule.anchor_date) return false;

  const targetDay = getDayOfWeekFromDate(targetDate);
  if (targetDay !== schedule.day_of_week) return false;

  if (schedule.frequency === 'WEEKLY') {
    return true;
  }

  if (schedule.frequency === 'BIWEEKLY') {
    const [aY, aM, aD] = schedule.anchor_date.split('-').map(Number);
    const [tY, tM, tD] = targetDate.split('-').map(Number);
    const anchorTime = new Date(aY, aM - 1, aD, 12, 0, 0).getTime();
    const targetTime = new Date(tY, tM - 1, tD, 12, 0, 0).getTime();

    const diffDays = Math.round((targetTime - anchorTime) / 86400000);
    if (diffDays < 0) return false;

    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks % 2 === 0;
  }

  return false;
};

/**
 * Representação de uma ocorrência calculada do cliente fixo
 */
export interface RecurringOccurrence {
  date: string;
  start_time: string;
  schedule_id: string;
  client_name: string;
  client_phone: string;
  professional_id: string;
  service_id: string;
  status: 'scheduled' | 'canceled' | 'rescheduled';
  is_rescheduled?: boolean;
  original_date?: string;
  appointment_id?: string;
  cancellation_feedback?: string;
}

/**
 * Gera as próximas N ocorrências de um contrato fixo a partir de uma data base,
 * combinando o cálculo da recorrência com as exceções registradas na tabela de agendamentos (appointments).
 */
export const getNextOccurrences = (
  schedule: RecurringSchedule,
  count = 4,
  appointments: Appointment[] = [],
  fromDateStr?: string
): RecurringOccurrence[] => {
  if (schedule.status !== 'ACTIVE') return [];

  const now = new Date();
  const todayKey = fromDateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const startDateStr = todayKey > schedule.anchor_date ? todayKey : schedule.anchor_date;

  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const cursor = new Date(sY, sM - 1, sD, 12, 0, 0);

  const occurrences: RecurringOccurrence[] = [];
  const maxDaysToScan = 120; // 4 meses para garantir count ocorrências

  for (let i = 0; i < maxDaysToScan && occurrences.length < count; i++) {
    const curYear = cursor.getFullYear();
    const curMonth = String(cursor.getMonth() + 1).padStart(2, '0');
    const curDay = String(cursor.getDate()).padStart(2, '0');
    const curDateStr = `${curYear}-${curMonth}-${curDay}`;

    if (isDateOccurrenceOfRecurring(schedule, curDateStr)) {
      // Procura exceções cadastradas em appointments para este recurring_id nesta data
      const matchingAppts = appointments.filter((a) => {
        if (!a || a.recurring_id !== schedule.id) return false;
        // Caso 1: Cancelamento na própria data
        if (a.date === curDateStr) return true;
        // Caso 2: Remarcação onde a data original era esta data
        const origDateOnly = (a.original_date || '').split(' ')[0];
        if (origDateOnly === curDateStr) return true;
        return false;
      });

      const canceledAppt = matchingAppts.find(
        (a) => a.date === curDateStr && (a.status === 'canceled' || (a.status as string) === 'cancelled')
      );

      const rescheduledAppt = matchingAppts.find(
        (a) => Boolean(a.is_rescheduled) && (a.original_date || '').split(' ')[0] === curDateStr
      );

      if (canceledAppt) {
        occurrences.push({
          date: curDateStr,
          start_time: schedule.start_time,
          schedule_id: schedule.id,
          client_name: schedule.client_name,
          client_phone: schedule.client_phone,
          professional_id: schedule.professional_id,
          service_id: schedule.service_id,
          status: 'canceled',
          appointment_id: canceledAppt.id,
          cancellation_feedback: canceledAppt.cancellation_feedback,
        });
      } else if (rescheduledAppt) {
        occurrences.push({
          date: rescheduledAppt.date || curDateStr,
          start_time: rescheduledAppt.start_time || schedule.start_time,
          schedule_id: schedule.id,
          client_name: schedule.client_name,
          client_phone: schedule.client_phone,
          professional_id: schedule.professional_id,
          service_id: schedule.service_id,
          status: 'rescheduled',
          is_rescheduled: true,
          original_date: `${curDateStr} ${schedule.start_time}`,
          appointment_id: rescheduledAppt.id,
          cancellation_feedback: rescheduledAppt.cancellation_feedback,
        });
      } else {
        occurrences.push({
          date: curDateStr,
          start_time: schedule.start_time,
          schedule_id: schedule.id,
          client_name: schedule.client_name,
          client_phone: schedule.client_phone,
          professional_id: schedule.professional_id,
          service_id: schedule.service_id,
          status: 'scheduled',
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
};

/**
 * Verifica se um horário específico na data informada está bloqueado por um contrato de cliente fixo.
 * Se o cliente tiver cancelado ou remarcado aquela data específica, o horário original fica LIVRE.
 */
export const isRecurringSlotOccupied = (
  slotTime: string,
  candidateDurationMinutes: number,
  professionalId: string,
  dateStr: string,
  recurringSchedules: RecurringSchedule[] = [],
  appointments: Appointment[] = [],
  services: Service[] = []
): boolean => {
  if (!recurringSchedules || recurringSchedules.length === 0) return false;

  const candidateStart = timeToMinutes(slotTime);
  const candidateEnd = candidateStart + (candidateDurationMinutes || 30);

  for (const schedule of recurringSchedules) {
    if (schedule.status !== 'ACTIVE') continue;
    if (schedule.professional_id !== professionalId) continue;
    if (!isDateOccurrenceOfRecurring(schedule, dateStr)) continue;

    // Obtém duração do serviço do cliente fixo
    const srv = services.find((s) => s.id === schedule.service_id);
    const scheduleDuration = srv ? (srv.duration_minutes || 30) : 30;
    const scheduleStart = timeToMinutes(schedule.start_time);
    const scheduleEnd = scheduleStart + scheduleDuration;

    // Verifica sobreposição de horário
    const overlaps = candidateStart < scheduleEnd && scheduleStart < candidateEnd;
    if (!overlaps) continue;

    // Se sobrepõe, checa se há exceção (cancelamento ou remarcação) na tabela appointments
    const exception = appointments.find((a) => {
      if (!a || a.recurring_id !== schedule.id) return false;
      // Caso A: Cancelamento daquela data
      if (a.date === dateStr && (a.status === 'canceled' || (a.status as string) === 'cancelled')) {
        return true;
      }
      // Caso B: Remarcação para outro dia/hora com liberação da data original
      const origDateOnly = (a.original_date || '').split(' ')[0];
      if (Boolean(a.is_rescheduled) && origDateOnly === dateStr) {
        return true;
      }
      return false;
    });

    // Se houve exceção (cancelou ou remarcou), o horário original foi liberado!
    if (exception) {
      continue;
    }

    // Caso contrário, o horário está ocupado pelo cliente fixo
    return true;
  }

  return false;
};

/**
 * Valida conflitos para a criação ou alteração de um contrato de cliente fixo
 * nas próximas N semanas (padrão: 4).
 */
export const hasRecurringConflict = (
  newSchedule: Omit<RecurringSchedule, 'id'>,
  existingSchedules: RecurringSchedule[] = [],
  appointments: Appointment[] = [],
  services: Service[] = [],
  excludeScheduleId?: string,
  weeksAhead = 4
): { hasConflict: boolean; reason?: string; conflictingDate?: string } => {
  const dummySchedule: RecurringSchedule = {
    ...newSchedule,
    id: excludeScheduleId || 'temp-check',
  };

  const occurrences = getNextOccurrences(dummySchedule, weeksAhead, appointments);
  const newService = services.find((s) => s.id === newSchedule.service_id);
  const newDuration = newService?.duration_minutes || 30;
  const newStartMinutes = timeToMinutes(newSchedule.start_time);
  const newEndMinutes = newStartMinutes + newDuration;

  for (const occ of occurrences) {
    // 1. Checa contra outros clientes fixos ativos
    for (const other of existingSchedules) {
      if (excludeScheduleId && other.id === excludeScheduleId) continue;
      if (other.status !== 'ACTIVE') continue;
      if (other.professional_id !== newSchedule.professional_id) continue;
      if (!isDateOccurrenceOfRecurring(other, occ.date)) continue;

      const otherService = services.find((s) => s.id === other.service_id);
      const otherDuration = otherService?.duration_minutes || 30;
      const otherStartMinutes = timeToMinutes(other.start_time);
      const otherEndMinutes = otherStartMinutes + otherDuration;

      if (newStartMinutes < otherEndMinutes && otherStartMinutes < newEndMinutes) {
        return {
          hasConflict: true,
          reason: `Conflito com o cliente fixo ${other.client_name} (${other.start_time} - ${getFrequencyLabel(other.frequency)}) em ${occ.date}.`,
          conflictingDate: occ.date,
        };
      }
    }

    // 2. Checa contra agendamentos existentes no dia
    for (const appt of appointments) {
      if (appt.barber_id !== newSchedule.professional_id) continue;
      if (appt.date !== occ.date) continue;
      if (appt.status === 'canceled' || (appt.status as string) === 'cancelled' || appt.status === 'no_show') continue;

      const apptStart = timeToMinutes(appt.start_time);
      const apptDuration = appt.duration_minutes || 30;
      const apptEnd = apptStart + apptDuration;

      if (newStartMinutes < apptEnd && apptStart < newEndMinutes) {
        return {
          hasConflict: true,
          reason: `Já existe um agendamento com ${appt.client_name} às ${appt.start_time} no dia ${occ.date}.`,
          conflictingDate: occ.date,
        };
      }
    }
  }

  return { hasConflict: false };
};
