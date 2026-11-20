'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface LanternProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  sway?: boolean;
  swayDuration?: number;
  swayDelay?: number;
  chainLength?: number;
  glow?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { width: 28, height: 52 },
  md: { width: 40, height: 74 },
  lg: { width: 56, height: 104 },
  xl: { width: 76, height: 138 },
};

/**
 * Lantern (Fanous)
 * Subtle secondary Ramadan motif per DESIGN.md §5:
 * gold-to-orange gradient body, deep maroon sticker outline, warm cream flame.
 * Uses pure compositor-thread CSS sway (auto-disabled in `prefers-reduced-motion`).
 */
export const Lantern = React.memo(function Lantern({
  size = 'md',
  sway = true,
  swayDuration = 4.2,
  swayDelay = 0,
  chainLength = 14,
  glow = true,
  className,
}: LanternProps) {
  const uid = useId().replace(/:/g, '');
  const dims = SIZE_MAP[size];

  const swayStyle = {
    transformOrigin: 'top center',
    ...(sway
      ? {
          '--sway-duration': `${swayDuration}s`,
          '--sway-delay': `${swayDelay}s`,
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center select-none',
        glow && 'drop-shadow-[0_0_18px_rgba(255,193,43,0.45)]',
        sway && 'animate-lantern-sway',
        className
      )}
      style={swayStyle}
      aria-hidden="true"
    >
      <svg
        width={dims.width}
        height={dims.height + chainLength}
        viewBox={`0 0 64 ${110 + chainLength}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <radialGradient id={`lantern-glow-${uid}`} cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor="#FFE899" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFC12B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFC12B" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`lantern-gold-${uid}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FFE899" />
            <stop offset="45%" stopColor="#FFC12B" />
            <stop offset="100%" stopColor="#E8740C" />
          </linearGradient>
        </defs>

        {/* Hanging Chain */}
        {chainLength > 0 && (
          <line
            x1="32"
            y1="0"
            x2="32"
            y2={chainLength}
            stroke="#4F0716"
            strokeWidth="2.5"
            strokeDasharray="3 2"
          />
        )}

        <g transform={`translate(0, ${chainLength})`}>
          {glow && (
            <circle cx="32" cy="58" r="28" fill={`url(#lantern-glow-${uid})`} />
          )}

          {/* Top Suspension Ring */}
          <circle
            cx="32"
            cy="7"
            r="4.5"
            stroke="#4F0716"
            strokeWidth="2.5"
            fill="#FFE899"
          />
          <path
            d="M28 14C28 11.5 30 10.5 32 10.5C34 10.5 36 11.5 36 14"
            stroke="#4F0716"
            strokeWidth="2.2"
          />

          {/* Dome */}
          <path
            d="M18 28C18 19.5 25 16.5 32 13.5C39 16.5 46 19.5 46 28H18Z"
            fill={`url(#lantern-gold-${uid})`}
            stroke="#4F0716"
            strokeWidth="2.5"
          />

          {/* Upper Crown Rim */}
          <path
            d="M12 28H52L47 35H17L12 28Z"
            fill="#C4163A"
            stroke="#4F0716"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="22" cy="31.5" r="1.4" fill="#FFE899" />
          <circle cx="32" cy="31.5" r="1.6" fill="#FFFFFF" />
          <circle cx="42" cy="31.5" r="1.4" fill="#FFE899" />

          {/* Main Tapered Glass Body */}
          <path
            d="M17 35H47L51 69H13L17 35Z"
            fill="#FFF9F0"
            stroke="#4F0716"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />

          {/* Brass Lattice */}
          <path
            d="M24 35L22 69M40 35L42 69"
            stroke="#E8740C"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Glowing Inner Flame */}
          <path
            d="M32 42C36 47.4 38 51 38 54.5C38 58 35.4 60.5 32 60.5C28.6 60.5 26 58 26 54.5C26 51 28 47.4 32 42Z"
            fill="#FFC12B"
            stroke="#4F0716"
            strokeWidth="1.6"
          />
          <path
            d="M32 47.5C34 50.5 35 52.6 35 54.6C35 56.5 33.7 58 32 58C30.3 58 29 56.5 29 54.6C29 52.6 30 50.5 32 47.5Z"
            fill="#FFFFFF"
          />

          {/* Lower Pedestal Base */}
          <path
            d="M13 69H51L44 79H20L13 69Z"
            fill={`url(#lantern-gold-${uid})`}
            stroke="#4F0716"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M17 79H47L45 83H19L17 79Z"
            fill="#C4163A"
            stroke="#4F0716"
            strokeWidth="2.2"
          />

          {/* Bottom Finial */}
          <path
            d="M27 83H37L32 91L27 83Z"
            fill="#FFC12B"
            stroke="#4F0716"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="94" r="2.2" fill="#FFE899" stroke="#4F0716" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
});

export const LanternCluster = React.memo(function LanternCluster({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn('inline-flex items-start gap-3 md:gap-5', className)}
      aria-hidden="true"
    >
      <Lantern size="sm" chainLength={18} swayDuration={3.8} swayDelay={0.2} />
      <Lantern size="lg" chainLength={8} swayDuration={4.6} swayDelay={0} />
      <Lantern size="md" chainLength={26} swayDuration={4.1} swayDelay={0.6} />
    </div>
  );
});
