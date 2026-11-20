'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  MonitorPlay,
  Radio,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  gameRepo,
  roundRepo,
  scoreRepo,
  settingsRepo,
  type LeaderboardEntry,
} from '@/lib/repos';
import { realtime, type RealtimeConnectionStatus } from '@/lib/realtime';
import type { Game, PlayerStatus, Round, Settings } from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AnimatedNumber,
  LiveBadge,
  PlayerAvatar,
  ScoreboardRow,
  ScoreChip,
} from '@/components/brand';
import { getPlayerStatusMeta } from '@/components/admin/adminFormatters';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  rounds: Round[];
  liveGames: Game[];
  settings: Settings;
}

export function LeaderboardLiveView() {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const [data, setData] = useState<LeaderboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState<string>('overall');
  const [statusFilter, setStatusFilter] = useState<'all' | PlayerStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rtStatus, setRtStatus] = useState<RealtimeConnectionStatus>('connected');
  const [rankShifts, setRankShifts] = useState<Record<string, number>>({});
  const [recentDeltas, setRecentDeltas] = useState<Record<string, number>>({});

  const loadSeqRef = useRef(0);
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const clearShiftTimerRef = useRef<number | null>(null);

  const loadLeaderboard = useCallback(
    async (selectedRound: string, showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [entries, rounds, liveGames, settings] = await Promise.all([
          scoreRepo.getLeaderboard({
            roundId: selectedRound === 'overall' ? undefined : selectedRound,
          }),
          roundRepo.list(),
          gameRepo.getLiveGames(),
          settingsRepo.get(),
        ]);

        if (seq !== loadSeqRef.current) return;

        // Detect live rank changes & point deltas relative to previous snapshot
        if (prevRanksRef.current.size > 0 && !showSpinner) {
          const nextShifts: Record<string, number> = {};
          const nextDeltas: Record<string, number> = {};
          for (const entry of entries) {
            const oldRank = prevRanksRef.current.get(entry.player.id);
            const oldScore = prevScoresRef.current.get(entry.player.id);
            if (typeof oldRank === 'number' && oldRank !== entry.rank) {
              nextShifts[entry.player.id] = oldRank - entry.rank; // positive = moved up
            }
            if (typeof oldScore === 'number' && oldScore !== entry.totalPoints) {
              nextDeltas[entry.player.id] = entry.totalPoints - oldScore;
            }
          }
          if (
            Object.keys(nextShifts).length > 0 ||
            Object.keys(nextDeltas).length > 0
          ) {
            setRankShifts(nextShifts);
            setRecentDeltas(nextDeltas);
            if (clearShiftTimerRef.current) {
              window.clearTimeout(clearShiftTimerRef.current);
            }
            clearShiftTimerRef.current = window.setTimeout(() => {
              setRankShifts({});
              setRecentDeltas({});
            }, 3600);
          }
        }

        prevRanksRef.current = new Map(entries.map((e) => [e.player.id, e.rank]));
        prevScoresRef.current = new Map(
          entries.map((e) => [e.player.id, e.totalPoints])
        );

        setData({ entries, rounds, liveGames, settings });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل لوحة الصدارة.'
              : 'Failed to load live leaderboard.'
        );
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    prevRanksRef.current.clear();
    prevScoresRef.current.clear();
    void loadLeaderboard(roundFilter, true);
  }, [roundFilter, loadLeaderboard]);

  useEffect(() => {
    const unsubEvents = realtime.subscribe('*', () => {
      void loadLeaderboard(roundFilter, false);
    });
    const unsubStatus = realtime.onStatusChange((st) => {
      setRtStatus(st);
    });
    return () => {
      unsubEvents();
      unsubStatus();
      if (clearShiftTimerRef.current) {
        window.clearTimeout(clearShiftTimerRef.current);
      }
    };
  }, [roundFilter, loadLeaderboard]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    const q = normalizeSearchText(searchQuery);
    return data.entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.player.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = normalizeSearchText(
        `${entry.player.fullName} ${entry.player.fullNameAr} ${entry.player.nickname} ${entry.player.nicknameAr} #${entry.rank}`
      );
      return haystack.includes(q);
    });
  }, [data, statusFilter, searchQuery]);

  const podiumTop3 = useMemo(() => {
    if (!data || data.entries.length === 0) return [];
    const top = data.entries.slice(0, 3);
    if (top.length < 3) return top;
    // Display order on md+: [#2, #1 elevated center, #3]
    return [top[1], top[0], top[2]];
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-12">
          <div className="mx-auto max-w-content-wide px-safe space-y-6">
            <Skeleton className="h-12 w-72 bg-white/25" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-44 w-full bg-white/20" />
              <Skeleton className="h-52 w-full bg-white/30" />
              <Skeleton className="h-44 w-full bg-white/20" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadLeaderboard(roundFilter, true)}
        />
      </div>
    );
  }

  const firstLive = data.liveGames[0] ?? null;

  return (
    <div className="flex flex-col">
      {/* STAGE HERO + TOP-3 PODIUM */}
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'لوحة الصدارة المباشرة'
            : 'Live Tournament Leaderboard'
        }
        goldHighlight={lang === 'ar' ? 'الصدارة المباشرة' : 'Live'}
        subtitle={
          lang === 'ar'
            ? 'الترتيب العام والنقاط تتحدث تلقائياً وفورياً مع كل ضغطة جرس أو تعديل نقاط من أي طاولة مباشرة.'
            : 'Official standings derived directly from every scored play—updating automatically in real time as live tables score.'
        }
        meta={
          <>
            <LiveBadge
              surface="stage"
              size="sm"
              pulse={rtStatus === 'connected'}
              label={
                lang === 'ar'
                  ? rtStatus === 'connected'
                    ? 'متصل بالبث المباشر'
                    : 'جارٍ المزامنة'
                  : rtStatus === 'connected'
                    ? 'LIVE SYNC ACTIVE'
                    : 'SYNCING'
              }
            />
            {firstLive && (
              <Link
                href={`/screen/${firstLive.id}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-outline bg-white px-3.5 py-1 text-xs font-extrabold text-red-900 shadow-sticker-sm hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
              >
                <Radio className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                <span>
                  {localizeText(lang, firstLive.tableName, firstLive.tableNameAr)}
                </span>
              </Link>
            )}
          </>
        }
        actions={
          <Button variant="gold" size="md" asChild>
            <Link href="/screen/leaderboard">
              <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'ar' ? 'عرض شاشة الصدارة العملاقة' : 'Open Venue Big Screen'}
              </span>
            </Link>
          </Button>
        }
      >
        {/* Top-3 Podium Spotlight */}
        {podiumTop3.length > 0 && (
          <LayoutGroup id="public-leaderboard-podium">
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3 md:items-end">
              {podiumTop3.map((entry) => {
                const isFirst = entry.rank === 1;
                const shift = rankShifts[entry.player.id] ?? 0;
                const mobileOrder =
                  entry.rank === 1
                    ? 'order-1 md:order-2'
                    : entry.rank === 2
                      ? 'order-2 md:order-1'
                      : 'order-3 md:order-3';

                return (
                  <motion.div
                    key={entry.player.id}
                    layout={!prefersReducedMotion}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={cn(
                      'relative flex flex-col items-center gap-3 rounded-card border-[2.5px] border-outline p-5 text-center text-ink shadow-sticker-lg',
                      mobileOrder,
                      isFirst
                        ? 'bg-gold-gradient text-red-900 md:py-7'
                        : 'bg-white'
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <ScoreChip
                        value={`#${formatNumber(entry.rank, { useArabicIndicDigits: useArabicIndic })}`}
                        tone={
                          entry.rank === 1
                            ? 'red'
                            : entry.rank === 2
                              ? 'gold'
                              : 'blue'
                        }
                        size="sm"
                      />

                      {shift !== 0 ? (
                        <Badge
                          variant={shift > 0 ? 'positive' : 'negative'}
                          className="px-2 py-0.5 text-[11px]"
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
                        </Badge>
                      ) : isFirst ? (
                        <span className="inline-flex items-center gap-1 rounded-pill border-2 border-outline bg-red-900 px-2.5 py-0.5 text-[11px] font-black text-gold-200">
                          <Trophy className="h-3 w-3" aria-hidden="true" />
                          <span>{lang === 'ar' ? 'المتصدر' : 'LEADER'}</span>
                        </span>
                      ) : null}
                    </div>

                    <PlayerAvatar
                      name={localizeText(
                        lang,
                        entry.player.fullName,
                        entry.player.fullNameAr
                      )}
                      avatarSeed={entry.player.avatarSeed}
                      size={isFirst ? 'lg' : 'md'}
                    />

                    <div className="min-w-0 w-full">
                      <h2 className="truncate font-display text-xl sm:text-2xl text-red-900">
                        {localizeText(
                          lang,
                          entry.player.fullName,
                          entry.player.fullNameAr
                        )}
                      </h2>
                      <p
                        className={cn(
                          'truncate text-xs font-bold',
                          isFirst ? 'text-red-900/85' : 'text-ink-muted'
                        )}
                      >
                        “
                        {localizeText(
                          lang,
                          entry.player.nickname,
                          entry.player.nicknameAr
                        )}
                        ”
                      </p>
                    </div>

                    <div className="flex items-baseline justify-center gap-1.5 pt-1">
                      <AnimatedNumber
                        value={entry.totalPoints}
                        useArabicIndicDigits={useArabicIndic}
                        className={cn(
                          'font-score font-black leading-none',
                          isFirst
                            ? 'text-5xl text-red-900'
                            : 'text-4xl text-red-600'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-extrabold uppercase',
                          isFirst ? 'text-red-900/85' : 'text-ink-muted'
                        )}
                      >
                        {lang === 'ar' ? 'نقطة' : 'PTS'}
                      </span>
                    </div>

                    <div
                      className={cn(
                        'flex w-full items-center justify-center gap-4 border-t pt-2.5 text-xs font-bold',
                        isFirst
                          ? 'border-red-900/20 text-red-900'
                          : 'border-border-paper text-ink-muted'
                      )}
                    >
                      <span>
                        {lang === 'ar' ? 'مباريات: ' : 'Games: '}
                        <strong className="tabular-nums">
                          {formatNumber(entry.gamesPlayed, {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </strong>
                      </span>
                      <span>
                        {lang === 'ar' ? 'فوز: ' : 'Wins: '}
                        <strong className="tabular-nums">
                          {formatNumber(entry.wins, {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </strong>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </LayoutGroup>
        )}
      </PublicPageHero>

      {/* PAPER RANKINGS SECTION */}
      <section className="theme-paper bg-paper py-8 sm:py-12">
        <div className="mx-auto max-w-content-wide px-safe space-y-6">
          {/* Filters Toolbar */}
          <div className="space-y-4 rounded-card border border-border-paper bg-white p-4 shadow-soft">
            <Tabs value={roundFilter} onValueChange={setRoundFilter}>
              <TabsList
                aria-label={
                  lang === 'ar'
                    ? 'تصفية الصدارة حسب الجولة'
                    : 'Filter standings by round'
                }
              >
                <TabsTrigger value="overall">
                  {lang === 'ar' ? 'الترتيب العام' : 'Overall Standings'}
                </TabsTrigger>
                {data.rounds.map((round) => (
                  <TabsTrigger key={round.id} value={round.id}>
                    {localizeText(lang, round.name.en, round.name.ar)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-7 space-y-1.5">
                <label
                  htmlFor="leaderboard-search"
                  className="block text-xs font-bold uppercase text-ink-muted"
                >
                  {lang === 'ar' ? 'ابحث باسم أو لقب اللاعب' : 'Search player or nickname'}
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <Input
                    id="leaderboard-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'مثال: عمر حسن أو الثعلب...'
                        : 'e.g. Omar Hassan or The Fox...'
                    }
                    className="ps-10 pe-10"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                      className="absolute end-1 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-pill text-ink-muted hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-5 space-y-1.5">
                <label
                  htmlFor="leaderboard-status-filter"
                  className="block text-xs font-bold uppercase text-ink-muted"
                >
                  {lang === 'ar' ? 'حالة المتسابق' : 'Contestant Status'}
                </label>
                <select
                  id="leaderboard-status-filter"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'all' | PlayerStatus)
                  }
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 py-2 text-base font-medium text-ink focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="all">
                    {lang === 'ar' ? 'جميع الحالات' : 'All statuses'}
                  </option>
                  <option value="active">
                    {lang === 'ar' ? 'نشط بالبطولة' : 'Active'}
                  </option>
                  <option value="finalist">
                    {lang === 'ar' ? 'متأهل للنهائي' : 'Finalist'}
                  </option>
                  <option value="checkedIn">
                    {lang === 'ar' ? 'تم الحضور' : 'Checked In'}
                  </option>
                  <option value="registered">
                    {lang === 'ar' ? 'مسجّل' : 'Registered'}
                  </option>
                  <option value="eliminated">
                    {lang === 'ar' ? 'خرج من المنافسة' : 'Eliminated'}
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Count + Live List */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-bold text-ink-muted">
            <span>
              {lang === 'ar'
                ? `عرض ${formatNumber(filteredEntries.length, { useArabicIndicDigits: useArabicIndic })} من ${formatNumber(data.entries.length, { useArabicIndicDigits: useArabicIndic })} متسابق`
                : `Showing ${filteredEntries.length} of ${data.entries.length} contestants`}
            </span>
            <span>
              {lang === 'ar'
                ? 'اضغط على أي لاعب لتتبع مساره في شجرة البطولة'
                : 'Select any player to trace their path on the bracket'}
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لا توجد نتائج مطابقة للبحث'
                  : 'No contestants match these filters'
              }
              description={
                lang === 'ar'
                  ? 'جرّب تعديل كلمة البحث أو اختيار جميع الحالات لعرض القائمة الكاملة.'
                  : 'Try clearing the search query or switching back to all statuses.'
              }
              action={
                <Button
                  variant="red"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setRoundFilter('overall');
                  }}
                >
                  {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                </Button>
              }
            />
          ) : (
            <LayoutGroup id="public-leaderboard-rows">
              <div className="space-y-2.5">
                {filteredEntries.map((entry) => {
                  const statusMeta = getPlayerStatusMeta(entry.player.status, lang);
                  const shift = rankShifts[entry.player.id] ?? 0;
                  const delta = recentDeltas[entry.player.id] ?? null;

                  return (
                    <Link
                      key={entry.player.id}
                      href={`/bracket?player=${encodeURIComponent(entry.player.id)}`}
                      className="block rounded-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                    >
                      <div className="relative">
                        <ScoreboardRow
                          rank={entry.rank}
                          name={localizeText(
                            lang,
                            entry.player.fullName,
                            entry.player.fullNameAr
                          )}
                          nickname={localizeText(
                            lang,
                            entry.player.nickname,
                            entry.player.nicknameAr
                          )}
                          avatarSeed={entry.player.avatarSeed}
                          score={entry.totalPoints}
                          recentDelta={delta}
                          gamesPlayed={entry.gamesPlayed}
                          wins={entry.wins}
                          statusLabel={statusMeta.label}
                          isHighlighted={entry.rank <= 3 || shift !== 0}
                          useArabicIndicDigits={useArabicIndic}
                          appearance="calm"
                        />

                        {shift !== 0 && (
                          <span
                            className={cn(
                              'pointer-events-none absolute -top-2 end-4 inline-flex items-center gap-0.5 rounded-pill border-2 border-outline px-2 py-0.5 text-[11px] font-black shadow-sticker-sm',
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
                    </Link>
                  );
                })}
              </div>
            </LayoutGroup>
          )}
        </div>
      </section>
    </div>
  );
}
