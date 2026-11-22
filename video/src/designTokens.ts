/**
 * Exact DESIGN.md Color, Typography, Gradient & Shadow Tokens for Remotion.
 * Brand safety: original vector/CSS tokens only; zero copied show artwork.
 */

export const COLORS = {
  // Brand red (the stage)
  red100: '#FDE7EB',
  red400: '#E5405C',
  red600: '#C4163A',
  red700: '#A81233',
  red750: '#B21235',
  red800: '#7E0D26',
  red900: '#4F0716',

  // Gold / orange (the star)
  gold200: '#FFE899',
  gold300: '#FFD54A',
  gold400: '#FFC12B',
  gold500: '#FF9F1C',
  gold600: '#E8740C',

  // White / Paper
  white: '#FFFFFF',
  paper: '#FFF9F0',
  paper2: '#FBEFE0',

  // Electric blue spark (NEVER directly on red — always buffered by white!)
  blue100: '#E6EEFF',
  blue300: '#7FA8FF',
  blue500: '#2F6BFF',
  blue600: '#1F4FD8',
  blue800: '#14327F',

  // Ink
  ink: '#2A0A10',
  inkMuted: '#6B4A50',

  // Status
  positive: '#1FA971',
  positiveInk: '#0D6A43',
  negative: '#B3001B',
} as const;

export const GRADIENTS = {
  goldText:
    'linear-gradient(180deg, #FFE066 0%, #FFC12B 40%, #FF9F1C 75%, #E8740C 100%)',
  blueSpark: 'linear-gradient(135deg, #7FA8FF, #2F6BFF 60%, #1F4FD8)',
  sunburst:
    'repeating-conic-gradient(from 0deg at 50% 50%, #C4163A 0deg 10deg, #B21235 10deg 20deg)',
  stageDark:
    'radial-gradient(circle at 50% 30%, #7E0D26 0%, #4F0716 70%, #34040E 100%)',
} as const;

export const SHADOWS = {
  sticker: (rtl = false) => `${rtl ? '-5px' : '5px'} 5px 0 ${COLORS.red900}`,
  stickerLg: (rtl = false) => `${rtl ? '-9px' : '9px'} 9px 0 ${COLORS.red900}`,
  goldGlow: '0 0 32px rgba(255, 193, 43, 0.6)',
  soft: '0 14px 40px rgba(79, 7, 22, 0.32)',
} as const;

export const FONT_FAMILIES = {
  displayEn: '"Lilita One", sans-serif',
  displayAr: '"Lalezar", sans-serif',
  scoreEn: '"Bebas Neue", sans-serif',
  scoreAr: '"Cairo", sans-serif',
  bodyEn: '"Inter", sans-serif',
  bodyAr: '"Cairo", sans-serif',
} as const;
