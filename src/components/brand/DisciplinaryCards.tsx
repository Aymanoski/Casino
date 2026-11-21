'use client';

import React from 'react';
import { cn, formatNumber } from '@/lib/utils';
import {
  formatScoreEventDisplay,
  getCardTypeFromAuditAction,
  stripCardNotePrefix,
  type DisciplinaryCardType,
} from '@/lib/utils/scorerFormat';

export {
  formatScoreEventDisplay,
  getCardTypeFromAuditAction,
  stripCardNotePrefix,
  type DisciplinaryCardType,
};

/**
 * Original SVG disciplinary card glyph (DESIGN.md §6 — never emoji, never color alone).
 * Yellow card displays an exclamation triangle-bar mark; Red card displays a crisp cross mark.
 */
export function DisciplinaryCardIcon({
  card,
  size = 'md',
  className,
}: {
  card: DisciplinaryCardType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims =
    size === 'xs'
      ? 'h-4 w-3'
      : size === 'sm'
        ? 'h-5 w-4'
        : size === 'lg'
          ? 'h-7 w-5'
          : 'h-6 w-4.5';

  const fill = card === 'yellow' ? 'var(--gold-400)' : 'var(--negative)';
  const innerStroke = card === 'yellow' ? 'var(--red-900)' : 'var(--white)';

  return (
    <svg
      viewBox="0 0 20 26"
      fill="none"
      aria-hidden="true"
      className={cn(dims, 'shrink-0', className)}
    >
      <rect
        x="1.5"
        y="1.5"
        width="17"
        height="23"
        rx="3.2"
        fill={fill}
        stroke="var(--red-900)"
        strokeWidth="2.4"
      />
      {card === 'yellow' ? (
        <>
          <line
            x1="10"
            y1="7"
            x2="10"
            y2="14.2"
            stroke={innerStroke}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="18.6" r="1.45" fill={innerStroke} />
        </>
      ) : (
        <>
          <line
            x1="6.6"
            y1="9.2"
            x2="13.4"
            y2="16.8"
            stroke={innerStroke}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <line
            x1="13.4"
            y1="9.2"
            x2="6.6"
            y2="16.8"
            stroke={innerStroke}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Card-shaped counter chip displaying a player's yellow or red card count (derived by kind).
 */
export function CardCountChip({
  card,
  count,
  surface = 'dark',
  size = 'md',
  useArabicIndicDigits = false,
  lang = 'en',
  className,
}: {
  card: DisciplinaryCardType;
  count: number;
  surface?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  useArabicIndicDigits?: boolean;
  lang?: 'en' | 'ar';
  className?: string;
}) {
  const isActive = count > 0;
  const label =
    card === 'yellow'
      ? lang === 'ar'
        ? `${formatNumber(count, { useArabicIndicDigits })} بطاقة صفراء`
        : `${count} yellow ${count === 1 ? 'card' : 'cards'}`
      : lang === 'ar'
        ? `${formatNumber(count, { useArabicIndicDigits })} بطاقة حمراء`
        : `${count} red ${count === 1 ? 'card' : 'cards'}`;

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-input border-2 font-score font-black tabular-nums leading-none transition-colors',
        size === 'sm'
          ? 'px-2 py-1 text-sm'
          : size === 'lg'
            ? 'px-3 py-1.5 text-xl sm:text-2xl'
            : 'px-2.5 py-1 text-base',
        isActive
          ? card === 'yellow'
            ? 'border-outline bg-gold-300 text-red-900 shadow-sticker-sm'
            : 'border-outline bg-negative text-white shadow-sticker-sm'
          : surface === 'dark'
            ? 'border-white/20 bg-red-900/70 text-white/75'
            : 'border-border-paper bg-paper text-ink-muted',
        className
      )}
    >
      <DisciplinaryCardIcon
        card={card}
        size={size === 'lg' ? 'md' : size === 'sm' ? 'xs' : 'sm'}
      />
      <span>{formatNumber(count, { useArabicIndicDigits })}</span>
    </span>
  );
}

/**
 * Paired Yellow & Red card counter group for player panels, scoreboards, and Big Screen.
 */
export function CardCounterGroup({
  yellowCount,
  redCount,
  surface = 'dark',
  size = 'md',
  useArabicIndicDigits = false,
  lang = 'en',
  hideZeros = false,
  className,
}: {
  yellowCount: number;
  redCount: number;
  surface?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  useArabicIndicDigits?: boolean;
  lang?: 'en' | 'ar';
  hideZeros?: boolean;
  className?: string;
}) {
  if (hideZeros && yellowCount === 0 && redCount === 0) {
    return null;
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      role="group"
      aria-label={lang === 'ar' ? 'البطاقات الإنذارية' : 'Disciplinary cards'}
    >
      {(!hideZeros || yellowCount > 0) && (
        <CardCountChip
          card="yellow"
          count={yellowCount}
          surface={surface}
          size={size}
          useArabicIndicDigits={useArabicIndicDigits}
          lang={lang}
        />
      )}
      {(!hideZeros || redCount > 0) && (
        <CardCountChip
          card="red"
          count={redCount}
          surface={surface}
          size={size}
          useArabicIndicDigits={useArabicIndicDigits}
          lang={lang}
        />
      )}
    </div>
  );
}
