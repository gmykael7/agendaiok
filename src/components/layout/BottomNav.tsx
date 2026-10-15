import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  House,
  ClipboardCheck,
  CalendarDays,
  WalletCards,
  ContactRound,
  Settings,
  Grid2x2,
  X,
  Receipt,
  Megaphone,
  Package,
  BarChart3,
  Sparkles,
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [rippleWave, setRippleWave] = useState<{ x: number; y: number; radius: number } | null>(null);

  const handleCenterClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Efeito de onda visual luminosa que expande a partir do centro
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

  const moreItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
    { id: 'clientes', label: 'Clientes', icon: ContactRound, desc: 'Base, fidelidade e CRM' },
    { id: 'ajustes', label: 'Ajustes', icon: Settings, desc: 'Configurações e perfil' },
    { id: 'comandas', label: 'Comandas', icon: Receipt, desc: 'Consumo e fechamento' },
    { id: 'campanhas', label: 'Campanhas', icon: Megaphone, desc: 'Disparos de WhatsApp' },
    { id: 'produtos', label: 'Produtos', icon: Package, desc: 'Estoque e vendas' },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3, desc: 'Faturamento e métricas' },
  ];

  const isMoreActive = ['clientes', 'ajustes', 'comandas', 'campanhas', 'produtos', 'relatorios'].includes(currentTab);

  const getMoreIcon = () => {
    if (currentTab === 'clientes') return ContactRound;
    if (currentTab === 'ajustes') return Settings;
    if (currentTab === 'comandas') return Receipt;
    if (currentTab === 'campanhas') return Megaphone;
    if (currentTab === 'produtos') return Package;
    if (currentTab === 'relatorios') return BarChart3;
    return Grid2x2;
  };

  const MoreIcon = getMoreIcon();

  return (
    <>
      {/* ONDA DE EXPANSÃO CIRCULAR (PORTAL) */}
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
                  'radial-gradient(circle, rgba(14,165,233,0.38) 0%, rgba(2,132,199,0.2) 45%, transparent 75%)',
                animation: 'circularRevealWave 540ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
              }}
            />
          </div>,
          document.body
        )}

      {/* MODAL / GAVETA RÁPIDA DE "MAIS OPÇÕES" */}
      {showMoreMenu &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
            <div
              className="w-full max-w-sm rounded-3xl border border-slate-800 bg-[#0c1527] p-5 shadow-2xl animate-scaleUp space-y-4"
              role="dialog"
              aria-label="Mais opções de navegação"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                    <Grid2x2 className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">Outros Módulos</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {moreItems.map((item) => {
                  const ItemIcon = item.icon;
                  const active = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCurrentTab(item.id);
                        setShowMoreMenu(false);
                      }}
                      className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                        active
                          ? 'border-sky-500/50 bg-sky-500/15 text-white shadow-sm'
                          : 'border-slate-800/80 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <ItemIcon className={`h-5 w-5 mb-1.5 ${active ? 'text-sky-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-white">{item.label}</span>
                      <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* BARRA INFERIOR FLUTUANTE EM CÁPSULA (FLOATING ISLAND DOCK) */}
      <nav
        className="app-bottom-nav fixed left-1/2 -translate-x-1/2 z-40 md:hidden w-[calc(100%-1.75rem)] max-w-md pointer-events-none"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
        aria-label="Navegação inferior flutuante"
      >
        <div className="pointer-events-auto relative flex w-full items-center justify-between rounded-full border border-white/10 bg-[#0c1527]/92 px-3 py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.65),0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          {/* LADO ESQUERDO: INÍCIO */}
          {permissions?.dashboard !== false && (
            <button
              type="button"
              onClick={() => setCurrentTab('dashboard')}
              aria-current={currentTab === 'dashboard' ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                currentTab === 'dashboard' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  currentTab === 'dashboard' ? 'bg-sky-500/15 text-sky-400 scale-105' : 'text-slate-400'
                }`}
              >
                <House className="h-5 w-5 stroke-[1.9]" />
              </div>
              <span
                className={`mt-0.5 text-[10px] tracking-tight ${
                  currentTab === 'dashboard' ? 'font-bold text-sky-400' : 'font-medium text-slate-400'
                }`}
              >
                Início
              </span>
            </button>
          )}

          {/* LADO ESQUERDO: ATENDER */}
          {permissions?.atendimentos !== false && (
            <button
              type="button"
              onClick={() => setCurrentTab('atendimentos')}
              aria-current={currentTab === 'atendimentos' ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                currentTab === 'atendimentos' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  currentTab === 'atendimentos' ? 'bg-sky-500/15 text-sky-400 scale-105' : 'text-slate-400'
                }`}
              >
                <ClipboardCheck className="h-5 w-5 stroke-[1.9]" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center font-mono shadow-sm">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span
                className={`mt-0.5 text-[10px] tracking-tight ${
                  currentTab === 'atendimentos' ? 'font-bold text-sky-400' : 'font-medium text-slate-400'
                }`}
              >
                Atender
              </span>
            </button>
          )}

          {/* CENTRO: BOTÃO PRINCIPAL ELEVADO PERMANENTEMENTE ATIVO */}
          <div className="relative flex flex-col items-center justify-center px-1.5 shrink-0">
            <button
              ref={centerBtnRef}
              type="button"
              onClick={handleCenterClick}
              aria-label="Abrir Agenda Completa"
              aria-current={currentTab === 'agenda' ? 'page' : undefined}
              className="group relative -top-3 sm:-top-3.5 flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 text-white shadow-[0_10px_25px_rgba(14,165,233,0.55)] ring-4 ring-[#08101f] transition-all duration-300 active:scale-90 hover:scale-105"
            >
              {/* Brilho pulsante sutil no fundo */}
              <span
                className="absolute inset-0 rounded-full bg-sky-400/35 blur-md pointer-events-none -z-10 group-hover:bg-sky-400/60 transition-colors"
                aria-hidden="true"
              />

              <CalendarDays className="h-6 w-6 stroke-[2.2] text-white drop-shadow-sm transition-transform group-hover:scale-110" />

              {/* Indicador sutil de seleção */}
              {currentTab === 'agenda' && (
                <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-white shadow-sm animate-pulse" />
              )}
            </button>
          </div>

          {/* LADO DIREITO: CAIXA */}
          {permissions?.caixa !== false && (
            <button
              type="button"
              onClick={() => setCurrentTab('caixa')}
              aria-current={currentTab === 'caixa' ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                currentTab === 'caixa' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  currentTab === 'caixa' ? 'bg-sky-500/15 text-sky-400 scale-105' : 'text-slate-400'
                }`}
              >
                <WalletCards className="h-5 w-5 stroke-[1.9]" />
              </div>
              <span
                className={`mt-0.5 text-[10px] tracking-tight ${
                  currentTab === 'caixa' ? 'font-bold text-sky-400' : 'font-medium text-slate-400'
                }`}
              >
                Caixa
              </span>
            </button>
          )}

          {/* LADO DIREITO: MAIS MÓDULOS / CLIENTES */}
          <button
            type="button"
            onClick={() => setShowMoreMenu(true)}
            aria-label="Abrir mais opções"
            aria-expanded={showMoreMenu}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              isMoreActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                isMoreActive ? 'bg-sky-500/15 text-sky-400 scale-105' : 'text-slate-400'
              }`}
            >
              <MoreIcon className="h-5 w-5 stroke-[1.9]" />
            </div>
            <span
              className={`mt-0.5 text-[10px] tracking-tight ${
                isMoreActive ? 'font-bold text-sky-400' : 'font-medium text-slate-400'
              }`}
            >
              {currentTab === 'clientes'
                ? 'Clientes'
                : currentTab === 'ajustes'
                ? 'Ajustes'
                : currentTab === 'comandas'
                ? 'Comandas'
                : 'Mais'}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
