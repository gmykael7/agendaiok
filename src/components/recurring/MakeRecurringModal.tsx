import React, { useState } from 'react';
import { Sparkles, Calendar, Clock, User, Phone, Check, RefreshCw, AlertCircle } from 'lucide-react';
import type { Appointment, Barber, Organization, RecurringFrequency, RecurringSchedule, RecurringStatus, Service } from '../../types';
import { formatPhoneBR } from '../../utils/whatsapp';
import {
  DAY_NAMES,
  getDayOfWeekFromDate,
  getDayOfWeekLabel,
  getFrequencyLabel,
  hasRecurringConflict,
  normalizePhoneOnlyDigits
} from '../../utils/recurringSchedules';

interface MakeRecurringModalProps {
  appointment: Appointment;
  org: Organization;
  barbers: Barber[];
  services: Service[];
  recurringSchedules: RecurringSchedule[];
  setRecurringSchedules: React.Dispatch<React.SetStateAction<RecurringSchedule[]>>;
  appointments: Appointment[];
  onClose: () => void;
  onSuccess?: (newSchedule: RecurringSchedule) => void;
}

export const MakeRecurringModal: React.FC<MakeRecurringModalProps> = ({
  appointment,
  org,
  barbers,
  services,
  recurringSchedules,
  setRecurringSchedules,
  appointments,
  onClose,
  onSuccess,
}) => {
  const appDate = appointment.date || new Date().toISOString().split('T')[0];
  const initialDayOfWeek = getDayOfWeekFromDate(appDate);

  const [clientName, setClientName] = useState(appointment.client_name);
  const [clientPhone, setClientPhone] = useState(formatPhoneBR(appointment.client_phone));
  const [professionalId, setProfessionalId] = useState(appointment.barber_id || barbers[0]?.id || '');
  const [serviceId, setServiceId] = useState(appointment.service_id || services[0]?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialDayOfWeek >= 0 ? initialDayOfWeek : 5);
  const [startTime, setStartTime] = useState(appointment.start_time || '14:00');
  const [frequency, setFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [anchorDate, setAnchorDate] = useState(appDate);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = normalizePhoneOnlyDigits(clientPhone);
    if (!clientName.trim() || cleanPhone.length < 10) {
      setError('Informe o nome e WhatsApp completo do cliente.');
      return;
    }

    const candidate = {
      tenant_id: org.id,
      client_name: clientName.trim(),
      client_phone: cleanPhone,
      professional_id: professionalId,
      service_id: serviceId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      frequency,
      anchor_date: anchorDate,
      status: 'ACTIVE' as RecurringStatus,
    };

    // Valida conflito ignorando o próprio agendamento atual
    const conflict = hasRecurringConflict(
      candidate,
      recurringSchedules,
      appointments.filter((a) => a.id !== appointment.id),
      services
    );

    if (conflict.hasConflict) {
      setError(conflict.reason || 'Conflito com outro horário detectado.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/recurring-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });

      const data = await res.json() as any;
      if (res.ok && data.success) {
        const newSchedule: RecurringSchedule = data.schedule || {
          ...candidate,
          id: `rec-${Date.now()}`,
          created_at: new Date().toISOString(),
        };

        setRecurringSchedules((prev) => [newSchedule, ...prev.filter((s) => s.id !== newSchedule.id)]);
        if (onSuccess) onSuccess(newSchedule);
        onClose();
      } else {
        setError(data.error || 'Falha ao registrar cliente fixo.');
      }
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const barber = barbers.find((b) => b.id === professionalId);
  const service = services.find((s) => s.id === serviceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#0B1120] p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-black text-emerald-300 uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3" /> Tornar Cliente Fixo
            </span>
            <h3 className="text-base font-black text-white">
              Reservar Horário Recorrente
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Transforme este agendamento em um contrato fixo semanal ou quinzenal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Card Resumo Pré-preenchido */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cliente:</span>
              <strong className="text-white">{clientName}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">WhatsApp:</span>
              <span className="font-mono text-emerald-400 font-bold">{clientPhone}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Profissional & Serviço:</span>
              <span className="text-white truncate">
                {barber?.full_name} • {service?.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Horário fixo sugerido:</span>
              <span className="font-mono text-cyan-300 font-black">
                {getDayOfWeekLabel(dayOfWeek)} às {startTime}
              </span>
            </div>
          </div>

          {/* Escolha da Frequência */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-2">
              Escolha a Frequência:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFrequency('WEEKLY')}
                className={`rounded-2xl p-3 border text-left transition-all ${
                  frequency === 'WEEKLY'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white shadow-md shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">🔁 Semanal</span>
                  {frequency === 'WEEKLY' && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Toda semana garantido
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFrequency('BIWEEKLY')}
                className={`rounded-2xl p-3 border text-left transition-all ${
                  frequency === 'BIWEEKLY'
                    ? 'border-cyan-500 bg-cyan-500/20 text-white shadow-md shadow-cyan-500/10'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">🔁 Quinzenal</span>
                  {frequency === 'BIWEEKLY' && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  A cada 15 dias (semana sim, semana não)
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Dia da Semana
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-[#070B14] px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {DAY_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Horário de Início
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-[#070B14] px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
              </input>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs py-2.5 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Fixo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
