import React, { useEffect, useRef, useState } from 'react';
import { useClipboard } from '../hooks/useClipboard';
import {
  Building2, Settings, Phone, MapPin, Clock,
  Sparkles, RotateCcw, Check, Copy, ExternalLink, Share2, Smartphone, Download, Upload,
  Palette, BellRing, ShieldCheck, CloudDownload, Loader2, Info, MessageSquareText, Image as ImageIcon, Tv2, Youtube, Music2, Eye, EyeOff, DollarSign, Volume2, CalendarOff, Trash2,
  Layout, Sliders, Scissors, CheckCircle, Flame, Moon, Sun, Layers, Sparkle, Plus, ArrowUp, ArrowDown, Instagram, Facebook, AtSign, Globe2, MapPinned
} from 'lucide-react';
import { BusinessClosurePeriod, Organization, PublicGalleryImage, UiBorderRadius, UiSurfaceStyle } from '../types';
import { INITIAL_ORG, INITIAL_SERVICES, INITIAL_BARBERS, INITIAL_APPOINTMENTS } from '../data/mockData';
import { restoreLastCloudBackup, saveTvSettingsToCloud } from '../services/cloudSync';
import { enablePushNotifications, getPushSubscriptionState, getPushSupportMessage } from '../services/pushNotifications';
import { getAdminAppUrl, getClientBookingUrl, getTvDisplayUrl } from '../config/urls';
import { getReadableTextColor, isLightColor, deriveAccentColor } from '../utils/color';
import { isSafePublicUrl, PUBLIC_GALLERY_LIMIT, sanitizePublicGallery, sanitizeSocialLinks, SOCIAL_LINK_KEYS, SocialLinkKey } from '../utils/publicShowcase';

interface SettingsViewProps {
  section?: 'general' | 'appearance';
  org: Organization;
  setOrg: React.Dispatch<React.SetStateAction<Organization>>;
  onLoadDemo: (demoData: {
    org: Organization;
    services: typeof INITIAL_SERVICES;
    barbers: typeof INITIAL_BARBERS;
    appointments: typeof INITIAL_APPOINTMENTS;
  }) => void;
  onResetAll: () => void;
}

export interface ThemePreset {
  id: string;
  name: string;
  niche: string;
  tag: string;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceStyle: UiSurfaceStyle;
  borderRadius: UiBorderRadius;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'onyx_gold',
    name: 'Onyx & Gold',
    niche: 'Barbearia Clássica',
    tag: 'Old School / Whisky',
    primary: '#D4AF37',
    accent: '#F59E0B',
    background: '#090806',
    surface: '#17140E',
    surfaceStyle: 'glow',
    borderRadius: 'standard',
  },
  {
    id: 'midnight_cyan',
    name: 'Midnight Cyan',
    niche: 'Barbearia Urbana',
    tag: 'Cyber / Tech',
    primary: '#06B6D4',
    accent: '#3B82F6',
    background: '#060D1A',
    surface: '#0E1B33',
    surfaceStyle: 'glass',
    borderRadius: 'standard',
  },
  {
    id: 'esmeralda_imperial',
    name: 'Esmeralda Imperial',
    niche: 'Executivo & Moderno',
    tag: 'Elegância Verde',
    primary: '#10B981',
    accent: '#34D399',
    background: '#07100D',
    surface: '#10211B',
    surfaceStyle: 'glow',
    borderRadius: 'soft',
  },
  {
    id: 'rose_gold_velvet',
    name: 'Rose Gold & Velvet',
    niche: 'Salão & Estética',
    tag: 'Beauty / Luxury',
    primary: '#FB7185',
    accent: '#F43F5E',
    background: '#0F0A0E',
    surface: '#1F141D',
    surfaceStyle: 'glass',
    borderRadius: 'soft',
  },
  {
    id: 'espresso_amber',
    name: 'Espresso & Amber',
    niche: 'Vintage & Madeira',
    tag: 'Couro / Tabaco',
    primary: '#E08A3C',
    accent: '#F59E0B',
    background: '#0E0B09',
    surface: '#1C1613',
    surfaceStyle: 'solid',
    borderRadius: 'standard',
  },
  {
    id: 'deep_purple',
    name: 'Deep Purple & Neon',
    niche: 'Studio Criativo',
    tag: 'Tattoo / Concept',
    primary: '#A855F7',
    accent: '#6366F1',
    background: '#0C0816',
    surface: '#18112C',
    surfaceStyle: 'glass',
    borderRadius: 'standard',
  },
  {
    id: 'rubi_dark',
    name: 'Rubi & Dark Metal',
    niche: 'Garage & Rock',
    tag: 'Automotivo / Industrial',
    primary: '#EF4444',
    accent: '#F87171',
    background: '#0F0808',
    surface: '#1E1010',
    surfaceStyle: 'glow',
    borderRadius: 'compact',
  },
  {
    id: 'clean_nordic',
    name: 'Clean Nordic',
    niche: 'Minimalista Claro',
    tag: 'Branco Puro / Contraste',
    primary: '#0F172A',
    accent: '#3B82F6',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceStyle: 'solid',
    borderRadius: 'standard',
  },
  {
    id: 'luxury_white_gold',
    name: 'Luxury White & Gold',
    niche: 'Estética & Clínica',
    tag: 'Claro Sofisticado',
    primary: '#D97706',
    accent: '#F59E0B',
    background: '#FFFFFF',
    surface: '#F4F6F8',
    surfaceStyle: 'solid',
    borderRadius: 'soft',
  },
  {
    id: 'ocean_blue',
    name: 'Ocean Navy',
    niche: 'Náutico & Moderno',
    tag: 'Azul Nobre',
    primary: '#3B82F6',
    accent: '#60A5FA',
    background: '#07101F',
    surface: '#111C32',
    surfaceStyle: 'glass',
    borderRadius: 'standard',
  },
  {
    id: 'sunset_tropic',
    name: 'Sunset Tropic',
    niche: 'Jovem & Dinâmico',
    tag: 'Laranja Solar',
    primary: '#FF6B4A',
    accent: '#FBBF24',
    background: '#0F0A0A',
    surface: '#1F1414',
    surfaceStyle: 'glow',
    borderRadius: 'standard',
  },
  {
    id: 'carbon_titanium',
    name: 'Carbon Titanium',
    niche: 'Monocromático Dark',
    tag: 'Minimalista Preto',
    primary: '#E2E8F0',
    accent: '#94A3B8',
    background: '#09090B',
    surface: '#18181B',
    surfaceStyle: 'solid',
    borderRadius: 'compact',
  },
];

const SOCIAL_LINK_FIELDS: Array<{
  key: SocialLinkKey;
  label: string;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/sua-barbearia', icon: Instagram },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/sua-barbearia', icon: Facebook },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@sua-barbearia', icon: AtSign },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@sua-barbearia', icon: Youtube },
  { key: 'website', label: 'Site', placeholder: 'https://seusite.com.br', icon: Globe2 },
  { key: 'maps', label: 'Como chegar', placeholder: 'https://maps.app.goo.gl/...', icon: MapPinned },
];

const localDateInputValue = (date = new Date()): string => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().split('T')[0];
};

const formatClosureDate = (dateStr: string): string =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export const SettingsView: React.FC<SettingsViewProps> = ({
  section = 'general',
  org,
  setOrg,
  onLoadDemo,
  onResetAll,
}) => {
  const [name, setName] = useState(org.name);
  const [ownerName, setOwnerName] = useState(org.owner_name || '');
  const [slug, setSlug] = useState(org.slug);
  const [phone, setPhone] = useState(org.phone);
  const [pixKey, setPixKey] = useState(org.pix_key || '');
  const [pixHolder, setPixHolder] = useState(org.pix_holder || '');
  const [address, setAddress] = useState(org.address || '');
  const [openHour, setOpenHour] = useState(org.open_hour || '08:00');
  const [closeHour, setCloseHour] = useState(org.close_hour || '20:00');
  const [breakEnabled, setBreakEnabled] = useState(org.break_enabled === true);
  const [breakStart, setBreakStart] = useState(org.break_start || '12:00');
  const [breakEnd, setBreakEnd] = useState(org.break_end || '14:00');
  const [closedPeriods, setClosedPeriods] = useState<BusinessClosurePeriod[]>(Array.isArray(org.closed_periods) ? org.closed_periods : []);
  const [closureDate, setClosureDate] = useState(localDateInputValue());
  const [closureMode, setClosureMode] = useState<'all_day' | 'morning' | 'afternoon' | 'custom'>('all_day');
  const [closureStart, setClosureStart] = useState(org.open_hour || '08:00');
  const [closureEnd, setClosureEnd] = useState(org.close_hour || '20:00');
  const [closureReason, setClosureReason] = useState('Fechado excepcionalmente');

  // Configurações de tema
  const [primaryColor, setPrimaryColor] = useState(org.primary_color || '#10b981');
  const [accentColor, setAccentColor] = useState(org.accent_color || deriveAccentColor(org.primary_color || '#10b981'));
  const [backgroundColor, setBackgroundColor] = useState(org.background_color || '#070B14');
  const [surfaceColor, setSurfaceColor] = useState(org.surface_color || '#121B2E');
  const [themePreset, setThemePreset] = useState<string>(org.theme_preset || 'esmeralda_imperial');
  const [uiBorderRadius, setUiBorderRadius] = useState<UiBorderRadius>(org.ui_border_radius || 'standard');
  const [uiSurfaceStyle, setUiSurfaceStyle] = useState<UiSurfaceStyle>(org.ui_surface_style || 'solid');
  const [previewTab, setPreviewTab] = useState<'dashboard' | 'booking'>('dashboard');

  const [coverImageUrl, setCoverImageUrl] = useState(org.cover_image_url || '');
  const [logoImageUrl, setLogoImageUrl] = useState(org.logo_image_url || '');
  const [galleryImages, setGalleryImages] = useState<PublicGalleryImage[]>(sanitizePublicGallery(org.public_gallery));
  const [socialLinks, setSocialLinks] = useState<Record<SocialLinkKey, string>>(() => {
    const links = sanitizeSocialLinks(org.social_links);
    return Object.fromEntries(SOCIAL_LINK_KEYS.map((key) => [key, links[key] || ''])) as Record<SocialLinkKey, string>;
  });
  const [tvEnabled, setTvEnabled] = useState(org.tv_enabled === true);
  const [tvMediaType, setTvMediaType] = useState<'youtube' | 'spotify' | 'apple_music' | 'audio' | 'institutional'>(org.tv_media_type || (org.tv_youtube_url ? 'youtube' : 'institutional'));
  const [tvMediaUrl, setTvMediaUrl] = useState(org.tv_media_url || org.tv_youtube_url || '');
  const [tvVisualMode, setTvVisualMode] = useState<'player_queue' | 'brand_queue' | 'brand_products_queue'>(org.tv_visual_mode || 'player_queue');
  const [tvAnimations, setTvAnimations] = useState(org.tv_animations !== false);
  const [tvNotice, setTvNotice] = useState(org.tv_notice || 'Obrigado pela preferência. Aguarde seu atendimento e fique à vontade!');
  const [tvShowClientNames, setTvShowClientNames] = useState(org.tv_show_client_names === true);
  const [tvShowPrices, setTvShowPrices] = useState(org.tv_show_prices === true);
  const [tvSoundEnabled, setTvSoundEnabled] = useState(org.tv_sound_enabled !== false);
  const [tvSoundVolume, setTvSoundVolume] = useState(Math.min(100, Math.max(0, Number(org.tv_sound_volume ?? 70))));
  const [tvSoundStyle, setTvSoundStyle] = useState<'bell' | 'soft' | 'attention'>(org.tv_sound_style || 'bell');
  const [confirmTemplate, setConfirmTemplate] = useState(org.whatsapp_confirm_template || 'Olá {cliente}! Seu horário na {barbearia} está confirmado para {data} às {horario}. Serviço: {servico}. Valor: R$ {valor}.');
  const [reminderTemplate, setReminderTemplate] = useState(org.whatsapp_reminder_template || 'Olá {cliente}! Passando para lembrar do seu horário na {barbearia} em {data} às {horario}. Serviço: {servico}.');
  const [thanksTemplate, setThanksTemplate] = useState(org.whatsapp_thanks_template || 'Olá {cliente}! Obrigado por escolher a {barbearia}. Foi um prazer atender você. Até a próxima!');
  const [inactiveTemplate, setInactiveTemplate] = useState(org.whatsapp_inactive_template || 'Olá {cliente}! Sentimos sua falta na {barbearia}. Que tal reservar seu próximo horário?');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const savedSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publicClipboard = useClipboard();
  const mobileClipboard = useClipboard();
  const tvClipboard = useClipboard();
  const copiedLink = publicClipboard.copied;
  const copiedMobileLink = mobileClipboard.copied;
  const copiedTvLink = tvClipboard.copied;
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [cloudRestoreMessage, setCloudRestoreMessage] = useState('');

  useEffect(() => {
    setName(org.name);
    setOwnerName(org.owner_name || '');
    setSlug(org.slug);
    setPhone(org.phone);
    setPixKey(org.pix_key || '');
    setPixHolder(org.pix_holder || '');
    setAddress(org.address || '');
    setOpenHour(org.open_hour || '08:00');
    setCloseHour(org.close_hour || '20:00');
    setBreakEnabled(org.break_enabled === true);
    setBreakStart(org.break_start || '12:00');
    setBreakEnd(org.break_end || '14:00');
    setClosedPeriods(Array.isArray(org.closed_periods) ? org.closed_periods : []);
    setPrimaryColor(org.primary_color || '#10b981');
    setAccentColor(org.accent_color || deriveAccentColor(org.primary_color || '#10b981'));
    setBackgroundColor(org.background_color || '#070B14');
    setSurfaceColor(org.surface_color || '#121B2E');
    setThemePreset(org.theme_preset || 'esmeralda_imperial');
    setUiBorderRadius(org.ui_border_radius || 'standard');
    setUiSurfaceStyle(org.ui_surface_style || 'solid');
    setCoverImageUrl(org.cover_image_url || '');
    setLogoImageUrl(org.logo_image_url || '');
    setGalleryImages(sanitizePublicGallery(org.public_gallery));
    const nextSocialLinks = sanitizeSocialLinks(org.social_links);
    setSocialLinks(Object.fromEntries(SOCIAL_LINK_KEYS.map((key) => [key, nextSocialLinks[key] || ''])) as Record<SocialLinkKey, string>);
    setTvEnabled(org.tv_enabled === true);
    setTvMediaType(org.tv_media_type || (org.tv_youtube_url ? 'youtube' : 'institutional'));
    setTvMediaUrl(org.tv_media_url || org.tv_youtube_url || '');
    setTvVisualMode(org.tv_visual_mode || 'player_queue');
    setTvAnimations(org.tv_animations !== false);
    setTvNotice(org.tv_notice || 'Obrigado pela preferência. Aguarde seu atendimento e fique à vontade!');
    setTvShowClientNames(org.tv_show_client_names === true);
    setTvShowPrices(org.tv_show_prices === true);
    setTvSoundEnabled(org.tv_sound_enabled !== false);
    setTvSoundVolume(Math.min(100, Math.max(0, Number(org.tv_sound_volume ?? 70))));
    setTvSoundStyle(org.tv_sound_style || 'bell');
    setConfirmTemplate(org.whatsapp_confirm_template || 'Olá {cliente}! Seu horário na {barbearia} está confirmado para {data} às {horario}. Serviço: {servico}. Valor: R$ {valor}.');
    setReminderTemplate(org.whatsapp_reminder_template || 'Olá {cliente}! Passando para lembrar do seu horário na {barbearia} em {data} às {horario}. Serviço: {servico}.');
    setThanksTemplate(org.whatsapp_thanks_template || 'Olá {cliente}! Obrigado por escolher a {barbearia}. Foi um prazer atender você. Até a próxima!');
    setInactiveTemplate(org.whatsapp_inactive_template || 'Olá {cliente}! Sentimos sua falta na {barbearia}. Que tal reservar seu próximo horário?');
  }, [org]);

  useEffect(() => {
    let active = true;
    const inspect = async () => {
      const support = getPushSupportMessage();
      const subscribed = await getPushSubscriptionState();
      if (!active) return;
      setNotificationEnabled(subscribed);
      setNotificationMessage(subscribed ? 'Notificações ativas neste aparelho.' : support.message);
    };
    void inspect();
    return () => { active = false; };
  }, []);

  const publicLink = getClientBookingUrl(slug || org.slug);
  const tvLink = getTvDisplayUrl(slug || org.slug);
  const generateMobileSyncLink = () => getAdminAppUrl(window.location.pathname);

  const buildUpdatedOrg = (periods: BusinessClosurePeriod[] = closedPeriods): Organization => ({
    ...org,
    name: name.trim(),
    owner_name: ownerName.trim() || undefined,
    slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
    phone: phone.trim(),
    pix_key: pixKey.trim() || undefined,
    pix_holder: pixHolder.trim() || undefined,
    address: address.trim() || undefined,
    open_hour: openHour,
    close_hour: closeHour,
    break_enabled: breakEnabled,
    break_start: breakStart,
    break_end: breakEnd,
    closed_periods: periods,
    primary_color: primaryColor,
    accent_color: accentColor,
    background_color: backgroundColor,
    surface_color: surfaceColor,
    theme_preset: themePreset,
    ui_border_radius: uiBorderRadius,
    ui_surface_style: uiSurfaceStyle,
    cover_image_url: coverImageUrl.trim() || undefined,
    logo_image_url: logoImageUrl.trim() || undefined,
    public_gallery: sanitizePublicGallery(galleryImages),
    social_links: sanitizeSocialLinks(socialLinks),
    tv_enabled: tvEnabled,
    tv_youtube_url: tvMediaType === 'youtube' ? (tvMediaUrl.trim() || undefined) : undefined,
    tv_media_type: tvMediaType,
    tv_media_url: tvMediaType === 'institutional' ? undefined : (tvMediaUrl.trim() || undefined),
    tv_visual_mode: tvMediaType === 'institutional' && tvVisualMode === 'player_queue' ? 'brand_products_queue' : tvVisualMode,
    tv_animations: tvAnimations,
    tv_notice: tvNotice.trim() || undefined,
    tv_show_client_names: tvShowClientNames,
    tv_show_prices: tvShowPrices,
    tv_sound_enabled: tvSoundEnabled,
    tv_sound_volume: tvSoundVolume,
    tv_sound_style: tvSoundStyle,
    whatsapp_confirm_template: confirmTemplate.trim() || undefined,
    whatsapp_reminder_template: reminderTemplate.trim() || undefined,
    whatsapp_thanks_template: thanksTemplate.trim() || undefined,
    whatsapp_inactive_template: inactiveTemplate.trim() || undefined,
  });

  const autoSaveFingerprint = JSON.stringify([
    name, ownerName, slug, phone, pixKey, pixHolder, address,
    openHour, closeHour, breakEnabled, breakStart, breakEnd, closedPeriods,
    primaryColor, accentColor, backgroundColor, surfaceColor, themePreset,
    uiBorderRadius, uiSurfaceStyle, coverImageUrl, logoImageUrl, galleryImages, socialLinks,
    tvEnabled, tvMediaType, tvMediaUrl, tvVisualMode, tvAnimations, tvNotice,
    tvShowClientNames, tvShowPrices, tvSoundEnabled, tvSoundVolume, tvSoundStyle,
    confirmTemplate, reminderTemplate, thanksTemplate, inactiveTemplate,
  ]);
  const lastAutoSaveFingerprintRef = useRef(autoSaveFingerprint);

  useEffect(() => {
    if (autoSaveFingerprint === lastAutoSaveFingerprintRef.current) return;
    lastAutoSaveFingerprintRef.current = autoSaveFingerprint;

    const hasInvalidAppearanceField = section === 'appearance' && (
      galleryImages.some((image) => !isSafePublicUrl(image.image_url))
      || SOCIAL_LINK_KEYS.some((key) => socialLinks[key].trim() && !isSafePublicUrl(socialLinks[key]))
    );
    const hasInvalidBreak = section === 'general' && breakEnabled && (
      !breakStart || !breakEnd || breakStart >= breakEnd
      || breakStart < openHour || breakEnd > closeHour
    );
    if (hasInvalidAppearanceField || hasInvalidBreak) return;

    const nextOrg = buildUpdatedOrg();
    if (JSON.stringify(nextOrg) === JSON.stringify(org)) return;

    setOrg(nextOrg);
    setSavedSuccess(true);
    if (savedSuccessTimerRef.current) clearTimeout(savedSuccessTimerRef.current);
    savedSuccessTimerRef.current = setTimeout(() => setSavedSuccess(false), 3000);
  }, [autoSaveFingerprint, section]);

  useEffect(() => () => {
    if (savedSuccessTimerRef.current) clearTimeout(savedSuccessTimerRef.current);
  }, []);

  const handleApplyPreset = (preset: ThemePreset) => {
    setThemePreset(preset.id);
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
    setBackgroundColor(preset.background);
    setSurfaceColor(preset.surface);
    setUiSurfaceStyle(preset.surfaceStyle);
    setUiBorderRadius(preset.borderRadius);
  };

  const resolveClosureTimes = () => {
    if (closureMode === 'all_day') return { allDay: true, start: openHour, end: closeHour };
    if (closureMode === 'morning') {
      const end = breakEnabled && breakStart > openHour ? breakStart : (openHour < '12:00' ? '12:00' : closeHour);
      return { allDay: false, start: openHour, end };
    }
    if (closureMode === 'afternoon') {
      const start = breakEnabled && breakEnd < closeHour ? breakEnd : (openHour < '12:00' ? '12:00' : openHour);
      return { allDay: false, start, end: closeHour };
    }
    return { allDay: false, start: closureStart, end: closureEnd };
  };

  const handleAddClosure = () => {
    if (!closureDate) {
      alert('Escolha a data do fechamento.');
      return;
    }
    const { allDay, start, end } = resolveClosureTimes();
    if (!allDay) {
      if (!start || !end || start >= end) {
        alert('Defina um período de fechamento válido.');
        return;
      }
      if (start < openHour || end > closeHour) {
        alert('O fechamento excepcional precisa ficar dentro do horário normal de funcionamento.');
        return;
      }
    }

    const period: BusinessClosurePeriod = {
      id: `close-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: closureDate,
      start,
      end,
      all_day: allDay,
      reason: closureReason.trim() || 'Fechado excepcionalmente',
    };
    const next = [...closedPeriods, period].sort((a, b) => `${a.date}-${a.start || ''}`.localeCompare(`${b.date}-${b.start || ''}`));
    setClosedPeriods(next);
    setOrg(buildUpdatedOrg(next));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRemoveClosure = (id: string) => {
    const next = closedPeriods.filter((period) => period.id !== id);
    setClosedPeriods(next);
    setOrg(buildUpdatedOrg(next));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddGalleryImage = () => {
    if (galleryImages.length >= PUBLIC_GALLERY_LIMIT) return;
    setGalleryImages((items) => [
      ...items,
      { id: `gallery-${crypto.randomUUID()}`, image_url: '', caption: '', alt_text: '' },
    ]);
  };

  const updateGalleryImage = (id: string, field: 'image_url' | 'caption' | 'alt_text', value: string) => {
    setGalleryImages((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const moveGalleryImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= galleryImages.length) return;
    setGalleryImages((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeGalleryImage = (id: string) => {
    setGalleryImages((items) => items.filter((item) => item.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (section === 'appearance') {
      const invalidGalleryIndex = galleryImages.findIndex((image) => !isSafePublicUrl(image.image_url));
      if (invalidGalleryIndex >= 0) {
        alert(`Informe um link HTTPS válido na foto ${invalidGalleryIndex + 1} do carrossel.`);
        return;
      }
      const invalidSocialKey = SOCIAL_LINK_KEYS.find((key) => socialLinks[key].trim() && !isSafePublicUrl(socialLinks[key]));
      if (invalidSocialKey) {
        alert('Os links das redes sociais precisam começar com https:// e ser válidos.');
        return;
      }
    }

    if (section === 'general' && breakEnabled) {
      if (!breakStart || !breakEnd || breakStart >= breakEnd) {
        alert('Defina um intervalo de descanso válido. O horário final precisa ser depois do horário inicial.');
        return;
      }
      if (breakStart < openHour || breakEnd > closeHour) {
        alert('O período de descanso precisa ficar dentro do horário de funcionamento da barbearia.');
        return;
      }
    }

    const nextOrg = buildUpdatedOrg();
    setOrg(nextOrg);

    const tvResult = await saveTvSettingsToCloud(nextOrg);
    if (!tvResult.ok) {
      alert(tvResult.error || 'As configurações foram alteradas no painel, mas não foi possível atualizar a TV na nuvem.');
      return;
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleEnableNotifications = async () => {
    setIsEnablingNotifications(true);
    setNotificationMessage('Ativando notificações...');
    const result = await enablePushNotifications();
    setIsEnablingNotifications(false);
    setNotificationEnabled(result.status === 'enabled');
    setNotificationMessage(result.message);
  };

  const handleRestoreCloudBackup = async () => {
    if (!window.confirm('Restaurar o último backup da nuvem? Os dados atuais serão substituídos pelo snapshot de segurança mais recente.')) return;
    setIsRestoringCloud(true);
    setCloudRestoreMessage('');
    try {
      const data = await restoreLastCloudBackup();
      if (!data.org) throw new Error('Backup sem dados da barbearia.');
      localStorage.setItem('agendai_current_org', JSON.stringify(data.org));
      localStorage.setItem('agendai_all_orgs', JSON.stringify(data.savedOrgs || [data.org]));
      localStorage.setItem('agendai_services', JSON.stringify(data.services || []));
      localStorage.setItem('agendai_barbers', JSON.stringify(data.barbers || []));
      localStorage.setItem('agendai_appointments', JSON.stringify(data.appointments || []));
      localStorage.setItem('agendai_clients', JSON.stringify(data.clients || []));
      setCloudRestoreMessage('✅ Backup restaurado. Recarregando...');
      setTimeout(() => window.location.reload(), 700);
    } catch (error: any) {
      setCloudRestoreMessage(`⚠️ ${error?.message || 'Não foi possível restaurar o backup.'}`);
    } finally {
      setIsRestoringCloud(false);
    }
  };

  const handleCopyPublicLink = () => {
    void publicClipboard.copy(publicLink);
  };

  const handleCopyTvLink = () => {
    void tvClipboard.copy(tvLink);
  };

  const handleCopyMobileLink = () => {
    void mobileClipboard.copy(generateMobileSyncLink());
  };

  const handleExportBackup = () => {
    const backup = {
      org,
      savedOrgs: JSON.parse(localStorage.getItem('agendai_all_orgs') || '[]'),
      services: JSON.parse(localStorage.getItem('agendai_services') || '[]'),
      barbers: JSON.parse(localStorage.getItem('agendai_barbers') || '[]'),
      appointments: JSON.parse(localStorage.getItem('agendai_appointments') || '[]'),
      clients: JSON.parse(localStorage.getItem('agendai_clients') || '[]'),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${org.slug}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.org) localStorage.setItem('agendai_current_org', JSON.stringify(parsed.org));
      if (parsed.savedOrgs) localStorage.setItem('agendai_all_orgs', JSON.stringify(parsed.savedOrgs));
      if (parsed.services) localStorage.setItem('agendai_services', JSON.stringify(parsed.services));
      if (parsed.barbers) localStorage.setItem('agendai_barbers', JSON.stringify(parsed.barbers));
      if (parsed.appointments) localStorage.setItem('agendai_appointments', JSON.stringify(parsed.appointments));
      if (parsed.clients) localStorage.setItem('agendai_clients', JSON.stringify(parsed.clients));
      localStorage.setItem('agendai_session_active', 'true');
      alert('✅ Backup restaurado com sucesso! A página será atualizada.');
      window.location.reload();
    } catch {
      alert('❌ Erro: Formato de JSON de backup inválido.');
    }
  };

  const previewIsLight = isLightColor(backgroundColor);
  const previewRadiusPx = uiBorderRadius === 'compact' ? '8px' : uiBorderRadius === 'soft' ? '24px' : '16px';
  const previewButtonRadius = uiBorderRadius === 'compact' ? '6px' : uiBorderRadius === 'soft' ? '999px' : '12px';

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-5xl">
      {(publicClipboard.error || mobileClipboard.error || tvClipboard.error) && <p role="status" className="text-sm text-amber-500">{publicClipboard.error || mobileClipboard.error || tvClipboard.error}</p>}
      <div className="bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            {section === 'appearance' ? <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" /> : <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />}
            {section === 'appearance' ? 'Aparência da Barbearia' : 'Perfil, Horários e Recursos'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {section === 'appearance'
              ? 'Personalize temas, cores, superfícies, cantos e confira o resultado antes de salvar.'
              : 'Atualize os dados do estabelecimento, horários, notificações, integrações e segurança.'}
          </p>
        </div>
      </div>

      {/* NOTIFICAÇÕES ANDROID / IOS */}
      {section === 'general' && (
      <div className="bg-[#121B2E] border border-slate-800 p-5 sm:p-6 rounded-3xl space-y-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Notificações de Novos Agendamentos</h3>
              <p className="text-xs text-slate-400 mt-1">
                Receba alerta do sistema no Android e no iPhone quando entrar um novo agendamento.
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${notificationEnabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
            {notificationEnabled ? 'ATIVAS' : 'DESATIVADAS'}
          </span>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-300 flex gap-2.5">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            No iPhone/iPad, adicione o AgendAI à <strong className="text-white">Tela de Início</strong>, abra pelo ícone e faça login novamente. Depois toque no botão abaixo para permitir as notificações. No Android, Chrome/PWA pode ativar diretamente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={isEnablingNotifications || notificationEnabled}
            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isEnablingNotifications ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
            {notificationEnabled ? 'Notificações Ativas' : 'Ativar Notificações neste Aparelho'}
          </button>
          <p className={`text-xs ${notificationEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>{notificationMessage}</p>
        </div>
      </div>
      )}

      {/* PERSONALIZAÇÃO AVANÇADA DE TEMA E IDENTIDADE VISUAL */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="fixed bottom-6 right-6 z-40 hidden md:flex items-center justify-end gap-3 pointer-events-none">
          {savedSuccess && (
            <span className="pointer-events-auto rounded-xl border border-emerald-500/30 bg-[#121B2E]/95 px-3 py-2.5 text-xs font-semibold text-emerald-400 shadow-xl backdrop-blur flex items-center gap-1">
              <Check className="w-4 h-4" /> Salvo com sucesso!
            </span>
          )}
          <button type="submit" className="pointer-events-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xl shadow-black/30 active:scale-98">
            {section === 'appearance' ? 'Salvar Aparência' : 'Salvar Configurações'}
          </button>
        </div>

        {section === 'appearance' && (
        <div className="bg-[#121B2E] border border-slate-800 p-5 sm:p-7 rounded-3xl space-y-7 shadow-xl">
          {/* CABEÇALHO DO TEMA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Estilo Visual & Personalização de Temas</h3>
                <p className="text-xs text-slate-400 mt-0.5">Escolha uma atmosfera calibrada por nicho ou ajuste manualmente cada detalhe da sua marca.</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0B1120] border border-slate-800 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300 font-medium">{THEME_PRESETS.length} Coleções Prontas</span>
            </div>
          </div>

          {/* 1. COLEÇÕES DE TEMAS PRONTOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                1. Coleções Prontas por Nicho
              </h4>
              <span className="text-[11px] text-slate-500">Clique para aplicar instantaneamente</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isSelected = themePreset === preset.id || (
                  primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                  backgroundColor.toLowerCase() === preset.background.toLowerCase()
                );

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`rounded-2xl border p-3 text-left transition-all relative overflow-hidden group active:scale-95 ${
                      isSelected
                        ? 'border-emerald-400 ring-2 ring-emerald-400/25 bg-emerald-500/10 shadow-lg'
                        : 'border-slate-800 bg-[#0B1120] hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="h-10 rounded-xl overflow-hidden flex border border-white/10 shadow-inner p-1 gap-1"
                      style={{ backgroundColor: preset.background }}
                    >
                      <div className="w-1/3 h-full rounded-lg shadow-sm" style={{ backgroundColor: preset.primary }} />
                      <div className="w-1/4 h-full rounded-lg opacity-80" style={{ backgroundColor: preset.accent }} />
                      <div className="flex-1 h-full rounded-lg border border-white/5" style={{ backgroundColor: preset.surface }} />
                    </div>

                    <div className="mt-2.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-white truncate block">{preset.name}</strong>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-emerald-400/90 font-semibold block truncate">{preset.niche}</span>
                      <span className="text-[9px] text-slate-500 block truncate">{preset.tag}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. AJUSTES FINOS DE CORES */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              2. Ajuste Fino de Cores
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Cor Principal (Marca)', value: primaryColor, setter: setPrimaryColor, desc: 'Botões, ícones e destaque ativo' },
                { label: 'Cor de Destaque (Acento)', value: accentColor, setter: setAccentColor, desc: 'Gradientes e badges complementares' },
                { label: 'Fundo do Aplicativo', value: backgroundColor, setter: setBackgroundColor, desc: 'Claro ativa o tema light completo' },
                { label: 'Superfície dos Cards', value: surfaceColor, setter: setSurfaceColor, desc: 'Painéis, modais e cartões' },
              ].map((item) => (
                <label key={item.label} className="bg-[#0B1120] border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3.5 cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      value={item.value}
                      onChange={(e) => {
                        setThemePreset('custom');
                        item.setter(e.target.value);
                      }}
                      className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-slate-300 block truncate">{item.label}</span>
                    <span className="text-xs font-mono uppercase text-emerald-400 font-semibold">{item.value}</span>
                    <span className="text-[9px] text-slate-500 block truncate mt-0.5">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 3. PERSONALIDADE DA INTERFACE */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layout className="w-3.5 h-3.5 text-emerald-400" />
              3. Personalidade da Interface (UI/UX)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0B1120] p-4 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Arredondamento das Bordas</span>
                  <span className="text-[10px] text-slate-400">
                    {uiBorderRadius === 'compact' ? 'Tech / Reto (8px)' : uiBorderRadius === 'soft' ? 'Orgânico / Suave (24px)' : 'Padrão Moderno (16px)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'compact', label: 'Compacto', sub: 'Tech / Sharp' },
                    { id: 'standard', label: 'Padrão', sub: 'Equilibrado' },
                    { id: 'soft', label: 'Orgânico', sub: 'Soft / Pill' },
                  ].map((rad) => (
                    <button
                      key={rad.id}
                      type="button"
                      onClick={() => setUiBorderRadius(rad.id as UiBorderRadius)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        uiBorderRadius === rad.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <strong className="block text-xs leading-tight">{rad.label}</strong>
                      <span className="block text-[9px] text-slate-500 mt-0.5">{rad.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0B1120] p-4 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Acabamento dos Painéis</span>
                  <span className="text-[10px] text-slate-400">
                    {uiSurfaceStyle === 'glass' ? 'Glassmorphism (Vidro)' : uiSurfaceStyle === 'glow' ? 'Neon Glow (Iluminado)' : 'Sólido Profundo'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'solid', label: 'Sólido', sub: 'Opaco profundo' },
                    { id: 'glass', label: 'Glass', sub: 'Vidro translúcido' },
                    { id: 'glow', label: 'Neon Glow', sub: 'Borda iluminada' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setUiSurfaceStyle(style.id as UiSurfaceStyle)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        uiSurfaceStyle === style.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <strong className="block text-xs leading-tight">{style.label}</strong>
                      <span className="block text-[9px] text-slate-500 mt-0.5">{style.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. SIMULADOR EM TEMPO REAL */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkle className="w-3.5 h-3.5 text-amber-400" />
                4. Simulador em Tempo Real (Preview ao Vivo)
              </h4>

              <div className="flex items-center gap-1.5 bg-[#0B1120] p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPreviewTab('dashboard')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    previewTab === 'dashboard'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Painel do Salão
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('booking')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    previewTab === 'booking'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Página do Cliente
                </button>
              </div>
            </div>

            <div
              className="rounded-3xl border border-slate-700/80 p-4 sm:p-6 transition-all duration-300 shadow-2xl overflow-hidden relative"
              style={{
                backgroundColor,
                color: previewIsLight ? '#172033' : '#FFFFFF',
              }}
            >
              <div
                className="absolute -top-12 -left-12 w-48 h-48 rounded-full opacity-20 pointer-events-none blur-3xl"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full opacity-15 pointer-events-none blur-3xl"
                style={{ backgroundColor: accentColor }}
              />

              {previewTab === 'dashboard' ? (
                <div className="space-y-4 relative z-10">
                  <div
                    className="p-3.5 flex items-center justify-between border transition-all"
                    style={{
                      backgroundColor: surfaceColor,
                      borderColor: uiSurfaceStyle === 'glow' ? primaryColor : 'rgba(148,163,184,0.15)',
                      borderRadius: previewRadiusPx,
                      boxShadow: uiSurfaceStyle === 'glow' ? `0 0 20px -5px ${primaryColor}40` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
                        style={{ backgroundColor: primaryColor, color: getReadableTextColor(primaryColor) }}
                      >
                        <Scissors className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-xs block leading-tight">{name || 'Minha Barbearia'}</strong>
                        <span className="text-[10px] opacity-70">Resumo do dia</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg"
                        style={{
                          backgroundColor: `${primaryColor}20`,
                          color: primaryColor,
                          border: `1px solid ${primaryColor}40`,
                        }}
                      >
                        Online
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="p-3.5 border transition-all"
                      style={{
                        backgroundColor: surfaceColor,
                        borderColor: uiSurfaceStyle === 'glow' ? `${primaryColor}60` : 'rgba(148,163,184,0.15)',
                        borderRadius: previewRadiusPx,
                      }}
                    >
                      <p className="text-[10px] uppercase font-bold opacity-60">Faturamento Hoje</p>
                      <p className="text-xl font-black font-mono mt-1" style={{ color: primaryColor }}>
                        R$ 480,00
                      </p>
                      <span className="text-[9px] opacity-70">8 atendimentos concluídos</span>
                    </div>

                    <div
                      className="p-3.5 border transition-all"
                      style={{
                        backgroundColor: surfaceColor,
                        borderColor: uiSurfaceStyle === 'glow' ? `${accentColor}60` : 'rgba(148,163,184,0.15)',
                        borderRadius: previewRadiusPx,
                      }}
                    >
                      <p className="text-[10px] uppercase font-bold opacity-60">Próximo Cliente</p>
                      <p className="text-sm font-bold mt-1 truncate">Carlos Eduardo</p>
                      <span className="text-[10px] font-mono font-bold" style={{ color: accentColor }}>15:00 · Corte + Barba</span>
                    </div>
                  </div>

                  <div
                    className="p-3.5 border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: surfaceColor,
                      borderColor: 'rgba(148,163,184,0.15)',
                      borderRadius: previewRadiusPx,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" style={{ color: primaryColor }} />
                      <span className="text-xs font-semibold">Cliente na recepção: Lucas M.</span>
                    </div>

                    <button
                      type="button"
                      className="px-3.5 py-1.5 text-xs font-bold transition-all shadow-md active:scale-95"
                      style={{
                        backgroundColor: primaryColor,
                        color: getReadableTextColor(primaryColor),
                        borderRadius: previewButtonRadius,
                      }}
                    >
                      Iniciar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 relative z-10 max-w-sm mx-auto">
                  <div
                    className="p-4 border text-center space-y-3"
                    style={{
                      backgroundColor: surfaceColor,
                      borderColor: uiSurfaceStyle === 'glow' ? primaryColor : 'rgba(148,163,184,0.15)',
                      borderRadius: previewRadiusPx,
                    }}
                  >
                    <div
                      className="w-14 h-14 mx-auto rounded-full flex items-center justify-center border shadow-lg"
                      style={{
                        backgroundColor: `${primaryColor}20`,
                        borderColor: `${primaryColor}50`,
                        color: primaryColor,
                      }}
                    >
                      <Scissors className="w-6 h-6" />
                    </div>

                    <div>
                      <h5 className="font-black text-sm">{name || 'Barbearia Exemplo'}</h5>
                      <p className="text-[10px] opacity-70 mt-0.5">Agendamento online rápido e sem filas</p>
                    </div>

                    <div
                      className="p-2.5 rounded-xl border flex items-center justify-between text-left"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}50`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: primaryColor, color: getReadableTextColor(primaryColor) }}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <div>
                          <strong className="text-xs block">Corte Degrade Navalhado</strong>
                          <span className="text-[9px] opacity-70">30 minutos</span>
                        </div>
                      </div>
                      <span className="font-bold text-xs font-mono" style={{ color: primaryColor }}>R$ 45,00</span>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2.5 text-xs font-black transition-all shadow-lg active:scale-95"
                      style={{
                        backgroundColor: primaryColor,
                        color: getReadableTextColor(primaryColor),
                        borderRadius: previewButtonRadius,
                      }}
                    >
                      Continuar Agendamento
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* PERFIL DO ESTABELECIMENTO */}
        <div className="bg-[#121B2E] p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-5">
          <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            {section === 'appearance' ? <ImageIcon className="w-5 h-5 text-cyan-300" /> : <Building2 className="w-5 h-5 text-emerald-400" />}
            {section === 'appearance' ? 'Identidade Visual e Página Pública' : 'Perfil do Estabelecimento'}
          </h3>

          {section === 'general' && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-field-1" className="block text-xs font-semibold text-slate-300 mb-1.5">Nome da Barbearia *</label>
              <input id="settings-field-1" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="settings-field-2" className="block text-xs font-semibold text-slate-300 mb-1.5">Nome do Responsável</label>
              <input id="settings-field-2" type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Ex: Felipe Mateus" className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label htmlFor="settings-field-3" className="block text-xs font-semibold text-slate-300 mb-1.5">Link / Slug da Barbearia</label>
            <input id="settings-field-3" type="text" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-emerald-400 focus:border-emerald-500 focus:outline-none font-mono" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-field-4" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp da Barbearia *</label>
              <input id="settings-field-4" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(84) 99999-0000" className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="settings-field-5" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> Endereço Físico</label>
              <input id="settings-field-5" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua Central, 120 - Centro" className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>
          </>
          )}

          {section === 'appearance' && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-field-6" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> Imagem de capa da página do cliente</label>
              <input id="settings-field-6" type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://.../foto-da-barbearia.jpg" className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
              <p className="text-[10px] text-slate-500 mt-1.5">Opcional. Uma imagem horizontal deixa a página pública com aparência de vitrine profissional.</p>
            </div>
            <div>
              <label htmlFor="settings-field-7" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> Logo do estabelecimento</label>
              <input id="settings-field-7" type="url" value={logoImageUrl} onChange={(e) => setLogoImageUrl(e.target.value)} placeholder="https://.../logo.png" className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none" />
              <p className="text-[10px] text-slate-500 mt-1.5">Usado no modo institucional da TV. Prefira PNG com fundo transparente.</p>
            </div>
          </div>

          <div className="bg-[#0B1120] p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Carrossel da página pública</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Adicione até {PUBLIC_GALLERY_LIMIT} fotos. A ordem abaixo será a mesma exibida para os clientes.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddGalleryImage}
                disabled={galleryImages.length >= PUBLIC_GALLERY_LIMIT}
                className="px-3 py-2 rounded-xl bg-cyan-400 text-slate-950 text-[11px] font-black flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar foto
              </button>
            </div>

            {galleryImages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center">
                <ImageIcon className="w-7 h-7 text-slate-700 mx-auto" />
                <p className="text-xs font-semibold text-slate-300 mt-2">Nenhuma foto no carrossel</p>
                <p className="text-[10px] text-slate-500 mt-1">A página pública continua funcionando normalmente com a capa atual.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {galleryImages.map((image, index) => (
                  <div key={image.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="w-full sm:w-32 aspect-[16/9] sm:aspect-[4/3] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shrink-0">
                        {isSafePublicUrl(image.image_url) ? (
                          <img src={image.image_url} alt="Prévia da foto" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Foto {index + 1}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveGalleryImage(index, -1)} disabled={index === 0} aria-label={`Mover foto ${index + 1} para cima`} title="Mover para cima" className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => moveGalleryImage(index, 1)} disabled={index === galleryImages.length - 1} aria-label={`Mover foto ${index + 1} para baixo`} title="Mover para baixo" className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => removeGalleryImage(image.id)} aria-label={`Excluir foto ${index + 1}`} title="Excluir foto" className="w-8 h-8 rounded-lg border border-rose-500/25 bg-rose-500/10 flex items-center justify-center text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <input type="url" required value={image.image_url} onChange={(e) => updateGalleryImage(image.id, 'image_url', e.target.value)} placeholder="https://.../ambiente.jpg" className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <input type="text" maxLength={120} value={image.caption || ''} onChange={(e) => updateGalleryImage(image.id, 'caption', e.target.value)} placeholder="Legenda opcional" className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none" />
                          <input type="text" maxLength={160} value={image.alt_text || ''} onChange={(e) => updateGalleryImage(image.id, 'alt_text', e.target.value)} placeholder="Descrição da imagem (acessibilidade)" className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-800 pt-5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2"><Share2 className="w-4 h-4 text-emerald-400" /> Redes sociais e links públicos</h4>
                <p className="text-[10px] text-slate-500 mt-1">Preencha apenas os canais que deseja mostrar. Os botões ficam visíveis abaixo do carrossel.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SOCIAL_LINK_FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
                  <label key={key} className="block">
                    <span className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-emerald-400" /> {label}</span>
                    <input type="url" value={socialLinks[key]} onChange={(e) => setSocialLinks((links) => ({ ...links, [key]: e.target.value }))} placeholder={placeholder} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none" />
                  </label>
                ))}
              </div>
            </div>
          </div>
          </>
          )}

          {section === 'general' && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B1120] p-3.5 sm:p-4 rounded-2xl border border-slate-800">
            <div>
              <label htmlFor="settings-field-8" className="block text-xs font-semibold text-slate-300 mb-1.5">Chave Pix do Estabelecimento</label>
              <input id="settings-field-8" type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatória" className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
              <p className="text-[10px] text-slate-500 mt-1">Essa chave será incluída automaticamente na mensagem de confirmação enviada ao cliente.</p>
            </div>
            <div>
              <label htmlFor="settings-field-9" className="block text-xs font-semibold text-slate-300 mb-1.5">Titular do Pix</label>
              <input id="settings-field-9" type="text" value={pixHolder} onChange={(e) => setPixHolder(e.target.value)} placeholder={name || 'Nome do estabelecimento'} className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>

          <div className="bg-[#0B1120] p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="settings-field-10" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-400" /> Horário Abertura</label>
                <input id="settings-field-10" type="time" value={openHour} onChange={(e) => setOpenHour(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono" />
              </div>
              <div>
                <label htmlFor="settings-field-11" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-400" /> Horário Fechamento</label>
                <input id="settings-field-11" type="time" value={closeHour} onChange={(e) => setCloseHour(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">Descanso / Horário de Almoço</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Ao ativar, nenhum cliente poderá agendar dentro desse intervalo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBreakEnabled(value => !value)}
                  className={`app-toggle relative w-12 h-7 rounded-full border transition-colors shrink-0 ${breakEnabled ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'}`}
                  aria-pressed={breakEnabled}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${breakEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {breakEnabled && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-fadeIn">
                  <div>
                    <label htmlFor="settings-field-12" className="block text-xs font-medium text-slate-400 mb-1">Início do descanso</label>
                    <input id="settings-field-12" type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label htmlFor="settings-field-13" className="block text-xs font-medium text-slate-400 mb-1">Fim do descanso</label>
                    <input id="settings-field-13" type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
                  <CalendarOff className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Fechamento excepcional</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Use quando não abrir em um dia ou período específico. A página pública informa o cliente e bloqueia esses horários automaticamente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400">Data</span>
                  <input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400">Motivo exibido ao cliente</span>
                  <input type="text" value={closureReason} onChange={(e) => setClosureReason(e.target.value)} placeholder="Ex: Fechado excepcionalmente" className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none" />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['all_day', 'Dia inteiro'],
                  ['morning', 'Manhã'],
                  ['afternoon', 'Tarde'],
                  ['custom', 'Personalizado'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const nextMode = value as 'all_day' | 'morning' | 'afternoon' | 'custom';
                      setClosureMode(nextMode);
                      if (nextMode === 'custom') {
                        setClosureStart(openHour);
                        setClosureEnd(closeHour);
                      }
                    }}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-bold transition-colors ${closureMode === value ? 'bg-amber-400/15 border-amber-400/35 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {closureMode === 'custom' && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400">Fechar a partir de</span>
                    <input type="time" value={closureStart} onChange={(e) => setClosureStart(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400">Reabrir às</span>
                    <input type="time" value={closureEnd} onChange={(e) => setClosureEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none" />
                  </label>
                </div>
              )}

              <button type="button" onClick={handleAddClosure} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-2 transition-colors">
                <CalendarOff className="w-4 h-4" /> Fechar este período
              </button>

              {closedPeriods.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Fechamentos cadastrados</p>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {closedPeriods.slice().sort((a, b) => `${a.date}-${a.start || ''}`.localeCompare(`${b.date}-${b.start || ''}`)).map((period) => (
                      <div key={period.id} className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">{formatClosureDate(period.date)} • {period.all_day ? 'Dia inteiro' : `${period.start}–${period.end}`}</p>
                          <p className="text-[10px] text-amber-200/80 truncate mt-0.5">{period.reason || 'Fechado excepcionalmente'}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveClosure(period.id)} className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 shrink-0" title="Reabrir/remover fechamento">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="settings-tv-panel bg-gradient-to-br from-cyan-950/30 to-[#0B1120] p-4 sm:p-5 rounded-2xl border border-cyan-400/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0"><Tv2 className="w-5 h-5 text-cyan-300" /></div>
                <div>
                  <h4 className="text-sm font-bold text-white">Modo TV • Painel de Espera</h4>
                  <p className="text-[11px] text-slate-400 mt-1">Abra um link exclusivo na Smart TV, TV Box ou computador da recepção. O painel mostra somente dados próprios para exibição pública.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTvEnabled((value) => !value)}
                className={`app-toggle relative w-12 h-7 rounded-full border transition-colors shrink-0 ${tvEnabled ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'}`}
                aria-pressed={tvEnabled}
                title={tvEnabled ? 'Desativar tela da TV' : 'Ativar tela da TV'}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${tvEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center shrink-0"><Music2 className="w-4 h-4 text-violet-300" /></div>
                <div>
                  <strong className="block text-xs text-white">Mídia da recepção</strong>
                  <span className="block text-[10px] text-slate-500 mt-0.5">Use YouTube, Spotify, Apple Music, um áudio direto ou deixe a TV somente no modo institucional.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">Fonte da mídia</span>
                  <select
                    value={tvMediaType}
                    onChange={(e) => {
                      const value = e.target.value as 'youtube' | 'spotify' | 'apple_music' | 'audio' | 'institutional';
                      setTvMediaType(value);
                      if (value === 'institutional' && tvVisualMode === 'player_queue') setTvVisualMode('brand_products_queue');
                    }}
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="spotify">Spotify</option>
                    <option value="apple_music">Apple Music</option>
                    <option value="audio">Áudio / rádio por URL</option>
                    <option value="institutional">Sem mídia • Institucional</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">Visual da TV</span>
                  <select
                    value={tvVisualMode}
                    onChange={(e) => setTvVisualMode(e.target.value as 'player_queue' | 'brand_queue' | 'brand_products_queue')}
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="player_queue" disabled={tvMediaType === 'institutional'}>Player grande + fila</option>
                    <option value="brand_queue">Logo da empresa + fila</option>
                    <option value="brand_products_queue">Player + produtos + fila</option>
                  </select>
                </label>
              </div>

              {tvMediaType !== 'institutional' && (
                <label className="space-y-1.5 block animate-fadeIn">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    {tvMediaType === 'youtube' ? <Youtube className="w-3.5 h-3.5 text-rose-400" /> : <Music2 className="w-3.5 h-3.5 text-violet-300" />}
                    {tvMediaType === 'youtube' ? 'Link do vídeo ou playlist' : tvMediaType === 'spotify' ? 'Link do Spotify' : tvMediaType === 'apple_music' ? 'Link do Apple Music' : 'URL direta do áudio ou rádio'}
                  </span>
                  <input
                    type="url"
                    value={tvMediaUrl}
                    onChange={(e) => setTvMediaUrl(e.target.value)}
                    placeholder={tvMediaType === 'youtube' ? 'https://youtube.com/playlist?list=...' : tvMediaType === 'spotify' ? 'https://open.spotify.com/playlist/...' : tvMediaType === 'apple_music' ? 'https://music.apple.com/br/playlist/...' : 'https://servidor.com/radio.mp3'}
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <span className="block text-[10px] text-slate-500">
                    {tvMediaType === 'audio'
                      ? 'Use o endereço direto do stream de áudio. Links de páginas de portais como Radios.com.br não são arquivos de áudio e não tocam no player.'
                      : 'Spotify/Apple Music podem pedir um toque inicial no player.'}
                  </span>
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => setTvAnimations((value) => !value)} className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${tvAnimations ? 'border-violet-400/30 bg-violet-400/10' : 'border-slate-700 bg-slate-900/70'}`}>
                  <Sparkles className={`w-4 h-4 ${tvAnimations ? 'text-violet-300' : 'text-slate-500'}`} />
                  <span><strong className="block text-xs text-white">Cards animados</strong><span className="block text-[10px] text-slate-500 mt-0.5">Alterna destaques e produtos suavemente na tela.</span></span>
                </button>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">Aviso exibido na TV</span>
                  <textarea rows={3} value={tvNotice} onChange={(e) => setTvNotice(e.target.value)} placeholder="Ex: Aproveite nosso café enquanto aguarda seu atendimento." className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none resize-y" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setTvShowClientNames((value) => !value)} className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${tvShowClientNames ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-slate-700 bg-slate-900/70'}`}>
                {tvShowClientNames ? <Eye className="w-4 h-4 text-cyan-300" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                <span><strong className="block text-xs text-white">Mostrar nome abreviado</strong><span className="block text-[10px] text-slate-500 mt-0.5">Exibe “João M.”. Desativado mostra “Cliente 01”.</span></span>
              </button>
              <button type="button" onClick={() => setTvShowPrices((value) => !value)} className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${tvShowPrices ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-slate-700 bg-slate-900/70'}`}>
                <DollarSign className={`w-4 h-4 ${tvShowPrices ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span><strong className="block text-xs text-white">Mostrar valores</strong><span className="block text-[10px] text-slate-500 mt-0.5">Por padrão os valores ficam ocultos na recepção.</span></span>
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/50 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white">Som para novo agendamento</strong>
                    <span className="block text-[10px] text-slate-500 mt-0.5">A TV toca uma campainha somente quando detectar um novo atendimento. Na primeira abertura da TV, toque em “Ativar som”.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTvSoundEnabled((value) => !value)}
                  className={`app-toggle relative w-12 h-7 rounded-full border transition-colors shrink-0 ${tvSoundEnabled ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'}`}
                  aria-pressed={tvSoundEnabled}
                  title={tvSoundEnabled ? 'Desativar som da TV' : 'Ativar som da TV'}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${tvSoundEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {tvSoundEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">Tipo de som</span>
                    <select
                      value={tvSoundStyle}
                      onChange={(e) => setTvSoundStyle(e.target.value as 'bell' | 'soft' | 'attention')}
                      className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="bell">Campainha</option>
                      <option value="soft">Suave</option>
                      <option value="attention">Atenção</option>
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Volume</span>
                      <span className="font-mono text-cyan-300">{tvSoundVolume}%</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={tvSoundVolume}
                      onChange={(e) => setTvSoundVolume(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                    <span className="block text-[10px] text-slate-500">O mesmo agendamento não toca novamente a cada atualização.</span>
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              <input type="text" readOnly value={tvLink} className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[11px] text-cyan-300 font-mono focus:outline-none truncate" />
              <div className="flex gap-2">
                <button type="button" onClick={handleCopyTvLink} className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1.5">
                  {copiedTvLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedTvLink ? 'Copiado!' : 'Copiar link TV'}
                </button>
                <a href={tvLink} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Abrir TV</a>
              </div>
            </div>
          </div>

          <div className="bg-[#0B1120] p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0"><MessageSquareText className="w-4 h-4 text-emerald-400" /></div>
              <div>
                <h4 className="text-xs font-bold text-white">Mensagens rápidas do WhatsApp</h4>
                <p className="text-[10px] text-slate-500 mt-1">Personalize os textos usados nos clientes e agendamentos. Variáveis: {'{cliente}'}, {'{barbearia}'}, {'{data}'}, {'{horario}'}, {'{servico}'}, {'{valor}'}.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[
                ['Confirmação', confirmTemplate, setConfirmTemplate],
                ['Lembrete', reminderTemplate, setReminderTemplate],
                ['Agradecimento', thanksTemplate, setThanksTemplate],
                ['Cliente inativo', inactiveTemplate, setInactiveTemplate],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">{label as string}</span>
                  <textarea rows={3} value={value as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none resize-y" />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedSuccess ? <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> Salvo com sucesso!</span> : <div />}
            <button type="submit" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 active:scale-98">
              Salvar Perfil e Horários
            </button>
          </div>
          </>
          )}

          {section === 'appearance' && (
            <div className="flex items-center justify-between gap-3 pt-2">
              {savedSuccess ? <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> Salvo com sucesso!</span> : <div />}
              <button type="submit" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 active:scale-98">
                Salvar Aparência
              </button>
            </div>
          )}
        </div>
      </form>

      {/* LINK DO CLIENTE E LOGIN NO CELULAR */}
      {section === 'general' && (
      <>
      <div className="settings-links-panel bg-gradient-to-br from-emerald-950/60 to-slate-900 border-2 border-emerald-500/40 p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-emerald-400" /><h3 className="text-sm font-bold text-white">Celular e Link do Cliente</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={handleCopyMobileLink} className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
            {copiedMobileLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copiedMobileLink ? 'Link de Login Copiado!' : 'Copiar Link de Login'}
          </button>
          <button type="button" onClick={handleCopyPublicLink} className="py-3 px-4 bg-slate-900 border border-slate-700 text-emerald-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
            {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}{copiedLink ? 'Link do Cliente Copiado!' : 'Copiar Link do Cliente'}
          </button>
        </div>
        <div className="flex items-center gap-2 bg-[#0B1120] p-2 rounded-2xl border border-slate-800">
          <input type="text" readOnly value={publicLink} className="w-full bg-transparent px-3 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none truncate" />
          <a href={publicLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl" title="Abrir página do cliente"><ExternalLink className="w-4 h-4" /></a>
        </div>
      </div>

      {/* BACKUP E PROTEÇÃO CONTRA ZERAR */}
      <div className="bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Backup e Proteção de Dados</h3>
        <p className="text-xs text-slate-400">A nova proteção bloqueia um aparelho vazio de sobrescrever uma conta que já possui dados na nuvem. Antes de alterações válidas, o servidor também mantém um último snapshot de segurança.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onClick={handleExportBackup} className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-xs text-slate-200 font-semibold flex items-center justify-center gap-2"><Download className="w-4 h-4 text-emerald-400" /> Baixar Backup</button>
          <button type="button" onClick={() => setShowImportBox(!showImportBox)} className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-xs text-slate-200 font-semibold flex items-center justify-center gap-2"><Upload className="w-4 h-4 text-emerald-400" /> Restaurar Arquivo</button>
          <button type="button" onClick={handleRestoreCloudBackup} disabled={isRestoringCloud} className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {isRestoringCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />} Último Backup da Nuvem
          </button>
        </div>
        {cloudRestoreMessage && <p className="text-xs text-slate-300">{cloudRestoreMessage}</p>}

        {showImportBox && (
          <div className="space-y-2 p-3 bg-[#0B1120] rounded-2xl border border-slate-800 animate-fadeIn">
            <label htmlFor="settings-field-14" className="block text-xs text-slate-400">Cole o conteúdo do backup abaixo:</label>
            <textarea id="settings-field-14" value={importJsonText} onChange={(e) => setImportJsonText(e.target.value)} placeholder="Cole o código JSON do backup aqui..." rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none" />
            <button type="button" onClick={handleImportBackup} className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs">Carregar Dados</button>
          </div>
        )}
      </div>

      {/* DEMO / RESET LOCAL */}
      <div className="bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> Ambiente de Demonstração e Reset</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <div><p className="text-xs font-medium text-slate-300">Carregar Dados de Exemplo</p><p className="text-[11px] text-slate-500 mt-0.5">Preenche serviços, barbeiros e agendamentos fictícios.</p></div>
          <button type="button" onClick={() => { if (window.confirm('Carregar dados de demonstração irá substituir os dados atuais. Deseja continuar?')) onLoadDemo({ org: INITIAL_ORG, services: INITIAL_SERVICES, barbers: INITIAL_BARBERS, appointments: INITIAL_APPOINTMENTS }); }} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold border border-slate-700/60">Carregar Demonstração</button>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
          <div><p className="text-xs font-medium text-rose-400">Zerar Dados Locais</p><p className="text-[11px] text-slate-500 mt-0.5">Apaga somente os dados deste navegador.</p></div>
          <button type="button" onClick={() => { if (window.confirm('Atenção: os dados locais serão apagados. Deseja continuar?')) onResetAll(); }} className="px-3.5 py-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-800/40 rounded-xl text-xs font-semibold flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Zerar Local</button>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
