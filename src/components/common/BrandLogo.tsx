import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  className?: string;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  className = '',
  alt = 'AgendAI',
}) => {
  const isMark = variant === 'mark';
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
