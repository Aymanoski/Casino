'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Clock,
  Crown,
  Hash,
  MapPin,
  Megaphone,
  MonitorPlay,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  contentRepo,
  matchRepo,
  playerRepo,
  roundRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  ContentItem,
  Match,
  MatchStatus,
  MatchType,
  Player,
  Round,
  Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import {
  formatPublicDateTime,
  formatPublicDayHeading,
  formatPublicTimeOnly,
  getLocalDayKey,
  resolvePlayerDisplay,
} from './publicFormatters';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface ScheduleDataset {
  games: Match[];
  rounds: Round[];
  players: Player[];
  announcements: ContentItem[];
  blurbs: ContentItem[];
  settings: Settings;
}

type GroupMode = 'day' | 'round';
type StatusFilter = 'all' | MatchStatus;

const SCHEDULE_PAGE_STEP = 24;

export function ScheduleView() {
  const { lang } = useI18n();

  const [data, setData] = useState<ScheduleDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('day');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stageFilter, setStageFilter] = useState<'all' | MatchType>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [jumpGroupOrMatch, setJumpGroupOrMatch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [visibleLimit, setVisibleLimit] = useState(SCHEDULE_PAGE_STEP);
  const loadSeqRef = useRef(0);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [games, rounds, players, announcements, blurbs, settings] =
          await Promise.all([
            matchRepo.list({ viewerRole: 'visitor' }),
            roundRepo.list(),
            playerRepo.list({ includeHost: true }),
            contentRepo.list({ category: 'announcement' }),
            contentRepo.list({ category: 'scheduleBlurb' }),
            settingsRepo.get(),
          ]);

        if (seq !== loadSeqRef.current) return;
        setData({ games, rounds, players, announcements, blurbs, settings });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل جدول البطولة.'
              : 'Failed to load tournament schedule.'
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
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'player.updated' ||
        msg.event === 'content.updated' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadAll(false);
      }
    });
    return () => unsub();
  }, [loadAll]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  useEffect(() => {
    setVisibleLimit(SCHEDULE_PAGE_STEP);
  }, [groupMode, statusFilter, stageFilter, tableFilter, jumpGroupOrMatch, deferredSearch]);

  const maps = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));
    const sortedRounds = [...data.rounds].sort((a, b) => a.order - b.order);

    const q = normalizeSearchText(deferredSearch);
    const jumpNum = parseInt(jumpGroupOrMatch.replace(/[^\d]/g, ''), 10);
    const filteredGames = [...data.games]
      .filter((g) => {
        if (statusFilter !== 'all' && g.status !== statusFilter) return false;
        if (stageFilter !== 'all' && g.type !== stageFilter) return false;
        if (tableFilter !== 'all' && String(g.tableNumber) !== tableFilter) return false;
        if (Number.isFinite(jumpNum) && jumpNum > 0) {
          if (g.groupId !== `group-${jumpNum}` && g.slot !== jumpNum) return false;
        }
        if (!q) return true;
        const round = roundMap.get(g.roundId);
        const playerNames = g.participants
          .map((part) => {
            if (part.isBye) return 'BYE';
            const p = part.playerId ? playerMap.get(part.playerId) : null;
            return p
              ? `${p.fullName} ${p.fullNameAr} ${p.nickname} ${p.nicknameAr}`
              : part.placeholderLabelEn ?? '';
          })
          .join(' ');
        const haystack = normalizeSearchText(
          `${g.tableName} ${g.tableNameAr} table ${g.tableNumber} #${g.tableNumber} ${g.groupId ?? ''} ${round?.name.en ?? ''} ${round?.name.ar ?? ''} ${playerNames}`
        );
        return haystack.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime() ||
          a.tableNumber - b.tableNumber
      );

    const visibleGames = filteredGames.slice(0, visibleLimit);

    // Group by calendar day
    const dayGroups: Array<{
      key: string;
      heading: string;
      nightIndex: number;
      games: Match[];
    }> = [];
    const dayLookup = new Map<string, number>();

    for (const g of visibleGames) {
      const key = getLocalDayKey(g.scheduledAt);
      const existingIdx = dayLookup.get(key);
      if (existingIdx !== undefined) {
        dayGroups[existingIdx].games.push(g);
      } else {
        dayLookup.set(key, dayGroups.length);
        dayGroups.push({
          key,
          heading: formatPublicDayHeading(g.scheduledAt, lang, useArabicIndic),
          nightIndex: dayGroups.length + 1,
          games: [g],
        });
      }
    }

    // Group by round
    const roundGroups = sortedRounds
      .map((round) => ({
        round,
        games: visibleGames.filter((g) => g.roundId === round.id),
      }))
      .filter((rg) => rg.games.length > 0);

    const statusCounts = {
      all: data.games.length,
      live: data.games.filter((g) => g.status === 'live').length,
      scheduled: data.games.filter((g) => g.status === 'scheduled').length,
      finished: data.games.filter((g) => g.status === 'finished').length,
    };

    const maxTables = Math.max(
      data.settings.tournament.tablesCount,
      ...data.games.map((g) => g.tableNumber)
    );
    const tableNumbers = Array.from({ length: Math.min(64, maxTables) }, (_, i) => i + 1);

    return {
      playerMap,
      roundMap,
      filteredGames,
      visibleGames,
      dayGroups,
      roundGroups,
      statusCounts,
      tableNumbers,
    };
  }, [data, statusFilter, stageFilter, tableFilter, jumpGroupOrMatch, deferredSearch, visibleLimit, lang, useArabicIndic]);

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-12">
          <div className="mx-auto max-w-content-wide px-safe space-y-4">
            <Skeleton className="h-12 w-72 bg-white/25" />
            <Skeleton className="h-5 w-96 max-w-full bg-white/20" />
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
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

  const { settings, announcements, blurbs } = data;
  const primaryAnnouncement = announcements[0] ?? null;
  const primaryBlurb = blurbs[0] ?? null;

  const renderGameCard = (game: Match) => {
    const round = maps.roundMap.get(game.roundId);
    const isLive = game.status === 'live';
    const isFinished = game.status === 'finished';
    const isByeMatch = game.participants.some((p) => p.isBye);
    const winnerId = game.result?.winnerId ?? game.winnerPlayerId;

    return (
      <article
        key={game.id}
        className={cn(
          'flex flex-col justify-between gap-4 rounded-card bg-white p-5 text-ink transition-transform duration-150',
          game.isFinal
            ? 'border-[2.5px] border-outline bg-gradient-to-b from-gold-200/45 via-white to-white shadow-sticker'
            : isLive
              ? 'border-[2.5px] border-outline ring-2 ring-gold-400 shadow-sticker-sm'
              : 'border border-border-paper shadow-soft'
        )}
      >
        {/* Top Row: Time + Table # + Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-border-paper bg-paper px-3 py-1 text-xs font-extrabold text-red-900 tabular-nums">
              <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
              <span>
                {groupMode === 'day'
                  ? formatPublicTimeOnly(game.scheduledAt, lang, useArabicIndic)
                  : formatPublicDateTime(game.scheduledAt, lang, useArabicIndic)}
              </span>
            </span>

            {!isByeMatch && (
              <Badge variant="muted">
                {lang === 'ar'
                  ? `طاولة #${formatNumber(game.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                  : `Table #${formatNumber(game.tableNumber, { useArabicIndicDigits: useArabicIndic })}`}
              </Badge>
            )}

            {round && groupMode === 'day' && (
              <span className="text-xs font-bold text-ink-muted">
                {localizeText(lang, round.name.en, round.name.ar)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isByeMatch && <Badge variant="gold">BYE</Badge>}
            {game.isFinal && (
              <Badge variant="gold">
                <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{lang === 'ar' ? 'النهائي 1v1v1' : 'FINAL 1v1v1'}</span>
              </Badge>
            )}
            {isLive ? (
              <LiveBadge surface="paper" size="sm" />
            ) : isFinished ? (
              <Badge variant="muted">{lang === 'ar' ? 'منتهية' : 'DONE'}</Badge>
            ) : (
              <Badge variant="upcoming">
                {lang === 'ar' ? 'قادمة' : 'UPCOMING'}
              </Badge>
            )}
          </div>
        </div>

        {/* Match Title & Participants (2 cols for 1v1, 3 cols for Final) */}
        <div className="min-w-0 space-y-3">
          <h3 className="font-display text-lg sm:text-xl text-red-900 leading-snug break-words">
            {localizeText(lang, game.tableName, game.tableNameAr)}
          </h3>

          <div
            className={cn(
              'grid gap-2',
              game.participants.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
            )}
          >
            {game.participants.map((part, idx) => {
              if (part.isBye) {
                return (
                  <div
                    key={`bye-${idx}`}
                    className="flex items-center justify-center rounded-input border-2 border-dashed border-gold-500/70 bg-gold-200/25 px-2.5 py-2 text-xs font-extrabold text-red-800"
                  >
                    {lang === 'ar' ? 'تأهل تلقائي (BYE)' : 'BYE'}
                  </div>
                );
              }
              const p = part.playerId
                ? resolvePlayerDisplay(part.playerId, maps.playerMap, lang, idx)
                : {
                    id: `tbd-${idx}`,
                    name:
                      lang === 'ar'
                        ? part.placeholderLabelAr ?? `متأهل #${idx + 1}`
                        : part.placeholderLabelEn ?? `Qualifier #${idx + 1}`,
                    avatarSeed: `tbd-${idx}`,
                    avatar: null,
                    isHost: Boolean(part.guest),
                    isPlaceholder: true,
                  };
              const isWinner = isFinished && Boolean(part.playerId) && winnerId === part.playerId;

              return (
                <div
                  key={`${part.playerId ?? 'tbd'}-${idx}`}
                  className={cn(
                    'flex items-center gap-2 rounded-input border px-2.5 py-2 text-xs',
                    p.isHost
                      ? 'border-outline bg-gold-gradient font-extrabold text-red-900'
                      : isWinner
                        ? 'border-outline bg-gold-200/75 font-bold text-red-900'
                        : p.isPlaceholder
                          ? 'border-dashed border-border-paper bg-paper-2/60 text-ink-muted italic'
                          : 'border-border-paper bg-paper text-ink font-semibold'
                  )}
                >
                  <PlayerAvatar
                    name={p.name}
                    playerId={p.id}
                    avatarSeed={p.avatarSeed}
                    avatar={p.avatar}
                    size="xs"
                    isHost={p.isHost}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate">
                      {p.isHost && (
                        <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
                      )}
                      {isWinner && !p.isHost && (
                        <Trophy
                          className="h-3 w-3 shrink-0 text-red-700"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{p.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions (Zero upcoming match segment details exposed per §15.3) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-paper pt-3">
          <span className="text-xs font-semibold text-ink-muted">
            {game.isFinal
              ? lang === 'ar'
                ? 'نهائي 1 ضد 1 ضد 1'
                : '1v1v1 Grand Final'
              : game.type === 'group'
                ? lang === 'ar'
                  ? 'مباراة مجموعات (1 ضد 1)'
                  : 'Group 1v1 Match'
                : lang === 'ar'
                  ? 'مباراة إقصائية (1 ضد 1)'
                  : 'Knockout 1v1 Match'}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {(isLive || game.isFinal) && (
              <Button variant="red" size="sm" asChild>
                <Link href={`/screen/${game.id}`}>
                  <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}</span>
                </Link>
              </Button>
            )}
            <Button variant="calm" size="sm" asChild>
              <Link
                href={
                  game.type === 'group' && game.groupId
                    ? `/groups?group=${encodeURIComponent(game.groupId.replace('group-', ''))}`
                    : `/bracket?match=${encodeURIComponent(game.id)}`
                }
              >
                <span>
                  {game.type === 'group'
                    ? lang === 'ar'
                      ? 'ترتيب المجموعة'
                      : 'Group Standings'
                    : lang === 'ar'
                      ? 'في الشجرة'
                      : 'View in Bracket'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="flex flex-col">
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'جدول ليالي ومواعيد البطولة'
            : 'Tournament Schedule & Call Times'
        }
        goldHighlight={lang === 'ar' ? 'مواعيد البطولة' : 'Schedule'}
        subtitle={
          lang === 'ar'
            ? 'تصفح جميع طاولات البطولة مرتبة حسب الليلة أو حسب الجولة، مع تحديث مباشر لحالة كل طاولة.'
            : 'Browse every tournament session grouped by night or by round, with real-time table status updates.'
        }
        compact
        meta={
          <>
            <Badge variant="white" className="max-w-full min-w-0">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span className="truncate">
                {localizeText(lang, settings.eventDates, settings.eventDatesAr)}
              </span>
            </Badge>
            <Badge variant="white" className="max-w-full min-w-0">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span className="truncate">{localizeText(lang, settings.venue, settings.venueAr)}</span>
            </Badge>
          </>
        }
        actions={
          <Button variant="gold" size="md" asChild>
            <Link href="/bracket">
              <span>{lang === 'ar' ? 'عرض شجرة البطولة' : 'View Bracket'}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {/* Live Announcement Strip from contentRepo */}
        {primaryAnnouncement && (
          <div className="rounded-card border-[2.5px] border-outline bg-white p-4 text-ink shadow-sticker">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="red" className="px-2.5 py-0.5 text-[11px]">
                      {localizeText(
                        lang,
                        primaryAnnouncement.badgeEn ?? 'ANNOUNCEMENT',
                        primaryAnnouncement.badgeAr ?? 'إعلان مباشر'
                      )}
                    </Badge>
                    <h2 className="font-display text-base sm:text-lg text-red-900">
                      {localizeText(
                        lang,
                        primaryAnnouncement.titleEn,
                        primaryAnnouncement.titleAr
                      )}
                    </h2>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {localizeText(
                      lang,
                      primaryAnnouncement.bodyEn,
                      primaryAnnouncement.bodyAr
                    )}
                  </p>
                </div>
              </div>
              <Button variant="red" size="sm" className="shrink-0" asChild>
                <Link href="/leaderboard">
                  <span>{lang === 'ar' ? 'متابعة الصدارة' : 'Live Standings'}</span>
                </Link>
              </Button>
            </div>
          </div>
        )}
      </PublicPageHero>

      <section className="theme-paper bg-paper py-8 sm:py-12">
        <div className="mx-auto max-w-content-wide px-safe space-y-6">
          {/* Editable Schedule Blurb from contentRepo */}
          {primaryBlurb && (
            <div className="rounded-card border border-border-paper bg-paper-2/80 p-4 sm:p-5 text-ink">
              <div className="flex flex-wrap items-center gap-2">
                {primaryBlurb.badgeEn && (
                  <Badge variant="gold">
                    {localizeText(
                      lang,
                      primaryBlurb.badgeEn,
                      primaryBlurb.badgeAr
                    )}
                  </Badge>
                )}
                <h2 className="font-display text-lg text-red-900">
                  {localizeText(lang, primaryBlurb.titleEn, primaryBlurb.titleAr)}
                </h2>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted max-w-[70ch]">
                {localizeText(lang, primaryBlurb.bodyEn, primaryBlurb.bodyAr)}
              </p>
            </div>
          )}

          {/* View Mode (By Day / By Round) + Status Filters + Search */}
          <div className="space-y-4 rounded-card border border-border-paper bg-white p-4 shadow-soft">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Tabs
                value={groupMode}
                onValueChange={(v) => setGroupMode(v as GroupMode)}
              >
                <TabsList
                  aria-label={
                    lang === 'ar' ? 'طريقة عرض الجدول' : 'Schedule grouping mode'
                  }
                >
                  <TabsTrigger value="day">
                    <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'حسب اليوم / الليلة' : 'By Day'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="round">
                    <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'حسب الجولة' : 'By Round'}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Status Filter Pills */}
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={lang === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'}
              >
                {(
                  [
                    { value: 'all', en: 'All', ar: 'الكل' },
                    { value: 'live', en: 'Live Now', ar: 'مباشر' },
                    { value: 'scheduled', en: 'Upcoming', ar: 'قادمة' },
                    { value: 'finished', en: 'Finished', ar: 'منتهية' },
                  ] as Array<{ value: StatusFilter; en: string; ar: string }>
                ).map((item) => {
                  const active = statusFilter === item.value;
                  const count =
                    (maps.statusCounts as Record<string, number>)[item.value] ?? 0;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatusFilter(item.value)}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 px-3.5 py-1.5 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                        active
                          ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                          : 'border-border-paper bg-paper text-ink hover:border-outline'
                      )}
                    >
                      <span>{lang === 'ar' ? item.ar : item.en}</span>
                      <span
                        className={cn(
                          'rounded-pill px-1.5 py-0.5 text-[11px] tabular-nums',
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-paper-2 text-ink-muted'
                        )}
                      >
                        {formatNumber(count, {
                          useArabicIndicDigits: useArabicIndic,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-5 space-y-1.5">
                <label
                  htmlFor="schedule-search"
                  className="block text-xs font-bold uppercase text-ink-muted"
                >
                  {lang === 'ar'
                    ? 'ابحث بالطاولة أو اسم اللاعب'
                    : 'Search by match, table, or player'}
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <Input
                    id="schedule-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'ابحث عن متسابق أو طاولة...'
                        : 'Search player or match...'
                    }
                    className="ps-10 pe-12"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                      className="absolute end-0.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-pill text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label
                  htmlFor="schedule-stage-filter"
                  className="block text-xs font-bold uppercase text-ink-muted"
                >
                  {lang === 'ar' ? 'المرحلة' : 'Stage'}
                </label>
                <select
                  id="schedule-stage-filter"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as 'all' | MatchType)}
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">{lang === 'ar' ? 'كل المراحل' : 'All stages'}</option>
                  <option value="group">{lang === 'ar' ? 'دور المجموعات' : 'Group Stage'}</option>
                  <option value="knockout">{lang === 'ar' ? 'الإقصائيات' : 'Knockouts'}</option>
                  <option value="final">{lang === 'ar' ? 'النهائي الكبير' : 'Grand Final'}</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="schedule-table-filter"
                  className="block text-xs font-bold uppercase text-ink-muted"
                >
                  {lang === 'ar' ? 'الطاولة' : 'Table #'}
                </label>
                <select
                  id="schedule-table-filter"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">{lang === 'ar' ? 'الكل' : 'All'}</option>
                  {maps.tableNumbers.map((num) => (
                    <option key={num} value={String(num)}>
                      {lang === 'ar' ? `طاولة #${num}` : `Table #${num}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="schedule-jump-num"
                  className="block text-xs font-bold uppercase text-ink-muted"
                >
                  {lang === 'ar' ? 'رقم مجموعة/مباراة' : 'Group / Slot #'}
                </label>
                <div className="relative">
                  <Hash
                    className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="schedule-jump-num"
                    type="number"
                    min={1}
                    value={jumpGroupOrMatch}
                    onChange={(e) => setJumpGroupOrMatch(e.target.value)}
                    placeholder="e.g. 7"
                    className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white ps-8 pe-2 text-base sm:text-sm font-bold tabular-nums text-ink focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs sm:text-sm font-bold text-ink-muted"
          >
            {lang === 'ar'
              ? `عرض ${formatNumber(maps.visibleGames.length, { useArabicIndicDigits: useArabicIndic })} من ${formatNumber(maps.filteredGames.length, { useArabicIndicDigits: useArabicIndic })} جلسة`
              : `Showing ${formatNumber(maps.visibleGames.length, { useArabicIndicDigits: useArabicIndic })} of ${formatNumber(maps.filteredGames.length, { useArabicIndicDigits: useArabicIndic })} sessions`}
          </div>

          {/* Schedule Groups */}
          {maps.filteredGames.length === 0 ? (
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لا توجد مباريات تطابق الفلاتر الحالية'
                  : 'No scheduled tables match these filters'
              }
              description={
                lang === 'ar'
                  ? 'أعد ضبط البحث أو عرض جميع الحالات لمشاهدة كامل جدول البطولة.'
                  : 'Reset search or switch back to All statuses to inspect the full tournament schedule.'
              }
              action={
                <Button
                  variant="red"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                >
                  {lang === 'ar' ? 'عرض كل الجدول' : 'Show Full Schedule'}
                </Button>
              }
            />
          ) : groupMode === 'day' ? (
            <div className="space-y-8">
              {maps.dayGroups.map((group) => (
                <section key={group.key} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-outline/20 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge variant="gold">
                        {lang === 'ar'
                          ? `الليلة ${formatNumber(group.nightIndex, { useArabicIndicDigits: useArabicIndic })}`
                          : `Night ${group.nightIndex}`}
                      </Badge>
                      <h2 className="font-display text-xl sm:text-2xl text-red-900">
                        {group.heading}
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-ink-muted tabular-nums">
                      {lang === 'ar'
                        ? group.games.length === 1
                          ? 'طاولة واحدة'
                          : group.games.length === 2
                            ? 'طاولتان'
                            : `${formatNumber(group.games.length, { useArabicIndicDigits: useArabicIndic })} ${group.games.length <= 10 ? 'طاولات' : 'طاولة'}`
                        : `${group.games.length} ${group.games.length === 1 ? 'session' : 'sessions'}`}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.games.map(renderGameCard)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {maps.roundGroups.map(({ round, games }) => (
                <section key={round.id} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-outline/20 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge
                        variant={
                          round.id === 'round-final' ? 'gold' : 'red'
                        }
                      >
                        {lang === 'ar'
                          ? `الجولة ${formatNumber(round.order, { useArabicIndicDigits: useArabicIndic })}`
                          : `Round ${round.order}`}
                      </Badge>
                      <h2 className="font-display text-xl sm:text-2xl text-red-900">
                        {localizeText(lang, round.name.en, round.name.ar)}
                      </h2>
                    </div>

                    <span className="text-xs font-bold text-ink-muted">
                      {round.id === 'round-final'
                        ? lang === 'ar'
                          ? '٢ متأهلين + مروان سري'
                          : '2 Finalists + Marwan Serry'
                        : lang === 'ar'
                          ? `يتأهل أفضل ${formatNumber(round.advancePerGame, { useArabicIndicDigits: useArabicIndic })} لكل طاولة`
                          : `Top ${round.advancePerGame} advances per table`}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {games.map(renderGameCard)}
                  </div>
                </section>
              ))}
            </div>
          )}

          {maps.visibleGames.length < maps.filteredGames.length && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setVisibleLimit((n) => n + SCHEDULE_PAGE_STEP)}
              >
                <span>
                  {lang === 'ar'
                    ? `عرض المزيد (${formatNumber(maps.filteredGames.length - maps.visibleGames.length, { useArabicIndicDigits: useArabicIndic })} متبقية)`
                    : `Load more sessions (${formatNumber(maps.filteredGames.length - maps.visibleGames.length, { useArabicIndicDigits: useArabicIndic })} remaining)`}
                </span>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
