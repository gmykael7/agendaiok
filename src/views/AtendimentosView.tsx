import { appConfirm } from '../components/common/ConfirmDialog';
import { gsap, motionAllowed } from '../utils/motion';
import { SwipeCard } from '../components/common/SwipeCard';
import { Modal } from "../components/common/Modal";
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  CheckSquare, Plus, Clock, CheckCircle, X, 
  Search, Phone, DollarSign, CreditCard, Banknote, QrCode, MessageSquare, Calendar, Check, AlertCircle,
  CheckCheck, UserRoundCheck, Play, UserX, Sparkles
} from 'lucide-react';
import { Appointment, Service, Barber, Organization, Client } from '../types';
import { normalizeClientPhone } from '../utils/clients';
import { getLocalDateKey, isBookableBusinessDateTime, timeToMinutes } from '../utils/scheduling';
import { appointmentStatusClasses, appointmentStatusLabel, blocksAppointmentSlot, isOpenAppointmentStatus } from '../utils/appointmentStatus';
import { buildAppointmentWhatsAppUrl, WhatsAppAction } from '../utils/whatsapp';
import { WhatsAppActionsModal } from '../components/common/WhatsAppActionsModal';

interface AtendimentosViewProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  services: Service[];
  barbers: Barber[];
  org: Organization;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onOpenCommand?: (appointment: Appointment) => void;
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

export const AtendimentosView: React.FC<AtendimentosViewProps> = ({
  appointments,
  setAppointments,
  services,
  barbers,
  org,
  setClients,
  onOpenCommand,
}) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'open' | 'completed' | 'no_show' | 'canceled'>('all');
  const [search, setSearch] = useState('');
  const [freshAppId, setFreshAppId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardTopsRef = useRef<Map<string, number>>(new Map());

  const [showModal, setShowModal] = useState(false);
  const [completingApp, setCompletingApp] = useState<Appointment | null>(null);
  const [whatsAppAppointment, setWhatsAppAppointment] = useState<Appointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'cash'>('pix');
  const [modalError, setModalError] = useState('');

  // Form State Novo Atendimento
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState(barbers[0]?.id || '');
  const [time, setTime] = useState('14:00');
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey());

  const todayStr = useMemo(() => getLocalDateKey(), []);

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

  const filtered = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    return appointments.filter(a => {
      const isToday = (a.date || todayStr) === todayStr;
      const matchesFilter =
        filter === 'all' ? true :
        filter === 'today' ? isToday :
        filter === 'open' ? isOpenAppointmentStatus(a.status) :
        a.status === filter;

      const matchesSearch = 
        !cleanSearch ||
        a.client_name.toLowerCase().includes(cleanSearch) ||
        a.service_name.toLowerCase().includes(cleanSearch) ||
        a.barber_name.toLowerCase().includes(cleanSearch) ||
        (a.client_phone && a.client_phone.includes(cleanSearch));

      return matchesFilter && matchesSearch;
    });
  }, [appointments, todayStr, filter, search]);

  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [filter, search]);

  const paginatedAppointments = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const handleFinishAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingApp) return;

    setAppointments(prev => prev.map(a => 
      a.id === completingApp.id ? { ...a, status: 'completed', payment_method: paymentMethod } : a
    ));
    // O retorno concluído é a única ação que soma pontos automaticamente.
    setClients(prev => prev.map(client => {
      const clientPhone = normalizeClientPhone(client.phone);
      const appointmentPhone = normalizeClientPhone(completingApp.client_phone);
      const sameClient = appointmentPhone
        ? clientPhone === appointmentPhone
        : client.name.trim().toLocaleLowerCase('pt-BR') === completingApp.client_name.trim().toLocaleLowerCase('pt-BR');
      return sameClient ? { ...client, loyalty_points: Math.max(0, Number(client.loyalty_points || 0)) + 10 } : client;
    }));
    setCompletingApp(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!clientName.trim() || selectedServiceIds.length === 0) return;

    const brb = barbers.find(b => b.id === barberId) || barbers[0];
    if (!brb) return;

    if (!isBookableBusinessDateTime(time, modalTotalDuration, selectedDate, org)) {
      setModalError(`O horário das ${time} está fora do expediente, no intervalo ou em um período bloqueado pela barbearia.`);
      return;
    }

    // VERIFICAÇÃO DE HORÁRIO OCUPADO
    const occupied = isTimeSlotOccupied(
      time,
      modalTotalDuration,
      brb.id,
      selectedDate,
      appointments
    );

    if (occupied) {
      setModalError(`O horário das ${time} no dia ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} já está ocupado para ${brb.full_name}.`);
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
      start_time: time,
      price: modalTotalPrice,
      status: 'scheduled',
      date: selectedDate,
      created_at: new Date().toISOString(),
    };

    setAppointments(prev => [created, ...prev]);
    setFreshAppId(created.id);
    window.setTimeout(() => setFreshAppId(null), 1400);
    setClientName('');
    setClientPhone('');
    setSelectedServiceIds([]);
    setShowModal(false);
  };

  const getAppointmentWhatsApp = (app: Appointment, action: WhatsAppAction) =>
    buildAppointmentWhatsAppUrl(org, app, action);

  // Reordenação suave: quando um atendimento entra no topo, os cards de baixo deslizam
  // da posição antiga até a nova (técnica FLIP), em vez de pularem de lugar.
  useLayoutEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const next = new Map<string, number>();
    root.querySelectorAll<HTMLElement>('[data-appointment-id]').forEach((el) => {
      const id = el.dataset.appointmentId as string;
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const previous = cardTopsRef.current.get(id);
      if (previous !== undefined && Math.abs(previous - top) > 1 && motionAllowed()) {
        gsap.fromTo(el, { y: previous - top }, { y: 0, duration: 0.42, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform' });
      }
    });
    cardTopsRef.current = next;
  }, [paginatedAppointments]);

  return (
    <div className="app-view space-y-4 sm:space-y-6 animate-fadeIn">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-[#121B2E] p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            Gestão de Atendimentos
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Controle de serviços presenciais e agendamentos online.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedServiceIds(services[0] ? [services[0].id] : []);
            setBarberId(barbers[0]?.id || '');
            setSelectedDate(todayStr);
            setModalError('');
            setShowModal(true);
          }}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Atendimento</span>
        </button>
      </div>

      {/* FILTROS E BUSCA RESPONSIVOS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-[#121B2E] p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto overflow-x-auto shadow-sm">
          {([
            { id: 'all', label: 'Todos' },
            { id: 'today', label: 'Hoje' },
            { id: 'open', label: 'Em aberto' },
            { id: 'completed', label: 'Concluídos' },
            { id: 'no_show', label: 'Faltas' },
            { id: 'canceled', label: 'Cancelados' },
          ] as const).map((st) => (
            <button
              key={st.id}
              onClick={() => setFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                filter === st.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou serviço..."
            aria-label="Buscar por cliente ou serviço"
            className="w-full bg-[#121B2E] border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* TABELA DE ATENDIMENTOS */}
      <div className="rounded-3xl">
        {filtered.length === 0 ? (
          <div className="bg-[#121B2E] border border-slate-800 rounded-3xl shadow-lg p-8 sm:p-12 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-base">{appointments.length === 0 ? 'Seus atendimentos aparecem aqui' : 'Nenhum atendimento encontrado'}</h4>
            <p className="text-xs text-slate-400">
              {appointments.length === 0
                ? 'Crie o primeiro atendimento ou compartilhe o link de agendamento para os clientes marcarem sozinhos.'
                : 'Ajuste a busca ou os filtros para encontrar os atendimentos desejados.'}
            </p>
          </div>
        ) : (
          <div ref={listRef} className="space-y-3 sm:space-y-3.5">
            {paginatedAppointments.map((app, index) => {
              const isToday = (app.date || todayStr) === todayStr;
              const formattedDateBadge = isToday ? 'HOJE' : new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

              return (
                <SwipeCard
                  key={app.id}
                  dataId={app.id}
                  swipeRight={app.status === 'in_progress' ? { label: 'Finalizar', tone: 'success', onAction: () => setCompletingApp(app) } : undefined}
                  swipeLeft={(app.status === 'scheduled' || app.status === 'confirmed') ? { label: 'Cancelar', tone: 'danger', onAction: async () => {
                    if (await appConfirm(`Cancelar o atendimento de ${app.client_name} às ${app.start_time}?`, { danger: true })) {
                      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'canceled' } : a));
                    }
                  } } : undefined}
                >
                <div
                  key={app.id}
                  style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
                  data-status={app.status}
                  className={`stagger-item appointment-person-card ${freshAppId === app.id ? 'atendimento-enter' : ''} bg-[#121B2E] border border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-6 shadow-md transition-all space-y-2 sm:space-y-0`}
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-14 sm:w-16 text-center shrink-0 space-y-1">
                      <span className="text-base sm:text-xl font-black text-emerald-400 font-mono block leading-tight">{app.start_time}</span>
                      <span className={`block w-full text-[11px] sm:text-xs font-black px-1 py-1 rounded-lg border leading-none ${
                        isToday ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35' : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}>
                        {formattedDateBadge}
                      </span>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm sm:text-base leading-snug truncate">{app.client_name}</h4>

                      {/* LISTA DE SERVIÇOS DO ATENDIMENTO */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {app.services && app.services.length > 0 ? (
                          app.services.map((srv, idx) => (
                            <span key={idx} className="text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
                              {srv.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
                            {app.service_name}
                          </span>
                        )}
                        <span className="text-xs text-white font-bold font-mono ml-1">
                          R$ {app.price.toFixed(2)}
                        </span>
                        {app.payment_method && (
                          <span className="text-[9px] sm:text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase font-mono">
                            {app.payment_method}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-slate-400 pt-0.5">
                        <span>Barbeiro: <strong className="text-slate-200">{app.barber_name}</strong></span>
                        {app.client_phone && app.client_phone !== 'Não informado' && (
                          <button
                            type="button"
                            onClick={() => setWhatsAppAppointment(app)}
                            className="text-emerald-400 hover:underline flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] font-medium"
                            title="Ações pelo WhatsApp"
                          >
                            <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 w-full md:w-auto">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] sm:text-xs font-semibold shrink-0 ${appointmentStatusClasses(app.status)}`}>
                      {appointmentStatusLabel(app.status)}
                    </span>

                    {isOpenAppointmentStatus(app.status) && (
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5 w-full md:w-auto">
                        {app.status === 'scheduled' && (
                          <button
                            onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'confirmed' } : a))}
                            className="w-full md:min-w-[6.5rem] min-h-9 px-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/25 text-sky-300 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                          >
                            <CheckCheck className="w-3.5 h-3.5 shrink-0" /> <span>Confirmar</span>
                          </button>
                        )}

                        {(app.status === 'scheduled' || app.status === 'confirmed') && (
                          <button
                            onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'arrived' } : a))}
                            className="w-full md:min-w-[6.5rem] min-h-9 px-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 text-cyan-300 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                          >
                            <UserRoundCheck className="w-3.5 h-3.5 shrink-0" /> <span>Chegou</span>
                          </button>
                        )}

                        {app.status === 'arrived' && (
                          <button
                            onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'in_progress' } : a))}
                            className="w-full md:min-w-[6.5rem] min-h-9 px-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 text-blue-300 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 shrink-0" /> <span>Iniciar</span>
                          </button>
                        )}

                        {app.status === 'in_progress' && (
                          <button
                            onClick={() => onOpenCommand?.(app)}
                            className="w-full md:min-w-[6.5rem] min-h-9 px-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                          >
                            <DollarSign className="w-3.5 h-3.5 shrink-0" /> <span>Comanda</span>
                          </button>
                        )}

                        {app.status === 'in_progress' && (
                          <button
                            onClick={() => setCompletingApp(app)}
                            className="w-full md:min-w-[6.5rem] min-h-9 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" /> <span>Finalizar</span>
                          </button>
                        )}

                        {(app.status === 'scheduled' || app.status === 'confirmed') && (
                          <button
                            onClick={async () => {
                              if (await appConfirm(`Marcar ${app.client_name} como não compareceu?`, { danger: true })) {
                                setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'no_show' } : a));
                              }
                            }}
                            className="w-full md:min-w-[6.5rem] min-h-9 px-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                          >
                            <UserX className="w-3.5 h-3.5 shrink-0" /> <span>Faltou</span>
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            if (await appConfirm(`Cancelar o atendimento de ${app.client_name} às ${app.start_time}?`, { danger: true })) {
                              setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'canceled' } : a));
                            }
                          }}
                          className="col-span-2 xl:col-span-1 w-full md:min-w-[6.5rem] min-h-9 px-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-300 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center justify-center whitespace-nowrap active:scale-95"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                </SwipeCard>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > visibleCount && (
        <div className="flex justify-center pt-2 pb-2">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 30)}
            className="px-6 py-3 rounded-2xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-xs font-bold text-emerald-400 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            <span>Carregar mais atendimentos</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {filtered.length - visibleCount} restantes
            </span>
          </button>
        </div>
      )}

      {/* MODAL CONCLUIR ATENDIMENTO */}
      <WhatsAppActionsModal
        open={Boolean(whatsAppAppointment)}
        recipientName={whatsAppAppointment?.client_name || 'cliente'}
        onClose={() => setWhatsAppAppointment(null)}
        actions={whatsAppAppointment ? [
          { action: 'confirm', label: 'Confirmar horário', href: getAppointmentWhatsApp(whatsAppAppointment, 'confirm') },
          { action: 'reminder', label: 'Lembrar atendimento', href: getAppointmentWhatsApp(whatsAppAppointment, 'reminder') },
          { action: 'thanks', label: 'Agradecer atendimento', href: getAppointmentWhatsApp(whatsAppAppointment, 'thanks') },
          { action: 'inactive', label: 'Chamar cliente inativo', href: getAppointmentWhatsApp(whatsAppAppointment, 'inactive') },
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

                <div className="flex justify-between border-t border-slate-800/80 pt-2 font-bold">
                  <span className="text-slate-300">Total a Receber:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">R$ {completingApp.price.toFixed(2)}</span>
                </div>
              </div>

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

      {/* MODAL NOVO ATENDIMENTO */}
      {showModal && (
        <Modal label="Novo atendimento" onClose={() => setShowModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Novo Atendimento
              </h3>
              <button aria-label="Fechar janela" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-4 sm:mx-5 mt-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-4 sm:p-5 space-y-3.5">
                <div>
                  <label htmlFor="atendimentos-field-1" className="block text-xs font-semibold text-slate-300 mb-1">Nome do Cliente *</label>
                  <input id="atendimentos-field-1"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="atendimentos-field-2" className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp</label>
                  <input id="atendimentos-field-2"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(84) 99999-0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="atendimentos-field-3" className="block text-xs font-semibold text-slate-300 mb-1">Data *</label>
                  <input id="atendimentos-field-3"
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
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
                        Total: R$ {modalTotalPrice.toFixed(2)} ({modalTotalDuration} min)
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
                    <label htmlFor="atendimentos-field-4" className="block text-xs font-semibold text-slate-300 mb-1">Barbeiro *</label>
                    <select id="atendimentos-field-4"
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
                    <label htmlFor="atendimentos-field-5" className="block text-xs font-semibold text-slate-300 mb-1">Horário *</label>
                    <input id="atendimentos-field-5"
                      type="time"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-static-footer flex justify-end gap-2 p-4 sm:p-5 border-t border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
    </div>
  );
};
