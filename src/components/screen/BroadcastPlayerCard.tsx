'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, Minus, Plus, Trophy, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';
import {
  AnimatedNumber,
  MarqueeBulbs,
  PlayerAvatar,
  ScoreChip,
  type ScoreChipTone,
} from '@/components/brand';

export interface BroadcastDeltaEvent {
  id: string | number;
  delta: number;
}

export interface BroadcastPlayerCardProps {
  playerId: string;
  name: string;
  nickname?: string;
  avatarSeed?: string;
  score: number;
  rank: number;
  isBuzzed?: boolean;
  /** True when another player on the table is currently buzzed */
  isDimmedByPeerBuzz?: boolean;
  isWinner?: boolean;
  isAdvancing?: boolean;
  isHost?: boolean;
  isFinal?: boolean;
  /** Optional explicit realtime delta event (fires even if score diff happens rapidly) */
  deltaEvent?: BroadcastDeltaEvent | null;
  useArabicIndicDigits?: boolean;
  className?: string;
}

/**
 * BroadcastPlayerCard
 * 10-meter legible venue/stream player panel for `/screen/[gameId]`.
 * - Crisp white sticker surface on crimson Stage (or warm Golden Seat for Marwan Serry in Final mode)
 * - Huge tabular `AnimatedNumber` score + floating `+/-` delta badge (always with Plus/Minus icon)
 * - Radiant golden BUZZED FIRST spotlight glow & pulse
 * - Name-only geometric avatar medallion (never real photos)
 */
export function BroadcastPlayerCard({
  name,
  nickname,
  avatarSeed,
  score,
  rank,
  isBuzzed = false,
  isDimmedByPeerBuzz = false,
  isWinner = false,
  isAdvancing = false,
  isHost = false,
  isFinal = false,
  deltaEvent = null,
  useArabicIndicDigits = false,
  className,
}: BroadcastPlayerCardProps) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const prevScoreRef = useRef<number>(score);
  const [floatingDelta, setFloatingDelta] =
    useState<BroadcastDeltaEvent | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const triggerDelta = (evt: BroadcastDeltaEvent) => {
    if (evt.delta === 0) return;
    setFloatingDelta(evt);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setFloatingDelta(null);
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Trigger on explicit realtime delta event
  useEffect(() => {
    if (deltaEvent && deltaEvent.delta !== 0) {
      triggerDelta(deltaEvent);
    }
  }, [deltaEvent]);

  // Fallback diff trigger if score prop changes without explicit deltaEvent
  useEffect(() => {
    if (score !== prevScoreRef.current) {
      const diff = score - prevScoreRef.current;
      prevScoreRef.current = score;
      if (!deltaEvent) {
        triggerDelta({ id: `diff-${Date.now()}-${diff}`, delta: diff });
      }
    }
  }, [score, deltaEvent]);

  const isGoldenSeat = isHost || (isFinal && isHost);
  const rankTone: ScoreChipTone =
    isGoldenSeat || rank === 1 ? 'gold' : rank === 2 ? 'red' : 'blue';

  return (
    <motion.article
      layout={!prefersReducedMotion}
      animate={
        prefersReducedMotion
          ? { opacity: isDimmedByPeerBuzz ? 0.84 : 1 }
          : {
              scale: isBuzzed ? 1.02 : isWinner ? 1.015 : 1,
              opacity: isDimmedByPeerBuzz ? 0.84 : 1,
            }
      }
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn(
        '@container relative flex min-w-0 flex-col justify-between overflow-hidden rounded-card border-[3px] border-outline p-3.5 sm:p-5 xl:p-6 3xl:p-8 [@media(max-height:520px)]:p-2.5 text-ink transition-shadow duration-300',
        isBuzzed
          ? 'bg-gradient-to-b from-gold-200 via-paper to-white ring-[5px] ring-gold-300 shadow-glow-gold'
          : isGoldenSeat
            ? 'bg-gradient-to-b from-gold-200 via-paper to-white ring-[4px] ring-gold-400/90 shadow-sticker-lg'
            : isWinner
              ? 'bg-gradient-to-b from-gold-200/80 via-paper to-white ring-[4px] ring-gold-300 shadow-sticker-lg'
              : 'bg-white shadow-sticker-lg',
        className
      )}
    >
      {/* Pulsing Gold Spotlight Ring when Buzzed First */}
      {isBuzzed && !prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[17px] border-[4px] border-gold-400"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Golden Seat Top Marquee Strip for Marwan Serry */}
      {isGoldenSeat && (
        <div className="relative z-10 mb-2 sm:mb-3 [@media(max-height:520px)]:hidden">
          <MarqueeBulbs variant="strip" bulbCount={10} tone="gold" chase />
        </div>
      )}

      {/* Top Status Bar: Rank Chip + Buzzed / Host / Winner Pill */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <ScoreChip
            value={`#${formatNumber(rank, { useArabicIndicDigits })}`}
            tone={rankTone}
            size="md"
            className="shrink-0 [@media(max-height:520px)]:scale-90"
          />
          {isGoldenSeat ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border-2 border-outline bg-gold-gradient px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-extrabold uppercase text-red-900 shadow-sticker-sm">
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
              <span className="hidden @xs:inline">
                {lang === 'ar' ? 'المقعد الذهبي · المضيف' : 'GOLDEN SEAT · HOST'}
              </span>
              <span className="@xs:hidden">
                {lang === 'ar' ? 'المقعد الذهبي' : 'GOLDEN SEAT'}
              </span>
            </span>
          ) : isFinal ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border-2 border-outline bg-blue-600 px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-extrabold uppercase text-white shadow-sticker-sm ring-2 ring-white">
              <span>{lang === 'ar' ? 'متأهل للنهائي' : 'FINALIST'}</span>
            </span>
          ) : null}
        </div>

        {/* Dynamic Status Callout: Buzzed First / Winner / Advancing */}
        <AnimatePresence mode="wait">
          {isBuzzed ? (
            <motion.span
              key="buzzed-pill"
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, scale: 0.85, y: -6 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border-[2.5px] border-outline bg-gold-gradient px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm 2xl:text-base font-black uppercase text-red-900 shadow-glow-gold"
            >
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-red-900 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'ar' ? 'ضغط الجرس أولاً!' : 'BUZZED FIRST!'}
              </span>
            </motion.span>
          ) : isWinner ? (
            <motion.span
              key="winner-pill"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border-2 border-outline bg-gold-gradient px-3.5 py-1 text-xs sm:text-sm font-black uppercase text-red-900 shadow-sticker-sm"
            >
              <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {isFinal
                  ? lang === 'ar'
                    ? 'البطل'
                    : 'CHAMPION'
                  : lang === 'ar'
                    ? 'الفائز'
                    : 'WINNER'}
              </span>
            </motion.span>
          ) : isAdvancing ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border-2 border-outline bg-positive-soft px-3 py-1 text-xs sm:text-sm font-extrabold uppercase text-positive-ink shadow-sticker-sm">
              <span>{lang === 'ar' ? 'متأهل' : 'ADVANCING'}</span>
            </span>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Center Identity Block: Container-adaptive Avatar + Name + Nickname (balanced vertically on tall displays) */}
      <div className="relative z-10 my-auto flex flex-col @sm:flex-row items-center text-center @sm:text-start gap-2.5 sm:gap-4 2xl:gap-6 py-3 sm:py-4 2xl:py-6 [@media(max-height:520px)]:py-1.5 [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:text-start">
        <PlayerAvatar
          name={name}
          avatarSeed={avatarSeed}
          size="xl"
          isHost={isHost}
          buzzed={isBuzzed}
          className="h-[clamp(3rem,min(5.2vw,8.5dvh),7.5rem)] w-[clamp(3rem,min(5.2vw,8.5dvh),7.5rem)] [@media(max-height:520px)]:h-10 [@media(max-height:520px)]:w-10 shrink-0"
        />

        <div className="min-w-0 flex-1 w-full">
          <h2
            className={cn(
              'truncate font-display leading-tight ltr:tracking-tight rtl:tracking-normal',
              'text-[length:var(--screen-player)] [@media(max-height:520px)]:text-base',
              isGoldenSeat ? 'text-red-900' : 'text-ink'
            )}
          >
            {name}
          </h2>
          {nickname && (
            <p className="mt-0.5 truncate font-semibold text-[length:var(--screen-nick)] [@media(max-height:520px)]:text-xs text-ink-muted">
              “{nickname}”
            </p>
          )}
        </div>
      </div>

      {/* Colossal 10-Meter Score Deck with Floating +/- Delta Flash */}
      <div className="relative z-10 flex items-end justify-between gap-3 border-t-[2.5px] border-border-paper pt-2.5 sm:pt-4 2xl:pt-6 [@media(max-height:520px)]:pt-1.5">
        <span className="font-bold uppercase text-[length:var(--screen-label)] ltr:tracking-wider rtl:tracking-normal text-ink-muted pb-1 sm:pb-2">
          {lang === 'ar' ? 'النقاط' : 'SCORE'}
        </span>

        <div className="relative ms-auto flex items-baseline justify-end gap-2.5">
          {/* Floating +/- Delta Badge (always paired with Plus/Minus icon) */}
          <AnimatePresence mode="popLayout">
            {floatingDelta && (
              <motion.div
                key={floatingDelta.id}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : {
                        opacity: 0,
                        y: floatingDelta.delta > 0 ? 18 : -18,
                        scale: 0.78,
                      }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : {
                        opacity: 1,
                        y: floatingDelta.delta > 0 ? -14 : 8,
                        scale: 1,
                      }
                }
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: floatingDelta.delta > 0 ? -36 : 26,
                        scale: 0.9,
                      }
                }
                transition={{ duration: 0.42, ease: 'easeOut' }}
                aria-live="polite"
                className={cn(
                  'pointer-events-none absolute -top-10 sm:-top-12 end-0 z-20 inline-flex shrink-0 items-center gap-1 rounded-pill border-[2.5px] border-outline px-3.5 py-1 font-score text-xl sm:text-2xl 2xl:text-3xl font-black tabular-nums shadow-sticker',
                  floatingDelta.delta > 0
                    ? 'bg-positive-soft text-positive-ink'
                    : 'bg-negative text-white'
                )}
              >
                {floatingDelta.delta > 0 ? (
                  <Plus
                    className="h-4 w-4 sm:h-5 sm:w-5 stroke-[3.2] shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Minus
                    className="h-4 w-4 sm:h-5 sm:w-5 stroke-[3.2] shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {formatNumber(Math.abs(floatingDelta.delta), {
                    useArabicIndicDigits,
                  })}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatedNumber
            value={score}
            useArabicIndicDigits={useArabicIndicDigits}
            duration={0.5}
            className={cn(
              'font-score font-black leading-none tracking-normal',
              'text-[length:var(--screen-score-hero)] [@media(max-height:520px)]:text-4xl',
              isGoldenSeat || isWinner || isBuzzed
                ? 'text-gold-sticker-lg'
                : 'text-red-900'
            )}
          />
        </div>
      </div>
    </motion.article>
  );
}
