import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  CascadeConfirmationRequiredError,
  CommandValidationError,
  commands,
} from '@/lib/commands';
import {
  computeMatchResult,
  detectScheduleConflicts,
  propagateWinners,
  resolveByes,
} from '@/lib/engine';
import {
  auditRepo,
  groupRepo,
  matchRepo,
  playerRepo,
  scoreRepo,
} from '@/lib/repos';
import { MARWAN_PLAYER_ID } from '@/lib/schemas';
import { SEED_PRESETS, type SeedPresetSize } from '@/lib/seed';
import { storage } from '@/lib/storage';

async function assertZeroViolations(label: string) {
  const report = await commands.runConsistencyCheck('user-admin');
  if (!report.ok || report.violations.length > 0) {
    throw new Error(
      `Consistency check failed after [${label}]: ${JSON.stringify(
        report.violations.slice(0, 5),
        null,
        2
      )}`
    );
  }
  expect(report.ok).toBe(true);
  expect(report.violations).toEqual([]);
}

/**
 * Plays a single 1v1 match cleanly through the command pipeline:
 * startMatch -> points/cards -> finishMatch.
 */
async function playStandardMatch(
  matchId: string,
  winnerId: string,
  winnerPts = 2,
  loserPts = 1
) {
  const m = (await matchRepo.get(matchId))!;
  const loserId = m.participants.find(
    (p) => p.playerId && p.playerId !== winnerId && !p.isBye
  )?.playerId;

  if (m.status === 'scheduled') {
    await commands.startMatch({ matchId, actorUserId: 'user-admin' });
  }
  const segId = m.segmentIds[0] ?? 'seg-1';
  const scoreEventIds: string[] = [];
  for (let i = 0; i < winnerPts; i++) {
    const ev = await commands.applyPoint({
      matchId,
      segmentId: segId,
      playerId: winnerId,
      delta: 1,
      byUserId: 'user-admin',
    });
    scoreEventIds.push(ev.id);
  }
  if (loserId) {
    for (let i = 0; i < loserPts; i++) {
      await commands.applyPoint({
        matchId,
        segmentId: segId,
        playerId: loserId,
        delta: 1,
        byUserId: 'user-admin',
      });
    }
  }
  const fin = await commands.finishMatch({
    matchId,
    actorUserId: 'user-admin',
    autoOpenTieBreaker: true,
  });
  expect(fin?.status).toBe('finished');
  expect(fin?.winnerId).toBe(winnerId);
  return { scoreEventIds, fin: fin! };
}

/**
 * Rapidly completes remaining unfinished group matches in a large preset (48 or 720)
 * by appending canonical started/point/finished events and running propagateWinners,
 * then committing cleanly so we can run real command-pipeline tests on top of completed
 * groups, knockouts, BYEs, and Grand Final within seconds!
 */
async function fastCompleteRemainingGroupMatches(skipGroupIds: Set<string> = new Set()) {
  const db = await storage.readSnapshot();
  let seq = 1;
  const nowMs = Date.now() - 60_000;
  const iso = () => new Date(nowMs + seq++ * 10).toISOString();

  for (const m of db.matches) {
    if (m.isDemo || m.type !== 'group') continue;
    if (m.groupId && skipGroupIds.has(m.groupId)) continue;
    if (m.status === 'finished') continue;

    const p0 = m.participants[0]?.playerId;
    const p1 = m.participants[1]?.playerId;
    if (!p0 || !p1) continue;

    const groupNum = Number((m.groupId ?? '').replace('group-', '')) || 1;
    // Give early groups slightly higher point diffs so BYE ranking is deterministic & distinct
    const winPts = 4 + (groupNum <= 16 ? 2 : 0);
    const losePts = 1;

    if (m.status === 'scheduled') {
      db.matchEvents.push({
        id: `me-fast-st-${m.id}-${seq}`,
        matchId: m.id,
        type: 'started',
        byUserId: m.judgeUserId,
        replayEpoch: m.replayEpoch ?? 0,
        createdAt: iso(),
      });
    }

    const segId = m.segmentIds[0] ?? 'seg-1';
    for (let k = 0; k < winPts; k++) {
      db.scoreEvents.push({
        id: `se-fast-w-${m.id}-${k}-${seq}`,
        matchId: m.id,
        gameId: m.id,
        segmentId: segId,
        playerId: p0,
        delta: 1,
        kind: 'point',
        byUserId: m.judgeUserId,
        replayEpoch: m.replayEpoch ?? 0,
        createdAt: iso(),
      });
    }
    for (let k = 0; k < losePts; k++) {
      db.scoreEvents.push({
        id: `se-fast-l-${m.id}-${k}-${seq}`,
        matchId: m.id,
        gameId: m.id,
        segmentId: segId,
        playerId: p1,
        delta: 1,
        kind: 'point',
        byUserId: m.judgeUserId,
        replayEpoch: m.replayEpoch ?? 0,
        createdAt: iso(),
      });
    }

    db.matchEvents.push({
      id: `me-fast-fin-${m.id}-${seq}`,
      matchId: m.id,
      type: 'finished',
      byUserId: m.judgeUserId,
      replayEpoch: m.replayEpoch ?? 0,
      createdAt: iso(),
    });
  }

  const prop = propagateWinners({
    players: db.players,
    groups: db.groups,
    rounds: db.rounds,
    matches: db.matches,
    scoreEvents: db.scoreEvents,
    absenceEvents: db.absenceEvents,
    buzzEvents: db.buzzEvents,
    matchEvents: db.matchEvents,
    checkInEvents: db.checkInEvents,
    settings: db.settings.tournament,
  });

  db.matches = prop.matches;
  db.rounds = prop.rounds;
  db.players = prop.players;
  await storage.writeSnapshot(db);
}

/**
 * Rapidly completes all knockout rounds up to (but not including) the Grand Final,
 * leaving at least the final knockout round or semi-final playable via commands if requested.
 */
async function fastCompleteKnockoutsUntilRound(stopBeforeRoundId: string) {
  let guard = 0;
  while (guard++ < 12) {
    const db = await storage.readSnapshot();
    const roundsSorted = [...db.rounds]
      .filter((r) => r.stage === 'knockout')
      .sort((a, b) => a.order - b.order);

    let progressed = false;
    let seq = 1;
    const nowMs = Date.now() - 30_000;
    const iso = () => new Date(nowMs + seq++ * 10).toISOString();

    for (const round of roundsSorted) {
      if (round.id === stopBeforeRoundId) break;
      const roundMatches = db.matches.filter(
        (m) =>
          !m.isDemo &&
          m.roundId === round.id &&
          m.status === 'scheduled' &&
          !m.participants.some((p) => p.isBye) &&
          m.participants.every((p) => Boolean(p.playerId))
      );
      if (roundMatches.length === 0) continue;

      for (const m of roundMatches) {
        const p0 = m.participants[0].playerId!;
        const p1 = m.participants[1].playerId!;
        const segId = m.segmentIds[0] ?? 'seg-1';
        db.matchEvents.push({
          id: `me-ko-st-${m.id}-${seq}`,
          matchId: m.id,
          type: 'started',
          byUserId: m.judgeUserId,
          replayEpoch: m.replayEpoch ?? 0,
          createdAt: iso(),
        });
        db.scoreEvents.push(
          {
            id: `se-ko-1-${m.id}-${seq}`,
            matchId: m.id,
            gameId: m.id,
            segmentId: segId,
            playerId: p0,
            delta: 1,
            kind: 'point',
            byUserId: m.judgeUserId,
            replayEpoch: m.replayEpoch ?? 0,
            createdAt: iso(),
          },
          {
            id: `se-ko-2-${m.id}-${seq}`,
            matchId: m.id,
            gameId: m.id,
            segmentId: segId,
            playerId: p0,
            delta: 1,
            kind: 'point',
            byUserId: m.judgeUserId,
            replayEpoch: m.replayEpoch ?? 0,
            createdAt: iso(),
          },
          {
            id: `se-ko-3-${m.id}-${seq}`,
            matchId: m.id,
            gameId: m.id,
            segmentId: segId,
            playerId: p1,
            delta: 1,
            kind: 'point',
            byUserId: m.judgeUserId,
            replayEpoch: m.replayEpoch ?? 0,
            createdAt: iso(),
          }
        );
        db.matchEvents.push({
          id: `me-ko-fin-${m.id}-${seq}`,
          matchId: m.id,
          type: 'finished',
          byUserId: m.judgeUserId,
          replayEpoch: m.replayEpoch ?? 0,
          createdAt: iso(),
        });
      }

      const prop = propagateWinners({
        players: db.players,
        groups: db.groups,
        rounds: db.rounds,
        matches: db.matches,
        scoreEvents: db.scoreEvents,
        absenceEvents: db.absenceEvents,
        buzzEvents: db.buzzEvents,
        matchEvents: db.matchEvents,
        checkInEvents: db.checkInEvents,
        settings: db.settings.tournament,
      });
      db.matches = prop.matches;
      db.rounds = prop.rounds;
      db.players = prop.players;
      await storage.writeSnapshot(db);
      progressed = true;
      break;
    }

    if (!progressed) break;
  }
}

describe('Change Request 1 Step 5 — End-to-End Scenarios Across 12, 48 & 720 Presets + Zero Consistency Violations', () => {
  it('Preset 12 (4 groups, 4 qualifiers, 0 BYEs): full end-to-end story (normal, walkover, both absent, tie-break, knockouts, 1v1v1 Marwan Final, client revert bug, downstream needsReview & keepAsIs/invalidateForReplay)', async () => {
    // 1. Seed clean 12-player preset & verify initial consistency
    await storage.resetToSeed({ ...SEED_PRESETS[12], includeDemoProgress: false });
    await assertZeroViolations('12P initial seed');

    const initialSnap = await storage.readSnapshot();
    expect(initialSnap.groups.length).toBe(4);
    expect(detectScheduleConflicts(initialSnap.matches, initialSnap.settings.tournament)).toEqual([]);

    // 2. Group 1 — NORMAL matches + cards (+1, -1, Yellow -1, Red -2)
    const g1Matches = await matchRepo.getByGroup('group-1');
    const [g1m1, g1m2, g1m3] = g1Matches;
    const pA = g1m1.participants[0].playerId!;
    const pB = g1m1.participants[1].playerId!;
    const pC = g1m2.participants.find((p) => p.playerId !== pA && p.playerId !== pB)!.playerId!;

    // Play g1m1: A scores +1,+1,+1 (=3); B scores +1,+1,+1 (=3) then Yellow (-1) => A=3, B=2
    await commands.startMatch({ matchId: g1m1.id, actorUserId: 'user-admin' });
    const evA1 = await commands.applyPoint({
      matchId: g1m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    const evA2 = await commands.applyPoint({
      matchId: g1m1.id,
      segmentId: 'seg-3',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: g1m1.id,
      segmentId: 'seg-6',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: g1m1.id,
      segmentId: 'seg-1',
      playerId: pB,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: g1m1.id,
      segmentId: 'seg-3',
      playerId: pB,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: g1m1.id,
      segmentId: 'seg-6',
      playerId: pB,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyCard({
      matchId: g1m1.id,
      segmentId: 'seg-6',
      playerId: pB,
      card: 'yellow',
      note: 'Early buzz',
      byUserId: 'user-admin',
    });
    const finG1M1 = await commands.finishMatch({
      matchId: g1m1.id,
      actorUserId: 'user-admin',
      autoOpenTieBreaker: true,
    });
    expect(finG1M1?.status).toBe('finished');
    expect(finG1M1?.winnerId).toBe(pA);
    await assertZeroViolations('12P G1M1 normal + yellow card');

    // Play g1m2 (B vs C): B beats C
    const g1m2Winner = g1m2.participants.some((p) => p.playerId === pB) ? pB : pA;
    await playStandardMatch(g1m2.id, g1m2Winner, 2, 0);
    // Play g1m3 (A vs C): A beats C -> A has 6 pts (2W), B has 3 pts (1W), C has 0 pts
    const finG1M3 = await playStandardMatch(g1m3.id, pA, 2, 0);
    // Check Group 1 complete & Semi-Final 1 Slot 0 received pA
    const sf1 = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1.participants[0].playerId).toBe(pA);
    expect(finG1M3.fin.advancedTo?.some((a) => a.playerId === pA && a.targetGameId === sf1.id)).toBe(true);
    await assertZeroViolations('12P Group 1 complete');

    // 3. Group 2 — WALKOVER (1 absent) + BOTH ABSENT (void -> Super Admin override) + TIE-BREAK!
    const g2Matches = await matchRepo.getByGroup('group-2');
    const [g2m1, g2m2, g2m3] = g2Matches;
    const g2p0 = g2m1.participants[0].playerId!;
    const g2p1 = g2m1.participants[1].playerId!;

    // 3a. Walkover on g2m1 (g2p1 absent -> g2p0 immediate walkover win)
    const woRes = await commands.markAbsent({
      matchId: g2m1.id,
      playerId: g2p1,
      byUserId: 'user-admin',
    });
    expect(woRes.match.status).toBe('finished');
    expect(woRes.match.result?.type).toBe('walkover');
    expect(woRes.match.result?.winnerId).toBe(g2p0);
    await assertZeroViolations('12P G2M1 walkover');

    // 3b. Both absent on g2m2 -> status becomes 'void', requiresAdminDecision = true!
    const g2m2p0 = g2m2.participants[0].playerId!;
    const g2m2p1 = g2m2.participants[1].playerId!;
    await commands.markAbsent({
      matchId: g2m2.id,
      playerId: g2m2p0,
      byUserId: 'user-admin',
    });
    const bothAbsRes = await commands.markAbsent({
      matchId: g2m2.id,
      playerId: g2m2p1,
      byUserId: 'user-admin',
    });
    expect(bothAbsRes.match.status).toBe('void');
    expect(bothAbsRes.match.result?.type).toBe('void');
    expect(bothAbsRes.requiresAdminDecision).toBe(true);
    await assertZeroViolations('12P G2M2 both absent -> void');

    // Super Admin resolves void match via overrideResult!
    await commands.overrideResult({
      matchId: g2m2.id,
      resultType: 'walkover',
      winnerId: g2m2p0,
      reason: 'Committee coin toss after double no-show',
      actorUserId: 'user-admin',
    });
    expect((await matchRepo.get(g2m2.id))?.status).toBe('finished');
    await assertZeroViolations('12P G2M2 void resolved by override');

    // 3c. Tie-Break on g2m3: tied 1-1 -> autoOpenTieBreaker inserts seg-16 -> deciding point -> finished!
    const g2m3p0 = g2m3.participants[0].playerId!;
    const g2m3p1 = g2m3.participants[1].playerId!;
    await commands.startMatch({ matchId: g2m3.id, actorUserId: 'user-admin' });
    await commands.applyPoint({
      matchId: g2m3.id,
      segmentId: 'seg-1',
      playerId: g2m3p0,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: g2m3.id,
      segmentId: 'seg-1',
      playerId: g2m3p1,
      delta: 1,
      byUserId: 'user-admin',
    });
    const tbAttempt = await commands.finishMatch({
      matchId: g2m3.id,
      actorUserId: 'user-admin',
      autoOpenTieBreaker: true,
    });
    expect(tbAttempt?.status).toBe('tie_breaker_opened');
    expect(tbAttempt?.match.segmentIds.at(-1)).toBe('seg-16');
    await assertZeroViolations('12P G2M3 tie-breaker opened');

    await commands.applyPoint({
      matchId: g2m3.id,
      segmentId: 'seg-16',
      playerId: g2m3p0,
      delta: 1,
      byUserId: 'user-admin',
    });
    const tbFinished = await commands.finishMatch({
      matchId: g2m3.id,
      actorUserId: 'user-admin',
      autoOpenTieBreaker: true,
    });
    expect(tbFinished?.status).toBe('finished');
    expect(tbFinished?.winnerId).toBe(g2m3p0);
    await assertZeroViolations('12P Group 2 complete (walkover + void override + tie-break)');

    // 4. Complete Groups 3 & 4 cleanly
    for (const gid of ['group-3', 'group-4']) {
      const gms = await matchRepo.getByGroup(gid);
      const leader = gms[0].participants[0].playerId!;
      for (const m of gms) {
        const w = m.participants.some((p) => p.playerId === leader)
          ? leader
          : m.participants[0].playerId!;
        await playStandardMatch(m.id, w, 2, 1);
      }
    }
    await assertZeroViolations('12P all 4 groups complete');

    // 5. CLIENT'S REPORTED BUG (before SF1 starts):
    // Revert 2 of pA's points in g1m1 so pA drops from 3 -> 1 while pB leads 2 -> 1!
    // Confirm winner tag, rank, group standing, qualifier AND SF1 bracket slot ALL move pA -> pB!
    await commands.revertEvent({
      matchId: g1m1.id,
      targetEventId: evA1.id,
      byUserId: 'user-admin',
      reason: 'Client bug test 1',
    });
    expect((await matchRepo.get(g1m1.id))?.status).toBe('needsTieBreak');
    expect((await matchRepo.get(g1m1.id))?.result).toBeNull();
    await assertZeroViolations('12P mid-revert tie -> needsTieBreak');

    await commands.revertEvent({
      matchId: g1m1.id,
      targetEventId: evA2.id,
      byUserId: 'user-admin',
      reason: 'Client bug test 2',
    });
    const g1m1Reverted = (await matchRepo.get(g1m1.id))!;
    expect(g1m1Reverted.status).toBe('finished');
    expect(g1m1Reverted.result?.winnerId).toBe(pB);
    expect(g1m1Reverted.winnerPlayerId).toBe(pB);

    const g1Standings = (await groupRepo.getStandings('group-1'))!;
    expect(g1Standings.rows[0].playerId).toBe(pB);
    expect(g1Standings.rows[0].rank).toBe(1);
    expect(g1Standings.qualifierPlayerIds).toEqual([pB]);

    const sf1AfterBugRevert = (await matchRepo.get(sf1.id))!;
    expect(sf1AfterBugRevert.participants[0].playerId).toBe(pB);
    await assertZeroViolations('12P client bug revert -> winner, rank, standing, qualifier, bracket slot all moved to pB');

    // 6. Play Semi-Final 1 (now pB vs Group 2 Winner) — start it so it is LIVE!
    await commands.startMatch({ matchId: sf1.id, actorUserId: 'user-admin' });
    await commands.applyPoint({
      matchId: sf1.id,
      segmentId: 'seg-1',
      playerId: pB,
      delta: 1,
      byUserId: 'user-admin',
    });
    await assertZeroViolations('12P SF1 started live');

    // 7. DOWNSTREAM CASCADE AFTER MATCH STARTED:
    // Give pA +2 points in finished g1m1 (via override or applyPoint) so pA regains Group 1 #1 AFTER SF1 already started!
    // Must throw CascadeConfirmationRequiredError with Impact Preview!
    let caughtImpact: CascadeConfirmationRequiredError | null = null;
    try {
      await commands.overrideResult({
        matchId: g1m1.id,
        resultType: 'normal',
        winnerId: pA,
        reason: 'Appeal upheld after SF1 started',
        actorUserId: 'user-admin',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        caughtImpact = err;
      }
    }
    expect(caughtImpact).not.toBeNull();
    expect(caughtImpact?.impact.requiresConfirmation).toBe(true);
    expect(caughtImpact?.impact.reviewRequiredMatches.some((x) => x.matchId === sf1.id)).toBe(true);
    await assertZeroViolations('12P blocked unconfirmed cascade');

    // 7a. Confirm with markNeedsReview -> SF1 becomes needsReview, history preserved!
    await commands.overrideResult({
      matchId: g1m1.id,
      resultType: 'normal',
      winnerId: pA,
      reason: 'Appeal upheld after SF1 started',
      actorUserId: 'user-admin',
      confirmCascade: true,
      cascadePolicy: 'markNeedsReview',
    });
    expect((await matchRepo.get(sf1.id))?.status).toBe('needsReview');
    expect((await matchRepo.get(sf1.id))?.participants[0].playerId).toBe(pB);
    await assertZeroViolations('12P downstream marked needsReview');

    // 7b. Resolve needsReview with 'invalidateForReplay' -> resets SF1 cleanly with pA at epoch 1
    await commands.resolveNeedsReview({
      matchId: sf1.id,
      action: 'invalidateForReplay',
      actorUserId: 'user-admin',
    });
    const sf1Reset = (await matchRepo.get(sf1.id))!;
    expect(sf1Reset.status).toBe('scheduled');
    expect(sf1Reset.replayEpoch).toBe(1);
    expect(sf1Reset.participants[0].playerId).toBe(pA);
    await assertZeroViolations('12P needsReview resolved via invalidateForReplay');

    // 8. Finish both Semi-Finals -> both finalists advance into 1v1v1 Grand Final with Marwan Serry!
    const sfMatches = (await matchRepo.list({ type: 'knockout' })).sort((a, b) => a.slot - b.slot);
    expect(sfMatches.length).toBe(2);
    const finalist1 = sfMatches[0].participants[0].playerId!;
    const finalist2 = sfMatches[1].participants[0].playerId!;
    await playStandardMatch(sfMatches[0].id, finalist1, 3, 1);
    await playStandardMatch(sfMatches[1].id, finalist2, 3, 2);
    await assertZeroViolations('12P both Semi-Finals finished');

    // 9. Play the 1v1v1 GRAND FINAL with Marwan Serry!
    const finalMatch = (await matchRepo.list({ type: 'final' }))[0]!;
    expect(finalMatch.participants.length).toBe(3);
    expect(finalMatch.participants.map((p) => p.playerId)).toEqual([
      finalist1,
      finalist2,
      MARWAN_PLAYER_ID,
    ]);
    await commands.startMatch({ matchId: finalMatch.id, actorUserId: 'user-admin' });

    // Test Finalist Absence -> MUST NOT auto-end Final!
    const finalAbs = await commands.markAbsent({
      matchId: finalMatch.id,
      playerId: finalist2,
      byUserId: 'user-admin',
    });
    expect(finalAbs.requiresAdminDecision).toBe(true);
    expect(finalAbs.match.status).toBe('live');
    await assertZeroViolations('12P Final absence does not auto-end');

    // Reverse finalist2's absence, then tie finalist1 and Marwan 2-2 -> Tie-Breaker -> Marwan wins 3-2-1!
    await commands.reverseAbsence({
      matchId: finalMatch.id,
      playerId: finalist2,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-1', playerId: finalist1, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-3', playerId: finalist1, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-1', playerId: finalist2, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-1', playerId: MARWAN_PLAYER_ID, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-3', playerId: MARWAN_PLAYER_ID, delta: 1, byUserId: 'user-admin' });

    const finalTie = await commands.finishMatch({
      matchId: finalMatch.id,
      actorUserId: 'user-admin',
      autoOpenTieBreaker: true,
    });
    expect(finalTie?.status).toBe('tie_breaker_opened');
    await assertZeroViolations('12P Grand Final tie-break opened');

    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-16', playerId: MARWAN_PLAYER_ID, delta: 1, byUserId: 'user-admin' });
    const finalDone = await commands.finishMatch({
      matchId: finalMatch.id,
      actorUserId: 'user-admin',
      autoOpenTieBreaker: true,
    });
    expect(finalDone?.status).toBe('finished');
    expect(finalDone?.winnerId).toBe(MARWAN_PLAYER_ID);

    // Confirm Marwan Serry is STILL excluded from leaderboard, groups & tournament player stats!
    const lb = await scoreRepo.getLeaderboard();
    expect(lb.some((e) => e.player.id === MARWAN_PLAYER_ID)).toBe(false);
    const marwan = await playerRepo.get(MARWAN_PLAYER_ID);
    expect(marwan?.stats.totalPoints).toBe(0);
    expect(marwan?.stats.wins).toBe(0);
    await assertZeroViolations('12P Grand Final finished with Marwan');
  });

  it('Preset 48 (16 groups of 3, advance 2 -> 32-slot KO, 0 BYEs): full end-to-end groups -> knockouts -> Final -> revert bug & downstream review', async () => {
    await storage.resetToSeed({ ...SEED_PRESETS[48], includeDemoProgress: true });
    await assertZeroViolations('48P initial demo seed');

    const snap0 = await storage.readSnapshot();
    expect(snap0.groups.length).toBe(16);
    expect(snap0.settings.tournament.advancePerGroup).toBe(2);

    // Complete remaining group matches
    await fastCompleteRemainingGroupMatches();
    await assertZeroViolations('48P all 16 groups completed');

    // All 16 Round-of-32 knockout matches should now have real players (0 TBDs!)
    const r32 = (await matchRepo.list({ roundId: 'round-ko-32' })).sort((a, b) => a.slot - b.slot);
    expect(r32.length).toBe(16);
    expect(r32.every((m) => m.participants.every((p) => Boolean(p.playerId)))).toBe(true);

    // Test client revert bug on Group 1 Match 1 (before R32 match 1 starts!)
    const g1m1 = (await matchRepo.getByGroup('group-1'))[0]!;
    const origWinner = g1m1.result!.winnerId!;
    const origLoser = g1m1.participants.find((p) => p.playerId !== origWinner)!.playerId!;
    const g1m1Scores = (await scoreRepo.listByMatch(g1m1.id)).filter(
      (e) => e.playerId === origWinner && e.delta > 0 && !e.undoneByEventId
    );
    // Revert enough points from origWinner so origLoser leads strictly
    for (const ev of g1m1Scores) {
      await commands.revertEvent({
        matchId: g1m1.id,
        targetEventId: ev.id,
        byUserId: 'user-admin',
        reason: '48P revert bug check',
      });
    }
    const g1m1After = (await matchRepo.get(g1m1.id))!;
    expect(g1m1After.status).toBe('finished');
    expect(g1m1After.result?.winnerId).toBe(origLoser);
    await assertZeroViolations('48P client bug revert');

    // Play a Round of 32 match via commands (with red card + walkover on another match), then fast-forward to Final
    const r32m1 = (await matchRepo.get(r32[0].id))!;
    const r32m1p0 = r32m1.participants[0].playerId!;
    const r32m1p1 = r32m1.participants[1].playerId!;
    await commands.startMatch({ matchId: r32m1.id, actorUserId: 'user-admin' });
    await commands.applyPoint({ matchId: r32m1.id, segmentId: 'seg-1', playerId: r32m1p0, delta: 1, byUserId: 'user-admin' });
    await commands.applyCard({ matchId: r32m1.id, segmentId: 'seg-1', playerId: r32m1p1, card: 'red', byUserId: 'user-admin' });
    await commands.finishMatch({ matchId: r32m1.id, actorUserId: 'user-admin' });
    await assertZeroViolations('48P R32 match 1 finished with Red card');

    // Walkover on R32 match 2
    const r32m2 = (await matchRepo.get(r32[1].id))!;
    await commands.markAbsent({
      matchId: r32m2.id,
      playerId: r32m2.participants[1].playerId!,
      byUserId: 'user-admin',
    });
    await assertZeroViolations('48P R32 match 2 walkover');

    // Complete knockouts up to Semi-Finals, then play Semi-Finals & 1v1v1 Grand Final via commands
    await fastCompleteKnockoutsUntilRound('round-semi');
    await assertZeroViolations('48P Quarter-Finals finished -> Semi-Finals populated');

    const semis = (await matchRepo.list({ roundId: 'round-semi' })).sort((a, b) => a.slot - b.slot);
    expect(semis.length).toBe(2);
    const f1 = semis[0].participants[0].playerId!;
    const f2 = semis[1].participants[0].playerId!;
    await playStandardMatch(semis[0].id, f1, 2, 1);
    await playStandardMatch(semis[1].id, f2, 2, 0);
    await assertZeroViolations('48P Semi-Finals finished -> Finalists seated');

    const finalMatch = (await matchRepo.list({ type: 'final' }))[0]!;
    expect(finalMatch.participants.map((p) => p.playerId)).toEqual([f1, f2, MARWAN_PLAYER_ID]);
    await commands.startMatch({ matchId: finalMatch.id, actorUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-1', playerId: f1, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-3', playerId: f1, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: finalMatch.id, segmentId: 'seg-1', playerId: MARWAN_PLAYER_ID, delta: 1, byUserId: 'user-admin' });
    const finalRes = await commands.finishMatch({ matchId: finalMatch.id, actorUserId: 'user-admin' });
    expect(finalRes?.winnerId).toBe(f1);
    await assertZeroViolations('48P 1v1v1 Grand Final finished');

    // Downstream revert AFTER Final finished: revert Semi-Final 1 winner so Final must require Impact Preview!
    const sf1Scores = (await scoreRepo.listByMatch(semis[0].id)).filter(
      (e) => e.playerId === f1 && e.delta > 0 && !e.undoneByEventId
    );
    // Revert 1st point (1-1 tie -> SF1 loses winner -> Final is finished so MUST trigger Impact Preview!)
    let caught: CascadeConfirmationRequiredError | null = null;
    try {
      await commands.revertEvent({
        matchId: semis[0].id,
        targetEventId: sf1Scores[0].id,
        byUserId: 'user-admin',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught?.impact.reviewRequiredMatches.some((x) => x.matchId === finalMatch.id)).toBe(true);
    await assertZeroViolations('48P unconfirmed cascade on finished Final');
  });

  it('Preset 720 (240 groups of 3, 256-slot KO with 16 BYEs, 975 matches): full end-to-end groups -> 16 BYEs resolve -> knockouts -> 1v1v1 Marwan Final -> client revert bug + downstream Impact Preview', async () => {
    await storage.resetToSeed({ ...SEED_PRESETS[720], includeDemoProgress: true });
    await assertZeroViolations('720P initial demo seed');

    const init = await storage.readSnapshot();
    expect(init.groups.length).toBe(240);
    expect(init.matches.filter((m) => !m.isDemo).length).toBe(975);
    expect(detectScheduleConflicts(init.matches, init.settings.tournament)).toEqual([]);

    // Exercise live group match from seed (finish normal + walkover + tie-break on groups 13, 14, 15, 16)
    const g13Matches = await matchRepo.getByGroup('group-13');
    const g13Live = g13Matches.find((m) => m.status === 'live')!;
    const g13p0 = g13Live.participants[0].playerId!;
    const g13p1 = g13Live.participants[1].playerId!;
    await commands.applyPoint({ matchId: g13Live.id, segmentId: 'seg-6', playerId: g13p0, delta: 1, byUserId: 'user-admin' });
    await commands.applyCard({ matchId: g13Live.id, segmentId: 'seg-6', playerId: g13p1, card: 'yellow', byUserId: 'user-admin' });
    await commands.finishMatch({ matchId: g13Live.id, actorUserId: 'user-admin', autoOpenTieBreaker: true });
    await assertZeroViolations('720P live Group 13 match finished');

    // Walkover on Group 16 Match 1
    const g16Matches = await matchRepo.getByGroup('group-16');
    await commands.markAbsent({
      matchId: g16Matches[0].id,
      playerId: g16Matches[0].participants[1].playerId!,
      byUserId: 'user-admin',
    });
    await assertZeroViolations('720P Group 16 walkover');

    // Both absent -> void -> Super Admin override on Group 16 Match 2
    await commands.markAbsent({
      matchId: g16Matches[1].id,
      playerId: g16Matches[1].participants[0].playerId!,
      byUserId: 'user-admin',
    });
    const g16Void = await commands.markAbsent({
      matchId: g16Matches[1].id,
      playerId: g16Matches[1].participants[1].playerId!,
      byUserId: 'user-admin',
    });
    expect(g16Void.match.status).toBe('void');
    await commands.overrideResult({
      matchId: g16Matches[1].id,
      resultType: 'walkover',
      winnerId: g16Matches[1].participants[0].playerId!,
      reason: '720P void override',
      actorUserId: 'user-admin',
    });
    await assertZeroViolations('720P Group 16 both-absent override');

    // Complete all remaining 240 groups (leaving Group 240 Match 3 for real command completion!)
    // Make Group 240 Match 3 (g240m3P0 vs g240m3P1) the group decider so reverting Match 3 flips Group 240's qualifier!
    await fastCompleteRemainingGroupMatches(new Set(['group-240']));
    const g240Matches = await matchRepo.getByGroup('group-240');
    const g240m3P0 = g240Matches[2].participants[0].playerId!;
    const g240m3P1 = g240Matches[2].participants[1].playerId!;
    const deciderSet = new Set([g240m3P0, g240m3P1]);
    const g240m0Winner = g240Matches[0].participants.find((p) => p.playerId && deciderSet.has(p.playerId))!.playerId!;
    const g240m1Winner = g240Matches[1].participants.find((p) => p.playerId && deciderSet.has(p.playerId))!.playerId!;
    await playStandardMatch(g240Matches[0].id, g240m0Winner, 3, 1);
    await playStandardMatch(g240Matches[1].id, g240m1Winner, 3, 1);
    // Final group match completes Group 240 -> triggers ALL 16 BYEs & all 240 qualifiers into 256-slot KO!
    const { scoreEventIds: g240m3EvIds } = await playStandardMatch(g240Matches[2].id, g240m3P0, 3, 2);
    await assertZeroViolations('720P all 240 groups complete -> 16 BYEs + 112 play-in matches populated');

    // Verify all 16 BYE matches auto-finished & propagated into Round of 128!
    const r256 = (await matchRepo.list({ roundId: 'round-ko-256' })).sort((a, b) => a.slot - b.slot);
    expect(r256.length).toBe(128);
    const byeMatches = r256.filter((m) => m.participants.some((p) => p.isBye));
    expect(byeMatches.length).toBe(16);
    expect(byeMatches.every((m) => m.status === 'finished' && m.result?.reason === 'bye')).toBe(true);

    const r128 = (await matchRepo.list({ roundId: 'round-ko-128' })).sort((a, b) => a.slot - b.slot);
    // First 8 matches of Round of 128 should ALREADY have both BYE winners seated!
    for (let i = 0; i < 8; i++) {
      expect(r128[i].participants[0].playerId).toBeTruthy();
      expect(r128[i].participants[1].playerId).toBeTruthy();
    }

    // CLIENT'S REPORTED BUG at 720-player scale!
    // Revert 2 points of g240m3P0 on Group 240 Match 3 -> g240m3P1 now leads 2-1 -> flips Group 240 winner & moves KO Round of 256 bracket slot!
    const g240Before = (await groupRepo.getStandings('group-240'))!;
    const oldQual = g240Before.qualifierPlayerIds[0];
    const r256ContainingOld = r256.find((m) =>
      m.participants.some((p) => p.playerId === oldQual)
    )!;
    expect(r256ContainingOld).toBeTruthy();

    await commands.revertEvent({
      matchId: g240Matches[2].id,
      targetEventId: g240m3EvIds[0],
      byUserId: 'user-admin',
    });
    expect((await matchRepo.get(g240Matches[2].id))?.status).toBe('needsTieBreak');
    await commands.revertEvent({
      matchId: g240Matches[2].id,
      targetEventId: g240m3EvIds[1],
      byUserId: 'user-admin',
    });

    const g240m3Reverted = (await matchRepo.get(g240Matches[2].id))!;
    expect(g240m3Reverted.status).toBe('finished');
    expect(g240m3Reverted.result?.winnerId).toBe(g240m3P1);
    const g240After = (await groupRepo.getStandings('group-240'))!;
    expect(g240After.qualifierPlayerIds[0]).not.toBe(oldQual);
    const newQual = g240After.qualifierPlayerIds[0];
    const r256ContainingNew = (await matchRepo.list({ roundId: 'round-ko-256' })).find((m) =>
      m.participants.some((p) => p.playerId === newQual)
    );
    expect(r256ContainingNew).toBeTruthy();
    await assertZeroViolations('720P client bug revert moved winner, group standing, qualifier & R256 slot');

    // Start R128 match 1 (BYE winner vs BYE winner) so a downstream match has started, then test Impact Preview on a BYE-affecting group revert!
    const r128m1 = (await matchRepo.get(r128[0].id))!;
    await commands.startMatch({ matchId: r128m1.id, actorUserId: 'user-admin' });
    await commands.applyPoint({
      matchId: r128m1.id,
      segmentId: 'seg-1',
      playerId: r128m1.participants[0].playerId!,
      delta: 1,
      byUserId: 'user-admin',
    });
    // Now reopen Group 240 Match 3 -> allGroupsComplete flips false -> BYE winners clear -> r128m1 is LIVE so MUST require Impact Preview!
    let caught720: CascadeConfirmationRequiredError | null = null;
    try {
      await commands.reopenMatch({
        matchId: g240Matches[2].id,
        actorUserId: 'user-admin',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) caught720 = err;
    }
    expect(caught720).not.toBeNull();
    expect(caught720?.impact.reviewRequiredMatches.some((x) => x.matchId === r128m1.id)).toBe(true);
    await assertZeroViolations('720P downstream live R128 protected by Impact Preview');

    // Finish r128m1 cleanly, fast-forward through all 256-slot knockouts down to Semi-Finals, then play Semi-Finals + 1v1v1 Marwan Final!
    await commands.finishMatch({ matchId: r128m1.id, actorUserId: 'user-admin' });
    await fastCompleteKnockoutsUntilRound('round-semi');
    await assertZeroViolations('720P knockouts completed down to Semi-Finals');

    const semis720 = (await matchRepo.list({ roundId: 'round-semi' })).sort((a, b) => a.slot - b.slot);
    expect(semis720.length).toBe(2);
    const fin1 = semis720[0].participants[0].playerId!;
    const fin2 = semis720[1].participants[0].playerId!;
    await playStandardMatch(semis720[0].id, fin1, 3, 2);
    await playStandardMatch(semis720[1].id, fin2, 3, 1);

    const final720 = (await matchRepo.list({ type: 'final' }))[0]!;
    expect(final720.participants.map((p) => p.playerId)).toEqual([fin1, fin2, MARWAN_PLAYER_ID]);
    await commands.startMatch({ matchId: final720.id, actorUserId: 'user-admin' });
    await commands.applyPoint({ matchId: final720.id, segmentId: 'seg-1', playerId: fin2, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: final720.id, segmentId: 'seg-3', playerId: fin2, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: final720.id, segmentId: 'seg-1', playerId: fin1, delta: 1, byUserId: 'user-admin' });
    await commands.applyPoint({ matchId: final720.id, segmentId: 'seg-1', playerId: MARWAN_PLAYER_ID, delta: 1, byUserId: 'user-admin' });
    const done720 = await commands.finishMatch({ matchId: final720.id, actorUserId: 'user-admin' });
    expect(done720?.status).toBe('finished');
    expect(done720?.winnerId).toBe(fin2);
    await assertZeroViolations('720P 1v1v1 Grand Final with Marwan completed');
  }, 60_000);

  it('Regression: resolveNeedsReview with keepAsIs preserves the played match result AND passes all 9 invariants', async () => {
    await storage.resetToSeed({ ...SEED_PRESETS[12], includeDemoProgress: false });
    const g1Matches = await matchRepo.getByGroup('group-1');
    const g2Matches = await matchRepo.getByGroup('group-2');
    const pA = g1Matches[0].participants[0].playerId!;
    const pB = g1Matches[0].participants[1].playerId!;

    await playStandardMatch(g1Matches[0].id, pA, 3, 1);
    await playStandardMatch(g1Matches[1].id, g1Matches[1].participants[0].playerId!, 2, 0);
    await playStandardMatch(g1Matches[2].id, pA, 2, 0);
    for (const m of g2Matches) {
      await playStandardMatch(m.id, m.participants[0].playerId!, 2, 1);
    }

    const sf1 = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1.participants[0].playerId).toBe(pA);
    await playStandardMatch(sf1.id, pA, 3, 1);

    // Upstream Group 1 changes after SF1 already finished -> mark SF1 needsReview
    await commands.overrideResult({
      matchId: g1Matches[0].id,
      resultType: 'walkover',
      winnerId: pB,
      reason: 'Late committee review',
      actorUserId: 'user-admin',
      confirmCascade: true,
      cascadePolicy: 'markNeedsReview',
    });
    expect((await matchRepo.get(sf1.id))?.status).toBe('needsReview');

    // Now Super Admin chooses keepAsIs! SF1 must STAY finished with pA as winner AND pass checkInvariants!
    await commands.resolveNeedsReview({
      matchId: sf1.id,
      action: 'keepAsIs',
      reason: 'Semi-final already broadcast live; keep standing result',
      actorUserId: 'user-admin',
    });
    const sf1Kept = (await matchRepo.get(sf1.id))!;
    expect(sf1Kept.status).toBe('finished');
    expect(sf1Kept.result?.winnerId).toBe(pA);
    expect(sf1Kept.replayEpoch).toBe(0);
    await assertZeroViolations('resolveNeedsReview keepAsIs');
  });

  it('Regression: reopenMatch rejects cleanly with CommandValidationError when participant is live in a sibling group match (instead of InvariantViolationError)', async () => {
    await storage.resetToSeed({ ...SEED_PRESETS[12], includeDemoProgress: false });
    const g1Matches = await matchRepo.getByGroup('group-1');
    const [m1, , m3] = g1Matches; // m1 = A vs B, m3 = A vs C (share player A!)
    const pA = m1.participants[0].playerId!;

    await playStandardMatch(m1.id, pA, 2, 1);
    await commands.startMatch({ matchId: m3.id, actorUserId: 'user-admin' });

    await expect(
      commands.reopenMatch({ matchId: m1.id, actorUserId: 'user-admin' })
    ).rejects.toBeInstanceOf(CommandValidationError);
    await assertZeroViolations('reopenMatch sibling live guard');
  });

  it('Regression: finishing last group match reports the actual group qualifier in advancedTo (even when a different player won the last match)', async () => {
    await storage.resetToSeed({ ...SEED_PRESETS[12], includeDemoProgress: false });
    const [m1, m2, m3] = await matchRepo.getByGroup('group-1');
    // m1: A vs B, m2: B vs C, m3: A vs C
    const pA = m1.participants[0].playerId!;
    const pB = m1.participants[1].playerId!;
    // A wins both m1 and m3 (6 pts -> Group 1 winner!)
    await playStandardMatch(m1.id, pA, 3, 1);
    await playStandardMatch(m3.id, pA, 3, 1);
    // Now m2 (B vs C) is played LAST -> B wins m2, finishing Group 1, while A advances to Semi-Final 1!
    const { fin } = await playStandardMatch(m2.id, pB, 2, 1);
    expect(fin.winnerId).toBe(pB);
    expect(fin.advancedTo?.length).toBe(1);
    expect(fin.advancedTo?.[0].playerId).toBe(pA);
    await assertZeroViolations('advancedTo reports actual group qualifier');
  });
});
