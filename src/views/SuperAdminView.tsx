import { appConfirm } from '../components/common/ConfirmDialog';
import { Modal } from "../components/common/Modal";
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock3, ExternalLink, Loader2, LockKeyhole, Search, ShieldCheck, Sparkles, UsersRound, Ban, CalendarDays, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { BrandLoader } from '../components/common/AppLoader';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { SuperAdminNotices } from '../components/common/SuperAdminNotices';
import { clearAuthToken, getAuthToken } from '../services/cloudSync';
import { bootstrapSuperAdmin, getSuperAdminStatus, listSuperAdminTenants, superAdminLogin, SuperAdminTenant, TenantPlan, TenantStatus, updateSuperAdminTenant } from '../services/superAdmin';
import { getClientBookingUrl, getTvDisplayUrl } from '../config/urls';

const statusLabel: Record<TenantStatus, string> = { active: 'Ativo', trial: 'Teste', suspended: 'Suspenso' };
const planLabel: Record<TenantPlan, string> = { trial: 'Teste', basic: 'Básico', professional: 'Profissional', premium: 'Premium' };

export const SuperAdminView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SuperAdminTenant | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const status = await getSuperAdminStatus();
      setAuthorized(status.authorized);
      setCanBootstrap(status.canBootstrap);
      setConfigured(status.configured);
      setAdminEmail(status.email || '');
      if (status.authorized) setTenants(await listSuperAdminTenants());
    } catch (e: any) {
      setAuthorized(false);
      setError(e?.message || 'Falha ao carregar o painel.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t => `${t.name} ${t.owner_name || ''} ${t.email} ${t.phone || ''} ${t.slug}`.toLowerCase().includes(q));
  }, [tenants, query]);

  const totals = useMemo(() => ({
    active: tenants.filter(t => t.status === 'active').length,
    trial: tenants.filter(t => t.status === 'trial').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    clients: tenants.reduce((n, t) => n + t.clients_count, 0),
    appointments: tenants.reduce((n, t) => n + t.appointments_count, 0),
  }), [tenants]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setError('');
    try { await superAdminLogin(email.trim().toLowerCase(), password); await load(); }
    catch (err: any) { setError(err?.message || 'Não foi possível entrar.'); }
    finally { setAuthLoading(false); }
  };

  const handleBootstrap = async () => {
    setAuthLoading(true); setError('');
    try { const s = await bootstrapSuperAdmin(); setAuthorized(s.authorized); setConfigured(s.configured); setCanBootstrap(false); await load(); }
    catch (err: any) { setError(err?.message || 'Não foi possível ativar o Super Admin.'); }
    finally { setAuthLoading(false); }
  };

  const saveTenant = async () => {
    if (!editing) return;
    const previous = tenants.find(t => t.email === editing.email);
    // Suspender uma barbearia bloqueia o acesso dos clientes dela: exige confirmação.
    if (editing.status === 'suspended' && previous?.status !== 'suspended') {
      const confirmed = await appConfirm(`Suspender "${editing.name}"? A barbearia perde o acesso ao painel até ser reativada.`, { danger: true });
      if (!confirmed) return;
    }
    setSaving(true); setError('');
    try {
      await updateSuperAdminTenant({ email: editing.email, status: editing.status, plan: editing.plan, due_date: editing.due_date });
      setEditing(null); await load();
    } catch (err: any) { setError(err?.message || 'Falha ao salvar.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="superadmin-view min-h-[60dvh] bg-[#061120] text-white flex items-center justify-center p-6"><BrandLoader size={64} label="Carregando painel" /></div>;

  if (!authorized) {
    return (
      <div className="superadmin-view min-h-screen bg-[#061120] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[30px] border border-slate-800 bg-[#0b1628] p-6 sm:p-8 shadow-2xl">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white p-2 mx-auto"><BrandLogo variant="mark" className="w-full h-full" /></div>
          <div className="text-center mt-5"><p className="text-[11px] tracking-[0.3em] uppercase text-cyan-300">Agência G7</p><h1 className="text-2xl font-black mt-2">Super Admin AgendAI</h1><p className="text-xs text-slate-400 mt-2">Área exclusiva para gestão dos estabelecimentos da plataforma.</p></div>
          {error && <div className="mt-4 rounded-xl border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">{error}</div>}
          {!getAuthToken() ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-3">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail administrador" className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
              <button disabled={authLoading} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-black py-3 flex items-center justify-center gap-2">{authLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <LockKeyhole className="w-4 h-4"/>} Entrar</button>
            </form>
          ) : canBootstrap ? (
            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="text-sm font-bold">Ativar esta conta como Super Admin?</p>
              <p className="text-xs text-slate-400 mt-1">Nenhum Super Admin foi definido ainda. Esta conta proprietária pode assumir a administração global inicial. Depois da ativação, o acesso fica vinculado somente a ela.</p>
              <button onClick={handleBootstrap} disabled={authLoading} className="mt-4 w-full rounded-xl bg-cyan-400 text-slate-950 font-black py-3">Ativar Super Admin</button>
            </div>
          ) : (
            <div className="mt-6 text-center"><ShieldCheck className="w-10 h-10 text-slate-500 mx-auto"/><p className="text-sm font-bold mt-3">Conta sem permissão global</p><p className="text-xs text-slate-500 mt-1">Entre com a conta definida como Super Admin.</p><button onClick={()=>{clearAuthToken(); location.reload();}} className="mt-4 text-xs text-cyan-300">Trocar conta</button></div>
          )}
          <AgencyCredit centered compact className="mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="superadmin-view min-h-screen bg-[#061120] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-[#0b1628] p-5">
          <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-full overflow-hidden bg-white p-2"><BrandLogo variant="mark" className="w-full h-full"/></div><div><p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Agência G7</p><h1 className="text-2xl font-black">Super Admin AgendAI</h1><p className="text-xs text-slate-400">Gestão comercial e operacional da plataforma</p></div></div>
          <div className="flex gap-2"><button onClick={()=>void load()} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Atualizar</button><a href="/" className="px-3 py-2 rounded-xl bg-cyan-400 text-slate-950 text-xs font-black">Painel normal</a></div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['Ativos', totals.active, CheckCircle2, 'text-emerald-300'], ['Em teste', totals.trial, Clock3, 'text-amber-300'], ['Suspensos', totals.suspended, Ban, 'text-rose-300'], ['Clientes', totals.clients, UsersRound, 'text-cyan-300'], ['Agendamentos', totals.appointments, CalendarDays, 'text-blue-300']
          ].map(([label,value,Icon,color]: any)=><div key={label} className="rounded-2xl border border-slate-800 bg-[#0b1628] p-4"><Icon className={`w-5 h-5 ${color}`}/><p className="text-3xl font-black mt-4">{value}</p><p className="text-xs text-slate-500 mt-1">{label}</p></div>)}
        </section>

        <SuperAdminNotices tenants={tenants} />

        <section className="rounded-3xl border border-slate-800 bg-[#0b1628] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-center justify-between"><div><h2 className="font-black text-lg">Estabelecimentos</h2><p className="text-xs text-slate-500">{tenants.length} conta(s) cadastrada(s)</p></div><div className="relative w-full sm:w-80"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Buscar barbearia por nome, telefone ou e-mail" placeholder="Buscar nome, telefone ou e-mail" className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-cyan-400"/></div></div>
          <div className="divide-y divide-slate-800">
            {filtered.map(t => <div key={t.email} className="p-4 sm:p-5 grid lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(110px,.5fr))_auto] gap-4 items-center">
              <div className="min-w-0"><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-cyan-300 shrink-0"/><p className="font-bold truncate">{t.name}</p></div><p className="text-[11px] text-slate-500 mt-1 truncate">{t.owner_name || 'Responsável não informado'} • {t.email}</p><p className="text-[11px] text-slate-600 truncate">{t.phone || 'Sem telefone'} • /{t.slug}</p></div>
              <div><p className="text-[10px] uppercase text-slate-600">Status</p><span className={`inline-flex mt-1 text-xs font-black rounded-full px-2.5 py-1 ${t.status==='active'?'bg-emerald-400/10 text-emerald-300':t.status==='trial'?'bg-amber-400/10 text-amber-300':'bg-rose-400/10 text-rose-300'}`}>{statusLabel[t.status]}</span></div>
              <div><p className="text-[10px] uppercase text-slate-600">Plano</p><p className="text-xs font-bold mt-1">{planLabel[t.plan]}</p></div>
              <div><p className="text-[10px] uppercase text-slate-600">Clientes</p><p className="text-lg font-black mt-1">{t.clients_count}</p></div>
              <div><p className="text-[10px] uppercase text-slate-600">Agendamentos</p><p className="text-lg font-black mt-1">{t.appointments_count}</p></div>
              <div className="flex flex-wrap gap-2 lg:justify-end"><a href={getClientBookingUrl(t.slug)} target="_blank" rel="noreferrer" className="p-2 rounded-xl border border-slate-700 text-slate-300" title="Página pública"><ExternalLink className="w-4 h-4"/></a><button onClick={()=>setEditing({...t})} className="px-3 py-2 rounded-xl bg-cyan-400 text-slate-950 text-xs font-black">Gerenciar</button></div>
            </div>)}
            {filtered.length===0 && <div className="py-14 text-center text-slate-500"><Sparkles className="w-8 h-8 mx-auto mb-2"/><p className="text-sm">Nenhum estabelecimento encontrado.</p></div>}
          </div>
        </section>
        <AgencyCredit centered />
      </div>

      {editing && <Modal label="Gerenciar barbearia" onClose={() => setEditing(null)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0b1628] p-5 shadow-2xl"><div className="flex justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Gerenciar conta</p><h3 className="text-xl font-black mt-1">{editing.name}</h3><p className="text-xs text-slate-500 mt-1">{editing.email}</p></div><button onClick={()=>setEditing(null)} className="text-slate-400">✕</button></div><div className="grid sm:grid-cols-2 gap-4 mt-6"><label className="text-xs text-slate-400">Status<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as TenantStatus})} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-3 text-white"><option value="active">Ativo</option><option value="trial">Teste</option><option value="suspended" disabled={editing.email === adminEmail}>Suspenso</option></select></label><label className="text-xs text-slate-400">Plano<select value={editing.plan} onChange={e=>setEditing({...editing,plan:e.target.value as TenantPlan})} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-3 text-white"><option value="trial">Teste</option><option value="basic">Básico</option><option value="professional">Profissional</option><option value="premium">Premium</option></select></label><label className="text-xs text-slate-400 sm:col-span-2">Vencimento<input type="date" value={editing.due_date || ''} onChange={e=>setEditing({...editing,due_date:e.target.value})} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-3 text-white"/></label></div><div className="mt-5 rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-xs text-slate-400">{editing.email === adminEmail ? 'Esta é a conta do Super Admin e não pode ser suspensa. Se estiver suspensa, altere o status para Ativo e salve.' : 'Suspender bloqueia login administrativo, página pública, TV e novos agendamentos até a reativação.'}</div><div className="flex gap-2 mt-5"><a href={getTvDisplayUrl(editing.slug)} target="_blank" rel="noreferrer" className="flex-1 text-center rounded-xl border border-slate-700 py-3 text-xs font-bold">Abrir TV</a><button onClick={saveTenant} disabled={saving} className="flex-1 rounded-xl bg-cyan-400 text-slate-950 py-3 text-xs font-black">{saving?'Salvando...':'Salvar alterações'}</button></div></div></Modal>}
    </div>
  );
};
