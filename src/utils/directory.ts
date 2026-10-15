export const BRAZIL_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export interface DirectoryEntry { name: string; slug: string; city: string; state: string; neighborhood: string; address: string; logo: string; }
export const directoryText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function publicDirectoryEntry(value: Record<string, unknown>): DirectoryEntry | null {
  const text = (key: string, max = 120) => typeof value[key] === 'string' ? String(value[key]).trim().slice(0, max) : '';
  const slug = text('slug');
  if (!/^[a-z0-9-]+$/.test(slug) || !text('name') || !text('city') || !BRAZIL_STATES.includes(text('state'))) return null;
  let logo = text('logo', 1000);
  try { if (new URL(logo).protocol !== 'https:') logo = ''; } catch { logo = ''; }
  return { name: text('name'), slug, city: text('city'), state: text('state'), neighborhood: text('neighborhood'), address: text('address', 240), logo };
}
