import { appConfirm } from '../components/common/ConfirmDialog';
import { Modal } from "../components/common/Modal";
import React, { useState } from 'react';
import { 
  Users, Plus, Trash2, Edit3, Phone, DollarSign, 
  UserCheck, AlertCircle, Percent, Sparkles, X, Check
} from 'lucide-react';
import { Barber, Appointment } from '../types';
import { BarberAvatar } from '../components/common/BarberAvatar';

interface TeamViewProps {
  barbers: Barber[];
  setBarbers: React.Dispatch<React.SetStateAction<Barber[]>>;
  appointments: Appointment[];
}

export const TeamView: React.FC<TeamViewProps> = ({
  barbers,
  setBarbers,
  appointments,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [commissionRate, setCommissionRate] = useState(50);
  const [soloOwner, setSoloOwner] = useState(false);
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');

  const openAddModal = () => {
    setEditingBarber(null);
    setFullName('');
    setRole('Barbeiro Especialista');
    setCommissionRate(50);
    setPhone('');
    setAvatarUrl('');
    setBio('');
    setSpecialties('');
    setShowModal(true);
  };

  const openEditModal = (barber: Barber) => {
    setEditingBarber(barber);
    setFullName(barber.full_name);
    setRole(barber.role);
    setCommissionRate(barber.commission_rate);
    setSoloOwner(!!barber.solo_owner);
    setPhone(barber.phone);
    setAvatarUrl(barber.avatar_url || '');
    setBio(barber.bio || '');
    setSpecialties((barber.specialties || []).join(', '));
    setShowModal(true);
  };

  const handleSaveBarber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    if (editingBarber) {
      // Atualizar barbeiro existente
      setBarbers(prev => prev.map(b => b.id === editingBarber.id ? {
        ...b,
        full_name: fullName.trim(),
        role: role.trim() || 'Barbeiro',
        commission_rate: soloOwner ? 0 : commissionRate,
        solo_owner: soloOwner,
        phone: phone.trim(),
        avatar_url: avatarUrl.trim() || undefined,
        bio: bio.trim().slice(0, 400),
        specialties: [...new Set(specialties.split(',').map(value => value.trim().slice(0, 60)).filter(Boolean))].slice(0, 8),
      } : b));
    } else {
      // Criar novo barbeiro (sem foto humana por padrão)
      const newBarber: Barber = {
        id: 'b-' + Date.now(),
        full_name: fullName.trim(),
        role: role.trim() || 'Barbeiro',
        commission_rate: soloOwner ? 0 : commissionRate,
        solo_owner: soloOwner,
        phone: phone.trim(),
        avatar_url: avatarUrl.trim() || undefined,
        bio: bio.trim().slice(0, 400),
        specialties: [...new Set(specialties.split(',').map(value => value.trim().slice(0, 60)).filter(Boolean))].slice(0, 8),
        active: true,
      };
      setBarbers(prev => [...prev, newBarber]);
    }

    setShowModal(false);
  };

  const handleDeleteBarber = async (id: string) => {
    if (await appConfirm('Tem certeza que deseja remover este profissional?', { danger: true })) {
      setBarbers(prev => prev.filter(b => b.id !== id));
    }
  };

  const updateCommissionRate = (barberId: string, newRate: number) => {
    const safeRate = Math.min(100, Math.max(0, newRate));
    setBarbers(prev => prev.map(b => b.id === barberId ? { ...b, commission_rate: safeRate } : b));
  };

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn">
      {/* CABEÇALHO DA SEÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            Equipe de Barbeiros & Comissões
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cadastre os profissionais que atendem no seu estabelecimento e defina as porcentagens de comissão.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Barbeiro</span>
        </button>
      </div>

      {/* LISTA DE BARBEIROS OU EMPTY STATE */}
      {barbers.length === 0 ? (
        <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nenhum barbeiro cadastrado</h3>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre o primeiro profissional para que seus clientes possam escolher com quem desejam ser atendidos.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/10 active:scale-95 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Primeiro Barbeiro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {barbers.map((barber, index) => {
            const concluidos = appointments.filter(a => a.barber_id === barber.id && a.status === 'completed');
            const totalBruto = concluidos.reduce((acc, curr) => acc + curr.price, 0);
            const valorComissao = (totalBruto * barber.commission_rate) / 100;
            const agendamentosPendentes = appointments.filter(a => a.barber_id === barber.id && ['scheduled', 'confirmed', 'arrived', 'in_progress'].includes(a.status)).length;

            return (
              <div 
                key={barber.id} 
                style={{ animationDelay: `${index * 40}ms` }}
                className="stagger-item booking-card bg-[#121B2E] p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-5 hover:border-emerald-500/50 shadow-md transition-all"
              >
                {/* TOPO DO CARD: FOTO / ÍCONE DE PERFIL PADRÃO, NOME, AÇÕES */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="transition-transform duration-200 hover:scale-105">
                      <BarberAvatar
                        name={barber.full_name}
                        avatarUrl={barber.avatar_url}
                        size="lg"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base sm:text-lg leading-tight">{barber.full_name}</h4>
                      <p className="text-xs text-cyan-300 font-semibold mt-0.5">{barber.role}</p>
                      {barber.phone && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-emerald-400" /> {barber.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(barber)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                      title="Editar barbeiro"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBarber(barber.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                      title="Remover barbeiro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {barber.bio && <p className="text-sm text-slate-300 break-words">{barber.bio}</p>}
                {!!barber.specialties?.length && <div className="flex flex-wrap gap-2">{barber.specialties.map(specialty => <span key={specialty} className="rounded-full bg-cyan-400/10 border border-cyan-400/20 px-3 py-1 text-xs text-cyan-300">{specialty}</span>)}</div>}

                {/* CONTROLE DE COMISSÃO */}
                <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Percentual de Comissão</span>
                    <span className="text-emerald-400 font-bold font-mono text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                      {barber.commission_rate}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={`Percentual de comissão de ${barber.full_name}`}
                    min="0"
                    max="100"
                    step="5"
                    value={barber.commission_rate}
                    onChange={(e) => updateCommissionRate(barber.id, parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono flex-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateCommissionRate(barber.id, 100)}
                      className="ml-2 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-black hover:bg-emerald-400 transition-colors shadow-sm active:scale-95"
                      title="Definir comissão em 100%"
                    >
                      100%
                    </button>
                  </div>
                </div>

                {/* MÉTRICAS DE PRODUÇÃO E LIQUIDAÇÃO */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                  <div className="bg-[#0B1120] p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Atendimentos</p>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1">
                      {concluidos.length} <span className="text-[10px] text-slate-500 font-normal">({agendamentosPendentes} pend.)</span>
                    </p>
                  </div>
                  <div className="bg-[#0B1120] p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Produzido</p>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1 font-mono">R$ {totalBruto.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/25">
                    <p className="text-[10px] sm:text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Comissão Líquida</p>
                    <p className="text-xs sm:text-sm font-bold text-emerald-400 mt-1 font-mono">R$ {valorComissao.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR BARBEIRO */}
      {showModal && (
        <Modal label="Cadastro de profissional" onClose={() => setShowModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {editingBarber ? 'Editar Barbeiro' : 'Adicionar Novo Barbeiro'}
              </h3>
              <button aria-label="Fechar janela" 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBarber} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-4 sm:p-5 space-y-4">
                <div>
                  <label htmlFor="team-field-1" className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome Completo *
                  </label>
                  <input id="team-field-1"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Lucas Silva"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="team-bio" className="block text-xs font-semibold text-slate-300 mb-1">Apresentação pública</label>
                  <textarea id="team-bio" value={bio} onChange={event => setBio(event.target.value)} maxLength={400} rows={3} placeholder="Conte sua experiência e seu estilo de atendimento." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white" />
                  <label htmlFor="team-specialties" className="block text-xs font-semibold text-slate-300 mt-3 mb-1">Especialidades (separadas por vírgula)</label>
                  <input id="team-specialties" value={specialties} onChange={event => setSpecialties(event.target.value)} maxLength={480} placeholder="Degradê, barba, corte infantil" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white" />
                  <p className="mt-2 text-xs text-slate-400">Até 8 especialidades. Estas informações aparecem para os clientes; não alteram preços nem restringem serviços.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="team-field-2" className="block text-xs font-semibold text-slate-300 mb-1">
                      Especialidade / Cargo
                    </label>
                    <input id="team-field-2"
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ex: Barbeiro Sênior"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Comissão Inicial (%)
                    </label>
                    <label className="mb-2 flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950 p-3 cursor-pointer">
                      <input type="checkbox" checked={soloOwner} onChange={(e) => { setSoloOwner(e.target.checked); if (e.target.checked) setCommissionRate(0); }} className="mt-0.5 h-5 w-5 accent-emerald-500 cursor-pointer" />
                      <span><strong className="block text-xs text-white">Atende sozinho</strong><span className="block text-[11px] text-slate-400">O dono é o barbeiro. Sem comissão: o líquido do caixa é o valor que ele recebe.</span></span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={soloOwner}
                        value={soloOwner ? 0 : commissionRate}
                        onChange={(e) => setCommissionRate(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setCommissionRate(100)}
                        disabled={soloOwner}
                        title="Definir comissão em 100%"
                        className="px-3 rounded-xl border border-emerald-400/60 bg-emerald-500/10 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        Usar 100%
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="team-field-3" className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp do Barbeiro
                  </label>
                  <input id="team-field-3"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(84) 99999-8888"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="team-field-4" className="block text-xs font-semibold text-slate-300 mb-1">
                    URL da Foto / Avatar (Opcional - por padrão usa avatar com iniciais)
                  </label>
                  <input id="team-field-4"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Opcional: https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="modal-static-footer flex justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition-colors shadow-sm active:scale-95"
                >
                  {editingBarber ? 'Salvar Alterações' : 'Cadastrar Barbeiro'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
