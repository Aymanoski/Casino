'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SunburstStageProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'stage' | 'stageDark';
  animateRays?: boolean;
  vignette?: boolean;
  as?: 'section' | 'div' | 'header';
}

/**
 * SunburstStage
 * Full-bleed Stage surface featuring DESIGN.md §2 repeating-conic sunburst rays,
 * warm center spotlight glow, edge maroon vignette, and optional slow rotation
 * (respecting `prefers-reduced-motion`).
 */
export function SunburstStage({
  variant = 'stage',
  animateRays = true,
  vignette = true,
  as: Tag = 'section',
  className,
  children,
  ...props
}: SunburstStageProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldRotate = animateRays && !prefersReducedMotion;
  const isDark = variant === 'stageDark';

  return (
    <Tag
      className={cn(
        'relative overflow-hidden',
        isDark ? 'theme-stage-dark bg-red-900 text-white' : 'theme-stage bg-red-600 text-white',
        className
      )}
      {...props}
    >
      {/* Rotating Sunburst Conic Rays Layer */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 h-[max(220vmax,2200px)] w-[max(220vmax,2200px)] -translate-x-1/2 -translate-y-1/2 select-none',
          shouldRotate && 'animate-sunburst-slow'
        )}
        style={{
          backgroundImage: isDark
            ? 'repeating-conic-gradient(from 0deg at 50% 50%, #4F0716 0deg 10deg, #5F0A1C 10deg 20deg)'
            : 'repeating-conic-gradient(from 0deg at 50% 50%, #C4163A 0deg 10deg, #B21235 10deg 20deg)',
        }}
      />

      {/* Focal Warm Radial Spotlight Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 75% 65% at 50% 28%, rgba(196, 22, 58, 0.30) 0%, transparent 72%)'
            : 'radial-gradient(ellipse 75% 65% at 50% 35%, rgba(255, 232, 153, 0.24) 0%, rgba(255, 193, 43, 0.08) 42%, transparent 72%)',
        }}
      />

      {/* Edge Maroon Vignette */}
      {vignette && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 select-none"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 50% 50%, transparent 50%, rgba(36, 2, 10, 0.55) 100%)'
              : 'radial-gradient(circle at 50% 50%, transparent 50%, rgba(79, 7, 22, 0.42) 100%)',
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </Tag>
  );
}

export interface StageDividerProps {
  variant?: 'zigzag' | 'angled' | 'scallop';
  from?: 'stage' | 'stageDark' | 'paper';
  to?: 'paper' | 'stage' | 'stageDark';
  className?: string;
}

const SURFACE_HEX: Record<'stage' | 'stageDark' | 'paper', string> = {
  stage: '#C4163A',
  stageDark: '#4F0716',
  paper: '#FFF9F0',
};

/**
 * StageDivider
 * Angled, zig-zag, or scalloped SVG section transition between Stage and Paper
 * with a thick maroon sticker stroke per DESIGN.md §4.
 */
export function StageDivider({
  variant = 'zigzag',
  from = 'stage',
  to = 'paper',
  className,
}: StageDividerProps) {
  const topFill = SURFACE_HEX[from];
  const bottomFill = SURFACE_HEX[to];

  return (
    <div
      className={cn('relative w-full overflow-hidden leading-none select-none', className)}
      style={{ backgroundColor: topFill }}
      aria-hidden="true"
    >
      {variant === 'zigzag' && (
        <svg
          viewBox="0 0 1200 48"
          preserveAspectRatio="none"
          className="block h-7 w-full sm:h-10"
        >
          <path
            d="M0,48 L0,26 L40,8 L80,26 L120,8 L160,26 L200,8 L240,26 L280,8 L320,26 L360,8 L400,26 L440,8 L480,26 L520,8 L560,26 L600,8 L640,26 L680,8 L720,26 L760,8 L800,26 L840,8 L880,26 L920,8 L960,26 L1000,8 L1040,26 L1080,8 L1120,26 L1160,8 L1200,26 L1200,48 Z"
            fill={bottomFill}
          />
          <path
            d="M0,26 L40,8 L80,26 L120,8 L160,26 L200,8 L240,26 L280,8 L320,26 L360,8 L400,26 L440,8 L480,26 L520,8 L560,26 L600,8 L640,26 L680,8 L720,26 L760,8 L800,26 L840,8 L880,26 L920,8 L960,26 L1000,8 L1040,26 L1080,8 L1120,26 L1160,8 L1200,26"
            fill="none"
            stroke="#4F0716"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {variant === 'angled' && (
        <svg
          viewBox="0 0 1200 56"
          preserveAspectRatio="none"
          className="block h-8 w-full sm:h-12"
        >
          <polygon points="0,48 1200,8 1200,56 0,56" fill={bottomFill} />
          <line
            x1="0"
            y1="48"
            x2="1200"
            y2="8"
            stroke="#4F0716"
            strokeWidth="4"
          />
        </svg>
      )}

      {variant === 'scallop' && (
        <svg
          viewBox="0 0 1200 48"
          preserveAspectRatio="none"
          className="block h-7 w-full sm:h-10"
        >
          <path
            d="M0,48 L0,22 Q30,4 60,22 T120,22 T180,22 T240,22 T300,22 T360,22 T420,22 T480,22 T540,22 T600,22 T660,22 T720,22 T780,22 T840,22 T900,22 T960,22 T1020,22 T1080,22 T1140,22 T1200,22 L1200,48 Z"
            fill={bottomFill}
          />
          <path
            d="M0,22 Q30,4 60,22 T120,22 T180,22 T240,22 T300,22 T360,22 T420,22 T480,22 T540,22 T600,22 T660,22 T720,22 T780,22 T840,22 T900,22 T960,22 T1020,22 T1080,22 T1140,22 T1200,22"
            fill="none"
            stroke="#4F0716"
            strokeWidth="4"
          />
        </svg>
      )}
    </div>
  );
}
