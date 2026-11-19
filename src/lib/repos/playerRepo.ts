import type { DatabaseSnapshot, Player, PlayerStatus } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission, PermissionDeniedError } from './permissions';

const CHECKIN_ALLOWED_STATUSES: readonly PlayerStatus[] = [
  'registered',
  'checkedIn',
  'absent',
];

export function recomputePlayerStatsInMemory(db: DatabaseSnapshot): void {
  const tournamentGames = db.games.filter((g) => !g.isDemo);
  const demoGameIds = new Set(db.games.filter((g) => g.isDemo).map((g) => g.id));

  db.players = db.players.map((player) => {
    const playerEvents = db.scoreEvents.filter(
      (e) => e.playerId === player.id && !demoGameIds.has(e.gameId)
    );
    const totalPoints = playerEvents.reduce((sum, e) => sum + e.delta, 0);
    const gamesPlayed = tournamentGames.filter(
      (g) =>
        (g.status === 'finished' || g.status === 'live') &&
        g.playerIds.includes(player.id)
    ).length;
    const wins = tournamentGames.filter(
      (g) => g.status === 'finished' && g.winnerPlayerId === player.id
    ).length;

    return {
      ...player,
      stats: {
        gamesPlayed,
        wins,
        totalPoints,
      },
    };
  });
}

export const playerRepo = {
  async list(options?: { includeHost?: boolean }): Promise<Player[]> {
    const db = await storage.readSnapshot();
    const list = options?.includeHost
      ? db.players
      : db.players.filter((p) => !p.isHost);
    return [...list].sort((a, b) => a.seed - b.seed);
  },

  async get(id: string): Promise<Player | null> {
    const db = await storage.readSnapshot();
    return db.players.find((p) => p.id === id) ?? null;
  },

  async create(
    input: {
      fullName: string;
      fullNameAr?: string;
      nickname: string;
      nicknameAr?: string;
      phone: string;
      email: string;
      status?: PlayerStatus;
      seed?: number;
    },
    actorUserId = 'user-admin'
  ): Promise<Player> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'player.manage');

    const nonHostPlayers = db.players.filter((p) => !p.isHost);
    const nextSeed =
      input.seed ??
      (nonHostPlayers.reduce((max, p) => Math.max(max, p.seed), 0) + 1);

    const newPlayer: Player = {
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fullName: input.fullName.trim(),
      fullNameAr: (input.fullNameAr?.trim() || input.fullName.trim()),
      nickname: input.nickname.trim(),
      nicknameAr: (input.nicknameAr?.trim() || input.nickname.trim()),
      avatarSeed: `seed-${nextSeed}-${input.nickname.toLowerCase().replace(/\s+/g, '')}`,
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      status: input.status ?? 'registered',
      seed: nextSeed,
      isHost: false,
      stats: { gamesPlayed: 0, wins: 0, totalPoints: 0 },
      createdAt: new Date().toISOString(),
    };

    db.players.push(newPlayer);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'player.create',
      entityType: 'player',
      entityId: newPlayer.id,
      summary: `Created player ${newPlayer.fullName} ("${newPlayer.nickname}")`,
      summaryAr: `تم إضافة اللاعب ${newPlayer.fullNameAr} ("${newPlayer.nicknameAr}")`,
      before: null,
      after: {
        fullName: newPlayer.fullName,
        fullNameAr: newPlayer.fullNameAr,
        nickname: newPlayer.nickname,
        email: newPlayer.email,
        status: newPlayer.status,
        seed: newPlayer.seed,
      },
    });

    realtime.publish('player.updated', { playerId: newPlayer.id });
    return newPlayer;
  },

  async bulkCreate(
    rows: Array<{
      fullName: string;
      fullNameAr?: string;
      nickname: string;
      nicknameAr?: string;
      phone?: string;
      email?: string;
      status?: PlayerStatus;
    }>,
    actorUserId = 'user-admin'
  ): Promise<Player[]> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'player.manage');

    if (rows.length === 0) return [];

    let nextSeed =
      db.players
        .filter((p) => !p.isHost)
        .reduce((max, p) => Math.max(max, p.seed), 0) + 1;

    const nowIso = new Date().toISOString();
    const created: Player[] = rows.map((row, idx) => {
      const seed = nextSeed++;
      const cleanName = row.fullName.trim();
      const cleanNick = row.nickname.trim();
      const generatedEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${seed}@players.casino`;

      return {
        id: `player-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        fullName: cleanName,
        fullNameAr: row.fullNameAr?.trim() || cleanName,
        nickname: cleanNick,
        nicknameAr: row.nicknameAr?.trim() || cleanNick,
        avatarSeed: `seed-${seed}-${cleanNick.toLowerCase().replace(/\s+/g, '')}`,
        phone: row.phone?.trim() || `+20 100 555 ${String(1000 + seed)}`,
        email: (row.email?.trim() || generatedEmail).toLowerCase(),
        status: row.status ?? 'registered',
        seed,
        isHost: false,
        stats: { gamesPlayed: 0, wins: 0, totalPoints: 0 },
        createdAt: nowIso,
      };
    });

    db.players.push(...created);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'player.bulkImport',
      entityType: 'player',
      entityId: `batch-${created.length}`,
      summary: `Bulk imported ${created.length} player(s) via CSV`,
      summaryAr: `تم استيراد ${created.length} لاعب عبر ملف CSV`,
      before: null,
      after: {
        count: created.length,
        players: created.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          nickname: p.nickname,
          email: p.email,
        })),
      },
    });

    realtime.publish('player.updated', { playerId: created[0]?.id });
    return created;
  },

  async update(
    id: string,
    patch: Partial<
      Pick<
        Player,
        | 'fullName'
        | 'fullNameAr'
        | 'nickname'
        | 'nicknameAr'
        | 'phone'
        | 'email'
        | 'status'
        | 'seed'
      >
    >,
    actorUserId = 'user-admin'
  ): Promise<Player | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'player.manage');

    const idx = db.players.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const before = { ...db.players[idx] };
    const updated: Player = {
      ...db.players[idx],
      ...patch,
    };
    db.players[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'player.update',
      entityType: 'player',
      entityId: id,
      summary: `Updated player ${updated.fullName}`,
      summaryAr: `تم تحديث بيانات اللاعب ${updated.fullNameAr}`,
      before: {
        status: before.status,
        fullName: before.fullName,
        fullNameAr: before.fullNameAr,
        nickname: before.nickname,
        phone: before.phone,
        email: before.email,
        seed: before.seed,
      },
      after: {
        status: updated.status,
        fullName: updated.fullName,
        fullNameAr: updated.fullNameAr,
        nickname: updated.nickname,
        phone: updated.phone,
        email: updated.email,
        seed: updated.seed,
      },
    });

    realtime.publish('player.updated', { playerId: id });
    return updated;
  },

  async updateStatus(
    id: string,
    status: PlayerStatus,
    actorUserId = 'user-checkin'
  ): Promise<Player | null> {
    const db = await storage.readSnapshot();
    const actor = assertRepoPermission(db, actorUserId, 'player.checkIn');

    // Check-in staff may only toggle arrival statuses per AGENTS.md §4
    if (actor?.role === 'checkIn' && !CHECKIN_ALLOWED_STATUSES.includes(status)) {
      throw new PermissionDeniedError(
        'player.checkIn',
        'checkIn',
        `Check-in staff can only set status to registered, checkedIn, or absent.`
      );
    }

    const idx = db.players.findIndex((p) => p.id === id);
    if (idx === -1 || db.players[idx].isHost) return null;

    const before = { ...db.players[idx] };
    const updated: Player = {
      ...before,
      status,
    };
    db.players[idx] = updated;
    await storage.writeSnapshot(db);

    const actionName =
      status === 'checkedIn'
        ? 'player.checkIn'
        : status === 'absent'
          ? 'player.markAbsent'
          : 'player.statusChange';

    await auditRepo.record({
      actorUserId,
      action: actionName,
      entityType: 'player',
      entityId: id,
      summary: `Set ${updated.fullName} status: ${before.status} -> ${status}`,
      summaryAr: `تغيير حالة اللاعب ${updated.fullNameAr}: ${before.status} ← ${status}`,
      before: { status: before.status },
      after: { status: updated.status },
    });

    realtime.publish('player.updated', { playerId: id });
    return updated;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'player.manage');

    const target = db.players.find((p) => p.id === id);
    if (!target || target.isHost) return false;

    db.players = db.players.filter((p) => p.id !== id);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'player.remove',
      entityType: 'player',
      entityId: id,
      summary: `Removed player ${target.fullName}`,
      summaryAr: `تم حذف اللاعب ${target.fullNameAr}`,
      before: {
        fullName: target.fullName,
        nickname: target.nickname,
        email: target.email,
        status: target.status,
      },
      after: null,
    });

    realtime.publish('player.updated', { playerId: id });
    return true;
  },
};
