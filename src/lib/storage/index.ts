/**
 * Storage Adapter (/lib/storage)
 *
 * Persists the entire DatabaseSnapshot in localStorage under a versioned key,
 * lazy-initializing from createSeedSnapshot() on first visit or when resetDemoData()
 * is invoked. No UI component may import this file or /lib/seed directly; all reads
 * and writes go through the async repository modules in /lib/repos.
 *
 * Performance: caches the validated DatabaseSnapshot alongside its raw serialized
 * string so repeated repo reads within the same state skip redundant JSON.parse +
 * full Zod schema validation while remaining 100% cross-tab coherent.
 */

import { DatabaseSnapshotSchema, type DatabaseSnapshot } from '@/lib/schemas';
import { createSeedSnapshot, SEED_VERSION } from '@/lib/seed';

const STORAGE_KEY = 'casino_el_al3ab_db_v1';

let memoryCache: DatabaseSnapshot | null = null;
let cachedRaw: string | null = null;
let storageListenerBound = false;

function cloneSnapshot(snapshot: DatabaseSnapshot): DatabaseSnapshot {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot)) as DatabaseSnapshot;
}

function bindStorageInvalidation() {
  if (storageListenerBound || typeof window === 'undefined') return;
  storageListenerBound = true;
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY || ev.key === null) {
      memoryCache = null;
      cachedRaw = null;
    }
  });
}

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
    return cloneSnapshot(memoryCache);
  }

  bindStorageInvalidation();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      if (memoryCache && raw === cachedRaw) {
        return cloneSnapshot(memoryCache);
      }
      const parsed = JSON.parse(raw);
      const validated = DatabaseSnapshotSchema.safeParse(parsed);
      if (validated.success && validated.data.version === SEED_VERSION) {
        memoryCache = validated.data;
        cachedRaw = raw;
        return cloneSnapshot(validated.data);
      }
    }
  } catch {
    // Fall back to fresh seed if corrupted
  }

  const fresh = createSeedSnapshot();
  const serialized = JSON.stringify(fresh);
  memoryCache = fresh;
  cachedRaw = serialized;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota errors
  }
  return cloneSnapshot(fresh);
}

export const storage: StorageAdapter = {
  async readSnapshot(): Promise<DatabaseSnapshot> {
    return loadFromLocalStorage();
  },

  async writeSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
    const frozen = cloneSnapshot(snapshot);
    const serialized = JSON.stringify(frozen);
    memoryCache = frozen;
    cachedRaw = serialized;
    if (typeof window !== 'undefined') {
      bindStorageInvalidation();
      try {
        window.localStorage.setItem(STORAGE_KEY, serialized);
      } catch {
        // Ignore storage quota errors
      }
    }
  },

  async resetToSeed(): Promise<DatabaseSnapshot> {
    const fresh = createSeedSnapshot();
    const serialized = JSON.stringify(fresh);
    memoryCache = fresh;
    cachedRaw = serialized;
    if (typeof window !== 'undefined') {
      bindStorageInvalidation();
      try {
        window.localStorage.setItem(STORAGE_KEY, serialized);
      } catch {
        // Ignore storage quota errors
      }
    }
    return cloneSnapshot(fresh);
  },
};
