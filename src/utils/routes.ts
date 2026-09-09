type AppLocation = Pick<Location, 'pathname' | 'hash' | 'search'>;

/** Todos os formatos de link público compartilham a mesma proteção de dados. */
export function bookingSlugFromLocation(location: AppLocation): string | null {
  const pathMatch = location.pathname.match(/^\/(?:agendar|booking)\/([a-z0-9-]+)\/?$/i);
  const hashMatch = location.hash.match(/^#\/?(?:agendar|booking)\/([a-z0-9-]+)\/?$/i);
  if (pathMatch || hashMatch) return (pathMatch || hashMatch)![1].toLowerCase();
  const params = new URLSearchParams(location.search);
  for (const key of ['slug', 'agendar', 'booking', 'org']) {
    const value = params.get(key)?.trim().toLowerCase();
    if (value && value !== 'true' && value !== '1' && /^[a-z0-9-]+$/.test(value)) return value;
  }
  return null;
}

export function isPublicBookingLocation(location: AppLocation): boolean {
  if (bookingSlugFromLocation(location)) return true;
  return /^\/(?:agendar|booking)(?:\/|$)/i.test(location.pathname)
    || /^#\/?(?:agendar|booking)(?:\/|$)/i.test(location.hash)
    || ['agendar', 'booking', 'slug', 'org'].some(key => new URLSearchParams(location.search).has(key));
}
