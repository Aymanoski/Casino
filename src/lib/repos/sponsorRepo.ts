import type { Sponsor } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission } from './permissions';

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
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'sponsor.manage');

    const nextOrder =
      input.order || db.sponsors.reduce((max, s) => Math.max(max, s.order), 0) + 1;

    const newSponsor: Sponsor = {
      ...input,
      order: nextOrder,
      id: `sponsor-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    db.sponsors.push(newSponsor);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'sponsor.create',
      entityType: 'sponsor',
      entityId: newSponsor.id,
      summary: `Added sponsor "${newSponsor.name}" (${newSponsor.tierLabelEn})`,
      summaryAr: `تمت إضافة الراعي "${newSponsor.nameAr || newSponsor.name}"`,
      before: null,
      after: {
        name: newSponsor.name,
        tier: newSponsor.tier,
        logoText: newSponsor.logoText,
      },
    });

    realtime.publish('sponsor.updated', { sponsorId: newSponsor.id });
    return newSponsor;
  },

  async update(
    id: string,
    patch: Partial<Omit<Sponsor, 'id'>>,
    actorUserId = 'user-content'
  ): Promise<Sponsor | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'sponsor.manage');

    const idx = db.sponsors.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const before = { ...db.sponsors[idx] };
    const updated: Sponsor = { ...before, ...patch };
    db.sponsors[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'sponsor.update',
      entityType: 'sponsor',
      entityId: id,
      summary: `Updated sponsor "${updated.name}"`,
      summaryAr: `تم تحديث بيانات الراعي "${updated.nameAr || updated.name}"`,
      before: {
        name: before.name,
        tier: before.tier,
        logoText: before.logoText,
        blurb: before.blurb,
      },
      after: {
        name: updated.name,
        tier: updated.tier,
        logoText: updated.logoText,
        blurb: updated.blurb,
      },
    });

    realtime.publish('sponsor.updated', { sponsorId: id });
    return updated;
  },

  async reorder(
    orderedIds: string[],
    actorUserId = 'user-content'
  ): Promise<Sponsor[]> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'sponsor.manage');

    const beforeOrder = [...db.sponsors]
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id);
    const byId = new Map(db.sponsors.map((s) => [s.id, s]));
    const nextList: Sponsor[] = [];
    let order = 1;

    for (const id of orderedIds) {
      const item = byId.get(id);
      if (item) {
        nextList.push({ ...item, order: order++ });
        byId.delete(id);
      }
    }
    byId.forEach((item) => nextList.push({ ...item, order: order++ }));

    db.sponsors = nextList;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'sponsor.reorder',
      entityType: 'sponsor',
      entityId: 'sponsors-list',
      summary: `Reordered ${nextList.length} sponsor tiers`,
      summaryAr: `تم إعادة ترتيب ${nextList.length} من فئات الرعاة`,
      before: { order: beforeOrder },
      after: { order: nextList.map((s) => s.id) },
    });

    realtime.publish('sponsor.updated', {});
    return nextList;
  },

  async remove(id: string, actorUserId = 'user-content'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'sponsor.manage');

    const target = db.sponsors.find((s) => s.id === id);
    if (!target) return false;

    db.sponsors = db.sponsors
      .filter((s) => s.id !== id)
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'sponsor.remove',
      entityType: 'sponsor',
      entityId: id,
      summary: `Removed sponsor "${target.name}"`,
      summaryAr: `تم حذف الراعي "${target.nameAr || target.name}"`,
      before: { name: target.name, tier: target.tier },
      after: null,
    });

    realtime.publish('sponsor.updated', { sponsorId: id });
    return true;
  },
};
