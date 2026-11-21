import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '@/lib/storage';
import { commands } from '@/lib/commands';
import { checkInvariants } from '@/lib/engine';
import { groupRepo, matchRepo, playerRepo, scoreRepo } from '@/lib/repos';

describe('Reported Bug Regression: Admin revert flipping winner on finished match', () => {
  beforeEach(async () => {
    await storage.resetToSeed({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      includeDemoProgress: false,
    });
  });

  it('reverts entries so second place leads: winner tag, result, group standings, player stats, and downstream qualifier ALL move to the new leader', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const [m1, m2, m3] = g1Matches;
    const pA = m1.participants[0].playerId!;
    const pB = m1.participants[1].playerId!;
    const pC = m2.participants.find((p) => p.playerId !== pA && p.playerId !== pB)!.playerId!;

    // Play m1 (A vs B): A scores +1, +1, +1 (=3); B scores +1, +1 (=2) -> A wins m1
    await commands.startMatch({ matchId: m1.id, actorUserId: 'user-admin' });
    const evA1 = await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    const evA2 = await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-3',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-6',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pB,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-3',
      playerId: pB,
      delta: 1,
      byUserId: 'user-admin',
    });
    const fin1 = await commands.finishMatch({ matchId: m1.id, actorUserId: 'user-admin' });
    expect(fin1?.status).toBe('finished');
    expect(fin1?.match.result?.winnerId).toBe(pA);
    expect(fin1?.match.winnerPlayerId).toBe(pA);

    // Finish remaining Group 1 matches: B beats C (2-0), A beats C (2-0)
    // So initially A has 6 pts (2W) and qualifies from Group 1 -> Semi-Final 1!
    for (const [match, winnerId] of [
      [m2, m2.participants[0].playerId === pC ? m2.participants[1].playerId! : m2.participants[0].playerId!],
      [m3, m3.participants[0].playerId === pC ? m3.participants[1].playerId! : m3.participants[0].playerId!],
    ] as const) {
      await commands.startMatch({ matchId: match.id, actorUserId: 'user-admin' });
      await commands.applyPoint({
        matchId: match.id,
        segmentId: 'seg-1',
        playerId: winnerId,
        delta: 1,
        byUserId: 'user-admin',
      });
      await commands.applyPoint({
        matchId: match.id,
        segmentId: 'seg-3',
        playerId: winnerId,
        delta: 1,
        byUserId: 'user-admin',
      });
      await commands.finishMatch({ matchId: match.id, actorUserId: 'user-admin' });
    }

    // Confirm A leads Group 1 and occupies Semi-Final 1 Slot 0
    const sf1Before = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1Before.participants[0].playerId).toBe(pA);

    // NOW: Super Admin reverts TWO of A's +1 entries on finished m1 -> A drops from 3 to 1, B leads 2 to 1!
    await commands.revertEvent({
      matchId: m1.id,
      targetEventId: evA1.id,
      byUserId: 'user-admin',
      reason: 'Wrong buzzer call',
    });
    // After 1st revert (2-2 tie): m1 MUST immediately transition to needsTieBreak with NO winner!
    const m1AfterFirstRevert = await matchRepo.get(m1.id);
    expect(m1AfterFirstRevert?.status).toBe('needsTieBreak');
    expect(m1AfterFirstRevert?.result).toBeNull();
    expect(m1AfterFirstRevert?.winnerPlayerId).toBeUndefined();

    // After 2nd revert (A=1, B=2): B now strictly leads -> winner tag MUST move to B!
    await commands.revertEvent({
      matchId: m1.id,
      targetEventId: evA2.id,
      byUserId: 'user-admin',
      reason: 'Second scoring correction',
    });

    const totals = await scoreRepo.getGameTotals(m1.id);
    expect(totals[pA]).toBe(1);
    expect(totals[pB]).toBe(2);

    const m1Updated = await matchRepo.get(m1.id);
    expect(m1Updated?.status).toBe('finished');
    expect(m1Updated?.result?.winnerId).toBe(pB);
    expect(m1Updated?.winnerPlayerId).toBe(pB);

    // Group 1 standings now rank B #1 (6 pts, 2W) over A (3 pts, 1W) -> B qualifies!
    const standings = await groupRepo.getStandings('group-1');
    expect(standings?.isComplete).toBe(true);
    expect(standings?.rows[0].playerId).toBe(pB);
    expect(standings?.qualifierPlayerIds).toEqual([pB]);

    // Downstream scheduled Semi-Final 1 Slot 0 auto-updated from A -> B!
    const sf1After = await matchRepo.get(sf1Before.id);
    expect(sf1After?.participants[0].playerId).toBe(pB);

    // Player stats & statuses recomputed cleanly: B is active (2W), A is eliminated (1W)
    const playerA = await playerRepo.get(pA);
    const playerB = await playerRepo.get(pB);
    expect(playerB?.stats.wins).toBe(2);
    expect(playerA?.stats.wins).toBe(1);
    expect(playerB?.status).toBe('active');
    expect(playerA?.status).toBe('eliminated');

    // All 9 invariants pass
    const report = checkInvariants(await storage.readSnapshot());
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });
});
