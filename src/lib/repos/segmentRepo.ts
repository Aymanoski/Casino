import type { Segment } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission, PermissionDeniedError } from './permissions';

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
    assertRepoPermission(db, actorUserId, 'segment.manage');

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
      after: {
        nameEn: newSegment.nameEn,
        nameAr: newSegment.nameAr,
        category: newSegment.category,
        presetPoints: newSegment.presetPoints,
        durationSec: newSegment.durationSec ?? null,
      },
    });

    realtime.publish('segment.updated', { segmentId: newSegment.id });
    return newSegment;
  },

  async update(
    id: string,
    patch: Partial<Omit<Segment, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Segment | null> {
    const db = await storage.readSnapshot();
    const actor = assertRepoPermission(db, actorUserId, 'segment.editCopy');

    const idx = db.segments.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const before = { ...db.segments[idx] };

    // Content managers may only edit bilingual segment names/descriptions per AGENTS.md §4
    if (actor?.role === 'content') {
      const touchesRestrictedField =
        patch.category !== undefined && patch.category !== before.category ||
        patch.durationSec !== undefined && patch.durationSec !== before.durationSec ||
        patch.order !== undefined && patch.order !== before.order ||
        (patch.presetPoints !== undefined &&
          JSON.stringify(patch.presetPoints) !== JSON.stringify(before.presetPoints));

      if (touchesRestrictedField) {
        throw new PermissionDeniedError(
          'segment.manage',
          'content',
          'Content managers may only edit segment descriptions and titles, not scoring presets, timers, categories, or order.'
        );
      }
    }

    const updated: Segment = { ...before, ...patch };
    db.segments[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.update',
      entityType: 'segment',
      entityId: id,
      summary: `Updated segment "${updated.nameEn}"`,
      summaryAr: `تم تحديث فقرة "${updated.nameAr}"`,
      before: {
        nameEn: before.nameEn,
        nameAr: before.nameAr,
        descriptionEn: before.descriptionEn,
        category: before.category,
        presetPoints: before.presetPoints,
        durationSec: before.durationSec ?? null,
      },
      after: {
        nameEn: updated.nameEn,
        nameAr: updated.nameAr,
        descriptionEn: updated.descriptionEn,
        category: updated.category,
        presetPoints: updated.presetPoints,
        durationSec: updated.durationSec ?? null,
      },
    });

    realtime.publish('segment.updated', { segmentId: id });
    return updated;
  },

  async reorder(
    orderedIds: string[],
    actorUserId = 'user-admin'
  ): Promise<Segment[]> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'segment.manage');

    const beforeOrder = [...db.segments]
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id);

    const byId = new Map(db.segments.map((s) => [s.id, s]));
    const nextList: Segment[] = [];
    let order = 1;

    for (const id of orderedIds) {
      const seg = byId.get(id);
      if (seg) {
        nextList.push({ ...seg, order: order++ });
        byId.delete(id);
      }
    }
    // Preserve any remaining segments not explicitly listed
    byId.forEach((seg) => {
      nextList.push({ ...seg, order: order++ });
    });

    db.segments = nextList;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.reorder',
      entityType: 'segment',
      entityId: 'segment-library',
      summary: `Reordered ${nextList.length} segments in library`,
      summaryAr: `تم إعادة ترتيب ${nextList.length} فقرة في المكتبة`,
      before: { order: beforeOrder },
      after: { order: nextList.map((s) => s.id) },
    });

    realtime.publish('segment.updated', {});
    return nextList;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'segment.manage');

    const target = db.segments.find((s) => s.id === id);
    if (!target || id === 'seg-16') return false; // Protect Tie-Breaker segment

    db.segments = db.segments
      .filter((s) => s.id !== id)
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.remove',
      entityType: 'segment',
      entityId: id,
      summary: `Removed segment "${target.nameEn}"`,
      summaryAr: `تم حذف فقرة "${target.nameAr}"`,
      before: { nameEn: target.nameEn, category: target.category },
      after: null,
    });

    realtime.publish('segment.updated', { segmentId: id });
    return true;
  },
};
