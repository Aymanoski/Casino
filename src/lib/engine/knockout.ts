import {
  MARWAN_PLAYER_ID,
  type Group,
  type Match,
  type MatchParticipant,
  type Round,
  type TournamentSettings,
} from '@/lib/schemas';
import type { ByeAllocation, QualifierSlot } from './types';

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Ranks group qualifiers for BYE allocation per AGENTS.md §15.1:
 * (1) Best group rank (1st-place winners ahead of 2nd-place qualifiers),
 * (2) Group points DESC,
 * (3) Match points difference DESC (then pointsFor DESC),
 * (4) Fewer red cards ASC, fewer yellow cards ASC,
 * (5) Lower group number ASC (deterministic tie-breaker).
 */
export function compareQualifiersForBye(a: QualifierSlot, b: QualifierSlot): number {
  if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
  if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
  if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  if (a.redCards !== b.redCards) return a.redCards - b.redCards;
  if (a.yellowCards !== b.yellowCards) return a.yellowCards - b.yellowCards;
  return a.groupNumber - b.groupNumber;
}

/**
 * Orders play-in qualifiers by group pairs per AGENTS.md §15.1:
 * Group 1 vs Group 2, Group 3 vs Group 4, ...
 * When advancePerGroup > 1: within each group pair (G_odd, G_even),
 * pair by rank (1st of G1 vs 1st of G2, 2nd of G1 vs 2nd of G2, ...).
 */
export function orderQualifiersIntoPairs(
  qualifiers: QualifierSlot[],
  advancePerGroup: number
): Array<[QualifierSlot, QualifierSlot]> {
  if (qualifiers.length < 2) return [];

  if (advancePerGroup <= 1) {
    const sorted = [...qualifiers].sort((a, b) => a.groupNumber - b.groupNumber);
    const pairs: Array<[QualifierSlot, QualifierSlot]> = [];
    for (let i = 0; i + 1 < sorted.length; i += 2) {
      pairs.push([sorted[i], sorted[i + 1]]);
    }
    return pairs;
  }

  // Group qualifiers by groupNumber
  const byGroup = new Map<number, QualifierSlot[]>();
  for (const q of qualifiers) {
    const list = byGroup.get(q.groupNumber) ?? [];
    list.push(q);
    byGroup.set(q.groupNumber, list);
  }
  const groupNumbers = Array.from(byGroup.keys()).sort((a, b) => a - b);

  const pairs: Array<[QualifierSlot, QualifierSlot]> = [];
  const leftovers: QualifierSlot[] = [];

  for (let i = 0; i < groupNumbers.length; i += 2) {
    const gA = byGroup.get(groupNumbers[i])!.sort((a, b) => a.groupRank - b.groupRank);
    const gBNum = groupNumbers[i + 1];
    if (gBNum === undefined) {
      leftovers.push(...gA);
      continue;
    }
    const gB = byGroup.get(gBNum)!.sort((a, b) => a.groupRank - b.groupRank);
    const maxRank = Math.max(gA.length, gB.length);
    for (let r = 0; r < maxRank; r++) {
      if (gA[r] && gB[r]) {
        pairs.push([gA[r], gB[r]]);
      } else if (gA[r]) {
        leftovers.push(gA[r]);
      } else if (gB[r]) {
        leftovers.push(gB[r]);
      }
    }
  }

  // Pair any odd-group-count leftovers sequentially
  for (let i = 0; i + 1 < leftovers.length; i += 2) {
    pairs.push([leftovers[i], leftovers[i + 1]]);
  }

  return pairs;
}

/**
 * Pure BYE resolver per AGENTS.md §15.1:
 * If qualifierCount is not a power of two (e.g. 240 -> 256 bracket, or 3 -> 4 bracket),
 * grants byes to the best group winners ranked by group points, points diff, fewer cards.
 */
export function resolveByes(
  qualifiers: QualifierSlot[],
  settings: TournamentSettings
): ByeAllocation {
  const qualifierCount = qualifiers.length;
  const minBracket = settings.includeFinalWithMarwan ? 2 : 2;
  const bracketSize = Math.max(minBracket, nextPowerOfTwo(qualifierCount));
  const byesCount = Math.max(0, bracketSize - qualifierCount);
  const allGroupsComplete =
    qualifierCount > 0 && qualifiers.every((q) => q.playerId !== null);

  if (byesCount === 0) {
    return {
      bracketSize,
      qualifierCount,
      byesCount: 0,
      allGroupsComplete,
      byeRecipients: [],
      round1PlayIn: [...qualifiers],
    };
  }

  if (!allGroupsComplete) {
    // Until all groups complete, keep BYE slots as TBD "Best Group Winner #i"
    // so byes don't flap prematurely while groups are still playing.
    return {
      bracketSize,
      qualifierCount,
      byesCount,
      allGroupsComplete: false,
      byeRecipients: Array.from({ length: byesCount }, (_, idx) => ({
        groupId: `bye-tbd-${idx + 1}`,
        groupNumber: 0,
        groupRank: 1,
        playerId: null,
        groupPoints: 0,
        pointsDiff: 0,
        pointsFor: 0,
        redCards: 0,
        yellowCards: 0,
        placeholderLabelEn: `Best Group Winner #${idx + 1} (TBD)`,
        placeholderLabelAr: `أفضل متصدر مجموعة #${idx + 1} (قريباً)`,
      })),
      round1PlayIn: Array.from({ length: Math.max(0, qualifierCount - byesCount) }, (_, idx) => ({
        groupId: `playin-tbd-${idx + 1}`,
        groupNumber: 0,
        groupRank: 1,
        playerId: null,
        groupPoints: 0,
        pointsDiff: 0,
        pointsFor: 0,
        redCards: 0,
        yellowCards: 0,
        placeholderLabelEn: `Group Qualifier #${idx + 1} (TBD)`,
        placeholderLabelAr: `متأهل المجموعات #${idx + 1} (قريباً)`,
      })),
    };
  }

  const ranked = [...qualifiers].sort(compareQualifiersForBye);
  const byeRecipients = ranked.slice(0, byesCount);
  const byeKeySet = new Set(
    byeRecipients.map((q) => `${q.groupId}::${q.groupRank}`)
  );
  const round1PlayIn = qualifiers.filter(
    (q) => !byeKeySet.has(`${q.groupId}::${q.groupRank}`)
  );

  return {
    bracketSize,
    qualifierCount,
    byesCount,
    allGroupsComplete: true,
    byeRecipients,
    round1PlayIn,
  };
}

function getKnockoutRoundName(bracketEntrants: number): { en: string; ar: string } {
  if (bracketEntrants === 4) {
    return { en: 'Semi-Finals', ar: 'نصف النهائي' };
  }
  if (bracketEntrants === 8) {
    return { en: 'Quarter-Finals', ar: 'ربع النهائي' };
  }
  return {
    en: `Round of ${bracketEntrants}`,
    ar: `دور الـ ${bracketEntrants}`,
  };
}

function participantIdsProjection(matchId: string, participants: MatchParticipant[]): string[] {
  return participants.map((p, idx) => {
    if (p.playerId) return p.playerId;
    if (p.isBye) return `bye-${matchId}-s${idx + 1}`;
    return `tbd-${matchId}-s${idx + 1}`;
  });
}

export interface GeneratedKnockoutTree {
  rounds: Round[];
  matches: Match[];
  bracketSize: number;
  byesCount: number;
}

/**
 * Generates the complete single-elimination 1v1 knockout bracket skeleton + 1v1v1 Grand Final
 * (2 finalists + Marwan Serry guest) with explicit feeder metadata on every participant slot.
 */
export function generateKnockout(
  groups: Group[],
  settings: TournamentSettings,
  options?: {
    startRoundOrder?: number;
    defaultSegmentIds?: string[];
    finalSegmentIds?: string[];
    defaultJudgeUserId?: string;
    baseScheduledAtIso?: string;
  }
): GeneratedKnockoutTree {
  const sortedGroups = [...groups].sort((a, b) => a.number - b.number);
  const qualifierCount = sortedGroups.reduce(
    (sum, g) => sum + Math.min(settings.advancePerGroup, g.playerIds.length),
    0
  );

  const startOrder = options?.startRoundOrder ?? 2;
  const segIds = options?.defaultSegmentIds ?? ['seg-1', 'seg-3', 'seg-6', 'seg-10', 'seg-13', 'seg-14'];
  const finalSegIds = options?.finalSegmentIds ?? [
    'seg-1',
    'seg-3',
    'seg-4',
    'seg-6',
    'seg-8',
    'seg-10',
    'seg-13',
    'seg-15',
  ];
  const judgeId = options?.defaultJudgeUserId ?? 'user-scorer-1';
  const baseMs = options?.baseScheduledAtIso
    ? Date.parse(options.baseScheduledAtIso)
    : Date.parse('2027-03-10T20:00:00.000Z');

  const bracketSize = Math.max(2, nextPowerOfTwo(qualifierCount));
  const byesCount = Math.max(0, bracketSize - qualifierCount);

  const rounds: Round[] = [];
  const matches: Match[] = [];

  // Build placeholder QualifierSlots for the skeleton
  const skeletonQualifiers: QualifierSlot[] = [];
  for (const g of sortedGroups) {
    const adv = Math.min(settings.advancePerGroup, g.playerIds.length);
    for (let r = 1; r <= adv; r++) {
      skeletonQualifiers.push({
        groupId: g.id,
        groupNumber: g.number,
        groupRank: r,
        playerId: null,
        groupPoints: 0,
        pointsDiff: 0,
        pointsFor: 0,
        redCards: 0,
        yellowCards: 0,
        placeholderLabelEn: r === 1 ? `Winner of Group ${g.number}` : `#${r} of Group ${g.number}`,
        placeholderLabelAr: r === 1 ? `متصدر المجموعة ${g.number}` : `المركز ${r} المجموعة ${g.number}`,
      });
    }
  }

  let currentOrder = startOrder;
  let prevRoundMatches: Match[] = [];

  // Special case: only 2 qualifiers total -> they go straight to the Final!
  if (bracketSize === 2) {
    if (settings.includeFinalWithMarwan) {
      const finalRound: Round = {
        id: 'round-final',
        name: {
          en: 'The Grand Final — vs. Marwan Serry',
          ar: 'النهائي الكبير — في مواجهة مروان سري',
        },
        order: currentOrder,
        stage: 'final',
        advancePerGame: 1,
        status: 'upcoming',
      };
      rounds.push(finalRound);

      const p0 = skeletonQualifiers[0];
      const p1 = skeletonQualifiers[1];
      const finalId = 'match-final';
      const participants: MatchParticipant[] = [
        {
          slotIndex: 0,
          playerId: null,
          placeholderLabelEn: p0?.placeholderLabelEn ?? 'Finalist #1 (TBD)',
          placeholderLabelAr: p0?.placeholderLabelAr ?? 'المتأهل الأول (قريباً)',
          feeder: p0
            ? { kind: 'group', groupId: p0.groupId, groupNumber: p0.groupNumber, rank: p0.groupRank }
            : { kind: 'bye' },
        },
        {
          slotIndex: 1,
          playerId: null,
          placeholderLabelEn: p1?.placeholderLabelEn ?? 'Finalist #2 (TBD)',
          placeholderLabelAr: p1?.placeholderLabelAr ?? 'المتأهل الثاني (قريباً)',
          feeder: p1
            ? { kind: 'group', groupId: p1.groupId, groupNumber: p1.groupNumber, rank: p1.groupRank }
            : { kind: 'bye' },
        },
        {
          slotIndex: 2,
          playerId: MARWAN_PLAYER_ID,
          guest: true,
          feeder: { kind: 'guest', playerId: MARWAN_PLAYER_ID },
        },
      ];

      matches.push({
        id: finalId,
        type: 'final',
        roundId: finalRound.id,
        round: currentOrder,
        slot: 1,
        participants,
        playerIds: participantIdsProjection(finalId, participants),
        tableNumber: 1,
        tableName: 'The Grand Final — Against Marwan Serry',
        tableNameAr: 'النهائي الكبير — في مواجهة مروان سري',
        scheduledAt: new Date(baseMs + 86_400_000).toISOString(),
        judgeUserId: judgeId,
        scorerUserId: judgeId,
        segmentIds: finalSegIds,
        currentSegmentIndex: 0,
        status: 'scheduled',
        result: null,
        isFinal: true,
        isDemo: false,
        podOrder: 1,
        replayEpoch: 0,
        version: 1,
        timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
      });
    } else {
      const finalRound: Round = {
        id: 'round-final',
        name: { en: 'The Final', ar: 'النهائي' },
        order: currentOrder,
        stage: 'final',
        advancePerGame: 1,
        status: 'upcoming',
      };
      rounds.push(finalRound);
      const p0 = skeletonQualifiers[0];
      const p1 = skeletonQualifiers[1];
      const finalId = 'match-final';
      const participants: MatchParticipant[] = [
        {
          slotIndex: 0,
          playerId: null,
          placeholderLabelEn: p0?.placeholderLabelEn ?? 'Finalist #1',
          placeholderLabelAr: p0?.placeholderLabelAr ?? 'المتأهل الأول',
          feeder: p0
            ? { kind: 'group', groupId: p0.groupId, groupNumber: p0.groupNumber, rank: p0.groupRank }
            : { kind: 'bye' },
        },
        {
          slotIndex: 1,
          playerId: null,
          placeholderLabelEn: p1?.placeholderLabelEn ?? 'Finalist #2',
          placeholderLabelAr: p1?.placeholderLabelAr ?? 'المتأهل الثاني',
          feeder: p1
            ? { kind: 'group', groupId: p1.groupId, groupNumber: p1.groupNumber, rank: p1.groupRank }
            : { kind: 'bye' },
        },
      ];
      matches.push({
        id: finalId,
        type: 'knockout',
        roundId: finalRound.id,
        round: currentOrder,
        slot: 1,
        participants,
        playerIds: participantIdsProjection(finalId, participants),
        tableNumber: 1,
        tableName: 'The Final',
        tableNameAr: 'النهائي',
        scheduledAt: new Date(baseMs + 86_400_000).toISOString(),
        judgeUserId: judgeId,
        scorerUserId: judgeId,
        segmentIds: finalSegIds,
        currentSegmentIndex: 0,
        status: 'scheduled',
        result: null,
        isFinal: true,
        isDemo: false,
        podOrder: 1,
        replayEpoch: 0,
        version: 1,
        timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
      });
    }

    return { rounds, matches, bracketSize, byesCount };
  }

  // Standard knockout rounds from bracketSize down to 4 (Semi-Finals -> 2 finalists)
  // or down to 2 if !includeFinalWithMarwan.
  const stopAtEntrants = settings.includeFinalWithMarwan ? 4 : 2;
  let entrants = bracketSize;
  let koRoundIdx = 1;

  while (entrants >= stopAtEntrants) {
    const matchCount = entrants / 2;
    const roundId =
      entrants === 4
        ? 'round-semi'
        : entrants === 2
          ? 'round-final'
          : `round-ko-${entrants}`;
    const roundName =
      entrants === 2
        ? { en: 'The Final', ar: 'النهائي' }
        : getKnockoutRoundName(entrants);

    rounds.push({
      id: roundId,
      name: roundName,
      order: currentOrder,
      stage: entrants === 2 ? 'final' : 'knockout',
      advancePerGame: 1,
      status: 'upcoming',
    });

    const roundMatches: Match[] = [];

    if (koRoundIdx === 1) {
      // First knockout round: direct group feeders (when byesCount === 0)
      // OR explicit BYE nodes + dynamic play-in feeders (when byesCount > 0)
      if (byesCount === 0) {
        const pairs = orderQualifiersIntoPairs(
          skeletonQualifiers,
          settings.advancePerGroup
        );
        for (let mIdx = 0; mIdx < matchCount; mIdx++) {
          const pair = pairs[mIdx];
          const matchId = `match-ko-${entrants}-${mIdx + 1}`;
          const participants: MatchParticipant[] = [
            {
              slotIndex: 0,
              playerId: null,
              placeholderLabelEn: pair?.[0].placeholderLabelEn ?? `Qualifier ${mIdx * 2 + 1}`,
              placeholderLabelAr: pair?.[0].placeholderLabelAr ?? `متأهل ${mIdx * 2 + 1}`,
              feeder: pair?.[0]
                ? {
                    kind: 'group',
                    groupId: pair[0].groupId,
                    groupNumber: pair[0].groupNumber,
                    rank: pair[0].groupRank,
                  }
                : { kind: 'bye' },
            },
            {
              slotIndex: 1,
              playerId: null,
              placeholderLabelEn: pair?.[1].placeholderLabelEn ?? `Qualifier ${mIdx * 2 + 2}`,
              placeholderLabelAr: pair?.[1].placeholderLabelAr ?? `متأهل ${mIdx * 2 + 2}`,
              feeder: pair?.[1]
                ? {
                    kind: 'group',
                    groupId: pair[1].groupId,
                    groupNumber: pair[1].groupNumber,
                    rank: pair[1].groupRank,
                  }
                : { kind: 'bye' },
            },
          ];

          roundMatches.push({
            id: matchId,
            type: 'knockout',
            roundId,
            round: currentOrder,
            slot: mIdx + 1,
            participants,
            playerIds: participantIdsProjection(matchId, participants),
            tableNumber: (mIdx % Math.max(1, settings.tablesCount)) + 1,
            tableName: `${roundName.en} — Match ${mIdx + 1}`,
            tableNameAr: `${roundName.ar} — مباراة ${mIdx + 1}`,
            scheduledAt: new Date(
              baseMs + koRoundIdx * 86_400_000 + mIdx * settings.slotMinutes * 60_000
            ).toISOString(),
            judgeUserId: judgeId,
            scorerUserId: judgeId,
            segmentIds: segIds,
            currentSegmentIndex: 0,
            status: 'scheduled',
            result: null,
            isFinal: false,
            isDemo: false,
            podOrder: mIdx + 1,
            replayEpoch: 0,
            version: 1,
            timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
          });
        }
      } else {
        // Explicit BYE nodes first (0 .. byesCount - 1), then remaining play-in matches
        let playInCursor = 0;
        for (let mIdx = 0; mIdx < matchCount; mIdx++) {
          const matchId = `match-ko-${entrants}-${mIdx + 1}`;
          const isByeMatch = mIdx < byesCount;

          const participants: MatchParticipant[] = isByeMatch
            ? [
                {
                  slotIndex: 0,
                  playerId: null,
                  placeholderLabelEn: `Best Group Winner #${mIdx + 1}`,
                  placeholderLabelAr: `أفضل متصدر مجموعة #${mIdx + 1}`,
                  feeder: { kind: 'bestGroupWinner', byeRankIndex: mIdx },
                },
                {
                  slotIndex: 1,
                  playerId: null,
                  isBye: true,
                  placeholderLabelEn: 'BYE',
                  placeholderLabelAr: 'تأهل تلقائي (BYE)',
                  feeder: { kind: 'bye' },
                },
              ]
            : [
                {
                  slotIndex: 0,
                  playerId: null,
                  placeholderLabelEn: `Group Qualifier #${playInCursor + 1}`,
                  placeholderLabelAr: `متأهل المجموعات #${playInCursor + 1}`,
                  feeder: {
                    kind: 'remainingGroupQualifier',
                    qualifierIndex: playInCursor++,
                  },
                },
                {
                  slotIndex: 1,
                  playerId: null,
                  placeholderLabelEn: `Group Qualifier #${playInCursor + 1}`,
                  placeholderLabelAr: `متأهل المجموعات #${playInCursor + 1}`,
                  feeder: {
                    kind: 'remainingGroupQualifier',
                    qualifierIndex: playInCursor++,
                  },
                },
              ];

          roundMatches.push({
            id: matchId,
            type: 'knockout',
            roundId,
            round: currentOrder,
            slot: mIdx + 1,
            participants,
            playerIds: participantIdsProjection(matchId, participants),
            tableNumber: (mIdx % Math.max(1, settings.tablesCount)) + 1,
            tableName: isByeMatch
              ? `${roundName.en} — Match ${mIdx + 1} (BYE)`
              : `${roundName.en} — Match ${mIdx + 1}`,
            tableNameAr: isByeMatch
              ? `${roundName.ar} — مباراة ${mIdx + 1} (BYE)`
              : `${roundName.ar} — مباراة ${mIdx + 1}`,
            scheduledAt: new Date(
              baseMs + koRoundIdx * 86_400_000 + mIdx * settings.slotMinutes * 60_000
            ).toISOString(),
            judgeUserId: judgeId,
            scorerUserId: judgeId,
            segmentIds: segIds,
            currentSegmentIndex: 0,
            status: 'scheduled',
            result: null,
            isFinal: false,
            isDemo: false,
            podOrder: mIdx + 1,
            replayEpoch: 0,
            version: 1,
            timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
          });
        }
      }
    } else {
      // Later knockout rounds: winner of prev match 2i vs winner of prev match 2i+1
      for (let mIdx = 0; mIdx < matchCount; mIdx++) {
        const feederA = prevRoundMatches[mIdx * 2];
        const feederB = prevRoundMatches[mIdx * 2 + 1];
        const matchId =
          entrants === 4
            ? `match-semi-${mIdx + 1}`
            : entrants === 2
              ? 'match-final'
              : `match-ko-${entrants}-${mIdx + 1}`;

        const participants: MatchParticipant[] = [
          {
            slotIndex: 0,
            playerId: null,
            placeholderLabelEn: feederA ? `Winner of ${feederA.tableName}` : `Feeder ${mIdx * 2 + 1}`,
            placeholderLabelAr: feederA ? `فائز ${feederA.tableNameAr}` : `متأهل ${mIdx * 2 + 1}`,
            feeder: feederA
              ? { kind: 'match', matchId: feederA.id, outcome: 'winner' }
              : { kind: 'bye' },
          },
          {
            slotIndex: 1,
            playerId: null,
            placeholderLabelEn: feederB ? `Winner of ${feederB.tableName}` : `Feeder ${mIdx * 2 + 2}`,
            placeholderLabelAr: feederB ? `فائز ${feederB.tableNameAr}` : `متأهل ${mIdx * 2 + 2}`,
            feeder: feederB
              ? { kind: 'match', matchId: feederB.id, outcome: 'winner' }
              : { kind: 'bye' },
          },
        ];

        roundMatches.push({
          id: matchId,
          type: 'knockout',
          roundId,
          round: currentOrder,
          slot: mIdx + 1,
          participants,
          playerIds: participantIdsProjection(matchId, participants),
          tableNumber: (mIdx % Math.max(1, settings.tablesCount)) + 1,
          tableName:
            entrants === 2
              ? 'The Final'
              : `${roundName.en} — Match ${mIdx + 1}`,
          tableNameAr:
            entrants === 2
              ? 'النهائي'
              : `${roundName.ar} — مباراة ${mIdx + 1}`,
          scheduledAt: new Date(
            baseMs + koRoundIdx * 86_400_000 + mIdx * settings.slotMinutes * 60_000
          ).toISOString(),
          judgeUserId: judgeId,
          scorerUserId: judgeId,
          segmentIds: entrants === 2 ? finalSegIds : segIds,
          currentSegmentIndex: 0,
          status: 'scheduled',
          result: null,
          isFinal: entrants === 2,
          isDemo: false,
          podOrder: mIdx + 1,
          replayEpoch: 0,
          version: 1,
          timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
        });
      }
    }

    matches.push(...roundMatches);
    prevRoundMatches = roundMatches;
    entrants = entrants / 2;
    currentOrder++;
    koRoundIdx++;
  }

  // Append the 1v1v1 Grand Final (2 semi-final winners + Marwan Serry guest)
  if (settings.includeFinalWithMarwan) {
    const finalRound: Round = {
      id: 'round-final',
      name: {
        en: 'The Grand Final — vs. Marwan Serry',
        ar: 'النهائي الكبير — في مواجهة مروان سري',
      },
      order: currentOrder,
      stage: 'final',
      advancePerGame: 1,
      status: 'upcoming',
    };
    rounds.push(finalRound);

    const semi1 = prevRoundMatches[0];
    const semi2 = prevRoundMatches[1];
    const finalId = 'match-final';
    const participants: MatchParticipant[] = [
      {
        slotIndex: 0,
        playerId: null,
        placeholderLabelEn: 'Winner of Semi-Final 1',
        placeholderLabelAr: 'فائز نصف النهائي ١',
        feeder: semi1
          ? { kind: 'match', matchId: semi1.id, outcome: 'winner' }
          : { kind: 'bye' },
      },
      {
        slotIndex: 1,
        playerId: null,
        placeholderLabelEn: 'Winner of Semi-Final 2',
        placeholderLabelAr: 'فائز نصف النهائي ٢',
        feeder: semi2
          ? { kind: 'match', matchId: semi2.id, outcome: 'winner' }
          : { kind: 'bye' },
      },
      {
        slotIndex: 2,
        playerId: MARWAN_PLAYER_ID,
        guest: true,
        feeder: { kind: 'guest', playerId: MARWAN_PLAYER_ID },
      },
    ];

    matches.push({
      id: finalId,
      type: 'final',
      roundId: finalRound.id,
      round: currentOrder,
      slot: 1,
      participants,
      playerIds: participantIdsProjection(finalId, participants),
      tableNumber: 1,
      tableName: 'The Grand Final — Against Marwan Serry',
      tableNameAr: 'النهائي الكبير — في مواجهة مروان سري',
      scheduledAt: new Date(baseMs + (koRoundIdx + 1) * 86_400_000).toISOString(),
      judgeUserId: judgeId,
      scorerUserId: judgeId,
      segmentIds: finalSegIds,
      currentSegmentIndex: 0,
      status: 'scheduled',
      result: null,
      isFinal: true,
      isDemo: false,
      podOrder: 1,
      replayEpoch: 0,
      version: 1,
      timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
    });
  }

  return { rounds, matches, bracketSize, byesCount };
}
