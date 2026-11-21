import type { Sponsor } from '@/lib/schemas';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';

export const sponsorRepo = {
  async list(): Promise<Sponsor[]> {
    const db = await storage.readSnapshot();
    return [...db.sponsors].sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<Sponsor | null> {
    const db = await storage.readSnapshot();
    return db.sponsors.find((s) => s.id === id) ?? null;
  },

  async create(
    input: Omit<Sponsor, 'id'>,
    actorUserId = 'user-content'
  ): Promise<Sponsor> {
    return commands.createSponsor({ ...input, actorUserId });
  },

  async update(
    id: string,
    patch: Partial<Omit<Sponsor, 'id'>>,
    actorUserId = 'user-content'
  ): Promise<Sponsor | null> {
    return commands.updateSponsor({ sponsorId: id, patch, actorUserId });
  },

  async reorder(
    orderedIds: string[],
    actorUserId = 'user-content'
  ): Promise<Sponsor[]> {
    return commands.reorderSponsors({ orderedIds, actorUserId });
  },

  async remove(id: string, actorUserId = 'user-content'): Promise<boolean> {
    return commands.removeSponsor({ sponsorId: id, actorUserId });
  },
};
