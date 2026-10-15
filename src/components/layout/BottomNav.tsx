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
    { id: 'atendimentos', label: 'Atender', icon: ClipboardCheck, permission: 'atendimentos' },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, permission: 'agenda' },
    { id: 'caixa', label: 'Caixa', icon: WalletCards, permission: 'caixa' },
    { id: 'clientes', label: 'Clientes', icon: ContactRound, permission: 'clientes' },
    { id: 'ajustes', label: 'Ajustes', icon: Settings, permission: 'ajustes' },
  ];

  return (
    <nav
      className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 safe-bottom-nav bg-[#08101f]/80 backdrop-blur-2xl border-t border-slate-800/40 px-2 pt-2 pb-1.5 md:hidden shadow-[0_-8px_32px_rgba(0,0,0,0.2)]"
      aria-label="Navegação inferior"
    >
      <div className="flex w-full items-stretch justify-around max-w-lg mx-auto">
        {navItems.filter((item) => permissions?.[item.permission] !== false).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`app-bottom-nav-item flex min-w-0 flex-1 basis-0 flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 scale-105 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 stroke-[1.8]" />
                {item.id === 'atendimentos' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center font-mono">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] tracking-tight mt-0.5 whitespace-nowrap ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 font-medium'
                }`}
              >
                <span className="block max-w-full truncate text-center">{item.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
