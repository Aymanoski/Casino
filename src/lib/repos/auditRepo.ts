import type { AuditEntityType, AuditEntry } from '@/lib/schemas';
import { storage } from '@/lib/storage';
import { assertRepoPermission } from './permissions';

export const auditRepo = {
  async list(options?: {
    entityType?: AuditEntityType;
    actorUserId?: string;
    order?: 'newest' | 'oldest';
    requesterUserId?: string | null;
  }): Promise<AuditEntry[]> {
    const db = await storage.readSnapshot();
    if (options && 'requesterUserId' in options) {
      assertRepoPermission(db, options.requesterUserId, 'audit.read');
    }

    let entries = [...db.auditEntries];
    if (options?.entityType) {
      entries = entries.filter((e) => e.entityType === options.entityType);
    }
    if (options?.actorUserId) {
      entries = entries.filter((e) => e.actorUserId === options.actorUserId);
    }

    entries.sort((a, b) => {
      const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return options?.order === 'oldest' ? -diff : diff;
    });

    return entries;
  },
};
