import { Modal } from "../components/common/Modal";
import { useClipboard } from '../hooks/useClipboard';
import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, Plus, Scissors, CheckCircle, Clock, 
  X, Phone, Calendar, User, DollarSign, Share2, Copy, Check, MessageSquare, QrCode, CreditCard, Banknote, AlertCircle, UserRoundCheck, Play, Sparkles, TrendingUp, UserX, CheckCheck
} from 'lucide-react';
import { Appointment, Service, Barber, Organization, ProductSale } from '../types';
import { getLocalDateKey, isBookableBusinessDateTime, timeToMinutes } from '../utils/scheduling';
import { getClientBookingUrl } from '../config/urls';
import { appointmentStatusClasses, appointmentStatusLabel, blocksAppointmentSlot, isOpenAppointmentStatus } from '../utils/appointmentStatus';
import { buildAppointmentWhatsAppUrl, WhatsAppAction } from '../utils/whatsapp';
import { WhatsAppActionsModal } from '../components/common/WhatsAppActionsModal';

interface DashboardViewProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  services: Service[];
  barbers: Barber[];
  org: Organization;
  productSales?: ProductSale[];
  onNavigateToAgenda: () => void;
  onNavigateToServices: () => void;
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

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  appointments, 
  setAppointments,
  services,
  barbers,
  org,
  productSales = [],
  onNavigateToAgenda,
  onNavigateToServices,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [completingApp, setCompletingApp] = useState<Appointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'cash'>('pix');
  const { copied: copiedLink, error: copyError, copy } = useClipboard();
  const [modalError, setModalError] = useState('');
  const [whatsAppAppointment, setWhatsAppAppointment] = useState<Appointment | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState(barbers[0]?.id || '');
  const [startTime, setStartTime] = useState('14:00');

  const todayStr = useMemo(() => getLocalDateKey(), []);

  // Saudação de acordo com o horário atual
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bom dia', icon: '🌅' };
    if (hour < 18) return { text: 'Boa tarde', icon: '🌤️' };
    return { text: 'Boa noite', icon: '🌙' };
  }, []);

  // Data formatada em português
  const formattedDate = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    };
    const str = new Date().toLocaleDateString('pt-BR', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, []);

  // Cálculos das métricas do dia
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => (a.date || todayStr) === todayStr);
  }, [appointments, todayStr]);

  const todayCompleted = todayAppointments.filter(a => a.status === 'completed');
  const todayScheduled = todayAppointments.filter(a => isOpenAppointmentStatus(a.status));
  const todayProductSales = productSales.filter((sale) => sale.status === 'completed' && sale.date === todayStr);
  const totalEmCaixaHoje = todayCompleted.reduce((acc, curr) => acc + curr.price, 0) + todayProductSales.reduce((acc, curr) => acc + Number(curr.total || 0), 0);

  const now = new Date();
  const allScheduled = appointments
    .filter(a => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'arrived')
    .filter(a => {
      if (!a.date) return true;
      const value = new Date(`${a.date}T${a.start_time || '00:00'}:00`);
      return !Number.isNaN(value.getTime()) && value.getTime() >= now.getTime() - 60 * 60 * 1000;
    })
    .sort((a, b) => `${a.date || todayStr} ${a.start_time}`.localeCompare(`${b.date || todayStr} ${b.start_time}`));
  const proximoCliente = allScheduled[0];

  const publicLink = getClientBookingUrl(org.slug);

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

  const handleCopyPublicLink = () => {
    void copy(publicLink);
  };

  const toggleServiceSelection = (id: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFinishAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingApp) return;

    setAppointments(prev => prev.map(a => 
      a.id === completingApp.id ? { ...a, status: 'completed', payment_method: paymentMethod } : a
    ));
    setCompletingApp(null);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!clientName.trim() || selectedServiceIds.length === 0) return;

    const brb = barbers.find(b => b.id === selectedBarberId) || barbers[0];
    if (!brb) {
      alert('Cadastre ao menos um profissional nos ajustes.');
      return;
    }

    if (!isBookableBusinessDateTime(startTime, modalTotalDuration, todayStr, org)) {
      setModalError(`O horário das ${startTime} está fora do expediente, no intervalo ou em um período bloqueado pela barbearia.`);
      return;
    }

    // VERIFICAÇÃO DE HORÁRIO OCUPADO
    const occupied = isTimeSlotOccupied(
      startTime,
      modalTotalDuration,
      brb.id,
      todayStr,
      appointments
    );

    if (occupied) {
      setModalError(`O horário das ${startTime} hoje já está ocupado ou colide com outro agendamento para ${brb.full_name}.`);
      return;
    }

    const joinedNames = modalSelectedServices.map(s => s.name).join(' + ');

    const created: Appointment = {
      id: 'app-' + Date.now(),
      org_id: org.id,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || 'Não informado',
      service_id: modalSelectedServices[0]?.id || '',
      service_name: joinedNames || modalSelectedServices[0]?.name || 'Atendimento',
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
      start_time: startTime,
      price: modalTotalPrice,
      status: 'scheduled',
      date: todayStr,
      created_at: new Date().toISOString(),
    };

    setAppointments(prev => [created, ...prev]);
    setClientName('');
    setClientPhone('');
    setSelectedServiceIds([]);
    setShowModal(false);
  };

  const getAppointmentWhatsApp = (app: Appointment, action: WhatsAppAction) =>
    buildAppointmentWhatsAppUrl(org, app, action);

  return (
    <div className="app-view space-y-5 sm:space-y-7 xl:space-y-8 animate-fadeIn">
      {copyError && <p role="status" className="text-sm text-amber-500">{copyError}</p>}
      {/* BANNER SUPERIOR DE BOAS-VINDAS */}
      <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span aria-hidden="true">{greeting.icon}</span> {greeting.text}, {org.owner_name || org.name}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium truncate">
              {formattedDate} · Resumo da sua barbearia hoje.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleCopyPublicLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-emerald-500/40 text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 text-xs font-semibold transition-all shrink-0 active:scale-95 shadow-sm"
              title="Copiar link de agendamento do cliente"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copiado!' : 'Link Cliente'}
            </button>

            <button
              onClick={onNavigateToAgenda}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800 text-xs font-semibold transition-all shrink-0 active:scale-95"
            >
              Ver agenda <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SUB-CARDS DENTRO DO BANNER */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 mt-4 sm:mt-6">
          <div className="bg-[#0B1120]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm min-w-0">
            <p className="text-[9px] min-[380px]:text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              AGENDADOS HOJE
            </p>
            <p className="text-lg min-[380px]:text-xl sm:text-2xl xl:text-3xl font-black text-emerald-400 mt-1 tracking-tight font-mono leading-tight">
              {todayScheduled.length} <span className="text-[11px] sm:text-xs font-sans font-semibold text-slate-300">aguardando</span>
            </p>
          </div>

          <div className="bg-[#0B1120]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm min-w-0">
            <p className="text-[9px] min-[380px]:text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              PRÓXIMO CLIENTE
            </p>
            {proximoCliente ? (
              <div className="mt-1 min-w-0">
                <p className="text-xs min-[380px]:text-sm sm:text-base font-black text-white truncate">
                  {proximoCliente.client_name} <span className="text-emerald-400 font-mono text-[11px] sm:text-xs">({proximoCliente.start_time})</span>
                </p>
                <span className="block text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                  {proximoCliente.barber_name}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Nenhum pendente</p>
            )}
          </div>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS PRINCIPAIS (RESPONSIVOS NO CELULAR) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 xl:gap-5">
        {/* TOTAL EM CAIXA (HOJE) */}
        <div className="stagger-item booking-card bg-[#121B2E] border border-slate-800 rounded-2xl p-3 sm:p-5 xl:p-6 shadow-md min-w-0">
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            <span className="min-[380px]:hidden">FATURA</span>
            <span className="hidden min-[380px]:inline sm:hidden">FATURAMENTO</span>
            <span className="hidden sm:inline">FATURAMENTO HOJE</span>
          </p>
          <p className="text-lg min-[380px]:text-xl sm:text-3xl xl:text-4xl font-black text-emerald-400 font-mono mt-1 sm:mt-2 tracking-tight truncate">
            R$ {totalEmCaixaHoje.toFixed(0)}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 hidden sm:block truncate">{todayCompleted.length} serviços • {todayProductSales.length} produtos</p>
        </div>

        {/* ATENDIMENTOS DO DIA */}
        <div className="stagger-item booking-card bg-[#121B2E] border border-slate-800 rounded-2xl p-3 sm:p-5 xl:p-6 shadow-md min-w-0" style={{ animationDelay: '40ms' }}>
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            <span className="sm:hidden">ATENDIMENTOS</span>
            <span className="hidden sm:inline">ATENDIMENTOS DO DIA</span>
          </p>
          <p className="text-lg min-[380px]:text-xl sm:text-3xl xl:text-4xl font-black text-white font-mono mt-1 sm:mt-2 tracking-tight">
            {todayAppointments.length}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 hidden sm:block truncate">{todayScheduled.length} agendados</p>
        </div>

        {/* TOTAL AGENDAMENTOS PENDENTES */}
        <div className="stagger-item booking-card bg-[#121B2E] border border-slate-800 rounded-2xl p-3 sm:p-5 xl:p-6 shadow-md min-w-0" style={{ animationDelay: '80ms' }}>
          <p className="text-[8px] min-[380px]:text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            EM ABERTO
          </p>
          <p className="text-lg min-[380px]:text-xl sm:text-3xl xl:text-4xl font-black text-amber-400 font-mono mt-1 sm:mt-2 tracking-tight">
            {allScheduled.length}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 hidden sm:block">geral</p>
        </div>
      </div>

      {/* SEÇÃO: ATENDIMENTOS DA BARBEARIA */}
      <div className="space-y-3.5 pt-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">
              Atendimentos Recentes
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (services.length === 0 || barbers.length === 0) {
                  alert('Cadastre serviços e profissionais nos ajustes antes de iniciar um atendimento.');
                } else {
                  setSelectedServiceIds(services[0] ? [services[0].id] : []);
                  setSelectedBarberId(barbers[0]?.id || '');
                  setModalError('');
                  setShowModal(true);
                }
              }}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Novo atendimento</span>
            </button>
          </div>
        </div>

        {/* LISTA DE ATENDIMENTOS */}
        <div className="rounded-3xl">
          {appointments.length === 0 ? (
            <div className="bg-[#121B2E] border border-slate-800 rounded-3xl shadow-lg p-8 sm:p-12 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-base">Nenhum atendimento registrado</h4>
              <p className="text-xs text-slate-400">
                Compartilhe o seu link público com os clientes ou lance um novo atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-3.5">
              {appointments.slice(0, 15).map((app, index) => {
                const isToday = (app.date || todayStr) === todayStr;
                const formattedDateBadge = isToday ? 'HOJE' : new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                return (
                  <div 
                    key={app.id}
                    style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                    className="stagger-item appointment-person-card bg-[#121B2E] border border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-6 shadow-md transition-all space-y-2 sm:space-y-0"
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
                        <div className="flex flex-wrap items-center gap-1.5 justify-end">
                          {(app.status === 'scheduled' || app.status === 'confirmed') && (
                            <button
                              onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'arrived' } : a))}
                              className="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/20 text-cyan-300 rounded-xl text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-colors active:scale-95"
                            ><UserRoundCheck className="w-3 h-3" /> Chegou</button>
                          )}
                          {app.status === 'arrived' && (
                            <button
                              onClick={() => setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'in_progress' } : a))}
                              className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 text-blue-300 rounded-xl text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-colors active:scale-95"
                            ><Play className="w-3 h-3" /> Iniciar</button>
                          )}
                          {app.status === 'in_progress' && (
                            <button
                              onClick={() => setCompletingApp(app)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 active:scale-95 shadow-sm"
                            ><CheckCircle className="w-3 h-3" /> Finalizar</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CONCLUIR ATENDIMENTO (BOTTOM SHEET NO CELULAR) */}
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
              <button aria-label="Fechar janela" onClick={() => setCompletingApp(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
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
                Confirmar e Concluir
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL NOVO ATENDIMENTO (BOTTOM SHEET NO CELULAR) */}
      {showModal && (
        <Modal label="Novo agendamento" onClose={() => setShowModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Novo Atendimento
              </h3>
              <button aria-label="Fechar janela" 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-4 sm:mx-5 mt-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-4 sm:p-5 space-y-3.5">
                <div>
                  <label htmlFor="dashboard-field-1" className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Cliente *
                  </label>
                  <input id="dashboard-field-1"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="dashboard-field-2" className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp do Cliente
                  </label>
                  <input id="dashboard-field-2"
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
                    <label htmlFor="dashboard-field-3" className="block text-xs font-semibold text-slate-300 mb-1">
                      Barbeiro *
                    </label>
                    <select id="dashboard-field-3"
                      value={selectedBarberId}
                      onChange={(e) => setSelectedBarberId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {barbers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="dashboard-field-4" className="block text-xs font-semibold text-slate-300 mb-1">
                      Horário *
                    </label>
                    <input id="dashboard-field-4"
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
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
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors disabled:opacity-50 active:scale-95"
                >
                  Confirmar (R$ {modalTotalPrice.toFixed(2)})
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
