import React, { useEffect, useState } from 'react';
import type { SuperAdminTenant } from '../../services/superAdmin';
import { archivePlatformNotice, listPlatformNotices, sendPlatformNotice } from '../../services/platformNotices';
import { PlatformNotice, PlatformNoticeDraft, safeNoticeLink } from '../../services/platformNoticeTypes';
import { PlatformNoticeCard } from './PlatformNoticeCard';

const empty = (): PlatformNoticeDraft => ({ id: crypto.randomUUID(), recipient_email: '', title: '', message: '', support: false, pix: '', link: '', image_url: '' });
const input = 'mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-300';

export function SuperAdminNotices({ tenants }: { tenants: SuperAdminTenant[] }) {
  const [draft, setDraft] = useState(empty);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<PlatformNotice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [archiveId, setArchiveId] = useState('');
  const tenant = tenants.find(t => t.email === draft.recipient_email);
  const broadcast = draft.recipient_email === '*';
  useEffect(() => {
    const abort = new AbortController();
    setHistory([]); setArchiveId('');
    if (!draft.recipient_email) { setHistoryLoading(false); return; }
    setHistoryLoading(true);
    void listPlatformNotices(draft.recipient_email, abort.signal).then(items => {
      if (!abort.signal.aborted) setHistory(items);
    }).catch(() => {
      if (!abort.signal.aborted) setError('Não foi possível carregar o histórico desta barbearia.');
    }).finally(() => { if (!abort.signal.aborted) setHistoryLoading(false); });
    return () => abort.abort();
  }, [draft.recipient_email, revision]);
  const change = (patch: Partial<PlatformNoticeDraft>) => {
    setDraft(v => ({ ...v, ...patch, id: crypto.randomUUID() })); setReview(false); setError(''); setSuccess('');
  };
  return <section aria-label="Enviar mensagem para barbearias" className="rounded-3xl border border-slate-800 bg-[#0b1628] p-4 sm:p-5 space-y-5">
    <div><h2 className="font-black text-lg">Mensagens para as barbearias</h2><p className="text-xs text-slate-400 mt-1">Envie texto, imagem ou os dois para uma barbearia específica ou para todas de uma vez. O card aparece somente nos painéis administrativos.</p></div>
    <form onSubmit={e => {
      e.preventDefault(); setError('');
      if ((!tenant && !broadcast) || (!draft.message.trim() && !draft.image_url.trim())) { setError('Selecione o destinatário e escreva uma mensagem ou informe uma imagem.'); return; }
      if (safeNoticeLink(draft.link.trim()) === null) { setError('Use um link HTTPS válido, sem usuário ou senha.'); return; }
      if (safeNoticeLink(draft.image_url.trim()) === null) { setError('Use uma URL HTTPS válida para a imagem.'); return; }
      setReview(true);
    }} className="space-y-4">
      <fieldset disabled={busy || review} className="space-y-4 min-w-0 disabled:opacity-70">
        <label className="block text-xs text-slate-300">Barbearia destinatária
          <select required value={draft.recipient_email} onChange={e => change({ recipient_email: e.target.value })} className={input}>
            <option value="">Selecione uma barbearia</option>
            <option value="*">📣 Todas as barbearias ({tenants.length})</option>
            {tenants.map(t => <option key={t.email} value={t.email}>{t.name} — {t.email}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-300">Título (opcional)<input maxLength={120} value={draft.title} onChange={e => change({ title: e.target.value })} placeholder="Mensagem do AgendAI" className={input} /></label>
        <label className="block text-xs text-slate-300">Mensagem livre (opcional quando houver imagem)
          <textarea maxLength={4000} rows={5} value={draft.message} onChange={e => change({ message: e.target.value })} placeholder="Escreva o aviso ou novidade..." className={`${input} resize-y`} />
          <span className="block text-right text-slate-500 mt-1">{draft.message.length}/4000</span>
        </label>
        <label className="block text-xs text-slate-300">Imagem (URL pública HTTPS, opcional)<input type="url" maxLength={1200} value={draft.image_url} onChange={e => change({ image_url: e.target.value })} className={input} placeholder="https://.../imagem.jpg" /></label>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-200">
          <span>Pedido de apoio voluntário</span>
          <span className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${draft.support ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>{draft.support ? 'Ativado' : 'Desativado'}</span>
            <input aria-label="Ativar pedido de apoio voluntário" type="checkbox" checked={draft.support} onChange={e => change({ support: e.target.checked, pix: e.target.checked ? draft.pix : '' })} className="h-5 w-5 accent-emerald-400" />
          </span>
        </label>
        {draft.support && <label className="block text-xs text-slate-300">Chave PIX (opcional)<input maxLength={140} value={draft.pix} onChange={e => change({ pix: e.target.value })} className={input} placeholder="Sua chave PIX" /></label>}
        <label className="block text-xs text-slate-300">{draft.support ? 'Link de contribuição' : 'Link'} (opcional)<input type="url" maxLength={1200} value={draft.link} onChange={e => change({ link: e.target.value })} className={input} placeholder="https://..." /></label>
      </fieldset>
      {!review && <button type="submit" disabled={busy} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Revisar mensagem</button>}
    </form>
    {review && (tenant || broadcast) && <div className="space-y-3 rounded-2xl border border-amber-300/40 p-3 sm:p-4">
      <p className="text-sm font-bold text-amber-200 break-words">{broadcast ? `Enviar para todas as ${tenants.length} barbearias cadastradas` : `Enviar somente para: ${tenant!.name} (${tenant!.email})`}</p>
      <p className="text-xs text-slate-300">{broadcast ? 'Cada barbearia receberá seu próprio card e poderá marcá-lo como lido.' : `Nenhuma outra barbearia receberá este card.${tenant!.status === 'suspended' ? ' Esta conta está suspensa; verá o aviso após a reativação.' : ''}`}</p>
      <PlatformNoticeCard notice={{ ...draft, title: draft.title.trim() || 'Mensagem do AgendAI', message: draft.message.trim(), created_at: new Date().toISOString(), read_at: null, archived_at: null }} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => setReview(false)} className="rounded-xl border border-slate-600 px-4 py-3 text-sm">Voltar e editar</button>
        <button type="button" disabled={busy} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50" onClick={async () => {
          setBusy(true); setError('');
          try {
            const result = await sendPlatformNotice(draft);
            setSuccess(broadcast ? `Mensagem enviada para ${result.sentCount} barbearias.` : `Mensagem enviada somente para ${tenant!.name}.`);
            setDraft({ ...empty(), recipient_email: draft.recipient_email }); setReview(false); setRevision(n => n + 1);
          } catch (e) { setError(e instanceof Error ? e.message : 'Falha no envio.'); }
          finally { setBusy(false); }
        }}>{busy ? 'Enviando...' : broadcast ? 'Confirmar envio para todas' : 'Confirmar envio para esta barbearia'}</button>
      </div>
    </div>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
    {(tenant || broadcast) && <details className="border-t border-slate-800 pt-4">
      <summary className="cursor-pointer text-sm font-bold">{broadcast ? 'Histórico de envios para todas' : `Histórico de ${tenant!.name}`} (até 50 mensagens recentes)</summary>
      <button type="button" disabled={busy || historyLoading} onClick={() => { setError(''); setRevision(n => n + 1); }} className="text-xs text-cyan-200 py-3">{historyLoading ? 'Carregando...' : 'Atualizar histórico'}</button>
      {!historyLoading && !history.length && <p className="text-xs text-slate-400">Nenhuma mensagem carregada.</p>}
      <div className="space-y-3">{history.map(notice => <PlatformNoticeCard key={notice.id} notice={notice}>
        <span>{notice.archived_at ? 'Retirada do painel' : notice.read_at ? 'Lida pela barbearia' : 'Ainda não lida'}</span>
        {!notice.archived_at && (archiveId === notice.id ? <div className="flex flex-wrap gap-3 items-center">
          <span>Retirar este card do painel?</span>
          <button type="button" disabled={busy} className="text-rose-300 font-bold py-2" onClick={async () => {
            setBusy(true); setError('');
            try { await archivePlatformNotice(notice); setRevision(n => n + 1); setArchiveId(''); }
            catch (e) { setError(e instanceof Error ? e.message : 'Falha ao retirar mensagem.'); }
            finally { setBusy(false); }
          }}>Confirmar retirada</button>
          <button type="button" disabled={busy} onClick={() => setArchiveId('')} className="py-2">Manter</button>
        </div> : <button type="button" disabled={busy} onClick={() => setArchiveId(notice.id)} className="text-rose-300 py-2">Retirar do painel</button>)}
      </PlatformNoticeCard>)}</div>
    </details>}
  </section>;
}
