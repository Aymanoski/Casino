'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Crown,
  GripVertical,
  Pencil,
  Sparkles,
  Users,
  Wand2,
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
  type BracketRoundSpec,
} from '@/lib/repos';
import type { Game, Player, Round, Segment, Settings, User } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  BracketNode,
  BracketTrack,
  PlayerAvatar,
  type BracketPlayerSlot,
} from '@/components/brand';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { GameEditorDialog } from './GameEditorDialog';
import { getRoundStatusMeta } from './adminFormatters';

function computeFlexibleRounds(
  totalPlayers: number,
  playersPerGame: number,
  defaultAdvance: number,
  semiAdvance: number,
  includeFinalWithMarwan: boolean
): BracketRoundSpec[] {
  const safeSize = Math.max(2, Math.min(6, playersPerGame));
  const safeAdv = Math.max(1, Math.min(safeSize - 1, defaultAdvance));
  const specs: BracketRoundSpec[] = [];

  let pool = Math.max(safeSize, totalPlayers);
  let roundNum = 1;

  while (pool > safeSize && roundNum <= 5) {
    const gamesCount = Math.ceil(pool / safeSize);
    const nextPool = gamesCount * safeAdv;
    specs.push({
      nameEn:
        roundNum === 1
          ? 'Round 1 — Opening Tables'
          : `Round ${roundNum} — Knockout Tables`,
      nameAr:
        roundNum === 1
          ? 'الدور الأول — طاولات التصفيات'
          : `الدور ${roundNum} — الإقصائيات`,
      gamesCount,
      advancePerGame: safeAdv,
    });
    if (nextPool >= pool) break;
    pool = nextPool;
    roundNum++;
  }

  // Penultimate Semi-Final table when running a Final vs Marwan
  if (includeFinalWithMarwan) {
    const semiGamesCount = Math.max(1, Math.ceil(pool / safeSize));
    const resolvedSemiAdv =
      semiGamesCount === 1
        ? Math.max(1, Math.min(safeSize - 1, semiAdvance))
        : 1;
    specs.push({
      nameEn: 'Semi-Final — The Golden Qualifier',
      nameAr: 'نصف النهائي — تصفية المقعدين',
      gamesCount: semiGamesCount,
      advancePerGame: resolvedSemiAdv,
    });
    specs.push({
      nameEn: 'The Grand Final — vs. Marwan Serry',
      nameAr: 'النهائي الكبير — في مواجهة مروان سري',
      gamesCount: 1,
      advancePerGame: 1,
      isFinal: true,
    });
  } else {
    specs.push({
      nameEn: 'Championship Final',
      nameAr: 'المباراة النهائية',
      gamesCount: 1,
      advancePerGame: 1,
      isFinal: false,
    });
  }

  return specs;
}

export function AdminBracketView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totalsByGame, setTotalsByGame] = useState<
    Record<string, Record<string, number>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Builder controls
  const [totalPlayers, setTotalPlayers] = useState(27);
  const [playersPerGame, setPlayersPerGame] = useState(3);
  const [advancePerGame, setAdvancePerGame] = useState(1);
  const [semiAdvanceCount, setSemiAdvanceCount] = useState(2);
  const [includeFinalWithMarwan, setIncludeFinalWithMarwan] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Drag & Drop player assignment state
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [selectedPoolPlayerId, setSelectedPoolPlayerId] = useState<string | null>(null);
  const [seedingRoundId, setSeedingRoundId] = useState<string>('');

  // Quick game edit dialog
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [allRounds, allGames, allPlayers, allUsers, allSegments, appSettings] =
        await Promise.all([
          roundRepo.list(),
          gameRepo.list(),
          playerRepo.list({ includeHost: true }),
          userRepo.list(),
          segmentRepo.list(),
          settingsRepo.get(),
        ]);

      const totalsEntries = await Promise.all(
        allGames.map(async (g) => [g.id, await scoreRepo.getGameTotals(g.id)] as const)
      );

      if (!mountedRef.current) return;
      setRounds(allRounds);
      setGames(allGames);
      setPlayers(allPlayers);
      setUsers(allUsers);
      setSegments(allSegments);
      setSettings(appSettings);
      setTotalsByGame(Object.fromEntries(totalsEntries));
      setSeedingRoundId((prev) =>
        prev && allRounds.some((r) => r.id === prev)
          ? prev
          : allRounds[0]?.id ?? ''
      );
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل شجرة البطولة.'
          : 'Failed to load tournament bracket.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'bracket.updated' ||
        msg.event === 'player.updated' ||
        msg.event === 'score.changed' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'data.reset'
      ) {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const nonHostPlayers = useMemo(() => players.filter((p) => !p.isHost), [players]);
  const scorers = useMemo(
    () => users.filter((u) => u.role === 'scorer' || u.role === 'superAdmin'),
    [users]
  );

  const plannedRounds = useMemo(
    () =>
      computeFlexibleRounds(
        totalPlayers,
        playersPerGame,
        advancePerGame,
        semiAdvanceCount,
        includeFinalWithMarwan
      ),
    [
      totalPlayers,
      playersPerGame,
      advancePerGame,
      semiAdvanceCount,
      includeFinalWithMarwan,
    ]
  );

  const totalPlannedGames = useMemo(
    () => plannedRounds.reduce((sum, r) => sum + r.gamesCount, 0),
    [plannedRounds]
  );

  const handleGenerateBracket = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const res = await gameRepo.generateBracket(
        {
          totalPlayers,
          playersPerGame,
          rounds: plannedRounds,
          includeFinalWithMarwan,
        },
        user.id
      );
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? 'تم توليد شجرة البطولة بنجاح'
            : 'Bracket generated successfully',
        description:
          lang === 'ar'
            ? `${res.rounds.length} جولات و ${res.games.length} طاولات جاهزة للتعيين.`
            : `${res.rounds.length} rounds and ${res.games.length} tables created and logged.`,
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر توليد الشجرة' : 'Bracket generation failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAssignPlayerToSeat = async (
    targetGame: Game,
    seatIdx: number,
    playerId: string
  ) => {
    if (!user) return;
    if (targetGame.isFinal && targetGame.playerIds[seatIdx] === 'player-marwan') {
      return;
    }

    const nextPlayerIds = [...targetGame.playerIds];
    nextPlayerIds[seatIdx] = playerId;
    try {
      await gameRepo.update(targetGame.id, { playerIds: nextPlayerIds }, user.id);
      const p = playerMap.get(playerId);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم تعيين المقعد' : 'Seat updated',
        description: `${p ? localizeText(lang, p.fullName, p.fullNameAr) : playerId} → ${localizeText(lang, targetGame.tableName, targetGame.tableNameAr)}`,
      });
      setSelectedPoolPlayerId(null);
      setDraggingPlayerId(null);
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر تحديث المقعد' : 'Could not assign player',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleUpdateRoundAdvance = async (round: Round, nextAdv: number) => {
    if (!user) return;
    try {
      await roundRepo.update(round.id, { advancePerGame: nextAdv }, user.id);
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر تحديث الجولة' : 'Failed to update round',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleSaveGameFromModal = async (
    payload: Omit<Game, 'id'>,
    existingId?: string
  ) => {
    if (!user) return;
    if (existingId) {
      await gameRepo.update(existingId, payload, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم تحديث المباراة' : 'Game session updated',
      });
    } else {
      await gameRepo.create(payload, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم إنشاء المباراة' : 'Game session created',
      });
    }
    await loadData();
  };

  const seedingRoundGames = useMemo(
    () =>
      games
        .filter((g) => g.roundId === seedingRoundId)
        .sort((a, b) => (a.podOrder ?? 99) - (b.podOrder ?? 99)),
    [games, seedingRoundId]
  );

  const seatedInSelectedRound = useMemo(() => {
    const ids = new Set<string>();
    seedingRoundGames.forEach((g) => g.playerIds.forEach((pid) => ids.add(pid)));
    return ids;
  }, [seedingRoundGames]);

  const toBracketSlots = (game: Game): BracketPlayerSlot[] => {
    const totals = totalsByGame[game.id] ?? {};
    return game.playerIds.map((pid, idx) => {
      const p = playerMap.get(pid);
      if (!p) {
        return {
          id: `${game.id}-slot-${idx}`,
          name:
            lang === 'ar'
              ? `متأهل مقعد ${idx + 1} (TBD)`
              : `Qualifier Seat ${idx + 1} (TBD)`,
          isPlaceholder: true,
        };
      }
      return {
        id: p.id,
        name: localizeText(lang, p.fullName, p.fullNameAr),
        nickname: localizeText(lang, p.nickname, p.nicknameAr),
        avatarSeed: p.avatarSeed,
        score:
          game.status === 'live' || game.status === 'finished'
            ? totals[p.id] ?? 0
            : undefined,
        isWinner: game.winnerPlayerId === p.id,
        isAdvancing: game.advancingPlayerIds?.includes(p.id),
        isHost: p.isHost,
      };
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton shape="card" className="h-56 w-full" />
        <Skeleton shape="card" className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          lang === 'ar'
            ? 'مصمم شجرة البطولة والتصفيات'
            : 'Flexible Bracket Builder'
        }
        description={
          lang === 'ar'
            ? 'اضبط عدد اللاعبين وحجم كل طاولة وعدد المتأهلين لكل جولة، ثم ولّد الجولات تلقائياً واسحب اللاعبين لتوزيع المقاعد.'
            : 'Configure total players, table size, and per-round advancement, auto-generate rounds and tables, drag-assign players, and inspect the live bracket preview.'
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/games">
              <Calendar className="h-4 w-4" />
              <span>
                {lang === 'ar' ? 'جدول المباريات والحكام' : 'Games & Scorers'}
              </span>
            </Link>
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      {/* 1. Flexible Bracket Generator */}
      <section
        aria-labelledby="bracket-gen-heading"
        className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="bracket-gen-heading"
              className="font-display text-xl text-red-900"
            >
              {lang === 'ar'
                ? 'مولّد التصفيات المرن'
                : 'Auto-Generate Rounds & Tables'}
            </h2>
            <p className="text-xs text-ink-muted">
              {lang === 'ar'
                ? 'النظام الافتراضي: ٢٧ لاعباً ← ٩ طاولات (٣/طاولة) ← ٣ طاولات ← نصف نهائي (يتأهل ٢) ← النهائي مع مروان سري.'
                : 'Default demo: 27 players → 9 tables (3/game) → 3 tables → Semi-Final (top 2) → Final vs. Marwan Serry.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '9P (3×3)', p: 9, sz: 3, adv: 1, semi: 2 },
              { label: '18P (6×3)', p: 18, sz: 3, adv: 1, semi: 2 },
              { label: '27P (Default)', p: 27, sz: 3, adv: 1, semi: 2 },
              { label: '36P (9×4)', p: 36, sz: 4, adv: 1, semi: 2 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setTotalPlayers(preset.p);
                  setPlayersPerGame(preset.sz);
                  setAdvancePerGame(preset.adv);
                  setSemiAdvanceCount(preset.semi);
                }}
                className="min-h-[36px] rounded-pill border border-border-paper bg-paper px-3 text-xs font-bold text-ink hover:border-red-600 hover:bg-paper-2 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label={lang === 'ar' ? 'عدد اللاعبين' : 'Total Players'}
            type="number"
            min={4}
            max={81}
            value={totalPlayers}
            onChange={(e) =>
              setTotalPlayers(Math.max(4, Math.min(81, Number(e.target.value) || 9)))
            }
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
              {lang === 'ar' ? 'حجم الطاولة' : 'Players / Game'}
            </label>
            <select
              value={playersPerGame}
              onChange={(e) => {
                const sz = Number(e.target.value);
                setPlayersPerGame(sz);
                if (advancePerGame >= sz) setAdvancePerGame(1);
              }}
              className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none"
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} {lang === 'ar' ? 'لكل طاولة' : '/ table'}
                  {n === 3 ? (lang === 'ar' ? ' (افتراضي)' : ' (Default)') : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
              {lang === 'ar' ? 'المتأهلون / طاولة' : 'Advance / Game'}
            </label>
            <select
              value={advancePerGame}
              onChange={(e) => setAdvancePerGame(Number(e.target.value))}
              className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: Math.max(1, playersPerGame - 1) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {lang === 'ar' ? `أفضل ${n}` : `Top ${n}`}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
              {lang === 'ar' ? 'متأهلو نصف النهائي' : 'Semi-Final Advance'}
            </label>
            <select
              value={semiAdvanceCount}
              onChange={(e) => setSemiAdvanceCount(Number(e.target.value))}
              disabled={!includeFinalWithMarwan}
              className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value={2}>
                {lang === 'ar' ? 'أفضل ٢ (مع مروان سري)' : 'Top 2 (+ Marwan)'}
              </option>
              <option value={1}>
                {lang === 'ar' ? 'أفضل ١' : 'Top 1'}
              </option>
            </select>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-input border-2 border-border-paper bg-paper px-3 py-2 self-end">
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-900">
              <Crown className="h-4 w-4 text-gold-600 shrink-0" />
              <span>
                {lang === 'ar' ? 'نهائي مروان سري' : 'Marwan Final'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={includeFinalWithMarwan}
              onChange={(e) => setIncludeFinalWithMarwan(e.target.checked)}
              className="h-5 w-5 accent-red-600"
            />
          </label>
        </div>

        {/* Live Advancement Math Pipeline Preview */}
        <div className="rounded-input border border-border-paper bg-paper p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
              {lang === 'ar'
                ? 'معاينة هيكل الجولات قبل التوليد'
                : 'Live Bracket Topology Preview'}
            </span>
            <Badge variant="white">
              {formatNumber(plannedRounds.length, { useArabicIndicDigits: useArabicIndic })}{' '}
              {lang === 'ar' ? 'جولات' : 'rounds'} ·{' '}
              {formatNumber(totalPlannedGames, { useArabicIndicDigits: useArabicIndic })}{' '}
              {lang === 'ar' ? 'مباراة' : 'games'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-pill border border-border-paper bg-white px-3 py-1 text-xs font-extrabold text-ink">
              <Users className="inline h-3.5 w-3.5 me-1 text-red-600" />
              {formatNumber(totalPlayers, { useArabicIndicDigits: useArabicIndic })}{' '}
              {lang === 'ar' ? 'لاعب' : 'Players'}
            </span>
            {plannedRounds.map((spec, idx) => (
              <React.Fragment key={`${spec.nameEn}-${idx}`}>
                <ArrowRight className="h-4 w-4 text-ink-muted rtl:rotate-180 shrink-0" />
                <span
                  className={cn(
                    'rounded-pill border px-3 py-1 text-xs font-bold',
                    spec.isFinal
                      ? 'border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                      : 'border-border-paper bg-white text-ink'
                  )}
                >
                  {spec.isFinal ? (
                    <>
                      <Crown className="inline h-3.5 w-3.5 me-1" />
                      {lang === 'ar'
                        ? 'النهائي (٢ + مروان سري)'
                        : 'Final (2 + Marwan Serry)'}
                    </>
                  ) : (
                    <>
                      {localizeText(lang, spec.nameEn.split('—')[0], spec.nameAr.split('—')[0])}:{' '}
                      {formatNumber(spec.gamesCount, { useArabicIndicDigits: useArabicIndic })}×
                      {formatNumber(playersPerGame, { useArabicIndicDigits: useArabicIndic })} (
                      {lang === 'ar' ? 'يتأهل' : 'adv'}{' '}
                      {formatNumber(spec.advancePerGame, { useArabicIndicDigits: useArabicIndic })})
                    </>
                  )}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {totalPlayers > nonHostPlayers.length
              ? lang === 'ar'
                ? `ملاحظة: لديك حالياً ${nonHostPlayers.length} لاعباً في القائمة؛ المقاعد الزائدة ستُنشأ كمقاعد مبدئية (TBD).`
                : `Note: Roster currently has ${nonHostPlayers.length} players; extra seats will be created as open TBD slots.`
              : lang === 'ar'
                ? 'سيتم توزيع اللاعبين تلقائياً حسب التصنيف (Seed) وتعيين الحكام بالتناوب.'
                : 'Seeded players will be assigned across Round 1 tables and scorers distributed round-robin.'}
          </p>

          <ConfirmDialog
            destructive
            title={
              lang === 'ar'
                ? 'إعادة توليد شجرة البطولة؟'
                : 'Auto-Generate New Bracket?'
            }
            description={
              lang === 'ar'
                ? `سيتم استبدال الجولات والمباريات الحالية بـ ${plannedRounds.length} جولات و ${totalPlannedGames} مباراة جديدة مع الاحتفاظ بسجل المراجعة وبيانات التجربة.`
                : `This replaces current tournament rounds and games with ${plannedRounds.length} rounds and ${totalPlannedGames} newly generated tables. Recorded in the audit log.`
            }
            confirmLabel={
              generating
                ? lang === 'ar'
                  ? 'جارٍ التوليد...'
                  : 'Generating...'
                : lang === 'ar'
                  ? 'توليد الجولات والمباريات'
                  : 'Generate Rounds & Games'
            }
            cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
            onConfirm={handleGenerateBracket}
            trigger={
              <Button type="button" variant="red" size="md" disabled={generating}>
                <Wand2 className="h-4 w-4" />
                <span>
                  {lang === 'ar'
                    ? 'توليد الجولات والمباريات تلقائياً'
                    : 'Auto-Generate Rounds & Games'}
                </span>
              </Button>
            }
          />
        </div>
      </section>

      {/* 2. Interactive Visual Bracket Preview */}
      <section
        aria-labelledby="bracket-preview-heading"
        className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="bracket-preview-heading"
              className="font-display text-xl text-red-900"
            >
              {lang === 'ar'
                ? 'المعاينة البصرية لشجرة البطولة'
                : 'Visual Bracket Preview'}
            </h2>
            <p className="text-xs text-ink-muted">
              {lang === 'ar'
                ? 'اضغط على أي مباراة لتعديل الطاولة أو الحكم أو التوقيت أو تعيين النهائي.'
                : 'Click any game node to edit its table name, scorer, schedule time, players, or Final status.'}
            </p>
          </div>
          <Badge variant="gold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {games.length} {lang === 'ar' ? 'طاولات نشطة' : 'Total Tables'}
            </span>
          </Badge>
        </div>

        {rounds.length === 0 ? (
          <EmptyState
            compact
            title={lang === 'ar' ? 'لا توجد جولات بعد' : 'No rounds generated yet'}
            description={
              lang === 'ar'
                ? 'استخدم مولّد التصفيات أعلاه لإنشاء الجولات والطاولات.'
                : 'Use the flexible bracket generator above to auto-create rounds and tables.'
            }
          />
        ) : (
          <BracketTrack
            title={
              lang === 'ar'
                ? 'اسحب أفقياً أو استخدم أزرار التكبير'
                : 'Pan horizontally or zoom to inspect rounds'
            }
          >
            <div className="flex items-start gap-6 min-w-max px-1 pb-2">
              {rounds.map((round, roundIdx) => {
                const roundGames = games
                  .filter((g) => g.roundId === round.id)
                  .sort((a, b) => (a.podOrder ?? 99) - (b.podOrder ?? 99));
                const rMeta = getRoundStatusMeta(round.status, lang);

                return (
                  <div
                    key={round.id}
                    className="w-[290px] sm:w-[310px] shrink-0 space-y-3"
                  >
                    {/* Round Column Header with inline advancePerGame edit */}
                    <div className="rounded-input border border-border-paper bg-white p-3 shadow-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-display text-base text-red-900">
                          {localizeText(lang, round.name.en, round.name.ar)}
                        </span>
                        <Badge variant={rMeta.variant}>{rMeta.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                        <span>
                          {formatNumber(roundGames.length, {
                            useArabicIndicDigits: useArabicIndic,
                          })}{' '}
                          {lang === 'ar'
                            ? roundGames.length === 1
                              ? 'مباراة'
                              : 'مباريات'
                            : roundGames.length === 1
                              ? 'game'
                              : 'games'}
                        </span>
                        <label className="inline-flex items-center gap-1.5 font-bold text-ink">
                          <span>{lang === 'ar' ? 'يتأهل:' : 'Advance:'}</span>
                          <select
                            aria-label={`${lang === 'ar' ? 'عدد المتأهلين في' : 'Advance count for'} ${round.name.en}`}
                            value={round.advancePerGame}
                            onChange={(e) =>
                              handleUpdateRoundAdvance(round, Number(e.target.value))
                            }
                            className="h-8 rounded-[8px] border border-border-paper bg-paper px-1.5 text-xs font-bold text-red-900"
                          >
                            {[1, 2, 3].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Games Column */}
                    <div
                      className={cn(
                        'flex flex-col gap-4',
                        roundIdx === 1 && 'pt-6',
                        roundIdx >= 2 && 'pt-14'
                      )}
                    >
                      {roundGames.map((game) => (
                        <div key={game.id} className="relative">
                          <BracketNode
                            tableName={localizeText(lang, game.tableName, game.tableNameAr)}
                            roundLabel={`${formatNumber(game.playerIds.length, { useArabicIndicDigits: useArabicIndic })}P · ${
                              users.find((u) => u.id === game.scorerUserId)?.name ?? 'Scorer'
                            }`}
                            status={game.status}
                            isFinal={game.isFinal}
                            players={toBracketSlots(game)}
                            useArabicIndicDigits={useArabicIndic}
                            onSelect={() => {
                              setEditingGame(game);
                              setEditorOpen(true);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </BracketTrack>
        )}
      </section>

      {/* 3. Drag & Drop / Tap-to-Assign Player Seeding Board */}
      <section
        aria-labelledby="drag-assign-heading"
        className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="drag-assign-heading"
              className="font-display text-xl text-red-900"
            >
              {lang === 'ar'
                ? 'سحب وتوزيع اللاعبين على المقاعد'
                : 'Drag or Click to Assign Players to Seats'}
            </h2>
            <p className="text-xs text-ink-muted">
              {lang === 'ar'
                ? 'اسحب أي لاعب من القائمة وأفلته على أي مقعد في الطاولة، أو انقر عليه ثم انقر على المقعد (مناسب للموبايل ولوحة المفاتيح).'
                : 'Drag a player card onto any seat slot below—or tap a player then tap a seat for touch & keyboard assignment.'}
            </p>
          </div>

          <select
            aria-label={lang === 'ar' ? 'اختر الجولة للتوزيع' : 'Select round for seeding'}
            value={seedingRoundId}
            onChange={(e) => setSeedingRoundId(e.target.value)}
            className="min-h-[44px] h-11 rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-bold text-ink focus:border-blue-500 focus:outline-none"
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {localizeText(lang, r.name.en, r.name.ar)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 lg:grid-cols-12 items-start">
          {/* Draggable Player Roster Pool */}
          <div className="lg:col-span-4 rounded-input border border-border-paper bg-paper p-3.5 space-y-2.5 max-h-[520px] overflow-y-auto">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
              <span>{lang === 'ar' ? 'قائمة المتسابقين' : 'Player Pool'}</span>
              <span>
                {seatedInSelectedRound.size}/{nonHostPlayers.length}{' '}
                {lang === 'ar' ? 'موزّع' : 'seated'}
              </span>
            </div>

            <div className="space-y-1.5">
              {nonHostPlayers.map((p) => {
                const isSeated = seatedInSelectedRound.has(p.id);
                const isPicked = selectedPoolPlayerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      setDraggingPlayerId(p.id);
                      e.dataTransfer.setData('text/plain', p.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDraggingPlayerId(null)}
                    onClick={() =>
                      setSelectedPoolPlayerId((prev) =>
                        prev === p.id ? null : p.id
                      )
                    }
                    className={cn(
                      'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-input border px-2.5 py-2 text-start text-xs transition-all cursor-grab active:cursor-grabbing',
                      isPicked
                        ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-500 text-blue-800'
                        : isSeated
                          ? 'border-border-paper bg-white/75 text-ink-muted'
                          : 'border-outline/30 bg-white text-ink shadow-sm hover:border-red-600'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-ink-faint" />
                      <PlayerAvatar
                        name={localizeText(lang, p.fullName, p.fullNameAr)}
                        avatarSeed={p.avatarSeed}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-bold">
                          #{p.seed} {localizeText(lang, p.fullName, p.fullNameAr)}
                        </div>
                        <div className="truncate text-[11px] opacity-80">
                          “{localizeText(lang, p.nickname, p.nicknameAr)}”
                        </div>
                      </div>
                    </div>
                    {isSeated && (
                      <Badge variant="muted" className="text-[10px] px-2 py-0.5 shrink-0">
                        {lang === 'ar' ? 'موزّع' : 'Seated'}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Tables & Drop Seats */}
          <div className="lg:col-span-8 grid gap-3 sm:grid-cols-2">
            {seedingRoundGames.map((game) => (
              <div
                key={game.id}
                className={cn(
                  'rounded-input border p-3.5 space-y-2.5 bg-paper/70',
                  game.isFinal
                    ? 'border-outline bg-gold-200/35'
                    : 'border-border-paper'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-red-900">
                      {game.isFinal && (
                        <Crown className="h-4 w-4 shrink-0 text-gold-600" />
                      )}
                      <span className="truncate">
                        {localizeText(lang, game.tableName, game.tableNameAr)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="calm"
                    size="icon"
                    onClick={() => {
                      setEditingGame(game);
                      setEditorOpen(true);
                    }}
                    aria-label={lang === 'ar' ? 'تعديل المباراة' : 'Edit game'}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  {game.playerIds.map((pid, sIdx) => {
                    const p = playerMap.get(pid);
                    const isMarwan = p?.isHost;
                    const canReceiveTap = Boolean(selectedPoolPlayerId) && !isMarwan;

                    return (
                      <div
                        key={`${game.id}-drop-${sIdx}`}
                        onDragOver={(e) => {
                          if (!isMarwan) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (isMarwan) return;
                          const droppedId =
                            e.dataTransfer.getData('text/plain') || draggingPlayerId;
                          if (droppedId) {
                            handleAssignPlayerToSeat(game, sIdx, droppedId);
                          }
                        }}
                        onClick={() => {
                          if (canReceiveTap && selectedPoolPlayerId) {
                            handleAssignPlayerToSeat(game, sIdx, selectedPoolPlayerId);
                          }
                        }}
                        className={cn(
                          'flex min-h-[44px] items-center justify-between gap-2 rounded-input border-2 px-3 py-1.5 text-xs transition-all',
                          isMarwan
                            ? 'border-outline bg-gold-gradient font-extrabold text-red-900'
                            : canReceiveTap || draggingPlayerId
                              ? 'border-dashed border-blue-600 bg-blue-100/60 cursor-pointer hover:bg-blue-100'
                              : 'border-border-paper bg-white'
                        )}
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-bold text-ink-muted me-1.5">
                            {isMarwan ? '♛' : `S${sIdx + 1}:`}
                          </span>
                          <span className={cn(p ? 'font-bold text-ink' : 'italic text-ink-muted')}>
                            {p
                              ? localizeText(lang, p.fullName, p.fullNameAr)
                              : lang === 'ar'
                                ? 'اسحب لاعباً هنا (TBD)'
                                : 'Drop player here (TBD)'}
                          </span>
                        </div>
                        {canReceiveTap && (
                          <span className="shrink-0 text-[11px] font-extrabold text-blue-800">
                            {lang === 'ar' ? 'تعيين' : 'Assign'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GameEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        game={editingGame}
        rounds={rounds}
        players={players}
        scorers={scorers}
        segments={segments}
        defaultPlayersPerGame={playersPerGame}
        onSave={handleSaveGameFromModal}
      />
    </div>
  );
}
