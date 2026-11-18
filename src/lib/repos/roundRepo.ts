import type { Round } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

export const roundRepo = {
  async list(): Promise<Round[]> {
    const db = await storage.readSnapshot();
    return [...db.rounds].sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<Round | null> {
    const db = await storage.readSnapshot();
    return db.rounds.find((r) => r.id === id) ?? null;
  },

  async update(
    id: string,
    patch: Partial<Omit<Round, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Round | null> {
    const db = await storage.readSnapshot();
    const idx = db.rounds.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const before = { ...db.rounds[idx] };
    const updated: Round = { ...db.rounds[idx], ...patch };
    db.rounds[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'bracket.update',
      entityType: 'round',
      entityId: id,
      summary: `Updated round ${updated.name.en}`,
      summaryAr: `تم تحديث الجولة ${updated.name.ar}`,
      before: { advancePerGame: before.advancePerGame, status: before.status },
      after: { advancePerGame: updated.advancePerGame, status: updated.status },
    });

    realtime.publish('bracket.updated', { roundId: id });
    return updated;
  },
};
