import type { Settings } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission } from './permissions';

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
    assertRepoPermission(db, actorUserId, 'settings.manage');

    const before = { ...db.settings };
    const updated: Settings = {
      ...before,
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
        eventDates: before.eventDates,
        venue: before.venue,
        prizeText: before.prizeText,
        defaultLanguage: before.defaultLanguage,
        useArabicIndicDigits: before.useArabicIndicDigits,
        bracketConfig: before.bracketConfig,
      },
      after: {
        eventName: updated.eventName,
        eventDates: updated.eventDates,
        venue: updated.venue,
        prizeText: updated.prizeText,
        defaultLanguage: updated.defaultLanguage,
        useArabicIndicDigits: updated.useArabicIndicDigits,
        bracketConfig: updated.bracketConfig,
      },
    });

    realtime.publish('settings.updated', { keys: Object.keys(patch) });
    return updated;
  },

  async resetDemoData(actorUserId = 'user-admin'): Promise<Settings> {
    const currentDb = await storage.readSnapshot();
    assertRepoPermission(currentDb, actorUserId, 'settings.manage');

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

    realtime.publish('data.reset', { reason: 'admin-reset' });
    return freshDb.settings;
  },
};
