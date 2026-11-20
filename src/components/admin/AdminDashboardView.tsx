'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Award,
  CheckSquare,
  Crown,
  FileText,
  GitBranch,
  Layers,
  Minus,
  MonitorPlay,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Tablet,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  contentRepo,
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
  sponsorRepo,
  userRepo,
} from '@/lib/repos';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
  type StatChipItem,
} from './AdminPageHeader';
import { formatAdminTimeShort, getGameStatusMeta } from './adminFormatters';

interface FeedRow {
  id: string;
  createdAt: string;
  kind: 'game' | 'score';
  gameId: string;
  tableName: string;
  playerName?: string;
  delta?: number;
  note?: string;
  winnerName?: string;
}

export function AdminDashboardView() {
  const { user } = useAuth();
  const { lang } = useI18n();

  const [players, setPlayers] = useState<Player[]>([]);
  const [hostPlayer, setHostPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [totalsByGame, setTotalsByGame] = useState<Record<string, Record<string, number>>>({});
  const [contentCount, setContentCount] = useState(0);
  const [sponsorCount, setSponsorCount] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [
        allPlayersWithHost,
        allGames,
        allRounds,
        allSegments,
        allUsers,
        allScores,
        allContent,
        allSponsors,
        appSettings,
      ] = await Promise.all([
        playerRepo.list({ includeHost: true }),
        gameRepo.list(),
        roundRepo.list(),
        segmentRepo.list(),
        userRepo.list(),
        scoreRepo.list({ order: 'newest' }),
        contentRepo.list(),
        sponsorRepo.list(),
        settingsRepo.get(),
      ]);

      const activeGames = allGames.filter(
        (g) => g.status === 'live' || g.status === 'scheduled'
      );
      const totalsEntries = await Promise.all(
        activeGames.map(async (g) => [g.id, await scoreRepo.getGameTotals(g.id)] as const)
      );

      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setPlayers(allPlayersWithHost.filter((p) => !p.isHost));
      setHostPlayer(allPlayersWithHost.find((p) => p.isHost) ?? null);
      setGames(allGames);
      setRounds(allRounds);
      setSegments(allSegments);
      setUsers(allUsers);
      setScoreEvents(allScores);
      setTotalsByGame(Object.fromEntries(totalsEntries));
      setContentCount(allContent.length);
      setSponsorCount(allSponsors.length);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل بيانات لوحة التحكم. حاول إعادة التحديث.'
          : 'Unable to load dashboard overview. Please retry.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)?.gameId;
      if (payloadGameId === 'game-demo' || msg.event === 'timer.updated') return;
      loadData();
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const role = user?.role ?? null;
  const isSuperAdmin = role === 'superAdmin';
  const isCheckIn = role === 'checkIn';
  const isContent = role === 'content';

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    if (hostPlayer) map.set(hostPlayer.id, hostPlayer);
    return map;
  }, [players, hostPlayer]);

  const roundMap = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);
  const segmentMap = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const liveGames = useMemo(
    () => games.filter((g) => g.status === 'live'),
    [games]
  );
  const finishedGames = useMemo(
    () => games.filter((g) => g.status === 'finished'),
    [games]
  );
  const scheduledGames = useMemo(
    () =>
      games
        .filter((g) => g.status === 'scheduled')
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ),
    [games]
  );

  const statChips = useMemo<StatChipItem[]>(() => {
    const checkedInCount = players.filter(
      (p) => p.status === 'checkedIn' || p.status === 'active' || p.status === 'finalist'
    ).length;
    const registeredCount = players.filter((p) => p.status === 'registered').length;

    if (isContent) {
      return [
        {
          id: 'content-items',
          value: contentCount,
          label: lang === 'ar' ? 'عناصر المحتوى' : 'Content Items',
          detail: lang === 'ar' ? 'الإعلانات، القوانين، الجدول' : 'Announcements, rules & blurbs',
          tone: 'blue',
          useArabicIndicDigits: useArabicIndic,
        },
        {
          id: 'sponsors',
          value: sponsorCount,
          label: lang === 'ar' ? 'فئات الرعاة' : 'Sponsor Tiers',
          detail: lang === 'ar' ? 'نصوص مبدئية قابلة للتعديل' : 'Editable pitch placeholders',
          tone: 'gold',
          useArabicIndicDigits: useArabicIndic,
        },
        {
          id: 'segments',
          value: segments.length,
          label: lang === 'ar' ? 'مكتبة الفقرات' : 'Segments Library',
          detail: lang === 'ar' ? 'تحرير الأوصاف باللغتين' : 'Bilingual copy editable',
          tone: 'red',
          useArabicIndicDigits: useArabicIndic,
        },
        {
          id: 'live-now',
          value: liveGames.length,
          label: lang === 'ar' ? 'مباشر الآن' : 'Live Now',
          detail:
            liveGames.length > 0
              ? localizeText(lang, liveGames[0].tableName, liveGames[0].tableNameAr)
              : lang === 'ar'
                ? 'لا توجد طاولات مباشرة'
                : 'No active tables',
          tone: 'live',
          useArabicIndicDigits: useArabicIndic,
        },
      ];
    }

    return [
      {
        id: 'players',
        value: players.length,
        label: lang === 'ar' ? 'إجمالي اللاعبين' : 'Total Players',
        detail:
          lang === 'ar'
            ? `${formatNumber(checkedInCount, { useArabicIndicDigits: useArabicIndic })} حاضر / نشط`
            : `${checkedInCount} checked-in / active`,
        tone: 'red',
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'games-done',
        value: finishedGames.length,
        label: lang === 'ar' ? 'المباريات المنتهية' : 'Games Done',
        detail:
          lang === 'ar'
            ? `من أصل ${formatNumber(games.length, { useArabicIndicDigits: useArabicIndic })} مباراة`
            : `of ${games.length} scheduled games`,
        tone: 'gold',
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'live-now',
        value: liveGames.length,
        label: lang === 'ar' ? 'مباشر الآن' : 'Live Now',
        detail:
          liveGames.length > 0
            ? localizeText(lang, liveGames[0].tableName, liveGames[0].tableNameAr)
            : lang === 'ar'
              ? 'لا توجد طاولات مباشرة'
              : 'No live tables right now',
        tone: 'live',
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'checkin-queue',
        value: registeredCount,
        label: lang === 'ar' ? 'بانتظار الحضور' : 'Pending Check-In',
        detail:
          lang === 'ar'
            ? `${formatNumber(scheduledGames.length, { useArabicIndicDigits: useArabicIndic })} طاولات قادمة`
            : `${scheduledGames.length} upcoming tables`,
        tone: 'blue',
        useArabicIndicDigits: useArabicIndic,
      },
    ];
  }, [
    players,
    finishedGames.length,
    games.length,
    liveGames,
    scheduledGames.length,
    contentCount,
    sponsorCount,
    segments.length,
    isContent,
    lang,
    useArabicIndic,
  ]);

  const recentFeed = useMemo<FeedRow[]>(() => {
    const gameRows: FeedRow[] = finishedGames
      .filter((g) => g.finishedAt)
      .map((g) => {
        const winner = g.winnerPlayerId ? playerMap.get(g.winnerPlayerId) : null;
        return {
          id: `game-fin-${g.id}`,
          createdAt: g.finishedAt!,
          kind: 'game',
          gameId: g.id,
          tableName: localizeText(lang, g.tableName, g.tableNameAr),
          winnerName: winner
            ? localizeText(lang, winner.fullName, winner.fullNameAr)
            : undefined,
        };
      });

    const scoreRows: FeedRow[] = scoreEvents.slice(0, 14).map((ev) => {
      const g = gameMap.get(ev.gameId);
      const p = playerMap.get(ev.playerId);
      return {
        id: ev.id,
        createdAt: ev.createdAt,
        kind: 'score',
        gameId: ev.gameId,
        tableName: g
          ? localizeText(lang, g.tableName, g.tableNameAr)
          : ev.gameId.toUpperCase(),
        playerName: p ? localizeText(lang, p.fullName, p.fullNameAr) : ev.playerId,
        delta: ev.delta,
        note: ev.note,
      };
    });

    return [...gameRows, ...scoreRows]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10);
  }, [finishedGames, scoreEvents, gameMap, playerMap, lang]);

  const quickActions = useMemo(() => {
    if (isCheckIn) {
      return [
        {
          href: '/admin/check-in',
          label: lang === 'ar' ? 'فتح بوابة الحضور' : 'Open Gate Check-In',
          icon: CheckSquare,
          variant: 'red' as const,
        },
        {
          href: '/screen/leaderboard',
          label: lang === 'ar' ? 'شاشة الصدارة' : 'Big Screen Leaderboard',
          icon: MonitorPlay,
          variant: 'secondary' as const,
        },
      ];
    }
    if (isContent) {
      return [
        {
          href: '/admin/content',
          label: lang === 'ar' ? 'تحرير المحتوى والقوانين' : 'Edit Content & Rules',
          icon: FileText,
          variant: 'red' as const,
        },
        {
          href: '/admin/sponsors',
          label: lang === 'ar' ? 'إدارة فئات الرعاة' : 'Manage Sponsor Tiers',
          icon: Award,
          variant: 'secondary' as const,
        },
        {
          href: '/admin/segments',
          label: lang === 'ar' ? 'أوصاف الفقرات' : 'Segment Descriptions',
          icon: Layers,
          variant: 'secondary' as const,
        },
      ];
    }
    return [
      {
        href: '/admin/players',
        label: lang === 'ar' ? 'إدارة اللاعبين' : 'Manage Players',
        icon: Users,
        variant: 'red' as const,
      },
      {
        href: '/admin/bracket',
        label: lang === 'ar' ? 'مصمم التصفيات' : 'Bracket Builder',
        icon: GitBranch,
        variant: 'secondary' as const,
      },
      {
        href: '/admin/check-in',
        label: lang === 'ar' ? 'بوابة الحضور' : 'Gate Check-In',
        icon: CheckSquare,
        variant: 'secondary' as const,
      },
      {
        href: '/admin/results',
        label: lang === 'ar' ? 'سجل النتائج' : 'Results Feed',
        icon: Activity,
        variant: 'secondary' as const,
      },
      {
        href: '/admin/audit',
        label: lang === 'ar' ? 'سجل المراجعة' : 'Audit Log',
        icon: Shield,
        variant: 'secondary' as const,
      },
      {
        href: '/admin/settings',
        label: lang === 'ar' ? 'إعدادات البطولة' : 'Event Settings',
        icon: SettingsIcon,
        variant: 'secondary' as const,
      },
    ];
  }, [isCheckIn, isContent, lang]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} shape="card" className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton shape="card" className="h-72 lg:col-span-7" />
          <Skeleton shape="card" className="h-72 lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          lang === 'ar'
            ? 'مركز التحكم بالبطولة'
            : 'Tournament Control Center'
        }
        description={
          settings
            ? `${localizeText(lang, settings.eventName, settings.eventNameAr)} · ${localizeText(lang, settings.eventDates, settings.eventDatesAr)}`
            : undefined
        }
        badge={
          liveGames.length > 0 ? (
            <LiveBadge size="sm" surface="paper" />
          ) : undefined
        }
        actions={
          <>
            <Button asChild variant="info" size="sm">
              <Link href="/screen/leaderboard">
                <MonitorPlay className="h-4 w-4" />
                <span>
                  {lang === 'ar' ? 'شاشة الصدارة' : 'Big Screen Board'}
                </span>
              </Link>
            </Button>
            {isSuperAdmin && liveGames[0] && (
              <Button asChild variant="red" size="sm">
                <Link href={`/scorer/${liveGames[0].id}`}>
                  <Tablet className="h-4 w-4" />
                  <span>
                    {lang === 'ar' ? 'فتح لوحة الحكم المباشرة' : 'Open Live Scorer'}
                  </span>
                </Link>
              </Button>
            )}
          </>
        }
      />

      {error && (
        <AdminErrorBanner
          message={error}
          onRetry={loadData}
          retryLabel={lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
        />
      )}

      {/* Poker-Chip Key Stats */}
      <AdminStatChipStrip items={statChips} />

      {/* Main Operations Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Live Games + Upcoming + Quick Actions */}
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <section
            aria-labelledby="live-games-heading"
            className="rounded-card border border-border-paper bg-white p-4 sm:p-5 shadow-soft space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="live-games-heading"
                className="font-display text-lg sm:text-xl text-red-900"
              >
                {lang === 'ar' ? 'الطاولات المباشرة الآن' : 'Live Tables On Stage'}
              </h2>
              {isSuperAdmin && (
                <Link
                  href="/admin/games"
                  className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  <span>{lang === 'ar' ? 'كل المباريات' : 'All games'}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              )}
            </div>

            {liveGames.length === 0 ? (
              <EmptyState
                compact
                title={
                  lang === 'ar'
                    ? 'لا توجد طاولات مباشرة حالياً'
                    : 'No tables live right now'
                }
                description={
                  lang === 'ar'
                    ? 'يمكن للحكام أو مدير البطولة بدء أي طاولة مجدولة من صفحة المباريات أو لوحة الحكم.'
                    : 'Scorers or Super Admins can start any scheduled table from Games or the Scorer Console.'
                }
                action={
                  isSuperAdmin && scheduledGames[0] ? (
                    <Button asChild variant="red" size="sm">
                      <Link href={`/scorer/${scheduledGames[0].id}`}>
                        {lang === 'ar' ? 'فتح الطاولة القادمة' : 'Open Next Table'}
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {liveGames.map((game) => {
                  const round = roundMap.get(game.roundId);
                  const currentSegId = game.segmentIds[game.currentSegmentIndex];
                  const currentSeg = segmentMap.get(currentSegId);
                  const scorer = userMap.get(game.scorerUserId);
                  const totals = totalsByGame[game.id] ?? {};

                  return (
                    <div
                      key={game.id}
                      className="@container rounded-card border border-border-paper bg-paper p-4 space-y-3.5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <LiveBadge size="sm" surface="paper" />
                            {round && (
                              <Badge variant="white">
                                {localizeText(lang, round.name.en, round.name.ar)}
                              </Badge>
                            )}
                            {game.isFinal && (
                              <Badge variant="gold">
                                <Crown className="h-3.5 w-3.5" />
                                <span>{lang === 'ar' ? 'النهائي' : 'FINAL'}</span>
                              </Badge>
                            )}
                          </div>
                          <h3 className="mt-2 break-words font-display text-lg text-red-900">
                            {localizeText(lang, game.tableName, game.tableNameAr)}
                          </h3>
                          <p className="break-words text-xs text-ink-muted">
                            {currentSeg
                              ? `${lang === 'ar' ? 'الفقرة' : 'Segment'} ${formatNumber(game.currentSegmentIndex + 1, { useArabicIndicDigits: useArabicIndic })}/${formatNumber(game.segmentIds.length, { useArabicIndicDigits: useArabicIndic })}: ${localizeText(lang, currentSeg.nameEn, currentSeg.nameAr)}`
                              : null}
                            {scorer
                              ? ` · ${lang === 'ar' ? 'الحكم:' : 'Scorer:'} ${localizeText(lang, scorer.name, scorer.nameAr)}`
                              : ''}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button asChild variant="calm" size="sm">
                            <Link href={`/screen/${game.id}`}>
                              <MonitorPlay className="h-4 w-4 text-red-600" />
                              <span>{lang === 'ar' ? 'الشاشة' : 'Big Screen'}</span>
                            </Link>
                          </Button>
                          {isSuperAdmin && (
                            <Button asChild variant="red" size="sm">
                              <Link href={`/scorer/${game.id}`}>
                                <Tablet className="h-4 w-4" />
                                <span>{lang === 'ar' ? 'التحكيم' : 'Scorer'}</span>
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
                        {game.playerIds.map((pid) => {
                          const p = playerMap.get(pid);
                          const pts = totals[pid] ?? 0;
                          const buzzed = game.activeBuzzPlayerId === pid;
                          return (
                            <div
                              key={pid}
                              className={cn(
                                'flex items-center justify-between gap-2 rounded-input border px-2.5 py-2 bg-white',
                                buzzed
                                  ? 'border-gold-600 ring-2 ring-gold-400'
                                  : 'border-border-paper'
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <PlayerAvatar
                                  name={p ? localizeText(lang, p.fullName, p.fullNameAr) : pid}
                                  avatarSeed={p?.avatarSeed ?? pid}
                                  size="xs"
                                  isHost={p?.isHost}
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-bold text-ink">
                                    {p ? localizeText(lang, p.fullName, p.fullNameAr) : pid}
                                  </div>
                                  {buzzed && (
                                    <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-700">
                                      <Zap className="h-3 w-3" />
                                      <span>{lang === 'ar' ? 'ضغط الجرس' : 'Buzzed'}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="shrink-0 font-score text-xl font-black tabular-nums text-red-900">
                                {formatNumber(pts, { useArabicIndicDigits: useArabicIndic })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Next Scheduled Preview */}
            {scheduledGames.length > 0 && (
              <div className="border-t border-border-paper pt-3.5 space-y-2">
                <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink-muted">
                  {lang === 'ar' ? 'المباريات القادمة على الجدول' : 'Up Next On Schedule'}
                </div>
                <div className="divide-y divide-border-paper rounded-input border border-border-paper bg-paper/60">
                  {scheduledGames.slice(0, 3).map((g) => {
                    const meta = getGameStatusMeta(g.status, lang);
                    return (
                      <div
                        key={g.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-ink">
                            {g.isFinal && (
                              <Crown className="h-4 w-4 shrink-0 text-gold-600" />
                            )}
                            <span className="truncate">
                              {localizeText(lang, g.tableName, g.tableNameAr)}
                            </span>
                          </div>
                          <div className="text-xs text-ink-muted">
                            {formatAdminTimeShort(g.scheduledAt, lang, useArabicIndic)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {isCheckIn && (
                            <Button asChild variant="surface" size="sm">
                              <Link href="/admin/check-in">
                                {lang === 'ar' ? 'حضور' : 'Check-In'}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section
            aria-labelledby="quick-actions-heading"
            className="rounded-card border border-border-paper bg-white p-4 sm:p-5 shadow-soft space-y-3"
          >
            <h2
              id="quick-actions-heading"
              className="font-display text-lg sm:text-xl text-red-900"
            >
              {lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {quickActions.map((act) => {
                const Icon = act.icon;
                return (
                  <Button key={act.href} asChild variant={act.variant} size="sm">
                    <Link href={act.href}>
                      <Icon className="h-4 w-4" />
                      <span>{act.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right: Recent Chronological Results Feed */}
        <section
          aria-labelledby="recent-results-heading"
          className="min-w-0 rounded-card border border-border-paper bg-white p-4 sm:p-5 shadow-soft space-y-4 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="recent-results-heading"
              className="font-display text-lg sm:text-xl text-red-900"
            >
              {lang === 'ar' ? 'أحدث النتائج والنقاط' : 'Recent Results Feed'}
            </h2>
            {isSuperAdmin && (
              <Link
                href="/admin/results"
                className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                <span>{lang === 'ar' ? 'السجل الكامل' : 'Full feed'}</span>
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </Link>
            )}
          </div>

          {recentFeed.length === 0 ? (
            <EmptyState
              compact
              title={lang === 'ar' ? 'لا توجد نتائج بعد' : 'No results recorded yet'}
              description={
                lang === 'ar'
                  ? 'ستظهر حركات النقاط ونتائج المباريات المنتهية هنا بالترتيب الزمني فور تسجيلها.'
                  : 'Score updates and finished games will appear here in chronological order.'
              }
            />
          ) : (
            <ol className="divide-y divide-border-paper">
              {recentFeed.map((row) => {
                const isPos = (row.delta ?? 0) >= 0;
                return (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      {row.kind === 'game' ? (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-red-900">
                          <Trophy className="h-4 w-4 shrink-0 text-gold-600" />
                          <span className="truncate">
                            {row.tableName}
                          </span>
                        </div>
                      ) : (
                        <div className="truncate text-sm font-bold text-ink">
                          {row.playerName}
                        </div>
                      )}

                      <div className="text-xs text-ink-muted truncate">
                        {row.kind === 'game'
                          ? `${lang === 'ar' ? 'الفائز:' : 'Winner:'} ${row.winnerName ?? '—'}`
                          : `${row.tableName}${row.note ? ` · ${row.note}` : ''}`}
                      </div>
                      <time
                        dateTime={row.createdAt}
                        className="block text-[11px] font-medium text-ink-faint tabular-nums"
                      >
                        {formatAdminTimeShort(row.createdAt, lang, useArabicIndic)}
                      </time>
                    </div>

                    {row.kind === 'game' ? (
                      <Badge variant="gold" className="shrink-0">
                        {lang === 'ar' ? 'انتهت' : 'FINALIZED'}
                      </Badge>
                    ) : (
                      <Badge
                        variant={isPos ? 'positive' : 'negative'}
                        className="shrink-0 font-score text-sm tabular-nums"
                      >
                        {isPos ? (
                          <Plus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                        ) : (
                          <Minus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                        )}
                        <span>
                          {formatNumber(Math.abs(row.delta ?? 0), {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </span>
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
