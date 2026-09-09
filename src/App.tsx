import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { 
  TabType, 
  Organization, 
  Service, 
  Barber, 
  Appointment,
  Client,
  AppNotification,
  CurrentUser,
  Product,
  ProductSale
} from './types';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { PlatformNotices } from './components/common/PlatformNotices';
import { LoadingState } from './components/common/LoadingState';
import { readStoredArray } from './utils/storage';
import { bookingSlugFromLocation, isPublicBookingLocation } from './utils/routes';
import { useClipboard } from './hooks/useClipboard';
import { Modal } from './components/common/Modal';

const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const AtendimentosView = lazy(() => import('./views/AtendimentosView').then(m => ({ default: m.AtendimentosView })));
const AgendaView = lazy(() => import('./views/AgendaView').then(m => ({ default: m.AgendaView })));
const CaixaView = lazy(() => import('./views/CaixaView').then(m => ({ default: m.CaixaView })));
const RelatoriosView = lazy(() => import('./views/RelatoriosView').then(m => ({ default: m.RelatoriosView })));
const ProductsView = lazy(() => import('./views/ProductsView').then(m => ({ default: m.ProductsView })));
const ClientesView = lazy(() => import('./views/ClientesView').then(m => ({ default: m.ClientesView })));
const AjustesView = lazy(() => import('./views/AjustesView').then(m => ({ default: m.AjustesView })));
const TenantBookingView = lazy(() => import('./views/TenantBookingView').then(m => ({ default: m.TenantBookingView })));
const TvDisplayView = lazy(() => import('./views/TvDisplayView').then(m => ({ default: m.TvDisplayView })));
const AuthView = lazy(() => import('./views/AuthView').then(m => ({ default: m.AuthView })));
const SuperAdminView = lazy(() => import('./views/SuperAdminView').then(m => ({ default: m.SuperAdminView })));
const LandingView = lazy(() => import('./views/LandingView').then(m => ({ default: m.LandingView })));
import { 
  INITIAL_ORG, 
  INITIAL_SERVICES, 
  INITIAL_BARBERS, 
  INITIAL_APPOINTMENTS,
  INITIAL_CLIENTS
} from './data/mockData';
import { 
  saveBarbershopToCloud,
  saveBarbershopToCloudDetailed,
  loadBarbershopFromCloud,
  getAuthToken,
  logoutBarbershop,
  CloudSyncPayload
} from './services/cloudSync';
import { Bell, Calendar, CheckCircle2, Clock, Sparkles, User, X, Smartphone, QrCode, Copy, Check, Share2, ArrowRight, Cloud, RefreshCw } from 'lucide-react';
import { BrandLogo } from './components/common/BrandLogo';
import { BarberPoleLoader } from './components/common/BarberPoleLoader';
import { OnboardingChecklist } from './components/common/OnboardingChecklist';
import { AgencyCredit } from './components/common/AgencyCredit';
import { dedupeClients, upsertClient } from './utils/clients';
import { getAdminAppUrl } from './config/urls';
import { getLocalDateKey } from './utils/scheduling';
import { getReadableTextColor, isLightColor, deriveAccentColor, adjustHexBrightness } from './utils/color';
import { cloneCloudPayload, ConflictPreference, reconcileCloudPayload } from './utils/cloudReconciliation';

const STORAGE_KEYS = {
  CURRENT_ORG: 'agendai_current_org',
  ALL_ORGS: 'agendai_all_orgs',
  SERVICES: 'agendai_services',
  BARBERS: 'agendai_barbers',
  APPOINTMENTS: 'agendai_appointments',
  CLIENTS: 'agendai_clients',
  NOTIFICATIONS: 'agendai_notifications',
  PRODUCTS: 'agendai_products',
  PRODUCT_SALES: 'agendai_product_sales',
  AUTH_SESSION: 'agendai_session_active',
};

const SYNC_CHANNEL_NAME = 'agendai_realtime_sync';

interface PendingCloudConflict {
  conflicts: string[];
}

interface ResolvedCloudSave {
  ok: boolean;
  status: number;
  updated_at?: string;
  error?: string;
  deferred?: boolean;
  reconciledPayload?: CloudSyncPayload;
}

const cloudPayloadFingerprint = (payload: CloudSyncPayload): string => JSON.stringify({
  org: payload.org,
  savedOrgs: payload.savedOrgs,
  services: payload.services,
  barbers: payload.barbers,
  appointments: payload.appointments,
  clients: payload.clients,
  notifications: payload.notifications || [],
  products: payload.products || [],
  productSales: payload.productSales || [],
});


const mergeNotifications = (current: AppNotification[], incoming: AppNotification[]): AppNotification[] => {
  const map = new Map<string, AppNotification>();
  [...current, ...incoming].forEach((notification) => {
    if (!notification?.id) return;
    const existing = map.get(notification.id);
    map.set(notification.id, {
      ...existing,
      ...notification,
      read_at: notification.read_at || existing?.read_at,
    });
  });
  return [...map.values()]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 100);
};

const tenantKeyForOrg = (organization: Organization | null | undefined): string =>
  String(organization?.email || organization?.id || organization?.slug || '').trim().toLowerCase();

const notificationsForOrg = (items: AppNotification[], organization: Organization | null | undefined): AppNotification[] => {
  const orgId = String(organization?.id || '').trim();
  if (!orgId) return [];
  return (Array.isArray(items) ? items : []).filter((notification) => {
    const notificationOrgId = String(notification?.org_id || '').trim();
    // Notificações novas sempre possuem org_id. Registros legados sem org_id só são
    // aceitos quando pertencem a um agendamento que será validado pelo snapshot atual.
    return !notificationOrgId || notificationOrgId === orgId;
  });
};


const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.14);
    gain2.gain.setValueAtTime(0.12, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.4);
  } catch {}
};

const getTvSlugFromUrl = (): string | null => {
  const pathname = window.location.pathname.toLowerCase();
  const pathMatch = pathname.match(/\/tv\/([a-z0-9-]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).toLowerCase();

  const params = new URLSearchParams(window.location.search);
  const tvSlug = params.get('tv');
  if (tvSlug && tvSlug !== 'true' && tvSlug !== '1') return tvSlug.toLowerCase();
  return null;
};

const getSlugFromUrl = (): string | null => {
  return bookingSlugFromLocation(window.location);
};

export default function App() {
  const isSuperAdminRoute = window.location.pathname.toLowerCase().startsWith('/superadmin');
  const tvSlug = getTvSlugFromUrl();
  const isTvRoute = Boolean(tvSlug);

  const [savedOrgs, setSavedOrgs] = useState<Organization[]>(() => {
    return readStoredArray<Organization>(STORAGE_KEYS.ALL_ORGS);
  });

  const [org, setOrg] = useState<Organization | null>(() => {
    const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ORG);
    if (session === 'true' && saved && getAuthToken()) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser | undefined>(() => {
    try { return JSON.parse(localStorage.getItem('agendai_current_user') || 'null') || undefined; } catch { return undefined; }
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ORG);
    return session === 'true' && !!saved && !!getAuthToken();
  });

  const [isSessionValidated, setIsSessionValidated] = useState<boolean>(() => {
    const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ORG);
    const hasCandidateSession = session === 'true' && !!saved && !!getAuthToken();
    return !hasCandidateSession;
  });

  const [services, setServices] = useState<Service[]>(() => {
    return readStoredArray<Service>(STORAGE_KEYS.SERVICES);
  });

  const [barbers, setBarbers] = useState<Barber[]>(() => {
    return readStoredArray<Barber>(STORAGE_KEYS.BARBERS);
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    return readStoredArray<Appointment>(STORAGE_KEYS.APPOINTMENTS);
  });

  const [clients, setClients] = useState<Client[]>(() => {
    return dedupeClients(readStoredArray<Client>(STORAGE_KEYS.CLIENTS));
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!saved) return [];
    try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  });

  const [productSales, setProductSales] = useState<ProductSale[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCT_SALES);
    if (!saved) return [];
    try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  });

  const [isClientRoute, setIsClientRoute] = useState<boolean>(() => {
    return isPublicBookingLocation(window.location);
  });
  const [publicRouteSlug, setPublicRouteSlug] = useState(getSlugFromUrl);

  const [isLoadingPublicData, setIsLoadingPublicData] = useState<boolean>(() => isClientRoute);
  // A página pública nunca reutiliza os arrays privados do painel, nem em memória.
  const [publicCloudData, setPublicCloudData] = useState<CloudSyncPayload | null>(null);
  const publicOrgData = publicCloudData?.org || null;

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [settingsInitialTab, setSettingsInitialTab] = useState<'team' | 'services' | 'general'>('team');
  const [authEntry, setAuthEntry] = useState<'landing' | 'login' | 'register'>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('cadastro') || hash.includes('register')) return 'register';
    if (hash.includes('login') || hash.includes('entrar')) return 'login';
    return 'landing';
  });
  const adminScrollRef = useRef<HTMLDivElement | null>(null);

  const openAuthEntry = useCallback((mode: 'login' | 'register') => {
    setAuthEntry(mode);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${mode === 'register' ? 'cadastro' : 'login'}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const closeAuthEntry = useCallback(() => {
    setAuthEntry('landing');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const navigateToTab = useCallback((tab: TabType) => {
    setCurrentTab(tab);
    requestAnimationFrame(() => {
      adminScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, []);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => typeof window === 'undefined' ? false : localStorage.getItem('agendai_onboarding_dismissed') !== '1');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const { copied: copiedSyncLink, error: copySyncError, copy: copySyncLink } = useClipboard();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [pendingCloudConflict, setPendingCloudConflict] = useState<PendingCloudConflict | null>(null);

  const [toastNotification, setToastNotification] = useState<{
    id: string;
    client_name: string;
    service_name: string;
    barber_name: string;
    start_time: string;
    date?: string;
    price: number;
  } | null>(null);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isInitialLoadDone = useRef(false);
  const lastCloudTimestamp = useRef<string>('');
  const lastSavedCloudFingerprintRef = useRef<string>('');
  const lastSyncedCloudPayloadRef = useRef<CloudSyncPayload | null>(null);
  const isCloudHydratedRef = useRef(false);
  const skipNextCloudSaveRef = useRef(false);
  const latestPayloadRef = useRef<CloudSyncPayload>({ org, savedOrgs, services, barbers, appointments, clients, notifications, products, productSales });
  latestPayloadRef.current = { org, savedOrgs, services, barbers, appointments, clients, notifications, products, productSales };
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Refs para acesso livre de stale closures dentro de intervalos de sincronização
  const servicesRef = useRef(services);
  const barbersRef = useRef(barbers);
  const appointmentsRef = useRef(appointments);
  const clientsRef = useRef(clients);
  const productsRef = useRef(products);
  const productSalesRef = useRef(productSales);
  const orgRef = useRef(org);
  const notificationBaselineRef = useRef<Map<string, Appointment>>(new Map());
  const notificationBaselineInitializedRef = useRef(false);

  useEffect(() => { servicesRef.current = services; }, [services]);
  useEffect(() => { barbersRef.current = barbers; }, [barbers]);
  useEffect(() => { appointmentsRef.current = appointments; }, [appointments]);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { productSalesRef.current = productSales; }, [productSales]);
  useEffect(() => { orgRef.current = org; }, [org]);

  // Hidrata o estado React diretamente com o conteúdo autenticado da nuvem.
  // Isto evita o bug em que um celular recém-logado iniciava com arrays vazios e os salvava por cima do KV.
  const applyPrivateCloudData = useCallback((cloudData: CloudSyncPayload) => {
    if (!cloudData.org) return;

    skipNextCloudSaveRef.current = true;
    isCloudHydratedRef.current = true;
    lastCloudTimestamp.current = cloudData.updated_at || '';

    const nextSavedOrgs = cloudData.savedOrgs?.length ? cloudData.savedOrgs : [cloudData.org];
    const nextServices = cloudData.services || [];
    const nextBarbers = cloudData.barbers || [];
    const nextAppointments = cloudData.appointments || [];
    const nextClients = dedupeClients(cloudData.clients || []);
    const nextNotifications = notificationsForOrg(Array.isArray(cloudData.notifications) ? cloudData.notifications : [], cloudData.org);
    const nextProducts = Array.isArray(cloudData.products) ? cloudData.products : [];
    const nextProductSales = Array.isArray(cloudData.productSales) ? cloudData.productSales : [];

    const normalizedCloudData: CloudSyncPayload = {
      org: cloudData.org,
      savedOrgs: nextSavedOrgs,
      services: nextServices,
      barbers: nextBarbers,
      appointments: nextAppointments,
      clients: nextClients,
      notifications: nextNotifications,
      products: nextProducts,
      productSales: nextProductSales,
      current_user: cloudData.current_user,
      updated_at: cloudData.updated_at,
    };
    lastSavedCloudFingerprintRef.current = cloudPayloadFingerprint(normalizedCloudData);
    lastSyncedCloudPayloadRef.current = cloneCloudPayload(normalizedCloudData);
    setPendingCloudConflict(null);

    // Atualiza também as refs imediatamente para impedir leituras antigas durante polling/autosave.
    orgRef.current = cloudData.org;
    servicesRef.current = nextServices;
    barbersRef.current = nextBarbers;
    appointmentsRef.current = nextAppointments;
    clientsRef.current = nextClients;
    productsRef.current = nextProducts;
    productSalesRef.current = nextProductSales;

    setOrg(cloudData.org);
    setSavedOrgs(nextSavedOrgs);
    setServices(nextServices);
    setBarbers(nextBarbers);
    setAppointments(nextAppointments);
    setClients(nextClients);
    setNotifications(mergeNotifications([], nextNotifications));
    setProducts(nextProducts);
    setProductSales(nextProductSales);
    if (cloudData.current_user) { setCurrentUser(cloudData.current_user); localStorage.setItem('agendai_current_user', JSON.stringify(cloudData.current_user)); }

    if (!notificationBaselineInitializedRef.current) {
      notificationBaselineRef.current = new Map(nextAppointments.map((appointment) => [appointment.id, { ...appointment }]));
      notificationBaselineInitializedRef.current = true;
    }

    localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(cloudData.org));
    localStorage.setItem(STORAGE_KEYS.ALL_ORGS, JSON.stringify(nextSavedOrgs));
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(nextServices));
    localStorage.setItem(STORAGE_KEYS.BARBERS, JSON.stringify(nextBarbers));
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(nextAppointments));
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(nextClients));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(mergeNotifications([], nextNotifications)));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextProducts));
    localStorage.setItem(STORAGE_KEYS.PRODUCT_SALES, JSON.stringify(nextProductSales));
  }, []);

  const reconcileAfterCloudConflict = useCallback(async (
    localPayload: CloudSyncPayload,
    preference?: ConflictPreference,
  ): Promise<ResolvedCloudSave> => {
    const identifier = localPayload.org?.email || localPayload.org?.slug;
    const base = lastSyncedCloudPayloadRef.current;
    if (!identifier || !base) {
      return {
        ok: false,
        status: 409,
        error: 'Não foi possível comparar as versões com segurança. Reabra o app antes de continuar.',
      };
    }

    let remote = await loadBarbershopFromCloud(identifier);
    if (!remote?.org || !remote.updated_at) {
      return { ok: false, status: 0, error: 'Não foi possível carregar a versão mais recente da nuvem.' };
    }

    // Uma nova gravação pode ocorrer entre a leitura e o salvamento. Repetimos a
    // conciliação uma vez com o snapshot mais novo, sem jamais forçar sobrescrita.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const resolution = reconcileCloudPayload(base, localPayload, remote, preference || 'local');
      if (resolution.conflicts.length > 0 && !preference) {
        setPendingCloudConflict({ conflicts: resolution.conflicts });
        return {
          ok: false,
          status: 409,
          deferred: true,
          error: `${resolution.conflicts.length} alteração${resolution.conflicts.length === 1 ? '' : 'ões'} precisa${resolution.conflicts.length === 1 ? '' : 'm'} da sua escolha.`,
        };
      }

      const result = await saveBarbershopToCloudDetailed({
        ...resolution.payload,
        updated_at: remote.updated_at,
      });
      if (result.ok) {
        return {
          ...result,
          reconciledPayload: {
            ...resolution.payload,
            updated_at: result.updated_at || remote.updated_at,
          },
        };
      }
      if (result.status !== 409) return result;

      const latestRemote = await loadBarbershopFromCloud(identifier);
      if (!latestRemote?.org || !latestRemote.updated_at) return result;
      remote = latestRemote;
    }

    return {
      ok: false,
      status: 409,
      error: 'A agenda recebeu novas alterações enquanto era conciliada. Tente novamente.',
    };
  }, []);

  // Aplica a paleta e personalizações escolhidas pelo estabelecimento em todas as telas.
  useEffect(() => {
    const themedOrg = isClientRoute ? publicOrgData : org;
    const root = document.documentElement;
    const primaryColor = themedOrg?.primary_color || '#10b981';
    const backgroundColor = themedOrg?.background_color || '#070B14';
    const surfaceColor = themedOrg?.surface_color || '#121B2E';
    const accentColor = themedOrg?.accent_color || deriveAccentColor(primaryColor);
    const surfaceStyle = themedOrg?.ui_surface_style || 'solid';
    const borderRadius = themedOrg?.ui_border_radius || 'standard';
    const isLight = isLightColor(backgroundColor);

    root.style.setProperty('--brand-color', primaryColor);
    root.style.setProperty('--brand-contrast-color', getReadableTextColor(primaryColor));
    root.style.setProperty('--brand-accent', accentColor);
    root.style.setProperty('--brand-accent-soft', isLight ? adjustHexBrightness(accentColor, 0.4) : adjustHexBrightness(accentColor, 1.3));
    root.style.setProperty('--app-bg-color', backgroundColor);
    root.style.setProperty('--app-surface-color', surfaceColor);
    root.style.setProperty('--app-surface-dark', isLight ? '#ffffff' : adjustHexBrightness(surfaceColor, 0.7));
    root.style.setProperty('--app-surface-elevated', isLight ? '#f1f5f9' : adjustHexBrightness(surfaceColor, 1.25));

    const radiusMap: Record<string, string> = {
      compact: '0.75rem',
      standard: '1.25rem',
      soft: '1.75rem',
    };
    root.style.setProperty('--app-card-radius', radiusMap[borderRadius] || '1.25rem');

    root.dataset.appTheme = isLight ? 'light' : 'dark';
    root.dataset.surfaceStyle = surfaceStyle;
    root.dataset.borderRadius = borderRadius;
  }, [org, publicOrgData, isClientRoute]);

  // 1. CARREGAMENTO INICIAL: BUSCAR DADOS DA NUVEM IMEDIATAMENTE AO ABRIR A PÁGINA
  useEffect(() => {
    let active = true;
    const initApp = async () => {
      const urlSlug = publicRouteSlug;

      // Modo TV usa uma rota pública própria e carrega somente dados sanitizados.
      if (isTvRoute) {
        setIsSessionValidated(true);
        isInitialLoadDone.current = true;
        return;
      }

      // CASO A: Página pública do cliente (/agendar/:slug)
      if (urlSlug || isClientRoute) {
        const targetSlug = urlSlug;
        setPublicCloudData(null);
        if (targetSlug) {
          setIsLoadingPublicData(true);
          try {
            const cloudData = await loadBarbershopFromCloud(targetSlug);
            if (!active) return;
            if (cloudData && cloudData.org) {
              setPublicCloudData(cloudData);
            }
          } catch (e) {
            console.debug('Erro ao carregar da nuvem:', e);
          } finally {
            if (active) setIsLoadingPublicData(false);
          }
        } else setIsLoadingPublicData(false);
      } 
      // CASO B: Painel Administrativo com Sessão Ativa
      else if (org && org.email) {
        try {
          const cloudData = await loadBarbershopFromCloud(org.email);
          if (!active) return;
          if (cloudData && cloudData.org) {
            applyPrivateCloudData(cloudData);
          } else if (!getAuthToken()) {
            // Só encerra a sessão quando o servidor realmente invalidou o token.
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
            setIsLoggedIn(false);
            setOrg(null);
            setCurrentTab('auth');
          } else {
            // Sem conexão: mantém os dados locais e BLOQUEIA qualquer upload até a nuvem ser lida.
            isCloudHydratedRef.current = false;
            setSyncStatusMsg('⚠️ Nuvem indisponível. Seus dados locais foram preservados e não serão sobrescritos.');
          }
        } catch (e) {
          if (!active) return;
          console.debug('Erro ao restaurar da nuvem:', e);
          isCloudHydratedRef.current = false;
          setSyncStatusMsg('⚠️ Não foi possível validar a nuvem agora. Dados locais preservados.');
        } finally {
          if (active) setIsSessionValidated(true);
        }
      } else {
        setIsSessionValidated(true);
      }

      if (active) isInitialLoadDone.current = true;
    };

    initApp();
    return () => { active = false; };
  }, [isClientRoute, isTvRoute, publicRouteSlug]);

  // 2. Links antigos com ?sync_data= não autenticam mais o painel.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('sync_data')) {
      params.delete('sync_data');
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
      setIsLoggedIn(false);
      setOrg(null);
      setCurrentTab('auth');
      setIsSessionValidated(true);
    }
  }, []);

  // Monitorar alterações na URL
  useEffect(() => {
    const handleHashChange = () => {
      setIsClientRoute(isPublicBookingLocation(window.location));
      setPublicRouteSlug(getSlugFromUrl());
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // 3. AUTO-SALVAMENTO OTIMIZADO: aguarda o usuario parar de editar e so grava se o conteudo mudou.
  // Isso evita uma escrita no banco a cada clique, tecla ou renderizacao intermediaria.
  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    if (!org || !isLoggedIn || !isCloudHydratedRef.current || isClientRoute || isTvRoute) return;

    // Dados que acabaram de chegar da nuvem nunca devem voltar imediatamente como um novo upload.
    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }

    const payload: CloudSyncPayload = {
      org,
      savedOrgs,
      services,
      barbers,
      appointments,
      clients,
      notifications,
      products,
      productSales,
      updated_at: lastCloudTimestamp.current || undefined,
    };
    const fingerprint = cloudPayloadFingerprint(payload);

    // Nenhuma alteracao real desde o ultimo snapshot confirmado.
    if (fingerprint === lastSavedCloudFingerprintRef.current) return;

    // Debounce curto: ações concluídas chegam à nuvem quase imediatamente,
    // mas atualizações simultâneas da mesma ação continuam agrupadas em uma única gravação.
    const timer = setTimeout(() => {
      const save = async () => {
        // Serializa gravações e ignora estados já substituídos por uma edição mais recente.
        if (fingerprint !== cloudPayloadFingerprint(latestPayloadRef.current)) return;
        let result: ResolvedCloudSave = await saveBarbershopToCloudDetailed({ ...payload, updated_at: lastCloudTimestamp.current || undefined });
        if (!result.ok && result.status === 409) {
          result = await reconcileAfterCloudConflict(payload);
        }

        let confirmedPayload: CloudSyncPayload | null = null;
        if (result.ok) {
          confirmedPayload = result.reconciledPayload || {
            ...payload,
            updated_at: result.updated_at || payload.updated_at,
          };
          if (result.reconciledPayload) {
            applyPrivateCloudData(confirmedPayload);
          } else {
            lastSavedCloudFingerprintRef.current = fingerprint;
            lastSyncedCloudPayloadRef.current = cloneCloudPayload(confirmedPayload);
            if (result.updated_at) lastCloudTimestamp.current = result.updated_at;
          }
          setPendingCloudConflict(null);
          setSyncStatusMsg('');
        } else if (result.deferred) {
          setSyncStatusMsg(`⚠️ ${result.error} Escolha abaixo qual versão deve prevalecer somente nos campos alterados nos dois aparelhos.`);
        } else {
          setSyncStatusMsg(`⚠️ ${result.error || 'Não foi possível salvar na nuvem.'} Suas alterações continuam neste aparelho.`);
        }

        // Sincronizacao instantanea entre abas do MESMO navegador nao consome banco.
        if (result.ok && broadcastChannelRef.current) {
          try {
            const synced = confirmedPayload || payload;
            broadcastChannelRef.current.postMessage({ type: 'SERVICES_SYNC', payload: synced.services, tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'BARBERS_SYNC', payload: synced.barbers, tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'APPOINTMENTS_SYNC', payload: synced.appointments, tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'CLIENTS_SYNC', payload: synced.clients, tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'NOTIFICATIONS_SYNC', payload: synced.notifications || [], tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'PRODUCTS_SYNC', payload: synced.products || [], tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'PRODUCT_SALES_SYNC', payload: synced.productSales || [], tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'ORG_SYNC', payload: synced.org, tenant: tenantKeyForOrg(synced.org) });
          } catch (e) {}
        }
      };
      saveQueueRef.current = saveQueueRef.current.then(save, save);
    }, 500);

    return () => clearTimeout(timer);
  }, [services, barbers, appointments, clients, notifications, products, productSales, org, savedOrgs, isLoggedIn, isClientRoute, isTvRoute, applyPrivateCloudData, reconcileAfterCloudConflict]);

  // 4. SINCRONIZAÇÃO ENTRE APARELHOS: consulta leve a cada 60s e ao voltar para a aba.
  useEffect(() => {
    if (!isInitialLoadDone.current || !isLoggedIn || isClientRoute || isTvRoute) return;

    const syncLiveCloud = async () => {
      if (isManualSyncing || document.visibilityState === 'hidden') return;
      const hasPendingEdits = () => isCloudHydratedRef.current && cloudPayloadFingerprint(latestPayloadRef.current) !== lastSavedCloudFingerprintRef.current;
      if (hasPendingEdits()) return;

      const targetIdentifier = orgRef.current?.email || orgRef.current?.slug;
      if (!targetIdentifier) return;

      try {
        const cloudData = await loadBarbershopFromCloud(targetIdentifier);
        if (hasPendingEdits()) return;
        if (!cloudData && !getAuthToken()) {
          localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
          localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
          setIsLoggedIn(false);
          setOrg(null);
          setCurrentTab('auth');
          return;
        }
        if (cloudData && cloudData.org) {
          const cloudTime = cloudData.updated_at || '';

          if (!isCloudHydratedRef.current || (cloudTime && cloudPayloadFingerprint(cloudData) !== lastSavedCloudFingerprintRef.current)) {
            const existingIds = new Set(appointmentsRef.current.map(a => a.id));
            const newIncoming = cloudData.appointments.filter(a => !existingIds.has(a.id));
            if (newIncoming.length > 0) {
              playNotificationSound();
              setToastNotification(newIncoming[0]);
            }

            // Aplica o snapshot inteiro de forma atômica e marca para NÃO reenviar esse snapshot.
            applyPrivateCloudData(cloudData);
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(syncLiveCloud, 60_000);
    window.addEventListener('focus', syncLiveCloud);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncLiveCloud);
    };
  }, [isManualSyncing, isLoggedIn, isClientRoute, isTvRoute, applyPrivateCloudData]);

  // Sincronização entre abas com BroadcastChannel e storage event
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const { type, payload, tenant } = event.data || {};
          const currentTenant = tenantKeyForOrg(orgRef.current);
          // Nunca processa eventos emitidos por outra conta aberta no mesmo navegador/domínio.
          if (!tenant || !currentTenant || tenant !== currentTenant) return;

          if (type === 'NEW_APPOINTMENT' && payload) {
            setAppointments(prev => {
              const exists = prev.some(a => a.id === payload.id);
              if (exists) return prev;
              return [payload, ...prev];
            });

            setClients(prev => upsertClient(prev, {
              name: payload.client_name,
              phone: payload.client_phone,
              org_id: payload.org_id,
              visitDelta: 1,
              spentDelta: payload.price,
              lastVisit: 'Hoje',
            }));

            setToastNotification(payload);
            playNotificationSound();
          } else if (type === 'UPDATE_APPOINTMENT' && payload) {
            setAppointments(prev => prev.map(a => a.id === payload.id ? payload : a));
          } else if (type === 'SERVICES_SYNC' && Array.isArray(payload)) {
            setServices(payload);
          } else if (type === 'BARBERS_SYNC' && Array.isArray(payload)) {
            setBarbers(payload);
          } else if (type === 'CLIENTS_SYNC' && Array.isArray(payload)) {
            setClients(dedupeClients(payload));
          } else if (type === 'NOTIFICATIONS_SYNC' && Array.isArray(payload)) {
            setNotifications((current) => mergeNotifications(notificationsForOrg(current, orgRef.current), notificationsForOrg(payload, orgRef.current)));
          } else if (type === 'PRODUCTS_SYNC' && Array.isArray(payload)) {
            setProducts(payload);
          } else if (type === 'PRODUCT_SALES_SYNC' && Array.isArray(payload)) {
            setProductSales(payload);
          } else if (type === 'ORG_SYNC' && payload) {
            setOrg(payload);
          }
        };
      }
    } catch (e) {}

    // localStorage é compartilhado por todas as contas deste domínio. Por segurança,
    // não usamos o evento `storage` para transportar dados de negócio entre abas.
    // A sincronização entre abas usa BroadcastChannel identificado pelo tenant acima.
    const handleStorageChange = (_e: StorageEvent) => {};

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // Persistência local
  useEffect(() => {
    if (org && !isClientRoute) localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(org));
  }, [org]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.ALL_ORGS, JSON.stringify(savedOrgs));
  }, [savedOrgs]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  }, [services, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.BARBERS, JSON.stringify(barbers));
  }, [barbers, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  }, [appointments, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }, [clients, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.PRODUCT_SALES, JSON.stringify(productSales));
  }, [productSales, isClientRoute]);

  useEffect(() => {
    if (!isLoggedIn || isClientRoute || isTvRoute || !isCloudHydratedRef.current) return;

    const currentMap = new Map(appointments.map((appointment) => [appointment.id, { ...appointment }]));
    if (!notificationBaselineInitializedRef.current) {
      notificationBaselineRef.current = currentMap;
      notificationBaselineInitializedRef.current = true;
      return;
    }

    const previousMap = notificationBaselineRef.current;
    const generated: AppNotification[] = [];
    const nowIso = new Date().toISOString();

    appointments.forEach((appointment) => {
      const previous = previousMap.get(appointment.id);
      if (!previous) {
        generated.push({
          id: `new-${appointment.id}`,
          org_id: appointment.org_id || org?.id,
          type: 'new_appointment',
          title: 'Novo agendamento',
          message: `${appointment.client_name} • ${appointment.service_name} • ${appointment.start_time}`,
          created_at: appointment.created_at || nowIso,
          appointment_id: appointment.id,
          client_name: appointment.client_name,
          target_tab: 'agenda',
        });
        return;
      }

      if (previous.status !== appointment.status) {
        if (appointment.status === 'canceled') {
          generated.push({
            id: `canceled-${appointment.id}`,
            org_id: appointment.org_id || org?.id,
            type: 'appointment_canceled',
            title: 'Atendimento cancelado',
            message: `${appointment.client_name} • ${appointment.date || ''} às ${appointment.start_time}`,
            created_at: nowIso,
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            target_tab: 'agenda',
          });
        } else if (appointment.status === 'completed') {
          generated.push({
            id: `completed-${appointment.id}`,
            org_id: appointment.org_id || org?.id,
            type: 'appointment_completed',
            title: 'Atendimento concluído',
            message: `${appointment.client_name} • ${appointment.service_name} • R$ ${Number(appointment.price || 0).toFixed(2)}`,
            created_at: nowIso,
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            target_tab: 'atendimentos',
          });
        } else if (appointment.status === 'confirmed') {
          generated.push({
            id: `confirmed-${appointment.id}`,
            org_id: appointment.org_id || org?.id,
            type: 'appointment_confirmed',
            title: 'Agendamento confirmado',
            message: `${appointment.client_name} • ${appointment.date || ''} às ${appointment.start_time}`,
            created_at: nowIso,
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            target_tab: 'agenda',
          });
        } else if (appointment.status === 'arrived') {
          generated.push({
            id: `arrived-${appointment.id}`,
            org_id: appointment.org_id || org?.id,
            type: 'appointment_arrived',
            title: 'Cliente chegou',
            message: `${appointment.client_name} • ${appointment.service_name}`,
            created_at: nowIso,
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            target_tab: 'atendimentos',
          });
        } else if (appointment.status === 'in_progress') {
          generated.push({
            id: `started-${appointment.id}`,
            org_id: appointment.org_id || org?.id,
            type: 'appointment_started',
            title: 'Atendimento iniciado',
            message: `${appointment.client_name} • ${appointment.barber_name}`,
            created_at: nowIso,
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            target_tab: 'atendimentos',
          });
        } else if (appointment.status === 'no_show') {
          generated.push({
            id: `no-show-${appointment.id}`,
            org_id: appointment.org_id || org?.id,
            type: 'appointment_no_show',
            title: 'Cliente não compareceu',
            message: `${appointment.client_name} • ${appointment.date || ''} às ${appointment.start_time}`,
            created_at: nowIso,
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            target_tab: 'atendimentos',
          });
        }
      }

      if (previous.date !== appointment.date || previous.start_time !== appointment.start_time) {
        generated.push({
          id: `rescheduled-${appointment.id}-${appointment.date || 'sem-data'}-${appointment.start_time}`,
          org_id: appointment.org_id || org?.id,
          type: 'appointment_rescheduled',
          title: 'Horário alterado',
          message: `${appointment.client_name} • ${appointment.date || ''} às ${appointment.start_time}`,
          created_at: nowIso,
          appointment_id: appointment.id,
          client_name: appointment.client_name,
          target_tab: 'agenda',
        });
      }
    });

    if (generated.length > 0) {
      setNotifications((current) => mergeNotifications(current, generated));
    }
    notificationBaselineRef.current = currentMap;
  }, [appointments, isLoggedIn, isClientRoute, isTvRoute, org?.id]);

  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setNotifications((current) => current.map((notification) =>
      notification.id === id && !notification.read_at
        ? { ...notification, read_at: new Date().toISOString() }
        : notification,
    ));
  }, []);

  const handleMarkAllNotificationsRead = useCallback(() => {
    const nowIso = new Date().toISOString();
    setNotifications((current) => current.map((notification) =>
      notification.read_at ? notification : { ...notification, read_at: nowIso },
    ));
  }, []);

  const pendingAppointmentsCount = useMemo(() => {
    return appointments.filter(a => ['scheduled', 'confirmed', 'arrived', 'in_progress'].includes(a.status)).length;
  }, [appointments]);

  const handleForceCloudSync = async () => {
    if (!org || isManualSyncing) return;
    if (!isCloudHydratedRef.current) {
      setSyncStatusMsg('⚠️ Salvamento bloqueado: primeiro é necessário carregar os dados atuais da nuvem.');
      return;
    }

    setIsManualSyncing(true);
    setSyncStatusMsg('');

    // O botão manual usa a mesma fila do autosave e o estado mais recente.
    let confirmedFingerprint = '';
    const save = async () => {
      const payload = latestPayloadRef.current;
      confirmedFingerprint = cloudPayloadFingerprint(payload);
      return saveBarbershopToCloudDetailed({ ...payload, updated_at: lastCloudTimestamp.current || undefined });
    };
    const pendingSave = saveQueueRef.current.then(save, save);
    saveQueueRef.current = pendingSave.then(() => undefined, () => undefined);
    let result: ResolvedCloudSave = await pendingSave;
    if (!result.ok && result.status === 409) {
      result = await reconcileAfterCloudConflict(latestPayloadRef.current);
    }

    setIsManualSyncing(false);
    if (result.ok) {
      const confirmedPayload = result.reconciledPayload || {
        ...latestPayloadRef.current,
        updated_at: result.updated_at || lastCloudTimestamp.current || undefined,
      };
      if (result.reconciledPayload) {
        applyPrivateCloudData(confirmedPayload);
      } else {
        lastSavedCloudFingerprintRef.current = confirmedFingerprint;
        lastSyncedCloudPayloadRef.current = cloneCloudPayload(confirmedPayload);
        if (result.updated_at) lastCloudTimestamp.current = result.updated_at;
      }
      setPendingCloudConflict(null);
      setSyncStatusMsg(result.reconciledPayload ? '✅ Alterações conciliadas e salvas na nuvem!' : '✅ Dados salvos com sucesso na nuvem!');
      setTimeout(() => setSyncStatusMsg(''), 4000);
    } else if (result.deferred) {
      setSyncStatusMsg(`⚠️ ${result.error} Escolha abaixo qual versão deve prevalecer somente nos campos alterados nos dois aparelhos.`);
    } else {
      setSyncStatusMsg(`⚠️ ${result.error || 'Não foi possível salvar na nuvem.'}`);
    }
  };

  const handleResolveCloudConflict = async (preference: ConflictPreference) => {
    if (!org || isManualSyncing) return;
    setIsManualSyncing(true);
    const result = await reconcileAfterCloudConflict(latestPayloadRef.current, preference);
    setIsManualSyncing(false);

    if (result.ok && result.reconciledPayload) {
      applyPrivateCloudData(result.reconciledPayload);
      setPendingCloudConflict(null);
      setSyncStatusMsg('✅ Alterações dos aparelhos foram conciliadas e salvas na nuvem!');
      setTimeout(() => setSyncStatusMsg(''), 5000);
      return;
    }

    setSyncStatusMsg(`⚠️ ${result.error || 'Não foi possível concluir a conciliação.'} Suas alterações continuam neste aparelho.`);
  };

  const handleAddAppointment = useCallback((newApp: Omit<Appointment, 'id'> & { id?: string }) => {
    if (isClientRoute) {
      const created = { ...newApp, id: newApp.id || crypto.randomUUID() } as Appointment;
      setPublicCloudData(current => current ? {
        ...current,
        appointments: current.appointments.some(item => item.id === created.id) ? current.appointments : [created, ...current.appointments],
      } : current);
      return created;
    }
    const targetDate = newApp.date || getLocalDateKey();
    const duration = newApp.duration_minutes || (newApp.services?.reduce((sum, s) => sum + (s.duration_minutes || 30), 0)) || 30;

    const candidateStart = timeToMinutes(newApp.start_time);
    const candidateEnd = candidateStart + duration;

    const isConflict = appointments.some(app => {
      if (app.status === 'canceled' || app.status === 'no_show') return false;
      if (app.barber_id !== newApp.barber_id) return false;
      const appDate = app.date || targetDate;
      if (appDate !== targetDate) return false;

      const appStart = timeToMinutes(app.start_time);
      const appDuration = app.duration_minutes || (app.services?.reduce((sum, s) => sum + (s.duration_minutes || 30), 0)) || 30;
      const appEnd = appStart + appDuration;

      return candidateStart < appEnd && appStart < candidateEnd;
    });

    if (isConflict) {
      return;
    }

    const created: Appointment = {
      ...newApp,
      id: newApp.id || ('app-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
      date: targetDate,
      created_at: new Date().toISOString(),
      status: newApp.status || 'scheduled',
    };

    setAppointments((prev) => {
      if (prev.some(item => item.id === created.id)) return prev;
      const updated = [created, ...prev];
      // A rota pública trabalha somente em memória. Nunca grava o snapshot público/sanitizado
      // no localStorage administrativo do mesmo navegador.
      if (!isClientRoute) localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      return updated;
    });

    if (!isClientRoute) {
      setClients((prev) => {
        const updatedClients = upsertClient(prev, {
          name: newApp.client_name,
          phone: newApp.client_phone,
          org_id: created.org_id,
          visitDelta: 1,
          spentDelta: newApp.price,
          lastVisit: 'Hoje',
        });
        localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(updatedClients));
        return updatedClients;
      });

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'NEW_APPOINTMENT',
            payload: created,
            tenant: tenantKeyForOrg(orgRef.current),
          });
        } catch (e) {}
      }

      playNotificationSound();
      setToastNotification(created);
    }

    return created;
  }, [appointments, isClientRoute]);

  const handleLogin = (cloudData: CloudSyncPayload) => {
    if (!cloudData.org) return;
    applyPrivateCloudData(cloudData);
    setIsSessionValidated(true);
    setIsLoggedIn(true);
    setCurrentTab('dashboard');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  const handleRegister = (cloudData: CloudSyncPayload) => {
    if (!cloudData.org) return;
    applyPrivateCloudData(cloudData);
    setIsSessionValidated(true);
    setIsLoggedIn(true);
    setCurrentTab('dashboard');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    localStorage.removeItem('agendai_onboarding_dismissed');
    setShowOnboarding(true);
  };

  const handleLogout = () => {
    setIsSessionValidated(true);
    isCloudHydratedRef.current = false;
    skipNextCloudSaveRef.current = false;
    notificationBaselineInitializedRef.current = false;
    notificationBaselineRef.current = new Map();
    void logoutBarbershop();
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
    localStorage.removeItem(STORAGE_KEYS.ALL_ORGS);
    localStorage.removeItem(STORAGE_KEYS.SERVICES);
    localStorage.removeItem(STORAGE_KEYS.BARBERS);
    localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCT_SALES);
    localStorage.removeItem('agendai_current_user');
    setCurrentUser(undefined);
    setSavedOrgs([]);
    setServices([]);
    setBarbers([]);
    setAppointments([]);
    setClients([]);
    setNotifications([]);
    setProducts([]);
    setProductSales([]);
    setIsLoggedIn(false);
    setOrg(null);
    setCurrentTab('auth');
    setAuthEntry('login');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#login`);
  };

  const handleLoadDemo = (demoData: {
    org: Organization;
    services: Service[];
    barbers: Barber[];
    appointments: Appointment[];
  }) => {
    setOrg(demoData.org);
    setSavedOrgs(prev => prev.some(o => o.id === demoData.org.id) ? prev : [demoData.org, ...prev]);
    setServices(demoData.services);
    setBarbers(demoData.barbers);
    setAppointments(demoData.appointments);
    setClients(INITIAL_CLIENTS);
    setIsLoggedIn(true);
    setCurrentTab('dashboard');

    saveBarbershopToCloud({
      org: demoData.org,
      savedOrgs: [demoData.org],
      services: demoData.services,
      barbers: demoData.barbers,
      appointments: demoData.appointments,
      clients: INITIAL_CLIENTS,
      notifications: [],
      products: [],
      productSales: [],
    });

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'APPOINTMENTS_SYNC', payload: demoData.appointments });
        broadcastChannelRef.current.postMessage({ type: 'SERVICES_SYNC', payload: demoData.services });
        broadcastChannelRef.current.postMessage({ type: 'BARBERS_SYNC', payload: demoData.barbers });
      } catch (e) {}
    }
  };

  const handleResetAll = () => {
    setIsSessionValidated(true);
    isCloudHydratedRef.current = false;
    skipNextCloudSaveRef.current = false;
    localStorage.clear();
    setOrg(null);
    setSavedOrgs([]);
    setServices([]);
    setBarbers([]);
    setAppointments([]);
    setClients([]);
    setNotifications([]);
    setProducts([]);
    setProductSales([]);
    notificationBaselineInitializedRef.current = false;
    notificationBaselineRef.current = new Map();
    setIsLoggedIn(false);
    setCurrentTab('auth');
    setAuthEntry('landing');
  };

  const generateMobileSyncLink = () => getAdminAppUrl(window.location.pathname);

  const handleCopySyncLink = () => {
    void copySyncLink(generateMobileSyncLink());
  };

  const currentPublicOrg = isClientRoute ? publicOrgData : org;

  // SUPER ADMIN AGÊNCIA G7 (rota isolada do painel de cada estabelecimento)
  if (isSuperAdminRoute) {
    return <SuperAdminView />;
  }

  // 0. MODO TV / PAINEL DE RECEPÇÃO (PÚBLICO E SOMENTE LEITURA)
  if (isTvRoute && tvSlug) {
    return <TvDisplayView slug={tvSlug} />;
  }

  // 1. ROTA PÚBLICA DE AGENDAMENTO DO CLIENTE (MOBILE-FIRST)
  if (isClientRoute || currentTab === 'booking') {
    if (isLoadingPublicData) {
      return (
        <div className="app-loading-screen min-h-screen safe-screen bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md rounded-[28px] brand-panel px-7 py-8 space-y-5">
            <BarberPoleLoader />
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200 font-semibold">AgendAI</p>
              <h3 className="text-xl font-black text-white">Carregando sua experiência premium</h3>
              <p className="text-xs text-slate-400">Buscando serviços, produtos, equipe e horários em tempo real.</p>
            </div>
            <AgencyCredit centered compact className="pt-2 border-0" />
          </div>
        </div>
      );
    }

    if (!currentPublicOrg) {
      return (
        <div className="app-loading-screen min-h-screen safe-screen bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md rounded-[28px] brand-panel px-7 py-8 space-y-5">
            <div className="mx-auto w-20 h-20 rounded-full overflow-hidden bg-white border border-cyan-400/20 flex items-center justify-center shadow-[0_18px_40px_rgba(6,182,212,0.16)] p-3">
              <BrandLogo variant="mark" className="w-full h-full" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200 font-semibold">AgendAI</p>
              <h3 className="text-xl font-black text-white">Barbearia não encontrada</h3>
              <p className="text-xs text-slate-400">O link de agendamento informado não foi localizado.</p>
            </div>
            <AgencyCredit centered compact className="pt-2 border-0" />
          </div>
        </div>
      );
    }

    return (
      <main className="min-h-screen safe-screen bg-[#070B14] text-slate-100 font-sans p-3 sm:p-6 flex items-center justify-center">
        <TenantBookingView 
          org={currentPublicOrg}
          services={isClientRoute ? publicCloudData?.services || [] : services}
          barbers={isClientRoute ? publicCloudData?.barbers || [] : barbers}
          appointments={isClientRoute ? publicCloudData?.appointments || [] : appointments}
          products={isClientRoute ? publicCloudData?.products || [] : products}
          onProductsChanged={isClientRoute ? items => setPublicCloudData(current => current ? { ...current, products: items } : current) : setProducts}
          onAddAppointment={handleAddAppointment}
          onBackToAdmin={isLoggedIn && org ? () => {
            if (isClientRoute) {
              window.location.assign(getAdminAppUrl('/'));
              return;
            }
            setIsClientRoute(false);
            setCurrentTab('dashboard');
          } : undefined}
          isStandalone={isClientRoute}
        />
      </main>
    );
  }

  // Valida o token no servidor antes de liberar qualquer tela administrativa.
  if (isLoggedIn && org && !isSessionValidated) {
    return (
      <div className="app-loading-screen min-h-screen safe-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[28px] brand-panel px-7 py-8 text-center space-y-5">
          <BarberPoleLoader />
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white">Validando sessão segura</h3>
            <p className="text-xs text-slate-400">Aguarde enquanto autenticamos seu acesso na nuvem.</p>
          </div>
          <p className="text-sm text-slate-300">Carregando painel...</p>
          <AgencyCredit centered compact className="pt-2 border-0" />
        </div>
      </div>
    );
  }

  // 2. TELA DE AUTENTICAÇÃO (ACESSO RESTRITO - LOGIN OBRIGATÓRIO)
  if (!isLoggedIn || !org) {
    if (authEntry === 'landing') {
      return <LandingView onLogin={() => openAuthEntry('login')} onRegister={() => openAuthEntry('register')} />;
    }

    return (
      <div className="min-h-screen safe-screen bg-[#070B14] text-slate-100 font-sans p-4 sm:p-8 flex items-center justify-center">
        <AuthView
          key={authEntry}
          onLogin={handleLogin}
          onRegister={handleRegister}
          savedOrganizations={savedOrgs}
          initialMode={authEntry}
          onBack={closeAuthEntry}
        />
      </div>
    );
  }

  if (currentTab === 'auth') {
    return (
      <div className="min-h-screen safe-screen bg-[#070B14] text-slate-100 font-sans p-4 sm:p-8 flex items-center justify-center">
        <AuthView onLogin={handleLogin} onRegister={handleRegister} savedOrganizations={savedOrgs} />
      </div>
    );
  }

  // 3. PAINEL ADMINISTRATIVO INTERNO DA BARBEARIA (APENAS PARA USUÁRIOS AUTENTICADOS)
  return (
    <div className="admin-app-shell app-shell fixed inset-0 overflow-hidden bg-[#070B14] text-slate-100 font-sans flex flex-col md:flex-row">
      {/* TOAST DE NOVO AGENDAMENTO EM TEMPO REAL */}
      {toastNotification && (
        <div className="fixed safe-toast-top left-4 right-4 sm:left-auto sm:right-5 sm:w-96 z-50 animate-bounce-short">
          <div className="app-notification-toast bg-gradient-to-r from-emerald-950 to-[#0B1120] border-2 border-emerald-500 rounded-3xl p-4 shadow-2xl shadow-emerald-500/20 text-white flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Bell className="w-4 h-4 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Novo Agendamento!
                </span>
                <h4 className="font-bold text-white text-xs leading-snug">
                  {toastNotification.client_name} agendou
                </h4>
                <p className="text-[11px] text-slate-300">
                  <strong className="text-emerald-400">{toastNotification.service_name}</strong> com {toastNotification.barber_name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5 font-mono">
                  <span>{new Date((toastNotification.date || getLocalDateKey()) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  <span className="font-bold text-emerald-400">às {toastNotification.start_time}</span>
                  <span>R$ {toastNotification.price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                onClick={() => setToastNotification(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setCurrentTab('agenda');
                  setToastNotification(null);
                }}
                className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20"
              >
                Ver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR PARA DESKTOP */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={navigateToTab}
        org={org}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onLogout={handleLogout}
        permissions={currentUser?.permissions}
      />

      {/* ÁREA PRINCIPAL: o topo fica fora da região rolável em todas as abas. */}
      <main className="app-main min-h-0 flex-1 flex flex-col min-w-0 overflow-hidden bg-[#070B14]">
        <Header 
          org={org} 
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onNavigateToBooking={() => navigateToTab('booking')}
          pendingAppointmentsCount={pendingAppointmentsCount}
          onLogout={handleLogout}
          clients={clients}
          appointments={appointments}
          barbers={barbers}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNavigate={navigateToTab}
        />

        {/* Apenas esta área rola. Assim o cabeçalho nunca sobe junto com a página. */}
        <div ref={adminScrollRef} className="admin-scroll-content app-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Sincronização continua automática em segundo plano. O card de status foi ocultado. */}
          {syncStatusMsg.startsWith('⚠️') && (
            <div className="px-3 sm:px-6 md:px-8 max-w-[1600px] w-full mx-auto pt-3">
              <div role="status" className="sync-warning text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-3">
                <p className="leading-relaxed">{syncStatusMsg}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pendingCloudConflict ? (
                    <>
                      <button
                        type="button"
                        disabled={isManualSyncing}
                        onClick={() => handleResolveCloudConflict('local')}
                        className="min-h-10 rounded-lg border border-current/30 px-3 py-2 font-semibold transition hover:bg-current/10 disabled:opacity-60"
                      >
                        {isManualSyncing ? 'Conciliando…' : 'Priorizar este aparelho'}
                      </button>
                      <button
                        type="button"
                        disabled={isManualSyncing}
                        onClick={() => handleResolveCloudConflict('remote')}
                        className="min-h-10 rounded-lg border border-current/30 px-3 py-2 font-semibold transition hover:bg-current/10 disabled:opacity-60"
                      >
                        Priorizar a nuvem
                      </button>
                      <span className="self-center opacity-80">
                        {pendingCloudConflict.conflicts.length} campo{pendingCloudConflict.conflicts.length === 1 ? '' : 's'} em conflito
                      </span>
                    </>
                  ) : (
                    <button type="button" disabled={isManualSyncing} onClick={handleForceCloudSync} className="min-h-10 underline font-semibold py-2">
                      {isManualSyncing ? 'Salvando…' : 'Tentar salvar novamente'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ABA ATIVA */}
          <div className="app-content p-3 sm:p-6 md:p-8 xl:p-10 max-w-[1600px] w-full mx-auto">
            <Suspense fallback={<LoadingState />}>
            {org && currentUser?.role !== 'barber' && <PlatformNotices key={`${org.id}:${getAuthToken() || ''}`} />}
            {currentTab === 'dashboard' && currentUser?.permissions?.dashboard !== false && showOnboarding && org && (
              <div className="mb-6">
                <OnboardingChecklist
                  org={org}
                  barbers={barbers}
                  services={services}
                  onNavigateToSettings={(tab) => { setSettingsInitialTab(tab); navigateToTab('ajustes'); }}
                  onDismiss={() => {
                    localStorage.setItem('agendai_onboarding_dismissed', '1');
                    setShowOnboarding(false);
                  }}
                />
              </div>
            )}
            {currentTab === 'dashboard' && currentUser?.permissions?.dashboard !== false && (
              <DashboardView 
                appointments={appointments}
                setAppointments={setAppointments}
                services={services}
                barbers={barbers}
                org={org}
                productSales={productSales}
                onNavigateToAgenda={() => navigateToTab('agenda')}
                onNavigateToServices={() => navigateToTab('ajustes')}
              />
            )}

            {currentTab === 'atendimentos' && currentUser?.permissions?.atendimentos !== false && (
              <AtendimentosView 
                appointments={appointments}
                setAppointments={setAppointments}
                services={services}
                barbers={barbers}
                org={org}
              />
            )}

            {currentTab === 'agenda' && currentUser?.permissions?.agenda !== false && (
              <AgendaView 
                appointments={appointments}
                setAppointments={setAppointments}
                barbers={barbers}
                services={services}
                org={org}
              />
            )}

            {currentTab === 'caixa' && currentUser?.permissions?.caixa !== false && (
              <CaixaView 
                appointments={appointments}
                barbers={barbers}
                productSales={productSales}
                org={org}
                setOrg={setOrg as React.Dispatch<React.SetStateAction<Organization>>}
                onNavigateToProducts={() => navigateToTab('produtos')}
                onNavigateToReports={() => navigateToTab('relatorios')}
              />
            )}

            {currentTab === 'produtos' && currentUser?.permissions?.products !== false && (
              <ProductsView
                org={org}
                products={products}
                setProducts={setProducts}
                productSales={productSales}
                setProductSales={setProductSales}
              />
            )}

            {currentTab === 'relatorios' && currentUser?.permissions?.relatorios !== false && (
              <RelatoriosView
                appointments={appointments}
                barbers={barbers}
                productSales={productSales}
              />
            )}

            {currentTab === 'clientes' && currentUser?.permissions?.clientes !== false && (
              <ClientesView 
                clients={clients}
                setClients={setClients}
                appointments={appointments}
                setAppointments={setAppointments}
                org={org}
                setOrg={setOrg as React.Dispatch<React.SetStateAction<Organization>>}
              />
            )}

            {currentTab === 'ajustes' && currentUser?.permissions?.ajustes !== false && (
              <AjustesView 
                initialTab={settingsInitialTab}
                org={org}
                setOrg={setOrg as React.Dispatch<React.SetStateAction<Organization>>}
                services={services}
                setServices={setServices}
                barbers={barbers}
                setBarbers={setBarbers}
                appointments={appointments}
                products={products}
                setProducts={setProducts}
                productSales={productSales}
                setProductSales={setProductSales}
                onLoadDemo={handleLoadDemo}
                onResetAll={handleResetAll}
                currentUser={currentUser}
              />
            )}
            </Suspense>
          </div>

          <div className="px-3 sm:px-6 md:px-8 pb-4 max-w-[1600px] w-full mx-auto">
            <div className="rounded-2xl bg-slate-950/35 border border-slate-800/70 px-4 py-4">
              <AgencyCredit />
            </div>
          </div>
        </div>
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR PARA SMARTPHONE (APP STYLE) */}
      <BottomNav
        currentTab={currentTab}
        setCurrentTab={navigateToTab}
        pendingCount={pendingAppointmentsCount}
        permissions={currentUser?.permissions}
      />

      {/* MODAL DE SINCRONIZAÇÃO ENTRE DISPOSITIVOS */}
      {showSyncModal && (
        <Modal label="Sincronização em Nuvem" onClose={() => setShowSyncModal(false)} className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#121B2E] border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-fadeIn max-h-[90dvh] overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-400" />
                Sincronização em Nuvem
              </h3>
              <button aria-label="Fechar sincronização" onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Sua barbearia está sincronizada com a nuvem: <strong className="text-emerald-400">{org?.name}</strong> (<span className="font-mono">{org?.slug}</span>).
              </p>

              <div className="bg-[#0B1120] p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Como acessar em qualquer celular:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>No celular, acesse a página de login.</li>
                  <li>Digite o e-mail cadastrado e sua senha.</li>
                  <li>O app carrega automaticamente todos os serviços, barbeiros e agendamentos!</li>
                </ol>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopySyncLink}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-98"
                >
                  {copiedSyncLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSyncLink ? 'Link Copiado! Cole no WhatsApp e abra no celular' : 'Copiar Link Seguro de Login'}
                </button>
                {copySyncError && <p role="status">{copySyncError}</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
