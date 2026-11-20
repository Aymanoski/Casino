'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Crown,
  GitBranch,
  MonitorPlay,
  Pencil,
  Plus,
  Tablet,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  gameRepo,
  playerRepo,
  roundRepo,
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
import { localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { LiveBadge } from '@/components/brand';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { GameEditorDialog } from './GameEditorDialog';
import { formatAdminTimeShort, getGameStatusMeta } from './adminFormatters';

export function AdminGamesView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roundFilter, setRoundFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | GameStatus>('all');
  const [scorerFilter, setScorerFilter] = useState('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);

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
      const [allGames, allRounds, allPlayers, allUsers, allSegments, appSettings] =
        await Promise.all([
          gameRepo.list(),
          roundRepo.list(),
          playerRepo.list({ includeHost: true }),
          userRepo.list(),
          segmentRepo.list(),
          settingsRepo.get(),
        ]);

      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setGames(allGames);
      setRounds(allRounds);
      setPlayers(allPlayers);
      setUsers(allUsers);
      setSegments(allSegments);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar' ? 'تعذر تحميل قائمة المباريات.' : 'Failed to load games.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'bracket.updated' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'user.updated' ||
        msg.event === 'data.reset'
      ) {
        loadData();
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

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (roundFilter !== 'all' && g.roundId !== roundFilter) return false;
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (scorerFilter !== 'all' && g.scorerUserId !== scorerFilter) return false;
      return true;
    });
  }, [games, roundFilter, statusFilter, scorerFilter]);

  const handleQuickAssignScorer = async (game: Game, scorerUserId: string) => {
    if (!user || busyGameId === game.id) return;
    setBusyGameId(game.id);
    try {
      await gameRepo.update(game.id, { scorerUserId }, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم تعيين الحكم' : 'Scorer assigned',
        description: localizeText(lang, game.tableName, game.tableNameAr),
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر تعيين الحكم' : 'Could not assign scorer',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyGameId(null);
    }
  };

  const handleMarkAsFinal = async (game: Game) => {
    if (!user || busyGameId === game.id) return;
    setBusyGameId(game.id);
    try {
      await gameRepo.update(game.id, { isFinal: !game.isFinal }, user.id);
      toast({
        variant: 'gold',
        title: !game.isFinal
          ? lang === 'ar'
            ? 'تم تعيين المباراة كـ النهائي الكبير (مع مروان سري)'
            : 'Marked as Grand Final (+ Marwan Serry)'
          : lang === 'ar'
            ? 'تم إلغاء علامة النهائي'
            : 'Removed Grand Final flag',
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل التحديث' : 'Update failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyGameId(null);
    }
  };

  const handleSaveGame = async (
    payload: Omit<Game, 'id'>,
    existingId?: string
  ) => {
    if (!user) return;
    if (existingId) {
      await gameRepo.update(existingId, payload, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم حفظ تعديلات المباراة' : 'Game session updated',
      });
    } else {
      await gameRepo.create(payload, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم إنشاء المباراة' : 'New game created',
      });
    }
    await loadData();
  };

  const handleDeleteGame = async (game: Game) => {
    if (!user) return;
    try {
      await gameRepo.remove(game.id, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم حذف المباراة' : 'Game removed',
        description: localizeText(lang, game.tableName, game.tableNameAr),
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حذف المباراة' : 'Failed to remove game',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const statItems = useMemo(
    () => [
      {
        id: 'total-games',
        value: games.length,
        label: lang === 'ar' ? 'إجمالي المباريات' : 'Total Games',
        detail: `${rounds.length} ${lang === 'ar' ? 'جولات' : 'rounds'}`,
        tone: 'red' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'live-games',
        value: games.filter((g) => g.status === 'live').length,
        label: lang === 'ar' ? 'مباشر الآن' : 'Live Now',
        detail: lang === 'ar' ? 'قيد اللعب حالياً' : 'Active on stage',
        tone: 'live' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'scheduled-games',
        value: games.filter((g) => g.status === 'scheduled').length,
        label: lang === 'ar' ? 'مجدولة قادمة' : 'Scheduled',
        detail: lang === 'ar' ? 'بانتظار بدء الجلسة' : 'Ready for start',
        tone: 'blue' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'done-games',
        value: games.filter((g) => g.status === 'finished').length,
        label: lang === 'ar' ? 'منتهية ومعتمدة' : 'Finished',
        detail: lang === 'ar' ? 'تم اعتماد النتائج' : 'Winners finalized',
        tone: 'gold' as const,
        useArabicIndicDigits: useArabicIndic,
      },
    ],
    [games, rounds.length, lang, useArabicIndic]
  );

  const columns = useMemo<DataTableColumn<Game>[]>(
    () => [
      {
        key: 'table',
        header: lang === 'ar' ? 'الطاولة والمباراة' : 'Table & Session',
        sortable: true,
        sortAccessor: (g) => g.tableName.toLowerCase(),
        mobileRole: 'title',
        render: (g) => {
          const round = roundMap.get(g.roundId);
          return (
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-red-900">
                {g.isFinal && (
                  <Crown className="h-4 w-4 shrink-0 text-gold-600" />
                )}
                <span className="truncate">
                  {localizeText(lang, g.tableName, g.tableNameAr)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                <span>
                  {round ? localizeText(lang, round.name.en, round.name.ar) : g.roundId}
                </span>
                {g.isFinal && (
                  <Badge variant="gold" className="text-[10px] px-2 py-0">
                    {lang === 'ar' ? 'النهائي مع مروان سري' : 'FINAL vs Marwan'}
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'status',
        header: lang === 'ar' ? 'الحالة' : 'Status',
        sortable: true,
        sortAccessor: (g) => g.status,
        mobileRole: 'badge',
        render: (g) =>
          g.status === 'live' ? (
            <LiveBadge size="sm" surface="paper" />
          ) : (
            <Badge variant={getGameStatusMeta(g.status, lang).variant}>
              {getGameStatusMeta(g.status, lang).label}
            </Badge>
          ),
      },
      {
        key: 'players',
        header: lang === 'ar' ? 'المتسابقون' : 'Seated Players',
        render: (g) => (
          <div className="flex flex-wrap gap-1 max-w-[240px]">
            {g.playerIds.map((pid, idx) => {
              const p = playerMap.get(pid);
              return (
                <span
                  key={`${g.id}-${idx}`}
                  className={
                    p?.isHost
                      ? 'rounded-pill border border-outline bg-gold-400 px-2 py-0.5 text-[11px] font-extrabold text-red-900'
                      : 'rounded-pill border border-border-paper bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink'
                  }
                >
                  {p
                    ? localizeText(lang, p.fullName, p.fullNameAr)
                    : 'TBD'}
                </span>
              );
            })}
          </div>
        ),
      },
      {
        key: 'scorer',
        header: lang === 'ar' ? 'حكم الطاولة' : 'Scorer',
        render: (g) => (
          <select
            aria-label={`${lang === 'ar' ? 'تعيين حكم لـ' : 'Assign scorer for'} ${g.tableName}`}
            value={g.scorerUserId}
            onChange={(e) => handleQuickAssignScorer(g, e.target.value)}
            className="min-h-[44px] rounded-input border border-border-paper bg-white px-2.5 py-1 text-base sm:text-xs font-bold text-ink focus:border-blue-500 focus:outline-none"
          >
            {scorers.map((u) => (
              <option key={u.id} value={u.id}>
                {localizeText(lang, u.name, u.nameAr)}
              </option>
            ))}
          </select>
        ),
      },
      {
        key: 'time',
        header: lang === 'ar' ? 'الموعد' : 'Scheduled',
        sortable: true,
        sortAccessor: (g) => new Date(g.scheduledAt).getTime(),
        render: (g) => (
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-ink-muted">
            {formatAdminTimeShort(g.scheduledAt, lang, useArabicIndic)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: lang === 'ar' ? 'إجراءات' : 'Actions',
        render: (g) => (
          <div className="flex items-center gap-1.5">
            <Button
              asChild
              variant="calm"
              size="icon"
              title={lang === 'ar' ? 'لوحة الحكم' : 'Open Scorer Console'}
            >
              <Link
                href={`/scorer/${g.id}`}
                aria-label={lang === 'ar' ? 'فتح لوحة الحكم' : 'Open Scorer Console'}
              >
                <Tablet className="h-4 w-4 text-red-600" />
              </Link>
            </Button>
            <Button
              asChild
              variant="calm"
              size="icon"
              title={lang === 'ar' ? 'شاشة العرض' : 'Open Big Screen'}
            >
              <Link
                href={`/screen/${g.id}`}
                aria-label={lang === 'ar' ? 'فتح شاشة العرض' : 'Open Big Screen'}
              >
                <MonitorPlay className="h-4 w-4 text-blue-600" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="calm"
              size="icon"
              onClick={() => handleMarkAsFinal(g)}
              title={
                g.isFinal
                  ? lang === 'ar'
                    ? 'إلغاء تعيين النهائي'
                    : 'Unmark Final'
                  : lang === 'ar'
                    ? 'تعيين كـ النهائي مع مروان سري'
                    : 'Mark as Final vs Marwan'
              }
              aria-label={lang === 'ar' ? 'تبديل حالة النهائي' : 'Toggle Grand Final'}
            >
              <Crown
                className={
                  g.isFinal ? 'h-4 w-4 text-gold-600 fill-gold-400' : 'h-4 w-4 text-ink-muted'
                }
              />
            </Button>
            <Button
              type="button"
              variant="calm"
              size="icon"
              onClick={() => {
                setEditingGame(g);
                setEditorOpen(true);
              }}
              aria-label={lang === 'ar' ? 'تعديل المباراة' : 'Edit game'}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              destructive
              title={lang === 'ar' ? 'حذف المباراة؟' : 'Remove Game Session?'}
              description={
                lang === 'ar'
                  ? `سيتم حذف "${g.tableNameAr || g.tableName}" من جدول البطولة.`
                  : `Remove "${g.tableName}" from the tournament schedule?`
              }
              confirmLabel={lang === 'ar' ? 'حذف' : 'Remove'}
              cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
              onConfirm={() => handleDeleteGame(g)}
              trigger={
                <Button
                  type="button"
                  variant="calm"
                  size="icon"
                  aria-label={lang === 'ar' ? 'حذف المباراة' : 'Delete game'}
                >
                  <Trash2 className="h-4 w-4 text-negative" />
                </Button>
              }
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, roundMap, playerMap, scorers, useArabicIndic]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="rounded-card border border-border-paper bg-white overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRowSkeleton key={i} columns={5} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'المباريات وجلسات اللعب' : 'Games & Sessions'}
        description={
          lang === 'ar'
            ? 'إدارة جميع الطاولات، تعيين الحكام والمواعيد، اختيار فقرات كل جلسة، وتعيين النهائي الكبير ضد مروان سري.'
            : 'Manage every table session, assign scorers and call times, customize segment lineups, and mark the Grand Final vs. Marwan Serry.'
        }
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/bracket">
                <GitBranch className="h-4 w-4" />
                <span>{lang === 'ar' ? 'مصمم الشجرة' : 'Bracket Builder'}</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="red"
              size="sm"
              onClick={() => {
                setEditingGame(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>{lang === 'ar' ? 'إنشاء مباراة' : 'New Game'}</span>
            </Button>
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      <DataTable
        data={filteredGames}
        columns={columns}
        getRowKey={(g) => g.id}
        filterLayout="bar"
        searchPlaceholder={
          lang === 'ar'
            ? 'ابحث باسم الطاولة أو اللاعبين...'
            : 'Search tables or seated players...'
        }
        searchFilter={(g, q) =>
          normalizeSearchText(g.tableName).includes(q) ||
          normalizeSearchText(g.tableNameAr).includes(q) ||
          g.playerIds.some((pid) => {
            const p = playerMap.get(pid);
            return (
              normalizeSearchText(p?.fullName).includes(q) ||
              normalizeSearchText(p?.fullNameAr).includes(q) ||
              normalizeSearchText(p?.nickname).includes(q) ||
              normalizeSearchText(p?.nicknameAr).includes(q)
            );
          })
        }
        filterLabel={lang === 'ar' ? 'تصفية المباريات' : 'Filter Games'}
        filterSlot={
          <>
            <select
              aria-label={lang === 'ar' ? 'الجولة' : 'Round'}
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{lang === 'ar' ? 'كل الجولات' : 'All Rounds'}</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {localizeText(lang, r.name.en, r.name.ar)}
                </option>
              ))}
            </select>
            <select
              aria-label={lang === 'ar' ? 'الحالة' : 'Status'}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | GameStatus)
              }
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="live">{lang === 'ar' ? 'مباشر' : 'Live'}</option>
              <option value="scheduled">{lang === 'ar' ? 'مجدولة' : 'Scheduled'}</option>
              <option value="finished">{lang === 'ar' ? 'منتهية' : 'Finished'}</option>
            </select>
            <select
              aria-label={lang === 'ar' ? 'الحكم' : 'Scorer'}
              value={scorerFilter}
              onChange={(e) => setScorerFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{lang === 'ar' ? 'كل الحكام' : 'All Scorers'}</option>
              {scorers.map((u) => (
                <option key={u.id} value={u.id}>
                  {localizeText(lang, u.name, u.nameAr)}
                </option>
              ))}
            </select>
          </>
        }
      />

      <GameEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        game={editingGame}
        rounds={rounds}
        players={players}
        scorers={scorers}
        segments={segments}
        defaultPlayersPerGame={settings?.bracketConfig.playersPerGame ?? 3}
        onSave={handleSaveGame}
      />
    </div>
  );
}
