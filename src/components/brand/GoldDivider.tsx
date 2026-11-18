import React from 'react';
import { cn } from '@/lib/utils';
import { CrescentStar } from './CrescentStar';
import { PlayingDice } from './GameMotifs';

export interface GoldDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  ornament?: 'dice' | 'suits' | 'crescent' | 'diamond' | 'none';
  label?: string;
  surface?: 'paper' | 'stage';
}

/**
 * ShowDivider (also exported as GoldDivider for backwards compatibility)
 * Playful game-show section separator with thick sticker center badge and optional label.
 */
export function GoldDivider({
  ornament = 'dice',
  label,
  surface = 'paper',
  className,
  ...props
}: GoldDividerProps) {
  const isStage = surface === 'stage';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center py-4 select-none',
        className
      )}
      role="separator"
      {...props}
    >
      <div
        className={cn(
          'min-w-[12px] flex-1 h-[3px] rounded-pill',
          isStage
            ? 'bg-gradient-to-r from-transparent via-gold-300/80 to-gold-400'
            : 'show-hairline'
        )}
      />

      {ornament !== 'none' && (
        <div className="mx-2.5 sm:mx-4 flex max-w-[85vw] sm:max-w-none items-center gap-2">
          {label ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-pill border-2 border-outline px-3.5 sm:px-4 py-1 text-center text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal shadow-sticker-sm',
                isStage
                  ? 'bg-gold-gradient text-red-900'
                  : 'bg-white text-red-900'
              )}
            >
              <span className="text-red-600" aria-hidden="true">♦</span>
              <span className="break-words">{label}</span>
              <span className="text-red-600" aria-hidden="true">♠</span>
            </span>
          ) : ornament === 'dice' ? (
            <div className="flex items-center gap-2">
              <PlayingDice value={5} size="sm" tilt={-10} />
              <PlayingDice value={6} size="sm" tilt={8} accent="gold" />
            </div>
          ) : ornament === 'crescent' ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-white px-3 py-1 shadow-sticker-sm">
              <CrescentStar size="sm" />
            </span>
          ) : ornament === 'suits' ? (
            <span className="inline-flex items-center gap-2 rounded-pill border-2 border-outline bg-white px-3.5 py-1 text-sm font-bold text-red-900 shadow-sticker-sm">
              <span className="text-red-600">♥</span>
              <span>♠</span>
              <CrescentStar size="sm" />
              <span className="text-red-600">♦</span>
              <span>♣</span>
            </span>
          ) : (
            <span className="inline-block h-3.5 w-3.5 rotate-45 border-2 border-outline bg-gold-400 shadow-sticker-sm" />
          )}
        </div>
      )}

      <div
        className={cn(
          'min-w-[12px] flex-1 h-[3px] rounded-pill',
          isStage
            ? 'bg-gradient-to-l from-transparent via-gold-300/80 to-gold-400'
            : 'show-hairline'
        )}
      />
    </div>
  );
}

export const ShowDivider = GoldDivider;
