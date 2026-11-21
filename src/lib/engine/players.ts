import type {
  AbsenceEvent,
  CheckInEvent,
  Match,
  Player,
  PlayerStats,
  PlayerStatus,
  ScoreEvent,
} from '@/lib/schemas';
import { getRevertedScoreEventIds } from './match';
import type {
  ComputedGroupStandings,
  ComputedMatchOutcome,
  LeaderboardRow,
} from './types';

function compareByCreatedAtAsc(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string }
): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return ta - tb;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Derives a player's tournament status purely from check-in events,
 * match participation, match outcomes, and group standings.
 * NEVER trusts a stored status field.
 */
export function computePlayerStatus(
  player: Player,
  checkInEvents: CheckInEvent[],
  matches: Match[],
  matchOutcomes: Map<string, ComputedMatchOutcome>,
  groupStandings: Map<string, ComputedGroupStandings>
): PlayerStatus {
  // Guest participant (Marwan Serry) is always seated as the Finalist Host
  if (player.isGuest || player.isHost) {
    return 'finalist';
  }

  const tournamentMatches = matches.filter((m) => !m.isDemo);
  const myMatches = tournamentMatches.filter((m) =>
    m.participants.some((p) => p.playerId === player.id)
  );

  // 1. Seated in the Grand Final?
  const inFinal = myMatches.some((m) => m.type === 'final' || m.isFinal);
  if (inFinal) {
    return 'finalist';
  }

  // 2. Currently in a live or tie-break match?
  const inLiveMatch = myMatches.some((m) => {
    const out = matchOutcomes.get(m.id);
    const st = out?.status ?? m.status;
    return st === 'live' || st === 'needsTieBreak';
  });
  if (inLiveMatch) {
    return 'active';
  }

  // 3. Lost a finished knockout match -> eliminated
  const lostKnockout = myMatches.some((m) => {
    if (m.type !== 'knockout') return false;
    const out = matchOutcomes.get(m.id);
    return (
      out?.status === 'finished' &&
      Boolean(out.result?.winnerId) &&
      out.result?.winnerId !== player.id
    );
  });
  if (lostKnockout) {
    return 'eliminated';
  }

  // 4. Group complete and did NOT qualify -> eliminated
  for (const gs of groupStandings.values()) {
    const row = gs.rows.find((r) => r.playerId === player.id);
    if (row) {
      if (gs.isComplete && !row.qualified) {
        return 'eliminated';
      }
      if (gs.isComplete && row.qualified) {
        return 'active';
      }
      if (row.matchesPlayed > 0) {
        return 'active';
      }
    }
  }

  // 5. Won any finished match -> active
  const playedAnyFinished = myMatches.some((m) => {
    const out = matchOutcomes.get(m.id);
    return out?.status === 'finished' && out.result?.reason !== 'bye';
  });
  if (playedAnyFinished) {
    return 'active';
  }

  // 6. Fallback to latest CheckInEvent ('registered' | 'checkedIn' | 'absent')
  const myCheckIns = checkInEvents
    .filter((e) => e.playerId === player.id)
    .sort(compareByCreatedAtAsc);
  if (myCheckIns.length > 0) {
    return myCheckIns[myCheckIns.length - 1].status;
  }

  return 'registered';
}

/**
 * Computes full player stats strictly from the append-only event log & derived outcomes.
 * Marwan Serry (isGuest) is excluded from tournament stats (zeros) per AGENTS.md §15.1.
 */
export function computeAllPlayerStats(
  players: Player[],
  matches: Match[],
  matchOutcomes: Map<string, ComputedMatchOutcome>,
  groupStandings: Map<string, ComputedGroupStandings>,
  scoreEvents: ScoreEvent[],
  absenceEvents: AbsenceEvent[]
): Map<string, PlayerStats> {
  const statsMap = new Map<string, PlayerStats>();
  const emptyStats = (): PlayerStats => ({
    matchesPlayed: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    totalPoints: 0,
    groupPoints: 0,
    yellowCards: 0,
    redCards: 0,
    absences: 0,
  });

  const tournamentMatches = matches.filter((m) => !m.isDemo);
  const matchById = new Map(tournamentMatches.map((m) => [m.id, m]));
  const guestIds = new Set(
    players.filter((p) => p.isGuest || p.isHost).map((p) => p.id)
  );

  for (const p of players) {
    statsMap.set(p.id, emptyStats());
  }

  // 1. Score points & card counts from active ScoreEvents across non-demo matches
  const activeEpochEvents = scoreEvents.filter((ev) => {
    const m = matchById.get(ev.matchId);
    if (!m) return false;
    return (ev.replayEpoch ?? 0) === (m.replayEpoch ?? 0);
  });
  const revertedIds = getRevertedScoreEventIds(activeEpochEvents);

  for (const ev of activeEpochEvents) {
    if (guestIds.has(ev.playerId)) continue;
    const s = statsMap.get(ev.playerId);
    if (!s) continue;
    s.totalPoints += ev.delta;
    if (ev.kind === 'yellow' && !revertedIds.has(ev.id)) {
      s.yellowCards += 1;
    } else if (ev.kind === 'red' && !revertedIds.has(ev.id)) {
      s.redCards += 1;
    }
  }

  // 2. Match wins, losses, matchesPlayed & absences from computed outcomes
  for (const m of tournamentMatches) {
    const outcome = matchOutcomes.get(m.id);
    if (!outcome) continue;

    // Count active absences in this match
    for (const absentPid of outcome.absentPlayerIds) {
      if (guestIds.has(absentPid)) continue;
      const s = statsMap.get(absentPid);
      if (s) s.absences += 1;
    }

    // BYE walkovers do not inflate matchesPlayed (they are bracket advancement slots)
    const isByeAuto = outcome.result?.reason === 'bye';
    if (isByeAuto) continue;

    const realPids = m.participants
      .map((p) => p.playerId)
      .filter((pid): pid is string => Boolean(pid && !guestIds.has(pid)));

    if (
      outcome.status === 'finished' ||
      outcome.status === 'live' ||
      outcome.status === 'needsTieBreak'
    ) {
      for (const pid of realPids) {
        const s = statsMap.get(pid);
        if (!s) continue;
        s.matchesPlayed += 1;
        s.gamesPlayed = s.matchesPlayed;
        if (outcome.status === 'finished' && outcome.result?.winnerId) {
          if (outcome.result.winnerId === pid) {
            s.wins += 1;
          } else {
            s.losses += 1;
          }
        }
      }
    }
  }

  // 3. Group points from derived group standings
  for (const gs of groupStandings.values()) {
    for (const row of gs.rows) {
      if (guestIds.has(row.playerId)) continue;
      const s = statsMap.get(row.playerId);
      if (s) s.groupPoints += row.groupPoints;
    }
  }

  // Suppress unused warning when absenceEvents passed for signature symmetry
  void absenceEvents;

  return statsMap;
}

/**
 * Pure leaderboard derivation — ALWAYS excludes guest participants (Marwan Serry)
 * per AGENTS.md §15.1.
 */
export function computeLeaderboard(
  players: Player[],
  matches: Match[],
  matchOutcomes: Map<string, ComputedMatchOutcome>,
  groupStandings: Map<string, ComputedGroupStandings>,
  scoreEvents: ScoreEvent[],
  absenceEvents: AbsenceEvent[],
  options?: { roundId?: string }
): LeaderboardRow[] {
  const nonGuestPlayers = players.filter((p) => !p.isGuest && !p.isHost);

  const scopedMatches = options?.roundId
    ? matches.filter((m) => !m.isDemo && m.roundId === options.roundId)
    : matches.filter((m) => !m.isDemo);

  const statsMap = computeAllPlayerStats(
    nonGuestPlayers,
    scopedMatches,
    matchOutcomes,
    options?.roundId
      ? new Map(
          Array.from(groupStandings.entries()).filter(
            ([, gs]) =>
              scopedMatches.some((m) => m.groupId === gs.groupId)
          )
        )
      : groupStandings,
    scoreEvents,
    absenceEvents
  );

  const rows: LeaderboardRow[] = nonGuestPlayers.map((player) => {
    const s = statsMap.get(player.id) ?? {
      matchesPlayed: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
      groupPoints: 0,
      yellowCards: 0,
      redCards: 0,
      absences: 0,
    };
    return {
      rank: 0,
      player,
      totalPoints: s.totalPoints,
      matchesPlayed: s.matchesPlayed,
      gamesPlayed: s.matchesPlayed,
      wins: s.wins,
      losses: s.losses,
      groupPoints: s.groupPoints,
      yellowCards: s.yellowCards,
      redCards: s.redCards,
      absences: s.absences,
    };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
    if (a.redCards !== b.redCards) return a.redCards - b.redCards;
    if (a.yellowCards !== b.yellowCards) return a.yellowCards - b.yellowCards;
    return a.player.seed - b.player.seed;
  });

  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}
