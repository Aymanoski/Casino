/**
 * Realtime Synchronization Layer (/lib/realtime)
 *
 * Prototype default: BrowserRealtimeTransport (BroadcastChannel + window 'storage'
 * fallback with message-ID deduplication) for instant cross-tab / cross-window sync
 * (e.g., Scorer Console -> Big Screen & Live Leaderboard).
 *
 * Production / Multi-Device Swap:
 * All UI and repositories talk strictly to the `realtime` broker (`RealtimeTransport`).
 * Plugging in a hosted WebSocket/Realtime provider (Supabase Realtime, Ably, Pusher,
 * PartyKit, or custom WebSockets) requires implementing `RealtimeTransport` and calling
 * `setRealtimeTransport(adapter)` (or extending `createRealtimeTransport`) — zero UI changes.
 */

import type { GameTimerState } from '@/lib/schemas';

export type RealtimeEventName =
  | 'score.changed'
  | 'buzz.recorded'
  | 'buzz.cleared'
  | 'segment.changed'
  | 'timer.updated'
  | 'game.started'
  | 'game.finished'
  | 'final.revealed'
  | 'player.updated'
  | 'bracket.updated'
  | 'settings.updated'
  | 'data.reset';

export interface RealtimeEventPayloadMap {
  'score.changed': {
    gameId: string;
    playerId?: string;
    delta?: number;
    scoreEventId?: string;
    isUndo?: boolean;
    isEdit?: boolean;
    isDelete?: boolean;
    reset?: boolean;
  };
  'buzz.recorded': {
    gameId: string;
    playerId: string;
    segmentId?: string;
    buzzId?: string;
  };
  'buzz.cleared': {
    gameId: string;
  };
  'segment.changed': {
    gameId: string;
    currentSegmentIndex: number;
    segmentId?: string;
    isTieBreaker?: boolean;
    tiedPlayerIds?: string[];
  };
  'timer.updated': {
    gameId: string;
    timer: GameTimerState;
  };
  'game.started': {
    gameId: string;
    reopened?: boolean;
  };
  'game.finished': {
    gameId: string;
    winnerPlayerId?: string;
    advancingPlayerIds?: string[];
  };
  'final.revealed': {
    gameId: string;
    winnerPlayerId?: string;
  };
  'player.updated': {
    playerId?: string;
  };
  'bracket.updated': {
    gameId?: string;
    roundId?: string;
  };
  'settings.updated': {
    keys?: string[];
  };
  'data.reset': {
    reason?: string;
  };
}

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type RealtimeStatusListener = (status: RealtimeConnectionStatus) => void;

export interface RealtimeMessage<T = Record<string, unknown>> {
  id: string;
  event: RealtimeEventName;
  payload: T;
  timestamp: string;
  /** Identifies the publishing transport/tab so receivers can trace origin */
  source?: string;
}

export type RealtimeListener<T = Record<string, unknown>> = (
  message: RealtimeMessage<T>
) => void;

/**
 * Swappable transport contract for local browser sync or hosted multi-device WebSockets.
 */
export interface RealtimeTransport {
  readonly name: string;
  connect: () => Promise<void> | void;
  disconnect: () => Promise<void> | void;
  getStatus: () => RealtimeConnectionStatus;
  onStatusChange: (listener: RealtimeStatusListener) => () => void;
  publish: <T = Record<string, unknown>>(
    event: RealtimeEventName,
    payload: T
  ) => void;
  subscribe: (
    event: RealtimeEventName | '*',
    listener: RealtimeListener
  ) => () => void;
}

/**
 * Configuration blueprint for plugging in a hosted realtime provider
 * (e.g. Supabase Realtime, Ably, Pusher, PartyKit, or custom WebSocket server).
 */
export interface HostedRealtimeConfig {
  driver: 'browser' | 'supabase' | 'ably' | 'pusher' | 'websocket';
  endpoint?: string;
  apiKey?: string;
  channelName?: string;
}

const DEFAULT_CHANNEL_NAME = 'casino_el_al3ab_realtime_v1';
const STORAGE_BROADCAST_KEY = 'casino_el_al3ab_rt_ping_v1';
const MAX_SEEN_IDS = 128;
const BROADCAST_FALLBACK_DELAY_MS = 60;

export class BrowserRealtimeTransport implements RealtimeTransport {
  readonly name = 'browser-broadcast';
  private channelName: string;
  private channel: BroadcastChannel | null = null;
  private listeners: Map<RealtimeEventName | '*', Set<RealtimeListener>> =
    new Map();
  private statusListeners: Set<RealtimeStatusListener> = new Set();
  private status: RealtimeConnectionStatus = 'idle';
  private initialized = false;
  private seenIds: string[] = [];
  private seenIdSet: Set<string> = new Set();
  private pendingFallbacks: Map<string, number> = new Map();
  private storageHandler: ((ev: StorageEvent) => void) | null = null;

  constructor(channelName = DEFAULT_CHANNEL_NAME) {
    this.channelName = channelName;
  }

  private setStatus(next: RealtimeConnectionStatus) {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((cb) => cb(next));
  }

  private markAndCheckDuplicate(id: string): boolean {
    if (this.seenIdSet.has(id)) return true;
    this.seenIdSet.add(id);
    this.seenIds.push(id);
    if (this.seenIds.length > MAX_SEEN_IDS) {
      const oldest = this.seenIds.shift();
      if (oldest) this.seenIdSet.delete(oldest);
    }
    return false;
  }

  private deliverCrossTabMessage(message: RealtimeMessage) {
    const pendingTimer = this.pendingFallbacks.get(message.id);
    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
      this.pendingFallbacks.delete(message.id);
    }
    if (this.markAndCheckDuplicate(message.id)) return;
    this.notifyLocalListeners(message);
  }

  connect(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    this.setStatus('connecting');

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (ev: MessageEvent<RealtimeMessage>) => {
          const msg = ev.data;
          if (!msg || !msg.event || !msg.id) return;
          if (this.seenIdSet.has(msg.id)) return;

          // In multi-process browsers (Chromium), BroadcastChannel can outrace
          // cross-process localStorage replication by a few milliseconds. Wait
          // briefly for the strictly-ordered `storage` event (which guarantees
          // the DB snapshot is already committed in this renderer) before falling back.
          if (!this.pendingFallbacks.has(msg.id)) {
            const tid = window.setTimeout(() => {
              this.pendingFallbacks.delete(msg.id);
              this.deliverCrossTabMessage(msg);
            }, BROADCAST_FALLBACK_DELAY_MS);
            this.pendingFallbacks.set(msg.id, tid);
          }
        };
      } catch {
        this.channel = null;
      }
    }

    // Primary cross-tab delivery: fires strictly after the preceding DB localStorage write commits
    this.storageHandler = (ev: StorageEvent) => {
      if (ev.key === STORAGE_BROADCAST_KEY && ev.newValue) {
        try {
          const message = JSON.parse(ev.newValue) as RealtimeMessage;
          if (message && message.event && message.id) {
            this.deliverCrossTabMessage(message);
          }
        } catch {
          // ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', this.storageHandler);
    this.setStatus('connected');
  }

  disconnect(): void {
    if (!this.initialized) return;
    this.initialized = false;

    this.pendingFallbacks.forEach((tid) => window.clearTimeout(tid));
    this.pendingFallbacks.clear();

    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // ignore close error
      }
      this.channel = null;
    }

    if (typeof window !== 'undefined' && this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }

    this.setStatus('disconnected');
  }

  getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: RealtimeStatusListener): () => void {
    this.connect();
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyLocalListeners(message: RealtimeMessage) {
    const specific = this.listeners.get(message.event);
    if (specific) {
      specific.forEach((cb) => cb(message));
    }
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      wildcard.forEach((cb) => cb(message));
    }
  }

  publish<T = Record<string, unknown>>(
    event: RealtimeEventName,
    payload: T
  ): void {
    this.connect();
    const message: RealtimeMessage<T> = {
      id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      event,
      payload,
      timestamp: new Date().toISOString(),
      source: this.name,
    };

    // Deduplicate against our own storage/broadcast echo
    this.markAndCheckDuplicate(message.id);

    // Notify subscribers in the same window immediately
    this.notifyLocalListeners(message as RealtimeMessage);

    if (typeof window === 'undefined') return;

    // Broadcast across tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // Fallback below handles delivery
      }
    }

    try {
      window.localStorage.setItem(
        STORAGE_BROADCAST_KEY,
        JSON.stringify(message)
      );
    } catch {
      // Ignore quota errors
    }
  }

  subscribe(
    event: RealtimeEventName | '*',
    listener: RealtimeListener
  ): () => void {
    this.connect();
    const existing = this.listeners.get(event) ?? new Set<RealtimeListener>();
    existing.add(listener);
    this.listeners.set(event, existing);

    return () => {
      const current = this.listeners.get(event);
      if (current) {
        current.delete(listener);
      }
    };
  }
}

/**
 * Stable proxy broker that delegates to the active RealtimeTransport.
 * Allows hot-swapping the transport (e.g. Browser -> Supabase/Ably/WebSocket)
 * while preserving every active component subscription seamlessly.
 */
class RealtimeBroker implements RealtimeTransport {
  private transport: RealtimeTransport;
  private subscribers: Array<{
    event: RealtimeEventName | '*';
    listener: RealtimeListener;
    unsub: () => void;
  }> = [];
  private statusSubscribers: Array<{
    listener: RealtimeStatusListener;
    unsub: () => void;
  }> = [];

  constructor(initialTransport: RealtimeTransport) {
    this.transport = initialTransport;
  }

  get name(): string {
    return this.transport.name;
  }

  getTransport(): RealtimeTransport {
    return this.transport;
  }

  setTransport(nextTransport: RealtimeTransport): void {
    if (nextTransport === this.transport) return;

    // Unbind existing subscriptions from old transport
    this.subscribers.forEach((entry) => entry.unsub());
    this.statusSubscribers.forEach((entry) => entry.unsub());
    void this.transport.disconnect();

    // Swap and rebind all active subscribers onto the new transport
    this.transport = nextTransport;
    this.subscribers.forEach((entry) => {
      entry.unsub = this.transport.subscribe(entry.event, entry.listener);
    });
    this.statusSubscribers.forEach((entry) => {
      entry.unsub = this.transport.onStatusChange(entry.listener);
    });
  }

  connect(): Promise<void> | void {
    return this.transport.connect();
  }

  disconnect(): Promise<void> | void {
    return this.transport.disconnect();
  }

  getStatus(): RealtimeConnectionStatus {
    return this.transport.getStatus();
  }

  onStatusChange(listener: RealtimeStatusListener): () => void {
    const entry = {
      listener,
      unsub: this.transport.onStatusChange(listener),
    };
    this.statusSubscribers.push(entry);
    return () => {
      entry.unsub();
      const idx = this.statusSubscribers.indexOf(entry);
      if (idx !== -1) this.statusSubscribers.splice(idx, 1);
    };
  }

  publish<T = Record<string, unknown>>(
    event: RealtimeEventName,
    payload: T
  ): void {
    this.transport.publish(event, payload);
  }

  subscribe(
    event: RealtimeEventName | '*',
    listener: RealtimeListener
  ): () => void {
    const entry = {
      event,
      listener,
      unsub: this.transport.subscribe(event, listener),
    };
    this.subscribers.push(entry);
    return () => {
      entry.unsub();
      const idx = this.subscribers.indexOf(entry);
      if (idx !== -1) this.subscribers.splice(idx, 1);
    };
  }
}

/**
 * Factory helper for selecting a realtime transport from config.
 * Extend this switch when plugging in a hosted multi-device provider (see TODO.md §3).
 */
export function createRealtimeTransport(
  config: HostedRealtimeConfig = { driver: 'browser' }
): RealtimeTransport {
  switch (config.driver) {
    case 'browser':
    default:
      return new BrowserRealtimeTransport(
        config.channelName ?? DEFAULT_CHANNEL_NAME
      );
  }
}

const broker = new RealtimeBroker(createRealtimeTransport({ driver: 'browser' }));

export const realtime: RealtimeTransport = broker;

export function setRealtimeTransport(transport: RealtimeTransport): void {
  broker.setTransport(transport);
}

export function getRealtimeTransport(): RealtimeTransport {
  return broker.getTransport();
}
