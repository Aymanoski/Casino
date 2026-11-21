'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Crown,
  Minus,
  Plus,
  RotateCcw,
  Trophy,
  UserX,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Avatar as AvatarType } from '@/lib/schemas';
import { PlayerAvatar } from './PlayerAvatar';
import { AnimatedNumber } from './AnimatedNumber';
import { MarqueeBulbs } from './MarqueeBulbs';
import {
  CardCounterGroup,
  DisciplinaryCardIcon,
} from './DisciplinaryCards';
import { ContactIconButton } from './PlayerContactDialog';

export interface PlayerPanelProps {
  playerId?: string;
  name: string;
  nickname?: string;
  avatarSeed?: string;
  avatar?: AvatarType | null;
  score: number;
  rank?: number;
  yellowCards?: number;
  redCards?: number;
  showCardCounters?: boolean;
  isBuzzed?: boolean;
  isSelected?: boolean;
  isWinner?: boolean;
  isWalkoverWinner?: boolean;
  isAbsent?: boolean;
  isHost?: boolean;
  recentDelta?: number | null;
  useArabicIndicDigits?: boolean;
  variant?: 'default' | 'scorer' | 'bigScreen' | 'finalBoss';
  /** Surface mode: 'light' = white sticker card (for Stage & Paper); 'dark' = deep maroon Stage-Dark (for Scorer console) */
  surface?: 'light' | 'dark';
  onSelect?: () => void;
  onBuzz?: () => void;
  /** Direct Scorer v2 controls (+1, -1, Yellow card -1, Red card -2) */
  onPointPlus?: () => void;
  onPointMinus?: () => void;
  onYellowCard?: () => void;
  onRedCard?: () => void;
  /** Responsive visibility class for direct scoring buttons (e.g. 'hidden md:grid' for hybrid layout) */
  scoringControlsClassName?: string;
  /** Role-gated Contact dialog trigger beside the player */
  onContact?: () => void;
  /** Absence controls (confirmation handled by parent) */
  onMarkAbsent?: () => void;
  markAbsentLabel?: string;
  onReverseAbsence?: () => void;
  disabledActions?: boolean;
  className?: string;
}

/**
 * PlayerPanel (Delighters hook point per AGENTS.md §12 & DESIGN.md §6)
 * - Generated avatar in thick outlined ring, name, muted nickname, big tabular score
 * - Yellow & Red card-shaped SVG counters derived by kind (never emoji, never -1/-2)
 * - BUZZED state = pulsing gold glow ring + gold sticker badge
 * - SELECTED state = electric blue ring (with crisp white inner buffer on dark maroon)
 * - ABSENT state = muted striped surface with tilted ABSENT sticker
 * - WALKOVER WIN state = glossy gold WALKOVER WIN sticker
 * - Scorer controls (+1, −1, Yellow −1, Red −2, Buzz) >= 56px tall; Contact & Absent >= 44px
 */
export function PlayerPanel({
  playerId,
  name,
  nickname,
  avatarSeed,
  avatar,
  score,
  rank,
  yellowCards = 0,
  redCards = 0,
  showCardCounters = false,
  isBuzzed = false,
  isSelected = false,
  isWinner = false,
  isWalkoverWinner = false,
  isAbsent = false,
  isHost = false,
  recentDelta = null,
  useArabicIndicDigits = false,
  variant = 'default',
  surface,
  onSelect,
  onBuzz,
  onPointPlus,
  onPointMinus,
  onYellowCard,
  onRedCard,
  scoringControlsClassName,
  onContact,
  onMarkAbsent,
  markAbsentLabel,
  onReverseAbsence,
  disabledActions = false,
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
  const isScorerCard = variant === 'scorer';
  const hasDirectScoring = Boolean(
    onPointPlus || onPointMinus || onYellowCard || onRedCard
  );
  const hasChildControls = Boolean(
    onBuzz ||
      hasDirectScoring ||
      onContact ||
      onMarkAbsent ||
      onReverseAbsence
  );
  const useOuterButton = Boolean(onSelect && !hasChildControls);
  const shouldShowCards =
    showCardCounters || isScorerCard || yellowCards > 0 || redCards > 0;

  const cardBodyContent = (
    <>
      {/* Boss Marquee Lights for Marwan Serry's Golden Seat */}
      {isGoldenSeat && (
        <div className={cn('relative z-10', isScorerCard ? 'mb-2' : 'mb-3')}>
          <MarqueeBulbs variant="strip" bulbCount={10} />
        </div>
      )}

      {/* Top Row: Rank Pill + Status Stickers (Absent / Walkover / Winner / Buzzed / Selected) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 min-h-[26px]">
        {rankLabel ? (
          <Badge
            variant={
              isAbsent
                ? 'muted'
                : rank === 1 || isGoldenSeat
                  ? 'gold'
                  : isDark
                    ? 'neutral'
                    : 'muted'
            }
            className="max-w-full truncate px-2.5 py-0.5 text-[11px]"
          >
            {isGoldenSeat ? (
              <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : rank === 1 && !isAbsent ? (
              <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span>{rankLabel}</span>
          </Badge>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {isAbsent && (
            <span className="inline-flex -rotate-2 items-center gap-1 rounded-pill border-2 border-outline bg-negative px-2.5 py-0.5 text-[11px] font-black uppercase text-white shadow-sticker-sm">
              <UserX className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'غائب' : 'ABSENT'}</span>
            </span>
          )}
          {isWalkoverWinner && !isAbsent && (
            <span className="inline-flex rotate-1 items-center gap-1 rounded-pill border-2 border-outline bg-gold-gradient px-2.5 py-0.5 text-[11px] font-black uppercase text-red-900 shadow-sticker-sm">
              <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'فوز انسحابي' : 'WALKOVER WIN'}</span>
            </span>
          )}
          {isSelected && !isAbsent && (
            <Badge variant="info" className="px-2 py-0.5 text-[11px] font-bold">
              {lang === 'ar' ? 'مختار' : 'SELECTED'}
            </Badge>
          )}
          {isWinner && !isWalkoverWinner && !isAbsent && (
            <Badge variant="positive" className="px-2 py-0.5 text-[11px] font-bold">
              <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'الفائز' : 'WINNER'}</span>
            </Badge>
          )}
          {isBuzzed && !isAbsent && (
            <Badge
              variant="gold"
              className="px-2 py-0.5 text-[11px] font-extrabold shadow-glow-gold"
            >
              <Zap className="h-3 w-3 fill-current shrink-0" aria-hidden="true" />
              <span>
                {isScorerCard
                  ? lang === 'ar'
                    ? 'الجرس!'
                    : 'BUZZED!'
                  : buzzedLabel}
              </span>
            </Badge>
          )}
        </div>
      </div>

      {/* Middle Row: Avatar + Name + Nickname */}
      <div
        className={cn(
          'relative z-10 flex items-center gap-3',
          isScorerCard ? 'my-2.5 @sm:my-3' : 'my-4 @sm:my-5 @sm:gap-4',
          isAbsent && 'opacity-75'
        )}
      >
        <PlayerAvatar
          name={name}
          playerId={playerId}
          avatarSeed={avatarSeed}
          avatar={avatar}
          size={isLargeScreen ? 'xl' : 'lg'}
          isHost={isHost}
          buzzed={isBuzzed && !isAbsent}
          selected={isSelected && !isAbsent}
          rank={rank}
          className={cn(
            !isLargeScreen &&
              (isScorerCard
                ? 'h-11 w-11 @xs:h-12 @xs:w-12 @md:h-14 @md:w-14'
                : 'h-12 w-12 @xs:h-14 @xs:w-14 @md:h-16 @md:w-16')
          )}
        />

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'truncate font-display ltr:tracking-tight rtl:tracking-normal',
              isLargeScreen
                ? 'text-[clamp(1.35rem,6cqi,2.25rem)]'
                : isScorerCard
                  ? 'text-[clamp(1.1rem,5cqi,1.45rem)]'
                  : 'text-[clamp(1.15rem,5.5cqi,1.65rem)]',
              isAbsent && 'line-through decoration-2',
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

      {/* Score & Card-Shaped Counters Section */}
      <div
        className={cn(
          'relative z-10 flex flex-wrap items-center justify-between gap-2 border-t-2',
          isScorerCard ? 'pt-2.5' : 'pt-3.5 @sm:pt-4',
          isDark ? 'border-white/15' : 'border-border-paper'
        )}
      >
        <div className="flex flex-col gap-1.5">
          <span
            className={cn(
              'text-[11px] @sm:text-xs font-bold uppercase ltr:tracking-wider rtl:tracking-normal',
              isDark ? 'text-white/90' : 'text-ink-muted'
            )}
          >
            {lang === 'ar' ? 'إجمالي النقاط' : 'TOTAL POINTS'}
          </span>

          {shouldShowCards && (
            <CardCounterGroup
              yellowCount={yellowCards}
              redCount={redCards}
              surface={isDark ? 'dark' : 'light'}
              size="sm"
              useArabicIndicDigits={useArabicIndicDigits}
              lang={lang}
            />
          )}
        </div>

        <div className="relative ms-auto flex min-w-0 max-w-full items-baseline gap-2">
          <AnimatePresence>
            {flashDelta && (
              <motion.span
                key={flashDelta.id}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : {
                        opacity: 0,
                        y: flashDelta.delta > 0 ? 10 : -10,
                        scale: 0.9,
                      }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 1, y: flashDelta.delta > 0 ? -8 : 6, scale: 1 }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-lg @sm:text-xl font-black tabular-nums shadow-sticker-sm',
                  flashDelta.delta > 0
                    ? 'bg-positive-soft text-positive-ink'
                    : 'bg-negative text-white'
                )}
              >
                {flashDelta.delta > 0 ? (
                  <Plus
                    className="h-3.5 w-3.5 stroke-[3] shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Minus
                    className="h-3.5 w-3.5 stroke-[3] shrink-0"
                    aria-hidden="true"
                  />
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
              'min-w-0 truncate font-score font-black leading-none tracking-normal',
              isLargeScreen
                ? 'text-[clamp(2.5rem,13cqi,5rem)]'
                : isScorerCard
                  ? 'text-[clamp(2.25rem,11cqi,3.25rem)]'
                  : 'text-[clamp(2.25rem,11cqi,3.5rem)]',
              isAbsent
                ? isDark
                  ? 'text-white/55'
                  : 'text-ink-faint'
                : isDark
                  ? 'text-gold-300'
                  : isGoldenSeat
                    ? 'text-gold-sticker'
                    : 'text-red-900'
            )}
          />
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      layout={!prefersReducedMotion && !isScorerCard}
      onClick={useOuterButton ? onSelect : undefined}
      role={useOuterButton ? 'button' : undefined}
      tabIndex={useOuterButton ? 0 : undefined}
      aria-pressed={useOuterButton ? isSelected : undefined}
      onKeyDown={
        useOuterButton && onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        '@container relative flex min-w-0 flex-col justify-between overflow-hidden rounded-card transition-[box-shadow,border-color,background-color] duration-200',
        isScorerCard ? 'p-3.5 @sm:p-4' : 'p-4 @xs:p-5 @md:p-6',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        isDark
          ? cn(
              isAbsent ? 'absent-stripes-dark' : 'bg-red-800',
              'text-white border-[2.5px] shadow-sticker',
              isAbsent
                ? 'border-white/30'
                : isWalkoverWinner
                  ? 'border-gold-400 ring-[3px] ring-gold-300 shadow-glow-gold'
                  : isSelected
                    ? 'border-white ring-[3px] ring-blue-500'
                    : isBuzzed
                      ? 'border-gold-300 ring-[3px] ring-gold-400 shadow-glow-gold'
                      : isGoldenSeat
                        ? 'border-gold-400 bg-gradient-to-b from-red-800 via-red-800 to-red-900 shadow-glow-gold'
                        : 'border-red-900'
            )
          : cn(
              isAbsent ? 'absent-stripes-light' : 'bg-white',
              'text-ink border-[2.5px] shadow-sticker',
              isAbsent
                ? 'border-ink-muted/45'
                : isWalkoverWinner
                  ? 'border-outline ring-[3px] ring-gold-400 bg-gradient-to-b from-gold-200 via-white to-white shadow-glow-gold'
                  : isSelected
                    ? 'border-blue-500 ring-[3px] ring-blue-500'
                    : isBuzzed
                      ? 'border-outline ring-[3px] ring-gold-400 shadow-glow-gold bg-gradient-to-b from-gold-200 via-white to-white'
                      : isGoldenSeat
                        ? 'border-outline bg-gradient-to-b from-gold-200 via-paper to-white shadow-sticker-lg'
                        : 'border-outline'
            ),
        useOuterButton && 'cursor-pointer',
        className
      )}
    >
      {/* Pulsing Gold Ring Overlay when Buzzed */}
      {isBuzzed && !isAbsent && !prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-card border-[3px] border-gold-300"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      {/* Top Info Area + Optional Round Contact Button (zero nested interactive buttons!) */}
      <div className="relative z-10 flex items-start gap-2">
        {onSelect && hasChildControls ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={isSelected}
            aria-label={
              lang === 'ar'
                ? `اختيار المتسابق ${name}`
                : `Select contestant ${name}`
            }
            className="flex min-w-0 flex-1 flex-col justify-between rounded-input text-start focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            {cardBodyContent}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {cardBodyContent}
          </div>
        )}

        {onContact && (
          <div className="relative z-20 shrink-0 pt-0.5">
            <ContactIconButton
              playerName={name}
              onClick={onContact}
              surface={isDark ? 'dark' : 'light'}
            />
          </div>
        )}
      </div>

      {/* Scorer Console Action Targets: minimum 56px tall touch targets */}
      {(onBuzz || hasDirectScoring || onMarkAbsent || onReverseAbsence) && (
        <div
          className={cn(
            'relative z-10 space-y-2.5 border-t-2',
            isScorerCard ? 'mt-3 pt-3' : 'mt-4 pt-4',
            isDark ? 'border-white/15' : 'border-border-paper'
          )}
        >
          {/* Buzz First Button (>= 56px) */}
          {onBuzz && !isAbsent && (
            <button
              type="button"
              disabled={disabledActions}
              onClick={onBuzz}
              className={cn(
                'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-button border-[2.5px] border-outline px-4 py-2.5 text-base font-extrabold shadow-sticker sticker-press disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                isBuzzed
                  ? 'bg-gold-gradient text-red-900 shadow-glow-gold'
                  : 'bg-white text-red-900 hover:bg-paper'
              )}
            >
              <Zap
                aria-hidden="true"
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
              <span className="sr-only"> — {name}</span>
            </button>
          )}

          {/* Direct v2 Scoring Controls: +1, −1, Yellow card (−1), Red card (−2) — NOTHING ELSE */}
          {hasDirectScoring && !isAbsent && (
            <div
              className={cn(
                'grid grid-cols-2 gap-2',
                scoringControlsClassName
              )}
            >
              {onPointPlus && (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={onPointPlus}
                  aria-label={
                    lang === 'ar'
                      ? `منح +١ نقطة إلى ${name}`
                      : `Award +1 point to ${name}`
                  }
                  className="flex min-h-[56px] items-center justify-center gap-1.5 rounded-button border-[2.5px] border-outline bg-positive-soft px-3 font-score text-2xl font-black tabular-nums text-positive-ink shadow-sticker-sm sticker-press hover:bg-positive hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <Plus
                    className="h-5 w-5 stroke-[3] shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {formatNumber(1, { useArabicIndicDigits })}
                  </span>
                </button>
              )}

              {onPointMinus && (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={onPointMinus}
                  aria-label={
                    lang === 'ar'
                      ? `خصم −١ نقطة من ${name}`
                      : `Deduct −1 point from ${name}`
                  }
                  className="flex min-h-[56px] items-center justify-center gap-1.5 rounded-button border-[2.5px] border-outline bg-white px-3 font-score text-2xl font-black tabular-nums text-negative shadow-sticker-sm sticker-press hover:bg-red-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <Minus
                    className="h-5 w-5 stroke-[3] shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {formatNumber(1, { useArabicIndicDigits })}
                  </span>
                </button>
              )}

              {onYellowCard && (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={onYellowCard}
                  aria-label={
                    lang === 'ar'
                      ? `بطاقة صفراء (−١) إلى ${name}`
                      : `Issue Yellow card (−1) to ${name}`
                  }
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-button border-[2.5px] border-outline bg-gold-400 px-3 text-red-900 shadow-sticker-sm sticker-press hover:bg-gold-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <DisciplinaryCardIcon card="yellow" size="sm" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-xs font-extrabold">
                      {lang === 'ar' ? 'بطاقة صفراء' : 'Yellow'}
                    </span>
                    <span className="font-score text-base font-black tabular-nums leading-none">
                      −{formatNumber(1, { useArabicIndicDigits })}
                    </span>
                  </span>
                </button>
              )}

              {onRedCard && (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={onRedCard}
                  aria-label={
                    lang === 'ar'
                      ? `بطاقة حمراء (−٢) إلى ${name}`
                      : `Issue Red card (−2) to ${name}`
                  }
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-button border-[2.5px] border-outline bg-negative px-3 text-white shadow-sticker-sm sticker-press hover:bg-red-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <DisciplinaryCardIcon card="red" size="sm" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-xs font-extrabold">
                      {lang === 'ar' ? 'بطاقة حمراء' : 'Red'}
                    </span>
                    <span className="font-score text-base font-black tabular-nums leading-none">
                      −{formatNumber(2, { useArabicIndicDigits })}
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Absence / Reverse Absence Secondary Row (>= 44px) */}
          {(onMarkAbsent || onReverseAbsence) && !isHost && (
            <div className="flex items-center justify-end gap-2">
              {isAbsent && onReverseAbsence ? (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={onReverseAbsence}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-2 border-outline bg-gold-400 px-3 py-2 text-xs sm:text-sm font-extrabold text-red-900 shadow-sticker-sm sticker-press hover:bg-gold-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'إلغاء الغياب (مدير)' : 'Reverse Absence (Admin)'}
                  </span>
                </button>
              ) : !isAbsent && onMarkAbsent ? (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={onMarkAbsent}
                  className={cn(
                    'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-2 px-3 py-2 text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    isDark
                      ? 'border-white/25 bg-red-900/80 text-red-100 hover:border-white/60 hover:bg-red-900 hover:text-white'
                      : 'border-border-paper bg-paper text-ink-muted hover:border-negative hover:text-negative'
                  )}
                >
                  <UserX className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {markAbsentLabel ??
                      (lang === 'ar' ? 'تسجيل غائب' : 'Mark Absent')}
                  </span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
