import { deriveAccentColor, getReadableTextColor } from '../utils/color';

export type AppThemeMode = 'dark' | 'light';
export type AppThemePreference = AppThemeMode | 'system';

export const APP_THEME_STORAGE_KEY = 'agendai:theme-mode';

export interface ModernPalette {
  id: string;
  name: string;
  tagline: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  soft: string;
  colors: [string, string, string, string];
  gradient: string;
  badge?: string;
}

export const MODERN_PALETTES: ModernPalette[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    tagline: 'Azul Cósmico & Lavanda',
    description: 'Inspirado nas auroras boreais: azul elétrico, lavanda e rosa pastel.',
    colors: ['#3B82F6', '#60A5FA', '#A78BFA', '#FBCFE8'],
    primary: '#3B82F6',
    secondary: '#60A5FA',
    accent: '#A78BFA',
    soft: '#FBCFE8',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 33%, #A78BFA 66%, #FBCFE8 100%)',
    badge: 'Popular',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    tagline: 'Pôr do Sol & Âmbar Solar',
    description: 'Energia acolhedora com tons solares de laranja, tangerina e âmbar dourado.',
    colors: ['#EA6113', '#F88F22', '#FBB931', '#FFE3B3'],
    primary: '#EA6113',
    secondary: '#F88F22',
    accent: '#FBB931',
    soft: '#FFE3B3',
    gradient: 'linear-gradient(135deg, #EA6113 0%, #F88F22 33%, #FBB931 66%, #FFE3B3 100%)',
    badge: 'Quente',
  },
  {
    id: 'viola',
    name: 'Viola',
    tagline: 'Violeta Real & Orquídea',
    description: 'Sofisticação e modernidade com violeta profundo, magenta e toque de pêssego.',
    colors: ['#7C3AED', '#C026D3', '#FB923C', '#FFE3B3'],
    primary: '#7C3AED',
    secondary: '#C026D3',
    accent: '#FB923C',
    soft: '#FFE3B3',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #C026D3 33%, #FB923C 66%, #FFE3B3 100%)',
    badge: 'Elegante',
  },
  {
    id: 'luigi',
    name: 'Luigi',
    tagline: 'Esmeralda & Lima Cítrico',
    description: 'Frescor moderno e vibrante com verde esmeralda, folha fresca e toque de lima.',
    colors: ['#FFE3B3', '#C2DD6C', '#79CE67', '#30B155'],
    primary: '#30B155',
    secondary: '#79CE67',
    accent: '#C2DD6C',
    soft: '#FFE3B3',
    gradient: 'linear-gradient(135deg, #FFE3B3 0%, #C2DD6C 33%, #79CE67 66%, #30B155 100%)',
    badge: 'Fresco',
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    tagline: 'Verde Tech AgendAI',
    description: 'Identidade clássica do AgendAI, equilibrada para alta produtividade.',
    colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
    primary: '#10B981',
    secondary: '#34D399',
    accent: '#059669',
    soft: '#6EE7B7',
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 33%, #34D399 66%, #6EE7B7 100%)',
    badge: 'Clássico',
  },
];

export const findModernPalette = (idOrColor?: string): ModernPalette | undefined => {
  if (!idOrColor) return undefined;
  const needle = idOrColor.toLowerCase().trim();
  return MODERN_PALETTES.find(
    (p) =>
      p.id.toLowerCase() === needle ||
      p.name.toLowerCase() === needle ||
      p.primary.toLowerCase() === needle ||
      p.colors.some((c) => c.toLowerCase() === needle)
  );
};

const THEME_TOKENS: Record<AppThemeMode, Record<string, string>> = {
  dark: {
    '--brand-color': '#10B981',
    '--brand-contrast-color': '#07111F',
    '--brand-accent': '#34D399',
    '--brand-accent-soft': '#6EE7B7',
    '--app-bg-color': '#070B14',
    '--app-surface-color': '#121B2E',
    '--app-surface-dark': '#0B1120',
    '--app-surface-elevated': '#1E293B',
  },
  light: {
    '--brand-color': '#0F766E',
    '--brand-contrast-color': '#FFFFFF',
    '--brand-accent': '#0E7490',
    '--brand-accent-soft': '#155E75',
    '--app-bg-color': '#F7F9FA',
    '--app-surface-color': '#FFFFFF',
    '--app-surface-dark': '#FFFFFF',
    '--app-surface-elevated': '#F0F6F4',
  },
};

export const normalizeAppThemeMode = (value: unknown): AppThemeMode =>
  value === 'light' ? 'light' : 'dark';

export const resolveSystemThemeMode = (): AppThemeMode =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const readStoredAppThemePreference = (): AppThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'system';
};

export const readStoredAppThemeMode = (): AppThemeMode => {
  const preference = readStoredAppThemePreference();
  return preference === 'system' ? resolveSystemThemeMode() : preference;
};

export const applyAppTheme = (mode: AppThemeMode, primaryColor = '#10B981', paletteId?: string): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(THEME_TOKENS[mode]).forEach(([name, value]) => root.style.setProperty(name, value));

  const palette = findModernPalette(paletteId) || findModernPalette(primaryColor);
  const brandColor = palette ? palette.primary : primaryColor;
  const brandSecondary = palette ? palette.secondary : brandColor;
  const brandAccent = palette ? palette.accent : deriveAccentColor(brandColor);
  const brandAccentSoft = palette ? palette.soft : brandAccent;
  const brandHighlight = palette ? palette.soft : brandAccent;
  const brandContrast = getReadableTextColor(brandColor);
  const brandGradient = palette
    ? palette.gradient
    : `linear-gradient(135deg, ${brandColor} 0%, ${brandSecondary} 50%, ${brandAccent} 100%)`;
  const brandGradientBtn = palette
    ? `linear-gradient(135deg, ${brandColor} 0%, ${brandSecondary} 100%)`
    : `linear-gradient(135deg, ${brandColor} 0%, ${brandColor} 100%)`;
  const brandGradientCard = palette
    ? `linear-gradient(135deg, color-mix(in srgb, ${brandColor} 14%, transparent), color-mix(in srgb, ${brandAccent} 14%, transparent))`
    : `linear-gradient(135deg, color-mix(in srgb, ${brandColor} 14%, transparent), transparent)`;

  root.style.setProperty('--brand-color', brandColor);
  root.style.setProperty('--brand-secondary', brandSecondary);
  root.style.setProperty('--brand-accent', brandAccent);
  root.style.setProperty('--brand-accent-soft', brandAccentSoft);
  root.style.setProperty('--brand-highlight', brandHighlight);
  root.style.setProperty('--brand-contrast-color', brandContrast);
  root.style.setProperty('--brand-gradient', brandGradient);
  root.style.setProperty('--brand-gradient-btn', brandGradientBtn);
  root.style.setProperty('--brand-gradient-card', brandGradientCard);
  root.dataset.appTheme = mode;
  root.dataset.brandPalette = palette?.id || 'custom';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#F7F9FA' : '#070B14');
};
