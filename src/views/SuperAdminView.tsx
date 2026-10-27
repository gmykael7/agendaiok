import { appConfirm } from '../components/common/ConfirmDialog';
import { Modal } from "../components/common/Modal";
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Building2, CheckCircle2, Clock3, ExternalLink, Loader2, LockKeyhole, 
  Search, ShieldCheck, Sparkles, UsersRound, Ban, CalendarDays, RefreshCw,
  LayoutDashboard, MessageSquare, Phone, Mail, User, Scissors, Tv,
  TrendingUp, X, Filter, ChevronRight, Award
} from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { BrandLoader } from '../components/common/AppLoader';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { SuperAdminNotices } from '../components/common/SuperAdminNotices';
import { clearAuthToken, getAuthToken } from '../services/cloudSync';
import { 
  bootstrapSuperAdmin, getSuperAdminStatus, listSuperAdminTenants, 
  superAdminLogin, SuperAdminTenant, TenantPlan, TenantStatus, 
  updateSuperAdminTenant 
} from '../services/superAdmin';
import { getClientBookingUrl, getTvDisplayUrl } from '../config/urls';
import { TEAM_PLAN_PRICE_LABEL } from '../utils/tenantPlan';

type SuperAdminTab = 'dashboard' | 'barbearias' | 'mensagens';
type StatusFilter = 'all' | 'active' | 'trial' | 'suspended';

const statusLabel: Record<TenantStatus, string> = { 
  active: 'Ativo', 
  trial: 'Em Teste', 
  suspended: 'Suspenso' 
};

const planLabel: Record<TenantPlan, string> = { 
  free: 'Grátis (1 barbeiro)', 
  team: `Equipe (${TEAM_PLAN_PRICE_LABEL})`, 
  trial: 'Teste (legado)', 
  basic: 'Básico', 
  professional: 'Profissional', 
  premium: 'Premium' 
};

export const SuperAdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('dashboard');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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
      if (status.authorized) {
        const list = await listSuperAdminTenants();
        setTenants(list);
      }
    } catch (e: any) {
      setAuthorized(false);
      setError(e?.message || 'Falha ao carregar o painel.');
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    void load(); 
  }, []);

  const filteredTenants = useMemo(() => {
    let list = tenants;
    if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(t => 
      `${t.name} ${t.owner_name || ''} ${t.email} ${t.phone || ''} ${t.slug}`
        .toLowerCase()
        .includes(q)
    );
  }, [tenants, query, statusFilter]);

  const totals = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    trial: tenants.filter(t => t.status === 'trial').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    clients: tenants.reduce((n, t) => n + (t.clients_count || 0), 0),
    appointments: tenants.reduce((n, t) => n + (t.appointments_count || 0), 0),
    barbers: tenants.reduce((n, t) => n + (t.barbers_count || 1), 0),
    services: tenants.reduce((n, t) => n + (t.services_count || 0), 0),
    freePlanCount: tenants.filter(t => t.plan === 'free').length,
    paidPlanCount: tenants.filter(t => t.plan !== 'free').length,
  }), [tenants]);

  const topTenants = useMemo(() => {
    return [...tenants]
      .sort((a, b) => (b.appointments_count || 0) - (a.appointments_count || 0))
      .slice(0, 5);
  }, [tenants]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setAuthLoading(true); 
    setError('');
    try { 
      await superAdminLogin(email.trim().toLowerCase(), password); 
      await load(); 
    } catch (err: any) { 
      setError(err?.message || 'Não foi possível entrar.'); 
    } finally { 
      setAuthLoading(false); 
    }
  };

  const handleBootstrap = async () => {
    setAuthLoading(true); 
    setError('');
    try { 
      const s = await bootstrapSuperAdmin(); 
      setAuthorized(s.authorized); 
      setConfigured(s.configured); 
      setCanBootstrap(false); 
      await load(); 
    } catch (err: any) { 
      setError(err?.message || 'Não foi possível ativar o Super Admin.'); 
    } finally { 
      setAuthLoading(false); 
    }
  };

  const saveTenant = async () => {
    if (!editing) return;
    const previous = tenants.find(t => t.email === editing.email);
    if (editing.status === 'suspended' && previous?.status !== 'suspended') {
      const confirmed = await appConfirm(
        `Suspender "${editing.name}"? A barbearia e seus clientes perderão o acesso ao agendamento até a reativação.`, 
        { danger: true }
      );
      if (!confirmed) return;
    }
    setSaving(true); 
    setError('');
    try {
      await updateSuperAdminTenant({ 
        email: editing.email, 
        status: editing.status, 
        plan: editing.plan, 
        due_date: editing.due_date 
      });
      setEditing(null); 
      await load();
    } catch (err: any) { 
      setError(err?.message || 'Falha ao salvar alterações.'); 
    } finally { 
      setSaving(false); 
    }
  };

  if (loading) {
    return (
      <div className="superadmin-view min-h-screen bg-[#070d18] text-white flex items-center justify-center p-6">
        <BrandLoader size={64} label="Carregando painel administrativo..." />
      </div>
    );
  }

  // TELA DE LOGIN / BOOTSTRAP DO SUPER ADMIN
  if (!authorized) {
    return (
      <div className="superadmin-view min-h-screen bg-[#070d18] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0d1728] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
            <BrandLogo variant="mark" className="w-10 h-10" />
          </div>
          <div className="text-center mt-5">
            <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-cyan-400">Agência G7</span>
            <h1 className="text-2xl font-black mt-1 text-white">Super Admin AgendAI</h1>
            <p className="text-xs text-slate-400 mt-2">Área exclusiva para gestão comercial e estabelecimentos da plataforma.</p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-800/50 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {!getAuthToken() ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">E-mail administrador</label>
                <input 
                  type="email" 
                  required
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="admin@seusalao.com" 
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Senha de acesso</label>
                <input 
                  type="password" 
                  required
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" 
                />
              </div>
              <button 
                type="submit"
                disabled={authLoading} 
                className="w-full rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-400/20"
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <LockKeyhole className="w-4 h-4"/>} 
                Entrar no Painel Global
              </button>
            </form>
          ) : canBootstrap ? (
            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-left">
              <p className="text-sm font-bold text-cyan-300">Ativar esta conta como Super Admin?</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Nenhum Super Admin foi definido ainda no banco. Esta conta assumirá a administração global de todas as barbearias.
              </p>
              <button 
                onClick={handleBootstrap} 
                disabled={authLoading} 
                className="mt-4 w-full rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black py-3 transition-all active:scale-95 shadow-md shadow-cyan-400/20"
              >
                Ativar Super Admin Agora
              </button>
            </div>
          ) : (
            <div className="mt-6 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto"/>
              <p className="text-sm font-bold text-white">Conta sem permissão global</p>
              <p className="text-xs text-slate-400">Faça login com a conta cadastrada como Super Admin.</p>
              <button 
                onClick={() => { clearAuthToken(); location.reload(); }} 
                className="text-xs text-cyan-400 underline font-semibold mt-2"
              >
                Trocar de Conta
              </button>
            </div>
          )}
          <AgencyCredit centered compact className="mt-6" />
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL DO SUPER ADMIN
  return (
    <div className="superadmin-view min-h-screen bg-[#070d18] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* CABEÇALHO SUPERIOR */}
        <header className="rounded-3xl border border-slate-800 bg-[#0d1728] p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <BrandLogo variant="mark" className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400">Agência G7</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                  <ShieldCheck className="w-3 h-3" /> Master
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">Super Admin AgendAI</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestão comercial, métricas consolidadas e suporte a todas as barbearias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button 
              onClick={() => void load()} 
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <a 
              href="/" 
              className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black transition-all active:scale-95 shadow-md shadow-cyan-400/20 flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Painel Barbearia</span>
            </a>
          </div>
        </header>

        {/* BARRA DE NAVEGAÇÃO: MENU À ESQUERDA | AÇÕES À DIREITA */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0d1728] p-2 sm:p-2.5 rounded-2xl border border-slate-800 shadow-md">
          {/* MENU DE ABAS À ESQUERDA */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none" aria-label="Navegação Super Admin">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('barbearias')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'barbearias'
                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Barbearias</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'barbearias' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {tenants.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('mensagens')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'mensagens'
                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Mensagens & Avisos</span>
            </button>
          </nav>

          {/* AÇÕES À DIREITA */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {activeTab === 'barbearias' && (
              <>
                {/* FILTROS POR STATUS */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors ${
                      statusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todas ({totals.total})
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors ${
                      statusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-emerald-400'
                    }`}
                  >
                    Ativas ({totals.active})
                  </button>
                  <button
                    onClick={() => setStatusFilter('trial')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors ${
                      statusFilter === 'trial' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    Teste ({totals.trial})
                  </button>
                  <button
                    onClick={() => setStatusFilter('suspended')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors ${
                      statusFilter === 'suspended' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    Suspensas ({totals.suspended})
                  </button>
                </div>

                {/* BUSCA RÁPIDA */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    value={query} 
                    onChange={e => setQuery(e.target.value)} 
                    placeholder="Buscar nome, email, slug..." 
                    className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-8 pr-7 py-2 text-xs text-white outline-none focus:border-cyan-400 placeholder:text-slate-500"
                  />
                  {query && (
                    <button 
                      onClick={() => setQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === 'dashboard' && (
              <div className="text-xs text-slate-400 flex items-center gap-2 px-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Super Admin: <strong className="text-white font-mono">{adminEmail || 'Ativo'}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* CONTEÚDO DAS ABAS */}

        {/* ABA 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* CARDS DE ESTATÍSTICAS PRINCIPAIS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                </div>
                <p className="text-3xl font-black text-white mt-3">{totals.total}</p>
                <p className="text-xs text-slate-400 mt-1">Barbearias Cadastradas</p>
                <div className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                  <span className="text-emerald-400">{totals.active} ativas</span> • 
                  <span className="text-amber-400">{totals.trial} teste</span> • 
                  <span className="text-rose-400">{totals.suspended} susp</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Ativas</span>
                </div>
                <p className="text-3xl font-black text-emerald-400 mt-3">{totals.active}</p>
                <p className="text-xs text-slate-400 mt-1">Em Operação Normal</p>
                <p className="text-[10px] text-slate-500 mt-2.5">
                  {totals.total ? `${Math.round((totals.active / totals.total) * 100)}% da base ativa` : '0%'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <UsersRound className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clientes</span>
                </div>
                <p className="text-3xl font-black text-white mt-3">{totals.clients}</p>
                <p className="text-xs text-slate-400 mt-1">Base Consolidada</p>
                <p className="text-[10px] text-slate-500 mt-2.5">Em todas as barbearias</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <CalendarDays className="w-5 h-5 text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horários</span>
                </div>
                <p className="text-3xl font-black text-white mt-3">{totals.appointments}</p>
                <p className="text-xs text-slate-400 mt-1">Agendamentos Totais</p>
                <p className="text-[10px] text-slate-500 mt-2.5">Volume processado</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-4 shadow-sm col-span-2 md:col-span-1">
                <div className="flex items-center justify-between">
                  <Scissors className="w-5 h-5 text-purple-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Equipe</span>
                </div>
                <p className="text-3xl font-black text-white mt-3">{totals.barbers}</p>
                <p className="text-xs text-slate-400 mt-1">Barbeiros na Plataforma</p>
                <p className="text-[10px] text-slate-500 mt-2.5">{totals.services} serviços catalogados</p>
              </div>
            </div>

            {/* SEÇÕES EM DUAS COLUNAS: RANKING E DISTRIBUIÇÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* TOP BARBEARIAS MAIS ATIVAS */}
              <div className="rounded-3xl border border-slate-800 bg-[#0d1728] p-5 sm:p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Barbearias com Maior Movimento
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Top 5 estabelecimentos por volume de agendamentos</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('barbearias')}
                    className="text-xs text-cyan-400 hover:underline font-semibold flex items-center gap-0.5"
                  >
                    Ver todas <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {topTenants.map((t, idx) => (
                    <div 
                      key={t.email} 
                      className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                          idx === 0 ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' :
                          idx === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                          idx === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{t.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">/{t.slug} • {t.owner_name || t.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <p className="text-xs font-black text-cyan-300 font-mono">{t.appointments_count}</p>
                          <p className="text-[10px] text-slate-500">agendamentos</p>
                        </div>
                        <button
                          onClick={() => setEditing({ ...t })}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 text-xs font-bold transition-all"
                        >
                          Gerenciar
                        </button>
                      </div>
                    </div>
                  ))}
                  {topTenants.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-6">Nenhum estabelecimento cadastrado ainda.</p>
                  )}
                </div>
              </div>

              {/* DISTRIBUIÇÃO COMERCIAL E PLANOS */}
              <div className="rounded-3xl border border-slate-800 bg-[#0d1728] p-5 sm:p-6 shadow-md flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Distribuição Comercial de Planos
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Adesão a planos pagos vs gratuitos</p>

                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-300">Plano Grátis (1 Barbeiro)</span>
                        <span className="text-slate-400 font-mono">{totals.freePlanCount} ({totals.total ? Math.round((totals.freePlanCount / totals.total) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-slate-500 rounded-full" 
                          style={{ width: `${totals.total ? (totals.freePlanCount / totals.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-cyan-300">Planos Equipe / Pagos</span>
                        <span className="text-cyan-400 font-mono">{totals.paidPlanCount} ({totals.total ? Math.round((totals.paidPlanCount / totals.total) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-cyan-400 rounded-full" 
                          style={{ width: `${totals.total ? (totals.paidPlanCount / totals.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Acesso Rápido</p>
                    <button 
                      onClick={() => { setStatusFilter('trial'); setActiveTab('barbearias'); }}
                      className="mt-1 text-xs font-bold text-amber-300 hover:underline block mx-auto"
                    >
                      Ver {totals.trial} em teste &rarr;
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Comunicação</p>
                    <button 
                      onClick={() => setActiveTab('mensagens')}
                      className="mt-1 text-xs font-bold text-cyan-300 hover:underline block mx-auto"
                    >
                      Enviar aviso global &rarr;
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ABA 2: BARBEARIAS (CARDS RESPONSIVOS: 3 OU 4 POR FILA NO DESKTOP) */}
        {activeTab === 'barbearias' && (
          <div className="space-y-4 animate-fadeIn">
            {/* INFORMAÇÃO DE RESULTADOS */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Mostrando <strong className="text-white font-mono">{filteredTenants.length}</strong> de <strong className="text-white font-mono">{tenants.length}</strong> barbearias
              </span>
              {(query || statusFilter !== 'all') && (
                <button
                  onClick={() => { setQuery(''); setStatusFilter('all'); }}
                  className="text-cyan-400 hover:underline font-semibold"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* GRADE DE CARDS (3 ou 4 por fila no computador dependendo do tamanho) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTenants.map((t) => {
                const isCurrentAdmin = t.email === adminEmail;
                const publicBookingUrl = getClientBookingUrl(t.slug);
                const tvUrl = getTvDisplayUrl(t.slug);

                return (
                  <div 
                    key={t.email} 
                    className="rounded-3xl border border-slate-800 bg-[#0d1728] p-5 shadow-sm hover:border-slate-700/90 transition-all flex flex-col justify-between group"
                  >
                    {/* TOPO DO CARD: NOME E STATUS */}
                    <div>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 font-black text-sm">
                            {t.name ? t.name.slice(0, 2).toUpperCase() : 'AB'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-base text-white truncate group-hover:text-cyan-300 transition-colors" title={t.name}>
                              {t.name}
                            </h3>
                            <a 
                              href={publicBookingUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[11px] text-slate-400 hover:text-cyan-400 truncate block font-mono"
                              title={`Abrir página pública: /${t.slug}`}
                            >
                              /{t.slug}
                            </a>
                          </div>
                        </div>

                        {/* STATUS BADGE */}
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                          t.status === 'active' 
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                            : t.status === 'trial'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}>
                          {statusLabel[t.status]}
                        </span>
                      </div>

                      {/* DETALHES DE CONTATO */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                        <p className="flex items-center gap-2 truncate" title={t.owner_name || 'Responsável não informado'}>
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{t.owner_name || 'Responsável não informado'}</span>
                        </p>
                        <p className="flex items-center gap-2 truncate" title={t.email}>
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate font-mono text-[11px]">{t.email}</span>
                        </p>
                        {t.phone ? (
                          <a 
                            href={`https://wa.me/55${t.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 truncate text-emerald-400 hover:underline"
                            title="Conversar no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-mono text-[11px]">{t.phone}</span>
                          </a>
                        ) : (
                          <p className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px]">Sem telefone informado</span>
                          </p>
                        )}
                      </div>

                      {/* PLANO E VENCIMENTO */}
                      <div className="mt-3.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Plano</p>
                          <p className="font-bold text-white text-[11px] mt-0.5">{planLabel[t.plan]}</p>
                        </div>
                        {t.due_date && t.plan !== 'free' && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Vencimento</p>
                            <p className="font-mono text-[11px] text-amber-300 font-semibold mt-0.5">
                              {t.due_date.split('-').reverse().join('/')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* MINI MÉTRICAS DA BARBEARIA */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 text-center">
                          <p className="text-[10px] uppercase font-bold text-slate-500">Clientes</p>
                          <p className="text-sm font-black text-white font-mono mt-0.5">{t.clients_count || 0}</p>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 text-center">
                          <p className="text-[10px] uppercase font-bold text-slate-500">Agendamentos</p>
                          <p className="text-sm font-black text-cyan-300 font-mono mt-0.5">{t.appointments_count || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* BOTÕES DE AÇÃO NO RODAPÉ DO CARD */}
                    <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center gap-2">
                      <button
                        onClick={() => setEditing({ ...t })}
                        className="flex-1 py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black text-center transition-all active:scale-95 shadow-sm shadow-cyan-400/20"
                      >
                        Gerenciar
                      </button>

                      <a
                        href={publicBookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        title="Abrir página pública de agendamento"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <a
                        href={tvUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        title="Abrir exibição em TV"
                      >
                        <Tv className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTenants.length === 0 && (
              <div className="rounded-3xl border border-slate-800 bg-[#0d1728] p-12 text-center text-slate-500 space-y-3">
                <Sparkles className="w-8 h-8 text-cyan-400 mx-auto" />
                <p className="text-base font-bold text-white">Nenhum estabelecimento encontrado</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Tente alterar os termos da busca ou redefinir os filtros de status.
                </p>
                <button
                  onClick={() => { setQuery(''); setStatusFilter('all'); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-cyan-400 text-xs font-bold hover:bg-slate-700 transition-colors"
                >
                  Limpar Busca e Filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: MENSAGENS E AVISOS */}
        {activeTab === 'mensagens' && (
          <div className="space-y-6 animate-fadeIn">
            <SuperAdminNotices tenants={tenants} />
          </div>
        )}

        <AgencyCredit centered />
      </div>

      {/* MODAL DE GERENCIAMENTO DA BARBEARIA */}
      {editing && (
        <Modal 
          label="Gerenciar barbearia" 
          onClose={() => setEditing(null)} 
          className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-700/90 bg-[#0d1728] p-5 sm:p-6 shadow-2xl relative text-white animate-scaleUp">
            <div className="flex justify-between items-start gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-cyan-400">Gerenciar Estabelecimento</span>
                <h3 className="text-xl font-black mt-1 text-white">{editing.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{editing.email}</p>
              </div>
              <button 
                onClick={() => setEditing(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status da Conta</label>
                <select 
                  value={editing.status} 
                  onChange={e => setEditing({ ...editing, status: e.target.value as TenantStatus })} 
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option value="active">Ativo (Acesso Liberado)</option>
                  <option value="trial">Em Teste</option>
                  <option value="suspended" disabled={editing.email === adminEmail}>
                    Suspenso (Bloqueado)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Plano</label>
                <select 
                  value={editing.plan} 
                  onChange={e => setEditing({ ...editing, plan: e.target.value as TenantPlan })} 
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option value="free">Grátis · 1 barbeiro</option>
                  <option value="team">Equipe · {TEAM_PLAN_PRICE_LABEL}</option>
                  <option value="trial">Teste (legado)</option>
                  <option value="basic">Básico</option>
                  <option value="professional">Profissional</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Data de Vencimento</label>
                <input 
                  type="date" 
                  disabled={editing.plan === 'free'} 
                  value={editing.plan === 'free' ? '' : editing.due_date || ''} 
                  onChange={e => setEditing({ ...editing, due_date: e.target.value })} 
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-40"
                />
                {editing.plan === 'free' && (
                  <span className="text-[11px] text-slate-500 mt-1 block">O plano grátis não possui cobrança ou vencimento.</span>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5 text-xs text-slate-400 leading-relaxed">
              {editing.email === adminEmail 
                ? 'ℹ️ Esta é a sua conta de Super Admin e está protegida contra suspensão acidental.' 
                : '⚠️ Ao suspender uma barbearia, o login administrativo, agendamentos públicos e a exibição de TV são imediatamente pausados.'}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-800">
              <a 
                href={getTvDisplayUrl(editing.slug)} 
                target="_blank" 
                rel="noreferrer" 
                className="flex-1 text-center rounded-xl border border-slate-700/80 py-3 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                Abrir TV
              </a>
              <button 
                onClick={saveTenant} 
                disabled={saving} 
                className="flex-1 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 py-3 text-xs font-black transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-cyan-400/20"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
