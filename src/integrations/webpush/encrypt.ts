// Cifragem de payload Web Push (RFC 8291 + RFC 8188, Content-Encoding: aes128gcm).
// Usa apenas Web Crypto, disponível no Cloudflare Workers e no Node 19+.

type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();


const b64urlToBytes = (value: string): Bytes => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const concat = (...parts: Bytes[]): Bytes => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const hkdf = async (salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits) as Bytes;
};

export interface WebPushSubscriptionKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Cifra `plaintext` para a assinatura do navegador. Retorna o corpo binário
 * pronto para ser enviado ao endpoint com Content-Encoding: aes128gcm.
 */
export const encryptWebPushPayload = async (
  plaintext: string,
  subscription: WebPushSubscriptionKeys
): Promise<Bytes> => {
  const uaPublic = b64urlToBytes(subscription.keys.p256dh);
  const authSecret = b64urlToBytes(subscription.keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('p256dh inválido');
  if (authSecret.length !== 16) throw new Error('auth inválido');

  // 1. Par de chaves efêmero do remetente
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey)) as Bytes;

  // 2. Segredo ECDH com a chave pública do navegador
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey, 256)
  ) as Bytes;

  // 3. IKM combinado com o segredo de autenticação (RFC 8291 §3.3)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // 4. Salt aleatório, chave de conteúdo e nonce (RFC 8188 §2.2, §2.3)
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // 5. Registro único: conteúdo + delimitador 0x02 (último registro)
  const data = concat(enc.encode(plaintext), new Uint8Array([0x02]) as Bytes);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, data)
  ) as Bytes;

  // 6. Cabeçalho: salt(16) | record size(4) | idlen(1) | keyid(=asPublic) | ciphertext
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]) as Bytes; // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]) as Bytes, asPublic, ciphertext);
};
