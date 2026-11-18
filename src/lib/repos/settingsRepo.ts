import type { Settings } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

export const settingsRepo = {
  async get(): Promise<Settings> {
    const db = await storage.readSnapshot();
    return db.settings;
  },

  async update(
    patch: Partial<Omit<Settings, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Settings> {
    const db = await storage.readSnapshot();
    const before = { ...db.settings };
    const updated: Settings = {
      ...db.settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    db.settings = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'settings.update',
      entityType: 'settings',
      entityId: 'global-settings',
      summary: 'Updated tournament settings & placeholders',
      summaryAr: 'تم تحديث إعدادات البطولة والبيانات المبدئية',
      before: {
        eventName: before.eventName,
        venue: before.venue,
        delightersEnabled: before.delightersEnabled,
      },
      after: {
        eventName: updated.eventName,
        venue: updated.venue,
        delightersEnabled: updated.delightersEnabled,
      },
    });

    realtime.publish('settings.updated', { settings: updated });
    return updated;
  },

  async resetDemoData(actorUserId = 'user-admin'): Promise<Settings> {
    const freshDb = await storage.resetToSeed();

    await auditRepo.record({
      actorUserId,
      action: 'system.reset',
      entityType: 'system',
      entityId: 'global-settings',
      summary: 'Reset all tournament demo data to factory seed state',
      summaryAr: 'تمت إعادة ضبط جميع البيانات التجريبية إلى الحالة الافتراضية',
      before: null,
      after: { version: freshDb.version },
    });

    realtime.publish('data.reset', { timestamp: new Date().toISOString() });
    return freshDb.settings;
  },
};
