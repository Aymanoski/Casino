import type { Group } from '@/lib/schemas';
import {
  computeGroupStandings,
  computeQualifiers,
  type ComputedGroupStandings,
  type QualifierSlot,
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

  async createTieBreakMatch(
    groupId: string,
    playerIds: [string, string],
    actorUserId = 'user-admin'
  ) {
    return commands.createGroupTieBreakMatch({
      groupId,
      playerIds,
      actorUserId,
    });
  },
};
