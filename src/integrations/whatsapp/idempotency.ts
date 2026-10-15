import type { Env } from '../../worker';
import { dbGet, dbPut } from '../../worker';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 horas

export async function isEventProcessed(env: Env, messageId: string): Promise<boolean> {
  if (!messageId) return false;
  const existing = await dbGet(env, `wa_evt:${messageId}`);
  return existing !== null;
}

export async function markEventProcessed(env: Env, messageId: string): Promise<void> {
  if (!messageId) return;
  await dbPut(env, `wa_evt:${messageId}`, '1', IDEMPOTENCY_TTL_SECONDS);
}
