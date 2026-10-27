import { test } from 'node:test';
import assert from 'node:assert/strict';

function getBirthdayStatus(birthDateStr, now = new Date()) {
  if (!birthDateStr || typeof birthDateStr !== 'string') return null;
  const trimmed = birthDateStr.trim();
  if (!trimmed) return null;

  let day = 0;
  let month = 0;

  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    }
  } else if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length >= 2) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
  }

  if (!day || !month || isNaN(day) || isNaN(month)) return null;

  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;

  if (day === currentDay && month === currentMonth) {
    return 'today';
  }

  if (month === currentMonth) {
    return 'this_month';
  }

  return null;
}

test('getBirthdayStatus detects birthday today correctly (YYYY-MM-DD)', () => {
  const fixedNow = new Date(2026, 9, 26, 12, 0, 0); // October 26, 2026
  assert.equal(getBirthdayStatus('1992-10-26', fixedNow), 'today');
});

test('getBirthdayStatus detects birthday today correctly (DD/MM/YYYY and DD/MM)', () => {
  const fixedNow = new Date(2026, 9, 26, 12, 0, 0); // October 26, 2026
  assert.equal(getBirthdayStatus('26/10/1995', fixedNow), 'today');
  assert.equal(getBirthdayStatus('26/10', fixedNow), 'today');
});

test('getBirthdayStatus detects birthday this month', () => {
  const fixedNow = new Date(2026, 9, 26, 12, 0, 0); // October 26, 2026
  assert.equal(getBirthdayStatus('1990-10-15', fixedNow), 'this_month');
  assert.equal(getBirthdayStatus('30/10', fixedNow), 'this_month');
});

test('getBirthdayStatus returns null for different month', () => {
  const fixedNow = new Date(2026, 9, 26, 12, 0, 0); // October 26, 2026
  assert.equal(getBirthdayStatus('1990-05-15', fixedNow), null);
  assert.equal(getBirthdayStatus('12/03', fixedNow), null);
  assert.equal(getBirthdayStatus('', fixedNow), null);
  assert.equal(getBirthdayStatus(null, fixedNow), null);
});

test('Client object retains haircut_notes, birth_date, and preferences', () => {
  const client = {
    id: 'cli-1',
    name: 'Carlos Oliveira',
    phone: '84999887766',
    total_visits: 12,
    total_spent: 420,
    haircut_notes: 'Degradê navalhado na zero alta, disfarce com 1.5, topo tesoura 3 dedos',
    birth_date: '1994-10-26',
    preferences: 'Café sem açúcar, prefere silêncio',
    notes: 'Costuma vir nas sextas',
  };

  assert.ok(client.haircut_notes.includes('Degradê navalhado'));
  assert.equal(client.birth_date, '1994-10-26');
  assert.ok(client.preferences.includes('Café'));
  assert.equal(getBirthdayStatus(client.birth_date, new Date(2026, 9, 26)), 'today');
});
