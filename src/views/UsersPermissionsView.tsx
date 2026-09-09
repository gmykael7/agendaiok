import { Modal } from "../components/common/Modal";
import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, ShieldCheck, Trash2, UserCog, Users, X, Eye, EyeOff, Save, UserRoundCheck, Sparkles } from 'lucide-react';
import { Barber, CurrentUser, StaffPermissions, StaffRole, StaffUser } from '../types';
import { loadStaffUsers, saveStaffUser } from '../services/cloudSync';

const preset = (role: StaffRole): StaffPermissions => role === 'admin'
  ? { dashboard:true, atendimentos:true, agenda:true, caixa:true, clientes:true, relatorios:true, ajustes:true, equipe:true, usuarios:false, products:true }
  : { dashboard:true, atendimentos:true, agenda:true, caixa:false, clientes:true, relatorios:false, ajustes:false, equipe:false, usuarios:false, products:false };

const permissionLabels: Array<[keyof StaffPermissions, string]> = [
  ['dashboard','Dashboard'], ['atendimentos','Atendimentos'], ['agenda','Agenda'], ['caixa','Caixa'],
  ['clientes','Clientes'], ['products','Produtos & vendas'], ['relatorios','Relatórios'], ['ajustes','Ajustes gerais'], ['equipe','Equipe e comissões'], ['usuarios','Usuários e permissões'],
];

export const UsersPermissionsView: React.FC<{ barbers: Barber[]; currentUser?: CurrentUser }> = ({ barbers, currentUser }) => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<StaffRole>('barber');
  const [active, setActive] = useState(true);
  const [barberId, setBarberId] = useState('');
  const [permissions, setPermissions] = useState<StaffPermissions>(preset('barber'));
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true); setError('');
    try { const data = await loadStaffUsers(); setUsers(Array.isArray(data.users) ? data.users : []); }
    catch (e:any) { setError(e.message || 'Falha ao carregar usuários.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const openNew = () => {
    setEditing(null); setName(''); setEmail(''); setPassword(''); setRole('barber'); setActive(true); setBarberId(''); setPermissions(preset('barber')); setModalOpen(true);
  };
  const openEdit = (user: StaffUser) => {
    setEditing(user); setName(user.name); setEmail(user.email); setPassword(''); setRole(user.role); setActive(user.active !== false); setBarberId(user.barber_id || ''); setPermissions(user.permissions || preset(user.role)); setModalOpen(true);
  };
  const changeRole = (next: StaffRole) => { setRole(next); setPermissions(preset(next)); if (next !== 'barber') setBarberId(''); };
  const submit = async () => {
    if (!name.trim() || !email.trim()) return setError('Informe nome e e-mail.');
    if (!editing && password.length < 6) return setError('A senha inicial precisa ter pelo menos 6 caracteres.');
    if (role === 'barber' && !barberId) return setError('Vincule o usuário a um barbeiro da equipe.');
    setSaving(true); setError('');
    try {
      const result = await saveStaffUser({ action:'save', name:name.trim(), email:email.trim().toLowerCase(), password, role, active, barber_id: barberId || undefined, permissions });
      setUsers(result.users || []); setModalOpen(false);
    } catch(e:any) { setError(e.message || 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };
  const remove = async (user: StaffUser) => {
    if (!confirm(`Excluir o acesso de ${user.name}?`)) return;
    try { const result = await saveStaffUser({ action:'delete', email:user.email }); setUsers(result.users || []); }
    catch(e:any) { setError(e.message || 'Não foi possível excluir.'); }
  };

  const activeCount = useMemo(() => users.filter(u => u.active !== false).length, [users]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-3xl border border-slate-800 bg-[#121B2E] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Usuários & Permissões
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Crie acessos separados para administradores e barbeiros, sem compartilhar a senha do proprietário.
          </p>
        </div>
        <button onClick={openNew} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 active:scale-95 shrink-0">
          <Plus className="w-4 h-4" />
          Novo usuário
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Usuários adicionais</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{users.length}</p>
        </div>
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5 shadow-sm" style={{ animationDelay: '40ms' }}>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Ativos</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono">{activeCount}</p>
        </div>
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5 col-span-2 sm:col-span-1 shadow-sm" style={{ animationDelay: '80ms' }}>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Seu acesso</p>
          <p className="text-sm font-bold text-cyan-300 mt-2">{currentUser?.role === 'owner' ? 'Proprietário' : currentUser?.role === 'admin' ? 'Administrador' : 'Barbeiro'}</p>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">{error}</div>}
      {loading ? <div className="text-sm text-slate-400 p-6">Carregando usuários...</div> : users.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 sm:p-12 text-center max-w-md mx-auto space-y-3 shadow-xl bg-[#121B2E]">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-white text-base">Nenhum usuário adicional</h4>
          <p className="text-xs text-slate-400">O proprietário continua com acesso total. Crie um acesso para sua equipe quando precisar.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((user, index) => (
            <div key={user.id || user.email} style={{ animationDelay: `${index * 40}ms` }} className="stagger-item booking-card rounded-3xl border border-slate-800 bg-[#10192b] p-5 sm:p-6 shadow-md hover:border-emerald-500/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-white truncate text-base">{user.name}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                </div>
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${user.active !== false ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25' : 'bg-rose-400/10 text-rose-300 border-rose-400/25'}`}>
                  {user.active !== false ? 'Ativo' : 'Desativado'}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <UserRoundCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 font-semibold">{user.role === 'admin' ? 'Administrador' : 'Barbeiro'}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {permissionLabels.filter(([key]) => user.permissions?.[key]).slice(0, 5).map(([key, label]) => (
                  <span key={key} className="text-[9px] px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex gap-2 pt-3 border-t border-slate-800/80">
                <button onClick={() => openEdit(user)} className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors active:scale-95">
                  <UserCog className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button onClick={() => remove(user)} className="px-3 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/30 text-rose-300 transition-colors active:scale-95">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal label="Cadastro de usuário" onClose={() => setModalOpen(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal-shell-fixed w-full max-w-xl max-h-[92dvh] rounded-3xl border border-slate-700 bg-[#0d1729] shadow-2xl">
            <div className="modal-static-header flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 bg-[#0d1729]">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Acesso da equipe</p>
                <h4 className="text-lg sm:text-xl font-black text-white mt-0.5">{editing ? 'Editar usuário' : 'Novo usuário'}</h4>
              </div>
              <button aria-label="Fechar janela" onClick={() => setModalOpen(false)} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-scroll-body p-4 sm:p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-300 font-semibold">Nome
                  <input value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
                </label>
                <label className="text-xs text-slate-300 font-semibold">E-mail
                  <input type="email" value={email} disabled={!!editing} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white disabled:opacity-60 focus:outline-none focus:border-emerald-500" />
                </label>
                <label className="text-xs text-slate-300 font-semibold sm:col-span-2">{editing ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial'}
                  <div className="relative mt-1.5">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 pr-10 text-white focus:outline-none focus:border-emerald-500" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => changeRole('admin')} className={`p-3.5 rounded-2xl border text-left transition-all ${role === 'admin' ? 'border-emerald-500/40 bg-emerald-500/10 shadow-sm' : 'border-slate-800 bg-slate-950/50'}`}>
                  <p className="font-bold text-white text-sm">Administrador</p>
                  <p className="text-[10px] text-slate-400 mt-1">Gestão quase completa.</p>
                </button>
                <button type="button" onClick={() => changeRole('barber')} className={`p-3.5 rounded-2xl border text-left transition-all ${role === 'barber' ? 'border-emerald-500/40 bg-emerald-500/10 shadow-sm' : 'border-slate-800 bg-slate-950/50'}`}>
                  <p className="font-bold text-white text-sm">Barbeiro</p>
                  <p className="text-[10px] text-slate-400 mt-1">Operação restrita.</p>
                </button>
              </div>
              {role === 'barber' && (
                <label className="block text-xs text-slate-300 font-semibold">
                  Profissional vinculado
                  <select value={barberId} onChange={e => setBarberId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500">
                    <option value="">Selecione...</option>
                    {barbers.filter(b => b.active !== false).map(b => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </label>
              )}
              <div>
                <p className="text-xs font-bold text-white mb-2">Permissões</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {permissionLabels.map(([key, label]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setPermissions(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs transition-all ${permissions[key] ? 'border-emerald-400/35 bg-emerald-400/10 text-white shadow-sm' : 'border-slate-800 bg-slate-950/50 text-slate-400'}`}
                    >
                      <span className="font-semibold">{label}</span>
                      <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${permissions[key] ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                        <span className={`block w-3 h-3 bg-white rounded-full transition-transform ${permissions[key] ? 'translate-x-4' : ''}`} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setActive(v => !v)} className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-white font-bold">Acesso ativo</span>
                <span className={`w-10 h-5 rounded-full p-0.5 transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${active ? 'translate-x-5' : ''}`} />
                </span>
              </button>
            </div>
            <div className="modal-static-footer flex justify-end gap-2 border-t border-slate-800 bg-[#0d1729] p-4 sm:p-5">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button disabled={saving} onClick={submit} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-sm">
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar usuário'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
