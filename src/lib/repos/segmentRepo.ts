import type { Segment } from '@/lib/schemas';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

export const segmentRepo = {
  async list(): Promise<Segment[]> {
    const db = await storage.readSnapshot();
    return [...db.segments].sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<Segment | null> {
    const db = await storage.readSnapshot();
    return db.segments.find((s) => s.id === id) ?? null;
  },

  async create(
    input: Omit<Segment, 'id' | 'order'> & { order?: number },
    actorUserId = 'user-admin'
  ): Promise<Segment> {
    const db = await storage.readSnapshot();
    const nextOrder =
      input.order ??
      (db.segments.reduce((max, s) => Math.max(max, s.order), 0) + 1);

    const newSegment: Segment = {
      ...input,
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      order: nextOrder,
    };
    db.segments.push(newSegment);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.create',
      entityType: 'segment',
      entityId: newSegment.id,
      summary: `Created segment "${newSegment.nameEn}"`,
      summaryAr: `تم إضافة فقرة "${newSegment.nameAr}"`,
      before: null,
      after: { nameEn: newSegment.nameEn, presetPoints: newSegment.presetPoints },
    });

    return newSegment;
  },

  async update(
    id: string,
    patch: Partial<Omit<Segment, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Segment | null> {
    const db = await storage.readSnapshot();
    const idx = db.segments.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const before = { ...db.segments[idx] };
    const updated: Segment = { ...db.segments[idx], ...patch };
    db.segments[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.update',
      entityType: 'segment',
      entityId: id,
      summary: `Updated segment "${updated.nameEn}"`,
      summaryAr: `تم تحديث فقرة "${updated.nameAr}"`,
      before: { nameEn: before.nameEn, presetPoints: before.presetPoints },
      after: { nameEn: updated.nameEn, presetPoints: updated.presetPoints },
    });

    return updated;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    const target = db.segments.find((s) => s.id === id);
    if (!target || id === 'seg-16') return false; // Protect Tie-Breaker segment

    db.segments = db.segments.filter((s) => s.id !== id);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.remove',
      entityType: 'segment',
      entityId: id,
      summary: `Removed segment "${target.nameEn}"`,
      summaryAr: `تم حذف فقرة "${target.nameAr}"`,
      before: { nameEn: target.nameEn },
      after: null,
    });

    return true;
  },
};
