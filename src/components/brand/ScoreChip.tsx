'use client';

import React from 'react';
import { cn, formatNumber } from '@/lib/utils';

export type ScoreChipTone = 'neutral' | 'positive' | 'negative' | 'live';

export interface ScoreChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: number | string;
  tone?: ScoreChipTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;
  useArabicIndicDigits?: boolean;
  interactive?: boolean;
  subtitle?: string;
}

const TONE_STYLES: Record<ScoreChipTone, { outer: string; inner: string; text: string }> = {
  neutral: {
    outer:
      'border-gold-500/80 bg-surface-2 shadow-[0_0_18px_rgba(232,184,75,0.25)]',
    inner: 'border-dashed border-gold-300/75 bg-bg-raised/90',
    text: 'text-gold-100',
  },
  positive: {
    outer:
      'border-positive/80 bg-positive/15 shadow-[0_0_18px_rgba(47,191,143,0.28)]',
    inner: 'border-dashed border-positive/80 bg-bg-raised/90',
    text: 'text-positive',
  },
  negative: {
    outer:
      'border-negative/80 bg-negative/15 shadow-[0_0_18px_rgba(214,51,76,0.28)]',
    inner: 'border-dashed border-negative/80 bg-bg-raised/90',
    text: 'text-negative',
  },
  live: {
    outer:
      'border-live/80 bg-live/15 shadow-[0_0_18px_rgba(255,77,77,0.30)]',
    inner: 'border-dashed border-live/80 bg-bg-raised/90',
    text: 'text-live',
  },
};

const SIZE_STYLES = {
  sm: {
    outer: 'h-9 w-9 p-1',
    interactiveOuter: 'h-11 w-11 min-h-[44px] min-w-[44px] p-1',
    text: 'text-xs',
    sub: 'text-[8px]',
  },
  md: {
    outer: 'h-12 w-12 p-1.5',
    interactiveOuter: 'h-12 w-12 min-h-[44px] min-w-[44px] p-1.5',
    text: 'text-base',
    sub: 'text-[9px]',
  },
  lg: {
    outer: 'h-16 w-16 p-1.5',
    interactiveOuter: 'h-16 w-16 p-1.5',
    text: 'text-xl',
    sub: 'text-[10px]',
  },
  xl: {
    outer: 'h-20 w-20 p-2',
    interactiveOuter: 'h-20 w-20 p-2',
    text: 'text-2xl',
    sub: 'text-[10px]',
  },
};

/**
 * ScoreChip (also exported as ChipBadge for Delighters hook point)
 * Circular poker chip badge with dashed inner ring and tabular number per DESIGN.md §5 & §6.
 * Enforces 44px minimum touch target whenever interactive or clickable.
 */
export function ScoreChip({
  value,
  tone,
  size = 'md',
  showSign = false,
  useArabicIndicDigits = false,
  interactive = false,
  subtitle,
  className,
  onClick,
  ...props
}: ScoreChipProps) {
  const numericVal = typeof value === 'number' ? value : Number(value);
  const resolvedTone: ScoreChipTone =
    tone ??
    (!Number.isNaN(numericVal)
      ? numericVal > 0 && showSign
        ? 'positive'
        : numericVal < 0
          ? 'negative'
          : 'neutral'
      : 'neutral');

  const styles = TONE_STYLES[resolvedTone];
  const dims = SIZE_STYLES[size];

  const displayText =
    typeof value === 'number'
      ? formatNumber(value, {
          sign: showSign,
          useArabicIndicDigits,
        })
      : String(value);

  const isButton = interactive || Boolean(onClick);

  const chipContent = (
    <span
      className={cn(
        'flex h-full w-full flex-col items-center justify-center rounded-pill border-2 leading-none',
        styles.inner
      )}
    >
      <span
        className={cn(
          'font-score font-bold tracking-wider tabular-nums',
          dims.text,
          styles.text
        )}
      >
        {displayText}
      </span>
      {subtitle && (
        <span
          className={cn(
            'mt-0.5 uppercase tracking-widest text-text-muted',
            dims.sub
          )}
        >
          {subtitle}
        </span>
      )}
    </span>
  );

  if (isButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group relative inline-flex shrink-0 items-center justify-center rounded-pill border-2 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          dims.interactiveOuter,
          styles.outer,
          className
        )}
        {...props}
      >
        {chipContent}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-pill border-2 select-none',
        dims.outer,
        styles.outer,
        className
      )}
      aria-label={`${displayText}${subtitle ? ` ${subtitle}` : ''}`}
    >
      {chipContent}
    </div>
  );
}

export const ChipBadge = ScoreChip;
