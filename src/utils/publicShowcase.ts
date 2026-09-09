import type { OrganizationSocialLinks, PublicGalleryImage } from '../types';

export const PUBLIC_GALLERY_LIMIT = 6;

export const isSafePublicUrl = (value: unknown): boolean => {
  const text = String(value || '').trim();
  if (!text || text.length > 1000) return false;
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
};

export const sanitizePublicGallery = (value: unknown): PublicGalleryImage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id || `gallery-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100),
      image_url: String(item.image_url || '').trim().slice(0, 1000),
      caption: String(item.caption || '').trim().slice(0, 120) || undefined,
      alt_text: String(item.alt_text || '').trim().slice(0, 160) || undefined,
    }))
    .filter((item) => Boolean(item.id) && isSafePublicUrl(item.image_url))
    .slice(0, PUBLIC_GALLERY_LIMIT);
};

export const SOCIAL_LINK_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube', 'website', 'maps'] as const;
export type SocialLinkKey = typeof SOCIAL_LINK_KEYS[number];

export const sanitizeSocialLinks = (value: unknown): OrganizationSocialLinks => {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return SOCIAL_LINK_KEYS.reduce<OrganizationSocialLinks>((result, key) => {
    const url = String(source[key] || '').trim().slice(0, 1000);
    if (isSafePublicUrl(url)) result[key] = url;
    return result;
  }, {});
};
