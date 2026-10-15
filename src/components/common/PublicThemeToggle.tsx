import { Moon, Sun } from 'lucide-react';
import type { AppThemeMode } from '../../config/theme';

interface PublicThemeToggleProps {
  mode: AppThemeMode;
  onChange: (mode: AppThemeMode) => void;
  className?: string;
}

/** A mesma escolha de tema para todas as experiências abertas ao cliente. */
export const PublicThemeToggle = ({ mode, onChange, className = '' }: PublicThemeToggleProps) => {
  const isLight = mode === 'light';
  const nextMode: AppThemeMode = isLight ? 'dark' : 'light';

  return (
    <button
      type="button"
      onClick={() => onChange(nextMode)}
      className={`public-theme-toggle inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${className}`}
      aria-label={isLight ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={isLight ? 'Ativar modo escuro' : 'Ativar modo claro'}
    >
      {isLight ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
};
