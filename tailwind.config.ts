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
      fontSize: {
        'fluid-xs': ['var(--text-fluid-xs)', { lineHeight: '1.45' }],
        'fluid-sm': ['var(--text-fluid-sm)', { lineHeight: '1.55' }],
        'fluid-base': ['var(--text-fluid-base)', { lineHeight: '1.6' }],
        'fluid-lg': ['var(--text-fluid-lg)', { lineHeight: '1.55' }],
        'fluid-xl': ['var(--text-fluid-xl)', { lineHeight: '1.35' }],
        'fluid-2xl': ['var(--text-fluid-2xl)', { lineHeight: '1.22' }],
        'fluid-3xl': ['var(--text-fluid-3xl)', { lineHeight: '1.16' }],
        'fluid-4xl': ['var(--text-fluid-4xl)', { lineHeight: '1.12' }],
        'fluid-hero': ['var(--text-fluid-hero)', { lineHeight: '1.08' }],
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
        'content-wide': '1440px',
        stage: '1760px',
      },
    },
  },
  plugins: [tailwindcssAnimate, containerQueriesPlugin],
};

export default config;
