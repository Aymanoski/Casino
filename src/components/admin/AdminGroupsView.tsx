'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Dice5,
  Hash,
  Lock,
  MonitorPlay,
  Search,
  Shuffle,
  Sparkles,
  Tablet,
  Trophy,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import type { ComputedGroupStandings, TournamentProgressSummary } from '@/lib/engine';
import {
  groupRepo,
  matchRepo,
  playerRepo,
  scoreRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import type { Group, Match, Player, Settings, User } from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  useResponsiveColumns,
  VirtualList,
  type VirtualListHandle,
} from '@/components/ui/virtual-list';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { formatAdminTimeShort } from './adminFormatters';

const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

type GroupFilterStatus =
  | 'all'
  | 'live'
  | 'complete'
  | 'needsTieBreak'
  | 'cycle'
  | 'upcoming';

function getTieBreakLabel(
  reason: ComputedGroupStandings['tieBreakApplied'],
  lang: 'en' | 'ar'
): string | null {
  switch (reason) {
    case 'h2h':
      return lang === 'ar' ? 'حُسم بالمواجهات المباشرة' : 'Resolved by H2H';
    case 'pointsDiff':
      return lang === 'ar' ? 'حُسم بفارق النقاط' : 'Resolved by Points Diff';
    case 'cards':
      return lang === 'ar' ? 'حُسم بأقل بطاقات' : 'Resolved by Fewer Cards';
    case 'tieBreakMatch':
      return lang === 'ar' ? 'حُسم بمباراة فاصلة' : 'Resolved by Tie-Break Match';
    case 'deadlock':
      return lang === 'ar' ? 'تعادل تام — يحتاج مباراة فاصلة' : 'Level Deadlock — Tie-Break Required';
    default:
      return null;
  }
}

export function AdminGroupsView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [standings, setStandings] = useState<ComputedGroupStandings[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [progress, setProgress] = useState<TournamentProgressSummary | null>(null);
  const [totalsByMatch, setTotalsByMatch] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Jump-to-Group
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<GroupFilterStatus>('all');
  const [jumpInput, setJumpInput] = useState('');
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);

  // Draw / Manual Move state (pre-tournament)
  const [busyAction, setBusyAction] = useState(false);
  const [movingPlayer, setMovingPlayer] = useState<{
    playerId: string;
    sourceGroupId: string;
    sourceGroupNumber: number;
  } | null>(null);

  // Group Inspector Dialog
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [moveDialogTarget, setMoveDialogTarget] = useState<{
    playerId: string;
    sourceGroupId: string;
    sourceGroupNumber: number;
  } | null>(null);
  const [moveTargetGroupNum, setMoveTargetGroupNum] = useState<string>('2');
  const [swapTargetPlayerId, setSwapTargetPlayerId] = useState<string>('');

  const virtualRef = useRef<VirtualListHandle | null>(null);
  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const cols = useResponsiveColumns({ base: 1, md: 2, xl: 3 });

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
        allGroups,
        allStandings,
        groupMatches,
        allPlayers,
        allUsers,
        appSettings,
        prog,
      ] = await Promise.all([
        groupRepo.list(),
        groupRepo.listAllStandings(),
        matchRepo.list({ type: 'group' }),
        playerRepo.list({ includeHost: false }),
        userRepo.list(),
        settingsRepo.get(),
        groupRepo.getTournamentProgress(),
      ]);

      // Fetch totals only for matches that have started or finished (super fast at 720!)
      const activeMatchIds = groupMatches
        .filter((m) => m.status !== 'scheduled')
        .map((m) => m.id);
      const totalsMap =
        activeMatchIds.length > 0
          ? await scoreRepo.getTotalsForMatches(activeMatchIds)
          : {};

      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setGroups(allGroups);
      setStandings(allStandings);
      setMatches(groupMatches);
      setPlayers(allPlayers);
      setUsers(allUsers);
      setSettings(appSettings);
      setProgress(prog);
      setTotalsByMatch(totalsMap);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل بيانات المجموعات والقرعة.'
          : 'Failed to load tournament groups and standings.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'bracket.updated' ||
        msg.event === 'tournament.generated' ||
        msg.event === 'score.changed' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndicDigits = settings?.useArabicIndicDigits ?? false;
  const useArabicIndic = useArabicIndicDigits;
  const drawLocked = Boolean(progress?.started);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
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

  const enrichedGroups = useMemo(() => {
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

  const filteredGroups = useMemo(() => {
    const q = normalizeSearchText(deferredSearch);
    return enrichedGroups.filter(({ group, gs, hasLive, hasStarted }) => {
      if (statusFilter === 'live' && !hasLive) return false;
      if (statusFilter === 'complete' && !gs?.isComplete) return false;
      if (statusFilter === 'needsTieBreak' && !gs?.needsTieBreakMatch) return false;
      if (statusFilter === 'cycle' && !gs?.hasThreeWayCycle) return false;
      if (statusFilter === 'upcoming' && (hasStarted || gs?.isComplete)) return false;

      if (!q) return true;
      const memberNames = group.playerIds
        .map((pid) => {
          const p = playerMap.get(pid);
          return p ? `${p.fullName} ${p.fullNameAr} ${p.nickname} ${p.nicknameAr} #${p.seed}` : pid;
        })
        .join(' ');
      const hay = normalizeSearchText(
        `${group.nameEn} ${group.nameAr} group ${group.number} #${group.number} ${group.number} ${memberNames}`
      );
      return hay.includes(q);
    });
  }, [enrichedGroups, statusFilter, deferredSearch, playerMap]);

  const handleJumpToGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpInput.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num < 1) return;
    // Reset filters if target isn't in current filtered slice
    let idx = filteredGroups.findIndex((g) => g.group.number === num);
    if (idx === -1) {
      setStatusFilter('all');
      setSearchQuery('');
      idx = enrichedGroups.findIndex((g) => g.group.number === num);
    }
    if (idx === -1) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? `المجموعة #${num} غير موجودة` : `Group #${num} not found`,
      });
      return;
    }
    const target = enrichedGroups[idx];
    setHighlightedGroupId(target.group.id);
    window.setTimeout(() => {
      virtualRef.current?.scrollToIndex(idx, 'smooth');
    }, 30);
    window.setTimeout(() => {
      setHighlightedGroupId((curr) => (curr === target.group.id ? null : curr));
    }, 3200);
  };

  const handleRedraw = async (preserveSeedOrder = false) => {
    if (!user) return;
    setBusyAction(true);
    try {
      const res = await groupRepo.redraw(user.id, { preserveSeedOrder });
      setMovingPlayer(null);
      await loadData();
      toast({
        variant: 'positive',
        title: preserveSeedOrder
          ? lang === 'ar'
            ? 'تم توزيع المجموعات حسب التصنيف'
            : 'Groups drawn by seed order'
          : lang === 'ar'
            ? 'تمت إعادة القرعة العشوائية بنجاح'
            : 'Random group draw complete',
        description:
          lang === 'ar'
            ? `${res.groups.length} مجموعة و${res.matches.length} مباراة مجدولة بدون تعارض.`
            : `${res.groups.length} groups and ${res.matches.length} matches auto-scheduled conflict-free.`,
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذرت إعادة القرعة' : 'Group draw failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleExecuteMove = async (
    playerId: string,
    targetGroupId: string,
    swapWithPlayerId?: string
  ) => {
    if (!user) return;
    setBusyAction(true);
    try {
      await groupRepo.movePlayer({
        playerId,
        targetGroupId,
        swapWithPlayerId,
        actorUserId: user.id,
      });
      setMovingPlayer(null);
      setMoveDialogTarget(null);
      await loadData();
      toast({
        variant: 'positive',
        title: swapWithPlayerId
          ? lang === 'ar'
            ? 'تم تبديل اللاعبين وإعادة جدولة مبارياتهما'
            : 'Players swapped & matches regenerated'
          : lang === 'ar'
            ? 'تم نقل اللاعب وإعادة جدولة المجموعتين'
            : 'Player moved & matches regenerated',
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر نقل اللاعب' : 'Could not move player',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleCreateManualTieBreak = async (groupId: string, tiedIds: string[]) => {
    if (!user || tiedIds.length < 2) return;
    setBusyAction(true);
    try {
      await groupRepo.createTieBreakMatch(groupId, tiedIds, user.id);
      await loadData();
      toast({
        variant: 'gold',
        title: lang === 'ar' ? 'تم إنشاء مباراة فاصلة للمجموعة' : 'Group tie-break match created',
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر إنشاء المباراة الفاصلة' : 'Failed to create tie-break',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const statItems = useMemo(() => {
    const completeCount = standings.filter((s) => s.isComplete).length;
    const tbCount = standings.filter((s) => s.needsTieBreakMatch).length;
    const liveCount = matches.filter(
      (m) => m.status === 'live' || m.status === 'needsTieBreak'
    ).length;
    const qualifiedCount = standings.reduce(
      (sum, s) => sum + s.qualifierPlayerIds.length,
      0
    );
    return [
      {
        id: 'total-groups',
        value: groups.length,
        label: lang === 'ar' ? 'إجمالي المجموعات' : 'Total Groups',
        detail: `${matches.length} ${lang === 'ar' ? 'مباراة 1 ضد 1' : '1v1 matches'}`,
        tone: 'red' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'completed-groups',
        value: completeCount,
        label: lang === 'ar' ? 'مجموعات مكتملة' : 'Groups Complete',
        detail: `${qualifiedCount} ${lang === 'ar' ? 'متأهل' : 'qualified'}`,
        tone: 'gold' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'live-group-matches',
        value: liveCount,
        label: lang === 'ar' ? 'مباريات مباشرة' : 'Live Matches',
        detail: lang === 'ar' ? 'دور المجموعات' : 'Active on tables',
        tone: 'live' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'tb-groups',
        value: tbCount,
        label: lang === 'ar' ? 'تحتاج حسم فاصل' : 'Needs Tie-Break',
        detail: lang === 'ar' ? 'تعادل تام بالمعايير' : 'Level cutoff ties',
        tone: 'blue' as const,
        useArabicIndicDigits: useArabicIndic,
      },
    ];
  }, [groups.length, standings, matches, lang, useArabicIndic]);

  const inspectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return enrichedGroups.find((e) => e.group.id === selectedGroupId) ?? null;
  }, [selectedGroupId, enrichedGroups]);

  const moveDialogTargetGroup = useMemo(() => {
    const n = parseInt(moveTargetGroupNum, 10);
    return groups.find((g) => g.number === n) ?? null;
  }, [groups, moveTargetGroupNum]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton shape="card" className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'المجموعات والقرعة والترتيب' : 'Groups, Draw & Standings'}
        description={
          lang === 'ar'
            ? 'قرعة عشوائية وإعادة قرعة ونقل يدوي قبل انطلاق البطولة، مع جدول ترتيب فوري ومباريات الدوري (1 ضد 1) ومؤشرات حسم التعادل.'
            : 'Random draw, re-draw, and pre-tournament manual player swaps/moves across numbered groups (1..N, seats A/B/C), plus engine-derived standings and tie-break tracking.'
        }
        badge={
          drawLocked ? (
            <Badge variant="gold" className="gap-1">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'القرعة مقفلة (بدأت البطولة)' : 'DRAW LOCKED (IN PROGRESS)'}</span>
            </Badge>
          ) : (
            <Badge variant="positive" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'القرعة والنقل اليدوي متاحان' : 'DRAW & MANUAL MOVES OPEN'}</span>
            </Badge>
          )
        }
        actions={
          !drawLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmDialog
                title={lang === 'ar' ? 'إعادة القرعة العشوائية؟' : 'Run Random Group Re-Draw?'}
                description={
                  lang === 'ar'
                    ? `سيتم إعادة توزيع جميع اللاعبين عشوائياً على ${groups.length} مجموعة وتوليد مباريات الدوري (1 ضد 1) والجدول تلقائياً بدون تعارض.`
                    : `Randomly shuffles all contestants across ${groups.length} groups and regenerates all 1v1 round-robin matches and conflict-free schedules.`
                }
                confirmLabel={lang === 'ar' ? 'تنفيذ القرعة العشوائية' : 'Random Re-Draw'}
                cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                onConfirm={() => handleRedraw(false)}
                trigger={
                  <Button
                    type="button"
                    variant="red"
                    disabled={busyAction}
                    className="gap-2"
                  >
                    <Shuffle className="h-4 w-4" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'قرعة عشوائية' : 'Random Re-Draw'}</span>
                  </Button>
                }
              />
              <Button
                type="button"
                variant="calm"
                disabled={busyAction}
                onClick={() => handleRedraw(true)}
                className="gap-2"
              >
                <Dice5 className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'ترتيب بالتصنيف' : 'Seed Order'}</span>
              </Button>
            </div>
          ) : (
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/settings">
                {lang === 'ar' ? 'تعديل الإعدادات أو إعادة الضبط' : 'Settings / Reset'}
              </Link>
            </Button>
          )
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      {/* Active Manual Move / Swap Sticky Bar (Pre-Tournament Only) */}
      {movingPlayer && !drawLocked && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-blue-600 bg-blue-100 p-3.5 text-blue-800 shadow-sticker">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? `جاري نقل: ${localizeText(lang, playerMap.get(movingPlayer.playerId)?.fullName ?? '', playerMap.get(movingPlayer.playerId)?.fullNameAr ?? '')} (المجموعة ${movingPlayer.sourceGroupNumber}) — اضغط على أي لاعب آخر للتبديل أو «نقل هنا» في مجموعة أخرى.`
                : `Moving: ${localizeText(lang, playerMap.get(movingPlayer.playerId)?.fullName ?? '', playerMap.get(movingPlayer.playerId)?.fullNameAr ?? '')} (Group ${movingPlayer.sourceGroupNumber}) — tap any player in another group to swap, or click "Move Here".`}
            </span>
          </div>
          <Button
            type="button"
            variant="calm"
            size="sm"
            onClick={() => setMovingPlayer(null)}
            className="gap-1.5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{lang === 'ar' ? 'إلغاء النقل' : 'Cancel Move'}</span>
          </Button>
        </div>
      )}

      {/* Search + Jump to Group # + Status Filter Bar */}
      <div className="space-y-3 rounded-card border border-border-paper bg-white p-4 shadow-soft">
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
                  ? 'ابحث باسم اللاعب أو اللقب أو رقم المجموعة...'
                  : 'Search player name, nickname, #seed, or group number...'
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

          <form onSubmit={handleJumpToGroup} className="flex items-center gap-2">
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
                placeholder={lang === 'ar' ? `مجموعة 1..${groups.length}` : `Group 1..${groups.length}`}
                aria-label={lang === 'ar' ? 'انتقال سريع إلى رقم المجموعة' : 'Jump to group number'}
                className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper ps-8 pe-3 text-base sm:text-sm font-bold tabular-nums text-ink focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              {lang === 'ar' ? 'انتقال' : 'Jump'}
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', en: 'All Groups', ar: 'الكل' },
                { id: 'live', en: 'Live Now', ar: 'مباشر الآن' },
                { id: 'complete', en: 'Completed', ar: 'مكتملة' },
                { id: 'needsTieBreak', en: 'Needs Tie-Break', ar: 'تحتاج حسم' },
                { id: 'cycle', en: '3-Way Cycle', ar: 'دورة ثلاثية' },
                { id: 'upcoming', en: 'Upcoming', ar: 'قادمة' },
              ] as Array<{ id: GroupFilterStatus; en: string; ar: string }>
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
              ? `عرض ${formatNumber(filteredGroups.length, { useArabicIndicDigits })} من ${formatNumber(groups.length, { useArabicIndicDigits })} مجموعة (تمرير افتراضي)`
              : `Showing ${formatNumber(filteredGroups.length, { useArabicIndicDigits })} of ${formatNumber(groups.length, { useArabicIndicDigits })} groups (Virtualized)`}
          </span>
        </div>
      </div>

      {/* Virtualized Group Cards Grid (Handles 240+ groups effortlessly) */}
      <VirtualList
        ref={virtualRef}
        items={filteredGroups}
        columns={cols}
        rowHeight={drawLocked ? 244 : 264}
        height={640}
        gap={14}
        ariaLabel={lang === 'ar' ? 'قائمة مجموعات البطولة' : 'Tournament groups grid'}
        getKey={(item) => item.group.id}
        emptyState={
          <EmptyState
            title={lang === 'ar' ? 'لا توجد مجموعات مطابقة' : 'No matching groups'}
            description={
              lang === 'ar'
                ? 'جرّب تغيير البحث أو إزالة الفلتر.'
                : 'Adjust your search query or status filter to view groups.'
            }
          />
        }
        renderItem={({ group, gs, gMatches, hasLive }) => {
          const isHighlighted = highlightedGroupId === group.id;
          const tbLabel = gs ? getTieBreakLabel(gs.tieBreakApplied, lang) : null;
          const isMovingFromHere = movingPlayer?.sourceGroupId === group.id;

          return (
            <article
              className={cn(
                'flex h-full flex-col justify-between rounded-card border bg-white p-4 shadow-soft transition-all',
                isHighlighted
                  ? 'border-blue-600 ring-[3px] ring-blue-500 ring-offset-2'
                  : gs?.needsTieBreakMatch
                    ? 'border-2 border-gold-500 bg-gold-200/15'
                    : 'border-border-paper hover:border-red-600/40'
              )}
            >
              {/* Card Header */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-border-paper pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-pill border-2 border-outline bg-red-600 px-2 font-score text-sm font-black text-white tabular-nums">
                      #{formatNumber(group.number, { useArabicIndicDigits })}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base text-red-900">
                        {localizeText(lang, group.nameEn, group.nameAr)}
                      </h3>
                      <div className="text-[11px] font-semibold text-ink-muted tabular-nums">
                        {lang === 'ar'
                          ? `${formatNumber(gs?.regularMatchesFinished ?? 0, { useArabicIndicDigits })} / ${formatNumber(gs?.regularMatchesTotal ?? gMatches.length, { useArabicIndicDigits })} مباريات`
                          : `${formatNumber(gs?.regularMatchesFinished ?? 0, { useArabicIndicDigits })} / ${formatNumber(gs?.regularMatchesTotal ?? gMatches.length, { useArabicIndicDigits })} matches`}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {hasLive ? (
                      <LiveBadge size="sm" surface="paper" />
                    ) : gs?.needsTieBreakMatch ? (
                      <Badge variant="gold">
                        {lang === 'ar' ? 'فاصلة مطلوبة' : 'TIE-BREAK'}
                      </Badge>
                    ) : gs?.isComplete ? (
                      <Badge variant="positive">
                        {lang === 'ar' ? 'مكتملة' : 'COMPLETE'}
                      </Badge>
                    ) : (
                      <Badge variant="info">
                        {lang === 'ar' ? 'قادمة' : 'OPEN'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Seats A / B / C with Derived Points & Diff */}
                <div className="space-y-1.5">
                  {group.playerIds.map((pid, seatIdx) => {
                    const p = playerMap.get(pid);
                    const row = gs?.rows.find((r) => r.playerId === pid);
                    const letter = SEAT_LETTERS[seatIdx] ?? String(seatIdx + 1);
                    const isSelectedToMove = movingPlayer?.playerId === pid;
                    const canSwapClick =
                      !drawLocked &&
                      Boolean(movingPlayer) &&
                      movingPlayer?.playerId !== pid;

                    return (
                      <div
                        key={pid}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-input border px-2.5 py-1.5 text-xs',
                          row?.qualified
                            ? 'border-outline bg-gold-200/55 font-bold text-red-900'
                            : isSelectedToMove
                              ? 'border-blue-600 bg-blue-100 text-blue-800'
                              : 'border-border-paper bg-paper text-ink'
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-outline/40 bg-white font-score text-xs font-black text-red-900">
                            {letter}
                          </span>
                          <span className="truncate font-bold">
                            {p ? localizeText(lang, p.fullName, p.fullNameAr) : pid}
                          </span>
                          {row?.qualified && (
                            <Trophy
                              className="h-3.5 w-3.5 shrink-0 text-red-700"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                          <span className="font-score text-sm font-black text-red-900">
                            {formatNumber(row?.groupPoints ?? 0, { useArabicIndicDigits })}
                            <span className="ms-0.5 font-sans text-[10px] font-semibold text-ink-muted">
                              {lang === 'ar' ? 'ن' : 'pt'}
                            </span>
                          </span>
                          <span className="text-[11px] font-semibold text-ink-muted">
                            ({(row?.pointsDiff ?? 0) >= 0 ? `+${row?.pointsDiff ?? 0}` : row?.pointsDiff ?? 0})
                          </span>

                          {!drawLocked && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => {
                                if (canSwapClick && movingPlayer) {
                                  void handleExecuteMove(
                                    movingPlayer.playerId,
                                    group.id,
                                    pid
                                  );
                                } else if (isSelectedToMove) {
                                  setMovingPlayer(null);
                                } else {
                                  setMovingPlayer({
                                    playerId: pid,
                                    sourceGroupId: group.id,
                                    sourceGroupNumber: group.number,
                                  });
                                }
                              }}
                              aria-label={
                                canSwapClick
                                  ? lang === 'ar'
                                    ? 'تبديل مع هذا اللاعب'
                                    : 'Swap with this player'
                                  : lang === 'ar'
                                    ? 'نقل أو تبديل هذا اللاعب'
                                    : 'Move or swap this player'
                              }
                              className={cn(
                                'inline-flex h-7 min-w-[28px] items-center justify-center rounded-[8px] border px-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                                canSwapClick
                                  ? 'border-blue-600 bg-blue-500 text-white hover:bg-blue-600'
                                  : isSelectedToMove
                                    ? 'border-blue-600 bg-white text-blue-800'
                                    : 'border-border-paper bg-white text-ink-muted hover:text-red-900'
                              )}
                            >
                              {canSwapClick
                                ? lang === 'ar'
                                  ? 'تبديل'
                                  : 'Swap'
                                : (
                                  <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                                )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-paper pt-2">
                <div className="min-w-0 truncate text-[11px] font-bold text-ink-muted">
                  {gs?.hasThreeWayCycle
                    ? lang === 'ar'
                      ? 'دورة ثلاثية (3-3-3)'
                      : '3-Way 3-3-3 Cycle'
                    : tbLabel ?? (lang === 'ar' ? 'دوري 1 ضد 1' : '1v1 Round-Robin')}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {!drawLocked && movingPlayer && !isMovingFromHere && (
                    <Button
                      type="button"
                      variant="info"
                      size="sm"
                      disabled={busyAction}
                      onClick={() =>
                        handleExecuteMove(movingPlayer.playerId, group.id)
                      }
                      className="min-h-[36px] h-9 px-2.5 text-xs"
                    >
                      {lang === 'ar' ? 'نقل هنا' : 'Move Here'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="calm"
                    size="sm"
                    onClick={() => setSelectedGroupId(group.id)}
                    className="min-h-[36px] h-9 px-3 text-xs"
                  >
                    {lang === 'ar' ? 'الترتيب والمباريات' : 'Standings & Matches'}
                  </Button>
                </div>
              </div>
            </article>
          );
        }}
      />

      {/* Detailed Group Standings + 1v1 Matches Inspector Dialog */}
      <Dialog
        open={Boolean(inspectedGroup)}
        onOpenChange={(open) => {
          if (!open) setSelectedGroupId(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[88dvh] overflow-y-auto">
          {inspectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-2xl text-red-900">
                  <span>
                    {localizeText(
                      lang,
                      inspectedGroup.group.nameEn,
                      inspectedGroup.group.nameAr
                    )}
                  </span>
                  {inspectedGroup.gs?.isComplete && (
                    <Badge variant="positive" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'مكتملة' : 'Complete'}</span>
                    </Badge>
                  )}
                  {inspectedGroup.gs?.hasThreeWayCycle && (
                    <Badge variant="gold">
                      {lang === 'ar' ? 'دورة ثلاثية 3-3-3' : '3-Way 3-3-3 Cycle'}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {lang === 'ar'
                    ? 'معايير الترتيب: (1) نقاط المجموعة، (2) المواجهة المباشرة عند تعادل لاعبين فقط، (3) فارق النقاط، (4) أقل بطاقات حمراء ثم صفراء، (5) مباراة فاصلة تلقائية.'
                    : 'Tie-break order (§15.1): (1) Group pts, (2) H2H if exactly 2 tied, (3) Match points diff, (4) Fewer red then yellow cards, (5) Automatic tie-break match.'}
                </DialogDescription>
              </DialogHeader>

              {/* Tie-Break Deadlock Callout */}
              {inspectedGroup.gs?.needsTieBreakMatch && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-gold-500 bg-gold-200/40 p-3.5">
                  <div className="flex items-start gap-2.5 text-xs font-bold text-red-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-700" aria-hidden="true" />
                    <div>
                      <div>
                        {lang === 'ar'
                          ? 'تعادل تام على مقعد التأهل في جميع المعايير!'
                          : 'Level deadlock across the qualification cutoff!'}
                      </div>
                      <div className="font-medium text-ink-muted">
                        {lang === 'ar'
                          ? 'يُنشئ المحرك مباراة فاصلة تلقائياً عند انتهاء آخر مباراة، أو يمكنك تشغيل واحدة الآن.'
                          : 'An automatic tie-break match is spawned when level; you can also trigger one below.'}
                      </div>
                    </div>
                  </div>
                  {!inspectedGroup.gMatches.some(
                    (m) => m.isGroupTieBreak && m.status !== 'finished'
                  ) && (
                    <Button
                      type="button"
                      variant="red"
                      size="sm"
                      disabled={busyAction}
                      onClick={() =>
                        handleCreateManualTieBreak(
                          inspectedGroup.group.id,
                          inspectedGroup.gs!.tiedCutoffPlayerIds
                        )
                      }
                    >
                      {lang === 'ar' ? 'إنشاء مباراة فاصلة' : 'Spawn Tie-Break Match'}
                    </Button>
                  )}
                </div>
              )}

              {/* Standings Table */}
              <div className="overflow-x-auto rounded-card border border-border-paper">
                <table className="w-full text-start text-xs sm:text-sm">
                  <thead className="border-b border-border-paper bg-paper-2 text-red-900">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-extrabold">#</th>
                      <th className="px-3 py-2.5 text-start font-extrabold">
                        {lang === 'ar' ? 'اللاعب' : 'Player'}
                      </th>
                      <th className="px-2.5 py-2.5 text-center font-extrabold">
                        {lang === 'ar' ? 'لعب' : 'MP'}
                      </th>
                      <th className="px-2.5 py-2.5 text-center font-extrabold">
                        {lang === 'ar' ? 'ف-خ' : 'W–L'}
                      </th>
                      <th className="px-2.5 py-2.5 text-center font-extrabold">
                        {lang === 'ar' ? 'نقاط' : 'Pts'}
                      </th>
                      <th className="px-2.5 py-2.5 text-center font-extrabold">
                        {lang === 'ar' ? 'فارق' : 'Diff'}
                      </th>
                      <th className="px-2.5 py-2.5 text-center font-extrabold">
                        {lang === 'ar' ? 'بطاقات' : 'Cards'}
                      </th>
                      {!drawLocked && (
                        <th className="px-2.5 py-2.5 text-end font-extrabold">
                          {lang === 'ar' ? 'نقل' : 'Move'}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(inspectedGroup.gs?.rows ?? []).map((row) => {
                      const p = playerMap.get(row.playerId);
                      const seatIdx = inspectedGroup.group.playerIds.indexOf(row.playerId);
                      return (
                        <tr
                          key={row.playerId}
                          className={cn(
                            'border-b border-border-paper last:border-0',
                            row.qualified ? 'bg-gold-200/45 font-bold' : 'bg-white'
                          )}
                        >
                          <td className="px-3 py-2.5 font-score text-base font-black text-red-900 tabular-nums">
                            {formatNumber(row.rank, { useArabicIndicDigits })}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border-paper bg-paper font-score text-xs font-black text-red-900">
                                {SEAT_LETTERS[seatIdx] ?? '?'}
                              </span>
                              <PlayerAvatar
                                name={p ? localizeText(lang, p.fullName, p.fullNameAr) : row.playerId}
                                avatarSeed={p?.avatarSeed ?? row.playerId}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-bold text-red-900">
                                  <span className="truncate">
                                    {p ? localizeText(lang, p.fullName, p.fullNameAr) : row.playerId}
                                  </span>
                                  {row.qualified && (
                                    <Badge variant="gold" className="text-[10px]">
                                      {lang === 'ar' ? 'متأهل' : 'QUALIFIED'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 text-center tabular-nums">
                            {formatNumber(row.matchesPlayed, { useArabicIndicDigits })}
                          </td>
                          <td className="px-2.5 py-2.5 text-center tabular-nums">
                            {formatNumber(row.wins, { useArabicIndicDigits })}–
                            {formatNumber(row.losses, { useArabicIndicDigits })}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-score text-base font-black text-red-900 tabular-nums">
                            {formatNumber(row.groupPoints, { useArabicIndicDigits })}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-bold tabular-nums">
                            {row.pointsDiff >= 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                          </td>
                          <td className="px-2.5 py-2.5 text-center tabular-nums">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                              <span className="rounded bg-gold-300 px-1.5 py-0.5 text-red-900">
                                Y:{row.yellowCards}
                              </span>
                              <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">
                                R:{row.redCards}
                              </span>
                            </span>
                          </td>
                          {!drawLocked && (
                            <td className="px-2.5 py-2.5 text-end">
                              <Button
                                type="button"
                                variant="calm"
                                size="sm"
                                onClick={() => {
                                  const nextNum =
                                    inspectedGroup.group.number < groups.length
                                      ? inspectedGroup.group.number + 1
                                      : 1;
                                  setMoveTargetGroupNum(String(nextNum));
                                  setSwapTargetPlayerId('');
                                  setMoveDialogTarget({
                                    playerId: row.playerId,
                                    sourceGroupId: inspectedGroup.group.id,
                                    sourceGroupNumber: inspectedGroup.group.number,
                                  });
                                }}
                                className="min-h-[36px] h-9 px-2.5 text-xs"
                              >
                                {lang === 'ar' ? 'نقل' : 'Move'}
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Round-Robin 1v1 Matches List */}
              <div className="space-y-2.5">
                <h4 className="font-display text-base text-red-900">
                  {lang === 'ar'
                    ? `مباريات المجموعة (${inspectedGroup.gMatches.length})`
                    : `Group 1v1 Round-Robin Matches (${inspectedGroup.gMatches.length})`}
                </h4>
                <div className="space-y-2">
                  {inspectedGroup.gMatches.map((m) => {
                    const totals = totalsByMatch[m.id] ?? {};
                    const judge = userMap.get(m.judgeUserId);
                    const winnerId = m.result?.winnerId ?? m.winnerPlayerId;
                    return (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-border-paper bg-paper p-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-red-900 text-sm">
                              {localizeText(lang, m.tableName, m.tableNameAr)}
                            </span>
                            {m.isGroupTieBreak && (
                              <Badge variant="gold">
                                {lang === 'ar' ? 'فاصلة' : 'TIE-BREAK'}
                              </Badge>
                            )}
                            {m.result?.type === 'walkover' && (
                              <Badge variant="negative">
                                {lang === 'ar' ? 'فوز انسحابي' : 'WALKOVER'}
                              </Badge>
                            )}
                            <Badge variant="muted">
                              {lang === 'ar'
                                ? `طاولة #${m.tableNumber}`
                                : `Table #${m.tableNumber}`}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {m.participants.map((part, pIdx) => {
                              const pl = part.playerId ? playerMap.get(part.playerId) : null;
                              const isWin = m.status === 'finished' && winnerId === part.playerId;
                              return (
                                <React.Fragment key={part.playerId ?? pIdx}>
                                  {pIdx > 0 && (
                                    <span className="font-bold text-ink-muted">vs</span>
                                  )}
                                  <span
                                    className={cn(
                                      'rounded-pill px-2 py-0.5',
                                      isWin
                                        ? 'bg-gold-300/70 font-extrabold text-red-900'
                                        : 'bg-white font-semibold text-ink'
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
                            {formatAdminTimeShort(m.scheduledAt, lang, useArabicIndic)} ·{' '}
                            {judge ? localizeText(lang, judge.name, judge.nameAr) : m.judgeUserId}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button asChild variant="calm" size="sm">
                            <Link href={`/scorer/${m.id}`} className="gap-1">
                              <Tablet className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{lang === 'ar' ? 'التحكيم' : 'Score'}</span>
                            </Link>
                          </Button>
                          <Button asChild variant="calm" size="sm">
                            <Link href={`/screen/${m.id}`} className="gap-1">
                              <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{lang === 'ar' ? 'الشاشة' : 'Screen'}</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Accessible Keyboard Move / Swap Dialog (from Group Inspector) */}
      <Dialog
        open={Boolean(moveDialogTarget)}
        onOpenChange={(o) => {
          if (!o) setMoveDialogTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          {moveDialogTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-red-900">
                  {lang === 'ar' ? 'نقل أو تبديل لاعب بين المجموعات' : 'Move or Swap Player'}
                </DialogTitle>
                <DialogDescription>
                  {lang === 'ar'
                    ? `اللاعب: ${localizeText(lang, playerMap.get(moveDialogTarget.playerId)?.fullName ?? '', playerMap.get(moveDialogTarget.playerId)?.fullNameAr ?? '')} (المجموعة ${moveDialogTarget.sourceGroupNumber})`
                    : `Player: ${localizeText(lang, playerMap.get(moveDialogTarget.playerId)?.fullName ?? '', playerMap.get(moveDialogTarget.playerId)?.fullNameAr ?? '')} (Group ${moveDialogTarget.sourceGroupNumber})`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-ink">
                    {lang === 'ar'
                      ? `رقم المجموعة المستهدفة (1–${groups.length})`
                      : `Target Group Number (1–${groups.length})`}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={groups.length}
                    value={moveTargetGroupNum}
                    onChange={(e) => {
                      setMoveTargetGroupNum(e.target.value);
                      setSwapTargetPlayerId('');
                    }}
                    className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-bold text-ink focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {moveDialogTargetGroup && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-ink">
                      {lang === 'ar'
                        ? 'تبديل مع لاعب في هذه المجموعة (اختياري — يُحافظ على حجم المجموعتين)'
                        : 'Swap with a player in this group (optional — preserves group sizes)'}
                    </label>
                    <select
                      value={swapTargetPlayerId}
                      onChange={(e) => setSwapTargetPlayerId(e.target.value)}
                      className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">
                        {lang === 'ar'
                          ? '— نقل بدون تبديل (إضافة للمجموعة) —'
                          : '— Direct Move (add to group without swap) —'}
                      </option>
                      {moveDialogTargetGroup.playerIds
                        .filter((pid) => pid !== moveDialogTarget.playerId)
                        .map((pid, idx) => {
                          const p = playerMap.get(pid);
                          return (
                            <option key={pid} value={pid}>
                              [{SEAT_LETTERS[idx] ?? idx + 1}]{' '}
                              {p ? localizeText(lang, p.fullName, p.fullNameAr) : pid}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="calm"
                  onClick={() => setMoveDialogTarget(null)}
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  variant="red"
                  disabled={!moveDialogTargetGroup || busyAction}
                  onClick={() => {
                    if (!moveDialogTargetGroup) return;
                    void handleExecuteMove(
                      moveDialogTarget.playerId,
                      moveDialogTargetGroup.id,
                      swapTargetPlayerId || undefined
                    );
                  }}
                >
                  {swapTargetPlayerId
                    ? lang === 'ar'
                      ? 'تنفيذ التبديل'
                      : 'Swap Players'
                    : lang === 'ar'
                      ? 'تنفيذ النقل'
                      : 'Move Player'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
