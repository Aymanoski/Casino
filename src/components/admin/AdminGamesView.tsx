'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Crown,
  GitBranch,
  Hash,
  MonitorPlay,
  Pencil,
  Plus,
  Tablet,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { detectScheduleConflicts, type ScheduleConflict } from '@/lib/engine';
import {
  matchRepo,
  playerRepo,
  roundRepo,
  segmentRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import type {
  Match,
  MatchStatus,
  MatchType,
  Player,
  Round,
  Segment,
  Settings,
  User,
} from '@/lib/schemas';
import { formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { LiveBadge } from '@/components/brand/LiveBadge';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { formatAdminTimeShort, getGameStatusMeta } from './adminFormatters';
import type { MatchEditorPayload } from './GameEditorDialog';

const GameEditorDialog = dynamic(
  () => import('./GameEditorDialog').then((m) => ({ default: m.GameEditorDialog })),
  { ssr: false }
);

export function AdminMatchesView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [matches, setMatches] = useState<Match[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'all' | MatchType | 'bye'>('all');
  const [roundFilter, setRoundFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | MatchStatus>('all');
  const [judgeFilter, setJudgeFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [jumpGroupInput, setJumpGroupInput] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

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
      const [allMatches, allRounds, allPlayers, allUsers, allSegments, appSettings] =
        await Promise.all([
          matchRepo.list(),
          roundRepo.list(),
          playerRepo.list({ includeHost: true }),
          userRepo.list(),
          segmentRepo.list(),
          settingsRepo.get(),
        ]);

      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setMatches(allMatches);
      setRounds(allRounds);
      setPlayers(allPlayers);
      setUsers(allUsers);
      setSegments(allSegments);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar' ? 'تعذر تحميل قائمة المباريات.' : 'Failed to load matches.'
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
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'user.updated' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const roundMap = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const scorers = useMemo(
    () => users.filter((u) => u.role === 'scorer' || u.role === 'superAdmin'),
    [users]
  );

  // Detect all player/table/judge schedule conflicts across the entire tournament
  const conflictsByMatch = useMemo(() => {
    const map = new Map<string, ScheduleConflict[]>();
    if (!settings) return map;
    const allConflicts = detectScheduleConflicts(matches, settings.tournament);
    for (const c of allConflicts) {
      const list = map.get(c.matchId);
      if (list) list.push(c);
      else map.set(c.matchId, [c]);
    }
    return map;
  }, [matches, settings]);

  const totalConflictingMatches = conflictsByMatch.size;

  const filteredMatches = useMemo(() => {
    const jumpGroupNum = parseInt(jumpGroupInput.replace(/[^\d]/g, ''), 10);
    return matches.filter((m) => {
      const isBye = m.participants.some((p) => p.isBye);
      if (typeFilter === 'bye' && !isBye) return false;
      if (typeFilter !== 'all' && typeFilter !== 'bye' && m.type !== typeFilter) {
        return false;
      }
      if (roundFilter !== 'all' && m.roundId !== roundFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (judgeFilter !== 'all' && m.judgeUserId !== judgeFilter) return false;
      if (tableFilter !== 'all' && String(m.tableNumber) !== tableFilter) return false;
      if (conflictsOnly && !conflictsByMatch.has(m.id)) return false;
      if (Number.isFinite(jumpGroupNum) && jumpGroupNum > 0) {
        if (m.groupId !== `group-${jumpGroupNum}` && m.slot !== jumpGroupNum) {
          return false;
        }
      }
      return true;
    });
  }, [
    matches,
    typeFilter,
    roundFilter,
    statusFilter,
    judgeFilter,
    tableFilter,
    conflictsOnly,
    conflictsByMatch,
    jumpGroupInput,
  ]);

  const handleAutoSchedule = async () => {
    if (!user) return;
    setScheduling(true);
    try {
      const res = await matchRepo.autoSchedule(user.id, { onlyScheduled: true });
      await loadData();
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? `تمت الجدولة التلقائية لـ ${res.rescheduledCount} مباراة`
            : `Auto-scheduled ${res.rescheduledCount} upcoming match(es)`,
        description:
          lang === 'ar'
            ? `تعارضات متبقية: ${res.remainingConflicts} · لم يتم تعديل المباريات المباشرة أو المنتهية.`
            : `Remaining conflicts: ${res.remainingConflicts}. Live & finished matches untouched.`,
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل الجدولة التلقائية' : 'Auto-schedule failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setScheduling(false);
    }
  };

  const handleQuickAssignJudge = async (match: Match, judgeUserId: string) => {
    if (!user || busyMatchId === match.id) return;
    setBusyMatchId(match.id);
    try {
      await matchRepo.update(match.id, { judgeUserId, scorerUserId: judgeUserId }, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم تعيين الحكم' : 'Judge assigned',
        description: localizeText(lang, match.tableName, match.tableNameAr),
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر تعيين الحكم' : 'Could not assign judge',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyMatchId(null);
    }
  };

  const handleSaveMatch = async (
    payload: MatchEditorPayload,
    existingId?: string
  ) => {
    if (!user) return;
    if (existingId) {
      await matchRepo.update(existingId, payload, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم حفظ تعديلات المباراة' : 'Match updated',
      });
    } else {
      await matchRepo.create(payload, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم إنشاء المباراة' : 'New match created',
      });
    }
    await loadData();
  };

  const handleDeleteMatch = async (match: Match) => {
    if (!user) return;
    try {
      await matchRepo.remove(match.id, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم حذف المباراة' : 'Match removed',
        description: localizeText(lang, match.tableName, match.tableNameAr),
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حذف المباراة' : 'Failed to remove match',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const statItems = useMemo(
    () => [
      {
        id: 'total-matches',
        value: matches.length,
        label: lang === 'ar' ? 'إجمالي المباريات' : 'Total Matches',
        detail: `${rounds.length} ${lang === 'ar' ? 'جولات' : 'rounds'}`,
        tone: 'red' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'live-matches',
        value: matches.filter((m) => m.status === 'live' || m.status === 'needsTieBreak').length,
        label: lang === 'ar' ? 'مباشر الآن' : 'Live Now',
        detail: lang === 'ar' ? 'قيد اللعب حالياً' : 'Active on stage',
        tone: 'live' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'scheduled-matches',
        value: matches.filter((m) => m.status === 'scheduled').length,
        label: lang === 'ar' ? 'مجدولة قادمة' : 'Scheduled',
        detail: `${settings?.tournament.tablesCount ?? 12} ${lang === 'ar' ? 'طاولات' : 'tables'}`,
        tone: 'blue' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'done-matches',
        value: matches.filter((m) => m.status === 'finished').length,
        label: lang === 'ar' ? 'منتهية ومعتمدة' : 'Finished',
        detail:
          totalConflictingMatches === 0
            ? lang === 'ar'
              ? '0 تعارض جدول'
              : '0 schedule conflicts'
            : lang === 'ar'
              ? `${totalConflictingMatches} تعارض!`
              : `${totalConflictingMatches} conflicts!`,
        tone: 'gold' as const,
        useArabicIndicDigits: useArabicIndic,
      },
    ],
    [matches, rounds.length, settings, totalConflictingMatches, lang, useArabicIndic]
  );

  const tableOptions = useMemo(() => {
    const count = Math.max(
      settings?.tournament.tablesCount ?? 12,
      ...matches.map((m) => m.tableNumber)
    );
    return Array.from({ length: Math.min(64, count) }, (_, i) => i + 1);
  }, [settings, matches]);

  const columns = useMemo<DataTableColumn<Match>[]>(
    () => [
      {
        key: 'match',
        header: lang === 'ar' ? 'المباراة والنوع' : 'Match & Stage',
        sortable: true,
        sortAccessor: (m) => `${m.round}-${String(m.slot).padStart(4, '0')}`,
        mobileRole: 'title',
        render: (m) => {
          const round = roundMap.get(m.roundId);
          const conflicts = conflictsByMatch.get(m.id);
          const isBye = m.participants.some((p) => p.isBye);
          return (
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 font-bold text-red-900">
                {m.isFinal && (
                  <Crown className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                )}
                <span className="truncate">
                  {localizeText(lang, m.tableName, m.tableNameAr)}
                </span>
                {isBye && <Badge variant="gold">BYE</Badge>}
                {m.isGroupTieBreak && (
                  <Badge variant="gold">
                    {lang === 'ar' ? 'فاصلة' : 'TIE-BREAK'}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                <span>
                  {round
                    ? localizeText(lang, round.name.en, round.name.ar)
                    : m.roundId}
                </span>
                <span>·</span>
                <span className="font-bold text-red-800">
                  {lang === 'ar'
                    ? `طاولة #${formatNumber(m.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                    : `Table #${formatNumber(m.tableNumber, { useArabicIndicDigits: useArabicIndic })}`}
                </span>
              </div>
              {conflicts && conflicts.length > 0 && (
                <div className="inline-flex items-center gap-1 rounded-pill bg-red-100 px-2 py-0.5 text-[11px] font-bold text-negative">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-[260px]">
                    {lang === 'ar' ? conflicts[0].messageAr : conflicts[0].messageEn}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: 'participants',
        header: lang === 'ar' ? 'المشاركون' : 'Participants',
        render: (m) => (
          <div className="flex flex-wrap gap-1">
            {m.participants.map((part, idx) => {
              if (part.isBye) {
                return (
                  <Badge key={`bye-${idx}`} variant="gold">
                    BYE
                  </Badge>
                );
              }
              const p = part.playerId ? playerMap.get(part.playerId) : null;
              const isWin =
                m.status === 'finished' &&
                (m.result?.winnerId ?? m.winnerPlayerId) === part.playerId;
              const label = p
                ? localizeText(lang, p.fullName, p.fullNameAr)
                : lang === 'ar'
                  ? part.placeholderLabelAr ?? 'قريباً'
                  : part.placeholderLabelEn ?? 'TBD';
              return (
                <Badge
                  key={part.playerId ?? `tbd-${idx}`}
                  variant={part.guest || isWin ? 'gold' : p ? 'muted' : 'info'}
                  className="max-w-[160px] truncate"
                >
                  {label}
                </Badge>
              );
            })}
          </div>
        ),
      },
      {
        key: 'scheduledAt',
        header: lang === 'ar' ? 'الموعد' : 'Time Slot',
        sortable: true,
        sortAccessor: (m) => Date.parse(m.scheduledAt) || 0,
        render: (m) => (
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-ink">
            {formatAdminTimeShort(m.scheduledAt, lang, useArabicIndic)}
          </span>
        ),
      },
      {
        key: 'judge',
        header: lang === 'ar' ? 'الحكم' : 'Judge',
        render: (m) => (
          <select
            aria-label={
              lang === 'ar'
                ? `تغيير حكم ${m.tableNameAr || m.tableName}`
                : `Assign judge for ${m.tableName}`
            }
            value={m.judgeUserId}
            disabled={busyMatchId === m.id}
            onChange={(e) => handleQuickAssignJudge(m, e.target.value)}
            className="min-h-[44px] h-11 rounded-input border border-border-paper bg-paper px-2.5 text-base sm:text-xs font-bold text-ink focus:border-blue-500 focus:outline-none"
          >
            {scorers.map((s) => (
              <option key={s.id} value={s.id}>
                {localizeText(lang, s.name, s.nameAr)}
              </option>
            ))}
          </select>
        ),
      },
      {
        key: 'status',
        header: lang === 'ar' ? 'الحالة' : 'Status',
        sortable: true,
        sortAccessor: (m) => m.status,
        mobileRole: 'badge',
        render: (m) => {
          if (m.status === 'live') return <LiveBadge size="sm" surface="paper" />;
          const meta = getGameStatusMeta(m.status, lang);
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      },
      {
        key: 'actions',
        header: lang === 'ar' ? 'إجراءات' : 'Actions',
        render: (m) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="calm"
              size="sm"
              onClick={() => {
                setEditingMatch(m);
                setEditorOpen(true);
              }}
              aria-label={lang === 'ar' ? `تعديل ${m.tableNameAr}` : `Edit ${m.tableName}`}
              className="gap-1"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
            </Button>
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
            {m.status === 'scheduled' && (
              <ConfirmDialog
                title={lang === 'ar' ? 'حذف المباراة؟' : 'Remove match?'}
                description={localizeText(lang, m.tableName, m.tableNameAr)}
                confirmLabel={lang === 'ar' ? 'حذف' : 'Remove'}
                cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                destructive
                onConfirm={() => handleDeleteMatch(m)}
                trigger={
                  <Button
                    type="button"
                    variant="calm"
                    size="icon"
                    aria-label={lang === 'ar' ? 'حذف المباراة' : 'Delete match'}
                  >
                    <Trash2 className="h-4 w-4 text-negative" aria-hidden="true" />
                  </Button>
                }
              />
            )}
          </div>
        ),
      },
    ],
    [
      lang,
      roundMap,
      conflictsByMatch,
      playerMap,
      useArabicIndic,
      scorers,
      busyMatchId,
    ]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <TableRowSkeleton key={idx} columns={5} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'المباريات والجدولة التلقائية' : 'Matches & Auto-Schedule'}
        description={
          lang === 'ar'
            ? 'إدارة جميع مباريات المجموعات والإقصائيات والنهائي الكبير مع جدولة تلقائية خالية من التعارضات وتجاوزات يدوية وتحذيرات فورية.'
            : 'Manage all group, knockout, and Grand Final matches across studio tables with conflict-free auto-scheduling, manual overrides, and live conflict warnings.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={scheduling}
              onClick={handleAutoSchedule}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              <span>
                {scheduling
                  ? lang === 'ar'
                    ? 'جاري الجدولة...'
                    : 'Scheduling...'
                  : lang === 'ar'
                    ? 'جدولة القادمة تلقائياً'
                    : 'Auto-Schedule Upcoming'}
              </span>
            </Button>
            <Button
              type="button"
              variant="red"
              onClick={() => {
                setEditingMatch(null);
                setEditorOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'مباراة جديدة' : 'New Match'}</span>
            </Button>
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/bracket" className="gap-1.5">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'الشجرة' : 'Bracket'}</span>
              </Link>
            </Button>
          </div>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      {/* Conflict Health Status Strip */}
      <div
        className={
          totalConflictingMatches > 0
            ? 'flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-gold-500 bg-gold-200/35 px-4 py-3'
            : 'flex flex-wrap items-center justify-between gap-3 rounded-card border border-positive/40 bg-positive-soft px-4 py-3'
        }
      >
        <div className="flex items-center gap-2 text-sm font-bold text-red-900">
          {totalConflictingMatches > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? `تم رصد تعارضات في ${totalConflictingMatches} مباراة (لاعب أو طاولة أو حكم محجوز مرتين في نفس الفترة).`
                  : `Detected schedule conflicts across ${totalConflictingMatches} match(es) (double-booked player, table, or judge).`}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
              <span className="text-positive-ink">
                {lang === 'ar'
                  ? `الجدول خالٍ تماماً من التعارضات عبر ${settings?.tournament.tablesCount ?? 12} طاولة (${settings?.tournament.slotMinutes ?? 30} دقيقة لكل فترة).`
                  : `Zero schedule conflicts across ${settings?.tournament.tablesCount ?? 12} tables (${settings?.tournament.slotMinutes ?? 30}-min slots).`}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalConflictingMatches > 0 && (
            <>
              <Button
                type="button"
                variant={conflictsOnly ? 'red' : 'calm'}
                size="sm"
                onClick={() => setConflictsOnly((v) => !v)}
              >
                {conflictsOnly
                  ? lang === 'ar'
                    ? 'عرض كل المباريات'
                    : 'Show All Matches'
                  : lang === 'ar'
                    ? `عرض التعارضات فقط (${totalConflictingMatches})`
                    : `Filter Conflicts (${totalConflictingMatches})`}
              </Button>
              <Button
                type="button"
                variant="red"
                size="sm"
                disabled={scheduling}
                onClick={handleAutoSchedule}
                className="gap-1.5"
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'إصلاح تلقائي' : 'Resolve via Auto-Schedule'}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Virtualized / Paginated Matches DataTable */}
      <DataTable
        data={filteredMatches}
        columns={columns}
        getRowKey={(m) => m.id}
        virtualized
        defaultPageSize={30}
        filterLayout="bar"
        searchPlaceholder={
          lang === 'ar'
            ? 'ابحث باسم المباراة، اللاعب، رقم المجموعة، أو الطاولة...'
            : 'Search match title, player name, group #, table #...'
        }
        searchFilter={(m, q) => {
          const pNames = m.participants
            .map((p) => {
              const pl = p.playerId ? playerMap.get(p.playerId) : null;
              return pl
                ? `${pl.fullName} ${pl.fullNameAr} ${pl.nickname}`
                : p.placeholderLabelEn ?? '';
            })
            .join(' ');
          const hay = normalizeSearchText(
            `${m.id} ${m.tableName} ${m.tableNameAr} table ${m.tableNumber} #${m.tableNumber} slot ${m.slot} ${m.groupId ?? ''} ${pNames}`
          );
          return hay.includes(q);
        }}
        filterSlot={
          <>
            <select
              aria-label={lang === 'ar' ? 'تصفية حسب النوع' : 'Filter by stage type'}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | MatchType | 'bye')}
              className="min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-paper px-3 text-base sm:text-xs font-bold text-ink"
            >
              <option value="all">{lang === 'ar' ? 'كل المراحل' : 'All Stages'}</option>
              <option value="group">{lang === 'ar' ? 'دور المجموعات (1 ضد 1)' : 'Group Stage (1v1)'}</option>
              <option value="knockout">{lang === 'ar' ? 'الإقصائيات (1 ضد 1)' : 'Knockouts (1v1)'}</option>
              <option value="final">{lang === 'ar' ? 'النهائي الكبير (3 لاعبين)' : 'Grand Final (1v1v1)'}</option>
              <option value="bye">{lang === 'ar' ? 'مقاعد التأهل التلقائي (BYE)' : 'BYE Auto-Advance'}</option>
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية حسب الجولة' : 'Filter by round'}
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-paper px-3 text-base sm:text-xs font-bold text-ink"
            >
              <option value="all">{lang === 'ar' ? 'كل الجولات' : 'All Rounds'}</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {localizeText(lang, r.name.en, r.name.ar)}
                </option>
              ))}
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | MatchStatus)}
              className="min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-paper px-3 text-base sm:text-xs font-bold text-ink"
            >
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="live">{lang === 'ar' ? 'مباشر' : 'Live'}</option>
              <option value="needsTieBreak">{lang === 'ar' ? 'يحتاج جولة حسم' : 'Needs Tie-Break'}</option>
              <option value="scheduled">{lang === 'ar' ? 'مجدولة' : 'Scheduled'}</option>
              <option value="finished">{lang === 'ar' ? 'منتهية' : 'Finished'}</option>
              <option value="needsReview">{lang === 'ar' ? 'مراجعة إدارية' : 'Needs Review'}</option>
              <option value="void">{lang === 'ar' ? 'ملغاة' : 'Void'}</option>
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية حسب الطاولة' : 'Filter by table'}
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-paper px-3 text-base sm:text-xs font-bold text-ink"
            >
              <option value="all">{lang === 'ar' ? 'كل الطاولات' : 'All Tables'}</option>
              {tableOptions.map((n) => (
                <option key={n} value={String(n)}>
                  {lang === 'ar' ? `طاولة #${n}` : `Table #${n}`}
                </option>
              ))}
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية حسب الحكم' : 'Filter by judge'}
              value={judgeFilter}
              onChange={(e) => setJudgeFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-paper px-3 text-base sm:text-xs font-bold text-ink lg:col-span-2"
            >
              <option value="all">{lang === 'ar' ? 'كل الحكام' : 'All Judges'}</option>
              {scorers.map((s) => (
                <option key={s.id} value={s.id}>
                  {localizeText(lang, s.name, s.nameAr)}
                </option>
              ))}
            </select>

            <div className="relative w-full lg:col-span-2">
              <Hash
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                type="number"
                min={1}
                value={jumpGroupInput}
                onChange={(e) => setJumpGroupInput(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'انتقال برقم المجموعة أو الخانة (1..240)'
                    : 'Jump to Group or Slot # (1..240)'
                }
                aria-label={lang === 'ar' ? 'تصفية برقم المجموعة أو الخانة' : 'Filter by Group or Slot #'}
                className="min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-paper ps-9 pe-3 text-base sm:text-xs font-bold tabular-nums text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        }
      />

      <GameEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        game={editingMatch}
        rounds={rounds}
        players={players}
        scorers={scorers}
        segments={segments}
        allMatches={matches}
        tournamentSettings={settings?.tournament}
        onSave={handleSaveMatch}
      />
    </div>
  );
}

/** Compatibility export alias */
export { AdminMatchesView as AdminGamesView };
