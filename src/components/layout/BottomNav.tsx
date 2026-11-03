import React, { useEffect, useRef, useMemo } from 'react';
import {
  IconlyHome,
  IconlyClipboard,
  IconlyWallet,
  IconlyCalendar,
  IconlyUsers,
  IconlySetting,
  IconlyProps,
} from '../common/IconlyIcons';
import { TabType, StaffPermissions } from '../../types';
import { gsap } from 'gsap';
import { motionAllowed } from '../../utils/motionPref';

interface BottomNavProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  pendingCount?: number;
  permissions?: StaffPermissions;
}

const menuItems: { id: TabType; label: string; icon: React.FC<IconlyProps> }[] = [
  { id: 'dashboard', label: 'Início', icon: IconlyHome },
  { id: 'atendimentos', label: 'Atender', icon: IconlyClipboard },
  { id: 'caixa', label: 'Caixa', icon: IconlyWallet },
  { id: 'agenda', label: 'Agenda', icon: IconlyCalendar },
  { id: 'clientes', label: 'Clientes', icon: IconlyUsers },
  { id: 'ajustes', label: 'Ajustes', icon: IconlySetting },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount = 0,
  permissions,
}) => {
  const pillRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isFirstMount = useRef(true);

  const visibleItems = useMemo(() => {
    if (!permissions) return menuItems;
    return menuItems.filter((item) => {
      return permissions[item.id as keyof StaffPermissions] !== false;
    });
  }, [permissions]);

  const activeIndex = useMemo(() => {
    const idx = visibleItems.findIndex((item) => item.id === currentTab);
    return idx >= 0 ? idx : -1;
  }, [visibleItems, currentTab]);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    if (activeIndex === -1) {
      gsap.to(pill, {
        opacity: 0,
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      return;
    }

    const targetBtn = buttonRefs.current[activeIndex];
    if (!targetBtn) return;

    const targetX = targetBtn.offsetLeft;
    const targetWidth = targetBtn.offsetWidth;

    // Caso o botão ainda não tenha sido medido (primeiro ciclo de montagem)
    if (targetWidth === 0) {
      requestAnimationFrame(() => {
        if (!targetBtn || !pill) return;
        pill.style.width = `${targetBtn.offsetWidth}px`;
        gsap.set(pill, {
          x: targetBtn.offsetLeft,
          scaleX: 1,
          opacity: 1,
        });
      });
      return;
    }

    // Atualiza a largura da cápsula para casar perfeitamente com o botão
    pill.style.width = `${targetWidth}px`;

    // No primeiro carregamento, posiciona imediatamente sem animação de entrada
    if (isFirstMount.current) {
      isFirstMount.current = false;
      gsap.set(pill, {
        x: targetX,
        scaleX: 1,
        opacity: 1,
      });
      return;
    }

    // Se preferência por movimento reduzido estiver ativa, posiciona sem transição
    if (!motionAllowed()) {
      gsap.set(pill, {
        x: targetX,
        scaleX: 1,
        opacity: 1,
      });
      return;
    }

    // Posição x atual da cápsula (mesmo no meio de outro movimento)
    const currentX = (gsap.getProperty(pill, 'x') as number) ?? targetX;
    const dx = targetX - currentX;
    const distance = Math.abs(dx);

    if (distance < 1) {
      gsap.to(pill, {
        scaleX: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      return;
    }

    // Alongamento proporcional ao deslocamento:
    // saltos curtos (~50px) esticam suavemente (~1.12x), saltos longos (~250px) chegam a ~1.26x
    const maxStretch = Math.min(1.26, 1.08 + (distance / 320) * 0.18);

    // Cancela o tween anterior para redirecionar suavemente da posição atual (toques rápidos)
    gsap.killTweensOf(pill);

    // 1. Deslocamento até o novo ícone em 400ms (350-450ms)
    gsap.to(pill, {
      x: targetX,
      opacity: 1,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: 'auto',
    });

    // 2. Alongamento horizontal durante o voo e mola suave ao chegar (sem oscilação excessiva)
    gsap.to(pill, {
      keyframes: [
        {
          scaleX: maxStretch,
          duration: 0.16,
          ease: 'power2.out',
        },
        {
          scaleX: 1,
          duration: 0.24,
          ease: 'back.out(1.5)',
        },
      ],
      overwrite: 'auto',
    });
  }, [activeIndex]);

  // Recalcula posição imediatamente em caso de redimensionamento de janela ou rotação
  useEffect(() => {
    const handleResize = () => {
      if (activeIndex === -1) return;
      const targetBtn = buttonRefs.current[activeIndex];
      const pill = pillRef.current;
      if (targetBtn && pill) {
        pill.style.width = `${targetBtn.offsetWidth}px`;
        gsap.set(pill, {
          x: targetBtn.offsetLeft,
          scaleX: 1,
          opacity: 1,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeIndex]);

  return (
    <nav
      className="app-bottom-nav safe-bottom-nav fixed left-1/2 -translate-x-1/2 z-40 md:hidden w-[calc(100%-1.25rem)] max-w-[460px] pointer-events-none"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
      aria-label="Navegação inferior"
    >
      <div
        className="app-bottom-nav-bar pointer-events-auto relative grid p-1 rounded-full items-center"
        style={{
          gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))`,
        }}
      >
        {/* A Única Cápsula Deslizante (Sliding Pill) */}
        <div
          ref={pillRef}
          aria-hidden="true"
          className="app-bottom-nav-sliding-pill absolute top-1 bottom-1 left-0 rounded-full pointer-events-none opacity-0"
        />

        {/* Itens de navegação com ícones fixos */}
        {visibleItems.map(({ id, label, icon: Icon }, index) => {
          const isActive = currentTab === id;
          const showBadge = id === 'atendimentos' && pendingCount > 0;

          return (
            <button
              key={id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              onClick={() => setCurrentTab(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={`app-bottom-nav-item relative z-10 flex flex-1 flex-col items-center justify-center min-h-[50px] py-1 select-none touch-manipulation focus:outline-none transition-colors ${
                isActive ? 'is-active' : ''
              }`}
            >
              <div
                className="relative flex items-center justify-center transition-transform duration-200"
                style={{
                  transform: isActive ? 'scale(1.12)' : 'scale(1)',
                }}
              >
                <Icon
                  active={isActive}
                  className={`h-5 w-5 transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center font-mono shadow-sm">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span
                className={`max-w-full truncate text-[10px] tracking-tight leading-none mt-0.5 transition-all duration-200 ${
                  isActive
                    ? 'font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'
                    : 'font-medium text-slate-400 dark:text-slate-400'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
