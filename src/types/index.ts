export type StaffRole = 'owner' | 'admin' | 'barber';

export interface StaffPermissions {
  dashboard: boolean;
  atendimentos: boolean;
  agenda: boolean;
  caixa: boolean;
  clientes: boolean;
  relatorios: boolean;
  ajustes: boolean;
  equipe: boolean;
  usuarios: boolean;
  products: boolean;
}

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  barber_id?: string;
  permissions: StaffPermissions;
  created_at?: string;
  last_login_at?: string;
}

export interface CurrentUser {
  email: string;
  name: string;
  role: StaffRole;
  barber_id?: string;
  permissions: StaffPermissions;
}

export interface Service {
  id: string;
  org_id?: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string;
  active: boolean;
}

export interface Product {
  id: string;
  org_id?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  stock: number;
  category: string;
  sku?: string;
  image_url?: string;
  active: boolean;
  public_visible: boolean;
}

export interface ProductSaleItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  cost?: number;
}

export interface ProductSale {
  id: string;
  org_id?: string;
  origin: 'internal' | 'public';
  status: 'pending' | 'completed' | 'canceled';
  items: ProductSaleItem[];
  total: number;
  customer_name?: string;
  customer_phone?: string;
  payment_method?: 'pix' | 'credit' | 'debit' | 'cash';
  date: string;
  time: string;
  created_at: string;
  completed_at?: string;
  canceled_at?: string;
}

export interface Barber {
  id: string;
  org_id?: string;
  full_name: string;
  role: string;
  commission_rate: number;
  avatar_url?: string;
  phone: string;
  active?: boolean;
}

export interface AppointmentServiceItem {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category?: string;
}

export interface Appointment {
  id: string;
  org_id?: string;
  client_name: string;
  client_phone: string;
  service_id?: string;
  service_name: string;
  services?: AppointmentServiceItem[];
  duration_minutes?: number;
  barber_id: string;
  barber_name: string;
  start_time: string;
  price: number;
  status: 'scheduled' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'no_show' | 'canceled';
  payment_method?: 'pix' | 'credit' | 'debit' | 'cash';
  date?: string;
  created_at?: string;
}

export interface Client {
  id: string;
  org_id?: string;
  name: string;
  phone: string;
  total_visits: number;
  total_spent: number;
  last_visit?: string;
  notes?: string;
  archived?: boolean;
  archived_at?: string;
}

export type AppNotificationType =
  | 'new_appointment'
  | 'appointment_canceled'
  | 'appointment_rescheduled'
  | 'appointment_completed'
  | 'appointment_confirmed'
  | 'appointment_arrived'
  | 'appointment_started'
  | 'appointment_no_show'
  | 'product_order';

export interface AppNotification {
  id: string;
  org_id?: string;
  type: AppNotificationType;
  title: string;
  message: string;
  created_at: string;
  read_at?: string;
  appointment_id?: string;
  client_id?: string;
  client_name?: string;
  target_tab?: 'agenda' | 'atendimentos' | 'clientes' | 'relatorios' | 'produtos';
}

export interface CashTransaction {
  id: string;
  org_id?: string;
  type: 'income' | 'expense' | 'commission';
  amount: number;
  description: string;
  payment_method: 'pix' | 'credit' | 'debit' | 'cash';
  date: string;
  time: string;
  appointment_id?: string;
  barber_id?: string;
}

export interface BusinessClosurePeriod {
  id: string;
  date: string;
  start?: string;
  end?: string;
  all_day?: boolean;
  reason?: string;
}

export interface CashMovement {
  id: string;
  type: 'entry' | 'withdrawal';
  amount: number;
  description: string;
  date: string;
  time: string;
  created_at: string;
}

export type UiBorderRadius = 'compact' | 'standard' | 'soft';
export type UiSurfaceStyle = 'solid' | 'glass' | 'glow';

export interface PublicGalleryImage {
  id: string;
  image_url: string;
  caption?: string;
  alt_text?: string;
}

export interface OrganizationSocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
  maps?: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_name?: string;
  email?: string;
  password?: string;
  slug: string;
  phone: string;
  pix_key?: string;
  pix_holder?: string;
  address?: string;
  primary_color: string;
  background_color?: string;
  surface_color?: string;
  accent_color?: string;
  theme_preset?: string;
  ui_border_radius?: UiBorderRadius;
  ui_surface_style?: UiSurfaceStyle;
  open_hour?: string;
  close_hour?: string;
  break_enabled?: boolean;
  break_start?: string;
  break_end?: string;
  closed_periods?: BusinessClosurePeriod[];
  cover_image_url?: string;
  logo_image_url?: string;
  public_gallery?: PublicGalleryImage[];
  social_links?: OrganizationSocialLinks;
  whatsapp_confirm_template?: string;
  whatsapp_reminder_template?: string;
  whatsapp_thanks_template?: string;
  whatsapp_inactive_template?: string;
  tv_enabled?: boolean;
  tv_youtube_url?: string;
  tv_media_type?: 'youtube' | 'spotify' | 'apple_music' | 'audio' | 'institutional';
  tv_media_url?: string;
  tv_visual_mode?: 'player_queue' | 'brand_queue' | 'brand_products_queue';
  tv_animations?: boolean;
  tv_notice?: string;
  tv_show_client_names?: boolean;
  tv_show_prices?: boolean;
  tv_sound_enabled?: boolean;
  tv_sound_volume?: number;
  tv_sound_style?: 'bell' | 'soft' | 'attention';
  crm_inactive_days?: 30 | 45 | 60;
  account_status?: 'active' | 'trial' | 'suspended';
  plan?: 'trial' | 'basic' | 'professional' | 'premium';
  subscription_due_date?: string;
  created_at?: string;
  last_login_at?: string;
  cash_movements?: CashMovement[];
}

export type TabType = 
  | 'dashboard' 
  | 'atendimentos' 
  | 'agenda' 
  | 'caixa' 
  | 'clientes' 
  | 'produtos'
  | 'relatorios'
  | 'ajustes' 
  | 'booking' 
  | 'auth';
