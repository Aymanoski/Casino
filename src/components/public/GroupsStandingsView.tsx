'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Hash,
  MonitorPlay,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { ComputedGroupStandings } from '@/lib/engine';
import {
  groupRepo,
  matchRepo,
  playerRepo,
  scoreRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Group, Match, Player, Settings } from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useResponsiveColumns,
  VirtualList,
  type VirtualListHandle,
} from '@/components/ui/virtual-list';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';
import { formatPublicDateTime } from './publicFormatters';

const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

type PublicGroupFilter = 'all' | 'live' | 'complete' | 'cycle' | 'needsTieBreak' | 'upcoming';

export interface GroupsStandingsViewProps {
  /** When true, hides the full PublicPageHero (used when embedded as Group Stage tab inside /bracket) */
  embedded?: boolean;
}

export function GroupsStandingsView({ embedded = false }: GroupsStandingsViewProps) {
  const { lang } = useI18n();
  const searchParams = useSearchParams();

  const [groups, setGroups] = useState<Group[]>([]);
  const [standings, setStandings] = useState<ComputedGroupStandings[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totalsByMatch, setTotalsByMatch] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<PublicGroupFilter>('all');
  const [jumpInput, setJumpInput] = useState('');
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const virtualRef = useRef<VirtualListHandle | null>(null);
  const loadSeqRef = useRef(0);
  const initializedQueryRef = useRef(false);
  const cols = useResponsiveColumns({ base: 1, md: 2, lg: 3 });

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      try {
        const [allGroups, allStandings, groupMatches, allPlayers, appSettings] =
          await Promise.all([
            groupRepo.list(),
            groupRepo.listAllStandings(),
            matchRepo.list({ type: 'group', viewerRole: 'visitor' }),
            playerRepo.list({ includeHost: false }),
            settingsRepo.get(),
          ]);

        const activeIds = groupMatches
          .filter((m) => m.status !== 'scheduled')
          .map((m) => m.id);
        const totals =
          activeIds.length > 0 ? await scoreRepo.getTotalsForMatches(activeIds) : {};

        if (seq !== loadSeqRef.current) return;
        setGroups(allGroups);
        setStandings(allStandings);
        setMatches(groupMatches);
        setPlayers(allPlayers);
        setSettings(appSettings);
        setTotalsByMatch(totals);
        setError(null);
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذر تحميل دور المجموعات.'
              : 'Failed to load group standings.'
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
    return unsub;
  }, [loadAll]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const standingsByGroup = useMemo(
    () => new Map(standings.map((s) => [s.groupId, s])),
    [standings]
  );
  const matchesByGroup = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      if (!m.groupId) continue;
      const list = map.get(m.groupId);
      if (list) list.push(m);
      else map.set(m.groupId, [m]);
    }
    return map;
  }, [matches]);

  const enriched = useMemo(() => {
    return groups.map((group) => {
      const gs = standingsByGroup.get(group.id);
      const gMatches = matchesByGroup.get(group.id) ?? [];
      const hasLive = gMatches.some(
        (m) => m.status === 'live' || m.status === 'needsTieBreak'
      );
      const hasStarted = gMatches.some((m) => m.status !== 'scheduled');
      return { group, gs, gMatches, hasLive, hasStarted };
    });
  }, [groups, standingsByGroup, matchesByGroup]);

  // Honor ?group=7 deep-link once loaded
  useEffect(() => {
    if (initializedQueryRef.current || enriched.length === 0) return;
    const qGroup = searchParams.get('group');
    if (qGroup) {
      const num = parseInt(qGroup.replace(/[^\d]/g, ''), 10);
      const idx = enriched.findIndex(
        (e) => e.group.number === num || e.group.id === qGroup
      );
      if (idx !== -1) {
        setSelectedGroupId(enriched[idx].group.id);
        setHighlightedGroupId(enriched[idx].group.id);
        window.setTimeout(() => virtualRef.current?.scrollToIndex(idx, 'smooth'), 50);
      }
    }
    initializedQueryRef.current = true;
  }, [enriched, searchParams]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(deferredSearch);
    return enriched.filter(({ group, gs, hasLive, hasStarted }) => {
      if (statusFilter === 'live' && !hasLive) return false;
      if (statusFilter === 'complete' && !gs?.isComplete) return false;
      if (statusFilter === 'cycle' && !gs?.hasThreeWayCycle) return false;
      if (statusFilter === 'needsTieBreak' && !gs?.needsTieBreakMatch) return false;
      if (statusFilter === 'upcoming' && (hasStarted || gs?.isComplete)) return false;

      if (!q) return true;
      const names = group.playerIds
        .map((pid) => {
          const p = playerMap.get(pid);
          return p ? `${p.fullName} ${p.fullNameAr} ${p.nickname} ${p.nicknameAr} #${p.seed}` : pid;
        })
        .join(' ');
      const hay = normalizeSearchText(
        `${group.nameEn} ${group.nameAr} group ${group.number} #${group.number} ${group.number} ${names}`
      );
      return hay.includes(q);
    });
  }, [enriched, statusFilter, deferredSearch, playerMap]);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpInput.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num < 1) return;
    let idx = filtered.findIndex((g) => g.group.number === num);
    if (idx === -1) {
      setStatusFilter('all');
      setSearchQuery('');
      idx = enriched.findIndex((g) => g.group.number === num);
    }
    if (idx === -1) return;
    const target = enriched[idx];
    setHighlightedGroupId(target.group.id);
    window.setTimeout(() => virtualRef.current?.scrollToIndex(idx, 'smooth'), 40);
    window.setTimeout(() => {
      setHighlightedGroupId((curr) => (curr === target.group.id ? null : curr));
    }, 3200);
  };

  const inspected = useMemo(() => {
    if (!selectedGroupId) return null;
    return enriched.find((e) => e.group.id === selectedGroupId) ?? null;
  }, [selectedGroupId, enriched]);

  const completedGroupsCount = useMemo(
    () => standings.filter((s) => s.isComplete).length,
    [standings]
  );
  const liveGroupMatchesCount = useMemo(
    () => matches.filter((m) => m.status === 'live' || m.status === 'needsTieBreak').length,
    [matches]
  );

  const content = (
    <div className="space-y-6">
      {error && <PublicErrorBanner message={error} onRetry={() => loadAll(true)} />}

      {/* Search + Jump to Group # + Status Filters */}
      <div className="space-y-3 rounded-card border-2 border-outline bg-white p-4 shadow-sticker">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'ابحث عن لاعب، لقب، أو رقم المجموعة (1..240)...'
                  : 'Search player name, nickname, or group #...'
              }
              aria-label={lang === 'ar' ? 'بحث في المجموعات' : 'Search groups'}
              className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper ps-9 pe-9 text-base sm:text-sm text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                className="absolute end-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-paper-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <form onSubmit={handleJump} className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48 sm:flex-none">
              <Hash
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                type="number"
                min={1}
                max={Math.max(1, groups.length)}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? `مجموعة 1..${groups.length}`
                    : `Group 1..${groups.length}`
                }
                aria-label={lang === 'ar' ? 'انتقال سريع لمجموعة' : 'Jump to group #'}
                className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper ps-8 pe-3 text-base sm:text-sm font-bold tabular-nums text-ink focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button type="submit" variant="red" size="sm">
              {lang === 'ar' ? 'انتقال' : 'Jump'}
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', en: 'All Groups', ar: 'الكل' },
                { id: 'live', en: 'Live Now', ar: 'مباشر' },
                { id: 'complete', en: 'Completed', ar: 'مكتملة' },
                { id: 'cycle', en: '3-Way Cycle', ar: 'دورة ثلاثية' },
                { id: 'needsTieBreak', en: 'Tie-Break', ar: 'فاصلة' },
                { id: 'upcoming', en: 'Upcoming', ar: 'قادمة' },
              ] as Array<{ id: PublicGroupFilter; en: string; ar: string }>
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                aria-pressed={statusFilter === pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={cn(
                  'min-h-[44px] rounded-pill border-2 px-3 py-1 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                  statusFilter === pill.id
                    ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                    : 'border-border-paper bg-paper text-red-900 hover:border-red-600/40'
                )}
              >
                {lang === 'ar' ? pill.ar : pill.en}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold tabular-nums text-ink-muted">
            {lang === 'ar'
              ? `${formatNumber(filtered.length, { useArabicIndicDigits: useArabicIndic })} / ${formatNumber(groups.length, { useArabicIndicDigits: useArabicIndic })} مجموعة`
              : `${formatNumber(filtered.length, { useArabicIndicDigits: useArabicIndic })} / ${formatNumber(groups.length, { useArabicIndicDigits: useArabicIndic })} groups`}
          </span>
        </div>
      </div>

      {/* Virtualized Group Cards Grid */}
      <VirtualList
        ref={virtualRef}
        items={filtered}
        columns={cols}
        rowHeight={238}
        height={640}
        gap={14}
        ariaLabel={lang === 'ar' ? 'جدول مجموعات البطولة' : 'Group standings cards'}
        getKey={(item) => item.group.id}
        emptyState={
          <EmptyState
            title={lang === 'ar' ? 'لا توجد مجموعات مطابقة' : 'No matching groups'}
            description={
              lang === 'ar'
                ? 'عدّل نص البحث أو اختر «الكل».'
                : 'Adjust your search or reset filters to view all groups.'
            }
          />
        }
        renderItem={({ group, gs, gMatches, hasLive }) => {
          const isHighlighted = highlightedGroupId === group.id;
          return (
            <button
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
              className={cn(
                'flex h-full w-full flex-col justify-between rounded-card border-2 bg-white p-4 text-start transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                isHighlighted
                  ? 'border-blue-600 ring-[3px] ring-blue-500 shadow-sticker'
                  : hasLive
                    ? 'border-outline ring-2 ring-gold-400 shadow-sticker'
                    : 'border-outline/80 shadow-sticker-sm hover:-translate-y-0.5'
              )}
            >
              <div className="space-y-2.5 w-full">
                <div className="flex items-center justify-between gap-2 border-b border-border-paper pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-7 min-w-[30px] items-center justify-center rounded-pill border-2 border-outline bg-red-600 px-2 font-score text-sm font-black text-white tabular-nums">
                      #{formatNumber(group.number, { useArabicIndicDigits: useArabicIndic })}
                    </span>
                    <span className="truncate font-display text-base text-red-900">
                      {localizeText(lang, group.nameEn, group.nameAr)}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {hasLive ? (
                      <LiveBadge size="sm" surface="paper" />
                    ) : gs?.needsTieBreakMatch ? (
                      <Badge variant="gold">{lang === 'ar' ? 'فاصلة' : 'TIE-BREAK'}</Badge>
                    ) : gs?.isComplete ? (
                      <Badge variant="positive">{lang === 'ar' ? 'مكتملة' : 'DONE'}</Badge>
                    ) : (
                      <Badge variant="info">{lang === 'ar' ? 'قادمة' : 'OPEN'}</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {(gs?.rows ?? []).slice(0, 4).map((row) => {
                    const p = playerMap.get(row.playerId);
                    const seatIdx = group.playerIds.indexOf(row.playerId);
                    return (
                      <div
                        key={row.playerId}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-input border px-2.5 py-1.5 text-xs',
                          row.qualified
                            ? 'border-outline bg-gold-200/65 font-bold text-red-900'
                            : 'border-border-paper bg-paper text-ink'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-paper bg-white font-score text-[11px] font-black text-red-900">
                            {SEAT_LETTERS[seatIdx] ?? row.rank}
                          </span>
                          <span className="truncate font-bold">
                            {p ? localizeText(lang, p.fullName, p.fullNameAr) : row.playerId}
                          </span>
                          {row.qualified && (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                          <span className="font-score text-sm font-black text-red-900">
                            {formatNumber(row.groupPoints, { useArabicIndicDigits: useArabicIndic })}
                          </span>
                          <span className="text-[11px] text-ink-muted">
                            ({row.pointsDiff >= 0 ? `+${row.pointsDiff}` : row.pointsDiff})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex w-full items-center justify-between border-t border-border-paper pt-2 text-[11px] font-bold text-ink-muted">
                <span>
                  {lang === 'ar'
                    ? `${gs?.regularMatchesFinished ?? 0}/${gs?.regularMatchesTotal ?? gMatches.length} مباريات`
                    : `${gs?.regularMatchesFinished ?? 0}/${gs?.regularMatchesTotal ?? gMatches.length} matches`}
                </span>
                <span className="text-red-700">
                  {gs?.hasThreeWayCycle
                    ? lang === 'ar'
                      ? 'دورة ثلاثية 3-3-3'
                      : '3-Way Cycle'
                    : lang === 'ar'
                      ? 'عرض التفاصيل ←'
                      : 'Inspect →'}
                </span>
              </div>
            </button>
          );
        }}
      />

      {/* Public Group Standings & 1v1 Matches Inspector Dialog */}
      <Dialog
        open={Boolean(inspected)}
        onOpenChange={(o) => {
          if (!o) setSelectedGroupId(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
          {inspected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-2xl text-red-900">
                  <span>
                    {localizeText(lang, inspected.group.nameEn, inspected.group.nameAr)}
                  </span>
                  {inspected.gs?.isComplete && (
                    <Badge variant="positive" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'مكتملة' : 'Complete'}</span>
                    </Badge>
                  )}
                  {inspected.gs?.hasThreeWayCycle && (
                    <Badge variant="gold">
                      {lang === 'ar' ? 'دورة ثلاثية 3-3-3' : '3-Way 3-3-3 Cycle'}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {lang === 'ar'
                    ? `تأهل أعلى ${settings?.tournament.advancePerGroup ?? 1} إلى الأدوار الإقصائية · الفوز = ${settings?.tournament.pointsPerGroupWin ?? 3} نقاط (لا يوجد تعادل).`
                    : `Top ${settings?.tournament.advancePerGroup ?? 1} advance to Knockouts · Win = ${settings?.tournament.pointsPerGroupWin ?? 3} group pts (zero draws).`}
                </DialogDescription>
              </DialogHeader>

              {inspected.gs?.needsTieBreakMatch && (
                <div className="flex items-center gap-2 rounded-input border-2 border-gold-500 bg-gold-200/40 p-3 text-xs font-bold text-red-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'تساوي تام في جميع المعايير — تُحسم المجموعة بمباراة فاصلة.'
                      : 'All tie-break criteria are level — decided by an automatic tie-break match.'}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto rounded-card border border-border-paper">
                <table className="w-full text-start text-xs sm:text-sm">
                  <thead className="border-b border-border-paper bg-paper-2 text-red-900">
                    <tr>
                      <th className="px-3 py-2 text-start font-extrabold">#</th>
                      <th className="px-3 py-2 text-start font-extrabold">
                        {lang === 'ar' ? 'المتسابق' : 'Player'}
                      </th>
                      <th className="px-2 py-2 text-center font-extrabold">
                        {lang === 'ar' ? 'لعب' : 'MP'}
                      </th>
                      <th className="px-2 py-2 text-center font-extrabold">
                        {lang === 'ar' ? 'ف-خ' : 'W–L'}
                      </th>
                      <th className="px-2 py-2 text-center font-extrabold">
                        {lang === 'ar' ? 'نقاط' : 'Pts'}
                      </th>
                      <th className="px-2 py-2 text-center font-extrabold">
                        {lang === 'ar' ? 'فارق' : 'Diff'}
                      </th>
                      <th className="px-2 py-2 text-center font-extrabold">
                        {lang === 'ar' ? 'بطاقات' : 'Cards'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inspected.gs?.rows ?? []).map((row) => {
                      const p = playerMap.get(row.playerId);
                      return (
                        <tr
                          key={row.playerId}
                          className={cn(
                            'border-b border-border-paper last:border-0',
                            row.qualified ? 'bg-gold-200/50 font-bold' : 'bg-white'
                          )}
                        >
                          <td className="px-3 py-2.5 font-score text-base font-black text-red-900 tabular-nums">
                            {formatNumber(row.rank, { useArabicIndicDigits: useArabicIndic })}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar
                                name={p ? localizeText(lang, p.fullName, p.fullNameAr) : row.playerId}
                                avatarSeed={p?.avatarSeed ?? row.playerId}
                                size="xs"
                              />
                              <span className="font-bold text-red-900">
                                {p ? localizeText(lang, p.fullName, p.fullNameAr) : row.playerId}
                              </span>
                              {row.qualified && (
                                <Badge variant="gold" className="text-[10px]">
                                  {lang === 'ar' ? 'متأهل' : 'ADV'}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums">{row.matchesPlayed}</td>
                          <td className="px-2 py-2.5 text-center tabular-nums">
                            {row.wins}–{row.losses}
                          </td>
                          <td className="px-2 py-2.5 text-center font-score text-base font-black text-red-900 tabular-nums">
                            {row.groupPoints}
                          </td>
                          <td className="px-2 py-2.5 text-center font-bold tabular-nums">
                            {row.pointsDiff >= 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                              <span className="rounded bg-gold-300 px-1.5 py-0.5 text-red-900">
                                Y:{row.yellowCards}
                              </span>
                              <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">
                                R:{row.redCards}
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-base text-red-900">
                  {lang === 'ar'
                    ? 'مباريات الدوري (1 ضد 1)'
                    : '1v1 Round-Robin Matches'}
                </h4>
                {inspected.gMatches.map((m) => {
                  const totals = totalsByMatch[m.id] ?? {};
                  const winnerId = m.result?.winnerId ?? m.winnerPlayerId;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-border-paper bg-paper p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-red-900">
                          <span>{localizeText(lang, m.tableName, m.tableNameAr)}</span>
                          <Badge variant="muted">
                            {lang === 'ar' ? `طاولة #${m.tableNumber}` : `Table #${m.tableNumber}`}
                          </Badge>
                          {m.result?.type === 'walkover' && (
                            <Badge variant="negative">
                              {lang === 'ar' ? 'انسحاب' : 'W/O'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {m.participants.map((part, idx) => {
                            const pl = part.playerId ? playerMap.get(part.playerId) : null;
                            const isWin = m.status === 'finished' && winnerId === part.playerId;
                            return (
                              <React.Fragment key={part.playerId ?? idx}>
                                {idx > 0 && <span className="text-ink-muted font-bold">vs</span>}
                                <span
                                  className={cn(
                                    'rounded-pill px-2 py-0.5',
                                    isWin
                                      ? 'bg-gold-300/75 font-extrabold text-red-900'
                                      : 'bg-white font-semibold'
                                  )}
                                >
                                  {pl
                                    ? localizeText(lang, pl.fullName, pl.fullNameAr)
                                    : part.playerId ?? 'TBD'}
                                  {m.status !== 'scheduled' && part.playerId
                                    ? ` (${totals[part.playerId] ?? 0})`
                                    : ''}
                                </span>
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {formatPublicDateTime(m.scheduledAt, lang, useArabicIndic)}
                        </div>
                      </div>

                      {(m.status === 'live' || m.status === 'finished') && (
                        <Button asChild variant="calm" size="sm">
                          <Link href={`/screen/${m.id}`} className="gap-1">
                            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  if (loading && groups.length === 0) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-10 space-y-6">
        <Skeleton className="h-14 w-80" />
        <Skeleton shape="card" className="h-96 w-full" />
      </div>
    );
  }

  if (embedded) return content;

  return (
    <div className="pb-16">
      <PublicPageHero
        title={lang === 'ar' ? 'دور المجموعات والترتيب' : 'Group Stage & Standings'}
        subtitle={
          lang === 'ar'
            ? `${formatNumber(groups.length, { useArabicIndicDigits: useArabicIndic })} مجموعة · دوري (1 ضد 1) · يتأهل أعلى ${formatNumber(settings?.tournament.advancePerGroup ?? 1, { useArabicIndicDigits: useArabicIndic })} إلى شجرة الإقصاء.`
            : `${formatNumber(groups.length, { useArabicIndicDigits: useArabicIndic })} groups · 1v1 round-robin · Top ${formatNumber(settings?.tournament.advancePerGroup ?? 1, { useArabicIndicDigits: useArabicIndic })} per group qualify for Knockouts.`
        }
        actions={
          <Button asChild variant="primary" size="md" className="gap-2">
            <Link href="/bracket">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'شجرة الإقصائيات' : 'Knockout Bracket'}</span>
            </Link>
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-white">
            <Badge variant="gold">
              {lang === 'ar'
                ? `${formatNumber(completedGroupsCount, { useArabicIndicDigits: useArabicIndic })} / ${formatNumber(groups.length, { useArabicIndicDigits: useArabicIndic })} مكتملة`
                : `${formatNumber(completedGroupsCount, { useArabicIndicDigits: useArabicIndic })} / ${formatNumber(groups.length, { useArabicIndicDigits: useArabicIndic })} Complete`}
            </Badge>
            {liveGroupMatchesCount > 0 && (
              <LiveBadge size="sm" surface="stage" />
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-content-wide px-safe pt-8">{content}</div>
    </div>
  );
}
