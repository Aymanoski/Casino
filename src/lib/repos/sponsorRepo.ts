import type { Sponsor } from '@/lib/schemas';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

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
    const newSponsor: Sponsor = {
      ...input,
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
      after: { name: newSponsor.name, tier: newSponsor.tier },
    });

    return newSponsor;
  },

  async update(
    id: string,
    patch: Partial<Omit<Sponsor, 'id'>>,
    actorUserId = 'user-content'
  ): Promise<Sponsor | null> {
    const db = await storage.readSnapshot();
    const idx = db.sponsors.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const before = { ...db.sponsors[idx] };
    const updated: Sponsor = { ...db.sponsors[idx], ...patch };
    db.sponsors[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'sponsor.update',
      entityType: 'sponsor',
      entityId: id,
      summary: `Updated sponsor "${updated.name}"`,
      summaryAr: `تم تحديث بيانات الراعي "${updated.nameAr || updated.name}"`,
      before: { name: before.name, tier: before.tier },
      after: { name: updated.name, tier: updated.tier },
    });

    return updated;
  },

  async remove(id: string, actorUserId = 'user-content'): Promise<boolean> {
    const db = await storage.readSnapshot();
    const target = db.sponsors.find((s) => s.id === id);
    if (!target) return false;

    db.sponsors = db.sponsors.filter((s) => s.id !== id);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'sponsor.remove',
      entityType: 'sponsor',
      entityId: id,
      summary: `Removed sponsor "${target.name}"`,
      summaryAr: `تم حذف الراعي "${target.nameAr || target.name}"`,
      before: { name: target.name },
      after: null,
    });

    return true;
  },
};
