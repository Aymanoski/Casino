'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface LiveBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function LiveBadge({
  label,
  size = 'md',
  pulse = true,
  className,
  ...props
}: LiveBadgeProps) {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const shouldPulse = pulse && !prefersReducedMotion;

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-[11px] gap-1.5',
    md: 'px-3 py-1 text-xs gap-2',
    lg: 'px-4 py-1.5 text-sm gap-2',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border border-live/60 bg-live/15 font-bold uppercase tracking-wider text-live shadow-[0_0_16px_rgba(255,77,77,0.28)]',
        sizeStyles,
        className
      )}
      {...props}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {shouldPulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-live opacity-80" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-pill bg-live" />
      </span>
      <span>{label ?? t.common.live}</span>
    </span>
  );
}
