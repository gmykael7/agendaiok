import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const compiled = await build({ stdin: { contents: `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { BarberPoleLoader } from './src/components/common/BarberPoleLoader';
  import { LoadingState } from './src/components/common/LoadingState';
  export const pole = compact => renderToStaticMarkup(React.createElement(BarberPoleLoader, { compact }));
  export const loading = () => renderToStaticMarkup(React.createElement(LoadingState));
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { pole, loading } = module.exports;
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('poste mantém a estrutura completa e possui versão compacta', () => {
  const regular = pole(false);
  const compact = pole(true);
  assert.match(regular, /barber-pole-loader__ball/);
  assert.equal((regular.match(/barber-pole-loader__cap/g) || []).length, 2);
  assert.equal((regular.match(/barber-pole-loader__end-cap/g) || []).length, 2);
  assert.match(regular, /barber-pole-loader__barber/);
  assert.match(compact, /barber-pole-loader--compact/);
  assert.match(regular, /aria-hidden="true"/);
});

test('carregamento compartilhado permanece acessível', () => {
  const markup = loading();
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /Carregando/);
});

test('animação é contínua, temática e respeita movimento reduzido', () => {
  assert.match(css, /@keyframes agendaiBarberPole/);
  assert.match(css, /animation: agendaiBarberPole 1\.5s linear infinite/);
  assert.match(css, /var\(--brand-color\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.barber-pole-loader__barber[\s\S]*?animation: none !important/);
});
