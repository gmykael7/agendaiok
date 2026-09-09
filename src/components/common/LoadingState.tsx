import { Loader2 } from 'lucide-react';

export function LoadingState() {
  return <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center gap-3 p-8 text-sm text-slate-400">
    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> Carregando…
  </div>;
}
