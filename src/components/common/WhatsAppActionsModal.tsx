import React from 'react';
import { createPortal } from 'react-dom';
import { BellRing, Check, HeartHandshake, MessageCircle, UserRoundSearch, X } from 'lucide-react';
import { WhatsAppAction } from '../../utils/whatsapp';
import { useDialog } from '../../hooks/useDialog';

type WhatsAppModalAction = {
  action: WhatsAppAction;
  label: string;
  href: string;
};

interface WhatsAppActionsModalProps {
  open: boolean;
  recipientName: string;
  actions: WhatsAppModalAction[];
  onClose: () => void;
}

const ACTION_ICON: Record<WhatsAppAction, React.FC<{ className?: string }>> = {
  confirm: Check,
  reminder: BellRing,
  thanks: HeartHandshake,
  inactive: UserRoundSearch,
};

export const WhatsAppActionsModal: React.FC<WhatsAppActionsModalProps> = ({
  open,
  recipientName,
  actions,
  onClose,
}) => {
  const dialogRef = useDialog(open, onClose);
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[220] app-mobile-modal flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 safe-screen"
      role="dialog"
      aria-modal="true"
      aria-label={`Enviar mensagem para ${recipientName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="whatsapp-actions-sheet w-full max-w-sm max-h-[86dvh] overflow-y-auto overscroll-contain rounded-[28px] border border-slate-700/80 bg-[#0B1426] shadow-2xl shadow-black/50">
        <div className="whatsapp-actions-header sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-[#0B1426]/95 px-5 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-400">
              <MessageCircle className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">WhatsApp</span>
            </div>
            <h3 className="mt-1 truncate text-base font-bold text-white">Enviar mensagem</h3>
            <p className="mt-0.5 truncate text-xs text-slate-400">Para {recipientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400 transition hover:text-white"
            aria-label="Fechar mensagens do WhatsApp"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-4 sm:p-5">
          <p className="px-1 pb-1 text-[11px] leading-relaxed text-slate-500">
            Escolha o tipo de mensagem. O WhatsApp será aberto com o texto já preparado.
          </p>
          {actions.map((item) => {
            const Icon = ACTION_ICON[item.action];
            return (
              <a
                key={item.action}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="whatsapp-actions-item flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-3.5 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">Abrir conversa no WhatsApp</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};
