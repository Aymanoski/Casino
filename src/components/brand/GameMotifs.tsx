'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* 1. Original Playing Dice (Sticker Style)                                   */
/* -------------------------------------------------------------------------- */

export interface PlayingDiceProps {
  value?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: 'sm' | 'md' | 'lg';
  tilt?: number;
  float?: boolean;
  accent?: 'red' | 'gold' | 'blue';
  className?: string;
}

const DICE_SIZE = {
  sm: 36,
  md: 52,
  lg: 72,
};

const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[32, 32]],
  2: [
    [20, 20],
    [44, 44],
  ],
  3: [
    [20, 20],
    [32, 32],
    [44, 44],
  ],
  4: [
    [20, 20],
    [44, 20],
    [20, 44],
    [44, 44],
  ],
  5: [
    [20, 20],
    [44, 20],
    [32, 32],
    [20, 44],
    [44, 44],
  ],
  6: [
    [20, 18],
    [44, 18],
    [20, 32],
    [44, 32],
    [20, 46],
    [44, 46],
  ],
};

export const PlayingDice = React.memo(function PlayingDice({
  value = 5,
  size = 'md',
  tilt = -8,
  float = false,
  accent = 'red',
  className,
}: PlayingDiceProps) {
  const px = DICE_SIZE[size];
  const pips = PIP_POSITIONS[value] ?? PIP_POSITIONS[5];
  const pipColor =
    accent === 'gold'
      ? '#E8740C'
      : accent === 'blue'
        ? '#1F4FD8'
        : value === 1 || value === 5
          ? '#C4163A'
          : '#4F0716';

  const floatStyle = (
    float
      ? {
          '--motif-tilt': `${tilt}deg`,
          '--motif-float-y': '-6px',
          '--motif-tilt-delta': '3deg',
          '--float-duration': '4.4s',
          transform: `rotate(${tilt}deg)`,
        }
      : { transform: `rotate(${tilt}deg)` }
  ) as React.CSSProperties;

  return (
    <div
      className={cn(
        'inline-flex shrink-0 select-none',
        float && 'animate-motif-float',
        className
      )}
      style={floatStyle}
      aria-hidden="true"
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 68 68"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hard offset sticker shadow */}
        <rect x="8" y="8" width="54" height="54" rx="13" fill="#4F0716" />
        {/* Die body */}
        <rect
          x="4"
          y="4"
          width="54"
          height="54"
          rx="13"
          fill="#FFF9F0"
          stroke="#4F0716"
          strokeWidth="4"
        />
        {/* Subtle inner bevel highlight */}
        <path
          d="M14 10H48C50.5 10 52 11.5 52 14"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Pips */}
        {pips.map(([cx, cy], idx) => (
          <circle
            key={idx}
            cx={cx - 1}
            cy={cy - 1}
            r={value === 1 ? 6.5 : 4.4}
            fill={idx === 2 && value === 5 ? '#C4163A' : pipColor}
            stroke="#4F0716"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* 2. Original Playing Cards & Card Fan (Sticker Style, No Gambling Motifs)   */
/* -------------------------------------------------------------------------- */

export interface PlayingCardMotifProps {
  suit?: 'star' | 'crown' | 'spade' | 'diamond';
  cornerText?: string;
  tone?: 'white' | 'gold' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  tilt?: number;
  float?: boolean;
  className?: string;
}

const CARD_DIMS = {
  sm: { w: 42, h: 58 },
  md: { w: 58, h: 80 },
  lg: { w: 78, h: 108 },
};

export const PlayingCardMotif = React.memo(function PlayingCardMotif({
  suit = 'star',
  cornerText = 'A',
  tone = 'white',
  size = 'md',
  tilt = 6,
  float = false,
  className,
}: PlayingCardMotifProps) {
  const dims = CARD_DIMS[size];

  const faceFill =
    tone === 'gold' ? '#FFE899' : tone === 'blue' ? '#E6EEFF' : '#FFFFFF';
  const accentFill =
    tone === 'blue' ? '#1F4FD8' : tone === 'gold' ? '#C4163A' : '#C4163A';

  const floatStyle = (
    float
      ? {
          '--motif-tilt': `${tilt}deg`,
          '--motif-float-y': '-7px',
          '--motif-tilt-delta': '-2.5deg',
          '--float-duration': '5s',
          transform: `rotate(${tilt}deg)`,
        }
      : { transform: `rotate(${tilt}deg)` }
  ) as React.CSSProperties;

  return (
    <div
      className={cn(
        'inline-flex shrink-0 select-none',
        float && 'animate-motif-float',
        className
      )}
      style={floatStyle}
      aria-hidden="true"
    >
      <svg
        width={dims.w}
        height={dims.h}
        viewBox="0 0 64 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sticker hard shadow */}
        <rect x="7" y="7" width="52" height="76" rx="10" fill="#4F0716" />
        {/* Card face */}
        <rect
          x="3"
          y="3"
          width="52"
          height="76"
          rx="10"
          fill={faceFill}
          stroke="#4F0716"
          strokeWidth="3.5"
        />
        {/* Inner game-show trim */}
        <rect
          x="8.5"
          y="8.5"
          width="41"
          height="65"
          rx="6"
          stroke={accentFill}
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.45"
        />
        {/* Top corner label */}
        <text
          x="12"
          y="21"
          fill="#4F0716"
          fontSize="12"
          fontWeight="800"
          fontFamily="sans-serif"
        >
          {cornerText}
        </text>
        {/* Center emblem */}
        {suit === 'star' && (
          <path
            d="M29 27L32.6 34.4L40.8 35.6L34.9 41.3L36.3 49.4L29 45.6L21.7 49.4L23.1 41.3L17.2 35.6L25.4 34.4L29 27Z"
            fill="#FFC12B"
            stroke="#4F0716"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {suit === 'diamond' && (
          <polygon
            points="29,26 40,41 29,56 18,41"
            fill={accentFill}
            stroke="#4F0716"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {suit === 'spade' && (
          <path
            d="M29 26C29 26 18 35 18 42.5C18 47 21.5 49.5 25 49.5C26.8 49.5 28 48.7 29 47.5C30 48.7 31.2 49.5 33 49.5C36.5 49.5 40 47 40 42.5C40 35 29 26 29 26ZM26.5 48.5L24.5 55H33.5L31.5 48.5"
            fill="#4F0716"
          />
        )}
        {suit === 'crown' && (
          <path
            d="M17 48L19 32L25 38L29 28L33 38L39 32L41 48H17Z"
            fill="#FFC12B"
            stroke="#4F0716"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {/* Bottom-right corner mark */}
        <text
          x="45"
          y="71"
          fill="#4F0716"
          fontSize="11"
          fontWeight="800"
          fontFamily="sans-serif"
          textAnchor="end"
        >
          {cornerText}
        </text>
      </svg>
    </div>
  );
});

export function PlayingCardFan({
  className,
  float = false,
}: {
  className?: string;
  float?: boolean;
}) {
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      aria-hidden="true"
    >
      <PlayingCardMotif
        suit="diamond"
        cornerText="Q"
        tone="blue"
        size="sm"
        tilt={-14}
        float={float}
        className="-me-3 mt-2"
      />
      <PlayingCardMotif
        suit="crown"
        cornerText="★"
        tone="gold"
        size="md"
        tilt={0}
        float={float}
        className="z-10"
      />
      <PlayingCardMotif
        suit="star"
        cornerText="A"
        tone="white"
        size="sm"
        tilt={14}
        float={float}
        className="-ms-3 mt-2"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Original Swirl & Spiral Ornaments                                       */
/* -------------------------------------------------------------------------- */

export interface SwirlOrnamentProps {
  tone?: 'gold' | 'white' | 'maroon';
  size?: 'sm' | 'md' | 'lg';
  flip?: boolean;
  className?: string;
}

export function SwirlOrnament({
  tone = 'gold',
  size = 'md',
  flip = false,
  className,
}: SwirlOrnamentProps) {
  const stroke =
    tone === 'gold' ? '#FFC12B' : tone === 'white' ? '#FFFFFF' : '#4F0716';
  const dim = size === 'sm' ? 32 : size === 'lg' ? 60 : 44;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'inline-block shrink-0 select-none rtl:-scale-x-100',
        flip && '-scale-x-100 rtl:scale-x-100',
        className
      )}
      aria-hidden="true"
    >
      {/* Spiral swirl path with bold sticker edge */}
      <path
        d="M8 38C13 30 22 30 25 23C28 16 21 10 15 13C10 15.5 11 23 17 23C21 23 23 19 20 17"
        stroke="#4F0716"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M8 38C13 30 22 30 25 23C28 16 21 10 15 13C10 15.5 11 23 17 23C21 23 23 19 20 17"
        stroke={stroke}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* 4-point game-show spark */}
      <path
        d="M36 9L38 14L43 16L38 18L36 23L34 18L29 16L34 14L36 9Z"
        fill={tone === 'maroon' ? '#FFC12B' : stroke}
        stroke="#4F0716"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Original Confetti, Stars & Sparks Shapes                                */
/* -------------------------------------------------------------------------- */

export function ConfettiShapes({
  className,
  variant = 'stage',
}: {
  className?: string;
  variant?: 'stage' | 'paper';
}) {
  return (
    <svg
      viewBox="0 0 360 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pointer-events-none select-none', className)}
      aria-hidden="true"
    >
      {/* Gold 4-point sparkle */}
      <path
        d="M28 16L32 26L42 30L32 34L28 44L24 34L14 30L24 26L28 16Z"
        fill="#FFC12B"
        stroke="#4F0716"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Tilted white confetti ribbon */}
      <rect
        x="72"
        y="46"
        width="20"
        height="9"
        rx="4.5"
        transform="rotate(-24 72 46)"
        fill={variant === 'stage' ? '#FFFFFF' : '#C4163A'}
        stroke="#4F0716"
        strokeWidth="2.2"
      />
      {/* White-bordered blue diamond spark */}
      <polygon
        points="132,14 143,26 132,38 121,26"
        fill="#2F6BFF"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <polygon
        points="132,14 143,26 132,38 121,26"
        fill="none"
        stroke="#4F0716"
        strokeWidth="1.6"
      />
      {/* Gold star */}
      <path
        d="M192 42L195.8 50.2L204.8 51.3L198.2 57.5L199.9 66.4L192 62L184.1 66.4L185.8 57.5L179.2 51.3L188.2 50.2L192 42Z"
        fill="#FFD54A"
        stroke="#4F0716"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Red / White mini triangle */}
      <polygon
        points="248,18 264,28 246,37"
        fill={variant === 'stage' ? '#FFE899' : '#FF9F1C'}
        stroke="#4F0716"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Blue circle chip dot (white rimmed) */}
      <circle
        cx="296"
        cy="56"
        r="8.5"
        fill="#2F6BFF"
        stroke="#FFFFFF"
        strokeWidth="2.5"
      />
      {/* Swirl streamer */}
      <path
        d="M322 22C330 16 336 28 345 22"
        stroke={variant === 'stage' ? '#FFFFFF' : '#C4163A'}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. StickerOutline Box Helper                                               */
/* -------------------------------------------------------------------------- */

export interface StickerBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tilt?: -2 | -1 | 0 | 1 | 2;
  tone?: 'gold' | 'white' | 'red' | 'blue';
}

export function StickerBadge({
  tilt = 0,
  tone = 'gold',
  className,
  children,
  ...props
}: StickerBadgeProps) {
  const rotateClass = {
    '-2': '-rotate-2 rtl:rotate-2',
    '-1': '-rotate-1 rtl:rotate-1',
    '0': '',
    '1': 'rotate-1 rtl:-rotate-1',
    '2': 'rotate-2 rtl:-rotate-2',
  }[String(tilt)];

  const toneClass = {
    gold: 'bg-gold-gradient text-red-900 border-[2.5px] border-outline shadow-sticker',
    white: 'bg-white text-ink border-[2.5px] border-outline shadow-sticker',
    red: 'bg-red-600 text-white border-[2.5px] border-outline shadow-sticker',
    blue: 'bg-blue-600 text-white border-[2.5px] border-white ring-2 ring-outline shadow-sticker',
  }[tone];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-pill px-4 py-1.5 font-display text-sm tracking-wide',
        rotateClass,
        toneClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
