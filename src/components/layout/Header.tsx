import React, { useMemo, useState, useRef, useEffect } from 'react';
import { IS_DEMO } from '../../utils/demoSandbox';
import {
  Search,
  X,
  UserRound,
  CalendarDays,
  Scissors,
  Menu,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { NotificationBell } from '../common/NotificationBell';
import { AgendaiMascot } from '../common/AgendaiMascot';
import { NotificationCenterModal } from '../notifications/NotificationCenterModal';
import { unreadNotificationCount } from '../../utils/notificationBell';
import { AppNotification, Appointment, Barber, Client, Organization, TabType } from '../../types';
import { setAgendaFocus } from '../../utils/agendaFocus';
import { setBarberSearchFocus, setClientSearchFocus } from '../../utils/searchFocus';

interface HeaderProps {
  org: Organization | null;
  onOpenSidebar?: () => void;
  onNavigateToBooking?: () => void;
  pendingAppointmentsCount?: number;
  syncTone?: 'ok' | 'saved' | 'warn' | 'offline';
  onLogout?: () => void;
  clients?: Client[];
  appointments?: Appointment[];
  barbers?: Barber[];
  notifications?: AppNotification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onNavigate?: (tab: TabType) => void;
  assistantOpen?: boolean;
  onAssistantToggle?: () => void;
}

type SearchItem = {
  id: string;
  targetId: string;
  type: 'client' | 'appointment' | 'barber';
  title: string;
  subtitle: string;
  tab: TabType;
};

export const Header: React.FC<HeaderProps> = ({
  org,
  syncTone = 'ok',
  onOpenSidebar,
  clients = [],
  appointments = [],
  barbers = [],
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigate,
  assistantOpen = false,
  onAssistantToggle,
}) => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const establishmentName = org?.name?.trim() || 'AgendAI';
  useEffect(() => {
    if (isSearchExpanded) {
      searchInputRef.current?.focus();
    }
  }, [isSearchExpanded]);

  const searchResults = useMemo<SearchItem[]>(() => {
    if (normalizedQuery.length < 2) return [];

    const result: SearchItem[] = [];

    clients.forEach((client) => {
      const haystack = `${client.name} ${client.phone}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        result.push({
          id: `client-${client.id}`,
          targetId: client.id,
          type: 'client',
          title: client.name,
          subtitle: client.phone || 'Cliente cadastrado',
          tab: 'clientes',
        });
      }
    });

    appointments.forEach((app) => {
      const haystack = `${app.client_name} ${app.client_phone} ${app.service_name} ${app.barber_name} ${app.start_time}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        result.push({
          id: `appointment-${app.id}`,
          targetId: app.id,
          type: 'appointment',
          title: `${app.client_name} • ${app.start_time}`,
          subtitle: `${app.service_name} com ${app.barber_name}`,
          tab: 'agenda',
        });
      }
    });

    barbers.forEach((barber) => {
      const haystack = `${barber.full_name} ${barber.phone} ${barber.role}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        result.push({
          id: `barber-${barber.id}`,
          targetId: barber.id,
          type: 'barber',
          title: barber.full_name,
          subtitle: barber.role || 'Profissional',
          tab: 'agenda',
        });
      }
    });

    return result.slice(0, 8);
  }, [normalizedQuery, clients, appointments, barbers]);

  const handleResultClick = (item: SearchItem) => {
    if (item.type === 'appointment') setAgendaFocus(item.targetId);
    if (item.type === 'client') setClientSearchFocus(item.targetId);
    if (item.type === 'barber') setBarberSearchFocus(item.targetId);
    onNavigate?.(item.tab);
    setQuery('');
    setIsSearchExpanded(false);
  };

  const unreadCount = unreadNotificationCount(notifications);

  return (
    <header className="app-header safe-header sticky top-0 z-40 shrink-0 border-b border-slate-800 px-3 py-2.5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] min-w-0 items-center justify-between gap-2 sm:gap-3">
        {/* LADO ESQUERDO: MENU + IDENTIFICAÇÃO */}
        <div className={`min-w-0 items-center gap-2.5 sm:gap-3 ${isSearchExpanded ? 'hidden sm:flex sm:shrink-0' : 'flex flex-1'}`}>
          {onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              aria-label="Abrir menu principal"
              aria-controls="app-sidebar"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div className={`organization-avatar relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 ring-1 ring-slate-200/80 sm:h-11 sm:w-11 ${org?.logo_image_url ? 'p-0' : 'p-1'}`}>
            {org?.logo_image_url ? (
              <>
                <BrandLogo variant="mark" className="w-full h-full p-1" alt="" />
                <img src={org.logo_image_url} alt={`Logo ${establishmentName}`} loading="lazy" decoding="async" className="profile-avatar absolute inset-0" onError={({ currentTarget }) => { currentTarget.style.display = 'none'; }} />
              </>
            ) : (
              <BrandLogo variant="mark" className="w-full h-full" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-sm font-bold leading-tight tracking-tight text-white sm:text-lg"
              title={establishmentName}
            >
              {establishmentName}
            </h1>
            <p className="mt-0.5 hidden min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">Painel online</span>
            </p>
          </div>
        </div>

        {/* CENTRO / EXPANSÍVEL: BUSCA FLUIDA */}
        {isSearchExpanded ? (
          <div className="relative flex-1 max-w-xl mx-auto animate-fadeIn">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Pesquisar cliente, agendamento ou profissional"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar cliente, telefone ou profissional..."
                className="w-full rounded-2xl bg-slate-900/90 pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-slate-500 border border-slate-700/60 shadow-lg focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                aria-label="Fechar pesquisa"
                onClick={() => {
                  setQuery('');
                  setIsSearchExpanded(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {normalizedQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-[#08101f] border border-slate-700/60 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.4)] z-50 max-h-[60dvh] overflow-y-auto animate-scaleUp">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">Nenhum resultado encontrado.</p>
                ) : (
                  searchResults.map((item) => {
                    const Icon = item.type === 'client' ? UserRound : item.type === 'appointment' ? CalendarDays : Scissors;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleResultClick(item)}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/70 transition-colors"
                      >
                        <span className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-emerald-400" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-white truncate">{item.title}</span>
                          <span className="block text-[10px] text-slate-400 truncate">{item.subtitle}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* LADO DIREITO: AÇÕES ESSENCIAIS */}
        <div className="header-action-cluster flex shrink-0 items-center gap-0.5 sm:gap-1 sm:rounded-xl sm:border sm:border-slate-800 sm:bg-slate-950/40 sm:p-1">
          {!isSearchExpanded && (() => {
            const tones = {
              ok: { dot: 'bg-slate-400', text: 'text-slate-400', label: 'Sincronizado' },
              saved: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Salvo' },
              warn: { dot: 'bg-amber-400', text: 'text-amber-300', label: IS_DEMO ? 'Demonstração' : 'Não salvo' },
              offline: { dot: 'bg-rose-400', text: 'text-rose-300', label: 'Sem conexão' },
            } as const;
            const t = tones[syncTone];
            return (
              <span
                role="status"
                aria-live="polite"
                title={t.label}
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold ${t.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${syncTone === 'warn' || syncTone === 'offline' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                {t.label}
              </span>
            );
          })()}
          {!isSearchExpanded && (
            <button
              type="button"
              onClick={() => setIsSearchExpanded(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Pesquisar..."
              aria-label="Abrir pesquisa"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {!isSearchExpanded && onAssistantToggle && (
            <button
              type="button"
              onClick={onAssistantToggle}
              className={`group hidden h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2.5 transition-colors sm:flex ${assistantOpen ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              title="Como posso ajudar?"
              aria-label="Abrir assistente: Como posso ajudar?"
              aria-expanded={assistantOpen}
              aria-controls="owner-assistant-panel"
            >
              <AgendaiMascot size={30} interactive={false} label="" />
              <span className="hidden xl:inline text-xs font-semibold whitespace-nowrap">Como posso ajudar?</span>
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
              title="Central de notificações"
              aria-label={`Central de notificações, ${unreadCount} não lidas`}
              aria-expanded={notificationsOpen}
            >
              <NotificationBell key={org?.id || 'no-org'} notifications={notifications} open={notificationsOpen} />
            </button>
          )}
        </div>
      </div>

      <NotificationCenterModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkNotificationRead={onMarkNotificationRead}
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
        onNavigate={onNavigate}
      />
    </header>
  );
};
