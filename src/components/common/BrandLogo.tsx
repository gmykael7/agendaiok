import React from 'react';
import { AgendaiLogoFull } from './AgendaiLogoFull';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  className?: string;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps & { tone?: 'auto' | 'dark' }> = ({
  variant = 'full',
  className = '',
  alt = 'AgendAI',
  tone = 'auto',
}) => {
  const isMark = variant === 'mark';

  // Logotipo completo: SVG vetorial que segue o tema do app.
  if (!isMark) return <AgendaiLogoFull className={className} label={alt} tone={tone} />;
  const src = isMark ? '/branding/agendai-mark.png' : '/branding/agendai-logo.png';

  return (
    <img
      src={src}
      alt={alt}
      className={`${isMark ? 'rounded-full object-cover object-center' : 'object-contain'} ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
};
