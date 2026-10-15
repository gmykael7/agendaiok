import type { Env } from '../../worker';
import { dbGet, dbPut, dbDelete, loadPayloadBySlug, storePayload } from '../../worker';
import type { WhatsAppConnection } from './types';

/**
 * Resolve o slug do tenant a partir do phoneNumberId recebido no webhook da Meta.
 * 1. Procura mapeamento dinâmico wa_tenant:{phoneNumberId}
 * 2. Se não encontrar, recorre ao fallback WHATSAPP_DEFAULT_TENANT_SLUG
 */
export async function resolveTenantSlug(env: Env, phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return env.WHATSAPP_DEFAULT_TENANT_SLUG || null;
  try {
    const mapped = await dbGet(env, `wa_tenant:${phoneNumberId}`);
    if (mapped && typeof mapped === 'string' && mapped.trim()) {
      return mapped.trim();
    }
  } catch {}
  return env.WHATSAPP_DEFAULT_TENANT_SLUG || null;
}

/**
 * Conecta um número do WhatsApp a um tenant (Fase 7 - Embedded Signup).
 * Salva o vínculo bidirecional no banco e atualiza o estado na organização.
 */
export async function connectTenantWhatsApp(
  env: Env,
  tenantSlug: string,
  connection: Omit<WhatsAppConnection, 'tenantId' | 'status'>
): Promise<WhatsAppConnection> {
  const payload = await loadPayloadBySlug(env, tenantSlug);
  if (!payload || !payload.org) {
    throw new Error('Estabelecimento não encontrado.');
  }

  const phoneNumberId = connection.phoneNumberId?.trim();
  if (!phoneNumberId) {
    throw new Error('phoneNumberId é obrigatório para conectar o WhatsApp.');
  }

  // Registra mapeamento número -> tenant no banco
  await dbPut(env, `wa_tenant:${phoneNumberId}`, tenantSlug);
  await dbPut(env, `tenant_wa:${tenantSlug}`, phoneNumberId);

  const fullConnection: WhatsAppConnection = {
    tenantId: tenantSlug,
    status: 'connected',
    phoneNumberId,
    businessAccountId: connection.businessAccountId,
    displayPhoneNumber: connection.displayPhoneNumber,
    verifiedName: connection.verifiedName || payload.org.name,
    connectedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
  };

  payload.org.whatsapp_connection = fullConnection;
  await storePayload(env, payload, tenantSlug, String(payload.updated_at || ''));

  return fullConnection;
}

/**
 * Desconecta o WhatsApp do tenant, removendo os mapeamentos no banco.
 */
export async function disconnectTenantWhatsApp(
  env: Env,
  tenantSlug: string
): Promise<WhatsAppConnection> {
  const payload = await loadPayloadBySlug(env, tenantSlug);
  if (!payload || !payload.org) {
    throw new Error('Estabelecimento não encontrado.');
  }

  const current = payload.org.whatsapp_connection as WhatsAppConnection | undefined;
  if (current?.phoneNumberId) {
    await dbDelete(env, `wa_tenant:${current.phoneNumberId}`);
  }
  await dbDelete(env, `tenant_wa:${tenantSlug}`);

  const disconnected: WhatsAppConnection = {
    tenantId: tenantSlug,
    status: 'disconnected',
  };

  payload.org.whatsapp_connection = disconnected;
  await storePayload(env, payload, tenantSlug, String(payload.updated_at || ''));

  return disconnected;
}

/**
 * Obtém o status da conexão WhatsApp do tenant.
 */
export async function getTenantWhatsAppConnection(
  env: Env,
  tenantSlug: string
): Promise<WhatsAppConnection> {
  const payload = await loadPayloadBySlug(env, tenantSlug);
  if (!payload || !payload.org) {
    return { tenantId: tenantSlug, status: 'disconnected' };
  }

  return (
    payload.org.whatsapp_connection || {
      tenantId: tenantSlug,
      status: 'disconnected',
    }
  );
}
