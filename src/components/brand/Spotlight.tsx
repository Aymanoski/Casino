import React from 'react';
import { cn } from '@/lib/utils';

export interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: 'subtle' | 'medium' | 'dramatic';
  beams?: 'single' | 'dual' | 'triple';
  overlayOnly?: boolean;
}

/**
 * Spotlight
 * Overhead TV game-show light beams & focal bloom for Stage sections per DESIGN.md §5.
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
      {/* Center overhead warm radial light bloom */}
      <div
        className="absolute -top-24 left-1/2 h-[360px] w-[min(100vw,780px)] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255, 232, 153, 0.28) 0%, rgba(255, 193, 43, 0.12) 45%, transparent 75%)',
        }}
      />

      {(beams === 'dual' || beams === 'triple') && (
        <div
          className="absolute -top-20 left-[12%] h-[420px] w-[min(42vw,260px)] origin-top -rotate-[22deg] blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 232, 153, 0.24) 0%, rgba(255, 193, 43, 0.08) 60%, transparent 100%)',
          }}
        />
      )}

      {(beams === 'dual' || beams === 'triple') && (
        <div
          className="absolute -top-20 right-[12%] h-[420px] w-[min(42vw,260px)] origin-top rotate-[22deg] blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 232, 153, 0.24) 0%, rgba(255, 193, 43, 0.08) 60%, transparent 100%)',
          }}
        />
      )}

      {(beams === 'single' || beams === 'triple') && (
        <div
          className="absolute -top-16 left-1/2 h-[440px] w-[min(55vw,320px)] -translate-x-1/2 blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 193, 43, 0.09) 65%, transparent 100%)',
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
