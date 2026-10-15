import React, { useLayoutEffect, useRef } from 'react';
import { gsap } from '../../utils/motion';
import { motionAllowed } from '../../utils/motion';

export type ActionStatus = 'idle' | 'loading' | 'success';

interface ActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  status: ActionStatus;
  children: React.ReactNode;
  loadingLabel?: string;
  successLabel?: string;
  icon?: React.ReactNode;
}

/**
 * Botão de ação com troca de estado: texto → loader → check.
 * Não muda a largura (evita salto de layout). Cada camada anima por cima da anterior,
 * sem overshoot, e a animação é interrompível: uma nova troca sobrescreve a atual.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  status,
  children,
  loadingLabel = 'Processando...',
  successLabel = 'Concluído',
  icon,
  className = '',
  disabled,
  ...rest
}) => {
  const idleRef = useRef<HTMLSpanElement>(null);
  const loadingRef = useRef<HTMLSpanElement>(null);
  const successRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const layers = {
      idle: idleRef.current,
      loading: loadingRef.current,
      success: successRef.current,
    };
    const reduce = !motionAllowed();
    (Object.keys(layers) as ActionStatus[]).forEach((key) => {
      const el = layers[key];
      if (!el) return;
      const active = key === status;
      if (reduce) {
        gsap.set(el, { autoAlpha: active ? 1 : 0, filter: 'blur(0px)', y: 0, scale: 1 });
        return;
      }
      gsap.to(el, {
        autoAlpha: active ? 1 : 0,
        y: active ? 0 : -6,
        filter: active ? 'blur(0px)' : 'blur(4px)',
        duration: 0.28,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });
  }, [status]);

  return (
    <button
      {...rest}
      disabled={disabled || status !== 'idle'}
      aria-busy={status === 'loading'}
      className={`relative inline-grid place-items-center overflow-hidden ${className}`}
    >
      <span ref={idleRef} className="col-start-1 row-start-1 inline-flex items-center gap-2">
        {icon}
        {children}
      </span>
      <span ref={loadingRef} className="col-start-1 row-start-1 inline-flex items-center gap-2 invisible" aria-hidden={status !== 'loading'}>
        <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
        {loadingLabel}
      </span>
      <span ref={successRef} className="col-start-1 row-start-1 inline-flex items-center gap-2 invisible" aria-hidden={status !== 'success'}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
        {successLabel}
      </span>
    </button>
  );
};

export default ActionButton;
