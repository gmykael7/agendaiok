import { useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Scissors, UsersRound, Wallet, X } from 'lucide-react';
import type { Appointment, Barber, ProductSale, Service } from '../../types';
import { getLocalDateKey } from '../../utils/scheduling';
import { Modal } from './Modal';

interface AppTourProps {
  appointments: Appointment[];
  barbers: Barber[];
  services: Service[];
  productSales: ProductSale[];
  onClose: () => void;
  onComplete?: () => void;
}

export function AppTour({ appointments, barbers, services, productSales, onClose, onComplete }: AppTourProps) {
  const [step, setStep] = useState(0);
  const today = getLocalDateKey();
  const todayAppointments = appointments.filter(item => item.date === today);
  const upcoming = todayAppointments.filter(item => ['scheduled', 'confirmed', 'arrived'].includes(item.status));
  const completed = todayAppointments.filter(item => item.status === 'completed');
  const todaySales = productSales.filter(item => item.date === today && item.status === 'completed');
  const revenue = completed.reduce((sum, item) => sum + Number(item.price || 0), 0)
    + todaySales.reduce((sum, item) => sum + Number(item.total || 0), 0);

  const slides = [
    { Icon: CalendarDays, label: 'Agenda', title: 'Seu dia em uma visão', value: String(upcoming.length), unit: 'horários em aberto hoje', detail: upcoming[0] ? `Próximo: ${upcoming[0].client_name} às ${upcoming[0].start_time}` : 'Nenhum horário em aberto hoje.' },
    { Icon: UsersRound, label: 'Equipe', title: 'Profissionais conectados', value: String(barbers.length), unit: 'profissionais cadastrados', detail: barbers.length ? barbers.slice(0, 3).map(item => item.full_name).join(' · ') : 'Cadastre sua equipe nos ajustes.' },
    { Icon: Scissors, label: 'Serviços', title: 'Seu catálogo organizado', value: String(services.length), unit: 'serviços cadastrados', detail: services.length ? services.slice(0, 3).map(item => item.name).join(' · ') : 'Cadastre seus serviços nos ajustes.' },
    { Icon: Check, label: 'Atendimentos', title: 'Acompanhe cada etapa', value: String(completed.length), unit: 'atendimentos concluídos hoje', detail: `${todayAppointments.length} atendimento${todayAppointments.length === 1 ? '' : 's'} na agenda de hoje.` },
    { Icon: Wallet, label: 'Resultados', title: 'Veja o resultado do dia', value: revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), unit: 'recebido hoje', detail: 'Soma dos atendimentos e vendas concluídos hoje.' },
  ];
  const current = slides[step];
  const Icon = current.Icon;

  return (
    <Modal label="Conhecer o AgendAI" onClose={onClose} className="app-tour-overlay fixed inset-0 z-[240] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5">
      <div className="app-tour-shell w-full max-w-lg overflow-hidden rounded-3xl border text-white shadow-2xl">
        <div className="app-tour-header flex items-center justify-between border-b px-5 py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFC400]">Tour do aplicativo</p><h2 className="mt-1 text-lg font-bold">Conheça sua operação</h2></div>
          <button type="button" onClick={onClose} aria-label="Fechar tour" className="app-tour-close rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white min-w-[44px] min-h-[44px] inline-flex items-center justify-center"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-1.5 px-5 pt-5" aria-label={`Etapa ${step + 1} de ${slides.length}`}>
          {slides.map((slide, index) => <span key={slide.label} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-[#FFC400]' : 'bg-white/10'}`} />)}
        </div>
        <div key={step} className="app-tour-body agendai-tour-slide px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FFC400]/30 bg-[#FFC400]/10 text-[#FFC400]"><Icon className="h-8 w-8" /></div>
          <div className="mt-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFC400]">{current.label}</p><h3 className="mt-2 text-2xl font-black">{current.title}</h3></div>
          <div className="app-tour-stat mt-6 rounded-2xl border p-5 text-center">
            <strong className="block text-4xl font-black text-white sm:text-5xl">{current.value}</strong>
            <span className="mt-2 block text-sm text-slate-300">{current.unit}</span>
            <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">{current.detail}</p>
          </div>
        </div>
        <div className="app-tour-footer flex items-center justify-between gap-3 border-t px-5 py-4">
          <button type="button" onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Voltar</button>
          <button type="button" onClick={() => step === slides.length - 1 ? (onComplete?.(), onClose()) : setStep(value => value + 1)} className="inline-flex items-center gap-1 rounded-xl bg-[#FFC400] px-4 py-2.5 text-sm font-black text-[#07111F] hover:bg-[#FFD333]">{step === slides.length - 1 ? 'Concluir' : 'Próximo'} {step < slides.length - 1 && <ChevronRight className="h-4 w-4" />}</button>
        </div>
      </div>
    </Modal>
  );
}
