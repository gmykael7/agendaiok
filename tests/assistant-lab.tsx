import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, FlaskConical, ShieldCheck } from 'lucide-react';
import { isAssistantReply } from '../src/services/bookingAssistant';
import type { AssistantReply, AssistantSlot } from '../src/services/bookingAssistant';
import { fixture } from './assistant-fixtures';
import { labScenarios } from './assistant-lab-scenarios';
import '../src/index.css';

function Lab() {
  const [status, setStatus] = useState<{ ready: boolean; model: string; remaining: number }>();
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<{ answer: AssistantReply; note: string }>();
  const [chosen, setChosen] = useState<AssistantSlot>();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/lab/status', { signal: controller.signal }).then(async r => {
      const raw = await r.json();
      if (!r.ok || !raw || typeof raw !== 'object') throw new Error();
      const value = raw as Record<string, unknown>;
      if (typeof value.ready !== 'boolean' || typeof value.model !== 'string' || typeof value.remaining !== 'number') throw new Error();
      setStatus({ ready: value.ready, model: value.model, remaining: value.remaining });
    }).catch(() => {
      if (!controller.signal.aborted) setError('Abra esta página pelo comando npm run dev:assistant-lab.');
    });
    return () => controller.abort();
  }, []);
  async function run(scenario: typeof labScenarios[number]) {
    if (busy) return;
    setBusy(true); setError(''); setChosen(undefined); setResult(undefined); setQuestion(scenario.text);
    try {
      const response = await fetch('/api/lab/run', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenario.id, live }), signal: AbortSignal.timeout(15_000) });
      const raw = await response.json();
      const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      if (!response.ok || !isAssistantReply(body.answer) || typeof body.note !== 'string' || typeof body.remaining !== 'number') throw new Error(typeof body.error === 'string' ? body.error : 'Resposta inválida. Nenhuma gravação foi realizada.');
      setResult({ answer: body.answer, note: body.note });
      const remaining = body.remaining;
      setStatus(current => current && ({ ...current, remaining }));
    } catch (e) { setError(e instanceof Error && e.name === 'TimeoutError' ? 'O teste demorou demais. Tente o modo guiado.' : e instanceof Error ? e.message : 'Falha no teste.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen px-4 py-8 sm:px-8 text-slate-100">
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300"><FlaskConical className="w-4 h-4" />AgendAI · laboratório local</p>
        <h1 className="text-2xl sm:text-4xl font-bold">Experimente a assistente</h1>
        <p className="text-slate-300 max-w-2xl">Só exemplos fictícios. Sem acesso ao painel, banco de clientes ou reservas reais.</p>
      </header>
      <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3" aria-label="Configuração do teste">
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="w-5 h-5 shrink-0 text-emerald-300" />{status ? status.ready ? 'Chave configurada no servidor local' : 'Modo guiado disponível · falta configurar a chave local' : 'Conferindo configuração…'}</p>
        {status && <p className="text-xs text-slate-300 break-all">Modelo configurado: {status.model} · {status.remaining}/10 tentativas restantes nesta execução</p>}
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={live} disabled={!status?.ready || busy || status.remaining === 0} onChange={e => { setLive(e.target.checked); setResult(undefined); setChosen(undefined); }} />
          <span>Usar IA real nos próximos exemplos<span className="block text-xs text-slate-400 mt-1">Desmarcado: regras locais. Marcado: envia apenas a frase escolhida e o catálogo fictício ao OpenRouter. O provedor pode registrar esse conteúdo.</span></span>
        </label>
      </section>
      <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
          <h2 className="font-bold">1. Escolha um exemplo</h2>
          <div className="space-y-2">{labScenarios.map(scenario => <button key={scenario.id} type="button" disabled={busy || !status} onClick={() => void run(scenario)} className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-left text-sm hover:border-emerald-400 focus-visible:outline focus-visible:outline-emerald-300 disabled:opacity-50">{scenario.text}</button>)}</div>
          <p className="text-xs text-slate-400">Catálogo de teste: Corte R$ 40 (30 min), Combo R$ 65 (60 min). Profissionais fictícias Ana e Bia. Expediente 08h–18h, intervalo 12h–14h.</p>
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-4" aria-label="Resultado do teste" aria-live="polite">
          <h2 className="font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-emerald-300" />2. Confira a resposta</h2>
          {!question && <p className="text-sm text-slate-400">Escolha uma frase ao lado para começar.</p>}
          {question && <p className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">{question}</p>}
          {busy && <p role="status" className="text-sm">Consultando…</p>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {result && <>
            <p className="text-xs font-bold text-emerald-300">{result.answer.mode === 'ai' ? 'IA REAL' : 'MODO GUIADO · SEM IA NESTA RESPOSTA'}</p>
            <p className="text-xs text-slate-400">{result.note}</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.answer.reply}</p>
            {result.answer.slots.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">{result.answer.slots.map(slot => <button key={`${slot.barberId}-${slot.time}`} type="button" onClick={() => setChosen(slot)} className="border border-emerald-500/40 rounded-xl p-3 bg-emerald-400/10 text-sm"><span className="block font-bold text-emerald-200">{slot.time}</span><span>{slot.barberName}</span></button>)}</div>}
            {chosen && <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm space-y-2"><h3 className="font-bold">Revisão simulada — nada reservado</h3><p>{fixture.services.find(s => s.id === chosen.serviceId)?.name} · {chosen.date.split('-').reverse().join('/')} às {chosen.time} · {chosen.barberName}</p><p>Na página pública, esta escolha segue para o formulário existente. Aqui não solicitamos contato e não gravamos reservas.</p></div>}
          </>}
        </section>
      </div>
      <p className="text-xs text-slate-400">Teste isolado, sem publicação. Se a IA falhar ou o modelo não estiver disponível, o resultado volta ao modo guiado. O filtro de tarde é um experimento local, ainda não aplicado à página pública.</p>
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Lab />);
