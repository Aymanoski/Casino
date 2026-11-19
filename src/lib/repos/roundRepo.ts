import type { Round } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission } from './permissions';

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
    input: Omit<Round, 'id' | 'order'> & { order?: number },
    actorUserId = 'user-admin'
  ): Promise<Round> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const nextOrder =
      input.order ??
      (db.rounds.reduce((max, r) => Math.max(max, r.order), 0) + 1);

    const newRound: Round = {
      ...input,
      id: `round-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      order: nextOrder,
    };

    db.rounds.push(newRound);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'bracket.roundCreate',
      entityType: 'round',
      entityId: newRound.id,
      summary: `Created round "${newRound.name.en}" (advance ${newRound.advancePerGame})`,
      summaryAr: `تم إنشاء جولة "${newRound.name.ar}"`,
      before: null,
      after: {
        nameEn: newRound.name.en,
        advancePerGame: newRound.advancePerGame,
        order: newRound.order,
      },
    });

    realtime.publish('bracket.updated', { roundId: newRound.id });
    return newRound;
  },

  async update(
    id: string,
    patch: Partial<Omit<Round, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Round | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const idx = db.rounds.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const before = { ...db.rounds[idx] };
    const updated: Round = { ...before, ...patch };
    db.rounds[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'bracket.update',
      entityType: 'round',
      entityId: id,
      summary: `Updated round "${updated.name.en}"`,
      summaryAr: `تم تحديث الجولة "${updated.name.ar}"`,
      before: {
        nameEn: before.name.en,
        advancePerGame: before.advancePerGame,
        status: before.status,
      },
      after: {
        nameEn: updated.name.en,
        advancePerGame: updated.advancePerGame,
        status: updated.status,
      },
    });

    realtime.publish('bracket.updated', { roundId: id });
    return updated;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const target = db.rounds.find((r) => r.id === id);
    if (!target) return false;

    db.rounds = db.rounds.filter((r) => r.id !== id);
    db.games = db.games.filter((g) => g.roundId !== id || g.isDemo);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'bracket.roundRemove',
      entityType: 'round',
      entityId: id,
      summary: `Removed round "${target.name.en}"`,
      summaryAr: `تم حذف الجولة "${target.name.ar}"`,
      before: { nameEn: target.name.en, order: target.order },
      after: null,
    });

    realtime.publish('bracket.updated', { roundId: id });
    return true;
  },
};
