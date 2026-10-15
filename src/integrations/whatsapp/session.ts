import type { Env } from '../../worker';
import { dbGet, dbPut } from '../../worker';
import type { AssistantSelection } from '../../services/bookingAssistant';

// Sessão de conversa expira após 30 minutos de inatividade
const SESSION_TTL_SECONDS = 30 * 60;

const sessionKey = (phone: string): string => `wa_session:${phone}`;

const EMPTY_SELECTION: AssistantSelection = { date: '', serviceId: '', barberId: '' };

export interface WhatsAppSessionState {
  date: string;
  serviceId: string;
  barberId: string;
  clientName?: string;
  pendingTime?: string;
  pendingBarberName?: string;
  mode?: 'booking' | 'rescheduling' | 'canceling';
  reschedulingAppointmentId?: string;
}

export async function getSession(env: Env, phone: string): Promise<WhatsAppSessionState> {
  const raw = await dbGet(env, sessionKey(phone));
  if (!raw) return { ...EMPTY_SELECTION };
  try {
    const parsed = JSON.parse(raw) as Partial<WhatsAppSessionState>;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : '',
      serviceId: typeof parsed.serviceId === 'string' ? parsed.serviceId : '',
      barberId: typeof parsed.barberId === 'string' ? parsed.barberId : '',
      clientName: typeof parsed.clientName === 'string' ? parsed.clientName : undefined,
      pendingTime: typeof parsed.pendingTime === 'string' ? parsed.pendingTime : undefined,
      pendingBarberName: typeof parsed.pendingBarberName === 'string' ? parsed.pendingBarberName : undefined,
      mode: parsed.mode,
      reschedulingAppointmentId: parsed.reschedulingAppointmentId,
    };
  } catch {
    return { ...EMPTY_SELECTION };
  }
}

export async function saveSession(env: Env, phone: string, state: WhatsAppSessionState): Promise<void> {
  await dbPut(env, sessionKey(phone), JSON.stringify(state), SESSION_TTL_SECONDS);
}

export async function clearSession(env: Env, phone: string): Promise<void> {
  await dbPut(env, sessionKey(phone), JSON.stringify(EMPTY_SELECTION), 1);
}

// Compatibilidade com as Fases 3 e 4
export async function getSelection(env: Env, phone: string): Promise<AssistantSelection> {
  const state = await getSession(env, phone);
  return { date: state.date, serviceId: state.serviceId, barberId: state.barberId };
}

export async function saveSelection(env: Env, phone: string, selection: AssistantSelection): Promise<void> {
  const existing = await getSession(env, phone);
  await saveSession(env, phone, {
    ...existing,
    date: selection.date,
    serviceId: selection.serviceId,
    barberId: selection.barberId,
  });
}
