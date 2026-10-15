import React, { useState } from 'react';

/**
 * Mascote do assistente: um calendário com rosto.
 * Abstrato de propósito (não representa nenhum barbeiro).
 * - entry: pisca uma vez ao aparecer (use só no painel do barbeiro).
 * - Toque: acena uma vez. Sem loop contínuo.
 * - Com "Reduzir movimento" ativo, fica estático (regras no CSS).
 */
export const AgendaiMascot: React.FC<{ size?: number; entry?: boolean; interactive?: boolean; happyKey?: number; className?: string; label?: string }> = ({
  size = 40,
  entry = false,
  interactive = true,
  happyKey = 0,
  className = '',
  label = 'Ajuda do AgendAI',
}) => {
  const [waving, setWaving] = useState(false);

  const wave = () => {
    setWaving(true);
    window.setTimeout(() => setWaving(false), 1400);
  };

  return (
    <span
      role="img"
      onClick={interactive ? wave : undefined}
      aria-label={label}
      key={happyKey}
      className={`agendai-mascot agendai-mascot--idle ${entry ? 'agendai-mascot--entry' : ''} ${waving || happyKey > 0 ? 'agendai-mascot--happy' : ''} ${className}`}
      style={{ width: size, height: size, cursor: interactive ? 'pointer' : 'inherit' }}
      data-mascot
    >
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <rect x="20" y="6" width="6" height="12" rx="3" fill="#334155" />
        <rect x="38" y="6" width="6" height="12" rx="3" fill="#334155" />
        <rect x="8" y="12" width="48" height="44" rx="12" fill="var(--brand-color, #10B981)" />
        <path d="M8 24 V24 A12 12 0 0 1 20 12 H44 A12 12 0 0 1 56 24 V26 H8 Z" fill="color-mix(in srgb, var(--brand-color, #10B981) 65%, #000)" />
        <g className="agendai-mascot__eyes">
          <circle cx="24" cy="38" r="3.2" fill="#022C22" />
          <circle cx="40" cy="38" r="3.2" fill="#022C22" />
        </g>
        <path d="M25 46 Q32 51 39 46" fill="none" stroke="#022C22" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
};

export default AgendaiMascot;
