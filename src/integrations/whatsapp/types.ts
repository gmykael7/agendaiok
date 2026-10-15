export type WhatsAppEventType =
  | 'message.received'
  | 'message.delivered'
  | 'message.read'
  | 'message.failed';

export interface WhatsAppInteractiveData {
  type: 'button_reply' | 'list_reply' | 'nfm_reply';
  buttonId?: string;
  buttonTitle?: string;
  listId?: string;
  listTitle?: string;
  flowResponse?: Record<string, any>;
}

export interface WhatsAppConnection {
  tenantId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  phoneNumberId?: string;
  businessAccountId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export type WhatsAppEvent =
  | {
      type: 'message.received';
      phoneNumberId: string;
      messageId: string;
      from: string;
      text?: string;
      profileName?: string;
      timestamp: string;
      interactive?: WhatsAppInteractiveData;
    }
  | {
      type: 'message.delivered';
      phoneNumberId: string;
      messageId: string;
    }
  | {
      type: 'message.read';
      phoneNumberId: string;
      messageId: string;
    }
  | {
      type: 'message.failed';
      phoneNumberId: string;
      messageId: string;
      error?: string;
    };
