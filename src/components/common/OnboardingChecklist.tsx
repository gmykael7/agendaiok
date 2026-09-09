import React from 'react';
import { CheckCircle2, Circle, Scissors, UsersRound, Clock3, Share2, X } from 'lucide-react';
import { Barber, Organization, Service } from '../../types';
import { getClientBookingUrl } from '../../config/urls';
import { useClipboard } from '../../hooks/useClipboard';

interface OnboardingChecklistProps {
  org: Organization;
  barbers: Barber[];
  services: Service[];
  onNavigateToSettings: (tab: 'team' | 'services' | 'general') => void;
  onDismiss: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  org,
  barbers,
  services,
  onNavigateToSettings,
  onDismiss,
}) => {
  const { copy, error } = useClipboard();
  const steps = [
    { label: 'Cadastre sua equipe', done: barbers.length > 0, icon: UsersRound },
    { label: 'Cadastre seus serviços', done: services.length > 0, icon: Scissors },
    { label: 'Configure seus horários', done: Boolean(org.open_hour && org.close_hour), icon: Clock3 },
    { label: 'Compartilhe seu link', done: false, icon: Share2 },
  ];

  const copyLink = async () => {
    if (await copy(getClientBookingUrl(org.slug))) onDismiss();
  };

  return (
    <div className="onboarding-checklist rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/80 to-blue-500/10 p-5 sm:p-6 shadow-xl shadow-cyan-950/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-cyan-300 font-black">Primeiros passos</span>
          <h3 className="text-lg sm:text-xl font-black text-white mt-1">Deixe sua barbearia pronta para receber agendamentos</h3>
          <p className="text-xs text-slate-400 mt-1">Quatro passos rápidos para começar sem se perder nas configurações.</p>
        </div>
        <button type="button" onClick={onDismiss} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800" aria-label="Fechar primeiros passos">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && <p role="status" className="mt-3 text-xs text-rose-400">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button
              key={step.label}
              type="button"
              onClick={index === 3 ? copyLink : () => onNavigateToSettings(index === 0 ? 'team' : index === 1 ? 'services' : 'general')}
              className="text-left rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3.5 hover:border-cyan-400/30 hover:bg-slate-900 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-cyan-300" />
                </span>
                {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-600" />}
              </div>
              <p className="text-[10px] text-slate-500 mt-3">Passo {index + 1}</p>
              <p className="text-xs font-bold text-white mt-0.5">{step.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
