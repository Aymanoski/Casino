import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, GRADIENTS, SHADOWS } from '../designTokens';
import { FONTS } from '../fonts';
import type { VideoLang } from '../storyboard';

/**
 * Crimson Sunburst Stage Backdrop (DESIGN.md §2 & §5).
 * Slowly rotates concentric rays with focal warm spotlight & maroon vignette.
 */
export const SunburstBackdrop: React.FC<{
  dark?: boolean;
  speedDegPerFrame?: number;
}> = ({ dark = false, speedDegPerFrame = 0.08 }) => {
  const frame = useCurrentFrame();
  const angle = frame * speedDegPerFrame;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? COLORS.red900 : COLORS.red600,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-60%',
          background: dark
            ? 'repeating-conic-gradient(from 0deg at 50% 50%, #5D091B 0deg 10deg, #4F0716 10deg 20deg)'
            : GRADIENTS.sunburst,
          transform: `rotate(${angle}deg)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: dark
            ? 'radial-gradient(circle at 50% 42%, rgba(196, 22, 58, 0.34) 0%, rgba(79, 7, 22, 0.72) 66%, rgba(42, 10, 16, 0.92) 100%)'
            : 'radial-gradient(circle at 50% 42%, rgba(255, 224, 102, 0.18) 0%, rgba(196, 22, 58, 0.1) 44%, rgba(79, 7, 22, 0.56) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Glossy Gold-to-Orange Outlined Sticker Headline (DESIGN.md §2 & §3).
 * Uses original Lilita One (EN) and Lalezar (AR RTL) with thick maroon outline.
 */
export const StickerHeading: React.FC<{
  children: React.ReactNode;
  lang: VideoLang;
  size?: number;
  tiltDeg?: number;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}> = ({ children, lang, size = 72, tiltDeg = 0, align = 'center', style }) => {
  const isAr = lang === 'ar';
  const strokePx = Math.max(3, Math.round(size * (isAr ? 0.055 : 0.068)));
  const shadowOffset = Math.max(4, Math.round(size * 0.08));

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        fontFamily: isAr ? FONTS.displayAr : FONTS.displayEn,
        fontSize: size,
        lineHeight: isAr ? 1.24 : 1.06,
        letterSpacing: isAr ? 0 : '0.01em',
        textAlign: align,
        fontWeight: 400,
        position: 'relative',
        display: 'inline-block',
        transform: tiltDeg ? `rotate(${tiltDeg}deg)` : undefined,
        ...style,
      }}
    >
      {/* Back outline & hard sticker drop shadow layer */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          color: COLORS.red900,
          WebkitTextStroke: `${strokePx * 2}px ${COLORS.red900}`,
          paintOrder: 'stroke fill',
          textShadow: `${isAr ? -shadowOffset : shadowOffset}px ${shadowOffset}px 0 ${COLORS.red900}`,
          userSelect: 'none',
        }}
      >
        {children}
      </span>
      {/* Glossy gold gradient top fill */}
      <span
        style={{
          position: 'relative',
          backgroundImage: GRADIENTS.goldText,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 0 rgba(255,255,255,0.22))',
        }}
      >
        {children}
      </span>
    </div>
  );
};

/** Original Sticker Casino Chip Badge (DESIGN.md §5 & §6) */
export const CasinoChip: React.FC<{
  label: string;
  variant?: 'gold' | 'red' | 'blue' | 'white';
  size?: number;
}> = ({ label, variant = 'gold', size = 76 }) => {
  const palette = {
    gold: { bg: COLORS.gold400, rim: COLORS.gold200, fg: COLORS.red900 },
    red: { bg: COLORS.red600, rim: COLORS.white, fg: COLORS.white },
    blue: { bg: COLORS.blue500, rim: COLORS.white, fg: COLORS.white },
    white: { bg: COLORS.white, rim: COLORS.red600, fg: COLORS.red900 },
  }[variant];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '9999px',
        backgroundColor: palette.bg,
        border: `4px solid ${variant === 'blue' ? COLORS.white : COLORS.red900}`,
        boxShadow:
          variant === 'blue'
            ? `0 0 0 3px ${COLORS.red900}, 4px 4px 0 ${COLORS.red900}`
            : `4px 4px 0 ${COLORS.red900}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: '9999px',
          border: `3px dashed ${palette.rim}`,
          opacity: 0.9,
        }}
      />
      <span
        style={{
          fontFamily: FONTS.scoreEn,
          fontSize: Math.round(size * 0.44),
          color: palette.fg,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
    </div>
  );
};

/** Original Sticker Die SVG (DESIGN.md §5 — zero copied artwork) */
export const OriginalDieSvg: React.FC<{ size?: number; tilt?: number }> = ({
  size = 64,
  tilt = -12,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    style={{
      transform: `rotate(${tilt}deg)`,
      filter: `drop-shadow(4px 4px 0 ${COLORS.red900})`,
    }}
  >
    <rect
      x="6"
      y="6"
      width="52"
      height="52"
      rx="14"
      fill={COLORS.paper}
      stroke={COLORS.red900}
      strokeWidth="4.5"
    />
    <circle cx="21" cy="21" r="4.5" fill={COLORS.red600} />
    <circle cx="43" cy="21" r="4.5" fill={COLORS.red600} />
    <circle cx="32" cy="32" r="4.5" fill={COLORS.red900} />
    <circle cx="21" cy="43" r="4.5" fill={COLORS.red600} />
    <circle cx="43" cy="43" r="4.5" fill={COLORS.red600} />
  </svg>
);

/** Original Sticker Playing Card SVG (DESIGN.md §5 — zero copied artwork) */
export const OriginalCardSvg: React.FC<{ size?: number; tilt?: number }> = ({
  size = 68,
  tilt = 14,
}) => (
  <svg
    width={size}
    height={Math.round(size * 1.32)}
    viewBox="0 0 64 84"
    style={{
      transform: `rotate(${tilt}deg)`,
      filter: `drop-shadow(4px 4px 0 ${COLORS.red900})`,
    }}
  >
    <rect
      x="4"
      y="4"
      width="56"
      height="76"
      rx="11"
      fill={COLORS.white}
      stroke={COLORS.red900}
      strokeWidth="4.5"
    />
    <rect
      x="11"
      y="11"
      width="42"
      height="62"
      rx="6"
      fill={COLORS.paper}
      stroke={COLORS.gold400}
      strokeWidth="2.5"
    />
    <path
      d="M32 25 L43 42 L32 59 L21 42 Z"
      fill={COLORS.red600}
      stroke={COLORS.red900}
      strokeWidth="2.5"
    />
  </svg>
);

/** Secondary Warm Ramadan Lantern (Fanous) SVG (DESIGN.md §5) */
export const RamadanLanternSvg: React.FC<{ size?: number; sway?: number }> = ({
  size = 64,
  sway = 0,
}) => (
  <svg
    width={size}
    height={Math.round(size * 1.45)}
    viewBox="0 0 64 92"
    style={{
      transformOrigin: '50% 0%',
      transform: `rotate(${sway}deg)`,
      filter: 'drop-shadow(0 0 14px rgba(255, 213, 74, 0.55))',
    }}
  >
    <line x1="32" y1="0" x2="32" y2="14" stroke={COLORS.gold300} strokeWidth="3.5" />
    <circle cx="32" cy="17" r="4" fill={COLORS.gold400} stroke={COLORS.red900} strokeWidth="2.5" />
    <path
      d="M18 28 Q32 14 46 28 Z"
      fill={COLORS.gold400}
      stroke={COLORS.red900}
      strokeWidth="3"
    />
    <polygon
      points="16,28 48,28 44,68 20,68"
      fill={COLORS.gold200}
      stroke={COLORS.red900}
      strokeWidth="3.2"
    />
    <polygon points="24,33 40,33 37,63 27,63" fill={COLORS.gold400} opacity="0.65" />
    <rect
      x="18"
      y="68"
      width="28"
      height="9"
      rx="4"
      fill={COLORS.gold500}
      stroke={COLORS.red900}
      strokeWidth="3"
    />
    <path d="M24 77 L32 88 L40 77 Z" fill={COLORS.gold400} stroke={COLORS.red900} strokeWidth="2.8" />
  </svg>
);

/** Chasing Marquee Bulb Frame (DESIGN.md §5 & §6) */
export const MarqueeBulbStrip: React.FC<{ count?: number }> = ({ count = 18 }) => {
  const frame = useCurrentFrame();
  const phase = Math.floor(frame / 6);
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: '0 14px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const lit = (i + phase) % 3 !== 0;
        return (
          <div
            key={i}
            style={{
              width: 11,
              height: 11,
              borderRadius: '9999px',
              backgroundColor: lit ? COLORS.gold200 : COLORS.gold600,
              border: `2px solid ${COLORS.red900}`,
              boxShadow: lit ? '0 0 12px rgba(255, 224, 102, 0.9)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

/** Decorative Floating Stage Props (gentle baseline float) */
export const FloatingStageAccents: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const floatA = Math.sin(frame * 0.05) * 8;
  const floatB = Math.cos(frame * 0.045) * 10;
  const sway = Math.sin(frame * 0.04) * 3.5;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: compact ? 38 : 42,
          left: compact ? 36 : 56,
          transform: `translateY(${floatA}px)`,
          opacity: 0.9,
        }}
      >
        <RamadanLanternSvg size={compact ? 42 : 52} sway={sway} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: compact ? 38 : 42,
          right: compact ? 36 : 56,
          transform: `translateY(${-floatA * 0.7}px)`,
          opacity: 0.9,
        }}
      >
        <RamadanLanternSvg size={compact ? 42 : 52} sway={-sway} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: compact ? 290 : 128,
          left: compact ? 32 : 60,
          transform: `translateY(${floatB}px)`,
          opacity: 0.82,
        }}
      >
        <OriginalDieSvg size={compact ? 48 : 58} tilt={-14} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: compact ? 290 : 128,
          right: compact ? 32 : 60,
          transform: `translateY(${-floatB}px)`,
          opacity: 0.82,
        }}
      >
        <OriginalCardSvg size={compact ? 46 : 56} tilt={13} />
      </div>
    </AbsoluteFill>
  );
};

/** Brand-safe Name-Only Golden Seat Emblem for Marwan Serry (NEVER a photo!) */
export const GoldenSeatBadge: React.FC<{
  lang: VideoLang;
  size?: 'md' | 'lg';
}> = ({ lang, size = 'lg' }) => {
  const isAr = lang === 'ar';
  const isLg = size === 'lg';
  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isLg ? 10 : 6,
        padding: isLg ? '22px 44px' : '14px 28px',
        borderRadius: 24,
        background: `linear-gradient(180deg, ${COLORS.gold200} 0%, ${COLORS.gold400} 58%, ${COLORS.gold500} 100%)`,
        border: `4px solid ${COLORS.red900}`,
        boxShadow: `${SHADOWS.stickerLg(isAr)}, ${SHADOWS.goldGlow}`,
      }}
    >
      <div
        style={{
          fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
          fontSize: isLg ? 18 : 14,
          fontWeight: 800,
          color: COLORS.red900,
          letterSpacing: isAr ? 0 : '0.16em',
          textTransform: 'uppercase',
        }}
      >
        {isAr ? '★ الكرسي الذهبي — ضيف شرف النهائي ★' : '★ THE GOLDEN SEAT · GRAND FINAL GUEST ★'}
      </div>
      <div
        style={{
          fontFamily: isAr ? FONTS.displayAr : FONTS.displayEn,
          fontSize: isLg ? 58 : 42,
          color: COLORS.red900,
          lineHeight: 1.08,
        }}
      >
        {isAr ? 'مروان سري' : 'MARWAN SERRY'}
      </div>
    </div>
  );
};
