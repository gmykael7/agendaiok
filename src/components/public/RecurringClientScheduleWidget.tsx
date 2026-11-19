import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  XCircle,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  ChevronRight,
  ArrowRight,
  Check,
  ChevronDown
} from 'lucide-react';
import type { Barber, Organization, RecurringSchedule, Service, Appointment } from '../../types';
import { formatPhoneBR } from '../../utils/whatsapp';
import { normalizePhoneOnlyDigits, getDayOfWeekLabel, getFrequencyLabel, RecurringOccurrence } from '../../utils/recurringSchedules';
import { generateBusinessSlots, isBookableBusinessDateTime, timeToMinutes } from '../../utils/scheduling';
import { isPublicTimeSlotOccupied } from '../../utils/publicBookingAvailability';

interface RecurringClientScheduleWidgetProps {
  org: Organization;
  services: Service[];
  barbers: Barber[];
  appointments: Appointment[];
  recurringSchedules?: RecurringSchedule[];
  onRefreshData?: () => Promise<void> | void;
  clientPhone?: string;
  clientName?: string;
}

const STORAGE_KEY_PHONE = 'agendai_client_phone';
const STORAGE_KEY_NAME = 'agendai_client_name';
const STORAGE_KEY_PROFILE = 'agendai_client_profile';

const QUICK_REASONS = [
  'Imprevisto no trabalho',
  'Viagem',
  'Compromisso familiar',
  'Saúde',
  'Outro',
];

export const RecurringClientScheduleWidget: React.FC<RecurringClientScheduleWidgetProps> = ({
  org,
  services,
  barbers,
  appointments,
  recurringSchedules = [],
  onRefreshData,
  clientPhone,
  clientName,
}) => {
  // Estado do cliente identificado
  const [identifiedPhone, setIdentifiedPhone] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const phone = localStorage.getItem(STORAGE_KEY_PHONE) || '';
    if (phone) return phone;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        return typeof parsed?.phone === 'string' ? parsed.phone.replace(/\D/g, '') : '';
      }
    } catch {}
    return '';
  });
  const [identifiedName, setIdentifiedName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const name = localStorage.getItem(STORAGE_KEY_NAME) || '';
    if (name) return name;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        return typeof parsed?.name === 'string' ? parsed.name : '';
      }
    } catch {}
    return '';
  });

  // Modo de formulário de identificação (aberto se não houver telefone salvo)
  const [showIdentityForm, setShowIdentityForm] = useState<boolean>(!identifiedPhone);
  const [inputName, setInputName] = useState(identifiedName);
  const [inputPhone, setInputPhone] = useState(identifiedPhone ? formatPhoneBR(identifiedPhone) : '');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identityError, setIdentityError] = useState('');

  // Dados carregados do cliente
  const [clientSchedules, setClientSchedules] = useState<any[]>([]);
  const [upcomingOccurrences, setUpcomingOccurrences] = useState<any[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  // Modais de ação
  const [cancelModalOccurrence, setCancelModalOccurrence] = useState<RecurringOccurrence | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Imprevisto no trabalho');
  const [cancelCustomNote, setCancelCustomNote] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);
  const [cancelMessage, setCancelMessage] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');
  const [cancelSuccessSummary, setCancelSuccessSummary] = useState<{
    original_date: string;
    original_time: string;
    professional_name: string;
    next_recurring_date?: string;
  } | null>(null);

  const [rescheduleModalOccurrence, setRescheduleModalOccurrence] = useState<RecurringOccurrence | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState<string>('Imprevisto no horário habitual');
  const [rescheduleSelectedDate, setRescheduleSelectedDate] = useState<string>('');
  const [rescheduleSelectedTime, setRescheduleSelectedTime] = useState<string>('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState<boolean>(false);
  const [rescheduleSuccessMsg, setRescheduleSuccessMsg] = useState<string>('');
  const [rescheduleError, setRescheduleError] = useState<string>('');
  const [rescheduleSuccessSummary, setRescheduleSuccessSummary] = useState<{
    original_date: string;
    original_time: string;
    new_date: string;
    new_time: string;
    professional_name: string;
  } | null>(null);

  // Carrega contratos e próximas datas do cliente
  const loadClientSchedule = useCallback(async (phone: string) => {
    const clean = normalizePhoneOnlyDigits(phone);
    if (!clean) return;

    setIsLoadingSchedules(true);
    try {
      const res = await fetch(`/api/public/client-schedule?tenantId=${encodeURIComponent(org.slug || org.id)}&phone=${clean}`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) {
          setClientSchedules(data.schedules || []);
          setUpcomingOccurrences(data.upcoming || []);
          if (data.client_name && !identifiedName) {
            setIdentifiedName(data.client_name);
            localStorage.setItem(STORAGE_KEY_NAME, data.client_name);
          }
        }
      }
    } catch (err) {
      console.warn('Falha ao consultar agenda do cliente fixo:', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, [org.slug, org.id, identifiedName]);

  // Carrega ao montar se já tiver telefone salvo
  useEffect(() => {
    if (identifiedPhone) {
      loadClientSchedule(identifiedPhone);
    }
  }, [identifiedPhone, loadClientSchedule]);

  // Salvar identificação do cliente
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityError('');

    const clean = normalizePhoneOnlyDigits(inputPhone);
    if (clean.length < 10) {
      setIdentityError('Informe seu WhatsApp completo com DDD (ex: 84 99999-0000).');
      return;
    }

    setIsIdentifying(true);
    try {
      const res = await fetch('/api/public/client-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: org.slug || org.id,
          phone: clean,
          name: inputName.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) {
          setIdentifiedPhone(clean);
          setIdentifiedName(inputName.trim() || data.client_name || '');
          localStorage.setItem(STORAGE_KEY_PHONE, clean);
          if (inputName.trim() || data.client_name) {
            localStorage.setItem(STORAGE_KEY_NAME, inputName.trim() || data.client_name);
          }
          localStorage.setItem(
            STORAGE_KEY_PROFILE,
            JSON.stringify({ name: inputName.trim() || data.client_name, phone: clean })
          );
          setClientSchedules(data.schedules || []);
          setUpcomingOccurrences(data.upcoming || []);
          setShowIdentityForm(false);
        }
      } else {
        const errData = await res.json().catch(() => ({})) as any;
        setIdentityError(errData.error || 'Não foi possível consultar seus horários.');
      }
    } catch {
      setIdentityError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setIsIdentifying(false);
    }
  };

  // Trocar de telefone/identificação
  const handleSwitchIdentity = () => {
    setShowIdentityForm(true);
    setInputPhone(identifiedPhone ? formatPhoneBR(identifiedPhone) : '');
    setInputName(identifiedName);
  };

  // Confirmação de Cancelamento
  const handleConfirmCancel = async () => {
    if (!cancelModalOccurrence) return;
    const finalReason = cancelReason === 'Outro'
      ? (cancelCustomNote.trim() || 'Outro motivo')
      : (cancelCustomNote.trim() ? `${cancelReason}: ${cancelCustomNote.trim()}` : cancelReason);

    if (!finalReason.trim()) {
      setCancelError('Por favor, informe o motivo do cancelamento.');
      return;
    }

    setIsSubmittingCancel(true);
    setCancelError('');
    try {
      const res = await fetch('/api/public/recurring/cancel-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: org.slug || org.id,
          recurring_id: cancelModalOccurrence.schedule_id,
          target_date: cancelModalOccurrence.date,
          cancellation_feedback: finalReason,
        }),
      });

      const data = await res.json() as any;
      if (res.ok && data.success) {
        const barberName = barbers.find(b => b.id === cancelModalOccurrence.professional_id)?.full_name || 'Profissional';
        setCancelSuccessSummary(data.summary || {
          original_date: cancelModalOccurrence.date.split('-').reverse().join('/'),
          original_time: cancelModalOccurrence.start_time,
          professional_name: barberName,
          next_recurring_date: data.summary?.next_recurring_date,
          barber_notified: true,
        });
        setCancelMessage(data.message || 'Horário liberado com sucesso para esta semana.');
        if (onRefreshData) await onRefreshData();
        await loadClientSchedule(identifiedPhone);
      } else {
        setCancelError(data.error || 'Falha ao liberar horário.');
      }
    } catch {
      setCancelError('Erro ao comunicar com o servidor.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Preparar Remarcação
  const handleOpenReschedule = (occ: RecurringOccurrence) => {
    setRescheduleModalOccurrence(occ);
    setRescheduleReason('Imprevisto no horário habitual');
    setRescheduleSelectedDate('');
    setRescheduleSelectedTime('');
    setRescheduleError('');
    setRescheduleSuccessMsg('');
    setRescheduleSuccessSummary(null);
  };

  // Gerar dias disponíveis para remarcação (próximos 14 dias a partir de hoje)
  const availableRescheduleDays = useMemo(() => {
    if (!rescheduleModalOccurrence) return [];
    const days: { dateStr: string; label: string; weekday: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const weekday = getDayOfWeekLabel(d.getDay(), true);
      const label = `${day}/${m}`;
      days.push({ dateStr, label, weekday });
    }
    return days;
  }, [rescheduleModalOccurrence]);

  // Horários disponíveis para a data selecionada na remarcação
  const availableRescheduleSlots = useMemo(() => {
    if (!rescheduleModalOccurrence || !rescheduleSelectedDate) return [];
    const profId = rescheduleModalOccurrence.professional_id;
    const srv = services.find((s) => s.id === rescheduleModalOccurrence.service_id);
    const duration = srv?.duration_minutes || 30;

    const allSlots = generateBusinessSlots(org, duration, 30);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return allSlots.filter((time) => {
      if (rescheduleSelectedDate === todayStr && timeToMinutes(time) <= nowMinutes) return false;
      if (!isBookableBusinessDateTime(time, duration, rescheduleSelectedDate, org)) return false;
      // Exclui o próprio agendamento atual se for no mesmo dia/hora
      const isOccupied = isPublicTimeSlotOccupied(
        time,
        duration,
        profId,
        rescheduleSelectedDate,
        appointments,
        rescheduleModalOccurrence.appointment_id,
        recurringSchedules,
        services
      );
      return !isOccupied;
    });
  }, [
    rescheduleModalOccurrence,
    rescheduleSelectedDate,
    services,
    org,
    appointments,
    recurringSchedules,
  ]);

  // Confirmação de Remarcação
  const handleConfirmReschedule = async () => {
    if (!rescheduleModalOccurrence || !rescheduleSelectedDate || !rescheduleSelectedTime) {
      setRescheduleError('Selecione uma data e um horário livre para remarcar.');
      return;
    }

    const finalReason = rescheduleReason.trim() || 'Remarcação na semana';
    setIsSubmittingReschedule(true);
    setRescheduleError('');

    try {
      const res = await fetch('/api/public/recurring/reschedule-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: org.slug || org.id,
          recurring_id: rescheduleModalOccurrence.schedule_id,
          original_date: `${rescheduleModalOccurrence.date} ${rescheduleModalOccurrence.start_time}`,
          new_date: rescheduleSelectedDate,
          new_time: rescheduleSelectedTime,
          cancellation_feedback: finalReason,
        }),
      });

      const data = await res.json() as any;
      if (res.ok && data.success) {
        const barberName = barbers.find(b => b.id === rescheduleModalOccurrence.professional_id)?.full_name || 'Profissional';
        setRescheduleSuccessSummary(data.summary || {
          original_date: rescheduleModalOccurrence.date.split('-').reverse().join('/'),
          original_time: rescheduleModalOccurrence.start_time,
          new_date: rescheduleSelectedDate.split('-').reverse().join('/'),
          new_time: rescheduleSelectedTime,
          professional_name: barberName,
          barber_notified: true,
        });
        setRescheduleSuccessMsg(data.message || 'Horário remarcado com sucesso!');
        if (onRefreshData) await onRefreshData();
        await loadClientSchedule(identifiedPhone);
      } else {
        setRescheduleError(data.error || 'Não foi possível remarcar.');
      }
    } catch {
      setRescheduleError('Erro ao comunicar com o servidor.');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // Se o cliente não tiver contratos ativos, não exibe nada
  // (a identificação e cadastro do cliente já são gerenciados pelo card principal da página pública)
  const hasActiveContracts = clientSchedules.length > 0;
  if (!hasActiveContracts) {
    return null;
  }

  return (
    <div className="mx-4 sm:mx-6 mt-4 space-y-3">
      {/* CARD DESTAQUE: MEU HORÁRIO FIXO */}
      <div className="space-y-3">
          {clientSchedules.map((schedule) => {
            const freqLabel = getFrequencyLabel(schedule.frequency);
            const dayLabel = getDayOfWeekLabel(schedule.day_of_week);
            const nextOcc = upcomingOccurrences.find((o) => o.schedule_id === schedule.id && o.status !== 'canceled');
            const isCurrentWeekRescheduled = nextOcc?.status === 'rescheduled';

            return (
              <div
                key={schedule.id}
                className="recurring-hero-card rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-[#0B1526] via-[#091D1E] to-[#0B1120] p-4 sm:p-5 shadow-xl shadow-emerald-950/20 relative overflow-hidden"
              >
                {/* Efeito Glow no fundo */}
                <div className="recurring-glow absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Cabeçalho do Card */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="recurring-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-emerald-400/20 border border-amber-400/40 text-[11px] font-black text-amber-300 tracking-wide">
                      ⭐ Cliente Fixo ({freqLabel})
                    </span>
                    <span className="recurring-status-text text-[10px] text-slate-400 font-medium hidden sm:inline">
                      Horário reservado
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchIdentity}
                    className="recurring-switch-btn text-[10px] text-slate-400 hover:text-white underline font-mono"
                  >
                    {formatPhoneBR(identifiedPhone)} (Trocar)
                  </button>
                </div>

                {/* Detalhes da Assinatura / Horário Habitual */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="recurring-subcard rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5">
                    <p className="recurring-label text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Dia habitual
                    </p>
                    <p className="recurring-value text-xs sm:text-sm font-black text-white mt-0.5">
                      Toda {dayLabel}
                    </p>
                    <p className="recurring-accent text-[11px] font-mono text-emerald-400 font-bold">
                      às {schedule.start_time}
                    </p>
                  </div>

                  <div className="recurring-subcard rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5">
                    <p className="recurring-label text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Profissional
                    </p>
                    <p className="recurring-value text-xs sm:text-sm font-black text-white mt-0.5 truncate">
                      {schedule.professional_name || 'Barbeiro'}
                    </p>
                    <p className="recurring-muted text-[11px] text-slate-400 truncate">
                      {schedule.service_name || 'Serviço'}
                    </p>
                  </div>

                  <div className="recurring-subcard col-span-2 sm:col-span-1 rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5">
                    <p className="recurring-label text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Próxima Vaga
                    </p>
                    {nextOcc ? (
                      <div>
                        <p className="recurring-accent text-xs sm:text-sm font-black text-emerald-300 mt-0.5">
                          {nextOcc.date.split('-').reverse().join('/')} às {nextOcc.start_time}
                        </p>
                        {isCurrentWeekRescheduled && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                            🔄 Remarcado na semana
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="recurring-muted text-xs font-bold text-slate-400 mt-0.5">
                        Consultando...
                      </p>
                    )}
                  </div>
                </div>

                {/* Bloco de Ações do Próximo Atendimento */}
                {nextOcc && (
                  <div className="recurring-actions-bar mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <p className="recurring-prompt-text text-[11px] text-slate-300 text-center sm:text-left">
                      Precisa alterar o atendimento de{' '}
                      <strong className="recurring-prompt-date text-white">
                        {nextOcc.date.split('-').reverse().join('/')}
                      </strong>
                      ?
                    </p>
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleOpenReschedule(nextOcc)}
                        className="recurring-btn-reschedule rounded-xl border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-bold px-3 py-2 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Remarcar semana</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalOccurrence(nextOcc);
                          setCancelReason('Imprevisto no trabalho');
                          setCancelCustomNote('');
                          setCancelError('');
                          setCancelMessage('');
                          setCancelSuccessSummary(null);
                        }}
                        className="recurring-btn-cancel rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-bold px-3 py-2 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Não poderei ir</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* HISTÓRICO / PRÓXIMAS 4 SEMANAS EM LISTA EXPANSÍVEL */}
          {upcomingOccurrences.length > 1 && (
            <div className="recurring-history-card rounded-2xl border border-slate-800 bg-[#0B1120] p-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Próximos atendimentos garantidos
              </h4>
              <div className="space-y-2">
                {upcomingOccurrences.map((occ, idx) => {
                  const [y, m, d] = occ.date.split('-');
                  const isCanceled = occ.status === 'canceled';
                  const isRescheduled = occ.status === 'rescheduled';

                  return (
                    <div
                      key={`${occ.schedule_id}-${occ.date}-${idx}`}
                      className={`recurring-history-row rounded-xl border p-2.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                        isCanceled
                          ? 'border-rose-900/40 bg-rose-950/20 text-rose-300'
                          : isRescheduled
                          ? 'border-amber-900/40 bg-amber-950/20 text-amber-200'
                          : 'border-slate-800 bg-slate-900/50 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="recurring-history-date font-mono font-bold text-white">
                          {d}/{m}
                        </span>
                        <span className="recurring-history-meta text-slate-400 font-mono text-[11px]">
                          às {occ.start_time}
                        </span>
                        <span className="recurring-history-meta text-slate-400 truncate">
                          • {occ.professional_name || 'Barbeiro'}
                        </span>
                      </div>
                      <div className="shrink-0">
                        {isCanceled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" /> Vaga liberada
                          </span>
                        ) : isRescheduled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            <RefreshCw className="w-3 h-3" /> Remarcado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            <Check className="w-3 h-3" /> Confirmado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CANCELAMENTO DA SEMANA COM FEEDBACK OBRIGATÓRIO                    */}
      {/* ========================================================================= */}
      {cancelModalOccurrence && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="recurring-modal-sheet w-full max-w-lg rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#0B1120] p-5 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            {cancelSuccessSummary ? (
              <div className="py-2 space-y-4 animate-in zoom-in-95 duration-200 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">Horário liberado com sucesso!</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    O profissional <strong className="text-slate-900 dark:text-white">{cancelSuccessSummary.professional_name}</strong> já recebeu seu feedback.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#070B14] p-3.5 text-left text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Vaga liberada:</span>
                    <strong className="text-rose-600 dark:text-rose-300">{cancelSuccessSummary.original_date} às {cancelSuccessSummary.original_time}</strong>
                  </div>
                  {cancelSuccessSummary.next_recurring_date && (
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                      <span className="text-slate-500 dark:text-slate-400">Próximo horário garantido:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{cancelSuccessSummary.next_recurring_date} às {cancelSuccessSummary.original_time}</strong>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Seu plano de Cliente Fixo segue 100% ativo!</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalOccurrence(null);
                    setCancelSuccessSummary(null);
                    setCancelMessage('');
                  }}
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-2.5 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  Entendido, fechar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <XCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Não poderei ir esta semana
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Data:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {cancelModalOccurrence.date.split('-').reverse().join('/')}
                        </strong>{' '}
                        às <strong className="text-slate-900 dark:text-white">{cancelModalOccurrence.start_time}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCancelModalOccurrence(null)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Aviso tranquilizador */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Você está liberando <strong>apenas o horário do dia{' '}
                    {cancelModalOccurrence.date.split('-').reverse().join('/')}</strong> para outro cliente da barbearia agendar. Seu horário fixo das próximas semanas continua <strong>100% garantido!</strong>
                  </p>
                </div>

                {/* Motivo Obrigatório com Chips Rápidos */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Qual o motivo do cancelamento? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REASONS.map((r) => {
                      const isSelected = cancelReason === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setCancelReason(r)}
                          className={`recurring-chip-btn ${isSelected ? 'is-active' : ''} rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-200'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    rows={2}
                    value={cancelCustomNote}
                    onChange={(e) => setCancelCustomNote(e.target.value)}
                    placeholder="Observação ou mensagem para a barbearia (opcional)..."
                    className="w-full mt-2 rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white dark:placeholder-slate-600"
                  />
                </div>

                {cancelError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{cancelError}</span>
                  </div>
                )}

                {cancelMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{cancelMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCancelModalOccurrence(null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingCancel}
                    onClick={handleConfirmCancel}
                    className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSubmittingCancel ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Liberando...
                      </>
                    ) : (
                      <>
                        <span>Confirmar liberação</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REMARCAÇÃO NA AGENDA ABERTA                                        */}
      {/* ========================================================================= */}
      {rescheduleModalOccurrence && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="recurring-modal-sheet w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#0B1120] p-5 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            {rescheduleSuccessSummary ? (
              <div className="py-2 space-y-4 animate-in zoom-in-95 duration-200 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:bg-cyan-500/20 dark:border-cyan-500/40 dark:text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">Troca de horário confirmada!</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    O profissional <strong className="text-slate-900 dark:text-white">{rescheduleSuccessSummary.professional_name}</strong> já foi avisado e sua vaga original foi liberada na agenda.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#070B14] p-3.5 text-left text-xs space-y-2.5">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Horário anterior (liberado):</span>
                    <strong className="text-slate-500 dark:text-slate-400 line-through">{rescheduleSuccessSummary.original_date} às {rescheduleSuccessSummary.original_time}</strong>
                  </div>
                  <div className="flex items-center justify-between text-cyan-800 dark:text-cyan-200 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Novo horário reservado:</span>
                    <strong className="text-cyan-700 dark:text-cyan-300 font-bold">{rescheduleSuccessSummary.new_date} às {rescheduleSuccessSummary.new_time}</strong>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-cyan-700 dark:text-cyan-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Excepcionalmente nesta semana. Na próxima, seu horário fixo padrão volta ao normal!</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleModalOccurrence(null);
                    setRescheduleSuccessSummary(null);
                    setRescheduleSuccessMsg('');
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black text-xs py-2.5 transition-all shadow-lg shadow-cyan-400/20 active:scale-95"
                >
                  Entendido, fechar
                </button>
              </div>
            ) : (
              <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:bg-cyan-500/15 dark:border-cyan-500/30 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Remarcar esta semana
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Horário original:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {rescheduleModalOccurrence.date.split('-').reverse().join('/')}
                    </strong>{' '}
                    às <strong className="text-slate-900 dark:text-white">{rescheduleModalOccurrence.start_time}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalOccurrence(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Aviso */}
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/20 p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-xs text-cyan-900 dark:text-cyan-200 leading-relaxed">
                Escolha qualquer dia e horário livre na agenda do profissional. O horário original será liberado para outros clientes e, na semana seguinte, seu horário fixo habitual continua normal.
              </p>
            </div>

            {/* Motivo da Troca */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Motivo da remarcação <span className="text-cyan-500">*</span>
              </label>
              <input
                type="text"
                required
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Ex: Reunião de trabalho, compromisso pessoal..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white dark:placeholder-slate-600"
              />
            </div>

            {/* 1. Escolha do Novo Dia */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                <span>1. Escolha o novo dia:</span>
                {rescheduleSelectedDate && (
                  <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300">
                    {rescheduleSelectedDate.split('-').reverse().join('/')}
                  </span>
                )}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mask-scroll-x">
                {availableRescheduleDays.map((d) => {
                  const isSelected = rescheduleSelectedDate === d.dateStr;
                  const isOriginal = d.dateStr === rescheduleModalOccurrence.date;

                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => {
                        setRescheduleSelectedDate(d.dateStr);
                        setRescheduleSelectedTime('');
                      }}
                      className={`recurring-day-btn ${isSelected ? 'is-selected' : ''} min-w-[62px] flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-900 shadow-md shadow-cyan-500/20 dark:border-cyan-400 dark:bg-cyan-500/25 dark:text-white'
                          : isOriginal
                          ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase">{d.weekday}</span>
                      <span className="text-xs font-black mt-0.5">{d.label}</span>
                      {isOriginal && (
                        <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase">Atual</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Escolha do Novo Horário */}
            {rescheduleSelectedDate && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  2. Horários disponíveis com{' '}
                  <span className="text-cyan-600 dark:text-cyan-300">
                    {barbers.find(b => b.id === rescheduleModalOccurrence.professional_id)?.full_name || 'o barbeiro'}
                  </span>:
                </label>
                {availableRescheduleSlots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-transparent">
                    Nenhum horário livre nesta data. Por favor, escolha outro dia acima.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                    {availableRescheduleSlots.map((time) => {
                      const isSelected = rescheduleSelectedTime === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setRescheduleSelectedTime(time)}
                          className={`recurring-slot-btn ${isSelected ? 'is-selected' : ''} rounded-xl py-2 px-1 text-center font-mono text-xs font-bold border transition-all ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-500 text-white font-black shadow-md shadow-cyan-500/20 dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-950'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Preview da Alteração */}
            {rescheduleSelectedDate && rescheduleSelectedTime && (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/30 p-3 text-xs text-cyan-900 dark:text-cyan-200 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    Novo horário escolhido
                  </p>
                  <p className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                    {rescheduleSelectedDate.split('-').reverse().join('/')} às {rescheduleSelectedTime}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
              </div>
            )}

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            {rescheduleSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{rescheduleSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRescheduleModalOccurrence(null)}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingReschedule || !rescheduleSelectedDate || !rescheduleSelectedTime}
                onClick={handleConfirmReschedule}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs py-2.5 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                {isSubmittingReschedule ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Remarcando...
                  </>
                ) : (
                  <>
                    <span>Confirmar remarcação</span>
                  </>
                )}
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
