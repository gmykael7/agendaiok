export const CANONICAL_APP_ORIGIN = 'https://meuagendai.fun';

const isLocalDevelopmentHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.localhost');

/**
 * URL pública oficial do AgendaAI.
 * Em desenvolvimento local, preserva a origem local para facilitar testes.
 * Em produção/preview, todos os links compartilhados usam o domínio oficial.
 */
export const getPublicAppOrigin = (): string => {
  if (typeof window !== 'undefined' && isLocalDevelopmentHost(window.location.hostname)) {
    return window.location.origin;
  }
  return CANONICAL_APP_ORIGIN;
};

export const getClientBookingUrl = (slug: string): string =>
  `${getPublicAppOrigin()}/agendar/${encodeURIComponent(slug)}`;

export const getTvDisplayUrl = (slug: string): string =>
  `${getPublicAppOrigin()}/tv/${encodeURIComponent(slug)}`;

export const getAdminAppUrl = (pathname = '/'): string => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getPublicAppOrigin()}${normalizedPath}`;
};
