import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ stdin: { contents: "export * from './src/utils/campaignDrafts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const { loadCampaignDrafts, saveCampaignDrafts } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('Rascunhos são restaurados após sair e voltar, separados por público e barbearia', () => {
  const storage = memoryStorage();
  const initial = loadCampaignDrafts('shop-a', storage).drafts;
  const changed = { ...initial, inactive: 'Olá {cliente}! ✂️\nVolte sempre.', all: '' };
  assert.equal(saveCampaignDrafts('shop-a', changed, storage), true);
  assert.deepEqual(loadCampaignDrafts('shop-a', storage), { drafts: changed, error: false });
  assert.deepEqual(loadCampaignDrafts('shop-b', storage).drafts, initial);
  saveCampaignDrafts('shop-b', { ...initial, subscribers: 'Benefícios B' }, storage);
  assert.deepEqual(loadCampaignDrafts('shop-a', storage).drafts, changed);
});

test('Dados parciais preservam rascunhos válidos e modelos de públicos novos', () => {
  const storage = { getItem: () => JSON.stringify({ all: '', inactive: 'Mensagem', subscribers: 42, unknown: 'ignorar' }), setItem() {} };
  const loaded = loadCampaignDrafts('shop', storage);
  assert.equal(loaded.drafts.all, '');
  assert.equal(loaded.drafts.inactive, 'Mensagem');
  assert.equal(typeof loaded.drafts.subscribers, 'string');
  assert.equal(loaded.drafts.unknown, undefined);
});

test('JSON inválido e armazenamento bloqueado não derrubam a tela nem indicam sucesso', () => {
  for (const raw of ['{', 'null', '[]']) {
    assert.equal(loadCampaignDrafts('shop', { getItem: () => raw }).error, true);
  }
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const loaded = loadCampaignDrafts('shop', blocked);
  assert.equal(loaded.error, true);
  assert.equal(saveCampaignDrafts('shop', loaded.drafts, blocked), false);
  assert.equal(saveCampaignDrafts('', loaded.drafts, memoryStorage()), false);
});
