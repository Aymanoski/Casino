'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  History,
  Mail,
  MapPin,
  Minus,
  MonitorPlay,
  Plus,
  Radio,
  Trophy,
  Zap,
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
  type LeaderboardEntry,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Game,
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
import {
  AnimatedNumber,
  LiveBadge,
  PlayerAvatar,
  ScoreChip,
} from '@/components/brand';
import { getPlayerStatusMeta } from '@/components/admin/adminFormatters';
import {
  computeGameTotalsFromEvents,
  formatPublicDateTime,
  formatPublicFullDateTime,
  resolvePlayerDisplay,
} from '@/components/public/publicFormatters';
import { PublicErrorBanner } from '@/components/public/PublicErrorBanner';
import { PlayerPortalChrome } from './PlayerPortalChrome';

interface PlayerPortalDataset {
  players: Player[];
  games: Game[];
  rounds: Round[];
  segments: Segment[];
  leaderboard: LeaderboardEntry[];
  allScoreEvents: ScoreEvent[];
  settings: Settings;
}

export function PlayerProfileView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PlayerPortalDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPlayerId, setPreviewPlayerId] = useState<string>('player-1');

  const loadSeqRef = useRef(0);
  const initializedQueryRef = useRef(false);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [players, games, rounds, segments, leaderboard, allScoreEvents, settings] =
          await Promise.all([
            playerRepo.list({ includeHost: true }),
            gameRepo.list(),
            roundRepo.list(),
            segmentRepo.list(),
            scoreRepo.getLeaderboard(),
            scoreRepo.list({ order: 'newest' }),
            settingsRepo.get(),
          ]);

        if (seq !== loadSeqRef.current) return;
        setData({
          players,
          games,
          rounds,
          segments,
          leaderboard,
          allScoreEvents,
          settings,
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل ملف المتسابق.'
              : 'Failed to load contestant profile.'
        );
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void loadAll(true);
    const unsub = realtime.subscribe('*', () => {
      void loadAll(false);
    });
    return () => unsub();
  }, [loadAll]);

  // Resolve initial preview player from URL query for Super Admin only
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
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('player', nextId);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const activePlayerId = useMemo(() => {
    if (user?.role === 'player' && user.playerId) {
      return user.playerId;
    }
    return previewPlayerId;
  }, [user, previewPlayerId]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const viewModel = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));
    const segmentMap = new Map(data.segments.map((s) => [s.id, s]));

    const player = playerMap.get(activePlayerId) ?? null;
    if (!player) return { player: null, playerMap, roundMap, segmentMap };

    const lbEntry =
      data.leaderboard.find((e) => e.player.id === player.id) ?? null;
    const totalContestants = data.leaderboard.length;

    const myGames = data.games
      .filter((g) => g.playerIds.includes(player.id))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );

    // Priority: LIVE game first, then earliest SCHEDULED game
    const liveGame = myGames.find((g) => g.status === 'live') ?? null;
    const nextScheduledGame =
      myGames.find((g) => g.status === 'scheduled') ?? null;
    const spotlightGame = liveGame ?? nextScheduledGame;

    const spotlightTotals = spotlightGame
      ? computeGameTotalsFromEvents(
          spotlightGame.id,
          spotlightGame.playerIds,
          data.allScoreEvents
        )
      : {};

    const spotlightRound = spotlightGame
      ? (roundMap.get(spotlightGame.roundId) ?? null)
      : null;

    const spotlightSegments: Segment[] = spotlightGame
      ? spotlightGame.segmentIds
          .map((sid) => segmentMap.get(sid))
          .filter((s): s is Segment => Boolean(s))
      : [];

    const recentEvents = data.allScoreEvents
      .filter((ev) => ev.playerId === player.id)
      .slice(0, 5);

    return {
      player,
      playerMap,
      roundMap,
      segmentMap,
      lbEntry,
      totalContestants,
      myGames,
      spotlightGame,
      spotlightTotals,
      spotlightRound,
      spotlightSegments,
      recentEvents,
    };
  }, [data, activePlayerId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-8 space-y-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-44 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data || !viewModel) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadAll(true)}
        />
      </div>
    );
  }

  const { settings } = data;
  const querySuffix =
    user?.role === 'superAdmin'
      ? `?player=${encodeURIComponent(activePlayerId)}`
      : '';

  if (!viewModel.player) {
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
              ? 'لم يتم العثور على ملف المتسابق'
              : 'Contestant profile not found'
          }
          description={
            lang === 'ar'
              ? 'هذا الحساب غير مرتبط بسجل متسابق نشط في البطولة الحالية.'
              : 'This account is not linked to an active contestant record in the current tournament.'
          }
        />
      </div>
    );
  }

  const {
    player,
    playerMap,
    segmentMap,
    lbEntry,
    totalContestants,
    spotlightGame,
    spotlightTotals,
    spotlightRound,
    spotlightSegments,
    recentEvents,
  } = viewModel;

  const statusMeta = getPlayerStatusMeta(player.status, lang);
  const currentRank = lbEntry?.rank ?? player.seed;

  return (
    <div className="mx-auto max-w-content-wide px-safe py-6 sm:py-10 space-y-6">
      <PlayerPortalChrome
        players={data.players}
        activePlayerId={player.id}
        onSelectPreviewPlayer={handleSelectPreviewPlayer}
        useArabicIndicDigits={useArabicIndic}
      />

      {/* 1. CONTESTANT IDENTITY HERO CARD */}
      <section className="rounded-card border-[3px] border-outline bg-red-600 p-5 sm:p-7 text-white shadow-sticker-lg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <PlayerAvatar
              name={localizeText(lang, player.fullName, player.fullNameAr)}
              avatarSeed={player.avatarSeed}
              size="xl"
              className="shrink-0"
            />
            <div className="min-w-0 space-y-1.5">
              <h1 className="font-display text-fluid-3xl text-gold-sticker leading-tight truncate">
                {localizeText(lang, player.fullName, player.fullNameAr)}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                <Badge variant="white" className="tabular-nums">
                  {lang === 'ar' ? 'تصنيف #' : 'Seed #'}
                  {formatNumber(player.seed, { useArabicIndicDigits: useArabicIndic })}
                </Badge>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-white/95">
                <span>
                  “{localizeText(lang, player.nickname, player.nicknameAr)}”
                </span>
                <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs font-semibold text-white/85">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{player.email}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button variant="gold" size="md" asChild>
              <Link href={`/player/history${querySuffix}`}>
                <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'سجل مبارياتي الكامل' : 'Full Match History'}
                </span>
              </Link>
            </Button>
            <Button variant="secondary" size="md" asChild>
              <Link href={`/bracket?player=${encodeURIComponent(player.id)}`}>
                <span>
                  {lang === 'ar' ? 'مساري في الشجرة' : 'My Bracket Path'}
                </span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. CAREER STATS POKER CHIPS */}
      <section
        aria-label={lang === 'ar' ? 'إحصائيات المتسابق' : 'Contestant statistics'}
        className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <div className="flex items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={`#${formatNumber(currentRank, { useArabicIndicDigits: useArabicIndic })}`}
            tone="gold"
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'الترتيب العام' : 'Overall Rank'}
            </div>
            <div className="text-sm font-bold text-ink tabular-nums">
              {lang === 'ar'
                ? `من أصل ${formatNumber(totalContestants, { useArabicIndicDigits: useArabicIndic })}`
                : `of ${totalContestants} players`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={formatNumber(player.stats.totalPoints, {
              useArabicIndicDigits: useArabicIndic,
            })}
            tone="red"
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'إجمالي النقاط' : 'Total Points'}
            </div>
            <div className="text-sm font-bold text-ink">
              {lang === 'ar' ? 'نقاط رسمية معتمدة' : 'Official tally'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={formatNumber(player.stats.gamesPlayed, {
              useArabicIndicDigits: useArabicIndic,
            })}
            tone="blue"
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'المباريات' : 'Games Played'}
            </div>
            <div className="text-sm font-bold text-ink">
              {lang === 'ar' ? 'جلسات مكتملة ومباشرة' : 'Completed & live'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={formatNumber(player.stats.wins, {
              useArabicIndicDigits: useArabicIndic,
            })}
            tone="white"
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'انتصارات الطاولة' : 'Table Wins'}
            </div>
            <div className="text-sm font-bold text-ink">
              {lang === 'ar' ? 'المركز الأول بالطاولة' : '1st-place finishes'}
            </div>
          </div>
        </div>
      </section>

      {/* 3. NEXT / LIVE GAME SPOTLIGHT + RECENT ACTIVITY */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Next / Live Game Spotlight Card */}
        <section className="min-w-0 lg:col-span-7 space-y-3">
          <h2 className="font-display text-fluid-2xl text-red-900">
            {spotlightGame?.status === 'live'
              ? lang === 'ar'
                ? 'مباراتك المباشرة الآن'
                : 'Your Live Table Right Now'
              : lang === 'ar'
                ? 'طاولتك وموعدك القادم'
                : 'Your Next Game & Table Assignment'}
          </h2>

          {spotlightGame ? (
            <div
              className={cn(
                'rounded-card bg-white p-5 sm:p-6 text-ink space-y-5',
                spotlightGame.status === 'live'
                  ? 'border-[3px] border-outline ring-[3px] ring-gold-400 shadow-sticker-lg'
                  : spotlightGame.isFinal
                    ? 'border-[3px] border-outline bg-gradient-to-b from-gold-200/45 via-white to-white shadow-sticker'
                    : 'border-[2.5px] border-outline shadow-sticker'
              )}
            >
              {/* Status & Round Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {spotlightGame.status === 'live' ? (
                    <LiveBadge surface="paper" size="sm" />
                  ) : (
                    <Badge variant="upcoming">
                      {lang === 'ar' ? 'الموعد القادم' : 'UPCOMING TABLE'}
                    </Badge>
                  )}
                  {spotlightGame.isFinal && (
                    <Badge variant="gold">
                      <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'النهائي الكبير' : 'GRAND FINAL'}</span>
                    </Badge>
                  )}
                </div>

                {spotlightRound && (
                  <span className="text-xs font-extrabold text-red-700">
                    {localizeText(
                      lang,
                      spotlightRound.name.en,
                      spotlightRound.name.ar
                    )}
                  </span>
                )}
              </div>

              {/* Table Name, Exact Date/Time & Venue */}
              <div className="space-y-2.5">
                <h3 className="font-display text-2xl text-red-900 leading-snug">
                  {localizeText(
                    lang,
                    spotlightGame.tableName,
                    spotlightGame.tableNameAr
                  )}
                </h3>

                <div className="grid min-w-0 gap-2 sm:grid-cols-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2 rounded-input border border-border-paper bg-paper px-3 py-2.5">
                    <Calendar
                      className="h-4 w-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase text-ink-muted">
                        {lang === 'ar' ? 'التاريخ والوقت' : 'Date & Call Time'}
                      </div>
                      <div className="font-bold text-ink tabular-nums break-words">
                        {formatPublicDateTime(
                          spotlightGame.scheduledAt,
                          lang,
                          useArabicIndic
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 rounded-input border border-border-paper bg-paper px-3 py-2.5">
                    <MapPin
                      className="h-4 w-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase text-ink-muted">
                        {lang === 'ar' ? 'المقر / الاستوديو' : 'Venue'}
                      </div>
                      <div className="font-bold text-ink truncate">
                        {localizeText(lang, settings.venue, settings.venueAr)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gate Check-In Readiness Pill */}
                {spotlightGame.status === 'scheduled' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-ink-muted pt-1">
                    <CheckCircle2
                      className={cn(
                        'h-4 w-4 shrink-0',
                        player.status === 'checkedIn' ||
                          player.status === 'active' ||
                          player.status === 'finalist'
                          ? 'text-positive-ink'
                          : 'text-ink-faint'
                      )}
                      aria-hidden="true"
                    />
                    <span>
                      {player.status === 'checkedIn' ||
                      player.status === 'active' ||
                      player.status === 'finalist'
                        ? lang === 'ar'
                          ? 'تم تأكيد حضورك وجاهزيتك للجلوس على الطاولة.'
                          : 'You are checked in and cleared for table seating.'
                        : lang === 'ar'
                          ? 'يرجى التوجه إلى مكتب الاستقبال قبل الموعد بـ ١٥ دقيقة لتسجيل الحضور.'
                          : 'Please check in at the venue gate 15 minutes before call time.'}
                    </span>
                  </div>
                )}
              </div>

              {/* 3-Player Table Lineup (with live scores if LIVE) */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase text-red-900">
                  {lang === 'ar' ? 'المتنافسون على الطاولة' : 'Table Lineup'}
                </div>
                <div className="space-y-2">
                  {spotlightGame.playerIds.map((pid, idx) => {
                    const p = resolvePlayerDisplay(pid, playerMap, lang, idx);
                    const isMe = pid === player.id;
                    const isBuzzed =
                      spotlightGame.status === 'live' &&
                      spotlightGame.activeBuzzPlayerId === pid;
                    const livePts = spotlightTotals[pid] ?? 0;

                    return (
                      <div
                        key={`${pid}-${idx}`}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-input border-2 px-3 py-2.5',
                          p.isHost
                            ? 'border-outline bg-gold-gradient text-red-900'
                            : isMe
                              ? 'border-blue-600 bg-blue-100/75 text-blue-800'
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
                              {isMe && (
                                <Badge variant="info" className="px-2 py-0.5 text-[10px]">
                                  {lang === 'ar' ? 'أنت' : 'YOU'}
                                </Badge>
                              )}
                              {p.isHost && (
                                <Badge variant="white" className="px-2 py-0.5 text-[10px]">
                                  <Crown className="h-3 w-3 text-gold-600" aria-hidden="true" />
                                  <span>{lang === 'ar' ? 'المقعد الذهبي' : 'Golden Seat'}</span>
                                </Badge>
                              )}
                              {isBuzzed && (
                                <Badge variant="red" className="px-2 py-0.5 text-[10px]">
                                  <Zap className="h-3 w-3" aria-hidden="true" />
                                  <span>{lang === 'ar' ? 'الجرس!' : 'BUZZED!'}</span>
                                </Badge>
                              )}
                            </div>
                            {p.nickname && !p.isPlaceholder && (
                              <div className="text-xs text-ink-muted">
                                “{p.nickname}”
                              </div>
                            )}
                          </div>
                        </div>

                        {spotlightGame.status === 'live' && (
                          <AnimatedNumber
                            value={livePts}
                            useArabicIndicDigits={useArabicIndic}
                            className="font-score text-2xl font-black text-red-900 shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Planned Segments Preview */}
              {spotlightSegments.length > 0 && (
                <div className="space-y-2 border-t border-border-paper pt-3.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase text-red-900">
                    <span>
                      {lang === 'ar' ? 'فقرات هذه الجلسة' : 'Session Segments'}
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      {formatNumber(spotlightSegments.length, {
                        useArabicIndicDigits: useArabicIndic,
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spotlightSegments.map((seg, i) => {
                      const isCurrent =
                        spotlightGame.status === 'live' &&
                        spotlightGame.currentSegmentIndex === i;
                      return (
                        <Link
                          key={`${seg.id}-${i}`}
                          href={`/segments?segment=${encodeURIComponent(seg.id)}`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-bold transition-colors',
                            isCurrent
                              ? 'border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                              : 'border-border-paper bg-paper text-ink hover:border-outline'
                          )}
                        >
                          <span className="tabular-nums text-red-700">
                            {formatNumber(i + 1, { useArabicIndicDigits: useArabicIndic })}.
                          </span>
                          <span>{localizeText(lang, seg.nameEn, seg.nameAr)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2.5 border-t border-border-paper pt-4">
                {spotlightGame.status === 'live' ? (
                  <Button variant="red" size="md" asChild>
                    <Link href={`/screen/${spotlightGame.id}`}>
                      <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'متابعة شاشة العرض المباشرة' : 'Watch Live Big Screen'}
                      </span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="red" size="md" asChild>
                    <Link href={`/bracket?game=${encodeURIComponent(spotlightGame.id)}`}>
                      <Radio className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'عرض الطاولة في الشجرة' : 'Inspect Table on Bracket'}
                      </span>
                    </Link>
                  </Button>
                )}
                <Button variant="secondary" size="md" asChild>
                  <Link href="/rules">
                    <span>{lang === 'ar' ? 'مراجعة القوانين' : 'Review Rules'}</span>
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title={
                player.status === 'eliminated'
                  ? lang === 'ar'
                    ? 'اكتملت مشاركتك في هذه البطولة'
                    : 'Your tournament run has concluded'
                  : lang === 'ar'
                    ? 'لا توجد طاولة قادمة مجدولة حالياً'
                    : 'No upcoming table scheduled right now'
              }
              description={
                player.status === 'eliminated'
                  ? lang === 'ar'
                    ? 'شكراً لمشاركتك المميزة! يمكنك مراجعة كامل سجل نقاطك فقرة بفقرة أو متابعة بقية المنافسات.'
                    : 'Thank you for competing! Review your full segment-by-segment score history or cheer on the remaining tables.'
                  : lang === 'ar'
                    ? 'بانتظار تحديد جدول الجولة التالية من مدير البطولة.'
                    : 'Awaiting the next round bracket assignment from the Tournament Director.'
              }
              action={
                <Button variant="red" asChild>
                  <Link href={`/player/history${querySuffix}`}>
                    <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'مراجعة سجل مبارياتي' : 'View My Game History'}
                    </span>
                  </Link>
                </Button>
              }
            />
          )}
        </section>

        {/* Recent Score Events Snapshot */}
        <section className="min-w-0 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-fluid-2xl text-red-900">
              {lang === 'ar' ? 'آخر حركات النقاط' : 'Recent Scoring Activity'}
            </h2>
            <Link
              href={`/player/history${querySuffix}`}
              className="inline-flex min-h-[44px] items-center gap-1 text-xs font-extrabold text-blue-600 underline underline-offset-4 hover:text-blue-800"
            >
              <span>{lang === 'ar' ? 'السجل الكامل' : 'See All'}</span>
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="rounded-card border border-border-paper bg-white p-6 text-center text-sm text-ink-muted shadow-soft space-y-2">
              <Trophy
                className="mx-auto h-7 w-7 text-ink-faint"
                aria-hidden="true"
              />
              <p className="font-bold text-ink">
                {lang === 'ar'
                  ? 'لم تُسجّل نقاط بعد'
                  : 'No score events recorded yet'}
              </p>
              <p>
                {lang === 'ar'
                  ? 'ستظهر هنا كل نقاطك فور بدء أول مباراة لك على المسرح.'
                  : 'Your live points and bonuses will appear here as soon as your first table begins.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-paper rounded-card border border-border-paper bg-white shadow-soft overflow-hidden">
              {recentEvents.map((ev) => {
                const seg = segmentMap.get(ev.segmentId);
                const isPos = ev.delta >= 0;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="truncate text-sm font-bold text-ink">
                        {seg
                          ? localizeText(lang, seg.nameEn, seg.nameAr)
                          : ev.segmentId}
                      </div>
                      {ev.note && (
                        <div className="truncate text-xs text-ink-muted">
                          {ev.note}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-faint tabular-nums">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                          {formatPublicFullDateTime(
                            ev.createdAt,
                            lang,
                            useArabicIndic
                          )}
                        </span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-0.5 rounded-pill border-2 px-2.5 py-1 font-score text-base font-black tabular-nums',
                        isPos
                          ? 'border-positive bg-positive-soft text-positive-ink'
                          : 'border-outline bg-negative text-white'
                      )}
                    >
                      {isPos ? (
                        <Plus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                      )}
                      <span>
                        {formatNumber(Math.abs(ev.delta), {
                          useArabicIndicDigits: useArabicIndic,
                        })}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
