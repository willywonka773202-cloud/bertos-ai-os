import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: '#2C2418',
        input: '#2C2418',
        ring: '#D4B483',
        background: '#070503',
        foreground: '#F0EAD8',
        primary: {
          DEFAULT: '#D4B483',
          foreground: '#0A0806',
        },
        secondary: {
          DEFAULT: '#2C2418',
          foreground: '#F0EAD8',
        },
        muted: {
          DEFAULT: '#161209',
          foreground: '#9A8A68',
        },
        accent: {
          DEFAULT: '#D4B483',
          foreground: '#0A0806',
        },
        card: {
          DEFAULT: '#0E0C09',
          foreground: '#F0EAD8',
        },
        zinc: {
          950: '#09090B',
        },
        /* ── Imperial Stone palette ──────────────── */
        stone: {
          975: '#070503',
          960: '#0A0806',
          950: '#0E0B08',
          940: '#121009',
        },
        imperial: {
          gold:    '#D4B483',
          bright:  '#F6C453',
          bronze:  '#B8894B',
          ivory:   '#F0E8D0',
          parchment: '#E8DDB8',
          celestial: '#7ABCD6',
        },
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.2s ease-out',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'halo':        'haloBreath 2.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        haloBreath: {
          '0%, 100%': { opacity: '0.40', transform: 'scale(1)' },
          '50%':      { opacity: '0.70', transform: 'scale(1.12)' },
        },
      },
      boxShadow: {
        'glow-gold':   '0 0 30px rgba(212,180,131,0.25)',
        'glow-bronze': '0 0 30px rgba(184,137,75,0.20)',
        'glow-purple': '0 0 30px rgba(139,92,246,0.25)',
        'glow-blue':   '0 0 30px rgba(59,130,246,0.20)',
        'glow-green':  '0 0 30px rgba(16,185,129,0.20)',
        'imperial':    '0 0 40px rgba(212,180,131,0.12), inset 0 1px 0 rgba(240,232,208,0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config
