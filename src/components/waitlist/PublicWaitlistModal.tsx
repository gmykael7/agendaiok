import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, Check, Clock, Calendar, Scissors, Phone, User, Sparkles } from 'lucide-react';
import { Barber, Organization, Service, WaitlistEntry, WaitlistPeriod } from '../../types';
import { useDialog } from '../../hooks/useDialog';
import { pushWaitlistToCloud } from '../../services/cloudSync';

interface PublicWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  org: Organization;
  selectedDate: string;
  selectedBarber: Barber | null;
  selectedServices: Service[];
  barbers: Barber[];
  services: Service[];
  initialClientName?: string;
  initialClientPhone?: string;
  onSuccess?: (entry: WaitlistEntry) => void;
}

export const PublicWaitlistModal: React.FC<PublicWaitlistModalProps> = ({
  open,
  onClose,
  org,
  selectedDate,
  selectedBarber,
  selectedServices,
  barbers,
  services,
  initialClientName = '',
  initialClientPhone = '',
  onSuccess,
}) => {
  const dialogRef = useDialog(open, onClose);

  const [clientName, setClientName] = useState(initialClientName);
  const [clientPhone, setClientPhone] = useState(initialClientPhone);
  const [preferredDate, setPreferredDate] = useState(selectedDate);
  const [preferredPeriod, setPreferredPeriod] = useState<WaitlistPeriod>('any');
  const [barberChoice, setBarberChoice] = useState<string>(selectedBarber?.id || 'any');
  const [serviceChoice, setServiceChoice] = useState<string>(selectedServices[0]?.id || services[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMsg('Por favor, informe seu nome e WhatsApp.');
      return;
    }

    const srv = services.find((s) => s.id === serviceChoice) || selectedServices[0];
    const brb = barbers.find((b) => b.id === barberChoice);

    setIsSubmitting(true);
    const result = await pushWaitlistToCloud(
      {
        org_id: org.id,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        preferred_date: preferredDate,
        preferred_period: preferredPeriod,
        service_id: srv?.id,
        service_name: srv?.name,
        barber_id: barberChoice !== 'any' ? brb?.id : undefined,
        barber_name: barberChoice !== 'any' ? brb?.full_name : 'Qualquer profissional',
      },
      org.slug
    );
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.error || 'Não foi possível entrar na lista de espera. Tente novamente.');
      return;
    }

    const createdEntry: WaitlistEntry = result.entry || {
      id: 'wait-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      org_id: org.id,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      preferred_date: preferredDate,
      preferred_period: preferredPeriod,
      service_id: srv?.id,
      service_name: srv?.name,
      barber_id: barberChoice !== 'any' ? brb?.id : undefined,
      barber_name: barberChoice !== 'any' ? brb?.full_name : 'Qualquer profissional',
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    onSuccess?.(createdEntry);

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('agendai_realtime_sync');
        const tenantKey = String(org.email || org.id || org.slug || '').trim().toLowerCase();
        channel.postMessage({ type: 'NEW_WAITLIST_ENTRY', payload: createdEntry, tenant: tenantKey });
      }
    } catch {}

    setSubmitted(true);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] app-mobile-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 safe-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Lista de Espera Relâmpago"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="public-waitlist-modal-dialog w-full max-w-md rounded-[28px] border border-amber-500/30 bg-[#0B1426] shadow-2xl shadow-black/80 overflow-hidden"
      >
        {/* HEADER */}
        <div className="public-waitlist-modal-header p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-amber-500/15 to-amber-500/5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="waitlist-modal-icon w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md shadow-amber-500/10 shrink-0">
              <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white tracking-tight">
                Lista de Espera Relâmpago
              </h3>
              <p className="waitlist-modal-sub text-[11px] text-slate-300 mt-0.5 truncate">
                Avise-me se surgir uma desistência ou vaga
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-4 sm:p-5 space-y-4">
          {submitted ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto animate-checkPop">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="text-base font-black text-white">Você está na fila!</h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Assim que um cliente desmarcar ou abrir um horário para{' '}
                <strong className="text-amber-300">
                  {preferredDate.split('-').reverse().join('/')}
                </strong>
                , enviaremos um alerta relâmpago no seu WhatsApp ({clientPhone}).
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                Entendido!
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Os melhores horários costumam ser disputados. Se alguém desmarcar, o AgendAI avisa você primeiro no WhatsApp para você garantir o horário.
              </p>

              {errorMsg && (
                <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[11px]">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" /> Seu Nome:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Oliveira"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:border-amber-400 outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" /> Seu WhatsApp (com DDD):
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: (84) 99999-8888"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:border-amber-400 outline-none text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-400" /> Data:
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-2.5 py-2 text-white focus:border-amber-400 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Período:
                  </label>
                  <select
                    value={preferredPeriod}
                    onChange={(e) => setPreferredPeriod(e.target.value as WaitlistPeriod)}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-2 py-2 text-white focus:border-amber-400 outline-none text-xs"
                  >
                    <option value="any">Qualquer horário</option>
                    <option value="morning">Manhã (08h-12h)</option>
                    <option value="afternoon">Tarde (12h-18h)</option>
                    <option value="evening">Noite (18h-21h)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-amber-400" /> Barbeiro de Preferência:
                </label>
                <select
                  value={barberChoice}
                  onChange={(e) => setBarberChoice(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none text-xs"
                >
                  <option value="any">Qualquer barbeiro disponível</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>{isSubmitting ? 'Salvando...' : 'Quero ser avisado se abrir vaga'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
