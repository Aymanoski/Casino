'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface MarqueeBulbsProps {
  /** 'strip' renders a single row of warm bulbs; 'perimeter' wraps children with bulbs on all 4 edges */
  variant?: 'strip' | 'perimeter';
  bulbCount?: number;
  chase?: boolean;
  tone?: 'gold' | 'ruby';
  className?: string;
  children?: React.ReactNode;
}

export function MarqueeBulbs({
  variant = 'strip',
  bulbCount = 14,
  chase = true,
  tone = 'gold',
  className,
  children,
}: MarqueeBulbsProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldChase = chase && !prefersReducedMotion;

  const renderBulb = (index: number, keyPrefix: string) => {
    const isEven = index % 2 === 0;
    const delayMs = (index % 4) * 350;

    return (
      <span
        key={`${keyPrefix}-${index}`}
        style={
          shouldChase
            ? {
                animationDelay: `${delayMs}ms`,
              }
            : undefined
        }
        className={cn(
          'inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-pill transition-opacity duration-500',
          tone === 'gold'
            ? 'bg-gold-100 shadow-[0_0_8px_2px_rgba(251,235,181,0.75)]'
            : 'bg-live shadow-[0_0_8px_2px_rgba(255,77,77,0.75)]',
          shouldChase
            ? 'animate-pulse'
            : isEven
              ? 'opacity-95'
              : 'opacity-70'
        )}
      />
    );
  };

  if (variant === 'strip') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-1.5 sm:gap-2 rounded-pill border border-border-strong bg-bg/90 px-3 sm:px-4 py-2',
          className
        )}
        aria-hidden="true"
      >
        {Array.from({ length: bulbCount }).map((_, idx) =>
          renderBulb(idx, 'strip')
        )}
      </div>
    );
  }

  // Perimeter mode around a card or showcase frame
  const topBottomCount = Math.max(6, Math.min(18, bulbCount));
  const sideCount = Math.max(4, Math.floor(topBottomCount * 0.55));

  return (
    <div className={cn('relative p-3 sm:p-5', className)}>
      {/* Outer marquee frame track */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[24px] sm:rounded-[26px] border border-border-strong bg-bg-raised/75 shadow-glow-gold"
        aria-hidden="true"
      >
        {/* Top bulbs */}
        <div className="absolute inset-x-4 sm:inset-x-5 top-1.5 flex items-center justify-between">
          {Array.from({ length: topBottomCount }).map((_, i) =>
            renderBulb(i, 'top')
          )}
        </div>
        {/* Bottom bulbs */}
        <div className="absolute inset-x-4 sm:inset-x-5 bottom-1.5 flex items-center justify-between">
          {Array.from({ length: topBottomCount }).map((_, i) =>
            renderBulb(topBottomCount - i, 'bottom')
          )}
        </div>
        {/* Left / Start bulbs */}
        <div className="absolute inset-y-6 start-1.5 flex flex-col items-center justify-between">
          {Array.from({ length: sideCount }).map((_, i) =>
            renderBulb(i + 1, 'start')
          )}
        </div>
        {/* Right / End bulbs */}
        <div className="absolute inset-y-6 end-1.5 flex flex-col items-center justify-between">
          {Array.from({ length: sideCount }).map((_, i) =>
            renderBulb(sideCount - i, 'end')
          )}
        </div>
      </div>

      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
