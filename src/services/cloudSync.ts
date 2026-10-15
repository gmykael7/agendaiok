import { Organization, Service, Barber, Appointment, Client, AppNotification, CurrentUser, Product, ProductSale, ServiceCommand, WaitlistEntry } from '../types';

export interface CloudSyncPayload {
  org: Organization | null;
  savedOrgs: Organization[];
  services: Service[];
  barbers: Barber[];
  appointments: Appointment[];
  clients: Client[];
  notifications?: AppNotification[];
  products?: Product[];
  productSales?: ProductSale[];
  commands?: ServiceCommand[];
  waitlist?: WaitlistEntry[];
  current_user?: CurrentUser;
  updated_at?: string;
}

export interface AuthResult {
  token: string;
  data: CloudSyncPayload;
}

export interface CloudSaveResult {
  ok: boolean;
  status: number;
  updated_at?: string;
  error?: string;
}

const AUTH_TOKEN_KEY = 'agendai_auth_token';

export const getAuthToken = (): string => localStorage.getItem(AUTH_TOKEN_KEY) || '';

export const setAuthToken = (token: string) => {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const normalizeCloudPayload = (data: any): CloudSyncPayload => ({
  org: data?.org || null,
  savedOrgs: Array.isArray(data?.savedOrgs) ? data.savedOrgs : data?.org ? [data.org] : [],
  services: Array.isArray(data?.services) ? data.services : [],
  barbers: Array.isArray(data?.barbers) ? data.barbers : [],
  appointments: Array.isArray(data?.appointments) ? data.appointments : [],
  clients: Array.isArray(data?.clients) ? data.clients : [],
  notifications: Array.isArray(data?.notifications) ? data.notifications : [],
  products: Array.isArray(data?.products) ? data.products : [],
  productSales: Array.isArray(data?.productSales) ? data.productSales : [],
  commands: Array.isArray(data?.commands) ? data.commands : [],
  waitlist: Array.isArray(data?.waitlist) ? data.waitlist : [],
  current_user: data?.current_user || undefined,
  updated_at: data?.updated_at,
});

const parseError = async (response: Response, fallback: string): Promise<Error> => {
  try {
    const data = await response.json() as any;
    return new Error(data?.error || fallback);
  } catch {
    return new Error(fallback);
  }
};

// Uma página HTML retornada por um deploy incompleto não confirma uma gravação.
const readWriteConfirmation = async (response: Response): Promise<Record<string, any>> => {
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('O servidor não confirmou a operação. Tente novamente em instantes.');
  }
  const result = data as Record<string, any>;
  if (response.ok && result.success !== true) {
    throw new Error('O servidor não confirmou a operação. Tente novamente em instantes.');
  }
  return result;
};

export const loginBarbershop = async (email: string, password: string, purpose?: 'superadmin'): Promise<AuthResult> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, ...(purpose ? { purpose } : {}) }),
  });

  if (!response.ok) throw await parseError(response, 'Não foi possível entrar.');
  const result = await response.json() as any;
  if (!result?.token || !result?.data?.org) throw new Error('Resposta de autenticação inválida.');

  setAuthToken(result.token);
  return { token: result.token, data: normalizeCloudPayload(result.data) };
};

export const registerBarbershop = async (
  payload: CloudSyncPayload,
  password: string
): Promise<AuthResult> => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, password }),
  });

  if (!response.ok) throw await parseError(response, 'Não foi possível concluir o cadastro.');
  const result = await response.json() as any;
  if (!result?.token || !result?.data?.org) throw new Error('Resposta de cadastro inválida.');

  setAuthToken(result.token);
  return { token: result.token, data: normalizeCloudPayload(result.data) };
};

export const logoutBarbershop = async (): Promise<void> => {
  const token = getAuthToken();
  clearAuthToken();
  if (!token) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Logout local continua válido mesmo se a rede estiver indisponível.
  }
};

// Salvamento administrativo detalhado. O servidor bloqueia sobrescrita vazia acidental.
export const saveBarbershopToCloudDetailed = async (payload: CloudSyncPayload): Promise<CloudSaveResult> => {
  const token = getAuthToken();
  if (!token || !payload.org?.email) {
    return { ok: false, status: 401, error: 'Sessão não autenticada.' };
  }

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await readWriteConfirmation(response);

    if (response.status === 401) clearAuthToken();
    return {
      ok: response.ok,
      status: response.status,
      updated_at: data?.updated_at,
      error: response.ok ? undefined : (data?.error || 'Falha ao salvar na nuvem.'),
    };
  } catch (error: any) {
    console.debug('Falha ao salvar na nuvem:', error);
    return { ok: false, status: 0, error: error instanceof Error && !(error instanceof TypeError) ? error.message : 'Sem conexão com a nuvem.' };
  }
};


export const saveTvSettingsToCloud = async (org: Organization): Promise<CloudSaveResult> => {
  const token = getAuthToken();
  if (!token) return { ok: false, status: 401, error: 'Sessão não autenticada.' };

  try {
    const response = await fetch('/api/tv/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tv_enabled: org.tv_enabled === true,
        tv_youtube_url: org.tv_youtube_url || '',
        tv_media_type: org.tv_media_type || 'institutional',
        tv_media_url: org.tv_media_url || '',
        tv_visual_mode: org.tv_visual_mode || 'player_queue',
        tv_animations: org.tv_animations !== false,
        tv_notice: org.tv_notice || '',
        tv_show_client_names: org.tv_show_client_names === true,
        tv_show_prices: org.tv_show_prices === true,
        tv_sound_enabled: org.tv_sound_enabled !== false,
        tv_sound_volume: Number(org.tv_sound_volume ?? 70),
        tv_sound_style: org.tv_sound_style || 'bell',
        logo_image_url: org.logo_image_url || '',
        cover_image_url: org.cover_image_url || '',
        public_gallery: org.public_gallery || [],
        social_links: org.social_links || {},
      }),
    });
    const data = await readWriteConfirmation(response);
    if (response.status === 401) clearAuthToken();
    return { ok: response.ok, status: response.status, updated_at: data?.updated_at, error: response.ok ? undefined : (data?.error || 'Falha ao atualizar a TV.') };
  } catch {
    return { ok: false, status: 0, error: 'Sem conexão com a nuvem.' };
  }
};

export const saveBarbershopToCloud = async (payload: CloudSyncPayload): Promise<boolean> => {
  return (await saveBarbershopToCloudDetailed(payload)).ok;
};

// E-mail = leitura privada (exige token). Slug = leitura pública sanitizada.
export const loadBarbershopFromCloud = async (
  emailOrSlug: string
): Promise<CloudSyncPayload | null> => {
  const clean = emailOrSlug.toLowerCase().trim();
  if (!clean) return null;

  const isEmail = clean.includes('@');
  const queryParam = isEmail
    ? `email=${encodeURIComponent(clean)}`
    : `slug=${encodeURIComponent(clean)}`;
  const token = getAuthToken();

  if (isEmail && !token) return null;

  try {
    const response = await fetch(`/api/sync?${queryParam}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...(isEmail && token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (response.status === 401) {
      clearAuthToken();
      return null;
    }
    if (!response.ok) return null;

    const data = await response.json() as any;
    if (!data?.org) return null;
    return normalizeCloudPayload(data);
  } catch (error) {
    console.debug('Falha ao consultar nuvem:', error);
    return null;
  }
};

export const restoreLastCloudBackup = async (): Promise<CloudSyncPayload> => {
  const token = getAuthToken();
  if (!token) throw new Error('Sessão não autenticada.');

  const response = await fetch('/api/sync/restore-last', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await parseError(response, 'Não foi possível restaurar o backup da nuvem.');
  const data = await response.json() as any;
  if (!data?.data?.org) throw new Error('Nenhum backup válido foi encontrado.');
  return normalizeCloudPayload(data.data);
};

// Novo agendamento do cliente. A rota é pública, mas o servidor valida conflito de horário.
export interface AppointmentPushResult {
  ok: boolean;
  status: number;
  error?: string;
  appointment?: Appointment;
}

export const pushAppointmentToCloud = async (
  appointment: Appointment,
  orgSlug: string | undefined,
  turnstileToken: string,
): Promise<AppointmentPushResult> => {
  const targetSlug = (orgSlug || appointment.org_id || '').toLowerCase().trim();
  if (!targetSlug) return { ok: false, status: 400, error: 'Barbearia não identificada.' };

  try {
    const response = await fetch('/api/appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...appointment,
        org_slug: targetSlug,
        'cf-turnstile-response': turnstileToken,
      }),
    });
    const body = await readWriteConfirmation(response);
    if (response.ok) return { ok: true, status: response.status, appointment: body.appointment };
    return { ok: false, status: response.status, error: body?.error || 'Não foi possível confirmar o agendamento.' };
  } catch (error) {
    console.debug('Erro ao enviar agendamento:', error);
    return { ok: false, status: 0, error: error instanceof Error && !(error instanceof TypeError) ? error.message : 'Sem conexão com o servidor. Tente novamente.' };
  }
};


export const loadStaffUsers = async () => {
  const token = getAuthToken();
  const response = await fetch('/api/staff', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw await parseError(response, 'Não foi possível carregar os usuários.');
  return await response.json() as any;
};

export const saveStaffUser = async (payload: any) => {
  const token = getAuthToken();
  const response = await fetch('/api/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response, 'Não foi possível salvar o usuário.');
  return await response.json() as any;
};


export interface ProductOrderPushResult {
  ok: boolean;
  status: number;
  sale?: ProductSale;
  products?: Product[];
  error?: string;
}

export const pushProductOrderToCloud = async (
  payload: {
    org_slug: string;
    customer_name: string;
    customer_phone: string;
    items: Array<{ product_id: string; quantity: number }>;
  },
  turnstileToken: string,
): Promise<ProductOrderPushResult> => {
  try {
    const response = await fetch('/api/product-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        'cf-turnstile-response': turnstileToken,
      }),
    });
    const body = await readWriteConfirmation(response);
    return {
      ok: response.ok,
      status: response.status,
      sale: body?.sale,
      products: Array.isArray(body?.products) ? body.products : undefined,
      error: response.ok ? undefined : (body?.error || 'Não foi possível registrar o pedido.'),
    };
  } catch {
    return { ok: false, status: 0, error: 'Sem conexão com a loja agora.' };
  }
};

export interface WaitlistPushResult {
  ok: boolean;
  status: number;
  entry?: WaitlistEntry;
  error?: string;
}

export const pushWaitlistToCloud = async (
  entry: Omit<WaitlistEntry, 'id' | 'status' | 'created_at'>,
  orgSlug: string,
): Promise<WaitlistPushResult> => {
  const targetSlug = (orgSlug || '').toLowerCase().trim();
  if (!targetSlug) return { ok: false, status: 400, error: 'Barbearia não identificada.' };

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...entry,
        org_slug: targetSlug,
      }),
    });
    const body = await readWriteConfirmation(response);
    return { ok: response.ok, status: response.status, entry: body.entry };
  } catch {
    return { ok: false, status: 0, error: 'Sem conexão com o servidor. Tente novamente.' };
  }
};
