import type { Env } from '../worker';
import { PlatformNotice, PlatformNoticeDraft, safeNoticeLink } from './platformNoticeTypes';

type Dependencies = {
  db: NonNullable<Env['DB']>;
  session: () => Promise<{ owner_email: string; role: string } | null>;
  superAdmin: () => Promise<string | null>;
  tenantExists: (email: string, requireActive: boolean) => Promise<boolean>;
  listTenantEmails: () => Promise<string[]>;
};
const prefix = (email: string) => `platform-notice:${encodeURIComponent(email)}:`;
const broadcastPrefix = 'platform-notice-broadcast:';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new InputError('Envie JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Mensagem vazia.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24000) { await reader.cancel(); throw new InputError('Mensagem muito grande.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new InputError('JSON inválido.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Pedido inválido.');
  return body as Record<string, unknown>;
}
function field(body: Record<string, unknown>, key: string, max: number, required = false): string {
  const value = body[key];
  if (value !== undefined && typeof value !== 'string') throw new InputError(`Campo inválido: ${key}.`);
  const text = (value as string | undefined)?.trim() || '';
  if ((required && !text) || text.length > max) throw new InputError(`Confira o campo ${key} (máximo ${max} caracteres).`);
  return text;
}
function recipient(value: unknown, allowBroadcast = false): string {
  if (typeof value !== 'string') throw new InputError('Selecione uma barbearia.');
  if (allowBroadcast && value === '*') return '*';
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Selecione uma barbearia válida.');
  return email;
}
function noticeId(body: Record<string, unknown>): string {
  const id = field(body, 'id', 36, true);
  if (!uuid.test(id)) throw new InputError('Identificador inválido.');
  return id.toLowerCase();
}
function draftOf(body: Record<string, unknown>): PlatformNoticeDraft {
  const link = field(body, 'link', 1200);
  const safeLink = safeNoticeLink(link);
  if (safeLink === null) throw new InputError('Use um link HTTPS válido, sem usuário ou senha.');
  const image = field(body, 'image_url', 1200);
  const safeImage = safeNoticeLink(image);
  if (safeImage === null) throw new InputError('Use uma URL HTTPS válida para a imagem.');
  if (typeof body.support !== 'boolean') throw new InputError('Tipo de mensagem inválido.');
  const pix = field(body, 'pix', 140);
  if (pix && !body.support) throw new InputError('Marque apoio voluntário para informar PIX.');
  const message = field(body, 'message', 4000);
  if (!message && !safeImage) throw new InputError('Escreva uma mensagem ou informe uma imagem.');
  return { id: noticeId(body), recipient_email: recipient(body.recipient_email, true),
    title: field(body, 'title', 120) || 'Mensagem do AgendAI', message,
    support: body.support, pix, link: safeLink, image_url: safeImage };
}

async function insertNotices(db: NonNullable<Env['DB']>, notices: PlatformNotice[]): Promise<void> {
  const statements = notices.map(notice => db.prepare(`INSERT INTO app_store (key, value, expires_at, updated_at)
    VALUES (?1, ?2, NULL, ?3) ON CONFLICT(key) DO NOTHING`).bind(prefix(notice.recipient_email) + notice.id, JSON.stringify(notice), Date.now()));
  if (db.batch) {
    for (let start = 0; start < statements.length; start += 50) await db.batch(statements.slice(start, start + 50));
    return;
  }
  for (const statement of statements) await statement.run();
}

/** Independent rows, never part of a tenant's autosaved appointment snapshot.
 * The authenticated owner's email is the only tenant-feed selector, including broadcast copies.
 */
export async function handlePlatformNotices(request: Request, deps: Dependencies): Promise<Response> {
  const url = new URL(request.url);
  const admin = url.pathname === '/api/superadmin/notices';
  if (!admin && url.pathname !== '/api/notices') return reply({ error: 'Rota inexistente.' }, 404);
  if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Método não permitido.' }, 405);
  try {
    let owner = '';
    if (admin) {
      if (!await deps.superAdmin()) return reply({ error: 'Acesso exclusivo do Super Admin.' }, 403);
    } else {
      const session = await deps.session();
      if (!session) return reply({ error: 'Sessão inválida ou expirada.' }, 401);
      if (!['owner', 'admin'].includes(session.role)) return reply({ error: 'Avisos exclusivos da administração.' }, 403);
      owner = session.owner_email;
      if (!await deps.tenantExists(owner, true)) return reply({ error: 'Conta indisponível.' }, 403);
    }
    if (request.method === 'GET') {
      const email = admin ? recipient(url.searchParams.get('recipient_email'), true) : owner;
      const start = email === '*' ? broadcastPrefix : prefix(email);
      const result = await deps.db.prepare(`SELECT value FROM app_store
        WHERE key >= ?1 AND key < ?2 ${admin ? '' : "AND json_extract(value, '$.archived_at') IS NULL"}
        ORDER BY json_extract(value, '$.created_at') DESC, key DESC LIMIT 50`).bind(start, start + '\uffff').all<{ value: string }>();
      return reply({ notices: (result.results || []).map(row => JSON.parse(row.value)) });
    }
    const body = await bodyOf(request);
    if (admin && body.action === 'send') {
      const draft = draftOf(body);
      if (draft.recipient_email === '*') {
        const key = broadcastPrefix + draft.id;
        const existing = await deps.db.prepare('SELECT value FROM app_store WHERE key = ?1 LIMIT 1').bind(key).first<{ value: string }>();
        let recipients: string[];
        let notice: PlatformNotice;
        if (existing) {
          const saved = JSON.parse(existing.value) as PlatformNotice & { recipient_emails?: string[] };
          if (Object.keys(draft).some(k => draft[k as keyof PlatformNoticeDraft] !== saved[k as keyof PlatformNoticeDraft])) {
            return reply({ error: 'Este envio já foi registrado com outro conteúdo. Inicie uma nova mensagem.' }, 409);
          }
          recipients = Array.isArray(saved.recipient_emails) ? saved.recipient_emails : [];
          // Metadados globais de destinatários não pertencem ao card de uma barbearia.
          notice = { ...draft, created_at: saved.created_at, read_at: saved.read_at, archived_at: saved.archived_at };
        } else {
          recipients = Array.from(new Set((await deps.listTenantEmails()).filter(email => email && !email.startsWith('superadmin:'))));
          if (!recipients.length) return reply({ error: 'Nenhuma barbearia cadastrada foi encontrada.' }, 404);
          notice = { ...draft, created_at: new Date().toISOString(), read_at: null, archived_at: null };
          await deps.db.prepare(`INSERT INTO app_store (key, value, expires_at, updated_at)
            VALUES (?1, ?2, NULL, ?3) ON CONFLICT(key) DO NOTHING`).bind(key, JSON.stringify({ ...notice, recipient_emails: recipients }), Date.now()).run();
        }
        // Confere o manifesto vencedor também em duas requisições simultâneas.
        const persisted = await deps.db.prepare('SELECT value FROM app_store WHERE key = ?1 LIMIT 1').bind(key).first<{ value: string }>();
        if (!persisted) throw new Error('Missing broadcast after insert');
        const manifest = JSON.parse(persisted.value) as PlatformNotice & { recipient_emails: string[] };
        if (Object.keys(draft).some(k => draft[k as keyof PlatformNoticeDraft] !== manifest[k as keyof PlatformNoticeDraft])) {
          return reply({ error: 'Este envio já foi registrado com outro conteúdo. Inicie uma nova mensagem.' }, 409);
        }
        recipients = manifest.recipient_emails;
        notice = { ...draft, created_at: manifest.created_at, read_at: manifest.read_at, archived_at: manifest.archived_at };
        await insertNotices(deps.db, recipients.map(email => ({ ...notice, recipient_email: email })));
        return reply({ notice, sent_count: recipients.length });
      }
      if (!await deps.tenantExists(draft.recipient_email, false)) return reply({ error: 'Barbearia não encontrada.' }, 404);
      const notice: PlatformNotice = { ...draft, created_at: new Date().toISOString(), read_at: null, archived_at: null };
      const key = prefix(draft.recipient_email) + draft.id;
      // UUID retained by the composer across retries. A retry cannot duplicate or overwrite.
      await deps.db.prepare(`INSERT INTO app_store (key, value, expires_at, updated_at)
        VALUES (?1, ?2, NULL, ?3) ON CONFLICT(key) DO NOTHING`).bind(key, JSON.stringify(notice), Date.now()).run();
      const stored = await deps.db.prepare('SELECT value FROM app_store WHERE key = ?1 LIMIT 1').bind(key).first<{ value: string }>();
      if (!stored) throw new Error('Missing notice after insert');
      const saved: PlatformNotice = JSON.parse(stored.value);
      if (Object.keys(draft).some(k => draft[k as keyof PlatformNoticeDraft] !== saved[k as keyof PlatformNoticeDraft])) {
        return reply({ error: 'Este envio já foi registrado com outro conteúdo. Inicie uma nova mensagem.' }, 409);
      }
      return reply({ notice: saved });
    }
    const action = admin ? 'archive' : 'read';
    if (body.action !== action) throw new InputError('Ação inválida.');
    const email = admin ? recipient(body.recipient_email, true) : owner;
    const id = noticeId(body);
    const key = (email === '*' ? broadcastPrefix : prefix(email)) + id;
    const raw = await deps.db.prepare('SELECT value FROM app_store WHERE key = ?1 LIMIT 1').bind(key).first<{ value: string }>();
    if (!raw || (!admin && JSON.parse(raw.value).archived_at)) return reply({ error: 'Mensagem não encontrada.' }, 404);
    if (admin && email === '*') {
      const saved = JSON.parse(raw.value) as PlatformNotice & { recipient_emails?: string[] };
      const archivedAt = new Date().toISOString();
      await deps.db.prepare(`UPDATE app_store SET value = json_set(value, '$.archived_at', ?1), updated_at = ?2
        WHERE key = ?3 AND json_extract(value, '$.archived_at') IS NULL`).bind(archivedAt, Date.now(), key).run();
      for (const recipientEmail of saved.recipient_emails || []) {
        const recipientKey = prefix(recipientEmail) + id;
        await deps.db.prepare(`UPDATE app_store SET value = json_set(value, '$.archived_at', ?1), updated_at = ?2
          WHERE key = ?3 AND json_extract(value, '$.archived_at') IS NULL`).bind(archivedAt, Date.now(), recipientKey).run();
      }
      return reply({ success: true });
    }
    const path = admin ? '$.archived_at' : '$.read_at';
    // Atomic field update preserves concurrent read/archive and the original text.
    await deps.db.prepare(`UPDATE app_store SET value = json_set(value, ?1, ?2), updated_at = ?3
      WHERE key = ?4 AND json_extract(value, ?1) IS NULL`).bind(path, new Date().toISOString(), Date.now(), key).run();
    return reply({ success: true });
  } catch (error) {
    if (error instanceof InputError) return reply({ error: error.message }, error.status);
    // Never log message bodies, PIX keys or tokens.
    return reply({ error: 'Não foi possível processar os avisos. Tente novamente.' }, 503);
  }
}
