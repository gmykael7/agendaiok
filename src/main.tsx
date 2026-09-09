import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { LoadingState } from './components/common/LoadingState';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <React.Suspense fallback={<LoadingState />}><App /></React.Suspense>
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
