'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Crown,
  GitBranch,
  Hash,
  Layers,
  MonitorPlay,
  Tablet,
  Trophy,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { canAccessScorerGame, useAuth } from '@/lib/auth';
import { resolveByes, type QualifierSlot } from '@/lib/engine';
import {
  groupRepo,
  matchRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Match, Player, Round, Settings, User } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PlayerCombobox } from '@/components/ui/player-combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import { BracketNode, type BracketPlayerSlot } from '@/components/brand/BracketNode';
import { KnockoutCanvas } from '@/components/brand/KnockoutCanvas';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { formatPublicDateTime } from './publicFormatters';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';
import { GroupsStandingsView } from './GroupsStandingsView';

interface BracketDataset {
  rounds: Round[];
  matches: Match[];
  players: Player[];
  users: User[];
  qualifiers: QualifierSlot[];
  groupsCount: number;
  settings: Settings;
  totalsByMatch: Map<string, Record<string, number>>;
}

export function BracketInteractiveView() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [data, setData] = useState<BracketDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stageView, setStageView] = useState<'knockout' | 'groups'>('knockout');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string>('');
  const [jumpSlotInput, setJumpSlotInput] = useState<string>('');
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);
  const [mobileRoundId, setMobileRoundId] = useState<string>('');
  const [mobileShowCanvas, setMobileShowCanvas] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  const loadSeqRef = useRef(0);
  const initializedFromQueryRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [rounds, matches, players, users, qualifiers, groups, settings] =
          await Promise.all([
            roundRepo.list(),
            matchRepo.list({ viewerRole: 'visitor' }),
            playerRepo.list({ includeHost: true }),
            userRepo.list(),
            groupRepo.listQualifiers(),
            groupRepo.list(),
            settingsRepo.get(),
          ]);

        const activeKoIds = matches
          .filter((m) => m.type !== 'group' && m.status !== 'scheduled')
          .map((m) => m.id);
        const totalsObj =
          activeKoIds.length > 0 ? await scoreRepo.getTotalsForMatches(activeKoIds) : {};
        const totalsByMatch = new Map<string, Record<string, number>>(
          Object.entries(totalsObj)
        );

        if (seq !== loadSeqRef.current) return;
        setData({
          rounds,
          matches,
          players,
          users,
          qualifiers,
          groupsCount: groups.length,
          settings,
          totalsByMatch,
        });

        const koRounds = rounds
          .filter((r) => r.stage === 'knockout' || r.stage === 'final')
          .sort((a, b) => a.order - b.order);
        setMobileRoundId((prev) => {
          if (prev && koRounds.some((r) => r.id === prev)) return prev;
          const finalR = koRounds.find((r) => r.stage === 'final');
          const semiR = koRounds.find((r) => r.id === 'round-semi');
          return semiR?.id ?? finalR?.id ?? koRounds[0]?.id ?? '';
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل شجرة البطولة.'
              : 'Failed to load tournament bracket.'
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
    return () => unsub();
  }, [loadAll]);

  // Honor deep-link query params (?game= / ?match= / ?player= / ?stage=groups)
  useEffect(() => {
    if (!data || initializedFromQueryRef.current) return;
    const qMatch = searchParams.get('match') ?? searchParams.get('game');
    const qPlayer = searchParams.get('player');
    const qStage = searchParams.get('stage');
    if (qStage === 'groups') setStageView('groups');
    if (qMatch && data.matches.some((m) => m.id === qMatch)) {
      setSelectedMatchId(qMatch);
      setFocusedMatchId(qMatch);
    }
    if (qPlayer && data.players.some((p) => p.id === qPlayer)) {
      setHighlightedPlayerId(qPlayer);
    }
    initializedFromQueryRef.current = true;
  }, [data, searchParams]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const maps = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));
    const userMap = new Map(data.users.map((u) => [u.id, u]));

    const koRounds = [...data.rounds]
      .filter((r) => r.stage === 'knockout' || r.stage === 'final')
      .sort((a, b) => a.order - b.order);
    const koMatches = data.matches.filter(
      (m) => !m.isDemo && (m.type === 'knockout' || m.type === 'final')
    );

    const matchesByRound = new Map<string, Match[]>();
    for (const r of koRounds) {
      matchesByRound.set(
        r.id,
        koMatches
          .filter((m) => m.roundId === r.id)
          .sort((a, b) => a.slot - b.slot)
      );
    }

    const byeAllocation = resolveByes(data.qualifiers, data.settings.tournament);
    const liveMatches = data.matches.filter(
      (m) => !m.isDemo && (m.status === 'live' || m.status === 'needsTieBreak')
    );

    return {
      playerMap,
      roundMap,
      userMap,
      koRounds,
      koMatches,
      matchesByRound,
      byeAllocation,
      liveMatches,
    };
  }, [data]);

  const handleJumpToMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maps) return;
    const num = parseInt(jumpSlotInput.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num < 1) return;
    const match =
      maps.koMatches.find((m) => m.slot === num) ??
      maps.koMatches.find((m) => m.id.includes(`-${num}`));
    if (!match) return;
    setFocusedMatchId(match.id);
    setSelectedMatchId(match.id);
    window.setTimeout(() => setFocusedMatchId(null), 4000);
  };

  const selectedMatch = useMemo(() => {
    if (!data || !selectedMatchId) return null;
    return data.matches.find((m) => m.id === selectedMatchId) ?? null;
  }, [data, selectedMatchId]);

  const buildMobileSlots = useCallback(
    (m: Match): BracketPlayerSlot[] => {
      if (!data || !maps) return [];
      const totals = data.totalsByMatch.get(m.id) ?? {};
      const showScores = m.status === 'live' || m.status === 'finished';
      const winnerId = m.result?.winnerId ?? m.winnerPlayerId;
      return m.participants.map((part, idx) => {
        if (part.isBye) {
          return {
            id: `bye-${m.id}-${idx}`,
            name: lang === 'ar' ? 'تأهل تلقائي (BYE)' : 'BYE',
            isBye: true,
            isPlaceholder: true,
          };
        }
        const p = part.playerId ? maps.playerMap.get(part.playerId) : null;
        if (p) {
          return {
            id: p.id,
            name: localizeText(lang, p.fullName, p.fullNameAr),
            nickname: localizeText(lang, p.nickname, p.nicknameAr),
            avatarSeed: p.avatarSeed,
            avatar: p.avatar,
            score: showScores ? (totals[p.id] ?? 0) : undefined,
            isWinner: m.status === 'finished' && winnerId === p.id,
            isAdvancing: m.status === 'finished' && winnerId === p.id,
            isHost: Boolean(part.guest || p.isGuest || p.isHost),
          };
        }
        return {
          id: `tbd-${m.id}-${idx}`,
          name:
            lang === 'ar'
              ? part.placeholderLabelAr ?? `متأهل #${idx + 1}`
              : part.placeholderLabelEn ?? `Qualifier #${idx + 1}`,
          isPlaceholder: true,
          isHost: Boolean(part.guest),
        };
      });
    },
    [data, maps, lang]
  );

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-12 space-y-6">
        <Skeleton className="h-16 w-80" />
        <Skeleton shape="card" className="h-[520px] w-full" />
      </div>
    );
  }

  return (
    <div className="pb-16">
      <PublicPageHero
        title={lang === 'ar' ? 'شجرة البطولة التفاعلية' : 'Interactive Tournament Bracket'}
        subtitle={
          lang === 'ar'
            ? `${formatNumber(data?.settings.tournament.totalPlayers ?? 720, { useArabicIndicDigits: useArabicIndic })} لاعب · ${formatNumber(data?.groupsCount ?? 0, { useArabicIndicDigits: useArabicIndic })} مجموعة ← شجرة إقصاء (${formatNumber(maps?.byeAllocation.bracketSize ?? 256, { useArabicIndicDigits: useArabicIndic })} مقعد) ← النهائي الكبير ضد مروان سري.`
            : `${formatNumber(data?.settings.tournament.totalPlayers ?? 720, { useArabicIndicDigits: useArabicIndic })} players · ${formatNumber(data?.groupsCount ?? 0, { useArabicIndicDigits: useArabicIndic })} groups → ${formatNumber(maps?.byeAllocation.bracketSize ?? 256, { useArabicIndicDigits: useArabicIndic })}-slot Knockouts → 1v1v1 Grand Final vs. Marwan Serry.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="primary" size="md" className="gap-2">
              <Link href="/final">
                <Crown className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'النهائي مع مروان' : 'Grand Final'}</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="md" className="gap-2">
              <Link href="/groups">
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'صفحة المجموعات' : 'Full Groups Page'}</span>
              </Link>
            </Button>
          </div>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {maps && maps.byeAllocation.byesCount > 0 && (
              <Badge variant="gold">
                {lang === 'ar'
                  ? `${formatNumber(maps.byeAllocation.byesCount, { useArabicIndicDigits: useArabicIndic })} مقعد BYE لأفضل المتصدرين`
                  : `${formatNumber(maps.byeAllocation.byesCount, { useArabicIndicDigits: useArabicIndic })} Best-Winner BYEs`}
              </Badge>
            )}
            {maps && maps.liveMatches.length > 0 && (
              <LiveBadge size="sm" surface="stage" />
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-content-wide px-safe pt-8 space-y-6">
        {error && <PublicErrorBanner message={error} onRetry={() => loadAll(true)} />}

        {/* Top Stage Switcher: Knockout Bracket vs Group Stage */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={stageView}
            onValueChange={(v) => setStageView(v as 'knockout' | 'groups')}
          >
            <TabsList>
              <TabsTrigger value="knockout" className="gap-1.5">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? `شجرة الإقصاء (${formatNumber(maps?.koMatches.length ?? 0, { useArabicIndicDigits: useArabicIndic })})`
                    : `Knockout Bracket (${formatNumber(maps?.koMatches.length ?? 0, { useArabicIndicDigits: useArabicIndic })})`}
                </span>
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-1.5">
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? `دور المجموعات (${formatNumber(data?.groupsCount ?? 0, { useArabicIndicDigits: useArabicIndic })})`
                    : `Group Stage (${formatNumber(data?.groupsCount ?? 0, { useArabicIndicDigits: useArabicIndic })})`}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {stageView === 'knockout' && !isDesktop && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMobileShowCanvas((v) => !v)}
            >
              {mobileShowCanvas
                ? lang === 'ar'
                  ? 'عرض حسب الجولة (موبايل)'
                  : 'Round Tabs View'
                : lang === 'ar'
                  ? 'فتح الشجرة التفاعلية (تكبير/تحريك)'
                  : 'Open Pan & Zoom Tree'}
            </Button>
          )}
        </div>

        {stageView === 'groups' ? (
          <GroupsStandingsView embedded />
        ) : (
          <div className="space-y-5">
            {/* Player Path Trace (720-ready Combobox) + Jump to Match # */}
            {data && maps && (
              <div className="flex flex-col gap-3 rounded-card border-2 border-outline bg-white p-4 shadow-sticker sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 max-w-md">
                  <PlayerCombobox
                    players={data.players}
                    value={highlightedPlayerId}
                    onChange={setHighlightedPlayerId}
                    includeGuest
                    useArabicIndicDigits={useArabicIndic}
                    emptyOptionLabel={
                      lang === 'ar' ? 'إلغاء تتبع اللاعب' : 'Clear player path'
                    }
                    placeholder={
                      lang === 'ar'
                        ? 'تتبع مسار لاعب في الشجرة (بحث في 720)...'
                        : 'Highlight player path (search 720 players)...'
                    }
                  />
                </div>

                <form onSubmit={handleJumpToMatch} className="flex items-center gap-2">
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
                      placeholder={lang === 'ar' ? 'رقم المباراة...' : 'Match / Slot #'}
                      aria-label={lang === 'ar' ? 'انتقال إلى مباراة' : 'Jump to match number'}
                      className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper ps-8 pe-3 text-base sm:text-sm font-bold tabular-nums text-ink focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <Button type="submit" variant="red" size="sm">
                    {lang === 'ar' ? 'انتقال' : 'Jump'}
                  </Button>
                </form>
              </div>
            )}

            {/* Desktop Pan/Zoom Canvas OR Mobile Round Tabs */}
            {data && maps && maps.koMatches.length > 0 ? (
              isDesktop || mobileShowCanvas ? (
                <KnockoutCanvas
                  rounds={data.rounds}
                  matches={data.matches}
                  playerMap={maps.playerMap}
                  totalsByMatch={data.totalsByMatch}
                  highlightedPlayerId={highlightedPlayerId}
                  focusedMatchId={focusedMatchId}
                  useArabicIndicDigits={useArabicIndic}
                  onSelectMatch={(m) => setSelectedMatchId(m.id)}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {maps.koRounds.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={mobileRoundId === r.id}
                        onClick={() => setMobileRoundId(r.id)}
                        className={cn(
                          'min-h-[44px] shrink-0 rounded-pill border-2 px-3.5 py-1.5 text-xs font-extrabold transition-colors',
                          mobileRoundId === r.id
                            ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                            : 'border-border-paper bg-white text-red-900'
                        )}
                      >
                        {localizeText(lang, r.name.en, r.name.ar)}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(maps.matchesByRound.get(mobileRoundId) ?? [])
                      .slice(0, 32)
                      .map((m) => (
                        <BracketNode
                          key={m.id}
                          tableName={localizeText(lang, m.tableName, m.tableNameAr)}
                          status={m.status}
                          isFinal={m.isFinal}
                          isByeMatch={m.participants.some((p) => p.isBye)}
                          players={buildMobileSlots(m)}
                          activeBuzzPlayerId={m.activeBuzzPlayerId}
                          highlightedPlayerId={highlightedPlayerId}
                          metaLabel={
                            lang === 'ar'
                              ? `طاولة #${m.tableNumber} · خانة #${m.slot}`
                              : `Table #${m.tableNumber} · Slot #${m.slot}`
                          }
                          useArabicIndicDigits={useArabicIndic}
                          onSelect={() => setSelectedMatchId(m.id)}
                        />
                      ))}
                  </div>
                  {(maps.matchesByRound.get(mobileRoundId)?.length ?? 0) > 32 && (
                    <p className="text-center text-xs font-bold text-ink-muted">
                      {lang === 'ar'
                        ? 'اضغط «فتح الشجرة التفاعلية» أو استخدم رقم المباراة للوصول السريع لكل الخانات.'
                        : 'Tap "Open Pan & Zoom Tree" or Jump to Match # to inspect all slots in this round.'}
                    </p>
                  )}
                </div>
              )
            ) : (
              <EmptyState
                title={lang === 'ar' ? 'لا توجد شجرة إقصائيات حالياً' : 'No knockout matches found'}
                description={
                  lang === 'ar'
                    ? 'ستظهر شجرة الإقصائيات فور توليد البطولة.'
                    : 'Knockout matches appear automatically once the tournament is generated.'
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Match Detail Modal / Bottom Sheet */}
      <Dialog
        open={Boolean(selectedMatch)}
        onOpenChange={(o) => {
          if (!o) setSelectedMatchId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {selectedMatch && maps && data && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-2xl text-red-900">
                  {selectedMatch.isFinal && (
                    <Crown className="h-5 w-5 text-gold-600" aria-hidden="true" />
                  )}
                  <span>
                    {localizeText(lang, selectedMatch.tableName, selectedMatch.tableNameAr)}
                  </span>
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatPublicDateTime(selectedMatch.scheduledAt, lang, useArabicIndic)}
                  </span>
                  <span>·</span>
                  <span>
                    {lang === 'ar'
                      ? `طاولة #${selectedMatch.tableNumber}`
                      : `Table #${selectedMatch.tableNumber}`}
                  </span>
                  {maps.userMap.get(selectedMatch.judgeUserId) && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {localizeText(
                          lang,
                          maps.userMap.get(selectedMatch.judgeUserId)!.name,
                          maps.userMap.get(selectedMatch.judgeUserId)!.nameAr
                        )}
                      </span>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                {selectedMatch.participants.map((part, idx) => {
                  if (part.isBye) {
                    return (
                      <div
                        key={`bye-${idx}`}
                        className="flex items-center justify-between rounded-input border-2 border-dashed border-gold-500/70 bg-gold-200/25 p-3 text-sm font-extrabold text-red-800"
                      >
                        <span>{lang === 'ar' ? 'تأهل تلقائي (BYE)' : 'BYE — Automatic Advance'}</span>
                        <Badge variant="gold">BYE</Badge>
                      </div>
                    );
                  }
                  const p = part.playerId ? maps.playerMap.get(part.playerId) : null;
                  const totals = data.totalsByMatch.get(selectedMatch.id) ?? {};
                  const score = part.playerId ? totals[part.playerId] : undefined;
                  const isWin =
                    selectedMatch.status === 'finished' &&
                    (selectedMatch.result?.winnerId ?? selectedMatch.winnerPlayerId) ===
                      part.playerId;
                  const isBuzzed =
                    selectedMatch.status === 'live' &&
                    selectedMatch.activeBuzzPlayerId === part.playerId;

                  return (
                    <div
                      key={part.playerId ?? idx}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-input border-2 p-3',
                        part.guest
                          ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
                          : isWin
                            ? 'border-outline bg-gold-200/70 text-red-900'
                            : 'border-border-paper bg-paper text-ink'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PlayerAvatar
                          name={
                            p
                              ? localizeText(lang, p.fullName, p.fullNameAr)
                              : part.placeholderLabelEn ?? 'TBD'
                          }
                          playerId={p?.id}
                          avatarSeed={p?.avatarSeed ?? `tbd-${idx}`}
                          avatar={p?.avatar}
                          size="sm"
                          isHost={Boolean(part.guest)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold">
                            {isWin && <Trophy className="h-4 w-4 text-red-700" aria-hidden="true" />}
                            {isBuzzed && <Zap className="h-4 w-4 text-red-700 fill-gold-400" aria-hidden="true" />}
                            <span className="truncate">
                              {p
                                ? localizeText(lang, p.fullName, p.fullNameAr)
                                : lang === 'ar'
                                  ? part.placeholderLabelAr ?? 'متأهل (قريباً)'
                                  : part.placeholderLabelEn ?? 'Qualifier (TBD)'}
                            </span>
                          </div>
                          {part.guest && (
                            <span className="text-xs font-extrabold text-red-900/80">
                              {lang === 'ar'
                                ? 'ضيف النهائي (خارج الترتيب والإحصائيات)'
                                : 'Guest Finalist (Excluded from rankings & stats)'}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedMatch.status !== 'scheduled' && typeof score === 'number' && (
                        <AnimatedNumber
                          value={score}
                          useArabicIndicDigits={useArabicIndic}
                          className="font-score text-2xl font-black text-red-900 tabular-nums"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="gap-2">
                {canAccessScorerGame(user, selectedMatch.judgeUserId) && (
                  <Button asChild variant="secondary" size="sm" className="gap-1.5">
                    <Link href={`/scorer/${selectedMatch.id}`}>
                      <Tablet className="h-4 w-4" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'فتح لوحة الحكم' : 'Scorer Console'}</span>
                    </Link>
                  </Button>
                )}
                <Button asChild variant="red" size="sm" className="gap-1.5">
                  <Link href={`/screen/${selectedMatch.id}`}>
                    <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'فتح شاشة العرض' : 'Open Big Screen'}</span>
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
