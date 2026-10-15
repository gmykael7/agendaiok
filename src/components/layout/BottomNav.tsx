import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  House,
  ClipboardCheck,
  CalendarDays,
  WalletCards,
  Settings,
} from 'lucide-react';
import { StaffPermissions, TabType } from '../../types';
import { motionAllowed } from '../../utils/motion';

interface BottomNavProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  pendingCount?: number;
  onQuickAdd?: () => void;
  permissions?: StaffPermissions;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount = 0,
  permissions,
}) => {
  const centerBtnRef = useRef<HTMLButtonElement | null>(null);
  const [rippleWave, setRippleWave] = useState<{ x: number; y: number; radius: number } | null>(null);

  const handleCenterClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    setRippleWave({ x, y, radius: maxRadius });
    window.setTimeout(() => setRippleWave(null), 580);

    const doc = document as Document & {
      startViewTransition?: (cb: () => Promise<void> | void) => { ready: Promise<void> };
    };

    if (doc.startViewTransition && motionAllowed()) {
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
              duration: 520,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        })
        .catch(() => undefined);
    } else {
      setCurrentTab('agenda');
    }
  };

  const renderSideTab = (
    id: TabType,
    label: string,
    Icon: React.FC<{ className?: string }>,
    badge?: number
  ) => {
    const isActive = currentTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setCurrentTab(id)}
        aria-current={isActive ? 'page' : undefined}
        className={`app-bottom-nav-side-btn flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
          isActive ? 'is-active' : ''
        }`}
      >
        <div className="relative flex h-7 w-7 items-center justify-center">
          <Icon
            className={`h-[22px] w-[22px] transition-transform duration-200 ${
              isActive ? 'stroke-[2.4] scale-105' : 'stroke-[1.8]'
            }`}
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
        className="app-bottom-nav safe-bottom-nav fixed left-1/2 -translate-x-1/2 z-40 md:hidden w-[calc(100%-1.75rem)] max-w-[400px] pointer-events-none"
        style={{ bottom: 'max(0.85rem, env(safe-area-inset-bottom, 0.85rem))' }}
        aria-label="Navegação inferior"
      >
        <div className="app-bottom-nav-pill pointer-events-auto relative flex w-full items-center justify-between rounded-full px-4 py-2">
          {permissions?.dashboard !== false &&
            renderSideTab('dashboard', 'Início', House)}

          {permissions?.atendimentos !== false &&
            renderSideTab('atendimentos', 'Atender', ClipboardCheck, pendingCount)}

          {permissions?.agenda !== false && (
            <div className="relative flex items-center justify-center px-2 shrink-0">
              <button
                ref={centerBtnRef}
                type="button"
                onClick={handleCenterClick}
                aria-label="Abrir Agenda Completa"
                aria-current={currentTab === 'agenda' ? 'page' : undefined}
                className="app-bottom-nav-hero group relative flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 active:scale-90 hover:scale-105"
              >
                <CalendarDays className="h-6 w-6 stroke-[2.2] transition-transform group-hover:scale-105" />
              </button>
            </div>
          )}

          {permissions?.caixa !== false &&
            renderSideTab('caixa', 'Caixa', WalletCards)}

          {permissions?.ajustes !== false &&
            renderSideTab('ajustes', 'Ajustes', Settings)}
        </div>
      </nav>
    </>
  );
};
