import { appConfirm } from '../common/ConfirmDialog';
import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Unplug,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Copy,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Organization, WhatsAppConnection } from '../../types';
import { useClipboard } from '../../hooks/useClipboard';
import { getAuthToken } from '../../services/cloudSync';

interface WhatsAppSettingsSectionProps {
  org: Organization;
  setOrg: React.Dispatch<React.SetStateAction<Organization>>;
}

const GUIDE_TEXT_FOR_BARBER = `💈 *Como pegar o Phone Number ID na Meta para ativar o WhatsApp do Salão:*

⚠️ *ATENÇÃO PARA NÃO ERRAR:*
Não copie o "ID do Aplicativo" que fica lá em cima no topo do site! O número correto fica dentro da aba do WhatsApp.

👉 *PASSO A PASSO:*
1️⃣ Entre no site de desenvolvedores da Meta:
🔗 https://developers.facebook.com/apps/

2️⃣ Clique no seu aplicativo.

3️⃣ No menu lateral esquerdo, clique em:
   *WhatsApp* ➡️ *Configuração da API* (ou *API Setup*)

4️⃣ Na tela, procure o quadro *"Enviar e receber mensagens"*:
   ✅ Copie o número do campo: *Identificação do número de telefone* (Phone number ID)
   (É um código com 15 a 16 dígitos numéricos)

   ✅ Se quiser, copie também a: *Identificação da conta do WhatsApp Business* (WABA ID)

5️⃣ Agora basta colar no painel do AgendAI e clicar em *Salvar e Conectar*! 🚀`;

export const WhatsAppSettingsSection: React.FC<WhatsAppSettingsSectionProps> = ({ org, setOrg }) => {
  const connection: WhatsAppConnection = org.whatsapp_connection || {
    tenantId: org.slug || org.id,
    status: 'disconnected',
  };

  const isConnected = connection.status === 'connected';
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(!isConnected);
  const [guideMode, setGuideMode] = useState<'test' | 'production'>('test');
  const [phoneNumberId, setPhoneNumberId] = useState(connection.phoneNumberId || '');
  const [businessAccountId, setBusinessAccountId] = useState(connection.businessAccountId || '');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(connection.displayPhoneNumber || org.phone || '');
  const [verifiedName, setVerifiedName] = useState(connection.verifiedName || org.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { copied: copiedGuide, copy: copyGuide } = useClipboard();

  const handleConnectManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhoneId = phoneNumberId.replace(/\D/g, '').trim();
    if (!cleanPhoneId) {
      setFeedbackMessage({ type: 'error', text: 'Informe a Identificação do número de telefone (Phone Number ID) da Meta.' });
      return;
    }

    setIsLoading(true);
    setFeedbackMessage(null);

    try {
      const token = getAuthToken();
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phoneNumberId: cleanPhoneId,
          businessAccountId: businessAccountId.replace(/\D/g, '').trim() || undefined,
          displayPhoneNumber: displayPhoneNumber.trim() || undefined,
          verifiedName: verifiedName.trim() || org.name,
        }),
      });

      const data = await response.json() as any;
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao conectar WhatsApp.');
      }

      setOrg((prev) => ({
        ...prev,
        whatsapp_connection: data.connection,
      }));

      setIsManualModalOpen(false);
      setFeedbackMessage({ type: 'success', text: 'WhatsApp conectado com sucesso ao estabelecimento!' });
    } catch (error: any) {
      if (!import.meta.env.DEV) {
        setFeedbackMessage({ type: 'error', text: error?.message || 'Não foi possível conectar o WhatsApp. Tente novamente.' });
        return;
      }

      // Ambiente local sem Worker: permite demonstrar a interface sem simular uma conexão em produção.
      const updatedConnection: WhatsAppConnection = {
        tenantId: org.slug || org.id,
        status: 'connected',
        phoneNumberId: cleanPhoneId,
        businessAccountId: businessAccountId.replace(/\D/g, '').trim() || undefined,
        displayPhoneNumber: displayPhoneNumber.trim() || org.phone,
        verifiedName: verifiedName.trim() || org.name,
        connectedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
      };

      setOrg((prev) => ({
        ...prev,
        whatsapp_connection: updatedConnection,
      }));

      setIsManualModalOpen(false);
      setFeedbackMessage({ type: 'success', text: 'WhatsApp conectado com sucesso!' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!await appConfirm('Deseja realmente desconectar este número de WhatsApp? O assistente deixará de responder neste número.', { danger: true })) {
      return;
    }

    setIsLoading(true);
    setFeedbackMessage(null);

    try {
      const token = getAuthToken();
      const response = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => null) as any;
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Não foi possível desconectar o WhatsApp.');
    } catch (error: any) {
      if (!import.meta.env.DEV) {
        setFeedbackMessage({ type: 'error', text: error?.message || 'Não foi possível desconectar o WhatsApp. Tente novamente.' });
        setIsLoading(false);
        return;
      }
    }

    setOrg((prev) => ({
      ...prev,
      whatsapp_connection: {
        tenantId: org.slug || org.id,
        status: 'disconnected',
      },
    }));

    setIsLoading(false);
    setFeedbackMessage({ type: 'success', text: 'WhatsApp desconectado com sucesso.' });
  };

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-[#121B2E] p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <MessageSquare className="w-5 h-5 sm:w-7 sm:h-7 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug">
                  WhatsApp Oficial & Atendimento
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold shrink-0 ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Conecte seu número de WhatsApp oficial da Meta para habilitar agendamento 24/7 com inteligência e WhatsApp Flows.
              </p>
            </div>
          </div>
        </div>

        {feedbackMessage && (
          <div
            className={`mt-4 p-4 rounded-xl text-sm flex items-center gap-2.5 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {feedbackMessage.text}
          </div>
        )}
      </div>

      {/* GUIA PASSO A PASSO ILUSTRADO */}
      <div className="bg-[#121B2E] rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                Onde encontrar os IDs no site da Meta (Guia Ilustrado)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Veja onde clicar na Meta para copiar a Identificação do Número sem confundir com o ID do App
              </p>
            </div>
          </div>
          {isGuideOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
          )}
        </button>

        {isGuideOpen && (
          <div className="px-5 pb-6 sm:px-6 sm:pb-6 pt-2 border-t border-slate-800/80 space-y-5">
            {/* SELETOR DE MODO DE NÚMERO */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuideMode('test')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    guideMode === 'test'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🧪 Número de Teste (Gratuito na Meta)
                </button>
                <button
                  type="button"
                  onClick={() => setGuideMode('production')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    guideMode === 'production'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📱 Chip Oficial da Barbearia
                </button>
              </div>

              <button
                type="button"
                onClick={() => copyGuide(GUIDE_TEXT_FOR_BARBER)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700"
                title="Copiar texto com formatação pronta para enviar no WhatsApp do barbeiro"
              >
                {copiedGuide ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Instruções copiadas!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copiar Guia para o WhatsApp</span>
                  </>
                )}
              </button>
            </div>

            {/* MOCKUP VISUAL DIDÁTICO DA TELA DA META */}
            <div className="meta-mockup-panel p-4 sm:p-5 rounded-2xl space-y-3 font-sans text-xs">
              <div className="meta-mockup-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  <span className="meta-mockup-title font-bold text-white text-xs">Visualização do Painel da Meta</span>
                </div>
                {/* AVISO DO MAIOR ERRO */}
                <div className="meta-mockup-alert-wrong flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>ID do aplicativo: 123456789... ❌ NÃO copie este número do topo!</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 pt-1">
                {/* MENU LATERAL META */}
                <div className="meta-mockup-sidebar-card bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Menu Lateral:</span>
                  <div className="pl-2 border-l-2 border-emerald-500 text-emerald-400 font-bold">
                    WhatsApp
                  </div>
                  <div className="meta-mockup-subitem pl-4 text-emerald-300 font-semibold bg-emerald-500/10 py-1 px-2 rounded-lg border border-emerald-500/20">
                    ↳ Configuração da API
                  </div>
                  <div className="pl-4 text-slate-500 text-[10px]">
                    (ou API Setup / Início Rápido)
                  </div>
                </div>

                {/* CONTEÚDO PRINCIPAL DA META */}
                <div className="lg:col-span-3 space-y-2.5">
                  <span className="meta-mockup-section-title text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    2. Localize a seção "Enviar e receber mensagens" no centro da tela:
                  </span>

                  {/* CAMPO CORRETO */}
                  <div className="meta-mockup-target-box p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/40 relative">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="meta-mockup-target-title text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Identificação do número de telefone (Phone number ID)
                        </span>
                        <span className="meta-mockup-number text-xs font-mono font-bold tracking-wider mt-0.5 block">
                          105492348572910
                        </span>
                        <span className="meta-mockup-target-desc text-[10px] text-emerald-300/80 mt-0.5 block">
                          Código de 15 a 16 dígitos exibido logo abaixo do número selecionado
                        </span>
                      </div>
                      <span className="meta-mockup-copy-badge px-2.5 py-1 bg-emerald-500 text-slate-950 font-extrabold rounded-md text-[10px] shrink-0 self-start sm:self-center shadow">
                        ✅ É ESTE NÚMERO QUE VOCÊ COPIA
                      </span>
                    </div>
                  </div>

                  {/* CAMPO WABA ID */}
                  <div className="meta-mockup-waba-box p-2.5 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="meta-mockup-waba-title text-[10px] text-slate-300 font-medium block">
                        Identificação da conta do WhatsApp Business (WABA ID)
                      </span>
                      <span className="meta-mockup-waba-number text-[11px] font-mono text-slate-400 block">
                        2381235335736494
                      </span>
                    </div>
                    <span className="meta-mockup-waba-badge px-2 py-0.5 bg-slate-800 text-slate-400 font-medium rounded text-[10px] shrink-0 self-start sm:self-center">
                      Opcional (segundo campo)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* PASSOS DETALHADOS EM 3 COLUNAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* PASSO 1 */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <a
                    href={guideMode === 'test' ? 'https://developers.facebook.com/apps/' : 'https://business.facebook.com/wa/manage/phone-numbers/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    Abrir Meta <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <h5 className="text-sm font-bold text-white">
                  {guideMode === 'test' ? 'Acesse o Meta for Developers' : 'Abra o Gerenciador de Telefones'}
                </h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {guideMode === 'test' ? (
                    <>Entre em <b>developers.facebook.com</b> com a conta do Facebook e clique no aplicativo do AgendAI.</>
                  ) : (
                    <>Acesse o <b>Gerenciador do WhatsApp</b> no Meta Business Suite onde os chips aprovados estão cadastrados.</>
                  )}
                </p>
              </div>

              {/* PASSO 2 */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {guideMode === 'test' ? 'WhatsApp > Configuração da API' : 'Tabela de Números'}
                  </span>
                </div>
                <h5 className="text-sm font-bold text-white">
                  {guideMode === 'test' ? 'Abra a Configuração da API' : 'Localize o Número do Salão'}
                </h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {guideMode === 'test' ? (
                    <>No menu lateral esquerdo, clique em <b>WhatsApp</b> e depois em <b>Configuração da API</b>.</>
                  ) : (
                    <>Na lista de números de telefone, encontre o chip verificado da sua barbearia.</>
                  )}
                </p>
              </div>

              {/* PASSO 3 */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Botão Copiar</span>
                </div>
                <h5 className="text-sm font-bold text-white">Copie a Identificação</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Clique no botão de cópia ao lado de <b>Identificação do número de telefone</b> (15 a 16 dígitos) e cole no modal abaixo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ESTADO CONECTADO */}
      {isConnected ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#121B2E] p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              Detalhes do Número Conectado
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Número Exibido</span>
                <span className="text-base font-bold text-white mt-1 block">
                  {connection.displayPhoneNumber || 'Não informado'}
                </span>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Nome da Empresa (Meta)</span>
                <span className="text-base font-bold text-white mt-1 block">
                  {connection.verifiedName || org.name}
                </span>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Phone Number ID</span>
                <span className="text-xs font-mono text-slate-300 mt-1 block break-all">
                  {connection.phoneNumberId}
                </span>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Conectado em</span>
                <span className="text-xs text-slate-300 mt-1 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {connection.connectedAt
                    ? new Date(connection.connectedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Hoje'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                O webhook da Cloud API está roteando mensagens diretamente para este estabelecimento.
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Unplug className="w-4 h-4" />
                Desconectar WhatsApp
              </button>
            </div>
          </div>

          <div className="bg-[#121B2E] p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Recursos Ativos
            </h4>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Atendimento automático 24/7 via WhatsApp
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Consulta de disponibilidade em tempo real
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Criação, cancelamento e reagendamento
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Suporte nativo a WhatsApp Flows (Fase 6)
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Bloqueio rigoroso de conflitos de agenda
              </li>
            </ul>
          </div>
        </div>
      ) : (
        /* ESTADO DESCONECTADO */
        <div className="bg-[#121B2E] p-8 rounded-3xl border border-slate-800 shadow-xl text-center max-w-2xl mx-auto space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">Conecte o WhatsApp do seu Salão</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
              Permita que seus clientes agendem horários, consultem serviços e recebam confirmações instantâneas diretamente pelo WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-2xl text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              Conectar WhatsApp (Meta Cloud API)
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Compatível com a API oficial da Meta. Sem risco de banimento de número.
          </p>
        </div>
      )}

      {/* MODAL DE CONEXÃO COM AJUDA INTEGRADA */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                Vincular Número de WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* BOX DE AJUDA COM LINKS DIRETOS E ALERTA CONTRA O APP ID */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-2.5">
              <div className="flex items-center justify-between font-bold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" /> Onde pegar esses números na Meta?
                </span>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-1"
                >
                  Abrir Meta <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Na Meta, abra seu App e vá no menu: <b>WhatsApp &gt; Configuração da API</b>. No centro da tela, copie o código do campo <b>Identificação do número de telefone</b>.
              </p>
              <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-[11px]">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span><b>Cuidado:</b> NÃO use o "ID do Aplicativo" do topo da tela! Use a Identificação do Número.</span>
              </div>
            </div>

            <form onSubmit={handleConnectManual} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Identificação do número de telefone (Phone Number ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 105492348572910"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                />
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  {phoneNumberId.length >= 15 && phoneNumberId.length <= 17 ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Código válido ({phoneNumberId.length} dígitos)
                    </span>
                  ) : phoneNumberId.length > 0 ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Geralmente possui 15 a 16 dígitos (digitado: {phoneNumberId.length})
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Código numérico de 15 a 16 dígitos exibido no painel da Meta.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Identificação da conta do WhatsApp Business (WABA ID)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 2381235335736494"
                  value={businessAccountId}
                  onChange={(e) => setBusinessAccountId(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Opcional. Exibido logo abaixo do Phone Number ID na tela da Meta.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Número Exibido (com DDD)
                </label>
                <input
                  type="text"
                  placeholder="Ex: (84) 98193-7580"
                  value={displayPhoneNumber}
                  onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome da Barbearia / Empresa
                </label>
                <input
                  type="text"
                  placeholder="Ex: Barbearia Vanguarda"
                  value={verifiedName}
                  onChange={(e) => setVerifiedName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? 'Salvando...' : 'Salvar e Conectar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
