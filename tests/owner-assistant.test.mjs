import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifactPath = resolve(process.cwd(), 'tests/artifacts/ownerAssistantApi.mjs');
await build({
  entryPoints: ['./src/services/ownerAssistantApi.ts'],
  outfile: artifactPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { handleOwnerAssistant } = await import(pathToFileURL(artifactPath).href);

const post = (body) => new Request('https://x.test/api/owner-assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('sem IA ligada, não chama o modelo e responde answer null', async () => {
  let called = false;
  const env = { ASSISTANT_AI_ENABLED: 'false', AI: { run: async () => { called = true; return { response: 'x' }; } } };
  const res = await handleOwnerAssistant(post({ question: 'Como cadastro um barbeiro?' }), env, 'dono@x.com');
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.answer, null);
  assert.equal(called, false);
});

test('pergunta vazia ou longa demais é recusada antes da IA', async () => {
  const env = { ASSISTANT_AI_ENABLED: 'true', AI: { run: async () => ({ response: 'x' }) } };
  assert.equal((await handleOwnerAssistant(post({ question: '   ' }), env, 'a@x.com')).status, 400);
  assert.equal((await handleOwnerAssistant(post({ question: 'a'.repeat(301) }), env, 'a@x.com')).status, 400);
});

test('limite de uso por conta bloqueia antes de chamar a IA', async () => {
  let called = false;
  const env = {
    ASSISTANT_AI_ENABLED: 'true',
    ASSISTANT_LIMITER: { limit: async () => ({ success: false }) },
    AI: { run: async () => { called = true; return { response: 'x' }; } },
  };
  const res = await handleOwnerAssistant(post({ question: 'oi' }), env, 'a@x.com');
  assert.equal(res.status, 429);
  assert.equal(called, false);
});

test('o prompt enviado contém só o guia e a pergunta, sem dados da conta', async () => {
  let sent = null;
  const env = { ASSISTANT_AI_ENABLED: 'true', AI: { run: async (_model, input) => { sent = input; return { response: 'Vá em Ajustes > Equipe.' }; } } };
  const res = await handleOwnerAssistant(post({ question: 'Como cadastro um barbeiro?' }), env, 'a@x.com');
  const data = await res.json();
  assert.equal(data.answer, 'Vá em Ajustes > Equipe.');
  const system = sent.messages.find(m => m.role === 'system').content;
  const user = sent.messages.find(m => m.role === 'user').content;
  assert.match(system, /Equipe/);
  assert.equal(user, 'Como cadastro um barbeiro?');
  // Procura dados reais (e-mail e valor em reais), não palavras de campo como "telefone".
  assert.doesNotMatch(system, /[\w.]+@[\w.]+|R\$\s?\d/);
});

test('falha do modelo volta para as perguntas prontas, sem expor detalhes', async () => {
  const env = { ASSISTANT_AI_ENABLED: 'true', AI: { run: async () => { throw new Error('boom secreto'); } } };
  const res = await handleOwnerAssistant(post({ question: 'oi' }), env, 'a@x.com');
  const data = await res.json();
  assert.equal(data.answer, null);
  assert.doesNotMatch(JSON.stringify(data), /boom secreto/);
});
