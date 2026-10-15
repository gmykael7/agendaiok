import type { Env } from '../../worker';

export class WhatsAppSendError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

export async function sendWhatsAppText(
  env: Env,
  to: string,
  text: string,
  phoneNumberIdOverride?: string
): Promise<void> {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = phoneNumberIdOverride || env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new WhatsAppSendError('WhatsApp credentials (token or phone number ID) missing in environment');
  }

  const cleanTo = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new WhatsAppSendError(`Failed to send WhatsApp message: ${response.status} ${errorText}`, response.status);
  }
}

export interface WhatsAppFlowParameters {
  flowId: string;
  flowCta?: string;
  flowToken?: string;
  screen?: string;
  data?: Record<string, unknown>;
  header?: string;
  body: string;
  footer?: string;
}

export async function sendWhatsAppFlow(
  env: Env,
  to: string,
  params: WhatsAppFlowParameters
): Promise<void> {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new WhatsAppSendError('WhatsApp credentials (token or phone number ID) missing in environment');
  }

  const cleanTo = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const flowPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'interactive',
    interactive: {
      type: 'flow',
      ...(params.header ? { header: { type: 'text', text: params.header } } : {}),
      body: { text: params.body },
      ...(params.footer ? { footer: { text: params.footer } } : {}),
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: params.flowToken || `ft-${Date.now()}`,
          flow_id: params.flowId,
          flow_cta: params.flowCta || 'Agendar Horário',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: params.screen || 'APPOINTMENT_SCREEN',
            data: params.data || {},
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(flowPayload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new WhatsAppSendError(`Failed to send WhatsApp Flow: ${response.status} ${errorText}`, response.status);
  }
}

export async function sendWhatsAppInteractiveButtons(
  env: Env,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  options: { header?: string; footer?: string } = {}
): Promise<void> {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new WhatsAppSendError('WhatsApp credentials (token or phone number ID) missing in environment');
  }

  const cleanTo = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(options.header ? { header: { type: 'text', text: options.header } } : {}),
      body: { text: bodyText },
      ...(options.footer ? { footer: { text: options.footer } } : {}),
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.slice(0, 20),
          },
        })),
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new WhatsAppSendError(`Failed to send WhatsApp Buttons: ${response.status} ${errorText}`, response.status);
  }
}
