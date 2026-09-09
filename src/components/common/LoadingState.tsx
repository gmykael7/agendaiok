import { BarberPoleLoader } from './BarberPoleLoader';

export function LoadingState() {
  return <div role="status" aria-live="polite" className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-sm text-slate-400">
    <BarberPoleLoader compact />
    <span>Carregando…</span>
  </div>;
}
