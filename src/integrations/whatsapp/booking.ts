import type { Env, StoredPayload } from '../../worker';
import { localDateKey } from '../../utils/localDate';
import {
  loadPayloadBySlug,
  storePayload,
  SnapshotConflictError,
  validateBusinessTime,
  overlapsExistingAppointment,
  notifyAdminDevices,
} from '../../worker';
import { normalizePublicAppointment, BookingInputError } from '../../utils/publicAppointment';

export interface CreateWhatsAppBookingParams {
  tenantSlug: string;
  clientPhone: string;
  clientName: string;
  serviceId: string;
  barberId: string;
  date: string;
  startTime: string;
  whatsappMessageId: string;
}

export type CreateWhatsAppBookingResult =
  | { success: true; appointment: any }
  | {
      success: false;
      reason: 'slot_unavailable' | 'tenant_not_found' | 'suspended' | 'invalid_data' | 'concurrency_exhausted';
      message: string;
    };

export interface CancelWhatsAppBookingParams {
  tenantSlug: string;
  clientPhone: string;
  appointmentId: string;
  whatsappMessageId: string;
}

export type CancelWhatsAppBookingResult =
  | { success: true; appointment: any }
  | {
      success: false;
      reason: 'not_found' | 'tenant_not_found' | 'unauthorized' | 'concurrency_exhausted';
      message: string;
    };

export interface RescheduleWhatsAppBookingParams {
  tenantSlug: string;
  clientPhone: string;
  appointmentId: string;
  newDate: string;
  newStartTime: string;
  newBarberId?: string;
  whatsappMessageId: string;
}

export type RescheduleWhatsAppBookingResult =
  | { success: true; appointment: any; oldAppointment: any }
  | {
      success: false;
      reason: 'not_found' | 'tenant_not_found' | 'unauthorized' | 'slot_unavailable' | 'invalid_data' | 'concurrency_exhausted';
      message: string;
    };

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

export const normalizeClientPhone = (value: unknown): string => {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 12) digits = digits.slice(1);
  if (digits.length > 11) digits = digits.slice(-11);
  return digits;
};

const normalizeClientName = (value: unknown): string => String(value || '').trim().toLowerCase();

const dedupeClientRecords = (clients: any[]): any[] => {
  const map = new Map<string, any>();
  const order: string[] = [];

  for (const client of Array.isArray(clients) ? clients : []) {
    if (!client || !String(client.name || '').trim()) continue;
    const phone = normalizeClientPhone(client.phone);
    const key = phone ? `phone:${phone}` : `name:${normalizeClientName(client.name)}`;
    if (!key || key === 'name:') continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...client });
      order.push(key);
      continue;
    }

    map.set(key, {
      ...existing,
      name: existing.name || client.name,
      phone: existing.phone && existing.phone !== 'Não informado' ? existing.phone : client.phone,
      total_visits: Math.max(0, Number(existing.total_visits || 0)) + Math.max(0, Number(client.total_visits || 0)),
      total_spent: Math.max(0, Number(existing.total_spent || 0)) + Math.max(0, Number(client.total_spent || 0)),
      last_visit: existing.last_visit || client.last_visit,
      notes: existing.notes || client.notes,
    });
  }

  return order.map(key => map.get(key)).filter(Boolean);
};

const accountStatus = (payload: StoredPayload | null | undefined): 'active' | 'trial' | 'suspended' => {
  const raw = String(payload?.org?.account_status || 'active');
  return raw === 'trial' || raw === 'suspended' ? raw : 'active';
};

const MAX_BOOKING_RETRIES = 3;

/** Consulta agendamentos futuros e ativos do cliente por telefone */
export function findCustomerAppointments(payload: StoredPayload, clientPhone: string, now = new Date()): any[] {
  const phoneKey = normalizeClientPhone(clientPhone);
  if (!phoneKey) return [];
  const today = localDateKey(now);
  const appointments = Array.isArray(payload.appointments) ? payload.appointments : [];
  return appointments
    .filter((a: any) => {
      if (normalizeClientPhone(a.client_phone) !== phoneKey) return false;
      if (a.status === 'canceled' || a.status === 'no_show') return false;
      return String(a.date || '') >= today;
    })
    .sort((a: any, b: any) => {
      const dateDiff = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateDiff !== 0) return dateDiff;
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
}

/** Criação de agendamento via WhatsApp (Fase 4) */
export async function createWhatsAppBooking(
  env: Env,
  params: CreateWhatsAppBookingParams
): Promise<CreateWhatsAppBookingResult> {
  for (let attempt = 0; attempt < MAX_BOOKING_RETRIES; attempt++) {
    const current = await loadPayloadBySlug(env, params.tenantSlug);
    if (!current) {
      return { success: false, reason: 'tenant_not_found', message: 'Estabelecimento não encontrado.' };
    }

    if (accountStatus(current) === 'suspended') {
      return {
        success: false,
        reason: 'suspended',
        message: 'Este estabelecimento está temporariamente indisponível para novos agendamentos.',
      };
    }

    const appointmentInput = {
      id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      client_name: params.clientName,
      client_phone: params.clientPhone,
      date: params.date,
      start_time: params.startTime,
      barber_id: params.barberId,
      service_id: params.serviceId,
    };

    let cleanAppointment: any;
    try {
      cleanAppointment = normalizePublicAppointment(appointmentInput, {
        org: current.org,
        services: Array.isArray(current.services) ? current.services : [],
        barbers: Array.isArray(current.barbers) ? current.barbers : [],
      });
    } catch (err: any) {
      return {
        success: false,
        reason: 'invalid_data',
        message: err instanceof BookingInputError ? err.message : 'Dados inválidos para agendamento.',
      };
    }

    cleanAppointment.origin = 'whatsapp';
    cleanAppointment.whatsappMessageId = params.whatsappMessageId;

    const previousAppointments = Array.isArray(current.appointments) ? current.appointments : [];

    const businessTimeError = validateBusinessTime(cleanAppointment, current.org);
    if (businessTimeError) {
      return { success: false, reason: 'slot_unavailable', message: businessTimeError };
    }

    if (overlapsExistingAppointment(cleanAppointment, previousAppointments)) {
      return {
        success: false,
        reason: 'slot_unavailable',
        message: 'Este horário acabou de ser reservado por outro cliente.',
      };
    }

    // 1. Atualiza lista de agendamentos
    current.appointments = [cleanAppointment, ...previousAppointments];

    // 2. Atualiza cadastro no CRM de clientes
    const currentClients = dedupeClientRecords(Array.isArray(current.clients) ? current.clients : []);
    const phoneKey = normalizeClientPhone(cleanAppointment.client_phone);
    const nameKey = normalizeClientName(cleanAppointment.client_name);
    const existingClientIndex = currentClients.findIndex((client: any) => {
      const clientPhone = normalizeClientPhone(client.phone);
      const clientName = normalizeClientName(client.name);
      return (phoneKey && clientPhone === phoneKey) || (!phoneKey && nameKey && clientName === nameKey);
    });

    if (existingClientIndex >= 0) {
      const existingClient = currentClients[existingClientIndex];
      currentClients[existingClientIndex] = {
        ...existingClient,
        name: cleanAppointment.client_name || existingClient.name,
        phone: cleanAppointment.client_phone || existingClient.phone,
        total_visits: Math.max(0, Number(existingClient.total_visits || 0)) + 1,
        total_spent: Math.max(0, Number(existingClient.total_spent || 0)) + Math.max(0, Number(cleanAppointment.price || 0)),
        last_visit: cleanAppointment.date || 'Hoje',
      };
    } else {
      currentClients.unshift({
        id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        org_id: current.org?.id,
        name: cleanAppointment.client_name,
        phone: cleanAppointment.client_phone,
        total_visits: 1,
        total_spent: Math.max(0, Number(cleanAppointment.price || 0)),
        last_visit: cleanAppointment.date || 'Hoje',
      });
    }
    current.clients = currentClients;

    // 3. Notificação no painel administrativo
    const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
    const notificationId = `new-${cleanAppointment.id}`;
    const serviceLabel = String(cleanAppointment.service_name || 'Atendimento');
    const newNotification = {
      id: notificationId,
      org_id: current.org?.id,
      type: 'new_appointment',
      title: 'Novo agendamento via WhatsApp',
      message: `${String(cleanAppointment.client_name || 'Cliente')} • ${serviceLabel} • ${String(cleanAppointment.start_time || '')}`,
      created_at: cleanAppointment.created_at || new Date().toISOString(),
      appointment_id: cleanAppointment.id,
      client_name: cleanAppointment.client_name,
      target_tab: 'agenda',
    };
    current.notifications = [
      newNotification,
      ...existingNotifications.filter((n: any) => String(n?.id || '') !== notificationId),
    ].slice(0, 100);

    // 4. Salva no banco com checagem de concorrência otimista
    try {
      await storePayload(env, current, params.tenantSlug, String(current.updated_at || ''));

      const email = normalizeEmail(current.org?.email);
      if (email) {
        void notifyAdminDevices(env, email);
      }

      return { success: true, appointment: cleanAppointment };
    } catch (error: any) {
      if (error instanceof SnapshotConflictError) {
        continue;
      }
      throw error;
    }
  }

  return {
    success: false,
    reason: 'concurrency_exhausted',
    message: 'Muitas tentativas simultâneas. Tente novamente em instantes.',
  };
}

/** Cancelamento de agendamento via WhatsApp (Fase 5) */
export async function cancelWhatsAppBooking(
  env: Env,
  params: CancelWhatsAppBookingParams
): Promise<CancelWhatsAppBookingResult> {
  for (let attempt = 0; attempt < MAX_BOOKING_RETRIES; attempt++) {
    const current = await loadPayloadBySlug(env, params.tenantSlug);
    if (!current) {
      return { success: false, reason: 'tenant_not_found', message: 'Estabelecimento não encontrado.' };
    }

    const appointments = Array.isArray(current.appointments) ? current.appointments : [];
    const apptIndex = appointments.findIndex((a: any) => a.id === params.appointmentId);
    if (apptIndex === -1) {
      return { success: false, reason: 'not_found', message: 'Agendamento não encontrado.' };
    }

    const targetAppt = appointments[apptIndex];
    if (normalizeClientPhone(targetAppt.client_phone) !== normalizeClientPhone(params.clientPhone)) {
      return { success: false, reason: 'unauthorized', message: 'Não autorizado para cancelar este agendamento.' };
    }

    if (targetAppt.status === 'canceled') {
      return { success: true, appointment: targetAppt };
    }

    const canceledAppt = {
      ...targetAppt,
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_via: 'whatsapp',
      whatsappMessageId: params.whatsappMessageId,
    };
    current.appointments[apptIndex] = canceledAppt;

    // Notificação de cancelamento para o painel administrativo
    const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
    const notificationId = `cancel-${canceledAppt.id}`;
    const serviceLabel = String(canceledAppt.service_name || 'Atendimento');
    const formattedDate = String(canceledAppt.date || '').split('-').reverse().join('/');
    const cancelNotification = {
      id: notificationId,
      org_id: current.org?.id,
      type: 'appointment_canceled',
      title: 'Agendamento cancelado via WhatsApp',
      message: `${String(canceledAppt.client_name || 'Cliente')} cancelou ${serviceLabel} de ${formattedDate} às ${String(canceledAppt.start_time || '')}`,
      created_at: new Date().toISOString(),
      appointment_id: canceledAppt.id,
      client_name: canceledAppt.client_name,
      target_tab: 'agenda',
    };
    current.notifications = [
      cancelNotification,
      ...existingNotifications.filter((n: any) => String(n?.id || '') !== notificationId),
    ].slice(0, 100);

    try {
      await storePayload(env, current, params.tenantSlug, String(current.updated_at || ''));
      const email = normalizeEmail(current.org?.email);
      if (email) {
        void notifyAdminDevices(env, email);
      }
      return { success: true, appointment: canceledAppt };
    } catch (error: any) {
      if (error instanceof SnapshotConflictError) {
        continue;
      }
      throw error;
    }
  }

  return { success: false, reason: 'concurrency_exhausted', message: 'Muitas tentativas simultâneas. Tente novamente em instantes.' };
}

/** Reagendamento de agendamento via WhatsApp (Fase 5) */
export async function rescheduleWhatsAppBooking(
  env: Env,
  params: RescheduleWhatsAppBookingParams
): Promise<RescheduleWhatsAppBookingResult> {
  for (let attempt = 0; attempt < MAX_BOOKING_RETRIES; attempt++) {
    const current = await loadPayloadBySlug(env, params.tenantSlug);
    if (!current) {
      return { success: false, reason: 'tenant_not_found', message: 'Estabelecimento não encontrado.' };
    }

    const appointments = Array.isArray(current.appointments) ? current.appointments : [];
    const apptIndex = appointments.findIndex((a: any) => a.id === params.appointmentId);
    if (apptIndex === -1) {
      return { success: false, reason: 'not_found', message: 'Agendamento não encontrado.' };
    }

    const oldAppt = appointments[apptIndex];
    if (normalizeClientPhone(oldAppt.client_phone) !== normalizeClientPhone(params.clientPhone)) {
      return { success: false, reason: 'unauthorized', message: 'Não autorizado para remarcar este agendamento.' };
    }

    const targetBarberId = params.newBarberId || oldAppt.barber_id;
    const barbers = Array.isArray(current.barbers) ? current.barbers : [];
    const targetBarber = barbers.find((b: any) => b.id === targetBarberId && b.active !== false);
    if (!targetBarber) {
      return { success: false, reason: 'invalid_data', message: 'Profissional não disponível.' };
    }

    const updatedAppt = {
      ...oldAppt,
      date: params.newDate,
      start_time: params.newStartTime,
      barber_id: targetBarber.id,
      barber_name: targetBarber.full_name,
      status: 'scheduled',
      rescheduled_at: new Date().toISOString(),
      rescheduled_via: 'whatsapp',
      whatsappMessageId: params.whatsappMessageId,
    };

    const timeError = validateBusinessTime(updatedAppt, current.org);
    if (timeError) {
      return { success: false, reason: 'slot_unavailable', message: timeError };
    }

    // Valida sobreposição excluindo a vaga anterior do próprio agendamento
    const otherAppointments = appointments.filter((a: any) => a.id !== oldAppt.id);
    if (overlapsExistingAppointment(updatedAppt, otherAppointments)) {
      return { success: false, reason: 'slot_unavailable', message: 'Este horário acabou de ser reservado por outro cliente.' };
    }

    current.appointments[apptIndex] = updatedAppt;

    // Notificação de reagendamento para o painel administrativo
    const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
    const notificationId = `resched-${updatedAppt.id}-${Date.now()}`;
    const serviceLabel = String(updatedAppt.service_name || 'Atendimento');
    const formattedDate = String(updatedAppt.date || '').split('-').reverse().join('/');
    const reschedNotification = {
      id: notificationId,
      org_id: current.org?.id,
      type: 'appointment_rescheduled',
      title: 'Agendamento reagendado via WhatsApp',
      message: `${String(updatedAppt.client_name || 'Cliente')} reagendou ${serviceLabel} para ${formattedDate} às ${String(updatedAppt.start_time || '')}`,
      created_at: new Date().toISOString(),
      appointment_id: updatedAppt.id,
      client_name: updatedAppt.client_name,
      target_tab: 'agenda',
    };
    current.notifications = [
      reschedNotification,
      ...existingNotifications.filter((n: any) => String(n?.id || '') !== notificationId),
    ].slice(0, 100);

    try {
      await storePayload(env, current, params.tenantSlug, String(current.updated_at || ''));
      const email = normalizeEmail(current.org?.email);
      if (email) {
        void notifyAdminDevices(env, email);
      }
      return { success: true, appointment: updatedAppt, oldAppointment: oldAppt };
    } catch (error: any) {
      if (error instanceof SnapshotConflictError) {
        continue;
      }
      throw error;
    }
  }

  return { success: false, reason: 'concurrency_exhausted', message: 'Muitas tentativas simultâneas. Tente novamente em instantes.' };
}

export interface ConfirmWhatsAppBookingParams {
  tenantSlug: string;
  clientPhone: string;
  appointmentId: string;
  whatsappMessageId: string;
}

export type ConfirmWhatsAppBookingResult =
  | { success: true; appointment: any; alreadyConfirmed: boolean }
  | {
      success: false;
      reason: 'not_found' | 'tenant_not_found' | 'unauthorized' | 'not_confirmable' | 'concurrency_exhausted';
      message: string;
    };

/**
 * Cliente confirma presença respondendo "CONFIRMAR" no WhatsApp.
 * Só altera agendamentos ainda marcados (scheduled). Idempotente: confirmar de novo não duplica nada.
 */
export async function confirmWhatsAppBooking(
  env: Env,
  params: ConfirmWhatsAppBookingParams
): Promise<ConfirmWhatsAppBookingResult> {
  for (let attempt = 0; attempt < MAX_BOOKING_RETRIES; attempt++) {
    const current = await loadPayloadBySlug(env, params.tenantSlug);
    if (!current) {
      return { success: false, reason: 'tenant_not_found', message: 'Estabelecimento não encontrado.' };
    }

    const appointments = Array.isArray(current.appointments) ? current.appointments : [];
    const apptIndex = appointments.findIndex((a: any) => a.id === params.appointmentId);
    if (apptIndex === -1) {
      return { success: false, reason: 'not_found', message: 'Agendamento não encontrado.' };
    }

    const target = appointments[apptIndex];
    if (normalizeClientPhone(target.client_phone) !== normalizeClientPhone(params.clientPhone)) {
      return { success: false, reason: 'unauthorized', message: 'Não autorizado para confirmar este agendamento.' };
    }

    if (target.status === 'confirmed') {
      return { success: true, appointment: target, alreadyConfirmed: true };
    }
    if (target.status !== 'scheduled') {
      return {
        success: false,
        reason: 'not_confirmable',
        message: 'Este agendamento não pode ser confirmado no momento. Fale com a barbearia se precisar de ajuda.',
      };
    }

    const confirmedAppt = {
      ...target,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_via: 'whatsapp',
      whatsappMessageId: params.whatsappMessageId,
    };
    current.appointments[apptIndex] = confirmedAppt;

    const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
    const notificationId = `confirm-${confirmedAppt.id}`;
    const formattedDate = String(confirmedAppt.date || '').split('-').reverse().join('/');
    const notification = {
      id: notificationId,
      org_id: current.org?.id,
      type: 'appointment_confirmed',
      title: 'Cliente confirmou presença',
      message: `${String(confirmedAppt.client_name || 'Cliente')} confirmou ${String(confirmedAppt.service_name || 'Atendimento')} de ${formattedDate} às ${String(confirmedAppt.start_time || '')}`,
      created_at: new Date().toISOString(),
      appointment_id: confirmedAppt.id,
      target_tab: 'agenda',
    };
    current.notifications = [
      notification,
      ...existingNotifications.filter((n: any) => String(n?.id || '') !== notificationId),
    ].slice(0, 100);

    try {
      await storePayload(env, current, params.tenantSlug, String(current.updated_at || ''));
      const email = normalizeEmail(current.org?.email);
      if (email) {
        void notifyAdminDevices(env, email, {
          title: 'Cliente confirmou presença',
          body: notification.message,
          tag: notificationId,
          url: '/?tab=agenda',
        });
      }
      return { success: true, appointment: confirmedAppt, alreadyConfirmed: false };
    } catch (error: any) {
      if (error instanceof SnapshotConflictError) {
        continue;
      }
      throw error;
    }
  }

  return { success: false, reason: 'concurrency_exhausted', message: 'Muitas tentativas simultâneas. Tente novamente em instantes.' };
}
