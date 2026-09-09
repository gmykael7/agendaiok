import React from 'react';
import {
  House,
  ClipboardCheck,
  CalendarDays,
  WalletCards,
  ContactRound,
  Settings,
} from 'lucide-react';
import { StaffPermissions, TabType } from '../../types';

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
  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; permission: keyof StaffPermissions }[] = [
    { id: 'dashboard', label: 'Início', icon: House, permission: 'dashboard' },
    { id: 'atendimentos', label: 'Atendimentos', icon: ClipboardCheck, permission: 'atendimentos' },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, permission: 'agenda' },
    { id: 'caixa', label: 'Caixa', icon: WalletCards, permission: 'caixa' },
    { id: 'clientes', label: 'Clientes', icon: ContactRound, permission: 'clientes' },
    { id: 'ajustes', label: 'Ajustes', icon: Settings, permission: 'ajustes' },
  ];

  return (
    <nav className="app-bottom-nav relative z-40 shrink-0 safe-bottom-nav bg-[#08101f]/95 backdrop-blur-xl border-t border-slate-800/80 px-1 pt-2 md:hidden shadow-[0_-10px_34px_rgba(0,0,0,0.45)]" aria-label="Navegação inferior">
      <div className="flex items-center justify-around max-w-xl mx-auto">
        {navItems.filter((item) => permissions?.[item.permission] !== false).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`app-bottom-nav-item flex min-w-[46px] sm:min-w-[52px] flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all relative ${
                isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 border border-emerald-500/30 scale-105 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/70 border border-slate-800/70'
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isActive ? 'text-emerald-400 stroke-[2.4]' : 'text-slate-400'}`} />
                {item.id === 'atendimentos' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center font-mono animate-pulse">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span className={`text-[8.5px] min-[380px]:text-[9.5px] sm:text-[10px] tracking-tight mt-1 whitespace-nowrap ${isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 font-medium'}`}>
                {item.label}
              </span>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 mt-0.5 shadow-sm shadow-cyan-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
