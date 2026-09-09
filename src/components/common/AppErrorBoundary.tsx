import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao abrir uma tela do AgendAI:', error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#070B14] text-slate-100">
      <section role="alert" className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 text-center space-y-4">
        <h1 className="text-xl font-bold">Não foi possível abrir esta tela</h1>
        <p className="text-sm leading-relaxed text-slate-300">Tente carregar novamente. Esta ação mantém os dados salvos da sua barbearia.</p>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950">
          <RefreshCw className="h-4 w-4" /> Carregar novamente
        </button>
      </section>
    </main>;
  }
}
