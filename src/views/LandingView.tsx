import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  Clock3,
  DollarSign,
  Globe2,
  LogIn,
  MessageCircleMore,
  MonitorPlay,
  Scissors,
  Sparkles,
  UserPlus,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AgencyCredit } from '../components/common/AgencyCredit';

interface LandingViewProps {
  onLogin: () => void;
  onRegister: () => void;
}

const features = [
  {
    Icon: CalendarCheck2,
    title: 'Agenda inteligente',
    description: 'Organize horários, profissionais, serviços e intervalos em uma visão simples.',
  },
  {
    Icon: UserRoundCheck,
    title: 'Atendimento em tempo real',
    description: 'Acompanhe quem chegou, quem está sendo atendido e o que vem a seguir.',
  },
  {
    Icon: UsersRound,
    title: 'Relacionamento com clientes',
    description: 'Histórico, preferências e mensagens prontas para confirmação e retorno.',
  },
  {
    Icon: DollarSign,
    title: 'Caixa e resultados',
    description: 'Visualize faturamento, comissões, serviços e produtos em um só lugar.',
  },
  {
    Icon: Globe2,
    title: 'Página pública própria',
    description: 'Receba agendamentos online com a identidade visual do seu estabelecimento.',
  },
  {
    Icon: MonitorPlay,
    title: 'AgendAI TV',
    description: 'Transforme a TV da recepção em um painel moderno para clientes e equipe.',
  },
];

const steps = [
  ['01', 'Crie sua conta', 'Cadastre sua barbearia e personalize as cores, a logo e os horários.'],
  ['02', 'Monte sua operação', 'Adicione profissionais, serviços, produtos e regras de atendimento.'],
  ['03', 'Compartilhe e gerencie', 'Envie seu link aos clientes e acompanhe tudo pelo painel.'],
];

export const LandingView: React.FC<LandingViewProps> = ({ onLogin, onRegister }) => (
  <div className="landing-view min-h-screen overflow-x-hidden bg-[#050912] text-white font-sans selection:bg-[#FFC400] selection:text-[#07111F]">
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-48 left-[8%] h-[30rem] w-[30rem] rounded-full bg-[#FFC400]/[0.06] blur-3xl" />
      <div className="absolute top-[20rem] -right-52 h-[34rem] w-[34rem] rounded-full bg-cyan-400/[0.07] blur-3xl" />
      <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
    </div>

    <header className="relative z-20 border-b border-white/[0.07] bg-[#050912]/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#inicio" className="flex items-center gap-3" aria-label="AgendAI — início">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-white/15 bg-white p-1 shadow-lg shadow-[#FFC400]/10">
            <BrandLogo variant="mark" className="h-full w-full" />
          </div>
          <BrandLogo variant="full" className="h-7 w-auto sm:h-8" />
        </a>

        <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-400 md:flex" aria-label="Navegação da apresentação">
          <a href="#recursos" className="transition hover:text-white">Recursos</a>
          <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
          <a href="#comecar" className="transition hover:text-white">Começar</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLogin}
            aria-label="Entrar na minha conta"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-xs font-bold text-white transition hover:border-white/30 hover:bg-white/[0.08] sm:px-5"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Entrar</span>
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#FFE071]/70 bg-[#FFC400] px-4 text-xs font-black text-[#07111F] shadow-[0_10px_28px_rgba(255,196,0,0.18)] transition hover:bg-[#FFD333] sm:px-5"
          >
            <UserPlus className="h-4 w-4" />
            Criar conta
          </button>
        </div>
      </div>
    </header>

    <main className="relative z-10">
      <section id="inicio" className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="max-w-2xl animate-riseIn">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FFC400]/25 bg-[#FFC400]/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFD84A]">
            <Sparkles className="h-3.5 w-3.5" />
            Gestão completa para barbearias
          </div>
          <h1 className="text-4xl font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-5xl lg:text-[4rem]">
            Sua barbearia organizada. <span className="text-[#FFC400]">Seus clientes voltando.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Agenda online, atendimentos, clientes, caixa, equipe e painel de recepção em uma experiência simples para você trabalhar melhor todos os dias.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRegister}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#FFE071]/70 bg-[#FFC400] px-6 py-3.5 text-sm font-black text-[#07111F] shadow-[0_16px_36px_rgba(255,196,0,0.2)] transition hover:bg-[#FFD333] active:scale-[.98]"
            >
              Criar minha conta <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.045] px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.08] active:scale-[.98]"
            >
              Já tenho uma conta
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-slate-400">
            {['Acesso pelo celular', 'Página própria', 'Dados sincronizados'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#FFC400]" />{item}</span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[590px] animate-riseIn [animation-delay:100ms]">
          <div aria-hidden="true" className="absolute -inset-6 rounded-[3rem] bg-[#FFC400]/[0.055] blur-2xl" />
          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.11] bg-[#0B1424] p-3 shadow-[0_36px_90px_rgba(0,0,0,0.44)] sm:p-4">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-2 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFC400]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Painel AgendAI</span>
            </div>

            <div className="grid gap-3 pt-3 sm:grid-cols-[1fr_1.15fr]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Hoje</span>
                    <CalendarCheck2 className="h-4 w-4 text-cyan-300" />
                  </div>
                  <p className="mt-3 text-3xl font-black tracking-tight text-white">12</p>
                  <p className="mt-1 text-[10px] text-slate-400">agendamentos confirmados</p>
                </div>
                <div className="rounded-2xl border border-[#FFC400]/20 bg-[#FFC400]/[0.07] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#FFD84A]">Faturamento</span>
                    <DollarSign className="h-4 w-4 text-[#FFC400]" />
                  </div>
                  <p className="mt-3 text-xl font-black text-white">R$ 1.280,00</p>
                  <p className="mt-1 text-[10px] text-slate-400">resultado do dia</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#07101D] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300">Em atendimento</p>
                    <p className="mt-1 text-xs font-black text-white">Movimento de agora</p>
                  </div>
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10">
                    <span className="absolute inset-1 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
                    <Scissors className="h-3.5 w-3.5 text-cyan-200" />
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    ['Matheus Silva', 'Corte degradê', '16:00', true],
                    ['Lucas Ferreira', 'Barba completa', '16:40', false],
                    ['André Santos', 'Corte + barba', '17:20', false],
                  ].map(([name, service, time, active]) => (
                    <div key={String(name)} className={`flex items-center gap-3 rounded-xl border p-2.5 ${active ? 'border-cyan-300/25 bg-cyan-300/[0.07]' : 'border-white/[0.06] bg-white/[0.025]'}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${active ? 'bg-cyan-300 text-[#07111F]' : 'bg-white/[0.07] text-slate-300'}`}>{String(name).charAt(0)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-white">{name}</p>
                        <p className="truncate text-[9px] text-slate-500">{service}</p>
                      </div>
                      <span className="text-[10px] font-black text-slate-300">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC400]">Tudo conectado</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Menos improviso. Mais controle.</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">As ferramentas essenciais para cuidar da operação e da experiência dos seus clientes.</p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ Icon, title, description }) => (
              <article key={title} className="group rounded-3xl border border-white/[0.08] bg-white/[0.028] p-5 transition hover:-translate-y-0.5 hover:border-[#FFC400]/20 hover:bg-white/[0.045] sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FFC400]/20 bg-[#FFC400]/[0.08] text-[#FFC400] transition group-hover:bg-[#FFC400]/[0.12]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC400]">Comece com facilidade</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Da conta criada à agenda funcionando.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">Uma configuração direta para colocar sua operação no lugar e começar a receber clientes.</p>
          </div>

          <div className="space-y-3">
            {steps.map(([number, title, description]) => (
              <article key={number} className="flex gap-4 rounded-3xl border border-white/[0.08] bg-[#0B1424]/75 p-5 sm:gap-6 sm:p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFC400] text-xs font-black text-[#07111F]">{number}</span>
                <div>
                  <h3 className="text-base font-black text-white">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="comecar" className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-[#FFC400]/20 bg-[#0B1424] px-5 py-10 text-center shadow-[0_28px_80px_rgba(0,0,0,0.28)] sm:px-10 sm:py-14">
          <div aria-hidden="true" className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFC400]/10 blur-3xl" />
          <div className="relative">
            <BadgeCheck className="mx-auto h-9 w-9 text-[#FFC400]" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Pronto para modernizar sua barbearia?</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">Crie sua conta, configure seu espaço e comece a organizar seus atendimentos.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={onRegister} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#FFE071]/70 bg-[#FFC400] px-6 text-sm font-black text-[#07111F] transition hover:bg-[#FFD333]">
                Criar conta agora <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={onLogin} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08]">
                <LogIn className="h-4 w-4" /> Entrar no painel
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="relative z-10 border-t border-white/[0.07] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
        <div className="flex items-center gap-3">
          <BrandLogo variant="full" className="h-7 w-auto" />
              <span className="hidden text-[10px] text-slate-400 sm:inline">Gestão & agendamento para barbearias</span>
        </div>
        <AgencyCredit compact centered className="border-0 pt-0" />
      </div>
    </footer>
  </div>
);
