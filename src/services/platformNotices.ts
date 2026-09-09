import { getAuthToken } from './cloudSync';
import type { PlatformNotice, PlatformNoticeDraft } from './platformNoticeTypes';
import { isPlatformNotice } from './platformNoticeTypes';

async function call(path: string, body?: object, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET', cache: 'no-store', signal,
    headers: { Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw: unknown = await response.json().catch(() => null);
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!response.ok || !data) throw new Error(typeof data?.error === 'string' ? data.error : 'Avisos indisponíveis. Tente novamente.');
  return data;
}
export async function listPlatformNotices(email?: string, signal?: AbortSignal): Promise<PlatformNotice[]> {
  const path = email ? `/api/superadmin/notices?recipient_email=${encodeURIComponent(email)}` : '/api/notices';
  const data = await call(path, undefined, signal);
  if (!Array.isArray(data.notices) || !data.notices.every(isPlatformNotice)) throw new Error('Resposta inválida ao carregar avisos.');
  return data.notices;
}
export async function sendPlatformNotice(draft: PlatformNoticeDraft): Promise<{ notice: PlatformNotice; sentCount: number }> {
  const data = await call('/api/superadmin/notices', { ...draft, action: 'send' });
  if (!isPlatformNotice(data.notice)) throw new Error('Não foi possível confirmar o envio. Tente novamente sem editar a mensagem.');
  return { notice: data.notice, sentCount: typeof data.sent_count === 'number' ? data.sent_count : 1 };
}
export async function archivePlatformNotice(notice: PlatformNotice): Promise<void> {
  await call('/api/superadmin/notices', { action: 'archive', id: notice.id, recipient_email: notice.recipient_email });
}
export async function readPlatformNotice(id: string): Promise<void> {
  await call('/api/notices', { action: 'read', id });
}
