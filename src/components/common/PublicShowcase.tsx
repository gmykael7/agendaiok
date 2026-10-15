import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AtSign,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Globe2,
  Instagram,
  MapPinned,
  Youtube,
} from 'lucide-react';
import type { Organization, OrganizationSocialLinks } from '../../types';
import { sanitizePublicGallery, sanitizeSocialLinks, type SocialLinkKey } from '../../utils/publicShowcase';

interface PublicShowcaseProps {
  org: Organization;
}

const socialMetadata: Array<{
  key: SocialLinkKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'facebook', label: 'Facebook', icon: Facebook },
  { key: 'tiktok', label: 'TikTok', icon: AtSign },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'website', label: 'Site', icon: Globe2 },
  { key: 'maps', label: 'Como chegar', icon: MapPinned },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PublicShowcase: React.FC<PublicShowcaseProps> = ({ org }) => {
  const gallery = useMemo(() => sanitizePublicGallery(org.public_gallery), [org.public_gallery]);
  const gallerySignature = gallery.map((item) => `${item.id}:${item.image_url}`).join('|');
  const links = useMemo(() => sanitizeSocialLinks(org.social_links), [org.social_links]);
  const socialItems = socialMetadata.filter(({ key }) => Boolean(links[key]));
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const visibleGallery = gallery.filter((item) => !failedIds.includes(item.id));
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  useEffect(() => {
    setFailedIds([]);
    setActiveIndex(0);
  }, [org.id, gallerySignature]);

  useEffect(() => {
    if (activeIndex >= visibleGallery.length) setActiveIndex(Math.max(0, visibleGallery.length - 1));
  }, [activeIndex, visibleGallery.length]);

  useEffect(() => {
    if (paused || visibleGallery.length < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveIndex((current) => (current + 1) % visibleGallery.length);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused, visibleGallery.length]);

  const showPrevious = () => setActiveIndex((current) => (current - 1 + visibleGallery.length) % visibleGallery.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % visibleGallery.length);
  const activeImage = visibleGallery[activeIndex];

  if (!activeImage && socialItems.length === 0) return null;

  return (
    <section aria-label="Galeria e redes sociais" className="border-b border-slate-800 bg-slate-950/20 px-4 py-4 sm:px-6 sm:py-5 space-y-3">
      {activeImage && (
        <div
          className="booking-showcase-media relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1120] shadow-lg"
          role="region"
          aria-roledescription="carrossel"
          aria-label={`Fotos de ${org.name}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          onPointerDown={(event) => { pointerStartX.current = event.clientX; setPaused(true); }}
          onPointerUp={(event) => {
            if (pointerStartX.current !== null && visibleGallery.length > 1) {
              const distance = event.clientX - pointerStartX.current;
              if (Math.abs(distance) > 45) distance > 0 ? showPrevious() : showNext();
            }
            pointerStartX.current = null;
            setPaused(false);
          }}
          onPointerCancel={() => { pointerStartX.current = null; setPaused(false); }}
        >
          <div className="relative aspect-[16/9] sm:aspect-[2/1]" role="group" aria-roledescription="slide" aria-label={`${activeIndex + 1} de ${visibleGallery.length}`}>
            <img
              key={activeImage.id}
              src={activeImage.image_url}
              alt={activeImage.alt_text || activeImage.caption || `Ambiente de ${org.name}`}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setFailedIds((items) => items.includes(activeImage.id) ? items : [...items, activeImage.id])}
              className="absolute inset-0 h-full w-full select-none object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            {activeImage.caption && (
              <p className="absolute inset-x-14 bottom-10 text-center text-xs font-bold text-white drop-shadow-md sm:text-sm">
                {activeImage.caption}
              </p>
            )}
          </div>

          {visibleGallery.length > 1 && (
            <>
              <button type="button" onClick={showPrevious} aria-label="Foto anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 p-2 text-white backdrop-blur hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={showNext} aria-label="Próxima foto" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 p-2 text-white backdrop-blur hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-label="Escolher foto">
                {visibleGallery.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    aria-label={`Mostrar foto ${index + 1}`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => setActiveIndex(index)}
                    className={`booking-showcase-dot h-2 rounded-full border border-white/40 p-0 transition-all ${index === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {socialItems.length > 0 && (
        <nav aria-label={`Redes sociais de ${org.name}`} className="flex flex-wrap justify-center gap-2">
          {socialItems.map(({ key, label, icon: Icon }) => (
            <a
              key={key}
              href={(links as OrganizationSocialLinks)[key]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-[#0B1120] px-3 py-2 text-[11px] font-bold text-slate-200 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </nav>
      )}
    </section>
  );
};
