import React from 'react';
import {
  Building2,
  CalendarDays,
  Smartphone,
  ArrowUpRight,
  ContactRound,
  WalletCards,
  ClipboardCheck,
  House,
  X,
  Settings,
  LogOut,
  BarChart3,
  Boxes,
} from 'lucide-react';
import { Organization, StaffPermissions, TabType } from '../../types';
import { BrandLogo } from '../common/BrandLogo';
import { AgencyCredit } from '../common/AgencyCredit';
import { getClientBookingUrl } from '../../config/urls';
import { useDialog } from '../../hooks/useDialog';

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  org: Organization | null;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  onLogout: () => void;
  permissions?: StaffPermissions;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  org,
  isSidebarOpen,
  setIsSidebarOpen,
  onLogout,
  permissions,
}) => {
  const drawerRef = useDialog(isSidebarOpen, () => setIsSidebarOpen(false));
  const publicPageUrl = org ? getClientBookingUrl(org.slug) : '';
  const publicPageLabel = publicPageUrl.replace(/^https?:\/\//, '');

  const menuItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; permission: keyof StaffPermissions }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: House, permission: 'dashboard' },
    { id: 'atendimentos', label: 'Atendimentos', icon: ClipboardCheck, permission: 'atendimentos' },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, permission: 'agenda' },
    { id: 'caixa', label: 'Caixa', icon: WalletCards, permission: 'caixa' },
    { id: 'produtos', label: 'Produtos', icon: Boxes, permission: 'products' },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3, permission: 'relatorios' },
    { id: 'clientes', label: 'Clientes', icon: ContactRound, permission: 'clientes' },
    { id: 'ajustes', label: 'Ajustes', icon: Settings, permission: 'ajustes' },
  ];

  return (
    <>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <aside
        id="app-sidebar"
        ref={drawerRef}
        role={isSidebarOpen ? 'dialog' : undefined}
        aria-modal={isSidebarOpen ? true : undefined}
        aria-label="Menu principal"
        tabIndex={-1}
        className={`app-sidebar fixed md:static inset-y-0 left-0 z-50 w-64 min-h-0 shrink-0 overflow-hidden bg-[#08101f] border-r border-slate-800/80 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0 visible' : '-translate-x-full invisible md:visible md:translate-x-0'
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-5 border-b border-slate-800/60 flex items-center justify-between bg-gradient-to-r from-cyan-400/5 to-blue-500/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white/95 border border-cyan-400/20 flex items-center justify-center shadow-lg shadow-cyan-500/10 overflow-hidden p-1 shrink-0">
                <BrandLogo variant="mark" className="w-full h-full" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold tracking-tight text-white leading-none">AgendAI</h1>
                <p className="text-[11px] text-cyan-300 font-medium mt-1">Gestão de Barbearia</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg" aria-label="Fechar menu">
              <X className="w-5 h-5" />
            </button>
          </div>

          {org && (
            <a
              href={publicPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 mx-3 my-3 rounded-2xl brand-panel flex items-center justify-between gap-2 transition-transform hover:-translate-y-0.5"
              title={`Abrir página pública: ${publicPageLabel}`}
              aria-label={`Abrir página pública de ${org.name}`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{org.name}</p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">{publicPageLabel}</p>
                </div>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </a>
          )}

          <nav className="app-sidebar-nav px-3 space-y-1 mt-2" aria-label="Navegação principal">
            {menuItems.filter((item) => permissions?.[item.permission] !== false).map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`app-sidebar-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shadow-sm shadow-emerald-500/10'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-cyan-400/10 border border-cyan-400/20' : 'bg-slate-900/70 border border-slate-800/70'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 p-4 border-t border-slate-800/80 space-y-3">
          <button
            onClick={() => {
              setCurrentTab('booking');
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium brand-button-soft hover:bg-cyan-400/15 transition-all"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Página do Cliente
            </span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              if (window.confirm('Deseja realmente sair do sistema?')) {
                onLogout();
              }
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair do Sistema
          </button>

          <AgencyCredit compact className="pt-3" />
        </div>
      </aside>
    </>
  );
};
