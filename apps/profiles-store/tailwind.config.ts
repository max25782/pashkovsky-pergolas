import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0a6cff',
        'primary-dark': '#0856cc',
        success: '#22c55e',
        brand: '#f5a623',
        'brand-dark': '#e09010',
        gray: {
          50: '#f5f5f5',
          100: '#e5e5e5',
          600: '#666666',
          700: '#444444',
          800: '#2a2a2a',
          900: '#1a1a1a',
        }
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
} satisfies Config
