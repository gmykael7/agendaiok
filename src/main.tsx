import './utils/demoSandbox';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { ConfirmHost } from './components/common/ConfirmDialog';
import { DemoBanner } from './components/common/DemoBanner';
import { IS_DEMO } from './utils/demoSandbox';
import { BrandLoader } from './components/common/AppLoader';
import { applyMotionPreference } from './utils/motion';

applyMotionPreference();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ConfirmHost />
      {IS_DEMO && <DemoBanner />}
      <React.Suspense fallback={<div className="flex min-h-[60dvh] items-center justify-center"><BrandLoader size={64} label="Carregando" /></div>}><App /></React.Suspense>
    </AppErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.debug('Service Worker não registrado:', error);
    });
  });
}
