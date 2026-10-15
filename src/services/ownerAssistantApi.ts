import { OWNER_ASSISTANT_SYSTEM_PROMPT } from './ownerHelpGuide';

type OwnerAssistantEnv = {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  ASSISTANT_AI_ENABLED?: string;
  ASSISTANT_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
};

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 800;

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) },
});

/**
 * Responde uma pergunta do barbeiro com IA. Quem chama já validou a sessão.
 * Sem IA ligada ou em caso de falha, devolve answer: null e o painel mostra as perguntas prontas.
 */
export async function handleOwnerAssistant(request: Request, env: OwnerAssistantEnv, email: string): Promise<Response> {
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);

  let body: { question?: unknown };
  try {
    body = await request.json() as { question?: unknown };
  } catch {
    return respond({ error: 'invalid_body' }, 400);
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_QUESTION_LENGTH) return respond({ error: 'invalid_question' }, 400);

  if (env.ASSISTANT_LIMITER) {
    const limit = await env.ASSISTANT_LIMITER.limit({ key: `owner-assistant:${email}` });
    if (!limit.success) return respond({ error: 'rate_limited' }, 429);
  }

  if (env.ASSISTANT_AI_ENABLED !== 'true' || !env.AI) {
    return respond({ answer: null, reason: 'ai_disabled' });
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: OWNER_ASSISTANT_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
      max_tokens: 250,
    }) as { response?: unknown };
    const answer = typeof result?.response === 'string' ? result.response.trim().slice(0, MAX_ANSWER_LENGTH) : '';
    if (!answer) return respond({ answer: null, reason: 'empty_answer' });
    return respond({ answer });
  } catch {
    return respond({ answer: null, reason: 'ai_error' });
  }
}
