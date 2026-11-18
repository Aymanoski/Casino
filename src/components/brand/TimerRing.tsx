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
  /** 'stage' = gold ring on deep maroon dial; 'paper' = red ring on crisp white dial */
  surface?: 'stage' | 'paper';
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
  sm: { fluidWidth: 'w-[clamp(96px,26vw,112px)]', stroke: 11 },
  md: { fluidWidth: 'w-[clamp(112px,28vw,140px)]', stroke: 10 },
  lg: { fluidWidth: 'w-[clamp(136px,34vw,180px)]', stroke: 9.5 },
  xl: { fluidWidth: 'w-[clamp(160px,38vw,228px)]', stroke: 9 },
};

/**
 * TimerRing
 * Per DESIGN.md §6:
 * - Large tabular numeric with circular progress ring: gold on Stage, red on Paper.
 * - Last 5 seconds: pulse + crisp white flash border.
 * - Minimum 44px standard / 56px scorer touch controls.
 */
export function TimerRing({
  durationSec,
  remainingSec,
  status = 'idle',
  size = 'md',
  surface = 'stage',
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
  const isStage = surface === 'stage';

  const mins = Math.floor(clampedRemaining / 60);
  const secs = clampedRemaining % 60;
  const formattedTime =
    mins > 0
      ? `${formatNumber(mins, { useArabicIndicDigits })}:${formatNumber(
          secs.toString().padStart(2, '0'),
          { useArabicIndicDigits }
        )}`
      : `${formatNumber(secs, { useArabicIndicDigits })}s`;

  const btnMinH =
    controlSize === 'scorer'
      ? 'min-h-[56px] px-5 text-sm'
      : 'min-h-[44px] px-3.5 text-xs';

  const ringStroke =
    isUrgent || isExpired
      ? isStage
        ? 'var(--gold-200)'
        : 'var(--negative)'
      : isStage
        ? 'var(--gold-400)'
        : 'var(--red-600)';

  const trackStroke = isStage
    ? 'rgba(255, 255, 255, 0.22)'
    : 'rgba(79, 7, 22, 0.14)';

  return (
    <div className={cn('inline-flex max-w-full flex-col items-center gap-3', className)}>
      <motion.div
        animate={
          isUrgent && !prefersReducedMotion
            ? {
                scale: [1, 1.06, 1],
                boxShadow: [
                  '0 0 0 3px #FFFFFF, 0 0 0 6px #4F0716',
                  '0 0 0 6px #FFFFFF, 0 0 24px rgba(255, 255, 255, 0.9)',
                  '0 0 0 3px #FFFFFF, 0 0 0 6px #4F0716',
                ],
              }
            : { scale: 1 }
        }
        transition={
          isUrgent && !prefersReducedMotion
            ? { duration: 0.65, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
        className={cn(
          '@container relative inline-flex aspect-square max-w-full items-center justify-center rounded-pill border-[3px]',
          cfg.fluidWidth,
          isStage
            ? 'bg-red-900 text-white'
            : 'bg-white text-ink',
          isUrgent
            ? 'border-white ring-4 ring-white/85'
            : 'border-outline shadow-sticker'
        )}
        role="timer"
        aria-live="polite"
        aria-label={
          lang === 'ar'
            ? `متبقي ${clampedRemaining} ثانية`
            : `${clampedRemaining} seconds remaining`
        }
      >
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          className="h-full w-full -rotate-90 transform p-1"
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2}
            r={radius}
            fill="transparent"
            stroke={trackStroke}
            strokeWidth={cfg.stroke}
          />
          {/* Progress Ring */}
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2}
            r={radius}
            fill="transparent"
            stroke={ringStroke}
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset,stroke] duration-300 ease-out"
          />
        </svg>

        {/* Center Numerals */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span
            className={cn(
              'font-score text-[clamp(1.25rem,26cqi,3.5rem)] font-black leading-none tracking-normal tabular-nums',
              isStage
                ? isUrgent || isExpired
                  ? 'text-white'
                  : 'text-gold-200'
                : isUrgent || isExpired
                  ? 'text-negative'
                  : 'text-red-900'
            )}
          >
            {formattedTime}
          </span>
          <span
            className={cn(
              'mt-1 font-bold uppercase ltr:tracking-wider rtl:tracking-normal text-[clamp(0.6875rem,7.2cqi,0.875rem)] leading-tight',
              isStage
                ? isUrgent || isExpired
                  ? 'text-gold-200'
                  : 'text-white/90'
                : isUrgent || isExpired
                  ? 'text-negative'
                  : 'text-ink-muted'
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

      {/* Start / Pause / Reset Controls */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {status === 'running' ? (
            <button
              type="button"
              onClick={onPause}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-button border-[2.5px] border-outline bg-white font-bold text-red-900 shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
                'inline-flex items-center gap-1.5 rounded-button border-[2.5px] border-outline font-bold shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                isStage
                  ? 'bg-gold-gradient text-red-900'
                  : 'bg-red-600 text-white',
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
              'inline-flex items-center gap-1.5 rounded-button border-[2.5px] border-outline bg-paper font-bold text-ink shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
