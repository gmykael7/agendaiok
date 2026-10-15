import React, { useRef } from 'react';
import { gsap, motionAllowed } from '../../utils/motion';

export interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  tone: 'success' | 'danger';
  onAction: () => void | Promise<void>;
}

interface SwipeCardProps {
  /** Ação ao arrastar para a direita (painel verde à esquerda). */
  swipeRight?: SwipeAction;
  /** Ação ao arrastar para a esquerda (painel vermelho à direita). */
  swipeLeft?: SwipeAction;
  children: React.ReactNode;
  /** Identificador usado pela animação de reordenação da lista. */
  dataId?: string;
}

const THRESHOLD = 96;
const MAX_DRAG = 140;
const INTERACTIVE = 'button,input,select,textarea,a,label,[role="button"]';

/**
 * Card que revela uma ação ao ser arrastado para o lado.
 * Só dispara a ação se o arrasto passar do limite. Arrasto vertical continua
 * rolando a página. Toques em botões do card não iniciam arrasto.
 */
export const SwipeCard: React.FC<SwipeCardProps> = ({ swipeRight, swipeLeft, children, dataId }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const state = useRef({ active: false, locked: null as null | 'x' | 'y', startX: 0, startY: 0, dx: 0 });

  const reduceMotion = () => !motionAllowed();

  const paint = (value: number) => {
    if (bodyRef.current) gsap.set(bodyRef.current, { x: value });
    const progress = Math.min(1, Math.abs(value) / THRESHOLD);
    if (rightPanelRef.current) gsap.set(rightPanelRef.current, { opacity: value > 0 ? progress : 0 });
    if (leftPanelRef.current) gsap.set(leftPanelRef.current, { opacity: value < 0 ? progress : 0 });
  };

  const snapBack = () => {
    if (!bodyRef.current) return;
    if (reduceMotion()) {
      paint(0);
      return;
    }
    gsap.to(bodyRef.current, { x: 0, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
    gsap.to([rightPanelRef.current, leftPanelRef.current], { opacity: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeRight && !swipeLeft) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    state.current = { active: true, locked: null, startX: event.clientX, startY: event.clientY, dx: 0 };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    if (!s.active) return;
    const ddx = event.clientX - s.startX;
    const ddy = event.clientY - s.startY;
    if (!s.locked) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      s.locked = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
      if (s.locked === 'y') {
        s.active = false;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // Sem ação naquele lado, o card quase não se move (resistência).
    const blocked = (ddx > 0 && !swipeRight) || (ddx < 0 && !swipeLeft);
    const value = blocked ? ddx * 0.15 : Math.max(-MAX_DRAG, Math.min(MAX_DRAG, ddx));
    s.dx = value;
    paint(value);
  };

  const finish = async () => {
    const s = state.current;
    if (!s.active && s.locked !== 'x') return;
    const value = s.dx;
    state.current = { active: false, locked: null, startX: 0, startY: 0, dx: 0 };
    snapBack();
    if (value > THRESHOLD && swipeRight) await swipeRight.onAction();
    else if (value < -THRESHOLD && swipeLeft) await swipeLeft.onAction();
  };

  const renderPanel = (action: SwipeAction | undefined, side: 'left' | 'right', ref: React.RefObject<HTMLDivElement>) => {
    if (!action) return null;
    const tone = action.tone === 'success'
      ? 'bg-emerald-500 text-slate-950'
      : 'bg-rose-500 text-white';
    return (
      <div
        ref={ref}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className={`pointer-events-none absolute inset-0 flex items-center rounded-2xl px-5 text-sm font-black ${tone} ${side === 'left' ? 'justify-start' : 'justify-end'}`}
      >
        <span className="inline-flex items-center gap-2">
          {action.icon}
          {action.label}
        </span>
      </div>
    );
  };

  return (
    <div className="relative rounded-2xl" style={{ touchAction: 'pan-y' }} data-appointment-id={dataId}>
      {renderPanel(swipeRight, 'left', rightPanelRef)}
      {renderPanel(swipeLeft, 'right', leftPanelRef)}
      <div
        ref={bodyRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="relative select-none"
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeCard;
