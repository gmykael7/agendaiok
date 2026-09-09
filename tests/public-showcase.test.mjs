import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const helpersBuild = await build({ stdin: { contents: `
  export * from './src/utils/publicShowcase';
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { PublicShowcase } from './src/components/common/PublicShowcase';
  export const renderShowcase = org => renderToStaticMarkup(React.createElement(PublicShowcase, { org }));
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false });
const helpersModule = { exports: {} };
new Function('require', 'module', 'exports', helpersBuild.outputFiles[0].text)(createRequire(import.meta.url), helpersModule, helpersModule.exports);
const { sanitizePublicGallery, sanitizeSocialLinks, renderShowcase } = helpersModule.exports;

const workerBuild = await build({ entryPoints: ['src/worker.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(workerBuild.outputFiles[0].text).toString('base64')}`);

const sampleOrg = {
  id: 'demo', name: 'Barbearia Demo', email: 'demo@test.invalid', slug: 'demo', phone: '84999999999', primary_color: '#10b981',
};

test('carrossel aceita somente HTTPS, limita a seis fotos e corta textos', () => {
  const input = Array.from({ length: 8 }, (_, index) => ({
    id: `foto-${index}`,
    image_url: index === 1 ? 'javascript:alert(1)' : `https://img.example/${index}.jpg`,
    caption: 'L'.repeat(150),
    alt_text: 'A'.repeat(190),
  }));
  const result = sanitizePublicGallery(input);
  assert.equal(result.length, 6);
  assert.equal(result.some(item => item.image_url.startsWith('javascript:')), false);
  assert.equal(result[0].caption.length, 120);
  assert.equal(result[0].alt_text.length, 160);
});

test('links sociais vazios ou inseguros não são publicados', () => {
  const result = sanitizeSocialLinks({ instagram: 'https://instagram.com/demo', website: 'http://inseguro.test', maps: 'data:text/html,bad', tiktok: '' });
  assert.deepEqual(result, { instagram: 'https://instagram.com/demo' });
});

test('componente público mostra legenda, navegação, redes e textos acessíveis', () => {
  const markup = renderShowcase({ ...sampleOrg,
    public_gallery: [
      { id: 'a', image_url: 'https://img.example/a.jpg', caption: 'Nosso ambiente', alt_text: 'Cadeiras e espelhos' },
      { id: 'b', image_url: 'https://img.example/b.jpg' },
    ],
    social_links: { instagram: 'https://instagram.com/demo', maps: 'https://maps.example/demo' },
  });
  assert.match(markup, /aria-roledescription="carrossel"/);
  assert.match(markup, /Nosso ambiente/);
  assert.match(markup, /Foto anterior/);
  assert.match(markup, />Instagram</);
  assert.match(markup, />Como chegar</);
  assert.match(markup, /rel="noopener noreferrer"/);
});

test('sem fotos e redes a seção não altera a página atual', () => {
  assert.equal(renderShowcase(sampleOrg), '');
});

function createDb(t, payload) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());
  const put = (key, value, plain = false) => sql.prepare('INSERT INTO app_store VALUES (?, ?, NULL, ?)').run(key, plain ? value : JSON.stringify(value), Date.now());
  put('user:demo@test.invalid', payload);
  put('slug:demo', 'demo@test.invalid', true);
  put('session:demo-token', { email: 'demo@test.invalid', login_email: 'demo@test.invalid', role: 'owner', expires_at: Date.now() + 600000 });
  const DB = { prepare(query) {
    const statement = sql.prepare(query); let params = [];
    const args = () => /\?\d/.test(query) ? [Object.fromEntries(params.map((value, index) => [`?${index + 1}`, value]))] : params;
    return { bind(...values) { params = values; return this; }, async first() { return statement.get(...args()) || null; }, async all() { return { results: statement.all(...args()) }; }, async run() { return statement.run(...args()); } };
  } };
  return { DB, sql };
}

test('Worker salva por barbearia e a resposta pública repete a sanitização', async t => {
  const { DB } = createDb(t, { org: sampleOrg, services: [], barbers: [], appointments: [] });
  const save = await worker.fetch(new Request('https://agendai.test/api/tv/settings', {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_gallery: [
        { id: 'boa', image_url: 'https://img.example/boa.jpg', caption: 'Foto boa' },
        { id: 'ruim', image_url: 'javascript:alert(1)' },
      ],
      social_links: { instagram: 'https://instagram.com/demo', website: 'http://inseguro.test' },
    }),
  }), { DB });
  assert.equal(save.status, 200);
  const response = await worker.fetch(new Request('https://agendai.test/api/sync?slug=demo'), { DB });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.org.public_gallery, [{ id: 'boa', image_url: 'https://img.example/boa.jpg', caption: 'Foto boa' }]);
  assert.deepEqual(data.org.social_links, { instagram: 'https://instagram.com/demo' });
  assert.equal(data.org.email, undefined);
});
