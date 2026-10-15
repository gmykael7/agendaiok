import React, { useMemo, useState } from 'react';
import { CalendarCheck2, Check, RotateCcw, Scissors, ShoppingBag, UsersRound } from 'lucide-react';

const services = [
  { name: 'Corte degradê', category: 'Cabelo', time: '40 min', price: 'R$ 45,00' },
  { name: 'Barba completa', category: 'Barba', time: '30 min', price: 'R$ 35,00' },
  { name: 'Corte + barba', category: 'Combos', time: '60 min', price: 'R$ 70,00' },
];
const categories = ['Todos', 'Cabelo', 'Barba', 'Combos'] as const;

export function LandingProductPreview() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('Todos');
  const [selected, setSelected] = useState<string[]>([]);
  const visibleServices = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return services.filter((service) => (category === 'Todos' || service.category === category) && (!term || service.name.toLocaleLowerCase('pt-BR').includes(term)));
  }, [category, query]);
  const toggleService = (name: string) => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const panels = [
    { title: 'Seu cliente escolhe. Sua agenda recebe.', label: 'PÁGINA DA BARBEARIA', text: 'Um link para consultar serviços, valores e duração, escolher o profissional e reservar um horário disponível.', points: ['Busca por serviço e filtros por categoria', 'Seleção de um ou mais serviços', 'Escolha de profissional, data e horário'], kind: 'catalog' },
    { title: 'Cada profissional, no seu horário.', label: 'AGENDA DA EQUIPE', text: 'Veja os atendimentos do dia por barbeiro e acompanhe o status de cada reserva em um só painel.', points: ['Agenda diária por profissional', 'Cadastro de agendamentos pela equipe', 'Status e horários em uma visão organizada'], kind: 'agenda' },
    { title: 'Apresente quem faz acontecer.', label: 'PERFIS DOS PROFISSIONAIS', text: 'Dê espaço à identidade da sua equipe com foto, apresentação e especialidades visíveis na escolha do profissional.', points: ['Foto e apresentação pública', 'Especialidades em cada perfil', 'Comissões gerenciadas no painel privado'], kind: 'team' },
  ];

  return <section aria-label="Conheça as telas do AgendAI" className="landing-product-preview mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    {panels.map((panel, index) => <article key={panel.kind} className="grid items-center gap-8 border-b border-white/10 py-12 lg:grid-cols-2 lg:gap-16">
      <div className={index === 1 ? 'lg:order-2' : ''}>
        <p className="text-[10px] font-black tracking-[.2em] text-[#FFC400]">{panel.label}</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{panel.title}</h2>
        <p className="mt-5 text-sm leading-relaxed text-slate-300">{panel.text}</p>
        <ul className="mt-6 space-y-3">{panel.points.map((point) => <li key={point} className="flex gap-3 text-sm text-slate-300"><Check className="h-4 w-4 shrink-0 text-[#FFC400]" />{point}</li>)}</ul>
      </div>
      <figure className="landing-demo-surface min-w-0 rounded-[28px] border border-white/10 bg-[#0b1424] p-4 text-slate-100 shadow-xl sm:p-6">
        <figcaption className="mb-5 text-[10px] uppercase tracking-widest text-slate-400">Demonstração interativa · dados fictícios</figcaption>
        {panel.kind === 'catalog' && <div className="mx-auto max-w-sm space-y-3">
          <div className="flex items-center gap-3"><Scissors className="h-9 w-9 rounded-xl bg-[#FFC400]/10 p-2 text-[#FFC400]" /><div><h3 className="font-bold">Sua barbearia</h3><p className="text-xs text-slate-400">Serviços e agendamento online</p></div></div>
          <label className="block"><span className="sr-only">Buscar serviço na demonstração</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar serviço…" className="min-h-11 w-full rounded-xl border border-slate-700 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#FFC400] focus:ring-2 focus:ring-[#FFC400]/30" /></label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar serviços por categoria">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={category === item ? 'min-h-11 rounded-full bg-[#FFC400] px-3 text-xs font-semibold text-slate-950 transition active:scale-[.97]' : 'min-h-11 rounded-full bg-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/15 active:scale-[.97]'}>{item}</button>)}</div>
          <div className="space-y-3" aria-live="polite">
            {visibleServices.map((service) => {
              const active = selected.includes(service.name);
              return <button key={service.name} type="button" onClick={() => toggleService(service.name)} aria-pressed={active} className={active ? 'w-full rounded-2xl border border-[#FFC400] bg-[#FFC400]/10 p-4 text-left shadow-[0_0_0_1px_rgba(255,196,0,.25)] transition active:scale-[.985]' : 'w-full rounded-2xl border border-white/10 bg-white/[.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[.06] active:scale-[.985]'}><span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-bold">{service.name}</span><span className="mt-1 block text-xs text-slate-400">{service.time}</span></span><span className="flex items-center gap-2 text-xs font-bold text-[#FFC400]">{service.price}{active && <Check className="h-4 w-4" aria-label="Selecionado" />}</span></span></button>;
            })}
            {!visibleServices.length && <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-300">Nenhum serviço encontrado. Tente outro termo ou categoria.</p>}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#FFC400]/35 bg-[#FFC400]/[0.08] p-3"><p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-100" aria-live="polite"><ShoppingBag className="h-4 w-4 text-[#FFC400]" />{selected.length === 1 ? '1 serviço escolhido' : selected.length + ' serviços escolhidos'}</p><button type="button" onClick={() => { setQuery(''); setCategory('Todos'); setSelected([]); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-[#FFE071] transition hover:bg-white/10"><RotateCcw className="h-3.5 w-3.5" />Limpar</button></div>
        </div>}
        {panel.kind === 'agenda' && <div><div className="mb-4 flex items-center gap-2 text-sm font-bold"><CalendarCheck2 className="h-4 w-4 text-[#FFC400]" />Agenda do dia</div><div className="grid grid-cols-3 gap-2">{['Carlos', 'Rafael', 'Diego'].map((name, i) => <div key={name} className="min-w-0"><h4 className="mb-3 truncate text-xs font-bold">{name}</h4>{['09:00', '10:00', '11:00'].map((time, j) => <div key={time} className={i === j ? 'mb-2 min-h-20 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2 text-[10px]' : 'mb-2 min-h-20 rounded-xl border border-amber-400/20 bg-amber-400/5 p-2 text-[10px]'}><span className="block text-slate-400">{time}</span><strong className="mt-2 block">{i === j ? 'Confirmado' : 'Agendado'}</strong><span>Corte</span></div>)}</div>)}</div></div>}
        {panel.kind === 'team' && <div className="space-y-3">{[['Carlos Silva', 'Cortes clássicos e modernos', 'Degradê · Barba'], ['Rafael Alves', 'Cuidado e atenção a cada detalhe', 'Corte infantil · Tesoura']].map(([name, bio, tags]) => <div key={name} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-center gap-3"><UsersRound className="h-10 w-10 rounded-full bg-cyan-300/10 p-2 text-cyan-300" /><h4 className="font-bold">{name}</h4></div><p className="mt-4 text-xs text-slate-300">{bio}</p><p className="mt-3 text-xs text-[#FFC400]">{tags}</p></div>)}</div>}
      </figure>
    </article>)}
  </section>;
}
