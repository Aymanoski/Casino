import type { Round } from '@/lib/schemas';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';

export const roundRepo = {
  async list(): Promise<Round[]> {
    const db = await storage.readSnapshot();
    return [...db.rounds].sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<Round | null> {
    const db = await storage.readSnapshot();
    return db.rounds.find((r) => r.id === id) ?? null;
  },

  async create(
    input: {
      name: Round['name'];
      advancePerGame: number;
      stage?: Round['stage'];
      order?: number;
    },
    actorUserId = 'user-admin'
  ): Promise<Round> {
    return commands.createRound({ ...input, actorUserId });
  },

  async update(
    id: string,
    patch: { name?: Round['name']; advancePerGame?: number; order?: number },
    actorUserId = 'user-admin'
  ): Promise<Round | null> {
    return commands.updateRound({ roundId: id, patch, actorUserId });
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    return commands.removeRound({ roundId: id, actorUserId });
  },
};
