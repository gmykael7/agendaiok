import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, Mail, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { PageSeo } from '../components/common/PageSeo';

export const PrivacyPolicyView: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#070B14] text-slate-200 py-10 px-4 sm:px-6 lg:px-8">
      <PageSeo title="Política de Privacidade | AgendAI" description="Saiba como o AgendAI coleta, utiliza, protege e permite a exclusão de dados pessoais em conformidade com a LGPD." path="/privacidade" structuredData={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Política de Privacidade do AgendAI', url: 'https://meuagendai.fun/privacidade', inLanguage: 'pt-BR' }} />
      <div className="max-w-3xl mx-auto space-y-8">
        {/* CABEÇALHO */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 shadow-md">
              <BrandLogo variant="mark" className="w-full h-full" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400">AgendAI</p>
              <h1 className="text-xl font-bold text-white tracking-tight">Política de Privacidade</h1>
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
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <span>Compromisso com a Privacidade e LGPD</span>
          </div>

          <p>
            O <strong>AgendAI</strong> valoriza a privacidade de seus usuários, estabelecimentos parceiros e de seus respectivos clientes. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais em nossa plataforma de gestão e através dos nossos canais integrados, incluindo o <strong>WhatsApp Cloud API oficial da Meta</strong>.
          </p>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">1. Informações que Coletamos</h2>
            <p>Para viabilizar o agendamento de serviços e o atendimento inteligente, coletamos apenas os dados estritamente necessários:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
              <li><strong>Clientes finais:</strong> Nome completo, número de WhatsApp/telefone e histórico de agendamentos realizados.</li>
              <li><strong>Estabelecimentos (barbearias e salões):</strong> Nome comercial, e-mail de contato, endereço, horários de expediente, catálogo de serviços e profissionais cadastrados.</li>
              <li><strong>Dados de integração com a Meta:</strong> Identificadores de telefone comercial (Phone Number ID e WABA ID) fornecidos voluntariamente durante a conexão com o WhatsApp.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Uso das Informações</h2>
            <p>As informações são utilizadas exclusivamente para:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
              <li>Confirmar, gerenciar, reagendar ou cancelar atendimentos agendados;</li>
              <li>Enviar lembretes automáticos e notificações operacionais via WhatsApp;</li>
              <li>Atualizar a agenda interna do estabelecimento em tempo real e evitar conflitos de horários;</li>
              <li>Garantir a segurança e integridade das contas de usuários na plataforma.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Integração Oficial com o WhatsApp (Meta Cloud API)</h2>
            <p>
              O AgendAI opera exclusivamente por meio da <strong>API Oficial da Meta (WhatsApp Cloud API)</strong>. Não utilizamos ferramentas não autorizadas de automação web. Todos os dados transmitidos entre a Meta e o AgendAI são protegidos por criptografia em trânsito (HTTPS/TLS) e assinaturas criptográficas de validação de webhook (HMAC-SHA256).
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">4. Compartilhamento de Dados</h2>
            <p>
              O AgendAI <strong>nunca comercializa, vende ou aluga dados pessoais</strong> a terceiros. O compartilhamento ocorre única e exclusivamente com fornecedores de infraestrutura indispensáveis à prestação do serviço (como servidores Cloudflare para hospedagem e banco de dados D1, e a Meta para entrega de mensagens de WhatsApp).
            </p>
          </div>

          <div className="space-y-3" id="exclusao">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              5. Exclusão e Retenção de Dados do Usuário (User Data Deletion)
            </h2>
            <p>
              Em conformidade com a LGPD e as diretrizes da Meta, qualquer usuário tem o direito de solicitar a exclusão definitiva de seus dados da plataforma.
            </p>
            <p className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-xs">
              <strong>Como solicitar a exclusão de seus dados:</strong>
              <br />
              Basta enviar um e-mail para <a href="mailto:privacidade@meuagendai.fun" className="text-emerald-400 hover:underline">privacidade@meuagendai.fun</a> ou <a href="mailto:admin@agendai.app" className="text-emerald-400 hover:underline">admin@agendai.app</a> com o assunto <em>"Exclusão de Dados"</em> e o número de telefone/e-mail cadastrado. A exclusão completa dos seus registros de atendimento e histórico será processada em até 48 horas úteis com confirmação por e-mail.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">6. Contato do Encarregado de Dados</h2>
            <p className="flex items-center gap-2 text-slate-400">
              <Mail className="w-4 h-4 text-emerald-400" />
              Dúvidas ou solicitações sobre privacidade: <span className="text-white font-medium">privacidade@meuagendai.fun</span>
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
