import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
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
  ProductSale,
  ServiceCommand,
  WaitlistEntry
} from './types';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { PlatformNotices } from './components/common/PlatformNotices';
import { LoadingState } from './components/common/LoadingState';
import { readStoredArray, safeSetItem } from './utils/storage';
import { motionAllowed } from './utils/motion';
import { setAgendaFocus } from './utils/agendaFocus';
import { OwnerAssistant } from './components/common/OwnerAssistant';
import { bookingSlugFromLocation, isPublicBookingLocation } from './utils/routes';
import { useClipboard } from './hooks/useClipboard';
import { Modal } from './components/common/Modal';

const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const AtendimentosView = lazy(() => import('./views/AtendimentosView').then(m => ({ default: m.AtendimentosView })));
const AgendaView = lazy(() => import('./views/AgendaView').then(m => ({ default: m.AgendaView })));
const CaixaView = lazy(() => import('./views/CaixaView').then(m => ({ default: m.CaixaView })));
const RelatoriosView = lazy(() => import('./views/RelatoriosView').then(m => ({ default: m.RelatoriosView })));
const ProductsView = lazy(() => import('./views/ProductsView').then(m => ({ default: m.ProductsView })));
const ComandasView = lazy(() => import('./views/ComandasView').then(m => ({ default: m.ComandasView })));
const SubscriptionsView = lazy(() => import('./views/SubscriptionsView').then(m => ({ default: m.SubscriptionsView })));
const CampaignsView = lazy(() => import('./views/CampaignsView').then(m => ({ default: m.CampaignsView })));
const ClientesView = lazy(() => import('./views/ClientesView').then(m => ({ default: m.ClientesView })));
const AjustesView = lazy(() => import('./views/AjustesView').then(m => ({ default: m.AjustesView })));
const TenantBookingView = lazy(() => import('./views/TenantBookingView').then(m => ({ default: m.TenantBookingView })));
const TvDisplayView = lazy(() => import('./views/TvDisplayView').then(m => ({ default: m.TvDisplayView })));
const AuthView = lazy(() => import('./views/AuthView').then(m => ({ default: m.AuthView })));
const SuperAdminView = lazy(() => import('./views/SuperAdminView').then(m => ({ default: m.SuperAdminView })));
const LandingView = lazy(() => import('./views/LandingView').then(m => ({ default: m.LandingView })));
const DirectoryView = lazy(() => import('./views/DirectoryView').then(m => ({ default: m.DirectoryView })));
const PrivacyPolicyView = lazy(() => import('./views/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView })));
const TermsOfServiceView = lazy(() => import('./views/TermsOfServiceView').then(m => ({ default: m.TermsOfServiceView })));
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
import { BrandLoader } from './components/common/AppLoader';
import { OnboardingChecklist } from './components/common/OnboardingChecklist';
import { AgencyCredit } from './components/common/AgencyCredit';
import { dedupeClients, upsertClient } from './utils/clients';
import { getAdminAppUrl } from './config/urls';
import { getLocalDateKey } from './utils/scheduling';
import { AppThemeMode, AppThemePreference, applyAppTheme, readStoredAppThemeMode, readStoredAppThemePreference, resolveSystemThemeMode, APP_THEME_STORAGE_KEY } from './config/theme';
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
  COMMANDS: 'agendai_commands',
  WAITLIST: 'agendai_waitlist',
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
  commands: payload.commands || [],
  waitlist: payload.waitlist || [],
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

const ADMIN_TABS: readonly TabType[] = [
  'dashboard', 'atendimentos', 'agenda', 'comandas', 'assinaturas', 'campanhas',
  'caixa', 'clientes', 'produtos', 'relatorios', 'ajustes', 'booking',
];

const getAdminTabFromUrl = (): TabType => {
  const requested = new URLSearchParams(window.location.search).get('tab') as TabType | null;
  return requested && ADMIN_TABS.includes(requested) ? requested : 'dashboard';
};

export default function App() {
  const [ownerAssistantOpen, setOwnerAssistantOpen] = useState(false);
  const isSuperAdminRoute = window.location.pathname.toLowerCase().startsWith('/superadmin');
  const tvSlug = getTvSlugFromUrl();
  const isTvRoute = Boolean(tvSlug);
  const [appThemePreference, setAppThemePreference] = useState<AppThemePreference>(readStoredAppThemePreference);
  const [appThemeMode, setAppThemeModeState] = useState<AppThemeMode>(readStoredAppThemeMode);
  // Retângulo do elemento tocado (card ou botão): a troca de tema nasce dele.
  const lastOriginRef = useRef<{ top: number; right: number; bottom: number; left: number; radius: number }>({
    top: window.innerHeight / 2, left: window.innerWidth / 2, right: window.innerWidth / 2, bottom: window.innerHeight / 2, radius: 0,
  });
  useEffect(() => {
    const remember = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const origin = target?.closest('button, [role="button"], [class*="rounded-"]') as HTMLElement | null;
      if (origin) {
        const rect = origin.getBoundingClientRect();
        const radius = parseFloat(getComputedStyle(origin).borderTopLeftRadius) || 0;
        lastOriginRef.current = {
          top: rect.top,
          left: rect.left,
          right: window.innerWidth - rect.right,
          bottom: window.innerHeight - rect.bottom,
          radius,
        };
      } else {
        const x = event.clientX;
        const y = event.clientY;
        lastOriginRef.current = { top: y, left: x, right: window.innerWidth - x, bottom: window.innerHeight - y, radius: 0 };
      }
    };
    window.addEventListener('pointerdown', remember, { capture: true });
    return () => window.removeEventListener('pointerdown', remember, { capture: true });
  }, []);

  // Atualiza o estado do tema sem bloquear a tela (sem flushSync): a aplicação visual
  // já aconteceu no documento, então a re-renderização pesada não atrasa a animação.
  const appThemeModeRef = useRef<AppThemeMode>(appThemeMode);
  useEffect(() => { appThemeModeRef.current = appThemeMode; }, [appThemeMode]);

  const commitThemeMode = useCallback((next: AppThemeMode) => {
    setAppThemeModeState(next);
    setAppThemePreference(next);
    safeSetItem(APP_THEME_STORAGE_KEY, next);
  }, []);

  const setAppThemeMode = useCallback<React.Dispatch<React.SetStateAction<AppThemeMode>>>((value) => {
    const next = typeof value === 'function' ? value(appThemeModeRef.current) : value;
    const doc = document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || !motionAllowed()) {
      commitThemeMode(next);
      applyAppTheme(next, document.documentElement.style.getPropertyValue('--brand-color') || '#10B981');
      return;
    }
    const o = lastOriginRef.current;
    const transition = doc.startViewTransition(() => {
      // Cores aplicadas direto no documento: custo mínimo, o novo tema aparece já no snapshot.
      applyAppTheme(next, document.documentElement.style.getPropertyValue('--brand-color') || '#10B981');
      commitThemeMode(next);
    });
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `inset(${o.top}px ${o.right}px ${o.bottom}px ${o.left}px round ${o.radius}px)`,
            'inset(0px 0px 0px 0px round 0px)',
          ],
        },
        { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => undefined);
  }, [commitThemeMode]);
  const followSystemTheme = useCallback(() => {
    setAppThemePreference('system');
    safeSetItem(APP_THEME_STORAGE_KEY, 'system');
    setAppThemeModeState(resolveSystemThemeMode());
  }, []);

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

  const [commands, setCommands] = useState<ServiceCommand[]>(() => readStoredArray<ServiceCommand>(STORAGE_KEYS.COMMANDS));

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(() => {
    return readStoredArray<WaitlistEntry>(STORAGE_KEYS.WAITLIST);
  });

  const [isClientRoute, setIsClientRoute] = useState<boolean>(() => {
    return isPublicBookingLocation(window.location);
  });
  const [isDirectoryRoute, setIsDirectoryRoute] = useState<boolean>(() => window.location.pathname.toLowerCase().startsWith('/barbearias'));
  const [publicRouteSlug, setPublicRouteSlug] = useState(getSlugFromUrl);

  const [isLoadingPublicData, setIsLoadingPublicData] = useState<boolean>(() => isClientRoute);
  // A página pública nunca reutiliza os arrays privados do painel, nem em memória.
  const [publicCloudData, setPublicCloudData] = useState<CloudSyncPayload | null>(null);
  const publicOrgData = publicCloudData?.org || null;

  const [currentTab, setCurrentTab] = useState<TabType>(getAdminTabFromUrl);
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
    if (!isClientRoute && !isDirectoryRoute && !isTvRoute && tab !== 'auth') {
      const url = new URL(window.location.href);
      if (tab === 'dashboard') url.searchParams.delete('tab');
      else url.searchParams.set('tab', tab);
      window.history.pushState({ tab }, '', `${url.pathname}${url.search}${url.hash}`);
    }
    setCurrentTab(tab);
    requestAnimationFrame(() => {
      adminScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [isClientRoute, isDirectoryRoute, isTvRoute]);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => typeof window === 'undefined' ? false : localStorage.getItem('agendai_onboarding_dismissed') !== '1');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const { copied: copiedSyncLink, error: copySyncError, copy: copySyncLink } = useClipboard();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
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
  const isCloudPullInFlightRef = useRef(false);
  const skipNextCloudSaveRef = useRef(false);
  const latestPayloadRef = useRef<CloudSyncPayload>({ org, savedOrgs, services, barbers, appointments, clients, notifications, products, productSales, commands, waitlist });
  latestPayloadRef.current = { org, savedOrgs, services, barbers, appointments, clients, notifications, products, productSales, commands, waitlist };
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Refs para acesso livre de stale closures dentro de intervalos de sincronização
  const servicesRef = useRef(services);
  const barbersRef = useRef(barbers);
  const appointmentsRef = useRef(appointments);
  const clientsRef = useRef(clients);
  const productsRef = useRef(products);
  const productSalesRef = useRef(productSales);
  const commandsRef = useRef(commands);
  const waitlistRef = useRef(waitlist);
  const orgRef = useRef(org);
  const notificationBaselineRef = useRef<Map<string, Appointment>>(new Map());
  const notificationBaselineInitializedRef = useRef(false);

  useEffect(() => { servicesRef.current = services; }, [services]);
  useEffect(() => { barbersRef.current = barbers; }, [barbers]);
  useEffect(() => { appointmentsRef.current = appointments; }, [appointments]);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { productSalesRef.current = productSales; }, [productSales]);
  useEffect(() => { commandsRef.current = commands; }, [commands]);
  useEffect(() => { waitlistRef.current = waitlist; }, [waitlist]);
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
    const nextCommands = Array.isArray(cloudData.commands) ? cloudData.commands : [];
    const nextWaitlist = Array.isArray(cloudData.waitlist) ? cloudData.waitlist : [];

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
      commands: nextCommands,
      waitlist: nextWaitlist,
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
    commandsRef.current = nextCommands;
    waitlistRef.current = nextWaitlist;

    setOrg(cloudData.org);
    setSavedOrgs(nextSavedOrgs);
    setServices(nextServices);
    setBarbers(nextBarbers);
    setAppointments(nextAppointments);
    setClients(nextClients);
    setNotifications(mergeNotifications([], nextNotifications));
    setProducts(nextProducts);
    setProductSales(nextProductSales);
    setCommands(nextCommands);
    setWaitlist(nextWaitlist);
    if (cloudData.current_user) { setCurrentUser(cloudData.current_user); localStorage.setItem('agendai_current_user', JSON.stringify(cloudData.current_user)); }

    if (!notificationBaselineInitializedRef.current) {
      notificationBaselineRef.current = new Map(nextAppointments.map((appointment) => [appointment.id, { ...appointment }]));
      notificationBaselineInitializedRef.current = true;
    }

    safeSetItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(cloudData.org));
    safeSetItem(STORAGE_KEYS.ALL_ORGS, JSON.stringify(nextSavedOrgs));
    safeSetItem(STORAGE_KEYS.SERVICES, JSON.stringify(nextServices));
    safeSetItem(STORAGE_KEYS.BARBERS, JSON.stringify(nextBarbers));
    safeSetItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(nextAppointments));
    safeSetItem(STORAGE_KEYS.CLIENTS, JSON.stringify(nextClients));
    safeSetItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(mergeNotifications([], nextNotifications)));
    safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextProducts));
    safeSetItem(STORAGE_KEYS.PRODUCT_SALES, JSON.stringify(nextProductSales));
    safeSetItem(STORAGE_KEYS.COMMANDS, JSON.stringify(nextCommands));
    safeSetItem(STORAGE_KEYS.WAITLIST, JSON.stringify(nextWaitlist));
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

  // A interface usa somente os modos globais claro e escuro. A barbearia pode
  // personalizar apenas a cor das ações principais, sem afetar fundos e cards.
  useEffect(() => {
    // Landing e diretório são experiências da plataforma, com tema único para clientes.
    // Apenas a página de uma barbearia pode usar sua cor principal nos destaques.
    const themedOrg = isClientRoute ? publicOrgData : (isDirectoryRoute || !isLoggedIn ? null : org);
    applyAppTheme(appThemeMode, themedOrg?.primary_color || '#10B981');
  }, [appThemeMode, org, publicOrgData, isClientRoute, isDirectoryRoute]);

  // No modo automático, acompanha a preferência do sistema inclusive quando ela
  // muda enquanto o aplicativo está aberto.
  useEffect(() => {
    if (appThemePreference !== 'system' || typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateFromSystem = () => setAppThemeModeState(media.matches ? 'dark' : 'light');
    updateFromSystem();
    media.addEventListener('change', updateFromSystem);
    return () => media.removeEventListener('change', updateFromSystem);
  }, [appThemePreference]);

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
      setIsDirectoryRoute(window.location.pathname.toLowerCase().startsWith('/barbearias'));
      if (!isPublicBookingLocation(window.location) && !window.location.pathname.toLowerCase().startsWith('/barbearias')) {
        setCurrentTab(getAdminTabFromUrl());
      }
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
      commands,
      waitlist,
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
            broadcastChannelRef.current.postMessage({ type: 'COMMANDS_SYNC', payload: synced.commands || [], tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'WAITLIST_SYNC', payload: synced.waitlist || [], tenant: tenantKeyForOrg(synced.org) });
            broadcastChannelRef.current.postMessage({ type: 'ORG_SYNC', payload: synced.org, tenant: tenantKeyForOrg(synced.org) });
          } catch (e) {}
        }
      };
      saveQueueRef.current = saveQueueRef.current.then(save, save);
    }, 500);

    return () => clearTimeout(timer);
  }, [services, barbers, appointments, clients, notifications, products, productSales, commands, waitlist, org, savedOrgs, isLoggedIn, isClientRoute, isTvRoute, applyPrivateCloudData, reconcileAfterCloudConflict]);

  // 4. SINCRONIZAÇÃO ENTRE APARELHOS: consulta leve e atualização imediata
  // ao abrir, recuperar a conexão ou voltar para o aplicativo.
  useEffect(() => {
    if (!isSessionValidated || !isInitialLoadDone.current || !isLoggedIn || isClientRoute || isTvRoute) return;

    const syncLiveCloud = async () => {
      if (isManualSyncing || document.visibilityState === 'hidden' || isCloudPullInFlightRef.current) return;
      const hasPendingEdits = () => isCloudHydratedRef.current && cloudPayloadFingerprint(latestPayloadRef.current) !== lastSavedCloudFingerprintRef.current;
      if (hasPendingEdits()) return;

      const targetIdentifier = orgRef.current?.email || orgRef.current?.slug;
      if (!targetIdentifier) return;

      isCloudPullInFlightRef.current = true;
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
      } catch (e) {
      } finally {
        isCloudPullInFlightRef.current = false;
      }
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncLiveCloud();
    };

    void syncLiveCloud();
    const interval = setInterval(syncLiveCloud, 5_000);
    window.addEventListener('focus', syncLiveCloud);
    window.addEventListener('online', syncLiveCloud);
    window.addEventListener('pageshow', syncLiveCloud);
    document.addEventListener('visibilitychange', syncWhenVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncLiveCloud);
      window.removeEventListener('online', syncLiveCloud);
      window.removeEventListener('pageshow', syncLiveCloud);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [isManualSyncing, isLoggedIn, isSessionValidated, isClientRoute, isTvRoute, applyPrivateCloudData]);

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
          } else if (type === 'COMMANDS_SYNC' && Array.isArray(payload)) {
            setCommands(payload);
          } else if (type === 'WAITLIST_SYNC' && Array.isArray(payload)) {
            setWaitlist(payload);
          } else if (type === 'NEW_WAITLIST_ENTRY' && payload) {
            setWaitlist(prev => {
              const exists = prev.some(w => w.id === payload.id);
              if (exists) return prev;
              return [payload, ...prev];
            });
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

  // Persistência local segura contra estouro de cota
  useEffect(() => {
    if (org && !isClientRoute) safeSetItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(org));
  }, [org, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.ALL_ORGS, JSON.stringify(savedOrgs));
  }, [savedOrgs, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.AUTH_SESSION, isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  }, [services, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.BARBERS, JSON.stringify(barbers));
  }, [barbers, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  }, [appointments, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }, [clients, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.PRODUCT_SALES, JSON.stringify(productSales));
  }, [productSales, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.COMMANDS, JSON.stringify(commands));
  }, [commands, isClientRoute]);

  useEffect(() => {
    if (!isClientRoute) safeSetItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlist));
  }, [waitlist, isClientRoute]);

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

  // Fecha o consumo sem duplicar faturamento: serviços tornam-se atendimento
  // concluído e produtos tornam-se venda de estoque, ambos já lidos pelo Caixa.
  const handleCloseCommand = useCallback((command: ServiceCommand) => {
    if (!org || command.status !== 'closed') return;
    const now = new Date();
    const nowIso = command.closed_at || now.toISOString();
    const date = getLocalDateKey(now);
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const serviceTotal = command.service_items.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const productTotal = command.product_items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const payment = command.payment_method || 'pix';
    setCommands(current => current.map(item => item.id === command.id ? command : item));
    if (serviceTotal > 0) {
      const appointmentId = command.linked_appointment_id || `cmd-service-${command.id}`;
      const serviceAppointment: Appointment = {
        id: appointmentId, org_id: org.id, client_name: command.client_name, client_phone: command.client_phone || '',
        service_id: command.service_items[0]?.service_id, service_name: command.service_items.map(item => item.name).join(' + '),
        services: command.service_items.map(item => ({ id: item.service_id, name: item.name, price: item.price, duration_minutes: item.duration_minutes })),
        duration_minutes: command.service_items.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0),
        barber_id: command.barber_id || '', barber_name: command.barber_name || 'Não informado', start_time: time,
        price: serviceTotal, status: 'completed', payment_method: payment, date, created_at: nowIso,
      };
      setAppointments(current => current.some(item => item.id === appointmentId) ? current.map(item => item.id === appointmentId ? { ...item, ...serviceAppointment } : item) : [serviceAppointment, ...current]);
      setClients(current => upsertClient(current, { name: command.client_name, phone: command.client_phone || '', org_id: org.id, visitDelta: 1, spentDelta: serviceTotal, lastVisit: 'Hoje' }).map(client => client.phone === command.client_phone || (!command.client_phone && client.name === command.client_name) ? { ...client, loyalty_points: Number(client.loyalty_points || 0) + 10 } : client));
    }
    if (productTotal > 0) {
      const saleId = `cmd-product-${command.id}`;
      setProductSales(current => current.some(item => item.id === saleId) ? current : [{ id: saleId, org_id: org.id, origin: 'internal', status: 'completed', items: command.product_items, total: productTotal, customer_name: command.client_name, customer_phone: command.client_phone, payment_method: payment, date, time, created_at: nowIso, completed_at: nowIso }, ...current]);
      setProducts(current => current.map(product => { const sold = command.product_items.find(item => item.product_id === product.id); return sold ? { ...product, stock: Math.max(0, Number(product.stock || 0) - Number(sold.quantity || 0)) } : product; }));
    }
  }, [org]);

  const handleOpenAppointmentCommand = useCallback((appointment: Appointment) => {
    if (!org) return;
    const existing = commands.find(command => command.linked_appointment_id === appointment.id && command.status === 'open');
    if (!existing) {
      const serviceItems = appointment.services?.length
        ? appointment.services.map(service => ({ service_id: service.id, name: service.name, price: Number(service.price || 0), duration_minutes: Number(service.duration_minutes || 30) }))
        : [{ service_id: appointment.service_id || `legacy-${appointment.id}`, name: appointment.service_name, price: Number(appointment.price || 0), duration_minutes: Number(appointment.duration_minutes || 30) }];
      setCommands(current => [{
        id: `cmd-${appointment.id}`, org_id: org.id, status: 'open', client_name: appointment.client_name,
        client_phone: appointment.client_phone || undefined, barber_id: appointment.barber_id || undefined, barber_name: appointment.barber_name || undefined,
        service_items: serviceItems, product_items: [], linked_appointment_id: appointment.id, opened_at: new Date().toISOString(),
      }, ...current]);
    }
    navigateToTab('comandas');
  }, [commands, navigateToTab, org]);

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
    localStorage.removeItem(STORAGE_KEYS.COMMANDS);
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
    setCommands([]);
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
      commands: [],
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
    setCommands([]);
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

  const isPrivacyRoute = typeof window !== 'undefined' && (window.location.pathname.toLowerCase().startsWith('/privacidade') || window.location.hash.toLowerCase().includes('privacidade'));
  const isTermsRoute = typeof window !== 'undefined' && (window.location.pathname.toLowerCase().startsWith('/termos') || window.location.hash.toLowerCase().includes('termos'));

  if (isPrivacyRoute) {
    return <PrivacyPolicyView />;
  }

  if (isTermsRoute) {
    return <TermsOfServiceView />;
  }

  // SUPER ADMIN AGÊNCIA G7 (rota isolada do painel de cada estabelecimento)
  if (isSuperAdminRoute) {
    return <SuperAdminView />;
  }

  // 0. MODO TV / PAINEL DE RECEPÇÃO (PÚBLICO E SOMENTE LEITURA)
  if (isTvRoute && tvSlug) {
    return <TvDisplayView slug={tvSlug} />;
  }

  // Diretório público: não exige sessão e só recebe campos aprovados pelo endpoint.
  if (isDirectoryRoute) {
    return <DirectoryView appThemeMode={appThemeMode} onThemeModeChange={setAppThemeMode} />;
  }

  // 1. ROTA PÚBLICA DE AGENDAMENTO DO CLIENTE (MOBILE-FIRST)
  if (isClientRoute || currentTab === 'booking') {
    if (isLoadingPublicData) {
      return (
        <div className="app-loading-screen min-h-[60dvh] safe-screen bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-xs space-y-6">
            <BrandLoader size={72} />
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">Preparando sua agenda</h3>
              <p className="text-xs text-slate-400">Buscando serviços, equipe e horários.</p>
            </div>
            <AgencyCredit centered compact className="pt-2 border-0" />
          </div>
        </div>
      );
    }

    if (!currentPublicOrg) {
      return (
        <div className="app-loading-screen min-h-[60dvh] safe-screen bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-sm space-y-5">
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
      <main className="booking-public-shell min-h-screen safe-screen bg-[#070B14] text-slate-100 font-sans p-3 sm:p-6 flex items-center justify-center">
        <TenantBookingView 
          org={currentPublicOrg}
          services={isClientRoute ? publicCloudData?.services || [] : services}
          barbers={isClientRoute ? publicCloudData?.barbers || [] : barbers}
          appointments={isClientRoute ? publicCloudData?.appointments || [] : appointments}
          products={isClientRoute ? publicCloudData?.products || [] : products}
          onProductsChanged={isClientRoute ? items => setPublicCloudData(current => current ? { ...current, products: items } : current) : setProducts}
          onAddAppointment={handleAddAppointment}
          onAddWaitlist={(entry) => setWaitlist(prev => [entry, ...prev])}
          onBackToAdmin={isLoggedIn && org ? () => {
            if (isClientRoute) {
              window.location.assign(getAdminAppUrl('/'));
              return;
            }
            setIsClientRoute(false);
            setCurrentTab('dashboard');
          } : undefined}
          isStandalone={isClientRoute}
          appThemeMode={appThemeMode}
          onThemeModeChange={setAppThemeMode}
        />
      </main>
    );
  }

  // Valida o token no servidor antes de liberar qualquer tela administrativa.
  if (isLoggedIn && org && !isSessionValidated) {
    return (
      <div className="app-loading-screen min-h-[60dvh] safe-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center space-y-5">
          <BrandLoader size={72} label="Validando sua sessão" />
          <p className="text-xs text-slate-400">Autenticando seu acesso com segurança.</p>
        </div>
      </div>
    );
  }

  // 2. TELA DE AUTENTICAÇÃO (ACESSO RESTRITO - LOGIN OBRIGATÓRIO)
  if (!isLoggedIn || !org) {
    if (authEntry === 'landing') {
      return <LandingView onLogin={() => openAuthEntry('login')} onRegister={() => openAuthEntry('register')} appThemeMode={appThemeMode} onThemeModeChange={setAppThemeMode} />;
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
                  navigateToTab('agenda');
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
          syncTone={!isOnline ? 'offline' : syncStatusMsg.startsWith('⚠️') ? 'warn' : syncStatusMsg.startsWith('✅') ? 'saved' : 'ok'}
          onLogout={handleLogout}
          clients={clients}
          appointments={appointments}
          barbers={barbers}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNavigate={navigateToTab}
          assistantOpen={ownerAssistantOpen}
          onAssistantToggle={() => setOwnerAssistantOpen((open) => !open)}
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
                onNavigateToAgenda={(appointmentId) => { if (appointmentId) setAgendaFocus(appointmentId); navigateToTab('agenda'); }}
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
                setClients={setClients}
                onOpenCommand={handleOpenAppointmentCommand}
              />
            )}

            {currentTab === 'agenda' && currentUser?.permissions?.agenda !== false && (
              <AgendaView 
                appointments={appointments}
                setAppointments={setAppointments}
                barbers={barbers}
                services={services}
                org={org}
                setOrg={setOrg as React.Dispatch<React.SetStateAction<Organization>>}
                waitlist={waitlist}
                setWaitlist={setWaitlist}
              />
            )}

            {currentTab === 'comandas' && currentUser?.permissions?.caixa !== false && (
              <ComandasView org={org} commands={commands} setCommands={setCommands} services={services} products={products} clients={clients} barbers={barbers} onCloseCommand={handleCloseCommand} />
            )}

            {currentTab === 'assinaturas' && currentUser?.permissions?.ajustes !== false && (
              <SubscriptionsView org={org} setOrg={setOrg as React.Dispatch<React.SetStateAction<Organization>>} clients={clients} />
            )}
            {currentTab === 'campanhas' && currentUser?.permissions?.clientes !== false && <CampaignsView clients={clients} appointments={appointments} org={org} />}

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
                appThemeMode={appThemeMode}
                setAppThemeMode={setAppThemeMode}
                appThemePreference={appThemePreference}
                followSystemTheme={followSystemTheme}
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

      <OwnerAssistant open={ownerAssistantOpen} onOpenChange={setOwnerAssistantOpen} onNavigate={navigateToTab} />

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
