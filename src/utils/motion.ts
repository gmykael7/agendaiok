import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export const MOTION_ALLOWED_QUERY = '(prefers-reduced-motion: no-preference)';
export const MOTION_PREF_KEY = 'agendai_motion_pref';

export type MotionPreference = 'on' | 'off';

/** Preferência do próprio app (independente da configuração do sistema). Padrão: animações ligadas. */
export const readMotionPreference = (): MotionPreference => {
  try {
    return localStorage.getItem(MOTION_PREF_KEY) === 'off' ? 'off' : 'on';
  } catch {
    return 'on';
  }
};

export const applyMotionPreference = (pref: MotionPreference = readMotionPreference()) => {
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = pref;
};

export const saveMotionPreference = (pref: MotionPreference) => {
  try {
    localStorage.setItem(MOTION_PREF_KEY, pref);
  } catch {
    // Armazenamento bloqueado: a preferência vale só nesta sessão.
  }
  applyMotionPreference(pref);
};

/** Animações permitidas: o app não pediu para reduzir e o sistema também não pediu. */
export const motionAllowed = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'off') return false;
  return window.matchMedia(MOTION_ALLOWED_QUERY).matches;
};

export { gsap, useGSAP };
