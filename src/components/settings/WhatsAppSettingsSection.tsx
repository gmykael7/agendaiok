import { appConfirm } from '../common/ConfirmDialog';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  Info,
} from 'lucide-react';
import { Organization, WhatsAppConnection } from '../../types';
import { getAuthToken } from '../../services/cloudSync';

interface WhatsAppSettingsSectionProps {
  org: Organization;
  setOrg: React.Dispatch<React.SetStateAction<Organization>>;
}

export const WhatsAppSettingsSection: React.FC<WhatsAppSettingsSectionProps> = ({ org, setOrg }) => {
  const connection: WhatsAppConnection = org.whatsapp_connection || {
    tenantId: org.slug || org.id,
    status: 'disconnected',
  };

  const isConnected = connection.status === 'connected';
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState(connection.phoneNumberId || '');
  const [businessAccountId, setBusinessAccountId] = useState(connection.businessAccountId || '');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(connection.displayPhoneNumber || org.phone || '');
  const [verifiedName, setVerifiedName] = useState(connection.verifiedName || org.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleConnectManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhoneId = phoneNumberId.replace(/\D/g, '').trim();
    if (!cleanPhoneId) {
      setFeedbackMessage({ type: 'error', text: 'Informe o Phone Number ID da Meta.' });
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

      const data = (await response.json()) as any;
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao conectar WhatsApp.');
      }

      setOrg((prev) => ({
        ...prev,
        whatsapp_connection: data.connection,
      }));

      setIsManualModalOpen(false);
      setFeedbackMessage({ type: 'success', text: 'WhatsApp conectado com sucesso!' });
    } catch (error: any) {
      if (!import.meta.env.DEV) {
        setFeedbackMessage({ type: 'error', text: error?.message || 'Não foi possível conectar o WhatsApp.' });
        return;
      }

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
    if (!await appConfirm('Deseja realmente desconectar o WhatsApp? O assistente deixará de responder neste número.', { danger: true })) {
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
      const data = (await response.json().catch(() => null)) as any;
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Não foi possível desconectar.');
    } catch (error: any) {
      if (!import.meta.env.DEV) {
        setFeedbackMessage({ type: 'error', text: error?.message || 'Falha ao desconectar.' });
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
    setFeedbackMessage({ type: 'success', text: 'WhatsApp desconectado.' });
  };

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-[#121B2E] p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  WhatsApp Oficial
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Atendimento e agendamentos automáticos pelo WhatsApp 24 horas por dia.
              </p>
            </div>
          </div>
        </div>

        {feedbackMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-sm flex items-center gap-2.5 ${
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

      {/* ESTADO CONECTADO OU DESCONECTADO */}
      {isConnected ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#121B2E] p-6 rounded-3xl border border-slate-800 shadow-xl space-y-5">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Número Conectado
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Número</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {connection.displayPhoneNumber || 'Não informado'}
                </span>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Empresa</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {connection.verifiedName || org.name}
                </span>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 sm:col-span-2">
                <span className="text-[11px] text-slate-400 block">Phone Number ID</span>
                <span className="text-xs font-mono text-slate-300 mt-0.5 block">
                  {connection.phoneNumberId}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Conectado em {connection.connectedAt ? new Date(connection.connectedAt).toLocaleDateString('pt-BR') : 'Hoje'}
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Unplug className="w-3.5 h-3.5" />
                Desconectar
              </button>
            </div>
          </div>

          <div className="bg-[#121B2E] p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3.5">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Recursos Ativos
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Atendimento automático 24/7
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Consulta de agenda em tempo real
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Agendamento, cancelamento e confirmação
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-[#121B2E] p-8 rounded-3xl border border-slate-800 shadow-xl text-center max-w-xl mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-emerald-400" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">Conectar WhatsApp da Barbearia</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Permita que seus clientes agendem e tirem dúvidas direto pelo WhatsApp.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2 transition-all active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            Conectar Número
          </button>
        </div>
      )}

      {/* MODAL SIMPLES E DIRETO (PORTAL NA RAIZ) */}
      {isManualModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] safe-screen">
          <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                Vincular WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1 min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectManual} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Phone Number ID *
                    </label>
                    <a
                      href="https://business.facebook.com/wa/manage/phone-numbers/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-0.5"
                    >
                      Abrir Meta <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1424718657391350"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                  />
                  {phoneNumberId.length >= 15 && phoneNumberId.length <= 17 && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-semibold mt-1">
                      <CheckCircle2 className="w-3 h-3" /> {phoneNumberId.length} dígitos
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Número com DDD
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (84) 98193-7580"
                    value={displayPhoneNumber}
                    onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Barbearia Vanguarda"
                    value={verifiedName}
                    onChange={(e) => setVerifiedName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Botões do Rodapé fixos */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2.5 shrink-0 bg-[#121B2E]">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-500/20"
                >
                  {isLoading ? 'Salvando...' : 'Salvar e Conectar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
