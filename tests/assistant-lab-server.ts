import { handleAssistantRequest } from '../src/services/assistantApi';
import { assistantAddDays, assistantToday, isAssistantReply } from '../src/services/bookingAssistant';
import { fixture } from './assistant-fixtures';
import { labScenarios } from './assistant-lab-scenarios';

type Config = { apiKey?: string; enabled?: boolean; model?: string };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Sem imports de banco, arquivos de clientes, Worker ou configuração de produção.
export function createLabHandler(config: Config = {}, network: typeof fetch = fetch) {
  let calls = 0;
  let busy = false;
  const model = config.model || 'openrouter/owl-alpha';
  const ready = Boolean(config.enabled && config.apiKey);
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.hostname !== '127.0.0.1' || (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin)) {
      return json({ error: 'O laboratório aceita somente a origem local.' }, 403);
    }
    if (url.pathname === '/api/lab/status' && request.method === 'GET') {
      return json({ ready, model, remaining: Math.max(0, 10 - calls) });
    }
    if (url.pathname !== '/api/lab/run' || request.method !== 'POST') return json({ error: 'Rota bloqueada no laboratório. Nenhuma reserva foi gravada.' }, 403);
    if (!request.headers.get('Content-Type')?.includes('application/json')) return json({ error: 'Envie JSON.' }, 415);
    let body: { scenario?: unknown; live?: unknown };
    try {
      const raw = await request.text();
      if (raw.length > 1024) return json({ error: 'Pedido muito grande.' }, 413);
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['scenario', 'live'].includes(k))) throw new Error();
    } catch { return json({ error: 'Use somente os exemplos fictícios.' }, 400); }
    const scenario = labScenarios.find(item => item.id === body.scenario);
    if (!scenario || typeof body.live !== 'boolean') return json({ error: 'Exemplo inválido.' }, 400);
    if (busy) return json({ error: 'Aguarde a consulta em andamento.' }, 429);
    const live = body.live && ready && calls < 10;
    let note = body.live ? !ready ? 'IA não configurada. Resposta por regras locais, sem chamada externa.' : calls >= 10 ? 'Limite de 10 tentativas atingido. Resposta por regras locais.' : '' : 'Simulação guiada: nenhuma chamada externa.';
    busy = true;
    try {
      const data = structuredClone(fixture);
      data.appointments[0].date = assistantAddDays(assistantToday(), 1);
      const ai = {
        run: async (_name: unknown, input: unknown, options: { signal?: AbortSignal }) => {
          calls++;
          // Confere o modelo exato antes da inferência, sem substituição automática.
          const listing = await network('https://openrouter.ai/api/v1/models', { signal: options.signal, redirect: 'error' });
          if (!listing.ok) { note = 'Não foi possível conferir o modelo. Modo guiado ativado.'; throw new Error('catalog'); }
          const catalog = await listing.json() as { data?: { id: string; pricing?: Record<string, string>; supported_parameters?: string[] }[] };
          const entry = catalog.data?.find(item => item.id === model);
          if (!entry) { note = 'Modelo ausente do catálogo atual. Modo guiado ativado, sem inferência.'; throw new Error('missing_model'); }
          if (!entry.pricing || !['prompt', 'completion'].every(key => entry.pricing?.[key] !== undefined && Number(entry.pricing[key]) === 0)
            || (entry.pricing.request !== undefined && Number(entry.pricing.request) !== 0)) {
            note = 'O laboratório permite apenas modelos com preço zero informado. Nenhuma inferência realizada.';
            throw new Error('price');
          }
          if (!entry.supported_parameters?.includes('response_format')) { note = 'Modelo sem suporte declarado a JSON. Modo guiado ativado.'; throw new Error('format'); }
          const response = await network('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST', redirect: 'error', signal: options.signal,
            headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
            // Este modelo consome tokens de saída também no raciocínio interno.
            // O limite maior é exclusivo do laboratório; o Worker permanece inalterado.
            body: JSON.stringify({ ...(input as object), max_tokens: 1000, model, stream: false, provider: {
              allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0, completion: 0, request: 0 },
            } }),
          });
          if (!response.ok) { note = `Provedor indisponível (HTTP ${response.status}). Modo guiado ativado.`; throw new Error('provider'); }
          const result = await response.json() as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] };
          if (result.choices?.[0]?.finish_reason === 'length') {
            note = 'O modelo atingiu o limite de saída antes de concluir. Modo guiado ativado.';
            throw new Error('truncated');
          }
          return { response: result.choices?.[0]?.message?.content };
        },
      } as unknown as Parameters<typeof handleAssistantRequest>[1]['AI'];
      const response = await handleAssistantRequest(new Request(`${url.origin}/api/assistant`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url.origin },
        body: JSON.stringify({ org_slug: data.org.slug, message: scenario.text, selection: {} }),
      }), {
        ASSISTANT_AI_ENABLED: live ? 'true' : 'false', AI: ai,
        ASSISTANT_LIMITER: { limit: async () => ({ success: true }) } as Parameters<typeof handleAssistantRequest>[1]['ASSISTANT_LIMITER'],
      }, async slug => slug === data.org.slug ? data : null);
      const answer: unknown = await response.json();
      if (!response.ok || !isAssistantReply(answer)) return json({ error: 'Falha na simulação. Nenhuma reserva foi gravada.' }, 503);
      // Experimento local de período, sem alterar as regras da assistente em produção.
      if (scenario.id === 'afternoon' && answer.slots.length) {
        answer.slots = answer.slots.filter(slot => slot.time >= '12:00' && slot.time < '18:00');
        answer.reply += answer.slots.length ? '\nFiltro local aplicado: somente à tarde.' : '\nNão há opções à tarde; escolha outro exemplo.';
      }
      if (live && answer.mode === 'guided' && !note) note = 'IA não retornou uma interpretação válida ou excedeu o tempo. Modo guiado ativado.';
      if (answer.mode === 'ai') note = 'Interpretação real por IA. Preços e vagas calculados com dados fictícios pelo sistema.';
      return json({ answer, note, model: answer.mode === 'ai' ? model : null, remaining: Math.max(0, 10 - calls) });
    } finally { busy = false; }
  };
}
