import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingView } from '../src/views/LandingView';
import { AuthView } from '../src/views/AuthView';
import '../src/index.css';

function Preview() {
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  return <><div className="bg-slate-950 p-2 text-center text-xs text-white">Prévia local · cadastro e autenticação desativados</div>{mode
    ? <AuthView key={mode} initialMode={mode} onBack={() => setMode(null)} onLogin={() => {}} onRegister={() => {}} savedOrganizations={[]} />
    : <LandingView onLogin={() => setMode('login')} onRegister={() => setMode('register')} />}</>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
