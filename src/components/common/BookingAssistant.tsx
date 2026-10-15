import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Send, Sparkles } from 'lucide-react';
import { AgendaiMascot } from './AgendaiMascot';
import { answerBookingAssistant, assistantAddDays, assistantToday, isAssistantReply } from '../../services/bookingAssistant';
import type { AssistantData, AssistantReply, AssistantSelection, AssistantSlot } from '../../services/bookingAssistant';

type Props = AssistantData & { onChooseSlot: (slot: AssistantSlot) => string | null };
type Message = { role: 'user' | 'assistant'; text: string };
const controlClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400';

export function BookingAssistant({ onChooseSlot, ...data }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'guided' | 'ai'>('guided');
  const [selection, setSelection] = useState<AssistantSelection>({ date: assistantToday(), serviceId: '', barberId: '' });
  const [slots, setSlots] = useState<AssistantSlot[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Olá! Posso mostrar serviços e preços e ajudar a encontrar um horário. A reserva só acontece depois de você revisar e confirmar no formulário. Não envie nome ou telefone aqui.' }]);
  const requestRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const updateSelection = (value: Partial<AssistantSelection>) => {
    setSelection(current => ({ ...current, ...value }));
    setSlots([]);
    setError('');
  };

  async function send(text: string) {
    const message = text.trim();
    if (!message || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setBusy(true);
    setError('');
    setSlots([]);
    setInput('');
    setMessages(current => [...current.slice(-19), { role: 'user', text: message }]);
    try {
      let result: AssistantReply;
      if (import.meta.env.DEV) {
        // O Vite usa dados locais de demonstração; nunca chama IA paga no desenvolvimento.
        result = answerBookingAssistant(data, message, selection);
      } else {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_slug: data.org.slug, message, selection }),
          signal: controller.signal,
        });
        if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Assistente indisponível. Use o agendamento normal.');
        const body: unknown = await response.json();
        if (!response.ok) {
          const error = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Não foi possível consultar a assistente.';
          throw new Error(error);
        }
        if (!isAssistantReply(body)) throw new Error('Resposta inválida. Use o agendamento normal.');
        result = body;
      }
      if (controller.signal.aborted) return;
      setSelection(result.selection);
      setSlots(result.slots);
      setMode(result.mode);
      setMessages(current => [...current.slice(-19), { role: 'assistant', text: result.reply }]);
    } catch (failure) {
      if (controller.signal.aborted) setError('A consulta demorou demais. Tente novamente ou use o agendamento normal.');
      else setError(failure instanceof Error ? failure.message : 'Não consegui consultar agora.');
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      setBusy(false);
    }
  }

  return (
    <section className="booking-assistant mx-4 sm:mx-6 mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 overflow-hidden" aria-label="Assistente de agendamento">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="booking-assistant-panel" className="w-full flex items-center gap-3 p-4 text-left">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center"><AgendaiMascot size={40} interactive={false} label="Assistente AgendAI" /></span>
        <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-white">Precisa de ajuda para agendar?</span><span className="block text-xs text-slate-400 mt-1">Assistente AgendAI · experimental</span></span>
        <ChevronDown className={`w-4 h-4 text-emerald-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id="booking-assistant-panel" className="p-4 pt-0 space-y-3">
        <p className="text-[11px] text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3" />{import.meta.env.DEV ? 'Prévia local · sem IA' : mode === 'ai' ? 'Interpretação por IA · dados conferidos pelo sistema' : 'Modo guiado · sem IA nesta resposta'}</p>
        <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="max-h-64 overflow-y-auto space-y-2 rounded-xl bg-slate-950/50 p-3">
          {messages.map((message, index) => <div key={index} className={`rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap break-words ${message.role === 'user' ? 'bg-emerald-500/10 text-emerald-300 ml-4' : 'bg-slate-800/70 text-slate-200 mr-4'}`}><span className="block font-bold mb-1">{message.role === 'user' ? 'Você' : 'Assistente'}</span>{message.text}</div>)}
          {busy && <p role="status" className="text-xs text-slate-400">Consultando…</p>}
        </div>
        <div className="flex flex-wrap gap-2">{['Ver serviços e preços', 'Quero agendar amanhã', 'Horário de funcionamento'].map(text => <button type="button" key={text} disabled={busy} onClick={() => void send(text)} className="rounded-lg border border-emerald-500/30 px-2.5 py-2 text-[11px] font-semibold text-emerald-300 disabled:opacity-50">{text}</button>)}</div>
        <form onSubmit={event => { event.preventDefault(); void send(input); }} className="flex gap-2">
          <input ref={inputRef} aria-label="Mensagem para a assistente" maxLength={500} value={input} disabled={busy} onChange={event => setInput(event.target.value)} placeholder="Ex.: quero um corte amanhã" className={`${controlClass} min-w-0`} />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar mensagem" className="px-3 rounded-xl bg-emerald-500 text-slate-950 disabled:opacity-40"><Send className="w-4 h-4" /></button>
        </form>
        <fieldset disabled={busy} className="grid sm:grid-cols-3 gap-2">
          <label className="text-xs text-slate-300 space-y-1"><span>Serviço</span><select className={controlClass} value={selection.serviceId} onChange={event => updateSelection({ serviceId: event.target.value })}><option value="">Escolha um serviço</option>{data.services.filter(s => s.active !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs text-slate-300 space-y-1"><span>Data (Brasília)</span><input type="date" className={controlClass} min={assistantToday()} max={assistantAddDays(assistantToday(), 90)} value={selection.date} onChange={event => updateSelection({ date: event.target.value })} /></label>
          <label className="text-xs text-slate-300 space-y-1"><span>Profissional</span><select className={controlClass} value={selection.barberId} onChange={event => updateSelection({ barberId: event.target.value })}><option value="">Qualquer profissional</option>{data.barbers.filter(b => b.active !== false).map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}</select></label>
        </fieldset>
        <button type="button" disabled={busy || !selection.serviceId || !selection.date} onClick={() => void send('Consultar horários disponíveis')} className="w-full rounded-xl py-3 bg-emerald-500 text-slate-950 text-xs font-bold disabled:opacity-40">Consultar horários</button>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        {slots.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold text-slate-200">Escolha para revisar — ainda não é uma reserva</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">{slots.map(slot => <button key={`${slot.date}-${slot.barberId}-${slot.time}`} type="button" onClick={() => {
          const problem = onChooseSlot(slot);
          if (problem) { setError(problem); setSlots([]); }
          else { setOpen(false); setSlots([]); }
        }} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-3 text-center"><span className="block text-sm font-black text-emerald-300">{slot.time}</span><span className="block text-[11px] text-slate-300 break-words">{slot.barberName}</span></button>)}</div></div>}
        <p className="text-[11px] text-slate-500">Conversa temporária: não é salva. Dados de contato são solicitados somente no formulário. Você pode fechar a assistente e agendar normalmente.</p>
      </div>}
    </section>
  );
}
