import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * Lightweight built-in container-query plugin for Tailwind CSS v3.4
 * Supports `@container`, `@container/<name>`, and `@2xs:`, `@xs:`, `@sm:`, `@md:`, `@lg:`, `@xl:`, `@2xl:`, `@3xl:` variants.
 */
const containerQueriesPlugin = plugin(({ addUtilities, matchUtilities, matchVariant }) => {
  addUtilities({
    '.\\@container': {
      containerType: 'inline-size',
    },
    '.\\@container-normal': {
      containerType: 'normal',
    },
  });

  matchUtilities(
    {
      '@container': (value) => ({
        containerType: 'inline-size',
        containerName: value,
      }),
    },
    { values: {} }
  );

  matchVariant(
    '@',
    (value = '', { modifier }) =>
      modifier
        ? `@container ${modifier} (min-width: ${value})`
        : `@container (min-width: ${value})`,
    {
      values: {
        '2xs': '16rem', // 256px
        xs: '20rem', // 320px
        sm: '24rem', // 384px
        md: '28rem', // 448px
        lg: '32rem', // 512px
        xl: '36rem', // 576px
        '2xl': '42rem', // 672px
        '3xl': '48rem', // 768px
      },
    }
  );
});

const config: Config = {
  darkMode: ['class'],
  future: {
    // Wrap all hover: utilities in @media (hover: hover) and (pointer: fine)
    // so touchscreens never suffer sticky hover states (AGENTS.md §13).
    hoverOnlyWhenSupported: true,
  },
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // Strict ascending mobile-first breakpoints including 1920px+ tier
    screens: {
      xs: '360px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
    extend: {
      colors: {
        red: {
          100: 'var(--red-100)',
          400: 'var(--red-400)',
          600: 'var(--red-600)',
          700: 'var(--red-700)',
          800: 'var(--red-800)',
          900: 'var(--red-900)',
          DEFAULT: 'var(--red-600)',
        },
        gold: {
          200: 'var(--gold-200)',
          300: 'var(--gold-300)',
          400: 'var(--gold-400)',
          500: 'var(--gold-500)',
          600: 'var(--gold-600)',
          DEFAULT: 'var(--gold-400)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          2: 'var(--paper-2)',
        },
        blue: {
          100: 'var(--blue-100)',
          300: 'var(--blue-300)',
          500: 'var(--blue-500)',
          600: 'var(--blue-600)',
          800: 'var(--blue-800)',
          DEFAULT: 'var(--blue-500)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        outline: 'var(--outline)',
        'border-paper': 'var(--border-paper)',
        positive: {
          DEFAULT: 'var(--positive)',
          ink: 'var(--positive-ink)',
          soft: 'var(--positive-soft)',
        },
        negative: {
          DEFAULT: 'var(--negative)',
          soft: 'var(--negative-soft)',
        },
        live: 'var(--live)',
        // Theme-adaptive semantic aliases (switch via .theme-paper / .theme-stage / .theme-stage-dark)
        canvas: 'var(--theme-bg)',
        panel: {
          DEFAULT: 'var(--theme-card)',
          2: 'var(--theme-card-2)',
        },
        'on-canvas': {
          DEFAULT: 'var(--theme-fg)',
          muted: 'var(--theme-fg-muted)',
        },
      },
      fontSize: {
        'fluid-xs': ['var(--text-fluid-xs)', { lineHeight: '1.45' }],
        'fluid-sm': ['var(--text-fluid-sm)', { lineHeight: '1.55' }],
        'fluid-base': ['var(--text-fluid-base)', { lineHeight: '1.6' }],
        'fluid-lg': ['var(--text-fluid-lg)', { lineHeight: '1.55' }],
        'fluid-xl': ['var(--text-fluid-xl)', { lineHeight: '1.3' }],
        'fluid-2xl': ['var(--text-fluid-2xl)', { lineHeight: '1.2' }],
        'fluid-3xl': ['var(--text-fluid-3xl)', { lineHeight: '1.14' }],
        'fluid-4xl': ['var(--text-fluid-4xl)', { lineHeight: '1.1' }],
        'fluid-hero': ['var(--text-fluid-hero)', { lineHeight: '1.05' }],
        'fluid-score': ['var(--text-fluid-score)', { lineHeight: '1' }],
        'fluid-score-xl': ['var(--text-fluid-score-xl)', { lineHeight: '0.95' }],
      },
      spacing: {
        'section-y': 'var(--space-section-y)',
        'card-pad': 'var(--space-card-pad)',
        gutter: 'var(--space-gutter)',
        'grid-gap': 'var(--space-grid-gap)',
        'header-h': 'var(--header-h)',
        'safe-t': 'env(safe-area-inset-top, 0px)',
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-s': 'env(safe-area-inset-left, 0px)',
        'safe-e': 'env(safe-area-inset-right, 0px)',
      },
      minHeight: {
        dvh: '100dvh',
        svh: '100svh',
        touch: '44px',
        scorer: '56px',
      },
      minWidth: {
        touch: '44px',
        scorer: '56px',
      },
      height: {
        dvh: '100dvh',
        svh: '100svh',
      },
      borderRadius: {
        card: '20px',
        button: '14px',
        input: '12px',
        pill: '9999px',
      },
      boxShadow: {
        sticker: 'var(--shadow-sticker)',
        'sticker-sm': 'var(--shadow-sticker-sm)',
        'sticker-lg': 'var(--shadow-sticker-lg)',
        'sticker-hover': 'var(--shadow-sticker-hover)',
        soft: 'var(--shadow-soft)',
        'glow-gold': 'var(--glow-gold)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'var(--font-ar-display)', 'sans-serif'],
        score: ['var(--font-score)', 'var(--font-ar-score)', 'sans-serif'],
        sans: ['var(--font-body)', 'var(--font-ar-body)', 'sans-serif'],
        'ar-display': ['var(--font-ar-display)', 'sans-serif'],
        'ar-body': ['var(--font-ar-body)', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient':
          'linear-gradient(180deg, #FFE066 0%, #FFC12B 40%, #FF9F1C 75%, #E8740C 100%)',
        sunburst:
          'repeating-conic-gradient(from 0deg at 50% 50%, #C4163A 0deg 10deg, #B21235 10deg 20deg)',
        'sunburst-dark':
          'repeating-conic-gradient(from 0deg at 50% 50%, #4F0716 0deg 10deg, #5F0A1B 10deg 20deg)',
        'blue-spark':
          'linear-gradient(135deg, #7FA8FF, #2F6BFF 60%, #1F4FD8)',
      },
      maxWidth: {
        content: '1200px',
        'content-wide': '1440px',
        stage: '1760px',
      },
    },
  },
  plugins: [tailwindcssAnimate, containerQueriesPlugin],
};

export default config;
