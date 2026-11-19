import React, { useEffect, useRef, useMemo } from 'react';
import {
  Smartphone,
  LogOut,
  PanelLeftOpen,
  ArrowUpRight,
} from 'lucide-react';
import {
  IconlyHome,
  IconlyClipboard,
  IconlyCalendar,
  IconlyUsers,
  IconlyBag,
  IconlyWallet,
  IconlyReceipt,
  IconlyBadge,
  IconlyMegaphone,
  IconlyChart,
  IconlySetting,
  IconlyProps,
} from '../common/IconlyIcons';
import { Organization, StaffPermissions, TabType } from '../../types';
import { BrandLogo } from '../common/BrandLogo';
import { getClientBookingUrl } from '../../config/urls';
import { appConfirm } from '../common/ConfirmDialog';
import { gsap } from 'gsap';
import { motionAllowed } from '../../utils/motionPref';

interface DesktopCapsuleNavProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  org: Organization | null;
  onOpenFullSidebar: () => void;
  onLogout: () => void;
  permissions?: StaffPermissions;
  pendingCount?: number;
}

const menuItems: { id: TabType; label: string; icon: React.FC<IconlyProps>; permission: keyof StaffPermissions }[] = [
  { id: 'dashboard', label: 'Início', icon: IconlyHome, permission: 'dashboard' },
  { id: 'atendimentos', label: 'Atender', icon: IconlyClipboard, permission: 'atendimentos' },
  { id: 'agenda', label: 'Agenda', icon: IconlyCalendar, permission: 'agenda' },
  { id: 'clientes', label: 'Clientes', icon: IconlyUsers, permission: 'clientes' },
  { id: 'produtos', label: 'Produtos', icon: IconlyBag, permission: 'products' },
  { id: 'caixa', label: 'Caixa', icon: IconlyWallet, permission: 'caixa' },
  { id: 'comandas', label: 'Comandas', icon: IconlyReceipt, permission: 'caixa' },
  { id: 'assinaturas', label: 'Assinaturas', icon: IconlyBadge, permission: 'ajustes' },
  { id: 'campanhas', label: 'Campanhas', icon: IconlyMegaphone, permission: 'clientes' },
  { id: 'relatorios', label: 'Relatórios', icon: IconlyChart, permission: 'relatorios' },
  { id: 'ajustes', label: 'Ajustes', icon: IconlySetting, permission: 'ajustes' },
];

export const DesktopCapsuleNav: React.FC<DesktopCapsuleNavProps> = ({
  currentTab,
  setCurrentTab,
  org,
  onOpenFullSidebar,
  onLogout,
  permissions,
  pendingCount = 0,
}) => {
  const pillRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isFirstMount = useRef(true);

  const visibleItems = useMemo(() => {
    if (!permissions) return menuItems;
    return menuItems.filter((item) => permissions[item.permission] !== false);
  }, [permissions]);

  const activeIndex = useMemo(() => {
    return visibleItems.findIndex((item) => item.id === currentTab);
  }, [visibleItems, currentTab]);

  const publicPageUrl = org ? getClientBookingUrl(org.slug) : '';

  // Efeito da cápsula deslizante vertical (FLIP / GSAP)
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    if (activeIndex === -1) {
      gsap.to(pill, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      return;
    }

    const targetBtn = buttonRefs.current[activeIndex];
    if (!targetBtn) return;

    const targetY = targetBtn.offsetTop;
    const targetH = targetBtn.offsetHeight;

    if (targetH === 0) {
      requestAnimationFrame(() => {
        if (!targetBtn || !pill) return;
        pill.style.height = `${targetBtn.offsetHeight}px`;
        gsap.set(pill, {
          y: targetBtn.offsetTop,
          opacity: 1,
        });
      });
      return;
    }

    pill.style.height = `${targetH}px`;

    if (isFirstMount.current) {
      isFirstMount.current = false;
      gsap.set(pill, {
        y: targetY,
        opacity: 1,
      });
      return;
    }

    if (!motionAllowed()) {
      gsap.set(pill, {
        y: targetY,
        opacity: 1,
      });
      return;
    }

    const currentY = (gsap.getProperty(pill, 'y') as number) ?? targetY;
    const dy = targetY - currentY;
    const distance = Math.abs(dy);

    if (distance < 1) {
      gsap.to(pill, {
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      return;
    }

    // Leve elasticidade vertical proporcional à distância percorrida
    const maxStretch = Math.min(1.22, 1.06 + (distance / 400) * 0.16);

    gsap.killTweensOf(pill);

    // 1. Movimento vertical
    gsap.to(pill, {
      y: targetY,
      opacity: 1,
      duration: 0.38,
      ease: 'power3.out',
      overwrite: 'auto',
    });

    // 2. Alongamento e retorno elástico (mola suave)
    gsap.to(pill, {
      keyframes: [
        {
          scaleY: maxStretch,
          duration: 0.15,
          ease: 'power2.out',
        },
        {
          scaleY: 1,
          duration: 0.23,
          ease: 'back.out(1.4)',
        },
      ],
      overwrite: 'auto',
    });
  }, [activeIndex]);

  return (
    <aside
      aria-label="Navegação em cápsula"
      className="desktop-capsule-nav hidden md:flex flex-col justify-between w-[196px] shrink-0 my-3 ml-3 rounded-[28px] bg-[#08101F]/90 border border-slate-800/80 backdrop-blur-xl shadow-2xl py-3 px-2 z-30 select-none"
    >
      {/* TOPO: Marca e Logo do AgendAI */}
      <div className="shrink-0 flex items-center gap-2.5 px-2 py-1">
        <button
          type="button"
          onClick={() => setCurrentTab('dashboard')}
          className="group relative w-11 h-11 rounded-2xl bg-white/95 border border-cyan-400/20 flex items-center justify-center p-1.5 transition-transform hover:scale-105 active:scale-95 shadow-md shadow-cyan-500/10"
          title="Início"
          aria-label="Ir para o Início"
        >
          <BrandLogo variant="mark" className="w-full h-full" />
        </button>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-black tracking-tight text-white">AgendAI</p>
          <p className="text-[10px] font-medium text-slate-400">Gestão da barbearia</p>
        </div>
      </div>

      {/* CENTRO: Itens de Navegação com a Cápsula Deslizante */}
      <div className="my-auto py-3 w-full flex flex-col overflow-y-auto overflow-x-hidden max-h-[calc(100vh-190px)] overscroll-contain no-scrollbar">
        <nav className="relative flex flex-col gap-1 w-full" aria-label="Abas principais">
          {/* O Indicador Deslizante com a Cor dos Ajustes */}
          <div
            ref={pillRef}
            aria-hidden="true"
            className="absolute left-1 right-1 h-12 rounded-2xl pointer-events-none opacity-0 border"
            style={{
              background: 'color-mix(in srgb, var(--brand-color, #10b981) 16%, transparent)',
              borderColor: 'color-mix(in srgb, var(--brand-color, #10b981) 32%, transparent)',
              boxShadow: '0 6px 18px color-mix(in srgb, var(--brand-color, #10b981) 12%, transparent)',
              zIndex: 1,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          />

          {visibleItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const showBadge = item.id === 'atendimentos' && pendingCount > 0;

            return (
              <button
                key={item.id}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`group relative z-10 w-full min-h-12 px-3 rounded-2xl flex items-center gap-3 text-left transition-colors ${
                  isActive
                    ? 'text-[var(--brand-color,#34d399)] font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div
                  className="relative flex items-center justify-center transition-transform duration-200"
                  style={{
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  <Icon
                    active={isActive}
                    className={`w-5 h-5 transition-colors duration-200 ${
                      isActive ? 'text-[var(--brand-color,#34d399)]' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black flex items-center justify-center font-mono shadow-sm">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>

                <span className="text-xs tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* RODAPÉ: Ações Rápidas (Página do Cliente, Expandir Menu, Sair) */}
      <div className="shrink-0 flex flex-col gap-1 pt-3 px-1 border-t border-slate-800/80 w-full">
        {publicPageUrl && (
          <a
            href={publicPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative min-h-11 px-3 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 text-emerald-400 flex items-center gap-3 transition-colors hover:bg-cyan-400/20 active:scale-[0.98]"
            aria-label="Abrir página pública do cliente"
          >
            <Smartphone className="w-4 h-4" />
            <span className="text-xs font-medium">Página do cliente</span><ArrowUpRight className="w-3.5 h-3.5 ml-auto" />
          </a>
        )}

        {/* Botão de Expandir para Menu Completo */}
        <button
          type="button"
          onClick={onOpenFullSidebar}
          className="group relative min-h-11 px-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-3 transition-colors active:scale-[0.98]"
          aria-label="Expandir menu completo"
        >
          <PanelLeftOpen className="w-4 h-4" />
          <span className="text-xs font-medium">Menu completo</span>
        </button>

        {/* Botão de Sair do Sistema */}
        <button
          type="button"
          onClick={async () => {
            if (await appConfirm('Deseja realmente sair do sistema?')) {
              onLogout();
            }
          }}
          className="group relative min-h-11 px-3 rounded-2xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 flex items-center gap-3 transition-colors active:scale-[0.98]"
          aria-label="Sair do sistema"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium">Sair do sistema</span>
        </button>
      </div>
    </aside>
  );
};
