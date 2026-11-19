'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

export type ScoreChipTone =
  | 'gold'
  | 'red'
  | 'white'
  | 'blue'
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'info'
  | 'plain'
  | 'live';

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

const TONE_STYLES: Record<
  ScoreChipTone,
  { outer: string; inner: string; text: string; sub: string }
> = {
  gold: {
    outer: 'border-outline bg-gold-400 shadow-sticker-sm',
    inner: 'border-dashed border-red-900/75 bg-gold-200',
    text: 'text-red-900',
    sub: 'text-red-900/80',
  },
  neutral: {
    outer: 'border-outline bg-gold-400 shadow-sticker-sm',
    inner: 'border-dashed border-red-900/75 bg-gold-200',
    text: 'text-red-900',
    sub: 'text-red-900/80',
  },
  red: {
    outer: 'border-outline bg-red-600 shadow-sticker-sm',
    inner: 'border-dashed border-white/85 bg-red-700',
    text: 'text-white',
    sub: 'text-white/90',
  },
  white: {
    outer: 'border-outline bg-white shadow-sticker-sm',
    inner: 'border-dashed border-red-900/50 bg-paper',
    text: 'text-ink',
    sub: 'text-ink-muted',
  },
  plain: {
    outer: 'border-outline bg-white shadow-sticker-sm',
    inner: 'border-dashed border-red-900/50 bg-paper',
    text: 'text-ink',
    sub: 'text-ink-muted',
  },
  blue: {
    outer: 'border-white bg-blue-600 ring-2 ring-outline shadow-sticker-sm',
    inner: 'border-dashed border-white/85 bg-blue-800',
    text: 'text-white',
    sub: 'text-white/95',
  },
  info: {
    outer: 'border-white bg-blue-600 ring-2 ring-outline shadow-sticker-sm',
    inner: 'border-dashed border-white/85 bg-blue-800',
    text: 'text-white',
    sub: 'text-white/95',
  },
  positive: {
    outer: 'border-outline bg-positive shadow-sticker-sm',
    inner: 'border-dashed border-positive bg-positive-soft',
    text: 'text-positive-ink',
    sub: 'text-positive-ink/85',
  },
  negative: {
    outer: 'border-outline bg-negative shadow-sticker-sm',
    inner: 'border-dashed border-white/80 bg-negative',
    text: 'text-white',
    sub: 'text-white/90',
  },
  live: {
    outer: 'border-outline bg-white shadow-sticker-sm',
    inner: 'border-dashed border-white/85 bg-red-600',
    text: 'text-white',
    sub: 'text-white/90',
  },
};

const SIZE_STYLES = {
  sm: {
    outer: 'h-10 w-10 p-1',
    interactiveOuter: 'h-11 w-11 min-h-[44px] min-w-[44px] p-1',
    text: 'text-xs',
    sub: 'text-[11px]',
    icon: 'h-3 w-3',
  },
  md: {
    outer: 'h-14 w-14 p-1.5',
    interactiveOuter: 'h-14 w-14 min-h-[44px] min-w-[44px] p-1.5',
    text: 'text-base',
    sub: 'text-[11px]',
    icon: 'h-3 w-3',
  },
  lg: {
    outer: 'h-[68px] w-[68px] p-1.5',
    interactiveOuter: 'h-[68px] w-[68px] p-1.5',
    text: 'text-xl',
    sub: 'text-[11px]',
    icon: 'h-3.5 w-3.5',
  },
  xl: {
    outer: 'h-20 w-20 p-2',
    interactiveOuter: 'h-20 w-20 p-2',
    text: 'text-2xl',
    sub: 'text-[11px]',
    icon: 'h-4 w-4',
  },
};

/**
 * ScoreChip (also exported as ChipBadge for Delighters hook point)
 * Circular casino chip badge with dashed inner ring, thick maroon outline,
 * hard offset sticker shadow, and tabular numerals per DESIGN.md §5 & §6.
 * Classic 4 chip colors (red, white, blue, gold) + positive/negative with explicit +/- icons.
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
          : 'gold'
      : 'gold');

  const styles = TONE_STYLES[resolvedTone];
  const dims = SIZE_STYLES[size];

  const isNegative = resolvedTone === 'negative' || (!Number.isNaN(numericVal) && numericVal < 0);
  const isPositive = resolvedTone === 'positive' || (!Number.isNaN(numericVal) && numericVal > 0 && showSign);

  // Format numeric values using true typographical minus (\u2212) when negative
  const rawDisplayText =
    typeof value === 'number'
      ? formatNumber(Math.abs(value), {
          sign: false,
          useArabicIndicDigits,
        })
      : String(value).replace(/^[+-]/, '');

  const signChar = isNegative ? '−' : isPositive ? '+' : '';
  const displayText =
    typeof value === 'number' || showSign || isNegative
      ? `${signChar}${rawDisplayText}`
      : String(value);

  const isButton = interactive || Boolean(onClick);

  const isCompactDigits = displayText.length >= 4;

  const chipContent = (
    <span
      className={cn(
        'flex h-full w-full flex-col items-center justify-center rounded-pill border-2 leading-none',
        styles.inner
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center gap-0.5 font-score font-black tracking-normal tabular-nums',
          isCompactDigits && size === 'md' ? 'text-sm' : dims.text,
          styles.text
        )}
      >
        <span>{displayText}</span>
      </span>
      {subtitle && (
        <span
          className={cn(
            'mt-0.5 flex items-center gap-0.5 font-bold uppercase ltr:tracking-wider rtl:tracking-normal leading-none',
            dims.sub,
            styles.sub
          )}
        >
          {isPositive && <Plus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />}
          {isNegative && <Minus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />}
          <span>{subtitle}</span>
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
          'group relative inline-flex shrink-0 items-center justify-center rounded-pill border-[2.5px] sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
        'relative inline-flex shrink-0 items-center justify-center rounded-pill border-[2.5px] select-none',
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
