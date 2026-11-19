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
    { label: 'Cadastre sua equipe', done: barbers.length > 0, icon: UsersRound, tab: 'team' as const },
    { label: 'Cadastre seus serviços', done: services.length > 0, icon: Scissors, tab: 'services' as const },
    { label: 'Configure seus horários', done: Boolean(org.open_hour && org.close_hour), icon: Clock3, tab: 'general' as const },
    { label: 'Compartilhe seu link', done: false, icon: Share2, tab: null },
  ];
  const completedCount = steps.filter((step) => step.done).length;
  const nextStepIndex = steps.findIndex((step) => !step.done);
  const nextStep = steps[nextStepIndex] || steps[steps.length - 1];
  const NextStepIcon = nextStep.icon;

  const copyLink = async () => {
    if (await copy(getClientBookingUrl(org.slug))) onDismiss();
  };

  const runStep = (index: number) => {
    const step = steps[index];
    if (!step) return;
    if (step.tab) onNavigateToSettings(step.tab);
    else void copyLink();
  };

  return (
    <section className="onboarding-checklist rounded-2xl border border-slate-700/70 bg-[#0d1728] p-4 sm:p-5" aria-labelledby="onboarding-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-300">Configuração inicial · {completedCount} de {steps.length}</p>
          <h3 id="onboarding-title" className="mt-1 text-base font-bold text-white sm:text-lg">Prepare sua barbearia para receber agendamentos</h3>
          <p className="mt-1 hidden text-sm text-slate-400 sm:block">Conclua as etapas essenciais antes de compartilhar sua página.</p>
        </div>
        <button type="button" onClick={onDismiss} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar primeiros passos">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && <p role="status" className="mt-3 text-xs text-rose-400">{error}</p>}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${(completedCount / steps.length) * 100}%` }} />
      </div>

      <button
        type="button"
        onClick={() => runStep(nextStepIndex)}
        className="mt-4 flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 text-left sm:hidden"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
          <NextStepIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-slate-400">Próxima etapa</span>
          <span className="block truncate text-sm font-semibold text-white">{nextStep.label}</span>
        </span>
      </button>

      <div className="mt-4 hidden grid-cols-2 gap-2.5 sm:grid xl:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button
              key={step.label}
              type="button"
              onClick={() => runStep(index)}
              className="rounded-xl border border-slate-700/70 bg-slate-950/35 p-3.5 text-left transition-colors hover:border-slate-500 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                  <Icon className="h-4 w-4 text-slate-300" />
                </span>
                {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-600" />}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">Etapa {index + 1}</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{step.label}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};
