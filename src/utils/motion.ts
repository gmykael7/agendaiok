import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export * from './motionPref';
export { gsap, useGSAP };

