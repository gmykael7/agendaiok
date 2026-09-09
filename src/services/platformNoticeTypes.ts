export interface PlatformNoticeDraft {
  id: string;
  recipient_email: string;
  title: string;
  message: string;
  support: boolean;
  pix: string;
  link: string;
  image_url: string;
}

export interface PlatformNotice extends PlatformNoticeDraft {
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
}

export function isPlatformNotice(value: unknown): value is PlatformNotice {
  if (!value || typeof value !== 'object') return false;
  const n = value as Record<string, unknown>;
  return ['id', 'recipient_email', 'title', 'message', 'pix', 'link', 'created_at'].every(k => typeof n[k] === 'string')
    && (n.image_url === undefined || typeof n.image_url === 'string')
    && typeof n.support === 'boolean'
    && (n.read_at === null || typeof n.read_at === 'string')
    && (n.archived_at === null || typeof n.archived_at === 'string');
}

// Also used before rendering links; message text is never interpreted as HTML.
export function safeNoticeLink(value?: string): string | null {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
