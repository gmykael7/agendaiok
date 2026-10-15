import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';
import { build } from 'esbuild';

const artifactPath = resolve(process.cwd(), 'tests/artifacts/clientImport.mjs');
await build({
  entryPoints: ['./src/utils/clientImport.ts'],
  outfile: artifactPath,
  bundle: true,
  external: ['xlsx'],
  platform: 'node',
  format: 'esm',
});

const clientImport = await import(pathToFileURL(artifactPath).href);

test('valida o arquivo clientes_10092026020650.xlsx com 24 colunas e 2 clientes', () => {
  const filePath = resolve(process.cwd(), 'clientes_10092026020650.xlsx');
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const result = clientImport.parseAndValidateClientWorkbook(workbook);

  assert.equal(result.valid, true);
  assert.equal(result.totalColumns, 24);
  assert.equal(result.isAppBarberLayout, true);
  assert.equal(result.importedClients.length, 2);

  // Verifica Cliente 1: Marcos Antonio Aquino Cabral Filho
  const cliente1 = result.importedClients[0];
  assert.equal(cliente1.name, 'Marcos Antonio Aquino Cabral Filho');
  assert.equal(cliente1.phone, '(84) 98228-2828');
  assert.equal(cliente1.email, 'gm@gmail.com');
  assert.equal(cliente1.loyalty_points, 0);

  // Verifica Cliente 2: Samuel Lian
  const cliente2 = result.importedClients[1];
  assert.equal(cliente2.name, 'Samuel Lian');
  assert.equal(cliente2.phone, '(84) 99999-9999');
  assert.equal(cliente2.email, 'marquinho2019u@gmail.com');
  assert.equal(cliente2.loyalty_points, 0);

  // SEGURANÇA E PRIVACIDADE: NENHUM campo sensível deve existir no objeto
  const sensitiveKeys = ['cpf', 'CPF', 'rg', 'RG', 'sexo', 'nascimento', 'endereco', 'cidade', 'estado', 'login'];
  for (const client of result.importedClients) {
    for (const key of sensitiveKeys) {
      assert.equal(key in client, false, `Campo sensível "${key}" não pode estar presente no objeto do cliente`);
    }
  }

  // Verifica se detectou e descartou as colunas sensíveis esperadas
  assert.ok(result.sensitiveColumnsDetected.includes('CPF'));
  assert.ok(result.sensitiveColumnsDetected.includes('RG'));
  assert.ok(result.sensitiveColumnsDetected.includes('Nascimento'));
  assert.ok(result.sensitiveColumnsDetected.includes('Sexo'));
  assert.ok(result.sensitiveColumnsDetected.includes('Endereco'));
});

test('aplica importação no CRM do AgendAI: insere novos e atualiza existentes', () => {
  const existingClients = [
    {
      id: 'c1',
      org_id: 'org-1',
      name: 'Marcos Antonio Antigo',
      phone: '(84) 98228-2828',
      total_visits: 3,
      total_spent: 150,
      loyalty_points: 10,
    },
  ];

  const incoming = [
    {
      name: 'Marcos Antonio Aquino Cabral Filho',
      phone: '(84) 98228-2828',
      email: 'gm@gmail.com',
      notes: 'Cliente VIP',
      loyalty_points: 20,
    },
    {
      name: 'Samuel Lian',
      phone: '(84) 99999-9999',
      email: 'marquinho2019u@gmail.com',
      loyalty_points: 0,
    },
  ];

  const applied = clientImport.applyClientsToCrm(existingClients, incoming, 'org-1');
  assert.equal(applied.total, 2);
  assert.equal(applied.updated, 1); // Marcos atualizado
  assert.equal(applied.added, 1);   // Samuel novo

  // Verifica Marcos atualizado
  const updatedMarcos = applied.nextClients.find(c => c.phone.includes('98228-2828'));
  assert.ok(updatedMarcos);
  assert.equal(updatedMarcos.name, 'Marcos Antonio Aquino Cabral Filho');
  assert.equal(updatedMarcos.email, 'gm@gmail.com');
  assert.equal(updatedMarcos.notes, 'Cliente VIP');
  assert.equal(updatedMarcos.loyalty_points, 20);
  assert.equal(updatedMarcos.total_visits, 3); // histórico mantido!

  // Verifica Samuel adicionado
  const addedSamuel = applied.nextClients.find(c => c.name === 'Samuel Lian');
  assert.ok(addedSamuel);
  assert.equal(addedSamuel.phone, '(84) 99999-9999');
  assert.equal(addedSamuel.email, 'marquinho2019u@gmail.com');
  assert.equal(addedSamuel.loyalty_points, 0);
  assert.equal(addedSamuel.total_visits, 0);
});

test('rejeita planilhas sem coluna Nome', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([{ Celular: '84999999999', Email: 'teste@email.com' }]);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');

  assert.throws(() => {
    clientImport.parseAndValidateClientWorkbook(wb);
  }, /coluna "Nome"/);
});
