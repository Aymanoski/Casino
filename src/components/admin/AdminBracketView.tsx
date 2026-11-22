'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  Crown,
  Hash,
  Layers,
  MonitorPlay,
  Pencil,
  ShieldAlert,
  Sparkles,
  Tablet,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  computeTournamentBlueprint,
  resolveByes,
  validateTournamentSettings,
  type QualifierSlot,
  type TournamentProgressSummary,
} from '@/lib/engine';
import {
  groupRepo,
  matchRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import type {
  Match,
  Player,
  Round,
  Segment,
  Settings,
  TournamentSettings,
  User,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PlayerCombobox } from '@/components/ui/player-combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { DEMO_SEED_PRESETS } from './AdminSettingsView';
import type { MatchEditorPayload } from './GameEditorDialog';

const KnockoutCanvas = dynamic(
  () =>
    import('@/components/brand/KnockoutCanvas').then((m) => ({
      default: m.KnockoutCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <Skeleton shape="card" className="h-[min(70dvh,760px)] w-full rounded-card" />
    ),
  }
);

const GameEditorDialog = dynamic(
  () => import('./GameEditorDialog').then((m) => ({ default: m.GameEditorDialog })),
  { ssr: false }
);

export function AdminBracketView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [qualifiers, setQualifiers] = useState<QualifierSlot[]>([]);
  const [progress, setProgress] = useState<TournamentProgressSummary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totalsByMatch, setTotalsByMatch] = useState<Map<string, Record<string, number>>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Builder draft settings
  const [totalPlayers, setTotalPlayers] = useState(720);
  const [groupSize, setGroupSize] = useState(3);
  const [advancePerGroup, setAdvancePerGroup] = useState(1);
  const [pointsPerGroupWin, setPointsPerGroupWin] = useState(3);
  const [tablesCount, setTablesCount] = useState(12);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [includeFinalWithMarwan, setIncludeFinalWithMarwan] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Canvas navigation helpers
  const [highlightedPlayerId, setHighlightedPlayerId] = useState('');
  const [jumpSlotInput, setJumpSlotInput] = useState('');
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);

  // Match editor dialog
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(
    async (syncDefaults = false) => {
      const seq = ++loadSeqRef.current;
      try {
        const [
          allRounds,
          allMatches,
          allPlayers,
          allUsers,
          allSegments,
          allQualifiers,
          prog,
          appSettings,
        ] = await Promise.all([
          roundRepo.list(),
          matchRepo.list(),
          playerRepo.list({ includeHost: true }),
          userRepo.list(),
          segmentRepo.list(),
          groupRepo.listQualifiers(),
          groupRepo.getTournamentProgress(),
          settingsRepo.get(),
        ]);

        const koActiveIds = allMatches
          .filter((m) => m.type !== 'group' && m.status !== 'scheduled')
          .map((m) => m.id);
        const totalsObj =
          koActiveIds.length > 0 ? await scoreRepo.getTotalsForMatches(koActiveIds) : {};
        const totalsMap = new Map<string, Record<string, number>>(
          Object.entries(totalsObj)
        );

        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        setRounds(allRounds);
        setMatches(allMatches);
        setPlayers(allPlayers);
        setUsers(allUsers);
        setSegments(allSegments);
        setQualifiers(allQualifiers);
        setProgress(prog);
        setSettings(appSettings);
        setTotalsByMatch(totalsMap);

        if (syncDefaults) {
          setTotalPlayers(appSettings.tournament.totalPlayers);
          setGroupSize(appSettings.tournament.groupSize);
          setAdvancePerGroup(appSettings.tournament.advancePerGroup);
          setPointsPerGroupWin(appSettings.tournament.pointsPerGroupWin);
          setTablesCount(appSettings.tournament.tablesCount);
          setSlotMinutes(appSettings.tournament.slotMinutes);
          setIncludeFinalWithMarwan(appSettings.tournament.includeFinalWithMarwan);
        }
        setError(null);
      } catch {
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        setError(
          lang === 'ar'
            ? 'تعذر تحميل شجرة الإقصائيات.'
            : 'Failed to load knockout bracket.'
        );
      } finally {
        if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void loadData(true);
    const unsub = realtime.subscribe('*', (msg) => {
      if (msg.event === 'data.reset' || msg.event === 'tournament.generated') {
        void loadData(true);
        return;
      }
      if (
        msg.event === 'bracket.updated' ||
        msg.event === 'score.changed' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'settings.updated'
      ) {
        void loadData(false);
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndicDigits = settings?.useArabicIndicDigits ?? false;
  const useArabicIndic = useArabicIndicDigits;
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const scorers = useMemo(
    () => users.filter((u) => u.role === 'scorer' || u.role === 'superAdmin'),
    [users]
  );
  const koMatches = useMemo(
    () => matches.filter((m) => m.type === 'knockout' || m.type === 'final'),
    [matches]
  );

  const draftSettings = useMemo<TournamentSettings>(
    () => ({
      totalPlayers,
      groupSize,
      advancePerGroup,
      pointsPerGroupWin,
      tablesCount,
      slotMinutes,
      includeFinalWithMarwan,
    }),
    [
      totalPlayers,
      groupSize,
      advancePerGroup,
      pointsPerGroupWin,
      tablesCount,
      slotMinutes,
      includeFinalWithMarwan,
    ]
  );

  const validation = useMemo(
    () => validateTournamentSettings(draftSettings),
    [draftSettings]
  );

  const blueprint = useMemo(
    () => computeTournamentBlueprint(draftSettings, scorers.length || 4),
    [draftSettings, scorers.length]
  );

  const currentByeAllocation = useMemo(() => {
    if (!settings) return null;
    return resolveByes(qualifiers, settings.tournament);
  }, [qualifiers, settings]);

  const handleGenerateTournament = async () => {
    if (!user || !validation.valid) return;
    setGenerating(true);
    try {
      const res = await matchRepo.generateBracket(
        {
          totalPlayers,
          groupSize,
          advancePerGroup,
          pointsPerGroupWin,
          tablesCount,
          slotMinutes,
          includeFinalWithMarwan,
        },
        user.id
      );
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? 'تم توليد المجموعات وشجرة الإقصاء بنجاح'
            : 'Tournament bracket generated',
        description:
          lang === 'ar'
            ? `${res.rounds.length} جولات و${res.matches.length} مباراة مجدولة بدون تعارض.`
            : `${res.rounds.length} rounds and ${res.matches.length} matches auto-scheduled conflict-free.`,
      });
      await loadData(true);
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر توليد الشجرة' : 'Generation failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const handleLoadQuickPreset = async (
    preset: (typeof DEMO_SEED_PRESETS)[number]
  ) => {
    if (!user) return;
    setGenerating(true);
    try {
      await settingsRepo.resetDemoData(user.id, preset.options);
      await loadData(true);
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? `تم تحميل نموذج ${preset.size} لاعب`
            : `Loaded ${preset.size}-player demo preset`,
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر التحميل' : 'Preset failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const handleJumpToSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpSlotInput.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num < 1) return;
    const match =
      koMatches.find((m) => m.slot === num) ??
      koMatches.find((m) => m.id.includes(`-${num}`));
    if (!match) {
      toast({
        variant: 'negative',
        title:
          lang === 'ar'
            ? `لا توجد مباراة إقصائية بالرقم #${num}`
            : `No knockout match at slot #${num}`,
      });
      return;
    }
    setFocusedMatchId(match.id);
    window.setTimeout(() => setFocusedMatchId(null), 4000);
  };

  const handleSaveMatch = async (
    payload: MatchEditorPayload,
    existingId?: string
  ) => {
    if (!user || !existingId) return;
    await matchRepo.update(existingId, payload, user.id);
    toast({
      variant: 'positive',
      title: lang === 'ar' ? 'تم تحديث المباراة' : 'Match updated',
    });
    await loadData(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton shape="card" className="h-52 w-full" />
        <Skeleton shape="card" className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          lang === 'ar'
            ? 'منشئ البطولة وشجرة الإقصائيات التفاعلية'
            : 'Tournament Builder & Knockout Bracket'
        }
        description={
          lang === 'ar'
            ? 'توليد تلقائي لـ دور المجموعات (1 ضد 1) وشجرة الإقصاء (مجموعة 1 ضد 2، 3 ضد 4...) مع توزيع مقاعد BYE لأفضل المتصدرين والنهائي الكبير ضد مروان سري.'
            : 'Configure and generate Group Stage + Single-Elimination 1v1 Knockouts (Group 1 vs 2, 3 vs 4…, best-qualifier BYEs) culminating in the 1v1v1 Grand Final vs. Marwan Serry.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/groups" className="gap-1.5">
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'المجموعات والقرعة' : 'Groups & Draw'}</span>
              </Link>
            </Button>
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/matches" className="gap-1.5">
                <Tablet className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'جدول المباريات' : 'All Matches'}</span>
              </Link>
            </Button>
          </div>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={() => loadData(false)} />}

      {/* Tournament Generator & Quick Scale Presets */}
      <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-red-600" aria-hidden="true" />
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar'
                ? 'مولّد هيكل البطولة ومعاينة الشجرة'
                : 'Tournament Structure Generator'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-ink-muted">
              {lang === 'ar' ? 'نماذج سريعة:' : 'Demo presets:'}
            </span>
            {DEMO_SEED_PRESETS.map((preset) => (
              <ConfirmDialog
                key={preset.size}
                title={
                  lang === 'ar'
                    ? `تحميل نموذج ${preset.size} لاعب التجريبي؟`
                    : `Load ${preset.size}-Player Demo Story?`
                }
                description={lang === 'ar' ? preset.descAr : preset.descEn}
                confirmLabel={lang === 'ar' ? 'تحميل' : 'Load Preset'}
                cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                destructive
                onConfirm={() => handleLoadQuickPreset(preset)}
                trigger={
                  <Button
                    type="button"
                    variant={
                      settings?.tournament.totalPlayers === preset.size
                        ? 'secondary'
                        : 'calm'
                    }
                    size="sm"
                    disabled={generating}
                  >
                    {preset.size}P
                  </Button>
                }
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Input
            label={lang === 'ar' ? 'اللاعبون' : 'Total Players'}
            type="number"
            min={4}
            max={2000}
            value={totalPlayers}
            onChange={(e) => setTotalPlayers(parseInt(e.target.value || '0', 10))}
          />
          <Input
            label={lang === 'ar' ? 'حجم المجموعة' : 'Group Size'}
            type="number"
            min={2}
            max={8}
            value={groupSize}
            onChange={(e) => setGroupSize(parseInt(e.target.value || '0', 10))}
          />
          <Input
            label={lang === 'ar' ? 'متأهلون/مجموعة' : 'Advance / Group'}
            type="number"
            min={1}
            max={Math.max(1, groupSize - 1)}
            value={advancePerGroup}
            onChange={(e) => setAdvancePerGroup(parseInt(e.target.value || '0', 10))}
          />
          <Input
            label={lang === 'ar' ? 'نقاط الفوز' : 'Win Points'}
            type="number"
            min={1}
            max={10}
            value={pointsPerGroupWin}
            onChange={(e) => setPointsPerGroupWin(parseInt(e.target.value || '0', 10))}
          />
          <Input
            label={lang === 'ar' ? 'الطاولات' : 'Tables'}
            type="number"
            min={1}
            max={64}
            value={tablesCount}
            onChange={(e) => setTablesCount(parseInt(e.target.value || '0', 10))}
          />
          <Input
            label={lang === 'ar' ? 'مدة الفترة (د)' : 'Slot (Min)'}
            type="number"
            min={5}
            max={180}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(parseInt(e.target.value || '0', 10))}
          />
        </div>

        {!validation.valid && (
          <div
            role="alert"
            className="rounded-input border border-negative bg-red-100/70 px-3 py-2 text-xs font-bold text-negative"
          >
            {lang === 'ar'
              ? validation.errors[0].messageAr
              : validation.errors[0].messageEn}
          </div>
        )}

        {/* Live Blueprint Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-paper bg-paper p-3.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="red">
              {formatNumber(blueprint.groupsCount, { useArabicIndicDigits })}{' '}
              {lang === 'ar' ? 'مجموعة' : 'Groups'}
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-ink-muted rtl:rotate-180" aria-hidden="true" />
            <Badge variant="info">
              {formatNumber(blueprint.qualifiersCount, { useArabicIndicDigits })}{' '}
              {lang === 'ar' ? 'متأهل' : 'Qualifiers'}
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-ink-muted rtl:rotate-180" aria-hidden="true" />
            <Badge variant="gold">
              {formatNumber(blueprint.bracketSize, { useArabicIndicDigits })}-
              {lang === 'ar' ? 'مقعد' : 'Slot KO'}
              {blueprint.byesCount > 0
                ? ` (${blueprint.byesCount} BYE)`
                : ''}
            </Badge>
            {includeFinalWithMarwan && (
              <>
                <ArrowRight className="h-3.5 w-3.5 text-ink-muted rtl:rotate-180" aria-hidden="true" />
                <Badge variant="gold" className="gap-1">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'النهائي ضد مروان' : 'Final vs. Marwan'}</span>
                </Badge>
              </>
            )}
          </div>

          <ConfirmDialog
            title={
              progress?.started
                ? lang === 'ar'
                  ? 'معاينة التأثير: إعادة بناء البطولة بعد بدئها؟'
                  : 'Impact Preview: Rebuild Active Tournament?'
                : lang === 'ar'
                  ? 'توليد هيكل البطولة الجديد؟'
                  : 'Generate New Tournament Bracket?'
            }
            description={
              progress?.started
                ? lang === 'ar'
                  ? `البطولة قيد التشغيل حالياً (${progress.liveCount} مباراة مباشرة، ${progress.finishedCount} منتهية، ${progress.eventsCount} حدث). إعادة التوليد ستبني ${blueprint.groupsCount} مجموعة و${blueprint.totalMatchesCount} مباراة جديدة من الصفر.`
                  : `Tournament is in progress (${progress.liveCount} live, ${progress.finishedCount} finished, ${progress.eventsCount} events). Rebuilding generates ${blueprint.groupsCount} groups and ${blueprint.totalMatchesCount} fresh matches.`
                : lang === 'ar'
                  ? `سيتم إنشاء ${blueprint.groupsCount} مجموعة، ${blueprint.groupMatchesCount} مباراة مجموعات، شجرة إقصاء من ${blueprint.bracketSize} مقعد (${blueprint.byesCount} BYE)، والجدولة التلقائية بدون تعارض.`
                  : `Creates ${blueprint.groupsCount} groups, ${blueprint.groupMatchesCount} 1v1 group matches, a ${blueprint.bracketSize}-slot knockout tree (${blueprint.byesCount} BYEs), and a conflict-free schedule.`
            }
            confirmLabel={
              lang === 'ar' ? 'تأكيد وتوليد البطولة' : 'Confirm & Generate'
            }
            cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
            destructive={Boolean(progress?.started)}
            onConfirm={handleGenerateTournament}
            trigger={
              <Button
                type="button"
                variant="red"
                disabled={generating || !validation.valid}
                className="gap-2"
              >
                {progress?.started ? (
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {generating
                    ? lang === 'ar'
                      ? 'جاري التوليد...'
                      : 'Generating...'
                    : lang === 'ar'
                      ? `توليد (${blueprint.totalMatchesCount} مباراة)`
                      : `Generate (${blueprint.totalMatchesCount} Matches)`}
                </span>
              </Button>
            }
          />
        </div>
      </section>

      {/* BYE Allocation Status Banner (when qualifier count is not a power of two) */}
      {currentByeAllocation && currentByeAllocation.byesCount > 0 && (
        <section className="rounded-card border border-gold-500/60 bg-gold-200/25 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-display text-base text-red-900">
              {lang === 'ar'
                ? `توزيع مقاعد التأهل التلقائي (BYE): ${formatNumber(currentByeAllocation.byesCount, { useArabicIndicDigits })} مقعد`
                : `BYE Allocation: ${formatNumber(currentByeAllocation.byesCount, { useArabicIndicDigits })} Best Group Winners`}
            </div>
            <p className="text-xs text-ink-muted">
              {currentByeAllocation.allGroupsComplete
                ? lang === 'ar'
                  ? 'اكتملت جميع المجموعات — تم منح مقاعد BYE لأفضل المتصدرين وتأهيلهم تلقائياً للدور التالي.'
                  : 'All groups complete — BYE recipients locked by group points, points diff, and fewer cards, automatically advanced into Round 2.'
                : lang === 'ar'
                  ? `${currentByeAllocation.qualifierCount} متأهل يحتاجون شجرة من ${currentByeAllocation.bracketSize} مقعد. تُمنح مقاعد الـ BYE تلقائياً لأفضل ${currentByeAllocation.byesCount} متصدرين بمجرد اكتمال المجموعات.`
                  : `${currentByeAllocation.qualifierCount} qualifiers fit a ${currentByeAllocation.bracketSize}-slot bracket. Top ${currentByeAllocation.byesCount} group winners automatically claim BYE nodes once all groups complete.`}
            </p>
          </div>
          <Badge variant="gold">
            {currentByeAllocation.allGroupsComplete
              ? lang === 'ar'
                ? 'BYE معتمد'
                : 'BYES LOCKED'
              : lang === 'ar'
                ? 'بانتظار اكتمال المجموعات'
                : 'PENDING GROUP COMPLETION'}
          </Badge>
        </section>
      )}

      {/* Search Player Path + Jump to Match # Controls */}
      <div className="flex flex-col gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <PlayerCombobox
            players={players}
            value={highlightedPlayerId}
            onChange={setHighlightedPlayerId}
            includeGuest
            useArabicIndicDigits={useArabicIndic}
            emptyOptionLabel={
              lang === 'ar' ? 'إلغاء تتبّع المسار' : 'Clear player path highlight'
            }
            placeholder={
              lang === 'ar'
                ? 'تتبّع مسار لاعب داخل الشجرة (بحث في 720)...'
                : 'Highlight player path across bracket (search 720)...'
            }
          />
        </div>

        <form onSubmit={handleJumpToSlot} className="flex items-center gap-2">
          <div className="relative w-44">
            <Hash
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="number"
              min={1}
              value={jumpSlotInput}
              onChange={(e) => setJumpSlotInput(e.target.value)}
              placeholder={lang === 'ar' ? 'رقم مباراة إقصاء...' : 'KO Match / Slot #'}
              aria-label={lang === 'ar' ? 'انتقال إلى رقم مباراة إقصائية' : 'Jump to knockout match number'}
              className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper ps-8 pe-3 text-base sm:text-sm font-bold tabular-nums text-ink focus:border-blue-500 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            {lang === 'ar' ? 'انتقال' : 'Jump'}
          </Button>
        </form>
      </div>

      {/* Interactive Zoomable & Pannable Knockout Tree */}
      {koMatches.length === 0 ? (
        <EmptyState
          title={lang === 'ar' ? 'لم يتم توليد شجرة إقصائيات بعد' : 'No knockout bracket generated yet'}
          description={
            lang === 'ar'
              ? 'استخدم مولّد البطولة أعلاه لإنشاء المجموعات والأدوار الإقصائية.'
              : 'Use the tournament generator above to build groups and knockout rounds.'
          }
        />
      ) : (
        <KnockoutCanvas
          rounds={rounds}
          matches={matches}
          playerMap={playerMap}
          totalsByMatch={totalsByMatch}
          highlightedPlayerId={highlightedPlayerId}
          focusedMatchId={focusedMatchId}
          useArabicIndicDigits={useArabicIndic}
          onSelectMatch={(match) => {
            setEditingMatch(match);
            setEditorOpen(true);
          }}
        />
      )}

      {/* Quick Action Bar for Selected / Final Match */}
      {editingMatch && !editorOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-paper bg-white p-3.5 shadow-soft">
          <div className="text-sm font-bold text-red-900">
            {localizeText(lang, editingMatch.tableName, editingMatch.tableNameAr)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="calm"
              size="sm"
              onClick={() => setEditorOpen(true)}
              className="gap-1"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
            </Button>
            <Button asChild variant="calm" size="sm">
              <Link href={`/scorer/${editingMatch.id}`} className="gap-1">
                <Tablet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'التحكيم' : 'Score'}</span>
              </Link>
            </Button>
            <Button asChild variant="calm" size="sm">
              <Link href={`/screen/${editingMatch.id}`} className="gap-1">
                <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'الشاشة' : 'Screen'}</span>
              </Link>
            </Button>
          </div>
        </div>
      )}

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
