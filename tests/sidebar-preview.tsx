import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from '../src/components/layout/Sidebar';
import { TabType } from '../src/types';
import { fixture } from './assistant-fixtures';
import '../src/index.css';

function SidebarPreview() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  return <div className="admin-app-shell fixed inset-0 overflow-hidden flex flex-col md:flex-row">
    <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} org={fixture.org}
      isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onLogout={() => {}} />
    <main className="min-w-0 flex-1 p-6">
      <h1>Prévia local do menu — dados fictícios</h1>
      <p>Aba selecionada: {currentTab}</p>
      <button type="button" onClick={() => setIsSidebarOpen(true)}>Abrir menu</button>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<SidebarPreview />);
