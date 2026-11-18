import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          raised: 'var(--bg-raised)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        gold: {
          100: 'var(--gold-100)',
          300: 'var(--gold-300)',
          500: 'var(--gold-500)',
          700: 'var(--gold-700)',
          900: 'var(--gold-900)',
          DEFAULT: 'var(--gold-500)',
        },
        ivory: {
          DEFAULT: 'var(--text)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        live: 'var(--live)',
        info: 'var(--info)',
      },
      borderRadius: {
        card: '20px',
        button: '14px',
        input: '12px',
        pill: '9999px',
      },
      boxShadow: {
        'glow-gold': 'var(--glow-gold)',
        'glow-gold-lg': 'var(--glow-gold-lg)',
        'card-inner': 'inset 0 1px 0 0 rgba(251, 235, 181, 0.14)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        score: ['var(--font-score)', 'sans-serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        'ar-display': ['var(--font-ar-display)', 'sans-serif'],
        'ar-body': ['var(--font-ar-body)', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FBEBB5 0%, #E8B84B 45%, #B8862B 100%)',
        'night-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232, 184, 75, 0.14) 0%, rgba(17, 26, 61, 0.65) 45%, #070B1A 100%)',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
