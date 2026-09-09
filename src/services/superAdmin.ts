import { getAuthToken, loginBarbershop } from './cloudSync';

export type TenantStatus = 'active' | 'trial' | 'suspended';
export type TenantPlan = 'trial' | 'basic' | 'professional' | 'premium';

export interface SuperAdminStatus {
  configured: boolean;
  authorized: boolean;
  canBootstrap: boolean;
  email?: string;
}

export interface SuperAdminTenant {
  email: string;
  name: string;
  owner_name?: string;
  slug: string;
  phone?: string;
  status: TenantStatus;
  plan: TenantPlan;
  due_date?: string;
  created_at?: string;
  last_login_at?: string;
  updated_at?: string;
  clients_count: number;
  appointments_count: number;
  barbers_count: number;
  services_count: number;
}

const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' });

const parseError = async (response: Response, fallback: string) => {
  try { const body = await response.json() as any; return new Error(body?.error || fallback); } catch { return new Error(fallback); }
};

export const superAdminLogin = async (email: string, password: string) => {
  await loginBarbershop(email, password, 'superadmin');
};

export const getSuperAdminStatus = async (): Promise<SuperAdminStatus> => {
  const response = await fetch('/api/superadmin/status', { headers: authHeaders(), cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'Não foi possível validar o Super Admin.');
  return response.json();
};

export const bootstrapSuperAdmin = async (): Promise<SuperAdminStatus> => {
  const response = await fetch('/api/superadmin/bootstrap', { method: 'POST', headers: authHeaders() });
  if (!response.ok) throw await parseError(response, 'Não foi possível ativar o Super Admin.');
  return response.json();
};

export const listSuperAdminTenants = async (): Promise<SuperAdminTenant[]> => {
  const response = await fetch('/api/superadmin/tenants', { headers: authHeaders(), cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'Não foi possível carregar os estabelecimentos.');
  const body = await response.json() as any;
  return Array.isArray(body?.tenants) ? body.tenants : [];
};

export const updateSuperAdminTenant = async (payload: { email: string; status: TenantStatus; plan: TenantPlan; due_date?: string; }) => {
  const response = await fetch('/api/superadmin/tenant', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response, 'Não foi possível atualizar a conta.');
  return response.json();
};
