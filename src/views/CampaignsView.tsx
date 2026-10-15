import React, { useMemo, useState } from 'react';
import { Megaphone, MessageCircle } from 'lucide-react';
import type { Appointment, Client, Organization } from '../types';
import { applyWhatsAppTemplate, buildWhatsAppUrl } from '../utils/whatsapp';
import { campaignTemplates, selectCampaignClients, type CampaignAudience } from '../utils/campaigns';
import { loadCampaignDrafts, saveCampaignDrafts } from '../utils/campaignDrafts';

type CampaignsViewProps = { clients: Client[]; appointments: Appointment[]; org: Organization };

export function CampaignsView(props: CampaignsViewProps) {
  // Remount on tenant change so no draft from another shop can be displayed or saved.
  return <CampaignsEditor key={props.org.id} {...props} />;
}

function CampaignsEditor({ clients, appointments, org }: CampaignsViewProps) {
  const [audience, setAudience] = useState<CampaignAudience>('inactive');
  const [initial] = useState(() => {
    try { return loadCampaignDrafts(org.id, window.localStorage); }
    catch { return { drafts: { ...campaignTemplates }, error: true }; }
  });
  const [drafts, setDrafts] = useState(initial.drafts);
  const [saveStatus, setSaveStatus] = useState<'ready' | 'saved' | 'error'>(initial.error ? 'error' : 'ready');
  const updateMessage = (value: string) => {
    const next = { ...drafts, [audience]: value };
    setDrafts(next);
    // Write immediately, not in a debounce that could be canceled by navigation.
    try { setSaveStatus(saveCampaignDrafts(org.id, next, window.localStorage) ? 'saved' : 'error'); }
    catch { setSaveStatus('error'); }
  };
  const [reviewId, setReviewId] = useState<string | null>(null);
  const message = drafts[audience];
  const today = new Date().toDateString();
  const selected = useMemo(() => selectCampaignClients(clients, appointments, org, audience), [clients, appointments, org, audience, today]);
  const reviewing = selected.find(client => client.id === reviewId);
  const personalized = reviewing ? applyWhatsAppTemplate(message, { cliente: reviewing.name, barbearia: org.name }).trim() : '';
  const descriptions: Record<CampaignAudience, string> = {
    inactive: `Sem visita concluída há pelo menos ${org.crm_inactive_days || 30} dias e sem próximo agendamento. Clientes sem histórico não entram neste público.`,
    subscribers: 'Clientes vinculados a um plano ativo cadastrado na barbearia.',
    'father-son': 'Clientes com “Pai & Filho” ou “Pai e Filho” nas observações, no plano ativo ou em um serviço concluído.',
    all: 'Todos os clientes não arquivados com telefone brasileiro em formato válido.',
  };
  const panel = 'rounded-3xl border border-slate-800 bg-[#121B2E] p-5';
  return (
    <div className="app-view space-y-6 animate-fadeIn">
      <header className={panel}>
        <h2 className="text-2xl font-black text-white flex gap-2 items-center"><Megaphone className="text-emerald-400" />Campanhas</h2>
        <p className="text-sm text-slate-400 mt-1">Organize por público e revise cada mensagem. Nenhum envio é automático.</p>
      </header>
      <section className={panel + ' space-y-3'}>
        <label htmlFor="campaign-audience" className="block text-sm font-bold text-white">Público</label>
        <select id="campaign-audience" value={audience} onChange={event => { setAudience(event.target.value as CampaignAudience); setReviewId(null); }} className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white">
          <option value="inactive">Clientes inativos</option><option value="subscribers">Assinantes</option><option value="father-son">Pai & Filho</option><option value="all">Todos os clientes</option>
        </select>
        <p className="text-sm text-slate-400">{descriptions[audience]}</p>
        <label htmlFor="campaign-message" className="block text-sm font-bold text-white">Mensagem</label>
        <textarea id="campaign-message" value={message} onChange={event => updateMessage(event.target.value)} rows={4} className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white" />
        <p role="status" className={saveStatus === 'error' ? 'text-sm text-amber-400' : 'text-sm text-emerald-300'}>
          {saveStatus === 'error' ? 'Não foi possível recuperar ou salvar o rascunho neste navegador. Copie a mensagem antes de sair.' : saveStatus === 'saved' ? 'Rascunho salvo neste navegador.' : 'Salvamento automático por barbearia e por público neste navegador.'}
        </p>
        <p className="text-xs text-slate-400">Use {'{cliente}'} e {'{barbearia}'} para personalizar. Os rascunhos não são sincronizados com outros dispositivos; limpar os dados do navegador os remove. Contate apenas clientes que autorizaram comunicações.</p>
        <p className="text-sm text-emerald-300" role="status">{selected.length} cliente(s) disponível(is) com telefone válido.</p>
      </section>
      {!selected.length && <p className={panel + ' text-slate-400'}>Nenhum cliente atende aos critérios deste público. Confira os cadastros e o histórico ou escolha outro público.</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {selected.map(client => (
          <article key={client.id} className="rounded-2xl bg-[#121B2E] border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><h3 className="text-white font-bold break-words">{client.name}</h3><p className="text-sm text-slate-400">{client.phone}</p></div>
              <button type="button" onClick={() => setReviewId(reviewId === client.id ? null : client.id)} disabled={!message.trim()} aria-expanded={reviewId === client.id} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 flex gap-1 items-center disabled:opacity-40"><MessageCircle className="w-4" />Revisar mensagem</button>
            </div>
            {reviewing?.id === client.id && <div className="space-y-3 border-t border-slate-700 pt-3">
              <p className="whitespace-pre-wrap break-words text-white">{personalized || 'Escreva uma mensagem antes de continuar.'}</p>
              {personalized && <a href={buildWhatsAppUrl(client.phone, personalized)} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">Abrir no WhatsApp</a>}
              <p className="text-xs text-slate-400">Confirme o envio no WhatsApp. Abrir a conversa não significa mensagem enviada.</p>
            </div>}
          </article>
        ))}
      </div>
    </div>
  );
}
