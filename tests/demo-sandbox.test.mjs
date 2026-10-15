import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifactPath = resolve(process.cwd(), 'tests/artifacts/demoSandbox.mjs');
await build({
  entryPoints: ['./src/utils/demoSandbox.ts'],
  outfile: artifactPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { IS_DEMO, buildDemoSnapshot } = await import(pathToFileURL(artifactPath).href);

test('demo fica desligada fora do navegador', () => {
  assert.equal(IS_DEMO, false);
});

test('snapshot de demonstração tem o formato que o cliente espera de /api/sync', () => {
  const snapshot = buildDemoSnapshot();
  assert.ok(snapshot.org, 'precisa de org (loadBarbershopFromCloud exige data.org)');
  assert.ok(Array.isArray(snapshot.services) && snapshot.services.length > 0);
  assert.ok(Array.isArray(snapshot.barbers) && snapshot.barbers.length > 0);
  assert.ok(Array.isArray(snapshot.appointments));
  assert.ok(Array.isArray(snapshot.clients));
});
