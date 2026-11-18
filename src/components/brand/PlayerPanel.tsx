'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PlayerAvatar } from './PlayerAvatar';
import { AnimatedNumber } from './AnimatedNumber';
import { MarqueeBulbs } from './MarqueeBulbs';

export interface PlayerPanelProps {
  playerId?: string;
  name: string;
  nickname?: string;
  avatarSeed?: string;
  score: number;
  rank?: number;
  isBuzzed?: boolean;
  isSelected?: boolean;
  isWinner?: boolean;
  isHost?: boolean;
  recentDelta?: number | null;
  useArabicIndicDigits?: boolean;
  variant?: 'default' | 'scorer' | 'bigScreen' | 'finalBoss';
  onSelect?: () => void;
  onBuzz?: () => void;
  presetPoints?: number[];
  onApplyPreset?: (points: number) => void;
  className?: string;
}

/**
 * PlayerPanel (Delighters hook point per AGENTS.md §12 & DESIGN.md §6)
 * Container-query responsive panel displaying avatar in gold ring, name, nickname,
 * fluid tabular score, rank pill, "BUZZED" glow state, and 56px+ scorer actions.
 */
export function PlayerPanel({
  name,
  nickname,
  avatarSeed,
  score,
  rank,
  isBuzzed = false,
  isSelected = false,
  isWinner = false,
  isHost = false,
  recentDelta = null,
  useArabicIndicDigits = false,
  variant = 'default',
  onSelect,
  onBuzz,
  presetPoints,
  onApplyPreset,
  className,
}: PlayerPanelProps) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const prevScoreRef = useRef<number>(score);
  const [flashDelta, setFlashDelta] = useState<{ id: number; delta: number } | null>(
    null
  );

  useEffect(() => {
    if (score !== prevScoreRef.current) {
      const diff = score - prevScoreRef.current;
      prevScoreRef.current = score;
      setFlashDelta({ id: Date.now(), delta: diff });
      const timer = setTimeout(() => setFlashDelta(null), 1600);
      return () => clearTimeout(timer);
    }
  }, [score]);

  useEffect(() => {
    if (typeof recentDelta === 'number' && recentDelta !== 0) {
      setFlashDelta({ id: Date.now(), delta: recentDelta });
      const timer = setTimeout(() => setFlashDelta(null), 1600);
      return () => clearTimeout(timer);
    }
  }, [recentDelta]);

  const rankLabel = isHost
    ? lang === 'ar'
      ? 'المقعد الذهبي · المضيف'
      : 'THE GOLDEN SEAT · HOST'
    : typeof rank === 'number'
      ? lang === 'ar'
        ? `المركز #${formatNumber(rank, { useArabicIndicDigits })}`
        : `RANK #${rank}`
      : null;

  const buzzedLabel =
    lang === 'ar' ? 'ضغط الجرس أولاً!' : 'BUZZED FIRST!';

  const isLargeScreen = variant === 'bigScreen' || variant === 'finalBoss';

  return (
    <motion.div
      layout={!prefersReducedMotion}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        '@container relative flex min-w-0 flex-col justify-between overflow-hidden rounded-card border p-4 @xs:p-5 @md:p-6 transition-all duration-300 shadow-card-inner',
        isHost || variant === 'finalBoss'
          ? 'border-gold-300 bg-gradient-to-b from-[#241B0B] via-surface to-bg shadow-glow-gold-lg'
          : isBuzzed
            ? 'border-gold-300 bg-gradient-to-b from-gold-500/20 via-surface to-surface shadow-glow-gold-lg ring-2 ring-gold-500/70'
            : isSelected
              ? 'border-gold-500 bg-surface-2 shadow-glow-gold'
              : 'border-border bg-surface hover:border-border-strong',
        onSelect && 'cursor-pointer',
        className
      )}
    >
      {/* Pulsing Gold Ring Overlay when Buzzed */}
      {isBuzzed && !prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-card border-2 border-gold-300"
          animate={{ opacity: [0.35, 0.95, 0.35] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      {/* Boss Marquee Lights for Marwan Serry's Golden Seat */}
      {(isHost || variant === 'finalBoss') && (
        <div className="relative z-10 mb-3">
          <MarqueeBulbs variant="strip" bulbCount={10} />
        </div>
      )}

      {/* Top Row: Rank Pill + Buzz Status / Winner Pill */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        {rankLabel ? (
          <Badge
            variant={rank === 1 || isHost ? 'gold' : 'muted'}
            className={cn(
              'max-w-full truncate',
              (rank === 1 || isHost) &&
                'border-gold-300/70 bg-gold-500/20 text-gold-100 font-semibold'
            )}
          >
            {isHost ? '♛ ' : rank === 1 ? '★ ' : ''}
            {rankLabel}
          </Badge>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {isWinner && (
            <Badge variant="positive" className="font-bold">
              {lang === 'ar' ? 'الفائز ★' : 'WINNER ★'}
            </Badge>
          )}
          {isBuzzed && (
            <Badge
              variant="gold"
              className="border-gold-100 bg-gold-gradient text-bg font-bold shadow-glow-gold"
            >
              <Zap className="h-3.5 w-3.5 fill-current shrink-0" />
              <span>{buzzedLabel}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Middle Row: Avatar + Name + Nickname (adapts smoothly to container width) */}
      <div className="relative z-10 my-4 @sm:my-5 flex items-center gap-3 @sm:gap-4">
        <PlayerAvatar
          name={name}
          avatarSeed={avatarSeed}
          size={isLargeScreen ? 'xl' : 'lg'}
          isHost={isHost}
          buzzed={isBuzzed}
          rank={rank}
          className={cn(
            !isLargeScreen && 'h-12 w-12 @xs:h-14 @xs:w-14 @md:h-16 @md:w-16'
          )}
        />

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'truncate font-display font-bold ltr:tracking-tight rtl:tracking-normal',
              isLargeScreen
                ? 'text-[clamp(1.35rem,6cqi,2.25rem)]'
                : 'text-[clamp(1.15rem,5.5cqi,1.65rem)]',
              isHost ? 'text-gold-gradient' : 'text-ivory'
            )}
          >
            {name}
          </h3>
          {nickname && (
            <p className="truncate text-xs @sm:text-sm font-medium text-text-muted">
              “{nickname}”
            </p>
          )}
        </div>
      </div>

      {/* Score Section with Animated Counter & Floating Delta Flash */}
      <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-2 border-t border-border/80 pt-3.5 @sm:pt-4">
        <span className="text-[11px] @sm:text-xs font-semibold uppercase tracking-widest text-text-muted">
          {lang === 'ar' ? 'إجمالي النقاط' : 'TOTAL POINTS'}
        </span>

        <div className="relative ms-auto flex items-baseline gap-2">
          <AnimatePresence>
            {flashDelta && (
              <motion.span
                key={flashDelta.id}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: flashDelta.delta > 0 ? 10 : -10, scale: 0.9 }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 1, y: flashDelta.delta > 0 ? -10 : 8, scale: 1 }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={cn(
                  'font-score text-lg @sm:text-2xl font-bold tabular-nums px-2 py-0.5 rounded-pill border',
                  flashDelta.delta > 0
                    ? 'border-positive/50 bg-positive/15 text-positive'
                    : 'border-negative/50 bg-negative/15 text-negative'
                )}
              >
                {formatNumber(flashDelta.delta, {
                  sign: true,
                  useArabicIndicDigits,
                })}
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatedNumber
            value={score}
            useArabicIndicDigits={useArabicIndicDigits}
            className={cn(
              'font-score font-bold leading-none tracking-wider',
              isLargeScreen
                ? 'text-[clamp(2.5rem,13cqi,5rem)] text-gold-gradient'
                : 'text-[clamp(2.25rem,11cqi,3.5rem)] text-gold-100'
            )}
          />
        </div>
      </div>

      {/* Scorer Console Action Targets: minimum 56px tall touch targets */}
      {(onBuzz || (presetPoints && onApplyPreset)) && (
        <div
          className="relative z-10 mt-4 space-y-2.5 border-t border-border pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          {onBuzz && (
            <button
              type="button"
              onClick={onBuzz}
              className={cn(
                'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-button border px-4 py-3 text-base font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 active:scale-[0.99]',
                isBuzzed
                  ? 'border-gold-100 bg-gold-gradient text-bg shadow-glow-gold'
                  : 'border-border-strong bg-surface-2 text-ivory hover:border-gold-500 hover:bg-gold-500/15'
              )}
            >
              <Zap
                className={cn(
                  'h-5 w-5 shrink-0',
                  isBuzzed ? 'fill-current text-bg' : 'text-gold-500'
                )}
              />
              <span>
                {isBuzzed
                  ? lang === 'ar'
                    ? 'ضغط أولاً (نشط)'
                    : 'Buzzed First (Active)'
                  : lang === 'ar'
                    ? 'ضغط الجرس أولاً'
                    : 'Buzzed First'}
              </span>
            </button>
          )}

          {presetPoints && presetPoints.length > 0 && onApplyPreset && (
            <div className="grid grid-cols-3 gap-2">
              {presetPoints.map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => onApplyPreset(pts)}
                  className={cn(
                    'flex min-h-[56px] items-center justify-center rounded-button border font-score text-xl font-bold tabular-nums transition-all duration-150 active:scale-95',
                    pts > 0
                      ? 'border-positive/60 bg-positive/15 text-positive hover:bg-positive hover:text-bg'
                      : 'border-negative/60 bg-negative/15 text-negative hover:bg-negative hover:text-ivory'
                  )}
                >
                  {formatNumber(pts, { sign: true, useArabicIndicDigits })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
