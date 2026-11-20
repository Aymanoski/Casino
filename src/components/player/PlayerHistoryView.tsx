'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  Calendar,
  ChevronDown,
  Clock,
  Crown,
  Minus,
  MonitorPlay,
  Plus,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Game,
  GameStatus,
  Player,
  Round,
  ScoreEvent,
  Segment,
  Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { ScoreChip } from '@/components/brand/ScoreChip';
import {
  computeGameTotalsFromEvents,
  formatPublicFullDateTime,
  formatPublicTimeOnly,
  resolvePlayerDisplay,
  SEGMENT_CATEGORY_INFO,
} from '@/components/public/publicFormatters';
import { PublicErrorBanner } from '@/components/public/PublicErrorBanner';
import { PlayerPortalChrome } from './PlayerPortalChrome';

interface HistoryDataset {
  players: Player[];
  games: Game[];
  rounds: Round[];
  segments: Segment[];
  scoreEvents: ScoreEvent[];
  settings: Settings;
}

type StatusFilter = 'all' | GameStatus;

const HISTORY_PAGE_STEP = 15;

export function PlayerHistoryView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const searchParams = useSearchParams();

  const [data, setData] = useState<HistoryDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPlayerId, setPreviewPlayerId] = useState<string>('player-1');
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [visibleLimit, setVisibleLimit] = useState<number>(HISTORY_PAGE_STEP);
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});

  const loadSeqRef = useRef(0);
  const initializedQueryRef = useRef(false);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [players, games, rounds, segments, scoreEvents, settings] =
          await Promise.all([
            playerRepo.list({ includeHost: true }),
            gameRepo.list(),
            roundRepo.list(),
            segmentRepo.list(),
            scoreRepo.list({ order: 'oldest' }),
            settingsRepo.get(),
          ]);

        if (seq !== loadSeqRef.current) return;
        setData({ players, games, rounds, segments, scoreEvents, settings });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل سجل المباريات.'
              : 'Failed to load player match history.'
        );
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void loadAll(true);
    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)?.gameId;
      if (payloadGameId === 'game-demo') return;
      if (
        msg.event === 'score.changed' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'player.updated' ||
        msg.event === 'segment.updated' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadAll(false);
      }
    });
    return () => unsub();
  }, [loadAll]);

  useEffect(() => {
    if (!data || initializedQueryRef.current) return;
    if (user?.role === 'superAdmin') {
      const qPlayer = searchParams.get('player');
      if (qPlayer && data.players.some((p) => p.id === qPlayer && !p.isHost)) {
        setPreviewPlayerId(qPlayer);
      } else {
        const firstReal = data.players.find((p) => !p.isHost);
        if (firstReal) setPreviewPlayerId(firstReal.id);
      }
    }
    initializedQueryRef.current = true;
  }, [data, user, searchParams]);

  const handleSelectPreviewPlayer = useCallback((nextId: string) => {
    setPreviewPlayerId(nextId);
    setExpandedGames({});
    setVisibleLimit(HISTORY_PAGE_STEP);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('player', nextId);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    setVisibleLimit(HISTORY_PAGE_STEP);
  }, [roundFilter, statusFilter, sortOrder]);

  const activePlayerId = useMemo(() => {
    if (user?.role === 'player' && user.playerId) {
      return user.playerId;
    }
    return previewPlayerId;
  }, [user, previewPlayerId]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const model = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));
    const segmentMap = new Map(data.segments.map((s) => [s.id, s]));
    const player = playerMap.get(activePlayerId) ?? null;

    if (!player) return { player: null };

    const allMyGames = data.games.filter((g) => g.playerIds.includes(player.id));
    const myEvents = data.scoreEvents.filter((e) => e.playerId === player.id);

    const positiveHits = myEvents.filter((e) => e.delta > 0 && e.kind !== 'undo').length;
    const penaltyHits = myEvents.filter((e) => e.delta < 0 && e.kind !== 'undo').length;

    const filteredGames = allMyGames
      .filter((g) => {
        if (roundFilter !== 'all' && g.roundId !== roundFilter) return false;
        if (statusFilter !== 'all' && g.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.finishedAt ?? a.startedAt ?? a.scheduledAt).getTime();
        const tb = new Date(b.finishedAt ?? b.startedAt ?? b.scheduledAt).getTime();
        return sortOrder === 'newest' ? tb - ta : ta - tb;
      });

    // Build rich segment-by-segment structure for each match
    const enrichedGames = filteredGames.map((game) => {
      const round = roundMap.get(game.roundId) ?? null;
      const totals = computeGameTotalsFromEvents(
        game.id,
        game.playerIds,
        data.scoreEvents
      );
      const myScore = totals[player.id] ?? 0;

      // Compute placement within this 3-player table
      const tableStandings = game.playerIds
        .map((pid, idx) => ({
          ...resolvePlayerDisplay(pid, playerMap, lang, idx),
          score: totals[pid] ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      const myRank =
        tableStandings.findIndex((s) => s.id === player.id) + 1;

      const gameMyEvents = myEvents.filter((e) => e.gameId === game.id);

      let runningTotal = 0;
      const segmentBreakdown = game.segmentIds.map((segId, idx) => {
        const seg = segmentMap.get(segId) ?? null;
        const segEvents = gameMyEvents.filter((e) => e.segmentId === segId);
        const segSubtotal = segEvents.reduce((sum, e) => sum + e.delta, 0);
        runningTotal += segSubtotal;
        return {
          index: idx,
          segId,
          segment: seg,
          events: segEvents,
          subtotal: segSubtotal,
          cumulative: runningTotal,
          isCurrent:
            game.status === 'live' && game.currentSegmentIndex === idx,
        };
      });

      const isWon =
        game.status === 'finished' &&
        (game.winnerPlayerId === player.id ||
          Boolean(game.advancingPlayerIds?.includes(player.id)));

      return {
        game,
        round,
        myScore,
        myRank,
        isWon,
        tableStandings,
        segmentBreakdown,
        totalPlays: gameMyEvents.length,
        referenceTime: game.finishedAt ?? game.startedAt ?? game.scheduledAt,
      };
    });

    return {
      player,
      allMyGamesCount: allMyGames.length,
      positiveHits,
      penaltyHits,
      enrichedGames,
    };
  }, [data, activePlayerId, roundFilter, statusFilter, sortOrder, lang]);

  // Expand the most recent LIVE or FINISHED played match by default (fallback to first scheduled match)
  const defaultExpandedMatchId =
    model?.enrichedGames?.find(
      (item) => item.game.status === 'live' || item.game.status === 'finished'
    )?.game.id ??
    model?.enrichedGames?.[0]?.game.id ??
    null;

  const isGameExpanded = (gameId: string) => {
    if (gameId in expandedGames) return expandedGames[gameId];
    return gameId === defaultExpandedMatchId;
  };

  const toggleGame = (gameId: string) => {
    setExpandedGames((prev) => ({
      ...prev,
      [gameId]: !isGameExpanded(gameId),
    }));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-8 space-y-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data || !model) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadAll(true)}
        />
      </div>
    );
  }

  if (!model.player) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-8 space-y-6">
        <PlayerPortalChrome
          players={data.players}
          activePlayerId={activePlayerId}
          onSelectPreviewPlayer={handleSelectPreviewPlayer}
          useArabicIndicDigits={useArabicIndic}
        />
        <EmptyState
          title={
            lang === 'ar'
              ? 'لا يوجد سجل لهذا الحساب'
              : 'No contestant history found'
          }
          description={
            lang === 'ar'
              ? 'اختر متسابقاً لعرض تاريخ مبارياته ونقاط فقراته.'
              : 'Select a contestant account to inspect their match history.'
          }
        />
      </div>
    );
  }

  const { player, allMyGamesCount, positiveHits, penaltyHits, enrichedGames } =
    model;

  return (
    <div className="mx-auto max-w-content-wide px-safe py-6 sm:py-10 space-y-6">
      <PlayerPortalChrome
        players={data.players}
        activePlayerId={player.id}
        onSelectPreviewPlayer={handleSelectPreviewPlayer}
        useArabicIndicDigits={useArabicIndic}
      />

      {/* Header & Career Summary */}
      <div className="rounded-card border-[2.5px] border-outline bg-white p-5 sm:p-6 text-ink shadow-sticker space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <PlayerAvatar
              name={localizeText(lang, player.fullName, player.fullNameAr)}
              avatarSeed={player.avatarSeed}
              size="lg"
            />
            <div className="min-w-0">
              <h1 className="font-display text-fluid-2xl sm:text-fluid-3xl text-red-900 leading-tight break-words">
                {lang === 'ar'
                  ? `سجل مباريات ${localizeText(lang, player.fullName, player.fullNameAr)}`
                  : `${localizeText(lang, player.fullName, player.fullNameAr)} — Match History`}
              </h1>
              <p className="text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'تفصيل كامل لكل مباراة وفقرة مع التوقيت والتاريخ الدقيق لكل نقطة.'
                  : 'Complete game-by-game and segment-by-segment score breakdown with exact dates and timestamps.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ScoreChip
              value={player.stats.totalPoints}
              tone={player.stats.totalPoints < 0 ? 'negative' : 'gold'}
              useArabicIndicDigits={useArabicIndic}
              size="md"
            />
            <div className="text-start">
              <div className="text-[11px] font-extrabold uppercase text-ink-muted">
                {lang === 'ar' ? 'صافي النقاط' : 'Net Points'}
              </div>
              <div className="text-xs font-bold text-ink tabular-nums">
                {formatNumber(player.stats.wins, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'فوز' : 'wins'} ·{' '}
                {formatNumber(player.stats.gamesPlayed, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'مباراة' : 'played'}
              </div>
            </div>
          </div>
        </div>

        {/* Positive / Penalty Quick Breakdown */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border-paper pt-4 text-xs font-bold">
          <Badge variant="positive">
            <Plus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
            <span>
              {formatNumber(positiveHits ?? 0, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'نقاط مكتسبة' : 'Scoring Plays'}
            </span>
          </Badge>
          <Badge variant="negative">
            <Minus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
            <span>
              {formatNumber(penaltyHits ?? 0, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'خصومات' : 'Penalties'}
            </span>
          </Badge>
          <Badge variant="muted">
            <span>
              {formatNumber(allMyGamesCount ?? 0, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'إجمالي الطاولات المسندة' : 'Total Assigned Tables'}
            </span>
          </Badge>
        </div>
      </div>

      {/* Filters & Sort Controls */}
      <div className="flex min-w-0 flex-col gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 w-full flex-wrap items-end gap-3 md:w-auto">
          <div className="w-full min-w-0 space-y-1 sm:w-auto">
            <label
              htmlFor="history-round-filter"
              className="block text-xs font-bold uppercase text-ink-muted"
            >
              {lang === 'ar' ? 'الجولة' : 'Round'}
            </label>
            <select
              id="history-round-filter"
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="min-h-[44px] w-full max-w-full sm:w-auto rounded-input border-2 border-border-paper bg-paper px-3 py-2 text-base font-medium text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">
                {lang === 'ar' ? 'جميع الجولات' : 'All Rounds'}
              </option>
              {data.rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {localizeText(lang, r.name.en, r.name.ar)}
                </option>
              ))}
            </select>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={lang === 'ar' ? 'حالة المباراة' : 'Match status'}
          >
            {(
              [
                { v: 'all', en: 'All', ar: 'الكل' },
                { v: 'live', en: 'Live', ar: 'مباشر' },
                { v: 'finished', en: 'Finished', ar: 'منتهية' },
                { v: 'scheduled', en: 'Scheduled', ar: 'قادمة' },
              ] as Array<{ v: StatusFilter; en: string; ar: string }>
            ).map((opt) => {
              const active = statusFilter === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStatusFilter(opt.v)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-[44px] items-center rounded-pill border-2 px-3.5 py-1.5 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    active
                      ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                      : 'border-border-paper bg-paper text-ink hover:border-outline'
                  )}
                >
                  {lang === 'ar' ? opt.ar : opt.en}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="calm"
          size="sm"
          onClick={() =>
            setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
          }
        >
          <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {sortOrder === 'newest'
              ? lang === 'ar'
                ? 'الأحدث أولاً'
                : 'Newest First'
              : lang === 'ar'
                ? 'الأقدم أولاً'
                : 'Oldest First'}
          </span>
        </Button>
      </div>

      {/* Game History Cards */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-xs sm:text-sm font-bold text-ink-muted"
      >
        {lang === 'ar'
          ? `عرض ${formatNumber(Math.min(visibleLimit, enrichedGames?.length ?? 0), { useArabicIndicDigits: useArabicIndic })} من ${formatNumber(enrichedGames?.length ?? 0, { useArabicIndicDigits: useArabicIndic })} مباراة`
          : `Showing ${formatNumber(Math.min(visibleLimit, enrichedGames?.length ?? 0), { useArabicIndicDigits: useArabicIndic })} of ${formatNumber(enrichedGames?.length ?? 0, { useArabicIndicDigits: useArabicIndic })} matches`}
      </div>

      {!enrichedGames || enrichedGames.length === 0 ? (
        <EmptyState
          title={
            (allMyGamesCount ?? 0) === 0
              ? lang === 'ar'
                ? 'لم تُسجّل مباريات لهذا المتسابق بعد'
                : 'No tournament matches recorded yet'
              : lang === 'ar'
                ? 'لا توجد مباريات مطابقة للفلاتر'
                : 'No matches fit the selected filters'
          }
          description={
            (allMyGamesCount ?? 0) === 0
              ? lang === 'ar'
                ? 'ستظهر هنا كل المباريات ونقاطها فقرة بفقرة فور تعيينك على طاولة في الشجرة.'
                : 'Your games and segment-by-segment score records will appear here once you are seated on a table.'
              : lang === 'ar'
                ? 'جرّب اختيار جميع الجولات والحالات لعرض كامل سجل مبارياتك.'
                : 'Reset the round and status filters to view all of your matches.'
          }
          action={
            (allMyGamesCount ?? 0) > 0 ? (
              <Button
                variant="red"
                onClick={() => {
                  setRoundFilter('all');
                  setStatusFilter('all');
                }}
              >
                {lang === 'ar' ? 'عرض جميع المباريات' : 'Show All Matches'}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {enrichedGames.slice(0, visibleLimit).map(
            ({
              game,
              round,
              myScore,
              myRank,
              isWon,
              tableStandings,
              segmentBreakdown,
              totalPlays,
              referenceTime,
            }) => {
              const expanded = isGameExpanded(game.id);
              const isLive = game.status === 'live';
              const isFinished = game.status === 'finished';

              return (
                <article
                  key={game.id}
                  className={cn(
                    'rounded-card bg-white text-ink overflow-hidden',
                    isLive
                      ? 'border-[2.5px] border-outline ring-2 ring-gold-400 shadow-sticker'
                      : isWon
                        ? 'border-[2.5px] border-outline shadow-sticker-sm'
                        : 'border border-border-paper shadow-soft'
                  )}
                >
                  {/* Expandable Header Button */}
                  <button
                    type="button"
                    onClick={() => toggleGame(game.id)}
                    aria-expanded={expanded}
                    className="flex w-full min-h-[68px] flex-col gap-3 p-4 sm:p-5 text-start transition-colors hover:bg-paper/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-blue-500 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isLive ? (
                          <LiveBadge surface="paper" size="sm" />
                        ) : isWon ? (
                          <Badge variant="gold">
                            <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {lang === 'ar' ? 'فائز ومتأهل' : 'Won & Advanced'}
                            </span>
                          </Badge>
                        ) : isFinished ? (
                          <Badge variant="muted">
                            {lang === 'ar'
                              ? `المركز #${formatNumber(myRank, { useArabicIndicDigits: useArabicIndic })}`
                              : `Finished #${myRank}`}
                          </Badge>
                        ) : (
                          <Badge variant="upcoming">
                            {lang === 'ar' ? 'مباراة قادمة' : 'Scheduled'}
                          </Badge>
                        )}

                        {game.isFinal && (
                          <Badge variant="gold">
                            <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'النهائي' : 'FINAL'}</span>
                          </Badge>
                        )}

                        {round && (
                          <span className="text-xs font-bold text-red-700">
                            {localizeText(lang, round.name.en, round.name.ar)}
                          </span>
                        )}
                      </div>

                      <h2 className="font-display text-xl text-red-900 leading-snug break-words">
                        {localizeText(lang, game.tableName, game.tableNameAr)}
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-ink-muted tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                          <span>
                            {formatPublicFullDateTime(
                              referenceTime,
                              lang,
                              useArabicIndic
                            )}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                          <span>
                            {formatNumber(game.segmentIds.length, {
                              useArabicIndicDigits: useArabicIndic,
                            })}{' '}
                            {lang === 'ar' ? 'فقرات' : 'segments'} ·{' '}
                            {formatNumber(totalPlays, {
                              useArabicIndicDigits: useArabicIndic,
                            })}{' '}
                            {lang === 'ar' ? 'حركات نقاط' : 'score events'}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 md:justify-end shrink-0">
                      <div className="text-start md:text-end">
                        <div className="text-[11px] font-extrabold uppercase text-ink-muted">
                          {lang === 'ar' ? 'نقاطك بالمباراة' : 'Your Match Score'}
                        </div>
                        {game.status === 'scheduled' ? (
                          <span className="font-display text-lg text-ink-muted">—</span>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <AnimatedNumber
                              value={myScore}
                              useArabicIndicDigits={useArabicIndic}
                              className="font-score text-3xl font-black text-red-900"
                            />
                            <span className="text-xs font-bold text-ink-muted">
                              {lang === 'ar' ? 'نقطة' : 'PTS'}
                            </span>
                          </div>
                        )}
                      </div>

                      <span className="flex h-11 w-11 items-center justify-center rounded-pill border border-border-paper bg-paper text-ink">
                        <ChevronDown
                          className={cn(
                            'h-5 w-5 transition-transform duration-200',
                            expanded && 'rotate-180'
                          )}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </button>

                  {/* Expanded Body: Table Standings + Segment-by-Segment Breakdown */}
                  {expanded && (
                    <div className="border-t-2 border-border-paper bg-paper/50 p-4 sm:p-5 space-y-5">
                      {/* 3-Player Table Context Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {tableStandings.map((p, idx) => {
                            const isMe = p.id === player.id;
                            return (
                              <div
                                key={`${p.id}-${idx}`}
                                className={cn(
                                  'inline-flex max-w-full min-w-0 items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-bold',
                                  isMe
                                    ? 'border-blue-600 bg-blue-100 text-blue-800'
                                    : p.isHost
                                      ? 'border-outline bg-gold-gradient text-red-900'
                                      : 'border-border-paper bg-white text-ink'
                                )}
                              >
                                <span className="shrink-0 tabular-nums text-red-700">
                                  #{formatNumber(idx + 1, { useArabicIndicDigits: useArabicIndic })}
                                </span>
                                <span className="truncate">{p.name}</span>
                                {game.status !== 'scheduled' && (
                                  <span className="shrink-0 font-score text-sm font-black tabular-nums">
                                    {formatNumber(p.score, {
                                      useArabicIndicDigits: useArabicIndic,
                                    })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {isLive && (
                          <Button variant="red" size="sm" asChild>
                            <Link href={`/screen/${game.id}`}>
                              <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}</span>
                            </Link>
                          </Button>
                        )}
                      </div>

                      {/* Segment-by-Segment Points Breakdown */}
                      <div className="space-y-2.5">
                        <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                          {lang === 'ar'
                            ? 'تفصيل النقاط فقرة بفقرة (مع الوقت والتاريخ)'
                            : 'Segment-by-Segment Points Log (with Date & Time)'}
                        </h3>

                        <div className="divide-y divide-border-paper rounded-card border border-border-paper bg-white overflow-hidden">
                          {segmentBreakdown.map((segRow) => {
                            const cat = segRow.segment
                              ? SEGMENT_CATEGORY_INFO[segRow.segment.category]
                              : null;

                            return (
                              <div
                                key={`${segRow.segId}-${segRow.index}`}
                                className={cn(
                                  'p-3.5 sm:p-4 space-y-2.5',
                                  segRow.isCurrent && 'bg-gold-200/45'
                                )}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="font-score text-base font-black text-red-700 tabular-nums">
                                      #{formatNumber(segRow.index + 1, {
                                        useArabicIndicDigits: useArabicIndic,
                                      })}
                                    </span>
                                    <span className="font-bold text-sm sm:text-base text-ink">
                                      {segRow.segment
                                        ? localizeText(
                                            lang,
                                            segRow.segment.nameEn,
                                            segRow.segment.nameAr
                                          )
                                        : segRow.segId}
                                    </span>
                                    {cat && (
                                      <Badge
                                        variant={cat.badgeVariant}
                                        className="px-2 py-0.5 text-[10px]"
                                      >
                                        {lang === 'ar' ? cat.labelAr : cat.labelEn}
                                      </Badge>
                                    )}
                                    {segRow.isCurrent && (
                                      <Badge variant="red" className="px-2 py-0.5 text-[10px]">
                                        {lang === 'ar' ? 'الفقرة الحالية' : 'NOW PLAYING'}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span
                                      className={cn(
                                        'inline-flex items-center gap-0.5 rounded-pill border px-2.5 py-0.5 font-score text-sm font-black tabular-nums',
                                        segRow.subtotal > 0
                                          ? 'border-positive bg-positive-soft text-positive-ink'
                                          : segRow.subtotal < 0
                                            ? 'border-outline bg-negative text-white'
                                            : 'border-border-paper bg-paper text-ink-muted'
                                      )}
                                    >
                                      {segRow.subtotal > 0 ? (
                                        <Plus
                                          className="h-3 w-3 stroke-[3]"
                                          aria-hidden="true"
                                        />
                                      ) : segRow.subtotal < 0 ? (
                                        <Minus
                                          className="h-3 w-3 stroke-[3]"
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                      <span>
                                        {formatNumber(Math.abs(segRow.subtotal), {
                                          useArabicIndicDigits: useArabicIndic,
                                        })}
                                      </span>
                                    </span>

                                    {game.status !== 'scheduled' && (
                                      <span className="text-xs font-bold text-ink-muted tabular-nums">
                                        {lang === 'ar' ? 'التراكمي: ' : 'Total: '}
                                        <strong className="text-red-900">
                                          {formatNumber(segRow.cumulative, {
                                            useArabicIndicDigits: useArabicIndic,
                                          })}
                                        </strong>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Individual ScoreEvents in this Segment */}
                                {segRow.events.length === 0 ? (
                                  <p className="text-xs text-ink-faint">
                                    {game.status === 'scheduled'
                                      ? lang === 'ar'
                                        ? 'بانتظار بدء المباراة'
                                        : 'Awaiting game start'
                                      : lang === 'ar'
                                        ? 'لم تُسجّل نقاط لك في هذه الفقرة'
                                        : 'No points recorded in this segment'}
                                  </p>
                                ) : (
                                  <div className="space-y-1.5 ps-3 border-s border-border-paper">
                                    {segRow.events.map((ev) => {
                                      const isPos = ev.delta >= 0;
                                      return (
                                        <div
                                          key={ev.id}
                                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                                        >
                                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <span
                                              className={cn(
                                                'inline-flex items-center gap-0.5 rounded-pill border px-2 py-0.5 font-score text-xs font-black tabular-nums',
                                                isPos
                                                  ? 'border-positive bg-positive-soft text-positive-ink'
                                                  : 'border-outline bg-negative text-white'
                                              )}
                                            >
                                              {isPos ? (
                                                <Plus
                                                  className="h-2.5 w-2.5 stroke-[3]"
                                                  aria-hidden="true"
                                                />
                                              ) : (
                                                <Minus
                                                  className="h-2.5 w-2.5 stroke-[3]"
                                                  aria-hidden="true"
                                                />
                                              )}
                                              <span>
                                                {formatNumber(Math.abs(ev.delta), {
                                                  useArabicIndicDigits:
                                                    useArabicIndic,
                                                })}
                                              </span>
                                            </span>
                                            <span className="rounded-pill bg-paper-2 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-muted">
                                              {ev.kind === 'undo'
                                                ? lang === 'ar'
                                                  ? 'تراجع'
                                                  : 'Undo'
                                                : ev.kind === 'custom'
                                                  ? lang === 'ar'
                                                    ? 'مخصص'
                                                    : 'Custom'
                                                  : lang === 'ar'
                                                    ? 'سريع'
                                                    : 'Preset'}
                                            </span>
                                            {ev.note && (
                                              <span className="min-w-0 break-all sm:break-words text-ink font-medium">
                                                {ev.note}
                                              </span>
                                            )}
                                          </div>

                                          <span className="text-[11px] font-medium text-ink-muted tabular-nums shrink-0">
                                            {formatPublicTimeOnly(
                                              ev.createdAt,
                                              lang,
                                              useArabicIndic
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            }
          )}

          {enrichedGames.length > visibleLimit && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setVisibleLimit((n) => n + HISTORY_PAGE_STEP)}
              >
                <span>
                  {lang === 'ar'
                    ? `عرض المزيد (${formatNumber(enrichedGames.length - visibleLimit, { useArabicIndicDigits: useArabicIndic })} متبقية)`
                    : `Load more matches (${formatNumber(enrichedGames.length - visibleLimit, { useArabicIndicDigits: useArabicIndic })} remaining)`}
                </span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
