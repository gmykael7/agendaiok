import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mesma expressão usada em processor.ts para reconhecer "CONFIRMAR".
const CONFIRM_KEYWORD = /\b(confirmar|confirmo|confirma)\b/i;

test('reconhece CONFIRMAR em maiúsculas, minúsculas e variações', () => {
  for (const msg of ['CONFIRMAR', 'confirmar', 'Confirmo!', 'pode confirma aí']) {
    assert.ok(CONFIRM_KEYWORD.test(msg), msg);
  }
});

test('não confunde com cancelar, remarcar ou conversa sem relação', () => {
  for (const msg of ['cancelar', 'quero remarcar', 'oi tudo bem', 'qual o preço?']) {
    assert.ok(!CONFIRM_KEYWORD.test(msg), msg);
  }
});
