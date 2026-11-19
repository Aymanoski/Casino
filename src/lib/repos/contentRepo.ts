import type { ContentCategory, ContentItem } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission } from './permissions';

export const contentRepo = {
  async list(options?: { category?: ContentCategory }): Promise<ContentItem[]> {
    const db = await storage.readSnapshot();
    let list = [...db.contentItems];
    if (options?.category) {
      list = list.filter((c) => c.category === options.category);
    }
    return list.sort((a, b) => a.order - b.order);
  },

  async getByKey(key: string): Promise<ContentItem | null> {
    const db = await storage.readSnapshot();
    return db.contentItems.find((c) => c.key === key) ?? null;
  },

  async create(
    input: Omit<ContentItem, 'id' | 'updatedAt'>,
    actorUserId = 'user-content'
  ): Promise<ContentItem> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'content.manage');

    const nextOrder =
      input.order ??
      db.contentItems.reduce((max, c) => Math.max(max, c.order), 0) + 1;

    const item: ContentItem = {
      ...input,
      order: nextOrder,
      id: `content-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      updatedAt: new Date().toISOString(),
    };
    db.contentItems.push(item);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'content.create',
      entityType: 'content',
      entityId: item.id,
      summary: `Created content item "${item.titleEn}" (${item.category})`,
      summaryAr: `تمت إضافة محتوى "${item.titleAr}"`,
      before: null,
      after: {
        titleEn: item.titleEn,
        titleAr: item.titleAr,
        category: item.category,
        key: item.key,
      },
    });

    realtime.publish('content.updated', { contentId: item.id });
    return item;
  },

  async update(
    id: string,
    patch: Partial<Omit<ContentItem, 'id'>>,
    actorUserId = 'user-content'
  ): Promise<ContentItem | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'content.manage');

    const idx = db.contentItems.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const before = { ...db.contentItems[idx] };
    const updated: ContentItem = {
      ...before,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    db.contentItems[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'content.update',
      entityType: 'content',
      entityId: id,
      summary: `Updated content item "${updated.titleEn}"`,
      summaryAr: `تم تحديث المحتوى "${updated.titleAr}"`,
      before: {
        titleEn: before.titleEn,
        titleAr: before.titleAr,
        bodyEn: before.bodyEn,
        category: before.category,
      },
      after: {
        titleEn: updated.titleEn,
        titleAr: updated.titleAr,
        bodyEn: updated.bodyEn,
        category: updated.category,
      },
    });

    realtime.publish('content.updated', { contentId: id });
    return updated;
  },

  async reorder(
    orderedIds: string[],
    actorUserId = 'user-content'
  ): Promise<ContentItem[]> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'content.manage');

    const beforeOrder = [...db.contentItems]
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);
    const byId = new Map(db.contentItems.map((c) => [c.id, c]));
    const nextList: ContentItem[] = [];
    let order = 1;

    for (const id of orderedIds) {
      const item = byId.get(id);
      if (item) {
        nextList.push({ ...item, order: order++ });
        byId.delete(id);
      }
    }
    byId.forEach((item) => nextList.push({ ...item, order: order++ }));

    db.contentItems = nextList;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'content.reorder',
      entityType: 'content',
      entityId: 'content-list',
      summary: `Reordered ${nextList.length} content items`,
      summaryAr: `تم إعادة ترتيب ${nextList.length} عنصر محتوى`,
      before: { order: beforeOrder },
      after: { order: nextList.map((c) => c.id) },
    });

    realtime.publish('content.updated', {});
    return nextList;
  },

  async remove(id: string, actorUserId = 'user-content'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'content.manage');

    const target = db.contentItems.find((c) => c.id === id);
    if (!target) return false;

    db.contentItems = db.contentItems.filter((c) => c.id !== id);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'content.remove',
      entityType: 'content',
      entityId: id,
      summary: `Removed content item "${target.titleEn}"`,
      summaryAr: `تم حذف المحتوى "${target.titleAr}"`,
      before: { titleEn: target.titleEn, category: target.category },
      after: null,
    });

    realtime.publish('content.updated', { contentId: id });
    return true;
  },
};
