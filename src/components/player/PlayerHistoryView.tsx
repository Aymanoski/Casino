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
  Lock,
  Minus,
  MonitorPlay,
  Plus,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  matchRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Match,
  MatchStatus,
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
import {
  CardCounterGroup,
  DisciplinaryCardIcon,
  formatScoreEventDisplay,
} from '@/components/brand/DisciplinaryCards';
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
  games: Match[];
  rounds: Round[];
  segments: Segment[];
  scoreEvents: ScoreEvent[];
  settings: Settings;
}

type StatusFilter = 'all' | MatchStatus;

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
        // Strictly pass viewerRole: 'player' so unfinished match segments are redacted at repo layer
        const [players, games, rounds, segments, scoreEvents, settings] =
          await Promise.all([
            playerRepo.list({ includeHost: true }),
            matchRepo.list({ viewerRole: 'player' }),
            roundRepo.list(),
            segmentRepo.list(),
            scoreRepo.list({ order: 'oldest', viewerRole: 'player' }),
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
        msg.event === 'match.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'match.finished' ||
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
      if (
        qPlayer &&
        data.players.some((p) => p.id === qPlayer && !p.isHost && !p.isGuest)
      ) {
        setPreviewPlayerId(qPlayer);
      } else {
        const firstReal = data.players.find((p) => !p.isHost && !p.isGuest);
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

    const allMyGames = data.games.filter(
      (g) =>
        g.playerIds.includes(player.id) ||
        g.participants.some((pt) => pt.playerId === player.id)
    );
    const myEvents = data.scoreEvents.filter((e) => e.playerId === player.id);

    const positiveHits = myEvents.filter(
      (e) => e.delta > 0 && e.kind !== 'undo'
    ).length;
    const penaltyHits = myEvents.filter(
      (e) => e.delta < 0 && e.kind !== 'undo'
    ).length;

    const filteredGames = allMyGames
      .filter((g) => {
        if (roundFilter !== 'all' && g.roundId !== roundFilter) return false;
        if (statusFilter !== 'all' && g.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(
          a.finishedAt ?? a.startedAt ?? a.scheduledAt
        ).getTime();
        const tb = new Date(
          b.finishedAt ?? b.startedAt ?? b.scheduledAt
        ).getTime();
        return sortOrder === 'newest' ? tb - ta : ta - tb;
      });

    // Build segment-by-segment structure ONLY for finished matches (AGENTS.md §15.3)
    const enrichedGames = filteredGames.map((game) => {
      const round = roundMap.get(game.roundId) ?? null;
      const totals = computeGameTotalsFromEvents(
        game.id,
        game.playerIds,
        data.scoreEvents
      );
      const myScore = totals[player.id] ?? 0;

      const tableStandings = game.playerIds
        .map((pid, idx) => ({
          ...resolvePlayerDisplay(pid, playerMap, lang, idx),
          score: totals[pid] ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      const myRank =
        tableStandings.findIndex((s) => s.id === player.id) + 1;

      const gameMyEvents = myEvents.filter((e) => e.gameId === game.id);
      const isFinished = game.status === 'finished';

      let runningTotal = 0;
      const segmentBreakdown = isFinished
        ? game.segmentIds.map((segId, idx) => {
            const seg = segmentMap.get(segId) ?? null;
            const segEvents = gameMyEvents.filter(
              (e) => e.segmentId === segId
            );
            const segSubtotal = segEvents.reduce((sum, e) => sum + e.delta, 0);
            runningTotal += segSubtotal;
            return {
              index: idx,
              segId,
              segment: seg,
              events: segEvents,
              subtotal: segSubtotal,
              cumulative: runningTotal,
            };
          })
        : [];

      const isWon =
        isFinished &&
        (game.result?.winnerId === player.id ||
          game.winnerPlayerId === player.id ||
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

  // Expand the most recent FINISHED match by default so post-match segment history is immediately visible
  const defaultExpandedMatchId =
    model?.enrichedGames?.find((item) => item.game.status === 'finished')?.game
      .id ??
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
          matches={data.games}
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
              ? 'اختر متسابقاً لعرض تاريخ مبارياته المنتهية.'
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
        matches={data.games}
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
              playerId={player.id}
              avatarSeed={player.avatarSeed}
              avatar={player.avatar}
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
                  ? 'تفصيل كامل للمباريات المنتهية فقرة بفقرة مع التوقيت والتاريخ الدقيق لكل نقطة.'
                  : 'Complete post-match segment-by-segment score breakdown with exact dates and timestamps.'}
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
                {formatNumber(player.stats.matchesPlayed, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'مباراة' : 'played'}
              </div>
            </div>
          </div>
        </div>

        {/* Positive / Penalty / Cards / Absences Quick Breakdown */}
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
          <CardCounterGroup
            yellowCount={player.stats.yellowCards}
            redCount={player.stats.redCards}
            surface="light"
            size="sm"
            lang={lang}
            useArabicIndicDigits={useArabicIndic}
          />
          {player.stats.absences > 0 && (
            <Badge variant="negative">
              <span>
                {lang === 'ar'
                  ? `غياب: ${formatNumber(player.stats.absences, { useArabicIndicDigits: useArabicIndic })}`
                  : `Absences: ${formatNumber(player.stats.absences, { useArabicIndicDigits: useArabicIndic })}`}
              </span>
            </Badge>
          )}
          <Badge variant="muted">
            <span>
              {formatNumber(allMyGamesCount ?? 0, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'إجمالي المباريات' : 'Total Assigned Matches'}
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
                { v: 'finished', en: 'Finished', ar: 'منتهية' },
                { v: 'live', en: 'Live', ar: 'مباشر' },
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

      {/* Match History Cards */}
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
                ? 'ستظهر هنا كل المباريات المنتهية ونقاطها فقرة بفقرة فور خوضها.'
                : 'Your completed matches and segment-by-segment score records will appear here.'
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
              const isLive =
                game.status === 'live' || game.status === 'needsTieBreak';
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
                            <Trophy
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              {lang === 'ar'
                                ? 'فائز ومتأهل'
                                : 'Won & Advanced'}
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

                        <Badge variant="white" className="tabular-nums">
                          {lang === 'ar'
                            ? `طاولة #${formatNumber(game.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                            : `Table #${formatNumber(game.tableNumber, { useArabicIndicDigits: useArabicIndic })}`}
                        </Badge>

                        {game.isFinal && (
                          <Badge variant="gold">
                            <Crown
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{lang === 'ar' ? 'النهائي' : 'FINAL'}</span>
                          </Badge>
                        )}

                        {game.result?.type === 'walkover' && (
                          <Badge variant="negative">
                            <span>
                              {lang === 'ar'
                                ? 'انسحاب (Walkover)'
                                : 'WALKOVER'}
                            </span>
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
                          <Calendar
                            className="h-3.5 w-3.5 text-red-600"
                            aria-hidden="true"
                          />
                          <span>
                            {formatPublicFullDateTime(
                              referenceTime,
                              lang,
                              useArabicIndic
                            )}
                          </span>
                        </span>
                        {isFinished ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock
                              className="h-3.5 w-3.5 text-red-600"
                              aria-hidden="true"
                            />
                            <span>
                              {formatNumber(game.segmentIds.length, {
                                useArabicIndicDigits: useArabicIndic,
                              })}{' '}
                              {lang === 'ar' ? 'فقرات ملعوبة' : 'segments played'} ·{' '}
                              {formatNumber(totalPlays, {
                                useArabicIndicDigits: useArabicIndic,
                              })}{' '}
                              {lang === 'ar' ? 'حركات نقاط' : 'score events'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-700 font-semibold">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {lang === 'ar'
                                ? 'فقرات المباراة سرية حتى انتهاء اللعب'
                                : 'Segments kept secret until match finishes'}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 md:justify-end shrink-0">
                      <div className="text-start md:text-end">
                        <div className="text-[11px] font-extrabold uppercase text-ink-muted">
                          {lang === 'ar' ? 'نقاطك بالمباراة' : 'Your Match Score'}
                        </div>
                        {game.status === 'scheduled' ? (
                          <span className="font-display text-lg text-ink-muted">
                            —
                          </span>
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

                  {/* Expanded Body: Table Standings + (Finished: Segment Breakdown | Unfinished: Secrecy Notice) */}
                  {expanded && (
                    <div className="border-t-2 border-border-paper bg-paper/50 p-4 sm:p-5 space-y-5">
                      {/* Table Participants Strip with Shared PlayerAvatars */}
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
                                <PlayerAvatar
                                  name={p.name}
                                  playerId={p.id}
                                  avatarSeed={p.avatarSeed}
                                  avatar={p.avatar}
                                  size="xs"
                                  isHost={p.isHost}
                                  className="h-6 w-6"
                                />
                                <span className="shrink-0 tabular-nums text-red-700">
                                  #
                                  {formatNumber(idx + 1, {
                                    useArabicIndicDigits: useArabicIndic,
                                  })}
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
                              <MonitorPlay
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                {lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}
                              </span>
                            </Link>
                          </Button>
                        )}
                      </div>

                      {!isFinished ? (
                        <div className="flex items-start gap-3 rounded-card border border-border-paper bg-white p-4 text-xs sm:text-sm text-ink-muted">
                          <Lock
                            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                            aria-hidden="true"
                          />
                          <div className="space-y-1">
                            <p className="font-bold text-red-900">
                              {lang === 'ar'
                                ? 'تبقى فقرات المباراة مفاجأة حتى انتهاء اللعب'
                                : 'Match Segments Stay Secret Until the Match Finishes'}
                            </p>
                            <p>
                              {lang === 'ar'
                                ? 'لحماية نزاهة المنافسة، لا تظهر أسماء أو ترتيب أو فئات الفقرات للمتسابقين في المباريات القادمة أو المباشرة. سيظهر السجل التفصيلي فقرة بفقرة هنا فور انتهاء المباراة.'
                                : 'To keep every challenge a fair surprise, segment names, order, and categories are never shown for upcoming or live matches. Full segment-by-segment history unlocks automatically once the match finishes.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Segment-by-Segment Points Breakdown (Finished Matches Only) */
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
                                  className="p-3.5 sm:p-4 space-y-2.5"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                      <span className="font-score text-base font-black text-red-700 tabular-nums">
                                        #
                                        {formatNumber(segRow.index + 1, {
                                          useArabicIndicDigits: useArabicIndic,
                                        })}
                                      </span>
                                      <Link
                                        href={`/segments?segment=${encodeURIComponent(segRow.segId)}`}
                                        className="font-display text-base sm:text-lg text-red-900 hover:underline break-words"
                                      >
                                        {segRow.segment
                                          ? localizeText(
                                              lang,
                                              segRow.segment.nameEn,
                                              segRow.segment.nameAr
                                            )
                                          : segRow.segId}
                                      </Link>
                                      {cat && (
                                        <Badge
                                          variant={cat.badgeVariant}
                                          className="px-2 py-0.5 text-[10px]"
                                        >
                                          {lang === 'ar'
                                            ? cat.labelAr
                                            : cat.labelEn}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Segment Subtotal & Running Total */}
                                    <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-0.5 rounded-pill px-2 py-0.5',
                                          segRow.subtotal > 0
                                            ? 'bg-positive-soft text-positive-ink'
                                            : segRow.subtotal < 0
                                              ? 'bg-negative text-white'
                                              : 'bg-paper text-ink-muted'
                                        )}
                                      >
                                        {segRow.subtotal > 0 && (
                                          <Plus
                                            className="h-3 w-3 stroke-[3]"
                                            aria-hidden="true"
                                          />
                                        )}
                                        {segRow.subtotal < 0 && (
                                          <Minus
                                            className="h-3 w-3 stroke-[3]"
                                            aria-hidden="true"
                                          />
                                        )}
                                        <span>
                                          {formatNumber(
                                            Math.abs(segRow.subtotal),
                                            {
                                              useArabicIndicDigits:
                                                useArabicIndic,
                                            }
                                          )}
                                        </span>
                                      </span>

                                      <span className="text-ink-muted">
                                        {lang === 'ar'
                                          ? 'التراكمي:'
                                          : 'Running:'}{' '}
                                        <strong className="font-score text-base font-black text-red-900">
                                          {formatNumber(segRow.cumulative, {
                                            useArabicIndicDigits:
                                              useArabicIndic,
                                          })}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Individual Timestamped Score Events in this Segment */}
                                  {segRow.events.length === 0 ? (
                                    <p className="text-xs text-ink-muted">
                                      {lang === 'ar'
                                        ? 'لا توجد حركات نقاط مسجلة لك في هذه الفقرة.'
                                        : 'No score events recorded for you in this segment.'}
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 pt-1">
                                      {segRow.events.map((ev) => {
                                        const isPos = ev.delta >= 0;
                                        const display =
                                          formatScoreEventDisplay(
                                            ev,
                                            lang,
                                            useArabicIndic
                                          );
                                        return (
                                          <div
                                            key={ev.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-border-paper bg-paper px-3 py-2 text-xs"
                                          >
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                              {display.cardType ? (
                                                <Badge
                                                  variant={
                                                    display.cardType ===
                                                    'yellow'
                                                      ? 'gold'
                                                      : 'negative'
                                                  }
                                                  className="px-2 py-0.5 text-[11px] font-extrabold"
                                                >
                                                  <DisciplinaryCardIcon
                                                    card={display.cardType}
                                                    size="xs"
                                                  />
                                                  <span>
                                                    {display.kindLabel}
                                                  </span>
                                                </Badge>
                                              ) : (
                                                <span
                                                  className={cn(
                                                    'inline-flex items-center gap-0.5 rounded-pill border px-2 py-0.5 font-score text-sm font-black tabular-nums',
                                                    isPos
                                                      ? 'border-positive bg-positive-soft text-positive-ink'
                                                      : 'border-outline bg-negative text-white'
                                                  )}
                                                >
                                                  {isPos ? (
                                                    <Plus
                                                      className="h-3 w-3 stroke-[3]"
                                                      aria-hidden="true"
                                                    />
                                                  ) : (
                                                    <Minus
                                                      className="h-3 w-3 stroke-[3]"
                                                      aria-hidden="true"
                                                    />
                                                  )}
                                                  <span>
                                                    {formatNumber(
                                                      Math.abs(ev.delta),
                                                      {
                                                        useArabicIndicDigits:
                                                          useArabicIndic,
                                                      }
                                                    )}
                                                  </span>
                                                </span>
                                              )}

                                              {!display.cardType && (
                                                <Badge
                                                  variant="muted"
                                                  className="px-2 py-0 text-[10px]"
                                                >
                                                  {display.kindLabel}
                                                </Badge>
                                              )}

                                              {display.userNote && (
                                                <span className="font-semibold text-ink break-words">
                                                  “{display.userNote}”
                                                </span>
                                              )}

                                              {ev.undoneByEventId && (
                                                <Badge
                                                  variant="negative"
                                                  className="px-2 py-0 text-[10px]"
                                                >
                                                  {lang === 'ar'
                                                    ? 'تم التراجع عنها'
                                                    : 'Undone'}
                                                </Badge>
                                              )}
                                            </div>

                                            <span className="text-[11px] font-medium text-ink-muted tabular-nums">
                                              {formatPublicFullDateTime(
                                                ev.createdAt,
                                                lang,
                                                useArabicIndic
                                              )}{' '}
                                              (
                                              {formatPublicTimeOnly(
                                                ev.createdAt,
                                                lang,
                                                useArabicIndic
                                              )}
                                              )
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
                      )}
                    </div>
                  )}
                </article>
              );
            }
          )}

          {/* Load More Matches Pagination Control */}
          {enrichedGames.length > visibleLimit && (
            <div className="flex flex-col items-center justify-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() =>
                  setVisibleLimit((prev) => prev + HISTORY_PAGE_STEP)
                }
              >
                <span>
                  {lang === 'ar'
                    ? `عرض المزيد من المباريات (${formatNumber(enrichedGames.length - visibleLimit, { useArabicIndicDigits: useArabicIndic })} متبقية)`
                    : `Show More Matches (${formatNumber(enrichedGames.length - visibleLimit, { useArabicIndicDigits: useArabicIndic })} remaining)`}
                </span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
