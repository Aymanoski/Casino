'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface MarqueeBulbsProps {
  /** 'strip' renders a single row of warm bulbs; 'perimeter' wraps children with bulbs on all 4 edges */
  variant?: 'strip' | 'perimeter';
  bulbCount?: number;
  chase?: boolean;
  tone?: 'gold' | 'red';
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
          'inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-pill border border-red-900/70 transition-opacity duration-500',
          tone === 'gold'
            ? isEven
              ? 'bg-gold-200 shadow-[0_0_8px_2px_rgba(255,232,153,0.85)]'
              : 'bg-gold-400 shadow-[0_0_8px_2px_rgba(255,193,43,0.75)]'
            : isEven
              ? 'bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.85)]'
              : 'bg-red-400 shadow-[0_0_8px_2px_rgba(229,64,92,0.75)]',
          shouldChase
            ? 'animate-pulse'
            : isEven
              ? 'opacity-100'
              : 'opacity-75'
        )}
      />
    );
  };

  if (variant === 'strip') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-1.5 sm:gap-2 rounded-pill border-2 border-outline bg-red-900 px-3 sm:px-4 py-2 shadow-sticker-sm',
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

  const topBottomCount = Math.max(6, Math.min(18, bulbCount));
  const sideCount = Math.max(4, Math.floor(topBottomCount * 0.55));

  return (
    <div className={cn('relative p-3.5 sm:p-5', className)}>
      <div
        className="pointer-events-none absolute inset-0 rounded-[26px] border-[3px] border-outline bg-red-900 shadow-sticker-lg"
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
        {/* Start bulbs */}
        <div className="absolute inset-y-6 start-1.5 flex flex-col items-center justify-between">
          {Array.from({ length: sideCount }).map((_, i) =>
            renderBulb(i + 1, 'start')
          )}
        </div>
        {/* End bulbs */}
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
