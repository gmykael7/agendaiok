import React from 'react';
import { MessageCircleMore, Sparkles } from 'lucide-react';

interface AgencyCreditProps {
  compact?: boolean;
  centered?: boolean;
  className?: string;
}

const WHATSAPP_URL = 'https://wa.me/5584981937580';

export const AgencyCredit: React.FC<AgencyCreditProps> = ({
  compact = false,
  centered = false,
  className = '',
}) => {
  return (
    <div className={`brand-credit ${centered ? 'text-center items-center justify-center' : ''} ${className}`.trim()}>
      <div className={`flex ${centered ? 'justify-center' : 'justify-start'} items-center gap-2 flex-wrap`}>
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
          <Sparkles className="w-3 h-3" />
          Desenvolvido por Agência G7
        </span>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-1 text-[11px] font-semibold text-teal-200 transition hover:bg-teal-400/20 hover:text-white"
        >
          <MessageCircleMore className="w-3.5 h-3.5" />
          WhatsApp: (84) 98193-7580
        </a>
      </div>
      {!compact && (
        <p className={`mt-2 text-[11px] text-slate-400 ${centered ? 'text-center' : ''}`}>
          Design, desenvolvimento e suporte do sistema oficial AgendAI.
        </p>
      )}
    </div>
  );
};
