import { getReadableTextColor } from '../utils/color';

export type AppThemeMode = 'dark' | 'light';
export type AppThemePreference = AppThemeMode | 'system';

export const APP_THEME_STORAGE_KEY = 'agendai:theme-mode';

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

export const applyAppTheme = (mode: AppThemeMode, primaryColor = '#10B981'): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(THEME_TOKENS[mode]).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.setProperty('--brand-color', primaryColor);
  root.style.setProperty('--brand-contrast-color', getReadableTextColor(primaryColor));
  root.style.setProperty('--brand-accent', primaryColor);
  root.style.setProperty('--brand-accent-soft', primaryColor);
  root.dataset.appTheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#F7F9FA' : '#070B14');
};
