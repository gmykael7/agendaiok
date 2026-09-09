import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['tests/assistant-lab-server.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { createLabHandler } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const origin = 'http://127.0.0.1:5174';
const req = (body = { scenario: 'tomorrow', live: false }, path = '/api/lab/run', headers = {}) => new Request(origin + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body),
});
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const model = 'test/model:free';
const config = { apiKey: 'TEST-SECRET', enabled: true, model };
const listing = { data: [{ id: model, pricing: { prompt: '0', completion: '0' }, supported_parameters: ['response_format'] }] };
const completion = { choices: [{ message: { content: JSON.stringify({ topic: 'availability', serviceId: 'cut', barberId: 'ana' }) } }] };

test('modo guiado e falta de chave nunca chamam rede', async () => {
  const network = async () => { assert.fail('Rede não autorizada'); };
  for (const settings of [{}, { enabled: true }, { apiKey: 'TEST-SECRET', enabled: false }]) {
    const handler = createLabHandler(settings, network);
    for (const live of [false, true]) {
      const response = await handler(req({ scenario: 'tomorrow', live }));
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.answer.mode, 'guided');
      assert.ok(result.answer.slots.length);
      assert.match(result.answer.reply, /Nada foi reservado/);
    }
  }
});
test('sucesso simulado da API mantém chave no servidor e envia só catálogo público fictício', async () => {
  let count = 0;
  const handler = createLabHandler(config, async (url, options) => {
    count++;
    if (url.endsWith('/models')) return json(listing);
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer TEST-SECRET');
    assert.equal(options.redirect, 'error');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, model);
    assert.equal(payload.provider.allow_fallbacks, false);
    assert.deepEqual(payload.provider.max_price, { prompt: 0, completion: 0, request: 0 });
    assert.equal(options.body.includes('PRIVATE'), false);
    assert.equal(options.body.includes('TEST-SECRET'), false);
    assert.equal(options.body.includes('appointments'), false);
    assert.equal(options.body.includes('Serviço oculto'), false);
    assert.equal(payload.max_tokens, 1000);
    assert.ok(options.signal);
    return json(completion);
  });
  const response = await handler(req({ scenario: 'tomorrow', live: true }));
  const result = await response.json();
  assert.equal(count, 2);
  assert.equal(result.answer.mode, 'ai');
  assert.equal(result.remaining, 9);
  assert.equal(JSON.stringify(result).includes('TEST-SECRET'), false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
test('status não revela segredo nem chama catálogo automaticamente', async () => {
  const handler = createLabHandler(config, async () => assert.fail('Rede não autorizada'));
  const response = await handler(new Request(origin + '/api/lab/status'));
  assert.deepEqual(await response.json(), { ready: true, model, remaining: 10 });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('modelo ausente, pago ou sem JSON impedem inferência', async () => {
  for (const data of [[], [{ ...listing.data[0], pricing: { prompt: '1', completion: '0' } }],
    [{ ...listing.data[0], pricing: { prompt: '0', completion: '0', request: '1' } }],
    [{ ...listing.data[0], pricing: {} }], [{ ...listing.data[0], supported_parameters: [] }]]) {
    const handler = createLabHandler(config, async url => { assert.ok(url.endsWith('/models')); return json({ data }); });
    const result = await (await handler(req({ scenario: 'tomorrow', live: true }))).json();
    assert.equal(result.answer.mode, 'guided');
    assert.ok(result.note);
  }
});
test('erro, timeout e resposta inválida voltam ao modo guiado sem expor detalhes', async () => {
  for (const failure of [() => new Response('PROVIDER-SECRET', { status: 500 }),
    () => { throw new DOMException('PROVIDER-SECRET', 'TimeoutError'); },
    () => json({ choices: [{ message: { content: 'NOT-JSON PROVIDER-SECRET' } }] })]) {
    const handler = createLabHandler(config, async url => url.endsWith('/models') ? json(listing) : failure());
    const result = await (await handler(req({ scenario: 'tomorrow', live: true }))).json();
    assert.equal(result.answer.mode, 'guided');
    assert.equal(JSON.stringify(result).includes('PROVIDER-SECRET'), false);
  }
});
test('saída truncada não é aceita como interpretação válida', async () => {
  const handler = createLabHandler(config, async url => url.endsWith('/models') ? json(listing) : json({ choices: [{
    finish_reason: 'length', message: completion.choices[0].message,
  }] }));
  const result = await (await handler(req({ scenario: 'prices', live: true }))).json();
  assert.equal(result.answer.mode, 'guided');
  assert.match(result.note, /limite de saída/);
});
test('bloqueia texto livre, slugs reais, origem externa e rotas de gravação', async () => {
  const handler = createLabHandler(config, async () => assert.fail('Rede não autorizada'));
  for (const request of [req({ scenario: 'tomorrow', live: true, message: 'Nome real' }),
    req({ scenario: 'tomorrow', live: true, org_slug: 'real' }), req({ scenario: 'unknown', live: true }),
    req({ scenario: 'tomorrow', live: 'true' }), req({}, '/api/appointment'), req({}, '/api/sync'),
    req(undefined, '/api/lab/run', { Origin: 'https://evil.test' }),
    new Request('http://evil.test/api/lab/status'), req({ scenario: 'x'.repeat(2000), live: false })]) {
    assert.ok((await handler(request)).status >= 400);
  }
});
test('limite total de dez tentativas não reinicia ao recarregar a página', async () => {
  let count = 0;
  const handler = createLabHandler(config, async url => { if (url.endsWith('/models')) { count++; return json(listing); } return json(completion); });
  for (let i = 0; i < 11; i++) {
    const result = await (await handler(req({ scenario: 'tomorrow', live: true }))).json();
    assert.equal(result.answer.mode, i < 10 ? 'ai' : 'guided');
  }
  assert.equal(count, 10);
});
test('consulta concorrente é bloqueada enquanto a primeira aguarda', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const handler = createLabHandler(config, async url => { if (url.endsWith('/models')) await pending; return url.endsWith('/models') ? json(listing) : json(completion); });
  const first = handler(req({ scenario: 'tomorrow', live: true }));
  // A primeira chamada marca busy antes de aguardar a rede.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await handler(req())).status, 429);
  release();
  assert.equal((await first).status, 200);
});
test('tarde filtra horários; cancelamento não confirma reserva; todos os exemplos funcionam', async () => {
  const handler = createLabHandler();
  for (const scenario of ['prices', 'tomorrow', 'afternoon', 'natural', 'hours', 'cancel']) {
    const response = await handler(req({ scenario, live: false }));
    assert.equal(response.status, 200);
    const { answer } = await response.json();
    if (scenario === 'afternoon') {
      assert.ok(answer.slots.length);
      assert.ok(answer.slots.every(s => s.time >= '14:00' && s.time < '18:00'));
    }
    if (scenario === 'cancel') { assert.equal(answer.slots.length, 0); assert.match(answer.reply, /entre em contato/); }
  }
});
