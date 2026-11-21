import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CascadeConfirmationRequiredError,
  CommandValidationError,
  commands,
} from '@/lib/commands';
import { checkInvariants, computeMatchScores } from '@/lib/engine';
import {
  auditRepo,
  matchRepo,
  PermissionDeniedError,
  playerRepo,
  scoreRepo,
} from '@/lib/repos';
import { SegmentSchema } from '@/lib/schemas';
import { createSegmentsSeed } from '@/lib/seed';
import { storage } from '@/lib/storage';
import {
  canViewPlayerContactForMatch,
  formatScoreEventDisplay,
  stripCardNotePrefix,
} from '@/lib/utils/scorerFormat';

describe('CR1 Step 3 — Scorer Console v2 Rules (Cards, Absent, Both Absent, Tie, Undo, Contact, No Presets)', () => {
  beforeEach(async () => {
    await storage.resetToSeed({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      includeDemoProgress: false,
    });
  });

  it('removes presetPoints from SegmentSchema and all seeded segments, and rejects arbitrary custom amounts', async () => {
    const seededSegments = createSegmentsSeed();
    expect(seededSegments.length).toBeGreaterThanOrEqual(16);
    for (const seg of seededSegments) {
      expect('presetPoints' in seg).toBe(false);
      expect(SegmentSchema.safeParse(seg).success).toBe(true);
    }

    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const pA = m1.participants[0].playerId!;

    await commands.startMatch({ matchId: m1.id, actorUserId: 'user-admin' });

    // Valid +1 and -1 succeed
    const evPlus = await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      note: 'Fast buzz',
      byUserId: 'user-admin',
    });
    expect(evPlus.delta).toBe(1);
    expect(evPlus.kind).toBe('point');

    const evMinus = await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: -1,
      note: 'Wrong lyric',
      byUserId: 'user-admin',
    });
    expect(evMinus.delta).toBe(-1);

    // Arbitrary custom amounts (+10, +5, -5, 0) are strictly rejected
    for (const badDelta of [10, 5, -5, 2, -2, 0, 15]) {
      await expect(
        commands.applyPoint({
          matchId: m1.id,
          segmentId: 'seg-1',
          playerId: pA,
          delta: badDelta,
          byUserId: 'user-admin',
        })
      ).rejects.toThrow(CommandValidationError);
    }

    // Editing a score event also enforces +1/-1/Yellow/Red strictly
    await expect(
      commands.editScoreEvent({
        eventId: evPlus.id,
        delta: 10,
        byUserId: 'user-admin',
      })
    ).rejects.toThrow(CommandValidationError);

    const editedToYellow = await commands.editScoreEvent({
      eventId: evPlus.id,
      delta: -1,
      kind: 'yellow',
      note: 'Converted to warning',
      byUserId: 'user-admin',
    });
    expect(editedToYellow?.kind).toBe('yellow');
    expect(editedToYellow?.delta).toBe(-1);
    expect(editedToYellow?.note).toBe('Yellow card (−1): Converted to warning');

    const inv = checkInvariants(await storage.readSnapshot());
    expect(inv.ok).toBe(true);
    expect(inv.violations).toEqual([]);
  });

  it('applies Yellow (−1) and Red (−2) cards with separate derived card counts, canonical labels & notes, and audit entries', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const pA = m1.participants[0].playerId!;
    const pB = m1.participants[1].playerId!;

    await commands.startMatch({ matchId: m1.id, actorUserId: 'user-admin' });

    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });

    const yellowEv = await commands.applyCard({
      matchId: m1.id,
      segmentId: 'seg-2',
      playerId: pA,
      card: 'yellow',
      note: 'Spoke out of turn',
      byUserId: 'user-admin',
    });
    const redEv = await commands.applyCard({
      matchId: m1.id,
      segmentId: 'seg-2',
      playerId: pB,
      card: 'red',
      note: 'Unsportsmanlike interruption',
      byUserId: 'user-admin',
    });

    expect(yellowEv.kind).toBe('yellow');
    expect(yellowEv.delta).toBe(-1);
    expect(yellowEv.note).toBe('Yellow card (−1): Spoke out of turn');

    expect(redEv.kind).toBe('red');
    expect(redEv.delta).toBe(-2);
    expect(redEv.note).toBe('Red card (−2): Unsportsmanlike interruption');

    // Display formatter strips duplicate prefix and outputs canonical EN & AR labels
    expect(stripCardNotePrefix(yellowEv.note)).toBe('Spoke out of turn');
    const yellowEn = formatScoreEventDisplay(yellowEv, 'en');
    expect(yellowEn.kindLabel).toBe('Yellow card (−1)');
    expect(yellowEn.userNote).toBe('Spoke out of turn');
    expect(yellowEn.cardType).toBe('yellow');

    const redAr = formatScoreEventDisplay(redEv, 'ar', true);
    expect(redAr.kindLabel).toBe('بطاقة حمراء (−٢)');
    expect(redAr.userNote).toBe('Unsportsmanlike interruption');
    expect(redAr.cardType).toBe('red');

    // Derived match score summary separates totals from card counts
    const summary = await scoreRepo.getMatchScoreSummary(m1.id);
    expect(summary.totals[pA]).toBe(1); // +1 +1 -1
    expect(summary.totals[pB]).toBe(-2); // -2
    expect(summary.yellowCardsByPlayer[pA]).toBe(1);
    expect(summary.redCardsByPlayer[pA]).toBe(0);
    expect(summary.yellowCardsByPlayer[pB]).toBe(0);
    expect(summary.redCardsByPlayer[pB]).toBe(1);

    // Player stats reflect card counts accurately
    const playerA = await playerRepo.get(pA);
    const playerB = await playerRepo.get(pB);
    expect(playerA?.stats.yellowCards).toBe(1);
    expect(playerB?.stats.redCards).toBe(1);

    // Audit log records Yellow card (−1) and Red card (−2) with notes
    const audit = await auditRepo.list({ requesterUserId: 'user-admin' });
    const yellowAudit = audit.find((a) => a.entityId === yellowEv.id);
    const redAudit = audit.find((a) => a.entityId === redEv.id);
    expect(yellowAudit?.action).toBe('score.yellowCard');
    expect(yellowAudit?.summary).toContain('Yellow card (−1)');
    expect(yellowAudit?.summary).toContain('Spoke out of turn');
    expect(redAudit?.action).toBe('score.redCard');
    expect(redAudit?.summary).toContain('Red card (−2)');
    expect(redAudit?.summary).toContain('Unsportsmanlike interruption');

    expect(checkInvariants(await storage.readSnapshot()).violations).toEqual([]);
  });

  it('reverts +1 and Yellow/Red cards via compensating Undo events (never deletes), restores card counts, and enforces own-action undo for judges', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const judgeId = m1.judgeUserId;
    const pA = m1.participants[0].playerId!;

    await commands.startMatch({ matchId: m1.id, actorUserId: judgeId });

    // Super Admin adds +1
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      delta: 1,
      byUserId: 'user-admin',
    });

    // Assigned judge issues Red card (-2)
    const redEv = await commands.applyCard({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: pA,
      card: 'red',
      note: 'Misclick card',
      byUserId: judgeId,
    });

    let summary = await scoreRepo.getMatchScoreSummary(m1.id);
    expect(summary.totals[pA]).toBe(-1); // +1 -2
    expect(summary.redCardsByPlayer[pA]).toBe(1);

    // Judge undoes own last action -> reverts the Red card, restores score to +1 and redCards to 0
    const undoEv = await commands.undoLastScore({
      matchId: m1.id,
      byUserId: judgeId,
      onlyOwn: true,
    });
    expect(undoEv).not.toBeNull();
    expect(undoEv?.kind).toBe('undo');
    expect(undoEv?.delta).toBe(2);
    expect(undoEv?.targetEventId).toBe(redEv.id);

    summary = await scoreRepo.getMatchScoreSummary(m1.id);
    expect(summary.totals[pA]).toBe(1);
    expect(summary.redCardsByPlayer[pA]).toBe(0);

    // Original event is still in the append-only log (never deleted)
    const allEvents = await scoreRepo.listByMatch(m1.id);
    expect(allEvents.some((e) => e.id === redEv.id && e.undoneByEventId === undoEv?.id)).toBe(
      true
    );

    // Judge tries to undo again with onlyOwn: true -> nothing left of judge's own actions (admin's +1 is untouched)
    const secondJudgeUndo = await commands.undoLastScore({
      matchId: m1.id,
      byUserId: judgeId,
      onlyOwn: true,
    });
    expect(secondJudgeUndo).toBeNull();

    // Double-reverting the same event is an idempotent no-op (returns null, does not double-credit)
    const doubleUndo = await commands.revertEvent({
      matchId: m1.id,
      targetEventId: redEv.id,
      byUserId: 'user-admin',
    });
    expect(doubleUndo).toBeNull();
    expect((await scoreRepo.getMatchScoreSummary(m1.id)).totals[pA]).toBe(1);

    expect(checkInvariants(await storage.readSnapshot()).violations).toEqual([]);
  });

  it('1v1 Mark Absent: ends immediately as walkover, awards +3 group points & advances knockout winner, and updates stats/audit', async () => {
    // 1) Group 1v1 walkover
    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const absentPid = m1.participants[0].playerId!;
    const presentPid = m1.participants[1].playerId!;

    await commands.markAbsent({
      matchId: m1.id,
      playerId: absentPid,
      reason: 'Did not arrive within 10 minutes',
      byUserId: m1.judgeUserId,
    });

    const updatedM1 = await matchRepo.get(m1.id);
    expect(updatedM1?.status).toBe('finished');
    expect(updatedM1?.result?.type).toBe('walkover');
    expect(updatedM1?.result?.winnerId).toBe(presentPid);

    const presentPlayer = await playerRepo.get(presentPid);
    const absentPlayer = await playerRepo.get(absentPid);
    expect(presentPlayer?.stats.groupPoints).toBe(3);
    expect(presentPlayer?.stats.wins).toBe(1);
    expect(absentPlayer?.stats.absences).toBe(1);

    // Finish remaining Group 1 & Group 2 matches so Semi-Final 1 populates
    for (const m of g1Matches.slice(1)) {
      const winner = m.participants.some((p) => p.playerId === presentPid)
        ? presentPid
        : m.participants[0].playerId!;
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
    const g2Matches = await matchRepo.getByGroup('group-2');
    for (const m of g2Matches) {
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

    // 2) Knockout 1v1 walkover automatically advances present player to the Grand Final!
    const sf1 = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    const koAbsent = sf1.participants[1].playerId!;
    const koWinner = sf1.participants[0].playerId!;
    expect(koWinner).toBe(presentPid);

    await commands.markAbsent({
      matchId: sf1.id,
      playerId: koAbsent,
      reason: 'No-show for knockout',
      byUserId: sf1.judgeUserId,
    });

    const updatedSf1 = await matchRepo.get(sf1.id);
    expect(updatedSf1?.status).toBe('finished');
    expect(updatedSf1?.result?.type).toBe('walkover');
    expect(updatedSf1?.result?.winnerId).toBe(koWinner);

    const finalMatch = (await matchRepo.list({ type: 'final' }))[0];
    expect(finalMatch.participants.some((p) => p.playerId === koWinner)).toBe(true);

    expect(checkInvariants(await storage.readSnapshot()).violations).toEqual([]);
  });

  it('Both absent in 1v1 makes match void requiring Super Admin decision; Super Admin can override or reverse absence with Impact Preview', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const p0 = m1.participants[0].playerId!;
    const p1 = m1.participants[1].playerId!;

    await commands.markAbsent({
      matchId: m1.id,
      playerId: p0,
      byUserId: 'user-admin',
    });

    // Duplicate markAbsent on same player is rejected
    await expect(
      commands.markAbsent({
        matchId: m1.id,
        playerId: p0,
        byUserId: 'user-admin',
      })
    ).rejects.toThrow(CommandValidationError);

    // Mark second player absent too -> match becomes void
    await commands.markAbsent({
      matchId: m1.id,
      playerId: p1,
      byUserId: 'user-admin',
    });

    const voidMatch = await matchRepo.get(m1.id);
    expect(voidMatch?.status).toBe('void');
    expect(voidMatch?.result?.type).toBe('void');
    expect(voidMatch?.result?.winnerId).toBeFalsy();

    // Judge cannot reverse absence (Super Admin only)
    await expect(
      commands.reverseAbsence({
        matchId: m1.id,
        playerId: p1,
        byUserId: m1.judgeUserId,
      })
    ).rejects.toThrow(PermissionDeniedError);

    // Super Admin reverses p1's absence -> returns to walkover win for p1
    await commands.reverseAbsence({
      matchId: m1.id,
      playerId: p1,
      reason: 'Arrived late with approval',
      byUserId: 'user-admin',
    });

    const walkoverAgain = await matchRepo.get(m1.id);
    expect(walkoverAgain?.status).toBe('finished');
    expect(walkoverAgain?.result?.type).toBe('walkover');
    expect(walkoverAgain?.result?.winnerId).toBe(p1);

    // Super Admin reverses p0's absence as well -> returns to scheduled (0 absences)
    await commands.reverseAbsence({
      matchId: m1.id,
      playerId: p0,
      reason: 'Rescheduled match',
      byUserId: 'user-admin',
    });

    const restoredMatch = await matchRepo.get(m1.id);
    expect(restoredMatch?.status).toBe('scheduled');
    expect((await playerRepo.get(p0))?.stats.absences).toBe(0);
    expect((await playerRepo.get(p1))?.stats.absences).toBe(0);

    // Re-trigger both absent, then resolve via Super Admin overrideResult
    await commands.markAbsent({ matchId: m1.id, playerId: p0, byUserId: 'user-admin' });
    await commands.markAbsent({ matchId: m1.id, playerId: p1, byUserId: 'user-admin' });
    expect((await matchRepo.get(m1.id))?.status).toBe('void');

    await commands.overrideResult({
      matchId: m1.id,
      resultType: 'walkover',
      winnerId: p0,
      reason: 'Admin awarded win after late check-in verification',
      actorUserId: 'user-admin',
    });

    const resolvedMatch = await matchRepo.get(m1.id);
    expect(resolvedMatch?.status).toBe('finished');
    expect(resolvedMatch?.result?.winnerId).toBe(p0);
    expect(resolvedMatch?.result?.overridden).toBe(true);

    expect(checkInvariants(await storage.readSnapshot()).violations).toEqual([]);
  });

  it('Super Admin reversing a group absence after downstream knockout started requires CascadeConfirmationRequiredError (Impact Preview)', async () => {
    const g1 = (await storage.readSnapshot()).groups.find((g) => g.id === 'group-1')!;
    const pA = g1.playerIds[0];
    const g1Matches = await matchRepo.getByGroup('group-1');
    const walkoverMatch = g1Matches.find((m) => m.participants.some((p) => p.playerId === pA))!;
    const walkoverLoser = walkoverMatch.participants.find((p) => p.playerId !== pA)!.playerId!;

    // pA wins walkoverMatch via walkover
    await commands.markAbsent({
      matchId: walkoverMatch.id,
      playerId: walkoverLoser,
      byUserId: 'user-admin',
    });

    // Finish remaining Group 1 & Group 2 matches so SF1 gets populated with pA
    for (const m of g1Matches.filter((x) => x.id !== walkoverMatch.id)) {
      const winner = m.participants.some((p) => p.playerId === pA)
        ? pA
        : m.participants[0].playerId!;
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
    for (const m of await matchRepo.getByGroup('group-2')) {
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

    // Start Semi-Final 1 so downstream match is live
    const sf1 = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1.participants[0].playerId).toBe(pA);
    await commands.startMatch({ matchId: sf1.id, actorUserId: 'user-admin' });

    // Reversing the absence in Group 1 without confirmCascade must throw CascadeConfirmationRequiredError
    let caught: unknown;
    try {
      await commands.reverseAbsence({
        matchId: walkoverMatch.id,
        playerId: walkoverLoser,
        byUserId: 'user-admin',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CascadeConfirmationRequiredError);
    const impact = (caught as CascadeConfirmationRequiredError).impact;
    expect(impact.affectedMatches.some((a) => a.matchId === sf1.id)).toBe(true);

    // Confirming cascade succeeds cleanly and preserves invariants
    await commands.reverseAbsence({
      matchId: walkoverMatch.id,
      playerId: walkoverLoser,
      byUserId: 'user-admin',
      confirmCascade: true,
      cascadePolicy: 'markNeedsReview',
    });

    const sf1After = await matchRepo.get(sf1.id);
    expect(sf1After?.status).toBe('needsReview');
    expect(checkInvariants(await storage.readSnapshot()).violations).toEqual([]);
  });

  it('Grand Final (1v1v1 with Marwan Serry): marking a finalist absent does NOT auto-end the match and prompts Super Admin decision', async () => {
    // Finish all 4 groups and 2 semi-finals so Grand Final has both finalists + Marwan
    for (const gId of ['group-1', 'group-2', 'group-3', 'group-4']) {
      for (const m of await matchRepo.getByGroup(gId)) {
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
    }
    for (const sf of await matchRepo.list({ type: 'knockout' })) {
      const winner = sf.participants[0].playerId!;
      await commands.startMatch({ matchId: sf.id, actorUserId: 'user-admin' });
      await commands.applyPoint({
        matchId: sf.id,
        segmentId: 'seg-1',
        playerId: winner,
        delta: 1,
        byUserId: 'user-admin',
      });
      await commands.finishMatch({ matchId: sf.id, actorUserId: 'user-admin' });
    }

    const finalMatch = (await matchRepo.list({ type: 'final' }))[0];
    expect(finalMatch.participants.length).toBe(3);
    const finalist = finalMatch.participants.find((p) => !p.guest)!.playerId!;
    const marwan = finalMatch.participants.find((p) => p.guest)!.playerId!;

    await commands.startMatch({ matchId: finalMatch.id, actorUserId: 'user-admin' });

    // Guest host Marwan cannot be marked absent
    await expect(
      commands.markAbsent({
        matchId: finalMatch.id,
        playerId: marwan,
        byUserId: 'user-admin',
      })
    ).rejects.toThrow(CommandValidationError);

    // Marking a finalist absent in the Final does NOT auto-end the match
    await commands.markAbsent({
      matchId: finalMatch.id,
      playerId: finalist,
      reason: 'Finalist delayed',
      byUserId: 'user-admin',
    });

    const finalAfter = await matchRepo.get(finalMatch.id);
    expect(finalAfter?.status).toBe('live');
    expect(finalAfter?.result).toBeNull();
    expect(checkInvariants(await storage.readSnapshot()).violations).toEqual([]);
  });

  it('Finishing a tied match requires a Tie-Breaker segment (seg-16) first, then finishes cleanly with result.type === normal', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const p0 = m1.participants[0].playerId!;
    const p1 = m1.participants[1].playerId!;

    await commands.startMatch({ matchId: m1.id, actorUserId: m1.judgeUserId });
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: p0,
      delta: 1,
      byUserId: m1.judgeUserId,
    });
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-1',
      playerId: p1,
      delta: 1,
      byUserId: m1.judgeUserId,
    });

    // Attempting to finish without autoOpenTieBreaker blocks and sets needsTieBreak
    const tieBlocked = await commands.finishMatch({
      matchId: m1.id,
      actorUserId: m1.judgeUserId,
      autoOpenTieBreaker: false,
    });
    expect(tieBlocked).not.toBeNull();
    expect(tieBlocked!.status).toBe('needsTieBreak');
    expect(tieBlocked!.match.status).toBe('needsTieBreak');

    // Attempting to finish with autoOpenTieBreaker appends Tie-Breaker #16 and keeps match live
    const tieResp = await commands.finishMatch({
      matchId: m1.id,
      actorUserId: m1.judgeUserId,
      autoOpenTieBreaker: true,
    });
    expect(tieResp).not.toBeNull();
    expect(tieResp!.status).toBe('tie_breaker_opened');
    expect(tieResp!.tiedPlayerIds).toContain(p0);
    expect(tieResp!.tiedPlayerIds).toContain(p1);
    expect(tieResp!.match.segmentIds).toContain('seg-16');

    // Break the tie in seg-16
    await commands.applyPoint({
      matchId: m1.id,
      segmentId: 'seg-16',
      playerId: p0,
      delta: 1,
      note: 'Sudden death winner',
      byUserId: m1.judgeUserId,
    });

    // Now finish succeeds with result.type === 'normal'
    const finResp = await commands.finishMatch({
      matchId: m1.id,
      actorUserId: m1.judgeUserId,
      autoOpenTieBreaker: true,
    });
    expect(finResp).not.toBeNull();
    expect(finResp!.status).toBe('finished');
    expect(finResp!.match.status).toBe('finished');
    expect(finResp!.match.result?.type).toBe('normal');
    expect(finResp!.match.result?.winnerId).toBe(p0);

    // Double check derived totals
    const db = await storage.readSnapshot();
    const scoreSummary = computeMatchScores(finResp!.match, db.scoreEvents);
    expect(scoreSummary.totals[p0]).toBe(2);
    expect(scoreSummary.totals[p1]).toBe(1);
    expect(checkInvariants(db).violations).toEqual([]);
  });

  it('Contact dialog visibility is strictly limited to assigned scorer, check-in staff, and super admin, and logs contact.viewed audit entries', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const m1 = g1Matches[0];
    const p0 = m1.participants[0].playerId!;
    const assignedScorerId = m1.judgeUserId;
    const otherScorerId = assignedScorerId === 'user-scorer-1' ? 'user-scorer-2' : 'user-scorer-1';

    // UI visibility helper checks
    const normalPlayer = { isGuest: false, isHost: false };
    const guestHost = { isGuest: true, isHost: true };
    expect(
      canViewPlayerContactForMatch(
        { id: assignedScorerId, role: 'scorer' },
        m1,
        normalPlayer
      )
    ).toBe(true);
    expect(
      canViewPlayerContactForMatch({ id: otherScorerId, role: 'scorer' }, m1, normalPlayer)
    ).toBe(false);
    expect(
      canViewPlayerContactForMatch({ id: 'user-checkin', role: 'checkIn' }, m1, normalPlayer)
    ).toBe(true);
    expect(
      canViewPlayerContactForMatch({ id: 'user-admin', role: 'superAdmin' }, m1, normalPlayer)
    ).toBe(true);
    expect(
      canViewPlayerContactForMatch({ id: 'user-content', role: 'content' }, m1, normalPlayer)
    ).toBe(false);
    // Guest host Marwan has no player contact button
    expect(
      canViewPlayerContactForMatch({ id: 'user-admin', role: 'superAdmin' }, m1, guestHost)
    ).toBe(false);

    // Repo permission checks + audit logging
    const assignedContact = await playerRepo.getContactForActor(p0, assignedScorerId);
    expect(assignedContact).not.toBeNull();
    expect(assignedContact!.phone).toBeTruthy();
    expect(assignedContact!.email).toBeTruthy();

    const checkInContact = await playerRepo.getContactForActor(p0, 'user-checkin');
    expect(checkInContact?.phone).toBe(assignedContact!.phone);

    const adminContact = await playerRepo.getContactForActor(p0, 'user-admin');
    expect(adminContact?.phone).toBe(assignedContact!.phone);

    // Unauthorized actors are blocked at the repo layer
    await expect(playerRepo.getContactForActor(p0, 'user-content')).rejects.toThrow(
      PermissionDeniedError
    );

    // Check unassigned scorer against a player who is NOT in any of their assigned matches
    const db = await storage.readSnapshot();
    const otherScorerPlayerIds = new Set(
      db.matches
        .filter((m) => !m.isDemo && m.judgeUserId === otherScorerId)
        .flatMap((m) => m.participants.map((p) => p.playerId).filter(Boolean))
    );
    const unassignedPlayer = db.players.find(
      (p) => !p.isGuest && !otherScorerPlayerIds.has(p.id)
    );
    if (unassignedPlayer) {
      await expect(
        playerRepo.getContactForActor(unassignedPlayer.id, otherScorerId)
      ).rejects.toThrow(PermissionDeniedError);
    }

    // Verify light contact.viewed audit entries were logged
    const audits = await auditRepo.list({
      requesterUserId: 'user-admin',
      entityType: 'contact',
    });
    const viewedByAssigned = audits.find(
      (a) =>
        a.action === 'contact.viewed' &&
        a.actorUserId === assignedScorerId &&
        a.entityId === p0
    );
    const viewedByCheckIn = audits.find(
      (a) =>
        a.action === 'contact.viewed' &&
        a.actorUserId === 'user-checkin' &&
        a.entityId === p0
    );
    expect(viewedByAssigned).toBeDefined();
    expect(viewedByCheckIn).toBeDefined();
  });
});
