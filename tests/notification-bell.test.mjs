import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ stdin: { contents: `
  export * from './src/utils/notificationBell';
  export * from './src/components/common/notificationBellAsset';
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { NotificationBell } from './src/components/common/NotificationBell';
  export const markup = notifications => renderToStaticMarkup(React.createElement(NotificationBell, { notifications, open: false }));
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false });
// CJS bundling allows react-dom/server's built-in Node dependencies in this test.
import { createRequire } from 'node:module';
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { unreadNotificationCount, bellCanAnimate, bellKeyframes, markup, BELL_ROTATION, BELL_CLAPPER, BELL_BOUNCE, BELL_BADGE, BELL_DURATION_MS, BELL_PATH } = module.exports;

test('só anima na abertura com itens não lidos', () => {
  assert.equal(bellCanAnimate(true, 1, false, false, true), true);
  assert.equal(bellCanAnimate(true, 0, false, false, true), false);
});
test('chegada durante uso e sincronização não reiniciam animação', () => {
  for (const count of [0, 1, 2, 10, 50]) assert.equal(bellCanAnimate(false, count, false, false, true), false);
});
test('marcar como lida zera a contagem; reabrir com tudo lido não anima', () => {
  const count = unreadNotificationCount([{ id: 'a', read_at: 'now' }]);
  assert.equal(count, 0);
  assert.equal(bellCanAnimate(true, count, false, false, true), false);
});
test('contagem considera todas as notificações, não só as 40 exibidas', () => {
  const list = Array.from({ length: 60 }, (_, i) => ({ id: String(i), ...(i % 2 ? { read_at: 'now' } : {}) }));
  assert.equal(unreadNotificationCount(list), 30);
});
test('central aberta, aba oculta ou movimento reduzido impedem animação', () => {
  for (const flags of [[true, 1, true, false, true], [true, 1, false, true, true], [true, 1, false, false, false]]) assert.equal(bellCanAnimate(...flags), false);
});
test('movimentos do arquivo são finitos, retornam ao repouso e não somem com o número', () => {
  assert.equal(BELL_DURATION_MS, 4000); assert.ok(BELL_PATH.startsWith('M42.726'));
  assert.ok(BELL_ROTATION.some(f => f.value === -20));
  for (const frames of [BELL_ROTATION, BELL_CLAPPER, BELL_BOUNCE, BELL_BADGE]) {
    const rest = frames === BELL_BADGE ? 1 : 0;
    const keys = bellKeyframes(frames, v => `scale(${v})`, rest);
    assert.equal(keys[0].offset, 0); assert.equal(keys.at(-1).offset, 1);
    assert.equal(keys.at(-1).transform, `scale(${rest})`);
    assert.ok(keys.every((k, i) => !i || k.offset >= keys[i - 1].offset));
  }
  assert.ok(BELL_BADGE.every(k => k.value >= 0.9));
});
test('SVG acessível como decoração, sem número fixo 1 e sem contador quando zerado', () => {
  const zero = markup([]);
  assert.ok(zero.includes('aria-hidden="true"')); assert.ok(zero.includes('<svg'));
  assert.equal(zero.includes('notification-count-badge'), false);
  assert.match(markup([{ id: 'a' }, { id: 'b' }]), />2<\/span>/);
  assert.match(markup(Array.from({ length: 12 }, (_, i) => ({ id: String(i) }))), />9\+<\/span>/);
});
