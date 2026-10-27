import { appConfirm } from '../components/common/ConfirmDialog';
import { Modal } from "../components/common/Modal";
import React, { useState, useMemo, useEffect } from 'react';
import { peekAgendaFocus, consumeAgendaFocus } from '../utils/agendaFocus';
import { consumeBarberSearchFocus } from '../utils/searchFocus';
import { createPortal } from 'react-dom';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, User, Scissors, Plus, CheckCircle, AlertCircle,
  Phone, MessageSquare, Check, X, DollarSign, QrCode, CreditCard, Banknote, Lock, ChevronDown, BellRing, HeartHandshake,
  CheckCheck, UserRoundCheck, Play, UserX, Sparkles, Zap, Gift
} from 'lucide-react';
import { Appointment, Barber, Service, Organization, WaitlistEntry, Client } from '../types';
import { generateBusinessSlots, getLocalDateKey, isBookableBusinessDateTime, timeToMinutes } from '../utils/scheduling';
import { buildAppointmentWhatsAppUrl, WhatsAppAction } from '../utils/whatsapp';
import { WhatsAppActionsModal } from '../components/common/WhatsAppActionsModal';
import { appointmentStatusClasses, appointmentStatusLabel, blocksAppointmentSlot, isOpenAppointmentStatus } from '../utils/appointmentStatus';
import { WaitlistModal } from '../components/waitlist/WaitlistModal';
import { findWaitlistMatches } from '../utils/waitlist';
import { getAuthToken } from '../services/cloudSync';
import { LoyaltyCardWidget } from '../components/loyalty/LoyaltyCardWidget';
import { addLoyaltyStampToClient, redeemLoyaltyRewardFromClient, calculateLoyaltyProgress } from '../utils/loyalty';
import { normalizeClientPhone, upsertClient } from '../utils/clients';
import { ClientProfileModal } from '../components/crm/ClientProfileModal';

interface AgendaViewProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  barbers: Barber[];
  services: Service[];
  org: Organization;
  setOrg?: React.Dispatch<React.SetStateAction<Organization>>;
  waitlist?: WaitlistEntry[];
  setWaitlist?: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;
  clients?: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
}

const statusIcons = {
  scheduled: Clock, confirmed: CheckCheck, arrived: UserRoundCheck,
  in_progress: Play, completed: CheckCircle, no_show: UserX, canceled: X,
};

function AgendaStatusBadge({ status, className }: { status: Appointment['status']; className: string }) {
  const Icon = statusIcons[status];
  return <span className={`inline-flex items-center gap-1 rounded-full shrink-0 ${appointmentStatusClasses(status)} ${className}`}>
    <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
    {appointmentStatusLabel(status)}
  </span>;
}

const isTimeSlotOccupied = (
  slotTime: string,
  candidateDurationMinutes: number,
  barberId: string,
  dateStr: string,
  allAppointments: Appointment[],
  excludeAppointmentId?: string
): boolean => {
  const candidateStart = timeToMinutes(slotTime);
  const candidateEnd = candidateStart + (candidateDurationMinutes || 30);

  return allAppointments.some(app => {
    if (excludeAppointmentId && app.id === excludeAppointmentId) return false;
    if (!blocksAppointmentSlot(app.status)) return false;
    if (app.barber_id !== barberId) return false;

    const appDate = app.date || dateStr;
    if (appDate !== dateStr) return false;

    const appStart = timeToMinutes(app.start_time);
    const appDuration = app.duration_minutes || (app.services?.reduce((sum, s) => sum + (s.duration_minutes || 30), 0)) || 30;
    const appEnd = appStart + appDuration;

    return candidateStart < appEnd && appStart < candidateEnd;
  });
};

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  setAppointments,
  barbers,
  services,
  org,
  setOrg,
  waitlist = [],
  setWaitlist,
  clients = [],
  setClients,
}) => {
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [pendingBarberFocus, setPendingBarberFocus] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateKey());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  useEffect(() => {
    const id = consumeBarberSearchFocus();
    if (!id || !barbers.some((barber) => barber.id === id)) return;
    setSelectedBarberId(id);
    setPendingBarberFocus(id);
  }, [barbers]);

  useEffect(() => {
    if (!pendingBarberFocus) return;
    const element = document.querySelector<HTMLElement>('[data-barber-filter]');
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('agenda-focus-flash');
    setPendingBarberFocus(null);
    const timer = window.setTimeout(() => element.classList.remove('agenda-focus-flash'), 1800);
    return () => window.clearTimeout(timer);
  }, [pendingBarberFocus, selectedBarberId]);

  // Foco vindo de notificação ou de "Ver na agenda": muda para a data do atendimento.
  useEffect(() => {
    const id = peekAgendaFocus();
    if (!id) return;
    const target = appointments.find(a => a.id === id);
    if (!target) { consumeAgendaFocus(); return; }
    setSelectedDate(target.date || getLocalDateKey());
    setPendingScrollId(id);
  }, [appointments]);

  // Depois que a data muda, rola até o card e destaca por um instante.
  useEffect(() => {
    if (!pendingScrollId) return;
    const el = document.querySelector<HTMLElement>(`[data-appointment-id="${pendingScrollId}"]`);
    consumeAgendaFocus();
    setPendingScrollId(null);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('agenda-focus-flash');
    const timer = window.setTimeout(() => el.classList.remove('agenda-focus-flash'), 1800);
    return () => window.clearTimeout(timer);
  }, [pendingScrollId, selectedDate, appointments]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [completingApp, setCompletingApp] = useState<Appointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'cash'>('pix');
  const [applyLoyaltyReward, setApplyLoyaltyReward] = useState<boolean>(false);
  const [whatsAppAppointment, setWhatsAppAppointment] = useState<Appointment | null>(null);
  const [confirmedFeedback, setConfirmedFeedback] = useState<Appointment | null>(null);
  const [activeProfileClient, setActiveProfileClient] = useState<Client | null>(null);

  const handleOpenClientProfile = (clientName: string, clientPhone?: string) => {
    const normPhone = clientPhone ? normalizeClientPhone(clientPhone) : '';
    const found = clients?.find(c => {
      if (normPhone && c.phone && normalizeClientPhone(c.phone) === normPhone) return true;
      return c.name.trim().toLowerCase() === clientName.trim().toLowerCase();
    });
    if (found) {
      setActiveProfileClient(found);
    } else {
      setActiveProfileClient({
        id: `temp-${Date.now()}`,
        name: clientName,
        phone: clientPhone || '',
        total_visits: 0,
        total_spent: 0,
        haircut_notes: '',
        birth_date: '',
        preferences: '',
      });
    }
  };

  const handleUpdateProfileClient = (updated: Client) => {
    if (setClients) {
      setClients(prev => {
        const exists = prev.some(c => c.id === updated.id);
        if (exists) {
          return prev.map(c => c.id === updated.id ? updated : c);
        }
        return [...prev, updated];
      });
    }
    setActiveProfileClient(updated);
  };

  const completingClient = useMemo(() => {
    if (!completingApp || !clients.length) return null;
    const phone = normalizeClientPhone(completingApp.client_phone);
    const name = completingApp.client_name?.trim().toLowerCase();
    return clients.find(c => {
      const cPhone = normalizeClientPhone(c.phone);
      if (phone && cPhone) return phone === cPhone;
      return Boolean(name && c.name?.trim().toLowerCase() === name);
    }) || null;
  }, [completingApp, clients]);

  useEffect(() => {
    if (!confirmedFeedback) return;
    const timeout = window.setTimeout(() => setConfirmedFeedback(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [confirmedFeedback]);

  const confirmAppointment = (appointment: Appointment) => {
    setAppointments(prev => prev.map(item => item.id === appointment.id ? { ...item, status: 'confirmed' } : item));
    setConfirmedFeedback(appointment);
  };

  // Modal e estado da Fila de Espera Relâmpago
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [releasedSlotAlert, setReleasedSlotAlert] = useState<{
    date: string;
    time: string;
    barber_id?: string;
    barber_name: string;
    service_name?: string;
    matches: WaitlistEntry[];
  } | null>(null);

  // Lembretes automáticos via WhatsApp (Anti No-Show)
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [remindersFeedback, setRemindersFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!remindersFeedback) return;
    const timer = window.setTimeout(() => setRemindersFeedback(null), 5500);
    return () => window.clearTimeout(timer);
  }, [remindersFeedback]);

  const handleTriggerReminders = async () => {
    setTriggeringReminders(true);
    setRemindersFeedback(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/whatsapp/reminders/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => null) as any;
      if (!res.ok) {
        setRemindersFeedback({
          type: 'error',
          message: data?.error || 'Erro ao disparar lembretes.',
        });
        return;
      }
      if (data?.sentCount > 0) {
        const sentIds = new Set<string>(data.sentAppointmentIds || []);
        const nowIso = new Date().toISOString();
        setAppointments(prev => prev.map(a => sentIds.has(a.id) ? { ...a, reminder_sent_at: nowIso } : a));
        setRemindersFeedback({
          type: 'success',
          message: `${data.sentCount} lembrete(s) enviado(s) via WhatsApp para clientes com horário nas próximas 2 horas!`,
        });
      } else {
        setRemindersFeedback({
          type: 'info',
          message: 'Nenhum agendamento pendente de lembrete para as próximas 2 horas hoje.',
        });
      }
    } catch {
      setRemindersFeedback({
        type: 'error',
        message: 'Falha de comunicação ao disparar lembretes.',
      });
    } finally {
      setTriggeringReminders(false);
    }
  };

  // Modal novo agendamento na agenda
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTime, setModalTime] = useState('10:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState(barbers[0]?.id || '');
  const [addModalError, setAddModalError] = useState('');

  const handleCancelAppointment = (app: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'canceled' } : a));

    const targetDate = app.date || selectedDate;
    const matches = findWaitlistMatches(waitlist, targetDate, app.start_time, app.barber_id);
    if (matches.length > 0) {
      setReleasedSlotAlert({
        date: targetDate,
        time: app.start_time,
        barber_id: app.barber_id,
        barber_name: app.barber_name,
        service_name: app.service_name,
        matches,
      });
    }
  };

  const handleClaimWaitlistSlot = (
    entry: WaitlistEntry,
    slot: { date: string; time: string; barberId: string; barberName: string }
  ) => {
    const srv = services.find(s => s.id === entry.service_id) || services[0];
    const newApp: Appointment = {
      id: 'app-claimed-' + Date.now(),
      org_id: org.id,
      client_name: entry.client_name,
      client_phone: entry.client_phone,
      service_id: srv?.id || '',
      service_name: srv?.name || entry.service_name || 'Atendimento',
      barber_id: slot.barberId,
      barber_name: slot.barberName,
      start_time: slot.time,
      price: srv?.price || 0,
      status: 'scheduled',
      date: slot.date,
      created_at: new Date().toISOString(),
    };

    setAppointments(prev => [newApp, ...prev]);
    if (setWaitlist) {
      setWaitlist(prev =>
        prev.map(w =>
          w.id === entry.id ? { ...w, status: 'claimed', claimed_at: new Date().toISOString() } : w
        )
      );
    }
    setReleasedSlotAlert(null);
  };

  const slots = useMemo(() => generateBusinessSlots(org, 30, 30), [
    org.open_hour,
    org.close_hour,
    org.break_enabled,
    org.break_start,
    org.break_end,
  ]);

  const changeDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(getLocalDateKey(current));
  };

  const openDatePicker = () => {
    const current = new Date(selectedDate + 'T00:00:00');
    setCalendarMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setShowDatePicker(true);
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(year, month, index - firstWeekday + 1);
      return {
        date: day,
        key: getLocalDateKey(day),
        isCurrentMonth: day.getMonth() === month,
      };
    });
  }, [calendarMonth]);

  const calendarMonthLabel = useMemo(
    () => calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [calendarMonth],
  );

  const formattedDateTitle = useMemo(() => {
    const current = new Date(selectedDate + 'T00:00:00');
    return current.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }, [selectedDate]);

  const compactDateLabel = useMemo(() => {
    const current = new Date(selectedDate + 'T00:00:00');
    const day = current.getDate();
    const month = current.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${day} de ${month}`;
  }, [selectedDate]);

  const currentWeekDays = useMemo(() => {
    const current = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = current.getDay(); // 0: Dom ... 6: Sáb
    const sunday = new Date(current);
    sunday.setDate(current.getDate() - dayOfWeek);

    const todayStr = getLocalDateKey();

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const key = getLocalDateKey(d);
      const weekdayShort = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
      return {
        date: d,
        key,
        dayNumber: d.getDate(),
        weekdayShort,
        isToday: key === todayStr,
        isSelected: key === selectedDate,
      };
    });
  }, [selectedDate]);

  const weekAppointmentsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach((app) => {
      if (!blocksAppointmentSlot(app.status)) return;
      if (selectedBarberId !== 'all' && app.barber_id !== selectedBarberId) return;
      const d = app.date || getLocalDateKey();
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [appointments, selectedBarberId]);

  // Agendamentos específicos da data selecionada
  const dayAppointments = useMemo(() => {
    return appointments.filter(a => {
      const appDate = a.date || getLocalDateKey();
      const matchesDate = appDate === selectedDate;
      const matchesBarber = selectedBarberId === 'all' || a.barber_id === selectedBarberId;
      return matchesDate && matchesBarber;
    });
  }, [appointments, selectedDate, selectedBarberId]);

  const boardBarbers = useMemo(() => {
    const active = barbers.filter(b => b.active !== false);
    return selectedBarberId === 'all' ? active : active.filter(b => b.id === selectedBarberId);
  }, [barbers, selectedBarberId]);

  // Rodízio justo: primeiro considera quem atendeu menos no dia; em caso de
  // empate, parte do profissional atendido por último, sem favorecer sempre o
  // primeiro nome da lista.
  const nextRotationBarber = useMemo(() => {
    const active = barbers.filter(barber => barber.active !== false);
    if (!active.length) return undefined;
    const countFor = (barberId: string) => appointments.filter(appointment =>
      (appointment.date || getLocalDateKey()) === selectedDate
      && appointment.barber_id === barberId
      && !['canceled', 'no_show'].includes(appointment.status)
    ).length;
    const minimum = Math.min(...active.map(barber => countFor(barber.id)));
    const candidates = active.filter(barber => countFor(barber.id) === minimum);
    const lastIndex = candidates.findIndex(barber => barber.id === org.rotation_last_barber_id);
    return candidates[(lastIndex + 1 + candidates.length) % candidates.length] || candidates[0];
  }, [appointments, barbers, org.rotation_last_barber_id, selectedDate]);

  const activeDayAppointments = dayAppointments.filter(a => blocksAppointmentSlot(a.status));
  const completedDayAppointments = dayAppointments.filter(a => a.status === 'completed');
  const dayRevenue = activeDayAppointments.reduce((acc, curr) => acc + curr.price, 0);

  // Totais dos serviços selecionados no modal de criação
  const modalSelectedServices = useMemo(() => {
    return services.filter(s => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const modalTotalPrice = useMemo(() => {
    return modalSelectedServices.reduce((sum, s) => sum + s.price, 0);
  }, [modalSelectedServices]);

  const modalTotalDuration = useMemo(() => {
    return modalSelectedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
  }, [modalSelectedServices]);

  const toggleServiceSelection = (id: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFinishAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingApp) return;

    const finalPrice = applyLoyaltyReward ? 0 : completingApp.price;

    setAppointments(prev => prev.map(a => 
      a.id === completingApp.id 
        ? { 
            ...a, 
            status: 'completed', 
            payment_method: paymentMethod, 
            price: finalPrice,
            loyalty_reward_applied: applyLoyaltyReward 
          } 
        : a
    ));

    if (setClients) {
      setClients(prev => {
        const phone = normalizeClientPhone(completingApp.client_phone);
        const name = completingApp.client_name?.trim();
        const base = upsertClient(prev, {
          name: completingApp.client_name,
          phone: completingApp.client_phone,
          org_id: completingApp.org_id,
          visitDelta: 1,
          spentDelta: finalPrice,
          lastVisit: 'Hoje',
        });

        if (org.loyalty_enabled === false) return base;

        return base.map(c => {
          const cPhone = normalizeClientPhone(c.phone);
          const isTarget = (phone && cPhone && phone === cPhone) || (!phone && c.name?.trim() === name);
          if (!isTarget) return c;

          if (applyLoyaltyReward) {
            return redeemLoyaltyRewardFromClient(c);
          } else {
            const { updatedClient } = addLoyaltyStampToClient(c, org);
            return updatedClient;
          }
        });
      });
    }

    setCompletingApp(null);
    setApplyLoyaltyReward(false);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError('');

    if (!clientName.trim() || selectedServiceIds.length === 0) return;

    const brb = barbers.find(b => b.id === barberId) || barbers[0];
    if (!brb) return;

    if (!isBookableBusinessDateTime(modalTime, modalTotalDuration, selectedDate, org)) {
      setAddModalError(`O horário das ${modalTime} está fora do expediente, no intervalo ou em um período bloqueado pela barbearia.`);
      return;
    }

    // VERIFICAÇÃO DE HORÁRIO OCUPADO
    const occupied = isTimeSlotOccupied(
      modalTime,
      modalTotalDuration,
      brb.id,
      selectedDate,
      appointments
    );

    if (occupied) {
      setAddModalError(`O horário das ${modalTime} já está ocupado ou colide com outro agendamento para ${brb.full_name}.`);
      return;
    }

    const joinedNames = modalSelectedServices.map(s => s.name).join(' + ');

    const created: Appointment = {
      id: 'app-' + Date.now(),
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || 'Não informado',
      service_id: modalSelectedServices[0]?.id || '',
      service_name: joinedNames,
      services: modalSelectedServices.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration_minutes: s.duration_minutes || 30,
        category: s.category,
      })),
      duration_minutes: modalTotalDuration,
      barber_id: brb.id,
      barber_name: brb.full_name,
      start_time: modalTime,
      price: modalTotalPrice,
      status: 'scheduled',
      date: selectedDate,
      created_at: new Date().toISOString(),
    };

    setAppointments(prev => [created, ...prev]);
    if (org.rotation_enabled && setOrg) setOrg(current => ({ ...current, rotation_last_barber_id: brb.id }));
    setClientName('');
    setClientPhone('');
    setSelectedServiceIds([]);
    setShowAddModal(false);
  };

  const getWhatsAppDirect = (app: Appointment, action: WhatsAppAction = 'confirm') =>
    buildAppointmentWhatsAppUrl(org, app, action);

  const openSlotForBarber = (time: string, targetBarberId: string) => {
    setModalTime(time);
    setSelectedServiceIds(services[0] ? [services[0].id] : []);
    setBarberId(targetBarberId);
    setAddModalError('');
    setShowAddModal(true);
  };

  return (
    <div className="app-view space-y-4 sm:space-y-6 animate-fadeIn">
      {/* CABEÇALHO DA AGENDA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-[#121B2E] p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            Agenda Completa
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 capitalize">
            {formattedDateTitle}
          </p>
        </div>

        {/* CONTROLES DE DATA E PROFISSIONAL */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Seletor de Barbeiro */}
          <select
            data-barber-filter
            aria-label="Filtrar agenda por profissional"
            value={selectedBarberId}
            onChange={(e) => setSelectedBarberId(e.target.value)}
            className="bg-[#0B1120] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="all">Todos os Barbeiros</option>
            {barbers.map(b => (
              <option key={b.id} value={b.id}>{b.full_name}</option>
            ))}
          </select>

          {/* Botão Hoje rápido (estilo Google Calendar) */}
          <button
            type="button"
            onClick={() => setSelectedDate(getLocalDateKey())}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 flex items-center gap-1.5 ${
              selectedDate === getLocalDateKey()
                ? 'bg-[#0B1120] text-emerald-400 border border-emerald-500/30'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
            }`}
            title="Voltar para a data de hoje"
          >
            Hoje
          </button>

          {/* Navegador de Data com indicação da data selecionada */}
          <div className="flex items-center gap-1 bg-[#0B1120] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => changeDate(-1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95 min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
              title="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openDatePicker}
              aria-haspopup="dialog"
              aria-label="Abrir calendário mensal"
              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 inline-flex items-center gap-1.5 capitalize"
              title="Clique para escolher uma data no calendário mensal"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>{compactDateLabel}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <button
              onClick={() => changeDate(1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95 min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
              title="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowWaitlistModal(true)}
            className="px-3 py-2 bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-sm"
            title="Abrir Lista de Espera Relâmpago"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Fila de Espera</span>
            {waitlist.filter((w) => w.status === 'waiting').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                {waitlist.filter((w) => w.status === 'waiting').length}
              </span>
            )}
          </button>

          {org.rotation_enabled && nextRotationBarber && (
            <button
              type="button"
              onClick={() => openSlotForBarber('14:00', nextRotationBarber.id)}
              className="px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
              title="Criar encaixe para o próximo profissional do rodízio"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Rodízio: {nextRotationBarber.full_name.split(' ')[0]}</span>
            </button>
          )}

          <button
            type="button"
            disabled={triggeringReminders}
            onClick={handleTriggerReminders}
            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 disabled:opacity-50"
            title="Verificar e enviar lembretes automáticos de WhatsApp aos clientes com horário nas próximas 2 horas"
          >
            <BellRing className={`w-3.5 h-3.5 ${triggeringReminders ? 'animate-bounce' : ''}`} />
            <span>{triggeringReminders ? 'Enviando...' : 'Lembretes WhatsApp'}</span>
          </button>

          <button
            onClick={() => {
              setSelectedServiceIds(services[0] ? [services[0].id] : []);
              setBarberId(selectedBarberId !== 'all' ? selectedBarberId : barbers[0]?.id || '');
              setModalTime('14:00');
              setAddModalError('');
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agendar</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK DO DISPARO DE LEMBRETES */}
      {remindersFeedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-fadeIn ${
          remindersFeedback.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' :
          remindersFeedback.type === 'error' ? 'bg-rose-500/15 border-rose-500/30 text-rose-200' :
          'bg-cyan-500/15 border-cyan-500/30 text-cyan-200'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            <BellRing className="w-4 h-4 shrink-0" />
            <span>{remindersFeedback.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setRemindersFeedback(null)} 
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* RÉGUA DA SEMANA */}
      <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 px-1 mb-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
            <CalendarIcon className="w-3 h-3 text-emerald-400" />
            <span>Visão Semanal</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeDate(-7)}
              className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
              title="Semana anterior"
            >
              <ChevronLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Semana anterior</span>
            </button>
            <button
              type="button"
              onClick={() => changeDate(7)}
              className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
              title="Próxima semana"
            >
              <span className="hidden sm:inline">Próxima semana</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
        <div className="grid min-w-[332px] grid-cols-7 gap-1 sm:gap-2">
          {currentWeekDays.map((item) => {
            const count = weekAppointmentsCount[item.key] || 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedDate(item.key)}
                aria-pressed={item.isSelected}
                aria-current={item.isToday ? 'date' : undefined}
                aria-label={`${item.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} ${count === 1 ? 'agendamento' : 'agendamentos'}`}
                className={`flex h-[76px] sm:h-[84px] flex-col items-center justify-center gap-1 px-1 py-3 rounded-xl border transition-colors active:scale-95 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  item.isSelected
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                    : 'border-slate-800 bg-[#0B1120]/50 hover:bg-slate-800/60 hover:border-slate-600 text-slate-300'
                }`}
              >
                <span className={`text-lg sm:text-xl font-bold leading-none tabular-nums ${item.isSelected || item.isToday ? 'text-emerald-400' : 'text-white'}`}>
                  {item.dayNumber}
                </span>
                <span className={`text-[9px] sm:text-[11px] font-medium ${item.isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {item.weekdayShort}
                </span>
                {count > 0 && (
                  <span aria-hidden="true" className={`absolute right-1 top-1 min-w-3.5 rounded-full px-0.5 text-center text-[8px] font-bold leading-[14px] ${item.isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* BARRA DE RESUMO DO DIA */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
        <div className="stagger-item booking-card bg-[#121B2E] p-2.5 sm:p-4 rounded-2xl border border-slate-800 text-center sm:text-left shadow-sm">
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">Agendados</p>
          <p className="text-lg min-[380px]:text-xl sm:text-2xl xl:text-3xl font-black text-white font-mono mt-1 tracking-tight">{activeDayAppointments.length}</p>
        </div>
        <div className="stagger-item booking-card bg-[#121B2E] p-2.5 sm:p-4 rounded-2xl border border-slate-800 text-center sm:text-left shadow-sm" style={{ animationDelay: '30ms' }}>
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">Concluídos</p>
          <p className="text-lg min-[380px]:text-xl sm:text-2xl xl:text-3xl font-black text-emerald-400 font-mono mt-1 tracking-tight">{completedDayAppointments.length}</p>
        </div>
        <div className="stagger-item booking-card bg-[#121B2E] p-2.5 sm:p-4 rounded-2xl border border-slate-800 text-center sm:text-left shadow-sm" style={{ animationDelay: '60ms' }}>
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">Previsto</p>
          <p className="text-lg min-[380px]:text-xl sm:text-2xl xl:text-3xl font-black text-emerald-400 font-mono mt-1 tracking-tight">R$ {dayRevenue.toFixed(0)}</p>
        </div>
        <div className="stagger-item booking-card bg-[#121B2E] p-2.5 sm:p-4 rounded-2xl border border-slate-800 text-center sm:text-left shadow-sm" style={{ animationDelay: '90ms' }}>
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">Livres</p>
          <p className="text-lg min-[380px]:text-xl sm:text-2xl xl:text-3xl font-black text-slate-300 font-mono mt-1 tracking-tight">{slots.length - activeDayAppointments.length}</p>
        </div>
      </div>

      {/* AGENDA VISUAL POR PROFISSIONAL - DESKTOP */}
      <div className="hidden lg:block bg-[#121B2E] border border-slate-800 rounded-3xl p-5 xl:p-6 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-black">Visão profissional</p>
            <h3 className="text-base font-bold text-white mt-0.5">Agenda por barbeiro</h3>
          </div>
          <span className="text-[11px] text-slate-500">Clique em um horário livre para agendar.</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#08101f]">
          <div
            className="min-w-[900px] grid"
            style={{ gridTemplateColumns: `88px repeat(${Math.max(boardBarbers.length, 1)}, minmax(190px, 1fr))` }}
          >
            <div className="sticky left-0 z-10 bg-slate-950 px-3 py-3 border-b border-r border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">Horário</div>
            {boardBarbers.map((barber) => (
              <div key={`head-${barber.id}`} className="px-4 py-3 border-b border-r last:border-r-0 border-slate-800 bg-slate-950/80">
                <p className="text-xs font-black text-white truncate">{barber.full_name}</p>
                <p className="text-[10px] text-cyan-300 mt-0.5 truncate">{barber.role || 'Profissional'}</p>
              </div>
            ))}

            {slots.flatMap((time) => {
              const rows: React.ReactNode[] = [
                <div key={`time-${time}`} className="sticky left-0 z-10 bg-slate-950/95 px-3 py-3 border-b border-r border-slate-800 flex items-start justify-center">
                  <span className="text-xs font-black font-mono text-cyan-300">{time}</span>
                </div>,
              ];

              boardBarbers.forEach((barber) => {
                const app = dayAppointments.find(a => a.barber_id === barber.id && a.start_time === time && blocksAppointmentSlot(a.status));

                rows.push(
                  <div key={`${time}-${barber.id}`} className="min-h-[84px] border-b border-r last:border-r-0 border-slate-800/80 p-2">
                    {app ? (
                      <div className={`h-full rounded-xl border p-3 flex flex-col justify-between gap-2 transition-all hover:shadow-md ${
                        app.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/25' :
                        app.status === 'arrived' ? 'bg-cyan-500/10 border-cyan-500/25' :
                        app.status === 'in_progress' ? 'bg-blue-500/10 border-blue-500/25' :
                        app.status === 'confirmed' ? 'bg-sky-500/10 border-sky-500/25' :
                        'bg-amber-500/10 border-amber-500/25'
                      }`}>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenClientProfile(app.client_name, app.client_phone)}
                              className="text-xs font-black text-white hover:text-cyan-300 truncate text-left transition-colors flex items-center gap-1 group"
                              title="Abrir ficha técnica e histórico do cliente"
                            >
                              <span className="truncate">{app.client_name}</span>
                              <span className="text-[10px] text-cyan-400 opacity-70 group-hover:opacity-100 shrink-0">📋</span>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              {app.reminder_sent_at && (
                                <span
                                  title={`Lembrete WhatsApp enviado às ${new Date(app.reminder_sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                                  className="inline-flex items-center text-emerald-400 p-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
                                >
                                  <BellRing className="w-2.5 h-2.5" />
                                </span>
                              )}
                              <AgendaStatusBadge status={app.status} className="text-[8px] px-1.5 py-0.5" />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-300 mt-1 flex items-center gap-1.5 min-w-0">
                            <Scissors className="w-3 h-3 shrink-0 text-emerald-400" aria-hidden="true" />
                            <span className="truncate">{app.service_name}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-cyan-300 inline-flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                            R$ {app.price.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenClientProfile(app.client_name, app.client_phone)}
                              className="text-[9px] text-cyan-300 inline-flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-1 hover:bg-cyan-500/20 active:scale-95 transition-all"
                              title="Ficha técnica de corte e histórico do cliente"
                            >
                              Ficha
                            </button>
                            {(app.status === 'scheduled' || app.status === 'confirmed') && (
                              <button
                                type="button"
                                onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'arrived' } : a))}
                                className="text-[9px] text-cyan-200 inline-flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 hover:bg-cyan-500/15 active:scale-95"
                              ><UserRoundCheck className="w-3 h-3" /> Chegou</button>
                            )}
                            {app.status === 'arrived' && (
                              <button
                                type="button"
                                onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'in_progress' } : a))}
                                className="text-[9px] text-blue-200 inline-flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1 hover:bg-blue-500/15 active:scale-95"
                              ><Play className="w-3 h-3" /> Iniciar</button>
                            )}
                            {app.status === 'in_progress' && (
                              <button
                                type="button"
                                onClick={() => setCompletingApp(app)}
                                className="text-[9px] text-emerald-200 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 hover:bg-emerald-500/15 active:scale-95"
                              ><CheckCircle className="w-3 h-3" /> Finalizar</button>
                            )}
                            <button
                              type="button"
                              onClick={() => setWhatsAppAppointment(app)}
                              className="text-[9px] text-emerald-400 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 hover:bg-emerald-500/15 active:scale-95"
                            >
                              <MessageSquare className="w-3 h-3" /> WhatsApp
                            </button>
                            {isOpenAppointmentStatus(app.status) && (
                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(app)}
                                title="Cancelar agendamento e verificar fila de espera"
                                className="text-[9px] text-slate-400 hover:text-rose-300 inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:bg-rose-950/40 active:scale-95 transition-colors min-w-[44px] min-h-[44px]"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSlotForBarber(time, barber.id)}
                        className="w-full h-full min-h-[66px] rounded-xl border border-dashed border-slate-800 text-[10px] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all flex items-center justify-center"
                      >
                        + Horário livre
                      </button>
                    )}
                  </div>
                );
              });

              return rows;
            })}
          </div>
        </div>
      </div>

      {/* GRADE HORÁRIA MOBILE - Otimizada para telas pequenas sem quebra */}
      <div className="lg:hidden bg-[#121B2E] border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-black text-white">Horários do dia</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Toque em um horário disponível para agendar.</p>
          </div>
          <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black font-mono text-emerald-300">{selectedDate.split('-').reverse().slice(0, 2).join('/')}</span>
        </div>
        {org.break_enabled && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <span className="text-[11px] sm:text-xs text-amber-300 font-semibold">Descanso ativo</span>
            <span className="text-[11px] sm:text-xs text-amber-200 font-mono">{org.break_start || '12:00'} — {org.break_end || '14:00'}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {slots.map((time) => {
            const slotStartMin = timeToMinutes(time);
            const slotEndMin = slotStartMin + 30;

            const matchingAppointments = dayAppointments.filter(a => {
              if (!blocksAppointmentSlot(a.status)) return false;

              const appStart = timeToMinutes(a.start_time);
              const appDuration = a.duration_minutes || (a.services?.reduce((sum, s) => sum + (s.duration_minutes || 30), 0)) || 30;
              const appEnd = appStart + appDuration;

              return slotStartMin < appEnd && appStart < slotEndMin;
            });

            const isOccupied = matchingAppointments.length > 0;

            return (
              <div
                key={time}
                className={`rounded-2xl border transition-all ${
                  isOccupied
                    ? 'col-span-2 p-3 sm:p-4 bg-slate-900 border-slate-700 shadow-sm space-y-2.5'
                    : 'col-span-1 p-2.5 min-h-[76px] flex flex-col justify-center bg-[#0B1120]/60 border-slate-800/60 opacity-90 hover:opacity-100 hover:border-emerald-500/40'
                }`}
              >
                {isOccupied ? (
                  <div className="space-y-3">
                    {matchingAppointments.map(app => {
                      const isOriginalStart = app.start_time === time;
                      const appDate = app.date || selectedDate;
                      const isToday = appDate === getLocalDateKey();
                      const formattedDateBadge = isToday
                        ? 'HOJE'
                        : new Date(`${appDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                      return (
                        <div key={app.id} data-appointment-id={app.id} className="space-y-2.5 scroll-mt-28 rounded-2xl">
                          {/* LINHA SUPERIOR: HORÁRIO, CLIENTE, SERVIÇO E STATUS */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="w-14 sm:w-16 shrink-0 text-center space-y-1">
                                <span className="block text-sm sm:text-base font-black font-mono text-emerald-400 leading-tight">
                                  {time}
                                </span>
                                <span className={`block w-full rounded-lg border px-1 py-1 text-[11px] sm:text-xs font-black leading-none ${
                                  isToday
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                                    : 'bg-slate-800 text-slate-200 border-slate-700'
                                }`}>
                                  {formattedDateBadge}
                                </span>
                              </div>
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClientProfile(app.client_name, app.client_phone)}
                                    className="font-bold text-white text-xs sm:text-sm truncate hover:text-cyan-300 text-left transition-colors flex items-center gap-1 group"
                                    title="Abrir ficha técnica e histórico do cliente"
                                  >
                                    <span className="truncate">{app.client_name}</span>
                                    <span className="text-[10px] text-cyan-400 opacity-80 group-hover:opacity-100">📋</span>
                                  </button>

                                  {!isOriginalStart && (
                                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                                      Início {app.start_time}
                                    </span>
                                  )}

                                  {app.services && app.services.length > 0 ? (
                                    app.services.map((srv, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-medium">
                                        <Scissors className="w-3 h-3 shrink-0" aria-hidden="true" />
                                        {srv.name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-medium">
                                      <Scissors className="w-3 h-3 shrink-0" aria-hidden="true" />
                                      {app.service_name}
                                    </span>
                                  )}

                                  <span className="inline-flex items-center gap-1 text-[11px] text-white font-mono font-bold">
                                    <Banknote className="w-3.5 h-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                                    R$ {app.price.toFixed(2)}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-slate-400">
                                  <span className="inline-flex items-center gap-1.5">
                                    <User className="w-3 h-3 shrink-0 text-sky-400" aria-hidden="true" />
                                    <span>Barbeiro: <strong className="text-slate-200">{app.barber_name}</strong></span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClientProfile(app.client_name, app.client_phone)}
                                    className="inline-flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 active:scale-95 transition-all"
                                    title="Abrir ficha técnica de corte e histórico"
                                  >
                                    📋 Ficha
                                  </button>
                                  {app.client_phone && (
                                    <button
                                      type="button"
                                      onClick={() => setWhatsAppAppointment(app)}
                                      className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/15 active:scale-95"
                                    >
                                      <MessageSquare className="w-2.5 h-2.5" /> WhatsApp
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <AgendaStatusBadge status={app.status} className="px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold" />
                              {app.reminder_sent_at && (
                                <span
                                  title={`Lembrete enviado via WhatsApp às ${new Date(app.reminder_sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                                  className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md"
                                >
                                  <BellRing className="w-2.5 h-2.5 shrink-0" />
                                  <span className="hidden sm:inline">Lembrete WhatsApp</span>
                                  <span className="sm:hidden">Lembrete</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* LINHA INFERIOR: BOTÕES DE AÇÃO COM WRAP COMPLETO (NUNCA SOBRESSAEM) */}
                          {isOpenAppointmentStatus(app.status) && isOriginalStart && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80 w-full">
                              {app.status === 'scheduled' && (
                                <button
                                  onClick={() => confirmAppointment(app)}
                                  className="w-full min-h-9 px-2 bg-sky-500/15 border border-sky-500/25 text-sky-300 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                                ><CheckCheck className="w-3.5 h-3.5 shrink-0" /> <span>Confirmar</span></button>
                              )}
                              {(app.status === 'scheduled' || app.status === 'confirmed') && (
                                <button
                                  onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'arrived' } : a))}
                                  className="w-full min-h-9 px-2 bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                                ><UserRoundCheck className="w-3.5 h-3.5 shrink-0" /> <span>Chegou</span></button>
                              )}
                              {app.status === 'arrived' && (
                                <button
                                  onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'in_progress' } : a))}
                                  className="w-full min-h-9 px-2 bg-blue-500/15 border border-blue-500/25 text-blue-300 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                                ><Play className="w-3.5 h-3.5 shrink-0" /> <span>Iniciar</span></button>
                              )}
                              {app.status === 'in_progress' && (
                                <button
                                  onClick={() => setCompletingApp(app)}
                                  className="w-full min-h-9 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95 shadow-sm"
                                ><CheckCircle className="w-3.5 h-3.5 shrink-0" /> <span>Finalizar</span></button>
                              )}
                              {(app.status === 'scheduled' || app.status === 'confirmed') && (
                                <button
                                  onClick={async () => {
                                    if (await appConfirm(`Marcar ${app.client_name} como não compareceu?`, { danger: true })) {
                                      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'no_show' } : a));
                                    }
                                  }}
                                  className="w-full min-h-9 px-2 bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                                ><UserX className="w-3.5 h-3.5 shrink-0" /> <span>Faltou</span></button>
                              )}
                              <button
                                onClick={() => handleCancelAppointment(app)}
                                className="col-span-2 xl:col-span-1 w-full min-h-9 px-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-300 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center justify-center whitespace-nowrap active:scale-95"
                              ><span>Cancelar</span></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setModalTime(time);
                      setSelectedServiceIds(services[0] ? [services[0].id] : []);
                      setBarberId(selectedBarberId !== 'all' ? selectedBarberId : barbers[0]?.id || '');
                      setAddModalError('');
                      setShowAddModal(true);
                    }}
                    aria-label={'Agendar horário livre às ' + time}
                    className="w-full min-h-[72px] rounded-xl px-1 text-left transition-colors group cursor-pointer"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 group-hover:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500/70 group-hover:bg-emerald-500 transition-colors shrink-0" />
                        Disponível
                      </span>
                      <span className="font-mono text-base font-black text-emerald-400">{time}</span>
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-500 group-hover:text-emerald-400">Toque para agendar</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showDatePicker && (
        <Modal
          label="Selecionar data da agenda"
          onClose={() => setShowDatePicker(false)}
          className="fixed inset-0 z-[220] app-mobile-modal flex items-center justify-center bg-black/70 p-3 sm:p-4"
        >
          <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-5" aria-label="Calendário mensal">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="capitalize text-center text-base font-black text-white">{calendarMonthLabel}</h3>
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-500">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day} className="py-2">{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label={'Dias de ' + calendarMonthLabel}>
              {calendarDays.map(({ date, key, isCurrentMonth }) => {
                const isSelected = key === selectedDate;
                const isToday = key === getLocalDateKey();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(key);
                      setShowDatePicker(false);
                    }}
                    aria-label={'Selecionar ' + date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    aria-pressed={isSelected}
                    className={isSelected
                      ? 'min-h-11 rounded-xl bg-emerald-500 text-xs font-black text-slate-950 shadow-sm'
                      : isToday
                        ? 'min-h-11 rounded-xl border border-emerald-500/45 bg-emerald-500/10 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20'
                        : isCurrentMonth
                          ? 'min-h-11 rounded-xl text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white'
                          : 'min-h-11 rounded-xl text-xs font-medium text-slate-600 transition hover:bg-slate-800/60'}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button type="button" onClick={() => setShowDatePicker(false)} className="min-h-11 rounded-xl px-4 text-xs font-semibold text-slate-300 transition hover:bg-slate-800">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setSelectedDate(getLocalDateKey(today));
                  setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setShowDatePicker(false);
                }}
                className="min-h-11 rounded-xl bg-emerald-500 px-4 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
              >
                Ir para hoje
              </button>
            </div>
          </section>
        </Modal>
      )}

      {/* MODAL CONCLUIR ATENDIMENTO */}
      <WhatsAppActionsModal
        open={Boolean(whatsAppAppointment)}
        recipientName={whatsAppAppointment?.client_name || 'cliente'}
        onClose={() => setWhatsAppAppointment(null)}
        actions={whatsAppAppointment ? [
          { action: 'confirm', label: 'Confirmar horário', href: getWhatsAppDirect(whatsAppAppointment, 'confirm') },
          { action: 'reminder', label: 'Enviar lembrete', href: getWhatsAppDirect(whatsAppAppointment, 'reminder') },
          { action: 'thanks', label: 'Agradecer atendimento', href: getWhatsAppDirect(whatsAppAppointment, 'thanks') },
        ] : []}
      />

      {completingApp && (
        <Modal label="Finalizar atendimento" onClose={() => setCompletingApp(null)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Concluir Atendimento
              </h3>
              <button aria-label="Fechar janela" onClick={() => setCompletingApp(null)} className="text-slate-400 hover:text-white p-1 rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-scroll-body p-4 sm:p-5 space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-2">
                <p><span className="text-slate-400">Cliente:</span> <strong className="text-white">{completingApp.client_name}</strong></p>
                <p><span className="text-slate-400">Profissional:</span> <strong className="text-white">{completingApp.barber_name}</strong></p>
                
                <div className="border-t border-slate-800/80 pt-1.5">
                  <span className="text-slate-400 block mb-1">Serviços:</span>
                  {completingApp.services && completingApp.services.length > 0 ? (
                    completingApp.services.map((s, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300 py-0.5">
                        <span>• {s.name}</span>
                        <span className="font-mono">R$ {s.price.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between text-slate-300">
                      <span>• {completingApp.service_name}</span>
                      <span className="font-mono">R$ {completingApp.price.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between border-t border-slate-800/80 pt-2 font-bold items-center">
                  <span className="text-slate-300">Total a Receber:</span>
                  <div className="text-right">
                    {applyLoyaltyReward ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs line-through text-slate-500 font-mono">
                          R$ {completingApp.price.toFixed(2)}
                        </span>
                        <span className="text-sm font-bold text-amber-400 font-mono">
                          R$ 0,00 (Fidelidade)
                        </span>
                      </div>
                    ) : (
                      <span className="text-base font-bold text-emerald-400 font-mono">
                        R$ {completingApp.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* CARTÃO FIDELIDADE DO CLIENTE */}
              {org.loyalty_enabled !== false && (
                <div className="space-y-2">
                  <LoyaltyCardWidget
                    client={completingClient || { name: completingApp.client_name, phone: completingApp.client_phone }}
                    org={org}
                    compact
                  />

                  {/* SE O CLIENTE TEM RECOMPENSA DISPONÍVEL */}
                  {Number(completingClient?.loyalty_rewards_available || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setApplyLoyaltyReward(prev => !prev)}
                      className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        applyLoyaltyReward
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/20'
                          : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border-amber-400/30'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 shrink-0" />
                        <span>Resgatar Recompensa ({org.loyalty_reward_description || '1 Corte Grátis'})</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/20 font-black">
                        {applyLoyaltyReward ? 'Aplicado (R$ 0,00)' : 'Aplicar'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pix', label: 'Pix', icon: QrCode },
                    { id: 'credit', label: 'Cartão Crédito', icon: CreditCard },
                    { id: 'debit', label: 'Cartão Débito', icon: CreditCard },
                    { id: 'cash', label: 'Dinheiro', icon: Banknote },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all ${
                          paymentMethod === m.id
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-static-footer p-4 sm:p-5 border-t border-slate-800 bg-slate-900">
              <button
                type="button"
                onClick={handleFinishAppointment}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 active:scale-98"
              >
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL NOVO AGENDAMENTO */}
      {showAddModal && (
        <Modal label="Agendar horário" onClose={() => setShowAddModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Agendar ({modalTime})
              </h3>
              <button aria-label="Fechar janela" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addModalError && (
              <div className="mx-4 sm:mx-5 mt-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{addModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-4 sm:p-5 space-y-3.5">
                <div>
                  <label htmlFor="agenda-field-1" className="block text-xs font-semibold text-slate-300 mb-1">Nome do Cliente *</label>
                  <input id="agenda-field-1"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Gabriel Moreira"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="agenda-field-2" className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp</label>
                  <input id="agenda-field-2"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(84) 99999-0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* SELEÇÃO DE MÚLTIPLOS SERVIÇOS */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Serviços * ({selectedServiceIds.length} selecionado(s))
                    </label>
                    {modalTotalPrice > 0 && (
                      <span className="text-xs text-emerald-400 font-bold font-mono">
                        R$ {modalTotalPrice.toFixed(2)} ({modalTotalDuration} min)
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {services.map((s) => {
                      const isChecked = selectedServiceIds.includes(s.id);
                      return (
                        <button type="button" aria-pressed={isChecked}
                          key={s.id}
                          onClick={() => toggleServiceSelection(s.id)}
                          className={`w-full text-left gap-2 p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isChecked
                              ? 'bg-emerald-950/30 border-emerald-500/60 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span aria-hidden="true" className={`shrink-0 w-4 h-4 rounded flex items-center justify-center border ${
                              isChecked ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700 bg-slate-900 text-transparent'
                            }`}>
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                            <span className="font-semibold">{s.name}</span>
                            <span className="shrink-0 text-[10px] text-slate-500">({s.duration_minutes}m)</span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-mono font-bold text-emerald-400">R$ {s.price.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="agenda-field-3" className="block text-xs font-semibold text-slate-300 mb-1">Barbeiro *</label>
                    <select id="agenda-field-3"
                      value={barberId}
                      onChange={(e) => setBarberId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {barbers.map((b) => (
                        <option key={b.id} value={b.id}>{b.full_name} ({b.role})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="agenda-field-4" className="block text-xs font-semibold text-slate-300 mb-1">Horário *</label>
                    <input id="agenda-field-4"
                      type="time"
                      required
                      value={modalTime}
                      onChange={(e) => setModalTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-static-footer flex justify-end gap-2 p-4 sm:p-5 border-t border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={selectedServiceIds.length === 0}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  Salvar (R$ {modalTotalPrice.toFixed(2)})
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      <WaitlistModal
        open={showWaitlistModal || Boolean(releasedSlotAlert)}
        onClose={() => {
          setShowWaitlistModal(false);
          setReleasedSlotAlert(null);
        }}
        waitlist={waitlist}
        setWaitlist={setWaitlist || (() => {})}
        org={org}
        barbers={barbers}
        services={services}
        releasedSlot={releasedSlotAlert}
        onClaimSlot={handleClaimWaitlistSlot}
      />

      {activeProfileClient && (
        <ClientProfileModal
          client={activeProfileClient}
          org={org}
          appointments={appointments}
          onClose={() => setActiveProfileClient(null)}
          onUpdateClient={handleUpdateProfileClient}
        />
      )}
      {confirmedFeedback && createPortal(
        <div role="status" className="agendai-confirm-toast pointer-events-none fixed right-3 top-4 z-[260] w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-emerald-400/40 bg-[#0B1424] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,.45)] sm:right-6 sm:top-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><CheckCheck className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><strong className="block text-sm">Horário confirmado</strong><p className="mt-1 text-xs text-slate-300">{confirmedFeedback.client_name} · {confirmedFeedback.service_name}</p><p className="mt-1 text-xs font-semibold text-emerald-300">{confirmedFeedback.date} às {confirmedFeedback.start_time}</p></div>
            <button type="button" onClick={() => setConfirmedFeedback(null)} aria-label="Fechar confirmação" className="pointer-events-auto rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white min-w-[44px] min-h-[44px] inline-flex items-center justify-center"><X className="h-4 w-4" /></button>
          </div>
        </div>, document.body,
      )}
    </div>
  );
};
