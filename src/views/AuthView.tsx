import React, { useState } from 'react';
import { ArrowLeft, Building2, LogIn, UserPlus, Lock, Mail, Phone, User, Loader2, AlertCircle } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { Organization } from '../types';
import { INITIAL_SERVICES, INITIAL_BARBERS } from '../data/mockData';
import { CloudSyncPayload, loginBarbershop, registerBarbershop } from '../services/cloudSync';
import { getPublicAppOrigin } from '../config/urls';

interface AuthViewProps {
  onLogin: (data: CloudSyncPayload) => void;
  onRegister: (data: CloudSyncPayload) => void;
  savedOrganizations: Organization[];
  initialMode?: 'login' | 'register';
  onBack?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onLogin,
  onRegister,
  savedOrganizations,
  initialMode = 'login',
  onBack,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const publicBookingBase = `${getPublicAppOrigin().replace(/^https?:\/\//, '')}/agendar/`;

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Register Form
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [registerError, setRegisterError] = useState('');


  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSalonName(val);
    setSlug(generateSlug(val));
  };

  // LOGIN: autenticação validada no servidor. Sem cadastro ou sem senha correta, não entra.
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const emailTrimmed = loginEmail.trim().toLowerCase();
    const passTrimmed = loginPassword.trim();

    if (!emailTrimmed) {
      setLoginError('Informe o e-mail de acesso.');
      return;
    }
    if (!passTrimmed) {
      setLoginError('Informe sua senha de acesso.');
      return;
    }

    setIsLoadingCloud(true);
    try {
      const { data } = await loginBarbershop(emailTrimmed, passTrimmed);
      if (!data.org) throw new Error('Cadastro não encontrado.');

      localStorage.setItem('agendai_current_org', JSON.stringify(data.org));
      localStorage.setItem('agendai_all_orgs', JSON.stringify(data.savedOrgs || [data.org]));
      localStorage.setItem('agendai_services', JSON.stringify(data.services || []));
      localStorage.setItem('agendai_barbers', JSON.stringify(data.barbers || []));
      localStorage.setItem('agendai_appointments', JSON.stringify(data.appointments || []));
      localStorage.setItem('agendai_clients', JSON.stringify(data.clients || []));
      localStorage.setItem('agendai_session_active', 'true');
      if (data.current_user) localStorage.setItem('agendai_current_user', JSON.stringify(data.current_user));

      onLogin(data);
    } catch (error: any) {
      // Migração segura de cadastro antigo salvo neste aparelho: só migra se a senha antiga existir e for exatamente igual.
      const currentLocal = (() => {
        try {
          return JSON.parse(localStorage.getItem('agendai_current_org') || 'null') as Organization | null;
        } catch {
          return null;
        }
      })();
      const legacyOrg = savedOrganizations.find(org => org.email?.toLowerCase() === emailTrimmed)
        || (currentLocal?.email?.toLowerCase() === emailTrimmed ? currentLocal : null);

      if (error?.message === 'Cadastro não encontrado.' && legacyOrg?.password && legacyOrg.password === passTrimmed) {
        try {
          const cleanLegacyOrg: Organization = { ...legacyOrg };
          delete cleanLegacyOrg.password;
          const legacyPayload = {
            org: cleanLegacyOrg,
            savedOrgs: [cleanLegacyOrg],
            services: JSON.parse(localStorage.getItem('agendai_services') || '[]'),
            barbers: JSON.parse(localStorage.getItem('agendai_barbers') || '[]'),
            appointments: JSON.parse(localStorage.getItem('agendai_appointments') || '[]'),
            clients: JSON.parse(localStorage.getItem('agendai_clients') || '[]'),
          };
          const { data } = await registerBarbershop(legacyPayload, passTrimmed);
          if (data.org) {
            localStorage.setItem('agendai_current_org', JSON.stringify(data.org));
            localStorage.setItem('agendai_all_orgs', JSON.stringify(data.savedOrgs || [data.org]));
            localStorage.setItem('agendai_session_active', 'true');
            onLogin(data);
            return;
          }
        } catch (migrationError: any) {
          setLoginError(migrationError?.message || 'Não foi possível migrar o cadastro antigo.');
          return;
        }
      }

      localStorage.removeItem('agendai_session_active');
      localStorage.removeItem('agendai_current_org');
      setLoginError(error?.message || 'E-mail ou senha incorretos.');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // CADASTRO: conta criada no servidor, com verificação de e-mail/slug duplicado e senha protegida.
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    const emailTrimmed = email.trim().toLowerCase();
    const passTrimmed = password.trim();

    if (!salonName.trim() || !ownerName.trim() || !phone.trim() || !emailTrimmed || !passTrimmed) {
      setRegisterError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (passTrimmed.length < 6) {
      setRegisterError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setRegisterError('As senhas digitadas não coincidem.');
      return;
    }

    const newOrg: Organization = {
      id: 'org-' + Date.now(),
      name: salonName.trim(),
      owner_name: ownerName.trim(),
      email: emailTrimmed,
      slug: slug.trim().toLowerCase() || generateSlug(salonName),
      phone: phone.trim(),
      primary_color: '#10b981',
      open_hour: '08:00',
      close_hour: '20:00',
      break_enabled: false,
      break_start: '12:00',
      break_end: '14:00',
      closed_periods: [],
      tv_enabled: false,
      tv_media_type: 'institutional',
      tv_visual_mode: 'brand_products_queue',
      tv_animations: true,
      tv_show_client_names: false,
      tv_show_prices: false,
      tv_sound_enabled: true,
      tv_sound_volume: 70,
      tv_sound_style: 'bell',
      tv_notice: 'Obrigado pela preferência. Aguarde seu atendimento e fique à vontade!',
    };

    const initialServicesWithOrg = INITIAL_SERVICES.map(s => ({ ...s, org_id: newOrg.id }));
    const initialBarbersWithOrg = INITIAL_BARBERS.map(b => ({ ...b, org_id: newOrg.id }));
    const payload = {
      org: newOrg,
      savedOrgs: [newOrg],
      services: initialServicesWithOrg,
      barbers: initialBarbersWithOrg,
      appointments: [],
      clients: [],
    };

    setIsLoadingCloud(true);
    try {
      const { data } = await registerBarbershop(payload, passTrimmed);
      if (!data.org) throw new Error('Não foi possível concluir o cadastro.');

      localStorage.setItem('agendai_current_org', JSON.stringify(data.org));
      localStorage.setItem('agendai_all_orgs', JSON.stringify(data.savedOrgs || [data.org]));
      localStorage.setItem('agendai_services', JSON.stringify(data.services || []));
      localStorage.setItem('agendai_barbers', JSON.stringify(data.barbers || []));
      localStorage.setItem('agendai_appointments', JSON.stringify(data.appointments || []));
      localStorage.setItem('agendai_clients', JSON.stringify(data.clients || []));
      localStorage.setItem('agendai_session_active', 'true');

      onRegister(data);
    } catch (error: any) {
      localStorage.removeItem('agendai_session_active');
      localStorage.removeItem('agendai_current_org');
      setRegisterError(error?.message || 'Não foi possível criar a conta.');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  return (
    <div className="auth-view w-full max-w-md mx-auto py-4 sm:py-10 animate-fadeIn px-2 sm:px-0">
      <div className="relative bg-[#121B2E] border border-slate-800 rounded-3xl p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 transition hover:text-white sm:left-5 sm:top-5 min-w-[44px] min-h-[44px]"
            aria-label="Voltar para a apresentação do AgendAI"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {/* LOGO E CABEÇALHO */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-white rounded-full overflow-hidden flex items-center justify-center mx-auto border border-cyan-400/15 shadow-lg shadow-cyan-500/10 p-2">
            <BrandLogo variant="mark" className="w-full h-full" />
          </div>
          <div className="flex justify-center">
            <BrandLogo variant="full" className="h-10 w-auto max-w-[220px]" />
          </div>
          <p className="text-xs text-slate-400">
            Acesso Restrito ao Painel da Barbearia
          </p>
        </div>

        {/* ABAS: ENTRAR / CADASTRAR */}
        <div className="flex bg-[#0B1120] p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLoginError('');
            }}
            className={`w-1/2 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-[#FFC400] text-[#07111F] border border-[#FFE071]/70 shadow-[0_8px_22px_rgba(255,196,0,0.18)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setRegisterError('');
            }}
            className={`w-1/2 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-[#FFC400] text-[#07111F] border border-[#FFE071]/70 shadow-[0_8px_22px_rgba(255,196,0,0.18)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Cadastrar Novo
          </button>
        </div>

        {/* 1. FORMULÁRIO DE LOGIN (BLOQUEADO SEM CADASTRO E SENHA) */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fadeIn">
            <div>
              <label htmlFor="auth-field-1" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" /> E-mail Cadastrado *
              </label>
              <input id="auth-field-1"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu-email@exemplo.com"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-field-2" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" /> Senha *
              </label>
              <input id="auth-field-2"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoadingCloud}
              className="w-full py-3.5 bg-[#FFC400] hover:bg-[#FFD333] text-[#07111F] border border-[#FFE071]/70 font-bold rounded-xl text-sm transition-all shadow-[0_12px_30px_rgba(255,196,0,0.18)] flex items-center justify-center gap-2 active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121B2E] disabled:opacity-50"
            >
              {isLoadingCloud ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando Credenciais...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar no Painel</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* 2. FORMULÁRIO DE CADASTRO NOVO */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 animate-fadeIn">
            <div>
              <label htmlFor="auth-field-3" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Nome da Barbearia *
              </label>
              <input id="auth-field-3"
                type="text"
                required
                value={salonName}
                onChange={handleNameChange}
                placeholder="Ex: Barbearia Dom Pedro"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-field-4" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Seu Nome (Administrador) *
              </label>
              <input id="auth-field-4"
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex: Felipe Mateus"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-field-5" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp da Barbearia *
              </label>
              <input id="auth-field-5"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(84) 99999-0000"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-field-6" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" /> E-mail de Acesso *
              </label>
              <input id="auth-field-6"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="auth-field-7" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Senha *
                </label>
                <input id="auth-field-7"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="auth-field-8" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Confirmar *
                </label>
                <input id="auth-field-8"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Link Exclusivo (Slug)
              </label>
              <div className="flex items-center bg-[#0B1120] border border-slate-800 rounded-xl px-3 text-xs text-slate-400">
                <span className="shrink-0 whitespace-nowrap text-[10px] sm:text-xs">{publicBookingBase}</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="min-w-0 w-full bg-transparent border-0 text-emerald-400 py-2.5 text-xs focus:outline-none font-mono"
                />
              </div>
            </div>

            {registerError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{registerError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoadingCloud}
              className="w-full py-3.5 bg-[#FFC400] hover:bg-[#FFD333] text-[#07111F] border border-[#FFE071]/70 font-bold rounded-xl text-sm transition-all shadow-[0_12px_30px_rgba(255,196,0,0.18)] mt-2 active:scale-98 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121B2E] disabled:opacity-50"
            >
              {isLoadingCloud ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cadastrando na Nuvem...</span>
                </>
              ) : (
                <span>Criar Conta e Entrar</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-4 rounded-2xl bg-slate-950/30 border border-slate-800/70 px-4 py-4">
          <AgencyCredit centered />
        </div>
      </div>
    </div>
  );
};
