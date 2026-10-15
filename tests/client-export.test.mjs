import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifactPath = resolve(process.cwd(), 'tests/artifacts/clientImportExport.mjs');
await build({
  entryPoints: ['./src/utils/clientImport.ts'],
  outfile: artifactPath,
  bundle: true,
  external: ['xlsx'],
  platform: 'node',
  format: 'esm',
});
const { readImportValue } = await import(pathToFileURL(artifactPath).href);

// Mesmo mapeamento usado em ClientesView.handleExportClients.
const exportedRow = {
  Nome: 'Erick Souza',
  Celular: '(84) 98888-7777',
  Email: 'erick@example.com',
  Visitas: 3,
  'Total gasto': 150,
  'Última visita': '2026-10-01',
  Pontos: 12,
  Observações: 'Prefere máquina no degradê',
};

test('cabeçalho Nome é lido pelo importador', () => {
  assert.equal(readImportValue(exportedRow, ['Nome', 'Nome Completo', 'Cliente']), 'Erick Souza');
});

test('cabeçalho Celular é lido pelo importador', () => {
  assert.equal(readImportValue(exportedRow, ['Celular', 'Celular 1', 'WhatsApp']), '(84) 98888-7777');
});

test('cabeçalho Email é lido pelo importador', () => {
  assert.equal(readImportValue(exportedRow, ['Email', 'E-mail']), 'erick@example.com');
});

test('cabeçalho Observações é lido pelo importador', () => {
  assert.equal(readImportValue(exportedRow, ['Obs', 'Observações', 'Observacao', 'Notas']), 'Prefere máquina no degradê');
});

test('cabeçalho Pontos é lido pelo importador', () => {
  assert.equal(readImportValue(exportedRow, ['Pontos', 'Pontos Fidelidade', 'Saldo Pontos']), '12');
});
