import {
  MARWAN_PLAYER_ID,
  type AbsenceEvent,
  type AuditEntry,
  type BuzzEvent,
  type CheckInEvent,
  type DatabaseSnapshot,
  type Group,
  type Match,
  type MatchLifecycleEvent,
  type Round,
  type ScoreEvent,
  type Settings,
  type TournamentSettings,
} from '@/lib/schemas';
import {
  autoScheduleMatches,
  generateGroupRoundRobinPairs,
  generateGroups,
  generateKnockout,
  propagateWinners,
} from '@/lib/engine';
import {
  buildBracketConfigCompat,
  createContentItemsSeed,
  createDefaultUsers,
  createDemoSeedState,
  createSegmentsSeed,
  createSponsorsSeed,
  generateProceduralPlayers,
  SEED_VERSION,
} from './index';

export type VideoDemoPreset = 'fresh' | 'main' | 'final';

export const VIDEO_DEMO_CONSTANTS = {
  HERO_GROUP_ID: 'group-1',
  HERO_MATCH_ID: 'match-g1-m3',
  HERO_KO_MATCH_ID: 'match-ko-256-17',
  FINAL_MATCH_ID: 'match-final',
  HERO_PLAYER_ID: 'player-1', // Omar Hassan "The Fox"
  HERO_PLAYER_USER_ID: 'user-player-1',
  OPPONENT_PLAYER_ID: 'player-3', // Mostafa Gamal "Tofa"
  THIRD_GROUP_PLAYER_ID: 'player-2', // Youssef Adel "Joe"
  FINALIST_2_PLAYER_ID: 'player-19', // Salma Reda "Salsabeel"
  HERO_JUDGE_ID: 'user-scorer-1',
  ADMIN_USER_ID: 'user-admin',
} as const;

// 16 groups guaranteed to achieve dominant +10 net diff so they deterministically claim
// the 16 Best-Group-Winner BYEs (leaving Group 1 Winner as Play-In Qualifier #1 in match-ko-256-17).
const BYE_GROUPS = new Set([
  2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
]);

/**
 * Deterministic, event-sourced Video Demo Snapshot builder.
 * Every derived field (winners, standings, qualifiers, BYEs, knockout slots, stats)
 * is computed strictly by pure `/lib/engine` `propagateWinners()` with 0 invariant violations.
 *
 * Presets:
 * - `fresh`: 720 players, 240 groups drawn, 0 matches started (unlocked Group Draw demo).
 * - `main`:  720 players, Groups 2..240 completed + Group 1 Matches 1 & 2 finished;
 *            `match-g1-m3` (Omar Hassan vs Mostafa Gamal) is SCHEDULED on Table #1 with Scorer 1.
 *            Finishing `match-g1-m3` completes the Group Stage, allocates 16 BYEs, and slots the
 *            Group 1 winner directly into `match-ko-256-17`.
 * - `final`: 720 players, full tournament played cleanly through Semi-Finals so Omar Hassan
 *            (`player-1`) and Salma Reda (`player-19`) face Marwan Serry (`player-marwan`)
 *            LIVE in `match-final` (1v1v1 Grand Final).
 */
export function createVideoDemoSnapshot(
  preset: VideoDemoPreset = 'main'
): DatabaseSnapshot {
  const tournament: TournamentSettings = {
    totalPlayers: 720,
    groupSize: 3,
    advancePerGroup: 1,
    pointsPerGroupWin: 3,
    tablesCount: 12,
    slotMinutes: 30,
    includeFinalWithMarwan: true,
  };

  const segments = createSegmentsSeed();
  const users = createDefaultUsers();
  const players = generateProceduralPlayers(tournament.totalPlayers);
  const sponsors = createSponsorsSeed();
  const contentItems = createContentItemsSeed();

  const stdSegIds = ['seg-1', 'seg-3', 'seg-6', 'seg-10', 'seg-13', 'seg-14'];
  const finalSegIds = [
    'seg-1',
    'seg-3',
    'seg-4',
    'seg-6',
    'seg-8',
    'seg-10',
    'seg-13',
    'seg-15',
  ];

  const groupRound: Round = {
    id: 'round-groups',
    name: {
      en: 'Group Stage — 1v1 Round-Robin',
      ar: 'دور المجموعات — دوري ١ ضد ١',
    },
    order: 1,
    stage: 'group',
    advancePerGame: tournament.advancePerGroup,
    status: 'upcoming',
  };

  let groups: Group[] = generateGroups(players, tournament, {
    preserveOrder: true,
    roundId: groupRound.id,
  });

  // In the 'final' preset, place Salma Reda (player-19) into Group 128 (second bracket half)
  // so Omar Hassan (Group 1, top half) and Salma Reda (Group 128, bottom half) legitimately
  // win Semi-Final 1 and Semi-Final 2 respectively to meet Marwan Serry in the 1v1v1 Grand Final!
  if (preset === 'final') {
    const g7 = groups.find((g) => g.number === 7);
    const g128 = groups.find((g) => g.number === 128);
    if (g7 && g128) {
      const salmaIdx = g7.playerIds.indexOf(VIDEO_DEMO_CONSTANTS.FINALIST_2_PLAYER_ID);
      if (salmaIdx >= 0) {
        const swapPid = g128.playerIds[0];
        g7.playerIds = g7.playerIds.map((id, i) => (i === salmaIdx ? swapPid : id));
        g128.playerIds = g128.playerIds.map((id, i) =>
          i === 0 ? VIDEO_DEMO_CONSTANTS.FINALIST_2_PLAYER_ID : id
        );
      }
    }
  }

  const groupMatches: Match[] = [];
  let gSlot = 1;
  for (const group of groups) {
    const pairs = generateGroupRoundRobinPairs(group.playerIds);
    pairs.forEach(([pA, pB], pairIdx) => {
      const matchId = `match-g${group.number}-m${pairIdx + 1}`;
      groupMatches.push({
        id: matchId,
        type: 'group',
        groupId: group.id,
        roundId: groupRound.id,
        round: 1,
        slot: gSlot++,
        isGroupTieBreak: false,
        participants: [
          { slotIndex: 0, playerId: pA, feeder: { kind: 'fixed', playerId: pA } },
          { slotIndex: 1, playerId: pB, feeder: { kind: 'fixed', playerId: pB } },
        ],
        playerIds: [pA, pB],
        tableNumber: ((gSlot - 2) % tournament.tablesCount) + 1,
        tableName: `Group ${group.number} · Match ${pairIdx + 1}`,
        tableNameAr: `المجموعة ${group.number} · مباراة ${pairIdx + 1}`,
        scheduledAt: '2027-03-05T19:00:00.000Z',
        judgeUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
        scorerUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
        segmentIds: stdSegIds,
        currentSegmentIndex: 0,
        status: 'scheduled',
        result: null,
        isFinal: false,
        isDemo: false,
        podOrder: gSlot - 1,
        replayEpoch: 0,
        version: 1,
        timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
      });
    });
  }

  const koTree = generateKnockout(groups, tournament, {
    startRoundOrder: 2,
    defaultSegmentIds: stdSegIds,
    finalSegmentIds: finalSegIds,
    defaultJudgeUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
    baseScheduledAtIso: '2027-03-14T20:00:00.000Z',
  });

  const rounds: Round[] = [groupRound, ...koTree.rounds];
  const rawTournamentMatches = [...groupMatches, ...koTree.matches];

  const scheduledTournamentMatches = autoScheduleMatches(
    rawTournamentMatches,
    users,
    tournament,
    '2027-03-05T19:00:00.000Z'
  );

  // Guarantee hero match `match-g1-m3` is on Table #1 with Judge Scorer 1 and a clean prime-time slot
  const heroMatchObj = scheduledTournamentMatches.find(
    (m) => m.id === VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID
  );
  if (heroMatchObj) {
    heroMatchObj.tableNumber = 1;
    heroMatchObj.judgeUserId = VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID;
    heroMatchObj.scorerUserId = VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID;
  }

  // Also ensure `match-ko-256-17` is assigned to Judge Scorer 1 so Scorer/Admin flows work cleanly
  const heroKoObj = scheduledTournamentMatches.find(
    (m) => m.id === VIDEO_DEMO_CONSTANTS.HERO_KO_MATCH_ID
  );
  if (heroKoObj) {
    heroKoObj.tableNumber = 1;
    heroKoObj.judgeUserId = VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID;
    heroKoObj.scorerUserId = VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID;
  }

  const demoSeed = createDemoSeedState([
    VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID,
    VIDEO_DEMO_CONSTANTS.FINALIST_2_PLAYER_ID,
  ]);

  const matches: Match[] = [...scheduledTournamentMatches, demoSeed.match];
  const scoreEvents: ScoreEvent[] = [...demoSeed.scoreEvents];
  const absenceEvents: AbsenceEvent[] = [];
  const buzzEvents: BuzzEvent[] = [...demoSeed.buzzEvents];
  const matchEvents: MatchLifecycleEvent[] = [...demoSeed.matchEvents];
  const checkInEvents: CheckInEvent[] = [];
  const auditEntries: AuditEntry[] = [];

  // Anchor seeded timestamps 12 hours before now (4s deterministic spacing)
  // so every live recorded tap during video capture always appears strictly newest-first
  // right at the top of /admin/results and /admin/audit.
  const baseStoryMs = Date.now() - 12 * 60 * 60_000;
  let evSeq = 1;
  const nextIso = () => new Date(baseStoryMs + evSeq++ * 4_000).toISOString();

  const addScore = (
    matchId: string,
    playerId: string,
    delta: number,
    kind: 'point' | 'yellow' | 'red',
    byUserId: string,
    segId: string,
    note?: string
  ) => {
    scoreEvents.push({
      id: `se-vd-${evSeq}`,
      matchId,
      gameId: matchId,
      segmentId: segId,
      playerId,
      delta,
      kind,
      note,
      byUserId,
      replayEpoch: 0,
      createdAt: nextIso(),
    });
  };

  const playMatchFast = (
    m: Match,
    winnerPid: string,
    winPts: number,
    losePts: number,
    opts?: { yellowLoser?: boolean; redLoser?: boolean }
  ) => {
    const pIds = m.participants
      .map((p) => p.playerId)
      .filter((id): id is string => Boolean(id));
    if (pIds.length < 2) return;
    const loserPid = pIds.find((id) => id !== winnerPid) ?? pIds[1];

    matchEvents.push({
      id: `me-vd-start-${evSeq}`,
      matchId: m.id,
      type: 'started',
      byUserId: m.judgeUserId,
      replayEpoch: 0,
      createdAt: nextIso(),
    });

    for (let k = 0; k < winPts; k++) {
      addScore(m.id, winnerPid, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
    }
    for (let k = 0; k < losePts; k++) {
      addScore(m.id, loserPid, 1, 'point', m.judgeUserId, stdSegIds[(k + 1) % stdSegIds.length]);
    }
    if (opts?.yellowLoser) {
      addScore(
        m.id,
        loserPid,
        -1,
        'yellow',
        m.judgeUserId,
        stdSegIds[2],
        'Yellow card (−1): False buzz'
      );
    }
    if (opts?.redLoser) {
      addScore(
        m.id,
        loserPid,
        -2,
        'red',
        m.judgeUserId,
        stdSegIds[4],
        'Red card (−2): Unsportsmanlike interruption'
      );
    }

    matchEvents.push({
      id: `me-vd-fin-${evSeq}`,
      matchId: m.id,
      type: 'finished',
      byUserId: m.judgeUserId,
      replayEpoch: 0,
      createdAt: nextIso(),
    });
    m.currentSegmentIndex = stdSegIds.length - 1;
  };

  if (preset === 'main' || preset === 'final') {
    const matchesByGroupId = new Map<string, Match[]>();
    for (const m of scheduledTournamentMatches) {
      if (m.groupId) {
        const list = matchesByGroupId.get(m.groupId);
        if (list) list.push(m);
        else matchesByGroupId.set(m.groupId, [m]);
      }
    }

    // Complete Groups 2..240
    for (const group of groups) {
      if (group.number === 1) continue;
      const gMatches = matchesByGroupId.get(group.id) ?? [];

      // Group 4: classic 3-way cycle resolved by net points diff (A=+3, B=-3, C=0 -> A qualifies)
      if (group.number === 4 && gMatches.length === 3) {
        playMatchFast(gMatches[0], gMatches[0].participants[0].playerId!, 5, 1);
        playMatchFast(gMatches[1], gMatches[1].participants[0].playerId!, 3, 2);
        playMatchFast(gMatches[2], gMatches[2].participants[1].playerId!, 3, 2);
        continue;
      }

      const isByeGroup = BYE_GROUPS.has(group.number);

      gMatches.forEach((m, mIdx) => {
        const p0 = m.participants[0].playerId!;
        const p1 = m.participants[1].playerId!;

        // Group 6 Match 3: walkover absence example
        if (group.number === 6 && mIdx === 2) {
          absenceEvents.push({
            id: `abs-vd-${evSeq}`,
            matchId: m.id,
            playerId: p1,
            action: 'marked',
            reason: 'No-show at table call',
            byUserId: m.judgeUserId,
            replayEpoch: 0,
            createdAt: nextIso(),
          });
          auditEntries.push({
            id: `audit-vd-${evSeq}`,
            actorUserId: m.judgeUserId,
            action: 'match.markAbsent',
            entityType: 'absence',
            entityId: m.id,
            summary: `Marked ${p1} absent in ${m.tableName} — walkover victory awarded to ${p0}.`,
            summaryAr: `تم تسجيل غياب ${p1} في ${m.tableNameAr} — فوز انسحابي لـ ${p0}.`,
            before: { status: 'scheduled' },
            after: { status: 'finished', resultType: 'walkover', winnerId: p0 },
            automatic: false,
            createdAt: nextIso(),
          });
          return;
        }

        if (isByeGroup) {
          // Seat A (playerIds[0]) wins m0 (A vs B) and m2 (A vs C) decisively 6-1 (+10 net diff, 0 cards)
          if (mIdx === 0 || mIdx === 2) {
            playMatchFast(m, p0, 6, 1);
          } else {
            playMatchFast(m, p0, 3, 2);
          }
        } else {
          // Standard group: Seat A wins m0 (4-2) and m2 (4-2) -> +4 diff; Seat B wins m1 (3-2)
          const addYellow = group.number <= 24 && mIdx === 0 && group.number % 4 === 0;
          const addRed = group.number === 20 && mIdx === 0;
          if (mIdx === 0 || mIdx === 2) {
            playMatchFast(m, p0, 4, 2, { yellowLoser: addYellow, redLoser: addRed });
          } else {
            playMatchFast(m, p0, 3, 2);
          }
        }
      });
    }

    // Group 1 (Hero Group):
    // Check in all 3 players of Group 1
    for (const pid of [
      VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID,
      VIDEO_DEMO_CONSTANTS.THIRD_GROUP_PLAYER_ID,
      VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID,
    ]) {
      checkInEvents.push({
        id: `ci-vd-${evSeq}`,
        playerId: pid,
        status: 'checkedIn',
        byUserId: 'user-checkin',
        createdAt: nextIso(),
      });
    }

    const g1Matches = matchesByGroupId.get('group-1') ?? [];
    const m1 = g1Matches.find((m) => m.id === 'match-g1-m1');
    const m2 = g1Matches.find((m) => m.id === 'match-g1-m2');
    const m3 = g1Matches.find((m) => m.id === 'match-g1-m3');

    // match-g1-m1: Omar Hassan (player-1) beats Youssef Adel (player-2) 4-2
    if (m1) playMatchFast(m1, VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID, 4, 2);
    // match-g1-m2: Mostafa Gamal (player-3) beats Youssef Adel (player-2) 3-1
    if (m2) playMatchFast(m2, VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID, 3, 1);

    // In 'final' preset, also finish match-g1-m3 (Omar wins 4-3) and play through knockouts!
    if (preset === 'final' && m3) {
      playMatchFast(m3, VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID, 4, 3);
    }

    auditEntries.push({
      id: 'audit-vd-init',
      actorUserId: VIDEO_DEMO_CONSTANTS.ADMIN_USER_ID,
      action: 'tournament.generate',
      entityType: 'bracket',
      entityId: 'tournament-bracket',
      summary: `Generated 720-player Ramadan tournament: 240 groups of 3, 720 group matches, 256-slot knockout bracket (16 BYEs) + 1v1v1 Grand Final with Marwan Serry.`,
      summaryAr: `تم توليد بطولة رمضان (720 لاعب): 240 مجموعة من 3 لاعبين، 720 مباراة مجموعات، شجرة تصفيات 256 مقعد (16 BYE) والنهائي الثلاثي مع مروان سري.`,
      before: null,
      after: {
        totalPlayers: 720,
        groupsCount: 240,
        matchesCount: scheduledTournamentMatches.length,
        byesCount: koTree.byesCount,
      },
      automatic: false,
      createdAt: new Date(baseStoryMs).toISOString(),
    });
  } else {
    // 'fresh' preset: record generation audit only, 0 matches started
    auditEntries.push({
      id: 'audit-vd-fresh-init',
      actorUserId: VIDEO_DEMO_CONSTANTS.ADMIN_USER_ID,
      action: 'tournament.generate',
      entityType: 'bracket',
      entityId: 'tournament-bracket',
      summary: `Prepared fresh 720-player tournament draw (240 groups of 3, 12 tables, 30-min slots).`,
      summaryAr: `تم تجهيز قرعة بطولة 720 لاعب (240 مجموعة، 12 طاولة، فترات 30 دقيقة).`,
      before: null,
      after: { totalPlayers: 720, groupsCount: 240, byesCount: koTree.byesCount },
      automatic: false,
      createdAt: new Date(baseStoryMs).toISOString(),
    });
  }

  const settings: Settings = {
    id: 'global-settings',
    eventName: 'Casino El Al3ab — Ramadan Tournament',
    eventNameAr: 'كازينو الألعاب — بطولة رمضان الكبرى',
    eventDates: 'Ramadan 2027 (Placeholder Dates)',
    eventDatesAr: 'رمضان ٢٠٢٧ (مواعيد مبدئية)',
    finalNightIso: '2027-03-22T21:00:00.000Z',
    venue: 'Cairo Grand Studio Arena (Placeholder Venue)',
    venueAr: 'استوديو القاهرة الكبرى (موقع مبدئي)',
    prizeText: 'Grand Trophy + Championship Prize Package (Placeholder)',
    prizeTextAr: 'كأس البطولة وحزمة الجوائز الكبرى (مبدئية)',
    contactEmail: 'partnerships@casinoelal3ab-demo.com',
    defaultLanguage: 'en',
    useArabicIndicDigits: false,
    delightersEnabled: false,
    soundEnabled: false,
    tournament,
    bracketConfig: buildBracketConfigCompat(tournament),
    updatedAt: '2027-02-28T18:00:00.000Z',
  };

  let propagated = propagateWinners({
    players,
    groups,
    rounds,
    matches,
    scoreEvents,
    absenceEvents,
    buzzEvents,
    matchEvents,
    checkInEvents,
    settings: tournament,
  });

  // For 'final' preset, propagate round-by-round through all knockout rounds up to Semi-Finals,
  // ensuring Omar Hassan (player-1) and Salma Reda (player-19) always win their respective matches,
  // then start `match-final` LIVE with Marwan Serry centered in the Golden Seat!
  if (preset === 'final') {
    const preferredWinners = new Set<string>([
      VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID,
      VIDEO_DEMO_CONSTANTS.FINALIST_2_PLAYER_ID,
    ]);

    const koRoundOrders = Array.from(
      new Set(
        propagated.matches
          .filter((m) => m.type === 'knockout')
          .map((m) => m.round)
      )
    ).sort((a, b) => a - b);

    for (const roundOrder of koRoundOrders) {
      const roundMatches = propagated.matches.filter(
        (m) => m.type === 'knockout' && m.round === roundOrder && m.status === 'scheduled'
      );

      for (const m of roundMatches) {
        const realPids = m.participants
          .filter((p) => !p.isBye && p.playerId)
          .map((p) => p.playerId!);
        if (realPids.length < 2) continue;

        const chosenWinner =
          realPids.find((pid) => preferredWinners.has(pid)) ?? realPids[0];
        playMatchFast(m, chosenWinner, 4, 2);
      }

      propagated = propagateWinners({
        players: propagated.players,
        groups,
        rounds: propagated.rounds,
        matches: propagated.matches,
        scoreEvents,
        absenceEvents,
        buzzEvents,
        matchEvents,
        checkInEvents,
        settings: tournament,
      });
    }

    // Now start the 1v1v1 Grand Final LIVE with the two surviving finalists + Marwan Serry!
    const finalMatch = propagated.matches.find(
      (m) => m.id === VIDEO_DEMO_CONSTANTS.FINAL_MATCH_ID
    );
    if (finalMatch) {
      const challengers = finalMatch.participants
        .map((p) => p.playerId)
        .filter((id): id is string => Boolean(id && id !== MARWAN_PLAYER_ID));
      const f1 = challengers[0] ?? VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID;
      const f2 = challengers[1] ?? VIDEO_DEMO_CONSTANTS.FINALIST_2_PLAYER_ID;

      matchEvents.push({
        id: `me-vd-final-start`,
        matchId: finalMatch.id,
        type: 'started',
        byUserId: finalMatch.judgeUserId,
        replayEpoch: 0,
        createdAt: nextIso(),
      });

      // Exciting close Grand Final scoreline: Marwan 6, Finalist 1 (Omar) 5, Finalist 2 (Salma) 4
      for (let k = 0; k < 5; k++) {
        addScore(finalMatch.id, f1, 1, 'point', finalMatch.judgeUserId, finalSegIds[k % 4]);
      }
      for (let k = 0; k < 6; k++) {
        addScore(
          finalMatch.id,
          MARWAN_PLAYER_ID,
          1,
          'point',
          finalMatch.judgeUserId,
          finalSegIds[k % 4],
          k === 5 ? 'Lightning buzz on Ramadan track!' : undefined
        );
      }
      for (let k = 0; k < 4; k++) {
        addScore(finalMatch.id, f2, 1, 'point', finalMatch.judgeUserId, finalSegIds[k % 4]);
      }

      finalMatch.currentSegmentIndex = 1; // "Put the Word in a Song" / "حط الكلمة في أغنية"
      finalMatch.timer = {
        status: 'paused',
        durationSec: 30,
        remainingSec: 19,
        endsAt: null,
      };
      buzzEvents.push({
        id: 'buzz-vd-final-marwan',
        matchId: finalMatch.id,
        gameId: finalMatch.id,
        segmentId: finalSegIds[1],
        playerId: MARWAN_PLAYER_ID,
        byUserId: finalMatch.judgeUserId,
        cleared: false,
        replayEpoch: 0,
        createdAt: nextIso(),
      });

      propagated = propagateWinners({
        players: propagated.players,
        groups,
        rounds: propagated.rounds,
        matches: propagated.matches,
        scoreEvents,
        absenceEvents,
        buzzEvents,
        matchEvents,
        checkInEvents,
        settings: tournament,
      });
    }
  }

  return {
    version: SEED_VERSION,
    players: propagated.players,
    users,
    groups,
    rounds: propagated.rounds,
    segments,
    matches: propagated.matches,
    scoreEvents: scoreEvents.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    absenceEvents: absenceEvents.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    buzzEvents: buzzEvents.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    matchEvents: matchEvents.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    checkInEvents: checkInEvents.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    auditEntries: auditEntries.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    sponsors,
    contentItems,
    settings,
  };
}
