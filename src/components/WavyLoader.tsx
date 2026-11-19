import { useEffect, useRef } from 'react';

interface WavyLoaderProps {
  size?: number;
  className?: string;
}

export function WavyLoader({ size = 44, className = '' }: WavyLoaderProps) {
  const wavyPathRef = useRef<SVGPathElement>(null);
  const trackPathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const cx = 24, cy = 24, radius = 17.5, amplitude = 1.65, frequency = 9, gap = 0.28;
    const render = (now: number) => {
      const elapsed = (now - start) / 1000;
      const base = elapsed * 2.4;
      const phase = elapsed * 5.2;
      const span = Math.PI * 0.92 + Math.sin(elapsed * 2.2) * 0.22;
      const steps = 72;
      let wavy = '';
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const theta = base + t * span;
        const fade = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
        const r = radius + amplitude * fade * Math.sin(frequency * theta - phase);
        const x = cx + r * Math.cos(theta), y = cy + r * Math.sin(theta);
        wavy += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      const trackStart = base + span + gap;
      const trackSpan = Math.PI * 2 - span - gap * 2;
      const trackEnd = trackStart + trackSpan;
      const x1 = cx + radius * Math.cos(trackStart), y1 = cy + radius * Math.sin(trackStart);
      const x2 = cx + radius * Math.cos(trackEnd), y2 = cy + radius * Math.sin(trackEnd);
      const track = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${trackSpan > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
      wavyPathRef.current?.setAttribute('d', wavy);
      trackPathRef.current?.setAttribute('d', track);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="status" aria-label="Carregando" className={`select-none ${className}`}>
      <path ref={trackPathRef} stroke="currentColor" strokeOpacity={0.28} strokeWidth={3.4} strokeLinecap="round" />
      <path ref={wavyPathRef} stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
