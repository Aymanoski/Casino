import { beforeEach, describe, expect, it } from 'vitest';
import {
  AVATAR_3D_LIBRARY,
  getAvatar3DDefinition,
  resolveDeterministicAvatarKey,
} from '@/lib/avatars';
import { CommandValidationError, commands } from '@/lib/commands';
import {
  auditRepo,
  matchRepo,
  PermissionDeniedError,
  playerRepo,
  scoreRepo,
  userRepo,
} from '@/lib/repos';
import { AVATAR_LIBRARY_KEYS, MARWAN_PLAYER_ID } from '@/lib/schemas';
import { storage } from '@/lib/storage';

// Minimal valid base64 image payloads for testing
const VALID_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const VALID_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const VALID_WEBP_DATA_URL =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

describe('Change Request 1 — Step 4: Player Privacy, Upcoming Match View & Avatars (v0.1.1-cr4-player)', () => {
  beforeEach(async () => {
    await storage.resetToSeed({ totalPlayers: 48, includeDemoProgress: true });
  });

  it('1. Enforces segment secrecy in matchRepo & scoreRepo for player and visitor roles on scheduled and live matches', async () => {
    // 1. Direct repo call as a player (by actorUserId and by viewerRole)
    const playerMatchesByActor = await matchRepo.list({
      actorUserId: 'user-player-1',
    });
    const playerMatchesByRole = await matchRepo.list({
      viewerRole: 'player',
    });
    const visitorMatches = await matchRepo.list({
      viewerRole: 'visitor',
    });

    const scheduledMatches = playerMatchesByActor.filter(
      (m) => m.status === 'scheduled'
    );
    const liveMatches = playerMatchesByActor.filter(
      (m) => m.status === 'live' || m.status === 'needsTieBreak'
    );
    const finishedMatches = playerMatchesByActor.filter(
      (m) => m.status === 'finished'
    );

    expect(scheduledMatches.length).toBeGreaterThan(0);
    expect(liveMatches.length).toBeGreaterThan(0);
    expect(finishedMatches.length).toBeGreaterThan(0);

    // Every scheduled or live match MUST have segmentIds redacted to [] for player & visitor
    for (const m of [...scheduledMatches, ...liveMatches]) {
      expect(m.segmentIds).toEqual([]);
      expect(m.currentSegmentIndex).toBe(0);

      const directGetAsPlayer = await matchRepo.get(m.id, {
        actorUserId: 'user-player-1',
      });
      expect(directGetAsPlayer?.segmentIds).toEqual([]);
      expect(directGetAsPlayer?.currentSegmentIndex).toBe(0);

      const directGetAsVisitor = await matchRepo.get(m.id, {
        viewerRole: 'visitor',
      });
      expect(directGetAsVisitor?.segmentIds).toEqual([]);
    }

    for (const m of playerMatchesByRole.filter((x) => x.status !== 'finished')) {
      expect(m.segmentIds).toEqual([]);
    }
    for (const m of visitorMatches.filter((x) => x.status !== 'finished')) {
      expect(m.segmentIds).toEqual([]);
    }

    // Group & Round scoped queries as a player ALSO redact unfinished matches
    const liveMatch = liveMatches[0];
    if (liveMatch.groupId) {
      const groupMatchesAsPlayer = await matchRepo.getByGroup(
        liveMatch.groupId,
        { actorUserId: 'user-player-1' }
      );
      const foundLive = groupMatchesAsPlayer.find((m) => m.id === liveMatch.id);
      expect(foundLive?.segmentIds).toEqual([]);
    }
    const roundMatchesAsPlayer = await matchRepo.getByRound(liveMatch.roundId, {
      actorUserId: 'user-player-1',
    });
    expect(
      roundMatchesAsPlayer.find((m) => m.id === liveMatch.id)?.segmentIds
    ).toEqual([]);

    // ScoreEvents on a LIVE match MUST redact segmentId when queried as a player or visitor
    const liveEventsAsPlayer = await scoreRepo.listByMatch(liveMatch.id, {
      actorUserId: 'user-player-1',
    });
    expect(liveEventsAsPlayer.length).toBeGreaterThan(0);
    for (const ev of liveEventsAsPlayer) {
      expect(ev.segmentId).toBe('');
    }

    const livePlayerId = liveMatch.participants[0]?.playerId!;
    const playerHistoryEvents = await scoreRepo.listByPlayer(livePlayerId, {
      actorUserId: 'user-player-1',
    });
    const unfinishedPlayerEvents = playerHistoryEvents.filter(
      (ev) => ev.matchId === liveMatch.id
    );
    expect(unfinishedPlayerEvents.length).toBeGreaterThan(0);
    for (const ev of unfinishedPlayerEvents) {
      expect(ev.segmentId).toBe('');
    }

    // Meanwhile, finished matches DO return full segmentIds and ScoreEvent.segmentId to players
    for (const fin of finishedMatches) {
      expect(fin.segmentIds.length).toBeGreaterThan(0);
    }
    const finishedEventsAsPlayer = await scoreRepo.listByMatch(
      finishedMatches[0].id,
      { actorUserId: 'user-player-1' }
    );
    expect(finishedEventsAsPlayer.length).toBeGreaterThan(0);
    for (const ev of finishedEventsAsPlayer) {
      expect(ev.segmentId).toMatch(/^seg-\d+$/);
    }

    // And Scorer / Super Admin reads on the exact same live match DO receive full segmentIds
    const liveAsAdmin = await matchRepo.get(liveMatch.id, {
      actorUserId: 'user-admin',
    });
    expect(liveAsAdmin?.segmentIds.length).toBeGreaterThan(0);
  });

  it('2. Provides table number, opponent metadata, and role-scoped Judge Help Contact Card for upcoming/live matches', async () => {
    const allMatches = await matchRepo.list({ actorUserId: 'user-player-1' });
    const p1UpcomingOrLive = allMatches.filter(
      (m) =>
        (m.status === 'scheduled' || m.status === 'live') &&
        m.participants.some((pt) => pt.playerId === 'player-1')
    );
    expect(p1UpcomingOrLive.length).toBeGreaterThan(0);

    const nextMatch = p1UpcomingOrLive[0];
    expect(nextMatch.tableNumber).toBeGreaterThanOrEqual(1);
    expect(nextMatch.scheduledAt).toBeTruthy();
    expect(nextMatch.judgeUserId).toBeTruthy();

    // Ensure user-player-1 can view the contact card of their assigned judge (and it is audited)
    const assignedJudgeContact = await userRepo.getJudgeContactForActor(
      nextMatch.judgeUserId,
      'user-player-1',
      nextMatch.id
    );
    expect(assignedJudgeContact).not.toBeNull();
    expect(assignedJudgeContact?.name).toBeTruthy();
    expect(assignedJudgeContact?.phone).toBeTruthy();

    const audits = await auditRepo.list({ requesterUserId: 'user-admin' });
    expect(
      audits.some(
        (a) =>
          a.action === 'contact.viewed' &&
          a.actorUserId === 'user-player-1' &&
          a.entityId === nextMatch.judgeUserId
      )
    ).toBe(true);

    // Ensure user-player-1 CANNOT view contact details of a judge who is NOT assigned to any of their upcoming/live matches
    const allScorers = await userRepo.list({ role: 'scorer' });
    const myUpcomingJudgeIds = new Set(
      p1UpcomingOrLive.map((m) => m.judgeUserId)
    );
    const unassignedJudge = allScorers.find(
      (u) => !myUpcomingJudgeIds.has(u.id)
    );
    if (unassignedJudge) {
      await expect(
        userRepo.getJudgeContactForActor(unassignedJudge.id, 'user-player-1')
      ).rejects.toThrow(PermissionDeniedError);
    }
  });

  it('3. Assigns deterministic 3D avatars from the 24-avatar library across all players', async () => {
    expect(AVATAR_LIBRARY_KEYS.length).toBe(24);
    expect(AVATAR_3D_LIBRARY.length).toBe(24);

    const uniqueKeys = new Set(AVATAR_3D_LIBRARY.map((a) => a.key));
    expect(uniqueKeys.size).toBe(24);

    for (let i = 1; i <= 24; i++) {
      const expectedKey = `avatar-${String(i).padStart(2, '0')}`;
      expect(resolveDeterministicAvatarKey(`player-${i}`)).toBe(expectedKey);
      expect(resolveDeterministicAvatarKey(i)).toBe(expectedKey);
      const def = getAvatar3DDefinition(expectedKey);
      expect(def.key).toBe(expectedKey);
      expect(def.nameEn.length).toBeGreaterThan(2);
      expect(def.nameAr.length).toBeGreaterThan(2);
    }

    // Wraparound determinism: player-25 -> avatar-01
    expect(resolveDeterministicAvatarKey('player-25')).toBe('avatar-01');
  });

  it('4. Allows players to edit ONLY their own photo, 3D avatar, and nickname, and blocks editing other players', async () => {
    // Player 1 updates their own 3D avatar and photo
    const updatedWithPhoto = await playerRepo.updateOwnProfile(
      'player-1',
      {
        nickname: 'Desert Fox',
        nicknameAr: 'ثعلب الصحراء',
        avatar: {
          photoUrl: VALID_JPEG_DATA_URL,
          avatarKey: 'avatar-14',
        },
      },
      'user-player-1'
    );
    expect(updatedWithPhoto?.nickname).toBe('Desert Fox');
    expect(updatedWithPhoto?.nicknameAr).toBe('ثعلب الصحراء');
    expect(updatedWithPhoto?.avatar.photoUrl).toBe(VALID_JPEG_DATA_URL);
    expect(updatedWithPhoto?.avatar.avatarKey).toBe('avatar-14');

    // Player 1 removes their own photo -> reverts cleanly to 3D avatar-14
    const afterRemove = await playerRepo.updateAvatar(
      'player-1',
      {
        photoUrl: null,
        avatarKey: 'avatar-14',
      },
      'user-player-1'
    );
    expect(afterRemove?.avatar.photoUrl).toBeNull();
    expect(afterRemove?.avatar.avatarKey).toBe('avatar-14');

    // Player 1 CANNOT edit Player 2's avatar or profile
    await expect(
      playerRepo.updateAvatar(
        'player-2',
        { photoUrl: VALID_PNG_DATA_URL, avatarKey: 'avatar-05' },
        'user-player-1'
      )
    ).rejects.toThrow(PermissionDeniedError);

    await expect(
      playerRepo.updateOwnProfile(
        'player-2',
        { nickname: 'Hacked' },
        'user-player-1'
      )
    ).rejects.toThrow(PermissionDeniedError);

    await expect(
      playerRepo.update(
        'player-2',
        { fullName: 'Unauthorized Name' },
        'user-player-1'
      )
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('5. Enforces file type check, <= 300KB size limit, Marwan Serry no-photo rule, and Super Admin photo override/removal', async () => {
    // Valid PNG and WebP photos succeed
    const withPng = await playerRepo.updateAvatar(
      'player-4',
      { photoUrl: VALID_PNG_DATA_URL, avatarKey: 'avatar-04' },
      'user-player-4'
    );
    expect(withPng?.avatar.photoUrl).toBe(VALID_PNG_DATA_URL);

    const withWebp = await playerRepo.updateAvatar(
      'player-4',
      { photoUrl: VALID_WEBP_DATA_URL, avatarKey: 'avatar-04' },
      'user-player-4'
    );
    expect(withWebp?.avatar.photoUrl).toBe(VALID_WEBP_DATA_URL);

    // Invalid file type (SVG / text) is rejected
    await expect(
      playerRepo.updateAvatar(
        'player-4',
        {
          photoUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
          avatarKey: 'avatar-04',
        },
        'user-player-4'
      )
    ).rejects.toThrow(CommandValidationError);

    // Oversized photo (> 300KB) is rejected
    const oversizedBase64 = 'A'.repeat(430_000); // ~322KB decoded
    await expect(
      playerRepo.updateAvatar(
        'player-4',
        {
          photoUrl: `data:image/jpeg;base64,${oversizedBase64}`,
          avatarKey: 'avatar-04',
        },
        'user-player-4'
      )
    ).rejects.toThrow(CommandValidationError);

    // Guest host Marwan Serry is strictly name-only and CANNOT have a photo even from Super Admin
    await expect(
      playerRepo.updateAvatar(
        MARWAN_PLAYER_ID,
        { photoUrl: VALID_JPEG_DATA_URL, avatarKey: 'avatar-01' },
        'user-admin'
      )
    ).rejects.toThrow(CommandValidationError);

    // Super Admin CAN replace or remove any player's photo
    const adminReplaced = await playerRepo.updateAvatar(
      'player-4',
      { photoUrl: VALID_JPEG_DATA_URL, avatarKey: 'avatar-12' },
      'user-admin'
    );
    expect(adminReplaced?.avatar.photoUrl).toBe(VALID_JPEG_DATA_URL);
    expect(adminReplaced?.avatar.avatarKey).toBe('avatar-12');

    const adminRemoved = await playerRepo.updateAvatar(
      'player-4',
      { photoUrl: null, avatarKey: 'avatar-12' },
      'user-admin'
    );
    expect(adminRemoved?.avatar.photoUrl).toBeNull();
    expect(adminRemoved?.avatar.avatarKey).toBe('avatar-12');

    // Verify all 9 engine invariants hold after all avatar/profile mutations
    const report = await commands.runConsistencyCheck('user-admin');
    expect(report.violations).toHaveLength(0);
  });
});
