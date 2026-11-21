import type { Group } from '@/lib/schemas';
import {
  computeGroupStandings,
  computeQualifiers,
  getTournamentProgress,
  type ComputedGroupStandings,
  type QualifierSlot,
  type TournamentProgressSummary,
} from '@/lib/engine';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';

export const groupRepo = {
  async list(): Promise<Group[]> {
    const db = await storage.readSnapshot();
    return [...db.groups].sort((a, b) => a.number - b.number);
  },

  async get(id: string): Promise<Group | null> {
    const db = await storage.readSnapshot();
    return db.groups.find((g) => g.id === id) ?? null;
  },

  async getByNumber(groupNumber: number): Promise<Group | null> {
    const db = await storage.readSnapshot();
    return db.groups.find((g) => g.number === groupNumber) ?? null;
  },

  async getStandings(groupId: string): Promise<ComputedGroupStandings | null> {
    const db = await storage.readSnapshot();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) return null;
    return computeGroupStandings(
      group,
      db.matches,
      db.scoreEvents,
      db.absenceEvents,
      db.matchEvents,
      db.settings.tournament
    );
  },

  async listAllStandings(): Promise<ComputedGroupStandings[]> {
    const db = await storage.readSnapshot();
    const { groupStandings } = computeQualifiers(
      db.groups,
      db.matches,
      db.scoreEvents,
      db.absenceEvents,
      db.matchEvents,
      db.settings.tournament
    );
    return Array.from(groupStandings.values()).sort(
      (a, b) => a.groupNumber - b.groupNumber
    );
  },

  async listQualifiers(): Promise<QualifierSlot[]> {
    const db = await storage.readSnapshot();
    const { qualifiers } = computeQualifiers(
      db.groups,
      db.matches,
      db.scoreEvents,
      db.absenceEvents,
      db.matchEvents,
      db.settings.tournament
    );
    return qualifiers;
  },

  async getTournamentProgress(): Promise<TournamentProgressSummary> {
    const db = await storage.readSnapshot();
    return getTournamentProgress(
      db.matches,
      db.scoreEvents,
      db.absenceEvents,
      db.matchEvents
    );
  },

  async redraw(
    actorUserId = 'user-admin',
    options?: { shuffleSeed?: number; preserveSeedOrder?: boolean }
  ) {
    return commands.redrawGroups({
      actorUserId,
      shuffleSeed: options?.shuffleSeed,
      preserveSeedOrder: options?.preserveSeedOrder,
    });
  },

  async movePlayer(input: {
    playerId: string;
    targetGroupId: string;
    swapWithPlayerId?: string;
    actorUserId?: string;
  }) {
    return commands.movePlayerBetweenGroups({
      playerId: input.playerId,
      targetGroupId: input.targetGroupId,
      swapWithPlayerId: input.swapWithPlayerId,
      actorUserId: input.actorUserId ?? 'user-admin',
    });
  },

  async createTieBreakMatch(
    groupId: string,
    playerIds: string[],
    actorUserId = 'user-admin'
  ) {
    return commands.createGroupTieBreakMatch({
      groupId,
      playerIds,
      actorUserId,
    });
  },
};
