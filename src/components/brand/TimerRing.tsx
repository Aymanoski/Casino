'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';

export interface TimerRingProps {
  durationSec: number;
  remainingSec: number;
  status?: 'idle' | 'running' | 'paused';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showControls?: boolean;
  useArabicIndicDigits?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { px: 88, stroke: 5, text: 'text-2xl', sub: 'text-[9px]' },
  md: { px: 124, stroke: 6, text: 'text-4xl', sub: 'text-[10px]' },
  lg: { px: 164, stroke: 8, text: 'text-5xl', sub: 'text-xs' },
  xl: { px: 210, stroke: 10, text: 'text-6xl', sub: 'text-xs' },
};

/**
 * TimerRing
 * Per DESIGN.md §6:
 * Large numeric with a circular gold progress ring;
 * turns casino ruby (--negative) and pulses in the last 5 seconds.
 */
export function TimerRing({
  durationSec,
  remainingSec,
  status = 'idle',
  size = 'md',
  showControls = false,
  useArabicIndicDigits = false,
  onStart,
  onPause,
  onReset,
  className,
}: TimerRingProps) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const cfg = SIZE_CONFIG[size];
  const radius = (cfg.px - cfg.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeDuration = Math.max(1, durationSec);
  const clampedRemaining = Math.max(0, Math.min(safeDuration, remainingSec));
  const progress = clampedRemaining / safeDuration;
  const dashOffset = circumference * (1 - progress);

  const isUrgent = clampedRemaining > 0 && clampedRemaining <= 5;
  const isExpired = clampedRemaining === 0;

  const mins = Math.floor(clampedRemaining / 60);
  const secs = clampedRemaining % 60;
  const formattedTime =
    mins > 0
      ? `${formatNumber(mins, { useArabicIndicDigits })}:${formatNumber(
          secs.toString().padStart(2, '0'),
          { useArabicIndicDigits }
        )}`
      : `${formatNumber(secs, { useArabicIndicDigits })}s`;

  return (
    <div className={cn('inline-flex flex-col items-center gap-3', className)}>
      <motion.div
        animate={
          isUrgent && !prefersReducedMotion
            ? { scale: [1, 1.05, 1] }
            : { scale: 1 }
        }
        transition={
          isUrgent && !prefersReducedMotion
            ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
        className={cn(
          'relative inline-flex items-center justify-center rounded-pill bg-bg-raised/90',
          isUrgent
            ? 'shadow-[0_0_28px_rgba(214,51,76,0.45)]'
            : 'shadow-glow-gold'
        )}
        style={{ width: cfg.px, height: cfg.px }}
        role="timer"
        aria-live="polite"
        aria-label={`${clampedRemaining} seconds remaining`}
      >
        <svg
          width={cfg.px}
          height={cfg.px}
          viewBox={`0 0 ${cfg.px} ${cfg.px}`}
          className="-rotate-90 transform"
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx={cfg.px / 2}
            cy={cfg.px / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(232, 184, 75, 0.16)"
            strokeWidth={cfg.stroke}
          />
          {/* Progress Ring */}
          <circle
            cx={cfg.px / 2}
            cy={cfg.px / 2}
            r={radius}
            fill="transparent"
            stroke={isUrgent || isExpired ? 'var(--negative)' : 'var(--gold-500)'}
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset,stroke] duration-300 ease-out"
          />
        </svg>

        {/* Center Numerals */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={cn(
              'font-score font-bold leading-none tracking-wider tabular-nums',
              cfg.text,
              isUrgent || isExpired ? 'text-negative' : 'text-gold-100'
            )}
          >
            {formattedTime}
          </span>
          <span
            className={cn(
              'mt-1 font-semibold uppercase tracking-widest',
              cfg.sub,
              isUrgent
                ? 'text-negative'
                : status === 'running'
                  ? 'text-gold-300'
                  : 'text-text-muted'
            )}
          >
            {isExpired
              ? lang === 'ar'
                ? 'انتهى الوقت'
                : 'TIME UP'
              : isUrgent
                ? lang === 'ar'
                  ? 'ثوانٍ أخيرة!'
                  : 'FINAL 5S!'
                : status === 'running'
                  ? lang === 'ar'
                    ? 'جاري العد'
                    : 'RUNNING'
                  : status === 'paused'
                    ? lang === 'ar'
                      ? 'متوقف مؤقتاً'
                      : 'PAUSED'
                    : lang === 'ar'
                      ? 'جاهز'
                      : 'READY'}
          </span>
        </div>
      </motion.div>

      {/* Optional Start / Pause / Reset Controls */}
      {showControls && (
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <button
              type="button"
              onClick={onPause}
              className="inline-flex h-9 items-center gap-1.5 rounded-button border border-border-strong bg-surface-2 px-3 text-xs font-semibold text-gold-300 hover:border-gold-500"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'إيقاف' : 'Pause'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-9 items-center gap-1.5 rounded-button bg-gold-gradient px-3 text-xs font-semibold text-bg shadow-glow-gold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{lang === 'ar' ? 'بدء' : 'Start'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-1.5 rounded-button border border-border bg-surface px-3 text-xs font-medium text-text-muted hover:border-border-strong hover:text-ivory"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'إعادة' : 'Reset'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
