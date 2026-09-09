import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export const MOTION_ALLOWED_QUERY = '(prefers-reduced-motion: no-preference)';

export { gsap, useGSAP };
