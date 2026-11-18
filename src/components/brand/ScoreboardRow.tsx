'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { ScoreChip } from './ScoreChip';
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
  className?: string;
}

/**
 * ScoreboardRow
 * Container-query responsive scoreboard row per DESIGN.md §6 & §7 and AGENTS.md §13.
 * Gracefully adapts between ultra-narrow mobile containers (320px) and wide displays (2560px)
 * without crushing player names or wrapping scores awkwardly.
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
    }
  }, [recentDelta]);

  const isTopThree = rank <= 3;

  return (
    <motion.div
      layout={!prefersReducedMotion}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        '@container group relative flex flex-wrap @sm:flex-nowrap items-center justify-between gap-2.5 @sm:gap-4 rounded-card border px-3.5 py-3 @sm:px-5 @sm:py-4 transition-all duration-200',
        isHighlighted || rank === 1
          ? 'border-border-strong bg-gradient-to-r from-gold-500/15 via-surface to-surface shadow-glow-gold'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2/80',
        className
      )}
    >
      {/* Start: Rank Chip + Avatar + Player Identity */}
      <div className="flex min-w-0 flex-1 basis-[190px] items-center gap-2.5 @sm:gap-4">
        <ScoreChip
          value={`#${formatNumber(rank, { useArabicIndicDigits })}`}
          tone="neutral"
          size="sm"
          className={cn(
            'shrink-0',
            rank === 1 && 'border-gold-300 shadow-glow-gold',
            !isTopThree && 'opacity-80'
          )}
        />

        <PlayerAvatar
          name={name}
          avatarSeed={avatarSeed}
          size="sm"
          isHost={isHost}
          className="hidden @2xs:inline-flex"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={cn(
                'truncate font-display text-base @sm:text-xl font-bold',
                rank === 1 || isHost ? 'text-gold-gradient' : 'text-ivory'
              )}
            >
              {name}
            </span>
            {nickname && (
              <span className="truncate text-xs text-text-muted">
                “{nickname}”
              </span>
            )}
            {statusLabel && (
              <Badge
                variant={rank <= 2 ? 'gold' : 'muted'}
                className="hidden @md:inline-flex px-2 py-0.5 text-[10px]"
              >
                {statusLabel}
              </Badge>
            )}
          </div>

          {(typeof gamesPlayed === 'number' || typeof wins === 'number') && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
              {typeof gamesPlayed === 'number' && (
                <span>
                  {lang === 'ar' ? 'المباريات: ' : 'Games: '}
                  <strong className="text-ivory tabular-nums">
                    {formatNumber(gamesPlayed, { useArabicIndicDigits })}
                  </strong>
                </span>
              )}
              {typeof wins === 'number' && (
                <span>
                  {lang === 'ar' ? 'الفوز: ' : 'Wins: '}
                  <strong className="text-gold-300 tabular-nums">
                    {formatNumber(wins, { useArabicIndicDigits })}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* End: Delta Flash + Animated Score Counter */}
      <div className="ms-auto flex shrink-0 items-center gap-2 @sm:gap-3">
        <AnimatePresence mode="popLayout">
          {deltaEvent && (
            <motion.span
              key={deltaEvent.id}
              initial={
                prefersReducedMotion
                  ? { opacity: 1, y: 0 }
                  : {
                      opacity: 0,
                      y: deltaEvent.delta > 0 ? 12 : -12,
                    }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1, y: 0 }
                  : {
                      opacity: 1,
                      y: deltaEvent.delta > 0 ? -3 : 3,
                    }
              }
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={cn(
                'inline-flex items-center rounded-pill border px-2 @sm:px-2.5 py-0.5 font-score text-sm @sm:text-lg font-bold tracking-wider tabular-nums',
                deltaEvent.delta > 0
                  ? 'border-positive/50 bg-positive/15 text-positive shadow-[0_0_12px_rgba(47,191,143,0.25)]'
                  : 'border-negative/50 bg-negative/15 text-negative shadow-[0_0_12px_rgba(214,51,76,0.25)]'
              )}
            >
              {formatNumber(deltaEvent.delta, {
                sign: true,
                useArabicIndicDigits,
              })}
            </motion.span>
          )}
        </AnimatePresence>

        <div className="flex items-baseline justify-end text-end">
          <AnimatedNumber
            value={score}
            useArabicIndicDigits={useArabicIndicDigits}
            className={cn(
              'font-score text-[clamp(1.65rem,7cqi,2.5rem)] font-bold leading-none tracking-wider',
              rank === 1 ? 'text-gold-gradient' : 'text-ivory'
            )}
          />
          <span className="ms-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {lang === 'ar' ? 'نقطة' : 'PTS'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
