import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { TabType } from '../../types';
import { getAuthToken } from '../../services/cloudSync';

/**
 * Assistente do barbeiro, fase 1: sem IA. Perguntas prontas, respostas curtas
 * e um botão que leva direto à tela certa. Não altera nenhum dado.
 */
const QUESTIONS: { question: string; answer: string; tab: TabType; go: string }[] = [
  {
    question: 'Como cadastro um barbeiro?',
    answer: 'Em Ajustes, abra Equipe e toque em "Adicionar Barbeiro". Preencha nome, telefone e comissão.',
    tab: 'ajustes',
    go: 'Ir para Ajustes',
  },
  {
    question: 'Como configuro a comissão?',
    answer: 'Na Equipe, informe a porcentagem que o barbeiro recebe. Se o dono atende sozinho, marque "Atende sozinho": a comissão fica em 0% e o líquido é o que ele recebe.',
    tab: 'ajustes',
    go: 'Abrir Equipe',
  },
  {
    question: 'Por que o líquido do caixa está zerado?',
    answer: 'Geralmente a comissão do barbeiro está em 100%. Confira a porcentagem em Equipe. Se for o dono atendendo sozinho, marque "Atende sozinho".',
    tab: 'caixa',
    go: 'Ver Caixa',
  },
  {
    question: 'Como cadastro serviços e preços?',
    answer: 'Em Ajustes, abra Serviços e toque em "Cadastrar Serviço". Informe nome, preço e duração em minutos.',
    tab: 'ajustes',
    go: 'Abrir Serviços',
  },
  {
    question: 'Como libero o link para os clientes?',
    answer: 'No Início, use o botão "Link Cliente". Copie e envie no WhatsApp: o cliente agenda sozinho pelo link.',
    tab: 'dashboard',
    go: 'Voltar ao Início',
  },
  {
    question: 'Como faço um agendamento manual?',
    answer: 'Em Atender, toque em "Novo atendimento". Escolha cliente, serviço, barbeiro e horário, e confirme.',
    tab: 'atendimentos',
    go: 'Ir para Atender',
  },
];

interface OwnerAssistantProps {
  onNavigate: (tab: TabType) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OwnerAssistant: React.FC<OwnerAssistantProps> = ({ onNavigate, open, onOpenChange }) => {
  const [active, setActive] = useState<number | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState('');

  const askAi = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = aiQuestion.trim();
    if (!question || aiBusy) return;
    setAiBusy(true);
    setAiAnswer(null);
    setAiNotice('');
    try {
      const response = await fetch('/api/owner-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ question }),
      });
      const data = await response.json().catch(() => ({})) as { answer?: string | null; error?: string; reason?: string };
      if (response.status === 429) setAiNotice('Muitas perguntas em pouco tempo. Tente de novo em um minuto.');
      else if (response.status === 401) setAiNotice('Sua sessão expirou. Entre de novo para usar a ajuda.');
      else if (response.ok && data.answer) setAiAnswer(data.answer);
      else if (response.ok && data.reason === 'ai_disabled') setAiNotice('A pergunta livre ainda não está ativa. Use as perguntas prontas acima.');
      else setAiNotice('Não consegui responder agora. Use as perguntas prontas acima.');
    } catch {
      setAiNotice('Sem conexão. Use as perguntas prontas acima.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <>
      {open && (
        <section
          id="owner-assistant-panel"
          aria-label="Ajuda para configurar a barbearia"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.75rem)] sm:inset-x-auto sm:right-6 sm:w-96 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0B1120] p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">Como posso ajudar?</p>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar ajuda" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white active:scale-95"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-2">
            {QUESTIONS.map((item, index) => {
              const isOpen = active === index;
              return (
                <div key={item.question} className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setActive(isOpen ? null : index)}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-100 hover:text-white"
                  >
                    {item.question}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-xs text-slate-300 leading-relaxed">{item.answer}</p>
                      <button
                        type="button"
                        onClick={() => { onNavigate(item.tab); onOpenChange(false); }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold"
                      >
                        {item.go}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <form onSubmit={askAi} className="mt-4 space-y-2 border-t border-slate-800 pt-3">
            <label className="block text-[11px] font-semibold text-slate-300" htmlFor="owner-assistant-question">Outra dúvida?</label>
            <div className="flex gap-2">
              <input
                id="owner-assistant-question"
                value={aiQuestion}
                onChange={event => setAiQuestion(event.target.value)}
                maxLength={300}
                placeholder="Ex.: como cadastro o horário de almoço?"
                className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
              <button type="submit" disabled={aiBusy || !aiQuestion.trim()} className="rounded-xl bg-emerald-500 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">
                {aiBusy ? '...' : 'Perguntar'}
              </button>
            </div>
            {aiAnswer && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-relaxed text-slate-200">{aiAnswer}</p>}
            {aiNotice && <p className="text-[11px] text-amber-300">{aiNotice}</p>}
          </form>
          <p className="mt-3 text-[10px] text-slate-500">A assistente só explica. Nenhuma ação é feita por aqui.</p>
        </section>
      )}
    </>
  );
};

export default OwnerAssistant;
