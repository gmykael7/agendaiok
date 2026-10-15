import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function compile(entryCode) {
  const output = await build({
    stdin: {
      contents: entryCode,
      resolveDir: process.cwd(),
      sourcefile: 'test-calendar-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'node',
  });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}

const { buildGoogleCalendarUrl, generateIcsContent } = await compile("export { buildGoogleCalendarUrl, generateIcsContent } from './src/utils/calendarLinks';");

test('buildGoogleCalendarUrl gera link válido para o Google Agenda com data e detalhes', () => {
  const org = {
    name: 'Barbearia Vanguarda',
    slug: 'barbearia-vanguarda',
    phone: '(84) 99999-8888',
    address: 'Rua Central, 120 - Natal/RN',
  };

  const app = {
    id: 'app-test-123',
    client_name: 'Carlos Oliveira',
    client_phone: '5584999991111',
    service_name: 'Corte + Barba',
    barber_name: 'Lucas Silva',
    date: '2026-09-20',
    start_time: '14:30',
    duration_minutes: 60,
    price: 80,
  };

  const url = buildGoogleCalendarUrl(org, app);
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
  assert.ok(url.includes('action=TEMPLATE'));
  assert.ok(url.includes('Corte+%2B+Barba+-+Barbearia+Vanguarda') || url.includes('Corte'));
  assert.ok(url.includes('20260920T143000'));
  assert.ok(url.includes('20260920T153000'));
  assert.ok(url.includes('Lucas+Silva') || url.includes('Lucas'));
  assert.ok(url.includes('Rua+Central') || url.includes('Central'));
});

test('generateIcsContent gera conteúdo iCalendar compatível com Apple Calendar', () => {
  const org = {
    name: 'Barbearia Vanguarda',
    slug: 'barbearia-vanguarda',
    phone: '(84) 99999-8888',
    address: 'Rua Central, 120',
  };

  const app = {
    id: 'app-test-456',
    client_name: 'Roberto Silva',
    client_phone: '5584999992222',
    service_name: 'Corte Social',
    barber_name: 'Rafael Barbeiro',
    date: '2026-09-22',
    start_time: '11:00',
    duration_minutes: 30,
    price: 45,
  };

  const ics = generateIcsContent(org, app);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('VERSION:2.0'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('SUMMARY:Corte Social - Barbearia Vanguarda'));
  assert.ok(ics.includes('UID:app-test-456@meuagendai.fun'));
  assert.ok(ics.includes('STATUS:CONFIRMED'));
  assert.ok(ics.includes('BEGIN:VALARM')); // Lembrete 1 hora antes
  assert.ok(ics.includes('END:VEVENT'));
  assert.ok(ics.includes('END:VCALENDAR'));
});
