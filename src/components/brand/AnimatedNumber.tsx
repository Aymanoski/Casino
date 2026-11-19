'use client';

import React, { useEffect, useState } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';
import { cn, formatNumber } from '@/lib/utils';

export interface AnimatedNumberProps {
  value: number;
  sign?: boolean;
  useArabicIndicDigits?: boolean;
  duration?: number;
  className?: string;
}

/**
 * AnimatedNumber (Delighters hook point per AGENTS.md §12 & DESIGN.md §7)
 * Smoothly counts up/down using Framer Motion and tabular numerals.
 * Respects `prefers-reduced-motion` by jumping immediately when enabled.
 */
export function AnimatedNumber({
  value,
  sign = false,
  useArabicIndicDigits = false,
  duration = 0.45,
  className,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionVal = useMotionValue(value);
  const [displayValue, setDisplayValue] = useState<number>(value);

  useEffect(() => {
    if (
      prefersReducedMotion ||
      (typeof document !== 'undefined' && document.hidden)
    ) {
      motionVal.set(value);
      setDisplayValue(value);
      return;
    }

    const controls = animate(motionVal, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      },
    });

    return () => controls.stop();
  }, [value, duration, prefersReducedMotion, motionVal]);

  return (
    <span className={cn('tabular-nums', className)}>
      {formatNumber(displayValue, { sign, useArabicIndicDigits })}
    </span>
  );
}
