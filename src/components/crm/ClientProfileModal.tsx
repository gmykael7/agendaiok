import React, { useState, useMemo } from 'react';
import { 
  X, User, Scissors, Calendar, Clock, DollarSign, 
  MessageSquare, Cake, Sparkles, Check, Save, Heart, 
  History, Star, AlertCircle, CheckCircle, Gift, Phone
} from 'lucide-react';
import { Client, Appointment, Organization } from '../../types';
import { Modal } from '../common/Modal';
import { getClientCrmStats, getBirthdayStatus } from '../../utils/clientCrm';
import { normalizeClientPhone } from '../../utils/clients';
import { buildClientWhatsAppUrl } from '../../utils/whatsapp';
import { appointmentStatusClasses, appointmentStatusLabel } from '../../utils/appointmentStatus';

interface ClientProfileModalProps {
  client: Client;
  org: Organization;
  appointments: Appointment[];
  onClose: () => void;
  onUpdateClient: (updated: Client) => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  client,
  org,
  appointments,
  onClose,
  onUpdateClient,
}) => {
  const [haircutNotes, setHaircutNotes] = useState(client.haircut_notes || '');
  const [birthDate, setBirthDate] = useState(client.birth_date || '');
  const [preferences, setPreferences] = useState(client.preferences || '');
  const [generalNotes, setGeneralNotes] = useState(client.notes || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Calcula estatísticas do CRM e histórico
  const crmStats = useMemo(() => {
    return getClientCrmStats(client, appointments);
  }, [client, appointments]);

  const birthdayStatus = useMemo(() => {
    return getBirthdayStatus(birthDate || client.birth_date);
  }, [birthDate, client.birth_date]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Client = {
      ...client,
      haircut_notes: haircutNotes.trim() || undefined,
      birth_date: birthDate.trim() || undefined,
      preferences: preferences.trim() || undefined,
      notes: generalNotes.trim() || undefined,
    };
    onUpdateClient(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const whatsAppUrl = client.phone ? buildClientWhatsAppUrl(org, client, 'thanks') : '';

  return (
    <Modal label="Ficha Técnica e Histórico do Cliente" onClose={onClose} className="fixed inset-0 z-[230] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="client-profile-modal-shell modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl animate-fadeIn max-h-[92dvh] flex flex-col">
        {/* CABEÇALHO */}
        <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 font-black flex items-center justify-center text-sm sm:text-base shrink-0 shadow-lg shadow-emerald-500/20">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{client.name}</h3>
                {birthdayStatus === 'today' && (
                  <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-black flex items-center gap-1 animate-pulse">
                    <Cake className="w-3 h-3 text-pink-400" />
                    <span>Aniversário Hoje! 🎂</span>
                  </span>
                )}
                {birthdayStatus === 'this_month' && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] font-bold flex items-center gap-1">
                    <Cake className="w-3 h-3 text-violet-400" />
                    <span>Aniversariante do Mês 🎈</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {client.phone || 'Sem telefone'}
                </span>
                {whatsAppUrl && (
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold text-[11px]"
                  >
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            aria-label="Fechar ficha do cliente"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="modal-scroll-body p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* BARRA DE ESTATÍSTICAS RÁPIDAS (CRM) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="client-profile-stat-card bg-[#0B1120] p-3 rounded-2xl border border-slate-800 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total Visitas</span>
              <strong className="text-base sm:text-lg font-black text-white mt-0.5 block">{crmStats.totalVisits}</strong>
              <span className="text-[10px] text-emerald-400 font-semibold">{crmStats.lastVisitLabel}</span>
            </div>

            <div className="client-profile-stat-card bg-[#0B1120] p-3 rounded-2xl border border-slate-800 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total Gasto</span>
              <strong className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5 block">
                R$ {crmStats.totalSpent.toFixed(2)}
              </strong>
              <span className="text-[10px] text-slate-400">Em atendimentos</span>
            </div>

            <div className="client-profile-stat-card bg-[#0B1120] p-3 rounded-2xl border border-slate-800 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Ticket Médio</span>
              <strong className="text-base sm:text-lg font-black text-cyan-300 font-mono mt-0.5 block">
                R$ {crmStats.averageTicket.toFixed(2)}
              </strong>
              <span className="text-[10px] text-slate-400">Por visita</span>
            </div>

            <div className="client-profile-stat-card bg-[#0B1120] p-3 rounded-2xl border border-slate-800 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Barbeiro Favorito</span>
              <strong className="text-xs sm:text-sm font-bold text-violet-300 mt-1 block truncate">
                {crmStats.favoriteBarber}
              </strong>
              <span className="text-[10px] text-slate-400 truncate block">{crmStats.favoriteService}</span>
            </div>
          </div>

          {/* FORMULÁRIO COM FICHA TÉCNICA E PREFERÊNCIAS */}
          <form id="client-profile-form" onSubmit={handleSave} className="space-y-4">
            <div className="client-profile-haircut-card bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-amber-500/5">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <label className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Ficha Técnica do Corte & Estilo</span>
                </label>
                <span className="text-[10px] text-amber-300/80 uppercase font-semibold tracking-wider">
                  Visível para o barbeiro
                </span>
              </div>
              <textarea
                rows={3}
                value={haircutNotes}
                onChange={(e) => setHaircutNotes(e.target.value)}
                placeholder="Ex: Degradê navalhado médio pente 1.5 na lateral, tesoura no topo preservando o comprimento, barba alinhada com navalha e óleo..."
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                O profissional que atender este cliente verá essa fórmula imediatamente na cadeira.
              </p>
            </div>

            {/* PREFERÊNCIAS & ANIVERSÁRIO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="client-profile-input-card bg-[#0B1120] p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cake className="w-3.5 h-3.5 text-pink-400" />
                  <span>Data de Aniversário</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Para enviar felicitações e lembretes especiais.</span>
              </div>

              <div className="client-profile-input-card bg-[#0B1120] p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  <span>Preferências de Atendimento</span>
                </label>
                <input
                  type="text"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="Ex: Café sem açúcar, corte silencioso"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Personalize a experiência do cliente no salão.</span>
              </div>
            </div>
          </form>

          {/* HISTÓRICO DE ATENDIMENTOS PASSADOS */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Histórico de Visitas ({crmStats.appointments.length})</span>
            </h4>

            {crmStats.appointments.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center bg-[#0B1120] rounded-xl border border-slate-800/80">
                Nenhum atendimento anterior registrado para este cliente.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {crmStats.appointments.map((app) => (
                  <div
                    key={app.id}
                    className="client-profile-history-item p-3 bg-[#0B1120] border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-white truncate">{app.service_name}</strong>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${appointmentStatusClasses(app.status)}`}>
                          {appointmentStatusLabel(app.status)}
                        </span>
                        {app.loyalty_reward_applied && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-bold flex items-center gap-0.5">
                            <Gift className="w-2.5 h-2.5" /> Prêmio
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{app.date ? app.date.split('-').reverse().join('/') : 'Data n/d'} às {app.start_time}</span>
                        <span>•</span>
                        <span>Barbeiro: <strong className="text-slate-300">{app.barber_name}</strong></span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                        R$ {Number(app.price || 0).toFixed(2)}
                      </span>
                      {app.payment_method && (
                        <span className="text-[10px] text-slate-500 block uppercase font-mono">
                          {app.payment_method}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ ESTÁTICO (SEMPRE VISÍVEL) */}
        <div className="modal-static-footer border-t border-slate-800 p-4 sm:p-5 flex items-center justify-between shrink-0 bg-slate-900">
          <div>
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle className="w-4 h-4" />
                Ficha do cliente salva com sucesso!
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Salvo no CRM da barbearia.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
            >
              Fechar
            </button>
            <button
              type="submit"
              form="client-profile-form"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Ficha do Cliente</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
