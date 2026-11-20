'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CalendarClock,
  Crown,
  Flame,
  Minus,
  Plus,
  Radio,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  realtime,
  type RealtimeConnectionStatus,
  type RealtimeMessage,
} from '@/lib/realtime';
import {
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import type {
  Game,
  GameTimerState,
  Player,
  Round,
  Segment,
  Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { PlayingDice } from '@/components/brand/GameMotifs';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { TimerRing } from '@/components/brand/TimerRing';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { BroadcastFrame } from './BroadcastFrame';
import {
  BroadcastPlayerCard,
  type BroadcastDeltaEvent,
} from './BroadcastPlayerCard';
import { PresenterControlPill } from './PresenterControlPill';
import { usePresenterMode } from './usePresenterMode';

interface LowerThirdEvent {
  id: string;
  tone: 'positive' | 'negative' | 'gold' | 'info';
  title: string;
  detail?: string;
  delta?: number;
}

function formatScheduledLabel(
  iso: string | undefined,
  lang: 'en' | 'ar',
  useArabicIndicDigits: boolean
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

/**
 * BigScreenGameView (`/screen/[gameId]`)
 * Venue & livestream broadcast display designed for 10-meter legibility at 1920px–4K.
 * Syncs instantaneously with `/scorer/[gameId]` via `/lib/realtime`.
 */
export function BigScreenGameView({ gameId }: { gameId: string }) {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const presenter = usePresenterMode();

  const [game, setGame] = useState<Game | null>(null);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [playersMap, setPlayersMap] = useState<Record<string, Player>>({});
  const [segmentsMap, setSegmentsMap] = useState<Record<string, Segment>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>('connected');

  // Timer live remaining seconds synced with endsAt
  const [displayRemainingSec, setDisplayRemainingSec] = useState<number>(45);

  // Realtime delta events keyed by playerId (allows rapid repeated deltas to animate cleanly)
  const [deltaByPlayer, setDeltaByPlayer] = useState<
    Record<string, BroadcastDeltaEvent | null>
  >({});

  // Bonus Idea: Broadcast Lower-Third Event Ribbon
  const [lowerThird, setLowerThird] = useState<LowerThirdEvent | null>(null);
  const lowerThirdTimeoutRef = useRef<number | null>(null);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const playersRef = useRef<Record<string, Player>>({});
  const segmentsRef = useRef<Record<string, Segment>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (lowerThirdTimeoutRef.current !== null) {
        window.clearTimeout(lowerThirdTimeoutRef.current);
      }
    };
  }, []);

  const flashLowerThird = useCallback((evt: LowerThirdEvent) => {
    setLowerThird(evt);
    if (lowerThirdTimeoutRef.current !== null) {
      window.clearTimeout(lowerThirdTimeoutRef.current);
    }
    lowerThirdTimeoutRef.current = window.setTimeout(() => {
      if (mountedRef.current) setLowerThird(null);
    }, 3400);
  }, []);

  const syncTimerDisplayFromGame = useCallback(
    (loadedGame: Game, segs: Record<string, Segment>) => {
      if (loadedGame.timer?.status === 'running' && loadedGame.timer.endsAt) {
        const left = Math.max(
          0,
          Math.ceil(
            (new Date(loadedGame.timer.endsAt).getTime() - Date.now()) / 1000
          )
        );
        setDisplayRemainingSec(left);
      } else if (loadedGame.timer) {
        setDisplayRemainingSec(loadedGame.timer.remainingSec);
      } else {
        const segId = loadedGame.segmentIds[loadedGame.currentSegmentIndex];
        setDisplayRemainingSec(segs[segId]?.durationSec ?? 45);
      }
    },
    []
  );

  const loadScreenState = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [
        loadedGame,
        loadedGames,
        loadedPlayers,
        loadedSegments,
        loadedSettings,
        gameTotals,
      ] = await Promise.all([
        gameRepo.get(gameId),
        gameRepo.list({ includeDemo: true }),
        playerRepo.list({ includeHost: true }),
        segmentRepo.list(),
        settingsRepo.get(),
        scoreRepo.getGameTotals(gameId),
      ]);

      let loadedRound: Round | null = null;
      if (loadedGame) {
        loadedRound = await roundRepo.get(loadedGame.roundId);
      }

      if (!mountedRef.current || seq !== loadSeqRef.current) return;

      const pMap: Record<string, Player> = {};
      loadedPlayers.forEach((p) => {
        pMap[p.id] = p;
      });
      const sMap: Record<string, Segment> = {};
      loadedSegments.forEach((s) => {
        sMap[s.id] = s;
      });

      playersRef.current = pMap;
      segmentsRef.current = sMap;

      setGame(loadedGame);
      setAllGames(loadedGames);
      setRound(loadedRound);
      setPlayersMap(pMap);
      setSegmentsMap(sMap);
      setSettings(loadedSettings);
      setTotals(gameTotals);

      if (loadedGame) {
        syncTimerDisplayFromGame(loadedGame, sMap);
      }
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [gameId, syncTimerDisplayFromGame]);

  useEffect(() => {
    setLoading(true);
    void loadScreenState();
  }, [loadScreenState]);

  // Monitor realtime transport connection status & resync on tab foregrounding
  useEffect(() => {
    const unsubStatus = realtime.onStatusChange(setConnectionStatus);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadScreenState();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubStatus();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadScreenState]);

  // Subscribe to all realtime events from Scorer Console / Admin
  useEffect(() => {
    const unsub = realtime.subscribe('*', (message: RealtimeMessage) => {
      const payload = (message.payload ?? {}) as Record<string, unknown>;
      const msgGameId = typeof payload.gameId === 'string' ? payload.gameId : null;

      // Fast-path instant UI state updates for our game before async reload settles
      if (msgGameId === gameId) {
        if (message.event === 'timer.updated' && payload.timer) {
          const t = payload.timer as GameTimerState;
          setGame((prev) => (prev ? { ...prev, timer: t } : prev));
          if (t.status === 'running' && t.endsAt) {
            const left = Math.max(
              0,
              Math.ceil((new Date(t.endsAt).getTime() - Date.now()) / 1000)
            );
            setDisplayRemainingSec(left);
          } else {
            setDisplayRemainingSec(t.remainingSec);
          }
          return;
        }

        if (message.event === 'buzz.recorded' && typeof payload.playerId === 'string') {
          const pid = payload.playerId;
          setGame((prev) =>
            prev ? { ...prev, activeBuzzPlayerId: pid || null } : prev
          );
          const p = playersRef.current[pid];
          if (p) {
            flashLowerThird({
              id: message.id,
              tone: 'gold',
              title:
                lang === 'ar'
                  ? `${p.fullNameAr || p.fullName} ضغط الجرس أولاً!`
                  : `${p.fullName} BUZZED FIRST!`,
              detail: p.nickname
                ? `“${localizeText(lang, p.nickname, p.nicknameAr)}”`
                : undefined,
            });
          }
        }

        if (message.event === 'buzz.cleared') {
          setGame((prev) =>
            prev ? { ...prev, activeBuzzPlayerId: null } : prev
          );
        }

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
          const p = playersRef.current[pid];
          if (p) {
            const pName = localizeText(lang, p.fullName, p.fullNameAr);
            flashLowerThird({
              id: message.id,
              tone: delta > 0 ? 'positive' : 'negative',
              delta,
              title: pName,
              detail: payload.isUndo
                ? lang === 'ar'
                  ? 'تراجع عن النقاط'
                  : 'Score reverted'
                : payload.isEdit
                  ? lang === 'ar'
                    ? 'تعديل النقاط'
                    : 'Score adjusted'
                  : lang === 'ar'
                    ? 'تحديث النقاط المباشر'
                    : 'Points awarded',
            });
          }
        }

        if (message.event === 'segment.changed' && payload.isTieBreaker) {
          flashLowerThird({
            id: message.id,
            tone: 'gold',
            title:
              lang === 'ar'
                ? 'تم تفعيل جولة الحسم الفاصلة!'
                : 'SUDDEN-DEATH TIE-BREAKER ACTIVATED!',
            detail:
              lang === 'ar'
                ? 'تحدي ٣٠ ثانية لكسر التعادل'
                : '30-second decisive tie-breaker',
          });
        }
      }

      // Reload canonical state from repositories
      if (
        !msgGameId ||
        msgGameId === gameId ||
        message.event === 'data.reset' ||
        message.event === 'settings.updated' ||
        message.event === 'bracket.updated' ||
        message.event === 'player.updated'
      ) {
        void loadScreenState();
      }
    });

    return unsub;
  }, [gameId, lang, loadScreenState, flashLowerThird]);

  // Frame-accurate countdown ticker when running
  useEffect(() => {
    if (game?.timer?.status !== 'running' || !game.timer.endsAt) return;
    const endsAtMs = new Date(game.timer.endsAt).getTime();

    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
      setDisplayRemainingSec(left);
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [game?.timer?.status, game?.timer?.endsAt]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;

  // Ordered players: in Final mode, position Marwan Serry dead-center flanked by the 2 finalists
  const displayPlayers = useMemo(() => {
    if (!game) return [];
    const list = game.playerIds
      .map((pid) => playersMap[pid])
      .filter((p): p is Player => Boolean(p));

    if (game.isFinal && list.length === 3) {
      const host = list.find((p) => p.isHost);
      const challengers = list.filter((p) => !p.isHost);
      if (host && challengers.length === 2) {
        return [challengers[0], host, challengers[1]];
      }
    }
    return list;
  }, [game, playersMap]);

  // Tie-aware live ranks (1, 2, 3)
  const rankByPlayerId = useMemo(() => {
    if (!game) return {};
    const scored = game.playerIds.map((pid) => ({
      pid,
      score: totals[pid] ?? 0,
    }));
    scored.sort((a, b) => b.score - a.score);
    const map: Record<string, number> = {};
    scored.forEach((item, idx) => {
      if (idx > 0 && item.score === scored[idx - 1].score) {
        map[item.pid] = map[scored[idx - 1].pid];
      } else {
        map[item.pid] = idx + 1;
      }
    });
    return map;
  }, [game, totals]);

  // Sorted podium for finished celebration view
  const finalStandings = useMemo(() => {
    if (!game) return [];
    return game.playerIds
      .map((pid) => ({
        player: playersMap[pid],
        score: totals[pid] ?? 0,
        rank: rankByPlayerId[pid] ?? 1,
        isWinner: game.winnerPlayerId === pid,
        isAdvancing: game.advancingPlayerIds?.includes(pid) ?? false,
      }))
      .filter((entry) => Boolean(entry.player))
      .sort((a, b) => {
        if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
        return b.score - a.score;
      });
  }, [game, playersMap, totals, rankByPlayerId]);

  const currentSegmentId = game
    ? game.segmentIds[game.currentSegmentIndex] ?? game.segmentIds[0]
    : undefined;
  const currentSegment = currentSegmentId
    ? segmentsMap[currentSegmentId]
    : undefined;
  const isTieBreakerSegment = currentSegmentId === 'seg-16';
  const timerDuration =
    game?.timer?.durationSec ?? currentSegment?.durationSec ?? 45;
  const timerStatus = game?.timer?.status ?? 'idle';

  const tableLabel = game
    ? localizeText(lang, game.tableName, game.tableNameAr)
    : '';
  const roundLabel = round
    ? lang === 'ar'
      ? round.name.ar
      : round.name.en
    : game?.isDemo
      ? lang === 'ar'
        ? 'عرض تفاعلي مباشر'
        : 'Interactive Pitch Exhibition'
      : '';

  // Loading state
  if (loading) {
    return (
      <BroadcastFrame cursorHidden={presenter.cursorHidden}>
        <div className="flex flex-1 flex-col justify-between gap-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-12 w-72 rounded-pill bg-red-800/70" />
            <Skeleton className="h-12 w-36 rounded-pill bg-red-800/70" />
          </div>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="w-full space-y-3">
              <Skeleton className="h-16 w-4/5 rounded-card bg-red-800/70" />
              <Skeleton className="h-12 w-3/5 rounded-card bg-red-800/60" />
            </div>
            <Skeleton className="h-44 w-44 rounded-pill bg-red-800/70 shrink-0" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
            {[0, 1, 2].map((idx) => (
              <Skeleton
                key={idx}
                className="min-h-[220px] rounded-card bg-red-800/70"
              />
            ))}
          </div>
        </div>
      </BroadcastFrame>
    );
  }

  // Missing / invalid gameId fallback
  if (!game) {
    const fallbackLive = allGames.find((g) => g.status === 'live' && !g.isDemo);
    return (
      <BroadcastFrame cursorHidden={presenter.cursorHidden}>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-card border-[3px] border-outline bg-white p-6 sm:p-8 text-ink shadow-sticker-lg">
            <EmptyState
              title={
                lang === 'ar'
                  ? `لم يتم العثور على طاولة العرض (${gameId})`
                  : `Broadcast Table Not Found (${gameId})`
              }
              description={
                lang === 'ar'
                  ? 'قد تكون هذه الجلسة محذوفة أو غير مهيأة بعد. يمكنك الانتقال مباشرة إلى الطاولة المباشرة أو لوحة الصدارة العملاقة.'
                  : 'This match session does not exist or has not been seeded. Jump directly to the active live table or the tournament leaderboard.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={`/screen/${fallbackLive?.id ?? 'game-11'}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-button border-[2.5px] border-outline bg-gold-gradient px-5 py-2.5 text-sm font-extrabold text-red-900 shadow-sticker sticker-press"
                  >
                    <Radio className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'فتح الطاولة المباشرة' : 'Open Live Table'}
                    </span>
                  </Link>
                  <Link
                    href="/screen/leaderboard"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-button border-[2.5px] border-outline bg-white px-5 py-2.5 text-sm font-extrabold text-red-900 shadow-sticker sticker-press"
                  >
                    <Trophy className="h-4 w-4 text-red-600" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'لوحة الصدارة' : 'Live Leaderboard'}
                    </span>
                  </Link>
                </div>
              }
            />
          </div>
        </div>
        <PresenterControlPill
          activeView="game"
          activeGameId={gameId}
          games={allGames}
          isPresenterMode={presenter.isPresenterMode}
          controlsVisible={presenter.controlsVisible}
          onTogglePresenterMode={() => void presenter.togglePresenterMode()}
          connectionStatus={connectionStatus}
        />
      </BroadcastFrame>
    );
  }

  const isScheduled = game.status === 'scheduled';
  const isFinished = game.status === 'finished';

  return (
    <BroadcastFrame
      isFinal={game.isFinal}
      cursorHidden={presenter.cursorHidden}
      showLanterns
    >
      {/* TOP BROADCAST RAIL */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-0 sm:[@media(min-height:560px)]:px-14 xl:px-20">
        {/* Start: Brand & Round/Table Badge */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-pill border-[2.5px] border-outline bg-red-900 px-3 py-1 sm:px-3.5 sm:py-1.5 shadow-sticker-sm">
            <PlayingDice
              value={6}
              size="sm"
              tilt={-6}
              float={false}
              className="shrink-0 [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6"
            />
            <span className="font-display text-sm sm:text-base 2xl:text-lg text-white whitespace-nowrap">
              {lang === 'ar' ? 'كازينو الألعاب' : 'Casino El Al3ab'}
            </span>
          </div>

          <div
            className={cn(
              'inline-flex min-w-0 max-w-full items-center gap-2 rounded-pill border-[2.5px] border-outline px-3 py-1 sm:px-3.5 sm:py-1.5 shadow-sticker-sm',
              game.isFinal
                ? 'bg-gold-gradient text-red-900'
                : 'bg-white text-red-900'
            )}
          >
            {game.isFinal && (
              <Crown className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate text-xs sm:text-sm 2xl:text-base font-extrabold">
              {roundLabel || tableLabel}
            </span>
          </div>

          {roundLabel && tableLabel && !game.isFinal && (
            <span className="hidden xl:inline-flex items-center rounded-pill border-2 border-white/30 bg-red-900/80 px-3.5 py-1.5 text-sm font-bold text-white">
              {tableLabel}
            </span>
          )}
        </div>

        {/* End: Live / Final / Tie-Breaker Status & Segment Counter */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
          {game.isDemo && (
            <span className="inline-flex items-center rounded-pill border-2 border-outline bg-blue-600 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase text-white shadow-sticker-sm ring-2 ring-white">
              {lang === 'ar' ? 'جلسة عرض تجريبية' : 'PITCH DEMO'}
            </span>
          )}

          {isTieBreakerSegment && game.status === 'live' && (
            <span className="inline-flex items-center gap-1.5 rounded-pill border-[2.5px] border-outline bg-gold-gradient px-3.5 py-1 text-xs sm:text-sm 2xl:text-base font-black uppercase text-red-900 shadow-glow-gold animate-pulse">
              <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'ar' ? 'جولة الحسم الفاصلة!' : 'SUDDEN-DEATH TIE-BREAKER!'}
              </span>
            </span>
          )}

          {game.status === 'live' ? (
            <LiveBadge size="lg" surface="stage" />
          ) : isScheduled ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-blue-600 px-3.5 py-1 text-xs sm:text-sm font-extrabold uppercase text-white shadow-sticker-sm ring-2 ring-white">
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'قريباً على المسرح' : 'COMING UP NEXT'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-pill border-[2.5px] border-outline bg-gold-gradient px-3.5 py-1 text-xs sm:text-sm font-black uppercase text-red-900 shadow-sticker-sm">
              <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'النتيجة النهائية' : 'FINAL RESULT'}</span>
            </span>
          )}

          {!isScheduled && (
            <span className="inline-flex items-center gap-1.5 rounded-pill border-[2.5px] border-outline bg-red-900 px-3 sm:px-3.5 py-1 sm:py-1.5 font-score text-sm sm:text-lg 2xl:text-xl font-black ltr:tracking-wider rtl:tracking-normal text-gold-300 shadow-sticker-sm tabular-nums">
              <span>
                {lang === 'ar' ? 'فقرة' : 'SEG'}{' '}
                {formatNumber(game.currentSegmentIndex + 1, {
                  useArabicIndicDigits: useArabicIndic,
                })}
                /
                {formatNumber(game.segmentIds.length, {
                  useArabicIndicDigits: useArabicIndic,
                })}
              </span>
            </span>
          )}
        </div>
      </header>

      {/* MAIN BROADCAST BODY — SWITCHES BY GAME LIFECYCLE STATE */}
      <AnimatePresence mode="wait">
        {/* STATE 1: SCHEDULED — DRAMATIC "COMING UP NEXT / VS LINEUP" SLATE */}
        {isScheduled && (
          <motion.section
            key="scheduled-slate"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={cn(
              'flex flex-1 min-h-0 flex-col justify-between gap-4 sm:gap-5 pt-3 sm:pt-4 transition-[padding] duration-300',
              presenter.controlsVisible ? 'pb-16 lg:pb-14' : 'pb-2'
            )}
          >
            {/* Dual-Language Match Title Hero */}
            <div className="mx-auto max-w-5xl text-center space-y-1.5 sm:space-y-2.5">
              <h1 className="font-display text-gold-sticker-lg text-[length:var(--screen-hero)] leading-[1.08] rtl:leading-[1.22] text-balance">
                {game.isFinal
                  ? lang === 'ar'
                    ? 'النهائي الكبير ضد مروان سري'
                    : 'THE GRAND FINAL vs. MARWAN SERRY'
                  : tableLabel}
              </h1>
              <p
                className={cn(
                  'text-white-sticker text-[length:var(--screen-subtitle)] leading-snug text-balance',
                  lang === 'ar' ? 'font-display' : 'font-ar-display'
                )}
              >
                <span dir={lang === 'ar' ? 'ltr' : 'rtl'} className="inline-block">
                  {game.isFinal
                    ? lang === 'ar'
                      ? 'THE GRAND FINAL vs. MARWAN SERRY'
                      : 'النهائي الكبير ضد مروان سري'
                    : lang === 'ar'
                      ? game.tableName
                      : game.tableNameAr || game.tableName}
                </span>
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <span className="inline-flex items-center gap-2 rounded-pill border-2 border-outline bg-white px-4 py-1.5 text-sm sm:text-base font-extrabold text-red-900 shadow-sticker-sm">
                  <CalendarClock
                    className="h-4 w-4 text-red-600 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {formatScheduledLabel(
                      game.scheduledAt,
                      lang,
                      useArabicIndic
                    )}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-pill border-2 border-white/30 bg-red-900/90 px-4 py-1.5 text-sm sm:text-base font-bold text-white">
                  <span>
                    {formatNumber(game.segmentIds.length, {
                      useArabicIndicDigits: useArabicIndic,
                    })}{' '}
                    {lang === 'ar' ? 'فقرات تنافسية' : 'Live Segments'}
                  </span>
                </span>
              </div>
            </div>

            {/* 3-Seat VS Showdown Lineup (Tablet Portrait: 2-col hybrid with Golden Seat spanning top; Desktop: 3-up) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 xl:gap-7 flex-1 min-h-0 items-center max-w-[1680px] w-full mx-auto">
              {displayPlayers.map((player, idx) => {
                const isHost = Boolean(player.isHost);
                const pName = localizeText(lang, player.fullName, player.fullNameAr);
                const pNick = localizeText(lang, player.nickname, player.nicknameAr);
                const spanFullOnTablet = game.isFinal ? isHost : idx === 0;
                return (
                  <div
                    key={player.id}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-card border-[3px] border-outline p-5 sm:p-6 xl:p-8 text-center transition-transform',
                      spanFullOnTablet && 'md:col-span-2 lg:col-span-1 md:order-first lg:order-none',
                      isHost
                        ? 'bg-gradient-to-b from-gold-200 via-paper to-white ring-[4px] ring-gold-300 shadow-glow-gold lg:-translate-y-2'
                        : 'bg-white shadow-sticker-lg'
                    )}
                  >
                    {isHost && (
                      <div className="mb-3 w-full">
                        <MarqueeBulbs variant="strip" bulbCount={8} tone="gold" chase />
                      </div>
                    )}

                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border-2 border-outline px-3.5 py-1 text-xs sm:text-sm font-black uppercase shadow-sticker-sm mb-3',
                        isHost
                          ? 'bg-gold-gradient text-red-900'
                          : 'bg-blue-600 text-white ring-2 ring-white'
                      )}
                    >
                      {isHost && <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span>
                        {isHost
                          ? lang === 'ar'
                            ? 'المقعد الذهبي · المضيف'
                            : 'GOLDEN SEAT · HOST'
                          : game.isFinal
                            ? lang === 'ar'
                              ? `المتأهل #${formatNumber(idx === 0 ? 1 : 2, { useArabicIndicDigits: useArabicIndic })}`
                              : `FINALIST #${idx === 0 ? 1 : 2}`
                            : lang === 'ar'
                              ? `المتسابق #${formatNumber(idx + 1, { useArabicIndicDigits: useArabicIndic })}`
                              : `SEAT #${idx + 1}`}
                      </span>
                    </span>

                    <PlayerAvatar
                      name={pName}
                      avatarSeed={player.avatarSeed}
                      size="xl"
                      isHost={isHost}
                      className="h-[clamp(4.5rem,min(7vw,12dvh),8rem)] w-[clamp(4.5rem,min(7vw,12dvh),8rem)]"
                    />

                    <h2 className="mt-4 font-display text-[length:var(--screen-player)] text-red-900 leading-tight">
                      {pName}
                    </h2>
                    {pNick && (
                      <p className="mt-1 text-[length:var(--screen-nick)] font-semibold text-ink-muted">
                        “{pNick}”
                      </p>
                    )}

                    {/* VS Casino Chip connector between seats on desktop */}
                    {idx < 2 && (
                      <div
                        aria-hidden="true"
                        className="hidden lg:flex absolute top-1/2 -end-5 xl:-end-6 z-20 -translate-y-1/2"
                      >
                        <ScoreChip value="VS" tone="gold" size="md" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Auto-Live Status Footer */}
            <div className="mx-auto flex items-center justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-pill border-2 border-white/30 bg-red-900/90 px-5 py-2 text-sm sm:text-base font-bold text-white shadow-sticker-sm">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-pill bg-gold-300 animate-pulse"
                />
                <span>
                  {lang === 'ar'
                    ? 'بانتظار بدء الجلسة من لوحة الحكم — ستتحول الشاشة للبث المباشر تلقائياً'
                    : 'Waiting for scorer to start live session — switches on air automatically'}
                </span>
              </div>
            </div>
          </motion.section>
        )}

        {/* STATE 2: FINISHED — VICTORY STAGE CELEBRATION TAKEOVER */}
        {isFinished && (
          <motion.section
            key="victory-stage"
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.96, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className={cn(
              'flex flex-1 min-h-0 flex-col justify-between gap-3.5 sm:gap-5 pt-2 sm:pt-4 transition-[padding] duration-300',
              presenter.controlsVisible ? 'pb-16 lg:pb-14' : 'pb-2'
            )}
          >
            {/* Victory Headline */}
            <div className="mx-auto max-w-5xl text-center">
              <motion.h1
                initial={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, scale: 0.9 }
                }
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="font-display text-gold-sticker-lg text-[length:var(--screen-hero)] leading-[1.06] rtl:leading-[1.22] text-balance"
              >
                {game.isFinal
                  ? lang === 'ar'
                    ? 'بطل كازينو الألعاب!'
                    : 'TOURNAMENT CHAMPION!'
                  : round?.advancePerGame === 2
                    ? lang === 'ar'
                      ? 'المتأهلان إلى النهائي الكبير!'
                      : 'FINALISTS QUALIFIED!'
                    : lang === 'ar'
                      ? 'الفائز بالطاولة!'
                      : 'TABLE WINNER!'}
              </motion.h1>
              <p
                className={cn(
                  'mt-1 text-white-sticker text-[length:var(--screen-subtitle)] text-balance',
                  lang === 'ar' ? 'font-display' : 'font-ar-display'
                )}
              >
                <span dir={lang === 'ar' ? 'ltr' : 'rtl'} className="inline-block">
                  {game.isFinal
                    ? lang === 'ar'
                      ? 'TOURNAMENT CHAMPION!'
                      : 'بطل كازينو الألعاب!'
                    : round?.advancePerGame === 2
                      ? lang === 'ar'
                        ? 'TOP 2 ADVANCE TO THE GRAND FINAL'
                        : 'تأهل الأول والثاني لمواجهة مروان سري'
                      : lang === 'ar'
                        ? 'OFFICIAL FINAL STANDINGS'
                        : 'النتيجة الرسمية المعتمدة'}
                </span>
              </p>
            </div>

            {/* Champion Hero Card with Baseline Celebration Motion */}
            {finalStandings[0] && (
              <motion.div
                initial={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 24, scale: 0.92 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : 0.1,
                  type: 'spring',
                  stiffness: 240,
                  damping: 22,
                }}
                className="relative mx-auto w-full max-w-4xl"
              >
                {/* Pulsing Golden Victory Halo */}
                {!prefersReducedMotion && (
                  <motion.div
                    aria-hidden="true"
                    animate={{
                      opacity: [0.45, 0.85, 0.45],
                      scale: [0.98, 1.03, 0.98],
                    }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="pointer-events-none absolute -inset-4 rounded-[34px] bg-gold-300/35 blur-2xl"
                  />
                )}

                <MarqueeBulbs variant="perimeter" bulbCount={16} tone="gold" chase>
                  <div className="relative flex flex-col sm:flex-row items-center justify-between gap-5 rounded-card border-[3px] border-outline bg-gradient-to-b from-gold-200 via-paper to-white p-5 sm:p-7 xl:p-8 text-ink shadow-glow-gold">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-start min-w-0">
                      <div className="relative shrink-0">
                        <PlayerAvatar
                          name={localizeText(
                            lang,
                            finalStandings[0].player.fullName,
                            finalStandings[0].player.fullNameAr
                          )}
                          avatarSeed={finalStandings[0].player.avatarSeed}
                          size="xl"
                          isHost={Boolean(finalStandings[0].player.isHost)}
                          buzzed
                          className="h-20 w-20 sm:h-24 sm:w-24 xl:h-28 xl:w-28"
                        />
                        <motion.span
                          aria-hidden="true"
                          animate={
                            prefersReducedMotion
                              ? undefined
                              : { rotate: [-6, 6, -6], scale: [1, 1.08, 1] }
                          }
                          transition={{
                            duration: 2.4,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="absolute -top-3 -end-2 inline-flex h-10 w-10 items-center justify-center rounded-pill border-2 border-outline bg-gold-gradient text-red-900 shadow-sticker-sm"
                        >
                          <Crown className="h-5 w-5" />
                        </motion.span>
                      </div>

                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-gold-gradient px-3.5 py-1 text-xs sm:text-sm font-black uppercase text-red-900 shadow-sticker-sm">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {game.isFinal
                              ? finalStandings[0].player.isHost
                                ? lang === 'ar'
                                  ? 'مروان سري يحسم اللقب!'
                                  : 'MARWAN SERRY DEFENDS THE SEAT!'
                                : lang === 'ar'
                                  ? 'بطل النهائي الكبير'
                                  : 'GRAND FINAL CHAMPION'
                              : lang === 'ar'
                                ? 'المركز الأول · متأهل'
                                : '1ST PLACE · ADVANCING'}
                          </span>
                        </div>

                        <h2 className="mt-2 truncate font-display text-[length:var(--screen-lb-title)] text-red-900 leading-tight">
                          {localizeText(
                            lang,
                            finalStandings[0].player.fullName,
                            finalStandings[0].player.fullNameAr
                          )}
                        </h2>
                        <p className="text-[length:var(--screen-nick)] font-bold text-ink-muted">
                          “
                          {localizeText(
                            lang,
                            finalStandings[0].player.nickname,
                            finalStandings[0].player.nicknameAr
                          )}
                          ”
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center sm:items-end shrink-0 border-t-2 sm:border-t-0 sm:border-s-2 border-border-paper pt-3 sm:pt-0 sm:ps-6">
                      <AnimatedNumber
                        value={finalStandings[0].score}
                        useArabicIndicDigits={useArabicIndic}
                        className="font-score text-gold-sticker-lg text-[length:var(--screen-score-hero)] font-black leading-none"
                      />
                      <span className="mt-1 text-[length:var(--screen-label)] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                        {lang === 'ar' ? 'إجمالي النقاط' : 'FINAL POINTS'}
                      </span>
                    </div>
                  </div>
                </MarqueeBulbs>
              </motion.div>
            )}

            {/* Runners-Up Final Tally Row */}
            <div className="mx-auto grid w-full max-w-4xl grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
              {finalStandings.slice(1).map((entry) => {
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
                    initial={
                      prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.22, duration: 0.35 }}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-card border-[2.5px] border-outline p-4 sm:p-5 text-ink shadow-sticker',
                      entry.isAdvancing
                        ? 'bg-gradient-to-b from-positive-soft via-white to-white ring-[3px] ring-positive'
                        : 'bg-white'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ScoreChip
                        value={`#${formatNumber(entry.rank, { useArabicIndicDigits: useArabicIndic })}`}
                        tone={entry.rank === 2 ? 'red' : 'blue'}
                        size="sm"
                      />
                      <PlayerAvatar
                        name={pName}
                        avatarSeed={entry.player.avatarSeed}
                        size="md"
                        isHost={Boolean(entry.player.isHost)}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-display text-lg sm:text-xl text-red-900">
                            {pName}
                          </span>
                          {entry.isAdvancing && (
                            <span className="rounded-pill border border-outline bg-positive-soft px-2 py-0.5 text-[11px] font-extrabold text-positive-ink">
                              {lang === 'ar' ? 'تأهل للنهائي' : 'ADVANCES'}
                            </span>
                          )}
                        </div>
                        <span className="block truncate text-xs sm:text-sm font-medium text-ink-muted">
                          “{pNick}”
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <AnimatedNumber
                        value={entry.score}
                        useArabicIndicDigits={useArabicIndic}
                        className="font-score text-3xl sm:text-4xl font-black text-red-900 leading-none"
                      />
                      <span className="block text-[11px] font-bold uppercase text-ink-muted">
                        {lang === 'ar' ? 'نقطة' : 'PTS'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* STATE 3: LIVE MATCH ARENA */}
        {!isScheduled && !isFinished && (
          <motion.section
            key="live-arena"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 min-h-0 flex-col justify-between gap-4 sm:gap-5 xl:gap-6 pt-3 sm:pt-4"
          >
            {/* STAGE CENTERPIECE: HUGE DUAL EN/AR SEGMENT TITLE + TIMER RING (Side-by-side on Tablet Portrait, Phone Landscape & Desktop) */}
            <div className="relative z-20 flex flex-col sm:[@media(max-height:520px)]:flex-row md:flex-row items-center justify-between gap-3 sm:gap-5 px-0 md:px-4 xl:px-14">
              {/* Dual-Language Segment Headline + Progress Strip */}
              <div className="min-w-0 flex-1 text-center sm:[@media(max-height:520px)]:text-start md:text-start">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSegment?.id ?? game.currentSegmentIndex}
                    initial={
                      prefersReducedMotion
                        ? { opacity: 1 }
                        : { opacity: 0, y: 12 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: -10 }
                    }
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="space-y-1 sm:space-y-1.5"
                  >
                    {/* Primary Language Huge Gold Sticker Title */}
                    <h1
                      className={cn(
                        'font-display text-gold-sticker-lg leading-[1.08] rtl:leading-[1.22] line-clamp-2 text-balance',
                        'text-[length:var(--screen-hero)] [@media(max-height:520px)]:text-2xl'
                      )}
                    >
                      {lang === 'ar'
                        ? currentSegment?.nameAr ?? tableLabel
                        : currentSegment?.nameEn ?? tableLabel}
                    </h1>

                    {/* Simultaneous Counterpart Language Title (EN + AR cleanly aligned on same start edge) */}
                    {currentSegment && (
                      <p
                        className={cn(
                          'text-white-sticker leading-[1.22] line-clamp-1',
                          lang === 'ar' ? 'font-display' : 'font-ar-display',
                          'text-[length:var(--screen-subtitle)] [@media(max-height:520px)]:text-lg'
                        )}
                      >
                        <span dir={lang === 'ar' ? 'ltr' : 'rtl'} className="inline-block">
                          {lang === 'ar'
                            ? currentSegment.nameEn
                            : currentSegment.nameAr}
                        </span>
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Segment Progress Stepper Pills */}
                <div
                  className="mt-2.5 sm:mt-3.5 [@media(max-height:520px)]:mt-1.5 flex flex-wrap items-center justify-center sm:[@media(max-height:520px)]:justify-start md:justify-start gap-1.5 sm:gap-2"
                  aria-label={
                    lang === 'ar'
                      ? `تقدم الفقرات: ${game.currentSegmentIndex + 1} من ${game.segmentIds.length}`
                      : `Segment progress: ${game.currentSegmentIndex + 1} of ${game.segmentIds.length}`
                  }
                >
                  {game.segmentIds.map((segId, idx) => {
                    const isCurrent = idx === game.currentSegmentIndex;
                    const isDone = idx < game.currentSegmentIndex;
                    const isTb = segId === 'seg-16';
                    return (
                      <span
                        key={`${segId}-${idx}`}
                        className={cn(
                          'h-2.5 sm:h-3 rounded-pill border-2 border-outline transition-all duration-300',
                          isCurrent
                            ? 'w-10 sm:w-14 bg-gold-gradient shadow-glow-gold'
                            : isDone
                              ? 'w-5 sm:w-7 bg-white'
                              : isTb
                                ? 'w-6 sm:w-8 bg-gold-300'
                                : 'w-4 sm:w-6 bg-red-900/75'
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Giant Broadcast Timer Ring (dual-axis vw/dvh scaled) */}
              <div className="shrink-0">
                <TimerRing
                  durationSec={timerDuration}
                  remainingSec={displayRemainingSec}
                  status={timerStatus}
                  size="xl"
                  surface="stage"
                  useArabicIndicDigits={useArabicIndic}
                  className="[&>div:first-child]:w-[clamp(108px,min(13.5vw,21dvh),248px)] [@media(max-height:520px)]:[&>div:first-child]:w-[86px]"
                />
              </div>
            </div>

            {/* LOWER ARENA: 3 CONTEXT-ADAPTED BROADCAST PLAYER PANELS
                - Phone Portrait: 1-col stack
                - Phone Landscape (<520px height): compact 3-up strip
                - Tablet Portrait (md): 2-col hybrid (featured/buzzed/Golden Seat spans full top width)
                - Desktop/TV (lg+): 3 equal columns */}
            <div
              className={cn(
                'relative z-20 grid grid-cols-1 sm:[@media(max-height:520px)]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 xl:gap-7 flex-1 min-h-0 items-stretch transition-[padding] duration-300',
                presenter.controlsVisible
                  ? 'pb-20 sm:pb-16 lg:pb-14 [@media(max-height:520px)]:pb-12'
                  : 'pb-1'
              )}
            >
              {displayPlayers.map((player, idx) => {
                const isBuzzed = game.activeBuzzPlayerId === player.id;
                const hasOtherBuzz = Boolean(
                  game.activeBuzzPlayerId &&
                    game.activeBuzzPlayerId !== player.id
                );
                const featuredOnTablet = game.isFinal
                  ? Boolean(player.isHost)
                  : game.activeBuzzPlayerId
                    ? isBuzzed
                    : idx === 0;

                return (
                  <BroadcastPlayerCard
                    key={player.id}
                    playerId={player.id}
                    name={localizeText(lang, player.fullName, player.fullNameAr)}
                    nickname={localizeText(
                      lang,
                      player.nickname,
                      player.nicknameAr
                    )}
                    avatarSeed={player.avatarSeed}
                    score={totals[player.id] ?? 0}
                    rank={rankByPlayerId[player.id] ?? 1}
                    isBuzzed={isBuzzed}
                    isDimmedByPeerBuzz={hasOtherBuzz}
                    isHost={Boolean(player.isHost)}
                    isFinal={game.isFinal}
                    deltaEvent={deltaByPlayer[player.id] ?? null}
                    useArabicIndicDigits={useArabicIndic}
                    className={cn(
                      featuredOnTablet &&
                        'md:col-span-2 lg:col-span-1 md:order-first lg:order-none'
                    )}
                  />
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* BONUS IDEA: BROADCAST LOWER-THIRD LIVE EVENT RIBBON */}
      <div className="pointer-events-none fixed bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] lg:bottom-[max(1.25rem,env(safe-area-inset-bottom))] inset-x-4 z-40 flex justify-center">
        <AnimatePresence>
          {lowerThird && (
            <motion.div
              key={lowerThird.id}
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 20, scale: 0.94 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14, scale: 0.96 }
              }
              transition={{ duration: 0.25, ease: 'easeOut' }}
              role="status"
              aria-live="polite"
              className={cn(
                'inline-flex max-w-full items-center gap-3 rounded-pill border-[3px] border-outline px-5 py-2.5 shadow-sticker-lg',
                lowerThird.tone === 'positive'
                  ? 'bg-positive-soft text-positive-ink'
                  : lowerThird.tone === 'negative'
                    ? 'bg-negative text-white'
                    : 'bg-gold-gradient text-red-900'
              )}
            >
              {typeof lowerThird.delta === 'number' ? (
                <span className="inline-flex items-center gap-0.5 font-score text-2xl sm:text-3xl font-black tabular-nums leading-none">
                  {lowerThird.delta > 0 ? (
                    <Plus className="h-5 w-5 stroke-[3.2]" aria-hidden="true" />
                  ) : (
                    <Minus className="h-5 w-5 stroke-[3.2]" aria-hidden="true" />
                  )}
                  <span>
                    {formatNumber(Math.abs(lowerThird.delta), {
                      useArabicIndicDigits: useArabicIndic,
                    })}
                  </span>
                </span>
              ) : (
                <Zap className="h-5 w-5 fill-current shrink-0" aria-hidden="true" />
              )}

              <span className="truncate font-display text-base sm:text-xl leading-none">
                {lowerThird.title}
              </span>

              {lowerThird.detail && (
                <span
                  className={cn(
                    'hidden sm:inline truncate text-sm font-bold',
                    lowerThird.tone === 'negative'
                      ? 'text-white/90'
                      : 'text-red-900/80'
                  )}
                >
                  · {lowerThird.detail}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AUTO-HIDING PRESENTER CONTROL PILL */}
      <PresenterControlPill
        activeView="game"
        activeGameId={gameId}
        games={allGames}
        isPresenterMode={presenter.isPresenterMode}
        controlsVisible={presenter.controlsVisible}
        onTogglePresenterMode={() => void presenter.togglePresenterMode()}
        connectionStatus={connectionStatus}
      />
    </BroadcastFrame>
  );
}
