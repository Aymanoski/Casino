import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { commands, CommandValidationError } from '@/lib/commands';
import {
  autoScheduleMatches,
  checkInvariants,
  computeGroupStandings,
  computeTournamentBlueprint,
  detectConflictsForMatch,
  detectScheduleConflicts,
  findNextFreeSlotForMatch,
  generateGroupRoundRobinPairs,
  generateGroups,
  generateKnockout,
  propagateWinners,
  validateTournamentSettings,
} from '@/lib/engine';
import { groupRepo, matchRepo, settingsRepo } from '@/lib/repos';
import {
  MARWAN_PLAYER_ID,
  type TournamentSettings,
} from '@/lib/schemas';
import {
  createDefaultUsers,
  createSeedSnapshot,
  SEED_PRESETS,
} from '@/lib/seed';
import { storage } from '@/lib/storage';

describe('CR-1 Step 2 — Tournament Structure, Settings, Draw, Tie-Breaks, Knockouts, Auto-Scheduler & 720 Scale', () => {
  beforeEach(async () => {
    await storage.resetToSeed({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      pointsPerGroupWin: 3,
      tablesCount: 4,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
      includeDemoProgress: false,
    });
  });

  it('720/3/1 preset: generates 240 groups, 720 group matches, 256-slot KO with 16 BYEs, 1v1v1 Marwan Final, zero schedule conflicts, fast & invariant-clean', () => {
    const startMs = Date.now();
    const snap = createSeedSnapshot(SEED_PRESETS[720]);
    const elapsedMs = Date.now() - startMs;

    // Seed generation must stay fast (never freeze UI)
    expect(elapsedMs).toBeLessThan(1500);

    const bp = computeTournamentBlueprint(snap.settings.tournament, 4);
    expect(bp.groupsCount).toBe(240);
    expect(bp.groupMatchesCount).toBe(720);
    expect(bp.qualifiersCount).toBe(240);
    expect(bp.bracketSize).toBe(256);
    expect(bp.byesCount).toBe(16);
    expect(bp.totalMatchesCount).toBe(720 + 254 + 1);

    const realPlayers = snap.players.filter((p) => !p.isGuest);
    expect(realPlayers.length).toBe(720);
    expect(realPlayers[0].contact.phone).toBe('010-0000-0001');
    expect(realPlayers[719].contact.phone).toBe('010-0000-0720');

    expect(snap.groups.length).toBe(240);
    const groupMatches = snap.matches.filter((m) => !m.isDemo && m.type === 'group');
    const koMatches = snap.matches.filter((m) => !m.isDemo && m.type === 'knockout');
    const finalMatches = snap.matches.filter((m) => !m.isDemo && m.type === 'final');

    expect(groupMatches.length).toBe(720);
    expect(koMatches.length).toBe(254);
    expect(finalMatches.length).toBe(1);
    expect(finalMatches[0].participants.length).toBe(3);
    expect(finalMatches[0].participants[2].playerId).toBe(MARWAN_PLAYER_ID);
    expect(finalMatches[0].participants[2].guest).toBe(true);

    const byeNodes = koMatches.filter((m) => m.participants.some((p) => p.isBye));
    expect(byeNodes.length).toBe(16);

    // Demo story checks: completed groups, 3-way cycle in Group 4, walkover in Group 6, live matches
    expect(groupMatches.filter((m) => m.status === 'finished').length).toBeGreaterThanOrEqual(36);
    expect(groupMatches.filter((m) => m.status === 'live').length).toBeGreaterThanOrEqual(1);

    // Zero player / table / judge schedule conflicts across all 975 matches!
    const conflicts = detectScheduleConflicts(snap.matches, snap.settings.tournament);
    expect(conflicts).toEqual([]);

    // Zero invariant violations!
    const report = checkInvariants(snap);
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it('48/3/2 preset: 16 groups of 3, 48 group matches, 32 qualifiers (0 BYEs), exact rank-matched seeding (1st G1 vs 1st G2, 2nd G1 vs 2nd G2)', () => {
    const settings: TournamentSettings = {
      totalPlayers: 48,
      groupSize: 3,
      advancePerGroup: 2,
      pointsPerGroupWin: 3,
      tablesCount: 6,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
    };
    const bp = computeTournamentBlueprint(settings, 4);
    expect(bp.groupsCount).toBe(16);
    expect(bp.groupMatchesCount).toBe(48);
    expect(bp.qualifiersCount).toBe(32);
    expect(bp.bracketSize).toBe(32);
    expect(bp.byesCount).toBe(0);

    const snap = createSeedSnapshot({ ...settings, includeDemoProgress: false });
    expect(snap.groups.length).toBe(16);
    expect(snap.matches.filter((m) => !m.isDemo && m.type === 'group').length).toBe(48);

    // Round of 32 (16 matches): Match 1 = 1st G1 vs 1st G2, Match 2 = 2nd G1 vs 2nd G2, Match 3 = 1st G3 vs 1st G4...
    const r32 = snap.matches
      .filter((m) => !m.isDemo && m.roundId === 'round-ko-32')
      .sort((a, b) => a.slot - b.slot);
    expect(r32.length).toBe(16);

    expect(r32[0].participants[0].feeder).toEqual({
      kind: 'group',
      groupId: 'group-1',
      groupNumber: 1,
      rank: 1,
    });
    expect(r32[0].participants[1].feeder).toEqual({
      kind: 'group',
      groupId: 'group-2',
      groupNumber: 2,
      rank: 1,
    });
    expect(r32[0].participants[0].placeholderLabelEn).toBe('Winner of Group 1');
    expect(r32[1].participants[0].feeder).toEqual({
      kind: 'group',
      groupId: 'group-1',
      groupNumber: 1,
      rank: 2,
    });
    expect(r32[1].participants[1].feeder).toEqual({
      kind: 'group',
      groupId: 'group-2',
      groupNumber: 2,
      rank: 2,
    });
    expect(r32[1].participants[0].placeholderLabelEn).toBe('#2 of Group 1');

    // Group 7 Winner placeholder exists and fills automatically when Group 7 completes
    const g7Match = r32.find((m) =>
      m.participants.some((p) => p.placeholderLabelEn === 'Winner of Group 7')
    );
    expect(g7Match).toBeDefined();

    expect(detectScheduleConflicts(snap.matches, settings)).toEqual([]);
    expect(checkInvariants(snap).ok).toBe(true);
  });

  it('12/4/1 preset: 3 groups of 4 (6 round-robin matches each = 18 group matches), odd group count -> 4-slot KO with 1 BYE', () => {
    const settings: TournamentSettings = {
      totalPlayers: 12,
      groupSize: 4,
      advancePerGroup: 1,
      pointsPerGroupWin: 3,
      tablesCount: 4,
      slotMinutes: 25,
      includeFinalWithMarwan: true,
    };
    const bp = computeTournamentBlueprint(settings, 4);
    expect(bp.groupsCount).toBe(3);
    expect(bp.hasOddGroups).toBe(true);
    expect(bp.groupMatchesCount).toBe(18); // 3 * (4*3/2)
    expect(bp.qualifiersCount).toBe(3);
    expect(bp.bracketSize).toBe(4);
    expect(bp.byesCount).toBe(1);

    const snap = createSeedSnapshot({ ...settings, includeDemoProgress: false });
    expect(snap.groups.length).toBe(3);
    expect(snap.groups.every((g) => g.playerIds.length === 4)).toBe(true);
    expect(generateGroupRoundRobinPairs(snap.groups[0].playerIds).length).toBe(6);
    expect(snap.matches.filter((m) => !m.isDemo && m.type === 'group').length).toBe(18);

    const sfMatches = snap.matches.filter((m) => m.roundId === 'round-semi');
    expect(sfMatches.length).toBe(2);
    expect(sfMatches.filter((m) => m.participants.some((p) => p.isBye)).length).toBe(1);

    expect(detectScheduleConflicts(snap.matches, settings)).toEqual([]);
    expect(checkInvariants(snap).ok).toBe(true);
  });

  it('odd group counts & non-divisible player remainders: 15/3/1 (5 groups -> 8 bracket, 3 BYEs) and 15/3/2 (10 qualifiers -> 16 bracket, 6 BYEs) and 10/3/1 (no 1-player orphan)', () => {
    // 5 groups, advance 1 -> 5 qualifiers -> 8 bracket, 3 BYEs
    const s5x1: TournamentSettings = {
      totalPlayers: 15,
      groupSize: 3,
      advancePerGroup: 1,
      pointsPerGroupWin: 3,
      tablesCount: 4,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
    };
    const snap5x1 = createSeedSnapshot({ ...s5x1, includeDemoProgress: false });
    expect(snap5x1.groups.length).toBe(5);
    const r8 = snap5x1.matches.filter((m) => m.roundId === 'round-ko-8');
    expect(r8.length).toBe(4);
    expect(r8.filter((m) => m.participants.some((p) => p.isBye)).length).toBe(3);
    expect(checkInvariants(snap5x1).ok).toBe(true);

    // 5 groups, advance 2 -> 10 qualifiers -> 16 bracket, 6 BYEs, 2 play-in matches
    const s5x2: TournamentSettings = { ...s5x1, advancePerGroup: 2 };
    const snap5x2 = createSeedSnapshot({ ...s5x2, includeDemoProgress: false });
    const r16 = snap5x2.matches.filter((m) => m.roundId === 'round-ko-16');
    expect(r16.length).toBe(8);
    expect(r16.filter((m) => m.participants.some((p) => p.isBye)).length).toBe(6);
    expect(checkInvariants(snap5x2).ok).toBe(true);

    // 10 players with groupSize 3 -> [3, 3, 4], NO 1-player orphan group
    const s10: TournamentSettings = { ...s5x1, totalPlayers: 10 };
    const bp10 = computeTournamentBlueprint(s10);
    expect(bp10.groupSizes).toEqual([3, 3, 4]);
    const g10 = generateGroups(snap5x1.players, s10, { preserveOrder: true });
    expect(g10.map((g) => g.playerIds.length)).toEqual([3, 3, 4]);
  });

  it('supports pre-tournament random re-draw and manual player swap/move, then locks once any match starts', async () => {
    const beforeGroups = await groupRepo.list();
    const g1p0 = beforeGroups[0].playerIds[0];
    const g2p0 = beforeGroups[1].playerIds[0];

    // Swap player A of Group 1 with player A of Group 2
    await groupRepo.movePlayer({
      playerId: g1p0,
      targetGroupId: beforeGroups[1].id,
      swapWithPlayerId: g2p0,
      actorUserId: 'user-admin',
    });

    const afterSwap = await groupRepo.list();
    expect(afterSwap[0].playerIds[0]).toBe(g2p0);
    expect(afterSwap[1].playerIds[0]).toBe(g1p0);

    // Group 1 & 2 round-robin matches regenerated & conflict-free
    const g1Matches = await matchRepo.getByGroup('group-1');
    expect(g1Matches.length).toBe(3);
    expect(g1Matches.some((m) => m.participants.some((p) => p.playerId === g2p0))).toBe(true);
    expect(await matchRepo.detectConflicts()).toEqual([]);

    // Random re-draw changes group order cleanly
    await groupRepo.redraw('user-admin', { shuffleSeed: 987654 });
    const afterRedraw = await groupRepo.list();
    expect(afterRedraw.length).toBe(4);
    expect(checkInvariants(await storage.readSnapshot()).ok).toBe(true);

    // Start one match -> manual moves and re-draw are now LOCKED!
    const firstMatch = (await matchRepo.list({ type: 'group' }))[0];
    await commands.startMatch({ matchId: firstMatch.id, actorUserId: 'user-admin' });

    await expect(
      groupRepo.movePlayer({
        playerId: afterRedraw[0].playerIds[0],
        targetGroupId: afterRedraw[1].id,
        swapWithPlayerId: afterRedraw[1].playerIds[0],
        actorUserId: 'user-admin',
      })
    ).rejects.toBeInstanceOf(CommandValidationError);

    await expect(groupRepo.redraw('user-admin')).rejects.toBeInstanceOf(
      CommandValidationError
    );
  });

  it('automatically creates a group tie-break match when a 3-way 3-3-3 cycle finishes completely level on all criteria, and advances the tie-break winner', async () => {
    const g1Matches = await matchRepo.getByGroup('group-1');
    const [m1, m2, m3] = g1Matches; // A v B, B v C, A v C

    // Exact symmetric 3-way 3-3-3 cycle: A beats B (2-1), B beats C (2-1), C beats A (2-1)
    const play2to1 = async (mId: string, winner: string, loser: string) => {
      await commands.startMatch({ matchId: mId, actorUserId: 'user-admin' });
      await commands.applyPoint({ matchId: mId, segmentId: 'seg-1', playerId: winner, delta: 1, byUserId: 'user-admin' });
      await commands.applyPoint({ matchId: mId, segmentId: 'seg-3', playerId: winner, delta: 1, byUserId: 'user-admin' });
      await commands.applyPoint({ matchId: mId, segmentId: 'seg-1', playerId: loser, delta: 1, byUserId: 'user-admin' });
      await commands.finishMatch({ matchId: mId, actorUserId: 'user-admin' });
    };

    const pA = m1.participants[0].playerId!;
    const pB = m1.participants[1].playerId!;
    const pC = m2.participants[1].playerId!;

    await play2to1(m1.id, pA, pB);
    await play2to1(m2.id, pB, pC);
    await play2to1(m3.id, pC, pA);

    // Engine detects level deadlock AND command pipeline AUTOMATICALLY created the tie-break match!
    const standings = (await groupRepo.getStandings('group-1'))!;
    expect(standings.hasThreeWayCycle).toBe(true);
    expect(standings.needsTieBreakMatch).toBe(true);
    expect(standings.isComplete).toBe(false);

    const g1After = await matchRepo.getByGroup('group-1');
    const autoTb = g1After.find((m) => m.isGroupTieBreak);
    expect(autoTb).toBeDefined();
    expect(autoTb?.participants.length).toBe(3);

    // Finish the automatic tie-break match won by pC -> Group 1 completes & pC automatically fills Semi-Final 1!
    await commands.startMatch({ matchId: autoTb!.id, actorUserId: 'user-admin' });
    await commands.applyPoint({ matchId: autoTb!.id, segmentId: 'seg-16', playerId: pC, delta: 1, byUserId: 'user-admin' });
    await commands.finishMatch({ matchId: autoTb!.id, actorUserId: 'user-admin' });

    const finalStandings = (await groupRepo.getStandings('group-1'))!;
    expect(finalStandings.isComplete).toBe(true);
    expect(finalStandings.qualifierPlayerIds).toEqual([pC]);

    const sf1 = (await matchRepo.list({ type: 'knockout' })).find((m) => m.slot === 1)!;
    expect(sf1.participants[0].playerId).toBe(pC);
    expect(checkInvariants(await storage.readSnapshot()).ok).toBe(true);
  });

  it('detects manual schedule override conflicts (table, judge, player), finds next free slot, and preserves live/finished matches on partial auto-schedule', async () => {
    const groupMatches = await matchRepo.list({ type: 'group' });
    const [m1, m2] = groupMatches;

    // Force a deliberate manual conflict: book m2 onto m1's exact table, time, and judge
    await matchRepo.update(
      m2.id,
      {
        tableNumber: m1.tableNumber,
        scheduledAt: m1.scheduledAt,
        judgeUserId: m1.judgeUserId,
      },
      'user-admin'
    );

    const conflicts = await matchRepo.detectConflicts();
    expect(conflicts.some((c) => c.matchId === m2.id && c.kind === 'table')).toBe(true);
    expect(conflicts.some((c) => c.matchId === m2.id && c.kind === 'judge')).toBe(true);

    // Find next free slot resolves conflict for m2
    const updatedM2 = (await matchRepo.get(m2.id))!;
    const free = await matchRepo.findNextFreeSlot(updatedM2);
    const snap = await storage.readSnapshot();
    const candidateClean = { ...updatedM2, ...free, scorerUserId: free.judgeUserId };
    expect(
      detectConflictsForMatch(candidateClean, snap.matches, snap.settings.tournament)
    ).toEqual([]);

    // Start m1 so it is LIVE, then run autoSchedule(onlyScheduled: true):
    // m1 stays untouched while m2 moves to a conflict-free slot!
    await commands.startMatch({ matchId: m1.id, actorUserId: 'user-admin' });
    const m1BeforeSched = (await matchRepo.get(m1.id))!;

    const res = await matchRepo.autoSchedule('user-admin', { onlyScheduled: true });
    expect(res.remainingConflicts).toBe(0);

    const m1AfterSched = (await matchRepo.get(m1.id))!;
    expect(m1AfterSched.scheduledAt).toBe(m1BeforeSched.scheduledAt);
    expect(m1AfterSched.tableNumber).toBe(m1BeforeSched.tableNumber);
    expect(await matchRepo.detectConflicts()).toEqual([]);
  });

  it('validates settings and enforces tiered Impact Preview when changing settings mid-tournament', async () => {
    // Validation rejects invalid settings (e.g. advancePerGroup >= groupSize)
    const bad = validateTournamentSettings({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 3,
      pointsPerGroupWin: 3,
      tablesCount: 4,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => e.field === 'advancePerGroup')).toBe(true);

    // Start one match so tournament is active
    const firstMatch = (await matchRepo.list({ type: 'group' }))[0];
    await commands.startMatch({ matchId: firstMatch.id, actorUserId: 'user-admin' });

    // Schedule change preview -> tier 'schedule', requiresConfirmation: true, 0 active matches lost
    const schedImpact = await settingsRepo.previewImpact({ tablesCount: 8, slotMinutes: 20 });
    expect(schedImpact.tier).toBe('schedule');
    expect(schedImpact.requiresConfirmation).toBe(true);
    expect(schedImpact.affectedActiveOrFinishedCount).toBe(0);

    // Structural change preview -> tier 'structural', requiresConfirmation: true, lists active match
    const structImpact = await settingsRepo.previewImpact({ totalPlayers: 48, groupSize: 3, advancePerGroup: 2 });
    expect(structImpact.tier).toBe('structural');
    expect(structImpact.requiresConfirmation).toBe(true);
    expect(structImpact.affectedActiveOrFinishedCount).toBe(1);

    // Attempting structural update WITHOUT confirmStructuralRebuild is rejected!
    await expect(
      settingsRepo.update(
        {
          tournament: {
            totalPlayers: 48,
            groupSize: 3,
            advancePerGroup: 2,
            pointsPerGroupWin: 3,
            tablesCount: 6,
            slotMinutes: 30,
            includeFinalWithMarwan: true,
          },
        },
        'user-admin'
      )
    ).rejects.toBeInstanceOf(CommandValidationError);

    // Confirming structural rebuild succeeds and scales cleanly to 48 players / 16 groups!
    await settingsRepo.update(
      {
        tournament: {
          totalPlayers: 48,
          groupSize: 3,
          advancePerGroup: 2,
          pointsPerGroupWin: 3,
          tablesCount: 6,
          slotMinutes: 30,
          includeFinalWithMarwan: true,
        },
      },
      'user-admin',
      { confirmStructuralRebuild: true, rebuildTournament: true }
    );

    const rebuiltGroups = await groupRepo.list();
    expect(rebuiltGroups.length).toBe(16);
    expect(checkInvariants(await storage.readSnapshot()).ok).toBe(true);
  });
});
