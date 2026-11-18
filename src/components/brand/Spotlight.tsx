import React from 'react';
import { cn } from '@/lib/utils';

export interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: 'subtle' | 'medium' | 'dramatic';
  beams?: 'single' | 'dual' | 'triple';
  overlayOnly?: boolean;
}

/**
 * Spotlight
 * Overhead casino/game-show stage light beams per DESIGN.md §5.
 */
export function Spotlight({
  intensity = 'medium',
  beams = 'dual',
  overlayOnly = false,
  className,
  children,
  ...props
}: SpotlightProps) {
  const opacityClass = {
    subtle: 'opacity-45',
    medium: 'opacity-75',
    dramatic: 'opacity-100',
  }[intensity];

  const beamsLayer = (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden select-none',
        opacityClass
      )}
      aria-hidden="true"
    >
      {/* Center overhead radial stage glow */}
      <div
        className="absolute -top-24 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(251, 235, 181, 0.22) 0%, rgba(232, 184, 75, 0.10) 45%, transparent 75%)',
        }}
      />

      {/* Left angled stage beam */}
      {(beams === 'dual' || beams === 'triple') && (
        <div
          className="absolute -top-20 left-[12%] h-[460px] w-[260px] origin-top -rotate-[22deg] blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(251, 235, 181, 0.20) 0%, rgba(232, 184, 75, 0.06) 60%, transparent 100%)',
          }}
        />
      )}

      {/* Right angled stage beam */}
      {(beams === 'dual' || beams === 'triple') && (
        <div
          className="absolute -top-20 right-[12%] h-[460px] w-[260px] origin-top rotate-[22deg] blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(251, 235, 181, 0.20) 0%, rgba(232, 184, 75, 0.06) 60%, transparent 100%)',
          }}
        />
      )}

      {/* Center vertical hero beam */}
      {(beams === 'single' || beams === 'triple') && (
        <div
          className="absolute -top-16 left-1/2 h-[480px] w-[320px] -translate-x-1/2 blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(251, 235, 181, 0.24) 0%, rgba(232, 184, 75, 0.07) 65%, transparent 100%)',
          }}
        />
      )}
    </div>
  );

  if (overlayOnly) {
    return beamsLayer;
  }

  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      {beamsLayer}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
