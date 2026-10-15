import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ stdin: { contents: "export * from './src/utils/serviceCatalog';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const { filterServiceCatalog } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const services = [{ id: '1', name: 'Corte Degradê', category: 'Cabelo', active: true }, { id: '2', name: 'Barba', description: 'Toalha quente', category: 'Barba', active: true }, { id: '3', name: 'Degradê desativado', category: 'Cabelo', active: false }];
test('Busca ignora acentos e maiúsculas e exclui inativos', () => {
  assert.deepEqual(filterServiceCatalog(services, ' DEGRADE ', '').map(s => s.id), ['1']);
  assert.deepEqual(filterServiceCatalog(services, 'toalha quente', '').map(s => s.id), ['2']);
});
test('Categoria e busca são combinadas sem alterar catálogo original', () => {
  assert.equal(filterServiceCatalog(services, 'barba', 'Cabelo').length, 0);
  assert.equal(filterServiceCatalog(services, '', '').length, 2);
  assert.equal(services.length, 3);
});
