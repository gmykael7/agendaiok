import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { build } from 'esbuild';

globalThis.crypto ??= webcrypto;

async function compileWebhook() {
  const output = await build({
    stdin: {
      contents: "export { handleWhatsAppWebhook } from './src/integrations/whatsapp/webhook';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}

const { handleWhatsAppWebhook } = await compileWebhook();
const secret = 'test-app-secret';
const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

test('webhook do WhatsApp rejeita corpo sem assinatura da Meta', async () => {
  const response = await handleWhatsAppWebhook(new Request('https://example.test/api/whatsapp/webhook', {
    method: 'POST', body: payload,
  }), { WHATSAPP_APP_SECRET: secret });
  assert.equal(response.status, 401);
});

test('webhook do WhatsApp aceita assinatura HMAC-SHA256 válida', async () => {
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  const response = await handleWhatsAppWebhook(new Request('https://example.test/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': signature },
    body: payload,
  }), { WHATSAPP_APP_SECRET: secret });
  assert.equal(response.status, 200);
});
