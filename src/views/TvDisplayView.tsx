import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Clock3,
  MapPin,
  Maximize2,
  Music2,
  Phone,
  QrCode,
  Scissors,
  Sparkles,
  UsersRound,
  WifiOff,
  Volume2,
  VolumeX,
  BellRing,
  ShoppingBag,
  Headphones,
} from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { Organization } from '../types';
import { getClientBookingUrl } from '../config/urls';
import { getReadableTextColor } from '../utils/color';
import { gsap, MOTION_ALLOWED_QUERY, useGSAP } from '../utils/motion';

type TvAppointment = {
  id: string;
  client_name: string;
  service_name: string;
  barber_name: string;
  barber_id: string;
  start_time: string;
  duration_minutes?: number;
  status: 'scheduled' | 'confirmed' | 'arrived' | 'in_progress' | 'completed';
  price?: number;
};

type TvProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string;
  stock?: number;
};

type TvBarber = {
  id: string;
  full_name: string;
  role?: string;
  avatar_url?: string;
};

type TvPayload = {
  enabled: boolean;
  org: Organization;
  appointments: TvAppointment[];
  barbers: TvBarber[];
  products?: TvProduct[];
  updated_at?: string;
  business_date?: string;
  business_minutes?: number;
  server_time?: string;
};

interface TvDisplayViewProps {
  slug: string;
}

const minutesFromTime = (value: string): number => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const getYouTubeEmbedUrl = (input?: string): string => {
  const raw = String(input || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const playlistId = url.searchParams.get('list');
    if (playlistId) {
      return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&autoplay=1&loop=1&controls=0&rel=0&modestbranding=1&fs=0&playsinline=1&disablekb=1&iv_load_policy=3`;
    }

    let videoId = url.searchParams.get('v') || '';
    if (!videoId && url.hostname.includes('youtu.be')) videoId = url.pathname.replace(/^\//, '').split('/')[0] || '';
    if (!videoId && url.pathname.includes('/embed/')) videoId = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
    if (!videoId && url.pathname.includes('/shorts/')) videoId = url.pathname.split('/shorts/')[1]?.split('/')[0] || '';

    if (videoId) {
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&loop=1&controls=0&playlist=${encodeURIComponent(videoId)}&rel=0&modestbranding=1&fs=0&playsinline=1&disablekb=1&iv_load_policy=3`;
    }
  } catch {
    // Aceita também ID simples de playlist ou vídeo.
  }

  if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) {
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(raw)}&autoplay=1&loop=1&controls=0&rel=0&modestbranding=1&fs=0&playsinline=1&disablekb=1&iv_load_policy=3`;
  }
  if (/^[A-Za-z0-9_-]{8,15}$/.test(raw)) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(raw)}?autoplay=1&loop=1&controls=0&playlist=${encodeURIComponent(raw)}&rel=0&modestbranding=1&fs=0&playsinline=1&disablekb=1&iv_load_policy=3`;
  }
  return '';
};

const getSpotifyEmbedUrl = (input?: string): string => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!url.hostname.includes('spotify.com')) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed') return url.toString();
    const allowed = ['playlist', 'album', 'track', 'artist', 'show', 'episode'];
    const typeIndex = parts.findIndex((part) => allowed.includes(part));
    if (typeIndex >= 0 && parts[typeIndex + 1]) {
      return `https://open.spotify.com/embed/${parts[typeIndex]}/${encodeURIComponent(parts[typeIndex + 1])}?utm_source=generator&theme=0`;
    }
  } catch {
    return '';
  }
  return '';
};

const getAppleMusicEmbedUrl = (input?: string): string => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!url.hostname.includes('music.apple.com') && !url.hostname.includes('embed.music.apple.com')) return '';
    if (url.hostname.includes('embed.music.apple.com')) return url.toString();
    return `https://embed.music.apple.com${url.pathname}${url.search}`;
  } catch {
    return '';
  }
};

const getSafeAudioUrl = (input?: string): string => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const formatPhone = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  return value || '';
};


type TvSoundStyle = 'bell' | 'soft' | 'attention';

const playNotificationTone = async (
  contextRef: React.MutableRefObject<AudioContext | null>,
  style: TvSoundStyle,
  volumePercent: number,
): Promise<void> => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = contextRef.current || new AudioCtx();
    contextRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    const volume = Math.min(1, Math.max(0, volumePercent / 100));
    const baseGain = Math.max(0.001, 0.72 * volume);
    const now = ctx.currentTime + 0.015;

    const tones = style === 'soft'
      ? [
          { frequency: 659.25, start: 0, duration: 0.22, gain: 0.65 },
          { frequency: 783.99, start: 0.14, duration: 0.34, gain: 0.5 },
        ]
      : style === 'attention'
        ? [
            { frequency: 740, start: 0, duration: 0.16, gain: 0.85 },
            { frequency: 740, start: 0.22, duration: 0.16, gain: 0.85 },
            { frequency: 987.77, start: 0.46, duration: 0.3, gain: 0.7 },
          ]
        : [
            { frequency: 880, start: 0, duration: 0.24, gain: 0.9 },
            { frequency: 1318.51, start: 0.12, duration: 0.5, gain: 0.6 },
          ];

    tones.forEach((tone) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = style === 'soft' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(tone.frequency, now + tone.start);
      gain.gain.setValueAtTime(baseGain * tone.gain, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + tone.start);
      oscillator.stop(now + tone.start + tone.duration + 0.03);
    });
  } catch {
    // Alguns navegadores de Smart TV não disponibilizam Web Audio.
  }
};

const TV_SOUND_FILES: Record<TvSoundStyle, string> = {
  bell: '/sounds/tv-bell.wav?v=193',
  soft: '/sounds/tv-soft.wav?v=193',
  attention: '/sounds/tv-attention.wav?v=193',
};

const playTvNotificationSound = async (
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  contextRef: React.MutableRefObject<AudioContext | null>,
  style: TvSoundStyle,
  volumePercent: number,
): Promise<void> => {
  const volume = Math.min(1, Math.max(0, volumePercent / 100));

  try {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
    }

    const soundPath = TV_SOUND_FILES[style] || TV_SOUND_FILES.bell;
    const currentPath = audio.getAttribute('src') || '';
    if (currentPath !== soundPath) audio.src = soundPath;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    await audio.play();
    return;
  } catch {
    // Fallback para navegadores/Smart TVs que não reproduzem WAV pelo elemento <audio>.
  }

  await playNotificationTone(contextRef, style, Math.max(volumePercent, 85));
};

export const TvDisplayView: React.FC<TvDisplayViewProps> = ({ slug }) => {
  const [payload, setPayload] = useState<TvPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [newBookingAlert, setNewBookingAlert] = useState<TvAppointment | null>(null);
  const [statusPulseId, setStatusPulseId] = useState<string>('');
  const [productPage, setProductPage] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const directMediaAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundUnlockedRef = useRef(false);
  const seenAppointmentIdsRef = useRef<Set<string> | null>(null);
  const statusSnapshotRef = useRef<Map<string, TvAppointment['status']> | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const tvRootRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  const requestTvWakeLock = useCallback(async () => {
    try {
      const wakeLockApi = (navigator as any).wakeLock;
      if (!wakeLockApi || document.visibilityState !== 'visible') return;
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      wakeLockRef.current = await wakeLockApi.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Smart TVs antigas podem não implementar Screen Wake Lock.
    }
  }, []);

  useEffect(() => {
    soundUnlockedRef.current = soundUnlocked;
  }, [soundUnlocked]);

  const fetchTv = useCallback(async () => {
    try {
      const response = await fetch(`/api/tv?slug=${encodeURIComponent(slug)}&_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
      });
      if (!response.ok) throw new Error('Não foi possível atualizar a TV.');
      const data = await response.json() as TvPayload;

      const currentIds = new Set((data.appointments || []).map((item) => item.id));
      const previousStatuses = statusSnapshotRef.current;
      const nextStatuses = new Map((data.appointments || []).map((item) => [item.id, item.status] as const));
      if (previousStatuses) {
        const changed = (data.appointments || []).find((item) => previousStatuses.get(item.id) && previousStatuses.get(item.id) !== item.status);
        if (changed) {
          setStatusPulseId(changed.id);
          if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
          statusTimerRef.current = window.setTimeout(() => setStatusPulseId(''), 4200);
        }
      }
      statusSnapshotRef.current = nextStatuses;

      const seenIds = seenAppointmentIdsRef.current;
      if (seenIds === null) {
        // Na primeira carga apenas memoriza os agendamentos existentes, sem tocar aviso antigo.
        seenAppointmentIdsRef.current = new Set(currentIds);
      } else {
        const newItems = (data.appointments || []).filter((item) => !seenIds.has(item.id));
        currentIds.forEach((id) => seenIds.add(id));

        if (newItems.length > 0) {
          const latest = newItems[newItems.length - 1];
          setNewBookingAlert(latest);
          if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
          alertTimerRef.current = window.setTimeout(() => setNewBookingAlert(null), 7000);

          if (data.org?.tv_sound_enabled !== false && soundUnlockedRef.current) {
            void playTvNotificationSound(
              notificationAudioRef,
              audioContextRef,
              (data.org.tv_sound_style || 'bell') as TvSoundStyle,
              Number(data.org.tv_sound_volume ?? 70),
            );
          }
        }
      }

      setPayload(data);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void fetchTv();
    const poll = window.setInterval(() => void fetchTv(), 15_000);
    return () => window.clearInterval(poll);
  }, [fetchTv]);

  useEffect(() => {
    const reclaimTvFocus = () => {
      window.setTimeout(() => {
        try {
          tvRootRef.current?.focus({ preventScroll: true });
        } catch {
          tvRootRef.current?.focus();
        }
      }, 80);
    };

    const restoreTvSession = () => {
      if (document.visibilityState === 'visible') {
        void requestTvWakeLock();
        reclaimTvFocus();
        void fetchTv();
      }
    };

    void requestTvWakeLock();
    reclaimTvFocus();
    document.addEventListener('visibilitychange', restoreTvSession);
    window.addEventListener('pageshow', restoreTvSession);
    window.addEventListener('focus', restoreTvSession);
    window.addEventListener('blur', reclaimTvFocus);

    return () => {
      document.removeEventListener('visibilitychange', restoreTvSession);
      window.removeEventListener('pageshow', restoreTvSession);
      window.removeEventListener('focus', restoreTvSession);
      window.removeEventListener('blur', reclaimTvFocus);
      try {
        void wakeLockRef.current?.release?.();
      } catch {
        // noop
      }
      wakeLockRef.current = null;
    };
  }, [fetchTv, requestTvWakeLock]);

  // Alguns navegadores de Smart TV promovem o iframe de vídeo para uma camada
  // de hardware separada após alguns minutos e deixam de compor o restante do DOM.
  // Este watchdog mantém a página inteira em composição ativa e recupera o painel
  // caso a TV tente entrar em um modo de vídeo isolado/descanso.
  useEffect(() => {
    const keepTvComposed = () => {
      if (document.visibilityState !== 'visible') return;

      void requestTvWakeLock();

      try {
        window.scrollTo(0, 0);
        tvRootRef.current?.focus({ preventScroll: true });
      } catch {
        tvRootRef.current?.focus();
      }
    };

    keepTvComposed();
    const compositorWatchdog = window.setInterval(keepTvComposed, 12000);

    const recoverFromFullscreen = () => {
      const fullscreenElement = document.fullscreenElement;
      if (fullscreenElement && fullscreenElement !== document.documentElement && fullscreenElement !== tvRootRef.current) {
        void document.exitFullscreen?.().catch?.(() => undefined);
      }
      keepTvComposed();
    };

    document.addEventListener('fullscreenchange', recoverFromFullscreen);
    document.addEventListener('webkitfullscreenchange', recoverFromFullscreen as EventListener);

    return () => {
      window.clearInterval(compositorWatchdog);
      document.removeEventListener('fullscreenchange', recoverFromFullscreen);
      document.removeEventListener('webkitfullscreenchange', recoverFromFullscreen as EventListener);
    };
  }, [requestTvWakeLock]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);


  useEffect(() => () => {
    if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    if (notificationAudioRef.current) {
      notificationAudioRef.current.pause();
      notificationAudioRef.current.src = '';
    }
    void audioContextRef.current?.close().catch(() => undefined);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = payload?.org?.primary_color || '#18d4c8';
    root.style.setProperty('--brand-color', primaryColor);
    root.style.setProperty('--brand-contrast-color', getReadableTextColor(primaryColor));
    root.style.setProperty('--app-bg-color', payload?.org?.background_color || '#061120');
    root.style.setProperty('--app-surface-color', payload?.org?.surface_color || '#0d1930');
  }, [payload]);

  const activeAppointments = useMemo(() => {
    return (payload?.appointments || [])
      .filter((item) => item.status !== 'completed')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [payload]);

  // Na TV, um novo agendamento precisa ficar visível imediatamente, mesmo quando
  // existem mais de cinco clientes na fila e o novo horário está no fim do dia.
  const visibleAppointments = useMemo(() => {
    const firstFive = activeAppointments.slice(0, 5);
    if (!newBookingAlert || newBookingAlert.status === 'completed') return firstFive;
    if (firstFive.some((item) => item.id === newBookingAlert.id)) return firstFive;
    return [newBookingAlert, ...firstFive.slice(0, 4)];
  }, [activeAppointments, newBookingAlert]);

  const currentMinutes = Number.isFinite(payload?.business_minutes) ? Number(payload?.business_minutes) : (now.getHours() * 60 + now.getMinutes());
  const nextScheduledId = useMemo(() => {
    const arrived = activeAppointments.find((item) => item.status === 'arrived');
    if (arrived) return arrived.id;
    const waiting = activeAppointments.filter((item) => item.status === 'scheduled' || item.status === 'confirmed');
    const future = waiting.find((item) => minutesFromTime(item.start_time) >= currentMinutes);
    return future?.id || waiting[0]?.id || '';
  }, [activeAppointments, currentMinutes]);

  const inProgressAppointment = useMemo(
    () => activeAppointments.find((item) => item.status === 'in_progress') || null,
    [activeAppointments],
  );

  const nextAppointment = useMemo(
    () => activeAppointments.find((item) => item.id === nextScheduledId) || null,
    [activeAppointments, nextScheduledId],
  );

  const compactQueue = useMemo(() => {
    const rest = activeAppointments.filter((item) => item.id !== inProgressAppointment?.id && item.id !== nextAppointment?.id);
    const firstThree = rest.slice(0, 3);
    if (!newBookingAlert || newBookingAlert.status === 'completed') return firstThree;
    if (newBookingAlert.id === inProgressAppointment?.id || newBookingAlert.id === nextAppointment?.id) return firstThree;
    const newest = rest.find((item) => item.id === newBookingAlert.id);
    if (!newest || firstThree.some((item) => item.id === newest.id)) return firstThree;
    return [newest, ...firstThree.slice(0, 2)];
  }, [activeAppointments, inProgressAppointment?.id, nextAppointment?.id, newBookingAlert]);

  const waitingCount = useMemo(
    () => activeAppointments.filter((item) => item.status === 'scheduled' || item.status === 'confirmed' || item.status === 'arrived').length,
    [activeAppointments],
  );

  const minutesUntilNext = nextAppointment ? minutesFromTime(nextAppointment.start_time) - currentMinutes : null;
  const nextTimeLabel = minutesUntilNext === null
    ? 'Sem próximo horário'
    : minutesUntilNext <= 0
      ? 'Horário atual'
      : minutesUntilNext === 1
        ? 'Em 1 minuto'
        : `Em ${minutesUntilNext} minutos`;

  const handleToggleSound = async () => {
    if (soundUnlocked) {
      directMediaAudioRef.current?.pause();
      setSoundUnlocked(false);
      return;
    }

    setSoundUnlocked(true);
    soundUnlockedRef.current = true;

    // O clique do usuário libera o autoplay bloqueado pelos navegadores de Smart TV.
    // Em modo rádio, inicia o stream no mesmo gesto usado para ativar o som.
    if (directMediaAudioRef.current) {
      directMediaAudioRef.current.volume = Math.min(1, Math.max(0, Number(payload?.org?.tv_sound_volume ?? 70) / 100));
      try {
        await directMediaAudioRef.current.play();
        return;
      } catch {
        // Mantém o fallback da campainha caso o stream esteja indisponível.
      }
    }

    await playTvNotificationSound(
      notificationAudioRef,
      audioContextRef,
      (payload?.org?.tv_sound_style || 'bell') as TvSoundStyle,
      Number(payload?.org?.tv_sound_volume ?? 70),
    );
  };

  const handleTestSound = async () => {
    soundUnlockedRef.current = true;
    setSoundUnlocked(true);
    await playTvNotificationSound(
      notificationAudioRef,
      audioContextRef,
      (payload?.org?.tv_sound_style || 'bell') as TvSoundStyle,
      Number(payload?.org?.tv_sound_volume ?? 70),
    );
  };

  const mediaType = payload?.org?.tv_media_type || (payload?.org?.tv_youtube_url ? 'youtube' : 'institutional');
  const mediaSourceUrl = payload?.org?.tv_media_url || payload?.org?.tv_youtube_url || '';
  const visualMode = payload?.org?.tv_visual_mode || (mediaType === 'institutional' ? 'brand_products_queue' : 'player_queue');
  const animationsEnabled = payload?.org?.tv_animations !== false;
  const youtubeEmbedUrl = useMemo(() => mediaType === 'youtube' ? getYouTubeEmbedUrl(mediaSourceUrl) : '', [mediaType, mediaSourceUrl]);
  const spotifyEmbedUrl = useMemo(() => mediaType === 'spotify' ? getSpotifyEmbedUrl(mediaSourceUrl) : '', [mediaType, mediaSourceUrl]);
  const appleMusicEmbedUrl = useMemo(() => mediaType === 'apple_music' ? getAppleMusicEmbedUrl(mediaSourceUrl) : '', [mediaType, mediaSourceUrl]);
  const directAudioUrl = useMemo(() => mediaType === 'audio' ? getSafeAudioUrl(mediaSourceUrl) : '', [mediaType, mediaSourceUrl]);
  const products = useMemo(() => (payload?.products || []).filter((item) => item && item.price >= 0), [payload?.products]);
  const hasMediaPlayer = Boolean(youtubeEmbedUrl || spotifyEmbedUrl || appleMusicEmbedUrl || directAudioUrl);
  const showMediaProductsLayout = visualMode === 'brand_products_queue' && mediaType !== 'institutional' && hasMediaPlayer;
  const showBrandStage = mediaType === 'institutional' || visualMode === 'brand_queue';
  const showProductsOnStage = visualMode === 'brand_products_queue' && products.length > 0;
  const productPageSize = 3;
  const productPageCount = Math.max(1, Math.ceil(products.length / productPageSize));
  const featuredProducts = useMemo(() => {
    if (!showProductsOnStage) return [];
    const start = (productPage % productPageCount) * productPageSize;
    return products.slice(start, start + productPageSize);
  }, [products, productPage, productPageCount, showProductsOnStage]);

  useEffect(() => {
    if (!animationsEnabled || !showProductsOnStage || productPageCount <= 1) {
      setProductPage(0);
      return;
    }
    const timer = window.setInterval(() => setProductPage((value) => (value + 1) % productPageCount), 8000);
    return () => window.clearInterval(timer);
  }, [animationsEnabled, showProductsOnStage, productPageCount]);

  useGSAP(() => {
    if (!payload?.enabled || !animationsEnabled) return;
    const media = gsap.matchMedia();
    media.add(MOTION_ALLOWED_QUERY, () => {
      gsap.from('[data-tv-shell-section]', {
        autoAlpha: 0,
        y: 18,
        duration: 0.65,
        stagger: 0.075,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      });
    });
    return () => media.revert();
  }, { scope: tvRootRef, dependencies: [Boolean(payload?.enabled), animationsEnabled], revertOnUpdate: true });

  useGSAP(() => {
    if (!newBookingAlert || !animationsEnabled) return;
    const media = gsap.matchMedia();
    media.add(MOTION_ALLOWED_QUERY, () => {
      const alert = tvRootRef.current?.querySelector('[data-tv-booking-alert]');
      if (!alert) return;
      return gsap.fromTo(alert,
        { autoAlpha: 0, y: -28, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.52, ease: 'back.out(1.45)', clearProps: 'opacity,visibility,transform' },
      );
    });
    return () => media.revert();
  }, { scope: tvRootRef, dependencies: [newBookingAlert?.id, animationsEnabled], revertOnUpdate: true });

  useGSAP(() => {
    if (!statusPulseId || !animationsEnabled) return;
    const media = gsap.matchMedia();
    media.add(MOTION_ALLOWED_QUERY, () => {
      const targets = Array.from(tvRootRef.current?.querySelectorAll<HTMLElement>('[data-tv-appointment-id]') || [])
        .filter((element) => element.dataset.tvAppointmentId === statusPulseId);
      if (!targets.length) return;
      return gsap.fromTo(targets,
        { scale: 0.975, boxShadow: '0 0 0 rgba(34,211,238,0)' },
        { scale: 1, boxShadow: '0 0 36px rgba(34,211,238,.22)', duration: 0.7, ease: 'power2.out', clearProps: 'transform,boxShadow' },
      );
    });
    return () => media.revert();
  }, { scope: tvRootRef, dependencies: [statusPulseId, animationsEnabled], revertOnUpdate: true });

  useGSAP(() => {
    if (!animationsEnabled || featuredProducts.length === 0) return;
    const media = gsap.matchMedia();
    media.add(MOTION_ALLOWED_QUERY, () => {
      return gsap.from('[data-tv-product-card]', {
        autoAlpha: 0,
        y: 14,
        scale: 0.985,
        duration: 0.48,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      });
    });
    return () => media.revert();
  }, { scope: tvRootRef, dependencies: [productPage, showProductsOnStage, animationsEnabled], revertOnUpdate: true });

  const bookingUrl = getClientBookingUrl(slug);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(bookingUrl)}`;

  if (loading && !payload) {
    return (
      <div className="min-h-screen bg-[#061120] text-white flex items-center justify-center p-8">
        <div className="text-center space-y-5">
          <div className="w-24 h-24 rounded-full overflow-hidden border border-cyan-300/15 bg-slate-950/30 p-2 mx-auto shadow-2xl shadow-cyan-500/15 animate-pulse">
            <BrandLogo variant="mark" className="w-full h-full" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">AgendAI TV</p>
            <h1 className="text-3xl font-black mt-2">Preparando painel de atendimento</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!payload?.enabled) {
    return (
      <div className="min-h-screen bg-[#061120] text-white flex items-center justify-center p-8">
        <div className="max-w-xl text-center rounded-[36px] border border-slate-800 bg-slate-950/50 p-10 shadow-2xl">
          <BrandLogo variant="mark" className="w-24 h-24 mx-auto rounded-full border border-cyan-300/15 bg-slate-950/30 p-2" />
          <h1 className="text-3xl font-black mt-6">Tela da TV desativada</h1>
          <p className="text-slate-400 mt-3">Ative o Modo TV em Ajustes para liberar este painel público.</p>
          <AgencyCredit centered compact className="mt-6" />
        </div>
      </div>
    );
  }

  const org = payload.org;
  const displayBarbers = (payload.barbers || []).filter((barber) => barber?.id);
  const teamIsCompact = displayBarbers.length > 2;
  const teamIsDense = displayBarbers.length > 4;
  const teamAvatarSize = teamIsDense
    ? 'w-[2.15vw] h-[2.15vw] min-w-[30px] min-h-[30px]'
    : teamIsCompact
      ? 'w-[2.7vw] h-[2.7vw] min-w-[38px] min-h-[38px]'
      : 'w-[3.25vw] h-[3.25vw] min-w-[46px] min-h-[46px]';
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase();
  const showPlayer = hasMediaPlayer;

  return (
    <div
      ref={tvRootRef}
      tabIndex={-1}
      className={`h-screen overflow-hidden bg-[#07090d] text-white font-sans p-[0.7vw] flex flex-col gap-[0.65vw] outline-none selection:bg-cyan-300/20 isolate ${animationsEnabled ? 'tv-motion-enabled' : 'tv-motion-reduced'}`}
    >
      {newBookingAlert && (
        <div data-tv-booking-alert className="fixed z-[90] left-1/2 top-[1vw] -translate-x-1/2 w-[min(92vw,880px)] rounded-[1vw] border border-cyan-300/40 bg-[#0b111a]/96 backdrop-blur-xl px-[1.1vw] py-[0.8vw] shadow-[0_20px_70px_rgba(34,211,238,0.24)]">
          <div className="flex items-center gap-[0.8vw]">
            <div className="w-[3vw] h-[3vw] rounded-[0.8vw] bg-cyan-400/12 border border-cyan-300/25 flex items-center justify-center shrink-0">
              <BellRing className="w-[1.35vw] h-[1.35vw] text-cyan-200" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[clamp(.62rem,.66vw,.82rem)] uppercase tracking-[.18em] text-cyan-300 font-black">Novo agendamento</p>
              <div className="flex items-baseline gap-[0.6vw] min-w-0 mt-[.12vw]">
                <strong className="text-[clamp(1.2rem,1.35vw,1.8rem)] truncate">{newBookingAlert.client_name}</strong>
                <span className="text-[clamp(1rem,1.05vw,1.35rem)] font-black text-cyan-200 shrink-0">{newBookingAlert.start_time}</span>
              </div>
              <p className="text-[clamp(.72rem,.76vw,.95rem)] text-slate-300 truncate">{newBookingAlert.service_name} • {newBookingAlert.barber_name}</p>
            </div>
          </div>
        </div>
      )}

      <header data-tv-shell-section className="h-[10.2vh] shrink-0 rounded-[1.15vw] border border-white/10 bg-[#0d1118] px-[1.15vw] flex items-center justify-between shadow-[0_10px_35px_rgba(0,0,0,.24)]">
        <div className="flex items-center gap-[0.85vw] min-w-0">
          <div className="w-[4.15vw] h-[4.15vw] min-w-[58px] min-h-[58px] rounded-full border border-white/10 bg-white/5 p-[0.28vw] overflow-hidden flex items-center justify-center shadow-lg">
            {org.logo_image_url ? (
              <img src={org.logo_image_url} alt={`Logo ${org.name}`} className="w-full h-full rounded-full object-cover object-center" />
            ) : (
              <BrandLogo variant="mark" className="w-full h-full" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[clamp(1.7rem,2.18vw,3rem)] leading-[.96] font-black tracking-[-.035em] truncate">{org.name}</h1>
            <div className="mt-[.42vw] flex items-center gap-[.85vw] text-[clamp(.72rem,.82vw,1.05rem)] text-slate-300">
              {org.phone && <span className="flex items-center gap-[.3vw]"><Phone className="w-[.82vw] h-[.82vw] text-cyan-300" />{formatPhone(org.phone)}</span>}
              {org.address && <span className="hidden 2xl:flex items-center gap-[.3vw] truncate max-w-[26vw]"><MapPin className="w-[.82vw] h-[.82vw] text-cyan-300 shrink-0" />{org.address}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-[1.1vw] shrink-0">
          {!online && (
            <>
              <div className="rounded-full border border-rose-400/25 bg-rose-400/8 text-rose-300 px-[.65vw] py-[.28vw] flex items-center gap-[.3vw] text-[clamp(.58rem,.62vw,.78rem)] uppercase tracking-[.12em] font-black">
                <WifiOff className="w-[.75vw] h-[.75vw]" />
                Reconectando
              </div>
              <div className="h-[4.1vh] w-px bg-white/10" />
            </>
          )}
          <p className="text-[clamp(.88rem,1vw,1.3rem)] font-black tracking-[.02em] text-slate-200 whitespace-nowrap">{dateLabel}</p>
          <div className="h-[4.1vh] w-px bg-white/10" />
          <p className="text-[clamp(2rem,2.75vw,3.8rem)] leading-none font-black tracking-[-.055em] tabular-nums text-white">{now.toLocaleTimeString('pt-BR')}</p>
        </div>
      </header>

      <main className="min-h-0 flex-1 grid grid-cols-12 grid-rows-[minmax(0,1fr)_10.8vh] gap-[0.65vw]">
        <section data-tv-shell-section className="col-start-9 col-span-4 row-start-1 min-h-0 grid grid-rows-[1.18fr_.92fr_1.18fr] gap-[0.65vw]">
          <article data-tv-appointment-id={inProgressAppointment?.id || ''} className={`tv-service-card relative rounded-[1.05vw] border p-[1vw] flex items-center gap-[.9vw] overflow-hidden transition-all duration-500 ${inProgressAppointment ? 'is-active border-emerald-300/45 bg-[linear-gradient(135deg,rgba(16,185,129,.17),rgba(8,21,25,.98))] shadow-[0_0_42px_rgba(16,185,129,.13)]' : 'border-white/10 bg-[#0d1118]'}`}>
            <div className={`tv-service-icon relative w-[4.35vw] h-[4.35vw] shrink-0 rounded-full flex items-center justify-center ${inProgressAppointment ? 'bg-emerald-300/10' : 'border border-white/10 bg-white/5'}`}>
              {inProgressAppointment && <span className="tv-service-spinner absolute inset-0 rounded-full" aria-hidden="true" />}
              <div className={`w-[3.25vw] h-[3.25vw] rounded-full border flex items-center justify-center ${inProgressAppointment ? 'border-emerald-200/25 bg-[#0a211e] shadow-[0_0_25px_rgba(52,211,153,.16)]' : 'border-transparent'}`}>
                <Scissors className={`w-[1.55vw] h-[1.55vw] ${inProgressAppointment ? 'text-emerald-200' : 'text-slate-500'}`} />
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-[.15vw]">
              <p className={`text-[clamp(.68rem,.72vw,.9rem)] uppercase tracking-[.11em] font-black ${inProgressAppointment ? 'text-emerald-200' : 'text-slate-500'}`}>{inProgressAppointment ? 'Atendimento em andamento' : 'Em atendimento'}</p>
              <h2 className="mt-[.28vw] text-[clamp(1.45rem,1.9vw,2.55rem)] leading-[.98] font-black uppercase tracking-[-.035em] truncate">{inProgressAppointment?.client_name || 'Nenhum cliente'}</h2>
              <p className="mt-[.34vw] text-[clamp(.76rem,.84vw,1.04rem)] text-slate-300 truncate">{inProgressAppointment ? `${inProgressAppointment.service_name} • ${inProgressAppointment.barber_name}` : 'Aguardando início de atendimento'}</p>

              {inProgressAppointment && (
                <p className="mt-[.62vw] text-[clamp(.54rem,.59vw,.73rem)] font-bold text-emerald-100/75">Cliente sendo atendido</p>
              )}
            </div>
          </article>

          <article data-tv-appointment-id={nextAppointment?.id || ''} className={`rounded-[1.05vw] border p-[1vw] flex items-center gap-[.85vw] overflow-hidden transition-all duration-500 ${nextAppointment ? 'border-sky-400/30 bg-[linear-gradient(135deg,rgba(59,130,246,.12),rgba(13,17,24,.98))]' : 'border-white/10 bg-[#0d1118]'}`}>
            <div className={`w-[4vw] h-[4vw] shrink-0 rounded-[.9vw] border flex items-center justify-center ${nextAppointment ? 'border-sky-300/25 bg-sky-300/10' : 'border-white/10 bg-white/5'}`}>
              <CalendarClock className={`w-[1.7vw] h-[1.7vw] ${nextAppointment ? 'text-sky-300' : 'text-slate-500'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[clamp(.68rem,.72vw,.9rem)] uppercase tracking-[.09em] font-black ${nextAppointment ? 'text-sky-300' : 'text-slate-500'}`}>Próximo cliente</p>
              <div className="flex items-end justify-between gap-[.7vw] mt-[.2vw]">
                <h2 className="text-[clamp(1.35rem,1.72vw,2.3rem)] leading-[1] font-black uppercase tracking-[-.03em] truncate">{nextAppointment?.client_name || 'Agenda livre'}</h2>
                {nextAppointment && <span className="text-[clamp(1.22rem,1.45vw,1.9rem)] leading-none font-black tabular-nums text-sky-300 shrink-0">{nextAppointment.start_time}</span>}
              </div>
              <p className="mt-[.34vw] text-[clamp(.76rem,.84vw,1.05rem)] text-slate-300 truncate">{nextAppointment ? `${nextAppointment.service_name} • ${nextAppointment.barber_name}` : 'Sem próximo horário'}</p>
            </div>
          </article>

          <article className="rounded-[1.05vw] border border-violet-400/25 bg-[linear-gradient(135deg,rgba(139,92,246,.10),rgba(13,17,24,.98))] p-[.85vw] min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-[.45vw]">
              <p className="text-[clamp(.66rem,.7vw,.86rem)] uppercase tracking-[.1em] text-violet-300 font-black flex items-center gap-[.35vw]"><UsersRound className="w-[.9vw] h-[.9vw]" /> Na sequência</p>
              <span className="text-[clamp(.58rem,.61vw,.76rem)] text-slate-500">{waitingCount} aguardando</span>
            </div>
            {compactQueue.length ? (
              <div className="space-y-[.3vw]">
                {compactQueue.map((item, index) => (
                  <div key={item.id} data-tv-appointment-id={item.id} className={`h-[2.25vw] min-h-[32px] rounded-[.62vw] border px-[.62vw] grid grid-cols-[1.6vw_minmax(0,1fr)_auto] items-center gap-[.45vw] ${item.id === newBookingAlert?.id ? 'border-cyan-300/35 bg-cyan-300/10' : 'border-white/8 bg-black/18'}`}>
                    <span className="w-[1.45vw] h-[1.45vw] rounded-full bg-violet-400/12 text-violet-200 flex items-center justify-center text-[clamp(.58rem,.62vw,.75rem)] font-black">{index + 1}</span>
                    <div className="min-w-0 flex items-center gap-[.45vw]">
                      <strong className="text-[clamp(.72rem,.82vw,1rem)] truncate">{item.client_name}</strong>
                      <span className="hidden 2xl:block text-[clamp(.56rem,.6vw,.72rem)] text-slate-500 truncate">{item.service_name}</span>
                    </div>
                    <span className="text-[clamp(.72rem,.8vw,.98rem)] font-black tabular-nums text-slate-200">{item.start_time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[calc(100%-1.6vw)] rounded-[.7vw] border border-dashed border-white/10 flex items-center justify-center text-[clamp(.7rem,.78vw,.95rem)] text-slate-500">Sem clientes na sequência</div>
            )}
          </article>
        </section>

        <section
          data-tv-shell-section
          className="col-start-1 col-span-8 row-start-1 min-h-0 rounded-[1.05vw] border border-white/10 bg-[#0d1118] overflow-hidden relative shadow-[0_16px_45px_rgba(0,0,0,.30)] isolate"
        >
          <div className="absolute inset-x-0 top-0 z-20 h-[3.2vw] min-h-[44px] px-[1vw] flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
            <div className="flex items-center gap-[.5vw]">
              {!showBrandStage && showPlayer ? <Music2 className="w-[1.05vw] h-[1.05vw] text-cyan-300" /> : <ShoppingBag className="w-[1.05vw] h-[1.05vw] text-cyan-300" />}
              <span className="text-[clamp(.66rem,.72vw,.9rem)] uppercase tracking-[.12em] font-black">
                {showMediaProductsLayout ? 'Mídia + produtos' : !showBrandStage && showPlayer ? 'Mídia da recepção' : showProductsOnStage ? 'Vitrine de produtos' : 'Painel institucional'}
              </span>
            </div>
            <span className="text-[clamp(.58rem,.62vw,.76rem)] text-slate-300">AgendAI TV</span>
          </div>

          {showMediaProductsLayout ? (
            <div className="absolute inset-0 overflow-hidden bg-[#090d13] pt-[3.35vw] px-[.75vw] pb-[.75vw] flex flex-col gap-[.62vw]">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[.85vw] border border-white/10 bg-black/40">
                {youtubeEmbedUrl ? (
                  <iframe
                    key={`products-${youtubeEmbedUrl}`}
                    className="tv-youtube-player absolute inset-0 w-full h-full pointer-events-none"
                    src={youtubeEmbedUrl}
                    title="YouTube da recepção"
                    allow="autoplay; encrypted-media"
                    sandbox="allow-scripts allow-same-origin"
                    tabIndex={-1}
                    aria-hidden="true"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : spotifyEmbedUrl ? (
                  <iframe className="absolute inset-0 w-full h-full" src={spotifyEmbedUrl} title="Spotify da recepção" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" />
                ) : appleMusicEmbedUrl ? (
                  <iframe className="absolute inset-0 w-full h-full" src={appleMusicEmbedUrl} title="Apple Music da recepção" allow="autoplay; encrypted-media" />
                ) : directAudioUrl ? (
                  <div className="absolute inset-0 overflow-hidden bg-[#090d13]">
                    {org.cover_image_url && <img src={org.cover_image_url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-25 scale-105" />}
                    <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,8,13,.96),rgba(5,8,13,.54),rgba(5,8,13,.9))]" />
                    <div className="relative h-full px-[1.3vw] pb-[.75vw] flex flex-col justify-end">
                      <p className="text-cyan-300 uppercase tracking-[.16em] font-black text-[clamp(.6rem,.65vw,.8rem)] flex items-center gap-[.3vw]"><Headphones className="w-[.9vw] h-[.9vw]" /> Áudio da recepção</p>
                      <h3 className="text-[clamp(1.35rem,1.75vw,2.5rem)] font-black mt-[.2vw] tracking-[-.035em]">{org.name}</h3>
                      <audio ref={directMediaAudioRef} src={directAudioUrl} controls autoPlay loop preload="auto" className="w-full mt-[.55vw] h-9" />
                    </div>
                  </div>
                ) : null}
              </div>

              {featuredProducts.length > 0 && (
                <div className="shrink-0">
                  <div className="mb-[.32vw] flex items-center justify-between">
                    <p className="text-[clamp(.58rem,.63vw,.78rem)] uppercase tracking-[.12em] text-cyan-300 font-black">Produtos em destaque</p>
                    {productPageCount > 1 && <span className="text-[clamp(.52rem,.56vw,.7rem)] text-slate-500 tabular-nums">{productPage + 1} / {productPageCount}</span>}
                  </div>
                  <div key={productPage} className="grid grid-cols-3 gap-[.62vw]">
                    {featuredProducts.map((product) => (
                      <article key={product.id} data-tv-product-card className="h-[5.15vw] min-h-[76px] max-h-[104px] min-w-0 overflow-hidden rounded-[.78vw] border border-cyan-300/18 bg-[#101923]/96 flex items-center shadow-[0_8px_22px_rgba(0,0,0,.24)]">
                        <div className="h-full aspect-square overflow-hidden bg-white/[.045] shrink-0 flex items-center justify-center border-r border-white/10">
                          {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-[1.65vw] h-[1.65vw] text-cyan-300" />}
                        </div>
                        <div className="min-w-0 flex-1 px-[.55vw] py-[.4vw]">
                          {product.category && <p className="text-[clamp(.46rem,.5vw,.62rem)] uppercase tracking-[.08em] text-cyan-300/80 font-bold truncate">{product.category}</p>}
                          <h3 className="text-[clamp(.68rem,.76vw,.94rem)] leading-tight font-black mt-[.08vw] truncate">{product.name}</h3>
                          <p className="text-[clamp(.76rem,.86vw,1.08rem)] leading-none text-cyan-200 font-black mt-[.28vw] tabular-nums">
                            {Number(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !showBrandStage && youtubeEmbedUrl ? (
            <>
              <iframe
                key={youtubeEmbedUrl}
                className="tv-youtube-player absolute inset-0 w-full h-full pointer-events-none"
                src={youtubeEmbedUrl}
                title="Playlist da barbearia"
                allow="autoplay; encrypted-media"
                sandbox="allow-scripts allow-same-origin"
                tabIndex={-1}
                aria-hidden="true"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: 'transparent' }}
              />
            </>
          ) : !showBrandStage && spotifyEmbedUrl ? (
            <div className="absolute inset-0 p-[1.2vw] pt-[3.7vw] bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,.16),transparent_34%),#090d13] flex items-center justify-center">
              <iframe className="w-full h-full rounded-[.9vw]" src={spotifyEmbedUrl} title="Spotify da recepção" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" />
            </div>
          ) : !showBrandStage && appleMusicEmbedUrl ? (
            <div className="absolute inset-0 p-[1.2vw] pt-[3.7vw] bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,.15),transparent_34%),#090d13] flex items-center justify-center">
              <iframe className="w-full h-full rounded-[.9vw]" src={appleMusicEmbedUrl} title="Apple Music da recepção" allow="autoplay; encrypted-media" />
            </div>
          ) : !showBrandStage && directAudioUrl ? (
            <div className="absolute inset-0 z-10 overflow-hidden bg-[#090d13]">
              {org.cover_image_url && <img src={org.cover_image_url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[1px] scale-105" />}
              <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,8,13,.95),rgba(5,8,13,.5),rgba(5,8,13,.9))]" />
              <div className="relative h-full pt-[4.2vw] px-[2vw] pb-[1.4vw] flex flex-col justify-end">
                <p className="text-cyan-300 uppercase tracking-[.18em] font-black text-[clamp(.65rem,.7vw,.86rem)] flex items-center gap-[.35vw]"><Headphones className="w-[1vw] h-[1vw]" /> Áudio da recepção</p>
                <h3 className="text-[clamp(2rem,2.7vw,3.8rem)] font-black mt-[.35vw] tracking-[-.04em]">{org.name}</h3>
                <p className="text-[clamp(.85rem,.95vw,1.2rem)] text-slate-300 mt-[.3vw]">{org.tv_notice || 'Música ambiente • acompanhe sua vez no painel'}</p>
                <audio ref={directMediaAudioRef} src={directAudioUrl} controls autoPlay loop preload="auto" className="w-full mt-[1.2vw] h-10" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 z-10 overflow-hidden bg-[#090d13]">
              {org.cover_image_url && <img src={org.cover_image_url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-20 scale-105" />}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(34,211,238,.16),transparent_34%),linear-gradient(110deg,rgba(5,8,13,.98),rgba(5,8,13,.68),rgba(5,8,13,.96))]" />
              <div className="relative h-full pt-[3.7vw] px-[1.35vw] pb-[1.15vw] flex flex-col">
                <div>
                  <p className="text-[clamp(.65rem,.72vw,.9rem)] uppercase tracking-[.2em] text-cyan-300 font-black">Bem-vindo</p>
                  <h2 className="text-[clamp(1.8rem,2.45vw,3.6rem)] leading-[.94] font-black mt-[.3vw] tracking-[-.05em] truncate">{org.name}</h2>
                  <p className="text-[clamp(.78rem,.88vw,1.1rem)] text-slate-300 mt-[.38vw] max-w-[48vw] truncate">{org.tv_notice || 'Seu cuidado, seu estilo, seu momento.'}</p>
                </div>
                {featuredProducts.length > 0 && (
                  <div className="min-h-0 flex-1 mt-[.8vw] flex flex-col">
                    <div className="mb-[.45vw] flex items-end justify-between gap-[1vw]">
                      <div>
                        <p className="text-[clamp(.62rem,.68vw,.84rem)] uppercase tracking-[.14em] text-cyan-300 font-black">Produtos em destaque</p>
                        <p className="text-[clamp(.66rem,.72vw,.9rem)] text-slate-400 mt-[.08vw]">Conheça nossas opções disponíveis na recepção</p>
                      </div>
                      {productPageCount > 1 && (
                        <span className="text-[clamp(.58rem,.62vw,.76rem)] text-slate-400 tabular-nums">{productPage + 1} / {productPageCount}</span>
                      )}
                    </div>

                    <div key={productPage} className="grid grid-cols-3 items-start gap-[.8vw]">
                      {featuredProducts.map((product) => (
                        <article key={product.id} data-tv-product-card className="relative min-w-0 overflow-hidden rounded-[1vw] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(21,32,45,.96),rgba(5,10,17,.96))] shadow-[0_12px_30px_rgba(0,0,0,.28)] flex flex-col">
                          <div className="h-[7.6vw] min-h-[112px] max-h-[168px] overflow-hidden bg-white/[.045] flex items-center justify-center border-b border-white/10">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-[2.5vw] h-[2.5vw] text-cyan-300" />
                            )}
                          </div>
                          <div className="min-h-0 flex-1 p-[.72vw] flex flex-col">
                            {product.category && <p className="text-[clamp(.52rem,.56vw,.7rem)] uppercase tracking-[.11em] text-cyan-300/80 font-bold truncate">{product.category}</p>}
                            <h3 className="text-[clamp(.88rem,1.02vw,1.3rem)] leading-[1.08] font-black mt-[.18vw] line-clamp-2">{product.name}</h3>
                            {product.description && <p className="text-[clamp(.58rem,.64vw,.8rem)] leading-[1.25] text-slate-400 mt-[.3vw] line-clamp-2">{product.description}</p>}
                            <p className="mt-auto pt-[.35vw] text-[clamp(1rem,1.18vw,1.5rem)] leading-none text-cyan-200 font-black tabular-nums">
                              {Number(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showBrandStage && youtubeEmbedUrl && (
            <iframe
              key={`background-${youtubeEmbedUrl}`}
              className="tv-youtube-player absolute inset-0 z-0 w-full h-full pointer-events-none"
              style={{ opacity: 0.001 }}
              src={youtubeEmbedUrl}
              title="YouTube em segundo plano"
              allow="autoplay; encrypted-media"
              sandbox="allow-scripts allow-same-origin"
              tabIndex={-1}
              aria-hidden="true"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}

          {showBrandStage && spotifyEmbedUrl && (
            <iframe
              className="absolute inset-0 z-0 w-full h-full opacity-[0.001] pointer-events-none"
              src={spotifyEmbedUrl}
              title="Spotify em segundo plano"
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              aria-hidden="true"
            />
          )}

          {showBrandStage && appleMusicEmbedUrl && (
            <iframe
              className="absolute inset-0 z-0 w-full h-full opacity-[0.001] pointer-events-none"
              src={appleMusicEmbedUrl}
              title="Apple Music em segundo plano"
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              aria-hidden="true"
            />
          )}

          {showBrandStage && directAudioUrl && (
            <audio
              ref={directMediaAudioRef}
              src={directAudioUrl}
              autoPlay
              loop
              preload="auto"
              className="absolute w-px h-px opacity-0 pointer-events-none"
              aria-hidden="true"
            />
          )}

          {showPlayer && (
            <div className={`absolute right-[.8vw] z-20 flex items-center gap-[.4vw] pointer-events-auto ${showMediaProductsLayout ? 'top-[3.85vw]' : 'bottom-[.8vw]'}`}>
              {org.tv_sound_enabled !== false && (
                <>
                  <button type="button" onClick={handleToggleSound} className="h-[2.4vw] min-h-[34px] rounded-[.7vw] border border-white/12 bg-black/55 backdrop-blur-md px-[.65vw] flex items-center gap-[.3vw] text-[clamp(.58rem,.62vw,.76rem)] font-black hover:border-cyan-300/40">
                    {soundUnlocked ? <Volume2 className="w-[.85vw] h-[.85vw] text-cyan-300" /> : <VolumeX className="w-[.85vw] h-[.85vw] text-slate-400" />}
                    {soundUnlocked ? 'Som ativo' : 'Ativar som'}
                  </button>
                  <button type="button" onClick={handleTestSound} className="h-[2.4vw] min-h-[34px] w-[2.4vw] min-w-[34px] rounded-[.7vw] border border-white/12 bg-black/55 backdrop-blur-md flex items-center justify-center hover:border-cyan-300/40" title="Testar som"><BellRing className="w-[.85vw] h-[.85vw] text-cyan-300" /></button>
                </>
              )}
              <button type="button" onClick={() => { void requestTvWakeLock(); void document.documentElement.requestFullscreen?.(); }} className="h-[2.4vw] min-h-[34px] w-[2.4vw] min-w-[34px] rounded-[.7vw] border border-white/12 bg-black/55 backdrop-blur-md flex items-center justify-center hover:border-cyan-300/40" title="Tela cheia"><Maximize2 className="w-[.9vw] h-[.9vw]" /></button>
            </div>
          )}
        </section>

        <section data-tv-shell-section className="col-span-2 rounded-[1.05vw] border border-white/10 bg-[#0d1118] px-[.75vw] flex items-center gap-[.6vw] overflow-hidden">
          <div className="w-[3.35vw] h-[3.35vw] rounded-[.85vw] bg-violet-400/10 border border-violet-300/20 flex items-center justify-center shrink-0"><UsersRound className="w-[1.45vw] h-[1.45vw] text-violet-300" /></div>
          <div className="min-w-0 flex items-center gap-[.55vw]">
            <span className="text-[clamp(2rem,2.35vw,3.2rem)] leading-none font-black text-white">{waitingCount}</span>
            <div className="min-w-0"><p className="text-[clamp(.66rem,.72vw,.9rem)] font-black uppercase leading-[1.05] truncate">Clientes</p><p className="text-[clamp(.56rem,.62vw,.76rem)] text-slate-400 uppercase truncate">aguardando</p></div>
          </div>
        </section>

        <section data-tv-shell-section className="col-span-6 min-w-0 overflow-hidden">
          {displayBarbers.length > 0 ? (
            <div
              className="grid h-full min-w-0 gap-[.45vw]"
              style={{ gridTemplateColumns: `repeat(${displayBarbers.length}, minmax(0, 1fr))` }}
            >
              {displayBarbers.map((barber, index) => {
                const activeForBarber = inProgressAppointment?.barber_id === barber.id;
                return (
                  <article key={barber.id} className={`rounded-[1.05vw] border bg-[#0d1118] overflow-hidden min-w-0 ${activeForBarber ? 'border-emerald-300/35 shadow-[0_0_24px_rgba(52,211,153,.08)]' : 'border-white/10'} ${teamIsDense ? 'px-[.3vw] flex flex-col items-center justify-center text-center gap-[.2vw]' : 'px-[.58vw] flex items-center gap-[.48vw]'}`}>
                    <div className={`profile-avatar relative ${teamAvatarSize} rounded-full border border-white/10 bg-white/5 overflow-hidden shrink-0`}>
                      {barber.avatar_url ? <img src={barber.avatar_url} alt={barber.full_name} className="profile-avatar w-full h-full rounded-full object-cover object-center" /> : <div className="w-full h-full rounded-full flex items-center justify-center"><Scissors className={`${teamIsDense ? 'w-[.9vw] h-[.9vw]' : 'w-[1.15vw] h-[1.15vw]'} text-slate-400`} /></div>}
                      <span className={`absolute right-[.08vw] bottom-[.08vw] w-[.62vw] h-[.62vw] min-w-[7px] min-h-[7px] rounded-full border-2 border-[#0d1118] ${activeForBarber ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    </div>
                    <div className="min-w-0 max-w-full">
                      {!teamIsDense && <p className="text-[clamp(.45rem,.5vw,.62rem)] uppercase tracking-[.08em] text-slate-500 truncate">Profissional</p>}
                      <p className={`${teamIsDense ? 'text-[clamp(.55rem,.62vw,.78rem)]' : teamIsCompact ? 'text-[clamp(.64rem,.7vw,.86rem)]' : 'text-[clamp(.76rem,.84vw,1.02rem)]'} font-black truncate`}>{barber.full_name}</p>
                      <p className={`${teamIsDense ? 'text-[clamp(.46rem,.5vw,.62rem)]' : 'text-[clamp(.52rem,.58vw,.7rem)]'} font-bold mt-[.08vw] truncate ${activeForBarber ? 'text-emerald-300' : 'text-slate-400'}`}>{activeForBarber ? 'Atendendo' : index === 0 && nextAppointment ? 'Próximo em breve' : 'Disponível'}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="h-full rounded-[1.05vw] border border-dashed border-white/10 bg-[#0d1118] flex items-center justify-center text-[clamp(.62rem,.68vw,.84rem)] text-slate-500">Nenhum profissional cadastrado</div>
          )}
        </section>

        <section data-tv-shell-section className="col-span-4 rounded-[1.05vw] border border-cyan-300/20 bg-[linear-gradient(120deg,rgba(34,211,238,.09),rgba(13,17,24,.98))] px-[.72vw] flex items-center gap-[.6vw] overflow-hidden">
          <div className="h-[8.4vh] aspect-square rounded-[.7vw] bg-white p-[.24vw] shrink-0"><img src={qrUrl} alt="QR Code para agendamento" className="w-full h-full object-contain" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[clamp(.62rem,.68vw,.84rem)] uppercase tracking-[.08em] text-cyan-300 font-black">Agendar pelo celular</p>
            <p className="text-[clamp(1rem,1.28vw,1.7rem)] font-black leading-none mt-[.15vw]">Escaneie o QR Code</p>
            <p className="text-[clamp(.55rem,.6vw,.74rem)] text-slate-400 truncate mt-[.22vw]">{bookingUrl}</p>
          </div>
          <div className="w-[3.1vw] h-[5.7vh] rounded-[.65vw] border border-white/12 bg-black/30 flex items-center justify-center shrink-0"><QrCode className="w-[1.3vw] h-[1.3vw] text-cyan-200" /></div>
        </section>
      </main>

      <footer data-tv-shell-section className="h-[3.7vh] min-h-[26px] shrink-0 rounded-[.75vw] border border-white/8 bg-[#0d1118] px-[.8vw] grid grid-cols-3 items-center text-[clamp(.5rem,.56vw,.7rem)] text-slate-500">
        <div className="flex items-center gap-[.28vw]"><Clock3 className="w-[.72vw] h-[.72vw]" /><span>Atualização automática a cada 15 segundos.</span></div>
        <div className="text-center"><span>Desenvolvido por <strong className="text-slate-300">Agência G7</strong></span></div>
        <div className="justify-self-end flex items-center gap-[.6vw]">
          {org.phone && <span className="flex items-center gap-[.25vw]"><Phone className="w-[.7vw] h-[.7vw]" />{formatPhone(org.phone)}</span>}
          <span className="text-slate-600">AgendAI TV</span>
        </div>
      </footer>
    </div>
  );
};
