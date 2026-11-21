'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Crown,
  Filter,
  MonitorPlay,
  Play,
  Radio,
  RotateCcw,
  Trophy,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import type {
  Game,
  GameStatus,
  Player,
  Round,
  Segment,
  Settings,
  User,
} from '@/lib/schemas';
import { cn, formatArabicCount, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';

type StatusFilter = 'all' | GameStatus;

function formatScheduledDateTime(
  iso: string,
  lang: 'en' | 'ar',
  useArabicIndicDigits: boolean
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(date);
  return formatted;
}

export function ScorerDashboardView() {
  const { user } = useAuth();
  const { lang } = useI18n();

  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totalsByGame, setTotalsByGame] = useState<
    Record<string, Record<string, number>>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scorerFilter, setScorerFilter] = useState<string>('all');

  const mountedRef = useRef<boolean>(true);
  const loadSeqRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';
  const useArabicIndic = settings?.useArabicIndicDigits ?? false;

  const loadDashboard = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [allGames, allPlayers, allRounds, allSegments, allUsers, appSettings] =
        await Promise.all([
          gameRepo.list(),
          playerRepo.list({ includeHost: true }),
          roundRepo.list(),
          segmentRepo.list(),
          userRepo.list(),
          settingsRepo.get(),
        ]);

      const scopedGames =
        user?.role === 'scorer'
          ? allGames.filter((g) => g.scorerUserId === user.id)
          : allGames;

      const totalsMap = await scoreRepo.getTotalsForMatches(
        scopedGames.map((g) => g.id)
      );

      if (!mountedRef.current || seq !== loadSeqRef.current) return;

      setGames(scopedGames);
      setPlayers(allPlayers);
      setRounds(allRounds);
      setSegments(allSegments);
      setUsers(allUsers);
      setSettings(appSettings);
      setTotalsByGame(totalsMap);
      setLoadError(null);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to load tournament tables.'
      );
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadDashboard();
    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)?.gameId;
      if (payloadGameId === 'game-demo' || msg.event === 'timer.updated') return;
      loadDashboard();
    });
    return () => unsub();
  }, [loadDashboard]);

  // Reset scorer filter when switching accounts
  useEffect(() => {
    setScorerFilter('all');
  }, [user?.id]);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const roundMap = useMemo(
    () => new Map(rounds.map((r) => [r.id, r])),
    [rounds]
  );
  const segmentMap = useMemo(
    () => new Map(segments.map((s) => [s.id, s])),
    [segments]
  );
  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

  const scorerUsers = useMemo(
    () => users.filter((u) => u.role === 'scorer'),
    [users]
  );

  const counts = useMemo(() => {
    const byScorer =
      isSuperAdmin && scorerFilter !== 'all'
        ? games.filter((g) => g.scorerUserId === scorerFilter)
        : games;
    return {
      all: byScorer.length,
      live: byScorer.filter(
        (g) => g.status === 'live' || g.status === 'needsTieBreak'
      ).length,
      scheduled: byScorer.filter((g) => g.status === 'scheduled').length,
      finished: byScorer.filter(
        (g) => g.status === 'finished' || g.status === 'void'
      ).length,
      needsReview: byScorer.filter(
        (g) => g.status === 'needsReview' || g.status === 'void'
      ).length,
    };
  }, [games, isSuperAdmin, scorerFilter]);

  const filteredGames = useMemo(() => {
    const priority: Record<GameStatus, number> = {
      live: 0,
      needsTieBreak: 1,
      needsReview: 2,
      scheduled: 3,
      finished: 4,
      void: 5,
    };
    return games
      .filter((g) => {
        if (isSuperAdmin && scorerFilter !== 'all' && g.scorerUserId !== scorerFilter) {
          return false;
        }
        if (statusFilter === 'live') {
          if (g.status !== 'live' && g.status !== 'needsTieBreak') return false;
        } else if (statusFilter === 'finished') {
          if (g.status !== 'finished' && g.status !== 'void') return false;
        } else if (statusFilter !== 'all' && g.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (priority[a.status] !== priority[b.status]) {
          return priority[a.status] - priority[b.status];
        }
        const tA = new Date(a.scheduledAt).getTime();
        const tB = new Date(b.scheduledAt).getTime();
        return a.status === 'finished' ? tB - tA : tA - tB;
      });
  }, [games, isSuperAdmin, scorerFilter, statusFilter]);

  const liveGames = useMemo(
    () =>
      filteredGames.filter(
        (g) => g.status === 'live' || g.status === 'needsTieBreak'
      ),
    [filteredGames]
  );
  const nonLiveGames = useMemo(
    () =>
      filteredGames.filter(
        (g) => g.status !== 'live' && g.status !== 'needsTieBreak'
      ),
    [filteredGames]
  );

  const firstLiveGame = useMemo(
    () => games.find((g) => g.status === 'live') ?? null,
    [games]
  );

  const filterOptions: Array<{ id: StatusFilter; label: string; count: number }> = [
    {
      id: 'all',
      label: lang === 'ar' ? 'الكل' : 'All Tables',
      count: counts.all,
    },
    {
      id: 'live',
      label: lang === 'ar' ? 'مباشر' : 'Live',
      count: counts.live,
    },
    {
      id: 'scheduled',
      label: lang === 'ar' ? 'مجدول' : 'Scheduled',
      count: counts.scheduled,
    },
    {
      id: 'finished',
      label: lang === 'ar' ? 'منتهٍ' : 'Finished',
      count: counts.finished,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stage-Dark Top Header */}
      <section className="flex flex-col gap-4 border-b-2 border-red-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-fluid-3xl leading-tight text-white [text-shadow:0_3px_0_var(--ink)]">
            {isSuperAdmin
              ? lang === 'ar'
                ? 'جميع طاولات التحكيم'
                : 'All Scoring Tables'
              : lang === 'ar'
                ? 'طاولاتي المخصصة'
                : 'My Assigned Tables'}
          </h1>
          <p className="max-w-2xl text-sm sm:text-base text-red-100 leading-relaxed">
            {isSuperAdmin
              ? lang === 'ar'
                ? 'بصلاحية مدير البطولة يمكنك فتح والتحكم في أي طاولة مباشرة أو مجدولة أو مراجعة الطاولات المنتهية.'
                : 'As Super Admin you can open any live, scheduled, or finished table and oversee scoring across all tables.'
              : lang === 'ar'
                ? `مرحباً ${user ? localizeText(lang, user.name, user.nameAr) : ''} — اختر طاولتك المخصصة لبدء الجلسة أو متابعة تسجيل النقاط والجرس.`
                : `Signed in as ${user ? localizeText(lang, user.name, user.nameAr) : ''} — open an assigned table below to run the timer, buzzers, and live scoring.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {firstLiveGame && (
            <Button asChild variant="gold" size="scorer" className="w-full sm:w-auto">
              <Link href={`/scorer/${firstLiveGame.id}`}>
                <Radio className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'الدخول للطاولة المباشرة الآن'
                    : 'Jump to Live Console'}
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Filter & Counter Controls */}
      <section
        aria-label={lang === 'ar' ? 'تصفية الطاولات' : 'Filter tables'}
        className="flex flex-col gap-3 rounded-card border-2 border-red-700 bg-red-800/80 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2" role="group">
          {filterOptions.map((opt) => {
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(opt.id)}
                className={cn(
                  'inline-flex min-h-[48px] items-center gap-2 rounded-button border-2 px-4 py-2 text-sm font-extrabold transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  active
                    ? 'border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                    : 'border-red-700 bg-red-900 text-white hover:border-white/50 hover:bg-red-700'
                )}
              >
                <span>{opt.label}</span>
                <span
                  className={cn(
                    'inline-flex min-w-[24px] items-center justify-center rounded-pill px-1.5 py-0.5 text-xs font-black tabular-nums',
                    active
                      ? 'bg-red-900 text-white'
                      : 'bg-red-800 text-red-100'
                  )}
                >
                  {formatNumber(opt.count, { useArabicIndicDigits: useArabicIndic })}
                </span>
              </button>
            );
          })}
        </div>

        {isSuperAdmin && scorerUsers.length > 0 && (
          <div className="flex items-center gap-2.5">
            <Filter className="h-4 w-4 shrink-0 text-red-100" aria-hidden="true" />
            <label htmlFor="scorer-filter-select" className="sr-only">
              {lang === 'ar' ? 'تصفية حسب الحكم' : 'Filter by assigned scorer'}
            </label>
            <select
              id="scorer-filter-select"
              value={scorerFilter}
              onChange={(e) => setScorerFilter(e.target.value)}
              className="min-h-[48px] w-full sm:w-auto min-w-[230px] rounded-input border-2 border-outline bg-white ps-3.5 pe-8 py-2 text-base font-bold text-ink shadow-sticker-sm focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500"
            >
              <option value="all">
                {lang === 'ar' ? 'كل الحكّام (الكل)' : 'All Scorers (Super Admin)'}
              </option>
              {scorerUsers.map((s) => (
                <option key={s.id} value={s.id}>
                  {localizeText(lang, s.name, s.nameAr)}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="space-y-4 rounded-card border-2 border-red-700 bg-red-800 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-6 w-28 bg-red-700/70" />
                <Skeleton className="h-6 w-32 bg-red-700/70" />
              </div>
              <Skeleton className="h-8 w-3/4 bg-red-700/70" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-16 rounded-input bg-red-900/70" />
                <Skeleton className="h-16 rounded-input bg-red-900/70" />
                <Skeleton className="h-16 rounded-input bg-red-900/70" />
              </div>
              <Skeleton className="h-14 w-full rounded-button bg-red-700/70" />
            </div>
          ))}
        </div>
      )}

      {/* Error State with Recovery Retry */}
      {!loading && loadError && (
        <section
          role="alert"
          className="flex flex-col items-center gap-4 rounded-card border-[3px] border-gold-400 bg-red-800 p-6 text-center shadow-sticker"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-pill border-2 border-outline bg-negative text-white shadow-sticker-sm">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-display text-fluid-xl text-white">
              {lang === 'ar'
                ? 'تعذر تحميل طاولات التحكيم'
                : 'Failed to Load Scoring Tables'}
            </h2>
            <p className="max-w-lg text-sm text-red-100 break-words">
              {lang === 'ar'
                ? 'حدث خطأ أثناء قراءة بيانات الطاولات. اضغط إعادة المحاولة لتحديث البيانات.'
                : `We couldn't load the tournament tables (${loadError}). Tap Retry to refresh.`}
            </p>
          </div>
          <Button
            type="button"
            variant="gold"
            size="scorer"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              loadDashboard();
            }}
          >
            <RotateCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Try Again'}</span>
          </Button>
        </section>
      )}

      {/* Empty State */}
      {!loading && !loadError && filteredGames.length === 0 && (
        <div className="rounded-card border-[2.5px] border-outline bg-white p-2 shadow-sticker">
          <EmptyState
            title={
              lang === 'ar'
                ? 'لا توجد طاولات مطابقة للتصفية الحالية'
                : 'No tables match this filter'
            }
            description={
              games.length === 0
                ? lang === 'ar'
                  ? 'لم يتم تعيين أي طاولات لهذا الحساب بعد. تواصل مع مدير البطولة لتوزيع الجلسات.'
                  : 'No tournament tables have been assigned to this scorer account yet.'
                : lang === 'ar'
                  ? 'جرّب اختيار حالة أخرى أو عرض جميع الطاولات المخصصة لك.'
                  : 'Switch the status or scorer filter above to view your other tables.'
            }
            action={
              games.length > 0 ? (
                <Button
                  variant="red"
                  size="scorer"
                  onClick={() => {
                    setStatusFilter('all');
                    setScorerFilter('all');
                  }}
                >
                  {lang === 'ar' ? 'عرض جميع الطاولات' : 'Show All Tables'}
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {/* LIVE Tables Priority Spotlight */}
      {!loading && liveGames.length > 0 && (
        <section aria-label={lang === 'ar' ? 'الطاولات المباشرة الآن' : 'Live Tables Now'} className="space-y-4">
          <div className="flex items-center gap-2.5">
            <LiveBadge surface="stage" />
            <h2 className="font-display text-fluid-xl text-white">
              {lang === 'ar' ? 'جارية الآن على المسرح' : 'Active Live Sessions'}
            </h2>
          </div>

          <div className="space-y-4">
            {liveGames.map((game) => {
              const round = roundMap.get(game.roundId);
              const scorer = userMap.get(game.scorerUserId);
              const currentSegId = game.segmentIds[game.currentSegmentIndex];
              const currentSeg = currentSegId ? segmentMap.get(currentSegId) : undefined;
              const gameTotals = totalsByGame[game.id] ?? {};
              const seatedPlayers = game.playerIds
                .map((pid) => playerMap.get(pid))
                .filter((p): p is Player => Boolean(p));

              return (
                <article
                  key={game.id}
                  className="relative overflow-hidden rounded-card border-[3px] border-gold-400 bg-red-800 p-4 sm:p-6 shadow-sticker-lg"
                >
                  {game.isFinal && (
                    <div className="mb-3">
                      <MarqueeBulbs variant="strip" bulbCount={12} />
                    </div>
                  )}

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <LiveBadge surface="stage" />
                        {round && (
                          <Badge variant="gold">
                            {localizeText(lang, round.name.en, round.name.ar)}
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/25 bg-red-900 px-3 py-1 text-xs font-bold text-white">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {formatScheduledDateTime(
                              game.scheduledAt,
                              lang,
                              useArabicIndic
                            )}
                          </span>
                        </span>
                        {isSuperAdmin && scorer && (
                          <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/25 bg-red-900 px-3 py-1 text-xs font-bold text-red-100">
                            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{localizeText(lang, scorer.name, scorer.nameAr)}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-fluid-2xl leading-tight text-white break-words [overflow-wrap:anywhere]">
                        {localizeText(lang, game.tableName, game.tableNameAr)}
                      </h3>

                      {currentSeg && (
                        <p className="text-sm font-semibold text-red-100">
                          {lang === 'ar'
                            ? `الفقرة ${formatNumber(game.currentSegmentIndex + 1, { useArabicIndicDigits: useArabicIndic })} من ${formatNumber(game.segmentIds.length, { useArabicIndicDigits: useArabicIndic })}: ${currentSeg.nameAr}`
                            : `Segment ${game.currentSegmentIndex + 1} of ${game.segmentIds.length}: ${currentSeg.nameEn}`}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-2.5 shrink-0">
                      <Button asChild variant="gold" size="scorer">
                        <Link href={`/scorer/${game.id}`}>
                          <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" />
                          <span>
                            {lang === 'ar' ? 'فتح لوحة التحكيم' : 'Resume Console'}
                          </span>
                        </Link>
                      </Button>
                      <Button asChild variant="secondary" size="scorer">
                        <Link
                          href={`/screen/${game.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MonitorPlay className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}
                          </span>
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Seated Players Strip (2-col for 1v1, 3-col for Final) */}
                  <div
                    className={cn(
                      'mt-5 grid gap-2.5',
                      seatedPlayers.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                    )}
                  >
                    {seatedPlayers.map((player) => {
                      const score = gameTotals[player.id] ?? 0;
                      const isBuzzed = game.activeBuzzPlayerId === player.id;
                      return (
                        <div
                          key={player.id}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-input border-2 px-3.5 py-3',
                            isBuzzed
                              ? 'border-gold-300 bg-red-900 shadow-glow-gold'
                              : 'border-red-900 bg-red-900/75'
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <PlayerAvatar
                              name={localizeText(lang, player.fullName, player.fullNameAr)}
                              playerId={player.id}
                              avatarSeed={player.avatarSeed}
                              avatar={player.avatar}
                              size="sm"
                              isHost={player.isHost}
                              buzzed={isBuzzed}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-white">
                                {localizeText(lang, player.fullName, player.fullNameAr)}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-red-100">
                                <span className="truncate">
                                  “{localizeText(lang, player.nickname, player.nicknameAr)}”
                                </span>
                                {isBuzzed && (
                                  <span className="inline-flex items-center gap-0.5 rounded-pill bg-gold-400 px-1.5 py-0.5 text-[10px] font-black text-red-900">
                                    <Zap className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                                    {lang === 'ar' ? 'جرس' : 'BUZZ'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="font-score text-3xl font-black leading-none tabular-nums text-gold-300">
                            {formatNumber(score, { useArabicIndicDigits: useArabicIndic })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Scheduled & Finished Tables Grid */}
      {!loading && nonLiveGames.length > 0 && (
        <section
          aria-label={lang === 'ar' ? 'الجلسات المجدولة والمنتهية' : 'Scheduled and Finished Tables'}
          className="space-y-4"
        >
          {liveGames.length > 0 && (
            <h2 className="font-display text-fluid-xl text-white">
              {statusFilter === 'scheduled'
                ? lang === 'ar'
                  ? 'الجلسات المجدولة القادمة'
                  : 'Scheduled Upcoming Sessions'
                : statusFilter === 'finished'
                  ? lang === 'ar'
                    ? 'الجلسات المنتهية'
                    : 'Completed Sessions'
                  : lang === 'ar'
                    ? 'الجلسات المجدولة والمنتهية'
                    : 'Scheduled & Completed Sessions'}
            </h2>
          )}

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {nonLiveGames.map((game) => {
              const round = roundMap.get(game.roundId);
              const scorer = userMap.get(game.scorerUserId);
              const gameTotals = totalsByGame[game.id] ?? {};
              const isScheduled = game.status === 'scheduled';
              const isFinished = game.status === 'finished';

              return (
                <article
                  key={game.id}
                  className={cn(
                    'flex flex-col justify-between gap-4 rounded-card border-[2.5px] p-4 sm:p-5 shadow-sticker transition-colors',
                    game.isFinal
                      ? 'border-gold-400 bg-gradient-to-b from-red-800 to-red-900'
                      : 'border-red-700 bg-red-800/90'
                  )}
                >
                  <div className="space-y-3">
                    {game.isFinal && (
                      <MarqueeBulbs variant="strip" bulbCount={8} />
                    )}

                    {/* Status + Round + Time */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isScheduled ? (
                          <Badge variant="upcoming">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'مجدولة' : 'SCHEDULED'}</span>
                          </Badge>
                        ) : game.status === 'void' ? (
                          <Badge variant="negative">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'ملغاة (غياب)' : 'VOID'}</span>
                          </Badge>
                        ) : game.status === 'needsReview' ? (
                          <Badge variant="gold">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'تحتاج مراجعة' : 'NEEDS REVIEW'}</span>
                          </Badge>
                        ) : (
                          <Badge variant="neutral">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'منتهية' : 'FINISHED'}</span>
                          </Badge>
                        )}
                        {isFinished && game.result?.type === 'walkover' && (
                          <Badge variant="negative" className="text-[10px]">
                            <span>{lang === 'ar' ? 'انسحاب' : 'WALKOVER'}</span>
                          </Badge>
                        )}
                        {game.tableNumber > 0 && (
                          <Badge variant="white" className="text-[10px] tabular-nums">
                            <span>
                              {lang === 'ar'
                                ? `طاولة ${formatNumber(game.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                                : `T${game.tableNumber}`}
                            </span>
                          </Badge>
                        )}
                        {game.isFinal && (
                          <Badge variant="gold">
                            <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'النهائي الكبير' : 'GRAND FINAL'}</span>
                          </Badge>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-100">
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {formatScheduledDateTime(
                            isFinished && game.finishedAt
                              ? game.finishedAt
                              : game.scheduledAt,
                            lang,
                            useArabicIndic
                          )}
                        </span>
                      </span>
                    </div>

                    {/* Table Name & Round */}
                    <div className="space-y-1">
                      <h3 className="font-display text-fluid-xl leading-snug text-white break-words [overflow-wrap:anywhere]">
                        {localizeText(lang, game.tableName, game.tableNameAr)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-red-100">
                        {round && (
                          <span>{localizeText(lang, round.name.en, round.name.ar)}</span>
                        )}
                        <span>
                          {lang === 'ar'
                            ? formatArabicCount(
                                game.segmentIds.length,
                                {
                                  one: 'فقرة واحدة',
                                  two: 'فقرتان',
                                  few: 'فقرات',
                                  many: 'فقرة',
                                },
                                useArabicIndic
                              )
                            : `${game.segmentIds.length} ${game.segmentIds.length === 1 ? 'segment' : 'segments'}`}
                        </span>
                        {isSuperAdmin && scorer && (
                          <span className="inline-flex items-center gap-1 text-white">
                            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{localizeText(lang, scorer.name, scorer.nameAr)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3 Players Compact List */}
                    <ul className="space-y-1.5 border-t border-white/15 pt-3">
                      {game.playerIds.map((pid, seatIdx) => {
                        const player = playerMap.get(pid);
                        if (!player) {
                          return (
                            <li
                              key={`${game.id}-${pid}-${seatIdx}`}
                              className="flex items-center justify-between gap-2 rounded-input border border-dashed border-white/25 bg-red-900/35 px-2.5 py-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-dashed border-gold-300/60 bg-red-900/70 font-score text-xs font-black text-gold-200"
                                >
                                  0{seatIdx + 1}
                                </span>
                                <span className="truncate text-sm font-semibold text-red-100">
                                  {game.isFinal
                                    ? lang === 'ar'
                                      ? `متأهل النهائي #${formatNumber(seatIdx + 1, { useArabicIndicDigits: useArabicIndic })} (TBD)`
                                      : `Finalist #${seatIdx + 1} (TBD)`
                                    : lang === 'ar'
                                      ? `مقعد متأهل #${formatNumber(seatIdx + 1, { useArabicIndicDigits: useArabicIndic })} (TBD)`
                                      : `Qualifier Seat #${seatIdx + 1} (TBD)`}
                                </span>
                              </div>
                              <span className="font-score text-xl font-black leading-none text-red-200/70">
                                —
                              </span>
                            </li>
                          );
                        }

                        const score = gameTotals[player.id] ?? 0;
                        const isWinner = isFinished && game.winnerPlayerId === player.id;
                        const isAdvancing =
                          isFinished &&
                          Boolean(game.advancingPlayerIds?.includes(player.id));

                        return (
                          <li
                            key={player.id}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-input px-2.5 py-2',
                              isWinner
                                ? 'border border-gold-400 bg-red-900'
                                : 'bg-red-900/60'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <PlayerAvatar
                                name={localizeText(lang, player.fullName, player.fullNameAr)}
                                playerId={player.id}
                                avatarSeed={player.avatarSeed}
                                avatar={player.avatar}
                                size="sm"
                                isHost={player.isHost}
                                className="h-8 w-8"
                              />
                              <span className="truncate text-sm font-bold text-white">
                                {localizeText(lang, player.fullName, player.fullNameAr)}
                              </span>
                              {player.isHost && (
                                <Badge variant="gold" className="px-2 py-0.5 text-[10px]">
                                  {lang === 'ar' ? 'المضيف' : 'HOST'}
                                </Badge>
                              )}
                              {isWinner && (
                                <Trophy
                                  className="h-4 w-4 shrink-0 text-gold-300"
                                  aria-label={lang === 'ar' ? 'الفائز' : 'Winner'}
                                />
                              )}
                              {!isWinner && isAdvancing && (
                                <Badge variant="positive" className="px-1.5 py-0 text-[10px]">
                                  {lang === 'ar' ? 'تأهل' : 'ADV'}
                                </Badge>
                              )}
                            </div>
                            <span className="font-score text-2xl font-black leading-none tabular-nums text-gold-300">
                              {isScheduled
                                ? '—'
                                : formatNumber(score, {
                                    useArabicIndicDigits: useArabicIndic,
                                  })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Card Footer Actions (min 56px tall) */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
                    <Button
                      asChild
                      variant={isScheduled ? 'gold' : 'secondary'}
                      size="scorer"
                      className="flex-1"
                    >
                      <Link href={`/scorer/${game.id}`}>
                        <span>
                          {isScheduled
                            ? lang === 'ar'
                              ? 'فتح وبدء الطاولة'
                              : 'Open & Start'
                            : lang === 'ar'
                              ? 'مراجعة الجلسة'
                              : 'Review Session'}
                        </span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="surface"
                      size="scorer"
                      className="px-4"
                      aria-label={
                        lang === 'ar'
                          ? `فتح شاشة العرض لـ ${game.tableNameAr || game.tableName}`
                          : `Open Big Screen for ${game.tableName}`
                      }
                    >
                      <Link
                        href={`/screen/${game.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MonitorPlay className="h-5 w-5 shrink-0" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
