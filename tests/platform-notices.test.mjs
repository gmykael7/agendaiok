import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/worker.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const A = 'a@barbearia.test', B = 'b@barbearia.test', ADMIN = 'super@agendai.test';
function setup(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());
  const put = (key, value) => sql.prepare('INSERT INTO app_store VALUES (?, ?, NULL, ?)').run(key, JSON.stringify(value), Date.now());
  for (const email of [A, B, ADMIN]) put(`user:${email}`, { org: { id: email, email, name: email, account_status: 'active' }, appointments: [{ id: 'keep' }] });
  // superadmin:email is plain text in the existing app_store contract.
  sql.prepare('INSERT INTO app_store VALUES (?, ?, NULL, ?)').run('superadmin:email', ADMIN, Date.now());
  for (const [token, email, role, login_email] of [['super', ADMIN, 'owner', ADMIN], ['a', A, 'owner', A], ['b', B, 'owner', B], ['staff', A, 'admin', 'staff@a.test'], ['barber', A, 'barber', 'barber@a.test'], ['fake-super', ADMIN, 'admin', 'staff@super.test']]) {
    put(`session:${token}`, { email, role, login_email, expires_at: Date.now() + 600000 });
  }
  // Real SQLite queries; only D1's asynchronous wrapper is adapted.
  const DB = { prepare(query) {
    const statement = sql.prepare(query); let params = [];
    const args = () => /\?\d/.test(query) ? [Object.fromEntries(params.map((value, index) => [`?${index + 1}`, value]))] : params;
    return { bind(...values) { params = values; return this; },
      async first() { return statement.get(...args()) || null; },
      async all() { return { results: statement.all(...args()) }; },
      async run() { return statement.run(...args()); } };
  } };
  const call = (token, path = '/api/notices', body, options = {}) => worker.fetch(new Request(`https://agendai.test${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options,
  }), { DB });
  const draft = (overrides = {}) => ({ action: 'send', id: crypto.randomUUID(), recipient_email: A, title: 'Atualização', message: 'Olá!\nMensagem livre para esta barbearia.', support: false, pix: '', link: '', image_url: '', ...overrides });
  const send = d => call('super', '/api/superadmin/notices', d || draft());
  const feed = async (token, path) => { const r = await call(token, path); assert.equal(r.status, 200); return (await r.json()).notices; };
  return { sql, call, draft, send, feed };
}
test('card só chega à barbearia marcada; parâmetro de outra conta é ignorado', async t => {
  const { send, feed } = setup(t);
  assert.equal((await send()).status, 200);
  assert.equal((await feed('a')).length, 1);
  assert.equal((await feed('b')).length, 0);
  assert.equal((await feed('b', `/api/notices?recipient_email=${A}`)).length, 0);
  assert.equal((await feed('staff')).length, 1);
});
test('sem autenticação, barbeiro e usuário comum não podem enviar/ler histórico global', async t => {
  const { call, draft } = setup(t);
  assert.equal((await call(null)).status, 401);
  assert.equal((await call('barber')).status, 403);
  for (const token of [null, 'a', 'b', 'staff', 'fake-super']) {
    assert.equal((await call(token, '/api/superadmin/notices', draft())).status, 403);
    assert.equal((await call(token, `/api/superadmin/notices?recipient_email=${A}`)).status, 403);
  }
});
test('envio para todas cria um card isolado para cada conta e mantém histórico global', async t => {
  const { send, draft, feed, call } = setup(t);
  const broadcast = draft({ recipient_email: '*' });
  const response = await send(broadcast);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent_count, 3);
  assert.equal((await feed('a')).length, 1);
  assert.equal((await feed('b')).length, 1);
  assert.equal((await feed('super', '/api/superadmin/notices?recipient_email=*')).length, 1);
  assert.equal((await call('super', '/api/superadmin/notices', { action: 'archive', recipient_email: '*', id: broadcast.id })).status, 200);
  assert.equal((await feed('a')).length, 0);
  assert.equal((await feed('b')).length, 0);
});
test('rejeita destinatário ausente, seleção múltipla e conta inexistente', async t => {
  const { send, draft, feed } = setup(t);
  for (const recipient_email of ['', 'all', [A, B], null]) assert.equal((await send(draft({ recipient_email }))).status, 400);
  assert.equal((await send(draft({ recipient_email: 'missing@barbearia.test' }))).status, 404);
  assert.equal((await feed('a')).length, 0);
});
test('retomar envio geral não expõe lista global de e-mails aos destinatários', async t => {
  const { sql, send, draft, feed } = setup(t);
  const message = draft({ recipient_email: '*' });
  await send(message);
  sql.prepare('DELETE FROM app_store WHERE key = ?').run(`platform-notice:${encodeURIComponent(B)}:${message.id}`);
  await send(message);
  const recipient = (await feed('b'))[0];
  assert.equal(recipient.recipient_email, B);
  assert.equal('recipient_emails' in recipient, false);
  assert.equal(JSON.stringify(recipient).includes(A), false);
  assert.equal((await feed('a')).length, 1);
});
test('leitura persistida e isolada: outra barbearia não marca o card como lido', async t => {
  const { call, send, draft, feed } = setup(t); const d = draft(); await send(d);
  assert.equal((await call('b', '/api/notices', { action: 'read', id: d.id, recipient_email: A })).status, 404);
  assert.equal((await feed('a'))[0].read_at, null);
  assert.equal((await call('staff', '/api/notices', { action: 'read', id: d.id })).status, 200);
  assert.ok((await feed('a'))[0].read_at);
  const before = (await feed('a'))[0].read_at;
  await call('a', '/api/notices', { action: 'read', id: d.id });
  assert.equal((await feed('a'))[0].read_at, before);
});
test('repetir envio após falha de rede não duplica nem sobrescreve mensagem', async t => {
  const { send, draft, feed } = setup(t); const d = draft();
  await send(d); await send(d);
  assert.equal((await feed('a')).length, 1);
  assert.equal((await send({ ...d, message: 'Outro conteúdo' })).status, 409);
  assert.equal((await feed('a'))[0].message, d.message);
});
test('retirada preserva histórico e leitura; não altera card da outra barbearia', async t => {
  const { send, draft, call, feed } = setup(t); const d = draft();
  await send(d); await send(draft({ recipient_email: B }));
  await call('a', '/api/notices', { action: 'read', id: d.id });
  assert.equal((await call('a', '/api/notices', { action: 'archive', id: d.id })).status, 400);
  assert.equal((await call('super', '/api/superadmin/notices', { action: 'archive', recipient_email: A, id: d.id })).status, 200);
  assert.equal((await feed('a')).length, 0);
  assert.equal((await feed('b')).length, 1);
  const history = await feed('super', `/api/superadmin/notices?recipient_email=${A}`);
  assert.ok(history[0].archived_at); assert.ok(history[0].read_at);
  assert.equal((await call('a', '/api/notices', { action: 'read', id: d.id })).status, 404);
});
test('PIX/link opcionais, texto com quebras preservado, HTML nunca convertido no servidor', async t => {
  const { send, draft, feed } = setup(t);
  assert.equal((await send(draft({ title: '', message: '<script>alert(1)</script>\nTexto livre', support: true, pix: 'pix-ficticio@teste.invalid', link: 'https://example.com/apoio' }))).status, 200);
  const notice = (await feed('a'))[0];
  assert.equal(notice.title, 'Mensagem do AgendAI'); assert.match(notice.message, /\nTexto livre/);
  assert.equal(notice.pix, 'pix-ficticio@teste.invalid'); assert.equal(notice.support, true);
});
test('aceita imagem HTTPS com ou sem texto e bloqueia imagens inseguras', async t => {
  const { send, draft, feed } = setup(t);
  assert.equal((await send(draft({ message: '', image_url: 'https://images.example.com/novidade.jpg' }))).status, 200);
  assert.equal((await feed('a'))[0].image_url, 'https://images.example.com/novidade.jpg');
  for (const image_url of ['http://example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,abc', 'not-a-url']) {
    assert.equal((await send(draft({ image_url }))).status, 400);
  }
});
test('bloqueia links inseguros, campos fora de tamanho e tipos malformados', async t => {
  const { send, draft } = setup(t);
  for (const link of ['javascript:alert(1)', 'data:text/html,bad', 'http://example.com', 'https://user:password@example.com', 'not-a-link']) {
    assert.equal((await send(draft({ link }))).status, 400);
  }
  for (const override of [{ message: '', image_url: '' }, { message: 'x'.repeat(4001) }, { title: 'x'.repeat(121) }, { pix: 'x'.repeat(141), support: true }, { support: 'yes' }, { pix: 'abc' }, { id: '../b' }, { title: {} }]) assert.equal((await send(draft(override))).status, 400);
});
test('limites de corpo, JSON inválido e métodos inesperados', async t => {
  const { call } = setup(t);
  const path = '/api/superadmin/notices';
  assert.equal((await call('super', path, {}, { body: 'x'.repeat(24001) })).status, 413);
  assert.equal((await call('super', path, {}, { body: '{' })).status, 400);
  assert.equal((await call('super', path, {}, { body: '[]' })).status, 400);
  assert.equal((await call('super', path, undefined, { method: 'DELETE' })).status, 405);
  assert.equal((await call('super', path, undefined)).status, 400);
});
test('não modifica snapshots, agendamentos, configurações nem notificações anteriores', async t => {
  const { sql, send, draft, call } = setup(t);
  const before = sql.prepare("SELECT * FROM app_store WHERE key LIKE 'user:%' ORDER BY key").all();
  const d = draft(); await send(d);
  await call('a', '/api/notices', { action: 'read', id: d.id });
  await call('super', '/api/superadmin/notices', { action: 'archive', recipient_email: A, id: d.id });
  assert.deepEqual(sql.prepare("SELECT * FROM app_store WHERE key LIKE 'user:%' ORDER BY key").all(), before);
});
test('conta suspensa ou sessão expirada não acessa mensagens', async t => {
  const { sql, call, send } = setup(t); await send();
  sql.prepare("UPDATE app_store SET value = json_set(value, '$.org.account_status', 'suspended') WHERE key = ?").run(`user:${A}`);
  assert.equal((await call('a')).status, 403);
  sql.prepare("UPDATE app_store SET value = json_set(value, '$.expires_at', 1) WHERE key = 'session:b'").run();
  assert.equal((await call('b')).status, 401);
});
test('limite de 50 é aplicado depois do filtro por destinatário', async t => {
  const { send, draft, feed } = setup(t);
  await send();
  for (let i = 0; i < 51; i++) await send(draft({ recipient_email: B, title: `Aviso ${i}` }));
  assert.equal((await feed('b')).length, 50);
  assert.equal((await feed('a')).length, 1);
});
test('página pública e snapshot privado não carregam os avisos separados', async t => {
  const { sql, send, draft, call } = setup(t);
  const text = 'Mensagem privada sentinela';
  await send(draft({ message: text }));
  sql.prepare('INSERT INTO app_store VALUES (?, ?, NULL, ?)').run('slug:demo-a', A, Date.now());
  for (const [token, path] of [[null, '/api/sync?slug=demo-a'], ['a', `/api/sync?email=${A}`]]) {
    const response = await call(token, path);
    assert.equal(response.status, 200);
    assert.equal((await response.text()).includes(text), false);
  }
});
test('falha de armazenamento retorna erro controlado sem expor detalhes', async () => {
  const response = await worker.fetch(new Request('https://agendai.test/api/notices', { headers: { Authorization: 'Bearer fake' } }), {
    DB: { prepare() { throw new Error('detalhe-interno-sentinela'); } },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('detalhe-interno-sentinela'), false);
});
