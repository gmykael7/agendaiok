import React from 'react';

export interface IconlyProps {
  className?: string;
  active?: boolean;
  variant?: 'bulk' | 'bold' | 'hero';
}

/**
 * Ícones vetoriais inspirados na família Iconly Pro (Bulk / Bold / Animated):
 * - Inativo: Duas camadas de opacidade (Bulk / Two-Tone) com formas orgânicas super arredondadas.
 * - Ativo: Preenchimento sólido (Bold) + microanimação nas partes internas.
 */

export const IconlyHome: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-bounce' : ''}`}
  >
    {active ? (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.334 2.768a2.62 2.62 0 0 1 3.332 0l6.42 5.318A2.85 2.85 0 0 1 21.1 10.28v7.87A3.85 3.85 0 0 1 17.25 22h-2.6a.75.75 0 0 1-.75-.75v-4.1a1.9 1.9 0 0 0-3.8 0v4.1a.75.75 0 0 1-.75.75h-2.6A3.85 3.85 0 0 1 2.9 18.15v-7.87a2.85 2.85 0 0 1 1.014-2.194l6.42-5.318Z"
        fill="currentColor"
      />
    ) : (
      <>
        <path
          d="M10.334 2.768a2.62 2.62 0 0 1 3.332 0l6.42 5.318A2.85 2.85 0 0 1 21.1 10.28v7.87A3.85 3.85 0 0 1 17.25 22H6.75A3.85 3.85 0 0 1 2.9 18.15v-7.87a2.85 2.85 0 0 1 1.014-2.194l6.42-5.318Z"
          fill="currentColor"
          opacity="0.38"
        />
        <path
          d="M12 14.5a2.1 2.1 0 0 1 2.1 2.1V22H9.9v-5.4A2.1 2.1 0 0 1 12 14.5Z"
          fill="currentColor"
        />
      </>
    )}
  </svg>
);

export const IconlyClipboard: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-pop' : ''}`}
  >
    <rect
      x="4"
      y="3.5"
      width="16"
      height="18.5"
      rx="4.8"
      fill="currentColor"
      opacity={active ? '0.92' : '0.35'}
    />
    <rect
      x="8.2"
      y="2"
      width="7.6"
      height="3.6"
      rx="1.8"
      fill="currentColor"
      className={active ? 'opacity-100' : ''}
    />
    <path
      d="M9.2 13.3l2.1 2.1 3.9-4.1"
      stroke={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? 'iconly-check-draw' : ''}
    />
  </svg>
);

export const IconlyCalendar: React.FC<IconlyProps> = ({
  className = 'w-6 h-6',
  active = false,
  variant = 'bulk',
}) => {
  if (variant === 'hero') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} iconly-hero-calendar`}
      >
        <rect
          x="3"
          y="4.5"
          width="18"
          height="16.5"
          rx="5"
          stroke="currentColor"
          strokeWidth="2.1"
          fill="currentColor"
          fillOpacity="0.14"
        />
        <path
          d="M3.5 9.5h17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M8.2 2.8v3.2M15.8 2.8v3.2"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="8.5" cy="13.5" r="1.25" fill="currentColor" className="iconly-dot-1" />
        <circle cx="12" cy="13.5" r="1.25" fill="currentColor" className="iconly-dot-2" />
        <circle cx="15.5" cy="13.5" r="1.25" fill="currentColor" className="iconly-dot-3" />
        <circle cx="8.5" cy="17" r="1.25" fill="currentColor" className="iconly-dot-2" />
        <circle cx="12" cy="17" r="1.25" fill="currentColor" className="iconly-dot-3" />
        <circle cx="15.5" cy="17" r="1.25" fill="currentColor" className="iconly-dot-1" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${active ? 'iconly-anim-bounce' : ''}`}
    >
      <path
        d="M3 10.2C3 7.2 5.2 5 8.2 5h7.6C18.8 5 21 7.2 21 10.2v6.6c0 3-2.2 5.2-5.2 5.2H8.2C5.2 22 3 19.8 3 16.8v-6.6Z"
        fill="currentColor"
        opacity={active ? '0.9' : '0.35'}
      />
      <path
        d="M8.2 2.5a.9.9 0 0 1 .9.9v2.2a.9.9 0 1 1-1.8 0V3.4a.9.9 0 0 1 .9-.9Zm7.6 0a.9.9 0 0 1 .9.9v2.2a.9.9 0 1 1-1.8 0V3.4a.9.9 0 0 1 .9-.9Z"
        fill="currentColor"
      />
      <circle
        cx="8.5"
        cy="13.2"
        r="1.2"
        fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      />
      <circle
        cx="12"
        cy="13.2"
        r="1.2"
        fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      />
      <circle
        cx="15.5"
        cy="13.2"
        r="1.2"
        fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      />
      <circle
        cx="8.5"
        cy="16.8"
        r="1.2"
        fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      />
      <circle
        cx="12"
        cy="16.8"
        r="1.2"
        fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      />
    </svg>
  );
};

export const IconlyWallet: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-pop' : ''}`}
  >
    <rect
      x="2.5"
      y="4.5"
      width="19"
      height="15"
      rx="4.8"
      fill="currentColor"
      opacity={active ? '0.92' : '0.36'}
    />
    <path
      d="M15.2 9.5H21.5v5H15.2a2.5 2.5 0 0 1 0-5Z"
      fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      className={active ? 'iconly-flap-slide' : ''}
    />
    <circle
      cx="15.5"
      cy="12"
      r="1.1"
      fill="currentColor"
    />
  </svg>
);

export const IconlySetting: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-spin' : ''}`}
  >
    <path
      d="M10.325 3.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
      fill="currentColor"
      opacity={active ? '0.92' : '0.36'}
    />
    <circle
      cx="12"
      cy="12"
      r="3.4"
      fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
    />
  </svg>
);

export const IconlyUsers: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-bounce' : ''}`}
  >
    <circle
      cx="9.5"
      cy="7.5"
      r="4"
      fill="currentColor"
    />
    <path
      d="M2.5 18.2c0-2.9 3.1-4.7 7-4.7s7 1.8 7 4.7c0 1.6-1.3 2.3-7 2.3s-7-.7-7-2.3Z"
      fill="currentColor"
      opacity={active ? '0.95' : '0.4'}
    />
    <circle
      cx="16.8"
      cy="8.5"
      r="2.8"
      fill="currentColor"
      opacity="0.45"
    />
    <path
      d="M17.2 14.2c2.4.4 4.3 1.6 4.3 3.4 0 1-.8 1.6-2.8 1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.55"
    />
  </svg>
);

export const IconlyBag: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-bounce' : ''}`}
  >
    <path
      d="M8.5 7.5V6.2a3.5 3.5 0 0 1 7 0v1.3"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
    <path
      d="M4.2 11.2c.3-2.6 1.8-4 4.5-4h6.6c2.7 0 4.2 1.4 4.5 4l.6 5.2c.4 3.2-1.3 5.1-4.5 5.1H8.1c-3.2 0-4.9-1.9-4.5-5.1l.6-5.2Z"
      fill="currentColor"
      opacity={active ? '0.92' : '0.38'}
    />
    <circle
      cx="9.2"
      cy="11.5"
      r="1"
      fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
    />
    <circle
      cx="14.8"
      cy="11.5"
      r="1"
      fill={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
    />
  </svg>
);

export const IconlyReceipt: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-pop' : ''}`}
  >
    <path
      d="M4.5 6.5C4.5 4 6.2 2.5 8.8 2.5h6.4c2.6 0 4.3 1.5 4.3 4v13.2c0 1.2-1.4 1.8-2.3 1.1l-1.5-1.2a1.2 1.2 0 0 0-1.5 0l-1.4 1.2a1.2 1.2 0 0 1-1.6 0l-1.4-1.2a1.2 1.2 0 0 0-1.5 0l-1.5 1.2c-.9.7-2.3.1-2.3-1.1V6.5Z"
      fill="currentColor"
      opacity={active ? '0.92' : '0.36'}
    />
    <path
      d="M8.5 8.5h7M8.5 12.5h4.5"
      stroke={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const IconlyBadge: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-pop' : ''}`}
  >
    <path
      d="M12 2.5 14.8 4l3.1-.4 1.1 3 2.6 1.8-.9 3 .9 3-2.6 1.8-1.1 3-3.1-.4L12 21.5 9.2 20l-3.1.4-1.1-3-2.6-1.8.9-3-.9-3L5 6.6l1.1-3 3.1.4L12 2.5Z"
      fill="currentColor"
      opacity={active ? '0.92' : '0.36'}
    />
    <path
      d="m9.3 12.2 1.9 1.9 3.6-3.8"
      stroke={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconlyMegaphone: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-bounce' : ''}`}
  >
    <path
      d="M18.5 4.8v12.4c0 1.2-1.3 1.9-2.3 1.3l-5.7-3.3H6.5A3.5 3.5 0 0 1 3 11.7v-.4a3.5 3.5 0 0 1 3.5-3.5h4l5.7-3.3c1-.6 2.3.1 2.3 1.3Z"
      fill="currentColor"
      opacity={active ? '0.92' : '0.38'}
    />
    <path
      d="M6.8 15.2 8 19.3a1.5 1.5 0 0 0 1.4 1.1h1.1a1.2 1.2 0 0 0 1.1-1.6l-1.1-3.6"
      fill="currentColor"
    />
    <path
      d="M21 9.2a3.5 3.5 0 0 1 0 4.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const IconlyChart: React.FC<IconlyProps> = ({ className = 'w-6 h-6', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${active ? 'iconly-anim-pop' : ''}`}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      fill="currentColor"
      opacity={active ? '0.92' : '0.35'}
    />
    <path
      d="M8.2 15.8v-3.2M12 15.8V8.5M15.8 15.8v-5.2"
      stroke={active ? 'var(--app-surface-color, #ffffff)' : 'currentColor'}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);
