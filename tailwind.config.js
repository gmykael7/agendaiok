/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideInRight: 'slideInRight 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        slideInLeft: 'slideInLeft 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        popIn: 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        riseIn: 'riseIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        checkPop: 'checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        ringPulse: 'ringPulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        kenBurns: 'kenBurns 14s ease-in-out infinite alternate',
        shimmer: 'shimmer 1.6s linear infinite',
        floatParticle: 'floatParticle 1.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        checkPop: {
          '0%': { transform: 'scale(0.4) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'scale(1.15) rotate(4deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        ringPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.15)', opacity: '0' },
        },
        kenBurns: {
          '0%': { transform: 'scale(1) translate(0, 0)' },
          '100%': { transform: 'scale(1.08) translate(-1%, -1%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floatParticle: {
          '0%': { transform: 'translate(0, 0) scale(1)', opacity: '1' },
          '100%': { transform: 'translate(var(--dx, 20px), var(--dy, -60px)) scale(0)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
