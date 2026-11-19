import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  User,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Search,
  Check,
  X,
  MessageSquare
} from 'lucide-react';
import type { Barber, Organization, RecurringFrequency, RecurringSchedule, RecurringStatus, Service, Client } from '../../types';
import { formatPhoneBR, buildWhatsAppUrl } from '../../utils/whatsapp';
import { getAuthToken } from '../../services/cloudSync';
import {
  DAY_NAMES,
  getDayOfWeekLabel,
  getFrequencyLabel,
  hasRecurringConflict,
  normalizePhoneOnlyDigits
} from '../../utils/recurringSchedules';

interface AdminRecurringSchedulesManagerProps {
  org: Organization;
  setOrg?: React.Dispatch<React.SetStateAction<Organization>>;
  recurringSchedules: RecurringSchedule[];
  setRecurringSchedules: React.Dispatch<React.SetStateAction<RecurringSchedule[]>>;
  barbers: Barber[];
  services: Service[];
  clients?: Client[];
  appointments?: any[];
}

export const AdminRecurringSchedulesManager: React.FC<AdminRecurringSchedulesManagerProps> = ({
  org,
  setOrg,
  recurringSchedules,
  setRecurringSchedules,
  barbers,
  services,
  clients = [],
  appointments = [],
}) => {
  const [filterFrequency, setFilterFrequency] = useState<'ALL' | 'WEEKLY' | 'BIWEEKLY'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [search, setSearch] = useState('');

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringSchedule | null>(null);

  // Campos do formulário
  const [formClientName, setFormClientName] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formBarberId, setFormBarberId] = useState(barbers[0]?.id || '');
  const [formServiceId, setFormServiceId] = useState(services[0]?.id || '');
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(5); // Sexta padrão
  const [formStartTime, setFormStartTime] = useState('14:00');
  const [formFrequency, setFormFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [formAnchorDate, setFormAnchorDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lista filtrada
  const filteredSchedules = useMemo(() => {
    return recurringSchedules.filter((s) => {
      if (filterFrequency !== 'ALL' && s.frequency !== filterFrequency) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const nameMatch = s.client_name.toLowerCase().includes(query);
        const phoneMatch = s.client_phone.includes(query);
        if (!nameMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [recurringSchedules, filterFrequency, filterStatus, search]);

  const activeWeeklyCount = useMemo(() => {
    return recurringSchedules.filter((s) => s.status === 'ACTIVE' && s.frequency === 'WEEKLY').length;
  }, [recurringSchedules]);

  const activeBiweeklyCount = useMemo(() => {
    return recurringSchedules.filter((s) => s.status === 'ACTIVE' && s.frequency === 'BIWEEKLY').length;
  }, [recurringSchedules]);

  // Abrir modal de criação
  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setFormClientName('');
    setFormClientPhone('');
    setFormBarberId(barbers[0]?.id || '');
    setFormServiceId(services[0]?.id || '');
    setFormDayOfWeek(5);
    setFormStartTime('14:00');
    setFormFrequency('WEEKLY');
    setFormAnchorDate(new Date().toISOString().split('T')[0]);
    setFormError('');
    setIsModalOpen(true);
  };

  // Abrir modal de edição
  const handleOpenEdit = (schedule: RecurringSchedule) => {
    setEditingSchedule(schedule);
    setFormClientName(schedule.client_name);
    setFormClientPhone(formatPhoneBR(schedule.client_phone));
    setFormBarberId(schedule.professional_id);
    setFormServiceId(schedule.service_id);
    setFormDayOfWeek(schedule.day_of_week);
    setFormStartTime(schedule.start_time);
    setFormFrequency(schedule.frequency);
    setFormAnchorDate(schedule.anchor_date);
    setFormError('');
    setIsModalOpen(true);
  };

  // Alternar pausa / reativação
  const handleTogglePause = async (schedule: RecurringSchedule) => {
    const nextStatus: RecurringStatus = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/recurring-schedules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: schedule.id, status: nextStatus }),
      });
      if (res.ok) {
        setRecurringSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? { ...s, status: nextStatus } : s))
        );
      }
    } catch (e) {
      console.warn('Erro ao atualizar status:', e);
    }
  };

  // Remover contrato
  const handleDelete = async (schedule: RecurringSchedule) => {
    if (!window.confirm(`Tem certeza que deseja remover o cliente fixo ${schedule.client_name}?`)) {
      return;
    }
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/recurring-schedules?id=${schedule.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setRecurringSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
      }
    } catch (e) {
      console.warn('Erro ao deletar:', e);
    }
  };

  // Salvar formulário
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = normalizePhoneOnlyDigits(formClientPhone);
    if (!formClientName.trim() || cleanPhone.length < 10) {
      setFormError('Informe o nome e o WhatsApp completo do cliente.');
      return;
    }

    // Checagem de conflitos
    const candidate = {
      tenant_id: org.id,
      client_name: formClientName.trim(),
      client_phone: cleanPhone,
      professional_id: formBarberId,
      service_id: formServiceId,
      day_of_week: formDayOfWeek,
      start_time: formStartTime,
      frequency: formFrequency,
      anchor_date: formAnchorDate,
      status: 'ACTIVE' as RecurringStatus,
    };

    const conflict = hasRecurringConflict(
      candidate,
      recurringSchedules,
      appointments,
      services,
      editingSchedule?.id
    );

    if (conflict.hasConflict) {
      setFormError(conflict.reason || 'Conflito detectado com outro horário.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = Boolean(editingSchedule);
      const url = '/api/admin/recurring-schedules';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit ? { ...candidate, id: editingSchedule!.id } : candidate;

      const token = getAuthToken();
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as any;
      if (res.ok && data.success) {
        const savedSchedule: RecurringSchedule = data.schedule || {
          ...candidate,
          id: editingSchedule?.id || `rec-${Date.now()}`,
          created_at: new Date().toISOString(),
        };

        setRecurringSchedules((prev) => {
          if (isEdit) {
            return prev.map((s) => (s.id === savedSchedule.id ? savedSchedule : s));
          }
          return [savedSchedule, ...prev];
        });

        setIsModalOpen(false);
      } else {
        setFormError(data.error || 'Falha ao salvar cliente fixo.');
      }
    } catch {
      setFormError('Erro ao comunicar com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com métricas e botão de criar */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121B2E] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Clientes Fixos (Recorrência)</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Horários semanais e quinzenais garantidos sem criar reservas infinitas no banco.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              🔁 {activeWeeklyCount} Semanais
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
              🔁 {activeBiweeklyCount} Quinzenais
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-4 py-2.5 flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/15 active:scale-95"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Novo Cliente Fixo</span>
        </button>
      </div>

      {/* CONFIGURAÇÃO DE NOTIFICAÇÕES VIA WHATSAPP */}
      <div className="recurring-subcard rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0B1526] p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Notificações Automáticas de Clientes Fixos</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Mensagens e alertas automáticos via WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/90 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/60 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={org.recurring_whatsapp_notify_client !== false}
              onChange={(e) => {
                if (setOrg) {
                  setOrg(prev => ({
                    ...prev,
                    recurring_whatsapp_notify_client: e.target.checked,
                  }));
                }
              }}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-purple-600 focus:ring-purple-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-white block">Enviar confirmação no WhatsApp do cliente ao cancelar/remarcar horário fixo</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                O cliente recebe aviso com o cancelamento da semana ou remarcação e o próximo horário fixo garantido.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/90 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/60 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={org.recurring_whatsapp_notify_barber !== false}
              onChange={(e) => {
                if (setOrg) {
                  setOrg(prev => ({
                    ...prev,
                    recurring_whatsapp_notify_barber: e.target.checked,
                  }));
                }
              }}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-purple-600 focus:ring-purple-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-white block">Enviar alerta no WhatsApp do barbeiro com o feedback do cliente</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Notifica imediatamente o profissional e a barbearia assim que um horário for liberado.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterFrequency('ALL')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${
              filterFrequency === 'ALL'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-[#121B2E] dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Todos ({recurringSchedules.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterFrequency('WEEKLY')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${
              filterFrequency === 'WEEKLY'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-[#121B2E] dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Semanais
          </button>
          <button
            type="button"
            onClick={() => setFilterFrequency('BIWEEKLY')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${
              filterFrequency === 'BIWEEKLY'
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-[#121B2E] dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Quinzenais
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'PAUSED' ? 'ALL' : 'PAUSED')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${
              filterStatus === 'PAUSED'
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-[#121B2E] dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Pausados
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou fone..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-[#121B2E] dark:text-white dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Grid de Cards de Clientes Fixos */}
      {filteredSchedules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-[#121B2E]/40 p-8 text-center space-y-2">
          <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-white">Nenhum cliente fixo encontrado</p>
          <p className="text-xs text-slate-500">
            {search ? 'Tente buscar com outro termo.' : 'Clique em "Novo Cliente Fixo" para cadastrar o primeiro.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSchedules.map((schedule) => {
            const barber = barbers.find((b) => b.id === schedule.professional_id);
            const service = services.find((s) => s.id === schedule.service_id);
            const dayName = getDayOfWeekLabel(schedule.day_of_week);
            const isPaused = schedule.status === 'PAUSED';

            return (
              <div
                key={schedule.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all shadow-sm ${
                  isPaused
                    ? 'border-slate-200 bg-slate-50/70 opacity-75 dark:border-slate-800 dark:bg-slate-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#121B2E] dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {schedule.client_name}
                      </h4>
                      <a
                        href={buildWhatsAppUrl(schedule.client_phone, '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        {formatPhoneBR(schedule.client_phone)}
                      </a>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        schedule.frequency === 'WEEKLY'
                          ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'border-cyan-500/30 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
                      }`}
                    >
                      {getFrequencyLabel(schedule.frequency)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2 dark:bg-slate-900/60 dark:border-slate-800/80">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Horário</p>
                      <p className="font-bold text-slate-800 dark:text-white mt-0.5">{dayName}</p>
                      <p className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300 font-bold">
                        às {schedule.start_time}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2 dark:bg-slate-900/60 dark:border-slate-800/80">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Atendimento</p>
                      <p className="font-bold text-slate-800 dark:text-white mt-0.5 truncate">
                        {barber?.full_name || 'Profissional'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {service?.name || 'Serviço'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isPaused ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {isPaused ? 'Pausado' : 'Ativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={isPaused ? 'Reativar' : 'Pausar'}
                      onClick={() => handleTogglePause(schedule)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                    </button>
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => handleOpenEdit(schedule)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remover"
                      onClick={() => handleDelete(schedule)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#0B1120] p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {editingSchedule ? 'Editar Cliente Fixo' : 'Novo Cliente Fixo'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure o horário recorrente e a frequência desejada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white dark:placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    WhatsApp (com DDD) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formClientPhone}
                    onChange={(e) => setFormClientPhone(formatPhoneBR(e.target.value))}
                    placeholder="(84) 99999-0000"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white dark:placeholder-slate-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Profissional *
                  </label>
                  <select
                    value={formBarberId}
                    onChange={(e) => setFormBarberId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Serviço Principal *
                  </label>
                  <select
                    value={formServiceId}
                    onChange={(e) => setFormServiceId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (R$ {s.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dia da Semana *
                  </label>
                  <select
                    value={formDayOfWeek}
                    onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white"
                  >
                    {DAY_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horário (HH:mm) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequência *
                  </label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as RecurringFrequency)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white font-bold"
                  >
                    <option value="WEEKLY">Semanal</option>
                    <option value="BIWEEKLY">Quinzenal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data Base do Primeiro Corte (Anchor Date) *
                </label>
                <input
                  type="date"
                  required
                  value={formAnchorDate}
                  onChange={(e) => setFormAnchorDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-[#070B14] dark:text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {formFrequency === 'BIWEEKLY'
                    ? 'Esta data define a semana de corte inicial para o cálculo de 15 em 15 dias.'
                    : 'A partir desta data os horários semanais ficam ativos.'}
                </p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-2.5 flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/15 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingSchedule ? 'Salvar Alterações' : 'Criar Cliente Fixo'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
