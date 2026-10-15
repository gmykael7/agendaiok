import React from 'react';

/** Faixa fixa avisando que a tela é uma demonstração. Altura fixa: uma linha em qualquer largura. */
export const DemoBanner: React.FC = () => (
  <div
    role="status"
    className="demo-banner fixed inset-x-0 top-0 z-[250] flex h-9 items-center justify-center overflow-hidden bg-amber-400 px-3 text-center text-[11px] font-black whitespace-nowrap text-slate-950"
  >
    <span className="truncate">Demonstração: dados de exemplo, nada é salvo. Recarregue para começar de novo.</span>
  </div>
);

export default DemoBanner;
