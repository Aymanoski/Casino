import type {
  Avatar,
  CheckInStatus,
  Player,
  PlayerContact,
} from '@/lib/schemas';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';
import { assertRepoPermission } from './permissions';

export const playerRepo = {
  async list(options?: { includeHost?: boolean; includeGuest?: boolean }): Promise<Player[]> {
    const db = await storage.readSnapshot();
    const includeGuest = Boolean(options?.includeHost || options?.includeGuest);
    const list = includeGuest
      ? db.players
      : db.players.filter((p) => !p.isGuest && !p.isHost);
    return [...list].sort((a, b) => a.seed - b.seed);
  },

  async get(id: string): Promise<Player | null> {
    const db = await storage.readSnapshot();
    return db.players.find((p) => p.id === id) ?? null;
  },

  async getContactForActor(
    playerId: string,
    actorUserId: string,
    matchId?: string
  ): Promise<PlayerContact | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'contact.viewPlayer', {
      targetPlayerId: playerId,
    });
    const player = db.players.find((p) => p.id === playerId);
    if (!player) return null;
    await commands.logContactViewed({
      targetType: 'player',
      targetId: playerId,
      matchId,
      actorUserId,
    });
    return player.contact;
  },

  async create(
    input: {
      fullName: string;
      fullNameAr?: string;
      nickname: string;
      nicknameAr?: string;
      phone: string;
      whatsapp?: string;
      email: string;
      initialCheckInStatus?: CheckInStatus;
      seed?: number;
    },
    actorUserId = 'user-admin'
  ): Promise<Player> {
    return commands.createPlayer({
      ...input,
      actorUserId,
    });
  },

  async bulkCreate(
    rows: Array<{
      fullName: string;
      fullNameAr?: string;
      nickname: string;
      nicknameAr?: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
      initialCheckInStatus?: CheckInStatus;
    }>,
    actorUserId = 'user-admin'
  ): Promise<Player[]> {
    return commands.bulkCreatePlayers({ rows, actorUserId });
  },

  /**
   * Profile-only update (identity, contact, seed, avatar).
   * Tournament status & stats are derived by /lib/engine and cannot be set here!
   */
  async update(
    id: string,
    patch: {
      fullName?: string;
      fullNameAr?: string;
      nickname?: string;
      nicknameAr?: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
      seed?: number;
      avatar?: Avatar;
    },
    actorUserId = 'user-admin'
  ): Promise<Player | null> {
    return commands.updatePlayerProfile({
      playerId: id,
      patch,
      actorUserId,
    });
  },

  async updateAvatar(
    id: string,
    avatar: Avatar,
    actorUserId: string
  ): Promise<Player | null> {
    return commands.updatePlayerAvatar({
      playerId: id,
      avatar,
      actorUserId,
    });
  },

  async updateOwnProfile(
    id: string,
    patch: {
      nickname?: string;
      nicknameAr?: string;
      avatar?: Avatar;
    },
    actorUserId: string
  ): Promise<Player | null> {
    return commands.updateOwnPlayerProfile({
      playerId: id,
      patch,
      actorUserId,
    });
  },

  /**
   * Records gate arrival check-in via append-only CheckInEvent.
   */
  async recordCheckIn(
    id: string,
    arrivalStatus: CheckInStatus,
    actorUserId = 'user-checkin'
  ): Promise<Player | null> {
    return commands.recordCheckIn({
      playerId: id,
      status: arrivalStatus,
      actorUserId,
    });
  },

  /** Compatibility alias calling recordCheckIn (strictly restricted to arrival statuses) */
  async updateStatus(
    id: string,
    arrivalStatus: CheckInStatus,
    actorUserId = 'user-checkin'
  ): Promise<Player | null> {
    return this.recordCheckIn(id, arrivalStatus, actorUserId);
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    return commands.removePlayer({ playerId: id, actorUserId });
  },
};
