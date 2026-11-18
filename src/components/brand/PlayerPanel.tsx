'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, Minus, Plus, Trophy, Zap } from 'lucide-react';
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
  /** Surface mode: 'light' = white sticker card (for Stage & Paper); 'dark' = deep maroon Stage-Dark (for Scorer console) */
  surface?: 'light' | 'dark';
  onSelect?: () => void;
  onBuzz?: () => void;
  presetPoints?: number[];
  onApplyPreset?: (points: number) => void;
  className?: string;
}

/**
 * PlayerPanel (Delighters hook point per AGENTS.md §12 & DESIGN.md §6)
 * - Generated avatar in thick outlined ring, name, muted nickname, big tabular score
 * - BUZZED state = pulsing gold glow ring + gold sticker badge
 * - SELECTED state = electric blue ring (with crisp white inner buffer on dark maroon)
 * - Scorer actions >= 56px tall; plus/minus always paired with +/- sign and icon
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
  surface,
  onSelect,
  onBuzz,
  presetPoints,
  onApplyPreset,
  className,
}: PlayerPanelProps) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const resolvedSurface =
    surface ?? (variant === 'scorer' ? 'dark' : 'light');
  const isDark = resolvedSurface === 'dark';

  const prevScoreRef = useRef<number>(score);
  const [flashDelta, setFlashDelta] = useState<{
    id: number;
    delta: number;
  } | null>(null);

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

  const buzzedLabel = lang === 'ar' ? 'ضغط الجرس أولاً!' : 'BUZZED FIRST!';
  const isLargeScreen = variant === 'bigScreen' || variant === 'finalBoss';
  const isGoldenSeat = isHost || variant === 'finalBoss';

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
        '@container relative flex min-w-0 flex-col justify-between overflow-hidden rounded-card p-4 @xs:p-5 @md:p-6 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        isDark
          ? cn(
              'bg-red-800 text-white border-[2.5px] shadow-sticker',
              isSelected
                ? 'border-white ring-[3px] ring-blue-500'
                : isBuzzed
                  ? 'border-gold-300 ring-[3px] ring-gold-400 shadow-glow-gold'
                  : isGoldenSeat
                    ? 'border-gold-400 bg-gradient-to-b from-red-800 via-red-800 to-red-900 shadow-glow-gold'
                    : 'border-red-900'
            )
          : cn(
              'bg-white text-ink border-[2.5px] shadow-sticker',
              isSelected
                ? 'border-blue-500 ring-[3px] ring-blue-500'
                : isBuzzed
                  ? 'border-outline ring-[3px] ring-gold-400 shadow-glow-gold bg-gradient-to-b from-gold-200/35 via-white to-white'
                  : isGoldenSeat
                    ? 'border-outline bg-gradient-to-b from-gold-200/45 via-paper to-white shadow-sticker-lg'
                    : 'border-outline'
            ),
        onSelect && 'cursor-pointer',
        className
      )}
    >
      {/* Pulsing Gold Ring Overlay when Buzzed */}
      {isBuzzed && !prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-card border-[3px] border-gold-300"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      {/* Boss Marquee Lights for Marwan Serry's Golden Seat */}
      {isGoldenSeat && (
        <div className="relative z-10 mb-3">
          <MarqueeBulbs variant="strip" bulbCount={10} />
        </div>
      )}

      {/* Top Row: Rank Pill + Winner / Buzzed / Selected Pill */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        {rankLabel ? (
          <Badge
            variant={rank === 1 || isGoldenSeat ? 'gold' : isDark ? 'neutral' : 'muted'}
            className="max-w-full truncate"
          >
            {isGoldenSeat ? (
              <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : rank === 1 ? (
              <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span>{rankLabel}</span>
          </Badge>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {isSelected && (
            <Badge variant="info" className="font-bold">
              {lang === 'ar' ? 'مختار' : 'SELECTED'}
            </Badge>
          )}
          {isWinner && (
            <Badge variant="positive" className="font-bold">
              <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'الفائز' : 'WINNER'}</span>
            </Badge>
          )}
          {isBuzzed && (
            <Badge variant="gold" className="font-extrabold shadow-glow-gold">
              <Zap className="h-3.5 w-3.5 fill-current shrink-0" aria-hidden="true" />
              <span>{buzzedLabel}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Middle Row: Avatar + Name + Nickname */}
      <div className="relative z-10 my-4 @sm:my-5 flex items-center gap-3 @sm:gap-4">
        <PlayerAvatar
          name={name}
          avatarSeed={avatarSeed}
          size={isLargeScreen ? 'xl' : 'lg'}
          isHost={isHost}
          buzzed={isBuzzed}
          selected={isSelected}
          rank={rank}
          className={cn(
            !isLargeScreen && 'h-12 w-12 @xs:h-14 @xs:w-14 @md:h-16 @md:w-16'
          )}
        />

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'truncate font-display ltr:tracking-tight rtl:tracking-normal',
              isLargeScreen
                ? 'text-[clamp(1.35rem,6cqi,2.25rem)]'
                : 'text-[clamp(1.15rem,5.5cqi,1.65rem)]',
              isDark
                ? isGoldenSeat
                  ? 'text-gold-200'
                  : 'text-white'
                : isGoldenSeat
                  ? 'text-red-900'
                  : 'text-ink'
            )}
          >
            {name}
          </h3>
          {nickname && (
            <p
              className={cn(
                'truncate text-xs @sm:text-sm font-medium',
                isDark ? 'text-red-100' : 'text-ink-muted'
              )}
            >
              “{nickname}”
            </p>
          )}
        </div>
      </div>

      {/* Score Section with Animated Counter & Floating Delta Flash */}
      <div
        className={cn(
          'relative z-10 flex flex-wrap items-baseline justify-between gap-2 border-t-2 pt-3.5 @sm:pt-4',
          isDark ? 'border-white/15' : 'border-border-paper'
        )}
      >
        <span
          className={cn(
            'text-[11px] @sm:text-xs font-bold uppercase ltr:tracking-wider rtl:tracking-normal',
            isDark ? 'text-white/90' : 'text-ink-muted'
          )}
        >
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
                    : { opacity: 1, y: flashDelta.delta > 0 ? -8 : 6, scale: 1 }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-lg @sm:text-xl font-black tabular-nums shadow-sticker-sm',
                  flashDelta.delta > 0
                    ? 'bg-positive-soft text-positive-ink'
                    : 'bg-negative text-white'
                )}
              >
                {flashDelta.delta > 0 ? (
                  <Plus className="h-3.5 w-3.5 stroke-[3] shrink-0" aria-hidden="true" />
                ) : (
                  <Minus className="h-3.5 w-3.5 stroke-[3] shrink-0" aria-hidden="true" />
                )}
                <span>
                  {formatNumber(Math.abs(flashDelta.delta), {
                    useArabicIndicDigits,
                  })}
                </span>
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatedNumber
            value={score}
            useArabicIndicDigits={useArabicIndicDigits}
            className={cn(
              'font-score font-black leading-none tracking-normal',
              isLargeScreen
                ? 'text-[clamp(2.5rem,13cqi,5rem)]'
                : 'text-[clamp(2.25rem,11cqi,3.5rem)]',
              isDark
                ? 'text-gold-300'
                : isGoldenSeat
                  ? 'text-gold-sticker'
                  : 'text-red-900'
            )}
          />
        </div>
      </div>

      {/* Scorer Console Action Targets: minimum 56px tall touch targets */}
      {(onBuzz || (presetPoints && onApplyPreset)) && (
        <div
          className={cn(
            'relative z-10 mt-4 space-y-2.5 border-t-2 pt-4',
            isDark ? 'border-white/15' : 'border-border-paper'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {onBuzz && (
            <button
              type="button"
              onClick={onBuzz}
              className={cn(
                'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-button border-[2.5px] border-outline px-4 py-3 text-base font-extrabold shadow-sticker sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                isBuzzed
                  ? 'bg-gold-gradient text-red-900 shadow-glow-gold'
                  : 'bg-white text-red-900 hover:bg-paper'
              )}
            >
              <Zap
                className={cn(
                  'h-5 w-5 shrink-0',
                  isBuzzed ? 'fill-red-900 text-red-900' : 'text-red-600'
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
              {presetPoints.map((pts) => {
                const isPos = pts > 0;
                return (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => onApplyPreset(pts)}
                    className={cn(
                      'flex min-h-[56px] items-center justify-center gap-1 rounded-button border-[2.5px] border-outline font-score text-xl font-black tabular-nums shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                      isPos
                        ? 'bg-positive-soft text-positive-ink hover:bg-positive hover:text-ink'
                        : 'bg-negative text-white hover:bg-red-900'
                    )}
                  >
                    {isPos ? (
                      <Plus className="h-4 w-4 stroke-[3] shrink-0" aria-hidden="true" />
                    ) : (
                      <Minus className="h-4 w-4 stroke-[3] shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {formatNumber(Math.abs(pts), { useArabicIndicDigits })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
