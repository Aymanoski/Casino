import React from 'react';
import { cn } from '@/lib/utils';
import { CrescentStar } from './CrescentStar';

export interface GoldDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  ornament?: 'crescent' | 'suits' | 'diamond' | 'none';
  label?: string;
}

export function GoldDivider({
  ornament = 'crescent',
  label,
  className,
  ...props
}: GoldDividerProps) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center py-4 select-none',
        className
      )}
      role="separator"
      {...props}
    >
      <div className="gold-hairline min-w-[12px] flex-1" />
      {ornament !== 'none' && (
        <div className="mx-2 sm:mx-3.5 flex max-w-[82vw] sm:max-w-none items-center gap-1.5 sm:gap-2 text-gold-500">
          <span className="text-[11px] opacity-60 shrink-0">♦</span>
          {label ? (
            <span className="rounded-pill border border-border-strong bg-surface px-2.5 sm:px-3 py-0.5 text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-gold-300 leading-snug">
              {label}
            </span>
          ) : ornament === 'crescent' ? (
            <CrescentStar size="sm" />
          ) : ornament === 'suits' ? (
            <span className="flex items-center gap-1.5 text-xs text-gold-300">
              <span>♠</span>
              <CrescentStar size="sm" />
              <span>♣</span>
            </span>
          ) : (
            <span className="inline-block h-2 w-2 rotate-45 border border-gold-500 bg-gold-500/30" />
          )}
          <span className="text-[11px] opacity-60 shrink-0">♠</span>
        </div>
      )}
      <div className="gold-hairline min-w-[12px] flex-1" />
    </div>
  );
}
