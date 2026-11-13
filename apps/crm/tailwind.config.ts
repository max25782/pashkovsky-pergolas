import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  // lib/deals/stages.ts holds the column colour classes the editor offers.
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./lib/deals/stages.ts'],
  theme: {
    extend: {
      colors: {
        brand: { blue: '#0a6cff', silver: '#c8d0da' },
        bg: { dark: '#0e0f12', light: '#ffffff' },
        warn: '#e8794a',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
} satisfies Config
