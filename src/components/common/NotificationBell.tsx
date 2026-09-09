import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { bellCanAnimate, bellKeyframes, BellNotification, unreadNotificationCount } from '../../utils/notificationBell';
import { BELL_PATH, BELL_DURATION_MS, BELL_ROTATION, BELL_CLAPPER, BELL_BOUNCE, BELL_BADGE } from './notificationBellAsset';

const reducedQuery = '(prefers-reduced-motion: reduce)';

/** Decorative only: the enclosing button owns its accessible label and click handler. */
export function NotificationBell({ notifications, open }: { notifications: readonly BellNotification[]; open: boolean }) {
  const maskId = `notification-bell-mask-${useId().replace(/:/g, '')}`;
  const swing = useRef<SVGGElement>(null);
  const clapper = useRef<SVGGElement>(null);
  const bounce = useRef<SVGGElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const animations = useRef<Animation[]>([]);
  const openingChecked = useRef(false);
  const [reduced, setReduced] = useState(() => typeof window === 'undefined' || window.matchMedia(reducedQuery).matches);
  const unreadCount = unreadNotificationCount(notifications);
  const stop = useCallback(() => {
    animations.current.forEach(a => a.cancel());
    animations.current = [];
  }, []);

  useEffect(() => {
    const media = window.matchMedia(reducedQuery);
    const change = () => { if (media.matches) stop(); setReduced(media.matches); };
    const visibility = () => { if (document.visibilityState !== 'visible') stop(); };
    media.addEventListener('change', change);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop(); openingChecked.current = false;
      media.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [stop]);

  useEffect(() => {
    // Header mounts after the app validates and loads the authenticated account.
    // Consume the opening even with zero unread items: later arrivals update only the count.
    const isOpening = !openingChecked.current;
    openingChecked.current = true;
    if (open || reduced || !unreadCount) { stop(); return; }
    if (!bellCanAnimate(isOpening, unreadCount, open, reduced, document.visibilityState === 'visible')) return;
    stop();
    const play = (element: Element | null, frames: Keyframe[]) => {
      if (element && typeof element.animate === 'function') {
        animations.current.push(element.animate(frames, { duration: BELL_DURATION_MS, iterations: 1, fill: 'none' }));
      }
    };
    play(swing.current, bellKeyframes(BELL_ROTATION, v => `rotate(${v}deg)`));
    play(clapper.current, bellKeyframes(BELL_CLAPPER, v => `translateX(${v}px)`));
    play(bounce.current, bellKeyframes(BELL_BOUNCE, v => `translateY(${v}px)`));
    play(badge.current, bellKeyframes(BELL_BADGE, v => `scale(${v})`, 1));
  }, [unreadCount, open, reduced, stop]);

  return <span aria-hidden="true" className="notification-bell-visual absolute inset-0 flex items-center justify-center pointer-events-none">
    <svg viewBox="-70 -65 140 140" className="w-7 h-7 sm:w-[30px] sm:h-[30px] md:w-7 md:h-7" fill="currentColor" focusable="false">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-100" y="-100" width="200" height="200" style={{ maskType: 'luminance' }}>
          <rect x="-100" y="-100" width="200" height="200" fill="white" />
          <path d={BELL_PATH} transform="translate(0.052 -3.315)" fill="black" />
        </mask>
      </defs>
      <g ref={swing} className="notification-bell-swing" style={{ transformOrigin: '-0.558px -51.547px' }}>
        <path d={BELL_PATH} transform="translate(0.052 -8.315)" />
        <g mask={`url(#${maskId})`}>
          <g ref={clapper}><g ref={bounce}><circle cx="0" cy="40" r="11.5" /></g></g>
        </g>
      </g>
    </svg>
    {unreadCount > 0 && <span ref={badge} className="notification-count-badge absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] leading-5 text-center font-black ring-2 ring-[#08101f] shadow-[0_3px_10px_rgba(225,29,72,0.65)]">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>}
  </span>;
}
