import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Download, X, Share, PlusSquare } from 'lucide-react';

const INSTALL_PROMPT_SEEN_KEY = 'agendai_pwa_prompt_seen';
const LEGACY_DISMISSED_KEY = 'agendai_pwa_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(INSTALL_PROMPT_SEEN_KEY) === '1' || Boolean(localStorage.getItem(LEGACY_DISMISSED_KEY));
  });
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Verifica se já está rodando como app instalado (standalone)
    const isApp = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isApp) {
      setIsStandalone(true);
      return;
    }

    // Detecta se é iOS (iPhone/iPad)
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) || 
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIos(isAppleDevice);

    const wasSeen = localStorage.getItem(INSTALL_PROMPT_SEEN_KEY) === '1' || Boolean(localStorage.getItem(LEGACY_DISMISSED_KEY));
    if (isAppleDevice && !wasSeen) {
      localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, '1');
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      deferredPromptRef.current = prompt;
      setDeferredPrompt(prompt);
      if (!wasSeen) localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, '1');
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    const handleRequestInstall = async () => {
      const prompt = deferredPromptRef.current;
      if (prompt) {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') setIsStandalone(true);
        deferredPromptRef.current = null;
        setDeferredPrompt(null);
      } else if (isAppleDevice) {
        setShowIosGuide(true);
      } else {
        alert('Para instalar no Android:\n1. Toque nos 3 pontinhos do Chrome (canto superior direito)\n2. Selecione "Instalar aplicativo" ou "Adicionar à tela inicial"');
      }
    };

    window.addEventListener('agendai-request-install', handleRequestInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('agendai-request-install', handleRequestInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsStandalone(true);
    }
    deferredPromptRef.current = null;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosGuide(false);
    localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, '1');
  };

  if (isStandalone || dismissed) {
    return null;
  }

  // Não exibe se não tiver prompt do Android e não for iOS
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <>
      {/* Banner Principal de Instalação */}
      <div className="pwa-install-banner fixed bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-fadeIn">
        <div className="pwa-install-card flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-[#0f172a] p-4 text-white shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="pwa-install-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="pwa-install-title truncate text-xs font-bold text-white sm:text-sm">Instalar o App AgendAI</h4>
              <p className="pwa-install-description truncate text-[11px] text-slate-300">
                {isIos ? 'Adicione à tela de início do seu iPhone' : 'Acesse mais rápido direto na tela inicial!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="pwa-install-action flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dispensar aviso de instalação"
              className="pwa-install-dismiss inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Guia Popup Exclusivo para iPhone (Safari iOS) */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 animate-fadeIn" onClick={() => setShowIosGuide(false)}>
          <div className="pwa-install-guide w-full max-w-sm space-y-4 rounded-3xl border border-slate-800 bg-[#0f172a] p-5 text-white shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Instalar no iPhone (iOS)</h3>
              </div>
              <button onClick={() => setShowIosGuide(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white block mb-0.5">1. Toque em Compartilhar</strong>
                  <span>Na barra inferior do Safari, toque no ícone com o quadrado e a seta para cima.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white block mb-0.5">2. "Adicionar à Tela de Início"</strong>
                  <span>Role a lista de opções para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white block mb-0.5">3. Confirmar "Adicionar"</strong>
                  <span>Toque em <strong>Adicionar</strong> no canto superior direito para criar o ícone do App.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
