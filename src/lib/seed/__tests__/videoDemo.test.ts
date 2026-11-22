import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '@/lib/engine';
import {
  CascadeConfirmationRequiredError,
  commands,
} from '@/lib/commands';
import {
  createVideoDemoSnapshot,
  VIDEO_DEMO_CONSTANTS,
  type VideoDemoPreset,
} from '@/lib/seed/videoDemo';
import { storage } from '@/lib/storage';

describe('Video Demo Deterministic States', () => {
  const presets: VideoDemoPreset[] = ['fresh', 'main', 'final'];

  for (const preset of presets) {
    it(`preset "${preset}" generates cleanly and passes all 9 invariants with 0 violations`, () => {
      const snap = createVideoDemoSnapshot(preset);
      expect(snap.players.filter((p) => !p.isGuest)).toHaveLength(720);
      expect(snap.groups).toHaveLength(240);

      const report = checkInvariants(snap);
      expect(report.violations).toEqual([]);
      expect(report.ok).toBe(true);
    });
  }

  it('end-to-end hero match lifecycle + Impact Preview revert cascade works authentically', async () => {
    const loaded = await commands.loadVideoDemoState('main');
    expect(loaded.violationsCount).toBe(0);

    // Hero match is scheduled on Table #1 with Scorer 1
    let db = await storage.readSnapshot();
    const heroMatch = db.matches.find((m) => m.id === VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID)!;
    expect(heroMatch.status).toBe('scheduled');
    expect(heroMatch.tableNumber).toBe(1);
    expect(heroMatch.judgeUserId).toBe(VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID);
    expect(heroMatch.playerIds).toEqual([
      VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID,
      VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID,
    ]);

    // Start match, score to 3-3 (including Yellow -1 and Red -2 on Mostafa), hit tie-break, Omar wins 4-3
    await commands.startMatch({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
      actorUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
    });

    const addPt = (pid: string, segId = 'seg-1') =>
      commands.applyPoint({
        matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
        segmentId: segId,
        playerId: pid,
        delta: 1,
        byUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
      });

    // Omar: +1, +1, +1 = 3
    await addPt(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID, 'seg-1');
    await addPt(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID, 'seg-3');
    await addPt(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID, 'seg-6');

    // Mostafa: +1 x 6 = 6, Yellow -1, Red -2 -> net 3 (tied 3-3!)
    for (let i = 0; i < 6; i++) {
      await addPt(VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID, 'seg-1');
    }
    await commands.applyCard({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
      segmentId: 'seg-3',
      playerId: VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID,
      card: 'yellow',
      note: 'False buzz',
      byUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
    });
    const redCardEvent = await commands.applyCard({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
      segmentId: 'seg-6',
      playerId: VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID,
      card: 'red',
      note: 'Disputed interruption',
      byUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
    });

    // Tied 3-3 -> finish triggers tie-break
    const tieRes = await commands.finishMatch({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
      actorUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
      autoOpenTieBreaker: true,
    });
    expect(tieRes).not.toBeNull();
    expect(tieRes!.status).toBe('tie_breaker_opened');

    // Omar scores sudden-death +1 -> wins 4-3
    await addPt(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID, 'seg-16');
    const finRes = await commands.finishMatch({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
      actorUserId: VIDEO_DEMO_CONSTANTS.HERO_JUDGE_ID,
    });
    expect(finRes).not.toBeNull();
    expect(finRes!.status).toBe('finished');
    expect(finRes!.match.result?.winnerId).toBe(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID);

    // Omar is automatically seated into Round of 256 Match 17!
    db = await storage.readSnapshot();
    const koMatch = db.matches.find((m) => m.id === VIDEO_DEMO_CONSTANTS.HERO_KO_MATCH_ID)!;
    expect(koMatch.playerIds).toContain(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID);

    // Start the downstream Round of 256 match so reverting triggers Impact Preview!
    await commands.startMatch({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_KO_MATCH_ID,
      actorUserId: VIDEO_DEMO_CONSTANTS.ADMIN_USER_ID,
    });

    // Reverting Mostafa's Red card (-2) without confirmation MUST throw CascadeConfirmationRequiredError
    let caughtImpact: CascadeConfirmationRequiredError | null = null;
    try {
      await commands.revertEvent({
        matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
        targetEventId: redCardEvent.id,
        byUserId: VIDEO_DEMO_CONSTANTS.ADMIN_USER_ID,
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        caughtImpact = err;
      } else {
        throw err;
      }
    }
    expect(caughtImpact).not.toBeNull();
    expect(
      caughtImpact!.impact.reviewRequiredMatches.some(
        (m) => m.matchId === VIDEO_DEMO_CONSTANTS.HERO_KO_MATCH_ID
      )
    ).toBe(true);

    // Confirm Impact Preview with invalidateForReplay -> winner flips to Mostafa & KO slot updates!
    await commands.revertEvent({
      matchId: VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID,
      targetEventId: redCardEvent.id,
      byUserId: VIDEO_DEMO_CONSTANTS.ADMIN_USER_ID,
      confirmCascade: true,
      cascadePolicy: 'invalidateForReplay',
    });

    db = await storage.readSnapshot();
    const updatedHero = db.matches.find((m) => m.id === VIDEO_DEMO_CONSTANTS.HERO_MATCH_ID)!;
    const updatedKo = db.matches.find((m) => m.id === VIDEO_DEMO_CONSTANTS.HERO_KO_MATCH_ID)!;
    expect(updatedHero.result?.winnerId).toBe(VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID);
    expect(updatedKo.status).toBe('scheduled');
    expect(updatedKo.playerIds).toContain(VIDEO_DEMO_CONSTANTS.OPPONENT_PLAYER_ID);
    expect(updatedKo.playerIds).not.toContain(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID);

    // Final preset has Omar, Salma, and Marwan Serry LIVE in match-final
    const finalLoaded = await commands.loadVideoDemoState('final');
    expect(finalLoaded.violationsCount).toBe(0);
    db = await storage.readSnapshot();
    const finalMatch = db.matches.find((m) => m.id === VIDEO_DEMO_CONSTANTS.FINAL_MATCH_ID)!;
    expect(finalMatch.status).toBe('live');
    expect(finalMatch.playerIds).toContain(VIDEO_DEMO_CONSTANTS.HERO_PLAYER_ID);
    expect(finalMatch.playerIds).toContain(VIDEO_DEMO_CONSTANTS.FINALIST_2_PLAYER_ID);
    expect(finalMatch.playerIds).toContain('player-marwan');
  });
});
