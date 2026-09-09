import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SuperAdminView } from '../src/views/SuperAdminView';
import { Header } from '../src/components/layout/Header';
import { PlatformNotices } from '../src/components/common/PlatformNotices';
import { setAuthToken } from '../src/services/cloudSync';
import { PlatformNotice } from '../src/services/platformNoticeTypes';
import { fixture } from './assistant-fixtures';
import type { AppNotification } from '../src/types';
import '../src/index.css';

const tenants = ['a', 'b'].map(letter => ({ email: `${letter}@barbearia.test`, name: `Barbearia ${letter.toUpperCase()} — demonstração`,
  slug: `demo-${letter}`, status: 'active', plan: 'trial', clients_count: 0, appointments_count: 0, barbers_count: 0, services_count: 0 }));
const notices: PlatformNotice[] = [];
let account = 'super';
setAuthToken('notice-preview-super');
// Fake data only. All requests are answered in memory, never forwarded to a server.
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const data = init?.body ? JSON.parse(String(init.body)) : {};
  const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  if (url.pathname === '/api/superadmin/status') return ok({ authorized: account === 'super', configured: true, canBootstrap: false });
  if (url.pathname === '/api/superadmin/tenants') return ok({ tenants });
  if (url.pathname === '/api/superadmin/notices') {
    if (account !== 'super') return ok({ error: 'Sem permissão.' }, 403);
    if (init?.method === 'POST') {
      if (data.action === 'send') {
        let notice = notices.find(n => n.id === data.id);
        if (!notice) { notice = { ...data, title: data.title.trim() || 'Mensagem do AgendAI', created_at: new Date().toISOString(), read_at: null, archived_at: null }; notices.unshift(notice!); }
        return ok({ notice });
      }
      const n = notices.find(n => n.id === data.id && n.recipient_email === data.recipient_email);
      if (n) n.archived_at = new Date().toISOString();
      return ok({ success: !!n });
    }
    return ok({ notices: notices.filter(n => n.recipient_email === url.searchParams.get('recipient_email')) });
  }
  if (url.pathname === '/api/notices') {
    const email = `${account}@barbearia.test`;
    if (init?.method === 'POST') {
      const n = notices.find(n => n.id === data.id && n.recipient_email === email);
      if (n) n.read_at = new Date().toISOString();
      return ok({ success: !!n }, n ? 200 : 404);
    }
    return ok({ notices: notices.filter(n => n.recipient_email === email && !n.archived_at) });
  }
  return ok({ error: 'Requisição bloqueada na prévia.' }, 503);
};
function Preview() {
  const [mode, setMode] = useState('super');
  const [light, setLight] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, AppNotification[]>>({});
  const [opening, setOpening] = useState(0);
  const simulate = (replace = false) => setNotifications(current => ({ ...current, [mode]: [
    { id: crypto.randomUUID(), org_id: mode, type: 'new_appointment', title: 'Novo agendamento de teste',
      message: 'Notificação fictícia para verificar o sino.', created_at: new Date().toISOString() },
    ...(replace ? (current[mode] || []).slice(1) : current[mode] || []),
  ] }));
  useEffect(() => {
    const root = document.documentElement;
    const isLight = mode !== 'super' && light;
    root.dataset.appTheme = isLight ? 'light' : 'dark';
    root.style.setProperty('--app-bg-color', isLight ? '#f1f5f9' : '#061120');
  }, [mode, light]);
  return <div className="min-h-screen text-white" style={{ background: 'var(--app-bg-color)' }}>
    <div style={{ padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #475569', background: '#061120' }}>
      <strong style={{ width: '100%' }}>PRÉVIA LOCAL • apenas dados fictícios</strong>
      {['super', 'a', 'b'].map(key => <button key={key} type="button" style={{ padding: 8, border: '1px solid #22d3ee', borderRadius: 8 }} onClick={() => {
        account = key; setAuthToken(`notice-preview-${key}`); setMode(key);
      }}>{key === 'super' ? 'Superadmin de teste' : `Abrir barbearia ${key.toUpperCase()}`}</button>)}
      {mode !== 'super' && <button type="button" onClick={() => setLight(v => !v)} style={{ padding: 8, border: '1px solid #22d3ee', borderRadius: 8 }}>Usar tema {light ? 'escuro' : 'claro'}</button>}
      {mode !== 'super' && <>
        <button type="button" onClick={() => setOpening(v => v + 1)} style={{ padding: 8, border: '1px solid #22d3ee', borderRadius: 8 }}>Simular abertura do app</button>
        <button type="button" onClick={() => simulate()} style={{ padding: 8, border: '1px solid #22d3ee', borderRadius: 8 }}>Simular notificação</button>
        <button type="button" onClick={() => simulate(true)} style={{ padding: 8, border: '1px solid #22d3ee', borderRadius: 8 }}>Nova com mesma contagem</button>
        <button type="button" onClick={() => setNotifications(current => ({ ...current, [mode]: [...current[mode] || []] }))} style={{ padding: 8, border: '1px solid #22d3ee', borderRadius: 8 }}>Simular sincronização</button>
      </>}
    </div>
    {mode === 'super' ? <SuperAdminView /> : <div className="admin-app-shell app-shell" key={mode}>
      <Header key={opening} org={{ ...fixture.org, id: mode, name: `Barbearia ${mode.toUpperCase()} — demonstração` }}
        notifications={notifications[mode] || []}
        onMarkNotificationRead={id => setNotifications(current => ({ ...current, [mode]: (current[mode] || []).map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n) }))}
        onMarkAllNotificationsRead={() => setNotifications(current => ({ ...current, [mode]: (current[mode] || []).map(n => ({ ...n, read_at: new Date().toISOString() })) }))}
      />
      <div className="app-content p-3 sm:p-6 md:p-8 max-w-[1600px] mx-auto"><PlatformNotices key={mode} /><h2 className="text-xl text-white">Início da barbearia {mode.toUpperCase()}</h2><p className="text-slate-400 mt-3">Os agendamentos continuam abaixo dos avisos.</p></div>
    </div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
