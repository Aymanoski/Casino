'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  History,
  Keyboard,
  Minus,
  MonitorPlay,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import {
  canAccessScorerGame,
  canManageScoreHistory,
  canReopenFinishedGame,
  useAuth,
} from '@/lib/auth';
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
  BuzzEvent,
  Game,
  Player,
  Round,
  ScoreEvent,
  Segment,
  SegmentCategory,
  Settings,
  User,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PlayerPanelSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  AnimatedNumber,
  LiveBadge,
  PlayerAvatar,
  PlayerPanel,
  TimerRing,
} from '@/components/brand';
import { SessionHistoryDrawer } from './SessionHistoryDrawer';

const CATEGORY_LABELS: Record<
  SegmentCategory,
  { en: string; ar: string; badge: 'gold' | 'red' | 'info' | 'neutral' }
> = {
  music: { en: 'Music & Singing', ar: 'غناء وموسيقى', badge: 'gold' },
  wordplay: { en: 'Wordplay & Speed', ar: 'سرعة وكلمات', badge: 'info' },
  popculture: { en: 'Cinema & Pop Culture', ar: 'سينما وفن', badge: 'red' },
  general: { en: 'General Knowledge', ar: 'معلومات عامة', badge: 'neutral' },
  special: { en: 'Special / Tie-Breaker', ar: 'فقرة خاصة / حسم', badge: 'gold' },
};

function formatDateTime(
  iso: string | undefined,
  lang: 'en' | 'ar',
  useArabicIndicDigits: boolean
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

export function ScorerConsoleView({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [buzzEvents, setBuzzEvents] = useState<BuzzEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<boolean>(false);

  // Selected target player for Action Dock
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [recentDeltaByPlayer, setRecentDeltaByPlayer] = useState<
    Record<string, number | null>
  >({});

  // Custom score input & mobile expandable drawer inside sticky dock
  const [customPoints, setCustomPoints] = useState<string>('15');
  const [customNote, setCustomNote] = useState<string>('');
  const [mobileCustomOpen, setMobileCustomOpen] = useState<boolean>(false);

  // Timer live display seconds
  const [displayRemainingSec, setDisplayRemainingSec] = useState<number>(45);
  const timerExpireHandledRef = useRef<boolean>(false);

  // Tie-breaker alert state (captures tied player IDs when auto-triggered)
  const [tieBreakerPlayerIds, setTieBreakerPlayerIds] = useState<string[]>([]);

  // Drawers & Confirmation Dialogs
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState<boolean>(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState<boolean>(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState<boolean>(false);
  const [confirmResetTimerOpen, setConfirmResetTimerOpen] = useState<boolean>(false);
  const [pendingSegmentIndex, setPendingSegmentIndex] = useState<number | null>(null);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const isSuperAdmin = user?.role === 'superAdmin';
  const canManageHistory = canManageScoreHistory(user?.role ?? null);
  const canReopen = canReopenFinishedGame(user?.role ?? null);

  const loadConsoleState = useCallback(async () => {
    const [
      loadedGame,
      loadedPlayers,
      loadedSegments,
      loadedUsers,
      loadedSettings,
      gameTotals,
      gameScores,
      gameBuzzes,
    ] = await Promise.all([
      gameRepo.get(gameId),
      playerRepo.list({ includeHost: true }),
      segmentRepo.list(),
      userRepo.list(),
      settingsRepo.get(),
      scoreRepo.getGameTotals(gameId),
      scoreRepo.listByGame(gameId),
      scoreRepo.listBuzzByGame(gameId),
    ]);

    let loadedRound: Round | null = null;
    if (loadedGame) {
      loadedRound = await roundRepo.get(loadedGame.roundId);

      // Sync timer remaining seconds
      if (loadedGame.timer?.status === 'running' && loadedGame.timer.endsAt) {
        const left = Math.max(
          0,
          Math.ceil(
            (new Date(loadedGame.timer.endsAt).getTime() - Date.now()) / 1000
          )
        );
        setDisplayRemainingSec(left);
        if (left > 0) timerExpireHandledRef.current = false;
      } else if (loadedGame.timer) {
        setDisplayRemainingSec(loadedGame.timer.remainingSec);
      } else {
        const segId = loadedGame.segmentIds[loadedGame.currentSegmentIndex];
        const seg = loadedSegments.find((s) => s.id === segId);
        setDisplayRemainingSec(seg?.durationSec ?? 45);
      }

      setSelectedPlayerId((prev) => {
        if (prev && loadedGame.playerIds.includes(prev)) return prev;
        if (
          loadedGame.activeBuzzPlayerId &&
          loadedGame.playerIds.includes(loadedGame.activeBuzzPlayerId)
        ) {
          return loadedGame.activeBuzzPlayerId;
        }
        return loadedGame.playerIds[0] ?? '';
      });
    }

    setGame(loadedGame);
    setRound(loadedRound);
    setAllPlayers(loadedPlayers);
    setAllSegments(loadedSegments);
    setAllUsers(loadedUsers);
    setSettings(loadedSettings);
    setTotals(gameTotals);
    setScoreEvents(gameScores);
    setBuzzEvents(gameBuzzes);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    loadConsoleState();
    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)
        ?.gameId;
      if (
        !payloadGameId ||
        payloadGameId === gameId ||
        msg.event === 'data.reset'
      ) {
        loadConsoleState();
      }
    });
    return () => unsub();
  }, [gameId, loadConsoleState]);

  // Accurate 250ms timer tick when running
  useEffect(() => {
    if (!game?.timer || game.timer.status !== 'running' || !game.timer.endsAt) {
      return;
    }

    const durationSec = game.timer.durationSec;
    const endsAtMs = new Date(game.timer.endsAt).getTime();

    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
      setDisplayRemainingSec(left);
      if (left === 0 && !timerExpireHandledRef.current) {
        timerExpireHandledRef.current = true;
        gameRepo.updateTimer(
          game.id,
          {
            status: 'paused',
            durationSec,
            remainingSec: 0,
            endsAt: null,
          },
          user?.id
        );
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [game?.id, game?.timer, user?.id]);

  // Derived entities
  const seatedPlayers = useMemo(() => {
    if (!game) return [];
    return game.playerIds
      .map((pid) => allPlayers.find((p) => p.id === pid))
      .filter((p): p is Player => Boolean(p));
  }, [game, allPlayers]);

  const gameSegments = useMemo(() => {
    if (!game) return [];
    return game.segmentIds
      .map((sid) => allSegments.find((s) => s.id === sid))
      .filter((s): s is Segment => Boolean(s));
  }, [game, allSegments]);

  const currentSegment = useMemo(() => {
    if (!game || gameSegments.length === 0) return null;
    return gameSegments[game.currentSegmentIndex] ?? gameSegments[0] ?? null;
  }, [game, gameSegments]);

  const assignedScorer = useMemo(() => {
    if (!game) return null;
    return allUsers.find((u) => u.id === game.scorerUserId) ?? null;
  }, [game, allUsers]);

  const selectedPlayer = useMemo(() => {
    return (
      seatedPlayers.find((p) => p.id === selectedPlayerId) ??
      seatedPlayers[0] ??
      null
    );
  }, [seatedPlayers, selectedPlayerId]);

  const buzzedPlayer = useMemo(() => {
    if (!game?.activeBuzzPlayerId) return null;
    return (
      seatedPlayers.find((p) => p.id === game.activeBuzzPlayerId) ?? null
    );
  }, [game?.activeBuzzPlayerId, seatedPlayers]);

  // Tie-aware competition rankings (1, 1, 3 on 1st-place tie)
  const rankByPlayerId = useMemo(() => {
    const entries = seatedPlayers
      .map((p) => ({ id: p.id, score: totals[p.id] ?? 0 }))
      .sort((a, b) => b.score - a.score);
    const map: Record<string, number> = {};
    entries.forEach((entry, idx) => {
      if (idx > 0 && entry.score === entries[idx - 1].score) {
        map[entry.id] = map[entries[idx - 1].id];
      } else {
        map[entry.id] = idx + 1;
      }
    });
    return map;
  }, [seatedPlayers, totals]);

  const sortedStandings = useMemo(() => {
    return [...seatedPlayers]
      .map((player) => ({
        player,
        score: totals[player.id] ?? 0,
        rank: rankByPlayerId[player.id] ?? 1,
      }))
      .sort((a, b) => b.score - a.score || a.player.seed - b.player.seed);
  }, [seatedPlayers, totals, rankByPlayerId]);

  // Preview whether Finish Game will detect a Qualifying Tie across advancePerGame
  const finishPreview = useMemo(() => {
    const advanceCount = round?.advancePerGame ?? 1;
    if (sortedStandings.length <= advanceCount) {
      return {
        hasQualifyingTie: false,
        tiedPlayers: [] as Player[],
        advancingPlayers: sortedStandings.map((s) => s.player),
        cutoffScore: 0,
      };
    }
    const cutoffScore = sortedStandings[advanceCount - 1].score;
    const nextScore = sortedStandings[advanceCount].score;
    if (cutoffScore === nextScore) {
      const tiedPlayers = sortedStandings
        .filter((s) => s.score === cutoffScore)
        .map((s) => s.player);
      return {
        hasQualifyingTie: true,
        tiedPlayers,
        advancingPlayers: [] as Player[],
        cutoffScore,
      };
    }
    return {
      hasQualifyingTie: false,
      tiedPlayers: [] as Player[],
      advancingPlayers: sortedStandings
        .slice(0, advanceCount)
        .map((s) => s.player),
      cutoffScore,
    };
  }, [sortedStandings, round?.advancePerGame]);

  // Determine the exact event Undo Last Action will revert
  const nextUndoableEvent = useMemo(() => {
    if (!user) return null;
    const onlyOwn = user.role === 'scorer';
    return (
      scoreEvents.find(
        (e) =>
          e.kind !== 'undo' &&
          !e.undoneByEventId &&
          (!onlyOwn || e.byUserId === user.id)
      ) ?? null
    );
  }, [scoreEvents, user]);

  const nextUndoablePlayer = useMemo(() => {
    if (!nextUndoableEvent) return null;
    return (
      seatedPlayers.find((p) => p.id === nextUndoableEvent.playerId) ?? null
    );
  }, [nextUndoableEvent, seatedPlayers]);

  const flashPlayerDelta = (playerId: string, delta: number) => {
    setRecentDeltaByPlayer((prev) => ({ ...prev, [playerId]: delta }));
    window.setTimeout(() => {
      setRecentDeltaByPlayer((prev) => ({ ...prev, [playerId]: null }));
    }, 1600);
  };

  // Actions
  const handleStartGame = async () => {
    if (!game || !user || busyAction) return;
    setBusyAction(true);
    try {
      await gameRepo.startGame(game.id, user.id);
      await loadConsoleState();
      toast({
        variant: 'gold',
        title: lang === 'ar' ? 'بدأت الجلسة المباشرة!' : 'Live session started!',
        description: localizeText(lang, game.tableName, game.tableNameAr),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleBuzz = useCallback(
    async (player: Player) => {
      if (!game || !currentSegment || !user || busyAction || game.status !== 'live') {
        return;
      }
      setBusyAction(true);
      try {
        setSelectedPlayerId(player.id);
        await scoreRepo.recordBuzz({
          gameId: game.id,
          segmentId: currentSegment.id,
          playerId: player.id,
          byUserId: user.id,
        });
        await loadConsoleState();
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? `${player.fullNameAr} ضغط الجرس أولاً!`
              : `${player.fullName} buzzed first!`,
          description:
            lang === 'ar'
              ? 'تم تحديده تلقائياً لتطبيق النقاط ومزامنة الشاشة.'
              : 'Auto-selected for scoring & synced to Big Screen.',
          durationMs: 2200,
        });
      } finally {
        setBusyAction(false);
      }
    },
    [game, currentSegment, user, busyAction, loadConsoleState, toast, lang]
  );

  const handleClearBuzz = async () => {
    if (!game || !user || busyAction) return;
    setBusyAction(true);
    try {
      await scoreRepo.clearBuzz(game.id, user.id);
      await loadConsoleState();
    } finally {
      setBusyAction(false);
    }
  };

  const handleApplyPoints = useCallback(
    async (delta: number, kind: 'preset' | 'custom', note?: string) => {
      if (
        !game ||
        !currentSegment ||
        !selectedPlayer ||
        !user ||
        busyAction ||
        game.status !== 'live' ||
        Number.isNaN(delta) ||
        delta === 0
      ) {
        return;
      }
      setBusyAction(true);
      try {
        await scoreRepo.applyScore({
          gameId: game.id,
          segmentId: currentSegment.id,
          playerId: selectedPlayer.id,
          delta,
          note: note?.trim() || undefined,
          kind,
          byUserId: user.id,
        });
        flashPlayerDelta(selectedPlayer.id, delta);
        await loadConsoleState();
        const signStr = delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
        toast({
          variant: delta > 0 ? 'positive' : 'negative',
          title:
            lang === 'ar'
              ? `${signStr} نقطة ← ${selectedPlayer.fullNameAr}`
              : `${signStr} pts → ${selectedPlayer.fullName}`,
          description:
            note?.trim() ||
            localizeText(lang, currentSegment.nameEn, currentSegment.nameAr),
          durationMs: 2200,
        });
      } finally {
        setBusyAction(false);
      }
    },
    [
      game,
      currentSegment,
      selectedPlayer,
      user,
      busyAction,
      loadConsoleState,
      toast,
      lang,
    ]
  );

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customPoints, 10);
    if (Number.isNaN(parsed) || parsed === 0) {
      toast({
        variant: 'negative',
        title:
          lang === 'ar'
            ? 'أدخل رقماً صحيحاً غير الصفر'
            : 'Enter a valid non-zero number',
        description:
          lang === 'ar'
            ? 'استخدم زر ± لتبديل الإشارة الموجبة أو السالبة.'
            : 'Use the ± button to switch between positive and negative points.',
      });
      return;
    }
    await handleApplyPoints(parsed, 'custom', customNote);
    setCustomNote('');
    setMobileCustomOpen(false);
  };

  const handleUndoLast = useCallback(async () => {
    if (!game || !user || !nextUndoableEvent || busyAction) return;
    setBusyAction(true);
    try {
      const undone = await scoreRepo.undoLastScore(game.id, user.id, {
        onlyOwn: user.role === 'scorer',
      });
      if (undone) {
        flashPlayerDelta(undone.playerId, undone.delta);
        await loadConsoleState();
        toast({
          variant: 'info',
          title:
            lang === 'ar' ? 'تم التراجع عن آخر حركة' : 'Last action undone',
          description: undone.note,
          durationMs: 2400,
        });
      }
    } finally {
      setBusyAction(false);
    }
  }, [game, user, nextUndoableEvent, busyAction, loadConsoleState, toast, lang]);

  const handleTimerStart = useCallback(async () => {
    if (!game || !currentSegment || !user || game.status !== 'live') return;
    const dur = game.timer?.durationSec ?? currentSegment.durationSec ?? 45;
    const rem = displayRemainingSec > 0 ? displayRemainingSec : dur;
    timerExpireHandledRef.current = false;
    await gameRepo.updateTimer(
      game.id,
      {
        status: 'running',
        durationSec: dur,
        remainingSec: rem,
        endsAt: new Date(Date.now() + rem * 1000).toISOString(),
      },
      user.id
    );
    await loadConsoleState();
  }, [game, currentSegment, user, displayRemainingSec, loadConsoleState]);

  const handleTimerPause = useCallback(async () => {
    if (!game || !currentSegment || !user) return;
    const dur = game.timer?.durationSec ?? currentSegment.durationSec ?? 45;
    await gameRepo.updateTimer(
      game.id,
      {
        status: 'paused',
        durationSec: dur,
        remainingSec: displayRemainingSec,
        endsAt: null,
      },
      user.id
    );
    await loadConsoleState();
  }, [game, currentSegment, user, displayRemainingSec, loadConsoleState]);

  const executeTimerReset = async () => {
    if (!game || !currentSegment || !user) return;
    const dur = currentSegment.durationSec ?? 45;
    timerExpireHandledRef.current = false;
    await gameRepo.updateTimer(
      game.id,
      {
        status: 'idle',
        durationSec: dur,
        remainingSec: dur,
        endsAt: null,
      },
      user.id
    );
    setDisplayRemainingSec(dur);
    await loadConsoleState();
  };

  const handleTimerResetClick = () => {
    if (game?.timer?.status === 'running') {
      setConfirmResetTimerOpen(true);
    } else {
      executeTimerReset();
    }
  };

  const executeSegmentChange = async (nextIndex: number) => {
    if (!game || !user || busyAction) return;
    setBusyAction(true);
    try {
      await gameRepo.changeSegment(game.id, nextIndex, user.id);
      await loadConsoleState();
    } finally {
      setBusyAction(false);
      setPendingSegmentIndex(null);
    }
  };

  const handleSegmentNavClick = (nextIndex: number) => {
    if (!game) return;
    const isBackward = nextIndex < game.currentSegmentIndex;
    const isTimerRunning = game.timer?.status === 'running';
    if (isBackward || isTimerRunning) {
      setPendingSegmentIndex(nextIndex);
    } else {
      executeSegmentChange(nextIndex);
    }
  };

  const handleConfirmFinish = async () => {
    if (!game || !user || busyAction) return;
    setBusyAction(true);
    try {
      const result = await gameRepo.finishGame(game.id, user.id, {
        autoOpenTieBreaker: true,
      });
      await loadConsoleState();

      if (!result) return;

      if (result.status === 'tie_breaker_opened') {
        const tiedIds = result.tiedPlayerIds ?? [];
        setTieBreakerPlayerIds(tiedIds);
        const names = tiedIds
          .map((pid) => {
            const p = allPlayers.find((pl) => pl.id === pid);
            return p ? localizeText(lang, p.fullName, p.fullNameAr) : pid;
          })
          .join(lang === 'ar' ? ' و ' : ' & ');
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? 'تعادل! تم فتح جولة الحسم تلقائياً'
              : 'Qualifying Tie! Tie-Breaker #16 Opened',
          description:
            lang === 'ar'
              ? `تعادل بين ${names} — جولة التحدي الفاصلة (٣٠ ثانية) جاهزة الآن.`
              : `Tie between ${names} — sudden-death Tie-Breaker (30s) inserted automatically.`,
          durationMs: 5000,
        });
      } else if (result.status === 'finished') {
        setTieBreakerPlayerIds([]);
        const winner = allPlayers.find(
          (p) => p.id === result.game.winnerPlayerId
        );
        toast({
          variant: 'positive',
          title:
            lang === 'ar'
              ? `انتهت الجلسة — الفائز: ${winner?.fullNameAr ?? ''}`
              : `Session Finished — Winner: ${winner?.fullName ?? ''}`,
          description:
            lang === 'ar'
              ? 'تم تحديث لوحة الصدارة وشجرة البطولة وسجل المراجعة.'
              : 'Leaderboard, bracket standings, and Audit Log updated.',
          durationMs: 4500,
        });
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!game || !user || busyAction || !canReopen) return;
    setBusyAction(true);
    try {
      await gameRepo.reopenGame(game.id, user.id);
      await loadConsoleState();
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? 'تمت إعادة فتح الجلسة للتعديل'
            : 'Session reopened for live scoring',
        description:
          lang === 'ar'
            ? 'تم تسجيل الإجراء في سجل المراجعة.'
            : 'Reopen action logged in Audit Log.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const toggleCustomSign = () => {
    const trimmed = customPoints.trim();
    if (!trimmed) {
      setCustomPoints('-');
      return;
    }
    if (trimmed.startsWith('-')) {
      setCustomPoints(trimmed.slice(1));
    } else if (trimmed.startsWith('+')) {
      setCustomPoints(`-${trimmed.slice(1)}`);
    } else {
      setCustomPoints(`-${trimmed}`);
    }
  };

  // Bonus Idea: Desktop/Tablet keyboard shortcuts for ultra-fast zero-mistake operation
  useEffect(() => {
    if (!game || game.status !== 'live' || !canAccessScorerGame(user, game.scorerUserId)) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping || historyOpen) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoLast();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '1' && seatedPlayers[0]) {
        setSelectedPlayerId(seatedPlayers[0].id);
      } else if (e.key === '2' && seatedPlayers[1]) {
        setSelectedPlayerId(seatedPlayers[1].id);
      } else if (e.key === '3' && seatedPlayers[2]) {
        setSelectedPlayerId(seatedPlayers[2].id);
      } else if (e.key.toLowerCase() === 'b' && selectedPlayer) {
        e.preventDefault();
        handleBuzz(selectedPlayer);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (game.timer?.status === 'running') {
          handleTimerPause();
        } else {
          handleTimerStart();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    game,
    user,
    historyOpen,
    seatedPlayers,
    selectedPlayer,
    handleBuzz,
    handleUndoLast,
    handleTimerPause,
    handleTimerStart,
  ]);

  // 1. Loading State
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-11 w-48 bg-red-800" />
          <Skeleton className="h-11 w-40 bg-red-800" />
        </div>
        <Skeleton className="h-32 w-full rounded-card bg-red-800" />
        <div className="grid gap-4 md:grid-cols-3">
          <PlayerPanelSkeleton />
          <PlayerPanelSkeleton />
          <PlayerPanelSkeleton />
        </div>
        <Skeleton className="h-28 w-full rounded-card bg-red-800" />
      </div>
    );
  }

  // 2. Not Found State
  if (!game) {
    return (
      <div className="mx-auto max-w-2xl rounded-card border-[2.5px] border-outline bg-white p-2 shadow-sticker">
        <EmptyState
          title={lang === 'ar' ? 'الجلسة غير موجودة' : 'Game session not found'}
          description={
            lang === 'ar'
              ? `لم يتم العثور على طاولة بالمعرّف (${gameId}). عُد إلى قائمة الطاولات لاختيار جلسة صالحة.`
              : `No table session matches ID "${gameId}". Return to your assigned tables to pick a valid match.`
          }
          action={
            <Button asChild variant="red" size="scorer">
              <Link href="/scorer">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'العودة إلى طاولاتي' : 'Back to My Tables'}
                </span>
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  // 3. Per-Game Scorer Assignment Access Guard
  if (!canAccessScorerGame(user, game.scorerUserId)) {
    return (
      <section className="mx-auto max-w-2xl py-6">
        <div className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-6 sm:p-8 text-center shadow-sticker-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-pill border-[2.5px] border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-fluid-2xl text-white">
              {lang === 'ar'
                ? 'هذه الطاولة مخصصة لحكم آخر'
                : 'Table Assigned to Another Scorer'}
            </h1>
            <p className="text-sm sm:text-base text-red-100 leading-relaxed">
              {lang === 'ar'
                ? `طاولة "${localizeText(lang, game.tableName, game.tableNameAr)}" مخصصة حالياً لـ ${assignedScorer ? localizeText(lang, assignedScorer.name, assignedScorer.nameAr) : game.scorerUserId}. يمكن لحكم الطاولة المعين أو مدير البطولة فقط فتح هذه اللوحة.`
                : `"${game.tableName}" is assigned to ${assignedScorer ? assignedScorer.name : game.scorerUserId}. Only the assigned scorer or a Super Admin can operate this console.`}
            </p>
          </div>

          <div className="flex flex-col xs:flex-row flex-wrap justify-center gap-3 pt-2">
            <Button asChild variant="gold" size="scorer">
              <Link href="/scorer">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'عرض طاولاتي المخصصة' : 'View My Assigned Tables'}
                </span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="scorer">
              <Link
                href={`/screen/${game.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MonitorPlay className="h-5 w-5" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'مشاهدة شاشة العرض فقط' : 'Watch Big Screen Only'}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const isTimerUrgent = displayRemainingSec > 0 && displayRemainingSec <= 5;
  const isTieBreakerActive = currentSegment?.id === 'seg-16';
  const totalEventsCount = scoreEvents.length + buzzEvents.length;
  const currentCatMeta = currentSegment
    ? CATEGORY_LABELS[currentSegment.category]
    : null;
  const hasPrevSeg = game.currentSegmentIndex > 0;
  const hasNextSeg = game.currentSegmentIndex < game.segmentIds.length - 1;

  return (
    <div
      className={cn(
        'space-y-3',
        game.status === 'live' && 'pb-52 md:pb-3'
      )}
    >
      {/* Top Session Command Strip */}
      <header className="flex flex-col gap-2.5 border-b-2 border-red-800 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
          <Button
            asChild
            variant="surface"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={lang === 'ar' ? 'العودة إلى قائمة الطاولات' : 'Back to assigned tables'}
          >
            <Link href="/scorer">
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-fluid-xl leading-tight text-white md:truncate">
                {localizeText(lang, game.tableName, game.tableNameAr)}
              </h1>
              {game.status === 'live' ? (
                <LiveBadge surface="stage" />
              ) : game.status === 'scheduled' ? (
                <Badge variant="upcoming">
                  {lang === 'ar' ? 'مجدولة' : 'SCHEDULED'}
                </Badge>
              ) : (
                <Badge variant="gold">
                  <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'منتهية' : 'FINISHED'}</span>
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs sm:text-sm font-semibold text-red-100">
              {round && (
                <span>{localizeText(lang, round.name.en, round.name.ar)}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {formatDateTime(game.scheduledAt, lang, useArabicIndic)}
              </span>
              {isSuperAdmin && assignedScorer && (
                <span className="text-white">
                  · {lang === 'ar' ? 'الحكم:' : 'Scorer:'}{' '}
                  {localizeText(lang, assignedScorer.name, assignedScorer.nameAr)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Utility Controls — single row on tablet/desktop */}
        <div className="flex shrink-0 flex-wrap lg:flex-nowrap items-center gap-2">
          <Button
            type="button"
            variant="surface"
            size="sm"
            className="min-h-[44px] flex-1 sm:flex-none px-3"
            onClick={() => setHistoryOpen(true)}
          >
            {canManageHistory ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
            ) : (
              <History className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            )}
            <span>
              {canManageHistory
                ? lang === 'ar'
                  ? 'السجل والتحكم'
                  : 'History'
                : lang === 'ar'
                  ? 'سجل الجلسة'
                  : 'Session Log'}
            </span>
            <span className="rounded-pill bg-red-900 px-2 py-0.5 text-xs font-black tabular-nums text-white">
              {formatNumber(totalEventsCount, {
                useArabicIndicDigits: useArabicIndic,
              })}
            </span>
          </Button>

          <Button
            asChild
            variant="info"
            size="sm"
            className="min-h-[44px] flex-1 sm:flex-none px-3.5"
          >
            <Link
              href={`/screen/${game.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}</span>
            </Link>
          </Button>

          {game.status === 'live' && (
            <div className="relative hidden lg:block">
              <Button
                type="button"
                variant="surface"
                size="icon"
                className="h-11 w-11"
                aria-expanded={shortcutsOpen}
                aria-label={
                  lang === 'ar' ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'
                }
                onClick={() => setShortcutsOpen((prev) => !prev)}
              >
                <Keyboard className="h-5 w-5" aria-hidden="true" />
              </Button>
              {shortcutsOpen && (
                <div className="absolute end-0 top-14 z-40 w-64 rounded-card border-[2.5px] border-outline bg-white p-4 text-ink shadow-sticker-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-base text-red-900">
                      {lang === 'ar' ? 'اختصارات سريعة' : 'Quick Shortcuts'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShortcutsOpen(false)}
                      aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-paper text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="space-y-1.5 text-xs font-semibold">
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'اختيار لاعب' : 'Select player'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        1 / 2 / 3
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'جرس اللاعب المختار' : 'Buzz selected'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        B
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'تشغيل / إيقاف المؤقت' : 'Start / Pause timer'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        Space
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'تراجع عن آخر حركة' : 'Undo last score'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        Ctrl+Z
                      </kbd>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* =================================================================== */}
      {/* STATE A: SCHEDULED GAME START GATE                                  */}
      {/* =================================================================== */}
      {game.status === 'scheduled' && (
        <section className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-5 sm:p-6 shadow-sticker-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-pill border border-white/25 bg-red-900 px-3 py-1 text-xs font-bold text-white">
                <CalendarClock className="h-4 w-4 text-gold-300" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'موعد الجلسة:' : 'Scheduled:'}{' '}
                  {formatDateTime(game.scheduledAt, lang, useArabicIndic)}
                </span>
              </div>
              <h2 className="font-display text-fluid-2xl text-white">
                {lang === 'ar'
                  ? 'الجلسة جاهزة للبدء المباشر'
                  : 'Table Ready for Live Broadcast'}
              </h2>
              <p className="max-w-2xl text-sm sm:text-base text-red-100">
                {lang === 'ar'
                  ? 'راجع المتسابقين الثلاثة وترتيب الفقرات ثم اضغط بدء الجلسة المباشرة لتفعيل المؤقت والجرس واحتساب النقاط.'
                  : 'Verify the 3 seated contestants and segment lineup below, then start the live session to unlock the timer, buzzer, and point controls.'}
              </p>
            </div>

            <Button
              type="button"
              variant="gold"
              size="scorer"
              disabled={busyAction}
              onClick={() => setConfirmStartOpen(true)}
              className="w-full lg:w-auto shrink-0"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              <span>
                {lang === 'ar' ? 'بدء الجلسة المباشرة' : 'Start Live Session'}
              </span>
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {seatedPlayers.map((player) => (
              <PlayerPanel
                key={player.id}
                playerId={player.id}
                name={localizeText(lang, player.fullName, player.fullNameAr)}
                nickname={localizeText(lang, player.nickname, player.nicknameAr)}
                avatarSeed={player.avatarSeed}
                score={totals[player.id] ?? 0}
                isHost={player.isHost}
                variant="scorer"
                surface="dark"
                useArabicIndicDigits={useArabicIndic}
              />
            ))}
          </div>

          <div className="space-y-2.5 border-t border-white/15 pt-4">
            <h3 className="text-sm font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-white">
              {lang === 'ar'
                ? `ترتيب الفقرات (${formatNumber(gameSegments.length, { useArabicIndicDigits: useArabicIndic })})`
                : `Segment Lineup (${gameSegments.length})`}
            </h3>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gameSegments.map((seg, i) => (
                <li
                  key={`${seg.id}-${i}`}
                  className="flex items-center gap-2.5 rounded-input border border-red-900 bg-red-900/75 px-3 py-2.5 text-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-gold-400 font-score text-base font-black text-red-900 tabular-nums">
                    {formatNumber(i + 1, { useArabicIndicDigits: useArabicIndic })}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">
                      {localizeText(lang, seg.nameEn, seg.nameAr)}
                    </div>
                    <div className="truncate text-xs text-red-100">
                      {lang === 'ar' ? seg.nameEn : seg.nameAr}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* STATE B: FINISHED GAME SUMMARY                                      */}
      {/* =================================================================== */}
      {game.status === 'finished' && (
        <section className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-5 sm:p-6 shadow-sticker-lg">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <h2 className="font-display text-fluid-2xl text-white">
                {lang === 'ar'
                  ? 'النتيجة النهائية للجلسة'
                  : 'Official Final Standings'}
              </h2>
              <p className="text-sm text-red-100">
                {lang === 'ar'
                  ? `انتهت الجلسة في ${formatDateTime(game.finishedAt, lang, useArabicIndic)} · يتأهل أعلى ${formatNumber(round?.advancePerGame ?? 1, { useArabicIndicDigits: useArabicIndic })}`
                  : `Concluded ${formatDateTime(game.finishedAt, lang, useArabicIndic)} · Top ${round?.advancePerGame ?? 1} advance`}
              </p>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="gold"
                size="scorer"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-5 w-5" aria-hidden="true" />
                <span>
                  {canManageHistory
                    ? lang === 'ar'
                      ? 'إدارة سجل النقاط'
                      : 'Manage Scoring History'
                    : lang === 'ar'
                      ? 'مراجعة سجل النقاط'
                      : 'Review Score History'}
                </span>
              </Button>

              {canReopen && (
                <Button
                  type="button"
                  variant="destructive"
                  size="scorer"
                  disabled={busyAction}
                  onClick={() => setConfirmReopenOpen(true)}
                >
                  <RotateCcw className="h-5 w-5" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'إعادة فتح الجلسة' : 'Reopen Session'}
                  </span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {sortedStandings.map(({ player, score, rank }) => {
              const isWinner = game.winnerPlayerId === player.id;
              const isAdvancing = Boolean(
                game.advancingPlayerIds?.includes(player.id)
              );
              return (
                <div key={player.id} className="space-y-2">
                  <PlayerPanel
                    playerId={player.id}
                    name={localizeText(lang, player.fullName, player.fullNameAr)}
                    nickname={localizeText(lang, player.nickname, player.nicknameAr)}
                    avatarSeed={player.avatarSeed}
                    score={score}
                    rank={rank}
                    isWinner={isWinner || isAdvancing}
                    isHost={player.isHost}
                    variant="scorer"
                    surface="dark"
                    useArabicIndicDigits={useArabicIndic}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* STATE C: ACTIVE LIVE SCORER CONSOLE                                 */}
      {/* =================================================================== */}
      {game.status === 'live' && currentSegment && (
        <>
          {/* Tie-Breaker Active Alert Banner */}
          {isTieBreakerActive && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border-[3px] border-outline bg-gold-gradient px-4 py-3 text-red-900 shadow-sticker"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-red-900 text-gold-300">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-display text-lg leading-tight">
                    {lang === 'ar'
                      ? 'جولة الحسم الفاصلة نشطة (التعادل)'
                      : 'Sudden-Death Tie-Breaker Active'}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-red-900">
                    {tieBreakerPlayerIds.length > 0
                      ? lang === 'ar'
                        ? `التعادل بين: ${tieBreakerPlayerIds
                            .map((pid) => {
                              const p = seatedPlayers.find((pl) => pl.id === pid);
                              return p ? p.fullNameAr : pid;
                            })
                            .join(' و ')} — امنح النقاط الحاسمة ثم اضغط إنهاء الجلسة.`
                        : `Tied at cutoff: ${tieBreakerPlayerIds
                            .map((pid) => {
                              const p = seatedPlayers.find((pl) => pl.id === pid);
                              return p ? p.fullName : pid;
                            })
                            .join(' & ')} — award decisive points then Finish Game.`
                      : lang === 'ar'
                        ? 'فقرة الحسم الفاصلة مفعّلة لحسم بطاقة التأهل في هذه الطاولة.'
                        : 'Segment #16 is active to break the qualifying tie and determine the advancing player.'}
                  </p>
                </div>
              </div>
              <Badge variant="red">
                {lang === 'ar' ? 'فقرة ١٦ · حسم' : 'SEG #16 · TIE-BREAKER'}
              </Badge>
            </div>
          )}

          {/* ZONE 1: SEGMENT & TIMER COMMAND BAND */}
          <section
            aria-label={
              lang === 'ar' ? 'الفقرة الحالية ومؤقت الجولة' : 'Current Segment and Timer'
            }
            className={cn(
              'rounded-card border-[2.5px] bg-red-800 p-3 sm:p-3.5 lg:p-4 shadow-sticker transition-all',
              isTimerUrgent
                ? 'border-white ring-4 ring-white/75'
                : isTieBreakerActive
                  ? 'border-gold-400'
                  : 'border-outline'
            )}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Segment Info + Dual EN/AR Title + Progress + Steppers */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold" className="font-extrabold">
                    {lang === 'ar'
                      ? `الفقرة ${formatNumber(game.currentSegmentIndex + 1, { useArabicIndicDigits: useArabicIndic })} / ${formatNumber(game.segmentIds.length, { useArabicIndicDigits: useArabicIndic })}`
                      : `SEGMENT ${game.currentSegmentIndex + 1} / ${game.segmentIds.length}`}
                  </Badge>
                  {currentCatMeta && (
                    <Badge variant={currentCatMeta.badge}>
                      {localizeText(lang, currentCatMeta.en, currentCatMeta.ar)}
                    </Badge>
                  )}
                  {isTimerUrgent && (
                    <span className="inline-flex items-center gap-1 rounded-pill border-2 border-outline bg-white px-2.5 py-0.5 text-xs font-black text-negative">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {lang === 'ar' ? 'آخر ٥ ثوانٍ!' : 'FINAL 5 SECONDS!'}
                    </span>
                  )}
                </div>

                {/* Bilingual Segment Headline (both EN and AR aligned cleanly to start edge) */}
                <div className="space-y-0.5 text-start">
                  <h2 className="font-display text-fluid-xl leading-tight text-white">
                    {localizeText(lang, currentSegment.nameEn, currentSegment.nameAr)}
                  </h2>
                  <p className="text-sm font-bold text-red-100">
                    <span dir={lang === 'ar' ? 'ltr' : 'rtl'} className="inline-block">
                      {lang === 'ar' ? currentSegment.nameEn : currentSegment.nameAr}
                    </span>
                  </p>
                </div>

                {/* Visual Segmented Progress Track */}
                <div
                  className="flex items-center gap-1.5"
                  aria-label={
                    lang === 'ar'
                      ? `تقدم الفقرات: ${game.currentSegmentIndex + 1} من ${game.segmentIds.length}`
                      : `Segment progress: ${game.currentSegmentIndex + 1} of ${game.segmentIds.length}`
                  }
                >
                  {game.segmentIds.map((sid, idx) => {
                    const isCurrent = idx === game.currentSegmentIndex;
                    const isDone = idx < game.currentSegmentIndex;
                    const isTb = sid === 'seg-16';
                    return (
                      <span
                        key={`${sid}-${idx}`}
                        className={cn(
                          'h-2 flex-1 rounded-pill transition-all',
                          isCurrent
                            ? isTb
                              ? 'bg-white ring-2 ring-gold-300'
                              : 'bg-gold-400'
                            : isDone
                              ? 'bg-gold-300/65'
                              : 'bg-red-900'
                        )}
                      />
                    );
                  })}
                </div>

                {/* Prev / Next Segment Controls (>= 56px tall) */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="scorer"
                    disabled={!hasPrevSeg || busyAction}
                    onClick={() =>
                      handleSegmentNavClick(game.currentSegmentIndex - 1)
                    }
                    className="flex-1 sm:flex-none px-4"
                  >
                    <ChevronLeft
                      className="h-5 w-5 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                    <span>{lang === 'ar' ? 'الفقرة السابقة' : 'Prev Segment'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="gold"
                    size="scorer"
                    disabled={!hasNextSeg || busyAction}
                    onClick={() =>
                      handleSegmentNavClick(game.currentSegmentIndex + 1)
                    }
                    className="flex-1 sm:flex-none px-4"
                  >
                    <span>{lang === 'ar' ? 'الفقرة التالية' : 'Next Segment'}</span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>

              {/* Segment Countdown Timer (Start / Pause / Reset >= 56px + 5s Visual Warning) */}
              <div className="flex flex-row items-center justify-between gap-3 border-t border-white/15 pt-3 sm:justify-center lg:border-t-0 lg:border-s lg:border-white/15 lg:ps-4 lg:pt-0">
                <TimerRing
                  durationSec={
                    game.timer?.durationSec ?? currentSegment.durationSec ?? 45
                  }
                  remainingSec={displayRemainingSec}
                  status={game.timer?.status ?? 'idle'}
                  size="sm"
                  surface="stage"
                  showControls
                  controlSize="scorer"
                  useArabicIndicDigits={useArabicIndic}
                  onStart={handleTimerStart}
                  onPause={handleTimerPause}
                  onReset={handleTimerResetClick}
                  className="w-full sm:w-auto flex-row items-center justify-between sm:justify-center gap-3"
                />
              </div>
            </div>
          </section>

          {/* ZONE 2: 3-PLAYER STAGE ARENA */}
          <section
            aria-label={lang === 'ar' ? 'المتسابقون الثلاثة' : 'Three Contestants'}
            className="space-y-2.5"
          >
            {/* Active Buzz Status + Clear Buzz Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold text-red-100">
                {lang === 'ar'
                  ? 'اضغط "ضغط الجرس أولاً" أو اضغط بطاقة اللاعب لاختياره قبل احتساب النقاط.'
                  : 'Tap "Buzzed First" or any player card to select them for one-tap scoring.'}
              </div>

              {buzzedPlayer && (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleClearBuzz}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-white px-3.5 py-2 text-xs sm:text-sm font-extrabold text-red-900 shadow-sticker-sm sticker-press hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <XCircle className="h-4 w-4 text-negative shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? `مسح الجرس (${buzzedPlayer.fullNameAr})`
                      : `Clear Buzz (${buzzedPlayer.fullName})`}
                  </span>
                </button>
              )}
            </div>

            {/* 3 Columns Side-by-Side on Tablet Landscape (md+) / Stacked on Phones */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-4">
              {seatedPlayers.map((player) => {
                const isSelected = selectedPlayer?.id === player.id;
                const isBuzzed = game.activeBuzzPlayerId === player.id;
                return (
                  <PlayerPanel
                    key={player.id}
                    playerId={player.id}
                    name={localizeText(lang, player.fullName, player.fullNameAr)}
                    nickname={localizeText(lang, player.nickname, player.nicknameAr)}
                    avatarSeed={player.avatarSeed}
                    score={totals[player.id] ?? 0}
                    rank={rankByPlayerId[player.id]}
                    isSelected={isSelected}
                    isBuzzed={isBuzzed}
                    isHost={player.isHost}
                    recentDelta={recentDeltaByPlayer[player.id] ?? null}
                    variant="scorer"
                    surface="dark"
                    useArabicIndicDigits={useArabicIndic}
                    onSelect={() => setSelectedPlayerId(player.id)}
                    onBuzz={() => handleBuzz(player)}
                  />
                );
              })}
            </div>
          </section>

          {/* ZONE 3: SINGLE SELECTED-PLAYER ACTION DOCK (Sticky on Phones, Docked on Tablet/Desktop) */}
          <section
            aria-label={
              lang === 'ar' ? 'شريط احتساب النقاط والتراجع' : 'Selected Player Scoring Dock'
            }
            className={cn(
              'fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-gold-400 bg-red-900/95 px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgba(42,10,16,0.65)] backdrop-blur-md',
              'md:static md:inset-auto md:z-auto md:rounded-card md:border-[3px] md:border-outline md:bg-red-800 md:p-4 lg:p-5 md:shadow-sticker-lg'
            )}
          >
            <div className="mx-auto max-w-content-wide space-y-2.5 md:space-y-3.5">
              {/* Mobile Quick-Switch Target Pills (< md) for One-Handed Phone Operation */}
              <div className="flex items-center gap-1.5 md:hidden">
                {seatedPlayers.map((player) => {
                  const active = selectedPlayer?.id === player.id;
                  const firstName = localizeText(
                    lang,
                    player.fullName.split(' ')[0] ?? player.fullName,
                    player.fullNameAr.split(' ')[0] ?? player.fullNameAr
                  );
                  return (
                    <button
                      key={player.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={cn(
                        'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-button border-2 px-2 py-1 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                        active
                          ? 'border-white bg-blue-600 text-white shadow-sticker-sm'
                          : 'border-red-700 bg-red-800 text-red-100'
                      )}
                    >
                      <span className="truncate">{firstName}</span>
                      <span className="font-score text-base font-black tabular-nums text-gold-300">
                        {formatNumber(totals[player.id] ?? 0, {
                          useArabicIndicDigits: useArabicIndic,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Row 1 (Tablet/Desktop Target Header + One-Tap Segment Presets >= 56px) */}
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                {/* Selected Target Badge (Tablet/Desktop) */}
                {selectedPlayer && (
                  <div className="hidden md:flex min-w-0 items-center gap-3 rounded-input border-2 border-white bg-blue-600 px-3.5 py-2 text-white shadow-sticker-sm">
                    <PlayerAvatar
                      name={localizeText(
                        lang,
                        selectedPlayer.fullName,
                        selectedPlayer.fullNameAr
                      )}
                      avatarSeed={selectedPlayer.avatarSeed}
                      size="sm"
                      isHost={selectedPlayer.isHost}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase ltr:tracking-wider rtl:tracking-normal text-blue-100">
                        {lang === 'ar' ? 'اللاعب المختار للنقاط' : 'SCORING TARGET'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-lg leading-none text-white">
                          {localizeText(
                            lang,
                            selectedPlayer.fullName,
                            selectedPlayer.fullNameAr
                          )}
                        </span>
                        <AnimatedNumber
                          value={totals[selectedPlayer.id] ?? 0}
                          useArabicIndicDigits={useArabicIndic}
                          className="rounded-pill bg-red-900 px-2 py-0.5 font-score text-lg font-black leading-none text-gold-300"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic Preset Point Buttons from Current Segment (>= 56px) */}
                <div className="grid flex-1 grid-cols-3 gap-2 md:max-w-xl">
                  {currentSegment.presetPoints.map((pts) => {
                    const isPos = pts > 0;
                    return (
                      <button
                        key={pts}
                        type="button"
                        disabled={busyAction || !selectedPlayer}
                        onClick={() => handleApplyPoints(pts, 'preset')}
                        aria-label={
                          selectedPlayer
                            ? lang === 'ar'
                              ? `تطبيق ${pts > 0 ? `+${pts}` : pts} نقطة على ${selectedPlayer.fullNameAr}`
                              : `Apply ${pts > 0 ? `+${pts}` : pts} points to ${selectedPlayer.fullName}`
                            : undefined
                        }
                        className={cn(
                          'flex min-h-[56px] items-center justify-center gap-1 rounded-button border-[2.5px] border-outline font-score text-2xl sm:text-3xl font-black tabular-nums shadow-sticker sticker-press transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                          isPos
                            ? 'bg-positive-soft text-positive-ink hover:bg-positive hover:text-ink'
                            : 'bg-negative text-white hover:bg-red-900'
                        )}
                      >
                        {isPos ? (
                          <Plus
                            className="h-5 w-5 stroke-[3] shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <Minus
                            className="h-5 w-5 stroke-[3] shrink-0"
                            aria-hidden="true"
                          />
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

              {/* Mobile Expandable Custom Amount + Note Panel (< md) */}
              {mobileCustomOpen && (
                <form
                  onSubmit={handleCustomSubmit}
                  className="space-y-2 rounded-input border-2 border-gold-400 bg-red-800 p-2.5 md:hidden"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleCustomSign}
                      aria-label={
                        lang === 'ar'
                          ? 'تبديل الإشارة موجب أو سالب'
                          : 'Toggle positive or negative sign'
                      }
                      className="flex min-h-[56px] w-14 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white text-xl font-black text-red-900 shadow-sticker-sm sticker-press"
                    >
                      ±
                    </button>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={customPoints}
                      onChange={(e) => setCustomPoints(e.target.value)}
                      placeholder="+15 / -10"
                      aria-label={lang === 'ar' ? 'قيمة نقاط مخصصة' : 'Custom points amount'}
                      className="min-h-[56px] w-20 shrink-0 px-2 text-center font-score text-2xl font-black"
                    />
                    <Input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder={
                        lang === 'ar' ? 'ملاحظة اختيارية...' : 'Optional note...'
                      }
                      aria-label={lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional note'}
                      className="min-h-[56px] min-w-0 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="scorer"
                      className="flex-1"
                      onClick={() => setMobileCustomOpen(false)}
                    >
                      {lang === 'ar' ? 'إغلاق' : 'Close'}
                    </Button>
                    <Button
                      type="submit"
                      variant="gold"
                      size="scorer"
                      disabled={busyAction}
                      className="flex-[2]"
                    >
                      <Check className="h-5 w-5" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'تطبيق النقاط' : 'Apply Custom'}
                      </span>
                    </Button>
                  </div>
                </form>
              )}

              {/* Row 2: Custom +/- with Note (single sleek row on lg+), Undo Last Action, and Finish Game */}
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:border-t lg:border-white/15 lg:pt-3">
                {/* Inline Custom +/- & Note Form on Tablet/Desktop (md+) */}
                <form
                  onSubmit={handleCustomSubmit}
                  className="hidden md:flex min-w-0 flex-1 flex-nowrap items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={toggleCustomSign}
                    aria-label={
                      lang === 'ar'
                        ? 'تبديل الإشارة موجب أو سالب'
                        : 'Toggle positive or negative sign'
                    }
                    className="flex min-h-[56px] w-14 shrink-0 items-center justify-center rounded-button border-[2.5px] border-outline bg-white text-xl font-black text-red-900 shadow-sticker-sm sticker-press hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    ±
                  </button>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={customPoints}
                    onChange={(e) => setCustomPoints(e.target.value)}
                    placeholder="+15 / -10"
                    aria-label={lang === 'ar' ? 'قيمة نقاط مخصصة' : 'Custom point delta'}
                    className="min-h-[56px] w-20 shrink-0 px-2 text-center font-score text-2xl font-black"
                  />
                  <Input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'ملاحظة اختيارية...'
                        : 'Optional note...'
                    }
                    aria-label={lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional score note'}
                    className="min-h-[56px] min-w-[110px] flex-1"
                  />
                  <Button
                    type="submit"
                    variant="gold"
                    size="scorer"
                    disabled={busyAction || !selectedPlayer}
                    className="shrink-0 px-4"
                  >
                    <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'تطبيق' : 'Apply'}</span>
                  </Button>
                </form>

                {/* Mobile Custom Toggle + Always-Visible Undo + Finish Game (>= 56px) */}
                <div className="grid shrink-0 grid-cols-3 gap-2 md:flex md:flex-nowrap md:items-center md:justify-end">
                  {/* Mobile Custom Trigger (< md only) */}
                  <button
                    type="button"
                    onClick={() => setMobileCustomOpen((prev) => !prev)}
                    aria-expanded={mobileCustomOpen}
                    className={cn(
                      'flex min-h-[56px] items-center justify-center gap-1.5 rounded-button border-[2.5px] border-outline px-2.5 text-xs xs:text-sm font-extrabold shadow-sticker-sm sticker-press md:hidden focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                      mobileCustomOpen
                        ? 'bg-gold-400 text-red-900'
                        : 'bg-white text-red-900'
                    )}
                  >
                    <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {lang === 'ar' ? 'مخصص' : 'Custom'}
                    </span>
                  </button>

                  {/* Always-Visible Undo Last Action with Live Event Preview */}
                  <button
                    type="button"
                    disabled={!nextUndoableEvent || busyAction}
                    onClick={handleUndoLast}
                    className="flex min-h-[56px] items-center justify-center gap-1.5 rounded-button border-[2.5px] border-outline bg-white px-2 md:px-4 text-xs xs:text-sm font-extrabold text-red-900 shadow-sticker sticker-press hover:bg-paper disabled:opacity-45 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <Undo2 className="h-4 w-4 md:h-5 md:w-5 shrink-0" aria-hidden="true" />
                    <span className="truncate md:hidden">
                      {nextUndoableEvent
                        ? lang === 'ar'
                          ? `تراجع ${nextUndoableEvent.delta > 0 ? `+${nextUndoableEvent.delta}` : `−${Math.abs(nextUndoableEvent.delta)}`}`
                          : `Undo ${nextUndoableEvent.delta > 0 ? `+${nextUndoableEvent.delta}` : `−${Math.abs(nextUndoableEvent.delta)}`}`
                        : lang === 'ar'
                          ? 'تراجع'
                          : 'Undo'}
                    </span>
                    <span className="hidden truncate md:inline">
                      {nextUndoableEvent
                        ? lang === 'ar'
                          ? `تراجع (${nextUndoableEvent.delta > 0 ? `+${nextUndoableEvent.delta}` : `−${Math.abs(nextUndoableEvent.delta)}`})`
                          : `Undo ${nextUndoableEvent.delta > 0 ? `+${nextUndoableEvent.delta}` : `−${Math.abs(nextUndoableEvent.delta)}`}${nextUndoablePlayer ? ` · ${nextUndoablePlayer.fullName.split(' ')[0]}` : ''}`
                        : lang === 'ar'
                          ? 'تراجع'
                          : 'Undo'}
                    </span>
                  </button>

                  {/* Finish Game (Explicit Confirmation Dialog) */}
                  <Button
                    type="button"
                    variant="destructive"
                    size="scorer"
                    disabled={busyAction}
                    onClick={() => setConfirmFinishOpen(true)}
                    className="px-2 md:px-5 text-xs xs:text-sm md:text-base"
                  >
                    <Flag className="h-4 w-4 md:h-5 md:w-5 shrink-0" aria-hidden="true" />
                    <span className="truncate md:hidden">
                      {lang === 'ar' ? 'إنهاء' : 'Finish'}
                    </span>
                    <span className="hidden truncate md:inline">
                      {lang === 'ar' ? 'إنهاء الجلسة' : 'Finish Game'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* SESSION HISTORY & FULL SCORE CONTROL DRAWER                         */}
      {/* =================================================================== */}
      <SessionHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        game={game}
        players={seatedPlayers}
        segments={allSegments}
        users={allUsers}
        scoreEvents={scoreEvents}
        buzzEvents={buzzEvents}
        useArabicIndicDigits={useArabicIndic}
        onChanged={loadConsoleState}
      />

      {/* =================================================================== */}
      {/* CONFIRMATION DIALOGS (Destructive & State-Transition Guardrails)    */}
      {/* =================================================================== */}

      {/* 1. Confirm Start Live Session */}
      <ConfirmDialog
        open={confirmStartOpen}
        onOpenChange={setConfirmStartOpen}
        title={lang === 'ar' ? 'بدء الجلسة المباشرة؟' : 'Start Live Session?'}
        description={
          lang === 'ar'
            ? `سيتم تحويل "${localizeText(lang, game.tableName, game.tableNameAr)}" إلى حالة مباشر وتفعيل شاشة العرض وتسجيل النقاط.`
            : `This sets "${game.tableName}" to LIVE, starts the broadcast timer at Segment 1, and notifies open Big Screen displays.`
        }
        confirmLabel={lang === 'ar' ? 'بدء الجلسة الآن' : 'Start Live Now'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={handleStartGame}
      />

      {/* 2. Confirm Finish Game (Computes Winner or Auto-Inserts Tie-Breaker #16) */}
      <ConfirmDialog
        open={confirmFinishOpen}
        onOpenChange={setConfirmFinishOpen}
        destructive={!finishPreview.hasQualifyingTie}
        title={
          finishPreview.hasQualifyingTie
            ? lang === 'ar'
              ? 'تعادل على التأهل — فتح جولة الحسم؟'
              : 'Qualifying Tie Detected — Open Tie-Breaker?'
            : lang === 'ar'
              ? 'إنهاء الجلسة واعتماد النتيجة؟'
              : 'Finish Game & Lock Final Winner?'
        }
        description={
          finishPreview.hasQualifyingTie
            ? lang === 'ar'
              ? `يوجد تعادل عند ${formatNumber(finishPreview.cutoffScore, { useArabicIndicDigits: useArabicIndic })} نقطة بين: ${finishPreview.tiedPlayers
                  .map((p) => p.fullNameAr)
                  .join(' و ')}. بالتأكيد سيتم إدراج "جولة التحدي / الحسم (#١٦)" تلقائياً بمؤقت ٣٠ ثانية.`
              : `Tie at ${finishPreview.cutoffScore} pts between ${finishPreview.tiedPlayers
                  .map((p) => p.fullName)
                  .join(' & ')}. Confirming will automatically insert Tie-Breaker Segment #16 (30s) so you can break the tie.`
            : lang === 'ar'
              ? `المتأهل الحالي: ${finishPreview.advancingPlayers
                  .map((p) => `${p.fullNameAr} (${totals[p.id] ?? 0} نقطة)`)
                  .join(' و ')}. سيتم إغلاق الطاولة وتحديث شجرة البطولة ولوحة الصدارة.`
              : `Advancing: ${finishPreview.advancingPlayers
                  .map((p) => `${p.fullName} (${totals[p.id] ?? 0} pts)`)
                  .join(' & ')}. Confirming finalizes this table, updates player statuses, and broadcasts the official winner.`
        }
        confirmLabel={
          finishPreview.hasQualifyingTie
            ? lang === 'ar'
              ? 'فتح جولة الحسم (#١٦)'
              : 'Open Tie-Breaker (#16)'
            : lang === 'ar'
              ? 'اعتماد الفائز وإنهاء الجلسة'
              : 'Confirm Winner & Finish'
        }
        cancelLabel={lang === 'ar' ? 'عودة للتحكيم' : 'Back to Console'}
        onConfirm={handleConfirmFinish}
      />

      {/* 3. Confirm Reopen Finished Session (Authorized Roles Only) */}
      <ConfirmDialog
        open={confirmReopenOpen}
        onOpenChange={setConfirmReopenOpen}
        destructive
        title={
          lang === 'ar'
            ? 'إعادة فتح الجلسة المنتهية؟'
            : 'Reopen Finished Session?'
        }
        description={
          lang === 'ar'
            ? 'سيتم إرجاع الطاولة إلى حالة "مباشر" وإلغاء قفل الفائز مؤقتاً لتتمكن من تعديل النقاط ثم إنهائها مجدداً. يُسجّل الإجراء في سجل المراجعة.'
            : 'This restores the table to LIVE status and clears the locked winner so you can adjust scores and re-finish. Logged in the Audit Log.'
        }
        confirmLabel={lang === 'ar' ? 'إعادة فتح الجلسة' : 'Reopen Session'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={handleConfirmReopen}
      />

      {/* 4. Confirm Reset Running Timer */}
      <ConfirmDialog
        open={confirmResetTimerOpen}
        onOpenChange={setConfirmResetTimerOpen}
        destructive
        title={lang === 'ar' ? 'إعادة ضبط المؤقت الجاري؟' : 'Reset Running Timer?'}
        description={
          lang === 'ar'
            ? 'المؤقت يعمل حالياً. هل تريد إيقافه وإعادته للوقت الكامل لهذه الفقرة؟'
            : 'The segment countdown is currently running. Resetting will stop the clock and restore the full segment duration.'
        }
        confirmLabel={lang === 'ar' ? 'إعادة ضبط المؤقت' : 'Reset Timer'}
        cancelLabel={lang === 'ar' ? 'إبقاء العد' : 'Keep Running'}
        onConfirm={executeTimerReset}
      />

      {/* 5. Confirm Segment Jump (Backward or While Timer Running) */}
      <ConfirmDialog
        open={pendingSegmentIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingSegmentIndex(null);
        }}
        title={
          pendingSegmentIndex !== null &&
          pendingSegmentIndex < game.currentSegmentIndex
            ? lang === 'ar'
              ? 'العودة إلى الفقرة السابقة؟'
              : 'Go Back to Previous Segment?'
            : lang === 'ar'
              ? 'الانتقال للفقرة التالية أثناء تشغيل المؤقت؟'
              : 'Advance Segment While Timer Is Running?'
        }
        description={
          lang === 'ar'
            ? 'سيؤدي تغيير الفقرة إلى إيقاف المؤقت وإعادة ضبطه ومسح إشارة الجرس النشطة، مع الاحتفاظ بجميع النقاط المسجلة.'
            : 'Switching segments resets the timer and clears the active buzz highlight. All recorded points stay intact.'
        }
        confirmLabel={lang === 'ar' ? 'تأكيد الانتقال' : 'Switch Segment'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Stay Here'}
        onConfirm={() => {
          if (pendingSegmentIndex !== null) {
            executeSegmentChange(pendingSegmentIndex);
          }
        }}
      />
    </div>
  );
}
