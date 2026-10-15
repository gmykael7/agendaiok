import { useEffect } from 'react';
import { CANONICAL_APP_ORIGIN } from '../../config/urls';

type StructuredData = Record<string, unknown> | Array<Record<string, unknown>>;

interface PageSeoProps {
  title: string;
  description: string;
  path: string;
  structuredData?: StructuredData;
  noIndex?: boolean;
}

const upsertMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
};

export const PageSeo = ({ title, description, path, structuredData, noIndex = false }: PageSeoProps) => {
  useEffect(() => {
    const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;
    const canonicalUrl = `${CANONICAL_APP_ORIGIN}${normalizedPath}`;
    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'pt_BR');
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'AgendAI');
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const existing = document.getElementById('agendai-structured-data');
    existing?.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.id = 'agendai-structured-data';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(structuredData).replace(/</g, '\\u003c');
      document.head.appendChild(script);
    }
  }, [description, noIndex, path, structuredData, title]);

  return null;
};
