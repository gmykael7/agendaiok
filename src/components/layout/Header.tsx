import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Share2,
  Check,
  Smartphone,
  LogOut,
  Search,
  X,
  UserRound,
  CalendarDays,
  Scissors,
  Bell,
  CheckCheck,
  Ban,
  CalendarClock,
  BadgeCheck,
  RefreshCw,
  UserRoundCheck,
  PlayCircle,
  UserX,
  ShoppingBag,
  Menu,
} from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { useClipboard } from '../../hooks/useClipboard';
import { BrandLogo } from '../common/BrandLogo';
import { NotificationBell } from '../common/NotificationBell';
import { unreadNotificationCount } from '../../utils/notificationBell';
import { AppNotification, Appointment, Barber, Client, Organization, TabType } from '../../types';
import { getClientBookingUrl } from '../../config/urls';

interface HeaderProps {
  org: Organization | null;
  onOpenSidebar?: () => void;
  onNavigateToBooking?: () => void;
  pendingAppointmentsCount?: number;
  onLogout?: () => void;
  clients?: Client[];
  appointments?: Appointment[];
  barbers?: Barber[];
  notifications?: AppNotification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onNavigate?: (tab: TabType) => void;
}

type SearchItem = {
  id: string;
  type: 'client' | 'appointment' | 'barber';
  title: string;
  subtitle: string;
  tab: TabType;
};

export const Header: React.FC<HeaderProps> = ({
  org,
  onOpenSidebar,
  onNavigateToBooking,
  onLogout,
  clients = [],
  appointments = [],
  barbers = [],
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigate,
}) => {
  const { copied, copy, error: copyError } = useClipboard();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const notificationDialog = useDialog(notificationsOpen, () => setNotificationsOpen(false));

  const publicLink = org ? getClientBookingUrl(org.slug) : '';
  const normalizedQuery = query.trim().toLowerCase();
  const establishmentName = org?.name?.trim() || 'AgendAI';
  const establishmentNameSize = establishmentName.length > 32
    ? 'text-[clamp(0.78rem,3.1vw,0.98rem)]'
    : establishmentName.length > 20
      ? 'text-[clamp(0.86rem,3.5vw,1.05rem)]'
      : 'text-[clamp(0.98rem,4vw,1.2rem)]';

  const searchResults = useMemo<SearchItem[]>(() => {
    if (normalizedQuery.length < 2) return [];

    const result: SearchItem[] = [];

    clients.forEach((client) => {
      const haystack = `${client.name} ${client.phone}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        result.push({
          id: `client-${client.id}`,
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
          type: 'barber',
          title: barber.full_name,
          subtitle: barber.role || 'Profissional',
          tab: 'agenda',
        });
      }
    });

    return result.slice(0, 8);
  }, [normalizedQuery, clients, appointments, barbers]);

  const handleCopyLink = () => {
    if (!publicLink) return;
    void copy(publicLink);
  };

  const handleResultClick = (item: SearchItem) => {
    onNavigate?.(item.tab);
    setQuery('');
    setSearchOpen(false);
  };

  const orderedNotifications = useMemo(() =>
    [...notifications].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 40),
  [notifications]);
  const unreadCount = unreadNotificationCount(notifications);

  const notificationTime = (createdAt: string) => {
    const time = new Date(createdAt).getTime();
    if (!Number.isFinite(time)) return '';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `há ${days}d`;
    return new Date(createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const notificationVisual = (notification: AppNotification) => {
    if (notification.type === 'appointment_canceled') return { Icon: Ban, iconClass: 'text-rose-300', boxClass: 'bg-rose-400/10 border-rose-400/20' };
    if (notification.type === 'appointment_completed') return { Icon: BadgeCheck, iconClass: 'text-emerald-300', boxClass: 'bg-emerald-400/10 border-emerald-400/20' };
    if (notification.type === 'appointment_rescheduled') return { Icon: RefreshCw, iconClass: 'text-amber-200', boxClass: 'bg-amber-300/10 border-amber-300/20' };
    if (notification.type === 'appointment_confirmed') return { Icon: CheckCheck, iconClass: 'text-sky-300', boxClass: 'bg-sky-400/10 border-sky-400/20' };
    if (notification.type === 'appointment_arrived') return { Icon: UserRoundCheck, iconClass: 'text-cyan-300', boxClass: 'bg-cyan-400/10 border-cyan-400/20' };
    if (notification.type === 'appointment_started') return { Icon: PlayCircle, iconClass: 'text-blue-300', boxClass: 'bg-blue-400/10 border-blue-400/20' };
    if (notification.type === 'appointment_no_show') return { Icon: UserX, iconClass: 'text-orange-300', boxClass: 'bg-orange-400/10 border-orange-400/20' };
    if (notification.type === 'product_order') return { Icon: ShoppingBag, iconClass: 'text-cyan-200', boxClass: 'bg-cyan-400/10 border-cyan-400/20' };
    return { Icon: CalendarClock, iconClass: 'text-cyan-200', boxClass: 'bg-cyan-400/10 border-cyan-400/20' };
  };

  const handleNotificationClick = (notification: AppNotification) => {
    onMarkNotificationRead?.(notification.id);
    if (notification.target_tab) onNavigate?.(notification.target_tab);
    setNotificationsOpen(false);
  };

  return (
    <header className="app-header sticky top-0 z-40 shrink-0 safe-header bg-[#08101f]/94 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-5 lg:px-6 pb-3 md:pb-3.5 shadow-[0_10px_35px_rgba(2,8,23,0.28)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_auto] items-center max-w-[1600px] mx-auto gap-x-2.5 sm:gap-x-4 gap-y-3 min-w-0">
        <div className="col-span-2 xl:col-span-1 flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onOpenSidebar && <button type="button" onClick={onOpenSidebar} aria-label="Abrir menu principal" aria-controls="app-sidebar" className="md:hidden shrink-0 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300"><Menu className="h-5 w-5" /></button>}
          <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-11 md:h-11 rounded-full bg-white/95 border border-cyan-400/20 flex items-center justify-center shadow-sm shadow-cyan-500/10 shrink-0 overflow-hidden p-1">
            {org?.logo_image_url ? (
              <img src={org.logo_image_url} alt="" className="profile-avatar w-full h-full object-cover" />
            ) : (
              <BrandLogo variant="mark" className="w-full h-full" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className={`font-extrabold ${establishmentNameSize} text-white tracking-tight leading-[1.08] break-words line-clamp-2`}
              title={establishmentName}
            >
              {establishmentName}
            </h1>
            <p className="mt-1 text-[9px] sm:text-[10px] text-cyan-200 font-medium font-mono flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">Painel online<span className="hidden min-[420px]:inline"> • Agenda inteligente</span></span>
            </p>
          </div>
        </div>

        <div className="hidden xl:block relative w-full max-w-xl mx-auto">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Pesquisar cliente, agendamento ou profissional"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Pesquisar cliente, telefone, agendamento ou profissional..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/5"
          />
          {query && (
            <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {searchOpen && normalizedQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-slate-700 bg-[#08101f] p-2 shadow-2xl z-50">
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-500">Nenhum resultado encontrado.</p>
              ) : (
                searchResults.map((item) => {
                  const Icon = item.type === 'client' ? UserRound : item.type === 'appointment' ? CalendarDays : Scissors;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleResultClick(item)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/80 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-emerald-400" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-white truncate">{item.title}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{item.subtitle}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="xl:hidden relative min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Pesquisar cliente, agendamento ou profissional"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Pesquisar..."
            className="w-full h-10 sm:h-11 rounded-full border border-slate-800 bg-slate-950/80 pl-9 pr-8 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/40"
          />
          {query && (
            <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {searchOpen && normalizedQuery.length >= 2 && (
            <div className="absolute top-full left-0 min-w-[min(20rem,calc(100vw-1.5rem))] mt-2 rounded-2xl border border-slate-700 bg-[#08101f] p-2 shadow-2xl z-50 max-h-[55dvh] overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-500">Nenhum resultado encontrado.</p>
              ) : (
                searchResults.map((item) => {
                  const Icon = item.type === 'client' ? UserRound : item.type === 'appointment' ? CalendarDays : Scissors;
                  return (
                    <button key={item.id} type="button" onClick={() => handleResultClick(item)} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/80">
                      <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-white truncate">{item.title}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{item.subtitle}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-self-end">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 md:w-10 md:h-10 p-0 rounded-full border flex items-center justify-center transition-colors active:scale-95 shrink-0 ${unreadCount > 0 ? 'bg-cyan-400/10 border-cyan-400/25 text-cyan-200' : 'bg-slate-900/85 border-slate-800/70 text-slate-300 hover:bg-slate-800'}`}
            title="Central de notificações"
            aria-label={`Central de notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`}
          >
            <NotificationBell key={org?.id || 'no-org'} notifications={notifications} open={notificationsOpen} />
          </button>

          {org && (
            <button
              onClick={handleCopyLink}
              className="inline-flex w-10 h-10 sm:w-11 sm:h-11 md:w-10 md:h-10 items-center justify-center p-0 rounded-full bg-cyan-400/10 hover:bg-cyan-400/15 border border-cyan-400/20 text-emerald-400 transition-all active:scale-95 shrink-0"
              title={copied ? 'Link copiado!' : 'Copiar link de agendamento do cliente'}
              aria-label={copied ? 'Link copiado' : 'Copiar link de agendamento do cliente'}
            >
              {copied ? <Check className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-4 md:h-4 text-emerald-400" /> : <Share2 className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-4 md:h-4" />}
            </button>
          )}

          {onNavigateToBooking && (
            <button
              onClick={onNavigateToBooking}
              className="hidden sm:flex w-10 h-10 p-0 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-slate-800/70 text-slate-300 items-center justify-center transition-colors active:scale-95 shrink-0"
              title="Ver página de agendamento do cliente"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja realmente sair do sistema?')) onLogout();
              }}
              className="md:hidden w-10 h-10 sm:w-11 sm:h-11 p-0 rounded-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 flex items-center justify-center transition-colors active:scale-95 shrink-0"
              title="Sair do sistema"
              aria-label="Sair do sistema"
            >
              <LogOut className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {copyError && <p role="status" className="mt-2 text-xs text-rose-400">{copyError}</p>}
      {notificationsOpen && createPortal(
        <div
          className="fixed inset-0 z-[220] app-mobile-modal bg-black/75 backdrop-blur-sm p-3 sm:p-5 flex items-start justify-center md:justify-end"
          onClick={() => setNotificationsOpen(false)}
        >
          <div
            ref={notificationDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Central de notificações"
            tabIndex={-1}
            className="notification-center-panel mt-4 md:mt-14 w-full max-w-md max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#08101f] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-black">Central de notificações</p>
                <h3 className="text-lg font-black text-white mt-1">Movimentações da barbearia</h3>
                <p className="text-[11px] text-slate-500 mt-1">Agendamentos, alterações, cancelamentos e conclusões.</p>
              </div>
              <button type="button" aria-label="Fechar notificações" onClick={() => setNotificationsOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-4 py-3 border-b border-slate-800/70 flex items-center justify-between gap-3 bg-slate-950/30">
              <span className="text-xs text-slate-400">{unreadCount > 0 ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'}</span>
              {unreadCount > 0 && (
                <button type="button" onClick={() => onMarkAllNotificationsRead?.()} className="text-[11px] font-bold text-cyan-200 flex items-center gap-1.5 hover:text-white">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {orderedNotifications.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl border border-slate-800 bg-slate-900 mx-auto flex items-center justify-center"><Bell className="w-5 h-5 text-slate-500" /></div>
                  <p className="text-sm font-bold text-white mt-3">Nenhuma notificação ainda</p>
                  <p className="text-xs text-slate-500 mt-1">As próximas movimentações aparecerão aqui automaticamente.</p>
                </div>
              ) : orderedNotifications.map((notification) => {
                const visual = notificationVisual(notification);
                const Icon = visual.Icon;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left rounded-2xl p-3.5 flex items-start gap-3 transition-colors border ${notification.read_at ? 'border-transparent hover:bg-slate-900/70' : 'border-cyan-400/10 bg-cyan-400/[0.035] hover:bg-cyan-400/[0.06]'}`}
                  >
                    <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${visual.boxClass}`}><Icon className={`w-4 h-4 ${visual.iconClass}`} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-white truncate">{notification.title}</span>
                        <span className="text-[9px] text-slate-500 shrink-0">{notificationTime(notification.created_at)}</span>
                      </span>
                      <span className="block text-[11px] leading-relaxed text-slate-400 mt-1">{notification.message}</span>
                      {notification.client_name && <span className="block text-[10px] text-cyan-300 mt-1.5">Abrir {notification.target_tab === 'atendimentos' ? 'atendimentos' : notification.target_tab === 'produtos' ? 'produtos' : 'agenda'} →</span>}
                    </span>
                    {!notification.read_at && <span className="w-2 h-2 rounded-full bg-cyan-300 mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
};
