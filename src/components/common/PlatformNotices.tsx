import React, { useCallback, useEffect, useRef, useState } from 'react';
import { listPlatformNotices, readPlatformNotice } from '../../services/platformNotices';
import type { PlatformNotice } from '../../services/platformNoticeTypes';
import { PlatformNoticeCard } from './PlatformNoticeCard';
import { ChevronDown, Megaphone, Sparkles } from 'lucide-react';

const DAILY_PREVIEW_KEY = 'agendai_notices_daily_preview';
const KNOWN_NOTICES_KEY = 'agendai_known_notices_ids';

// Mounted with a session/organization key in App: nothing survives a tenant switch.
export function PlatformNotices() {
  const [notices, setNotices] = useState<PlatformNotice[]>([]);
  const [showRead, setShowRead] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasNewHighlight, setHasNewHighlight] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const acknowledged = useRef(new Set<string>());
  const requestVersion = useRef(0);
  const controller = useRef<AbortController>();
  const autoCloseTimer = useRef<number | null>(null);
  const userInteracted = useRef(false);

  const clearTimer = () => {
    if (autoCloseTimer.current) {
      clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
  };

  const load = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController(); 
    controller.current = abort;
    const version = ++requestVersion.current;

    try {
      const result = await listPlatformNotices(undefined, abort.signal);
      if (version !== requestVersion.current) return;

      const updated = result.map(n => 
        acknowledged.current.has(n.id) && !n.read_at 
          ? { ...n, read_at: new Date().toISOString() } 
          : n
      );
      setNotices(updated);
      setError('');

      if (!result.length) return;

      // 1. Checagem de mensagens novas que ainda não foram vistas
      let knownIds = new Set<string>();
      try {
        const raw = localStorage.getItem(KNOWN_NOTICES_KEY);
        if (raw) knownIds = new Set(JSON.parse(raw));
      } catch {}

      const unreadNotices = updated.filter(n => !n.read_at);
      const brandNewNotices = unreadNotices.filter(n => !knownIds.has(n.id));

      if (brandNewNotices.length > 0 && !userInteracted.current) {
        // Marca as mensagens como conhecidas para não reabrir em loop nos polls
        brandNewNotices.forEach(n => knownIds.add(n.id));
        try {
          localStorage.setItem(KNOWN_NOTICES_KEY, JSON.stringify([...knownIds]));
        } catch {}

        setHasNewHighlight(true);
        setExpanded(true);
        clearTimer();

        // Quando chega mensagem nova, abre e fica aberto por 8 segundos
        autoCloseTimer.current = window.setTimeout(() => {
          setExpanded(false);
          setHasNewHighlight(false);
        }, 8000);

        return;
      }

      // 2. Abertura automática diária (ao abrir no dia, abre e depois de 3 segundos fecha)
      const todayKey = new Date().toISOString().slice(0, 10);
      let lastDailyDate = '';
      try {
        lastDailyDate = localStorage.getItem(DAILY_PREVIEW_KEY) || '';
      } catch {}

      if (lastDailyDate !== todayKey && !userInteracted.current) {
        try {
          localStorage.setItem(DAILY_PREVIEW_KEY, todayKey);
        } catch {}

        setExpanded(true);
        clearTimer();

        // Abre no dia e fecha após 3 segundos
        autoCloseTimer.current = window.setTimeout(() => {
          setExpanded(false);
        }, 3000);
      }

    } catch {
      if (!abort.signal.aborted && version === requestVersion.current) {
        setNotices([]); 
        setError('Não foi possível carregar os avisos do AgendAI.');
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { 
      if (document.visibilityState === 'visible') void load(); 
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      ++requestVersion.current; 
      controller.current?.abort(); 
      clearInterval(timer);
      clearTimer();
      window.removeEventListener('focus', refresh); 
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const handleToggle = () => {
    userInteracted.current = true;
    clearTimer();
    setHasNewHighlight(false);
    setExpanded(prev => !prev);
  };

  const handleInteract = () => {
    userInteracted.current = true;
    clearTimer();
    setHasNewHighlight(false);
  };

  const unread = notices.filter(n => !n.read_at);
  const visible = showRead ? notices : unread;

  if (!notices.length && !error) return null;

  return (
    <section 
      aria-label="Avisos do AgendAI" 
      className="mb-4 space-y-3 transition-all"
      onClick={handleInteract}
    >
      <button 
        type="button" 
        onClick={handleToggle} 
        aria-expanded={expanded} 
        className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left transition-all hover:bg-slate-900/70 ${
          hasNewHighlight 
            ? 'border-amber-400/50 bg-amber-400/[0.08] shadow-lg shadow-amber-400/10' 
            : 'border-slate-800/80 bg-slate-950/35'
        }`}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          hasNewHighlight 
            ? 'bg-amber-400 text-slate-950 animate-bounce' 
            : 'bg-amber-400/10 text-amber-300'
        }`}>
          {hasNewHighlight ? <Sparkles className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Avisos do AgendAI</span>
            {hasNewHighlight && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                Nova mensagem
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-slate-400">
            {unread.length 
              ? `${unread.length} ${unread.length === 1 ? 'mensagem nova' : 'mensagens novas'}` 
              : 'Mensagens da administração'}
          </span>
        </span>

        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="space-y-3 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {notices.some(n => n.read_at) && (
              <button 
                type="button" 
                className="min-h-11 text-xs font-semibold text-slate-300 px-2 hover:text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); setShowRead(v => !v); }}
              >
                {showRead ? 'Ocultar mensagens lidas' : 'Ver mensagens lidas'}
              </button>
            )}
          </div>

          {error && (
            <div role="status" className="text-xs text-amber-200 flex flex-wrap items-center gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => void load()} className="underline py-2">
                Tentar novamente
              </button>
            </div>
          )}

          {visible.map(notice => (
            <PlatformNoticeCard key={notice.id} notice={notice}>
              {notice.read_at ? (
                <span className="text-slate-400">Lida pela barbearia</span>
              ) : (
                <button 
                  type="button" 
                  disabled={!!busy} 
                  className="rounded-xl bg-cyan-300 hover:bg-cyan-200 px-3 py-2 font-bold text-slate-950 text-xs disabled:opacity-50 transition-colors" 
                  onClick={async (e) => {
                    e.stopPropagation();
                    setBusy(notice.id);
                    try {
                      await readPlatformNotice(notice.id);
                      acknowledged.current.add(notice.id);
                      setNotices(items => items.map(n => n.id === notice.id ? { ...n, read_at: new Date().toISOString() } : n));
                      setError('');
                    } catch (err) { 
                      setError(err instanceof Error ? err.message : 'Não foi possível marcar como lida.'); 
                    } finally { 
                      setBusy(null); 
                    }
                  }}
                >
                  {busy === notice.id ? 'Salvando...' : 'Marcar como lida'}
                </button>
              )}
            </PlatformNoticeCard>
          ))}

          {showRead && (
            <p className="text-xs text-slate-500 text-center pt-1">
              Até 50 mensagens recentes. A leitura é compartilhada pela administração da barbearia.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
