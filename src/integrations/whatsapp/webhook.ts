import type { Env } from '../../worker';
import type { WhatsAppEvent, WhatsAppInteractiveData } from './types';
import { isEventProcessed, markEventProcessed } from './idempotency';
import { processWhatsAppEvent } from './processor';

const encoder = new TextEncoder();

const signatureToBytes = (value: string): Uint8Array | null => {
  const match = /^sha256=([a-fA-F0-9]{64})$/.exec(value.trim());
  if (!match) return null;
  const hex = match[1];
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const hasValidWebhookSignature = async (rawBody: string, signature: string | null, appSecret: string | undefined): Promise<boolean> => {
  const secret = String(appSecret || '').trim();
  const signatureBytes = signature ? signatureToBytes(signature) : null;
  if (!secret || !signatureBytes) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, signatureBytes as unknown as BufferSource, encoder.encode(rawBody));
};

export function verifyWhatsAppWebhook(url: URL, env: Env): Response {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const expectedToken = env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
    return new Response(challenge || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function handleWhatsAppWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text();
  const isValidSignature = await hasValidWebhookSignature(
    rawBody,
    request.headers.get('X-Hub-Signature-256'),
    env.WHATSAPP_APP_SECRET,
  );
  if (!isValidSignature) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0]?.value;
  if (!change) {
    return new Response(JSON.stringify({ status: 'ignored' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const phoneNumberId = String(change?.metadata?.phone_number_id || '');
  const messages = change?.messages;
  const statuses = change?.statuses;

  if (Array.isArray(messages) && messages.length > 0) {
    const contact = change?.contacts?.[0];
    const profileName = contact?.profile?.name ? String(contact.profile.name).trim() : undefined;

    for (const msg of messages) {
      const messageId = String(msg?.id || '');
      if (!messageId) continue;

      if (await isEventProcessed(env, messageId)) {
        continue;
      }
      await markEventProcessed(env, messageId);

      let interactiveData: WhatsAppInteractiveData | undefined;
      let extractedText = msg?.text?.body ? String(msg.text.body) : '';

      // Fase 6: Suporte a respostas interativas e conclusão de WhatsApp Flows
      if (msg?.type === 'interactive' && msg?.interactive) {
        const inter = msg.interactive;
        if (inter.type === 'nfm_reply' && inter.nfm_reply?.response_json) {
          try {
            const flowResponse = JSON.parse(inter.nfm_reply.response_json);
            interactiveData = {
              type: 'nfm_reply',
              flowResponse,
            };
            extractedText = `flow_completed`;
          } catch {}
        } else if (inter.type === 'button_reply' && inter.button_reply) {
          interactiveData = {
            type: 'button_reply',
            buttonId: inter.button_reply.id,
            buttonTitle: inter.button_reply.title,
          };
          extractedText = inter.button_reply.title || inter.button_reply.id;
        } else if (inter.type === 'list_reply' && inter.list_reply) {
          interactiveData = {
            type: 'list_reply',
            listId: inter.list_reply.id,
            listTitle: inter.list_reply.title,
          };
          extractedText = inter.list_reply.title || inter.list_reply.id;
        }
      }

      const event: WhatsAppEvent = {
        type: 'message.received',
        phoneNumberId,
        messageId,
        from: String(msg?.from || ''),
        text: extractedText,
        profileName,
        timestamp: String(msg?.timestamp || Math.floor(Date.now() / 1000)),
        interactive: interactiveData,
      };

      if (env.WHATSAPP_QUEUE) {
        await env.WHATSAPP_QUEUE.send(event);
      } else {
        await processWhatsAppEvent(env, event);
      }
    }
  } else if (Array.isArray(statuses) && statuses.length > 0) {
    for (const st of statuses) {
      const messageId = String(st?.id || '');
      const status = String(st?.status || '');
      const event: WhatsAppEvent =
        status === 'delivered'
          ? { type: 'message.delivered', phoneNumberId, messageId }
          : status === 'read'
          ? { type: 'message.read', phoneNumberId, messageId }
          : { type: 'message.failed', phoneNumberId, messageId, error: st?.errors?.[0]?.message };

      if (env.WHATSAPP_QUEUE) {
        await env.WHATSAPP_QUEUE.send(event);
      } else {
        await processWhatsAppEvent(env, event);
      }
    }
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
