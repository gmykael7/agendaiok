import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function compile(entryCode) {
  const output = await build({
    stdin: {
      contents: entryCode,
      resolveDir: process.cwd(),
      sourcefile: 'test-waitlist-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'node',
  });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}

const {
  timeToPeriod,
  matchesWaitlistPeriod,
  findWaitlistMatches,
  buildWaitlistWhatsAppUrl,
} = await compile("export { timeToPeriod, matchesWaitlistPeriod, findWaitlistMatches, buildWaitlistWhatsAppUrl } from './src/utils/waitlist';");

test('timeToPeriod classifica corretamente manha, tarde e noite', () => {
  assert.equal(timeToPeriod('09:00'), 'morning');
  assert.equal(timeToPeriod('11:30'), 'morning');
  assert.equal(timeToPeriod('12:00'), 'afternoon');
  assert.equal(timeToPeriod('15:45'), 'afternoon');
  assert.equal(timeToPeriod('18:00'), 'evening');
  assert.equal(timeToPeriod('20:30'), 'evening');
});

test('matchesWaitlistPeriod respeita o período selecionado ou any', () => {
  assert.equal(matchesWaitlistPeriod('any', '09:00'), true);
  assert.equal(matchesWaitlistPeriod(undefined, '14:00'), true);
  assert.equal(matchesWaitlistPeriod('morning', '10:00'), true);
  assert.equal(matchesWaitlistPeriod('morning', '14:00'), false);
  assert.equal(matchesWaitlistPeriod('afternoon', '14:00'), true);
  assert.equal(matchesWaitlistPeriod('evening', '19:00'), true);
  assert.equal(matchesWaitlistPeriod('evening', '16:00'), false);
});

test('findWaitlistMatches filtra por data, barbeiro e periodo em ordem FIFO', () => {
  const waitlist = [
    {
      id: 'w1',
      client_name: 'Bruno Silva',
      client_phone: '84999991111',
      preferred_date: '2026-09-15',
      preferred_period: 'afternoon',
      barber_id: 'b1',
      status: 'waiting',
      created_at: '2026-09-14T10:00:00Z',
    },
    {
      id: 'w2',
      client_name: 'Carlos Mendes',
      client_phone: '84999992222',
      preferred_date: '2026-09-15',
      preferred_period: 'any',
      barber_id: 'any',
      status: 'waiting',
      created_at: '2026-09-14T09:00:00Z', // Mais antigo!
    },
    {
      id: 'w3',
      client_name: 'Danilo Ramos',
      client_phone: '84999993333',
      preferred_date: '2026-09-15',
      preferred_period: 'morning',
      barber_id: 'b1',
      status: 'waiting',
      created_at: '2026-09-14T08:00:00Z',
    },
    {
      id: 'w4',
      client_name: 'Eduardo Costa',
      client_phone: '84999994444',
      preferred_date: '2026-09-16', // Outro dia
      preferred_period: 'afternoon',
      status: 'waiting',
      created_at: '2026-09-14T07:00:00Z',
    },
    {
      id: 'w5',
      client_name: 'Fernando Lima',
      client_phone: '84999995555',
      preferred_date: '2026-09-15',
      status: 'claimed', // Já atendido
      created_at: '2026-09-14T06:00:00Z',
    },
  ];

  // Vaga liberada: 2026-09-15 às 14:00 (tarde) com barbeiro b1
  const matches = findWaitlistMatches(waitlist, '2026-09-15', '14:00', 'b1');
  assert.equal(matches.length, 2);
  // w2 é mais antigo (09:00) que w1 (10:00)
  assert.equal(matches[0].id, 'w2');
  assert.equal(matches[1].id, 'w1');
});

test('buildWaitlistWhatsAppUrl gera mensagem com dados da vaga relampago', () => {
  const org = {
    name: 'Barbearia Vanguarda',
    slug: 'barbearia-vanguarda',
    phone: '84988887777',
  };

  const entry = {
    id: 'w1',
    client_name: 'Marcos Paulo',
    client_phone: '84999998888',
    preferred_date: '2026-09-15',
    status: 'waiting',
    created_at: '2026-09-14T10:00:00Z',
  };

  const slot = {
    date: '2026-09-15',
    time: '15:30',
    barber_name: 'Lucas Silva',
    service_name: 'Degradê Navalhado',
  };

  const url = buildWaitlistWhatsAppUrl(org, entry, slot);
  assert.ok(url.startsWith('https://wa.me/5584999998888?text='));
  assert.ok(url.includes('VAGA+REL%C3%82MPAGO') || url.includes('VAGA'));
  assert.ok(url.includes('Marcos+Paulo') || url.includes('Marcos'));
  assert.ok(url.includes('15%3A30') || url.includes('15:30'));
  assert.ok(url.includes('Lucas+Silva') || url.includes('Lucas'));
  assert.ok(url.includes('meuagendai.fun%2Fagendar%2Fbarbearia-vanguarda') || url.includes('barbearia-vanguarda'));
});
