import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifactPath = resolve(process.cwd(), 'tests/artifacts/webpushEncrypt.mjs');
await build({
  entryPoints: ['./src/integrations/webpush/encrypt.ts'],
  outfile: artifactPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { encryptWebPushPayload } = await import(pathToFileURL(artifactPath).href);

const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (bytes) => Buffer.from(bytes).toString('base64url');
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
};
const hkdf = async (salt, ikm, info, length) => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
};

async function makeBrowserKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, pub, auth, subscription: { endpoint: 'https://push.example/x', keys: { p256dh: toB64(pub), auth: toB64(auth) } } };
}

// Decifrador independente, seguindo RFC 8291 / RFC 8188.
async function decrypt(body, browser) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPub = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, browser.pair.privateKey, 256));
  const ikm = await hkdf(browser.auth, secret, cat(enc.encode('WebPush: info\0'), browser.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ciphertext));
  return dec.decode(padded.slice(0, padded.lastIndexOf(0x02)));
}

test('payload cifrado volta idêntico para o navegador de destino', async () => {
  const browser = await makeBrowserKeys();
  const payload = JSON.stringify({ title: 'Novo agendamento', body: 'Erick às 14:00 · Corte', url: '/?tab=atendimentos' });
  const body = await encryptWebPushPayload(payload, browser.subscription);
  assert.equal(await decrypt(body, browser), payload);
});

test('cabeçalho do registro segue o formato aes128gcm (rs = 4096, chave pública de 65 bytes)', async () => {
  const browser = await makeBrowserKeys();
  const body = await encryptWebPushPayload('oi', browser.subscription);
  assert.equal(new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), 4096);
  assert.equal(body[20], 65);
  assert.equal(body[21], 0x04);
});

test('outra chave de navegador não consegue decifrar', async () => {
  const browser = await makeBrowserKeys();
  const intruder = await makeBrowserKeys();
  const body = await encryptWebPushPayload('segredo', browser.subscription);
  await assert.rejects(() => decrypt(body, intruder));
});

test('rejeita chave p256dh inválida antes de enviar', async () => {
  await assert.rejects(() => encryptWebPushPayload('x', {
    endpoint: 'https://push.example/x',
    keys: { p256dh: toB64(new Uint8Array(10)), auth: toB64(new Uint8Array(16)) },
  }));
});
