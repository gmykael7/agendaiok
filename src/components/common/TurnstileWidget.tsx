import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CheckCircle, Loader2, ShieldCheck } from 'lucide-react';

const TURNSTILE_SITE_KEY = '0x4AAAAAAEuDsFGUL8t5DKAp';
const TURNSTILE_SCRIPT_ID = 'agendai-turnstile-script';

type TurnstileWidgetId = string;
type TurnstileSize = 'normal' | 'compact' | 'flexible';

interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    language?: string;
    theme?: 'auto' | 'light' | 'dark';
    size?: TurnstileSize;
    appearance?: 'always' | 'execute' | 'interaction-only';
    callback: (token: string) => void;
    'error-callback': () => void;
    'expired-callback': () => void;
    'timeout-callback': () => void;
  }) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const resolveApi = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile indisponível.'));
    };
    const fail = () => {
      turnstileScriptPromise = null;
      reject(new Error('Não foi possível carregar o Turnstile.'));
    };

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', resolveApi, { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', resolveApi, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  action: 'public_booking' | 'product_order';
  onTokenChange: (token: string) => void;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ action, onTokenChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    onTokenChangeRef.current = onTokenChange;

    useImperativeHandle(ref, () => ({
      reset: () => {
        onTokenChangeRef.current('');
        setStatus('loading');
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }), []);

    useEffect(() => {
      let active = true;
      let renderedWidgetId: TurnstileWidgetId | null = null;
      onTokenChangeRef.current('');
      setStatus('loading');

      void loadTurnstile().then((api) => {
        if (!active || !containerRef.current) return;
        renderedWidgetId = api.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          language: 'pt-br',
          theme: 'dark',
          size: 'compact',
          appearance: 'interaction-only',
          callback: (token) => {
            if (!active) return;
            onTokenChangeRef.current(token);
            setStatus('ready');
          },
          'error-callback': () => {
            if (!active) return;
            onTokenChangeRef.current('');
            setStatus('error');
          },
          'expired-callback': () => {
            if (!active) return;
            onTokenChangeRef.current('');
            setStatus('loading');
          },
          'timeout-callback': () => {
            if (!active) return;
            onTokenChangeRef.current('');
            setStatus('error');
          },
        });
        widgetIdRef.current = renderedWidgetId;
      }).catch(() => {
        if (active) setStatus('error');
      });

      return () => {
        active = false;
        onTokenChangeRef.current('');
        if (window.turnstile && renderedWidgetId) window.turnstile.remove(renderedWidgetId);
        if (widgetIdRef.current === renderedWidgetId) widgetIdRef.current = null;
      };
    }, [action]);

    return (
      <div className="rounded-xl border border-slate-800 bg-[#0B1120]/80 px-3 py-2.5" aria-live="polite">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
          {status === 'ready' ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : status === 'error' ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-300" />
          )}
          <span>
            {status === 'ready'
              ? 'Verificação de segurança concluída.'
              : status === 'error'
                ? 'Não foi possível verificar. Atualize a página e tente novamente.'
                : 'Preparando verificação de segurança...'}
          </span>
        </div>
        <div ref={containerRef} className="mt-2 flex min-h-0 justify-center" />
      </div>
    );
  },
);

TurnstileWidget.displayName = 'TurnstileWidget';
