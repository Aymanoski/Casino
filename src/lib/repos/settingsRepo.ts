import type { Settings } from '@/lib/schemas';
import type { CreateSeedOptions } from '@/lib/seed';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';

export const settingsRepo = {
  async get(): Promise<Settings> {
    const db = await storage.readSnapshot();
    return db.settings;
  },

  async update(
    patch: Partial<Omit<Settings, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Settings> {
    return commands.updateSettings({ patch, actorUserId });
  },

  async resetDemoData(
    actorUserId = 'user-admin',
    seedOptions?: CreateSeedOptions
  ): Promise<Settings> {
    return commands.resetDemoData({ actorUserId, seedOptions });
  },
};
