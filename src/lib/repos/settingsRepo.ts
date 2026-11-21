import type { Settings, TournamentSettings } from '@/lib/schemas';
import type { SettingsImpactPreview } from '@/lib/engine';
import type { CreateSeedOptions } from '@/lib/seed';
import { commands, type CascadePolicy } from '@/lib/commands';
import { storage } from '@/lib/storage';

export const settingsRepo = {
  async get(): Promise<Settings> {
    const db = await storage.readSnapshot();
    return db.settings;
  },

  async previewImpact(
    tournament: Partial<TournamentSettings>
  ): Promise<SettingsImpactPreview> {
    return commands.previewSettingsImpact({ tournament });
  },

  async update(
    patch: Partial<Omit<Settings, 'id'>>,
    actorUserId = 'user-admin',
    options?: {
      confirmCascade?: boolean;
      cascadePolicy?: CascadePolicy;
      confirmStructuralRebuild?: boolean;
      rebuildTournament?: boolean;
      rescheduleUpcoming?: boolean;
    }
  ): Promise<Settings> {
    return commands.updateSettings({
      patch,
      actorUserId,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      confirmStructuralRebuild: options?.confirmStructuralRebuild,
      rebuildTournament: options?.rebuildTournament,
      rescheduleUpcoming: options?.rescheduleUpcoming,
    });
  },

  async resetDemoData(
    actorUserId = 'user-admin',
    seedOptions?: CreateSeedOptions
  ): Promise<Settings> {
    return commands.resetDemoData({ actorUserId, seedOptions });
  },
};
