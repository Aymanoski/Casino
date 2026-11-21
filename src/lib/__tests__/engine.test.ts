import { describe, it, expect } from 'vitest';
import {
  MARWAN_PLAYER_ID,
  type AbsenceEvent,
  type Match,
  type MatchLifecycleEvent,
  type ScoreEvent,
  type TournamentSettings,
} from '@/lib/schemas';
import {
  autoScheduleMatches,
  checkInvariants,
  computeGroupStandings,
  computeLeaderboard,
  computeMatchResult,
  computeQualifiers,
  generateGroupRoundRobinPairs,
  generateGroups,
  generateKnockout,
  propagateWinners,
  resolveByes,
} from '@/lib/engine';
import {
  createDefaultUsers,
  createSeedSnapshot,
  generateProceduralPlayers,
} from '@/lib/seed';

const DEFAULT_SETTINGS: TournamentSettings = {
  totalPlayers: 12,
  groupSize: 3,
  advancePerGroup: 1,
  pointsPerGroupWin: 3,
  tablesCount: 4,
  slotMinutes: 30,
  includeFinalWithMarwan: true,
};

function make1v1Match(id: string, pA: string, pB: string, groupId?: string): Match {
  return {
    id,
    type: groupId ? 'group' : 'knockout',
    groupId,
    roundId: groupId ? 'round-groups' : 'round-ko',
    round: groupId ? 1 : 2,
    slot: 1,
    isGroupTieBreak: false,
    participants: [
      { slotIndex: 0, playerId: pA, feeder: { kind: 'fixed', playerId: pA } },
      { slotIndex: 1, playerId: pB, feeder: { kind: 'fixed', playerId: pB } },
    ],
    playerIds: [pA, pB],
    tableNumber: 1,
    tableName: `Match ${id}`,
    tableNameAr: `مباراة ${id}`,
    scheduledAt: '2027-03-05T19:00:00.000Z',
    judgeUserId: 'user-scorer-1',
    scorerUserId: 'user-scorer-1',
    segmentIds: ['seg-1', 'seg-3'],
    currentSegmentIndex: 0,
    status: 'scheduled',
    result: null,
    isFinal: false,
    isDemo: false,
    replayEpoch: 0,
    version: 1,
  };
}

let seq = 1;
const iso = () => new Date(Date.parse('2027-03-05T19:00:00.000Z') + seq++ * 1000).toISOString();

function scoreEv(
  matchId: string,
  playerId: string,
  delta: number,
  kind: ScoreEvent['kind'] = 'point',
  targetEventId?: string
): ScoreEvent {
  return {
    id: `se-${seq}`,
    matchId,
    gameId: matchId,
    segmentId: 'seg-1',
    playerId,
    delta,
    kind,
    targetEventId,
    byUserId: 'user-scorer-1',
    replayEpoch: 0,
    createdAt: iso(),
  };
}

function lifecycleEv(
  matchId: string,
  type: MatchLifecycleEvent['type'],
  payload?: Record<string, unknown>
): MatchLifecycleEvent {
  return {
    id: `me-${seq}`,
    matchId,
    type,
    byUserId: 'user-scorer-1',
    payload,
    replayEpoch: 0,
    createdAt: iso(),
  };
}

function absenceEv(
  matchId: string,
  playerId: string,
  action: AbsenceEvent['action']
): AbsenceEvent {
  return {
    id: `abs-${seq}`,
    matchId,
    playerId,
    action,
    byUserId: 'user-scorer-1',
    replayEpoch: 0,
    createdAt: iso(),
  };
}

describe('Pure Engine (/lib/engine)', () => {
  it('enforces no draws: tied finish transitions to needsTieBreak with null result, resolved when tie-break scored', () => {
    const m = make1v1Match('m-tie', 'player-1', 'player-2', 'group-1');
    const scoreEvents = [
      scoreEv(m.id, 'player-1', 1),
      scoreEv(m.id, 'player-2', 1),
    ];
    const matchEvents = [lifecycleEv(m.id, 'started'), lifecycleEv(m.id, 'finished')];

    const tiedOutcome = computeMatchResult(m, scoreEvents, [], matchEvents);
    expect(tiedOutcome.status).toBe('needsTieBreak');
    expect(tiedOutcome.result).toBeNull();
    expect(tiedOutcome.tiedPlayerIds).toEqual(['player-1', 'player-2']);

    // Score sudden-death point for player-2 -> now finished with player-2 as winner!
    const brokenOutcome = computeMatchResult(
      m,
      [...scoreEvents, scoreEv(m.id, 'player-2', 1)],
      [],
      [...matchEvents, lifecycleEv(m.id, 'tieBreakerOpened'), lifecycleEv(m.id, 'finished')]
    );
    expect(brokenOutcome.status).toBe('finished');
    expect(brokenOutcome.result).toEqual({
      type: 'normal',
      winnerId: 'player-2',
      reason: 'score',
    });
  });

  it('handles walkover (one absent), void (both absent), and absence reversal cleanly', () => {
    const m = make1v1Match('m-abs', 'player-1', 'player-2', 'group-1');

    // One absent -> immediate walkover for player-2
    const abs1 = absenceEv(m.id, 'player-1', 'marked');
    const walkover = computeMatchResult(m, [], [abs1], []);
    expect(walkover.status).toBe('finished');
    expect(walkover.result).toEqual({
      type: 'walkover',
      winnerId: 'player-2',
      reason: 'absence',
    });

    // Both absent -> void + requiresAdminDecision
    const abs2 = absenceEv(m.id, 'player-2', 'marked');
    const bothAbsent = computeMatchResult(m, [], [abs1, abs2], []);
    expect(bothAbsent.status).toBe('void');
    expect(bothAbsent.result?.type).toBe('void');
    expect(bothAbsent.result?.winnerId).toBeUndefined();
    expect(bothAbsent.requiresAdminDecision).toBe(true);

    // Reverse both absences -> returns to scheduled with no result
    const rev1 = absenceEv(m.id, 'player-1', 'reversed');
    const rev2 = absenceEv(m.id, 'player-2', 'reversed');
    const restored = computeMatchResult(m, [], [abs1, abs2, rev1, rev2], []);
    expect(restored.status).toBe('scheduled');
    expect(restored.result).toBeNull();
    expect(restored.absentPlayerIds).toEqual([]);
  });

  it('tracks Yellow (-1) and Red (-2) cards separately from points and decrements card counts when undone', () => {
    const m = make1v1Match('m-cards', 'player-1', 'player-2', 'group-1');
    const p1Pt1 = scoreEv(m.id, 'player-1', 1, 'point');
    const p1Pt2 = scoreEv(m.id, 'player-1', 1, 'point');
    const p1Pt3 = scoreEv(m.id, 'player-1', 1, 'point');
    const p1Yel = scoreEv(m.id, 'player-1', -1, 'yellow');
    const p2Red = scoreEv(m.id, 'player-2', -2, 'red');
    const p2Pt1 = scoreEv(m.id, 'player-2', 1, 'point');

    const res1 = computeMatchResult(
      m,
      [p1Pt1, p1Pt2, p1Pt3, p1Yel, p2Red, p2Pt1],
      [],
      [lifecycleEv(m.id, 'started')]
    );
    expect(res1.totals['player-1']).toBe(2); // 3 - 1
    expect(res1.totals['player-2']).toBe(-1); // 1 - 2
    expect(res1.yellowCardsByPlayer['player-1']).toBe(1);
    expect(res1.redCardsByPlayer['player-2']).toBe(1);

    // Undo player-1's yellow card -> score becomes 3 AND yellow card count returns to 0!
    const undoYel = scoreEv(m.id, 'player-1', 1, 'undo', p1Yel.id);
    const res2 = computeMatchResult(
      m,
      [p1Pt1, p1Pt2, p1Pt3, p1Yel, p2Red, p2Pt1, undoYel],
      [],
      [lifecycleEv(m.id, 'started')]
    );
    expect(res2.totals['player-1']).toBe(3);
    expect(res2.yellowCardsByPlayer['player-1']).toBe(0);
    expect(res2.redCardsByPlayer['player-2']).toBe(1);
  });

  it('resolves a 3-way group cycle via points diff and card tie-breakers (skipping H2H)', () => {
    const group = {
      id: 'group-cycle',
      number: 1,
      nameEn: 'Group 1',
      nameAr: 'المجموعة 1',
      roundId: 'round-groups',
      playerIds: ['player-1', 'player-2', 'player-3'],
    };

    const mAB = make1v1Match('m-ab', 'player-1', 'player-2', group.id);
    const mBC = make1v1Match('m-bc', 'player-2', 'player-3', group.id);
    const mAC = make1v1Match('m-ac', 'player-1', 'player-3', group.id);

    // Cycle: A beats B (4-1 -> A +3, B -3), B beats C (3-1 -> B +2, C -2), C beats A (2-1 -> C +1, A -1)
    // All 3 have 3 group points! Final diffs: A = +2, B = -1, C = -1.
    // Give B 1 red card and C 1 yellow card -> C beats B on fewer red cards!
    const scores: ScoreEvent[] = [
      // A vs B: A=4, B=1 (with 1 red card included: B scored 3 pts - 2 red = 1)
      scoreEv(mAB.id, 'player-1', 1),
      scoreEv(mAB.id, 'player-1', 1),
      scoreEv(mAB.id, 'player-1', 1),
      scoreEv(mAB.id, 'player-1', 1),
      scoreEv(mAB.id, 'player-2', 1),
      scoreEv(mAB.id, 'player-2', 1),
      scoreEv(mAB.id, 'player-2', 1),
      scoreEv(mAB.id, 'player-2', -2, 'red'),
      // B vs C: B=3, C=1 (C scored 2 pts - 1 yellow = 1)
      scoreEv(mBC.id, 'player-2', 1),
      scoreEv(mBC.id, 'player-2', 1),
      scoreEv(mBC.id, 'player-2', 1),
      scoreEv(mBC.id, 'player-3', 1),
      scoreEv(mBC.id, 'player-3', 1),
      scoreEv(mBC.id, 'player-3', -1, 'yellow'),
      // A vs C: C=2, A=1
      scoreEv(mAC.id, 'player-3', 1),
      scoreEv(mAC.id, 'player-3', 1),
      scoreEv(mAC.id, 'player-1', 1),
    ];
    const events: MatchLifecycleEvent[] = [
      lifecycleEv(mAB.id, 'started'),
      lifecycleEv(mAB.id, 'finished'),
      lifecycleEv(mBC.id, 'started'),
      lifecycleEv(mBC.id, 'finished'),
      lifecycleEv(mAC.id, 'started'),
      lifecycleEv(mAC.id, 'finished'),
    ];

    const gs = computeGroupStandings(
      group,
      [mAB, mBC, mAC],
      scores,
      [],
      events,
      DEFAULT_SETTINGS
    );

    expect(gs.isComplete).toBe(true);
    expect(gs.needsTieBreakMatch).toBe(false);
    expect(gs.rows.map((r) => r.playerId)).toEqual(['player-1', 'player-3', 'player-2']);
    expect(gs.rows[0].groupPoints).toBe(3);
    expect(gs.rows[0].pointsDiff).toBe(2);
    expect(gs.rows[1].redCards).toBe(0);
    expect(gs.rows[2].redCards).toBe(1);
    expect(gs.qualifierPlayerIds).toEqual(['player-1']);
  });

  it('handles odd group counts & BYEs: 3 groups -> 4-slot bracket with 1 BYE given to best group winner', () => {
    const settings: TournamentSettings = {
      totalPlayers: 9,
      groupSize: 3,
      advancePerGroup: 1,
      pointsPerGroupWin: 3,
      tablesCount: 3,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
    };
    const seed = createSeedSnapshot({ ...settings, includeDemoProgress: false });
    expect(seed.groups.length).toBe(3);

    // Finish all 9 group matches so:
    // Group 1 winner has 6 pts (+4 diff)
    // Group 2 winner has 6 pts (+10 diff) -> BEST GROUP WINNER -> MUST GET THE BYE!
    // Group 3 winner has 6 pts (+2 diff)
    const scores: ScoreEvent[] = [];
    const matchEvs: MatchLifecycleEvent[] = [];

    const groupDominator = new Map<string, string>();
    const groupBonus = new Map<string, number>([
      ['group-1', 3],
      ['group-2', 6],
      ['group-3', 2],
    ]);

    for (const g of seed.groups) {
      groupDominator.set(g.id, g.playerIds[0]);
      const gMatches = seed.matches.filter((m) => m.groupId === g.id);
      for (const m of gMatches) {
        const p0 = m.participants[0].playerId!;
        const p1 = m.participants[1].playerId!;
        const dom = g.playerIds[0];
        const winner = p0 === dom || p1 === dom ? dom : p0;
        const pts = winner === dom ? groupBonus.get(g.id)! : 2;
        matchEvs.push(lifecycleEv(m.id, 'started'));
        for (let k = 0; k < pts; k++) {
          scores.push(scoreEv(m.id, winner, 1));
        }
        matchEvs.push(lifecycleEv(m.id, 'finished'));
      }
    }

    const prop = propagateWinners({
      players: seed.players,
      groups: seed.groups,
      rounds: seed.rounds,
      matches: seed.matches,
      scoreEvents: scores,
      absenceEvents: [],
      buzzEvents: [],
      matchEvents: matchEvs,
      checkInEvents: [],
      settings,
    });

    expect(prop.byeAllocation.bracketSize).toBe(4);
    expect(prop.byeAllocation.byesCount).toBe(1);
    expect(prop.byeAllocation.byeRecipients[0].playerId).toBe(groupDominator.get('group-2'));

    // Semi-Final 1 is the BYE node -> auto-finished walkover advancing Group 2's winner directly into Grand Final!
    const sfMatches = prop.matches.filter((m) => m.roundId === 'round-semi');
    expect(sfMatches.length).toBe(2);
    const byeMatch = sfMatches.find((m) => m.participants.some((p) => p.isBye))!;
    expect(byeMatch.status).toBe('finished');
    expect(byeMatch.result?.type).toBe('walkover');
    expect(byeMatch.result?.winnerId).toBe(groupDominator.get('group-2'));

    // Grand Final already has Group 2's winner in Slot 0 + Marwan guest in Slot 2!
    const finalMatch = prop.matches.find((m) => m.type === 'final')!;
    expect(finalMatch.participants[0].playerId).toBe(groupDominator.get('group-2'));
    expect(finalMatch.participants[2].playerId).toBe(MARWAN_PLAYER_ID);
    expect(finalMatch.participants[2].guest).toBe(true);
  });

  it('supports arbitrary tournament settings (48 players / groupSize 4 / advancePerGroup 2) and pairs by rank within group pairs', () => {
    const settings: TournamentSettings = {
      totalPlayers: 48,
      groupSize: 4,
      advancePerGroup: 2,
      pointsPerGroupWin: 3,
      tablesCount: 6,
      slotMinutes: 25,
      includeFinalWithMarwan: true,
    };
    const players = generateProceduralPlayers(48);
    const groups = generateGroups(players, settings, { preserveOrder: true });
    expect(groups.length).toBe(12);
    expect(groups.every((g) => g.playerIds.length === 4)).toBe(true);

    // n(n-1)/2 = 4*3/2 = 6 round-robin matches per group
    expect(generateGroupRoundRobinPairs(groups[0].playerIds).length).toBe(6);

    // 12 groups * 2 qualifiers = 24 qualifiers -> 32 bracket with 8 BYEs
    const ko = generateKnockout(groups, settings);
    expect(ko.bracketSize).toBe(32);
    expect(ko.byesCount).toBe(8);

    // Test 16 players, groupSize 4, advancePerGroup 2 -> 4 groups * 2 = 8 qualifiers (0 BYEs):
    // Verify exact rank-within-group-pair seeding: 1st G1 vs 1st G2, 2nd G1 vs 2nd G2!
    const settingsNoBye: TournamentSettings = {
      ...settings,
      totalPlayers: 16,
      groupSize: 4,
      advancePerGroup: 2,
    };
    const g4 = generateGroups(generateProceduralPlayers(16), settingsNoBye, {
      preserveOrder: true,
    });
    const koNoBye = generateKnockout(g4, settingsNoBye);
    expect(koNoBye.byesCount).toBe(0);
    const r1 = koNoBye.matches.filter((m) => m.round === 2);
    expect(r1.length).toBe(4);
    expect(r1[0].participants[0].feeder).toEqual({
      kind: 'group',
      groupId: 'group-1',
      groupNumber: 1,
      rank: 1,
    });
    expect(r1[0].participants[1].feeder).toEqual({
      kind: 'group',
      groupId: 'group-2',
      groupNumber: 2,
      rank: 1,
    });
    expect(r1[1].participants[0].feeder).toEqual({
      kind: 'group',
      groupId: 'group-1',
      groupNumber: 1,
      rank: 2,
    });
    expect(r1[1].participants[1].feeder).toEqual({
      kind: 'group',
      groupId: 'group-2',
      groupNumber: 2,
      rank: 2,
    });
  });

  it('handles 1v1v1 Final with Marwan Serry: highest score wins, excludes Marwan from standings/leaderboard/stats, and does not auto-end Final on finalist absence', () => {
    const seed = createSeedSnapshot({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      includeDemoProgress: false,
    });
    const finalMatch: Match = {
      ...seed.matches.find((m) => m.type === 'final')!,
      participants: [
        { slotIndex: 0, playerId: 'player-1', guest: false, isBye: false },
        { slotIndex: 1, playerId: 'player-4', guest: false, isBye: false },
        { slotIndex: 2, playerId: MARWAN_PLAYER_ID, guest: true, isBye: false },
      ],
      playerIds: ['player-1', 'player-4', MARWAN_PLAYER_ID],
    };

    // Finalist absence does NOT auto-end Final as walkover!
    const absFinal = computeMatchResult(
      finalMatch,
      [],
      [absenceEv(finalMatch.id, 'player-1', 'marked')],
      [lifecycleEv(finalMatch.id, 'started')]
    );
    expect(absFinal.status).toBe('live');
    expect(absFinal.result).toBeNull();
    expect(absFinal.requiresAdminDecision).toBe(true);

    // 1v1v1 scoring where Marwan wins 5 vs 4 vs 2 -> Marwan wins the match,
    // yet Marwan is strictly excluded from leaderboard & tournament player stats!
    const finalScores = [
      scoreEv(finalMatch.id, MARWAN_PLAYER_ID, 1),
      scoreEv(finalMatch.id, MARWAN_PLAYER_ID, 1),
      scoreEv(finalMatch.id, MARWAN_PLAYER_ID, 1),
      scoreEv(finalMatch.id, MARWAN_PLAYER_ID, 1),
      scoreEv(finalMatch.id, MARWAN_PLAYER_ID, 1),
      scoreEv(finalMatch.id, 'player-1', 1),
      scoreEv(finalMatch.id, 'player-1', 1),
      scoreEv(finalMatch.id, 'player-1', 1),
      scoreEv(finalMatch.id, 'player-1', 1),
      scoreEv(finalMatch.id, 'player-4', 1),
      scoreEv(finalMatch.id, 'player-4', 1),
    ];
    const finalEvents = [
      lifecycleEv(finalMatch.id, 'started'),
      lifecycleEv(finalMatch.id, 'finished'),
    ];
    const out = computeMatchResult(finalMatch, finalScores, [], finalEvents);
    expect(out.status).toBe('finished');
    expect(out.result?.winnerId).toBe(MARWAN_PLAYER_ID);

    const outcomesMap = new Map([[finalMatch.id, out]]);
    const { groupStandings } = computeQualifiers(
      seed.groups,
      [finalMatch],
      finalScores,
      [],
      finalEvents,
      seed.settings.tournament
    );
    const lb = computeLeaderboard(
      seed.players,
      [finalMatch],
      outcomesMap,
      groupStandings,
      finalScores,
      []
    );
    expect(lb.some((r) => r.player.id === MARWAN_PLAYER_ID)).toBe(false);
    expect(lb[0].player.id).toBe('player-1');
    expect(lb[0].totalPoints).toBe(4);
  });

  it('generates default 720-player seed cleanly with conflict-free scheduling and zero invariant violations', () => {
    const snapshot = createSeedSnapshot({ totalPlayers: 720 });
    expect(snapshot.players.filter((p) => !p.isGuest).length).toBe(720);
    expect(snapshot.groups.length).toBe(240);
    expect(snapshot.matches.filter((m) => !m.isDemo && m.type === 'group').length).toBe(720);
    // 256 bracket: 128 + 64 + 32 + 16 + 8 + 4 + 2 = 254 KO + 1 Final = 255
    expect(snapshot.matches.filter((m) => !m.isDemo && m.type !== 'group').length).toBe(255);

    // Check auto-scheduler conflict-free invariant on 12-player preset
    const small = createSeedSnapshot({ totalPlayers: 12, includeDemoProgress: false });
    const scheduled = autoScheduleMatches(
      small.matches.filter((m) => !m.isDemo),
      createDefaultUsers(),
      small.settings.tournament
    );
    const bySlot = new Map<string, Match[]>();
    for (const m of scheduled) {
      if (m.participants.some((p) => p.isBye)) continue;
      const arr = bySlot.get(m.scheduledAt) ?? [];
      arr.push(m);
      bySlot.set(m.scheduledAt, arr);
    }
    for (const [, slotMatches] of bySlot.entries()) {
      const seenPlayers = new Set<string>();
      const seenTables = new Set<number>();
      const seenJudges = new Set<string>();
      for (const m of slotMatches) {
        expect(seenTables.has(m.tableNumber)).toBe(false);
        seenTables.add(m.tableNumber);
        expect(seenJudges.has(m.judgeUserId)).toBe(false);
        seenJudges.add(m.judgeUserId);
        for (const p of m.participants) {
          if (p.playerId) {
            expect(seenPlayers.has(p.playerId)).toBe(false);
            seenPlayers.add(p.playerId);
          }
        }
      }
    }

    const report = checkInvariants(snapshot);
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it('resolveByes ranks qualifiers by group points -> points diff -> fewer red/yellow cards', () => {
    const qualifiers = [
      {
        groupId: 'group-1',
        groupNumber: 1,
        groupRank: 1,
        playerId: 'player-1',
        groupPoints: 6,
        pointsDiff: 5,
        pointsFor: 8,
        redCards: 1,
        yellowCards: 0,
        placeholderLabelEn: 'Winner of Group 1',
        placeholderLabelAr: 'متصدر المجموعة 1',
      },
      {
        groupId: 'group-2',
        groupNumber: 2,
        groupRank: 1,
        playerId: 'player-4',
        groupPoints: 6,
        pointsDiff: 5,
        pointsFor: 8,
        redCards: 0,
        yellowCards: 1,
        placeholderLabelEn: 'Winner of Group 2',
        placeholderLabelAr: 'متصدر المجموعة 2',
      },
      {
        groupId: 'group-3',
        groupNumber: 3,
        groupRank: 1,
        playerId: 'player-7',
        groupPoints: 3,
        pointsDiff: 1,
        pointsFor: 4,
        redCards: 0,
        yellowCards: 0,
        placeholderLabelEn: 'Winner of Group 3',
        placeholderLabelAr: 'متصدر المجموعة 3',
      },
    ];
    const alloc = resolveByes(qualifiers, DEFAULT_SETTINGS);
    expect(alloc.bracketSize).toBe(4);
    expect(alloc.byesCount).toBe(1);
    // Group 2 has 0 red cards vs Group 1's 1 red card -> Group 2 gets the BYE!
    expect(alloc.byeRecipients[0].playerId).toBe('player-4');
  });

  it('flags needsTieBreakMatch when a 3-way group deadlock cannot be separated by points diff or cards, then resolves when tie-break match finishes', () => {
    const group = {
      id: 'group-deadlock',
      number: 1,
      nameEn: 'Group 1',
      nameAr: 'المجموعة 1',
      roundId: 'round-groups',
      playerIds: ['player-1', 'player-2', 'player-3'],
    };
    const mAB = make1v1Match('m-dl-ab', 'player-1', 'player-2', group.id);
    const mBC = make1v1Match('m-dl-bc', 'player-2', 'player-3', group.id);
    const mAC = make1v1Match('m-dl-ac', 'player-1', 'player-3', group.id);

    // Exact symmetric 3-way cycle: every match finishes 2-1 -> all 3 players have 3 group pts, 0 diff, 0 cards!
    const scores: ScoreEvent[] = [
      scoreEv(mAB.id, 'player-1', 1),
      scoreEv(mAB.id, 'player-1', 1),
      scoreEv(mAB.id, 'player-2', 1),
      scoreEv(mBC.id, 'player-2', 1),
      scoreEv(mBC.id, 'player-2', 1),
      scoreEv(mBC.id, 'player-3', 1),
      scoreEv(mAC.id, 'player-3', 1),
      scoreEv(mAC.id, 'player-3', 1),
      scoreEv(mAC.id, 'player-1', 1),
    ];
    const events: MatchLifecycleEvent[] = [
      lifecycleEv(mAB.id, 'started'),
      lifecycleEv(mAB.id, 'finished'),
      lifecycleEv(mBC.id, 'started'),
      lifecycleEv(mBC.id, 'finished'),
      lifecycleEv(mAC.id, 'started'),
      lifecycleEv(mAC.id, 'finished'),
    ];

    const gsBefore = computeGroupStandings(
      group,
      [mAB, mBC, mAC],
      scores,
      [],
      events,
      DEFAULT_SETTINGS
    );
    expect(gsBefore.isComplete).toBe(false);
    expect(gsBefore.needsTieBreakMatch).toBe(true);
    expect(gsBefore.tiedCutoffPlayerIds.length).toBe(3);

    // Admin triggers group tie-break match won by player-3 -> resolves deadlock!
    const tbMatch: Match = {
      ...make1v1Match('m-dl-tb', 'player-1', 'player-3', group.id),
      isGroupTieBreak: true,
    };
    const gsAfter = computeGroupStandings(
      group,
      [mAB, mBC, mAC, tbMatch],
      [...scores, scoreEv(tbMatch.id, 'player-3', 1)],
      [],
      [...events, lifecycleEv(tbMatch.id, 'started'), lifecycleEv(tbMatch.id, 'finished')],
      DEFAULT_SETTINGS
    );
    expect(gsAfter.isComplete).toBe(true);
    expect(gsAfter.needsTieBreakMatch).toBe(false);
    expect(gsAfter.qualifierPlayerIds).toEqual(['player-3']);
  });
});
