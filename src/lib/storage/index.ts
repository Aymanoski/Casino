/**
 * Storage Adapter (/lib/storage)
 *
 * Persists the entire DatabaseSnapshot in localStorage under a versioned key,
 * lazy-initializing from createSeedSnapshot() on first visit or when resetDemoData()
 * is invoked. No UI component may import this file or /lib/seed directly; all reads
 * and writes go through the async repository modules in /lib/repos.
 */

import { DatabaseSnapshotSchema, type DatabaseSnapshot } from '@/lib/schemas';
import { createSeedSnapshot, SEED_VERSION } from '@/lib/seed';

const STORAGE_KEY = 'casino_el_al3ab_db_v1';

let memoryCache: DatabaseSnapshot | null = null;

export interface StorageAdapter {
  readSnapshot: () => Promise<DatabaseSnapshot>;
  writeSnapshot: (snapshot: DatabaseSnapshot) => Promise<void>;
  resetToSeed: () => Promise<DatabaseSnapshot>;
}

function loadFromLocalStorage(): DatabaseSnapshot {
  if (typeof window === 'undefined') {
    if (!memoryCache) {
      memoryCache = createSeedSnapshot();
    }
    return memoryCache;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validated = DatabaseSnapshotSchema.safeParse(parsed);
      if (validated.success && validated.data.version === SEED_VERSION) {
        memoryCache = validated.data;
        return validated.data;
      }
    }
  } catch {
    // Fall back to fresh seed if corrupted
  }

  const fresh = createSeedSnapshot();
  memoryCache = fresh;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore storage quota errors
  }
  return fresh;
}

export const storage: StorageAdapter = {
  async readSnapshot(): Promise<DatabaseSnapshot> {
    return loadFromLocalStorage();
  },

  async writeSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
    memoryCache = snapshot;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Ignore storage quota errors
      }
    }
  },

  async resetToSeed(): Promise<DatabaseSnapshot> {
    const fresh = createSeedSnapshot();
    memoryCache = fresh;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } catch {
        // Ignore storage quota errors
      }
    }
    return fresh;
  },
};
