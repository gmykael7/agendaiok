import { appConfirm } from '../common/ConfirmDialog';
import { localDateKey } from '../../utils/localDate';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  X,
  MessageCircle,
  Calendar,
  Clock,
  User,
  CheckCircle,
  Trash2,
  Phone,
  Scissors,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Appointment, Barber, Organization, Service, WaitlistEntry, WaitlistPeriod } from '../../types';
import { useDialog } from '../../hooks/useDialog';
import { buildWaitlistWhatsAppUrl, waitlistPeriodLabel } from '../../utils/waitlist';

export interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
  waitlist: WaitlistEntry[];
  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;
  org: Organization;
  barbers: Barber[];
  services: Service[];
  onClaimSlot?: (
    entry: WaitlistEntry,
    slot: { date: string; time: string; barberId: string; barberName: string }
  ) => void;
  releasedSlot?: {
    date: string;
    time: string;
    barber_id?: string;
    barber_name: string;
    service_name?: string;
    matches: WaitlistEntry[];
  } | null;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
  open,
  onClose,
  waitlist,
  setWaitlist,
  org,
  barbers,
  services,
  onClaimSlot,
  releasedSlot,
}) => {
  const dialogRef = useDialog(open, onClose);
  const [filterTab, setFilterTab] = useState<'all' | 'waiting' | 'notified'>('waiting');

  // Modal interno de adição manual rápida pela recepção
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDate, setManualDate] = useState(() => localDateKey());
  const [manualPeriod, setManualPeriod] = useState<WaitlistPeriod>('any');
  const [manualBarberId, setManualBarberId] = useState('any');
  const [manualServiceId, setManualServiceId] = useState(services[0]?.id || '');

  const waitingCount = useMemo(
    () => waitlist.filter((w) => w.status === 'waiting').length,
    [waitlist]
  );

  const filteredEntries = useMemo(() => {
    if (filterTab === 'all') return waitlist;
    return waitlist.filter((w) => w.status === filterTab);
  }, [waitlist, filterTab]);

  const handleMarkNotified = (id: string) => {
    setWaitlist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'notified', notified_at: new Date().toISOString() } : item
      )
    );
  };

  const handleDeleteEntry = async (id: string) => {
    if (await appConfirm('Remover este cliente da lista de espera?', { danger: true })) {
      setWaitlist((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleAddManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;

    const srv = services.find((s) => s.id === manualServiceId);
    const brb = barbers.find((b) => b.id === manualBarberId);

    const newEntry: WaitlistEntry = {
      id: 'wait-manual-' + Date.now(),
      org_id: org.id,
      client_name: manualName.trim(),
      client_phone: manualPhone.trim(),
      service_id: srv?.id,
      service_name: srv?.name,
      barber_id: manualBarberId !== 'any' ? brb?.id : undefined,
      barber_name: manualBarberId !== 'any' ? brb?.full_name : 'Qualquer profissional',
      preferred_date: manualDate,
      preferred_period: manualPeriod,
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    setWaitlist((prev) => [newEntry, ...prev]);
    setManualName('');
    setManualPhone('');
    setShowManualAdd(false);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] app-mobile-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 safe-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Fila de Espera Relâmpago"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="waitlist-modal-dialog w-full max-w-xl max-h-[88dvh] flex flex-col rounded-[28px] border border-amber-500/30 bg-[#0B1426] shadow-2xl shadow-black/80 overflow-hidden"
      >
        {/* HEADER COM DESTAQUE */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-transparent flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md shadow-amber-500/10 shrink-0">
              <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {releasedSlot ? 'Vaga Relâmpago Liberada!' : 'Fila de Espera Relâmpago'}
                </h3>
                {waitingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {waitingCount} aguardando
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {releasedSlot
                  ? `Desistência às ${releasedSlot.time} (${releasedSlot.barber_name}). Notifique os clientes em espera!`
                  : 'Clientes aguardando vagas de desistência e encaixe.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 border border-transparent transition-colors shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ÁREA DE CONTEÚDO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 booking-scroll">
          {/* SEÇÃO 1: ALERTA DE VAGA LIBERADA (SE ABERTO POR CANCELAMENTO) */}
          {releasedSlot && (
            <div className="p-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 fill-amber-300" />
                    Horário Disponível para Encaixe
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-white bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-700">
                  {releasedSlot.time}
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <p>
                  📅 Data: <strong className="text-white">{releasedSlot.date.split('-').reverse().join('/')}</strong>
                  {' • '}
                  💈 Profissional: <strong className="text-white">{releasedSlot.barber_name}</strong>
                </p>
                {releasedSlot.matches.length > 0 ? (
                  <p className="text-emerald-300 font-semibold">
                    Encontramos {releasedSlot.matches.length} cliente(s) na fila compatíveis com este horário!
                  </p>
                ) : (
                  <p className="text-slate-400">
                    Nenhum cliente na fila especificamente para este horário, mas você pode avisar os outros da lista abaixo.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO 2: ABAS DE FILTRO & BOTÃO DE NOVO ENCAIXE MANUAL */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center p-1 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterTab('waiting')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterTab === 'waiting'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Aguardando ({waitingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterTab === 'all'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Histórico ({waitlist.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowManualAdd(!showManualAdd)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar à Fila</span>
            </button>
          </div>

          {/* FORMULÁRIO DE ADIÇÃO MANUAL PELA BARBEARIA */}
          {showManualAdd && (
            <form onSubmit={handleAddManualEntry} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Adicionar cliente à fila de espera</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <input
                  type="text"
                  placeholder="Nome do cliente *"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                  required
                />
                <input
                  type="tel"
                  placeholder="WhatsApp com DDD *"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                  required
                />
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                  required
                />
                <select
                  value={manualPeriod}
                  onChange={(e) => setManualPeriod(e.target.value as WaitlistPeriod)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                >
                  <option value="any">Qualquer horário</option>
                  <option value="morning">Manhã (08h às 12h)</option>
                  <option value="afternoon">Tarde (12h às 18h)</option>
                  <option value="evening">Noite (18h às 21h)</option>
                </select>
                <select
                  value={manualBarberId}
                  onChange={(e) => setManualBarberId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                >
                  <option value="any">Qualquer profissional</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>{b.full_name}</option>
                  ))}
                </select>
                <select
                  value={manualServiceId}
                  onChange={(e) => setManualServiceId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (R$ {s.price.toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualAdd(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all"
                >
                  Salvar na Fila
                </button>
              </div>
            </form>
          )}

          {/* LISTA DE ENTRADAS NA FILA */}
          {filteredEntries.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-800 rounded-2xl">
              <Zap className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white mt-2">Nenhum cliente na fila de espera</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Quando clientes buscarem horários esgotados na página de agendamento, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredEntries.map((entry, idx) => {
                const isMatch = releasedSlot && releasedSlot.matches.some((m) => m.id === entry.id);

                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isMatch
                        ? 'border-amber-400/50 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-white">
                            #{idx + 1} {entry.client_name}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                            entry.status === 'waiting'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : entry.status === 'notified'
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                              : entry.status === 'claimed'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {entry.status === 'waiting' ? 'Aguardando' : entry.status === 'notified' ? 'Avisado' : entry.status === 'claimed' ? 'Encaixado' : 'Cancelado'}
                          </span>
                          {isMatch && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                              Compatível com a vaga!
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Data: <strong className="text-slate-200">{entry.preferred_date.split('-').reverse().join('/')}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Período: <strong className="text-slate-200">{waitlistPeriodLabel(entry.preferred_period)}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <Scissors className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Profissional: <strong className="text-slate-200">{entry.barber_name || 'Qualquer'}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>WhatsApp: <strong className="text-slate-200 font-mono">{entry.client_phone}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-slate-800 shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                        title="Remover da lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* BOTÕES DE AÇÃO: DISPARO WHATSAPP OU ENCAIXE */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-end gap-2 flex-wrap">
                      {releasedSlot ? (
                        <a
                          href={buildWaitlistWhatsAppUrl(org, entry, {
                            date: releasedSlot.date,
                            time: releasedSlot.time,
                            barber_name: releasedSlot.barber_name,
                            service_name: releasedSlot.service_name || entry.service_name,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleMarkNotified(entry.id)}
                          className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Avisar no WhatsApp</span>
                        </a>
                      ) : (
                        <a
                          href={`https://wa.me/55${entry.client_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Conversar</span>
                        </a>
                      )}

                      {releasedSlot && onClaimSlot && (
                        <button
                          type="button"
                          onClick={() =>
                            onClaimSlot(entry, {
                              date: releasedSlot.date,
                              time: releasedSlot.time,
                              barberId: releasedSlot.barber_id || barbers[0]?.id || '',
                              barberName: releasedSlot.barber_name,
                            })
                          }
                          className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Encaixar Agora</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
