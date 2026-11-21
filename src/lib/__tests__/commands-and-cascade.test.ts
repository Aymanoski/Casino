import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CascadeConfirmationRequiredError,
  commands,
  VersionConflictError,
} from '@/lib/commands';
import { checkInvariants } from '@/lib/engine';
import { realtime } from '@/lib/realtime';
import {
  auditRepo,
  matchRepo,
  PermissionDeniedError,
  playerRepo,
  scoreRepo,
  userRepo,
} from '@/lib/repos';
import { storage } from '@/lib/storage';

async function playAndFinishGroup(groupId: string, preferredWinnerId?: string) {
  const matches = await matchRepo.getByGroup(groupId);
  let lastWinnerScoreEvId = '';
  let decidingMatchId = '';

  for (const m of matches) {
    const p0 = m.participants[0].playerId!;
    const p1 = m.participants[1].playerId!;
    const winner =
      preferredWinnerId && (p0 === preferredWinnerId || p1 === preferredWinnerId)
        ? preferredWinnerId
        : p0;
    const loser = winner === p0 ? p1 : p0;

    await commands.startMatch({ matchId: m.id, actorUserId: 'user-admin' });
    const ev1 = await commands.applyPoint({
      matchId: m.id,
      segmentId: 'seg-1',
      playerId: winner,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: m.id,
      segmentId: 'seg-3',
      playerId: winner,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: m.id,
      segmentId: 'seg-1',
      playerId: loser,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.finishMatch({ matchId: m.id, actorUserId: 'user-admin' });

    if (winner === preferredWinnerId && !decidingMatchId) {
      decidingMatchId = m.id;
      lastWinnerScoreEvId = ev1.id;
    }
  }
  return { decidingMatchId, lastWinnerScoreEvId };
}

describe('Command Pipeline, Cascades, Impact Preview, Permissions, Undo, Invariants & IndexedDB Scale', () => {
  beforeEach(async () => {
    await storage.resetToSeed({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      includeDemoProgress: false,
    });
  });

  it('requires Impact Preview confirmation when reverting after a downstream match has started, and enforces both markNeedsReview and invalidateForReplay policies', async () => {
    const g1 = (await storage.readSnapshot()).groups.find((g) => g.id === 'group-1')!;
    const g2 = (await storage.readSnapshot()).groups.find((g) => g.id === 'group-2')!;
    const pA = g1.playerIds[0];
    const pB = g1.playerIds[1];

    // Finish Group 1 (pA wins both matches) and Group 2 (g2.playerIds[0] wins)
    const { decidingMatchId } = await playAndFinishGroup('group-1', pA);
    await playAndFinishGroup('group-2', g2.playerIds[0]);

    // Semi-Final 1 now has pA vs g2.playerIds[0] — START Semi-Final 1 so it is LIVE!
    const sf1 = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1.participants[0].playerId).toBe(pA);
    await commands.startMatch({ matchId: sf1.id, actorUserId: 'user-admin' });
    await commands.applyPoint({
      matchId: sf1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });

    // Now Super Admin attempts to override Group 1's deciding match so pB wins instead (WITHOUT confirmCascade)
    let caught: CascadeConfirmationRequiredError | null = null;
    try {
      await commands.overrideResult({
        matchId: decidingMatchId,
        resultType: 'walkover',
        winnerId: pB,
        reason: 'Referee video review',
        actorUserId: 'user-admin',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        caught = err;
      }
    }

    // Must block with CascadeConfirmationRequiredError and NOT mutate DB!
    expect(caught).not.toBeNull();
    expect(caught?.impact.requiresConfirmation).toBe(true);
    expect(caught?.impact.reviewRequiredMatches.some((x) => x.matchId === sf1.id)).toBe(true);
    expect((await matchRepo.get(sf1.id))?.status).toBe('live');

    // Confirm with policy = 'markNeedsReview' -> SF1 flagged needsReview (history preserved!)
    await commands.overrideResult({
      matchId: decidingMatchId,
      resultType: 'walkover',
      winnerId: pB,
      reason: 'Referee video review',
      actorUserId: 'user-admin',
      confirmCascade: true,
      cascadePolicy: 'markNeedsReview',
    });

    const sf1Marked = await matchRepo.get(sf1.id);
    expect(sf1Marked?.status).toBe('needsReview');
    expect(sf1Marked?.participants[0].playerId).toBe(pA); // History NOT silently rewritten!

    // Now resolve needsReview with 'invalidateForReplay' -> epoch incremented, participants updated to pB, reset to scheduled!
    await commands.resolveNeedsReview({
      matchId: sf1.id,
      action: 'invalidateForReplay',
      actorUserId: 'user-admin',
    });

    const sf1Replayed = await matchRepo.get(sf1.id);
    expect(sf1Replayed?.status).toBe('scheduled');
    expect(sf1Replayed?.replayEpoch).toBe(1);
    expect(sf1Replayed?.participants[0].playerId).toBe(pB);
    // Past score event from epoch 0 is still preserved in append-only event log (never deleted!)
    const sf1Events = await scoreRepo.listByMatch(sf1.id);
    expect(sf1Events.length).toBe(1);
    expect(sf1Events[0].replayEpoch).toBe(0);
    // Current epoch totals start fresh at 0
    const sf1Totals = await scoreRepo.getGameTotals(sf1.id);
    expect(sf1Totals[pB]).toBe(0);

    // Audit log includes automatic cascade entries
    const audits = await auditRepo.list({ requesterUserId: 'user-admin' });
    expect(audits.some((a) => a.automatic && a.entityType === 'cascade')).toBe(true);
    expect(checkInvariants(await storage.readSnapshot()).ok).toBe(true);
  });

  it('enforces absence reversal cascade (walkover undone -> returns to scheduled and clears downstream qualifier)', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const [m1, m2, m3] = g1Matches;
    const pA = m1.participants[0].playerId!;
    const pB = m1.participants[1].playerId!;

    // Complete m2 and m3 cleanly, and finish m1 via walkover (pB absent -> pA wins)
    await commands.markAbsent({
      matchId: m1.id,
      playerId: pB,
      byUserId: 'user-admin',
    });
    expect((await matchRepo.get(m1.id))?.result?.type).toBe('walkover');
    expect((await matchRepo.get(m1.id))?.result?.winnerId).toBe(pA);

    for (const m of [m2, m3]) {
      const winner = m.participants[0].playerId!;
      await commands.startMatch({ matchId: m.id, actorUserId: 'user-admin' });
      await commands.applyPoint({
        matchId: m.id,
        segmentId: 'seg-1',
        playerId: winner,
        delta: 1,
        byUserId: 'user-admin',
      });
      await commands.finishMatch({ matchId: m.id, actorUserId: 'user-admin' });
    }

    // Group 1 is complete -> SF1 Slot 0 filled
    const sf1Before = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1Before.participants[0].playerId).not.toBeNull();

    // Reverse pB's absence in m1 -> m1 reverts to scheduled -> Group 1 no longer complete -> SF1 Slot 0 returns to null (TBD)!
    await commands.reverseAbsence({
      matchId: m1.id,
      playerId: pB,
      byUserId: 'user-admin',
    });

    const m1After = await matchRepo.get(m1.id);
    expect(m1After?.status).toBe('scheduled');
    expect(m1After?.result).toBeNull();

    const sf1After = await matchRepo.get(sf1Before.id);
    expect(sf1After?.participants[0].playerId).toBeNull();
    expect(checkInvariants(await storage.readSnapshot()).ok).toBe(true);
  });

  it('enforces undo rules (compensating append-only, no double-undo, scorer own-only) and optimistic concurrency version checks', async () => {
    const m = (await matchRepo.getByGroup('group-1'))[0];
    const assignedJudge = m.judgeUserId;
    const otherJudge = assignedJudge === 'user-scorer-1' ? 'user-scorer-2' : 'user-scorer-1';
    const p0 = m.participants[0].playerId!;

    await commands.startMatch({ matchId: m.id, actorUserId: assignedJudge });
    const started = (await matchRepo.get(m.id))!;

    // Stale version check throws friendly VersionConflictError
    await expect(
      commands.applyPoint({
        matchId: m.id,
        segmentId: 'seg-1',
        playerId: p0,
        delta: 1,
        byUserId: assignedJudge,
        expectedVersion: started.version - 1,
      })
    ).rejects.toBeInstanceOf(VersionConflictError);

    // Other scorer is blocked by permission guard
    await expect(
      commands.applyPoint({
        matchId: m.id,
        segmentId: 'seg-1',
        playerId: p0,
        delta: 1,
        byUserId: otherJudge,
      })
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    // Assigned judge gives yellow card (-1), then undoes own last action
    const yellow = await commands.applyCard({
      matchId: m.id,
      segmentId: 'seg-1',
      playerId: p0,
      card: 'yellow',
      byUserId: assignedJudge,
    });
    expect((await scoreRepo.getMatchScoreSummary(m.id)).yellowCardsByPlayer[p0]).toBe(1);

    const undoEv = await commands.undoLastScore({
      matchId: m.id,
      byUserId: assignedJudge,
      onlyOwn: true,
    });
    expect(undoEv?.kind).toBe('undo');
    expect(undoEv?.delta).toBe(1);
    expect(undoEv?.targetEventId).toBe(yellow.id);

    // Original event was NOT deleted; totals & yellow cards both back to 0!
    const allEvs = await scoreRepo.listByMatch(m.id);
    expect(allEvs.length).toBe(2);
    const summaryAfter = await scoreRepo.getMatchScoreSummary(m.id);
    expect(summaryAfter.totals[p0]).toBe(0);
    expect(summaryAfter.yellowCardsByPlayer[p0]).toBe(0);

    // Attempting to revert the already-undone event again returns null (no double undo!)
    const secondUndo = await commands.revertEvent({
      matchId: m.id,
      targetEventId: yellow.id,
      byUserId: 'user-admin',
    });
    expect(secondUndo).toBeNull();
  });

  it('enforces repository-level player segment secrecy & role-scoped contact visibility', async () => {
    const m = (await matchRepo.getByGroup('group-1'))[0];

    // Scheduled match -> player role receives ZERO segmentIds!
    const asPlayerScheduled = await matchRepo.get(m.id, { viewerRole: 'player' });
    expect(asPlayerScheduled?.segmentIds).toEqual([]);

    // Scorer role receives full segmentIds
    const asScorer = await matchRepo.get(m.id, { viewerRole: 'scorer' });
    expect(asScorer?.segmentIds.length).toBeGreaterThan(0);

    // Finish match -> player role CAN now see segments in post-match history!
    await commands.startMatch({ matchId: m.id, actorUserId: 'user-admin' });
    await commands.applyPoint({
      matchId: m.id,
      segmentId: 'seg-1',
      playerId: m.participants[0].playerId!,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.finishMatch({ matchId: m.id, actorUserId: 'user-admin' });

    const asPlayerFinished = await matchRepo.get(m.id, { viewerRole: 'player' });
    expect(asPlayerFinished?.segmentIds.length).toBeGreaterThan(0);

    // Contact visibility: judge assigned to m can view player contact (and logs contact.viewed)
    const p0 = m.participants[0].playerId!;
    const contact = await playerRepo.getContactForActor(p0, m.judgeUserId, m.id);
    expect(contact?.phone).toMatch(/^010-0000-/);
    const contactAudits = await auditRepo.list({
      entityType: 'contact',
      requesterUserId: 'user-admin',
    });
    expect(contactAudits.some((a) => a.action === 'contact.viewed' && a.entityId === p0)).toBe(true);

    // Player can view their own upcoming match's judge contact, denied for unrelated judge
    const p1Matches = (await matchRepo.list()).filter(
      (x) => x.status === 'scheduled' && x.participants.some((p) => p.playerId === 'player-1')
    );
    if (p1Matches[0]) {
      const judgeContact = await userRepo.getJudgeContactForActor(
        p1Matches[0].judgeUserId,
        'user-player-1',
        p1Matches[0].id
      );
      expect(judgeContact?.phone).toBeTruthy();
    }
  });

  it('detects corrupted derived state in Consistency Check and repairs 100% by recomputation', async () => {
    const m = (await matchRepo.getByGroup('group-1'))[0];
    const p0 = m.participants[0].playerId!;
    const p1 = m.participants[1].playerId!;

    await commands.startMatch({ matchId: m.id, actorUserId: 'user-admin' });
    await commands.applyPoint({
      matchId: m.id,
      segmentId: 'seg-1',
      playerId: p0,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.finishMatch({ matchId: m.id, actorUserId: 'user-admin' });

    // Deliberately tamper directly with IndexedDB snapshot to simulate legacy corruption
    const tampered = await storage.readSnapshot();
    const mIdx = tampered.matches.findIndex((x) => x.id === m.id);
    tampered.matches[mIdx] = {
      ...tampered.matches[mIdx],
      winnerPlayerId: p1, // WRONG winner!
      result: { type: 'normal', winnerId: p1, reason: 'score' },
    };
    const pIdx = tampered.players.findIndex((x) => x.id === p0);
    tampered.players[pIdx] = {
      ...tampered.players[pIdx],
      stats: { ...tampered.players[pIdx].stats, wins: 99 }, // WRONG stats!
    };
    tampered.scoreEvents.push({
      id: 'orphan-ev-1',
      matchId: 'non-existent-match',
      gameId: 'non-existent-match',
      segmentId: 'seg-1',
      playerId: p0,
      delta: 5,
      kind: 'point',
      byUserId: 'user-admin',
      replayEpoch: 0,
      createdAt: new Date().toISOString(),
    });
    await storage.writeSnapshot(tampered);

    // Consistency check MUST catch all 3 corruption types!
    const brokenReport = await commands.runConsistencyCheck('user-admin');
    expect(brokenReport.ok).toBe(false);
    const codes = new Set(brokenReport.violations.map((v) => v.code));
    expect(codes.has('FINISHED_MATCH_SINGLE_VALID_WINNER')).toBe(true);
    expect(codes.has('STORED_STATS_MATCH_RECOMPUTED')).toBe(true);
    expect(codes.has('NO_ORPHAN_EVENTS')).toBe(true);

    // Repair by recomputation fixes EVERYTHING from the event log!
    const repaired = await commands.repairByRecomputation('user-admin');
    expect(repaired.afterReport.ok).toBe(true);
    expect(repaired.afterReport.violations).toEqual([]);
    expect((await matchRepo.get(m.id))?.winnerPlayerId).toBe(p0);
    expect((await playerRepo.get(p0))?.stats.wins).toBe(1);
  });

  it('broadcasts realtime events strictly AFTER IndexedDB commit completes', async () => {
    const m = (await matchRepo.getByGroup('group-1'))[0];
    const p0 = m.participants[0].playerId!;
    await commands.startMatch({ matchId: m.id, actorUserId: 'user-admin' });

    let observedPointsInIDBAtBroadcastTime = -999;
    const unsub = realtime.subscribe('score.changed', () => {
      // Read directly from IndexedDB via match query right as broadcast fires
      void storage.getScoreEventsByMatch(m.id).then((evs) => {
        observedPointsInIDBAtBroadcastTime = evs
          .filter((e) => e.playerId === p0)
          .reduce((sum, e) => sum + e.delta, 0);
      });
    });

    await commands.applyPoint({
      matchId: m.id,
      segmentId: 'seg-1',
      playerId: p0,
      delta: 1,
      byUserId: 'user-admin',
    });

    // Wait one microtask tick for the async IDB get inside listener
    await new Promise((r) => setTimeout(r, 20));
    unsub();

    expect(observedPointsInIDBAtBroadcastTime).toBe(1);
  });

  it('IndexedDB storage handles 1,000+ matches and 100,000+ events smoothly with fast indexed reads & delta commits', async () => {
    // Seed full 720-player tournament (976 matches) + extend to 1,005 matches + 100,000 events
    const snap = await storage.resetToSeed({ totalPlayers: 720, includeDemoProgress: false });
    const baseMatch = snap.matches[0];
    const extraMatches = Array.from({ length: 30 }, (_, i) => ({
      ...baseMatch,
      id: `match-scale-extra-${i + 1}`,
      groupId: undefined,
      type: 'knockout' as const,
      isDemo: true,
    }));
    const targetMatch = snap.matches.find((m) => m.type === 'group')!;
    const p0 = targetMatch.participants[0].playerId!;
    const p1 = targetMatch.participants[1].playerId!;

    // Generate 100,000 events across the first 500 matches (200 events each)
    const bulkEvents = Array.from({ length: 100_000 }, (_, i) => {
      const m = snap.matches[i % 500];
      const pid = i % 2 === 0 ? (m.participants[0].playerId ?? p0) : (m.participants[1].playerId ?? p1);
      return {
        id: `se-scale-${i}`,
        matchId: m.id,
        gameId: m.id,
        segmentId: 'seg-1',
        playerId: pid,
        delta: 1,
        kind: 'point' as const,
        byUserId: 'user-scorer-1',
        replayEpoch: 0,
        createdAt: '2027-03-05T19:00:00.000Z',
      };
    });

    await storage.commitDelta({
      putMatches: extraMatches,
      putScoreEvents: bulkEvents,
    });

    const counts = await storage.getStoreCounts();
    expect(counts.matches).toBeGreaterThanOrEqual(1000);
    expect(counts.scoreEvents).toBeGreaterThanOrEqual(100_000);

    // Indexed single-match query MUST be super fast (does not scan 100,000 events in JS!)
    const t0 = performance.now();
    const matchEvs = await storage.getScoreEventsByMatch(targetMatch.id);
    const readMs = performance.now() - t0;
    expect(matchEvs.length).toBe(200);
    expect(readMs).toBeLessThan(500);

    // Single delta commit on top of 100,000 events MUST be fast
    const t1 = performance.now();
    await storage.commitDelta({
      putScoreEvents: [
        {
          id: 'se-scale-delta-1',
          matchId: targetMatch.id,
          gameId: targetMatch.id,
          segmentId: 'seg-1',
          playerId: p0,
          delta: 1,
          kind: 'point',
          byUserId: 'user-scorer-1',
          replayEpoch: 0,
          createdAt: '2027-03-05T19:05:00.000Z',
        },
      ],
    });
    const writeMs = performance.now() - t1;
    expect(writeMs).toBeLessThan(500);
    expect((await storage.getScoreEventsByMatch(targetMatch.id)).length).toBe(201);
  });
});
