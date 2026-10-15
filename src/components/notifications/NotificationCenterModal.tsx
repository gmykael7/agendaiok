import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { setAgendaFocus } from '../../utils/agendaFocus';
import { createPortal } from 'react-dom';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  CalendarClock,
  Ban,
  BadgeCheck,
  RefreshCw,
  UserRoundCheck,
  PlayCircle,
  UserX,
  ShoppingBag,
  Clock,
  ChevronRight,
  User,
  Sparkles,
} from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { unreadNotificationCount } from '../../utils/notificationBell';
import { AppNotification, AppNotificationType, TabType } from '../../types';

export interface NotificationCenterModalProps {
  open: boolean;
  onClose: () => void;
  notifications?: readonly AppNotification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onNavigate?: (tab: TabType) => void;
}

interface NotificationVisual {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  boxClass: string;
  badgeClass: string;
  accentBarClass: string;
}

function getNotificationVisual(type: AppNotificationType): NotificationVisual {
  switch (type) {
    case 'appointment_canceled':
      return {
        label: 'Cancelamento',
        Icon: Ban,
        iconClass: 'text-rose-400',
        boxClass: 'bg-rose-500/15 border-rose-500/25 shadow-rose-500/10',
        badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
        accentBarClass: 'from-rose-500 to-rose-600',
      };
    case 'appointment_completed':
      return {
        label: 'Concluído',
        Icon: BadgeCheck,
        iconClass: 'text-emerald-400',
        boxClass: 'bg-emerald-500/15 border-emerald-500/25 shadow-emerald-500/10',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
        accentBarClass: 'from-emerald-400 to-teal-500',
      };
    case 'appointment_rescheduled':
      return {
        label: 'Remarcado',
        Icon: RefreshCw,
        iconClass: 'text-amber-300',
        boxClass: 'bg-amber-500/15 border-amber-500/25 shadow-amber-500/10',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        accentBarClass: 'from-amber-400 to-amber-500',
      };
    case 'appointment_confirmed':
      return {
        label: 'Confirmado',
        Icon: CheckCheck,
        iconClass: 'text-sky-400',
        boxClass: 'bg-sky-500/15 border-sky-500/25 shadow-sky-500/10',
        badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
        accentBarClass: 'from-sky-400 to-cyan-500',
      };
    case 'appointment_arrived':
      return {
        label: 'Cliente Chegou',
        Icon: UserRoundCheck,
        iconClass: 'text-teal-300',
        boxClass: 'bg-teal-500/15 border-teal-500/25 shadow-teal-500/10',
        badgeClass: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
        accentBarClass: 'from-teal-400 to-emerald-500',
      };
    case 'appointment_started':
      return {
        label: 'Em Atendimento',
        Icon: PlayCircle,
        iconClass: 'text-blue-400',
        boxClass: 'bg-blue-500/15 border-blue-500/25 shadow-blue-500/10',
        badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
        accentBarClass: 'from-blue-400 to-indigo-500',
      };
    case 'appointment_no_show':
      return {
        label: 'Não Compareceu',
        Icon: UserX,
        iconClass: 'text-orange-400',
        boxClass: 'bg-orange-500/15 border-orange-500/25 shadow-orange-500/10',
        badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
        accentBarClass: 'from-orange-400 to-amber-500',
      };
    case 'product_order':
      return {
        label: 'Pedido de Produto',
        Icon: ShoppingBag,
        iconClass: 'text-purple-300',
        boxClass: 'bg-purple-500/15 border-purple-500/25 shadow-purple-500/10',
        badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
        accentBarClass: 'from-purple-400 to-fuchsia-500',
      };
    case 'new_appointment':
    default:
      return {
        label: 'Agendamento',
        Icon: CalendarClock,
        iconClass: 'text-cyan-300',
        boxClass: 'bg-cyan-500/15 border-cyan-500/25 shadow-cyan-500/10',
        badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
        accentBarClass: 'from-cyan-400 to-teal-400',
      };
  }
}

function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const time = date.getTime();
  if (!Number.isFinite(time)) return '';

  const now = Date.now();
  const diffMinutes = Math.max(0, Math.floor((now - time) / 60_000));

  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `ontem às ${hours}:${mins}`;
  }
  if (diffDays < 7) return `há ${diffDays}d`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTabDestinationLabel(tab?: TabType): string {
  switch (tab) {
    case 'atendimentos':
      return 'Ver atendimentos';
    case 'produtos':
      return 'Ver produtos';
    case 'clientes':
      return 'Ver clientes';
    case 'relatorios':
      return 'Ver relatórios';
    case 'agenda':
    default:
      return 'Ver na agenda';
  }
}

export function NotificationCenterModal({
  open,
  onClose,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigate,
}: NotificationCenterModalProps) {
  const [isRendered, setIsRendered] = useState(open);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const handleClose = useCallback(() => {
    setIsAnimatingIn(false);
    const timeout = setTimeout(() => {
      onClose();
    }, 220);
    return () => clearTimeout(timeout);
  }, [onClose]);

  const dialogRef = useDialog(open, handleClose);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsAnimatingIn(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsAnimatingIn(false);
      const timeout = setTimeout(() => {
        setIsRendered(false);
      }, 220);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  const orderedNotifications = useMemo(() => {
    const sorted = [...notifications].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
    return sorted.slice(0, 40);
  }, [notifications]);

  const unreadCount = useMemo(
    () => unreadNotificationCount(notifications),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return orderedNotifications.filter((n) => !n.read_at);
    }
    return orderedNotifications;
  }, [orderedNotifications, filter]);

  const handleCardClick = (notification: AppNotification) => {
    onMarkNotificationRead?.(notification.id);
    if (notification.target_tab === 'agenda' && notification.appointment_id) {
      setAgendaFocus(notification.appointment_id);
    }
    if (notification.target_tab) {
      onNavigate?.(notification.target_tab);
    }
    handleClose();
  };

  const handleMarkAsReadOnly = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMarkNotificationRead?.(id);
  };

  if (!isRendered && !open) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[220] app-view flex items-start justify-center md:justify-end pt-3 sm:pt-4 md:pt-14 px-3 sm:px-4 md:pr-6 pb-4 transition-all duration-200 ease-out notification-center-backdrop ${
        isAnimatingIn
          ? 'bg-slate-950/55 backdrop-blur-md opacity-100'
          : 'bg-slate-950/0 backdrop-blur-none opacity-0 pointer-events-none'
      }`}
      onClick={handleClose}
      aria-hidden={!open}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Central de notificações"
        tabIndex={-1}
        className={`notification-center-panel modal-shell-fixed app-view w-full max-w-md max-h-[calc(100dvh-2.5rem)] md:max-h-[min(800px,calc(100dvh-5rem))] flex flex-col overflow-hidden rounded-3xl border border-slate-700/70 bg-[#08101f]/95 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_40px_rgba(6,182,212,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
          isAnimatingIn
            ? 'translate-y-0 opacity-100 scale-100'
            : '-translate-y-6 opacity-0 scale-[0.98]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Premium com Gradiente & Informações */}
        <div className="notification-panel-header modal-static-header shrink-0 p-4 sm:p-5 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/10 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="notification-panel-title text-base sm:text-lg font-black text-white tracking-tight leading-none">
                    Notificações
                  </h3>
                  {unreadCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-400/15 text-cyan-300 border border-cyan-400/25 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 shrink-0">
                      Em dia
                    </span>
                  )}
                </div>
                <p className="notification-panel-subtitle text-[11px] text-slate-400 mt-1 truncate">
                  Movimentações e atualizações da barbearia
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fechar notificações"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-colors shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Abas de Filtro + Ação de Marcar Todas */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="notification-filter-bar flex items-center p-1 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  filter === 'all'
                    ? 'notification-filter-btn-active bg-cyan-500/20 text-cyan-200 border border-cyan-400/25 shadow-sm'
                    : 'notification-filter-btn-inactive text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <span>Todas</span>
                <span
                  className={`notification-filter-pill-count text-[10px] px-1.5 py-0.2 rounded-full ${
                    filter === 'all'
                      ? 'notification-filter-pill-active bg-cyan-400/30 text-cyan-100 font-black'
                      : 'notification-filter-pill-inactive bg-slate-800 text-slate-400'
                  }`}
                >
                  {orderedNotifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  filter === 'unread'
                    ? 'notification-filter-btn-active bg-cyan-500/20 text-cyan-200 border border-cyan-400/25 shadow-sm'
                    : 'notification-filter-btn-inactive text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <span>Não lidas</span>
                <span
                  className={`notification-filter-pill-count text-[10px] px-1.5 py-0.2 rounded-full ${
                    filter === 'unread'
                      ? 'notification-filter-pill-active bg-cyan-400/30 text-cyan-100 font-black'
                      : unreadCount > 0
                        ? 'bg-cyan-400/20 text-cyan-300 font-bold'
                        : 'notification-filter-pill-inactive bg-slate-800 text-slate-400'
                  }`}
                >
                  {unreadCount}
                </span>
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => onMarkAllNotificationsRead?.()}
                className="text-[11px] font-bold text-cyan-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-all shrink-0"
                title="Marcar todas as notificações como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden min-[360px]:inline">Marcar lidas</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de Cards com Scroll Macio */}
        <div className="notification-list-scroll modal-scroll-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-3.5 space-y-2.5 booking-scroll">
          {filteredNotifications.length === 0 ? (
            <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center shadow-lg shadow-black/20 text-slate-500">
                {filter === 'unread' ? (
                  <Check className="w-7 h-7 text-emerald-400" />
                ) : (
                  <Bell className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <p className="notification-empty-title text-sm font-bold text-white mt-3.5">
                {filter === 'unread'
                  ? 'Tudo lido e em dia!'
                  : 'Nenhuma notificação por enquanto'}
              </p>
              <p className="notification-empty-desc text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                {filter === 'unread'
                  ? 'Você já acompanhou todas as notificações recentes da barbearia.'
                  : 'As novas confirmações, agendamentos e movimentações aparecerão aqui automaticamente.'}
              </p>
              {filter === 'unread' && orderedNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-cyan-300 border border-slate-700/70 transition-all active:scale-95"
                >
                  Ver histórico completo ({orderedNotifications.length})
                </button>
              )}
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const visual = getNotificationVisual(notification.type);
              const Icon = visual.Icon;
              const isUnread = !notification.read_at;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleCardClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(notification);
                    }
                  }}
                  className={`group relative w-full text-left rounded-2xl p-3.5 sm:p-4 transition-all duration-200 cursor-pointer border overflow-hidden ${
                    isUnread
                      ? 'notification-card-unread bg-gradient-to-r from-cyan-500/[0.08] via-slate-900/80 to-slate-900/60 border-cyan-500/25 hover:border-cyan-400/45 hover:from-cyan-500/[0.12] hover:shadow-[0_4px_25px_rgba(6,182,212,0.1)]'
                      : 'notification-card-read bg-slate-900/40 hover:bg-slate-900/70 border-slate-800/80 hover:border-slate-700/70'
                  }`}
                >
                  {/* Faixa lateral suave para notificações não lidas */}
                  {isUnread && (
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${visual.accentBarClass}`}
                    />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Caixa de Ícone Temática */}
                    <div
                      className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm ${visual.boxClass} transition-transform group-hover:scale-105`}
                    >
                      <Icon className={`w-5 h-5 ${visual.iconClass}`} />
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="min-w-0 flex-1">
                      {/* Topo do Card: Tipo + Hora + Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${visual.badgeClass}`}
                          >
                            {visual.label}
                          </span>
                          {isUnread && (
                            <span className="notification-new-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                              <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
                              Nova
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatNotificationTime(notification.created_at)}
                          </span>

                          {isUnread && (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleMarkAsReadOnly(e, notification.id)
                              }
                              title="Marcar apenas como lida"
                              aria-label="Marcar apenas como lida"
                              className="p-1 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors ml-0.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Título do Card */}
                      <h4
                        className={`notification-card-title text-xs sm:text-[13px] font-bold mt-1.5 leading-snug tracking-tight ${
                          isUnread ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {notification.title}
                      </h4>

                      {/* Mensagem Detalhada */}
                      <p className="notification-card-message text-[11px] sm:text-xs leading-relaxed text-slate-400 mt-1 break-words">
                        {notification.message}
                      </p>

                      {/* Rodapé do Card: Cliente e Link de Ação */}
                      <div className="notification-card-divider mt-2.5 pt-2 border-t border-slate-800/50 flex items-center justify-between gap-2 flex-wrap text-[10px]">
                        {notification.client_name ? (
                          <span className="notification-client-chip inline-flex items-center gap-1 text-slate-300 font-medium bg-slate-950/40 px-2 py-0.5 rounded-md border border-slate-800/60 truncate max-w-[200px]">
                            <User className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">
                              {notification.client_name}
                            </span>
                          </span>
                        ) : (
                          <span />
                        )}

                        <span className="inline-flex items-center gap-1 text-cyan-300 font-bold group-hover:text-cyan-200 group-hover:translate-x-0.5 transition-transform ml-auto">
                          {getTabDestinationLabel(notification.target_tab)}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="notification-panel-footer modal-static-footer shrink-0 px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/50 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Central em tempo real
          </span>
          <span>
            {orderedNotifications.length}{' '}
            {orderedNotifications.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
