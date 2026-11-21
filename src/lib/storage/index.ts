/**
 * IndexedDB Storage Adapter (/lib/storage)
 *
 * Replaces localStorage (which caps out around ~5MB) with IndexedDB via `idb`
 * so the platform smoothly handles 720+ players, 1,000+ matches, and 100,000+ events.
 *
 * Architecture:
 * - Dedicated object stores with secondary indexes (by-matchId, by-playerId, by-roundId, etc.)
 * - Atomic delta commits (`commitDelta`) in a single IndexedDB readwrite transaction
 *   so scoring a point touches only the 3–5 modified rows instead of rewriting the whole DB.
 * - Write-through memory cache invalidated across tabs via BroadcastChannel + localStorage ping.
 * - Automatic SSR / Node fallback when IndexedDB is absent (tests use fake-indexeddb/auto
 *   to test the real IndexedDB path).
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AbsenceEvent,
  AuditEntry,
  BuzzEvent,
  CheckInEvent,
  ContentItem,
  DatabaseSnapshot,
  Group,
  Match,
  MatchLifecycleEvent,
  Player,
  Round,
  ScoreEvent,
  Segment,
  Settings,
  Sponsor,
  User,
} from '@/lib/schemas';
import {
  createSeedSnapshot,
  createSeedSnapshotAsync,
  SEED_VERSION,
  type CreateSeedOptions,
} from '@/lib/seed';

const DB_NAME = 'casino_el_al3ab_idb_v1';
const DB_SCHEMA_VERSION = 1;
const LEGACY_LOCALSTORAGE_KEY = 'casino_el_al3ab_db_v1';
const IDB_SYNC_CHANNEL = 'casino_el_al3ab_idb_sync_v1';
const IDB_SYNC_STORAGE_KEY = 'casino_el_al3ab_idb_ping_v1';

interface MetaRecord {
  id: 'dbMeta';
  version: number;
  settings: Settings;
  updatedAt: string;
}

interface CasinoIDBSchema extends DBSchema {
  meta: {
    key: string;
    value: MetaRecord;
  };
  players: {
    key: string;
    value: Player;
    indexes: { 'by-seed': number };
  };
  users: {
    key: string;
    value: User;
    indexes: { 'by-role': string; 'by-email': string };
  };
  groups: {
    key: string;
    value: Group;
    indexes: { 'by-number': number };
  };
  rounds: {
    key: string;
    value: Round;
    indexes: { 'by-order': number };
  };
  segments: {
    key: string;
    value: Segment;
    indexes: { 'by-order': number };
  };
  matches: {
    key: string;
    value: Match;
    indexes: {
      'by-roundId': string;
      'by-groupId': string;
      'by-judgeUserId': string;
      'by-status': string;
      'by-type': string;
    };
  };
  scoreEvents: {
    key: string;
    value: ScoreEvent;
    indexes: {
      'by-matchId': string;
      'by-playerId': string;
      'by-createdAt': string;
    };
  };
  absenceEvents: {
    key: string;
    value: AbsenceEvent;
    indexes: { 'by-matchId': string; 'by-playerId': string };
  };
  buzzEvents: {
    key: string;
    value: BuzzEvent;
    indexes: { 'by-matchId': string };
  };
  matchEvents: {
    key: string;
    value: MatchLifecycleEvent;
    indexes: { 'by-matchId': string };
  };
  checkInEvents: {
    key: string;
    value: CheckInEvent;
    indexes: { 'by-playerId': string };
  };
  auditEntries: {
    key: string;
    value: AuditEntry;
    indexes: { 'by-entityType': string; 'by-createdAt': string };
  };
  sponsors: {
    key: string;
    value: Sponsor;
    indexes: { 'by-order': number };
  };
  contentItems: {
    key: string;
    value: ContentItem;
    indexes: { 'by-category': string };
  };
}

const ALL_STORES = [
  'meta',
  'players',
  'users',
  'groups',
  'rounds',
  'segments',
  'matches',
  'scoreEvents',
  'absenceEvents',
  'buzzEvents',
  'matchEvents',
  'checkInEvents',
  'auditEntries',
  'sponsors',
  'contentItems',
] as const;

export interface StorageDelta {
  putPlayers?: Player[];
  deletePlayerIds?: string[];
  putUsers?: User[];
  deleteUserIds?: string[];
  putGroups?: Group[];
  deleteGroupIds?: string[];
  putRounds?: Round[];
  deleteRoundIds?: string[];
  putSegments?: Segment[];
  deleteSegmentIds?: string[];
  putMatches?: Match[];
  deleteMatchIds?: string[];
  putScoreEvents?: ScoreEvent[];
  putAbsenceEvents?: AbsenceEvent[];
  putBuzzEvents?: BuzzEvent[];
  putMatchEvents?: MatchLifecycleEvent[];
  putCheckInEvents?: CheckInEvent[];
  putAuditEntries?: AuditEntry[];
  putSponsors?: Sponsor[];
  deleteSponsorIds?: string[];
  putContentItems?: ContentItem[];
  deleteContentItemIds?: string[];
  settings?: Settings;
}

export interface StorageAdapter {
  readSnapshot: () => Promise<DatabaseSnapshot>;
  writeSnapshot: (snapshot: DatabaseSnapshot) => Promise<void>;
  commitDelta: (delta: StorageDelta, nextSnapshotCache?: DatabaseSnapshot) => Promise<void>;
  resetToSeed: (options?: CreateSeedOptions) => Promise<DatabaseSnapshot>;
  invalidateCache: () => void;
  // Fast indexed query helpers for 1,000+ matches & 100,000+ events
  getMatch: (matchId: string) => Promise<Match | null>;
  getMatchesByRound: (roundId: string) => Promise<Match[]>;
  getMatchesByGroup: (groupId: string) => Promise<Match[]>;
  getMatchesByJudge: (judgeUserId: string) => Promise<Match[]>;
  getScoreEventsByMatch: (matchId: string) => Promise<ScoreEvent[]>;
  getScoreEventsByPlayer: (playerId: string) => Promise<ScoreEvent[]>;
  getAbsenceEventsByMatch: (matchId: string) => Promise<AbsenceEvent[]>;
  getBuzzEventsByMatch: (matchId: string) => Promise<BuzzEvent[]>;
  getMatchEventsByMatch: (matchId: string) => Promise<MatchLifecycleEvent[]>;
  getStoreCounts: () => Promise<{
    players: number;
    groups: number;
    matches: number;
    scoreEvents: number;
    absenceEvents: number;
    buzzEvents: number;
    matchEvents: number;
    auditEntries: number;
  }>;
}

let dbPromise: Promise<IDBPDatabase<CasinoIDBSchema>> | null = null;
let memorySnapshot: DatabaseSnapshot | null = null;
let syncBound = false;
let syncChannel: BroadcastChannel | null = null;
const tabInstanceId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function cloneData<T>(val: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(val);
  }
  return JSON.parse(JSON.stringify(val)) as T;
}

function bindCrossTabInvalidation(): void {
  if (syncBound || typeof window === 'undefined') return;
  syncBound = true;

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      syncChannel = new BroadcastChannel(IDB_SYNC_CHANNEL);
      syncChannel.onmessage = (ev: MessageEvent<{ source?: string }>) => {
        if (ev.data?.source !== tabInstanceId) {
          memorySnapshot = null;
        }
      };
    } catch {
      syncChannel = null;
    }
  }

  window.addEventListener('storage', (ev) => {
    if (ev.key === IDB_SYNC_STORAGE_KEY) {
      memorySnapshot = null;
    }
  });
}

function notifyOtherTabsCommitted(): void {
  if (typeof window === 'undefined') return;
  bindCrossTabInvalidation();
  const payload = { source: tabInstanceId, ts: Date.now() };
  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch {
      // ignore
    }
  }
  try {
    window.localStorage.setItem(IDB_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function cleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY)) {
      window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

async function getDb(): Promise<IDBPDatabase<CasinoIDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<CasinoIDBSchema>(DB_NAME, DB_SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('players')) {
          const s = db.createObjectStore('players', { keyPath: 'id' });
          s.createIndex('by-seed', 'seed');
        }
        if (!db.objectStoreNames.contains('users')) {
          const s = db.createObjectStore('users', { keyPath: 'id' });
          s.createIndex('by-role', 'role');
          s.createIndex('by-email', 'email');
        }
        if (!db.objectStoreNames.contains('groups')) {
          const s = db.createObjectStore('groups', { keyPath: 'id' });
          s.createIndex('by-number', 'number');
        }
        if (!db.objectStoreNames.contains('rounds')) {
          const s = db.createObjectStore('rounds', { keyPath: 'id' });
          s.createIndex('by-order', 'order');
        }
        if (!db.objectStoreNames.contains('segments')) {
          const s = db.createObjectStore('segments', { keyPath: 'id' });
          s.createIndex('by-order', 'order');
        }
        if (!db.objectStoreNames.contains('matches')) {
          const s = db.createObjectStore('matches', { keyPath: 'id' });
          s.createIndex('by-roundId', 'roundId');
          s.createIndex('by-groupId', 'groupId');
          s.createIndex('by-judgeUserId', 'judgeUserId');
          s.createIndex('by-status', 'status');
          s.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('scoreEvents')) {
          const s = db.createObjectStore('scoreEvents', { keyPath: 'id' });
          s.createIndex('by-matchId', 'matchId');
          s.createIndex('by-playerId', 'playerId');
          s.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('absenceEvents')) {
          const s = db.createObjectStore('absenceEvents', { keyPath: 'id' });
          s.createIndex('by-matchId', 'matchId');
          s.createIndex('by-playerId', 'playerId');
        }
        if (!db.objectStoreNames.contains('buzzEvents')) {
          const s = db.createObjectStore('buzzEvents', { keyPath: 'id' });
          s.createIndex('by-matchId', 'matchId');
        }
        if (!db.objectStoreNames.contains('matchEvents')) {
          const s = db.createObjectStore('matchEvents', { keyPath: 'id' });
          s.createIndex('by-matchId', 'matchId');
        }
        if (!db.objectStoreNames.contains('checkInEvents')) {
          const s = db.createObjectStore('checkInEvents', { keyPath: 'id' });
          s.createIndex('by-playerId', 'playerId');
        }
        if (!db.objectStoreNames.contains('auditEntries')) {
          const s = db.createObjectStore('auditEntries', { keyPath: 'id' });
          s.createIndex('by-entityType', 'entityType');
          s.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('sponsors')) {
          const s = db.createObjectStore('sponsors', { keyPath: 'id' });
          s.createIndex('by-order', 'order');
        }
        if (!db.objectStoreNames.contains('contentItems')) {
          const s = db.createObjectStore('contentItems', { keyPath: 'id' });
          s.createIndex('by-category', 'category');
        }
      },
    });
  }
  return dbPromise;
}

async function writeFullSnapshotToIDB(snapshot: DatabaseSnapshot): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...ALL_STORES], 'readwrite');

  await Promise.all(ALL_STORES.map((name) => tx.objectStore(name).clear()));

  const metaStore = tx.objectStore('meta');
  void metaStore.put({
    id: 'dbMeta',
    version: snapshot.version,
    settings: snapshot.settings,
    updatedAt: new Date().toISOString(),
  });

  const putAll = <K extends Exclude<(typeof ALL_STORES)[number], 'meta'>>(
    storeName: K,
    rows: Array<CasinoIDBSchema[K]['value']>
  ) => {
    const store = tx.objectStore(storeName);
    for (const row of rows) {
      void store.put(row);
    }
  };

  putAll('players', snapshot.players);
  putAll('users', snapshot.users);
  putAll('groups', snapshot.groups);
  putAll('rounds', snapshot.rounds);
  putAll('segments', snapshot.segments);
  putAll('matches', snapshot.matches);
  putAll('scoreEvents', snapshot.scoreEvents);
  putAll('absenceEvents', snapshot.absenceEvents);
  putAll('buzzEvents', snapshot.buzzEvents);
  putAll('matchEvents', snapshot.matchEvents);
  putAll('checkInEvents', snapshot.checkInEvents);
  putAll('auditEntries', snapshot.auditEntries);
  putAll('sponsors', snapshot.sponsors);
  putAll('contentItems', snapshot.contentItems);

  await tx.done;
}

async function readFullSnapshotFromIDB(): Promise<DatabaseSnapshot | null> {
  const db = await getDb();
  const meta = await db.get('meta', 'dbMeta');
  if (!meta || meta.version !== SEED_VERSION) {
    return null;
  }

  const tx = db.transaction([...ALL_STORES], 'readonly');
  const [
    players,
    users,
    groups,
    rounds,
    segments,
    matches,
    scoreEvents,
    absenceEvents,
    buzzEvents,
    matchEvents,
    checkInEvents,
    auditEntries,
    sponsors,
    contentItems,
  ] = await Promise.all([
    tx.objectStore('players').getAll(),
    tx.objectStore('users').getAll(),
    tx.objectStore('groups').getAll(),
    tx.objectStore('rounds').getAll(),
    tx.objectStore('segments').getAll(),
    tx.objectStore('matches').getAll(),
    tx.objectStore('scoreEvents').getAll(),
    tx.objectStore('absenceEvents').getAll(),
    tx.objectStore('buzzEvents').getAll(),
    tx.objectStore('matchEvents').getAll(),
    tx.objectStore('checkInEvents').getAll(),
    tx.objectStore('auditEntries').getAll(),
    tx.objectStore('sponsors').getAll(),
    tx.objectStore('contentItems').getAll(),
  ]);
  await tx.done;

  return {
    version: meta.version,
    players,
    users,
    groups,
    rounds,
    segments,
    matches,
    scoreEvents,
    absenceEvents,
    buzzEvents,
    matchEvents,
    checkInEvents,
    auditEntries,
    sponsors,
    contentItems,
    settings: meta.settings,
  };
}

let initInFlight: Promise<DatabaseSnapshot> | null = null;

async function ensureInitialized(): Promise<DatabaseSnapshot> {
  if (memorySnapshot) {
    return memorySnapshot;
  }

  if (!hasIndexedDB()) {
    memorySnapshot = createSeedSnapshot();
    return memorySnapshot;
  }

  bindCrossTabInvalidation();

  if (!initInFlight) {
    initInFlight = (async () => {
      try {
        const existing = await readFullSnapshotFromIDB();
        if (existing) {
          memorySnapshot = existing;
          return existing;
        }
      } catch {
        // Fall through to clean seed on corrupted store
      }

      cleanupLegacyLocalStorage();
      const fresh = await createSeedSnapshotAsync();
      await writeFullSnapshotToIDB(fresh);
      memorySnapshot = fresh;
      return fresh;
    })().finally(() => {
      initInFlight = null;
    });
  }

  return initInFlight;
}

function shallowCloneSnapshot(snap: DatabaseSnapshot): DatabaseSnapshot {
  return {
    version: snap.version,
    players: [...snap.players],
    users: [...snap.users],
    groups: [...snap.groups],
    rounds: [...snap.rounds],
    segments: [...snap.segments],
    matches: [...snap.matches],
    scoreEvents: [...snap.scoreEvents],
    absenceEvents: [...snap.absenceEvents],
    buzzEvents: [...snap.buzzEvents],
    matchEvents: [...snap.matchEvents],
    checkInEvents: [...snap.checkInEvents],
    auditEntries: [...snap.auditEntries],
    sponsors: [...snap.sponsors],
    contentItems: [...snap.contentItems],
    settings: {
      ...snap.settings,
      tournament: { ...snap.settings.tournament },
      bracketConfig: { ...snap.settings.bracketConfig },
    },
  };
}

export const storage: StorageAdapter = {
  invalidateCache(): void {
    memorySnapshot = null;
  },

  async readSnapshot(): Promise<DatabaseSnapshot> {
    const snap = await ensureInitialized();
    return shallowCloneSnapshot(snap);
  },

  async writeSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
    const copied = shallowCloneSnapshot(snapshot);
    if (hasIndexedDB()) {
      await writeFullSnapshotToIDB(copied);
    }
    memorySnapshot = copied;
    notifyOtherTabsCommitted();
  },

  async commitDelta(
    delta: StorageDelta,
    nextSnapshotCache?: DatabaseSnapshot
  ): Promise<void> {
    if (hasIndexedDB()) {
      const storeNames = new Set<(typeof ALL_STORES)[number]>();
      if (delta.settings) storeNames.add('meta');
      if (delta.putPlayers?.length || delta.deletePlayerIds?.length) storeNames.add('players');
      if (delta.putUsers?.length || delta.deleteUserIds?.length) storeNames.add('users');
      if (delta.putGroups?.length || delta.deleteGroupIds?.length) storeNames.add('groups');
      if (delta.putRounds?.length || delta.deleteRoundIds?.length) storeNames.add('rounds');
      if (delta.putSegments?.length || delta.deleteSegmentIds?.length) storeNames.add('segments');
      if (delta.putMatches?.length || delta.deleteMatchIds?.length) storeNames.add('matches');
      if (delta.putScoreEvents?.length) storeNames.add('scoreEvents');
      if (delta.putAbsenceEvents?.length) storeNames.add('absenceEvents');
      if (delta.putBuzzEvents?.length) storeNames.add('buzzEvents');
      if (delta.putMatchEvents?.length) storeNames.add('matchEvents');
      if (delta.putCheckInEvents?.length) storeNames.add('checkInEvents');
      if (delta.putAuditEntries?.length) storeNames.add('auditEntries');
      if (delta.putSponsors?.length || delta.deleteSponsorIds?.length) storeNames.add('sponsors');
      if (delta.putContentItems?.length || delta.deleteContentItemIds?.length) {
        storeNames.add('contentItems');
      }

      if (storeNames.size > 0) {
        const db = await getDb();
        const tx = db.transaction(Array.from(storeNames), 'readwrite');

        if (delta.settings) {
          void tx.objectStore('meta').put({
            id: 'dbMeta',
            version: SEED_VERSION,
            settings: delta.settings,
            updatedAt: new Date().toISOString(),
          });
        }
        if (delta.putPlayers?.length || delta.deletePlayerIds?.length) {
          const s = tx.objectStore('players');
          for (const item of delta.putPlayers ?? []) void s.put(item);
          for (const id of delta.deletePlayerIds ?? []) void s.delete(id);
        }
        if (delta.putUsers?.length || delta.deleteUserIds?.length) {
          const s = tx.objectStore('users');
          for (const item of delta.putUsers ?? []) void s.put(item);
          for (const id of delta.deleteUserIds ?? []) void s.delete(id);
        }
        if (delta.putGroups?.length || delta.deleteGroupIds?.length) {
          const s = tx.objectStore('groups');
          for (const item of delta.putGroups ?? []) void s.put(item);
          for (const id of delta.deleteGroupIds ?? []) void s.delete(id);
        }
        if (delta.putRounds?.length || delta.deleteRoundIds?.length) {
          const s = tx.objectStore('rounds');
          for (const item of delta.putRounds ?? []) void s.put(item);
          for (const id of delta.deleteRoundIds ?? []) void s.delete(id);
        }
        if (delta.putSegments?.length || delta.deleteSegmentIds?.length) {
          const s = tx.objectStore('segments');
          for (const item of delta.putSegments ?? []) void s.put(item);
          for (const id of delta.deleteSegmentIds ?? []) void s.delete(id);
        }
        if (delta.putMatches?.length || delta.deleteMatchIds?.length) {
          const s = tx.objectStore('matches');
          for (const item of delta.putMatches ?? []) void s.put(item);
          for (const id of delta.deleteMatchIds ?? []) void s.delete(id);
        }
        if (delta.putScoreEvents?.length) {
          const s = tx.objectStore('scoreEvents');
          for (const item of delta.putScoreEvents) void s.put(item);
        }
        if (delta.putAbsenceEvents?.length) {
          const s = tx.objectStore('absenceEvents');
          for (const item of delta.putAbsenceEvents) void s.put(item);
        }
        if (delta.putBuzzEvents?.length) {
          const s = tx.objectStore('buzzEvents');
          for (const item of delta.putBuzzEvents) void s.put(item);
        }
        if (delta.putMatchEvents?.length) {
          const s = tx.objectStore('matchEvents');
          for (const item of delta.putMatchEvents) void s.put(item);
        }
        if (delta.putCheckInEvents?.length) {
          const s = tx.objectStore('checkInEvents');
          for (const item of delta.putCheckInEvents) void s.put(item);
        }
        if (delta.putAuditEntries?.length) {
          const s = tx.objectStore('auditEntries');
          for (const item of delta.putAuditEntries) void s.put(item);
        }
        if (delta.putSponsors?.length || delta.deleteSponsorIds?.length) {
          const s = tx.objectStore('sponsors');
          for (const item of delta.putSponsors ?? []) void s.put(item);
          for (const id of delta.deleteSponsorIds ?? []) void s.delete(id);
        }
        if (delta.putContentItems?.length || delta.deleteContentItemIds?.length) {
          const s = tx.objectStore('contentItems');
          for (const item of delta.putContentItems ?? []) void s.put(item);
          for (const id of delta.deleteContentItemIds ?? []) void s.delete(id);
        }

        await tx.done;
      }
    }

    if (nextSnapshotCache) {
      memorySnapshot = shallowCloneSnapshot(nextSnapshotCache);
    } else {
      memorySnapshot = null;
    }
    notifyOtherTabsCommitted();
  },

  async resetToSeed(options?: CreateSeedOptions): Promise<DatabaseSnapshot> {
    cleanupLegacyLocalStorage();
    const fresh = await createSeedSnapshotAsync(options);
    if (hasIndexedDB()) {
      await writeFullSnapshotToIDB(fresh);
    }
    memorySnapshot = fresh;
    notifyOtherTabsCommitted();
    return shallowCloneSnapshot(fresh);
  },

  async getMatch(matchId: string): Promise<Match | null> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      const m = memorySnapshot?.matches.find((x) => x.id === matchId);
      return m ? cloneData(m) : null;
    }
    const db = await getDb();
    const found = await db.get('matches', matchId);
    return found ? cloneData(found) : null;
  },

  async getMatchesByRound(roundId: string): Promise<Match[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.matches ?? []).filter((m) => m.roundId === roundId)
      );
    }
    const db = await getDb();
    return cloneData(await db.getAllFromIndex('matches', 'by-roundId', roundId));
  },

  async getMatchesByGroup(groupId: string): Promise<Match[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.matches ?? []).filter((m) => m.groupId === groupId)
      );
    }
    const db = await getDb();
    return cloneData(await db.getAllFromIndex('matches', 'by-groupId', groupId));
  },

  async getMatchesByJudge(judgeUserId: string): Promise<Match[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.matches ?? []).filter((m) => m.judgeUserId === judgeUserId)
      );
    }
    const db = await getDb();
    return cloneData(
      await db.getAllFromIndex('matches', 'by-judgeUserId', judgeUserId)
    );
  },

  async getScoreEventsByMatch(matchId: string): Promise<ScoreEvent[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.scoreEvents ?? []).filter((e) => e.matchId === matchId)
      );
    }
    const db = await getDb();
    return cloneData(
      await db.getAllFromIndex('scoreEvents', 'by-matchId', matchId)
    );
  },

  async getScoreEventsByPlayer(playerId: string): Promise<ScoreEvent[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.scoreEvents ?? []).filter((e) => e.playerId === playerId)
      );
    }
    const db = await getDb();
    return cloneData(
      await db.getAllFromIndex('scoreEvents', 'by-playerId', playerId)
    );
  },

  async getAbsenceEventsByMatch(matchId: string): Promise<AbsenceEvent[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.absenceEvents ?? []).filter((e) => e.matchId === matchId)
      );
    }
    const db = await getDb();
    return cloneData(
      await db.getAllFromIndex('absenceEvents', 'by-matchId', matchId)
    );
  },

  async getBuzzEventsByMatch(matchId: string): Promise<BuzzEvent[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.buzzEvents ?? []).filter((e) => e.matchId === matchId)
      );
    }
    const db = await getDb();
    return cloneData(
      await db.getAllFromIndex('buzzEvents', 'by-matchId', matchId)
    );
  },

  async getMatchEventsByMatch(matchId: string): Promise<MatchLifecycleEvent[]> {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return cloneData(
        (memorySnapshot?.matchEvents ?? []).filter((e) => e.matchId === matchId)
      );
    }
    const db = await getDb();
    return cloneData(
      await db.getAllFromIndex('matchEvents', 'by-matchId', matchId)
    );
  },

  async getStoreCounts() {
    await ensureInitialized();
    if (!hasIndexedDB()) {
      return {
        players: memorySnapshot?.players.length ?? 0,
        groups: memorySnapshot?.groups.length ?? 0,
        matches: memorySnapshot?.matches.length ?? 0,
        scoreEvents: memorySnapshot?.scoreEvents.length ?? 0,
        absenceEvents: memorySnapshot?.absenceEvents.length ?? 0,
        buzzEvents: memorySnapshot?.buzzEvents.length ?? 0,
        matchEvents: memorySnapshot?.matchEvents.length ?? 0,
        auditEntries: memorySnapshot?.auditEntries.length ?? 0,
      };
    }
    const db = await getDb();
    const tx = db.transaction(
      [
        'players',
        'groups',
        'matches',
        'scoreEvents',
        'absenceEvents',
        'buzzEvents',
        'matchEvents',
        'auditEntries',
      ],
      'readonly'
    );
    const [
      players,
      groups,
      matches,
      scoreEvents,
      absenceEvents,
      buzzEvents,
      matchEvents,
      auditEntries,
    ] = await Promise.all([
      tx.objectStore('players').count(),
      tx.objectStore('groups').count(),
      tx.objectStore('matches').count(),
      tx.objectStore('scoreEvents').count(),
      tx.objectStore('absenceEvents').count(),
      tx.objectStore('buzzEvents').count(),
      tx.objectStore('matchEvents').count(),
      tx.objectStore('auditEntries').count(),
    ]);
    await tx.done;
    return {
      players,
      groups,
      matches,
      scoreEvents,
      absenceEvents,
      buzzEvents,
      matchEvents,
      auditEntries,
    };
  },
};
