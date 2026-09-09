import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TenantBookingView } from '../src/views/TenantBookingView';
import { fixture } from './assistant-fixtures';
import '../src/index.css';

const gallery = [
  { id: 'ambiente', image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=85', caption: 'Um ambiente preparado para você', alt_text: 'Interior de uma barbearia' },
  { id: 'trabalho', image_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1400&q=85', caption: 'Cuidado em cada detalhe', alt_text: 'Atendimento em uma barbearia' },
  { id: 'ferramentas', image_url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=85', caption: 'Tradição e estilo', alt_text: 'Ferramentas de barbearia' },
];

function Preview() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.appTheme = light ? 'light' : 'dark';
    document.documentElement.style.setProperty('--app-bg-color', light ? '#f8fafc' : '#070B14');
    document.documentElement.style.setProperty('--app-surface-color', light ? '#ffffff' : '#121B2E');
    document.documentElement.style.setProperty('--brand-color', light ? '#0f766e' : '#10b981');
  }, [light]);

  const org = {
    ...fixture.org,
    name: 'Barbearia Imperial',
    phone: '(84) 99999-0000',
    public_gallery: gallery,
    social_links: {
      instagram: 'https://instagram.com/',
      facebook: 'https://facebook.com/',
      tiktok: 'https://tiktok.com/',
      youtube: 'https://youtube.com/',
      website: 'https://example.com/',
      maps: 'https://maps.google.com/',
    },
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg-color)' }}>
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-slate-700 bg-[#061120] px-4 py-3 text-white">
        <strong className="text-xs">PRÉVIA LOCAL • página pública</strong>
        <button type="button" onClick={() => setLight((value) => !value)} className="rounded-lg border border-cyan-400 px-3 py-2 text-xs font-bold">
          Usar tema {light ? 'escuro' : 'claro'}
        </button>
      </div>
      <TenantBookingView
        org={org}
        services={fixture.services}
        barbers={fixture.barbers}
        appointments={fixture.appointments}
        products={[]}
        isStandalone
        onAddAppointment={(appointment) => ({ ...appointment, id: appointment.id || crypto.randomUUID() })}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
