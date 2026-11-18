import type { DatabaseSnapshot, Player, PlayerStatus } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

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
    const nonHostPlayers = db.players.filter((p) => !p.isHost);
    const nextSeed =
      input.seed ??
      (nonHostPlayers.reduce((max, p) => Math.max(max, p.seed), 0) + 1);

    const newPlayer: Player = {
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fullName: input.fullName,
      fullNameAr: input.fullNameAr ?? input.fullName,
      nickname: input.nickname,
      nicknameAr: input.nicknameAr ?? input.nickname,
      avatarSeed: `seed-${nextSeed}-${input.nickname.toLowerCase().replace(/\s+/g, '')}`,
      phone: input.phone,
      email: input.email,
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
      after: { fullName: newPlayer.fullName, nickname: newPlayer.nickname, seed: newPlayer.seed },
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
    }>,
    actorUserId = 'user-admin'
  ): Promise<Player[]> {
    const created: Player[] = [];
    for (const row of rows) {
      const p = await this.create(
        {
          fullName: row.fullName,
          fullNameAr: row.fullNameAr,
          nickname: row.nickname,
          nicknameAr: row.nicknameAr,
          phone: row.phone ?? '+20 100 000 0000',
          email:
            row.email ??
            `${row.fullName.toLowerCase().replace(/[^a-z]/g, '.')}@players.casino`,
        },
        actorUserId
      );
      created.push(p);
    }
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
      before: { status: before.status, fullName: before.fullName, nickname: before.nickname },
      after: { status: updated.status, fullName: updated.fullName, nickname: updated.nickname },
    });

    realtime.publish('player.updated', { playerId: id });
    return updated;
  },

  async updateStatus(
    id: string,
    status: PlayerStatus,
    actorUserId = 'user-checkin'
  ): Promise<Player | null> {
    return this.update(id, { status }, actorUserId);
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
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
      before: { fullName: target.fullName },
      after: null,
    });

    realtime.publish('player.updated', { playerId: id });
    return true;
  },
};
