'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, Minus, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { ScoreChip, type ScoreChipTone } from './ScoreChip';
import { AnimatedNumber } from './AnimatedNumber';
import { Badge } from '@/components/ui/badge';

export interface ScoreboardRowProps {
  rank: number;
  name: string;
  nickname?: string;
  avatarSeed?: string;
  score: number;
  recentDelta?: number | null;
  gamesPlayed?: number;
  wins?: number;
  statusLabel?: string;
  isHighlighted?: boolean;
  isHost?: boolean;
  useArabicIndicDigits?: boolean;
  /** 'sticker' (for Stage) or 'calm' (for Paper tables) */
  appearance?: 'sticker' | 'calm';
  className?: string;
}

/**
 * ScoreboardRow
 * Container-query responsive scoreboard row per DESIGN.md §6 & §7:
 * Rank casino chip, avatar, name, animated score counter, and floating delta
 * (+10 in green with Plus icon, −5 in maroon with Minus icon).
 */
export function ScoreboardRow({
  rank,
  name,
  nickname,
  avatarSeed,
  score,
  recentDelta = null,
  gamesPlayed,
  wins,
  statusLabel,
  isHighlighted = false,
  isHost = false,
  useArabicIndicDigits = false,
  appearance = 'sticker',
  className,
}: ScoreboardRowProps) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const prevScoreRef = useRef<number>(score);
  const [deltaEvent, setDeltaEvent] = useState<{
    id: number;
    delta: number;
  } | null>(
    typeof recentDelta === 'number' && recentDelta !== 0
      ? { id: 1, delta: recentDelta }
      : null
  );

  useEffect(() => {
    if (score !== prevScoreRef.current) {
      const diff = score - prevScoreRef.current;
      prevScoreRef.current = score;
      setDeltaEvent({ id: Date.now(), delta: diff });
      const timer = setTimeout(() => setDeltaEvent(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [score]);

  useEffect(() => {
    if (typeof recentDelta === 'number' && recentDelta !== 0) {
      setDeltaEvent({ id: Date.now(), delta: recentDelta });
      const timer = setTimeout(() => setDeltaEvent(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [recentDelta]);

  const chipTone: ScoreChipTone =
    rank === 1 ? 'gold' : rank === 2 ? 'red' : rank === 3 ? 'blue' : 'white';

  return (
    <motion.div
      layout={!prefersReducedMotion}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        '@container group relative flex flex-wrap @sm:flex-nowrap items-center justify-between gap-2.5 @sm:gap-4 rounded-card px-3.5 py-3 @sm:px-5 @sm:py-4 transition-[box-shadow,border-color,background-color] duration-200',
        appearance === 'sticker'
          ? 'border-[2.5px] border-outline shadow-sticker'
          : 'border border-border-paper shadow-soft',
        isHighlighted || rank === 1
          ? 'bg-white ltr:bg-gradient-to-r rtl:bg-gradient-to-l from-gold-200/45 via-paper to-white text-ink'
          : 'bg-white text-ink hover:bg-paper',
        className
      )}
    >
      {/* Start: Rank Casino Chip + Avatar + Identity */}
      <div className="flex min-w-0 flex-1 basis-[190px] items-center gap-2.5 @sm:gap-4">
        <ScoreChip
          value={`#${formatNumber(rank, { useArabicIndicDigits })}`}
          tone={chipTone}
          size="sm"
          className="shrink-0"
        />

        <PlayerAvatar
          name={name}
          avatarSeed={avatarSeed}
          size="sm"
          isHost={isHost}
          className="hidden @2xs:inline-flex"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {isHost && (
              <Crown className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            )}
            <span
              className={cn(
                'truncate font-display text-base @sm:text-xl',
                rank === 1 || isHost ? 'text-red-900' : 'text-ink'
              )}
            >
              {name}
            </span>
            {nickname && (
              <span className="truncate text-xs text-ink-muted">
                “{nickname}”
              </span>
            )}
            {statusLabel && (
              <Badge
                variant={rank <= 2 ? 'gold' : 'muted'}
                className="hidden @md:inline-flex px-2.5 py-0.5 text-[11px]"
              >
                {statusLabel}
              </Badge>
            )}
          </div>

          {(typeof gamesPlayed === 'number' || typeof wins === 'number') && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
              {typeof gamesPlayed === 'number' && (
                <span>
                  {lang === 'ar' ? 'المباريات: ' : 'Games: '}
                  <strong className="text-ink tabular-nums">
                    {formatNumber(gamesPlayed, { useArabicIndicDigits })}
                  </strong>
                </span>
              )}
              {typeof wins === 'number' && (
                <span>
                  {lang === 'ar' ? 'الفوز: ' : 'Wins: '}
                  <strong className="text-red-700 tabular-nums">
                    {formatNumber(wins, { useArabicIndicDigits })}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* End: Delta Flash (+ / - with explicit icon) + Animated Score Counter */}
      <div className="ms-auto flex shrink-0 items-center gap-2 @sm:gap-3">
        <AnimatePresence mode="popLayout">
          {deltaEvent && (
            <motion.span
              key={deltaEvent.id}
              initial={
                prefersReducedMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: deltaEvent.delta > 0 ? 10 : -10 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 1, y: deltaEvent.delta > 0 ? -3 : 3 }
              }
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={cn(
                'inline-flex items-center gap-1 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-sm @sm:text-base font-black tabular-nums shadow-sticker-sm',
                deltaEvent.delta > 0
                  ? 'bg-positive-soft text-positive-ink'
                  : 'bg-negative text-white'
              )}
            >
              {deltaEvent.delta > 0 ? (
                <Plus className="h-3.5 w-3.5 stroke-[3] shrink-0" aria-hidden="true" />
              ) : (
                <Minus className="h-3.5 w-3.5 stroke-[3] shrink-0" aria-hidden="true" />
              )}
              <span>
                {formatNumber(Math.abs(deltaEvent.delta), {
                  useArabicIndicDigits,
                })}
              </span>
            </motion.span>
          )}
        </AnimatePresence>

        <div className="flex items-baseline justify-end text-end">
          <AnimatedNumber
            value={score}
            useArabicIndicDigits={useArabicIndicDigits}
            className={cn(
              'font-score text-[clamp(1.65rem,7cqi,2.5rem)] font-black leading-none tracking-normal',
              rank === 1 ? 'text-red-600' : 'text-red-900'
            )}
          />
          <span className="ms-1 text-[11px] font-bold uppercase ltr:tracking-wider rtl:tracking-normal text-ink-muted">
            {lang === 'ar' ? 'نقطة' : 'PTS'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
