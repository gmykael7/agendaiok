import React from 'react';
import { Gift, Scissors, Sparkles, Check, Award } from 'lucide-react';
import { Client, Organization } from '../../types';
import { calculateLoyaltyProgress } from '../../utils/loyalty';

interface LoyaltyCardWidgetProps {
  client?: Partial<Client> | null;
  org?: Partial<Organization> | null;
  compact?: boolean;
  onRedeem?: () => void;
  canRedeem?: boolean;
}

export const LoyaltyCardWidget: React.FC<LoyaltyCardWidgetProps> = ({
  client,
  org,
  compact = false,
  onRedeem,
  canRedeem = false,
}) => {
  const {
    target,
    stamps,
    rewardsAvailable,
    remaining,
    progressPercent,
    rewardDescription,
    hasReward,
  } = calculateLoyaltyProgress(client, org);

  // Array com índices de 0 a target - 1
  const stampSlots = Array.from({ length: target }, (_, i) => i + 1);

  return (
    <div className={`loyalty-card-widget relative overflow-hidden rounded-2xl border transition-all ${
      hasReward 
        ? 'bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 border-amber-500/40 shadow-lg shadow-amber-500/10'
        : 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-slate-800'
    } ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}>
      {/* Detalhe de fundo com brilho */}
      <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

      {/* CABEÇALHO DO CARTÃO */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`loyalty-icon-box w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border shrink-0 ${
            hasReward
              ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {hasReward ? <Sparkles className="w-4 h-4 animate-spin-slow" /> : <Award className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              <span>Cartão Fidelidade</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                {stamps}/{target}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">
              Prêmio: <strong className="text-amber-200">{rewardDescription}</strong>
            </p>
          </div>
        </div>

        {rewardsAvailable > 0 && (
          <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs font-black flex items-center gap-1 shadow-sm">
            <Gift className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{rewardsAvailable} disponível</span>
          </span>
        )}
      </div>

      {/* GRADE DE CARIMBOS / SELOS */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2 my-3">
        {stampSlots.map((slotNum) => {
          const isStamped = slotNum <= stamps;
          const isTargetSlot = slotNum === target;

          return (
            <div
              key={slotNum}
              className={`loyalty-stamp-slot aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                isStamped
                  ? 'loyalty-stamp-filled bg-amber-400/20 border-2 border-amber-400 text-amber-300 shadow-sm shadow-amber-400/20 scale-100'
                  : isTargetSlot
                  ? 'loyalty-stamp-target bg-slate-950/70 border-2 border-dashed border-amber-400/40 text-amber-400/60'
                  : 'loyalty-stamp-empty bg-slate-950/60 border border-dashed border-slate-800 text-slate-600'
              }`}
            >
              {isStamped ? (
                isTargetSlot ? (
                  <Gift className="w-4 h-4 text-amber-300 animate-pulse" />
                ) : (
                  <Scissors className="w-3.5 h-3.5 text-amber-300" />
                )
              ) : isTargetSlot ? (
                <Gift className="w-3.5 h-3.5 opacity-60" />
              ) : (
                <span className="text-[10px] font-bold font-mono">{slotNum}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* BARRA DE PROGRESSO & RESUMO */}
      <div className="mt-2 space-y-1.5">
        <div className="loyalty-progress-track w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              hasReward
                ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                : 'bg-gradient-to-r from-amber-500 to-amber-300'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1">
          {hasReward ? (
            <span className="font-bold text-emerald-300 flex items-center gap-1">
              <Gift className="w-3.5 h-3.5 shrink-0" />
              Pronto para resgatar {rewardDescription}!
            </span>
          ) : (
            <span className="text-slate-400">
              Faltam apenas <strong className="text-white">{remaining}</strong> para seu <strong className="text-amber-300">{rewardDescription}</strong>!
            </span>
          )}

          {canRedeem && onRedeem && rewardsAvailable > 0 && (
            <button
              type="button"
              onClick={onRedeem}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] uppercase tracking-wide flex items-center gap-1 shadow-md shadow-amber-400/20 active:scale-95 shrink-0"
            >
              <Gift className="w-3 h-3" />
              <span>Resgatar Agora</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
