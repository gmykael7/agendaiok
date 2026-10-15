import React, { useState } from 'react';
import { MotionPreference as Pref, readMotionPreference, saveMotionPreference } from '../../utils/motion';

/** Liga e desliga as animações do app, sem depender da configuração do aparelho. */
export const MotionPreference: React.FC = () => {
  const [pref, setPref] = useState<Pref>(readMotionPreference);
  const choose = (next: Pref) => {
    saveMotionPreference(next);
    setPref(next);
  };
  const options: { value: Pref; title: string; description: string }[] = [
    { value: 'on', title: 'Animações ativas', description: 'Entradas, transições e a troca de tema com movimento.' },
    { value: 'off', title: 'Animações reduzidas', description: 'Mudanças imediatas, sem movimento na tela.' },
  ];
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Animações do aplicativo">
      {options.map(({ value, title, description }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(value)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] ${
              active ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-[#0B1120] hover:border-slate-700'
            }`}
          >
            <span className="flex-1">
              <strong className="block text-sm text-white">{title}</strong>
              <span className="block mt-0.5 text-xs text-slate-400">{description}</span>
            </span>
            <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};

export default MotionPreference;
