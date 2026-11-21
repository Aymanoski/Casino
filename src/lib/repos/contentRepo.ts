import type { ContentCategory, ContentItem } from '@/lib/schemas';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';

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
    return commands.createContent({ ...input, actorUserId });
  },

  async update(
    id: string,
    patch: Partial<Omit<ContentItem, 'id'>>,
    actorUserId = 'user-content'
  ): Promise<ContentItem | null> {
    return commands.updateContent({ contentId: id, patch, actorUserId });
  },

  async reorder(
    orderedIds: string[],
    actorUserId = 'user-content'
  ): Promise<ContentItem[]> {
    return commands.reorderContent({ orderedIds, actorUserId });
  },

  async remove(id: string, actorUserId = 'user-content'): Promise<boolean> {
    return commands.removeContent({ contentId: id, actorUserId });
  },
};
