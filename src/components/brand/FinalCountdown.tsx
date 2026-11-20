'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  reached: boolean;
}

function computeCountdownParts(targetIso: string, nowMs: number): CountdownParts {
  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, reached: false };
  }
  const diff = Math.max(0, targetMs - nowMs);
  if (diff === 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, reached: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    reached: false,
  };
}

export interface FinalCountdownProps {
  targetIso: string;
  useArabicIndicDigits?: boolean;
  /** 'compact' for Landing Hero; 'wide' for Final Showcase */
  size?: 'compact' | 'wide';
  className?: string;
}

/**
 * Isolated 1-second Final Night countdown widget.
 * Keeps its own 1s interval state so parent hero / showcase views never re-render every second.
 */
export const FinalCountdown = React.memo(function FinalCountdown({
  targetIso,
  useArabicIndicDigits = false,
  size = 'compact',
  className,
}: FinalCountdownProps) {
  const { lang } = useI18n();
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const countdown =
    nowMs === null ? null : computeCountdownParts(targetIso, nowMs);

  const cells = [
    { key: 'days', val: countdown?.days ?? null, labelEn: 'DAYS', labelAr: 'يوم' },
    { key: 'hours', val: countdown?.hours ?? null, labelEn: 'HOURS', labelAr: 'ساعة' },
    { key: 'minutes', val: countdown?.minutes ?? null, labelEn: 'MINS', labelAr: 'دقيقة' },
    { key: 'seconds', val: countdown?.seconds ?? null, labelEn: 'SECS', labelAr: 'ثانية' },
  ];

  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-2 sm:gap-3',
        size === 'compact' ? 'max-w-md' : 'max-w-lg',
        className
      )}
      role="timer"
      aria-label={
        lang === 'ar'
          ? 'العد التنازلي للنهائي الكبير'
          : 'Countdown to Grand Final'
      }
    >
      {cells.map((cell) => (
        <div
          key={cell.key}
          className={cn(
            'flex flex-col items-center justify-center rounded-card border-[2.5px] border-outline bg-white text-center shadow-sticker-sm',
            size === 'compact'
              ? 'px-2 py-2.5 sm:py-3'
              : 'px-2 py-3 sm:py-3.5'
          )}
        >
          <span
            className={cn(
              'font-score font-black leading-none text-red-600 tabular-nums',
              size === 'compact'
                ? 'text-2xl sm:text-4xl'
                : 'text-2xl sm:text-4xl lg:text-5xl'
            )}
          >
            {cell.val === null
              ? '--'
              : formatNumber(String(cell.val).padStart(2, '0'), {
                  useArabicIndicDigits,
                })}
          </span>
          <span className="mt-1 text-[11px] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
            {lang === 'ar' ? cell.labelAr : cell.labelEn}
          </span>
        </div>
      ))}
    </div>
  );
});
