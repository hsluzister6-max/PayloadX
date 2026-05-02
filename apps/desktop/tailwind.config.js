/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Mono', 'monospace'],
        title: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        // ── Design system tokens (CSS-variable backed) ────────────────
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          // Legacy numeric scale mapped to dynamic tokens for theme switching
          50: 'var(--bg-primary)',
          100: 'var(--bg-secondary)',
          200: 'var(--surface-1)',
          300: 'var(--border-1)',
          400: 'var(--text-muted)',
          500: 'var(--text-secondary)',
          600: 'var(--surface-3)', // Often used for hover state
          700: 'var(--border-1)',  // Most 'border-surface-700' will now use border-1
          750: 'var(--surface-2)', // Often used for secondary active backgrounds
          800: 'var(--bg-tertiary)', // Often used for inputs & nested areas
          850: 'var(--surface-1)', // Standard panels/cards
          900: 'var(--bg-primary)', // Base app backgrounds
          950: '#0A0A0A',
        },
        border: {
          1: 'var(--border-1)',
          2: 'var(--border-2)',
        },
        tx: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },

        // ── Brand scale → pure silver/chrome scale (NO purple/blue) ──
        brand: {
          50: '#F5F5F7',
          100: '#E5E5E7',
          200: '#D2D2D7',
          300: '#A1A1A6',
          400: '#86868B',
          500: 'var(--accent)',   /* Main Metallic Accent */
          600: '#6E6E73',
          700: '#424245',
          800: '#1D1D1F',
          900: '#000000',
        },

        // ── Semantic status colors ────────────────────────────────────
        success: { DEFAULT: 'var(--success)' },
        warning: { DEFAULT: 'var(--warning)' },
        danger: { DEFAULT: 'var(--error)' },
        info: { DEFAULT: '#39C5CF' },
      },
      borderRadius: {
        'lg': '6px',
        'xl': '8px',
        '2xl': '10px',
        '3xl': '14px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInLeft: { '0%': { transform: 'translateX(-10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(6px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      boxShadow: {
        'glass': '0 12px 30px -5px rgba(0, 0, 0, 0.5)', /* Solid, high-contrast shadow */
        'glass-sm': '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
