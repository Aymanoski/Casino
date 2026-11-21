'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Flag,
  Gavel,
  History,
  Keyboard,
  MessageSquarePlus,
  Minus,
  MonitorPlay,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Undo2,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import {
  canAccessScorerGame,
  canManageScoreHistory,
  canReopenFinishedGame,
  useAuth,
} from '@/lib/auth';
import {
  CascadeConfirmationRequiredError,
  commands,
  VersionConflictError,
  type CascadePolicy,
} from '@/lib/commands';
import { computeMatchAbsences, type CascadeImpact } from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { ImpactPreviewDialog } from '@/components/admin/ImpactPreviewDialog';
import { realtime } from '@/lib/realtime';
import {
  matchRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
  userRepo,
} from '@/lib/repos';
import type {
  AbsenceEvent,
  BuzzEvent,
  Match,
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
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerPanel } from '@/components/brand/PlayerPanel';
import { TimerRing } from '@/components/brand/TimerRing';
import {
  DisciplinaryCardIcon,
  formatScoreEventDisplay,
} from '@/components/brand/DisciplinaryCards';
import {
  canViewPlayerContactForMatch,
  PlayerContactDialog,
} from '@/components/brand/PlayerContactDialog';

const SessionHistoryDrawer = dynamic(
  () =>
    import('./SessionHistoryDrawer').then((m) => ({
      default: m.SessionHistoryDrawer,
    })),
  { ssr: false }
);

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

function formatTimeShort(
  iso: string,
  lang: 'en' | 'ar',
  useArabicIndicDigits: boolean
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

const NOTE_MAX_LENGTH = 140;

export interface ScorerConsoleViewProps {
  matchId?: string;
  /** Compatibility alias */
  gameId?: string;
}

export function ScorerConsoleView({ matchId, gameId }: ScorerConsoleViewProps) {
  const resolvedMatchId = matchId ?? gameId ?? '';
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [yellowCardsByPlayer, setYellowCardsByPlayer] = useState<
    Record<string, number>
  >({});
  const [redCardsByPlayer, setRedCardsByPlayer] = useState<
    Record<string, number>
  >({});
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [absenceEvents, setAbsenceEvents] = useState<AbsenceEvent[]>([]);
  const [buzzEvents, setBuzzEvents] = useState<BuzzEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // Selected target player (drives phone thumb dock & keyboard shortcuts)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [recentDeltaByPlayer, setRecentDeltaByPlayer] = useState<
    Record<string, number | null>
  >({});

  // Optional note attached to the next +1 / -1 / Yellow / Red tap (zero custom numeric input!)
  const [actionNote, setActionNote] = useState<string>('');
  const [mobileNoteOpen, setMobileNoteOpen] = useState<boolean>(false);

  // Timer live display seconds
  const [displayRemainingSec, setDisplayRemainingSec] = useState<number>(45);
  const timerExpireHandledRef = useRef<boolean>(false);
  const timerWarnAnnouncedRef = useRef<boolean>(false);

  // Concurrency & cleanup refs
  const mountedRef = useRef<boolean>(true);
  const loadSeqRef = useRef<number>(0);
  const busyRef = useRef<boolean>(false);
  const deltaTimeoutsRef = useRef<Record<string, number>>({});
  const shortcutsRef = useRef<HTMLDivElement | null>(null);

  // Tie-breaker alert state
  const [tieBreakerPlayerIds, setTieBreakerPlayerIds] = useState<string[]>([]);

  // Drawers, Contact Dialog, Absence & Admin Decision Dialogs
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [contactPlayer, setContactPlayer] = useState<Player | null>(null);
  const [confirmStartOpen, setConfirmStartOpen] = useState<boolean>(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState<boolean>(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState<boolean>(false);
  const [confirmResetTimerOpen, setConfirmResetTimerOpen] =
    useState<boolean>(false);
  const [pendingSegmentIndex, setPendingSegmentIndex] = useState<number | null>(
    null
  );
  const [pendingAbsentPlayer, setPendingAbsentPlayer] = useState<Player | null>(
    null
  );
  const [absenceReason, setAbsenceReason] = useState<string>('');
  const [pendingReverseAbsentPlayer, setPendingReverseAbsentPlayer] =
    useState<Player | null>(null);

  // Inline Super Admin Decision state (void / Final absence / needsReview)
  const [overrideWinnerId, setOverrideWinnerId] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Shared Cascade Impact Preview Dialog
  const [pendingImpact, setPendingImpact] = useState<{
    impact: CascadeImpact;
    retry: (policy: CascadePolicy) => Promise<void>;
  } | null>(null);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const isSuperAdmin = user?.role === 'superAdmin';
  const canManageHistory = canManageScoreHistory(user?.role ?? null);
  const canReopen = canReopenFinishedGame(user?.role ?? null);

  useEffect(() => {
    mountedRef.current = true;
    const timeoutsMap = deltaTimeoutsRef.current;
    return () => {
      mountedRef.current = false;
      Object.values(timeoutsMap).forEach((tid) => window.clearTimeout(tid));
    };
  }, []);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        shortcutsRef.current &&
        !shortcutsRef.current.contains(e.target as Node)
      ) {
        setShortcutsOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShortcutsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [shortcutsOpen]);

  const loadConsoleState = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [
        loadedMatch,
        loadedPlayers,
        loadedSegments,
        loadedUsers,
        loadedSettings,
        scoreSummary,
        matchScores,
        matchAbsences,
        matchBuzzes,
      ] = await Promise.all([
        matchRepo.get(resolvedMatchId),
        playerRepo.list({ includeHost: true }),
        segmentRepo.list(),
        userRepo.list(),
        settingsRepo.get(),
        scoreRepo.getMatchScoreSummary(resolvedMatchId),
        scoreRepo.listByMatch(resolvedMatchId),
        scoreRepo.listAbsencesByMatch(resolvedMatchId),
        scoreRepo.listBuzzByGame(resolvedMatchId),
      ]);

      let loadedRound: Round | null = null;
      if (loadedMatch) {
        loadedRound = await roundRepo.get(loadedMatch.roundId);
      }

      if (!mountedRef.current || seq !== loadSeqRef.current) return;

      if (loadedMatch) {
        if (
          loadedMatch.timer?.status === 'running' &&
          loadedMatch.timer.endsAt
        ) {
          const left = Math.max(
            0,
            Math.ceil(
              (new Date(loadedMatch.timer.endsAt).getTime() - Date.now()) / 1000
            )
          );
          setDisplayRemainingSec(left);
          if (left > 0) timerExpireHandledRef.current = false;
          if (left > 5) timerWarnAnnouncedRef.current = false;
        } else if (loadedMatch.timer) {
          setDisplayRemainingSec(loadedMatch.timer.remainingSec);
          if (loadedMatch.timer.remainingSec > 5) {
            timerWarnAnnouncedRef.current = false;
          }
        } else {
          const segId =
            loadedMatch.segmentIds[loadedMatch.currentSegmentIndex];
          const seg = loadedSegments.find((s) => s.id === segId);
          setDisplayRemainingSec(seg?.durationSec ?? 45);
        }

        const realIds = loadedMatch.participants
          .map((p) => p.playerId)
          .filter((pid): pid is string => Boolean(pid));

        setSelectedPlayerId((prev) => {
          if (prev && realIds.includes(prev)) return prev;
          if (
            loadedMatch.activeBuzzPlayerId &&
            realIds.includes(loadedMatch.activeBuzzPlayerId)
          ) {
            return loadedMatch.activeBuzzPlayerId;
          }
          return realIds[0] ?? '';
        });

        setOverrideWinnerId((prev) =>
          prev && realIds.includes(prev) ? prev : (realIds[0] ?? '')
        );
      }

      setMatch(loadedMatch);
      setRound(loadedRound);
      setAllPlayers(loadedPlayers);
      setAllSegments(loadedSegments);
      setAllUsers(loadedUsers);
      setSettings(loadedSettings);
      setTotals(scoreSummary.totals);
      setYellowCardsByPlayer(scoreSummary.yellowCardsByPlayer);
      setRedCardsByPlayer(scoreSummary.redCardsByPlayer);
      setScoreEvents(matchScores);
      setAbsenceEvents(matchAbsences);
      setBuzzEvents(matchBuzzes);
      setLoadError(null);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to read match data.'
      );
      setLoading(false);
    }
  }, [resolvedMatchId]);

  useEffect(() => {
    loadConsoleState();
    const unsub = realtime.subscribe('*', (msg) => {
      const payload = msg.payload as
        | { gameId?: string; matchId?: string }
        | undefined;
      const targetId = payload?.matchId ?? payload?.gameId;
      if (
        !targetId ||
        targetId === resolvedMatchId ||
        msg.event === 'data.reset'
      ) {
        loadConsoleState();
      }
    });
    return () => unsub();
  }, [resolvedMatchId, loadConsoleState]);

  // Accurate 250ms timer tick when running
  useEffect(() => {
    if (
      !match?.timer ||
      match.timer.status !== 'running' ||
      !match.timer.endsAt
    ) {
      return;
    }

    const durationSec = match.timer.durationSec;
    const endsAtMs = new Date(match.timer.endsAt).getTime();

    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
      setDisplayRemainingSec(left);
      if (left > 0 && left <= 5 && !timerWarnAnnouncedRef.current) {
        timerWarnAnnouncedRef.current = true;
        setLiveAnnouncement(
          lang === 'ar'
            ? 'تحذير: آخر 5 ثوانٍ في المؤقت'
            : 'Warning: 5 seconds remaining on segment timer'
        );
      }
      if (left === 0 && !timerExpireHandledRef.current) {
        timerExpireHandledRef.current = true;
        setLiveAnnouncement(
          lang === 'ar' ? 'انتهى وقت الفقرة' : 'Segment timer expired'
        );
        commands
          .updateTimer({
            matchId: match.id,
            timer: {
              status: 'paused',
              durationSec,
              remainingSec: 0,
              endsAt: null,
            },
            actorUserId: user?.id,
          })
          .catch(() => {
            // Keep 0s display if storage write fails
          });
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [match?.id, match?.timer, user?.id, lang]);

  // Derived view models (read-only; NEVER written directly to storage)
  const seatedPlayers = useMemo(() => {
    if (!match) return [];
    const resolved = match.participants
      .map((p) =>
        p.playerId ? allPlayers.find((pl) => pl.id === p.playerId) : undefined
      )
      .filter((p): p is Player => Boolean(p));

    // In Grand Final (3 participants), place Marwan Serry in the center slot on desktop symmetry
    if ((match.type === 'final' || match.isFinal) && resolved.length === 3) {
      const host = resolved.find((p) => p.isGuest || p.isHost);
      const finalists = resolved.filter((p) => !p.isGuest && !p.isHost);
      if (host && finalists.length === 2) {
        return [finalists[0], host, finalists[1]];
      }
    }
    return resolved;
  }, [match, allPlayers]);

  const absentSet = useMemo(() => {
    if (!match) return new Set<string>();
    return computeMatchAbsences(match, absenceEvents);
  }, [match, absenceEvents]);

  const absentPlayerIds = useMemo(() => Array.from(absentSet), [absentSet]);

  const unresolvedParticipants = useMemo(() => {
    if (!match) return [];
    const knownIds = new Set(allPlayers.map((p) => p.id));
    return match.participants.filter(
      (p) => !p.isBye && (!p.playerId || !knownIds.has(p.playerId))
    );
  }, [match, allPlayers]);

  const hasUnfilledSeats = unresolvedParticipants.length > 0;
  const isFinalMatch = Boolean(match?.type === 'final' || match?.isFinal);
  const isThreeColLayout =
    isFinalMatch || (match?.participants.length ?? 2) >= 3;
  const isFinalAbsenceDecisionNeeded = Boolean(
    match &&
      isFinalMatch &&
      absentPlayerIds.length > 0 &&
      match.status !== 'finished' &&
      match.status !== 'void'
  );

  const matchSegments = useMemo(() => {
    if (!match) return [];
    return match.segmentIds
      .map((sid) => allSegments.find((s) => s.id === sid))
      .filter((s): s is Segment => Boolean(s));
  }, [match, allSegments]);

  const currentSegment = useMemo(() => {
    if (!match || matchSegments.length === 0) return null;
    return matchSegments[match.currentSegmentIndex] ?? matchSegments[0] ?? null;
  }, [match, matchSegments]);

  const assignedJudge = useMemo(() => {
    if (!match) return null;
    const jid = match.judgeUserId || match.scorerUserId;
    return allUsers.find((u) => u.id === jid) ?? null;
  }, [match, allUsers]);

  const selectedPlayer = useMemo(() => {
    return (
      seatedPlayers.find(
        (p) => p.id === selectedPlayerId && !absentSet.has(p.id)
      ) ??
      seatedPlayers.find((p) => !absentSet.has(p.id)) ??
      seatedPlayers[0] ??
      null
    );
  }, [seatedPlayers, selectedPlayerId, absentSet]);

  const buzzedPlayer = useMemo(() => {
    if (!match?.activeBuzzPlayerId) return null;
    return (
      seatedPlayers.find((p) => p.id === match.activeBuzzPlayerId) ?? null
    );
  }, [match?.activeBuzzPlayerId, seatedPlayers]);

  // Tie-aware live rankings
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
      .sort((a, b) => {
        if (match?.result?.winnerId === a.player.id) return -1;
        if (match?.result?.winnerId === b.player.id) return 1;
        return b.score - a.score || a.player.seed - b.player.seed;
      });
  }, [seatedPlayers, totals, rankByPlayerId, match?.result?.winnerId]);

  // Preview Finish Match: draws are NEVER allowed (tie at top requires Tie-Breaker #16)
  const finishPreview = useMemo(() => {
    if (sortedStandings.length < 2) {
      return {
        isTied: false,
        tiedPlayers: [] as Player[],
        leader: sortedStandings[0]?.player ?? null,
        topScore: sortedStandings[0]?.score ?? 0,
      };
    }
    const topScore = sortedStandings[0].score;
    const leaders = sortedStandings
      .filter((s) => s.score === topScore)
      .map((s) => s.player);
    return {
      isTied: leaders.length > 1,
      tiedPlayers: leaders.length > 1 ? leaders : [],
      leader: leaders.length === 1 ? leaders[0] : null,
      topScore,
    };
  }, [sortedStandings]);

  // Current epoch events & next undoable event
  const activeEpochScoreEvents = useMemo(() => {
    const epoch = match?.replayEpoch ?? 0;
    return scoreEvents.filter((e) => (e.replayEpoch ?? 0) === epoch);
  }, [scoreEvents, match?.replayEpoch]);

  const nextUndoableEvent = useMemo(() => {
    if (!user) return null;
    const onlyOwn = user.role === 'scorer';
    return (
      activeEpochScoreEvents.find(
        (e) =>
          e.kind !== 'undo' &&
          !e.undoneByEventId &&
          (!onlyOwn || e.byUserId === user.id)
      ) ?? null
    );
  }, [activeEpochScoreEvents, user]);

  const nextUndoablePlayer = useMemo(() => {
    if (!nextUndoableEvent) return null;
    return (
      seatedPlayers.find((p) => p.id === nextUndoableEvent.playerId) ?? null
    );
  }, [nextUndoableEvent, seatedPlayers]);

  const recentPlays = useMemo(
    () => activeEpochScoreEvents.slice(0, 3),
    [activeEpochScoreEvents]
  );

  const flashPlayerDelta = useCallback((playerId: string, delta: number) => {
    setRecentDeltaByPlayer((prev) => ({ ...prev, [playerId]: delta }));
    if (deltaTimeoutsRef.current[playerId]) {
      window.clearTimeout(deltaTimeoutsRef.current[playerId]);
    }
    deltaTimeoutsRef.current[playerId] = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setRecentDeltaByPlayer((prev) => ({ ...prev, [playerId]: null }));
      delete deltaTimeoutsRef.current[playerId];
    }, 1600);
  }, []);

  const handleCommandError = useCallback(
    async (
      err: unknown,
      actionEn: string,
      actionAr: string,
      retryWithCascade?: (policy: CascadePolicy) => Promise<void>
    ) => {
      if (err instanceof CascadeConfirmationRequiredError && retryWithCascade) {
        setPendingImpact({
          impact: err.impact,
          retry: retryWithCascade,
        });
        return;
      }
      if (err instanceof VersionConflictError) {
        await loadConsoleState();
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? 'تم تحديث المباراة في نافذة أخرى'
              : 'Match Updated in Another Window',
          description:
            lang === 'ar'
              ? 'تمت مزامنة أحدث حالة للمباراة تلقائياً. أعد المحاولة الآن.'
              : 'Synced to the latest match state automatically. Please tap again.',
        });
        return;
      }
      toast({
        variant: 'negative',
        title: lang === 'ar' ? `تعذر ${actionAr}` : `Failed to ${actionEn}`,
        description:
          err instanceof Error && err.message
            ? err.message
            : lang === 'ar'
              ? 'حدث خطأ أثناء حفظ البيانات. حاول مرة أخرى.'
              : 'Could not save the update. Please try again.',
      });
    },
    [lang, loadConsoleState, toast]
  );

  // ============================================================================
  // COMMAND HANDLERS (100% /lib/commands, zero direct state writes!)
  // ============================================================================

  const handleStartMatch = async () => {
    if (!match || !user || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.startMatch({
        matchId: match.id,
        actorUserId: user.id,
        expectedVersion: match.version,
      });
      await loadConsoleState();
      const msg = lang === 'ar' ? 'بدأت المباراة المباشرة!' : 'Live match started!';
      setLiveAnnouncement(msg);
      toast({
        variant: 'gold',
        title: msg,
        description: localizeText(lang, match.tableName, match.tableNameAr),
      });
    } catch (err) {
      await handleCommandError(err, 'start match', 'بدء المباراة');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleBuzz = useCallback(
    async (player: Player) => {
      if (
        !match ||
        !currentSegment ||
        !user ||
        busyRef.current ||
        (match.status !== 'live' && match.status !== 'needsTieBreak')
      ) {
        return;
      }
      busyRef.current = true;
      setBusyAction(true);
      try {
        setSelectedPlayerId(player.id);
        await commands.recordBuzz({
          matchId: match.id,
          segmentId: currentSegment.id,
          playerId: player.id,
          byUserId: user.id,
          expectedVersion: match.version,
        });
        await loadConsoleState();
        const title =
          lang === 'ar'
            ? `${player.fullNameAr} ضغط الجرس أولاً!`
            : `${player.fullName} buzzed first!`;
        setLiveAnnouncement(title);
        toast({
          variant: 'gold',
          title,
          durationMs: 2000,
        });
      } catch (err) {
        await handleCommandError(err, 'record buzz', 'تسجيل الجرس');
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusyAction(false);
      }
    },
    [match, currentSegment, user, loadConsoleState, toast, lang, handleCommandError]
  );

  const handleClearBuzz = async () => {
    if (!match || !user || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.clearBuzz({
        matchId: match.id,
        byUserId: user.id,
        expectedVersion: match.version,
      });
      await loadConsoleState();
      setLiveAnnouncement(
        lang === 'ar' ? 'تم مسح إشارة الجرس' : 'Active buzz highlight cleared'
      );
    } catch (err) {
      await handleCommandError(err, 'clear buzz', 'مسح الجرس');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleApplyPoint = useCallback(
    async (player: Player, delta: 1 | -1) => {
      if (
        !match ||
        !currentSegment ||
        !user ||
        busyRef.current ||
        (match.status !== 'live' && match.status !== 'needsTieBreak')
      ) {
        return;
      }
      busyRef.current = true;
      setBusyAction(true);
      try {
        setSelectedPlayerId(player.id);
        const cleanNote = actionNote.trim().slice(0, NOTE_MAX_LENGTH) || undefined;
        await commands.applyPoint({
          matchId: match.id,
          segmentId: currentSegment.id,
          playerId: player.id,
          delta,
          note: cleanNote,
          byUserId: user.id,
          expectedVersion: match.version,
        });
        if (cleanNote) {
          setActionNote('');
          setMobileNoteOpen(false);
        }
        flashPlayerDelta(player.id, delta);
        await loadConsoleState();
        const signStr =
          delta > 0
            ? `+${formatNumber(1, { useArabicIndicDigits: useArabicIndic })}`
            : `−${formatNumber(1, { useArabicIndicDigits: useArabicIndic })}`;
        const title =
          lang === 'ar'
            ? `${signStr} نقطة ← ${player.fullNameAr}`
            : `${signStr} pt → ${player.fullName}`;
        setLiveAnnouncement(title);
        toast({
          variant: delta > 0 ? 'positive' : 'negative',
          title,
          description:
            cleanNote ||
            localizeText(lang, currentSegment.nameEn, currentSegment.nameAr),
          durationMs: 2000,
        });
      } catch (err) {
        await handleCommandError(err, 'apply point', 'احتساب النقطة');
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusyAction(false);
      }
    },
    [
      match,
      currentSegment,
      user,
      actionNote,
      flashPlayerDelta,
      loadConsoleState,
      useArabicIndic,
      lang,
      toast,
      handleCommandError,
    ]
  );

  const handleApplyCard = useCallback(
    async (player: Player, card: 'yellow' | 'red') => {
      if (
        !match ||
        !currentSegment ||
        !user ||
        busyRef.current ||
        (match.status !== 'live' && match.status !== 'needsTieBreak')
      ) {
        return;
      }
      busyRef.current = true;
      setBusyAction(true);
      try {
        setSelectedPlayerId(player.id);
        const cleanNote = actionNote.trim().slice(0, NOTE_MAX_LENGTH) || undefined;
        await commands.applyCard({
          matchId: match.id,
          segmentId: currentSegment.id,
          playerId: player.id,
          card,
          note: cleanNote,
          byUserId: user.id,
          expectedVersion: match.version,
        });
        if (cleanNote) {
          setActionNote('');
          setMobileNoteOpen(false);
        }
        flashPlayerDelta(player.id, card === 'yellow' ? -1 : -2);
        await loadConsoleState();
        const cardLabel =
          card === 'yellow'
            ? lang === 'ar'
              ? `بطاقة صفراء (−${formatNumber(1, { useArabicIndicDigits: useArabicIndic })})`
              : 'Yellow card (−1)'
            : lang === 'ar'
              ? `بطاقة حمراء (−${formatNumber(2, { useArabicIndicDigits: useArabicIndic })})`
              : 'Red card (−2)';
        const title =
          lang === 'ar'
            ? `${cardLabel} ← ${player.fullNameAr}`
            : `${cardLabel} → ${player.fullName}`;
        setLiveAnnouncement(title);
        toast({
          variant: card === 'yellow' ? 'gold' : 'negative',
          title,
          description:
            cleanNote ||
            localizeText(lang, currentSegment.nameEn, currentSegment.nameAr),
          durationMs: 2400,
        });
      } catch (err) {
        await handleCommandError(err, 'issue card', 'منح البطاقة');
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusyAction(false);
      }
    },
    [
      match,
      currentSegment,
      user,
      actionNote,
      flashPlayerDelta,
      loadConsoleState,
      useArabicIndic,
      lang,
      toast,
      handleCommandError,
    ]
  );

  const handleUndoLast = useCallback(async () => {
    if (!match || !user || !nextUndoableEvent || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      const undone = await commands.undoLastScore({
        matchId: match.id,
        byUserId: user.id,
        onlyOwn: user.role === 'scorer',
        expectedVersion: match.version,
      });
      if (undone) {
        flashPlayerDelta(undone.playerId, undone.delta);
        await loadConsoleState();
        const title =
          lang === 'ar' ? 'تم التراجع عن آخر حركة' : 'Last action undone';
        setLiveAnnouncement(title);
        toast({
          variant: 'info',
          title,
          description: undone.note,
          durationMs: 2200,
        });
      }
    } catch (err) {
      await handleCommandError(err, 'undo last action', 'التراجع عن آخر حركة');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  }, [
    match,
    user,
    nextUndoableEvent,
    flashPlayerDelta,
    loadConsoleState,
    toast,
    lang,
    handleCommandError,
  ]);

  const handleConfirmMarkAbsent = async (cascadeOpts?: {
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
  }) => {
    if (!match || !user || !pendingAbsentPlayer || busyRef.current) return;
    const targetPlayer = pendingAbsentPlayer;
    busyRef.current = true;
    setBusyAction(true);
    try {
      const res = await commands.markAbsent({
        matchId: match.id,
        playerId: targetPlayer.id,
        byUserId: user.id,
        reason: absenceReason.trim() || undefined,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
        expectedVersion: match.version,
      });
      setPendingAbsentPlayer(null);
      setAbsenceReason('');
      setPendingImpact(null);
      await loadConsoleState();

      if (res.match.status === 'void') {
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? 'اللاعبان غائبان — المباراة ملغاة (Void)'
              : 'Both Players Absent — Match Void',
          description:
            lang === 'ar'
              ? 'بانتظار قرار مدير البطولة لاختيار المتأهل أو إعادة المباراة.'
              : 'Super Admin decision required to award advancement or replay.',
          durationMs: 4500,
        });
      } else if (res.requiresAdminDecision && isFinalMatch) {
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? 'تم تسجيل غياب متأهل في النهائي — مطلوب قرار المدير'
              : 'Finalist Marked Absent — Super Admin Decision Needed',
          description:
            lang === 'ar'
              ? 'لا تُنهى مباراة النهائي تلقائياً؛ استخدم لوحة قرار مدير البطولة.'
              : 'The Grand Final does not auto-end on absence. Super Admin must decide.',
          durationMs: 5000,
        });
      } else if (res.match.result?.type === 'walkover') {
        const winner = allPlayers.find(
          (p) => p.id === res.match.result?.winnerId
        );
        toast({
          variant: 'positive',
          title:
            lang === 'ar'
              ? `فوز انسحابي فوري: ${winner?.fullNameAr ?? ''}`
              : `Immediate Walkover Win: ${winner?.fullName ?? ''}`,
          description:
            match.type === 'group'
              ? lang === 'ar'
                ? 'تم احتساب +٣ نقاط للمجموعة وتحديث الترتيب والشجرة تلقائياً.'
                : 'Awarded +3 group points and updated standings & bracket automatically.'
              : lang === 'ar'
                ? 'تم تأهيل الفائز تلقائياً للدور التالي عبر محرك البطولة.'
                : 'Winner automatically advanced to the next knockout round.',
          durationMs: 4500,
        });
      }
    } catch (err) {
      await handleCommandError(err, 'mark absent', 'تسجيل الغياب', (policy) =>
        handleConfirmMarkAbsent({ confirmCascade: true, cascadePolicy: policy })
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleConfirmReverseAbsence = async (cascadeOpts?: {
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
  }) => {
    if (!match || !user || !pendingReverseAbsentPlayer || busyRef.current) return;
    const targetPlayer = pendingReverseAbsentPlayer;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.reverseAbsence({
        matchId: match.id,
        playerId: targetPlayer.id,
        byUserId: user.id,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
        expectedVersion: match.version,
      });
      setPendingReverseAbsentPlayer(null);
      setPendingImpact(null);
      await loadConsoleState();
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? `تم إلغاء غياب ${targetPlayer.fullNameAr}`
            : `Absence reversed for ${targetPlayer.fullName}`,
        description:
          lang === 'ar'
            ? 'تمت إعادة حساب حالة المباراة والترتيب والتأهل تلقائياً.'
            : 'Match status, standings, and downstream qualifiers recomputed automatically.',
      });
    } catch (err) {
      await handleCommandError(
        err,
        'reverse absence',
        'إلغاء الغياب',
        (policy) =>
          handleConfirmReverseAbsence({
            confirmCascade: true,
            cascadePolicy: policy,
          })
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleAdminOverrideWinner = async (cascadeOpts?: {
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
  }) => {
    if (!match || !user || !isSuperAdmin || !overrideWinnerId || busyRef.current)
      return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.overrideResult({
        matchId: match.id,
        resultType: 'walkover',
        winnerId: overrideWinnerId,
        reason:
          overrideReason.trim() ||
          (lang === 'ar' ? 'قرار مدير البطولة' : 'Super Admin decision'),
        actorUserId: user.id,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
        expectedVersion: match.version,
      });
      setOverrideReason('');
      setPendingImpact(null);
      await loadConsoleState();
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? 'تم اعتماد قرار مدير البطولة'
            : 'Super Admin Decision Applied',
      });
    } catch (err) {
      await handleCommandError(err, 'apply decision', 'اعتماد القرار', (policy) =>
        handleAdminOverrideWinner({
          confirmCascade: true,
          cascadePolicy: policy,
        })
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleAdminResolveReview = async (
    action: 'invalidateForReplay' | 'keepAsIs'
  ) => {
    if (!match || !user || !isSuperAdmin || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.resolveNeedsReview({
        matchId: match.id,
        action,
        reason: overrideReason.trim() || undefined,
        actorUserId: user.id,
        expectedVersion: match.version,
      });
      setOverrideReason('');
      await loadConsoleState();
      toast({
        variant: 'info',
        title:
          action === 'invalidateForReplay'
            ? lang === 'ar'
              ? 'تمت إعادة تهيئة المباراة لإعادة اللعب'
              : 'Match Reset for Replay'
            : lang === 'ar'
              ? 'تمت الموافقة على إبقاء النتيجة'
              : 'Existing Result Confirmed',
      });
    } catch (err) {
      await handleCommandError(err, 'resolve review', 'تسوية المراجعة');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleOpenTieBreakerNow = async () => {
    if (!match || !user || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.openTieBreaker({
        matchId: match.id,
        actorUserId: user.id,
        expectedVersion: match.version,
      });
      await loadConsoleState();
      toast({
        variant: 'gold',
        title:
          lang === 'ar'
            ? 'تم فتح جولة الحسم الفاصلة (#١٦)'
            : 'Sudden-Death Tie-Breaker (#16) Opened',
      });
    } catch (err) {
      await handleCommandError(err, 'open tie-breaker', 'فتح جولة الحسم');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleTimerStart = useCallback(async () => {
    if (
      !match ||
      !currentSegment ||
      !user ||
      (match.status !== 'live' && match.status !== 'needsTieBreak')
    )
      return;
    const dur = match.timer?.durationSec ?? currentSegment.durationSec ?? 45;
    const rem = displayRemainingSec > 0 ? displayRemainingSec : dur;
    timerExpireHandledRef.current = false;
    if (rem > 5) timerWarnAnnouncedRef.current = false;
    try {
      await commands.updateTimer({
        matchId: match.id,
        timer: {
          status: 'running',
          durationSec: dur,
          remainingSec: rem,
          endsAt: new Date(Date.now() + rem * 1000).toISOString(),
        },
        actorUserId: user.id,
      });
      setLiveAnnouncement(
        lang === 'ar' ? 'بدأ مؤقت الفقرة' : 'Segment timer started'
      );
      await loadConsoleState();
    } catch (err) {
      await handleCommandError(err, 'start timer', 'بدء المؤقت');
    }
  }, [
    match,
    currentSegment,
    user,
    displayRemainingSec,
    loadConsoleState,
    lang,
    handleCommandError,
  ]);

  const handleTimerPause = useCallback(async () => {
    if (!match || !currentSegment || !user) return;
    const dur = match.timer?.durationSec ?? currentSegment.durationSec ?? 45;
    try {
      await commands.updateTimer({
        matchId: match.id,
        timer: {
          status: 'paused',
          durationSec: dur,
          remainingSec: displayRemainingSec,
          endsAt: null,
        },
        actorUserId: user.id,
      });
      setLiveAnnouncement(
        lang === 'ar' ? 'تم إيقاف المؤقت مؤقتاً' : 'Segment timer paused'
      );
      await loadConsoleState();
    } catch (err) {
      await handleCommandError(err, 'pause timer', 'إيقاف المؤقت');
    }
  }, [
    match,
    currentSegment,
    user,
    displayRemainingSec,
    loadConsoleState,
    lang,
    handleCommandError,
  ]);

  const executeTimerReset = async () => {
    if (!match || !currentSegment || !user) return;
    const dur = currentSegment.durationSec ?? 45;
    timerExpireHandledRef.current = false;
    timerWarnAnnouncedRef.current = false;
    try {
      await commands.updateTimer({
        matchId: match.id,
        timer: {
          status: 'idle',
          durationSec: dur,
          remainingSec: dur,
          endsAt: null,
        },
        actorUserId: user.id,
      });
      setDisplayRemainingSec(dur);
      setLiveAnnouncement(
        lang === 'ar' ? 'تمت إعادة ضبط المؤقت' : 'Segment timer reset'
      );
      await loadConsoleState();
    } catch (err) {
      await handleCommandError(err, 'reset timer', 'إعادة ضبط المؤقت');
    }
  };

  const handleTimerResetClick = () => {
    if (match?.timer?.status === 'running') {
      setConfirmResetTimerOpen(true);
    } else {
      executeTimerReset();
    }
  };

  const executeSegmentChange = async (nextIndex: number) => {
    if (!match || !user || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.changeSegment({
        matchId: match.id,
        nextIndex,
        actorUserId: user.id,
        expectedVersion: match.version,
      });
      await loadConsoleState();
      const targetSegId = match.segmentIds[nextIndex];
      const targetSeg = allSegments.find((s) => s.id === targetSegId);
      setLiveAnnouncement(
        lang === 'ar'
          ? `الفقرة ${nextIndex + 1}: ${targetSeg?.nameAr ?? ''}`
          : `Segment ${nextIndex + 1}: ${targetSeg?.nameEn ?? ''}`
      );
    } catch (err) {
      await handleCommandError(err, 'switch segment', 'تغيير الفقرة');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusyAction(false);
        setPendingSegmentIndex(null);
      }
    }
  };

  const handleSegmentNavClick = (nextIndex: number) => {
    if (!match) return;
    const isBackward = nextIndex < match.currentSegmentIndex;
    const isTimerRunning = match.timer?.status === 'running';
    if (isBackward || isTimerRunning) {
      setPendingSegmentIndex(nextIndex);
    } else {
      executeSegmentChange(nextIndex);
    }
  };

  const handleConfirmFinish = async () => {
    if (!match || !user || busyRef.current) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      const result = await commands.finishMatch({
        matchId: match.id,
        actorUserId: user.id,
        autoOpenTieBreaker: true,
        expectedVersion: match.version,
      });
      await loadConsoleState();

      if (!result) return;

      if (
        result.status === 'tie_breaker_opened' ||
        result.status === 'needsTieBreak'
      ) {
        const tiedIds = result.tiedPlayerIds ?? [];
        setTieBreakerPlayerIds(tiedIds);
        const names = tiedIds
          .map((pid) => {
            const p = allPlayers.find((pl) => pl.id === pid);
            return p ? localizeText(lang, p.fullName, p.fullNameAr) : pid;
          })
          .join(lang === 'ar' ? ' و ' : ' & ');
        const title =
          lang === 'ar'
            ? 'تعادل! تم فتح جولة الحسم تلقائياً'
            : 'Scores Tied! Tie-Breaker #16 Opened';
        setLiveAnnouncement(title);
        toast({
          variant: 'gold',
          title,
          description:
            lang === 'ar'
              ? `تعادل بين ${names} — لا يُسمح بالتعادل، فقرة الحسم جاهزة الآن.`
              : `Tie between ${names} — draws are not allowed; sudden-death Tie-Breaker (30s) inserted.`,
          durationMs: 4500,
        });
      } else if (result.status === 'finished') {
        setTieBreakerPlayerIds([]);
        const winner = allPlayers.find(
          (p) => p.id === result.match.result?.winnerId
        );
        const resultTypeLabel =
          result.match.result?.type === 'walkover'
            ? lang === 'ar'
              ? 'فوز انسحابي'
              : 'Walkover'
            : lang === 'ar'
              ? 'فوز عادي'
              : 'Normal Win';
        const title =
          lang === 'ar'
            ? `انتهت المباراة (${resultTypeLabel}) — الفائز: ${winner?.fullNameAr ?? ''}`
            : `Match Finished (${resultTypeLabel}) — Winner: ${winner?.fullName ?? ''}`;
        const advancedTables = Array.from(
          new Set(
            (result.advancedTo ?? []).map((a) =>
              localizeText(lang, a.targetTableName, a.targetTableNameAr)
            )
          )
        );
        const advancedToFinal = Boolean(
          result.advancedTo?.some((a) => a.isFinal)
        );
        const description = advancedToFinal
          ? lang === 'ar'
            ? 'تم حجز مقاعد النهائي الكبير تلقائياً في مواجهة مروان سري!'
            : 'Finalist automatically advanced into the Grand Final vs. Marwan Serry!'
          : advancedTables.length > 0
            ? lang === 'ar'
              ? `تم تأهيل الفائز تلقائياً إلى: ${advancedTables.join('، ')}.`
              : `Automatically advanced to: ${advancedTables.join(', ')}.`
            : match.type === 'group'
              ? lang === 'ar'
                ? 'تم احتساب +٣ نقاط في ترتيب المجموعة وتحديث لوحة الصدارة.'
                : '+3 group points credited; standings and leaderboard updated.'
              : lang === 'ar'
                ? 'تم تحديث لوحة الصدارة وشجرة البطولة وسجل المراجعة.'
                : 'Leaderboard, bracket, and Audit Log updated.';
        setLiveAnnouncement(title);
        toast({
          variant: 'positive',
          title,
          description,
          durationMs: 5000,
        });
      }
    } catch (err) {
      await handleCommandError(err, 'finish match', 'إنهاء المباراة');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  const handleConfirmReopen = async (cascadeOpts?: {
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
  }) => {
    if (!match || !user || busyRef.current || !canReopen) return;
    busyRef.current = true;
    setBusyAction(true);
    try {
      await commands.reopenMatch({
        matchId: match.id,
        actorUserId: user.id,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
        expectedVersion: match.version,
      });
      setPendingImpact(null);
      await loadConsoleState();
      const title =
        lang === 'ar'
          ? 'تمت إعادة فتح المباراة للتعديل'
          : 'Match reopened for live scoring';
      setLiveAnnouncement(title);
      toast({
        variant: 'info',
        title,
        description:
          lang === 'ar'
            ? 'تم تسجيل الإجراء في سجل المراجعة.'
            : 'Reopen action logged in Audit Log.',
      });
    } catch (err) {
      await handleCommandError(
        err,
        'reopen match',
        'إعادة فتح المباراة',
        (policy) =>
          handleConfirmReopen({ confirmCascade: true, cascadePolicy: policy })
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyAction(false);
    }
  };

  // Desktop / Tablet Keyboard Shortcuts (v2: +1, -1, Y yellow, R red, B buzz, Space timer, Ctrl+Z undo)
  useEffect(() => {
    if (
      !match ||
      (match.status !== 'live' && match.status !== 'needsTieBreak') ||
      !canAccessScorerGame(user, match.judgeUserId || match.scorerUserId)
    ) {
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
      if (isTyping || historyOpen || contactPlayer || pendingAbsentPlayer) return;

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
      } else if (
        e.key.toLowerCase() === 'b' &&
        selectedPlayer &&
        !absentSet.has(selectedPlayer.id)
      ) {
        e.preventDefault();
        handleBuzz(selectedPlayer);
      } else if (
        (e.key === '+' || e.key === '=') &&
        selectedPlayer &&
        !absentSet.has(selectedPlayer.id)
      ) {
        e.preventDefault();
        handleApplyPoint(selectedPlayer, 1);
      } else if (
        e.key === '-' &&
        selectedPlayer &&
        !absentSet.has(selectedPlayer.id)
      ) {
        e.preventDefault();
        handleApplyPoint(selectedPlayer, -1);
      } else if (
        e.key.toLowerCase() === 'y' &&
        selectedPlayer &&
        !absentSet.has(selectedPlayer.id)
      ) {
        e.preventDefault();
        handleApplyCard(selectedPlayer, 'yellow');
      } else if (
        e.key.toLowerCase() === 'r' &&
        selectedPlayer &&
        !absentSet.has(selectedPlayer.id)
      ) {
        e.preventDefault();
        handleApplyCard(selectedPlayer, 'red');
      } else if (e.key === ' ') {
        e.preventDefault();
        if (match.timer?.status === 'running') {
          handleTimerPause();
        } else {
          handleTimerStart();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    match,
    user,
    historyOpen,
    contactPlayer,
    pendingAbsentPlayer,
    seatedPlayers,
    selectedPlayer,
    absentSet,
    handleBuzz,
    handleApplyPoint,
    handleApplyCard,
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
        <div className="grid gap-4 md:grid-cols-2">
          <PlayerPanelSkeleton />
          <PlayerPanelSkeleton />
        </div>
      </div>
    );
  }

  // 1b. Load Error Recovery State
  if (loadError) {
    return (
      <section role="alert" className="mx-auto max-w-2xl py-6">
        <div className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-6 sm:p-8 text-center shadow-sticker-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-pill border-[2.5px] border-outline bg-negative text-white shadow-sticker-sm">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-fluid-2xl text-white">
              {lang === 'ar'
                ? 'تعذر تحميل لوحة التحكيم'
                : 'Could Not Load Scorer Console'}
            </h1>
            <p className="text-sm sm:text-base text-red-100 leading-relaxed break-words">
              {lang === 'ar'
                ? 'حدث خطأ أثناء قراءة بيانات هذه المباراة. اضغط إعادة المحاولة لاستئناف التحكيم.'
                : `An error occurred loading match "${resolvedMatchId}" (${loadError}). Tap Retry to recover.`}
            </p>
          </div>
          <div className="flex flex-col xs:flex-row flex-wrap justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="gold"
              size="scorer"
              onClick={() => {
                setLoading(true);
                setLoadError(null);
                loadConsoleState();
              }}
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Try Again'}</span>
            </Button>
            <Button asChild variant="secondary" size="scorer">
              <Link href="/scorer">
                <ArrowLeft
                  className="h-5 w-5 rtl:rotate-180"
                  aria-hidden="true"
                />
                <span>
                  {lang === 'ar' ? 'العودة إلى طاولاتي' : 'Back to My Tables'}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // 2. Not Found State
  if (!match) {
    return (
      <div className="mx-auto max-w-2xl rounded-card border-[2.5px] border-outline bg-white p-2 shadow-sticker">
        <EmptyState
          title={lang === 'ar' ? 'المباراة غير موجودة' : 'Match session not found'}
          description={
            lang === 'ar'
              ? `لم يتم العثور على مباراة بالمعرّف (${resolvedMatchId}). عُد إلى قائمة الطاولات لاختيار مباراة صالحة.`
              : `No match exists for ID "${resolvedMatchId}". Return to your assigned tables to pick a valid match.`
          }
          action={
            <Button asChild variant="red" size="scorer">
              <Link href="/scorer">
                <ArrowLeft
                  className="h-5 w-5 rtl:rotate-180"
                  aria-hidden="true"
                />
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

  // 3. Per-Match Judge Assignment Guard
  const assignedJudgeId = match.judgeUserId || match.scorerUserId;
  if (!canAccessScorerGame(user, assignedJudgeId)) {
    return (
      <section className="mx-auto max-w-2xl py-6">
        <div className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-6 sm:p-8 text-center shadow-sticker-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-pill border-[2.5px] border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-fluid-2xl text-white">
              {lang === 'ar'
                ? 'هذه المباراة مخصصة لحكم آخر'
                : 'Match Assigned to Another Judge'}
            </h1>
            <p className="text-sm sm:text-base text-red-100 leading-relaxed">
              {lang === 'ar'
                ? `"${localizeText(lang, match.tableName, match.tableNameAr)}" مخصصة حالياً لـ ${assignedJudge ? localizeText(lang, assignedJudge.name, assignedJudge.nameAr) : assignedJudgeId}. يمكن للحكم المعين أو مدير البطولة فقط إدارة هذه اللوحة.`
                : `"${match.tableName}" is assigned to ${assignedJudge ? assignedJudge.name : assignedJudgeId}. Only the assigned judge or a Super Admin can operate this console.`}
            </p>
          </div>

          <div className="flex flex-col xs:flex-row flex-wrap justify-center gap-3 pt-2">
            <Button asChild variant="gold" size="scorer">
              <Link href="/scorer">
                <ArrowLeft
                  className="h-5 w-5 rtl:rotate-180"
                  aria-hidden="true"
                />
                <span>
                  {lang === 'ar'
                    ? 'عرض طاولاتي المخصصة'
                    : 'View My Assigned Tables'}
                </span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="scorer">
              <Link
                href={`/screen/${match.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MonitorPlay className="h-5 w-5" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'مشاهدة شاشة العرض فقط'
                    : 'Watch Big Screen Only'}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const isLiveOrTieBreak =
    match.status === 'live' || match.status === 'needsTieBreak';
  const isTimerUrgent = displayRemainingSec > 0 && displayRemainingSec <= 5;
  const isTieBreakerActive = currentSegment?.id === 'seg-16';
  const totalEventsCount =
    scoreEvents.length + absenceEvents.length + buzzEvents.length;
  const currentCatMeta = currentSegment
    ? CATEGORY_LABELS[currentSegment.category]
    : null;
  const hasPrevSeg = match.currentSegmentIndex > 0;
  const hasNextSeg = match.currentSegmentIndex < match.segmentIds.length - 1;
  const isWalkoverFinished =
    match.status === 'finished' && match.result?.type === 'walkover';

  const undoPreview = nextUndoableEvent
    ? formatScoreEventDisplay(nextUndoableEvent, lang, useArabicIndic)
    : null;

  // Reusable inline Super Admin Decision Panel (for void, needsReview, or Final absence)
  const renderAdminDecisionBanner = (
    mode: 'void' | 'finalAbsence' | 'needsReview'
  ) => {
    const headline =
      mode === 'void'
        ? lang === 'ar'
          ? 'المباراة ملغاة — كلا اللاعبين غائب (قرار المدير مطلوب)'
          : 'Match Void — Both Players Absent (Admin Decision Required)'
        : mode === 'finalAbsence'
          ? lang === 'ar'
            ? 'غياب متأهل في النهائي الكبير — مطلوب قرار مدير البطولة'
            : 'Finalist Absent in Grand Final — Super Admin Decision Required'
          : lang === 'ar'
            ? 'المباراة بحاجة لمراجعة إدارية بعد تعديل نتيجة سابقة'
            : 'Match Flagged for Admin Review After Upstream Change';

    const subcopy =
      mode === 'void'
        ? lang === 'ar'
          ? 'عند غياب كلا اللاعبين لا يتأهل أحد تلقائياً. اختر الفائز أو ألغِ غياب أحد اللاعبين أو أعد تهيئة المباراة لإعادة اللعب.'
          : 'With both contestants absent, nobody advances automatically. Super Admin may award a winner, reverse an absence, or reset for replay.'
        : mode === 'finalAbsence'
          ? lang === 'ar'
            ? 'مباراة النهائي مع مروان سري لا تُنهى تلقائياً بالغياب. يمكن لمدير البطولة إلغاء الغياب أو اعتماد النتيجة الإدارية أو متابعة اللعب.'
            : 'The Grand Final with Marwan Serry never auto-ends on absence. Super Admin may reverse the absence, override the result, or continue play.'
          : match.needsReviewReason ??
            (lang === 'ar'
              ? 'تغيّرت نتيجة مباراة سابقة تؤثر على هذه المواجهة.'
              : 'An upstream match result changed after this match started or finished.');

    const selectableWinners = seatedPlayers.filter((p) =>
      mode === 'void' ? true : !absentSet.has(p.id)
    );

    return (
      <section
        role="alert"
        className="space-y-4 rounded-card border-[3px] border-gold-400 bg-red-800 p-4 sm:p-5 text-white shadow-sticker-lg"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
            <Gavel className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="font-display text-fluid-xl leading-tight text-white">
              {headline}
            </h2>
            <p className="text-sm text-red-100 leading-relaxed">{subcopy}</p>
          </div>
        </div>

        {isSuperAdmin ? (
          <div className="space-y-3 rounded-input border-2 border-white/20 bg-red-900/80 p-3.5 sm:p-4">
            {mode === 'needsReview' ? (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="gold"
                  size="scorer"
                  disabled={busyAction}
                  onClick={() => handleAdminResolveReview('invalidateForReplay')}
                  className="flex-1"
                >
                  <RotateCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'إلغاء النتيجة وإعادة اللعب (٠-٠)'
                      : 'Invalidate & Reset for Replay (0–0)'}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="scorer"
                  disabled={busyAction}
                  onClick={() => handleAdminResolveReview('keepAsIs')}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'اعتماد النتيجة الحالية كما هي'
                      : 'Keep Existing Result'}
                  </span>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2.5 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="admin-override-winner"
                      className="mb-1 block text-xs font-extrabold uppercase text-gold-200"
                    >
                      {lang === 'ar'
                        ? 'اعتماد فائز بقرار إداري'
                        : 'Award Winner (Override)'}
                    </label>
                    <select
                      id="admin-override-winner"
                      value={overrideWinnerId}
                      onChange={(e) => setOverrideWinnerId(e.target.value)}
                      className="min-h-[48px] w-full rounded-input border-2 border-outline bg-white px-3 text-base font-bold text-ink focus:border-blue-500 focus:outline-none"
                    >
                      {(selectableWinners.length > 0
                        ? selectableWinners
                        : seatedPlayers
                      ).map((p) => (
                        <option key={p.id} value={p.id}>
                          {localizeText(lang, p.fullName, p.fullNameAr)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label
                      htmlFor="admin-override-reason"
                      className="mb-1 block text-xs font-extrabold uppercase text-gold-200"
                    >
                      {lang === 'ar' ? 'سبب القرار' : 'Decision Reason'}
                    </label>
                    <Input
                      id="admin-override-reason"
                      type="text"
                      maxLength={NOTE_MAX_LENGTH}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder={
                        lang === 'ar'
                          ? 'مثال: تأهل بالقرعة أو قرار اللجنة'
                          : 'e.g. Committee ruling / forfeit'
                      }
                      className="min-h-[48px]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      type="button"
                      variant="gold"
                      size="scorer"
                      disabled={busyAction || !overrideWinnerId}
                      onClick={() => handleAdminOverrideWinner()}
                      className="w-full"
                    >
                      <Gavel className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'اعتماد الفائز' : 'Award Winner'}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
                  {absentPlayerIds.map((pid) => {
                    const pl = seatedPlayers.find((p) => p.id === pid);
                    if (!pl) return null;
                    return (
                      <Button
                        key={pid}
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyAction}
                        onClick={() => setPendingReverseAbsentPlayer(pl)}
                      >
                        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar'
                            ? `إلغاء غياب ${pl.fullNameAr}`
                            : `Reverse Absence: ${pl.fullName}`}
                        </span>
                      </Button>
                    );
                  })}

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busyAction}
                    onClick={() =>
                      handleAdminResolveReview('invalidateForReplay')
                    }
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'إعادة تهيئة للعب مجدداً'
                        : 'Reset for Replay'}
                    </span>
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-input border border-gold-300/60 bg-red-900/90 px-3.5 py-2.5 text-sm font-bold text-gold-200">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? 'بانتظار تدخل مدير البطولة (Super Admin) لاتخاذ القرار الرسمي.'
                : 'Awaiting Super Admin decision to resolve this match.'}
            </span>
          </div>
        )}
      </section>
    );
  };

  return (
    <div
      className={cn(
        'space-y-3',
        isLiveOrTieBreak && 'pb-60 md:pb-4'
      )}
    >
      {/* Screen-reader live region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* TOP SESSION COMMAND STRIP */}
      <header className="flex flex-col gap-2.5 border-b-2 border-red-800 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
          <Button
            asChild
            variant="surface"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={
              lang === 'ar'
                ? 'العودة إلى قائمة الطاولات'
                : 'Back to assigned tables'
            }
          >
            <Link href="/scorer">
              <ArrowLeft
                className="h-5 w-5 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </Button>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-fluid-xl leading-tight text-white break-words [overflow-wrap:anywhere] md:truncate">
                {localizeText(lang, match.tableName, match.tableNameAr)}
              </h1>

              <Badge variant="neutral" className="tabular-nums">
                {lang === 'ar'
                  ? `طاولة #${formatNumber(match.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                  : `Table #${match.tableNumber}`}
              </Badge>

              {isFinalMatch && (
                <Badge variant="gold">
                  <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'النهائي ٣ لاعبين' : '1v1v1 FINAL'}</span>
                </Badge>
              )}

              {match.status === 'live' ? (
                <LiveBadge surface="stage" />
              ) : match.status === 'needsTieBreak' ? (
                <Badge variant="gold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'تعادل — حسم مطلوب' : 'TIE-BREAK REQUIRED'}</span>
                </Badge>
              ) : match.status === 'void' ? (
                <Badge variant="negative">
                  <UserX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'ملغاة (غياب الطرفين)' : 'VOID · BOTH ABSENT'}</span>
                </Badge>
              ) : match.status === 'needsReview' ? (
                <Badge variant="gold">
                  <Gavel className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'بحاجة لمراجعة' : 'NEEDS REVIEW'}</span>
                </Badge>
              ) : match.status === 'scheduled' ? (
                <Badge variant="upcoming">
                  {lang === 'ar' ? 'مجدولة' : 'SCHEDULED'}
                </Badge>
              ) : (
                <Badge variant="gold">
                  <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isWalkoverFinished
                      ? lang === 'ar'
                        ? 'منتهية · فوز انسحابي'
                        : 'FINISHED · WALKOVER'
                      : lang === 'ar'
                        ? 'منتهية · فوز عادي'
                        : 'FINISHED · NORMAL'}
                  </span>
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs sm:text-sm font-semibold text-red-100">
              {round && (
                <span>{localizeText(lang, round.name.en, round.name.ar)}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {formatDateTime(match.scheduledAt, lang, useArabicIndic)}
              </span>
              {isSuperAdmin && assignedJudge && (
                <span className="text-white">
                  · {lang === 'ar' ? 'الحكم:' : 'Judge:'}{' '}
                  {localizeText(lang, assignedJudge.name, assignedJudge.nameAr)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Utility Controls */}
        <div className="flex shrink-0 flex-wrap lg:flex-nowrap items-center gap-2">
          <Button
            type="button"
            variant="surface"
            size="sm"
            className="min-h-[44px] flex-1 sm:flex-none px-3"
            onClick={() => setHistoryOpen(true)}
          >
            {canManageHistory ? (
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-positive-ink"
                aria-hidden="true"
              />
            ) : (
              <History
                className="h-4 w-4 shrink-0 text-red-700"
                aria-hidden="true"
              />
            )}
            <span>
              {canManageHistory
                ? lang === 'ar'
                  ? 'السجل والتحكم'
                  : 'History'
                : lang === 'ar'
                  ? 'سجل المباراة'
                  : 'Match Log'}
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
              href={`/screen/${match.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}</span>
            </Link>
          </Button>

          {isLiveOrTieBreak && (
            <div ref={shortcutsRef} className="relative hidden lg:block">
              <Button
                type="button"
                variant="surface"
                size="icon"
                className="h-11 w-11"
                aria-expanded={shortcutsOpen}
                aria-haspopup="dialog"
                aria-label={
                  lang === 'ar' ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'
                }
                onClick={() => setShortcutsOpen((prev) => !prev)}
              >
                <Keyboard className="h-5 w-5" aria-hidden="true" />
              </Button>
              {shortcutsOpen && (
                <div
                  role="dialog"
                  aria-label={
                    lang === 'ar' ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'
                  }
                  className="absolute end-0 top-14 z-40 w-64 rounded-card border-[2.5px] border-outline bg-white p-4 text-ink shadow-sticker-lg"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-display text-base text-red-900">
                      {lang === 'ar' ? 'اختصارات سريعة' : 'Quick Shortcuts'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShortcutsOpen(false)}
                      aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                      className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-outline bg-paper text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="space-y-1.5 text-xs font-semibold">
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'اختيار لاعب' : 'Select player'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        {isThreeColLayout ? '1 / 2 / 3' : '1 / 2'}
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'جرس المختار' : 'Buzz selected'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        B
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'نقطة +١ / −١' : '+1 / −1 point'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        + / -
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'صفراء / حمراء' : 'Yellow / Red card'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        Y / R
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'تشغيل / إيقاف المؤقت' : 'Start / Pause timer'}</span>
                      <kbd className="rounded border border-outline bg-paper px-1.5 py-0.5 font-mono">
                        Space
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{lang === 'ar' ? 'تراجع عن آخر حركة' : 'Undo last action'}</span>
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
      {/* INLINE ADMIN DECISION BANNERS (VOID / NEEDS REVIEW / FINAL ABSENCE) */}
      {/* =================================================================== */}
      {match.status === 'void' && renderAdminDecisionBanner('void')}
      {match.status === 'needsReview' && renderAdminDecisionBanner('needsReview')}
      {isFinalAbsenceDecisionNeeded && renderAdminDecisionBanner('finalAbsence')}

      {/* =================================================================== */}
      {/* STATE A: SCHEDULED MATCH START GATE                                 */}
      {/* =================================================================== */}
      {match.status === 'scheduled' && (
        <section className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-5 sm:p-6 shadow-sticker-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-pill border border-white/25 bg-red-900 px-3 py-1 text-xs font-bold text-white">
                <CalendarClock
                  className="h-4 w-4 text-gold-300"
                  aria-hidden="true"
                />
                <span>
                  {lang === 'ar' ? 'موعد المباراة:' : 'Scheduled:'}{' '}
                  {formatDateTime(match.scheduledAt, lang, useArabicIndic)} ·{' '}
                  {lang === 'ar'
                    ? `طاولة #${formatNumber(match.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                    : `Table #${match.tableNumber}`}
                </span>
              </div>
              <h2 className="font-display text-fluid-2xl text-white">
                {lang === 'ar'
                  ? 'المباراة جاهزة للبدء المباشر'
                  : 'Match Ready for Live Broadcast'}
              </h2>
              <p className="max-w-2xl text-sm sm:text-base text-red-100">
                {isFinalMatch
                  ? lang === 'ar'
                    ? 'راجع المتأهلين ومقعد مروان سري ثم اضغط بدء النهائي الكبير. يمكنك التواصل مع أي لاعب متأخر أو تسجيل غيابه من البطاقة.'
                    : 'Verify the two finalists and Marwan Serry’s seat, then start the Grand Final. Contact late players or record absence directly below.'
                  : lang === 'ar'
                    ? 'تحقق من حضور اللاعبين. يمكنك الاتصال باللاعب المتأخر أو تسجيل غيابه (فوز انسحابي فوري في ١ ضد ١) أو بدء المباراة المباشرة.'
                    : 'Verify both players are seated. Call a late player, mark a no-show absent (immediate walkover in 1v1), or start the live match.'}
              </p>
            </div>

            <Button
              type="button"
              variant="gold"
              size="scorer"
              disabled={busyAction || hasUnfilledSeats}
              onClick={() => setConfirmStartOpen(true)}
              className="w-full lg:w-auto shrink-0"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              <span>
                {hasUnfilledSeats
                  ? lang === 'ar'
                    ? 'بانتظار اكتمال المقاعد'
                    : 'Awaiting Qualifiers'
                  : lang === 'ar'
                    ? 'بدء المباراة المباشرة'
                    : 'Start Live Match'}
              </span>
            </Button>
          </div>

          {hasUnfilledSeats && (
            <div
              role="status"
              className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-card border-2 border-gold-300 bg-red-900/90 px-4 py-3 text-sm text-white"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-gold-300"
                  aria-hidden="true"
                />
                <p className="leading-relaxed">
                  {lang === 'ar'
                    ? `لا يمكن بدء هذه المباراة قبل اكتمال المقاعد (${formatNumber(unresolvedParticipants.length, { useArabicIndicDigits: useArabicIndic })} بانتظار المتأهلين من الدور السابق).`
                    : `Cannot go live yet — ${unresolvedParticipants.length} qualifier slot(s) are still TBD. Finish upstream matches first.`}
                </p>
              </div>
              {isSuperAdmin && (
                <Button asChild variant="surface" size="sm" className="shrink-0">
                  <Link href="/admin/bracket">
                    {lang === 'ar' ? 'فتح شجرة البطولة' : 'Open Bracket'}
                  </Link>
                </Button>
              )}
            </div>
          )}

          <div
            className={cn(
              'grid gap-3',
              isThreeColLayout ? 'md:grid-cols-3' : 'md:grid-cols-2'
            )}
          >
            {match.participants.map((part, sIdx) => {
              const player = part.playerId
                ? allPlayers.find((p) => p.id === part.playerId)
                : undefined;
              if (!player) {
                return (
                  <div
                    key={`tbd-${part.slotIndex}-${sIdx}`}
                    className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-gold-300/60 bg-red-900/60 p-5 text-center text-white"
                  >
                    <Badge variant="upcoming">
                      {part.isBye
                        ? 'BYE'
                        : lang === 'ar'
                          ? `مقعد #${formatNumber(sIdx + 1, { useArabicIndicDigits: useArabicIndic })} · TBD`
                          : `SEAT #${sIdx + 1} · TBD`}
                    </Badge>
                    <div className="font-display text-lg text-gold-200">
                      {localizeText(
                        lang,
                        part.placeholderLabelEn ?? `Qualifier #${sIdx + 1}`,
                        part.placeholderLabelAr ?? `متأهل #${sIdx + 1}`
                      )}
                    </div>
                  </div>
                );
              }

              const showContact = canViewPlayerContactForMatch(user, match, player);
              const isAbsent = absentSet.has(player.id);
              const canMark = !player.isGuest && !player.isHost && !hasUnfilledSeats;

              return (
                <PlayerPanel
                  key={player.id}
                  playerId={player.id}
                  name={localizeText(lang, player.fullName, player.fullNameAr)}
                  nickname={localizeText(lang, player.nickname, player.nicknameAr)}
                  avatarSeed={player.avatarSeed}
                  avatar={player.avatar}
                  score={totals[player.id] ?? 0}
                  yellowCards={yellowCardsByPlayer[player.id] ?? 0}
                  redCards={redCardsByPlayer[player.id] ?? 0}
                  isAbsent={isAbsent}
                  isHost={Boolean(player.isGuest || player.isHost)}
                  variant="scorer"
                  surface="dark"
                  useArabicIndicDigits={useArabicIndic}
                  disabledActions={busyAction}
                  onContact={showContact ? () => setContactPlayer(player) : undefined}
                  onMarkAbsent={
                    canMark && !isAbsent
                      ? () => setPendingAbsentPlayer(player)
                      : undefined
                  }
                  onReverseAbsence={
                    isSuperAdmin && isAbsent
                      ? () => setPendingReverseAbsentPlayer(player)
                      : undefined
                  }
                />
              );
            })}
          </div>

          <div className="space-y-2.5 border-t border-white/15 pt-4">
            <h3 className="text-sm font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-white">
              {lang === 'ar'
                ? `ترتيب الفقرات (${formatNumber(matchSegments.length, { useArabicIndicDigits: useArabicIndic })})`
                : `Segment Lineup (${matchSegments.length})`}
            </h3>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {matchSegments.map((seg, i) => (
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
      {/* STATE B: FINISHED / VOID / NEEDS REVIEW SUMMARY                     */}
      {/* =================================================================== */}
      {(match.status === 'finished' ||
        match.status === 'void' ||
        match.status === 'needsReview') && (
        <section className="space-y-5 rounded-card border-[3px] border-gold-400 bg-red-800 p-5 sm:p-6 shadow-sticker-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-fluid-2xl text-white">
                  {match.status === 'void'
                    ? lang === 'ar'
                      ? 'مباراة ملغاة (غياب الطرفين)'
                      : 'Void Match — Both Absent'
                    : match.status === 'needsReview'
                      ? lang === 'ar'
                        ? 'مباراة قيد المراجعة الإدارية'
                        : 'Match Pending Admin Review'
                      : lang === 'ar'
                        ? 'النتيجة النهائية المعتمدة'
                        : 'Official Final Result'}
                </h2>
                {match.status === 'finished' && match.result && (
                  <Badge variant={isWalkoverFinished ? 'gold' : 'positive'}>
                    {isWalkoverFinished
                      ? match.result.reason === 'bye'
                        ? lang === 'ar'
                          ? 'تأهل تلقائي (BYE)'
                          : 'BYE Walkover'
                        : lang === 'ar'
                          ? 'النتيجة: فوز انسحابي'
                          : 'Result: Walkover'
                      : lang === 'ar'
                        ? 'النتيجة: فوز عادي'
                        : 'Result: Normal'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-red-100">
                {match.finishedAt
                  ? lang === 'ar'
                    ? `انتهت في ${formatDateTime(match.finishedAt, lang, useArabicIndic)}${match.type === 'group' && match.status === 'finished' ? ' · الفائز حصل على +٣ نقاط بالمجموعة' : ''}`
                    : `Concluded ${formatDateTime(match.finishedAt, lang, useArabicIndic)}${match.type === 'group' && match.status === 'finished' ? ' · Winner awarded +3 group points' : ''}`
                  : formatDateTime(match.scheduledAt, lang, useArabicIndic)}
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
                      ? 'إدارة سجل المباراة'
                      : 'Manage History'
                    : lang === 'ar'
                      ? 'مراجعة السجل'
                      : 'Review Log'}
                </span>
              </Button>

              {canReopen && match.status === 'finished' && (
                <Button
                  type="button"
                  variant="destructive"
                  size="scorer"
                  disabled={busyAction}
                  onClick={() => setConfirmReopenOpen(true)}
                >
                  <RotateCcw className="h-5 w-5" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'إعادة فتح المباراة' : 'Reopen Match'}
                  </span>
                </Button>
              )}
            </div>
          </div>

          <div
            className={cn(
              'grid gap-4',
              isThreeColLayout ? 'md:grid-cols-3' : 'md:grid-cols-2'
            )}
          >
            {sortedStandings.map(({ player, score, rank }) => {
              const isWinner =
                match.status === 'finished' &&
                match.result?.winnerId === player.id;
              const isWalkoverWin = isWinner && isWalkoverFinished;
              const isAbsent = absentSet.has(player.id);
              const showContact = canViewPlayerContactForMatch(user, match, player);
              // On a 1v1 walkover (1 absent), allow marking the 2nd player absent too -> Void!
              const canMarkSecondAbsent =
                match.status === 'finished' &&
                isWalkoverFinished &&
                match.result?.reason === 'absence' &&
                !isFinalMatch &&
                !isAbsent &&
                !player.isGuest &&
                !player.isHost;

              return (
                <PlayerPanel
                  key={player.id}
                  playerId={player.id}
                  name={localizeText(lang, player.fullName, player.fullNameAr)}
                  nickname={localizeText(lang, player.nickname, player.nicknameAr)}
                  avatarSeed={player.avatarSeed}
                  avatar={player.avatar}
                  score={score}
                  rank={rank}
                  yellowCards={yellowCardsByPlayer[player.id] ?? 0}
                  redCards={redCardsByPlayer[player.id] ?? 0}
                  showCardCounters
                  isWinner={isWinner}
                  isWalkoverWinner={isWalkoverWin}
                  isAbsent={isAbsent}
                  isHost={Boolean(player.isGuest || player.isHost)}
                  variant="scorer"
                  surface="dark"
                  useArabicIndicDigits={useArabicIndic}
                  disabledActions={busyAction}
                  onContact={showContact ? () => setContactPlayer(player) : undefined}
                  onReverseAbsence={
                    isSuperAdmin && isAbsent
                      ? () => setPendingReverseAbsentPlayer(player)
                      : undefined
                  }
                  onMarkAbsent={
                    canMarkSecondAbsent
                      ? () => setPendingAbsentPlayer(player)
                      : undefined
                  }
                  markAbsentLabel={
                    lang === 'ar'
                      ? 'تسجيل غياب المنافس أيضاً (إلغاء المباراة)'
                      : 'Mark Also Absent (Both Absent → Void)'
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* STATE C: ACTIVE LIVE / NEEDS-TIE-BREAK SCORER CONSOLE               */}
      {/* =================================================================== */}
      {isLiveOrTieBreak && currentSegment && (
        <>
          {/* Tie-Break Active / Required Alert Banner */}
          {(isTieBreakerActive || match.status === 'needsTieBreak') && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border-[3px] border-outline bg-gold-gradient px-4 py-3 text-red-900 shadow-sticker"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-red-900 text-gold-300">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-lg leading-tight">
                    {isTieBreakerActive
                      ? lang === 'ar'
                        ? 'جولة الحسم الفاصلة نشطة (التعادل ممنوع)'
                        : 'Sudden-Death Tie-Breaker Active'
                      : lang === 'ar'
                        ? 'المباراة متعادلة — يجب كسر التعادل قبل الإنهاء'
                        : 'Match Tied — Tie-Breaker Required Before Finishing'}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-red-900">
                    {tieBreakerPlayerIds.length > 0
                      ? lang === 'ar'
                        ? `التعادل بين: ${tieBreakerPlayerIds
                            .map((pid) => {
                              const p = seatedPlayers.find((pl) => pl.id === pid);
                              return p ? p.fullNameAr : pid;
                            })
                            .join(' و ')} — سجل نقطة الحسم ثم اضغط إنهاء المباراة.`
                        : `Tied: ${tieBreakerPlayerIds
                            .map((pid) => {
                              const p = seatedPlayers.find((pl) => pl.id === pid);
                              return p ? p.fullName : pid;
                            })
                            .join(' & ')} — score the deciding point then Finish Match.`
                      : lang === 'ar'
                        ? 'لا يُسمح بإنهاء المباراة بالتعادل؛ امنح نقطة حاسمة أو افتح جولة الحسم (#١٦).'
                        : 'Draws are forbidden — break the tie with a point or open Sudden-Death Tie-Breaker (#16).'}
                  </p>
                </div>
              </div>

              {!isTieBreakerActive ? (
                <Button
                  type="button"
                  variant="red"
                  size="sm"
                  disabled={busyAction}
                  onClick={handleOpenTieBreakerNow}
                >
                  {lang === 'ar'
                    ? 'فتح جولة الحسم (#١٦)'
                    : 'Open Tie-Breaker (#16)'}
                </Button>
              ) : (
                <Badge variant="red">
                  {lang === 'ar' ? 'فقرة ١٦ · حسم' : 'SEG #16 · TIE-BREAKER'}
                </Badge>
              )}
            </div>
          )}

          {/* ZONE 1: SEGMENT & TIMER COMMAND BAND */}
          <section
            aria-label={
              lang === 'ar'
                ? 'الفقرة الحالية ومؤقت الجولة'
                : 'Current Segment and Timer'
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
              {/* Segment Title, Progress & Prev/Next */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold" className="font-extrabold">
                    {lang === 'ar'
                      ? `الفقرة ${formatNumber(match.currentSegmentIndex + 1, { useArabicIndicDigits: useArabicIndic })} / ${formatNumber(match.segmentIds.length, { useArabicIndicDigits: useArabicIndic })}`
                      : `SEGMENT ${match.currentSegmentIndex + 1} / ${match.segmentIds.length}`}
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

                <div className="space-y-0.5 text-start">
                  <h2 className="font-display text-fluid-xl leading-tight text-white">
                    {localizeText(
                      lang,
                      currentSegment.nameEn,
                      currentSegment.nameAr
                    )}
                  </h2>
                  <p className="text-sm font-bold text-red-100">
                    <span
                      dir={lang === 'ar' ? 'ltr' : 'rtl'}
                      className="inline-block"
                    >
                      {lang === 'ar'
                        ? currentSegment.nameEn
                        : currentSegment.nameAr}
                    </span>
                  </p>
                </div>

                {/* Progress Track */}
                <div
                  className="flex items-center gap-1.5"
                  aria-label={
                    lang === 'ar'
                      ? `تقدم الفقرات: ${match.currentSegmentIndex + 1} من ${match.segmentIds.length}`
                      : `Segment progress: ${match.currentSegmentIndex + 1} of ${match.segmentIds.length}`
                  }
                >
                  {match.segmentIds.map((sid, idx) => {
                    const isCurrent = idx === match.currentSegmentIndex;
                    const isDone = idx < match.currentSegmentIndex;
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

                {/* Prev / Next Segment Controls (>= 56px) */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="scorer"
                    disabled={!hasPrevSeg || busyAction}
                    onClick={() =>
                      handleSegmentNavClick(match.currentSegmentIndex - 1)
                    }
                    className="flex-1 sm:flex-none px-4"
                  >
                    <ChevronLeft
                      className="h-5 w-5 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                    <span>
                      {lang === 'ar' ? 'الفقرة السابقة' : 'Prev Segment'}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="gold"
                    size="scorer"
                    disabled={!hasNextSeg || busyAction}
                    onClick={() =>
                      handleSegmentNavClick(match.currentSegmentIndex + 1)
                    }
                    className="flex-1 sm:flex-none px-4"
                  >
                    <span>
                      {lang === 'ar' ? 'الفقرة التالية' : 'Next Segment'}
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>

              {/* Segment Timer */}
              <div className="flex flex-row items-center justify-between gap-3 border-t border-white/15 pt-3 sm:justify-center lg:border-t-0 lg:border-s lg:border-white/15 lg:ps-4 lg:pt-0">
                <TimerRing
                  durationSec={
                    match.timer?.durationSec ?? currentSegment.durationSec ?? 45
                  }
                  remainingSec={displayRemainingSec}
                  status={match.timer?.status ?? 'idle'}
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

          {/* ZONE 2: PLAYER PANELS (2 columns for 1v1, 3 columns for Grand Final) */}
          <section
            aria-label={
              isFinalMatch
                ? lang === 'ar'
                  ? 'المتسابقون في النهائي الكبير'
                  : 'Grand Final Participants'
                : lang === 'ar'
                  ? 'المتنافسان (١ ضد ١)'
                  : '1v1 Contestants'
            }
            className="space-y-2.5"
          >
            {/* Buzz Status Bar + Bonus Live Recent Plays Ticker */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {recentPlays.length > 0 ? (
                <div
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs"
                  aria-label={lang === 'ar' ? 'آخر الحركات' : 'Recent plays'}
                >
                  <span className="font-extrabold uppercase text-gold-200">
                    {lang === 'ar' ? 'آخر الحركات:' : 'Recent:'}
                  </span>
                  {recentPlays.map((ev) => {
                    const pl = seatedPlayers.find((p) => p.id === ev.playerId);
                    const d = formatScoreEventDisplay(ev, lang, useArabicIndic);
                    return (
                      <span
                        key={ev.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-white/20 bg-red-800 px-2.5 py-1 font-bold text-white"
                      >
                        {d.cardType && (
                          <DisciplinaryCardIcon card={d.cardType} size="xs" />
                        )}
                        <span className="truncate max-w-[220px]">
                          {pl
                            ? localizeText(
                                lang,
                                pl.fullName.split(' ')[0] ?? pl.fullName,
                                pl.fullNameAr.split(' ')[0] ?? pl.fullNameAr
                              )
                            : ev.playerId}
                          : {d.kindLabel}
                          {d.userNote ? ` (${d.userNote})` : ''}
                        </span>
                        <span className="text-[10px] text-red-100/80 tabular-nums">
                          {formatTimeShort(ev.createdAt, lang, useArabicIndic)}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs sm:text-sm font-bold text-red-100">
                  {lang === 'ar'
                    ? 'استخدم +١ أو −١ أو البطاقة الصفراء (−١) أو الحمراء (−٢) مباشرة لكل لاعب.'
                    : 'Use +1, −1, Yellow card (−1), or Red card (−2) per player with optional note.'}
                </div>
              )}

              {buzzedPlayer && (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleClearBuzz}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 border-outline bg-white px-3.5 py-2 text-xs sm:text-sm font-extrabold text-red-900 shadow-sticker-sm sticker-press hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <XCircle
                    className="h-4 w-4 text-negative shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {lang === 'ar'
                      ? `مسح الجرس (${buzzedPlayer.fullNameAr})`
                      : `Clear Buzz (${buzzedPlayer.fullName})`}
                  </span>
                </button>
              )}
            </div>

            {/* Hybrid Panels: 2-col for 1v1, 3-col for Final; direct 4-button scoring visible on md+ */}
            <div
              className={cn(
                'grid grid-cols-1 gap-3 lg:gap-4',
                isThreeColLayout ? 'md:grid-cols-3' : 'md:grid-cols-2'
              )}
            >
              {seatedPlayers.map((player) => {
                const isSelected = selectedPlayer?.id === player.id;
                const isBuzzed = match.activeBuzzPlayerId === player.id;
                const isAbsent = absentSet.has(player.id);
                const showContact = canViewPlayerContactForMatch(
                  user,
                  match,
                  player
                );

                return (
                  <PlayerPanel
                    key={player.id}
                    playerId={player.id}
                    name={localizeText(lang, player.fullName, player.fullNameAr)}
                    nickname={localizeText(lang, player.nickname, player.nicknameAr)}
                    avatarSeed={player.avatarSeed}
                    avatar={player.avatar}
                    score={totals[player.id] ?? 0}
                    rank={rankByPlayerId[player.id]}
                    yellowCards={yellowCardsByPlayer[player.id] ?? 0}
                    redCards={redCardsByPlayer[player.id] ?? 0}
                    showCardCounters
                    isSelected={isSelected}
                    isBuzzed={isBuzzed}
                    isAbsent={isAbsent}
                    isHost={Boolean(player.isGuest || player.isHost)}
                    recentDelta={recentDeltaByPlayer[player.id] ?? null}
                    variant="scorer"
                    surface="dark"
                    useArabicIndicDigits={useArabicIndic}
                    disabledActions={busyAction}
                    scoringControlsClassName="hidden md:grid"
                    onSelect={() => setSelectedPlayerId(player.id)}
                    onBuzz={() => handleBuzz(player)}
                    onPointPlus={() => handleApplyPoint(player, 1)}
                    onPointMinus={() => handleApplyPoint(player, -1)}
                    onYellowCard={() => handleApplyCard(player, 'yellow')}
                    onRedCard={() => handleApplyCard(player, 'red')}
                    onContact={
                      showContact ? () => setContactPlayer(player) : undefined
                    }
                    onMarkAbsent={
                      !player.isGuest && !player.isHost && !isAbsent
                        ? () => setPendingAbsentPlayer(player)
                        : undefined
                    }
                    onReverseAbsence={
                      isSuperAdmin && isAbsent
                        ? () => setPendingReverseAbsentPlayer(player)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </section>

          {/* ZONE 3A: TABLET / DESKTOP ACTION BAR (Optional Note + Undo + Finish Match — md+) */}
          <section
            aria-label={
              lang === 'ar'
                ? 'الملاحظة والتراجع وإنهاء المباراة'
                : 'Optional Note, Undo and Finish Match'
            }
            className="hidden md:block rounded-card border-[3px] border-outline bg-red-800 p-4 shadow-sticker-lg"
          >
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
              {/* Shared Optional Note attached to next +1 / -1 / Yellow / Red action */}
              <div className="min-w-[200px] flex-1">
                <label htmlFor="desktop-scorer-note" className="sr-only">
                  {lang === 'ar'
                    ? 'ملاحظة اختيارية للنقطة أو البطاقة القادمة'
                    : 'Optional note for next point or card'}
                </label>
                <Input
                  id="desktop-scorer-note"
                  type="text"
                  maxLength={NOTE_MAX_LENGTH}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'ملاحظة اختيارية تُرفق مع الحركة القادمة (+١ / −١ / بطاقة)...'
                      : 'Optional note attached to next +1 / −1 / card tap...'
                  }
                  className="min-h-[56px]"
                />
              </div>

              {/* Undo Last Action (with exact event preview, including Yellow/Red card wording) */}
              <button
                type="button"
                disabled={!nextUndoableEvent || busyAction}
                onClick={handleUndoLast}
                className="flex min-h-[56px] shrink-0 items-center justify-center gap-2 rounded-button border-[2.5px] border-outline bg-white px-4 text-sm font-extrabold text-red-900 shadow-sticker sticker-press hover:bg-paper disabled:opacity-45 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Undo2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="max-w-[260px] truncate">
                  {undoPreview
                    ? lang === 'ar'
                      ? `تراجع: ${undoPreview.kindLabel}${nextUndoablePlayer ? ` · ${nextUndoablePlayer.fullNameAr.split(' ')[0]}` : ''}`
                      : `Undo ${undoPreview.kindLabel}${nextUndoablePlayer ? ` · ${nextUndoablePlayer.fullName.split(' ')[0]}` : ''}`
                    : lang === 'ar'
                      ? 'تراجع'
                      : 'Undo'}
                </span>
              </button>

              {/* Finish Match */}
              <Button
                type="button"
                variant="destructive"
                size="scorer"
                disabled={busyAction}
                onClick={() => setConfirmFinishOpen(true)}
                className="shrink-0 px-5"
              >
                <Flag className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'إنهاء المباراة' : 'Finish Match'}
                </span>
              </Button>
            </div>
          </section>

          {/* ZONE 3B: ONE-HANDED PHONE STICKY THUMB DOCK (< md only) */}
          <section
            aria-label={
              lang === 'ar'
                ? 'شريط التحكيم بيد واحدة'
                : 'One-Handed Scoring Thumb Dock'
            }
            className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-gold-400 bg-red-900/95 px-2.5 pt-2 pb-[calc(0.65rem+env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgb(var(--ink-rgb)/0.7)] backdrop-blur-md md:hidden"
          >
            <div className="mx-auto max-w-lg space-y-2">
              {/* Row 1: One-Handed Player Switcher Pills */}
              <div className="flex items-center gap-1.5">
                {seatedPlayers.map((player) => {
                  const active = selectedPlayer?.id === player.id;
                  const isAbsent = absentSet.has(player.id);
                  const firstName = localizeText(
                    lang,
                    player.fullName.split(' ')[0] ?? player.fullName,
                    player.fullNameAr.split(' ')[0] ?? player.fullNameAr
                  );
                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={isAbsent}
                      aria-pressed={active}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={cn(
                        'flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-button border-2 px-2 py-1 text-xs font-extrabold transition-colors disabled:opacity-45 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                        active
                          ? 'border-white bg-blue-600 text-white shadow-sticker-sm'
                          : 'border-red-700 bg-red-800 text-red-100'
                      )}
                    >
                      <span className="truncate">{firstName}</span>
                      <span className="shrink-0 font-score text-base font-black tabular-nums text-gold-300">
                        {formatNumber(totals[player.id] ?? 0, {
                          useArabicIndicDigits: useArabicIndic,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Collapsible Optional Note Input */}
              {mobileNoteOpen && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    maxLength={NOTE_MAX_LENGTH}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'ملاحظة اختيارية للنقطة أو البطاقة...'
                        : 'Optional note for next point or card...'
                    }
                    aria-label={lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional note'}
                    className="min-h-[44px] flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileNoteOpen(false)}
                    aria-label={lang === 'ar' ? 'إغلاق الملاحظة' : 'Close note'}
                    className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white text-red-900"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Row 2: The ONLY 4 Scoring Controls (+1, −1, Yellow −1, Red −2), >= 56px tall */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  disabled={busyAction || !selectedPlayer || absentSet.has(selectedPlayer.id)}
                  onClick={() => selectedPlayer && handleApplyPoint(selectedPlayer, 1)}
                  aria-label={
                    selectedPlayer
                      ? lang === 'ar'
                        ? `منح +١ نقطة إلى ${selectedPlayer.fullNameAr}`
                        : `Award +1 point to ${selectedPlayer.fullName}`
                      : '+1'
                  }
                  className="flex min-h-[56px] flex-col items-center justify-center rounded-button border-[2.5px] border-outline bg-positive-soft font-score text-2xl font-black tabular-nums text-positive-ink shadow-sticker-sm sticker-press disabled:opacity-45"
                >
                  <span className="inline-flex items-center gap-0.5 leading-none">
                    <Plus className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                    {formatNumber(1, { useArabicIndicDigits: useArabicIndic })}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busyAction || !selectedPlayer || absentSet.has(selectedPlayer.id)}
                  onClick={() => selectedPlayer && handleApplyPoint(selectedPlayer, -1)}
                  aria-label={
                    selectedPlayer
                      ? lang === 'ar'
                        ? `خصم −١ نقطة من ${selectedPlayer.fullNameAr}`
                        : `Deduct −1 point from ${selectedPlayer.fullName}`
                      : '−1'
                  }
                  className="flex min-h-[56px] flex-col items-center justify-center rounded-button border-[2.5px] border-outline bg-white font-score text-2xl font-black tabular-nums text-negative shadow-sticker-sm sticker-press disabled:opacity-45"
                >
                  <span className="inline-flex items-center gap-0.5 leading-none">
                    <Minus className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                    {formatNumber(1, { useArabicIndicDigits: useArabicIndic })}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busyAction || !selectedPlayer || absentSet.has(selectedPlayer.id)}
                  onClick={() => selectedPlayer && handleApplyCard(selectedPlayer, 'yellow')}
                  aria-label={
                    selectedPlayer
                      ? lang === 'ar'
                        ? `بطاقة صفراء (−١) إلى ${selectedPlayer.fullNameAr}`
                        : `Yellow card (−1) to ${selectedPlayer.fullName}`
                      : 'Yellow card (−1)'
                  }
                  className="flex min-h-[56px] items-center justify-center gap-1 rounded-button border-[2.5px] border-outline bg-gold-400 px-1 text-red-900 shadow-sticker-sm sticker-press disabled:opacity-45"
                >
                  <DisciplinaryCardIcon card="yellow" size="xs" />
                  <span className="font-score text-xl font-black tabular-nums leading-none">
                    −{formatNumber(1, { useArabicIndicDigits: useArabicIndic })}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busyAction || !selectedPlayer || absentSet.has(selectedPlayer.id)}
                  onClick={() => selectedPlayer && handleApplyCard(selectedPlayer, 'red')}
                  aria-label={
                    selectedPlayer
                      ? lang === 'ar'
                        ? `بطاقة حمراء (−٢) إلى ${selectedPlayer.fullNameAr}`
                        : `Red card (−2) to ${selectedPlayer.fullName}`
                      : 'Red card (−2)'
                  }
                  className="flex min-h-[56px] items-center justify-center gap-1 rounded-button border-[2.5px] border-outline bg-negative px-1 text-white shadow-sticker-sm sticker-press disabled:opacity-45"
                >
                  <DisciplinaryCardIcon card="red" size="xs" />
                  <span className="font-score text-xl font-black tabular-nums leading-none">
                    −{formatNumber(2, { useArabicIndicDigits: useArabicIndic })}
                  </span>
                </button>
              </div>

              {/* Row 3: Note Toggle + Undo + Finish Match (>= 56px) */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobileNoteOpen((prev) => !prev)}
                  aria-expanded={mobileNoteOpen}
                  className={cn(
                    'flex min-h-[56px] min-w-0 items-center justify-center gap-1 rounded-button border-[2.5px] border-outline px-2 text-xs font-extrabold shadow-sticker-sm sticker-press',
                    mobileNoteOpen || actionNote.trim()
                      ? 'bg-gold-300 text-red-900'
                      : 'bg-white text-red-900'
                  )}
                >
                  <MessageSquarePlus
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {actionNote.trim()
                      ? lang === 'ar'
                        ? 'ملاحظة ✓'
                        : 'Note ✓'
                      : lang === 'ar'
                        ? 'ملاحظة'
                        : 'Note'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!nextUndoableEvent || busyAction}
                  onClick={handleUndoLast}
                  className="flex min-h-[56px] min-w-0 items-center justify-center gap-1 rounded-button border-[2.5px] border-outline bg-white px-2 text-xs font-extrabold text-red-900 shadow-sticker-sm sticker-press disabled:opacity-45"
                >
                  <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {lang === 'ar' ? 'تراجع' : 'Undo'}
                  </span>
                </button>

                <Button
                  type="button"
                  variant="destructive"
                  size="scorer"
                  disabled={busyAction}
                  onClick={() => setConfirmFinishOpen(true)}
                  className="min-w-0 px-2 text-xs"
                >
                  <Flag className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {lang === 'ar' ? 'إنهاء' : 'Finish'}
                  </span>
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* DIALOGS: HISTORY, CONTACT, ABSENCE, LIFECYCLE, IMPACT PREVIEW       */}
      {/* =================================================================== */}
      {historyOpen && (
        <SessionHistoryDrawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          game={match}
          players={seatedPlayers}
          segments={allSegments}
          users={allUsers}
          scoreEvents={scoreEvents}
          absenceEvents={absenceEvents}
          absentPlayerIds={absentPlayerIds}
          buzzEvents={buzzEvents}
          useArabicIndicDigits={useArabicIndic}
          onChanged={loadConsoleState}
        />
      )}

      {/* Role-Gated Contact Dialog (automatically logs contact.viewed audit entry) */}
      <PlayerContactDialog
        open={Boolean(contactPlayer)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setContactPlayer(null);
        }}
        player={contactPlayer}
        actorUserId={user?.id}
        matchId={match.id}
        tableLabel={localizeText(lang, match.tableName, match.tableNameAr)}
      />

      {/* 1. Confirm Start Live Match */}
      <ConfirmDialog
        open={confirmStartOpen}
        onOpenChange={setConfirmStartOpen}
        title={lang === 'ar' ? 'بدء المباراة المباشرة؟' : 'Start Live Match?'}
        description={
          lang === 'ar'
            ? `سيتم تحويل "${localizeText(lang, match.tableName, match.tableNameAr)}" إلى حالة مباشر وتفعيل شاشة العرض وتسجيل النقاط والبطاقات.`
            : `This sets "${match.tableName}" to LIVE, initializes the timer at Segment 1, and syncs open Big Screen displays.`
        }
        confirmLabel={lang === 'ar' ? 'بدء المباراة الآن' : 'Start Live Now'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={handleStartMatch}
      />

      {/* 2. Confirm Mark Player Absent (with exact 1v1 walkover / void / Final explanation) */}
      <ConfirmDialog
        open={Boolean(pendingAbsentPlayer) && !pendingImpact}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPendingAbsentPlayer(null);
            setAbsenceReason('');
          }
        }}
        destructive
        title={
          pendingAbsentPlayer
            ? lang === 'ar'
              ? `تسجيل غياب ${pendingAbsentPlayer.fullNameAr}؟`
              : `Mark ${pendingAbsentPlayer.fullName} Absent?`
            : ''
        }
        description={
          pendingAbsentPlayer
            ? isFinalMatch
              ? lang === 'ar'
                ? 'في النهائي الكبير لا تُنهى المباراة تلقائياً بالغياب — سيتم تسجيل الغياب وإظهار تنبيه لمدير البطولة لاتخاذ القرار الرسمي.'
                : 'In the Grand Final, absence does not auto-end the match. It will record the absence and prompt a Super Admin decision.'
              : absentPlayerIds.length >= 1
                ? lang === 'ar'
                  ? 'المنافس مسجّل غائباً بالفعل! تسجيل هذا اللاعب غائباً أيضاً سيجعل المباراة ملغاة (Void) وبحاجة لقرار مدير البطولة.'
                  : 'The opponent is already absent! Marking this player absent too makes the match VOID and requires a Super Admin decision.'
                : match.type === 'group'
                  ? lang === 'ar'
                    ? 'في مباريات ١ ضد ١ تنتهي المباراة فوراً بفوز انسحابي للمنافس الحاضر ويحصل تلقائياً على +٣ نقاط في ترتيب المجموعة.'
                    : 'In 1v1 group matches, this ends the match immediately as a Walkover Win (+3 group points) for the present player.'
                  : lang === 'ar'
                    ? 'في مباريات الإقصاء ١ ضد ١ تنتهي المباراة فوراً بفوز انسحابي ويتأهل المنافس الحاضر تلقائياً للدور التالي.'
                    : 'In 1v1 knockout matches, this ends the match immediately as a Walkover Win and advances the present player automatically.'
            : ''
        }
        confirmLabel={lang === 'ar' ? 'تأكيد تسجيل الغياب' : 'Confirm Mark Absent'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={() => handleConfirmMarkAbsent()}
      >
        <div className="pt-1">
          <label
            htmlFor="absent-reason-input"
            className="mb-1 block text-xs font-bold text-ink"
          >
            {lang === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)'}
          </label>
          <Input
            id="absent-reason-input"
            type="text"
            maxLength={NOTE_MAX_LENGTH}
            value={absenceReason}
            onChange={(e) => setAbsenceReason(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'مثال: لم يحضر للطاولة بعد النداء'
                : 'e.g. No-show after final call'
            }
          />
        </div>
      </ConfirmDialog>

      {/* 3. Confirm Reverse Absence (Super Admin Only) */}
      <ConfirmDialog
        open={Boolean(pendingReverseAbsentPlayer) && !pendingImpact}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingReverseAbsentPlayer(null);
        }}
        title={lang === 'ar' ? 'إلغاء تسجيل الغياب؟' : 'Reverse Player Absence?'}
        description={
          pendingReverseAbsentPlayer
            ? lang === 'ar'
              ? `سيتم إلغاء غياب ${pendingReverseAbsentPlayer.fullNameAr} عبر حركة عكسية (دون حذف السجل) وإعادة حساب نتيجة المباراة والتأهل تلقائياً.`
              : `Reverse the absence of ${pendingReverseAbsentPlayer.fullName} (append-only) and recompute match status, group standings, and knockout slots.`
            : ''
        }
        confirmLabel={lang === 'ar' ? 'تأكيد إلغاء الغياب' : 'Reverse Absence'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={() => handleConfirmReverseAbsence()}
      />

      {/* 4. Confirm Finish Match (Blocks tie -> requires Tie-Breaker #16) */}
      <ConfirmDialog
        open={confirmFinishOpen}
        onOpenChange={setConfirmFinishOpen}
        destructive={!finishPreview.isTied}
        title={
          finishPreview.isTied
            ? lang === 'ar'
              ? 'النتيجة متعادلة — فتح جولة الحسم؟'
              : 'Scores Tied — Tie-Breaker Required'
            : lang === 'ar'
              ? 'إنهاء المباراة واعتماد الفائز؟'
              : 'Finish Match & Lock Official Winner?'
        }
        description={
          finishPreview.isTied
            ? lang === 'ar'
              ? `تعادل عند ${formatNumber(finishPreview.topScore, { useArabicIndicDigits: useArabicIndic })} نقطة بين: ${finishPreview.tiedPlayers
                  .map((p) => p.fullNameAr)
                  .join(' و ')}. لا يُسمح بالتعادل — بالتأكيد ستُفتح "جولة التحدي / الحسم (#١٦)" فوراً.`
              : `Scores are level at ${finishPreview.topScore} pts between ${finishPreview.tiedPlayers
                  .map((p) => p.fullName)
                  .join(' & ')}. Draws are not allowed — confirming opens Sudden-Death Tie-Breaker (#16, 30s) first.`
            : lang === 'ar'
              ? `الفائز (فوز عادي): ${finishPreview.leader?.fullNameAr ?? ''} (${formatNumber(finishPreview.topScore, { useArabicIndicDigits: useArabicIndic })} نقطة). سيتم إغلاق المباراة وتحديث الترتيب والشجرة تلقائياً.`
              : `Winner (Normal Win): ${finishPreview.leader?.fullName ?? ''} (${finishPreview.topScore} pts). Confirming locks this result and propagates standings & bracket slots automatically.`
        }
        confirmLabel={
          finishPreview.isTied
            ? lang === 'ar'
              ? 'فتح جولة الحسم (#١٦)'
              : 'Open Tie-Breaker (#16)'
            : lang === 'ar'
              ? 'اعتماد الفائز وإنهاء المباراة'
              : 'Confirm Winner & Finish'
        }
        cancelLabel={lang === 'ar' ? 'عودة للتحكيم' : 'Back to Console'}
        onConfirm={handleConfirmFinish}
      />

      {/* 5. Confirm Reopen Finished Match (Super Admin Only) */}
      <ConfirmDialog
        open={confirmReopenOpen && !pendingImpact}
        onOpenChange={setConfirmReopenOpen}
        destructive
        title={
          lang === 'ar'
            ? 'إعادة فتح المباراة المنتهية؟'
            : 'Reopen Finished Match?'
        }
        description={
          lang === 'ar'
            ? 'سيتم إرجاع المباراة إلى حالة "مباشر" وإعادة حساب التأهل تلقائياً (مع معاينة الأثر إذا بدأت مباريات تالية).'
            : 'Restores the match to LIVE status and recomputes downstream standings/slots (prompting Impact Preview if downstream matches started).'
        }
        confirmLabel={lang === 'ar' ? 'إعادة فتح المباراة' : 'Reopen Match'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={() => handleConfirmReopen()}
      />

      {/* 6. Confirm Reset Running Timer */}
      <ConfirmDialog
        open={confirmResetTimerOpen}
        onOpenChange={setConfirmResetTimerOpen}
        destructive
        title={lang === 'ar' ? 'إعادة ضبط المؤقت الجاري؟' : 'Reset Running Timer?'}
        description={
          lang === 'ar'
            ? 'المؤقت يعمل حالياً. هل تريد إيقافه وإعادته للوقت الكامل لهذه الفقرة؟'
            : 'The segment countdown is running. Resetting stops the clock and restores full segment time.'
        }
        confirmLabel={lang === 'ar' ? 'إعادة ضبط المؤقت' : 'Reset Timer'}
        cancelLabel={lang === 'ar' ? 'إبقاء العد' : 'Keep Running'}
        onConfirm={executeTimerReset}
      />

      {/* 7. Confirm Segment Jump */}
      <ConfirmDialog
        open={pendingSegmentIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingSegmentIndex(null);
        }}
        title={
          pendingSegmentIndex !== null &&
          pendingSegmentIndex < match.currentSegmentIndex
            ? lang === 'ar'
              ? 'العودة إلى الفقرة السابقة؟'
              : 'Go Back to Previous Segment?'
            : lang === 'ar'
              ? 'الانتقال للفقرة التالية أثناء تشغيل المؤقت؟'
              : 'Advance Segment While Timer Is Running?'
        }
        description={
          lang === 'ar'
            ? 'سيؤدي تغيير الفقرة إلى إيقاف المؤقت ومسح إشارة الجرس النشطة، مع الاحتفاظ بجميع النقاط والبطاقات.'
            : 'Switching segments resets the timer and clears the active buzz highlight. All points and cards stay intact.'
        }
        confirmLabel={lang === 'ar' ? 'تأكيد الانتقال' : 'Switch Segment'}
        cancelLabel={lang === 'ar' ? 'البقاء هنا' : 'Stay Here'}
        onConfirm={() => {
          if (pendingSegmentIndex !== null) {
            executeSegmentChange(pendingSegmentIndex);
          }
        }}
      />

      {/* 8. Shared Cascade Impact Preview Dialog */}
      <ImpactPreviewDialog
        open={Boolean(pendingImpact)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingImpact(null);
        }}
        impact={pendingImpact?.impact ?? null}
        busy={busyAction}
        onConfirm={async (policy) => {
          if (pendingImpact) {
            await pendingImpact.retry(policy);
          }
        }}
      />
    </div>
  );
}
