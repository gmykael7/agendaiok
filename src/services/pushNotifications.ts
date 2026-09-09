import { getAuthToken } from './cloudSync';

export type PushSetupStatus = 'enabled' | 'denied' | 'unsupported' | 'ios-install-required' | 'error';

export interface PushSetupResult {
  status: PushSetupStatus;
  message: string;
}

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
};

export const getPushSupportMessage = (): PushSetupResult => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { status: 'unsupported', message: 'Este navegador não oferece suporte a notificações push.' };
  }
  if (isIOS() && !isStandalone()) {
    return {
      status: 'ios-install-required',
      message: 'No iPhone/iPad, adicione o AgendAI à Tela de Início e abra pelo ícone antes de ativar as notificações.',
    };
  }
  if (Notification.permission === 'denied') {
    return { status: 'denied', message: 'As notificações estão bloqueadas nas configurações do navegador.' };
  }
  return {
    status: Notification.permission === 'granted' ? 'enabled' : 'error',
    message: Notification.permission === 'granted' ? 'Notificações permitidas neste aparelho.' : 'Pronto para solicitar permissão.',
  };
};

export const getPushSubscriptionState = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription && Notification.permission === 'granted');
  } catch {
    return false;
  }
};

export const enablePushNotifications = async (): Promise<PushSetupResult> => {
  const support = getPushSupportMessage();
  if (support.status === 'unsupported' || support.status === 'ios-install-required' || support.status === 'denied') {
    return support;
  }

  const token = getAuthToken();
  if (!token) return { status: 'error', message: 'Entre novamente na sua conta para ativar as notificações.' };

  try {
    // A solicitação de permissão é executada dentro do clique do usuário.
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        status: permission === 'denied' ? 'denied' : 'error',
        message: permission === 'denied' ? 'Permissão de notificações negada.' : 'Permissão de notificações não concedida.',
      };
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('Não foi possível obter a chave de notificações.');
    const { publicKey } = await keyResponse.json() as { publicKey?: string };
    if (!publicKey) throw new Error('Chave pública de notificações não configurada.');

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as any;
      throw new Error(body?.error || 'Não foi possível registrar este aparelho para notificações.');
    }

    return { status: 'enabled', message: 'Notificações ativadas neste aparelho.' };
  } catch (error: any) {
    return { status: 'error', message: error?.message || 'Falha ao ativar notificações.' };
  }
};
