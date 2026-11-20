'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Tablet,
  Undo2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  gameRepo,
  playerRepo,
  scoreRepo,
  segmentRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Game, Player, ScoreEvent, Segment, Settings } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton, PlayerPanelSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { ScoreboardRow } from '@/components/brand/ScoreboardRow';
import { SectionHeading } from '@/components/brand/SectionHeading';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';
import { TimerRing } from '@/components/brand/TimerRing';

const DEMO_GAME_ID = 'game-demo';
const DEMO_SCORER_ID = 'user-scorer-1';

export interface LiveDemoSectionProps {
  settings: Settings | null;
}

export function LiveDemoSection({ settings }: LiveDemoSectionProps) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const useArabicIndic = settings?.useArabicIndicDigits ?? false;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('player-1');
  const [customPoints, setCustomPoints] = useState<string>('15');
  const [customNote, setCustomNote] = useState<string>('');
  const [recentDeltaByPlayer, setRecentDeltaByPlayer] = useState<
    Record<string, number | null>
  >({});
  const [displayRemainingSec, setDisplayRemainingSec] = useState<number>(32);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [liveOfficialGameId, setLiveOfficialGameId] = useState<string | null>(null);

  const loadDemoState = useCallback(async () => {
    const [demoGame, allPlayers, allSegments, gameTotals, gameEvents, liveGames] =
      await Promise.all([
        gameRepo.get(DEMO_GAME_ID),
        playerRepo.list({ includeHost: false }),
        segmentRepo.list(),
        scoreRepo.getGameTotals(DEMO_GAME_ID),
        scoreRepo.list({ gameId: DEMO_GAME_ID, order: 'newest' }),
        gameRepo.getLiveGames(),
      ]);

    const resolvedGame =
      demoGame ?? (await gameRepo.resetDemoGame(DEMO_GAME_ID));

    if (resolvedGame) {
      setGame(resolvedGame);
      setSelectedPlayerId((prev) =>
        resolvedGame.playerIds.includes(prev)
          ? prev
          : (resolvedGame.playerIds[0] ?? prev)
      );

      if (resolvedGame.timer?.status === 'running' && resolvedGame.timer.endsAt) {
        const left = Math.max(
          0,
          Math.ceil(
            (new Date(resolvedGame.timer.endsAt).getTime() - Date.now()) / 1000
          )
        );
        setDisplayRemainingSec(left);
      } else if (resolvedGame.timer) {
        setDisplayRemainingSec(resolvedGame.timer.remainingSec);
      }
    }

    setLiveOfficialGameId(liveGames[0]?.id ?? null);
    setPlayers(allPlayers);
    setSegments(allSegments);
    setTotals(gameTotals);
    setEvents(gameEvents);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDemoState();
    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)
        ?.gameId;
      if (
        !payloadGameId ||
        payloadGameId === DEMO_GAME_ID ||
        msg.event === 'data.reset'
      ) {
        loadDemoState();
      }
    });
    return () => unsub();
  }, [loadDemoState]);

  // Smooth 1-second timer tick while demo timer is running
  useEffect(() => {
    if (!game?.timer || game.timer.status !== 'running') {
      return;
    }

    const tick = () => {
      if (game.timer?.endsAt) {
        const left = Math.max(
          0,
          Math.ceil(
            (new Date(game.timer.endsAt).getTime() - Date.now()) / 1000
          )
        );
        setDisplayRemainingSec(left);
        if (left === 0) {
          gameRepo.updateTimer(
            DEMO_GAME_ID,
            {
              status: 'paused',
              durationSec: game.timer.durationSec,
              remainingSec: 0,
              endsAt: null,
            },
            DEMO_SCORER_ID
          );
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [game?.timer]);

  const demoPlayers = useMemo(() => {
    if (!game) return [];
    return game.playerIds
      .map((pid) => players.find((p) => p.id === pid))
      .filter((p): p is Player => Boolean(p));
  }, [game, players]);

  const demoSegments = useMemo(() => {
    if (!game) return [];
    return game.segmentIds
      .map((sid) => segments.find((s) => s.id === sid))
      .filter((s): s is Segment => Boolean(s));
  }, [game, segments]);

  const currentSegment = useMemo(() => {
    if (!game || demoSegments.length === 0) return null;
    return demoSegments[game.currentSegmentIndex] ?? demoSegments[0] ?? null;
  }, [game, demoSegments]);

  const sortedStandings = useMemo(() => {
    return [...demoPlayers]
      .map((player) => ({
        player,
        score: totals[player.id] ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.player.seed - b.player.seed);
  }, [demoPlayers, totals]);

  const buzzedPlayer = useMemo(() => {
    if (!game?.activeBuzzPlayerId) return null;
    return demoPlayers.find((p) => p.id === game.activeBuzzPlayerId) ?? null;
  }, [game?.activeBuzzPlayerId, demoPlayers]);

  const canUndo = useMemo(
    () => events.some((e) => e.kind !== 'undo' && !e.undoneByEventId),
    [events]
  );

  const flashPlayerDelta = (playerId: string, delta: number) => {
    setRecentDeltaByPlayer((prev) => ({ ...prev, [playerId]: delta }));
    window.setTimeout(() => {
      setRecentDeltaByPlayer((prev) => ({ ...prev, [playerId]: null }));
    }, 1700);
  };

  const handleBuzz = async (player: Player) => {
    if (!game || !currentSegment || busyAction) return;
    setBusyAction(true);
    try {
      setSelectedPlayerId(player.id);
      await scoreRepo.recordBuzz({
        gameId: DEMO_GAME_ID,
        segmentId: currentSegment.id,
        playerId: player.id,
        byUserId: DEMO_SCORER_ID,
      });
      await loadDemoState();
      toast({
        variant: 'gold',
        title:
          lang === 'ar'
            ? `${player.fullNameAr} ضغط الجرس أولاً!`
            : `${player.fullName} buzzed first!`,
        description:
          lang === 'ar'
            ? 'تم تحديث إضاءة الجرس على شاشة العرض فوراً.'
            : 'Big Screen spotlight updated live via BroadcastChannel.',
        durationMs: 2400,
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleClearBuzz = async () => {
    if (!game || busyAction) return;
    setBusyAction(true);
    try {
      await scoreRepo.clearBuzz(DEMO_GAME_ID, DEMO_SCORER_ID);
      await loadDemoState();
    } finally {
      setBusyAction(false);
    }
  };

  const handleApplyPoints = async (
    player: Player,
    delta: number,
    kind: 'preset' | 'custom',
    note?: string
  ) => {
    if (!game || !currentSegment || busyAction || Number.isNaN(delta) || delta === 0) {
      return;
    }
    setBusyAction(true);
    try {
      setSelectedPlayerId(player.id);
      await scoreRepo.applyScore({
        gameId: DEMO_GAME_ID,
        segmentId: currentSegment.id,
        playerId: player.id,
        delta,
        note: note?.trim() || undefined,
        kind,
        byUserId: DEMO_SCORER_ID,
      });
      flashPlayerDelta(player.id, delta);
      await loadDemoState();
      const signText = delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
      toast({
        variant: delta > 0 ? 'positive' : 'negative',
        title:
          lang === 'ar'
            ? `${signText} نقطة لـ ${player.fullNameAr}`
            : `${signText} pts → ${player.fullName}`,
        description: note?.trim() || localizeText(lang, currentSegment.nameEn, currentSegment.nameAr),
        durationMs: 2200,
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selected = demoPlayers.find((p) => p.id === selectedPlayerId);
    const parsed = parseInt(customPoints, 10);
    if (!selected || Number.isNaN(parsed) || parsed === 0) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'أدخل رقماً صحيحاً غير الصفر' : 'Enter a valid non-zero number',
        description:
          lang === 'ar'
            ? 'مثال: 15 أو -10 ثم اضغط تطبيق.'
            : 'Example: 15 or -10, then apply to the selected player.',
      });
      return;
    }
    await handleApplyPoints(selected, parsed, 'custom', customNote);
    setCustomNote('');
  };

  const handleUndo = async () => {
    if (!canUndo || busyAction) return;
    setBusyAction(true);
    try {
      const undone = await scoreRepo.undoLastScore(DEMO_GAME_ID, DEMO_SCORER_ID);
      if (undone) {
        flashPlayerDelta(undone.playerId, undone.delta);
        await loadDemoState();
        toast({
          variant: 'info',
          title: lang === 'ar' ? 'تم التراجع عن آخر حركة' : 'Last score action undone',
          description: undone.note,
          durationMs: 2400,
        });
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleSegmentStep = async (nextIndex: number) => {
    if (!game || busyAction) return;
    setBusyAction(true);
    try {
      await gameRepo.changeSegment(DEMO_GAME_ID, nextIndex, DEMO_SCORER_ID);
      await loadDemoState();
    } finally {
      setBusyAction(false);
    }
  };

  const handleTimerStart = async () => {
    if (!game || !currentSegment) return;
    const dur = game.timer?.durationSec ?? currentSegment.durationSec ?? 45;
    const rem = displayRemainingSec > 0 ? displayRemainingSec : dur;
    await gameRepo.updateTimer(
      DEMO_GAME_ID,
      {
        status: 'running',
        durationSec: dur,
        remainingSec: rem,
        endsAt: new Date(Date.now() + rem * 1000).toISOString(),
      },
      DEMO_SCORER_ID
    );
    await loadDemoState();
  };

  const handleTimerPause = async () => {
    if (!game || !currentSegment) return;
    const dur = game.timer?.durationSec ?? currentSegment.durationSec ?? 45;
    await gameRepo.updateTimer(
      DEMO_GAME_ID,
      {
        status: 'paused',
        durationSec: dur,
        remainingSec: displayRemainingSec,
        endsAt: null,
      },
      DEMO_SCORER_ID
    );
    await loadDemoState();
  };

  const handleTimerReset = async () => {
    if (!game || !currentSegment) return;
    const dur = currentSegment.durationSec ?? 45;
    setDisplayRemainingSec(dur);
    await gameRepo.updateTimer(
      DEMO_GAME_ID,
      {
        status: 'idle',
        durationSec: dur,
        remainingSec: dur,
        endsAt: null,
      },
      DEMO_SCORER_ID
    );
    await loadDemoState();
  };

  const handleResetDemo = async () => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      await gameRepo.resetDemoGame(DEMO_GAME_ID);
      setRecentDeltaByPlayer({});
      await loadDemoState();
      toast({
        variant: 'gold',
        title: lang === 'ar' ? 'تمت إعادة ضبط طاولة التجربة' : 'Demo table restored',
        description:
          lang === 'ar'
            ? 'عادت طاولة العرض إلى حالتها الافتراضية دون المساس بترتيب البطولة.'
            : 'Exhibition table reset cleanly without affecting tournament standings.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const presetPoints = currentSegment?.presetPoints ?? [10, 5, -5];
  const selectedPlayer =
    demoPlayers.find((p) => p.id === selectedPlayerId) ?? demoPlayers[0] ?? null;

  return (
    <div id="live-demo" className="relative scroll-mt-20">
      <section className="theme-paper bg-paper paper-pattern py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-6 sm:space-y-8">
          <SectionHeading
            surface="paper"
            align="center"
            size="lg"
            title={
              lang === 'ar'
                ? 'جرّب إدارة العرض مباشرة من هنا'
                : 'Operate the Show Live Right Here'
            }
            goldKeyword={lang === 'ar' ? 'مباشرة من هنا' : 'Live Right Here'}
            subtitle={
              lang === 'ar'
                ? 'اضغط الجرس واحتسب النقاط أو تراجع من لوحة الحكم—وشاهد شاشة الاستوديو تتحدث لحظياً عبر المستودعات الحقيقية وقناة البث الفوري دون التأثير على ترتيب البطولة الرسمي.'
                : 'Tap Buzz, score presets, or undo on the mini Scorer Console—watch the Big Screen update live through our real repositories and BroadcastChannel without altering official tournament standings.'
            }
          />

          {/* Guided Pitch Prompt Strip + Reset / Pop-Out Tab Controls */}
          <div className="flex flex-col gap-3 rounded-card border-2 border-outline bg-white p-3.5 sm:p-4 shadow-sticker-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-red-900">
              <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-gold-400 px-3 py-1 text-red-900">
                <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>{lang === 'ar' ? '١. اضغط الجرس' : '1. Tap Buzz'}</span>
              </span>
              <span className="text-ink-faint" aria-hidden="true">→</span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-positive bg-positive-soft px-3 py-1 text-positive-ink">
                <Plus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                <span>{lang === 'ar' ? '٢. امنح +١٠ أو مخصص' : '2. Tap +10 / Custom'}</span>
              </span>
              <span className="text-ink-faint" aria-hidden="true">→</span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-blue-600 bg-blue-100 px-3 py-1 text-blue-800">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? '٣. شاهد البث الحي' : '3. Watch Screen Sync'}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetDemo}
                disabled={busyAction || loading}
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{lang === 'ar' ? 'إعادة ضبط التجربة' : 'Reset Demo Table'}</span>
              </Button>
              <Button variant="info" size="sm" asChild>
                <Link href={`/screen/${DEMO_GAME_ID}`} target="_blank">
                  <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'افتح في نافذة شاشة مستقلة' : 'Pop Out Big Screen Tab'}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-4 rounded-card border-[2.5px] border-outline bg-red-900 p-5">
                <Skeleton className="h-10 w-56 bg-red-800" />
                <PlayerPanelSkeleton />
                <PlayerPanelSkeleton />
              </div>
              <div className="lg:col-span-6 space-y-4 rounded-card border-[2.5px] border-outline bg-red-600 p-5">
                <Skeleton className="h-12 w-full bg-red-700" />
                <PlayerPanelSkeleton />
                <PlayerPanelSkeleton />
              </div>
            </div>
          ) : (
            <div className="grid items-stretch gap-6 lg:grid-cols-12">
              {/* LEFT / START: Mini Scorer Console (Stage-Dark) */}
              <div className="theme-stage-dark lg:col-span-6 flex min-w-0 flex-col justify-between gap-4 rounded-card border-[3px] border-outline bg-red-900 p-4 sm:p-5 text-white shadow-sticker-lg">
                {/* Console Header & Segment Switcher */}
                <div className="space-y-3 border-b-2 border-white/15 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-button border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
                        <Tablet className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <div className="font-display text-lg text-white leading-tight">
                          {lang === 'ar' ? 'لوحة تحكم الحكم المصغرة' : 'Mini Scorer Console'}
                        </div>
                        <div className="text-xs font-semibold text-red-100">
                          {lang === 'ar'
                            ? 'طاولة تجريبية مستقلة · أزرار سريعة'
                            : 'Isolated exhibition table · 1-tap controls'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {game?.activeBuzzPlayerId && (
                        <button
                          type="button"
                          onClick={handleClearBuzz}
                          disabled={busyAction}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-white px-3 py-1.5 text-xs font-extrabold text-red-900 shadow-sticker-sm sticker-press hover:bg-paper"
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                          <span>{lang === 'ar' ? 'مسح الجرس' : 'Clear Buzz'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={!canUndo || busyAction}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-gold-400 px-3.5 py-1.5 text-xs font-black text-red-900 shadow-sticker-sm sticker-press disabled:opacity-45 disabled:pointer-events-none hover:bg-gold-300"
                      >
                        <Undo2 className="h-4 w-4" aria-hidden="true" />
                        <span>{lang === 'ar' ? 'تراجع' : 'Undo'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Segment Switcher Bar */}
                  {game && currentSegment && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-input border-2 border-white/20 bg-red-800/80 p-2">
                      <button
                        type="button"
                        onClick={() => handleSegmentStep(game.currentSegmentIndex - 1)}
                        disabled={game.currentSegmentIndex <= 0 || busyAction}
                        aria-label={lang === 'ar' ? 'الفقرة السابقة' : 'Previous segment'}
                        className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white text-red-900 shadow-sticker-sm disabled:opacity-40"
                      >
                        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                      </button>

                      <div className="min-w-0 flex-1 text-center px-1">
                        <div className="text-[11px] font-bold uppercase ltr:tracking-wider rtl:tracking-normal text-gold-200">
                          {lang === 'ar'
                            ? `الفقرة ${formatNumber(game.currentSegmentIndex + 1, { useArabicIndicDigits: useArabicIndic })} من ${formatNumber(demoSegments.length, { useArabicIndicDigits: useArabicIndic })}`
                            : `SEGMENT ${game.currentSegmentIndex + 1} OF ${demoSegments.length}`}
                        </div>
                        <div className="truncate text-sm sm:text-base font-bold text-white">
                          {localizeText(lang, currentSegment.nameEn, currentSegment.nameAr)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSegmentStep(game.currentSegmentIndex + 1)}
                        disabled={
                          game.currentSegmentIndex >= demoSegments.length - 1 || busyAction
                        }
                        aria-label={lang === 'ar' ? 'الفقرة التالية' : 'Next segment'}
                        className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white text-red-900 shadow-sticker-sm disabled:opacity-40"
                      >
                        <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 3 Player Console Strips with 56px+ Touch Targets */}
                <div className="space-y-3">
                  {demoPlayers.map((player) => {
                    const score = totals[player.id] ?? 0;
                    const isBuzzed = game?.activeBuzzPlayerId === player.id;
                    const isSelected = selectedPlayerId === player.id;
                    const displayName = localizeText(lang, player.fullName, player.fullNameAr);
                    const displayNick = localizeText(lang, player.nickname, player.nicknameAr);

                    return (
                      <div
                        key={player.id}
                        className={cn(
                          'rounded-card border-[2.5px] bg-red-800 p-3 sm:p-3.5 transition-all',
                          isSelected
                            ? 'border-white ring-[3px] ring-blue-500'
                            : isBuzzed
                              ? 'border-gold-300 ring-[3px] ring-gold-400 shadow-glow-gold'
                              : 'border-red-900'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerId(player.id)}
                          aria-pressed={isSelected}
                          className="flex min-h-[44px] w-full flex-wrap items-center justify-between gap-2 pb-2.5 text-start rounded-input focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <PlayerAvatar
                              name={displayName}
                              avatarSeed={player.avatarSeed}
                              size="sm"
                              buzzed={isBuzzed}
                              selected={isSelected}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate font-display text-base sm:text-lg text-white">
                                  {displayName}
                                </span>
                                {isSelected && (
                                  <Badge variant="info" className="px-2 py-0 text-[11px]">
                                    {lang === 'ar' ? 'مختار' : 'SELECTED'}
                                  </Badge>
                                )}
                                {isBuzzed && (
                                  <Badge variant="gold" className="px-2 py-0 text-[11px]">
                                    <Zap className="h-3 w-3 fill-current" aria-hidden="true" />
                                    <span>{lang === 'ar' ? 'الجرس' : 'BUZZED'}</span>
                                  </Badge>
                                )}
                              </div>
                              <div className="truncate text-xs text-red-100">
                                “{displayNick}”
                              </div>
                            </div>
                          </div>

                          <div className="flex items-baseline gap-1 ms-auto">
                            <AnimatedNumber
                              value={score}
                              useArabicIndicDigits={useArabicIndic}
                              className="font-score text-3xl sm:text-4xl font-black leading-none text-gold-300 tabular-nums"
                            />
                            <span className="text-[11px] font-bold uppercase text-white/85">
                              {lang === 'ar' ? 'نقطة' : 'PTS'}
                            </span>
                          </div>
                        </button>

                        {/* 56px+ Scorer Action Buttons */}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                          <button
                            type="button"
                            onClick={() => handleBuzz(player)}
                            disabled={busyAction}
                            className={cn(
                              'sm:col-span-5 flex min-h-[56px] items-center justify-center gap-1.5 rounded-button border-[2.5px] border-outline px-3 text-sm font-extrabold shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                              isBuzzed
                                ? 'bg-gold-gradient text-red-900 shadow-glow-gold'
                                : 'bg-white text-red-900 hover:bg-paper'
                            )}
                          >
                            <Zap
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isBuzzed ? 'fill-red-900 text-red-900' : 'text-red-600'
                              )}
                              aria-hidden="true"
                            />
                            <span>
                              {isBuzzed
                                ? lang === 'ar'
                                  ? 'ضغط أولاً ✓'
                                  : 'Buzzed First ✓'
                                : lang === 'ar'
                                  ? 'ضغط الجرس'
                                  : 'Buzzed First'}
                            </span>
                          </button>

                          <div className="sm:col-span-7 grid grid-cols-3 gap-1.5">
                            {presetPoints.map((pts) => {
                              const isPos = pts > 0;
                              return (
                                <button
                                  key={pts}
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() =>
                                    handleApplyPoints(player, pts, 'preset')
                                  }
                                  className={cn(
                                    'flex min-h-[56px] items-center justify-center gap-0.5 rounded-button border-[2.5px] border-outline font-score text-xl font-black tabular-nums shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                                    isPos
                                      ? 'bg-positive-soft text-positive-ink hover:bg-positive hover:text-ink'
                                      : 'bg-negative text-white hover:bg-red-900'
                                  )}
                                >
                                  {isPos ? (
                                    <Plus className="h-4 w-4 stroke-[3] shrink-0" aria-hidden="true" />
                                  ) : (
                                    <Minus className="h-4 w-4 stroke-[3] shrink-0" aria-hidden="true" />
                                  )}
                                  <span>
                                    {formatNumber(Math.abs(pts), {
                                      useArabicIndicDigits: useArabicIndic,
                                    })}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom +/- Points Input + Timer Controls */}
                <div className="space-y-3 border-t-2 border-white/15 pt-4">
                  <form
                    onSubmit={handleCustomSubmit}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-3">
                      <label htmlFor="demo-custom-pts" className="sr-only">
                        {lang === 'ar' ? 'نقاط مخصصة (+/-)' : 'Custom points (+/-)'}
                      </label>
                      <Input
                        id="demo-custom-pts"
                        type="number"
                        value={customPoints}
                        onChange={(e) => setCustomPoints(e.target.value)}
                        placeholder="+15 / -10"
                        className="min-h-[56px] text-center font-score text-xl font-black text-red-900"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label htmlFor="demo-custom-note" className="sr-only">
                        {lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional note'}
                      </label>
                      <Input
                        id="demo-custom-note"
                        type="text"
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        placeholder={
                          lang === 'ar' ? 'ملاحظة (اختياري)...' : 'Note (optional)...'
                        }
                        className="min-h-[56px]"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Button
                        type="submit"
                        variant="gold"
                        size="scorer"
                        className="w-full"
                        disabled={busyAction || !selectedPlayer}
                      >
                        <span>
                          {lang === 'ar'
                            ? `تطبيق (${selectedPlayer?.nicknameAr ?? ''})`
                            : `Apply (${selectedPlayer?.nickname ?? ''})`}
                        </span>
                      </Button>
                    </div>
                  </form>

                  {/* Timer Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-input border-2 border-white/20 bg-red-800/80 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <span className="uppercase ltr:tracking-wider rtl:tracking-normal text-gold-200">
                        {lang === 'ar' ? 'مؤقت الفقرة' : 'SEGMENT TIMER'}
                      </span>
                      <span className="font-score text-2xl font-black text-white tabular-nums">
                        {formatNumber(displayRemainingSec, {
                          useArabicIndicDigits: useArabicIndic,
                        })}
                        s
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {game?.timer?.status === 'running' ? (
                        <button
                          type="button"
                          onClick={handleTimerPause}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-white px-3.5 py-1.5 text-xs font-extrabold text-red-900 shadow-sticker-sm sticker-press"
                        >
                          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{lang === 'ar' ? 'إيقاف' : 'Pause'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleTimerStart}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-gold-gradient px-3.5 py-1.5 text-xs font-extrabold text-red-900 shadow-sticker-sm sticker-press"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          <span>{lang === 'ar' ? 'بدء المؤقت' : 'Start Timer'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleTimerReset}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-paper px-3 py-1.5 text-xs font-bold text-ink shadow-sticker-sm sticker-press"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{lang === 'ar' ? 'إعادة' : 'Reset'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT / END: Mini Big Screen Monitor (MarqueeBulbs + SunburstStage) */}
              <div className="lg:col-span-6 flex min-w-0 flex-col">
                <MarqueeBulbs variant="perimeter" bulbCount={12} className="flex-1">
                  <SunburstStage
                    variant="stage"
                    as="div"
                    className="flex h-full flex-col justify-between rounded-card border-[3px] border-outline p-4 sm:p-5 shadow-sticker-lg"
                  >
                    {/* Screen Top Bar: LIVE pill + Synced TimerRing */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <LiveBadge
                            surface="stage"
                            size="sm"
                            label={
                              lang === 'ar'
                                ? 'مباشر · شاشة العرض'
                                : 'LIVE · BIG SCREEN'
                            }
                          />
                          <span className="rounded-pill border border-outline bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-red-900 shadow-sticker-sm">
                            {lang === 'ar' ? 'تحديث لحظي' : 'REALTIME SYNCED'}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white/90">
                          {game
                            ? localizeText(lang, game.tableName, game.tableNameAr)
                            : ''}
                        </div>
                      </div>

                      <TimerRing
                        durationSec={
                          game?.timer?.durationSec ??
                          currentSegment?.durationSec ??
                          45
                        }
                        remainingSec={displayRemainingSec}
                        status={game?.timer?.status ?? 'idle'}
                        size="sm"
                        surface="stage"
                        useArabicIndicDigits={useArabicIndic}
                      />
                    </div>

                    {/* Bilingual Segment Banner (EN + AR per DESIGN.md §8) */}
                    {currentSegment && (
                      <div className="my-4 rounded-card border-[2.5px] border-outline bg-red-900/90 px-4 py-3 text-center shadow-sticker-sm">
                        <div className="font-display text-lg sm:text-xl text-gold-sticker leading-snug">
                          {currentSegment.nameEn}
                        </div>
                        <div
                          className="mt-0.5 font-display text-base sm:text-lg text-white leading-snug"
                          dir="rtl"
                        >
                          {currentSegment.nameAr}
                        </div>
                      </div>
                    )}

                    {/* Active Buzz Spotlight Strip */}
                    <AnimatePresence mode="wait">
                      {buzzedPlayer ? (
                        <motion.div
                          key={buzzedPlayer.id}
                          initial={
                            prefersReducedMotion
                              ? { opacity: 1 }
                              : { opacity: 0, y: -6, scale: 0.98 }
                          }
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className="mb-3 flex items-center justify-between gap-2 rounded-card border-[2.5px] border-outline bg-gold-gradient px-3.5 py-2.5 text-red-900 shadow-glow-gold"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Zap className="h-5 w-5 shrink-0 fill-red-900" aria-hidden="true" />
                            <span className="truncate font-display text-base sm:text-lg">
                              {lang === 'ar'
                                ? `${buzzedPlayer.fullNameAr} ضغط الجرس أولاً!`
                                : `${buzzedPlayer.fullName} BUZZED FIRST!`}
                            </span>
                          </div>
                          <span className="shrink-0 rounded-pill border-2 border-outline bg-white px-2.5 py-0.5 text-[11px] font-black text-red-900">
                            {lang === 'ar' ? 'دوره الآن' : 'ON MIC'}
                          </span>
                        </motion.div>
                      ) : (
                        <div className="mb-3 flex items-center justify-center rounded-card border-2 border-dashed border-white/40 bg-red-900/45 px-3.5 py-2 text-xs font-bold text-white/90">
                          {lang === 'ar'
                            ? 'في انتظار ضغطة الجرس من لوحة الحكم...'
                            : 'Waiting for scorer to tap Buzzed First...'}
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Live Animated Standings Rows (Layout Animated Rank Reordering) */}
                    <div className="space-y-2.5">
                      {sortedStandings.map((entry, idx) => (
                        <ScoreboardRow
                          key={entry.player.id}
                          rank={idx + 1}
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
                          score={entry.score}
                          recentDelta={recentDeltaByPlayer[entry.player.id] ?? null}
                          isHighlighted={
                            game?.activeBuzzPlayerId === entry.player.id
                          }
                          useArabicIndicDigits={useArabicIndic}
                          appearance="sticker"
                        />
                      ))}
                    </div>

                    {/* Recent Feed & Full Console Deep Links */}
                    <div className="mt-4 space-y-3 border-t-2 border-white/20 pt-3">
                      <div className="rounded-input border-2 border-outline bg-white px-3 py-2 text-xs text-ink shadow-sticker-sm">
                        <div className="flex items-center justify-between gap-2 pb-1 text-[11px] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                          <span>
                            {lang === 'ar'
                              ? 'آخر حركات النقاط المسجلة'
                              : 'LATEST RECORDED EVENTS'}
                          </span>
                          <span>
                            {formatNumber(events.length, {
                              useArabicIndicDigits: useArabicIndic,
                            })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {events.slice(0, 2).map((ev) => {
                            const p = players.find((pl) => pl.id === ev.playerId);
                            const isPos = ev.delta > 0;
                            return (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="truncate font-semibold text-ink">
                                  {p
                                    ? localizeText(lang, p.fullName, p.fullNameAr)
                                    : ev.playerId}
                                  {ev.note ? (
                                    <span className="text-ink-muted"> — {ev.note}</span>
                                  ) : null}
                                </span>
                                <span
                                  className={cn(
                                    'inline-flex shrink-0 items-center gap-0.5 rounded-pill border px-2 py-0.5 font-score text-xs font-black tabular-nums',
                                    isPos
                                      ? 'border-positive bg-positive-soft text-positive-ink'
                                      : 'border-outline bg-negative text-white'
                                  )}
                                >
                                  {isPos ? (
                                    <Plus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                                  ) : (
                                    <Minus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                                  )}
                                  {formatNumber(Math.abs(ev.delta), {
                                    useArabicIndicDigits: useArabicIndic,
                                  })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="gold" size="sm" asChild>
                          <Link href={liveOfficialGameId ? `/scorer/${liveOfficialGameId}` : '/scorer'}>
                            <Tablet className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>
                              {lang === 'ar'
                                ? 'افتح لوحة الحكم الكاملة'
                                : 'Open Full Scorer Console'}
                            </span>
                          </Link>
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={liveOfficialGameId ? `/screen/${liveOfficialGameId}` : '/screen/leaderboard'}>
                            <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>
                              {lang === 'ar'
                                ? 'شاهد المباراة المباشرة'
                                : 'Watch Live Big Screen'}
                            </span>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </SunburstStage>
                </MarqueeBulbs>
              </div>
            </div>
          )}
        </div>
      </section>

      <StageDivider variant="angled" from="paper" to="stage" />
    </div>
  );
}
