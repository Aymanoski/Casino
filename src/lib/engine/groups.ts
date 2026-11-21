import type {
  AbsenceEvent,
  Group,
  Match,
  MatchLifecycleEvent,
  Player,
  ScoreEvent,
  TournamentSettings,
} from '@/lib/schemas';
import { computeMatchResult } from './match';
import type {
  ComputedGroupStandings,
  ComputedMatchOutcome,
  GroupStandingRow,
  GroupTieBreakReason,
  QualifierSlot,
} from './types';

function seededShuffle<T>(items: T[], seed = 2027): T[] {
  const arr = [...items];
  let state = seed >>> 0;
  const nextRand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Splits tournament players (excluding guests like Marwan) into numbered groups 1..N
 * of size `groupSize`. Handles non-exact remainders cleanly without creating 1-player groups.
 */
export function generateGroups(
  players: Player[],
  settings: TournamentSettings,
  options?: { shuffleSeed?: number; preserveOrder?: boolean; roundId?: string }
): Group[] {
  const eligible = players.filter((p) => !p.isGuest && !p.isHost);
  const limited = eligible.slice(0, Math.min(eligible.length, settings.totalPlayers));
  const ordered = options?.preserveOrder
    ? [...limited].sort((a, b) => a.seed - b.seed)
    : seededShuffle(limited, options?.shuffleSeed ?? 2027);

  const groupSize = Math.max(2, settings.groupSize);
  const roundId = options?.roundId ?? 'round-groups';

  if (ordered.length === 0) return [];
  if (ordered.length <= groupSize) {
    return [
      {
        id: 'group-1',
        number: 1,
        nameEn: 'Group 1',
        nameAr: 'المجموعة 1',
        roundId,
        playerIds: ordered.map((p) => p.id),
      },
    ];
  }

  // Chunk into groups of `groupSize`, avoiding a trailing 1-player orphan group
  const chunks: string[][] = [];
  for (let i = 0; i < ordered.length; i += groupSize) {
    chunks.push(ordered.slice(i, i + groupSize).map((p) => p.id));
  }
  if (chunks.length >= 2 && chunks[chunks.length - 1].length === 1) {
    const orphan = chunks.pop()![0];
    chunks[chunks.length - 1].push(orphan);
  }

  return chunks.map((playerIds, idx) => ({
    id: `group-${idx + 1}`,
    number: idx + 1,
    nameEn: `Group ${idx + 1}`,
    nameAr: `المجموعة ${idx + 1}`,
    roundId,
    playerIds,
  }));
}

/**
 * Generates all 1v1 round-robin pairs n(n-1)/2 for a group.
 * For group [A, B, C]: [A, B], [B, C], [A, C].
 */
export function generateGroupRoundRobinPairs(playerIds: string[]): Array<[string, string]> {
  const n = playerIds.length;
  if (n === 3) {
    return [
      [playerIds[0], playerIds[1]],
      [playerIds[1], playerIds[2]],
      [playerIds[0], playerIds[2]],
    ];
  }
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([playerIds[i], playerIds[j]]);
    }
  }
  return pairs;
}

/**
 * Pure group standings calculation strictly following AGENTS.md §15.1:
 * (1) Group points (win = pointsPerGroupWin, loss = 0)
 * (2) If EXACTLY TWO are tied on group points, head-to-head between them
 *     (A 3-way cycle skips rule 2 and goes straight to rule 3!)
 * (3) Total match points difference (pointsFor - pointsAgainst), then pointsFor
 * (4) Fewer red cards, then fewer yellow cards
 * (5) Admin-triggered group tie-break match (isGroupTieBreak: true)
 */
export function computeGroupStandings(
  group: Group,
  allMatches: Match[],
  scoreEvents: ScoreEvent[],
  absenceEvents: AbsenceEvent[],
  matchEvents: MatchLifecycleEvent[],
  settings: TournamentSettings,
  precomputedOutcomes?: Map<string, ComputedMatchOutcome>
): ComputedGroupStandings {
  const groupMatches = allMatches.filter(
    (m) => !m.isDemo && m.type === 'group' && m.groupId === group.id
  );
  const regularMatches = groupMatches.filter((m) => !m.isGroupTieBreak);
  const tieBreakMatches = groupMatches.filter((m) => m.isGroupTieBreak);

  const outcomeFor = (m: Match): ComputedMatchOutcome =>
    precomputedOutcomes?.get(m.id) ??
    computeMatchResult(m, scoreEvents, absenceEvents, matchEvents);

  const regularOutcomes = regularMatches.map((m) => ({
    match: m,
    outcome: outcomeFor(m),
  }));
  const tieBreakOutcomes = tieBreakMatches.map((m) => ({
    match: m,
    outcome: outcomeFor(m),
  }));

  // Track stats per player in the group
  interface MutableRow {
    playerId: string;
    matchesPlayed: number;
    wins: number;
    losses: number;
    groupPoints: number;
    pointsFor: number;
    pointsAgainst: number;
    pointsDiff: number;
    redCards: number;
    yellowCards: number;
    absences: number;
  }

  const rowMap = new Map<string, MutableRow>();
  for (const pid of group.playerIds) {
    rowMap.set(pid, {
      playerId: pid,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      groupPoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      redCards: 0,
      yellowCards: 0,
      absences: 0,
    });
  }

  // Head-to-head winners between pairs from finished regular matches: key "pA::pB" -> winnerId
  const h2hWinner = new Map<string, string>();
  const h2hKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

  let regularMatchesFinished = 0;

  for (const { match, outcome } of regularOutcomes) {
    const pids = match.participants
      .map((p) => p.playerId)
      .filter((pid): pid is string => Boolean(pid && rowMap.has(pid)));

    // Accumulate cards & absences from any played/finished/void group match
    for (const pid of pids) {
      const row = rowMap.get(pid)!;
      row.yellowCards += outcome.yellowCardsByPlayer[pid] ?? 0;
      row.redCards += outcome.redCardsByPlayer[pid] ?? 0;
      if (outcome.absentPlayerIds.includes(pid)) {
        row.absences += 1;
      }
    }

    if (outcome.status === 'finished' && outcome.result?.winnerId) {
      regularMatchesFinished++;
      const winnerId = outcome.result.winnerId;

      for (const pid of pids) {
        const row = rowMap.get(pid)!;
        row.matchesPlayed += 1;
        const myPts = outcome.totals[pid] ?? 0;
        const oppPts = pids
          .filter((id) => id !== pid)
          .reduce((sum, oppId) => sum + (outcome.totals[oppId] ?? 0), 0);
        row.pointsFor += myPts;
        row.pointsAgainst += oppPts;
        row.pointsDiff = row.pointsFor - row.pointsAgainst;

        if (pid === winnerId) {
          row.wins += 1;
          row.groupPoints += settings.pointsPerGroupWin;
        } else {
          row.losses += 1;
        }
      }

      if (pids.length === 2) {
        h2hWinner.set(h2hKey(pids[0], pids[1]), winnerId);
      }
    }
  }

  // Tie-break match head-to-head override map (rule 5)
  const tieBreakWins = new Map<string, number>();
  for (const { outcome } of tieBreakOutcomes) {
    if (outcome.status === 'finished' && outcome.result?.winnerId) {
      const wid = outcome.result.winnerId;
      tieBreakWins.set(wid, (tieBreakWins.get(wid) ?? 0) + 1);
    }
  }

  // Partition and sort recursively by tie-break criteria
  const allRows = Array.from(rowMap.values());

  // Helper to compare two rows on rules 3, 4, 5 strictly per AGENTS.md §15.1
  function compareRules3to5(a: MutableRow, b: MutableRow): number {
    // Rule 3: match points difference (pointsFor - pointsAgainst) DESC
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    // Rule 4: fewer red cards ASC, then fewer yellow cards ASC
    if (a.redCards !== b.redCards) return a.redCards - b.redCards;
    if (a.yellowCards !== b.yellowCards) return a.yellowCards - b.yellowCards;
    // Rule 5: group tie-break match wins DESC
    const tbA = tieBreakWins.get(a.playerId) ?? 0;
    const tbB = tieBreakWins.get(b.playerId) ?? 0;
    if (tbB !== tbA) return tbB - tbA;
    return 0;
  }

  // Group by rule 1 (groupPoints DESC)
  const byGroupPoints = new Map<number, MutableRow[]>();
  for (const row of allRows) {
    const bucket = byGroupPoints.get(row.groupPoints) ?? [];
    bucket.push(row);
    byGroupPoints.set(row.groupPoints, bucket);
  }
  const sortedPointValues = Array.from(byGroupPoints.keys()).sort((a, b) => b - a);

  const rankedBuckets: MutableRow[][] = [];
  let appliedReason: GroupTieBreakReason = 'points';
  let hasThreeWayCycle = false;

  for (const pts of sortedPointValues) {
    const bucket = byGroupPoints.get(pts)!;
    if (bucket.length === 1) {
      rankedBuckets.push(bucket);
      continue;
    }

    // Rule 2: Head-to-head ONLY if EXACTLY TWO players are tied on group points
    if (bucket.length === 2) {
      const [a, b] = bucket;
      const winner = h2hWinner.get(h2hKey(a.playerId, b.playerId));
      if (winner === a.playerId) {
        if (appliedReason === 'points') appliedReason = 'h2h';
        rankedBuckets.push([a], [b]);
        continue;
      }
      if (winner === b.playerId) {
        if (appliedReason === 'points') appliedReason = 'h2h';
        rankedBuckets.push([b], [a]);
        continue;
      }
    }

    if (bucket.length >= 3 && pts > 0) {
      hasThreeWayCycle = true;
    }

    // Otherwise (3+ way tie / cycle, or unplayed H2H): apply Rules 3 -> 4 -> 5
    const sorted = [...bucket].sort((a, b) => {
      const cmp = compareRules3to5(a, b);
      if (cmp !== 0) return cmp;
      return group.playerIds.indexOf(a.playerId) - group.playerIds.indexOf(b.playerId);
    });

    // Record which tie-break tier separated adjacent rows in this tied bucket
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.pointsDiff !== curr.pointsDiff) {
        if (appliedReason === 'points' || appliedReason === 'h2h') {
          appliedReason = 'pointsDiff';
        }
      } else if (prev.redCards !== curr.redCards || prev.yellowCards !== curr.yellowCards) {
        if (appliedReason !== 'tieBreakMatch') {
          appliedReason = 'cards';
        }
      } else if ((tieBreakWins.get(prev.playerId) ?? 0) !== (tieBreakWins.get(curr.playerId) ?? 0)) {
        appliedReason = 'tieBreakMatch';
      }
    }

    // Sub-group identical ties (where compareRules3to5 === 0) so we detect deadlocks accurately
    let curGroup: MutableRow[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (compareRules3to5(curGroup[0], sorted[i]) === 0) {
        curGroup.push(sorted[i]);
      } else {
        rankedBuckets.push(curGroup);
        curGroup = [sorted[i]];
      }
    }
    rankedBuckets.push(curGroup);
  }

  // Assign competition ranks and detect whether a deadlock crosses the qualification cutoff
  const advanceCount = Math.min(settings.advancePerGroup, group.playerIds.length);
  const allRegularDone =
    regularMatches.length > 0 && regularMatchesFinished === regularMatches.length;
  const anyTieBreakPending = tieBreakOutcomes.some(
    ({ outcome }) => outcome.status !== 'finished'
  );

  let needsTieBreakMatch = false;
  const tiedCutoffPlayerIds: string[] = [];

  const finalRows: GroupStandingRow[] = [];
  let currentRank = 1;

  for (const tiedSlice of rankedBuckets) {
    const sliceStart = currentRank;
    const sliceEnd = currentRank + tiedSlice.length - 1;
    const crossesCutoff =
      tiedSlice.length > 1 && sliceStart <= advanceCount && sliceEnd > advanceCount;

    if (crossesCutoff && allRegularDone) {
      needsTieBreakMatch = true;
      appliedReason = 'deadlock';
      for (const r of tiedSlice) {
        tiedCutoffPlayerIds.push(r.playerId);
      }
    }

    for (const r of tiedSlice) {
      finalRows.push({
        ...r,
        rank: sliceStart,
        qualified: false,
        tiedForCutoff: crossesCutoff && allRegularDone,
        tieBreakReason: crossesCutoff && allRegularDone ? 'deadlock' : appliedReason,
      });
    }
    currentRank += tiedSlice.length;
  }

  const isComplete =
    allRegularDone && !needsTieBreakMatch && !anyTieBreakPending;

  const qualifierPlayerIds: string[] = [];
  if (isComplete) {
    for (let i = 0; i < advanceCount && i < finalRows.length; i++) {
      finalRows[i].qualified = true;
      qualifierPlayerIds.push(finalRows[i].playerId);
    }
  }

  return {
    groupId: group.id,
    groupNumber: group.number,
    isComplete,
    regularMatchesTotal: regularMatches.length,
    regularMatchesFinished,
    rows: finalRows,
    qualifierPlayerIds,
    needsTieBreakMatch,
    tiedCutoffPlayerIds,
    tieBreakApplied: appliedReason,
    hasThreeWayCycle,
  };
}

/**
 * Computes ordered qualifier slots across all groups (ordered by group.number ASC).
 * Completed groups expose real playerIds; incomplete or tied groups expose TBD slots.
 */
export function computeQualifiers(
  groups: Group[],
  matches: Match[],
  scoreEvents: ScoreEvent[],
  absenceEvents: AbsenceEvent[],
  matchEvents: MatchLifecycleEvent[],
  settings: TournamentSettings,
  precomputedStandings?: Map<string, ComputedGroupStandings>,
  precomputedOutcomes?: Map<string, ComputedMatchOutcome>
): {
  qualifiers: QualifierSlot[];
  groupStandings: Map<string, ComputedGroupStandings>;
} {
  const sortedGroups = [...groups].sort((a, b) => a.number - b.number);
  const standingsMap =
    precomputedStandings ?? new Map<string, ComputedGroupStandings>();

  // Index group matches once in O(M) instead of O(G * M)
  const matchesByGroup = new Map<string, Match[]>();
  for (const m of matches) {
    if (!m.isDemo && m.type === 'group' && m.groupId) {
      const list = matchesByGroup.get(m.groupId) ?? [];
      list.push(m);
      matchesByGroup.set(m.groupId, list);
    }
  }

  const qualifiers: QualifierSlot[] = [];

  for (const group of sortedGroups) {
    let gs = standingsMap.get(group.id);
    if (!gs) {
      gs = computeGroupStandings(
        group,
        matchesByGroup.get(group.id) ?? [],
        scoreEvents,
        absenceEvents,
        matchEvents,
        settings,
        precomputedOutcomes
      );
      standingsMap.set(group.id, gs);
    }

    const advanceCount = Math.min(settings.advancePerGroup, group.playerIds.length);
    for (let r = 1; r <= advanceCount; r++) {
      const qualifiedRow = gs.isComplete ? gs.rows[r - 1] : undefined;
      const rankPrefixEn = r === 1 ? 'Winner' : `#${r}`;
      const rankPrefixAr = r === 1 ? 'متأهل' : `المركز ${r}`;
      qualifiers.push({
        groupId: group.id,
        groupNumber: group.number,
        groupRank: r,
        playerId: qualifiedRow ? qualifiedRow.playerId : null,
        groupPoints: qualifiedRow?.groupPoints ?? 0,
        pointsDiff: qualifiedRow?.pointsDiff ?? 0,
        pointsFor: qualifiedRow?.pointsFor ?? 0,
        redCards: qualifiedRow?.redCards ?? 0,
        yellowCards: qualifiedRow?.yellowCards ?? 0,
        placeholderLabelEn: `${rankPrefixEn} of Group ${group.number}`,
        placeholderLabelAr: `${rankPrefixAr} المجموعة ${group.number}`,
      });
    }
  }

  return { qualifiers, groupStandings: standingsMap };
}
