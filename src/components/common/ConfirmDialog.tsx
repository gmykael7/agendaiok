import React, { useEffect, useId, useState } from 'react';

type ConfirmRequest = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};

let activeRequest: ConfirmRequest | null = null;
let publish: ((request: ConfirmRequest | null) => void) | null = null;

/**
 * Substitui window.confirm por um diálogo do próprio app.
 * Uso: if (await appConfirm('Excluir?', { danger: true })) { ... }
 */
export const appConfirm = (
  message: string,
  options: Omit<ConfirmRequest, 'message' | 'resolve'> = {},
): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    // Se já houver um diálogo aberto, a nova solicitação cancela a anterior.
    activeRequest?.resolve(false);
    activeRequest = { message, ...options, resolve };
    publish?.(activeRequest);
  });

/** Montado uma única vez na raiz do app. */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    publish = setRequest;
    return () => {
      if (publish === setRequest) publish = null;
    };
  }, []);

  const close = (value: boolean) => {
    if (!request) return;
    request.resolve(value);
    if (activeRequest === request) activeRequest = null;
    setRequest(null);
  };

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request) return null;

  const confirmClass = request.danger
    ? 'bg-rose-500 hover:bg-rose-400 text-white'
    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fadeIn">
        <h2 id={titleId} className="text-base font-black text-white">{request.title || 'Confirmar ação'}</h2>
        <p id={messageId} className="mt-2 text-sm leading-relaxed text-slate-300">{request.message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => close(false)} className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 transition hover:bg-slate-800 active:scale-95">
            {request.cancelLabel || 'Cancelar'}
          </button>
          <button type="button" autoFocus onClick={() => close(true)} className={`min-h-11 rounded-xl px-4 text-sm font-black transition active:scale-95 ${confirmClass}`}>
            {request.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
