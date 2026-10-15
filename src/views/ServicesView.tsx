import { appConfirm } from '../components/common/ConfirmDialog';
import { Modal } from "../components/common/Modal";
import React, { useState } from 'react';
import { Scissors, Plus, Clock, Trash2, Edit3, X, Sparkles, Coffee, HeartHandshake } from 'lucide-react';
import { ActionButton } from '../components/common/ActionButton';
import { Service } from '../types';

interface ServicesViewProps {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
}

const DEFAULT_CATEGORIES = ['Cabelo', 'Barba', 'Combos', 'Estética', 'Sobrancelha', 'Experiências', 'Day Spa', 'Planos', 'Outros'];

const EXPERIENCE_PRESETS: Service[] = [
  { id: 'experience-father-son', name: 'Plano Pai & Filho', description: 'Dois cortes, ritual de boas-vindas e registro da evolução dos cortes.', badge: 'Experiência em família', price: 0, duration_minutes: 75, category: 'Experiências', active: false },
  { id: 'experience-day-spa-60', name: 'Day Spa Masculino 60', description: 'Corte, barba e cuidado facial express para sair renovado.', badge: 'Presente perfeito', price: 0, duration_minutes: 60, category: 'Day Spa', active: false },
  { id: 'experience-day-spa-120', name: 'Day Spa Masculino 120', description: 'Ritual completo com corte, barba, pele, massagem express e mãos.', badge: 'Experiência completa', price: 0, duration_minutes: 120, category: 'Day Spa', active: false },
];

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  setServices,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [category, setCategory] = useState('Cabelo');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('');
  const [presetMessage, setPresetMessage] = useState('');

  const openAddModal = () => {
    setEditingService(null);
    setName('');
    setPrice('');
    setDuration('30');
    setCategory('Cabelo');
    setDescription('');
    setBadge('');
    setShowModal(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.price.toString());
    setDuration(service.duration_minutes.toString());
    setCategory(service.category);
    setDescription(service.description || '');
    setBadge(service.badge || '');
    setShowModal(true);
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveStatus !== 'idle') return;
    if (!name.trim() || !price) return;

    const parsedPrice = parseFloat(price);
    const parsedDuration = parseInt(duration, 10) || 30;

    if (editingService) {
      setServices(prev => prev.map(s => s.id === editingService.id ? {
        ...s,
        name: name.trim(),
        price: parsedPrice,
        duration_minutes: parsedDuration,
        category: category.trim() || 'Geral',
        description: description.trim() || undefined,
        badge: badge.trim() || undefined,
      } : s));
    } else {
      const newService: Service = {
        id: 'srv-' + Date.now(),
        name: name.trim(),
        price: parsedPrice,
        duration_minutes: parsedDuration,
        category: category.trim() || 'Geral',
        description: description.trim() || undefined,
        badge: badge.trim() || undefined,
        active: true,
      };
      setServices(prev => [...prev, newService]);
    }

    setSaveStatus('success');
    window.setTimeout(() => {
      setShowModal(false);
      setSaveStatus('idle');
    }, 550);
  };

  const handleDeleteService = async (id: string) => {
    if (await appConfirm('Tem certeza que deseja remover este serviço?', { danger: true })) {
      setServices(prev => prev.filter(s => s.id !== id));
    }
  };

  const toggleActive = (id: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const addExperiencePresets = () => {
    const existingNames = new Set(services.map(service => service.name.trim().toLocaleLowerCase('pt-BR')));
    const additions = EXPERIENCE_PRESETS
      .filter(service => !existingNames.has(service.name.toLocaleLowerCase('pt-BR')))
      .map(service => ({ ...service, id: `${service.id}-${Date.now()}`, org_id: services[0]?.org_id }));
    if (additions.length === 0) {
      setPresetMessage('As experiências sugeridas já estão no catálogo.');
      return;
    }
    setServices(previous => [...previous, ...additions]);
    setPresetMessage(`${additions.length} experiências adicionadas como rascunho. Defina o preço e ative quando estiver pronto.`);
  };

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Scissors className="w-6 h-6 text-emerald-400" />
            Catálogo de Serviços
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure os serviços oferecidos, valores e tempos estimados de atendimento.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Serviço</span>
        </button>
      </div>

      <section className="services-experience-panel rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.07] via-[#121B2E] to-amber-300/[0.06] p-4 sm:p-5 shadow-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200"><HeartHandshake className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Experiências que fidelizam</p>
              <h3 className="mt-1 text-sm font-black text-white">Pai & Filho e Day Spa prontos para configurar</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Inclua também o lounge no ritual: café especial, água saborizada, Wi‑Fi, videogame e um espaço para conversar ou trabalhar.</p>
            </div>
          </div>
          <button type="button" onClick={addExperiencePresets} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3.5 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/15 active:scale-95"><Coffee className="w-4 h-4" />Adicionar como rascunho</button>
        </div>
        {presetMessage && <p className="mt-3 rounded-xl border border-cyan-400/15 bg-slate-950/35 px-3 py-2 text-[11px] text-cyan-100">{presetMessage}</p>}
      </section>

      {/* LISTA OU EMPTY STATE */}
      {services.length === 0 ? (
        <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm">
            <Scissors className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nenhum serviço cadastrado</h3>
            <p className="text-xs text-slate-400 mt-1">
              Adicione cortes, barba ou combos para começar a receber agendamentos.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/10 active:scale-95 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Primeiro Serviço
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {services.map((service, index) => (
            <div 
              key={service.id} 
              style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              className={`stagger-item booking-card bg-[#121B2E] p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-md ${
                service.active ? 'border-slate-800 hover:border-emerald-500/50' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                    {service.category}
                  </span>
                  <button
                    onClick={() => toggleActive(service.id)}
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                      service.active 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {service.active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                <h4 className="font-bold text-white text-base sm:text-lg mt-3 leading-snug">{service.name}</h4>
                {service.badge && <span className="mt-2 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-200">{service.badge}</span>}
                {service.description && <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{service.description}</p>}

                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    {service.duration_minutes} min
                  </span>
                  <span className="text-emerald-400 font-black text-base sm:text-lg font-mono">
                    R$ {service.price.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-3.5 mt-3.5 border-t border-slate-800/70">
                <button
                  onClick={() => openEditModal(service)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                  title="Editar serviço"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteService(service.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                  title="Excluir serviço"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR SERVIÇO */}
      {showModal && (
        <Modal label="Cadastro de serviço" onClose={() => setShowModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Scissors className="w-5 h-5 text-emerald-400" />
                {editingService ? 'Editar Serviço' : 'Adicionar Novo Serviço'}
              </h3>
              <button aria-label="Fechar janela" 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-4 sm:p-5 space-y-4">
                <div>
                  <label htmlFor="services-field-1" className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Serviço *
                  </label>
                  <input id="services-field-1"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Corte Degrade Navalhado"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="services-field-5" className="block text-xs font-semibold text-slate-300 mb-1">Descrição curta</label>
                  <textarea id="services-field-5" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={180} rows={2} placeholder="Ex.: Inclui café especial e cuidado facial express" className="w-full resize-none bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
                </div>

                <div>
                  <label htmlFor="services-field-6" className="block text-xs font-semibold text-slate-300 mb-1">Selo opcional</label>
                  <input id="services-field-6" type="text" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={40} placeholder="Ex.: Presente perfeito" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="services-field-2" className="block text-xs font-semibold text-slate-300 mb-1">
                      Preço (R$) *
                    </label>
                    <input id="services-field-2"
                      type="number"
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="45.00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="services-field-3" className="block text-xs font-semibold text-slate-300 mb-1">
                      Duração (Minutos) *
                    </label>
                    <input id="services-field-3"
                      type="number"
                      required
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="30"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="services-field-4" className="block text-xs font-semibold text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select id="services-field-4"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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
                <ActionButton
                  type="submit"
                  status={saveStatus}
                  loadingLabel="Salvando..."
                  successLabel="Salvo"
                  className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition-colors shadow-sm active:scale-95"
                >
                  {editingService ? 'Salvar Alterações' : 'Cadastrar Serviço'}
                </ActionButton>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
