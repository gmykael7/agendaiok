import React, { useState } from 'react';
import { HeartHandshake, Megaphone, Copy, ExternalLink } from 'lucide-react';
import { PlatformNotice, safeNoticeLink } from '../../services/platformNoticeTypes';

export function PlatformNoticeCard({ notice, children }: { notice: PlatformNotice; children?: React.ReactNode }) {
  const [copyStatus, setCopyStatus] = useState('');
  const link = safeNoticeLink(notice.link);
  const image = safeNoticeLink(notice.image_url);
  const Icon = notice.support ? HeartHandshake : Megaphone;
  return <article className="platform-notice-card min-w-0 rounded-2xl border border-cyan-400/25 bg-[#0b1b2d] p-4 sm:p-5 text-white">
    <div className="flex items-center gap-2 text-cyan-200 text-xs font-bold">
      <Icon className="w-4 h-4 shrink-0" /><span>AgendAI • {notice.support ? 'Apoio voluntário' : 'Mensagem da administração'}</span>
    </div>
    <h3 className="mt-3 font-black text-base sm:text-lg break-words [overflow-wrap:anywhere]">{notice.title}</h3>
    {image && <img src={image} alt={notice.title} loading="lazy" referrerPolicy="no-referrer" className="mt-3 max-h-80 w-full rounded-xl border border-slate-700/70 object-contain bg-slate-950/30" />}
    {notice.message && <p className="mt-2 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{notice.message}</p>}
    {notice.support && <p className="mt-3 text-xs text-amber-200">Contribuição opcional. Não é uma cobrança e não altera seu acesso ao app.</p>}
    {notice.pix && <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <p className="text-xs font-bold text-slate-400">Chave PIX</p>
      <p className="mt-1 font-mono text-sm break-all select-all">{notice.pix}</p>
      <button type="button" onClick={async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        setCopyStatus('Copiando...');
        try {
          await Promise.race([navigator.clipboard.writeText(notice.pix), new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Clipboard timeout')), 4000);
          })]);
          setCopyStatus('Chave copiada!');
        }
        catch { setCopyStatus('Não foi possível copiar. Selecione a chave acima.'); }
        finally { if (timer) clearTimeout(timer); }
      }} className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-cyan-200 py-2"><Copy className="w-4 h-4" />Copiar chave PIX</button>
      {copyStatus && <p role="status" className="text-xs text-cyan-200">{copyStatus}</p>}
    </div>}
    {link && <a href={link} target="_blank" rel="noopener noreferrer" className="mt-3 flex w-fit max-w-full items-center gap-2 rounded-xl border border-cyan-400/30 px-3 py-2.5 text-xs font-bold text-cyan-200">
      <ExternalLink className="w-4 h-4 shrink-0" /><span className="break-all">{notice.support ? 'Contribuir' : 'Abrir link'} • {new URL(link).hostname}</span>
    </a>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
      <time dateTime={notice.created_at}>{new Date(notice.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
      {children}
    </div>
  </article>;
}
