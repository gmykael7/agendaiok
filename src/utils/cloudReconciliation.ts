import type { CloudSyncPayload } from '../services/cloudSync';

export type ConflictPreference = 'local' | 'remote';

export interface CloudReconciliationResult {
  payload: CloudSyncPayload;
  conflicts: string[];
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)])) as T;
  }
  return value;
};

const isDeepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => isDeepEqual(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && isDeepEqual(left[key], right[key]));
  }
  return false;
};

const identifiedArray = (values: unknown[]): values is Array<{ id: string } & JsonRecord> =>
  values.every(item => isRecord(item) && typeof item.id === 'string' && item.id.trim().length > 0);

const mergeValue = (
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string[],
  preference: ConflictPreference,
  conflicts: string[],
): unknown => {
  if (isDeepEqual(local, remote)) return cloneValue(local);
  if (isDeepEqual(local, base)) return cloneValue(remote);
  if (isDeepEqual(remote, base)) return cloneValue(local);

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const result: JsonRecord = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    keys.forEach((key) => {
      const merged = mergeValue(base[key], local[key], remote[key], [...path, key], preference, conflicts);
      if (merged !== undefined) result[key] = merged;
    });
    return result;
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const allItems = [...base, ...local, ...remote];
    if (identifiedArray(allItems)) {
      const baseById = new Map(base.map(item => [item.id, item]));
      const localById = new Map(local.map(item => [item.id, item]));
      const remoteById = new Map(remote.map(item => [item.id, item]));
      const orderedIds = [...new Set([...remote.map(item => item.id), ...local.map(item => item.id), ...base.map(item => item.id)])];
      const result: unknown[] = [];
      orderedIds.forEach((id) => {
        const merged = mergeValue(baseById.get(id), localById.get(id), remoteById.get(id), [...path, id], preference, conflicts);
        if (merged !== undefined) result.push(merged);
      });
      return result;
    }
  }

  conflicts.push(path.join('.') || 'dados');
  return cloneValue(preference === 'local' ? local : remote);
};

const corePayload = (payload: CloudSyncPayload): Omit<CloudSyncPayload, 'updated_at' | 'current_user'> => ({
  org: payload.org,
  savedOrgs: payload.savedOrgs || [],
  services: payload.services || [],
  barbers: payload.barbers || [],
  appointments: payload.appointments || [],
  clients: payload.clients || [],
  notifications: payload.notifications || [],
  products: payload.products || [],
  productSales: payload.productSales || [],
  commands: payload.commands || [],
  waitlist: payload.waitlist || [],
});

export const cloneCloudPayload = (payload: CloudSyncPayload): CloudSyncPayload => cloneValue(payload);

export const reconcileCloudPayload = (
  base: CloudSyncPayload,
  local: CloudSyncPayload,
  remote: CloudSyncPayload,
  preference: ConflictPreference,
): CloudReconciliationResult => {
  const conflicts: string[] = [];
  const payload = mergeValue(
    corePayload(base),
    corePayload(local),
    corePayload(remote),
    [],
    preference,
    conflicts,
  ) as Omit<CloudSyncPayload, 'updated_at' | 'current_user'>;

  return {
    payload: {
      ...payload,
      current_user: remote.current_user,
      updated_at: remote.updated_at,
    },
    conflicts: [...new Set(conflicts)],
  };
};
