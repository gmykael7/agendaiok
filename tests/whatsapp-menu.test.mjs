import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({
  stdin: { contents: "export * from './src/integrations/whatsapp/conversation'; export { sendWhatsAppText } from './src/integrations/whatsapp/client';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const { welcomeMenu, createConversationMenu, toInteractivePayload, sendWhatsAppText } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const env = { WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_PHONE_NUMBER_ID: 'wrong-default' };

function mockFetch(t, response) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return response(calls.length);
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

test('envia lista nativa com IDs únicos, limites válidos e número do tenant correto', async t => {
  const calls = mockFetch(t, () => new Response('{"messages":[{"id":"sent"}]}'));
  const menu = welcomeMenu('Barbearia Teste', 'Carlos');
  await sendWhatsAppText(env, '55 84 99999-0000', menu.text, 'tenant-number', menu);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/tenant-number/messages'));
  assert.equal(calls[0].body.type, 'interactive');
  assert.equal(calls[0].body.to, '5584999990000');
  const interactive = calls[0].body.interactive;
  assert.equal(interactive.type, 'list');
  assert.ok(interactive.body.text.length <= 1024);
  assert.ok(interactive.action.button.length <= 20);
  const rows = interactive.action.sections.flatMap(s => s.rows);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.ok(rows.length <= 10);
  assert.ok(rows.every(row => row.title.length <= 24 && (row.description?.length || 0) <= 72));
  assert.ok(rows.every(row => !row.description || !row.title.endsWith(row.description)));
});

test('rejeição explícita do formato interativo mantém alternativa numerada em texto', async t => {
  const calls = mockFetch(t, n => n === 1
    ? new Response('{"error":{"code":100}}', { status: 400 }) : new Response('{}'));
  const menu = welcomeMenu('Barbearia Teste', '');
  await sendWhatsAppText(env, '5584999990000', menu.text, 'tenant', menu);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.type, 'text');
  assert.equal(calls[1].body.text.body, menu.text);
  assert.match(calls[1].body.text.body, /1 · Agendar/);
});

test('erro de autenticação não é repetido e texto longo preserva números', async t => {
  const calls = mockFetch(t, () => new Response('{"error":{"code":190}}', { status: 401 }));
  const menu = welcomeMenu('Barbearia Teste', '');
  await assert.rejects(sendWhatsAppText(env, '5584999990000', menu.text, 'tenant', menu), /401/);
  assert.equal(calls.length, 1);
  const long = createConversationMenu('a'.repeat(1025), [{ title: 'Agendar', text: 'Agendar' }]);
  assert.equal(toInteractivePayload(long), undefined);
});
