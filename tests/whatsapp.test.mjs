import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  stdin: {
    contents: "export * from './src/utils/whatsapp';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const helpers = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

test('link oficial do WhatsApp preserva emojis, acentos, formatação e quebras de linha', () => {
  const message = '💈 *NOVO AGENDAMENTO*\n👤 Cliente: Gleymon Mykael\n✂️ Serviço: Barba\n⏰ Horário: 13:30';
  const url = new URL(helpers.buildWhatsAppUrl('(84) 99918-8497', message));

  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5584999188497');
  assert.equal(url.searchParams.get('text'), message);
  assert.equal(url.href.includes('%F0%9F%92%88'), true);
  assert.equal(url.href.includes('%EF%BF%BD'), false);
});

test('link sem mensagem mantém somente o telefone internacional normalizado', () => {
  assert.equal(helpers.buildWhatsAppUrl('55 84 99918-8497'), 'https://wa.me/5584999188497');
});
