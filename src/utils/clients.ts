import { Client } from '../types';

export const normalizeClientPhone = (value?: string): string => {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  // Remove código do país do Brasil, independentemente da máscara usada.
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);

  // Alguns contatos chegam como 0 + DDD + número. Esse zero não faz parte do telefone.
  if (digits.startsWith('0') && digits.length === 12) digits = digits.slice(1);

  // Se ainda houver prefixos extras, a identidade do contato fica pelos últimos 11 dígitos.
  // Isso evita duplicidade entre +55 84 9..., 55849..., 0849... e 849....
  if (digits.length > 11) digits = digits.slice(-11);

  return digits;
};

const normalizedName = (value?: string): string =>
  String(value || '').trim().toLowerCase();

export const clientIdentityKey = (client: Pick<Client, 'name' | 'phone'>): string => {
  const phone = normalizeClientPhone(client.phone);
  if (phone) return `phone:${phone}`;
  return `name:${normalizedName(client.name)}`;
};

/**
 * Remove duplicidades do CRM. Telefone é a identidade principal do cliente;
 * nome só é usado quando não existe telefone válido.
 *
 * A primeira ocorrência vence para nome/telefone (as listas do app são
 * normalmente mais recentes primeiro) e os acumulados de registros antigos
 * duplicados são preservados.
 */
export const dedupeClients = (clients: Client[]): Client[] => {
  const byKey = new Map<string, Client>();
  const order: string[] = [];

  for (const client of clients || []) {
    if (!client || !String(client.name || '').trim()) continue;
    const key = clientIdentityKey(client);
    if (!key || key === 'name:') continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...client });
      order.push(key);
      continue;
    }

    byKey.set(key, {
      ...existing,
      // A primeira ocorrência mantém a identidade visual; só preenche lacunas.
      name: existing.name || client.name,
      phone: existing.phone && existing.phone !== 'Não informado' ? existing.phone : client.phone,
      email: existing.email || client.email,
      total_visits: Math.max(0, Number(existing.total_visits || 0)) + Math.max(0, Number(client.total_visits || 0)),
      total_spent: Math.max(0, Number(existing.total_spent || 0)) + Math.max(0, Number(client.total_spent || 0)),
      last_visit: existing.last_visit || client.last_visit,
      notes: existing.notes || client.notes,
      loyalty_points: Math.max(Number(existing.loyalty_points || 0), Number(client.loyalty_points || 0)),
      archived: existing.archived === true,
      archived_at: existing.archived_at || client.archived_at,
    });
  }

  return order.map(key => byKey.get(key)!).filter(Boolean);
};

type UpsertClientInput = {
  name: string;
  phone?: string;
  email?: string;
  org_id?: string;
  visitDelta?: number;
  spentDelta?: number;
  lastVisit?: string;
};

/**
 * Insere ou atualiza um cliente sem duplicar o mesmo telefone, mesmo quando
 * o número chega com máscaras diferentes (ex.: (84) 99999-0000 x 84999990000).
 */
export const upsertClient = (clients: Client[], input: UpsertClientInput): Client[] => {
  const cleanName = String(input.name || '').trim();
  const displayPhone = String(input.phone || '').trim() || 'Não informado';
  const phoneKey = normalizeClientPhone(displayPhone);
  const nameKey = normalizedName(cleanName);
  const visitDelta = Math.max(0, Number(input.visitDelta || 0));
  const spentDelta = Math.max(0, Number(input.spentDelta || 0));

  const base = dedupeClients(clients || []);
  const index = base.findIndex(client => {
    const existingPhone = normalizeClientPhone(client.phone);
    if (phoneKey) return existingPhone === phoneKey;
    return !existingPhone && nameKey && normalizedName(client.name) === nameKey;
  });

  if (index >= 0) {
    const existing = base[index];
    const updated: Client = {
      ...existing,
      // Se o mesmo telefone for informado com outro nome, mantém só um cadastro
      // e passa a usar o nome informado mais recentemente.
      name: cleanName || existing.name,
      phone: phoneKey ? displayPhone : existing.phone,
      email: input.email?.trim() || existing.email,
      org_id: existing.org_id || input.org_id,
      total_visits: Math.max(0, Number(existing.total_visits || 0)) + visitDelta,
      total_spent: Math.max(0, Number(existing.total_spent || 0)) + spentDelta,
      last_visit: input.lastVisit || existing.last_visit,
      archived: false,
      archived_at: undefined,
    };
    return [updated, ...base.filter((_, idx) => idx !== index)];
  }

  const newClient: Client = {
    id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    org_id: input.org_id,
    name: cleanName,
    phone: displayPhone,
    email: input.email?.trim() || undefined,
    total_visits: visitDelta,
    total_spent: spentDelta,
    last_visit: input.lastVisit || 'Novo cliente',
    archived: false,
  };

  return [newClient, ...base];
};
