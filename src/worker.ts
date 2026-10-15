// Cloudflare Worker Backend for AgendAI
// Static Assets + D1 como banco principal + KV legado somente para leitura/migracao + Web Push.
import { handleAssistantRequest } from './services/assistantApi';
import { handleOwnerAssistant } from './services/ownerAssistantApi';
import { encryptWebPushPayload } from './integrations/webpush/encrypt';
import { handleDirectory, handleSitemap } from './services/directoryApi';
import { handlePlatformNotices } from './services/platformNoticesApi';
import { sanitizePublicGallery, sanitizeSocialLinks } from './utils/publicShowcase';
import { BookingInputError, normalizePublicAppointment } from './utils/publicAppointment';
import { verifyWhatsAppWebhook, handleWhatsAppWebhook } from './integrations/whatsapp/webhook';
import { processWhatsAppEvent } from './integrations/whatsapp/processor';
import { handleAvailabilityRequest, handleWhatsAppFlowRequest } from './integrations/whatsapp/flow';
import { connectTenantWhatsApp, disconnectTenantWhatsApp, getTenantWhatsAppConnection } from './integrations/whatsapp/tenant';
import type { WhatsAppEvent } from './integrations/whatsapp/types';
type D1PreparedStatementLike = {
  bind: (...values: any[]) => D1PreparedStatementLike;
  first: <T = any>() => Promise<T | null>;
  run: () => Promise<any>;
  all: <T = any>() => Promise<{ results?: T[] }>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
  batch?: (statements: D1PreparedStatementLike[]) => Promise<unknown[]>;
};

export interface Env extends Partial<Pick<Cloudflare.Env, 'AI' | 'ASSISTANT_AI_ENABLED' | 'ASSISTANT_LIMITER' | 'TURNSTILE_HOSTNAMES'>> {
  TURNSTILE_SECRET?: string;
  DB?: D1DatabaseLike;
  // Mantido temporariamente apenas para importar dados antigos. Nenhuma escrita nova e feita no KV.
  AGENDAI_KV?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
    delete?: (key: string) => Promise<void>;
    list?: (options?: { prefix?: string; cursor?: string; limit?: number }) => Promise<{
      keys: Array<{ name: string }>;
      list_complete?: boolean;
      cursor?: string;
    }>;
  };
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  // --- Integração WhatsApp (Fase 1 — CODEX_WHATSAPP_INTEGRATION.md) ---
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;
  // Fallback temporário enquanto o mapeamento phone_number_id -> tenant (Fase 7) não existe.
  WHATSAPP_DEFAULT_TENANT_SLUG?: string;
  // Fase 2: fila para desacoplar o envio de resposta (chamada HTTP à Cloud API) do
  // webhook, que precisa responder rápido à Meta. Ausente em dev local; nesse caso o
  // webhook processa de forma síncrona (ver integrations/whatsapp/webhook.ts).
  WHATSAPP_QUEUE?: Queue<WhatsAppEvent>;
}

type ExecutionContextLike = { waitUntil?: (promise: Promise<unknown>) => void };
export type StoredPayload = Record<string, any>;
type CredentialRecord = { salt: string; hash: string; iterations: number };
type SessionRecord = { email: string; login_email?: string; role?: 'owner' | 'admin' | 'barber'; barber_id?: string; permissions?: Record<string, boolean>; name?: string; expires_at: number };
type SessionContext = { owner_email: string; login_email: string; role: 'owner' | 'admin' | 'barber'; barber_id?: string; permissions: Record<string, boolean>; name: string };
type PushSubscriptionRecord = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};
type VapidRecord = { publicKey: string; privateJwk: JsonWebKey };

const D1_DELETED = '__AGENDAI_D1_DELETED__';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100_000;
const VAPID_CONTACT = 'mailto:admin@agendai.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
});

type TurnstileVerification = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

const verifyTurnstile = async (
  request: Request,
  env: Env,
  token: unknown,
  expectedAction: 'public_booking' | 'product_order',
): Promise<boolean> => {
  const secret = String(env.TURNSTILE_SECRET || '').trim();
  const expectedHostnames = new Set(
    String(env.TURNSTILE_HOSTNAMES || '')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048 || !secret || expectedHostnames.size === 0) {
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) body.set('remoteip', clientIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileVerification;
    return result.success === true
      && result.action === expectedAction
      && typeof result.hostname === 'string'
      && expectedHostnames.has(result.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeSlug = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
const ALL_PERMISSIONS: Record<string, boolean> = { dashboard: true, atendimentos: true, agenda: true, caixa: true, clientes: true, relatorios: true, ajustes: true, equipe: true, usuarios: true, products: true };
const ADMIN_PERMISSIONS: Record<string, boolean> = { ...ALL_PERMISSIONS, usuarios: false };
const BARBER_PERMISSIONS: Record<string, boolean> = { dashboard: true, atendimentos: true, agenda: true, caixa: false, clientes: true, relatorios: false, ajustes: false, equipe: false, usuarios: false, products: false };
const normalizePermissions = (value: any, role: string): Record<string, boolean> => {
  const base = role === 'owner' ? ALL_PERMISSIONS : role === 'admin' ? ADMIN_PERMISSIONS : BARBER_PERMISSIONS;
  const clean: Record<string, boolean> = {};
  Object.keys(ALL_PERMISSIONS).forEach((key) => { clean[key] = typeof value?.[key] === 'boolean' ? value[key] : base[key]; });
  if (role === 'owner') Object.keys(clean).forEach((key) => { clean[key] = true; });
  return clean;
};

const normalizeClientPhone = (value: unknown): string => {
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

// D1 e a fonte de verdade. O KV antigo e consultado apenas quando uma chave ainda nao foi
// migrada; nesse caso o valor e copiado UMA VEZ para o D1. Nunca fazemos KV.put/delete/list.
const d1Get = async (env: Env, key: string): Promise<string | null | undefined> => {
  if (!env.DB) return undefined;
  const row = await env.DB.prepare(
    'SELECT value, expires_at FROM app_store WHERE key = ?1 LIMIT 1'
  ).bind(key).first<{ value: string; expires_at: number | null }>();
  if (!row) return undefined;
  if (row.value === D1_DELETED) return null;
  if (row.expires_at && row.expires_at <= Date.now()) return null;
  return row.value;
};

const d1Put = async (env: Env, key: string, value: string, expirationTtl?: number): Promise<void> => {
  if (!env.DB) throw new Error('Cloudflare D1 nao configurado. Execute npm run setup:d1 e publique novamente.');
  const expiresAt = expirationTtl ? Date.now() + (expirationTtl * 1000) : null;
  await env.DB.prepare(`
    INSERT INTO app_store (key, value, expires_at, updated_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).bind(key, value, expiresAt, Date.now()).run();
};

const legacyKvGet = async (env: Env, key: string): Promise<string | null> => {
  if (!env.AGENDAI_KV) return null;
  try { return await env.AGENDAI_KV.get(key); }
  catch (error) {
    console.warn('Falha ao ler KV legado:', error);
    return null;
  }
};

// Exportadas para reuso pelo módulo de integração WhatsApp (idempotência de eventos,
// sessão de conversa). Nenhuma mudança de comportamento — apenas visibilidade.
export const dbGet = async (env: Env, key: string): Promise<string | null> => {
  if (env.DB) {
    const fromD1 = await d1Get(env, key);
    if (fromD1 !== undefined) return fromD1;
  }

  // Compatibilidade de migracao: importa chaves existentes do antigo KV para o D1.
  const legacy = await legacyKvGet(env, key);
  if (legacy !== null && env.DB) {
    let ttl: number | undefined;
    if (key.startsWith('session:')) {
      try {
        const parsed = JSON.parse(legacy) as { expires_at?: number };
        if (parsed.expires_at) ttl = Math.max(60, Math.floor((parsed.expires_at - Date.now()) / 1000));
      } catch {}
    }
    await d1Put(env, key, legacy, ttl);
    return legacy;
  }

  return legacy ?? null;
};

export const dbPut = async (env: Env, key: string, value: string, expirationTtl?: number): Promise<void> => {
  // IMPORTANTE: todas as novas escritas vao somente para o D1.
  await d1Put(env, key, value, expirationTtl);
};

export const dbDelete = async (env: Env, key: string): Promise<void> => {
  // Tombstone impede que uma chave apagada no D1 seja "ressuscitada" pelo KV legado.
  await d1Put(env, key, D1_DELETED);
};

const dbListKeys = async (env: Env, prefix: string): Promise<string[]> => {
  if (!env.DB) return [];
  const rows = await env.DB.prepare(`
    SELECT key FROM app_store
    WHERE key LIKE ?1
      AND value <> ?2
      AND (expires_at IS NULL OR expires_at > ?3)
    ORDER BY key
    LIMIT 1000
  `).bind(`${prefix}%`, D1_DELETED, Date.now()).all<{ key: string }>();
  return (rows.results || []).map(row => row.key);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const base64UrlFromBytes = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const base64UrlFromText = (value: string): string =>
  base64UrlFromBytes(new TextEncoder().encode(value));

const derivePasswordHash = async (password: string, saltBase64: string, iterations: number): Promise<string> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltBase64) as unknown as BufferSource,
      iterations,
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
};

const createCredential = async (password: string): Promise<CredentialRecord> => {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToBase64(saltBytes);
  return {
    salt,
    hash: await derivePasswordHash(password, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS,
  };
};

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const verifyCredential = async (password: string, credential: CredentialRecord): Promise<boolean> => {
  const calculated = await derivePasswordHash(password, credential.salt, credential.iterations || PBKDF2_ITERATIONS);
  return safeEqual(calculated, credential.hash);
};

const stripSecretsFromOrg = (org: any, publicView = false) => {
  if (!org) return org;
  const clean = { ...org };
  delete clean.password;
  delete clean.password_hash;
  delete clean.passwordHash;
  clean.public_gallery = sanitizePublicGallery(clean.public_gallery);
  clean.social_links = sanitizeSocialLinks(clean.social_links);
  if (publicView) {
    delete clean.email;
    delete clean.whatsapp_confirm_template;
    delete clean.whatsapp_reminder_template;
    delete clean.whatsapp_thanks_template;
    delete clean.whatsapp_inactive_template;
    clean.closed_periods = Array.isArray(clean.closed_periods)
      ? clean.closed_periods.map((period: any) => ({
          id: String(period?.id || ''),
          date: String(period?.date || ''),
          start: period?.start ? String(period.start) : undefined,
          end: period?.end ? String(period.end) : undefined,
          all_day: period?.all_day === true,
          reason: period?.reason ? String(period.reason).slice(0, 120) : 'Fechado excepcionalmente',
        })).filter((period: any) => period.date)
      : [];
  }
  return clean;
};

const sanitizeProducts = (items: any[], orgId = '', publicView = false): any[] => (Array.isArray(items) ? items : [])
  .filter((product: any) => product && String(product.id || '').trim() && String(product.name || '').trim())
  .map((product: any) => ({
    id: String(product.id).slice(0, 160),
    org_id: orgId || (product.org_id ? String(product.org_id).slice(0, 120) : undefined),
    name: String(product.name).trim().slice(0, 160),
    description: product.description ? String(product.description).trim().slice(0, 600) : undefined,
    price: Math.max(0, Number(product.price || 0)),
    ...(publicView ? {} : { cost: Number.isFinite(Number(product.cost)) ? Math.max(0, Number(product.cost)) : undefined }),
    stock: Math.max(0, Math.floor(Number(product.stock || 0))),
    category: String(product.category || 'Geral').trim().slice(0, 100),
    sku: product.sku ? String(product.sku).trim().slice(0, 80) : undefined,
    image_url: product.image_url && /^https?:\/\//i.test(String(product.image_url)) ? String(product.image_url).slice(0, 1000) : undefined,
    active: product.active !== false,
    public_visible: product.public_visible !== false,
  }))
  .filter((product: any) => !publicView || (product.active && product.public_visible && product.stock > 0))
  .slice(0, 500);

const sanitizeProductSales = (items: any[], orgId = ''): any[] => (Array.isArray(items) ? items : [])
  .filter((sale: any) => sale && String(sale.id || '').trim())
  .map((sale: any) => {
    const saleItems = (Array.isArray(sale.items) ? sale.items : []).map((item: any) => ({
      product_id: String(item?.product_id || '').slice(0, 160),
      name: String(item?.name || 'Produto').slice(0, 160),
      price: Math.max(0, Number(item?.price || 0)),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(item?.quantity || 1)))),
      cost: Number.isFinite(Number(item?.cost)) ? Math.max(0, Number(item.cost)) : undefined,
    })).filter((item: any) => item.product_id);
    const calculatedTotal = saleItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    return {
      id: String(sale.id).slice(0, 160),
      org_id: orgId || (sale.org_id ? String(sale.org_id).slice(0, 120) : undefined),
      origin: sale.origin === 'public' ? 'public' : 'internal',
      status: ['pending', 'completed', 'canceled'].includes(String(sale.status || '')) ? sale.status : 'pending',
      items: saleItems,
      total: Math.max(0, calculatedTotal),
      customer_name: sale.customer_name ? String(sale.customer_name).trim().slice(0, 140) : undefined,
      customer_phone: sale.customer_phone ? String(sale.customer_phone).trim().slice(0, 40) : undefined,
      payment_method: ['pix', 'credit', 'debit', 'cash'].includes(String(sale.payment_method || '')) ? sale.payment_method : undefined,
      date: String(sale.date || '').slice(0, 10),
      time: String(sale.time || '').slice(0, 5),
      created_at: String(sale.created_at || new Date().toISOString()),
      completed_at: sale.completed_at ? String(sale.completed_at) : undefined,
      canceled_at: sale.canceled_at ? String(sale.canceled_at) : undefined,
    };
  })
  .filter((sale: any) => sale.items.length > 0)
  .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
  .slice(0, 1000);

const sanitizePrivatePayload = (input: StoredPayload): StoredPayload => {
  const safeInput = { ...input };
  delete safeInput.__allow_empty;
  const org = stripSecretsFromOrg(safeInput.org, false);
  const savedOrgs = Array.isArray(safeInput.savedOrgs)
    ? safeInput.savedOrgs.map((item: any) => stripSecretsFromOrg(item, false))
    : org ? [org] : [];
  const clients = dedupeClientRecords(Array.isArray(safeInput.clients) ? safeInput.clients : []);
  const currentOrgId = String(org?.id || '').trim();
  const products = sanitizeProducts(safeInput.products, currentOrgId, false);
  const productSales = sanitizeProductSales(safeInput.productSales, currentOrgId);
  const commands = (Array.isArray(safeInput.commands) ? safeInput.commands : [])
    .filter((command: any) => command && String(command.id || '').trim() && String(command.client_name || '').trim())
    .map((command: any) => ({
      id: String(command.id).slice(0, 160), org_id: currentOrgId || undefined,
      status: ['open', 'closed', 'canceled'].includes(String(command.status)) ? command.status : 'open',
      client_name: String(command.client_name).trim().slice(0, 140), client_phone: command.client_phone ? String(command.client_phone).trim().slice(0, 40) : undefined,
      barber_id: command.barber_id ? String(command.barber_id).slice(0, 160) : undefined, barber_name: command.barber_name ? String(command.barber_name).slice(0, 140) : undefined,
      service_items: (Array.isArray(command.service_items) ? command.service_items : []).map((item: any) => ({ service_id: String(item?.service_id || '').slice(0, 160), name: String(item?.name || '').trim().slice(0, 140), price: Math.max(0, Number(item?.price || 0)), duration_minutes: Math.max(0, Number(item?.duration_minutes || 0)) })).filter((item: any) => item.service_id && item.name),
      product_items: sanitizeProductSales([{ id: 'items', items: command.product_items, created_at: command.opened_at }], currentOrgId)[0]?.items || [],
      payment_method: ['pix', 'credit', 'debit', 'cash'].includes(String(command.payment_method || '')) ? command.payment_method : undefined,
      notes: command.notes ? String(command.notes).trim().slice(0, 500) : undefined, linked_appointment_id: command.linked_appointment_id ? String(command.linked_appointment_id).slice(0, 160) : undefined,
      opened_at: String(command.opened_at || new Date().toISOString()), closed_at: command.closed_at ? String(command.closed_at) : undefined, canceled_at: command.canceled_at ? String(command.canceled_at) : undefined,
    }))
    .sort((a: any, b: any) => String(b.opened_at).localeCompare(String(a.opened_at)))
    .slice(0, 1000);
  const notifications = (Array.isArray(safeInput.notifications) ? safeInput.notifications : [])
    .filter((notification: any) => {
      if (!notification || !String(notification.id || '').trim()) return false;
      const notificationOrgId = String(notification.org_id || '').trim();
      return !notificationOrgId || !currentOrgId || notificationOrgId === currentOrgId;
    })
    .map((notification: any) => ({
      id: String(notification.id).slice(0, 160),
      org_id: currentOrgId || (notification.org_id ? String(notification.org_id).slice(0, 120) : undefined),
      type: ['new_appointment', 'appointment_canceled', 'appointment_rescheduled', 'appointment_completed', 'appointment_confirmed', 'appointment_arrived', 'appointment_started', 'appointment_no_show', 'product_order'].includes(String(notification.type || ''))
        ? notification.type
        : 'new_appointment',
      title: String(notification.title || 'Notificação').slice(0, 120),
      message: String(notification.message || '').slice(0, 320),
      created_at: String(notification.created_at || new Date().toISOString()),
      read_at: notification.read_at ? String(notification.read_at) : undefined,
      appointment_id: notification.appointment_id ? String(notification.appointment_id).slice(0, 160) : undefined,
      client_id: notification.client_id ? String(notification.client_id).slice(0, 160) : undefined,
      client_name: notification.client_name ? String(notification.client_name).slice(0, 120) : undefined,
      target_tab: ['agenda', 'atendimentos', 'clientes', 'relatorios', 'produtos'].includes(String(notification.target_tab || '')) ? notification.target_tab : 'agenda',
    }))
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 100);
  return { ...safeInput, org, savedOrgs, clients, products, productSales, commands, notifications };
};

const sanitizePublicPayload = (input: StoredPayload): StoredPayload => {
  const org = stripSecretsFromOrg(input.org, true);
  const barbers = Array.isArray(input.barbers)
    ? input.barbers.map((barber: any) => ({ ...barber, phone: '', commission_rate: 0 }))
    : [];
  const appointments = Array.isArray(input.appointments)
    ? input.appointments.map((appointment: any) => ({
        ...appointment,
        client_name: 'Reservado',
        client_phone: '',
        payment_method: undefined,
      }))
    : [];

  return {
    org,
    savedOrgs: org ? [org] : [],
    services: Array.isArray(input.services) ? input.services : [],
    products: sanitizeProducts(input.products, String(org?.id || ''), true),
    productSales: [],
    commands: [],
    barbers,
    appointments,
    clients: [],
    updated_at: input.updated_at,
  };
};

const maskTvClientName = (value: unknown, fallbackIndex: number, showNames: boolean): string => {
  if (!showNames) return `Cliente ${String(fallbackIndex + 1).padStart(2, '0')}`;
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return `Cliente ${String(fallbackIndex + 1).padStart(2, '0')}`;
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
};

const sanitizeTvPayload = (input: StoredPayload, requestedDate?: string): StoredPayload => {
  const sourceOrg = input.org || {};
  const businessNow = getBusinessNow(sourceOrg);
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(requestedDate || '')) ? String(requestedDate) : businessNow.date;
  const publicOrg = stripSecretsFromOrg(sourceOrg, true) || {};
  const enabled = sourceOrg.tv_enabled === true;
  const showNames = sourceOrg.tv_show_client_names === true;
  const showPrices = sourceOrg.tv_show_prices === true;
  const mediaType = ['youtube', 'spotify', 'apple_music', 'audio', 'institutional'].includes(String(sourceOrg.tv_media_type || ''))
    ? sourceOrg.tv_media_type
    : (sourceOrg.tv_youtube_url ? 'youtube' : 'institutional');
  const mediaUrlRaw = String(sourceOrg.tv_media_url || sourceOrg.tv_youtube_url || '').trim();
  const mediaUrl = /^https?:\/\//i.test(mediaUrlRaw) ? mediaUrlRaw.slice(0, 1600) : '';
  const visualMode = ['player_queue', 'brand_queue', 'brand_products_queue'].includes(String(sourceOrg.tv_visual_mode || ''))
    ? sourceOrg.tv_visual_mode
    : (mediaType === 'institutional' ? 'brand_products_queue' : 'player_queue');

  if (!enabled) {
    return {
      enabled: false,
      org: {
        name: publicOrg.name || 'AgendAI',
        slug: publicOrg.slug || '',
        primary_color: publicOrg.primary_color || '#18d4c8',
      },
      appointments: [],
      barbers: [],
      business_date: effectiveDate,
      business_minutes: businessNow.minutes,
      server_time: new Date().toISOString(),
      updated_at: input.updated_at,
    };
  }

  const appointments = (Array.isArray(input.appointments) ? input.appointments : [])
    .filter((appointment: any) => String(appointment?.date || '') === effectiveDate && appointment?.status !== 'canceled' && appointment?.status !== 'no_show')
    .sort((a: any, b: any) => String(a?.start_time || '').localeCompare(String(b?.start_time || '')))
    .map((appointment: any, index: number) => ({
      id: String(appointment.id || `tv-${index}`),
      client_name: maskTvClientName(appointment.client_name, index, showNames),
      service_name: String(appointment.service_name || (Array.isArray(appointment.services) ? appointment.services.map((service: any) => service?.name).filter(Boolean).join(' + ') : '') || 'Atendimento'),
      barber_name: String(appointment.barber_name || 'Profissional'),
      barber_id: String(appointment.barber_id || ''),
      start_time: String(appointment.start_time || ''),
      duration_minutes: Math.max(0, Number(appointment.duration_minutes || 0)),
      status: ['confirmed', 'arrived', 'in_progress', 'completed'].includes(String(appointment.status || '')) ? appointment.status : 'scheduled',
      price: showPrices ? Math.max(0, Number(appointment.price || 0)) : undefined,
    }));

  const barbers = (Array.isArray(input.barbers) ? input.barbers : [])
    .filter((barber: any) => barber?.active !== false)
    .map((barber: any) => ({
      id: String(barber.id || ''),
      full_name: String(barber.full_name || 'Profissional'),
      role: String(barber.role || 'Barbeiro'),
      avatar_url: barber.avatar_url ? String(barber.avatar_url) : undefined,
    }));

  return {
    enabled: true,
    org: {
      id: publicOrg.id,
      name: publicOrg.name,
      slug: publicOrg.slug,
      phone: publicOrg.phone,
      address: publicOrg.address,
      primary_color: publicOrg.primary_color,
      open_hour: publicOrg.open_hour,
      close_hour: publicOrg.close_hour,
      cover_image_url: publicOrg.cover_image_url && /^https?:\/\//i.test(String(publicOrg.cover_image_url)) ? String(publicOrg.cover_image_url).slice(0, 1000) : undefined,
      logo_image_url: publicOrg.logo_image_url && /^https?:\/\//i.test(String(publicOrg.logo_image_url)) ? String(publicOrg.logo_image_url).slice(0, 1000) : undefined,
      tv_youtube_url: mediaType === 'youtube' ? mediaUrl : '',
      tv_media_type: mediaType,
      tv_media_url: mediaUrl,
      tv_visual_mode: visualMode,
      tv_animations: sourceOrg.tv_animations !== false,
      tv_notice: sourceOrg.tv_notice || '',
      tv_show_client_names: showNames,
      tv_show_prices: showPrices,
      tv_sound_enabled: sourceOrg.tv_sound_enabled !== false,
      tv_sound_volume: Math.min(100, Math.max(0, Number(sourceOrg.tv_sound_volume ?? 70))),
      tv_sound_style: ['bell', 'soft', 'attention'].includes(String(sourceOrg.tv_sound_style || '')) ? sourceOrg.tv_sound_style : 'bell',
    },
    appointments,
    barbers,
    products: sanitizeProducts(input.products, String(publicOrg.id || ''), true).slice(0, 18),
    business_date: effectiveDate,
    business_minutes: businessNow.minutes,
    server_time: new Date().toISOString(),
    updated_at: input.updated_at,
  };
};


const accountStatus = (payload: StoredPayload | null | undefined): 'active' | 'trial' | 'suspended' => {
  const raw = String(payload?.org?.account_status || 'active');
  return raw === 'trial' || raw === 'suspended' ? raw : 'active';
};

const listTenantPayloads = async (env: Env): Promise<Array<{ email: string; payload: StoredPayload }>> => {
  const keys = await dbListKeys(env, 'user:');
  const items: Array<{ email: string; payload: StoredPayload }> = [];
  for (const key of keys) {
    const raw = await dbGet(env, key);
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw) as StoredPayload;
      const email = normalizeEmail(payload.org?.email || key.slice(5));
      if (email) items.push({ email, payload });
    } catch {}
  }
  return items;
};

const getSuperAdminEmail = async (env: Env): Promise<string> => normalizeEmail(await dbGet(env, 'superadmin:email'));

const getSuperAdminSession = async (request: Request, env: Env): Promise<string | null> => {
  const session = await getSessionContext(request, env);
  if (!session || session.role !== 'owner' || session.login_email !== session.owner_email) return null;
  const adminEmail = await getSuperAdminEmail(env);
  return adminEmail && adminEmail === session.owner_email ? session.owner_email : null;
};

const createSession = async (env: Env, email: string, context?: Partial<SessionContext>): Promise<string> => {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const token = base64UrlFromBytes(random);
  const role = context?.role || 'owner';
  const record: SessionRecord = {
    email,
    login_email: context?.login_email || email,
    role,
    barber_id: context?.barber_id,
    permissions: normalizePermissions(context?.permissions, role),
    name: context?.name || '',
    expires_at: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  await dbPut(env, `session:${token}`, JSON.stringify(record), SESSION_TTL_SECONDS);
  return token;
};

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const getSessionContext = async (request: Request, env: Env): Promise<SessionContext | null> => {
  const token = getBearerToken(request);
  if (!token) return null;
  const raw = await dbGet(env, `session:${token}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SessionRecord;
    if (!session.email || session.expires_at <= Date.now()) {
      await dbDelete(env, `session:${token}`);
      return null;
    }
    const role = session.role || 'owner';
    return {
      owner_email: normalizeEmail(session.email),
      login_email: normalizeEmail(session.login_email || session.email),
      role,
      barber_id: session.barber_id,
      permissions: normalizePermissions(session.permissions, role),
      name: String(session.name || ''),
    };
  } catch { return null; }
};

const getSessionEmail = async (request: Request, env: Env): Promise<string | null> => {
  const session = await getSessionContext(request, env);
  return session?.owner_email || null;
};

const getCurrentUserPayload = (session: SessionContext, payload?: StoredPayload) => ({
  email: session.login_email,
  name: session.name || (session.role === 'owner' ? String(payload?.org?.owner_name || 'Proprietário') : session.login_email),
  role: session.role,
  barber_id: session.barber_id,
  permissions: normalizePermissions(session.permissions, session.role),
});

const privatePayloadForSession = (payload: StoredPayload, session: SessionContext): StoredPayload => {
  const safe = sanitizePrivatePayload(payload);
  if (session.role === 'owner') return safe;
  if (session.role === 'barber') {
    const barberId = String(session.barber_id || '');
    const ownAppointments = (Array.isArray(safe.appointments) ? safe.appointments : []).filter((a: any) => String(a.barber_id || '') === barberId);
    const ownIds = new Set(ownAppointments.map((a: any) => String(a.id || '')));
    safe.appointments = ownAppointments.map((a: any) => (!session.permissions.caixa && !session.permissions.relatorios ? { ...a, payment_method: undefined } : a));
    safe.notifications = (Array.isArray(safe.notifications) ? safe.notifications : []).filter((n: any) => n.type === 'product_order' ? Boolean(session.permissions.products) : (!n.appointment_id || ownIds.has(String(n.appointment_id))));
    if (!session.permissions.clientes) safe.clients = [];
    safe.barbers = (Array.isArray(safe.barbers) ? safe.barbers : []).map((b: any) => ({ ...b, commission_rate: b.id === barberId && session.permissions.caixa ? b.commission_rate : 0, phone: b.id === barberId ? b.phone : '' }));
    if (!session.permissions.ajustes) {
      safe.org = { ...safe.org, pix_key: undefined, pix_holder: undefined, whatsapp_confirm_template: undefined, whatsapp_reminder_template: undefined, whatsapp_thanks_template: undefined, whatsapp_inactive_template: undefined };
    }
  } else if (!session.permissions.caixa && !session.permissions.relatorios) {
    safe.appointments = (Array.isArray(safe.appointments) ? safe.appointments : []).map((a: any) => ({ ...a, payment_method: undefined }));
    safe.commands = [];
  }
  if (!session.permissions.products) {
    safe.products = [];
    safe.productSales = [];
    safe.notifications = (Array.isArray(safe.notifications) ? safe.notifications : []).filter((n: any) => n.type !== 'product_order');
  }
  return safe;
};

export class SnapshotConflictError extends Error {}

export const storePayload = async (env: Env, payload: StoredPayload, previousSlug?: string, expectedRevision?: string): Promise<StoredPayload> => {
  const previousTime = Date.parse(String(payload.updated_at || ''));
  const nextTime = Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0);
  const cleanPayload = sanitizePrivatePayload({ ...payload, updated_at: new Date(nextTime).toISOString() });
  const email = normalizeEmail(cleanPayload.org?.email);
  const slug = normalizeSlug(cleanPayload.org?.slug);
  if (!email || !slug) throw new Error('E-mail e slug são obrigatórios.');

  const currentSlugMapping = await dbGet(env, `slug:${slug}`);
  if (currentSlugMapping && currentSlugMapping !== email) {
    let mappedEmail = '';
    try { mappedEmail = normalizeEmail(JSON.parse(currentSlugMapping)?.org?.email); } catch {}
    if (mappedEmail !== email) throw new SnapshotConflictError('Este link já está em uso por outra barbearia. Escolha outro.');
  }

  // O snapshot completo existe apenas uma vez. O slug guarda somente o e-mail da conta,
  // evitando duplicar o payload em duas chaves a cada salvamento.
  const serialized = JSON.stringify(cleanPayload);
  if (expectedRevision !== undefined) {
    if (!env.DB) throw new Error('Armazenamento indisponível.');
    const result = await env.DB.prepare(`UPDATE app_store SET value = ?2, expires_at = NULL, updated_at = ?3
      WHERE key = ?1 AND COALESCE(json_extract(value, '$.updated_at'), '') = ?4`)
      .bind(`user:${email}`, serialized, Date.now(), expectedRevision).run();
    // D1 usa meta.changes; o adaptador SQLite dos testes expõe changes diretamente.
    if (Number(result.meta?.changes ?? result.changes) !== 1) throw new SnapshotConflictError('A agenda foi atualizada durante esta operação. Tente novamente.');
  } else {
    await dbPut(env, `user:${email}`, serialized);
  }

  const mappingAlreadyCorrect = currentSlugMapping === email;
  if (!mappingAlreadyCorrect) await dbPut(env, `slug:${slug}`, email);
  if (previousSlug && previousSlug !== slug) await dbDelete(env, `slug:${previousSlug}`);

  return cleanPayload;
};

// Exportada para reuso pela integração WhatsApp (Fase 3 — consulta de disponibilidade,
// somente leitura). Não expõe storePayload/SnapshotConflictError: escrita de agendamento
// via WhatsApp é decidida na Fase 4, reaproveitando a mesma validação do fluxo público.
export const loadPayloadBySlug = async (env: Env, slugValue: unknown): Promise<StoredPayload | null> => {
  const slug = normalizeSlug(slugValue);
  if (!slug) return null;
  const rawMapping = await dbGet(env, `slug:${slug}`);
  if (!rawMapping) return null;

  // Formato novo: slug -> e-mail -> user:e-mail.
  if (!rawMapping.trim().startsWith('{')) {
    const email = normalizeEmail(rawMapping);
    if (!email) return null;
    const rawUser = await dbGet(env, `user:${email}`);
    if (!rawUser) return null;
    try { return JSON.parse(rawUser) as StoredPayload; } catch { return null; }
  }

  // Formato legado do KV: slug continha o snapshot inteiro. Migra na primeira leitura.
  try {
    const legacyPayload = JSON.parse(rawMapping) as StoredPayload;
    const email = normalizeEmail(legacyPayload.org?.email);
    if (!email) return legacyPayload;
    const rawUser = await dbGet(env, `user:${email}`);
    if (!rawUser) await dbPut(env, `user:${email}`, JSON.stringify(sanitizePrivatePayload(legacyPayload)));
    await dbPut(env, `slug:${slug}`, email);
    return rawUser ? JSON.parse(rawUser) as StoredPayload : legacyPayload;
  } catch {
    return null;
  }
};

const payloadForCompare = (payload: StoredPayload): string => {
  const normalized = sanitizePrivatePayload({ ...payload });
  delete normalized.updated_at;
  delete normalized.__allow_empty;
  return JSON.stringify(normalized);
};

const payloadDataCount = (payload: StoredPayload): number =>
  (Array.isArray(payload.services) ? payload.services.length : 0) +
  (Array.isArray(payload.barbers) ? payload.barbers.length : 0) +
  (Array.isArray(payload.appointments) ? payload.appointments.length : 0) +
  (Array.isArray(payload.clients) ? payload.clients.length : 0) +
  (Array.isArray(payload.products) ? payload.products.length : 0) +
  (Array.isArray(payload.productSales) ? payload.productSales.length : 0) +
  (Array.isArray(payload.commands) ? payload.commands.length : 0);

const minutesFromTime = (value: string): number => {
  const [h, m] = String(value || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const getBusinessNow = (org: any): { date: string; minutes: number } => {
  // AgendAI opera inicialmente no fuso do RN. Se a organização passar a ter
  // um timezone próprio, ele é respeitado automaticamente sem migração de banco.
  const timeZone = String(org?.timezone || 'America/Fortaleza');
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      minutes: Number(values.hour || 0) * 60 + Number(values.minute || 0),
    };
  } catch {
    const now = new Date();
    // Fallback conservador para UTC-3, fuso padrão atual do RN.
    const shifted = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return {
      date: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`,
      minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    };
  }
};

export const validateBusinessTime = (appointment: any, org: any): string | null => {
  const start = minutesFromTime(String(appointment.start_time || ''));
  const duration = Math.max(5, Number(appointment.duration_minutes || 30));
  const end = start + duration;
  const open = minutesFromTime(String(org?.open_hour || '08:00'));
  const close = minutesFromTime(String(org?.close_hour || '20:00'));

  if (start < open || end > close) {
    return 'Este horário está fora do expediente da barbearia.';
  }

  const appointmentDate = String(appointment?.date || '');
  const businessNow = getBusinessNow(org);
  if (appointmentDate < businessNow.date) {
    return 'Esta data já passou. Escolha uma nova data para o agendamento.';
  }
  if (appointmentDate === businessNow.date && start <= businessNow.minutes) {
    return 'Este horário já passou. Escolha um horário futuro.';
  }

  const closedPeriods = Array.isArray(org?.closed_periods) ? org.closed_periods : [];
  const matchingClosure = closedPeriods.find((period: any) => {
    if (String(period?.date || '') !== appointmentDate) return false;
    if (period?.all_day === true) return true;
    const closureStart = minutesFromTime(String(period?.start || ''));
    const closureEnd = minutesFromTime(String(period?.end || ''));
    return closureEnd > closureStart && start < closureEnd && closureStart < end;
  });
  if (matchingClosure) {
    const reason = String(matchingClosure?.reason || 'Fechado excepcionalmente');
    if (matchingClosure?.all_day === true) {
      return `${reason}. O estabelecimento não terá atendimento nesta data.`;
    }
    return `${reason}. O estabelecimento estará fechado das ${matchingClosure?.start || '--:--'} às ${matchingClosure?.end || '--:--'}. Escolha outro horário.`;
  }

  if (org?.break_enabled === true) {
    const breakStart = minutesFromTime(String(org?.break_start || '12:00'));
    const breakEnd = minutesFromTime(String(org?.break_end || '14:00'));
    if (breakEnd > breakStart && start < breakEnd && breakStart < end) {
      return `A barbearia está em descanso das ${org?.break_start || '12:00'} às ${org?.break_end || '14:00'}. Escolha outro horário.`;
    }
  }

  return null;
};

export const overlapsExistingAppointment = (appointment: any, existing: any[]): boolean => {
  const date = String(appointment.date || '');
  const barberId = String(appointment.barber_id || '');
  const start = minutesFromTime(appointment.start_time);
  const duration = Math.max(5, Number(appointment.duration_minutes || 30));
  const end = start + duration;
  return existing.some((item: any) => {
    if (item.status === 'canceled' || item.status === 'no_show') return false;
    if (String(item.date || '') !== date) return false;
    if (String(item.barber_id || '') !== barberId) return false;
    const itemStart = minutesFromTime(item.start_time);
    const itemDuration = Math.max(5, Number(item.duration_minutes || 30));
    return start < itemStart + itemDuration && itemStart < end;
  });
};

// ---------- WEB PUSH ----------
const getOrCreateVapidKeys = async (env: Env): Promise<VapidRecord> => {
  const stored = await dbGet(env, 'push:vapid');
  if (stored) {
    try { return JSON.parse(stored) as VapidRecord; } catch {}
  }

  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const record: VapidRecord = { publicKey: base64UrlFromBytes(publicRaw), privateJwk };
  await dbPut(env, 'push:vapid', JSON.stringify(record));
  return record;
};

const createVapidJwt = async (endpoint: string, vapid: VapidRecord): Promise<string> => {
  const audience = new URL(endpoint).origin;
  const header = base64UrlFromText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64UrlFromText(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    sub: VAPID_CONTACT,
  }));
  const signingInput = `${header}.${payload}`;
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    vapid.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
};

const subscriptionKeyId = async (endpoint: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return base64UrlFromBytes(new Uint8Array(digest)).slice(0, 32);
};

export type PushPayload = { title: string; body: string; tag?: string; url?: string };

const sendPushToSubscription = async (
  env: Env,
  keyName: string,
  subscription: PushSubscriptionRecord,
  payload?: PushPayload
): Promise<void> => {
  if (!subscription.endpoint) return;
  try {
    const vapid = await getOrCreateVapidKeys(env);
    const jwt = await createVapidJwt(subscription.endpoint, vapid);
    const baseHeaders = {
      TTL: '120',
      Urgency: 'high',
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    };

    // Tenta enviar o conteúdo cifrado (RFC 8291). Se a cifragem falhar ou o serviço
    // recusar o corpo, reenvia sem payload: o service worker mostra o texto padrão.
    let response: Response | null = null;
    if (payload && subscription.keys?.p256dh && subscription.keys?.auth) {
      try {
        const body = await encryptWebPushPayload(JSON.stringify(payload), {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        });
        response = await fetch(subscription.endpoint, {
          method: 'POST',
          headers: { ...baseHeaders, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' },
          body,
        });
        if (response.status !== 400 && response.status !== 413 && response.status !== 401 && response.status !== 403) {
          // resposta aceita ou erro não relacionado ao corpo: segue o fluxo normal
        } else {
          console.warn('Web Push com payload recusado, reenviando sem corpo:', response.status);
          response = null;
        }
      } catch (error) {
        console.warn('Falha ao cifrar payload Web Push, reenviando sem corpo:', error);
        response = null;
      }
    }
    if (!response) {
      response = await fetch(subscription.endpoint, { method: 'POST', headers: baseHeaders });
    }

    if (response.status === 404 || response.status === 410) await dbDelete(env, keyName);
    if (!response.ok && response.status !== 201 && response.status !== 202) {
      console.warn('Web Push rejeitado:', response.status, await response.text().catch(() => ''));
    }
  } catch (error) {
    console.error('Falha ao enviar Web Push:', error);
  }
};

export const notifyAdminDevices = async (env: Env, email: string, payload?: PushPayload): Promise<void> => {
  const keys = await dbListKeys(env, `pushsub:${email}:`);
  await Promise.all(keys.slice(0, 25).map(async key => {
    const raw = await dbGet(env, key);
    if (!raw) return;
    try { await sendPushToSubscription(env, key, JSON.parse(raw), payload); }
    catch { await dbDelete(env, key); }
  }));
};

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    if (url.pathname === '/sitemap.xml' && request.method === 'GET') return handleSitemap(env.DB);
    if (url.pathname === '/api/directory') return handleDirectory(request, env.DB);

    if (url.pathname.startsWith('/api/') && !env.DB) {
      return jsonResponse({ error: 'Banco D1 não configurado. Execute npm run setup:d1 uma única vez e depois npm run deploy.' }, 503);
    }

    // Integração WhatsApp (Fase 1 — ver CODEX_WHATSAPP_INTEGRATION.md). Endpoint dedicado,
    // desacoplado do restante da API: não usa CORS nem sessão de painel, a Meta autentica
    // via hub.verify_token (GET) e assinatura HMAC do corpo (POST).
    if (url.pathname === '/api/whatsapp/webhook') {
      if (request.method === 'GET') return verifyWhatsAppWebhook(url, env);
      if (request.method === 'POST') return handleWhatsAppWebhook(request, env);
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Disponibilidade de horários para WhatsApp Flows e integrações externas (Fase 6)
    if (url.pathname === '/api/availability' && (request.method === 'GET' || request.method === 'OPTIONS')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
      return handleAvailabilityRequest(url, env);
    }

    // Endpoint de Data Exchange para WhatsApp Flows da Meta (Fase 6)
    if (url.pathname === '/api/whatsapp/flow' && request.method === 'POST') {
      return handleWhatsAppFlowRequest(request, env);
    }

    // Gestão de Conexão WhatsApp por Estabelecimento (Fase 7 - Embedded Signup)
    if (url.pathname === '/api/whatsapp/connection' && (request.method === 'GET' || request.method === 'OPTIONS')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
      const session = await getSessionContext(request, env);
      if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
      if (session.role !== 'owner' && !session.permissions.ajustes) return jsonResponse({ error: 'Sem permissão para consultar a conexão do WhatsApp.' }, 403);
      const raw = await dbGet(env, `user:${session.owner_email}`);
      if (!raw) return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
      const payload = JSON.parse(raw) as StoredPayload;
      const slug = normalizeSlug(payload.org?.slug);
      const connection = await getTenantWhatsAppConnection(env, slug);
      return jsonResponse({ connection });
    }

    if (url.pathname === '/api/whatsapp/connect' && (request.method === 'POST' || request.method === 'OPTIONS')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
      const session = await getSessionContext(request, env);
      if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
      if (session.role !== 'owner' && !session.permissions.ajustes) return jsonResponse({ error: 'Sem permissão para conectar o WhatsApp.' }, 403);
      const raw = await dbGet(env, `user:${session.owner_email}`);
      if (!raw) return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
      const payload = JSON.parse(raw) as StoredPayload;
      const slug = normalizeSlug(payload.org?.slug);

      try {
        const body = (await request.json()) as any;
        const connection = await connectTenantWhatsApp(env, slug, {
          phoneNumberId: body?.phoneNumberId,
          businessAccountId: body?.businessAccountId,
          displayPhoneNumber: body?.displayPhoneNumber,
          verifiedName: body?.verifiedName,
        });
        return jsonResponse({ success: true, connection });
      } catch (err: any) {
        return jsonResponse({ error: err?.message || 'Falha ao conectar WhatsApp.' }, 400);
      }
    }

    if (url.pathname === '/api/whatsapp/disconnect' && (request.method === 'POST' || request.method === 'OPTIONS')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
      const session = await getSessionContext(request, env);
      if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
      if (session.role !== 'owner' && !session.permissions.ajustes) return jsonResponse({ error: 'Sem permissão para desconectar o WhatsApp.' }, 403);
      const raw = await dbGet(env, `user:${session.owner_email}`);
      if (!raw) return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
      const payload = JSON.parse(raw) as StoredPayload;
      const slug = normalizeSlug(payload.org?.slug);

      try {
        const connection = await disconnectTenantWhatsApp(env, slug);
        return jsonResponse({ success: true, connection });
      } catch (err: any) {
        return jsonResponse({ error: err?.message || 'Falha ao desconectar WhatsApp.' }, 400);
      }
    }

    // Avisos privados e direcionados, fora dos snapshots administrativos.
    if (url.pathname === '/api/notices' || url.pathname === '/api/superadmin/notices') {
      return handlePlatformNotices(request, {
        db: env.DB!,
        session: () => getSessionContext(request, env),
        superAdmin: () => getSuperAdminSession(request, env),
        tenantExists: async (email, requireActive) => {
          const raw = await dbGet(env, `user:${email}`);
          if (!raw) return false;
          const payload = JSON.parse(raw) as StoredPayload;
          return Boolean(payload.org) && (!requireActive || accountStatus(payload) !== 'suspended');
        },
        listTenantEmails: async () => {
          const keys = await dbListKeys(env, 'user:');
          return keys.map(key => normalizeEmail(key.slice('user:'.length))).filter(Boolean);
        },
      });
    }

    // Piloto somente leitura: o agendamento continua sendo confirmado por /api/appointment.
    if (url.pathname === '/api/owner-assistant') {
      // Só o próprio barbeiro logado. A IA responde com o guia fixo; nenhum dado da conta entra no prompt.
      const session = await getSessionContext(request, env);
      if (!session?.login_email) return jsonResponse({ error: 'unauthorized' }, 401);
      return handleOwnerAssistant(request, env, session.login_email);
    }
    if (url.pathname === '/api/assistant') {
      return handleAssistantRequest(request, env, async (slug) => {
        const payload = await loadPayloadBySlug(env, slug);
        if (!payload || accountStatus(payload) === 'suspended') return null;
        return {
          org: payload.org,
          services: Array.isArray(payload.services) ? payload.services : [],
          barbers: Array.isArray(payload.barbers) ? payload.barbers : [],
          appointments: Array.isArray(payload.appointments) ? payload.appointments : [],
        };
      });
    }

    // Chave pública VAPID: pode ser lida sem autenticação para criar a assinatura do navegador.
    if (url.pathname === '/api/push/public-key' && request.method === 'GET') {
      const vapid = await getOrCreateVapidKeys(env);
      return jsonResponse({ publicKey: vapid.publicKey });
    }

    // Registra este aparelho na conta autenticada.
    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      try {
        const email = await getSessionEmail(request, env);
        if (!email) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
        const body = await request.json() as any;
        const subscription = body.subscription as PushSubscriptionRecord;
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
          return jsonResponse({ error: 'Assinatura de notificações inválida.' }, 400);
        }
        const id = await subscriptionKeyId(subscription.endpoint);
        await dbPut(env, `pushsub:${email}:${id}`, JSON.stringify(subscription));
        return jsonResponse({ success: true });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao ativar notificações.' }, 500);
      }
    }

    // Cadastro
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const payload = body.payload || body.data || body;
        const password = String(body.password || '').trim();
        const email = normalizeEmail(payload.org?.email);
        const slug = normalizeSlug(payload.org?.slug);

        if (!email || !email.includes('@') || !slug) return jsonResponse({ error: 'Informe um e-mail válido e um slug.' }, 400);
        if (password.length < 6) return jsonResponse({ error: 'A senha deve ter no mínimo 6 caracteres.' }, 400);
        if (await dbGet(env, `user:${email}`) || await dbGet(env, `staff:${email}`)) return jsonResponse({ error: 'Este e-mail já possui cadastro ou acesso de equipe.' }, 409);
        if (await dbGet(env, `slug:${slug}`)) return jsonResponse({ error: 'Este link/slug já está em uso.' }, 409);

        const credential = await createCredential(password);
        await dbPut(env, `auth:${email}`, JSON.stringify(credential));
        payload.org = {
          ...payload.org,
          account_status: ['active', 'trial', 'suspended'].includes(String(payload.org?.account_status || '')) ? payload.org.account_status : 'trial',
          plan: ['trial', 'basic', 'professional', 'premium'].includes(String(payload.org?.plan || '')) ? payload.org.plan : 'trial',
          created_at: payload.org?.created_at || new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        };
        const stored = await storePayload(env, payload);
        const context = { owner_email: email, login_email: email, role: 'owner' as const, permissions: normalizePermissions(null, 'owner'), name: String(stored.org?.owner_name || 'Proprietário') };
        const token = await createSession(env, email, context);
        stored.current_user = getCurrentUserPayload(context, stored);
        return jsonResponse({ success: true, token, data: stored }, 201);
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao criar cadastro.' }, 500);
      }
    }

    // Login de proprietário, administrador ou barbeiro.
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const loginEmail = normalizeEmail(body.email);
        const password = String(body.password || '');
        if (!loginEmail || !password) return jsonResponse({ error: 'E-mail e senha são obrigatórios.' }, 400);

        let ownerEmail = loginEmail;
        let role: 'owner' | 'admin' | 'barber' = 'owner';
        let barberId: string | undefined;
        let permissions = normalizePermissions(null, 'owner');
        let userName = '';
        const staffRaw = await dbGet(env, `staff:${loginEmail}`);
        if (staffRaw) {
          const staff = JSON.parse(staffRaw) as any;
          if (staff.active === false) return jsonResponse({ error: 'Este usuário está desativado.' }, 403);
          ownerEmail = normalizeEmail(staff.owner_email);
          role = staff.role === 'admin' ? 'admin' : 'barber';
          barberId = staff.barber_id ? String(staff.barber_id) : undefined;
          permissions = normalizePermissions(staff.permissions, role);
          userName = String(staff.name || '');
        }

        const rawData = await dbGet(env, `user:${ownerEmail}`);
        if (!rawData) return jsonResponse({ error: 'Cadastro não encontrado.' }, 401);
        let data = JSON.parse(rawData) as StoredPayload;
        const rawCredential = await dbGet(env, `auth:${loginEmail}`);
        let valid = false;
        if (rawCredential) valid = await verifyCredential(password, JSON.parse(rawCredential) as CredentialRecord);
        else if (role === 'owner') {
          const legacyPassword = String(data.org?.password || '');
          if (legacyPassword && safeEqual(legacyPassword, password)) {
            valid = true;
            await dbPut(env, `auth:${loginEmail}`, JSON.stringify(await createCredential(password)));
            data = await storePayload(env, data, normalizeSlug(data.org?.slug));
          }
        }
        if (!valid) return jsonResponse({ error: 'E-mail ou senha incorretos.' }, 401);
        if (accountStatus(data) === 'suspended') {
          const recoveryAdminEmail = body.purpose === 'superadmin'
            && role === 'owner'
            && loginEmail === ownerEmail
            ? await getSuperAdminEmail(env)
            : '';
          if (!recoveryAdminEmail || recoveryAdminEmail !== ownerEmail) {
            return jsonResponse({ error: 'Esta conta está suspensa. Entre em contato com o suporte do AgendAI.' }, 403);
          }
        }

        if (role === 'owner') {
          userName = String(data.org?.owner_name || 'Proprietário');
          data.org = { ...data.org, last_login_at: new Date().toISOString() };
          data = await storePayload(env, data, normalizeSlug(data.org?.slug));
        } else {
          const staff = JSON.parse(staffRaw as string) as any;
          staff.last_login_at = new Date().toISOString();
          await dbPut(env, `staff:${loginEmail}`, JSON.stringify(staff));
          const idxRaw = await dbGet(env, `staffindex:${ownerEmail}`);
          if (idxRaw) {
            try {
              const list = JSON.parse(idxRaw) as any[];
              const next = list.map(item => normalizeEmail(item.email) === loginEmail ? { ...item, last_login_at: staff.last_login_at } : item);
              await dbPut(env, `staffindex:${ownerEmail}`, JSON.stringify(next));
            } catch {}
          }
        }

        data = sanitizePrivatePayload(data);
        const context = { owner_email: ownerEmail, login_email: loginEmail, role, barber_id: barberId, permissions, name: userName };
        const token = await createSession(env, ownerEmail, context);
        data.current_user = getCurrentUserPayload(context, data);
        return jsonResponse({ success: true, token, data });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao autenticar.' }, 500);
      }
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const token = getBearerToken(request);
      if (token) await dbDelete(env, `session:${token}`);
      return jsonResponse({ success: true });
    }


    // Super Admin Agência G7. Enquanto nenhum Super Admin estiver configurado,
    // uma conta proprietária autenticada pode realizar a ativação inicial uma única vez.
    // Depois de gravado superadmin:email, somente essa conta terá acesso global.
    if (url.pathname === '/api/superadmin/status' && request.method === 'GET') {
      const session = await getSessionContext(request, env);
      const ownerSession = session?.role === 'owner' && session.login_email === session.owner_email ? session : null;
      const sessionEmail = ownerSession?.owner_email || '';
      const adminEmail = await getSuperAdminEmail(env);
      return jsonResponse({
        configured: Boolean(adminEmail),
        authorized: Boolean(sessionEmail && adminEmail && sessionEmail === adminEmail),
        canBootstrap: Boolean(sessionEmail && !adminEmail),
        email: sessionEmail && adminEmail && sessionEmail === adminEmail ? adminEmail : undefined,
      });
    }

    if (url.pathname === '/api/superadmin/bootstrap' && request.method === 'POST') {
      const session = await getSessionContext(request, env);
      if (!session || session.role !== 'owner' || session.login_email !== session.owner_email) return jsonResponse({ error: 'Apenas a conta proprietária pode ativar o Super Admin.' }, 403);
      const sessionEmail = session.owner_email;
      const existing = await getSuperAdminEmail(env);
      if (existing) return jsonResponse({ error: 'O Super Admin já foi configurado.' }, 409);
      await dbPut(env, 'superadmin:email', sessionEmail);
      return jsonResponse({ configured: true, authorized: true, canBootstrap: false, email: sessionEmail });
    }

    if (url.pathname === '/api/superadmin/tenants' && request.method === 'GET') {
      const adminEmail = await getSuperAdminSession(request, env);
      if (!adminEmail) return jsonResponse({ error: 'Acesso exclusivo do Super Admin.' }, 403);
      const tenants = (await listTenantPayloads(env)).map(({ email, payload }) => {
        const org = payload.org || {};
        return {
          email,
          name: String(org.name || 'Estabelecimento'),
          owner_name: org.owner_name ? String(org.owner_name) : undefined,
          slug: String(org.slug || ''),
          phone: org.phone ? String(org.phone) : undefined,
          status: accountStatus(payload),
          plan: ['trial', 'basic', 'professional', 'premium'].includes(String(org.plan || '')) ? org.plan : 'trial',
          due_date: org.subscription_due_date || undefined,
          created_at: org.created_at || undefined,
          last_login_at: org.last_login_at || undefined,
          updated_at: payload.updated_at || undefined,
          clients_count: Array.isArray(payload.clients) ? payload.clients.filter((item: any) => item?.archived !== true).length : 0,
          appointments_count: Array.isArray(payload.appointments) ? payload.appointments.length : 0,
          barbers_count: Array.isArray(payload.barbers) ? payload.barbers.filter((item: any) => item?.active !== false).length : 0,
          services_count: Array.isArray(payload.services) ? payload.services.filter((item: any) => item?.active !== false).length : 0,
        };
      }).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      return jsonResponse({ tenants });
    }

    if (url.pathname === '/api/superadmin/tenant' && request.method === 'POST') {
      const adminEmail = await getSuperAdminSession(request, env);
      if (!adminEmail) return jsonResponse({ error: 'Acesso exclusivo do Super Admin.' }, 403);
      try {
        const body = await request.json() as any;
        const email = normalizeEmail(body.email);
        const status = String(body.status || 'active');
        const plan = String(body.plan || 'trial');
        const dueDate = String(body.due_date || '').trim();
        if (!email) return jsonResponse({ error: 'Conta inválida.' }, 400);
        if (!['active', 'trial', 'suspended'].includes(status)) return jsonResponse({ error: 'Status inválido.' }, 400);
        if (!['trial', 'basic', 'professional', 'premium'].includes(plan)) return jsonResponse({ error: 'Plano inválido.' }, 400);
        if (email === adminEmail && status === 'suspended') return jsonResponse({ error: 'A conta do Super Admin não pode suspender a si própria.' }, 400);
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return jsonResponse({ error: 'Vencimento inválido.' }, 400);
        const raw = await dbGet(env, `user:${email}`);
        if (!raw) return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
        const payload = JSON.parse(raw) as StoredPayload;
        payload.org = {
          ...payload.org,
          account_status: status,
          plan,
          subscription_due_date: dueDate || undefined,
        };
        const stored = await storePayload(env, payload, normalizeSlug(payload.org?.slug));
        return jsonResponse({ success: true, updated_at: stored.updated_at });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao atualizar estabelecimento.' }, 500);
      }
    }

    // Atualização imediata das configurações da TV.
    // Evita depender do debounce do snapshot administrativo para refletir mudanças no painel público.
    if (url.pathname === '/api/tv/settings' && request.method === 'POST') {
      try {
        const session = await getSessionContext(request, env);
        if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
        if (session.role !== 'owner' && !session.permissions.ajustes) return jsonResponse({ error: 'Sem permissão para alterar a TV.' }, 403);

        const raw = await dbGet(env, `user:${session.owner_email}`);
        if (!raw) return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
        const payload = JSON.parse(raw) as StoredPayload;
        const body = await request.json() as any;
        const mediaType = ['youtube', 'spotify', 'apple_music', 'audio', 'institutional'].includes(String(body.tv_media_type || ''))
          ? String(body.tv_media_type)
          : 'institutional';
        const visualMode = ['player_queue', 'brand_queue', 'brand_products_queue'].includes(String(body.tv_visual_mode || ''))
          ? String(body.tv_visual_mode)
          : (mediaType === 'institutional' ? 'brand_products_queue' : 'player_queue');
        const cleanUrl = (value: unknown, max = 1600) => {
          const text = String(value || '').trim();
          return /^https?:\/\//i.test(text) ? text.slice(0, max) : undefined;
        };

        payload.org = {
          ...payload.org,
          tv_enabled: body.tv_enabled === true,
          tv_youtube_url: mediaType === 'youtube' ? cleanUrl(body.tv_youtube_url) : undefined,
          tv_media_type: mediaType,
          tv_media_url: mediaType === 'institutional' ? undefined : cleanUrl(body.tv_media_url),
          tv_visual_mode: visualMode,
          tv_animations: body.tv_animations !== false,
          tv_notice: String(body.tv_notice || '').trim().slice(0, 500) || undefined,
          tv_show_client_names: body.tv_show_client_names === true,
          tv_show_prices: body.tv_show_prices === true,
          tv_sound_enabled: body.tv_sound_enabled !== false,
          tv_sound_volume: Math.min(100, Math.max(0, Number(body.tv_sound_volume ?? 70))),
          tv_sound_style: ['bell', 'soft', 'attention'].includes(String(body.tv_sound_style || '')) ? body.tv_sound_style : 'bell',
          logo_image_url: cleanUrl(body.logo_image_url, 1000),
          cover_image_url: cleanUrl(body.cover_image_url, 1000),
          public_gallery: sanitizePublicGallery(body.public_gallery),
          social_links: sanitizeSocialLinks(body.social_links),
        };

        const stored = await storePayload(env, payload, normalizeSlug(payload.org?.slug));
        return jsonResponse({ success: true, updated_at: stored.updated_at });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao atualizar configurações da TV.' }, 500);
      }
    }

    // Painel público para TV/recepção. Retorna apenas dados próprios para exibição pública.
    if (url.pathname === '/api/tv' && request.method === 'GET') {
      const slug = normalizeSlug(url.searchParams.get('slug'));
      const requestedDate = String(url.searchParams.get('date') || '').trim();
      if (!slug) return jsonResponse({ error: 'Informe o slug da barbearia.' }, 400);
      if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return jsonResponse({ error: 'Informe uma data válida.' }, 400);

      const payload = await loadPayloadBySlug(env, slug);
      if (!payload) return jsonResponse({ found: false }, 404);
      if (accountStatus(payload) === 'suspended') return jsonResponse({ error: 'Estabelecimento temporariamente indisponível.' }, 403);
      return jsonResponse(sanitizeTvPayload(payload, requestedDate));
    }

    // Usuários e permissões da equipe. Não exige nova tabela: usa o app_store já existente.
    if (url.pathname === '/api/staff' && request.method === 'GET') {
      const session = await getSessionContext(request, env);
      if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
      if (!session.permissions.usuarios && session.role !== 'owner') return jsonResponse({ error: 'Sem permissão para gerenciar usuários.' }, 403);
      const raw = await dbGet(env, `staffindex:${session.owner_email}`);
      let users: any[] = [];
      try { users = raw ? JSON.parse(raw) : []; } catch {}
      return jsonResponse({ users, current_user: getCurrentUserPayload(session) });
    }

    if (url.pathname === '/api/staff' && request.method === 'POST') {
      try {
        const session = await getSessionContext(request, env);
        if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
        if (!session.permissions.usuarios && session.role !== 'owner') return jsonResponse({ error: 'Sem permissão para gerenciar usuários.' }, 403);
        const body = await request.json() as any;
        const action = String(body.action || 'save');
        const email = normalizeEmail(body.email);
        if (!email || !email.includes('@')) return jsonResponse({ error: 'Informe um e-mail válido.' }, 400);
        if (email === session.owner_email) return jsonResponse({ error: 'A conta do proprietário é gerenciada pelo cadastro principal.' }, 400);

        let idx: any[] = [];
        const idxRaw = await dbGet(env, `staffindex:${session.owner_email}`);
        try { idx = idxRaw ? JSON.parse(idxRaw) : []; } catch {}

        if (action === 'delete') {
          idx = idx.filter(item => normalizeEmail(item.email) !== email);
          await dbPut(env, `staffindex:${session.owner_email}`, JSON.stringify(idx));
          await dbDelete(env, `staff:${email}`);
          await dbDelete(env, `auth:${email}`);
          return jsonResponse({ success: true, users: idx });
        }

        const role = body.role === 'admin' ? 'admin' : 'barber';
        const existingRaw = await dbGet(env, `staff:${email}`);
        if (existingRaw) {
          try {
            const existingStaff = JSON.parse(existingRaw) as any;
            if (normalizeEmail(existingStaff.owner_email) !== session.owner_email) return jsonResponse({ error: 'Este e-mail já pertence à equipe de outro estabelecimento.' }, 409);
          } catch {}
        }
        if (!existingRaw) {
          const conflictingOwner = await dbGet(env, `user:${email}`);
          if (conflictingOwner) return jsonResponse({ error: 'Este e-mail já pertence a outro estabelecimento.' }, 409);
          const password = String(body.password || '');
          if (password.length < 6) return jsonResponse({ error: 'A senha inicial deve ter pelo menos 6 caracteres.' }, 400);
          await dbPut(env, `auth:${email}`, JSON.stringify(await createCredential(password)));
        } else if (String(body.password || '').trim()) {
          if (String(body.password).length < 6) return jsonResponse({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }, 400);
          await dbPut(env, `auth:${email}`, JSON.stringify(await createCredential(String(body.password))));
        }

        const previous = existingRaw ? JSON.parse(existingRaw) : {};
        const record = {
          id: previous.id || crypto.randomUUID(),
          owner_email: session.owner_email,
          email,
          name: String(body.name || previous.name || email).trim().slice(0, 120),
          role,
          active: body.active !== false,
          barber_id: body.barber_id ? String(body.barber_id) : undefined,
          permissions: normalizePermissions(body.permissions, role),
          created_at: previous.created_at || new Date().toISOString(),
          last_login_at: previous.last_login_at,
        };
        await dbPut(env, `staff:${email}`, JSON.stringify(record));
        idx = idx.filter(item => normalizeEmail(item.email) !== email);
        const { owner_email: _ownerEmail, ...safeRecord } = record;
        idx.push(safeRecord);
        idx.sort((a,b) => String(a.name).localeCompare(String(b.name)));
        await dbPut(env, `staffindex:${session.owner_email}`, JSON.stringify(idx));
        return jsonResponse({ success: true, users: idx });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao salvar usuário.' }, 500);
      }
    }

    // Leitura pública por slug ou privada por e-mail.
    if (url.pathname === '/api/sync' && request.method === 'GET') {
      const email = normalizeEmail(url.searchParams.get('email'));
      const slug = normalizeSlug(url.searchParams.get('slug'));
      if (!email && !slug) return jsonResponse({ error: 'Informe email ou slug para consultar.' }, 400);

      if (email) {
        const sessionEmail = await getSessionEmail(request, env);
        if (!sessionEmail || sessionEmail !== email) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
        const raw = await dbGet(env, `user:${email}`);
        if (!raw) return jsonResponse({ found: false }, 404);
        const privatePayload = JSON.parse(raw) as StoredPayload;
        if (accountStatus(privatePayload) === 'suspended') return jsonResponse({ error: 'Esta conta está suspensa. Entre em contato com o suporte do AgendAI.' }, 403);
        const session = await getSessionContext(request, env);
        const safe = session ? privatePayloadForSession(privatePayload, session) : sanitizePrivatePayload(privatePayload);
        if (session) safe.current_user = getCurrentUserPayload(session, safe);
        return jsonResponse(safe);
      }

      const publicPayload = await loadPayloadBySlug(env, slug);
      if (!publicPayload) return jsonResponse({ found: false }, 404);
      if (accountStatus(publicPayload) === 'suspended') return jsonResponse({ error: 'Estabelecimento temporariamente indisponível.' }, 403);
      return jsonResponse(sanitizePublicPayload(publicPayload));
    }

    // Salvamento administrativo com proteção antizeramento e snapshot de segurança.
    if (url.pathname === '/api/sync' && request.method === 'POST') {
      try {
        const body = await request.json() as StoredPayload;
        const email = normalizeEmail(body.org?.email);
        const session = await getSessionContext(request, env);
        const sessionEmail = session?.owner_email || '';
        if (!session || !email || sessionEmail !== email) return jsonResponse({ error: 'Não autorizado.' }, 401);

        const currentRaw = await dbGet(env, `user:${email}`);
        const current = currentRaw ? JSON.parse(currentRaw) as StoredPayload : null;
        if (current && accountStatus(current) === 'suspended') return jsonResponse({ error: 'Esta conta está suspensa. Entre em contato com o suporte do AgendAI.' }, 403);

        // Nunca aceita silenciosamente um snapshot administrativo antigo. O cliente
        // carrega a revisão atual e faz uma conciliação de três vias antes de tentar
        // novamente, preservando inclusive reservas e pedidos criados no site público.
        if (current && body.updated_at && current.updated_at && String(body.updated_at) !== String(current.updated_at)) {
          return jsonResponse({
            error: 'A agenda foi atualizada em outro aparelho. Concilie as alterações antes de salvar.',
            conflict: true,
            updated_at: current.updated_at,
          }, 409);
        }
        if (current && session.role === 'barber') {
          const barberId = String(session.barber_id || '');
          if (!barberId) return jsonResponse({ error: 'Usuário barbeiro sem profissional vinculado.' }, 403);
          const existingById = new Map((Array.isArray(current.appointments) ? current.appointments : []).map((a: any) => [String(a.id), a]));
          const incomingOwn = (Array.isArray(body.appointments) ? body.appointments : [])
            .filter((a: any) => String(a.barber_id || '') === barberId)
            .map((a: any) => ({ ...(existingById.get(String(a.id)) as Record<string, any> || {}), ...a }));
          const preservedOthers = (Array.isArray(current.appointments) ? current.appointments : []).filter((a: any) => String(a.barber_id || '') !== barberId);
          body.appointments = [...preservedOthers, ...incomingOwn];
          const notificationMap = new Map<string, any>();
          const ownAppointmentIds = new Set(incomingOwn.map((a: any) => String(a.id || '')));
          (Array.isArray(current.notifications) ? current.notifications : [])
            .forEach((n: any) => notificationMap.set(String(n.id || crypto.randomUUID()), n));
          (Array.isArray(body.notifications) ? body.notifications : [])
            .filter((n: any) => !n.appointment_id || ownAppointmentIds.has(String(n.appointment_id)))
            .forEach((n: any) => notificationMap.set(String(n.id || crypto.randomUUID()), n));
          body.notifications = Array.from(notificationMap.values());
          body.org = current.org;
          body.savedOrgs = current.savedOrgs;
          body.services = current.services;
          body.barbers = current.barbers;
          if (!session.permissions.clientes) body.clients = current.clients;
        }
        if (current && session.role !== 'owner' && !session.permissions.products) {
          body.products = current.products;
          body.productSales = current.productSales;
        }
        if (current && session.role !== 'owner' && !session.permissions.caixa) body.commands = current.commands;
        if (current?.org) {
          body.org = {
            ...body.org,
            account_status: current.org.account_status || 'active',
            plan: current.org.plan || 'trial',
            subscription_due_date: current.org.subscription_due_date,
            created_at: current.org.created_at,
            last_login_at: current.org.last_login_at,
          };
        }
        if (current && payloadDataCount(current) > 0 && payloadDataCount(body) === 0 && body.__allow_empty !== true) {
          return jsonResponse({
            error: 'Proteção de dados: este aparelho está com listas vazias e não pode apagar uma conta que possui dados na nuvem. Recarregue a página para sincronizar.'
          }, 409);
        }

        // Se nada realmente mudou, não grava backup nem snapshot novamente.
        if (current && payloadForCompare(current) === payloadForCompare(body)) {
          return jsonResponse({ success: true, unchanged: true, updated_at: current.updated_at });
        }

        if (currentRaw) await dbPut(env, `backup:last:${email}`, currentRaw);
        const previousSlug = current ? normalizeSlug(current.org?.slug) : undefined;
        const stored = await storePayload(env, body, previousSlug, current ? String(current.updated_at || '') : undefined);
        return jsonResponse({ success: true, updated_at: stored.updated_at });
      } catch (error: any) {
        if (error instanceof SnapshotConflictError) return jsonResponse({ error: error.message }, 409);
        return jsonResponse({ error: error?.message || 'Falha ao salvar.' }, 500);
      }
    }

    // Restaura o snapshot imediatamente anterior ao último salvamento administrativo.
    if (url.pathname === '/api/sync/restore-last' && request.method === 'POST') {
      try {
        const session = await getSessionContext(request, env);
        if (!session) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
        if (session.role !== 'owner' && (session.role !== 'admin' || !session.permissions.ajustes)) return jsonResponse({ error: 'Sem permissão para restaurar os dados da barbearia.' }, 403);
        const email = session.owner_email;
        const backupRaw = await dbGet(env, `backup:last:${email}`);
        if (!backupRaw) return jsonResponse({ error: 'Ainda não existe backup de segurança disponível.' }, 404);

        const currentRaw = await dbGet(env, `user:${email}`);
        const current = currentRaw ? JSON.parse(currentRaw) as StoredPayload : null;
        if (accountStatus(current) === 'suspended') return jsonResponse({ error: 'Conta temporariamente indisponível.' }, 403);
        const backup = JSON.parse(backupRaw) as StoredPayload;
        const restored = await storePayload(env, backup, current ? normalizeSlug(current.org?.slug) : undefined);
        if (currentRaw) await dbPut(env, `backup:last:${email}`, currentRaw);
        return jsonResponse({ success: true, data: restored });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Falha ao restaurar backup.' }, 500);
      }
    }

    // Agendamento público com validação de conflito e notificação push aos aparelhos do administrador.
    if (url.pathname === '/api/appointment' && request.method === 'POST') {
      try {
        const appointment = await request.json() as any;
        if (!appointment || typeof appointment !== 'object' || Array.isArray(appointment)) throw new BookingInputError('Agendamento inválido.');
        const turnstileToken = appointment['cf-turnstile-response'];
        delete appointment['cf-turnstile-response'];
        if (!await verifyTurnstile(request, env, turnstileToken, 'public_booking')) {
          return jsonResponse({ error: 'Não foi possível validar a verificação de segurança. Atualize a página e tente novamente.' }, 403);
        }
        const orgSlug = normalizeSlug(appointment.org_slug || appointment.org_id);
        if (!orgSlug) return jsonResponse({ error: 'Slug da barbearia é obrigatório.' }, 400);
        if (!appointment.id || !appointment.date || !appointment.start_time || !appointment.barber_id) {
          return jsonResponse({ error: 'Dados obrigatórios do agendamento não foram informados.' }, 400);
        }
        if (!String(appointment.client_name || '').trim() || !String(appointment.client_phone || '').trim()) {
          return jsonResponse({ error: 'Nome e telefone do cliente são obrigatórios.' }, 400);
        }

        const current = await loadPayloadBySlug(env, orgSlug);
        if (!current) return jsonResponse({ error: 'Barbearia não encontrada.' }, 404);
        if (accountStatus(current) === 'suspended') return jsonResponse({ error: 'Este estabelecimento está temporariamente indisponível para novos agendamentos.' }, 403);
        const cleanAppointment = normalizePublicAppointment(appointment, {
          org: current.org,
          services: Array.isArray(current.services) ? current.services : [],
          barbers: Array.isArray(current.barbers) ? current.barbers : [],
        });
        const previousAppointments = Array.isArray(current.appointments) ? current.appointments : [];
        const duplicate = previousAppointments.find((item: any) => item.id === cleanAppointment.id);
        if (duplicate) {
          const sameBooking = ['client_name', 'client_phone', 'barber_id', 'date', 'start_time', 'service_id'].every(key => duplicate[key] === (cleanAppointment as any)[key]);
          return sameBooking ? jsonResponse({ success: true, duplicate: true }) : jsonResponse({ error: 'Este identificador já foi utilizado. Atualize a página.' }, 409);
        }
        const businessTimeError = validateBusinessTime(cleanAppointment, current.org);
        if (businessTimeError) return jsonResponse({ error: businessTimeError }, 409);
        if (overlapsExistingAppointment(cleanAppointment, previousAppointments)) {
          return jsonResponse({ error: 'Este horário acabou de ser reservado. Escolha outro horário.' }, 409);
        }

        current.appointments = [cleanAppointment, ...previousAppointments];

        // Atualiza também o cadastro do cliente no servidor. A página pública nunca precisa
        // escrever o localStorage privado do administrador para manter o CRM sincronizado.
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

        const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
        const notificationId = `new-${cleanAppointment.id}`;
        const serviceLabel = String(
          cleanAppointment.service_name ||
          (Array.isArray(cleanAppointment.services) ? cleanAppointment.services.map((service: any) => service?.name).filter(Boolean).join(' + ') : '') ||
          'Atendimento'
        );
        const newNotification = {
          id: notificationId,
          org_id: current.org?.id,
          type: 'new_appointment',
          title: 'Novo agendamento',
          message: `${String(cleanAppointment.client_name || 'Cliente')} • ${serviceLabel} • ${String(cleanAppointment.start_time || '')}`,
          created_at: cleanAppointment.created_at || new Date().toISOString(),
          appointment_id: cleanAppointment.id,
          client_name: cleanAppointment.client_name,
          target_tab: 'agenda',
        };
        current.notifications = [
          newNotification,
          ...existingNotifications.filter((notification: any) => String(notification?.id || '') !== notificationId),
        ].slice(0, 100);

        const email = normalizeEmail(current.org?.email);
        await storePayload(env, current, orgSlug, String(current.updated_at || ''));

        if (email) {
          const pushTask = notifyAdminDevices(env, email, {
            title: 'Novo agendamento',
            body: String(newNotification.message || 'Um novo horário foi reservado.'),
            tag: notificationId,
            url: '/?tab=atendimentos',
          });
          if (ctx?.waitUntil) ctx.waitUntil(pushTask);
          else void pushTask;
        }

        return jsonResponse({ success: true, appointment: cleanAppointment, timestamp: new Date().toISOString() }, 201);
      } catch (error: any) {
        if (error instanceof SnapshotConflictError) return jsonResponse({ error: error.message }, 409);
        if (error instanceof BookingInputError) return jsonResponse({ error: error.message }, error.status);
        if (error instanceof SyntaxError) return jsonResponse({ error: 'Agendamento inválido.' }, 400);
        return jsonResponse({ error: error?.message || 'Falha ao registrar agendamento.' }, 500);
      }
    }


    // Pedido público de produtos físicos. Reserva estoque e envia o pedido ao painel do estabelecimento.
    if (url.pathname === '/api/product-order' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'Pedido inválido.' }, 400);
        const turnstileToken = body['cf-turnstile-response'];
        delete body['cf-turnstile-response'];
        if (!await verifyTurnstile(request, env, turnstileToken, 'product_order')) {
          return jsonResponse({ error: 'Não foi possível validar a verificação de segurança. Atualize a página e tente novamente.' }, 403);
        }
        const orgSlug = normalizeSlug(body.org_slug);
        const customerName = String(body.customer_name || '').trim();
        const customerPhone = String(body.customer_phone || '').trim();
        const requestedItems = Array.isArray(body.items) ? body.items : [];
        if (!orgSlug) return jsonResponse({ error: 'Estabelecimento não identificado.' }, 400);
        if (!customerName || !customerPhone) return jsonResponse({ error: 'Nome e WhatsApp são obrigatórios.' }, 400);
        if (requestedItems.length === 0) return jsonResponse({ error: 'Adicione pelo menos um produto ao pedido.' }, 400);
        if (requestedItems.length > 30) return jsonResponse({ error: 'O pedido excede o limite de itens.' }, 400);

        const current = await loadPayloadBySlug(env, orgSlug);
        if (!current) return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
        if (accountStatus(current) === 'suspended') return jsonResponse({ error: 'Este estabelecimento está temporariamente indisponível.' }, 403);

        const orgId = String(current.org?.id || '');
        const products = sanitizeProducts(current.products, orgId, false);
        const saleItems: any[] = [];
        const quantities = new Map<string, number>();
        for (const requested of requestedItems) {
          const productId = String(requested?.product_id || '');
          const quantity = Number(requested?.quantity);
          if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return jsonResponse({ error: 'Informe uma quantidade válida para cada produto.' }, 400);
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        }

        for (const [productId, quantity] of quantities.entries()) {
          const product = products.find((item: any) => item.id === productId);
          if (!product || product.active === false || product.public_visible === false) return jsonResponse({ error: 'Um dos produtos não está mais disponível.' }, 409);
          if (!Number.isFinite(product.price) || !Number.isFinite(product.stock)) return jsonResponse({ error: 'Este produto precisa ser revisado pela barbearia.' }, 409);
          if (Number(product.stock || 0) < quantity) return jsonResponse({ error: `Estoque insuficiente para ${product.name}. Atualize a página e tente novamente.` }, 409);
          saleItems.push({ product_id: product.id, name: product.name, price: Number(product.price || 0), quantity, cost: Number(product.cost || 0) });
        }

        const now = new Date();
        const businessNow = getBusinessNow(current.org);
        const total = saleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const sale = {
          id: `web-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          org_id: orgId,
          origin: 'public',
          status: 'pending',
          items: saleItems,
          total,
          customer_name: customerName.slice(0, 140),
          customer_phone: customerPhone.slice(0, 40),
          date: businessNow.date,
          time: `${String(Math.floor(businessNow.minutes / 60)).padStart(2, '0')}:${String(businessNow.minutes % 60).padStart(2, '0')}`,
          created_at: now.toISOString(),
        };

        current.products = products.map((product: any) => {
          const reserved = saleItems.find((item) => item.product_id === product.id);
          return reserved ? { ...product, stock: Math.max(0, Number(product.stock || 0) - reserved.quantity) } : product;
        });
        current.productSales = [sale, ...sanitizeProductSales(current.productSales, orgId)].slice(0, 1000);

        const notificationId = `product-${sale.id}`;
        const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
        current.notifications = [{
          id: notificationId,
          org_id: orgId,
          type: 'product_order',
          title: 'Novo pedido de produtos',
          message: `${customerName} • ${saleItems.reduce((sum, item) => sum + item.quantity, 0)} item(ns) • R$ ${total.toFixed(2)}`,
          created_at: now.toISOString(),
          client_name: customerName,
          target_tab: 'produtos',
        }, ...existingNotifications.filter((notification: any) => String(notification?.id || '') !== notificationId)].slice(0, 100);

        const email = normalizeEmail(current.org?.email);
        await storePayload(env, current, orgSlug, String(current.updated_at || ''));
        if (email) {
          const pushTask = notifyAdminDevices(env, email, {
            title: 'Novo pedido de produtos',
            body: `${customerName} • ${saleItems.reduce((sum, item) => sum + item.quantity, 0)} item(ns) • R$ ${total.toFixed(2)}`,
            tag: notificationId,
            url: '/?tab=produtos',
          });
          if (ctx?.waitUntil) ctx.waitUntil(pushTask);
          else void pushTask;
        }

        return jsonResponse({
          success: true,
          // Nunca exponha custo/margem do estabelecimento na resposta pública.
          sale: {
            ...sale,
            items: sale.items.map((item: any) => ({
              product_id: item.product_id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
          },
          products: sanitizeProducts(current.products, orgId, true),
        }, 201);
      } catch (error: any) {
        if (error instanceof SnapshotConflictError) return jsonResponse({ error: error.message }, 409);
        return jsonResponse({ error: error?.message || 'Falha ao registrar pedido.' }, 500);
      }
    }

    // Inscrição pública na Lista de Espera Relâmpago.
    if (url.pathname === '/api/waitlist' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'Dados inválidos.' }, 400);

        const orgSlug = normalizeSlug(body.org_slug);
        const clientName = String(body.client_name || '').trim();
        const clientPhone = String(body.client_phone || '').trim();
        const preferredDate = String(body.preferred_date || '').trim();
        const preferredPeriod = String(body.preferred_period || 'any');

        if (!orgSlug) return jsonResponse({ error: 'Estabelecimento não identificado.' }, 400);
        if (!clientName || !clientPhone) return jsonResponse({ error: 'Nome e WhatsApp são obrigatórios.' }, 400);
        if (!preferredDate) return jsonResponse({ error: 'Data de preferência é obrigatória.' }, 400);

        const current = await loadPayloadBySlug(env, orgSlug);
        if (!current || !current.org) return jsonResponse({ error: 'Barbearia não encontrada.' }, 404);
        if (accountStatus(current) === 'suspended') return jsonResponse({ error: 'Barbearia temporariamente indisponível.' }, 403);

        const newEntry = {
          id: 'wait-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          org_id: current.org?.id || '',
          client_name: clientName,
          client_phone: clientPhone,
          service_id: body.service_id ? String(body.service_id) : undefined,
          service_name: body.service_name ? String(body.service_name) : undefined,
          barber_id: body.barber_id ? String(body.barber_id) : undefined,
          barber_name: body.barber_name ? String(body.barber_name) : undefined,
          preferred_date: preferredDate,
          preferred_period: ['morning', 'afternoon', 'evening', 'any'].includes(preferredPeriod) ? preferredPeriod : 'any',
          notes: body.notes ? String(body.notes).slice(0, 200) : undefined,
          status: 'waiting',
          created_at: new Date().toISOString(),
        };

        const existingWaitlist = Array.isArray(current.waitlist) ? current.waitlist : [];
        current.waitlist = [newEntry, ...existingWaitlist];

        // Notificação para a central do painel
        const notificationId = `notif-wait-${Date.now()}`;
        const newNotification = {
          id: notificationId,
          org_id: current.org.id,
          type: 'waitlist_entry',
          title: '⚡ Novo cliente na Fila de Espera',
          message: `${clientName} quer vaga para ${preferredDate.split('-').reverse().join('/')} (${newEntry.preferred_period === 'any' ? 'Qualquer horário' : newEntry.preferred_period}).`,
          created_at: new Date().toISOString(),
          client_name: clientName,
          target_tab: 'agenda',
        };
        const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
        current.notifications = [newNotification, ...existingNotifications].slice(0, 100);

        await storePayload(env, current, orgSlug, String(current.updated_at || ''));

        const email = normalizeEmail(current.org?.email);
        if (email) {
          const pushTask = notifyAdminDevices(env, email, {
            title: 'Novo cliente na lista de espera',
            body: String(newNotification.message || 'Um cliente entrou na lista de espera.'),
            tag: notificationId,
            url: '/?tab=agenda',
          });
          if (ctx?.waitUntil) ctx.waitUntil(pushTask);
          else void pushTask;
        }

        return jsonResponse({ success: true, entry: newEntry }, 201);
      } catch (error: any) {
        if (error instanceof SnapshotConflictError) return jsonResponse({ error: error.message }, 409);
        return jsonResponse({ error: error?.message || 'Falha ao registrar na lista de espera.' }, 500);
      }
    }

    if (url.pathname.startsWith('/api/')) return jsonResponse({ error: 'Rota da API não encontrada.' }, 404);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('App carregado', { headers: { 'Content-Type': 'text/plain' } });
  },

  // Consumidor da Cloudflare Queue "whatsapp-events" (Fase 2). Cada mensagem já chega
  // como um WhatsAppEvent tipado (produzido em integrations/whatsapp/webhook.ts) — nunca
  // o payload bruto da Meta. Falha em um evento não derruba o lote inteiro: cada
  // mensagem é ack()/retry() individualmente.
  async queue(batch: MessageBatch<WhatsAppEvent>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processWhatsAppEvent(env, message.body);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          event: 'whatsapp_queue_message_failed',
          attempts: message.attempts,
          error: error instanceof Error ? error.message : 'unknown_error',
        }));
        message.retry();
      }
    }
  }
};
