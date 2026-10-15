import { useEffect, useRef, useState } from 'react';

export function LandingPromoVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setShouldLoad(true);
      frameRef.current?.contentWindow?.postMessage(
        entry.isIntersecting ? 'agendai-promo:play' : 'agendai-promo:pause',
        window.location.origin,
      );
    }, { threshold: 0.2 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby="promo-video-title" className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mb-7 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC400]">Veja em ação</p>
        <h2 id="promo-video-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Conheça o AgendAI em 30 segundos</h2>
        <p className="mt-3 text-sm text-slate-400">Uma visão da agenda, dos atendimentos e dos resultados em um só lugar.</p>
      </div>
      <div ref={containerRef} className="overflow-hidden rounded-2xl border border-white/15 bg-[#050912] shadow-2xl sm:rounded-[28px]" style={{ aspectRatio: '1920 / 1150' }}>
        {shouldLoad && (
          <iframe
            ref={frameRef}
            title="Apresentação animada do AgendAI"
            src="/promo-agendai/index.html"
            className="h-full w-full border-0"
            loading="lazy"
            allow="autoplay"
          />
        )}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Telas ilustrativas com dados de demonstração.</p>
    </section>
  );
}
