'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Crown,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  Trophy,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  realtime,
  type RealtimeConnectionStatus,
  type RealtimeMessage,
} from '@/lib/realtime';
import {
  gameRepo,
  roundRepo,
  scoreRepo,
  settingsRepo,
  type LeaderboardEntry,
} from '@/lib/repos';
import type { Game, Round, Settings } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { PlayingDice } from '@/components/brand/GameMotifs';
import { ScoreChip, type ScoreChipTone } from '@/components/brand/ScoreChip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { BroadcastFrame } from './BroadcastFrame';
import { PresenterControlPill } from './PresenterControlPill';
import { usePresenterMode } from './usePresenterMode';

const ROWS_PER_PAGE = 8; // Ranks 4–11, 12–19, 20–27 (3 clean broadcast pages)
const AUTO_CYCLE_MS = 8500;

interface LiveDeltaRecord {
  id: string;
  delta: number;
}

/**
 * BigScreenLeaderboardView (`/screen/leaderboard`)
 * Broadcast-ready live tournament standings for 10-meter venue displays:
 * - Top-3 Podium Spotlight (#2 | #1 elevated | #3) with Framer Motion layout reordering
 * - 8-per-page giant legible broadcast rows cycling across Ranks 4–27
 * - Instant real-time sync via `/lib/realtime` with floating +/- deltas, rank-movement pills,
 *   and automatic jump + spotlight highlight whenever a player's score updates live.
 */
export function BigScreenLeaderboardView() {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const presenter = usePresenterMode();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>('connected');

  // Pagination & Auto-cycle across Ranks 4..27
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [autoCycle, setAutoCycle] = useState<boolean>(true);

  // Live highlight, floating +/- deltas, and rank-change arrows
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(
    null
  );
  const [deltaByPlayer, setDeltaByPlayer] = useState<
    Record<string, LiveDeltaRecord | null>
  >({});
  const [rankShiftByPlayer, setRankShiftByPlayer] = useState<
    Record<string, number>
  >({});

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const prevRanksRef = useRef<Record<string, number>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const deltaTimeoutsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    mountedRef.current = true;
    const dTimeouts = deltaTimeoutsRef.current;
    return () => {
      mountedRef.current = false;
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      Object.values(dTimeouts).forEach((tid) => window.clearTimeout(tid));
    };
  }, []);

  // Pause auto-cycling automatically when user prefers reduced motion
  useEffect(() => {
    if (prefersReducedMotion) {
      setAutoCycle(false);
    }
  }, [prefersReducedMotion]);

  const loadLeaderboard = useCallback(
    async (focusPlayerId?: string) => {
      const seq = ++loadSeqRef.current;
      try {
        const [loadedEntries, loadedRounds, loadedGames, loadedSettings] =
          await Promise.all([
            scoreRepo.getLeaderboard({
              roundId: selectedRoundId === 'all' ? undefined : selectedRoundId,
              includeHost: false,
            }),
            roundRepo.list(),
            gameRepo.list({ includeDemo: true }),
            settingsRepo.get(),
          ]);

        if (!mountedRef.current || seq !== loadSeqRef.current) return;

        // Compute rank shifts relative to previous snapshot
        const prevMap = prevRanksRef.current;
        const hasPrev = Object.keys(prevMap).length > 0;
        const shifts: Record<string, number> = {};
        const nextMap: Record<string, number> = {};

        loadedEntries.forEach((entry) => {
          nextMap[entry.player.id] = entry.rank;
          if (hasPrev && typeof prevMap[entry.player.id] === 'number') {
            const deltaRank = prevMap[entry.player.id] - entry.rank; // positive = moved UP
            if (deltaRank !== 0) {
              shifts[entry.player.id] = deltaRank;
            }
          }
        });
        prevRanksRef.current = nextMap;

        if (Object.keys(shifts).length > 0) {
          setRankShiftByPlayer(shifts);
        }

        setEntries(loadedEntries);
        setRounds(loadedRounds);
        setAllGames(loadedGames);
        setSettings(loadedSettings);

        // If a live score update hit a player in Ranks 4..27, jump straight to their page
        if (focusPlayerId) {
          const idx = loadedEntries.findIndex(
            (e) => e.player.id === focusPlayerId
          );
          if (idx >= 3) {
            const targetPage = Math.floor((idx - 3) / ROWS_PER_PAGE);
            setPageIndex(targetPage);
          }
          setHighlightedPlayerId(focusPlayerId);
          if (highlightTimeoutRef.current !== null) {
            window.clearTimeout(highlightTimeoutRef.current);
          }
          highlightTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current) setHighlightedPlayerId(null);
          }, 4200);
        }
      } finally {
        if (mountedRef.current && seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [selectedRoundId]
  );

  useEffect(() => {
    setPageIndex(0);
    prevRanksRef.current = {};
    setRankShiftByPlayer({});
    void loadLeaderboard();
  }, [loadLeaderboard]);

  // Monitor realtime transport status & resync when returning to foreground
  useEffect(() => {
    const unsubStatus = realtime.onStatusChange(setConnectionStatus);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadLeaderboard();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubStatus();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadLeaderboard]);

  // Subscribe to realtime updates from Scorer Console & Admin
  useEffect(() => {
    const unsub = realtime.subscribe('*', (message: RealtimeMessage) => {
      const payload = (message.payload ?? {}) as Record<string, unknown>;

      if (
        message.event === 'score.changed' &&
        typeof payload.playerId === 'string' &&
        typeof payload.delta === 'number' &&
        payload.delta !== 0
      ) {
        const pid = payload.playerId;
        const delta = payload.delta;
        setDeltaByPlayer((prev) => ({
          ...prev,
          [pid]: { id: message.id, delta },
        }));

        if (deltaTimeoutsRef.current[pid]) {
          window.clearTimeout(deltaTimeoutsRef.current[pid]);
        }
        deltaTimeoutsRef.current[pid] = window.setTimeout(() => {
          if (mountedRef.current) {
            setDeltaByPlayer((prev) => ({ ...prev, [pid]: null }));
          }
        }, 2600);

        void loadLeaderboard(pid);
        return;
      }

      if (
        message.event === 'score.changed' ||
        message.event === 'game.started' ||
        message.event === 'game.finished' ||
        message.event === 'bracket.updated' ||
        message.event === 'player.updated' ||
        message.event === 'settings.updated' ||
        message.event === 'data.reset'
      ) {
        void loadLeaderboard();
      }
    });

    return unsub;
  }, [loadLeaderboard]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const topThree = useMemo(() => entries.slice(0, 3), [entries]);
  const restEntries = useMemo(() => entries.slice(3), [entries]);
  const totalPages = Math.max(1, Math.ceil(restEntries.length / ROWS_PER_PAGE));

  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleRest = useMemo(() => {
    const start = safePageIndex * ROWS_PER_PAGE;
    return restEntries.slice(start, start + ROWS_PER_PAGE);
  }, [restEntries, safePageIndex]);

  // Auto-cycle timer for pages 1..N (resets cleanly on manual page click or live highlight jump)
  useEffect(() => {
    if (!autoCycle || totalPages <= 1) return;
    const id = window.setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, AUTO_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [autoCycle, totalPages, safePageIndex, highlightedPlayerId]);

  const activeLiveGame = useMemo(
    () => allGames.find((g) => g.status === 'live' && !g.isDemo) ?? null,
    [allGames]
  );

  // Horizontal touch swipe paging on the standings board (strict horizontal-vs-vertical axis lock, RTL mirrored)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleBoardTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (e.touches.length !== 1) return;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    },
    []
  );
  const handleBoardTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!touchStartRef.current || totalPages <= 1 || e.changedTouches.length !== 1) {
        touchStartRef.current = null;
        return;
      }
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      // Require clear horizontal dominance so vertical page scrolling is never hijacked
      if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;

      const isRtl = lang === 'ar';
      const swipeNext = isRtl ? dx > 0 : dx < 0;
      setPageIndex((prev) =>
        swipeNext ? (prev + 1) % totalPages : (prev - 1 + totalPages) % totalPages
      );
    },
    [totalPages, lang]
  );

  // Adapted podium topology:
  // - Mobile (< md): natural 1-col [#1, #2, #3]
  // - Tablet Portrait (md): 2-col Podium Pyramid (#1 full-width top, #2 & #3 side-by-side below)
  // - Tablet Landscape & Desktop (lg+): 3-col TV podium [#2 | #1 elevated | #3]
  const podiumOrderClass = (rankIdx: number) => {
    if (rankIdx === 0)
      return 'order-1 md:col-span-2 lg:col-span-1 lg:order-2 lg:-translate-y-1.5';
    if (rankIdx === 1) return 'order-2 lg:order-1';
    return 'order-3 lg:order-3';
  };

  const rangeStart = 4 + safePageIndex * ROWS_PER_PAGE;
  const rangeEnd = Math.min(
    entries.length,
    rangeStart + visibleRest.length - 1
  );

  return (
    <BroadcastFrame cursorHidden={presenter.cursorHidden} showLanterns>
      {/* TOP BROADCAST HEADER RAIL */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-0 sm:[@media(min-height:560px)]:px-14 xl:px-20">
        {/* Start: Brand & Huge Gold Title (zero eyebrow kickers above heading) */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3.5">
          <div className="hidden sm:inline-flex items-center gap-2 rounded-pill border-[2.5px] border-outline bg-red-900 px-3.5 py-1.5 shadow-sticker-sm">
            <PlayingDice
              value={5}
              size="sm"
              tilt={6}
              float={false}
              className="shrink-0 [&>svg]:h-6 [&>svg]:w-6"
            />
            <span className="font-display text-sm 2xl:text-base text-white whitespace-nowrap">
              {lang === 'ar' ? 'كازينو الألعاب' : 'Casino El Al3ab'}
            </span>
          </div>

          <h1 className="font-display text-gold-sticker text-[length:var(--screen-lb-title)] leading-none rtl:leading-[1.18] text-balance">
            {lang === 'ar' ? 'لوحة الصدارة المباشرة' : 'LIVE LEADERBOARD'}
          </h1>
        </div>

        {/* End: Live Badge + Active Table Jump + Round Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <LiveBadge size="lg" surface="stage" />

          {activeLiveGame && (
            <Link
              href={`/screen/${activeLiveGame.id}`}
              className="hidden xl:inline-flex min-h-[44px] items-center gap-2 rounded-pill border-[2.5px] border-outline bg-gold-gradient px-4 py-1.5 text-sm font-extrabold text-red-900 shadow-sticker-sm sticker-press"
            >
              <Radio className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="max-w-[240px] truncate">
                {localizeText(
                  lang,
                  activeLiveGame.tableName,
                  activeLiveGame.tableNameAr
                )}
              </span>
            </Link>
          )}

          {/* Round Filter Pills (>= 44px x 44px touch targets) */}
          <div
            role="group"
            aria-label={lang === 'ar' ? 'تصفية حسب الدور' : 'Filter by round'}
            className="inline-flex items-center gap-1 rounded-pill border-[2.5px] border-outline bg-red-900 p-1 shadow-sticker-sm"
          >
            <button
              type="button"
              onClick={() => setSelectedRoundId('all')}
              aria-pressed={selectedRoundId === 'all'}
              className={cn(
                'min-h-[44px] min-w-[44px] rounded-pill px-3.5 text-xs sm:text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                selectedRoundId === 'all'
                  ? 'bg-gold-gradient text-red-900'
                  : 'text-white hover:bg-red-800'
              )}
            >
              {lang === 'ar' ? 'الكل' : 'All'}
            </button>
            {rounds
              .filter((r) => r.id !== 'round-final')
              .map((round) => {
                const isSelected = selectedRoundId === round.id;
                const shortLabel =
                  round.id === 'round-1'
                    ? lang === 'ar'
                      ? 'د١'
                      : 'R1'
                    : round.id === 'round-2'
                      ? lang === 'ar'
                        ? 'د٢'
                        : 'R2'
                      : lang === 'ar'
                        ? 'نصف'
                        : 'Semi';
                return (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => setSelectedRoundId(round.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'min-h-[44px] min-w-[44px] rounded-pill px-3.5 text-xs sm:text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                      isSelected
                        ? 'bg-gold-gradient text-red-900'
                        : 'text-white hover:bg-red-800'
                    )}
                  >
                    {shortLabel}
                  </button>
                );
              })}
          </div>
        </div>
      </header>

      {/* LOADING STATE */}
      {loading ? (
        <div className="flex flex-1 flex-col gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-card bg-red-800/70" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 rounded-card bg-red-800/65" />
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-card border-[3px] border-outline bg-white p-6 text-ink shadow-sticker-lg">
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لا توجد نتائج مسجلة بعد'
                  : 'No Standings Recorded Yet'
              }
              description={
                lang === 'ar'
                  ? 'ستظهر النقاط والترتيب العام تلقائياً هنا بمجرد تسجيل أول نقاط في البطولة.'
                  : 'Live standings will populate here automatically as soon as the first scores are recorded.'
              }
            />
          </div>
        </div>
      ) : (
        <LayoutGroup id="big-screen-leaderboard">
          <div
            className={cn(
              'relative z-20 flex flex-1 min-h-0 flex-col gap-2.5 sm:gap-3.5 2xl:gap-5 pt-2.5 sm:pt-3 transition-[padding] duration-300',
              presenter.controlsVisible
                ? 'pb-20 sm:pb-16 lg:pb-14 [@media(max-height:520px)]:pb-12'
                : 'pb-1'
            )}
          >
            {/* TOP 3 PODIUM SPOTLIGHT (Mobile: 1-col; Tablet Portrait md: 2-col pyramid; Tablet Landscape lg+: 3-col podium) */}
            <section
              aria-label={
                lang === 'ar' ? 'المراكز الثلاثة الأولى' : 'Top 3 Podium Leaders'
              }
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 2xl:gap-5 items-stretch"
            >
              {topThree.map((entry, idx) => {
                const isFirst = idx === 0;
                const isHighlighted = highlightedPlayerId === entry.player.id;
                const delta = deltaByPlayer[entry.player.id] ?? null;
                const shift = rankShiftByPlayer[entry.player.id] ?? 0;
                const pName = localizeText(
                  lang,
                  entry.player.fullName,
                  entry.player.fullNameAr
                );
                const pNick = localizeText(
                  lang,
                  entry.player.nickname,
                  entry.player.nicknameAr
                );
                const tone: ScoreChipTone =
                  idx === 0 ? 'gold' : idx === 1 ? 'red' : 'blue';

                return (
                  <motion.article
                    key={entry.player.id}
                    layout={!prefersReducedMotion}
                    transition={{
                      type: 'spring',
                      stiffness: 320,
                      damping: 30,
                    }}
                    className={cn(
                      '@container relative flex flex-col justify-between gap-2.5 rounded-card border-[3px] border-outline p-3 sm:p-4 2xl:p-5 text-ink transition-shadow duration-300',
                      // On wide podium cards (phone full-width, tablet #1 hero, and xl+ desktop), use crisp single-row layout;
                      // On compact 2-up/3-up tablet cards (md..lg), use 2-tier layout so full names NEVER truncate!
                      isFirst
                        ? 'sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center'
                        : 'sm:flex-row sm:items-center md:flex-col md:items-stretch xl:flex-row xl:items-center',
                      podiumOrderClass(idx),
                      isFirst
                        ? 'bg-gradient-to-b from-gold-200 via-paper to-white ring-[4px] ring-gold-300 shadow-glow-gold'
                        : isHighlighted
                          ? 'bg-gradient-to-b from-gold-200/80 via-white to-white ring-[4px] ring-gold-300 shadow-glow-gold'
                          : 'bg-white shadow-sticker-lg'
                    )}
                  >
                    {/* Start / Top Tier: Rank Chip + Avatar + Identity (with inline score only on compact 2-tier tablet view) */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative shrink-0">
                        <ScoreChip
                          value={`#${formatNumber(entry.rank, { useArabicIndicDigits: useArabicIndic })}`}
                          tone={tone}
                          size="md"
                        />
                        {isFirst && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-2.5 -end-2 inline-flex h-6 w-6 items-center justify-center rounded-pill border-2 border-outline bg-gold-gradient text-red-900"
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>

                      <PlayerAvatar
                        name={pName}
                        avatarSeed={entry.player.avatarSeed}
                        size="lg"
                        buzzed={isHighlighted}
                        className="h-11 w-11 xl:h-14 xl:w-14 3xl:h-[4.5rem] 3xl:w-[4.5rem] shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h2 className="truncate font-display text-[clamp(1.15rem,min(1.7vw,3.1dvh),2.4rem)] text-red-900 leading-tight">
                            {pName}
                          </h2>
                          {shift !== 0 && (
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-0.5 rounded-pill border border-outline px-1.5 py-0.5 text-xs font-black tabular-nums',
                                shift > 0
                                  ? 'bg-positive-soft text-positive-ink'
                                  : 'bg-negative text-white'
                              )}
                            >
                              {shift > 0 ? (
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              )}
                              <span>
                                {formatNumber(Math.abs(shift), {
                                  useArabicIndicDigits: useArabicIndic,
                                })}
                              </span>
                            </span>
                          )}
                        </div>

                        <p className="truncate text-[length:var(--screen-nick)] font-semibold text-ink-muted">
                          “{pNick}” ·{' '}
                          <span className="text-red-700 font-bold">
                            {formatNumber(entry.wins, {
                              useArabicIndicDigits: useArabicIndic,
                            })}{' '}
                            {lang === 'ar' ? 'فوز' : entry.wins === 1 ? 'Win' : 'Wins'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* End / Bottom Tier: Animated Giant Score + Floating Delta */}
                    <div
                      className={cn(
                        'relative flex shrink-0 items-baseline justify-between gap-2 border-t border-border-paper pt-2',
                        isFirst
                          ? 'sm:block sm:border-t-0 sm:pt-0 sm:text-end lg:flex lg:border-t lg:pt-2 xl:block xl:border-t-0 xl:pt-0 xl:text-end'
                          : 'sm:block sm:border-t-0 sm:pt-0 sm:text-end md:flex md:border-t md:pt-2 xl:block xl:border-t-0 xl:pt-0 xl:text-end'
                      )}
                    >
                      <span
                        className={cn(
                          'text-[length:var(--screen-label)] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink-muted',
                          isFirst
                            ? 'sm:hidden lg:inline xl:hidden'
                            : 'sm:hidden md:inline xl:hidden'
                        )}
                      >
                        {lang === 'ar' ? 'الإجمالي' : 'TOTAL SCORE'}
                      </span>

                      <div className="relative flex items-baseline gap-1.5 xl:block">
                        <AnimatePresence mode="popLayout">
                          {delta && (
                            <motion.span
                              key={delta.id}
                              initial={
                                prefersReducedMotion
                                  ? { opacity: 1 }
                                  : { opacity: 0, y: 12, scale: 0.8 }
                              }
                              animate={{ opacity: 1, y: -6, scale: 1 }}
                              exit={{ opacity: 0, y: -22 }}
                              transition={{ duration: 0.35, ease: 'easeOut' }}
                              className={cn(
                                'pointer-events-none absolute -top-7 end-0 z-20 inline-flex items-center gap-0.5 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-base sm:text-lg font-black tabular-nums shadow-sticker-sm',
                                delta.delta > 0
                                  ? 'bg-positive-soft text-positive-ink'
                                  : 'bg-negative text-white'
                              )}
                            >
                              {delta.delta > 0 ? (
                                <Plus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                              ) : (
                                <Minus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                              )}
                              <span>
                                {formatNumber(Math.abs(delta.delta), {
                                  useArabicIndicDigits: useArabicIndic,
                                })}
                              </span>
                            </motion.span>
                          )}
                        </AnimatePresence>

                        <AnimatedNumber
                          value={entry.totalPoints}
                          useArabicIndicDigits={useArabicIndic}
                          className={cn(
                            'font-score font-black leading-none',
                            'text-[length:var(--screen-score-podium)]',
                            isFirst ? 'text-gold-sticker' : 'text-red-900'
                          )}
                        />
                        <span className="xl:block text-[length:var(--screen-label)] font-extrabold uppercase text-ink-muted">
                          {lang === 'ar' ? 'نقطة' : 'PTS'}
                        </span>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </section>

            {/* PAGE & AUTO-CYCLE BAR */}
            {restEntries.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-pill border-[2.5px] border-outline bg-red-900/90 px-4 py-1.5 text-white shadow-sticker-sm">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm 2xl:text-base font-extrabold">
                  <Trophy
                    className="h-4 w-4 text-gold-300 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {lang === 'ar'
                      ? `المراكز #${formatNumber(rangeStart, { useArabicIndicDigits: useArabicIndic })} – #${formatNumber(rangeEnd, { useArabicIndicDigits: useArabicIndic })} من ${formatNumber(entries.length, { useArabicIndicDigits: useArabicIndic })}`
                      : `RANKS #${rangeStart} – #${rangeEnd} OF ${entries.length}`}
                  </span>
                </div>

                {/* Page Indicator Dots + Prev/Next/Auto-Cycle Controls (>= 44px touch targets) */}
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1 me-1">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPageIndex(idx)}
                        aria-label={
                          lang === 'ar'
                            ? `صفحة ${formatNumber(idx + 1, { useArabicIndicDigits: useArabicIndic })}`
                            : `Page ${idx + 1}`
                        }
                        aria-current={idx === safePageIndex ? 'page' : undefined}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill px-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        <span
                          className={cn(
                            'block h-2.5 rounded-pill border border-outline transition-all duration-300',
                            idx === safePageIndex
                              ? 'w-9 bg-gold-gradient'
                              : 'w-3.5 bg-white/45 hover:bg-white/75'
                          )}
                        />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAutoCycle((v) => !v)}
                    aria-pressed={autoCycle}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-white/25 bg-red-800 px-3.5 text-xs sm:text-sm font-extrabold text-white hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    {autoCycle ? (
                      <Pause className="h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4 shrink-0 text-gold-300 fill-current" aria-hidden="true" />
                    )}
                    <span>
                      {autoCycle
                        ? lang === 'ar'
                          ? 'تبديل تلقائي'
                          : 'Auto-Cycle'
                        : lang === 'ar'
                          ? 'متوقف'
                          : 'Paused'}
                    </span>
                  </button>

                  {totalPages > 1 && (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPageIndex(
                            (prev) => (prev - 1 + totalPages) % totalPages
                          )
                        }
                        aria-label={
                          lang === 'ar' ? 'الصفحة السابقة' : 'Previous page'
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-pill border-2 border-outline bg-white text-red-900 hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        <ChevronLeft
                          className="h-5 w-5 rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPageIndex((prev) => (prev + 1) % totalPages)
                        }
                        aria-label={
                          lang === 'ar' ? 'الصفحة التالية' : 'Next page'
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-pill border-2 border-outline bg-white text-red-900 hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        <ChevronRight
                          className="h-5 w-5 rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RANKS 4–27 TWO-COLUMN 10M-LEGIBLE LAYOUT-ANIMATED BOARD (Supports horizontal touch swipe on touchscreens) */}
            <section
              aria-label={
                lang === 'ar' ? 'بقية الترتيب العام' : 'Tournament Standings'
              }
              onTouchStart={handleBoardTouchStart}
              onTouchEnd={handleBoardTouchEnd}
              className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5 2xl:gap-4 flex-1 min-h-0 auto-rows-fr touch-pan-y"
            >
              <AnimatePresence mode="popLayout">
                {visibleRest.map((entry) => {
                  const isHighlighted = highlightedPlayerId === entry.player.id;
                  const delta = deltaByPlayer[entry.player.id] ?? null;
                  const shift = rankShiftByPlayer[entry.player.id] ?? 0;
                  const pName = localizeText(
                    lang,
                    entry.player.fullName,
                    entry.player.fullNameAr
                  );
                  const pNick = localizeText(
                    lang,
                    entry.player.nickname,
                    entry.player.nicknameAr
                  );

                  return (
                    <motion.div
                      key={entry.player.id}
                      layout={!prefersReducedMotion}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { opacity: 0, y: 8 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
                      }
                      transition={{
                        layout: {
                          type: 'spring',
                          stiffness: 340,
                          damping: 32,
                        },
                        duration: 0.25,
                      }}
                      className={cn(
                        'relative flex items-center justify-between gap-3 rounded-card border-[2.5px] border-outline px-3.5 py-2 sm:px-4 sm:py-2.5 2xl:px-6 2xl:py-4 text-ink transition-shadow duration-200',
                        isHighlighted
                          ? 'ltr:bg-gradient-to-r rtl:bg-gradient-to-l from-gold-200 via-paper to-white ring-[4px] ring-gold-300 shadow-glow-gold'
                          : 'bg-white shadow-sticker'
                      )}
                    >
                      {/* Start: Rank + Avatar + Name */}
                      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                        <ScoreChip
                          value={`#${formatNumber(entry.rank, { useArabicIndicDigits: useArabicIndic })}`}
                          tone={isHighlighted ? 'gold' : 'white'}
                          size="sm"
                          className="shrink-0 2xl:scale-110"
                        />

                        <PlayerAvatar
                          name={pName}
                          avatarSeed={entry.player.avatarSeed}
                          size="sm"
                          buzzed={isHighlighted}
                          className="hidden xs:inline-flex h-10 w-10 xl:h-12 xl:w-12 3xl:h-16 3xl:w-16 shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-display text-[length:var(--screen-row-name)] text-ink leading-tight">
                              {pName}
                            </span>
                            {shift !== 0 && (
                              <span
                                className={cn(
                                  'inline-flex shrink-0 items-center gap-0.5 rounded-pill border border-outline px-1.5 py-0.5 text-xs font-black tabular-nums',
                                  shift > 0
                                    ? 'bg-positive-soft text-positive-ink'
                                    : 'bg-negative text-white'
                                )}
                              >
                                {shift > 0 ? (
                                  <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                )}
                                <span>
                                  {formatNumber(Math.abs(shift), {
                                    useArabicIndicDigits: useArabicIndic,
                                  })}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[length:var(--screen-nick)] font-medium text-ink-muted truncate">
                            <span className="truncate">“{pNick}”</span>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0 font-bold text-red-700">
                              {formatNumber(entry.wins, {
                                useArabicIndicDigits: useArabicIndic,
                              })}{' '}
                              {lang === 'ar'
                                ? 'فوز'
                                : entry.wins === 1
                                  ? 'Win'
                                  : 'Wins'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* End: Floating Delta + Giant Tabular Score */}
                      <div className="relative flex shrink-0 items-center gap-2.5">
                        <AnimatePresence mode="popLayout">
                          {delta && (
                            <motion.span
                              key={delta.id}
                              initial={
                                prefersReducedMotion
                                  ? { opacity: 1 }
                                  : { opacity: 0, x: 10, scale: 0.85 }
                              }
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-base sm:text-lg font-black tabular-nums shadow-sticker-sm',
                                delta.delta > 0
                                  ? 'bg-positive-soft text-positive-ink'
                                  : 'bg-negative text-white'
                              )}
                            >
                              {delta.delta > 0 ? (
                                <Plus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                              ) : (
                                <Minus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                              )}
                              <span>
                                {formatNumber(Math.abs(delta.delta), {
                                  useArabicIndicDigits: useArabicIndic,
                                })}
                              </span>
                            </motion.span>
                          )}
                        </AnimatePresence>

                        <div className="flex items-baseline gap-1.5 text-end">
                          <AnimatedNumber
                            value={entry.totalPoints}
                            useArabicIndicDigits={useArabicIndic}
                            className="font-score text-[length:var(--screen-score-row)] font-black leading-none text-red-900"
                          />
                          <span className="text-[length:var(--screen-label)] font-extrabold uppercase text-ink-muted">
                            {lang === 'ar' ? 'نقطة' : 'PTS'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </section>
          </div>
        </LayoutGroup>
      )}

      {/* AUTO-HIDING PRESENTER CONTROL PILL */}
      <PresenterControlPill
        activeView="leaderboard"
        games={allGames}
        isPresenterMode={presenter.isPresenterMode}
        controlsVisible={presenter.controlsVisible}
        onTogglePresenterMode={() => void presenter.togglePresenterMode()}
        connectionStatus={connectionStatus}
      />
    </BroadcastFrame>
  );
}
