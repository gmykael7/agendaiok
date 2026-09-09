import React from 'react';
import { createRoot } from 'react-dom/client';
import { TenantBookingView } from '../src/views/TenantBookingView';
import { fixture } from './assistant-fixtures';
import '../src/index.css';

// Esta página usa somente dados fictícios. Não permite gravar reservas nem consultar produção.
window.fetch = async () => new Response(JSON.stringify({ error: 'Esta é uma demonstração local. Nenhum agendamento foi gravado.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });

createRoot(document.getElementById('root')!).render(<>
  <div className="p-3 bg-amber-100 text-amber-950 text-center text-sm">Prévia local — dados fictícios, sem gravações. <button type="button" className="underline font-bold" onClick={() => { document.documentElement.dataset.appTheme = document.documentElement.dataset.appTheme === 'light' ? 'dark' : 'light'; }}>Alternar tema</button></div>
  <TenantBookingView {...fixture} onAddAppointment={() => { throw new Error('Gravação bloqueada na prévia'); }} isStandalone />
</>);
