import type {
  AbsenceEvent,
  BuzzEvent,
  Match,
  MatchLifecycleEvent,
  MatchResult,
  MatchStatus,
  ScoreEvent,
} from '@/lib/schemas';
import type { ComputedMatchOutcome, ParticipantScoreSummary } from './types';

function compareByCreatedAtAsc(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return ta - tb;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Returns the set of ScoreEvent IDs that have been compensated by an active 'undo' event.
 */
export function getRevertedScoreEventIds(scoreEvents: ScoreEvent[]): Set<string> {
  const reverted = new Set<string>();
  for (const ev of scoreEvents) {
    if (ev.kind === 'undo' && ev.targetEventId) {
      reverted.add(ev.targetEventId);
    }
  }
  return reverted;
}

/**
 * Computes active score totals and card counts for a single match within its current replayEpoch.
 * Pure: derives everything strictly from the append-only ScoreEvent log.
 */
export function computeMatchScores(
  match: Match,
  allScoreEvents: ScoreEvent[]
): {
  totals: Record<string, number>;
  yellowCardsByPlayer: Record<string, number>;
  redCardsByPlayer: Record<string, number>;
  activeEvents: ScoreEvent[];
} {
  const epoch = match.replayEpoch ?? 0;
  const matchEvents = allScoreEvents.filter(
    (e) => e.matchId === match.id && (e.replayEpoch ?? 0) === epoch
  );
  const revertedIds = getRevertedScoreEventIds(matchEvents);

  const totals: Record<string, number> = {};
  const yellowCardsByPlayer: Record<string, number> = {};
  const redCardsByPlayer: Record<string, number> = {};

  for (const p of match.participants) {
    if (p.playerId) {
      totals[p.playerId] = 0;
      yellowCardsByPlayer[p.playerId] = 0;
      redCardsByPlayer[p.playerId] = 0;
    }
  }

  for (const ev of matchEvents) {
    totals[ev.playerId] = (totals[ev.playerId] ?? 0) + ev.delta;
    if (ev.kind === 'yellow' && !revertedIds.has(ev.id)) {
      yellowCardsByPlayer[ev.playerId] = (yellowCardsByPlayer[ev.playerId] ?? 0) + 1;
    } else if (ev.kind === 'red' && !revertedIds.has(ev.id)) {
      redCardsByPlayer[ev.playerId] = (redCardsByPlayer[ev.playerId] ?? 0) + 1;
    }
  }

  return {
    totals,
    yellowCardsByPlayer,
    redCardsByPlayer,
    activeEvents: matchEvents,
  };
}

/**
 * Replays chronological AbsenceEvents for a match (within current replayEpoch)
 * to determine which participants are currently marked absent.
 */
export function computeMatchAbsences(
  match: Match,
  allAbsenceEvents: AbsenceEvent[]
): Set<string> {
  const epoch = match.replayEpoch ?? 0;
  const relevant = allAbsenceEvents
    .filter((e) => e.matchId === match.id && (e.replayEpoch ?? 0) === epoch)
    .sort(compareByCreatedAtAsc);

  const absentSet = new Set<string>();
  for (const ev of relevant) {
    if (ev.action === 'marked') {
      absentSet.add(ev.playerId);
    } else if (ev.action === 'reversed') {
      absentSet.delete(ev.playerId);
    }
  }
  return absentSet;
}

/**
 * Derives the active buzzed player for a match's current segment from BuzzEvents + segment changes.
 */
export function computeActiveBuzz(
  match: Match,
  allBuzzEvents: BuzzEvent[],
  allMatchEvents: MatchLifecycleEvent[]
): string | null {
  const epoch = match.replayEpoch ?? 0;
  const currentSegId = match.segmentIds[match.currentSegmentIndex];
  const relevantBuzzes = allBuzzEvents
    .filter(
      (b) =>
        b.matchId === match.id &&
        (b.replayEpoch ?? 0) === epoch &&
        (!currentSegId || b.segmentId === currentSegId)
    )
    .sort(compareByCreatedAtAsc);

  if (relevantBuzzes.length === 0) return null;

  const latestBuzz = relevantBuzzes[relevantBuzzes.length - 1];
  if (latestBuzz.cleared) return null;

  // Check if a segmentChanged or finished or reopened event happened AFTER the latest buzz
  const latestBuzzTime = Date.parse(latestBuzz.createdAt);
  const invalidatedAfter = allMatchEvents.some(
    (me) =>
      me.matchId === match.id &&
      (me.replayEpoch ?? 0) === epoch &&
      (me.type === 'segmentChanged' ||
        me.type === 'finished' ||
        me.type === 'reopened' ||
        me.type === 'tieBreakerOpened') &&
      Date.parse(me.createdAt) >= latestBuzzTime
  );
  if (invalidatedAfter) return null;
  return latestBuzz.playerId;
}

/**
 * Core pure engine function: computes match status, winner/result, tie-aware standings,
 * card totals, absences, and tie-break requirement purely from append-only events.
 */
export function computeMatchResult(
  match: Match,
  allScoreEvents: ScoreEvent[],
  allAbsenceEvents: AbsenceEvent[],
  allMatchEvents: MatchLifecycleEvent[],
  allBuzzEvents: BuzzEvent[] = []
): ComputedMatchOutcome {
  const epoch = match.replayEpoch ?? 0;
  const { totals, yellowCardsByPlayer, redCardsByPlayer } = computeMatchScores(
    match,
    allScoreEvents
  );
  const absentSet = computeMatchAbsences(match, allAbsenceEvents);

  const lifecycleEvents = allMatchEvents
    .filter((e) => e.matchId === match.id && (e.replayEpoch ?? 0) === epoch)
    .sort(compareByCreatedAtAsc);

  const realParticipants = match.participants.filter((p) => !p.isBye && p.playerId);
  const byeParticipants = match.participants.filter((p) => p.isBye);

  // Build tie-aware standings (sorted by points DESC, then slotIndex ASC for deterministic ordering)
  const sortedRaw = realParticipants
    .map((p) => ({
      playerId: p.playerId as string,
      points: totals[p.playerId as string] ?? 0,
      yellowCards: yellowCardsByPlayer[p.playerId as string] ?? 0,
      redCards: redCardsByPlayer[p.playerId as string] ?? 0,
      absent: absentSet.has(p.playerId as string),
      guest: Boolean(p.guest),
      slotIndex: p.slotIndex,
    }))
    .sort((a, b) => b.points - a.points || a.slotIndex - b.slotIndex);

  const standings: ParticipantScoreSummary[] = sortedRaw.map((entry, idx, arr) => {
    const rank =
      idx > 0 && entry.points === arr[idx - 1].points
        ? (arr
            .slice(0, idx)
            .findIndex((prev) => prev.points === entry.points) + 1)
        : idx + 1;
    return {
      playerId: entry.playerId,
      points: entry.points,
      yellowCards: entry.yellowCards,
      redCards: entry.redCards,
      absent: entry.absent,
      guest: entry.guest,
      rank,
    };
  });

  // Track lifecycle timestamps & flags
  let startedAt: string | undefined;
  let finishedAt: string | undefined;
  let lifecycleState: 'scheduled' | 'live' | 'finished' = 'scheduled';
  let overrideResult: MatchResult | null = null;
  let needsReview = false;
  let needsReviewReason: string | undefined;

  for (const ev of lifecycleEvents) {
    switch (ev.type) {
      case 'started':
        if (!startedAt) startedAt = ev.createdAt;
        lifecycleState = 'live';
        overrideResult = null;
        break;
      case 'reopened':
        lifecycleState = 'live';
        finishedAt = undefined;
        overrideResult = null;
        needsReview = false;
        needsReviewReason = undefined;
        break;
      case 'tieBreakerOpened':
        lifecycleState = 'live';
        finishedAt = undefined;
        overrideResult = null;
        break;
      case 'finished':
        lifecycleState = 'finished';
        finishedAt = ev.createdAt;
        break;
      case 'overrideResult': {
        const resType = (ev.payload?.resultType as MatchResult['type']) ?? 'normal';
        const winnerId =
          typeof ev.payload?.winnerId === 'string' && ev.payload.winnerId.length > 0
            ? ev.payload.winnerId
            : undefined;
        overrideResult = {
          type: resType,
          winnerId,
          reason: 'override',
          overridden: true,
        };
        lifecycleState = 'finished';
        finishedAt = ev.createdAt;
        needsReview = false;
        needsReviewReason = undefined;
        break;
      }
      case 'markedNeedsReview':
        needsReview = true;
        needsReviewReason =
          ev.reason ??
          (typeof ev.payload?.reason === 'string' ? ev.payload.reason : 'Upstream result changed');
        break;
      case 'reviewResolved':
        needsReview = false;
        needsReviewReason = undefined;
        break;
      case 'invalidatedForReplay':
        lifecycleState = 'scheduled';
        startedAt = undefined;
        finishedAt = undefined;
        overrideResult = null;
        needsReview = false;
        needsReviewReason = undefined;
        break;
      default:
        break;
    }
  }

  const activeBuzzPlayerId =
    lifecycleState === 'live'
      ? computeActiveBuzz(match, allBuzzEvents, allMatchEvents)
      : null;

  // 1. Explicit Super Admin override always wins (until reopened / invalidated)
  if (overrideResult) {
    const status: MatchStatus = needsReview
      ? 'needsReview'
      : overrideResult.type === 'void'
        ? 'void'
        : 'finished';
    return {
      matchId: match.id,
      status,
      result: overrideResult,
      standings,
      totals,
      yellowCardsByPlayer,
      redCardsByPlayer,
      absentPlayerIds: Array.from(absentSet),
      tiedPlayerIds: [],
      requiresAdminDecision: overrideResult.type === 'void',
      activeBuzzPlayerId: null,
      startedAt,
      finishedAt,
      needsReviewReason,
    };
  }

  // 2. Explicit BYE node in Knockout (1 real player + 1 BYE slot)
  if (byeParticipants.length > 0 && realParticipants.length === 1) {
    const winnerId = realParticipants[0].playerId as string;
    return {
      matchId: match.id,
      status: needsReview ? 'needsReview' : 'finished',
      result: {
        type: 'walkover',
        winnerId,
        reason: 'bye',
      },
      standings,
      totals,
      yellowCardsByPlayer,
      redCardsByPlayer,
      absentPlayerIds: Array.from(absentSet),
      tiedPlayerIds: [],
      requiresAdminDecision: false,
      activeBuzzPlayerId: null,
      startedAt: startedAt ?? match.scheduledAt,
      finishedAt: finishedAt ?? match.scheduledAt,
      needsReviewReason,
    };
  }

  // 3. Absence handling (AGENTS.md §15.2)
  if (absentSet.size > 0 && realParticipants.length >= 2) {
    if (match.type === 'final') {
      // In the 1v1v1 Final with Marwan, marking a finalist absent does NOT auto-end the match:
      // prompt and let Super Admin decide.
      const nonGuestAbsent = realParticipants.some(
        (p) => !p.guest && p.playerId && absentSet.has(p.playerId)
      );
      if (nonGuestAbsent && lifecycleState !== 'finished') {
        return {
          matchId: match.id,
          status: needsReview ? 'needsReview' : lifecycleState,
          result: null,
          standings,
          totals,
          yellowCardsByPlayer,
          redCardsByPlayer,
          absentPlayerIds: Array.from(absentSet),
          tiedPlayerIds: [],
          requiresAdminDecision: true,
          activeBuzzPlayerId,
          startedAt,
          finishedAt,
          needsReviewReason,
        };
      }
    } else {
      // Standard 1v1 match (group or knockout)
      const present = realParticipants.filter(
        (p) => p.playerId && !absentSet.has(p.playerId)
      );
      if (present.length === 0) {
        // Both absent -> void, needs Super Admin decision
        return {
          matchId: match.id,
          status: needsReview ? 'needsReview' : 'void',
          result: {
            type: 'void',
            winnerId: undefined,
            reason: 'both_absent',
          },
          standings,
          totals,
          yellowCardsByPlayer,
          redCardsByPlayer,
          absentPlayerIds: Array.from(absentSet),
          tiedPlayerIds: [],
          requiresAdminDecision: true,
          activeBuzzPlayerId: null,
          startedAt,
          finishedAt: finishedAt ?? allAbsenceEvents.find((a) => a.matchId === match.id)?.createdAt,
          needsReviewReason,
        };
      }
      if (present.length === 1) {
        // One absent -> immediate walkover win for the present player
        const walkoverWinnerId = present[0].playerId as string;
        const latestAbsence = allAbsenceEvents
          .filter((a) => a.matchId === match.id && (a.replayEpoch ?? 0) === epoch)
          .sort(compareByCreatedAtAsc)
          .at(-1);
        return {
          matchId: match.id,
          status: needsReview ? 'needsReview' : 'finished',
          result: {
            type: 'walkover',
            winnerId: walkoverWinnerId,
            reason: 'absence',
          },
          standings,
          totals,
          yellowCardsByPlayer,
          redCardsByPlayer,
          absentPlayerIds: Array.from(absentSet),
          tiedPlayerIds: [],
          requiresAdminDecision: false,
          activeBuzzPlayerId: null,
          startedAt: startedAt ?? latestAbsence?.createdAt,
          finishedAt: finishedAt ?? latestAbsence?.createdAt,
          needsReviewReason,
        };
      }
    }
  }

  // 4. Cascade needsReview flag on live/finished downstream match
  if (needsReview) {
    return {
      matchId: match.id,
      status: 'needsReview',
      result: null,
      standings,
      totals,
      yellowCardsByPlayer,
      redCardsByPlayer,
      absentPlayerIds: Array.from(absentSet),
      tiedPlayerIds: [],
      requiresAdminDecision: true,
      activeBuzzPlayerId: null,
      startedAt,
      finishedAt,
      needsReviewReason,
    };
  }

  // 5. Normal finished match evaluation (recomputed live from ScoreEvents!)
  if (lifecycleState === 'finished') {
    if (standings.length === 0) {
      return {
        matchId: match.id,
        status: 'needsTieBreak',
        result: null,
        standings,
        totals,
        yellowCardsByPlayer,
        redCardsByPlayer,
        absentPlayerIds: Array.from(absentSet),
        tiedPlayerIds: [],
        requiresAdminDecision: false,
        activeBuzzPlayerId: null,
        startedAt,
        finishedAt: undefined,
      };
    }

    const topScore = standings[0].points;
    const leaders = standings.filter((s) => s.points === topScore);

    // Draws are NEVER allowed (AGENTS.md §15.1 & §15.4):
    // If a finished match becomes tied (e.g. after an admin revert!), it transitions to needsTieBreak with NO winner!
    if (leaders.length > 1) {
      return {
        matchId: match.id,
        status: 'needsTieBreak',
        result: null,
        standings,
        totals,
        yellowCardsByPlayer,
        redCardsByPlayer,
        absentPlayerIds: Array.from(absentSet),
        tiedPlayerIds: leaders.map((l) => l.playerId),
        requiresAdminDecision: false,
        activeBuzzPlayerId: null,
        startedAt,
        finishedAt: undefined,
      };
    }

    // Clear single leader -> winner is ALWAYS the highest-scoring participant!
    return {
      matchId: match.id,
      status: 'finished',
      result: {
        type: 'normal',
        winnerId: leaders[0].playerId,
        reason: 'score',
      },
      standings,
      totals,
      yellowCardsByPlayer,
      redCardsByPlayer,
      absentPlayerIds: Array.from(absentSet),
      tiedPlayerIds: [],
      requiresAdminDecision: false,
      activeBuzzPlayerId: null,
      startedAt,
      finishedAt,
    };
  }

  // 6. Live or Scheduled match
  return {
    matchId: match.id,
    status: lifecycleState,
    result: null,
    standings,
    totals,
    yellowCardsByPlayer,
    redCardsByPlayer,
    absentPlayerIds: Array.from(absentSet),
    tiedPlayerIds: [],
    requiresAdminDecision: false,
    activeBuzzPlayerId,
    startedAt,
    finishedAt: undefined,
  };
}
