import React from 'react';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { PageSeo } from '../components/common/PageSeo';

export const TermsOfServiceView: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#070B14] text-slate-200 py-10 px-4 sm:px-6 lg:px-8">
      <PageSeo title="Termos de Serviço | AgendAI" description="Consulte as condições de uso, responsabilidades e regras da plataforma de gestão e agendamento AgendAI." path="/termos" structuredData={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Termos de Serviço do AgendAI', url: 'https://meuagendai.fun/termos', inLanguage: 'pt-BR' }} />
      <div className="max-w-3xl mx-auto space-y-8">
        {/* CABEÇALHO */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 shadow-md">
              <BrandLogo variant="mark" className="w-full h-full" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400">AgendAI</p>
              <h1 className="text-xl font-bold text-white tracking-tight">Termos de Serviço</h1>
            </div>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </a>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <article className="bg-[#121B2E] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl leading-relaxed text-sm text-slate-300">
          <div className="flex items-center gap-3 text-emerald-400 font-bold text-base">
            <FileText className="w-6 h-6 shrink-0" />
            <span>Termos de Uso da Plataforma</span>
          </div>

          <p>
            Bem-vindo ao <strong>AgendAI</strong>. Ao utilizar nosso software de agendamento e canais de atendimento integrados (incluindo o atendimento automatizado via WhatsApp), você concorda com estes Termos de Serviço.
          </p>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">1. Objeto do Serviço</h2>
            <p>
              O AgendAI fornece infraestrutura tecnológica de agendamento online, gestão de agenda, controle de caixa básico e atendimento inteligente via WhatsApp para barbearias, salões de beleza e profissionais autônomos.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Responsabilidade sobre os Atendimentos</h2>
            <p>
              O AgendAI atua como intermediador tecnológico de agendamento. A prestação efetiva do serviço físico, pontualidade, preços praticados e atendimento presencial são de exclusiva responsabilidade do estabelecimento contratante.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Uso Aceitável do WhatsApp</h2>
            <p>
              Os estabelecimentos e usuários concordam em utilizar o canal do WhatsApp em estrita conformidade com as Políticas Comerciais da Meta. É expressamente proibido o uso da plataforma para envio de spam, mensagens abusivas ou condutas que violem a legislação brasileira.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">4. Disponibilidade do Sistema</h2>
            <p>
              O AgendAI emprega infraestrutura de alta disponibilidade com servidores em nuvem (Cloudflare Workers e banco D1). Interrupções temporárias para manutenção preventiva ou falhas imprevistas em redes de terceiros (como falhas no serviço da Meta ou de operadoras) serão solucionadas com a maior agilidade possível.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500">
            Última atualização: Setembro de 2026.
          </div>
        </article>

        <div className="pt-2">
          <AgencyCredit centered />
        </div>
      </div>
    </main>
  );
};
