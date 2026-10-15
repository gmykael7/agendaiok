import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/services/directoryApi.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { handleDirectory, DIRECTORY_SQL } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

test('diretório usa parâmetros D1 e expõe somente campos públicos autorizados', async () => {
  let receivedQuery = '';
  let receivedBindings = [];
  const db = {
    prepare(query) {
      receivedQuery = query;
      return { bind(...values) {
        receivedBindings = values;
        return { async all() {
          return { results: [
            { name: 'Barbearia Áurea', slug: 'aurea', city: 'Natal', state: 'RN', neighborhood: 'Tirol', address: 'Rua das Flores, 10', logo: 'https://images.example/logo.png', email: 'privado@example.com', phone: '84999990000' },
            { name: 'Incompleta', slug: 'invalida', city: '', state: 'RN', email: 'nao@expor.test' },
          ] };
        } };
      } };
    },
  };
  const response = await handleDirectory(new Request('https://agendai.test/api/directory?q=aurea%27%20OR%201%3D1--&city=Nat%C3%A1l&state=rn'), db);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items, [{ name: 'Barbearia Áurea', slug: 'aurea', city: 'Natal', state: 'RN', neighborhood: 'Tirol', address: 'Rua das Flores, 10', logo: 'https://images.example/logo.png' }]);
  assert.equal(JSON.stringify(body).includes('privado@example.com'), false);
  assert.equal(JSON.stringify(body).includes('84999990000'), false);
  assert.equal(receivedQuery.includes("aurea' OR 1=1--"), false);
  assert.equal(receivedQuery, DIRECTORY_SQL);
  assert.equal(receivedBindings[1], "aurea' or 1=1--");
  assert.equal(receivedBindings[2], 'natal');
  assert.equal(receivedBindings[3], 'RN');
});

test('diretório bloqueia método e filtros inválidos antes de consultar o banco', async () => {
  const unavailable = await handleDirectory(new Request('https://agendai.test/api/directory', { method: 'POST' }), undefined);
  assert.equal(unavailable.status, 405);
  const invalid = await handleDirectory(new Request('https://agendai.test/api/directory?page=0'), undefined);
  assert.equal(invalid.status, 400);
  const oversized = await handleDirectory(new Request(`https://agendai.test/api/directory?q=${'a'.repeat(121)}`), undefined);
  assert.equal(oversized.status, 400);
});

test('busca próxima ordena pelo raio e mantém coordenadas fora da resposta pública', async () => {
  const db = { prepare() { return { bind() { return { async all() { return { results: [
    { name: 'Longe', slug: 'longe', city: 'Natal', state: 'RN', latitude: -5.70, longitude: -35.20 },
    { name: 'Perto', slug: 'perto', city: 'Natal', state: 'RN', latitude: -5.794, longitude: -35.211 },
  ] }; } }; } }; } };
  const response = await handleDirectory(new Request('https://agendai.test/api/directory?latitude=-5.794&longitude=-35.211'), db);
  const body = await response.json();
  assert.equal(body.items[0].name, 'Perto');
  assert.equal(JSON.stringify(body).includes('latitude'), false);
  assert.equal(JSON.stringify(body).includes('longitude'), false);
});
