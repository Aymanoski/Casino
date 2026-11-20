'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Filter,
  LayoutGrid,
  Minus,
  MonitorPlay,
  Plus,
  Radio,
  Tablet,
  Trophy,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { canAccessScorerGame, useAuth } from '@/lib/auth';
import {
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Game,
  Player,
  Round,
  ScoreEvent,
  Segment,
  Settings,
  User,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import {
  BracketNode,
  BracketTrack,
  type BracketPlayerSlot,
} from '@/components/brand/BracketNode';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import {
  computeGameTotalsFromEvents,
  formatPublicDateTime,
  formatPublicTimeOnly,
  resolvePlayerDisplay,
  SEGMENT_CATEGORY_INFO,
} from './publicFormatters';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface BracketDataset {
  rounds: Round[];
  games: Game[];
  players: Player[];
  segments: Segment[];
  users: User[];
  scoreEvents: ScoreEvent[];
  settings: Settings;
}

export function BracketInteractiveView() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [data, setData] = useState<BracketDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string>('');
  const [mobileRoundId, setMobileRoundId] = useState<string>('');
  const [mobileShowFullTree, setMobileShowFullTree] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  const loadSeqRef = useRef(0);
  const initializedFromQueryRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [rounds, games, players, segments, users, scoreEvents, settings] =
          await Promise.all([
            roundRepo.list(),
            gameRepo.list(),
            playerRepo.list({ includeHost: true }),
            segmentRepo.list(),
            userRepo.list(),
            scoreRepo.list(),
            settingsRepo.get(),
          ]);

        if (seq !== loadSeqRef.current) return;
        setData({ rounds, games, players, segments, users, scoreEvents, settings });

        // Set smart default mobile round (active live round first, else first round)
        setMobileRoundId((prev) => {
          if (prev && rounds.some((r) => r.id === prev)) return prev;
          const liveGame = games.find((g) => g.status === 'live');
          if (liveGame) return liveGame.roundId;
          return rounds[0]?.id ?? '';
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل شجرة البطولة.'
              : 'Failed to load tournament bracket.'
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
      if (payloadGameId === 'game-demo' || msg.event === 'timer.updated') return;
      void loadAll(false);
    });
    return () => unsub();
  }, [loadAll]);

  // Honor deep-link query params (?game=game-11 or ?player=player-1) once data arrives
  useEffect(() => {
    if (!data || initializedFromQueryRef.current) return;
    const qGame = searchParams.get('game');
    const qPlayer = searchParams.get('player');
    if (qGame && data.games.some((g) => g.id === qGame)) {
      setSelectedGameId(qGame);
      const found = data.games.find((g) => g.id === qGame);
      if (found) setMobileRoundId(found.roundId);
    }
    if (qPlayer && data.players.some((p) => p.id === qPlayer)) {
      setHighlightedPlayerId(qPlayer);
    }
    initializedFromQueryRef.current = true;
  }, [data, searchParams]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const maps = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));
    const segmentMap = new Map(data.segments.map((s) => [s.id, s]));
    const userMap = new Map(data.users.map((u) => [u.id, u]));

    const sortedRounds = [...data.rounds].sort((a, b) => a.order - b.order);
    const gamesByRound = new Map<string, Game[]>();
    for (const r of sortedRounds) {
      const rGames = data.games
        .filter((g) => g.roundId === r.id)
        .sort((a, b) => {
          const pa = a.podOrder ?? 999;
          const pb = b.podOrder ?? 999;
          if (pa !== pb) return pa - pb;
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        });
      gamesByRound.set(r.id, rGames);
    }

    const totalsByGame = new Map<string, Record<string, number>>();
    for (const g of data.games) {
      totalsByGame.set(
        g.id,
        computeGameTotalsFromEvents(g.id, g.playerIds, data.scoreEvents)
      );
    }

    const contestants = [...data.players]
      .filter((p) => !p.isHost)
      .sort((a, b) => a.seed - b.seed);

    const liveGames = data.games.filter((g) => g.status === 'live');
    const finishedCount = data.games.filter((g) => g.status === 'finished').length;

    return {
      playerMap,
      roundMap,
      segmentMap,
      userMap,
      sortedRounds,
      gamesByRound,
      totalsByGame,
      contestants,
      liveGames,
      finishedCount,
    };
  }, [data]);

  const buildBracketSlots = useCallback(
    (game: Game): BracketPlayerSlot[] => {
      if (!maps) return [];
      const totals = maps.totalsByGame.get(game.id) ?? {};
      const showScores = game.status === 'live' || game.status === 'finished';
      const advancingSet = new Set(game.advancingPlayerIds ?? []);

      return game.playerIds.map((pid, idx) => {
        const resolved = resolvePlayerDisplay(pid, maps.playerMap, lang, idx);
        return {
          id: resolved.id,
          name: resolved.name,
          nickname: resolved.nickname,
          avatarSeed: resolved.avatarSeed,
          score: showScores ? (totals[pid] ?? 0) : undefined,
          isWinner: game.status === 'finished' && game.winnerPlayerId === pid,
          isAdvancing:
            game.status === 'finished' &&
            (advancingSet.has(pid) || game.winnerPlayerId === pid),
          isHost: resolved.isHost,
          isPlaceholder: resolved.isPlaceholder,
        };
      });
    },
    [maps, lang]
  );

  // Compute rich details for the selected game modal
  const selectedGameDetails = useMemo(() => {
    if (!data || !maps || !selectedGameId) return null;
    const game = data.games.find((g) => g.id === selectedGameId);
    if (!game) return null;

    const round = maps.roundMap.get(game.roundId) ?? null;
    const scorer = maps.userMap.get(game.scorerUserId) ?? null;
    const gameEvents = data.scoreEvents.filter((e) => e.gameId === game.id);
    const totals = maps.totalsByGame.get(game.id) ?? {};

    const standings = game.playerIds
      .map((pid, idx) => {
        const resolved = resolvePlayerDisplay(pid, maps.playerMap, lang, idx);
        return {
          ...resolved,
          total: totals[pid] ?? 0,
          isWinner: game.status === 'finished' && game.winnerPlayerId === pid,
          isAdvancing:
            game.status === 'finished' &&
            Boolean(
              game.advancingPlayerIds?.includes(pid) ||
                game.winnerPlayerId === pid
            ),
          isBuzzed:
            game.status === 'live' && game.activeBuzzPlayerId === pid,
        };
      })
      .sort((a, b) => {
        if (game.status === 'scheduled') return 0;
        return b.total - a.total;
      });

    // Segment-by-segment breakdown
    const segmentRows = game.segmentIds.map((segId, idx) => {
      const seg = maps.segmentMap.get(segId) ?? null;
      const segEvents = gameEvents.filter((e) => e.segmentId === segId);
      const perPlayer: Record<string, number> = {};
      for (const pid of game.playerIds) {
        perPlayer[pid] = segEvents
          .filter((e) => e.playerId === pid)
          .reduce((sum, e) => sum + e.delta, 0);
      }
      return {
        index: idx,
        segId,
        segment: seg,
        events: segEvents,
        perPlayer,
        isCurrent:
          game.status === 'live' && game.currentSegmentIndex === idx,
        isPlayed:
          game.status === 'finished' ||
          (game.status === 'live' && idx <= game.currentSegmentIndex),
      };
    });

    const canScore = canAccessScorerGame(user, game.scorerUserId);

    return {
      game,
      round,
      scorer,
      standings,
      segmentRows,
      eventCount: gameEvents.length,
      canScore,
    };
  }, [data, maps, selectedGameId, lang, user]);

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-12">
          <div className="mx-auto max-w-content-wide px-safe space-y-4">
            <Skeleton className="h-12 w-72 bg-white/25" />
            <Skeleton className="h-5 w-96 max-w-full bg-white/20" />
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !maps) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadAll(true)}
        />
      </div>
    );
  }

  const firstLiveGame = maps.liveGames[0] ?? null;
  const highlightedPlayer = highlightedPlayerId
    ? maps.playerMap.get(highlightedPlayerId) ?? null
    : null;
  const highlightedGamesCount = highlightedPlayerId
    ? data.games.filter((g) => g.playerIds.includes(highlightedPlayerId)).length
    : 0;

  return (
    <div className="flex flex-col">
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'شجرة البطولة التفاعلية'
            : 'Interactive Tournament Bracket'
        }
        goldHighlight={lang === 'ar' ? 'شجرة البطولة' : 'Tournament Bracket'}
        subtitle={
          lang === 'ar'
            ? 'المباريات الجارية تضيء مباشرة وتتحدث لحظياً مع لوحة الحكم. اضغط على أي طاولة لعرض تفاصيل النقاط وفقرات المباراة.'
            : 'Live games glow and update in real time with the Scorer Console. Click any table node to inspect segment-by-segment points, standings, and schedule.'
        }
        compact
        meta={
          <>
            <Badge variant="white">
              <span>
                {formatNumber(maps.contestants.length, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'متسابقاً' : 'Players'}
              </span>
            </Badge>
            <Badge variant="white">
              <span>
                {formatNumber(maps.finishedCount, {
                  useArabicIndicDigits: useArabicIndic,
                })}
                /
                {formatNumber(data.games.length, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'طاولات منتهية' : 'Tables Done'}
              </span>
            </Badge>
            {firstLiveGame && (
              <LiveBadge
                surface="stage"
                size="sm"
                label={`${formatNumber(maps.liveGames.length, {
                  useArabicIndicDigits: useArabicIndic,
                })} ${lang === 'ar' ? 'مباشر الآن' : 'LIVE NOW'}`}
              />
            )}
          </>
        }
        actions={
          <>
            {firstLiveGame && (
              <Button
                variant="gold"
                size="md"
                onClick={() => setSelectedGameId(firstLiveGame.id)}
              >
                <Radio className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'تفاصيل المباراة المباشرة' : 'Inspect Live Table'}
                </span>
              </Button>
            )}
            <Button variant="secondary" size="md" asChild>
              <Link href="/leaderboard">
                <Trophy className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{lang === 'ar' ? 'لوحة الصدارة' : 'Live Leaderboard'}</span>
              </Link>
            </Button>
          </>
        }
      />

      {/* PAPER CONTROLS + INTERACTIVE BRACKET */}
      <section className="theme-paper bg-paper py-8 sm:py-12">
        <div className="mx-auto max-w-content-wide px-safe space-y-6">
          {/* Toolbar: Highlight Player Path (Bonus Idea) + Status Legend */}
          <div className="flex flex-col gap-4 rounded-card border border-border-paper bg-white p-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 flex-1 min-w-0">
              <label
                htmlFor="bracket-player-trace"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-red-900 shrink-0"
              >
                <Filter className="h-4 w-4 text-red-600" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'تتبع مسار لاعب:' : 'Highlight Player Path:'}
                </span>
              </label>

              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <select
                  id="bracket-player-trace"
                  value={highlightedPlayerId}
                  onChange={(e) => setHighlightedPlayerId(e.target.value)}
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper px-3 py-2 text-base font-medium text-ink focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">
                    {lang === 'ar'
                      ? '— جميع اللاعبين (٢٧ + مروان سري) —'
                      : '— All contestants (27 + Marwan Serry) —'}
                  </option>
                  <option value="player-marwan">
                    {lang === 'ar'
                      ? 'مروان سري — المقعد الذهبي'
                      : 'Marwan Serry — Golden Seat'}
                  </option>
                  {maps.contestants.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.seed} {localizeText(lang, p.fullName, p.fullNameAr)} “
                      {localizeText(lang, p.nickname, p.nicknameAr)}”
                    </option>
                  ))}
                </select>

                {highlightedPlayerId && (
                  <Button
                    variant="calm"
                    size="icon"
                    onClick={() => setHighlightedPlayerId('')}
                    aria-label={
                      lang === 'ar'
                        ? 'إلغاء تحديد مسار اللاعب'
                        : 'Clear highlighted player'
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {highlightedPlayer && (
                <Badge
                  variant="info"
                  role="status"
                  aria-live="polite"
                  className="self-start sm:self-center"
                >
                  <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {formatNumber(highlightedGamesCount, {
                      useArabicIndicDigits: useArabicIndic,
                    })}{' '}
                    {lang === 'ar' ? 'طاولات في المسار' : 'tables on path'}
                  </span>
                </Badge>
              )}
            </div>

            {/* Compact Legend */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-muted">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-outline/25 bg-paper px-2.5 py-1">
                <span className="h-2.5 w-2.5 rounded-pill bg-red-600 ring-2 ring-gold-400" />
                <span>{lang === 'ar' ? 'مباشر متوهج' : 'Live Glow'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-outline/25 bg-gold-200/70 px-2.5 py-1 text-red-900">
                <Trophy className="h-3 w-3 text-red-700" aria-hidden="true" />
                <span>{lang === 'ar' ? 'متأهل' : 'Advancing'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-outline/25 bg-gold-gradient px-2.5 py-1 text-red-900">
                <Crown className="h-3 w-3" aria-hidden="true" />
                <span>{lang === 'ar' ? 'المقعد الذهبي' : 'Golden Seat'}</span>
              </span>
            </div>
          </div>

          {maps.sortedRounds.length === 0 || data.games.length === 0 ? (
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لا توجد مباريات في شجرة البطولة حالياً'
                  : 'No bracket tables configured yet'
              }
              description={
                lang === 'ar'
                  ? 'يمكن لمدير البطولة توليد الأدوار والطاولات من لوحة إعدادات التصفيات.'
                  : 'Generate rounds and tables from Admin Bracket Config to populate the live tree.'
              }
            />
          ) : (
            <>
              {/* MOBILE / SMALL TABLET ROUND FOCUS (< lg) — Mounted only when viewport < 1024px to avoid duplicate interactive DOM */}
              {!isDesktop && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tabs
                      value={mobileRoundId}
                      onValueChange={(v) => {
                        setMobileRoundId(v);
                        setMobileShowFullTree(false);
                      }}
                      className="w-full"
                    >
                      <TabsList
                        aria-label={
                          lang === 'ar' ? 'اختيار الجولة' : 'Select tournament round'
                        }
                      >
                        {maps.sortedRounds.map((r) => {
                          const rGames = maps.gamesByRound.get(r.id) ?? [];
                          const hasLive = rGames.some((g) => g.status === 'live');
                          return (
                            <TabsTrigger key={r.id} value={r.id}>
                              {hasLive && (
                                <span
                                  className="h-2 w-2 rounded-pill bg-gold-400"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{localizeText(lang, r.name.en, r.name.ar)}</span>
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>
                    </Tabs>

                    <Button
                      variant="calm"
                      size="sm"
                      onClick={() => setMobileShowFullTree((v) => !v)}
                      className="ms-auto"
                    >
                      <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {mobileShowFullTree
                          ? lang === 'ar'
                            ? 'العودة لعرض الجولة'
                            : 'Back to Round Focus'
                          : lang === 'ar'
                            ? 'عرض الشجرة الكاملة'
                            : 'View Full Tree'}
                      </span>
                    </Button>
                  </div>

                  {!mobileShowFullTree && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(maps.gamesByRound.get(mobileRoundId) ?? []).map((game) => {
                        const round = maps.roundMap.get(game.roundId);
                        return (
                          <BracketNode
                            key={game.id}
                            tableName={localizeText(
                              lang,
                              game.tableName,
                              game.tableNameAr
                            )}
                            roundLabel={
                              round
                                ? localizeText(lang, round.name.en, round.name.ar)
                                : undefined
                            }
                            metaLabel={formatPublicDateTime(
                              game.scheduledAt,
                              lang,
                              useArabicIndic
                            )}
                            status={game.status}
                            isFinal={game.isFinal}
                            players={buildBracketSlots(game)}
                            activeBuzzPlayerId={game.activeBuzzPlayerId}
                            highlightedPlayerId={highlightedPlayerId || null}
                            useArabicIndicDigits={useArabicIndic}
                            onSelect={() => setSelectedGameId(game.id)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* FULL INTERACTIVE CONNECTED TREE (lg+ always, or toggled on mobile) */}
              {(isDesktop || mobileShowFullTree) && (
                <div>
                <BracketTrack
                  title={
                    lang === 'ar'
                      ? 'اضغط على أي طاولة لعرض تفاصيل النقاط'
                      : 'Click any table node for segment breakdown & Big Screen'
                  }
                >
                  <div className="flex min-w-max items-stretch gap-3 px-1 py-2">
                    {maps.sortedRounds.map((round, roundIdx) => {
                      const rGames = maps.gamesByRound.get(round.id) ?? [];
                      const isLastRound =
                        roundIdx === maps.sortedRounds.length - 1;
                      const isFinalCol =
                        round.id === 'round-final' ||
                        rGames.some((g) => g.isFinal);

                      return (
                        <div
                          key={round.id}
                          className="flex items-stretch gap-3"
                        >
                          <div className="flex w-[256px] xl:w-[266px] shrink-0 flex-col gap-3.5">
                            {/* Round Column Header */}
                            <div
                              className={cn(
                                'rounded-card border-2 px-4 py-3 text-start',
                                isFinalCol
                                  ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
                                  : 'border-outline bg-white text-ink shadow-sticker-sm'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h2 className="truncate font-display text-base text-red-900">
                                  {localizeText(lang, round.name.en, round.name.ar)}
                                </h2>
                                <span className="shrink-0 rounded-pill border border-outline/30 bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-red-900 tabular-nums">
                                  {formatNumber(rGames.length, {
                                    useArabicIndicDigits: useArabicIndic,
                                  })}
                                </span>
                              </div>
                              <p
                                className={cn(
                                  'mt-0.5 text-xs font-semibold',
                                  isFinalCol ? 'text-red-900/90' : 'text-ink-muted'
                                )}
                              >
                                {isFinalCol
                                  ? lang === 'ar'
                                    ? '٢ متأهلين + مروان سري'
                                    : '2 Finalists + Marwan Serry'
                                  : lang === 'ar'
                                    ? `يتأهل أفضل ${formatNumber(round.advancePerGame, { useArabicIndicDigits: useArabicIndic })} لكل طاولة`
                                    : `Top ${round.advancePerGame} advances per table`}
                              </p>
                            </div>

                            {/* Round Games vertically balanced to align pods toward next round */}
                            <div className="flex flex-1 flex-col justify-around gap-4">
                              {rGames.map((game) => (
                                <BracketNode
                                  key={game.id}
                                  tableName={localizeText(
                                    lang,
                                    game.tableName,
                                    game.tableNameAr
                                  )}
                                  metaLabel={formatPublicDateTime(
                                    game.scheduledAt,
                                    lang,
                                    useArabicIndic
                                  )}
                                  status={game.status}
                                  isFinal={game.isFinal}
                                  players={buildBracketSlots(game)}
                                  activeBuzzPlayerId={game.activeBuzzPlayerId}
                                  highlightedPlayerId={
                                    highlightedPlayerId || null
                                  }
                                  useArabicIndicDigits={useArabicIndic}
                                  onSelect={() => setSelectedGameId(game.id)}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Directional Connector Rail between rounds */}
                          {!isLastRound && (
                            <div
                              className="flex w-5 shrink-0 flex-col items-center justify-center self-stretch pt-16"
                              aria-hidden="true"
                            >
                              <div className="h-full w-0.5 rounded-pill bg-outline/25 relative flex items-center justify-center">
                                <span className="flex h-6 w-6 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
                                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </BracketTrack>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CLICK-A-GAME DETAIL MODAL / MOBILE BOTTOM SHEET */}
      <Dialog
        open={Boolean(selectedGameDetails)}
        onOpenChange={(open) => {
          if (!open) setSelectedGameId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedGameDetails && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedGameDetails.game.status === 'live' ? (
                    <LiveBadge surface="paper" size="sm" />
                  ) : selectedGameDetails.game.status === 'finished' ? (
                    <Badge variant="muted">
                      {lang === 'ar' ? 'مباراة منتهية' : 'FINISHED'}
                    </Badge>
                  ) : (
                    <Badge variant="upcoming">
                      {lang === 'ar' ? 'مجدولة قادمة' : 'SCHEDULED'}
                    </Badge>
                  )}
                  {selectedGameDetails.game.isFinal && (
                    <Badge variant="gold">
                      <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'النهائي الكبير' : 'GRAND FINAL'}</span>
                    </Badge>
                  )}
                  {selectedGameDetails.round && (
                    <span className="text-xs font-bold text-red-700">
                      {localizeText(
                        lang,
                        selectedGameDetails.round.name.en,
                        selectedGameDetails.round.name.ar
                      )}
                    </span>
                  )}
                </div>

                <DialogTitle className="break-words">
                  {localizeText(
                    lang,
                    selectedGameDetails.game.tableName,
                    selectedGameDetails.game.tableNameAr
                  )}
                </DialogTitle>

                <DialogDescription asChild>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                      <span>
                        {formatPublicDateTime(
                          selectedGameDetails.game.scheduledAt,
                          lang,
                          useArabicIndic
                        )}
                      </span>
                    </span>
                    {selectedGameDetails.scorer && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'الحكم: ' : 'Scorer: '}
                          <strong className="text-ink">
                            {localizeText(
                              lang,
                              selectedGameDetails.scorer.name,
                              selectedGameDetails.scorer.nameAr
                            )}
                          </strong>
                        </span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                      <span>
                        {formatNumber(
                          selectedGameDetails.game.segmentIds.length,
                          { useArabicIndicDigits: useArabicIndic }
                        )}{' '}
                        {lang === 'ar' ? 'فقرات' : 'segments'}
                      </span>
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {/* 3-Player Standings */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                  {selectedGameDetails.game.status === 'scheduled'
                    ? lang === 'ar'
                      ? 'المتسابقون على الطاولة'
                      : 'Seated Contestants'
                    : lang === 'ar'
                      ? 'الترتيب والنقاط'
                      : 'Table Standings'}
                </h3>

                <div className="space-y-2">
                  {selectedGameDetails.standings.map((p, idx) => (
                    <div
                      key={`${p.id}-${idx}`}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-input border-2 px-3.5 py-2.5',
                        p.isHost
                          ? 'border-outline bg-gold-gradient text-red-900'
                          : p.isBuzzed
                            ? 'border-outline bg-gold-300/75 text-red-900'
                            : p.isWinner || p.isAdvancing
                              ? 'border-outline bg-gold-200/65 text-red-900'
                              : 'border-border-paper bg-paper text-ink'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PlayerAvatar
                          name={p.name}
                          avatarSeed={p.avatarSeed}
                          size="sm"
                          isHost={p.isHost}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-display text-base text-red-900">
                              {p.name}
                            </span>
                            {p.isWinner && (
                              <Badge variant="gold" className="px-2 py-0.5 text-[11px]">
                                <Trophy className="h-3 w-3" aria-hidden="true" />
                                <span>{lang === 'ar' ? 'الفائز' : 'Winner'}</span>
                              </Badge>
                            )}
                            {p.isBuzzed && (
                              <Badge variant="red" className="px-2 py-0.5 text-[11px]">
                                <Zap className="h-3 w-3" aria-hidden="true" />
                                <span>{lang === 'ar' ? 'ضغط الجرس!' : 'Buzzed First!'}</span>
                              </Badge>
                            )}
                            {p.isHost && (
                              <Badge variant="white" className="px-2 py-0.5 text-[11px]">
                                <Crown className="h-3 w-3 text-gold-600" aria-hidden="true" />
                                <span>{lang === 'ar' ? 'المقعد الذهبي' : 'Golden Seat'}</span>
                              </Badge>
                            )}
                          </div>
                          {p.nickname && !p.isPlaceholder && (
                            <div className="text-xs text-ink-muted">“{p.nickname}”</div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-end">
                        {selectedGameDetails.game.status === 'scheduled' ? (
                          <span className="text-xs font-bold text-ink-muted">—</span>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <AnimatedNumber
                              value={p.total}
                              useArabicIndicDigits={useArabicIndic}
                              className="font-score text-2xl font-black text-red-900"
                            />
                            <span className="text-[11px] font-bold text-ink-muted">
                              {lang === 'ar' ? 'نقطة' : 'PTS'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Segment-by-Segment Points Breakdown */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                    {lang === 'ar'
                      ? 'تفاصيل النقاط حسب الفقرة'
                      : 'Segment-by-Segment Breakdown'}
                  </h3>
                  <span className="text-xs font-semibold text-ink-muted">
                    {formatNumber(selectedGameDetails.eventCount, {
                      useArabicIndicDigits: useArabicIndic,
                    })}{' '}
                    {lang === 'ar' ? 'حركة نقاط' : 'score events'}
                  </span>
                </div>

                <div className="divide-y divide-border-paper rounded-input border border-border-paper bg-paper/70 overflow-hidden">
                  {selectedGameDetails.segmentRows.map((row) => {
                    const cat = row.segment
                      ? SEGMENT_CATEGORY_INFO[row.segment.category]
                      : null;

                    return (
                      <div
                        key={`${row.segId}-${row.index}`}
                        className={cn(
                          'flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                          row.isCurrent && 'bg-gold-200/60'
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-score text-sm font-black text-red-700 tabular-nums">
                              #{formatNumber(row.index + 1, { useArabicIndicDigits: useArabicIndic })}
                            </span>
                            <span className="text-sm font-bold text-ink truncate">
                              {row.segment
                                ? localizeText(
                                    lang,
                                    row.segment.nameEn,
                                    row.segment.nameAr
                                  )
                                : row.segId}
                            </span>
                            {row.isCurrent && (
                              <Badge variant="red" className="px-2 py-0.5 text-[10px]">
                                {lang === 'ar' ? 'الفقرة الحالية' : 'NOW PLAYING'}
                              </Badge>
                            )}
                            {cat && (
                              <span className="text-[11px] font-semibold text-ink-muted">
                                · {lang === 'ar' ? cat.labelAr : cat.labelEn}
                              </span>
                            )}
                          </div>
                          {row.events.length > 0 && (
                            <div className="text-[11px] text-ink-muted">
                              {formatPublicTimeOnly(
                                row.events[0].createdAt,
                                lang,
                                useArabicIndic
                              )}{' '}
                              ·{' '}
                              {formatNumber(row.events.length, {
                                useArabicIndicDigits: useArabicIndic,
                              })}{' '}
                              {lang === 'ar' ? 'تحديث' : 'plays'}
                            </div>
                          )}
                        </div>

                        {/* Per-player segment deltas */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {selectedGameDetails.standings.map((p) => {
                            const segPts = row.perPlayer[p.id] ?? 0;
                            if (selectedGameDetails.game.status === 'scheduled') {
                              return null;
                            }
                            return (
                              <span
                                key={p.id}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-bold tabular-nums',
                                  segPts > 0
                                    ? 'border-positive bg-positive-soft text-positive-ink'
                                    : segPts < 0
                                      ? 'border-outline bg-negative text-white'
                                      : 'border-border-paper bg-white text-ink-muted'
                                )}
                                title={p.name}
                              >
                                <span className="max-w-[76px] truncate">
                                  {p.name.split(' ')[0]}
                                </span>
                                {segPts > 0 ? (
                                  <Plus className="h-3 w-3 shrink-0 stroke-[3]" aria-hidden="true" />
                                ) : segPts < 0 ? (
                                  <Minus className="h-3 w-3 shrink-0 stroke-[3]" aria-hidden="true" />
                                ) : null}
                                <span className="font-score text-sm font-black">
                                  {formatNumber(Math.abs(segPts), {
                                    useArabicIndicDigits: useArabicIndic,
                                  })}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter>
                {selectedGameDetails.canScore && (
                  <Button variant="secondary" size="md" asChild>
                    <Link href={`/scorer/${selectedGameDetails.game.id}`}>
                      <Tablet className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'فتح لوحة الحكم' : 'Open Scorer Console'}
                      </span>
                    </Link>
                  </Button>
                )}
                <Button variant="red" size="md" asChild>
                  <Link href={`/screen/${selectedGameDetails.game.id}`}>
                    <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'فتح شاشة العرض العملاقة' : 'Open Big Screen'}
                    </span>
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
