'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Download,
  Minus,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
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
  Player,
  Round,
  ScoreEvent,
  Segment,
  Settings,
  User,
} from '@/lib/schemas';
import { formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { formatAdminDateTime } from './adminFormatters';
import { downloadCsvFile } from './csvUtils';

interface UnifiedResultRecord {
  id: string;
  recordType: 'finishedGame' | 'scoreEvent';
  createdAt: string;
  roundId: string;
  roundLabel: string;
  gameId: string;
  tableName: string;
  playerId: string;
  playerName: string;
  scorerUserId: string;
  scorerName: string;
  segmentLabel: string;
  delta?: number;
  kind?: ScoreEvent['kind'];
  note?: string;
  gameScoreSummary?: string;
}

export function AdminResultsView() {
  const { lang } = useI18n();
  const { toast } = useToast();

  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totalsByGame, setTotalsByGame] = useState<
    Record<string, Record<string, number>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [feedTab, setFeedTab] = useState<'all' | 'finishedGame' | 'scoreEvent'>('all');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [roundFilter, setRoundFilter] = useState('all');
  const [gameFilter, setGameFilter] = useState('all');
  const [playerFilter, setPlayerFilter] = useState('all');
  const [scorerFilter, setScorerFilter] = useState('all');

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
        allScores,
        allGames,
        allRounds,
        allPlayers,
        allSegments,
        allUsers,
        appSettings,
      ] = await Promise.all([
        scoreRepo.list({ order: 'newest' }),
        gameRepo.list(),
        roundRepo.list(),
        playerRepo.list({ includeHost: true }),
        segmentRepo.list(),
        userRepo.list(),
        settingsRepo.get(),
      ]);

      const finished = allGames.filter((g) => g.status === 'finished');
      const totalsEntries = await Promise.all(
        finished.map(async (g) => [g.id, await scoreRepo.getGameTotals(g.id)] as const)
      );

      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setScoreEvents(allScores);
      setGames(allGames);
      setRounds(allRounds);
      setPlayers(allPlayers);
      setSegments(allSegments);
      setUsers(allUsers);
      setSettings(appSettings);
      setTotalsByGame(Object.fromEntries(totalsEntries));
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل سجل النتائج.'
          : 'Failed to load results feed.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'score.changed' ||
        msg.event === 'game.finished' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'data.reset'
      ) {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const roundMap = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const segmentMap = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const scorers = useMemo(
    () => users.filter((u) => u.role === 'scorer' || u.role === 'superAdmin'),
    [users]
  );

  const unifiedRecords = useMemo<UnifiedResultRecord[]>(() => {
    const finishedGameRows: UnifiedResultRecord[] = games
      .filter((g) => g.status === 'finished')
      .map((g) => {
        const round = roundMap.get(g.roundId);
        const winner = g.winnerPlayerId ? playerMap.get(g.winnerPlayerId) : null;
        const scorer = userMap.get(g.scorerUserId);
        const totals = totalsByGame[g.id] ?? {};
        const scoreSummary = g.playerIds
          .map((pid) => {
            const p = playerMap.get(pid);
            const name = p ? localizeText(lang, p.nickname, p.nicknameAr) : pid;
            return `${name}: ${totals[pid] ?? 0}`;
          })
          .join(' · ');

        return {
          id: `fin-${g.id}`,
          recordType: 'finishedGame',
          createdAt: g.finishedAt ?? g.scheduledAt,
          roundId: g.roundId,
          roundLabel: round
            ? localizeText(lang, round.name.en, round.name.ar)
            : g.roundId,
          gameId: g.id,
          tableName: localizeText(lang, g.tableName, g.tableNameAr),
          playerId: g.winnerPlayerId ?? '',
          playerName: winner
            ? localizeText(lang, winner.fullName, winner.fullNameAr)
            : '—',
          scorerUserId: g.scorerUserId,
          scorerName: scorer
            ? localizeText(lang, scorer.name, scorer.nameAr)
            : g.scorerUserId,
          segmentLabel: lang === 'ar' ? 'النتيجة النهائية للمباراة' : 'Final Match Result',
          gameScoreSummary: scoreSummary,
        };
      });

    const scoreRows: UnifiedResultRecord[] = scoreEvents.map((ev) => {
      const g = gameMap.get(ev.gameId);
      const round = g ? roundMap.get(g.roundId) : undefined;
      const p = playerMap.get(ev.playerId);
      const seg = segmentMap.get(ev.segmentId);
      const scorer = userMap.get(ev.byUserId);

      return {
        id: ev.id,
        recordType: 'scoreEvent',
        createdAt: ev.createdAt,
        roundId: g?.roundId ?? '',
        roundLabel: round
          ? localizeText(lang, round.name.en, round.name.ar)
          : g?.roundId ?? '—',
        gameId: ev.gameId,
        tableName: g
          ? localizeText(lang, g.tableName, g.tableNameAr)
          : ev.gameId,
        playerId: ev.playerId,
        playerName: p ? localizeText(lang, p.fullName, p.fullNameAr) : ev.playerId,
        scorerUserId: ev.byUserId,
        scorerName: scorer
          ? localizeText(lang, scorer.name, scorer.nameAr)
          : ev.byUserId,
        segmentLabel: seg
          ? localizeText(lang, seg.nameEn, seg.nameAr)
          : ev.segmentId,
        delta: ev.delta,
        kind: ev.kind,
        note: ev.note,
      };
    });

    const combined = [...finishedGameRows, ...scoreRows].filter((r) => {
      if (feedTab !== 'all' && r.recordType !== feedTab) return false;
      if (roundFilter !== 'all' && r.roundId !== roundFilter) return false;
      if (gameFilter !== 'all' && r.gameId !== gameFilter) return false;
      if (playerFilter !== 'all') {
        if (r.recordType === 'finishedGame') {
          const g = gameMap.get(r.gameId);
          if (!g?.playerIds.includes(playerFilter)) return false;
        } else if (r.playerId !== playerFilter) {
          return false;
        }
      }
      if (scorerFilter !== 'all' && r.scorerUserId !== scorerFilter) return false;
      return true;
    });

    combined.sort((a, b) => {
      const diff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return order === 'oldest' ? -diff : diff;
    });

    return combined;
  }, [
    games,
    scoreEvents,
    roundMap,
    gameMap,
    playerMap,
    segmentMap,
    userMap,
    totalsByGame,
    feedTab,
    roundFilter,
    gameFilter,
    playerFilter,
    scorerFilter,
    order,
    lang,
  ]);

  const handleExportCsv = () => {
    downloadCsvFile(
      `casino-results-feed-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Date & Time (ISO)',
        'Type',
        'Round',
        'Table / Game',
        'Player / Winner',
        'Segment / Result',
        'Points Delta',
        'Kind',
        'Scorer',
        'Note / Standings',
      ],
      unifiedRecords.map((r) => [
        r.createdAt,
        r.recordType === 'finishedGame' ? 'Finished Game' : 'Score Event',
        r.roundLabel,
        r.tableName,
        r.playerName,
        r.segmentLabel,
        r.delta ?? '',
        r.kind ?? 'final',
        r.scorerName,
        r.note ?? r.gameScoreSummary ?? '',
      ])
    );
    toast({
      variant: 'positive',
      title: lang === 'ar' ? 'تم تصدير سجل النتائج CSV' : 'Results feed exported',
      description:
        lang === 'ar'
          ? `${unifiedRecords.length} سجل مطابق للتصفية الحالية.`
          : `${unifiedRecords.length} filtered record(s) downloaded as UTF-8 CSV.`,
    });
  };

  const resetFilters = () => {
    setRoundFilter('all');
    setGameFilter('all');
    setPlayerFilter('all');
    setScorerFilter('all');
    setFeedTab('all');
  };

  const hasActiveFilters =
    roundFilter !== 'all' ||
    gameFilter !== 'all' ||
    playerFilter !== 'all' ||
    scorerFilter !== 'all';

  const statItems = useMemo(
    () => [
      {
        id: 'matching',
        value: unifiedRecords.length,
        label: lang === 'ar' ? 'السجلات الظاهرة' : 'Matching Records',
        detail:
          order === 'newest'
            ? lang === 'ar'
              ? 'الأحدث أولاً'
              : 'Newest first'
            : lang === 'ar'
              ? 'الأقدم أولاً'
              : 'Oldest first',
        tone: 'blue' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'finished',
        value: games.filter((g) => g.status === 'finished').length,
        label: lang === 'ar' ? 'مباريات معتمدة' : 'Finished Games',
        detail: lang === 'ar' ? 'نتائج نهائية محفوظة' : 'Official match results',
        tone: 'gold' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'events',
        value: scoreEvents.length,
        label: lang === 'ar' ? 'حركات النقاط' : 'Score Events',
        detail: lang === 'ar' ? 'مسبقة + مخصصة + تراجع' : 'Preset, custom & undo',
        tone: 'red' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'net-pts',
        value: scoreEvents.reduce((acc, e) => acc + e.delta, 0),
        label: lang === 'ar' ? 'صافي النقاط المسجلة' : 'Net Points Scored',
        detail: lang === 'ar' ? 'إجمالي البطولة' : 'Tournament cumulative',
        tone: 'positive' as const,
        useArabicIndicDigits: useArabicIndic,
      },
    ],
    [unifiedRecords.length, order, games, scoreEvents, lang, useArabicIndic]
  );

  const columns = useMemo<DataTableColumn<UnifiedResultRecord>[]>(
    () => [
      {
        key: 'datetime',
        header: lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time',
        mobileRole: 'badge',
        render: (r) => (
          <time
            dateTime={r.createdAt}
            className="whitespace-nowrap text-xs font-bold tabular-nums text-red-900"
          >
            {formatAdminDateTime(r.createdAt, lang, useArabicIndic)}
          </time>
        ),
      },
      {
        key: 'subject',
        header: lang === 'ar' ? 'اللاعب / الفائز' : 'Player / Winner',
        mobileRole: 'title',
        render: (r) => (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-ink">
              {r.recordType === 'finishedGame' && (
                <Trophy className="h-4 w-4 shrink-0 text-gold-600" />
              )}
              <span className="truncate">{r.playerName}</span>
            </div>
            <div className="truncate text-xs text-ink-muted">
              {r.tableName} · {r.roundLabel}
            </div>
          </div>
        ),
      },
      {
        key: 'delta',
        header: lang === 'ar' ? 'النتيجة / النقاط' : 'Result / Delta',
        render: (r) => {
          if (r.recordType === 'finishedGame') {
            return (
              <div className="space-y-1">
                <Badge variant="gold">
                  {lang === 'ar' ? 'فائز المباراة' : 'MATCH WINNER'}
                </Badge>
                {r.gameScoreSummary && (
                  <div className="text-[11px] font-semibold text-ink-muted">
                    {r.gameScoreSummary}
                  </div>
                )}
              </div>
            );
          }
          const isPos = (r.delta ?? 0) >= 0;
          return (
            <div className="flex items-center gap-1.5">
              <Badge
                variant={isPos ? 'positive' : 'negative'}
                className="font-score text-sm tabular-nums"
              >
                {isPos ? (
                  <Plus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                ) : (
                  <Minus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                )}
                <span>
                  {formatNumber(Math.abs(r.delta ?? 0), {
                    useArabicIndicDigits: useArabicIndic,
                  })}
                </span>
              </Badge>
              {r.kind === 'undo' && (
                <Badge variant="muted" className="text-[10px]">
                  {lang === 'ar' ? 'تراجع' : 'UNDO'}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        key: 'segment',
        header: lang === 'ar' ? 'الفقرة والملاحظة' : 'Segment & Note',
        render: (r) => (
          <div className="min-w-0 max-w-xs">
            <div className="truncate text-xs font-bold text-ink">
              {r.segmentLabel}
            </div>
            {r.note && (
              <div className="truncate text-xs text-ink-muted">{r.note}</div>
            )}
          </div>
        ),
      },
      {
        key: 'scorer',
        header: lang === 'ar' ? 'الحكم' : 'Scorer',
        render: (r) => (
          <span className="whitespace-nowrap text-xs font-semibold text-ink-muted">
            {r.scorerName}
          </span>
        ),
      },
    ],
    [lang, useArabicIndic]
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
        title={lang === 'ar' ? 'سجل النتائج المباشر' : 'Chronological Results Feed'}
        description={
          lang === 'ar'
            ? 'كل نتيجة مباراة وكل حركة نقاط تصلك بالترتيب الزمني مع التاريخ والوقت وإمكانية التصفية والتصدير إلى CSV.'
            : 'Every finished game and score event delivered in chronological order with exact date & time, multi-filter controls, and CSV export.'
        }
        actions={
          <>
            <Button
              type="button"
              variant="calm"
              size="sm"
              onClick={() =>
                setOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
              }
            >
              <ArrowDownUp className="h-4 w-4 text-red-600" />
              <span>
                {order === 'newest'
                  ? lang === 'ar'
                    ? 'الأحدث أولاً'
                    : 'Newest First'
                  : lang === 'ar'
                    ? 'الأقدم أولاً'
                    : 'Oldest First'}
              </span>
            </Button>
            <Button
              type="button"
              variant="red"
              size="sm"
              disabled={unifiedRecords.length === 0}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </Button>
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={feedTab}
          onValueChange={(v) =>
            setFeedTab(v as 'all' | 'finishedGame' | 'scoreEvent')
          }
        >
          <TabsList>
            <TabsTrigger value="all">
              {lang === 'ar' ? 'جميع النتائج' : 'All Results'}
            </TabsTrigger>
            <TabsTrigger value="finishedGame">
              {lang === 'ar' ? 'المباريات المنتهية' : 'Finished Games'}
            </TabsTrigger>
            <TabsTrigger value="scoreEvent">
              {lang === 'ar' ? 'حركات النقاط' : 'Score Events'}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
          </Button>
        )}
      </div>

      <DataTable
        data={unifiedRecords}
        columns={columns}
        getRowKey={(r) => r.id}
        filterLayout="bar"
        searchPlaceholder={
          lang === 'ar'
            ? 'ابحث باللاعب أو الطاولة أو الفقرة أو الملاحظة...'
            : 'Search player, table, segment, or note...'
        }
        searchFilter={(r, q) =>
          normalizeSearchText(r.playerName).includes(q) ||
          normalizeSearchText(r.tableName).includes(q) ||
          normalizeSearchText(r.segmentLabel).includes(q) ||
          normalizeSearchText(r.note).includes(q) ||
          normalizeSearchText(r.scorerName).includes(q)
        }
        filterLabel={lang === 'ar' ? 'تصفية النتائج' : 'Filter Feed'}
        filterSlot={
          <>
            <select
              aria-label={lang === 'ar' ? 'تصفية بالجولة' : 'Filter by round'}
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base sm:text-xs font-semibold text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{lang === 'ar' ? 'كل الجولات' : 'All Rounds'}</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {localizeText(lang, r.name.en, r.name.ar)}
                </option>
              ))}
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية بالمباراة' : 'Filter by game'}
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base sm:text-xs font-semibold text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{lang === 'ar' ? 'كل الطاولات' : 'All Games'}</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {localizeText(lang, g.tableName, g.tableNameAr)}
                </option>
              ))}
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية باللاعب' : 'Filter by player'}
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base sm:text-xs font-semibold text-ink focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{lang === 'ar' ? 'كل اللاعبين' : 'All Players'}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {localizeText(lang, p.fullName, p.fullNameAr)}
                </option>
              ))}
            </select>

            <select
              aria-label={lang === 'ar' ? 'تصفية بالحكم' : 'Filter by scorer'}
              value={scorerFilter}
              onChange={(e) => setScorerFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base sm:text-xs font-semibold text-ink focus:border-blue-500 focus:outline-none"
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
    </div>
  );
}
