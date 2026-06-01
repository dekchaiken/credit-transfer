import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0f172a',
        muted: '#64748b',
        line: '#e2e8f0',
        bg: '#ffffff',
        soft: '#f8fafc',
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#1e40af',
          600: '#1e3a8a',
          700: '#172554',
        },
        accent: {
          50: '#fef3c7',
          500: '#d97706',
          600: '#b45309',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        slideDown: 'slideDown 200ms ease-out',
        slideUp: 'slideUp 250ms ease-out',
        pulseSoft: 'pulseSoft 1.5s ease-in-out infinite',
        fadeIn: 'fadeIn 200ms ease-out',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        lift: '0 4px 12px rgba(15,23,42,0.08)',
        nav: '0 1px 0 rgba(15,23,42,0.04), 0 4px 16px rgba(30,64,175,0.06)',
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
};
export default config;
