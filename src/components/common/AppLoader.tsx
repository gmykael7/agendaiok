import React from 'react';
import { BrandLogo } from './BrandLogo';

/** Loader compacto da marca: anel em movimento com o logotipo no centro. */
export function BrandLoader({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
      <div className="app-brand-loader" style={{ width: size, height: size }} aria-hidden="true">
        <span className="app-brand-loader__ring" />
        <span className="app-brand-loader__core">
          <BrandLogo variant="mark" className="h-[70%] w-[70%]" />
        </span>
      </div>
      {label && <p className="text-xs font-semibold tracking-wide text-slate-400">{label}</p>}
      <span className="sr-only">{label || 'Carregando'}</span>
    </div>
  );
}

/** Bloco com brilho animado usado em esqueletos de conteúdo. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`app-skeleton ${className}`} />;
}

/** Esqueleto que imita a tela do painel enquanto os dados chegam. */
export function ContentSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      <span className="sr-only">Carregando</span>
      <div className="rounded-3xl border border-slate-800/60 bg-[#121B2E]/60 p-5 space-y-3">
        <SkeletonBlock className="h-5 w-40 rounded-lg" />
        <SkeletonBlock className="h-3 w-64 rounded-md" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <SkeletonBlock className="h-16 rounded-2xl" />
          <SkeletonBlock className="h-16 rounded-2xl" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-20 rounded-2xl" />
        <SkeletonBlock className="h-20 rounded-2xl" />
        <SkeletonBlock className="h-20 rounded-2xl" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-slate-800/60 bg-[#121B2E]/60 p-4 flex items-center gap-4">
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-1/2 rounded-md" />
            <SkeletonBlock className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default BrandLoader;
