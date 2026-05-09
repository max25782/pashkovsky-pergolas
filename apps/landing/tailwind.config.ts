import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#0c0c14',
          2: '#13131f',
          card: '#1c1c2e',
          'card-hover': '#22223a',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#a855f7',
          glow: 'rgba(124, 58, 237, 0.15)',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          subtle: 'rgba(255,255,255,0.04)',
        },
        text: {
          DEFAULT: '#f0f0f8',
          2: '#8888aa',
          3: '#55557a',
        },
      },
      backgroundImage: {
        'grid-pattern':
          'radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, transparent 70%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        'hero-glow':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.25) 0%, transparent 60%)',
        'cta-glow':
          'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(124,58,237,0.20) 0%, transparent 70%)',
      },
      backgroundSize: {
        grid: '100% 100%, 60px 60px, 60px 60px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
