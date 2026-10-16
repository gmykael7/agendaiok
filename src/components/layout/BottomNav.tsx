import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconlyHome,
  IconlyClipboard,
  IconlyCalendar,
  IconlyWallet,
  IconlySetting,
  IconlyProps,
} from '../common/IconlyIcons';
import { StaffPermissions, TabType } from '../../types';
import { motionAllowed } from '../../utils/motion';

interface BottomNavProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  pendingCount?: number;
  onQuickAdd?: () => void;
  permissions?: StaffPermissions;
}

/**
 * Retorna true somente quando a cor de destaque é amarela/dourada,
 * caso em que o ícone da Agenda fica preto (#0B1120).
 * Em todas as demais cores, o ícone fica branco puro (#FFFFFF).
 */
export const isYellowHighlightColor = (rawColor: string): boolean => {
  const hex = rawColor.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3,6}$/.test(hex)) return false;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.15) return false;

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;

  return h >= 38 && h <= 68 && r > 0.78 && g > 0.58 && b < 0.45;
};

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount = 0,
  permissions,
}) => {
  const centerBtnRef = useRef<HTMLButtonElement | null>(null);
  const [rippleWave, setRippleWave] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [isYellowBrand, setIsYellowBrand] = useState<boolean>(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateColorCheck = () => {
      const brand =
        document.documentElement.style.getPropertyValue('--brand-color') ||
        getComputedStyle(document.documentElement).getPropertyValue('--brand-color') ||
        '#10B981';
      setIsYellowBrand(isYellowHighlightColor(brand));
    };
    updateColorCheck();
    const observer = new MutationObserver(updateColorCheck);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-app-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const heroIconColor = isYellowBrand ? '#0B1120' : '#FFFFFF';

  const handleCenterClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (currentTab === 'agenda') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Detecção de aparelhos de entrada (≤ 4GB RAM ou ≤ 4 núcleos) para garantir 60fps
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : null;
    const isLowEnd =
      nav &&
      ((typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) ||
        (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4));

    const doc = document as Document & {
      startViewTransition?: (cb: () => Promise<void> | void) => { ready: Promise<void> };
    };

    // Em celulares mais modestos, não captura textura de tela cheia (ViewTransition) para não engasgar a GPU
    if (!isLowEnd && doc.startViewTransition && motionAllowed()) {
      setRippleWave({ x, y, radius: Math.min(maxRadius, 500) });
      window.setTimeout(() => setRippleWave(null), 520);

      const transition = doc.startViewTransition(() => {
        setCurrentTab('agenda');
      });

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(28px at ${x}px ${y}px)`,
                `circle(${maxRadius * 1.05}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 480,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        })
        .catch(() => undefined);
    } else {
      // Transição ultra-leve acelerada 100% por GPU
      setRippleWave({ x, y, radius: Math.min(maxRadius, 360) });
      window.setTimeout(() => setRippleWave(null), 420);
      setCurrentTab('agenda');
    }
  };

  const renderSideTab = (
    id: TabType,
    label: string,
    Icon: React.FC<IconlyProps>,
    badge?: number
  ) => {
    const isActive = currentTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setCurrentTab(id)}
        aria-current={isActive ? 'page' : undefined}
        className={`app-bottom-nav-side-btn relative z-10 flex flex-1 flex-col items-center justify-center py-1.5 transition-all active:scale-95 ${
          isActive ? 'is-active' : ''
        }`}
      >
        <div className="relative flex h-7 w-7 items-center justify-center">
          <Icon
            active={isActive}
            className="h-[22px] w-[22px] transition-transform duration-200"
          />
          {badge !== undefined && badge > 0 && (
            <span className="app-bottom-nav-badge absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center font-mono shadow-sm">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>
        <span
          className={`mt-1 text-[11px] leading-none tracking-tight ${
            isActive ? 'font-bold' : 'font-medium'
          }`}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <>
      {rippleWave &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="absolute rounded-full"
              style={{
                left: rippleWave.x,
                top: rippleWave.y,
                width: rippleWave.radius * 2.2,
                height: rippleWave.radius * 2.2,
                transform: 'translate(-50%, -50%) scale(0)',
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--brand-color) 42%, transparent) 0%, color-mix(in srgb, var(--brand-color) 20%, transparent) 45%, transparent 75%)',
                animation: 'circularRevealWave 540ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
              }}
            />
          </div>,
          document.body
        )}

      <nav
        className="app-bottom-nav safe-bottom-nav fixed left-1/2 -translate-x-1/2 z-40 md:hidden w-[calc(100%-1.75rem)] max-w-[410px] pointer-events-none"
        style={{ bottom: 'max(0.85rem, env(safe-area-inset-bottom, 0.85rem))' }}
        aria-label="Navegação inferior"
      >
        <div className="app-bottom-nav-wave-shell pointer-events-auto relative flex h-[66px] w-full items-center justify-between px-3">
          {/* Superfície da cápsula com a onda baixa côncava esculpida em SVG */}
          <svg
            viewBox="0 0 400 66"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="app-bottom-nav-wave-svg pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <path
              className="app-bottom-nav-wave-path"
              d="M 33,0 L 130,0 C 156,0 166,34 200,34 C 234,34 244,0 270,0 L 367,0 A 33,33 0 0 1 400,33 A 33,33 0 0 1 367,66 L 33,66 A 33,33 0 0 1 0,33 A 33,33 0 0 1 33,0 Z"
            />
          </svg>

          {/* Lado Esquerdo: Início + Atender */}
          <div className="relative z-10 flex flex-1 items-center justify-around pr-2">
            {permissions?.dashboard !== false &&
              renderSideTab('dashboard', 'Início', IconlyHome)}
            {permissions?.atendimentos !== false &&
              renderSideTab('atendimentos', 'Atender', IconlyClipboard, pendingCount)}
          </div>

          {/* Berço da Onda Baixa + Botão Central Flutuando */}
          {permissions?.agenda !== false && (
            <div className="relative z-20 flex w-[84px] shrink-0 items-center justify-center">
              <button
                ref={centerBtnRef}
                type="button"
                onClick={handleCenterClick}
                aria-label="Abrir Agenda Completa"
                aria-current={currentTab === 'agenda' ? 'page' : undefined}
                style={
                  {
                    '--hero-icon-color': heroIconColor,
                    backgroundColor: 'var(--brand-color)',
                    color: heroIconColor,
                  } as React.CSSProperties
                }
                className="app-bottom-nav-hero group relative -top-[22px] flex h-[56px] w-[56px] items-center justify-center rounded-full transition-transform duration-200 active:scale-90 hover:scale-105"
              >
                <IconlyCalendar
                  variant="hero"
                  active={currentTab === 'agenda'}
                  className="h-6 w-6 transition-transform group-hover:scale-105"
                />
              </button>
            </div>
          )}

          {/* Lado Direito: Caixa + Ajustes */}
          <div className="relative z-10 flex flex-1 items-center justify-around pl-2">
            {permissions?.caixa !== false &&
              renderSideTab('caixa', 'Caixa', IconlyWallet)}
            {permissions?.ajustes !== false &&
              renderSideTab('ajustes', 'Ajustes', IconlySetting)}
          </div>
        </div>
      </nav>
    </>
  );
};
