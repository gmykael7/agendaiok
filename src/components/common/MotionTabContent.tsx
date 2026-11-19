import React, { useEffect, useRef } from 'react';
import { motionAllowed } from '../../utils/motionPref';

interface MotionTabContentProps {
  tabKey: string;
  children: React.ReactNode;
  className?: string;
}

export const MotionTabContent: React.FC<MotionTabContentProps> = ({
  tabKey,
  children,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef<string>(tabKey);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!motionAllowed()) {
      prevTabRef.current = tabKey;
      return;
    }

    // 1. ANIMAÇÃO DE ENTRADA ESCALONADA DOS CARDS (FADE + SCALE + TRANSLATEY + BLUR)
    const cards = container.querySelectorAll<HTMLElement>(
      '.stagger-item, .booking-card, .agendai-card, .agendai-feature-card, [data-enter], article, .card'
    );
    const targetCards = cards.length > 0 ? Array.from(cards) : Array.from(container.children) as HTMLElement[];

    // Limita aos primeiros 14 cartões para altíssima performance em listas longas
    const cardsToAnimate = targetCards.slice(0, 14);

    cardsToAnimate.forEach((card, index) => {
      const delay = Math.min(index * 35, 380);
      try {
        card.animate(
          [
            {
              opacity: 0,
              transform: 'translateY(16px) scale(0.985)',
              filter: 'blur(3.5px)',
            },
            {
              opacity: 1,
              transform: 'translateY(0) scale(1)',
              filter: 'blur(0)',
            },
          ],
          {
            duration: 500,
            delay,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both',
          }
        );
      } catch {
        // Fallback gracioso caso WAAPI não suporte filter em navegadores legados
        card.style.opacity = '1';
        card.style.transform = 'none';
      }
    });

    // 2. ANIMAÇÃO PROGRESSIVA DE BARRAS DE OCUPAÇÃO/GRÁFICOS
    const bars = container.querySelectorAll<HTMLElement>(
      '[data-bar], .bar-occupancy, .chart-bar'
    );
    bars.forEach((bar, index) => {
      try {
        bar.style.transformOrigin = 'bottom';
        bar.animate(
          [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
          {
            duration: 650,
            delay: 150 + index * 45,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both',
          }
        );
      } catch {}
    });

    // 3. ANIMAÇÃO PROGRESSIVA DE CONTADORES NUMÉRICOS
    const countElements = container.querySelectorAll<HTMLElement>('[data-count]');
    countElements.forEach((el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || target <= 0) return;

      const duration = 850;
      const startTime = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * easeOut);
        el.textContent = current.toLocaleString('pt-BR');

        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    });

    prevTabRef.current = tabKey;
  }, [tabKey]);

  return (
    <div ref={containerRef} className={`motion-tab-wrapper min-w-0 ${className}`}>
      {children}
    </div>
  );
};
