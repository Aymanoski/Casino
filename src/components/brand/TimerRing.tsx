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
  /** 'standard' enforces 44px touch targets; 'scorer' enforces 56px+ scorer touch targets */
  controlSize?: 'standard' | 'scorer';
  useArabicIndicDigits?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    fluidWidth: 'w-[clamp(76px,22vw,96px)]',
    stroke: 10,
  },
  md: {
    fluidWidth: 'w-[clamp(104px,28vw,136px)]',
    stroke: 9,
  },
  lg: {
    fluidWidth: 'w-[clamp(132px,34vw,176px)]',
    stroke: 8.5,
  },
  xl: {
    fluidWidth: 'w-[clamp(156px,38vw,228px)]',
    stroke: 8,
  },
};

/**
 * TimerRing
 * Fluid, container-query scaled circular timer per DESIGN.md §6 & AGENTS.md §13.
 * Uses a normalized 160x160 viewBox + clamp() sizing so it scales cleanly from 320px phones
 * up to 4K big screens, with 44px+ (or 56px scorer) control buttons.
 */
export function TimerRing({
  durationSec,
  remainingSec,
  status = 'idle',
  size = 'md',
  showControls = false,
  controlSize = 'standard',
  useArabicIndicDigits = false,
  onStart,
  onPause,
  onReset,
  className,
}: TimerRingProps) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const cfg = SIZE_CONFIG[size];
  const viewSize = 160;
  const radius = (viewSize - cfg.stroke * 2) / 2;
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

  const btnMinH = controlSize === 'scorer' ? 'min-h-[56px] px-4 text-sm' : 'min-h-[44px] px-3.5 text-xs';

  return (
    <div className={cn('inline-flex max-w-full flex-col items-center gap-3', className)}>
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
          '@container relative inline-flex aspect-square max-w-full items-center justify-center rounded-pill bg-bg-raised/90',
          cfg.fluidWidth,
          isUrgent
            ? 'shadow-[0_0_28px_rgba(214,51,76,0.45)]'
            : 'shadow-glow-gold'
        )}
        role="timer"
        aria-live="polite"
        aria-label={`${clampedRemaining} seconds remaining`}
      >
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          className="h-full w-full -rotate-90 transform"
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(232, 184, 75, 0.16)"
            strokeWidth={cfg.stroke}
          />
          {/* Progress Ring */}
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2}
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

        {/* Center Numerals scaled by container width */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span
            className={cn(
              'font-score text-[clamp(1.25rem,26cqi,3.5rem)] font-bold leading-none tracking-wider tabular-nums',
              isUrgent || isExpired ? 'text-negative' : 'text-gold-100'
            )}
          >
            {formattedTime}
          </span>
          <span
            className={cn(
              'mt-1 font-semibold uppercase tracking-widest text-[clamp(0.55rem,7.2cqi,0.8rem)] leading-tight',
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

      {/* Optional Start / Pause / Reset Controls (44px+ minimum touch target) */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {status === 'running' ? (
            <button
              type="button"
              onClick={onPause}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-button border border-border-strong bg-surface-2 font-semibold text-gold-300 hover:border-gold-500',
                btnMinH
              )}
            >
              <Pause className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'ar' ? 'إيقاف' : 'Pause'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-button bg-gold-gradient font-semibold text-bg shadow-glow-gold',
                btnMinH
              )}
            >
              <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
              <span>{lang === 'ar' ? 'بدء' : 'Start'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-button border border-border bg-surface font-medium text-text-muted hover:border-border-strong hover:text-ivory',
              btnMinH
            )}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>{lang === 'ar' ? 'إعادة' : 'Reset'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
