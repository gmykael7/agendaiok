import React, { useCallback, useEffect, useRef, useState } from 'react';
import { listPlatformNotices, readPlatformNotice } from '../../services/platformNotices';
import type { PlatformNotice } from '../../services/platformNoticeTypes';
import { PlatformNoticeCard } from './PlatformNoticeCard';
import { ChevronDown, Megaphone } from 'lucide-react';

// Mounted with a session/organization key in App: nothing survives a tenant switch.
export function PlatformNotices() {
  const [notices, setNotices] = useState<PlatformNotice[]>([]);
  const [showRead, setShowRead] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const acknowledged = useRef(new Set<string>());
  const requestVersion = useRef(0);
  const controller = useRef<AbortController>();
  const load = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const version = ++requestVersion.current;
    try {
      const result = await listPlatformNotices(undefined, abort.signal);
      if (version !== requestVersion.current) return;
      setNotices(result.map(n => acknowledged.current.has(n.id) && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n));
      setError('');
    } catch {
      if (!abort.signal.aborted && version === requestVersion.current) {
        // Do not leave old private messages visible after expired/revoked sessions.
        setNotices([]); setError('Não foi possível carregar os avisos do AgendAI.');
      }
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      ++requestVersion.current; controller.current?.abort(); clearInterval(timer);
      window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);
  const unread = notices.filter(n => !n.read_at);
  const visible = showRead ? notices : unread;
  if (!notices.length && !error) return null;
  return <section aria-label="Avisos do AgendAI" className="mb-4 space-y-3">
    <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/35 px-4 text-left transition hover:bg-slate-900/70">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><Megaphone className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">Avisos do AgendAI</span><span className="block truncate text-[11px] text-slate-400">{unread.length ? `${unread.length} ${unread.length === 1 ? 'mensagem nova' : 'mensagens novas'}` : 'Mensagens da administração'}</span></span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
    {expanded && <>
    <div className="flex flex-wrap items-center justify-end gap-2">
      {notices.some(n => n.read_at) && <button type="button" className="min-h-11 text-xs font-semibold text-slate-300 px-2" onClick={() => setShowRead(v => !v)}>{showRead ? 'Ocultar mensagens lidas' : 'Ver mensagens lidas'}</button>}
    </div>
    {error && <div role="status" className="text-xs text-amber-200 flex flex-wrap items-center gap-2"><span>{error}</span><button type="button" onClick={() => void load()} className="underline py-2">Tentar novamente</button></div>}
    {visible.map(notice => <PlatformNoticeCard key={notice.id} notice={notice}>
      {notice.read_at ? <span>Lida pela barbearia</span> : <button type="button" disabled={!!busy} className="rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950 disabled:opacity-50" onClick={async () => {
        setBusy(notice.id);
        try {
          await readPlatformNotice(notice.id);
          acknowledged.current.add(notice.id);
          setNotices(items => items.map(n => n.id === notice.id ? { ...n, read_at: new Date().toISOString() } : n));
          setError('');
        } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível marcar como lida.'); }
        finally { setBusy(null); }
      }}>{busy === notice.id ? 'Salvando...' : 'Marcar como lida'}</button>}
    </PlatformNoticeCard>)}
    {showRead && <p className="text-xs text-slate-500">Até 50 mensagens recentes. A leitura é compartilhada pela administração da barbearia.</p>}
    </>}
  </section>;
}
