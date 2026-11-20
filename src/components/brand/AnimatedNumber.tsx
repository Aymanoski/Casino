'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';

export interface AnimatedNumberProps {
  value: number;
  sign?: boolean;
  useArabicIndicDigits?: boolean;
  duration?: number;
  className?: string;
}

function prefersReducedMotionNow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * AnimatedNumber (Delighters hook point per AGENTS.md §12 & DESIGN.md §7)
 * Zero-dependency cubic ease-out counter using tabular numerals.
 * Skips animation on initial mount, respects `prefers-reduced-motion` and hidden tabs,
 * and avoids redundant React commits when rounded digits have not changed.
 */
export const AnimatedNumber = React.memo(function AnimatedNumber({
  value,
  sign = false,
  useArabicIndicDigits = false,
  duration = 0.45,
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const currentRef = useRef<number>(value);

  useEffect(() => {
    const startVal = currentRef.current;
    if (startVal === value) return;

    if (
      prefersReducedMotionNow() ||
      (typeof document !== 'undefined' && document.hidden) ||
      typeof window === 'undefined' ||
      duration <= 0
    ) {
      currentRef.current = value;
      setDisplayValue(value);
      return;
    }

    const durationMs = Math.max(80, duration * 1000);
    const startTime = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // Cubic ease-out curve
      const eased = 1 - Math.pow(1 - t, 3);
      const nextRaw = startVal + (value - startVal) * eased;
      const rounded = t >= 1 ? value : Math.round(nextRaw);

      currentRef.current = nextRaw;
      setDisplayValue((prev) => (prev === rounded ? prev : rounded));

      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        currentRef.current = value;
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [value, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {formatNumber(displayValue, { sign, useArabicIndicDigits })}
    </span>
  );
});
