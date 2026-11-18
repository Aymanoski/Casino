import type { AuditEntityType, AuditEntry } from '@/lib/schemas';
import { storage } from '@/lib/storage';

export interface RecordAuditInput {
  actorUserId: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  summaryAr?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export const auditRepo = {
  async list(options?: {
    entityType?: AuditEntityType;
    actorUserId?: string;
    order?: 'newest' | 'oldest';
  }): Promise<AuditEntry[]> {
    const db = await storage.readSnapshot();
    let entries = [...db.auditEntries];

    if (options?.entityType) {
      entries = entries.filter((e) => e.entityType === options.entityType);
    }
    if (options?.actorUserId) {
      entries = entries.filter((e) => e.actorUserId === options.actorUserId);
    }

    entries.sort((a, b) => {
      const diff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return options?.order === 'oldest' ? -diff : diff;
    });

    return entries;
  },

  async record(input: RecordAuditInput): Promise<AuditEntry> {
    const db = await storage.readSnapshot();
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      summaryAr: input.summaryAr,
      before: input.before ?? null,
      after: input.after ?? null,
      createdAt: new Date().toISOString(),
    };
    db.auditEntries.unshift(entry);
    await storage.writeSnapshot(db);
    return entry;
  },
};
