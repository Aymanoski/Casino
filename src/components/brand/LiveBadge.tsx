'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface LiveBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  /** 'stage' = white pill with pulsing red dot; 'paper' = red pill with pulsing white dot */
  surface?: 'stage' | 'paper';
}

/**
 * LiveBadge
 * Per DESIGN.md §6:
 * - On Stage surfaces: white pill with a pulsing red dot and "LIVE" ("مباشر").
 * - On Paper surfaces: red pill with a pulsing white dot.
 */
export function LiveBadge({
  label,
  size = 'md',
  pulse = true,
  surface = 'stage',
  className,
  ...props
}: LiveBadgeProps) {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const shouldPulse = pulse && !prefersReducedMotion;

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-[11px] gap-1.5',
    md: 'px-3.5 py-1 text-xs gap-2',
    lg: 'px-4 py-1.5 text-xs sm:text-sm gap-2',
  }[size];

  const isPaper = surface === 'paper';

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center justify-center rounded-pill border-2 border-outline text-center font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal shadow-sticker-sm',
        isPaper ? 'bg-red-600 text-white' : 'bg-white text-red-600',
        sizeStyles,
        className
      )}
      {...props}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        {shouldPulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-pill opacity-75',
              isPaper ? 'bg-white' : 'bg-red-600'
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex h-2.5 w-2.5 rounded-pill',
            isPaper ? 'bg-white' : 'bg-red-600'
          )}
        />
      </span>
      <span>{label ?? t.common.live}</span>
    </span>
  );
}
