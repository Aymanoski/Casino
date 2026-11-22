'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface QuizCountdownRingProps {
  totalMs: number;
  remainingMs: number;
  isTimedOut?: boolean;
  className?: string;
}

/**
 * Huge Stage-Theme Circular 10-Second Countdown Ring (AGENTS.md §16.2 & DESIGN.md §6):
 * - Smooth continuous SVG ring depletion synced to stored wall-clock deadline.
 * - Crisp whole seconds (10 -> 0) in tabular display numerals.
 * - High-urgency pulse + crisp white flash border in the final 3 seconds (respects prefers-reduced-motion).
 */
export function QuizCountdownRing({
  totalMs,
  remainingMs,
  isTimedOut = false,
  className,
}: QuizCountdownRingProps) {
  const { lang } = useI18n();
  const safeTotal = Math.max(1000, totalMs);
  const clampedMs = Math.max(0, Math.min(safeTotal, remainingMs));
  const wholeSeconds = isTimedOut ? 0 : Math.ceil(clampedMs / 1000);
  const progress = isTimedOut ? 0 : clampedMs / safeTotal;

  const isUrgent = !isTimedOut && clampedMs > 0 && clampedMs <= 3000;
  const expired = isTimedOut || clampedMs <= 0;

  const viewSize = 180;
  const stroke = 11;
  const radius = (viewSize - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const ringStroke = expired
    ? 'var(--red-400)'
    : isUrgent
      ? 'var(--white)'
      : 'var(--gold-400)';

  return (
    <div
      data-testid="quiz-countdown"
      data-urgent={isUrgent ? 'true' : 'false'}
      data-expired={expired ? 'true' : 'false'}
      role="timer"
      aria-live="off"
      aria-label={
        lang === 'ar'
          ? `متبقي ${wholeSeconds} ثانية`
          : `${wholeSeconds} seconds remaining`
      }
      className={cn(
        '@container relative inline-flex aspect-square w-[clamp(132px,34vw,176px)] max-w-full items-center justify-center rounded-pill border-[3.5px] bg-red-900 text-white transition-colors',
        isUrgent
          ? 'animate-timer-urgent border-white ring-4 ring-white/95 shadow-[0_0_0_6px_var(--outline),0_0_28px_rgb(var(--live-rgb)/0.88)]'
          : expired
            ? 'border-white bg-red-800 shadow-sticker'
            : 'border-outline shadow-sticker',
        className
      )}
    >
      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="h-full w-full -rotate-90 transform p-1.5"
        aria-hidden="true"
      >
        <circle
          cx={viewSize / 2}
          cy={viewSize / 2}
          r={radius}
          fill="transparent"
          stroke="rgb(var(--live-rgb) / 0.2)"
          strokeWidth={stroke}
        />
        <circle
          cx={viewSize / 2}
          cy={viewSize / 2}
          r={radius}
          fill="transparent"
          stroke={ringStroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span
          data-testid="quiz-countdown-seconds"
          className={cn(
            'font-score text-[clamp(2.5rem,36cqi,4.25rem)] font-black leading-none tabular-nums',
            isUrgent || expired ? 'text-white' : 'text-gold-300'
          )}
        >
          {wholeSeconds}
        </span>
        <span
          className={cn(
            'mt-1 text-[clamp(0.6875rem,8cqi,0.8125rem)] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal leading-tight',
            isUrgent ? 'text-gold-200' : 'text-white/90'
          )}
        >
          {expired
            ? lang === 'ar'
              ? 'انتهى الوقت!'
              : 'TIME UP!'
            : isUrgent
              ? lang === 'ar'
                ? 'أسرع!'
                : 'HURRY!'
              : lang === 'ar'
                ? 'ثانية'
                : 'SEC'}
        </span>
      </div>
    </div>
  );
}
