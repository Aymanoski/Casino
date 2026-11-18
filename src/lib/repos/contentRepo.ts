import type { ContentCategory, ContentItem } from '@/lib/schemas';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

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
    const item: ContentItem = {
      ...input,
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
      summary: `Created content item "${item.titleEn}"`,
      summaryAr: `تمت إضافة محتوى "${item.titleAr}"`,
      before: null,
      after: { titleEn: item.titleEn, category: item.category },
    });

    return item;
  },

  async update(
    id: string,
    patch: Partial<Omit<ContentItem, 'id'>>,
    actorUserId = 'user-content'
  ): Promise<ContentItem | null> {
    const db = await storage.readSnapshot();
    const idx = db.contentItems.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const before = { ...db.contentItems[idx] };
    const updated: ContentItem = {
      ...db.contentItems[idx],
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
      before: { titleEn: before.titleEn, bodyEn: before.bodyEn },
      after: { titleEn: updated.titleEn, bodyEn: updated.bodyEn },
    });

    return updated;
  },

  async remove(id: string, actorUserId = 'user-content'): Promise<boolean> {
    const db = await storage.readSnapshot();
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
      before: { titleEn: target.titleEn },
      after: null,
    });

    return true;
  },
};
