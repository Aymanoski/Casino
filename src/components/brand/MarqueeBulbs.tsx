'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface MarqueeBulbsProps {
  /** 'strip' renders a single row of warm bulbs; 'perimeter' wraps children with bulbs on all 4 edges */
  variant?: 'strip' | 'perimeter';
  bulbCount?: number;
  chase?: boolean;
  tone?: 'gold' | 'red';
  size?: 'default' | 'stage';
  className?: string;
  children?: React.ReactNode;
}

export const MarqueeBulbs = React.memo(function MarqueeBulbs({
  variant = 'strip',
  bulbCount = 14,
  chase = true,
  tone = 'gold',
  size = 'default',
  className,
  children,
}: MarqueeBulbsProps) {
  const isStageSize = size === 'stage';

  const renderBulb = (index: number, keyPrefix: string) => {
    const isEven = index % 2 === 0;
    const delayMs = (index % 4) * 350;

    return (
      <span
        key={`${keyPrefix}-${index}`}
        style={
          chase
            ? {
                animationDelay: `${delayMs}ms`,
              }
            : undefined
        }
        className={cn(
          'inline-block rounded-pill border border-red-900/70 transition-opacity duration-500',
          isStageSize
            ? 'h-2 w-2 sm:h-2.5 sm:w-2.5 lg:h-3 lg:w-3 3xl:h-4 3xl:w-4'
            : 'h-2 w-2 sm:h-2.5 sm:w-2.5',
          tone === 'gold'
            ? isEven
              ? 'bg-gold-200 shadow-[0_0_8px_2px_rgba(255,232,153,0.85)]'
              : 'bg-gold-400 shadow-[0_0_8px_2px_rgba(255,193,43,0.75)]'
            : isEven
              ? 'bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.85)]'
              : 'bg-red-400 shadow-[0_0_8px_2px_rgba(229,64,92,0.75)]',
          chase
            ? 'animate-pulse motion-reduce:animate-none'
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

  const maxBulbs = isStageSize ? 24 : 18;
  const topBottomCount = Math.max(6, Math.min(maxBulbs, bulbCount));
  const sideCount = Math.max(4, Math.floor(topBottomCount * 0.55));

  return (
    <div
      className={cn(
        'relative',
        isStageSize ? 'p-3.5 sm:p-5 lg:p-6 3xl:p-8' : 'p-3.5 sm:p-5',
        className
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 border-[3px] border-outline bg-red-900 shadow-sticker-lg',
          isStageSize ? 'rounded-[22px] sm:rounded-[28px]' : 'rounded-marquee'
        )}
        aria-hidden="true"
      >
        {/* Top bulbs */}
        <div
          className={cn(
            'absolute flex items-center justify-between',
            isStageSize
              ? 'inset-x-5 sm:inset-x-7 lg:inset-x-9 top-1.5 sm:top-2 3xl:top-2.5'
              : 'inset-x-4 sm:inset-x-5 top-1.5'
          )}
        >
          {Array.from({ length: topBottomCount }).map((_, i) =>
            renderBulb(i, 'top')
          )}
        </div>
        {/* Bottom bulbs */}
        <div
          className={cn(
            'absolute flex items-center justify-between',
            isStageSize
              ? 'inset-x-5 sm:inset-x-7 lg:inset-x-9 bottom-1.5 sm:bottom-2 3xl:bottom-2.5'
              : 'inset-x-4 sm:inset-x-5 bottom-1.5'
          )}
        >
          {Array.from({ length: topBottomCount }).map((_, i) =>
            renderBulb(topBottomCount - i, 'bottom')
          )}
        </div>
        {/* Start bulbs */}
        <div
          className={cn(
            'absolute flex flex-col items-center justify-between',
            isStageSize
              ? 'inset-y-6 sm:inset-y-8 lg:inset-y-10 start-1.5 sm:start-2 3xl:start-2.5'
              : 'inset-y-6 start-1.5'
          )}
        >
          {Array.from({ length: sideCount }).map((_, i) =>
            renderBulb(i + 1, 'start')
          )}
        </div>
        {/* End bulbs */}
        <div
          className={cn(
            'absolute flex flex-col items-center justify-between',
            isStageSize
              ? 'inset-y-6 sm:inset-y-8 lg:inset-y-10 end-1.5 sm:end-2 3xl:end-2.5'
              : 'inset-y-6 end-1.5'
          )}
        >
          {Array.from({ length: sideCount }).map((_, i) =>
            renderBulb(sideCount - i, 'end')
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-1 min-h-0 h-full w-full flex-col">
        {children}
      </div>
    </div>
  );
});
