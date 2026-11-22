/**
 * Realtime Synchronization Layer (/lib/realtime)
 *
 * BroadcastChannel + window 'storage' fallback with message-ID deduplication.
 * Every command broadcasts realtime events ONLY AFTER IndexedDB commit succeeds.
 * On receiving a cross-tab realtime event, listeners automatically invalidate the
 * local storage read cache before re-reading from IndexedDB.
 */

import type { GameTimerState } from '@/lib/schemas';

export type RealtimeEventName =
  | 'score.changed'
  | 'buzz.recorded'
  | 'buzz.cleared'
  | 'absence.recorded'
  | 'segment.changed'
  | 'timer.updated'
  | 'game.started'
  | 'game.finished'
  | 'match.started'
  | 'match.finished'
  | 'match.needsReview'
  | 'final.revealed'
  | 'player.updated'
  | 'user.updated'
  | 'segment.updated'
  | 'content.updated'
  | 'sponsor.updated'
  | 'bracket.updated'
  | 'tournament.generated'
  | 'consistency.repaired'
  | 'settings.updated'
  | 'data.reset'
  | 'quiz.started'
  | 'quiz.answered'
  | 'quiz.timedOut'
  | 'quiz.finished'
  | 'quiz.reset'
  | 'quiz.questionUpdated'
  | 'quiz.settingsUpdated'
  | 'quiz.handoffCompleted';

export interface RealtimeEventPayloadMap {
  'score.changed': {
    gameId: string;
    matchId?: string;
    playerId?: string;
    delta?: number;
    kind?: 'point' | 'yellow' | 'red' | 'undo';
    scoreEventId?: string;
    isUndo?: boolean;
    isEdit?: boolean;
    reset?: boolean;
  };
  'buzz.recorded': {
    gameId: string;
    matchId?: string;
    playerId: string;
    segmentId?: string;
    buzzId?: string;
  };
  'buzz.cleared': {
    gameId: string;
    matchId?: string;
  };
  'absence.recorded': {
    matchId: string;
    gameId?: string;
    playerId: string;
    action: 'marked' | 'reversed';
  };
  'segment.changed': {
    gameId: string;
    matchId?: string;
    currentSegmentIndex: number;
    segmentId?: string;
    isTieBreaker?: boolean;
    tiedPlayerIds?: string[];
  };
  'timer.updated': {
    gameId: string;
    matchId?: string;
    timer: GameTimerState;
  };
  'game.started': {
    gameId: string;
    matchId?: string;
    reopened?: boolean;
  };
  'game.finished': {
    gameId: string;
    matchId?: string;
    winnerPlayerId?: string;
    advancingPlayerIds?: string[];
  };
  'match.started': {
    matchId: string;
    gameId?: string;
    reopened?: boolean;
  };
  'match.finished': {
    matchId: string;
    gameId?: string;
    winnerId?: string;
  };
  'match.needsReview': {
    matchId: string;
    reason?: string;
  };
  'final.revealed': {
    gameId: string;
    matchId?: string;
    winnerPlayerId?: string;
  };
  'player.updated': {
    playerId?: string;
  };
  'user.updated': {
    userId?: string;
  };
  'segment.updated': {
    segmentId?: string;
  };
  'content.updated': {
    contentId?: string;
  };
  'sponsor.updated': {
    sponsorId?: string;
  };
  'bracket.updated': {
    gameId?: string;
    matchId?: string;
    roundId?: string;
    groupId?: string;
  };
  'tournament.generated': {
    totalPlayers: number;
    groupsCount: number;
    matchesCount: number;
  };
  'consistency.repaired': {
    violationsRepaired: number;
  };
  'settings.updated': {
    keys?: string[];
  };
  'data.reset': {
    reason?: string;
  };
  'quiz.started': {
    applicantId: string;
    attemptId: string;
  };
  'quiz.answered': {
    applicantId: string;
    attemptId: string;
    questionIndex: number;
  };
  'quiz.timedOut': {
    applicantId: string;
    attemptId: string;
    questionIndex: number;
  };
  'quiz.finished': {
    applicantId: string;
    attemptId: string;
    score?: number;
    totalResponseTimeMs?: number;
  };
  'quiz.reset': {
    applicantId: string;
    attemptId: string;
  };
  'quiz.questionUpdated': {
    questionId?: string;
  };
  'quiz.settingsUpdated': {
    keys?: string[];
  };
  'quiz.handoffCompleted': {
    createdCount: number;
    linkedCount: number;
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
  source?: string;
}

export type RealtimeListener<T = Record<string, unknown>> = (
  message: RealtimeMessage<T>
) => void;

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

export interface HostedRealtimeConfig {
  driver: 'browser' | 'supabase' | 'ably' | 'pusher' | 'websocket';
  endpoint?: string;
  apiKey?: string;
  channelName?: string;
}

const DEFAULT_CHANNEL_NAME = 'casino_el_al3ab_realtime_v2';
const STORAGE_BROADCAST_KEY = 'casino_el_al3ab_rt_ping_v2';
const MAX_SEEN_IDS = 256;

let onCrossTabReceiveHook: (() => void) | null = null;
export function registerCrossTabCacheInvalidator(fn: () => void): void {
  onCrossTabReceiveHook = fn;
}

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
    if (this.markAndCheckDuplicate(message.id)) return;
    if (onCrossTabReceiveHook) {
      onCrossTabReceiveHook();
    }
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
          this.deliverCrossTabMessage(msg);
        };
      } catch {
        this.channel = null;
      }
    }

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

    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // ignore
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

    this.markAndCheckDuplicate(message.id);
    this.notifyLocalListeners(message as RealtimeMessage);

    if (typeof window === 'undefined') return;

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // fallback below
      }
    }

    try {
      window.localStorage.setItem(
        STORAGE_BROADCAST_KEY,
        JSON.stringify(message)
      );
    } catch {
      // ignore quota errors
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
    this.subscribers.forEach((entry) => entry.unsub());
    this.statusSubscribers.forEach((entry) => entry.unsub());
    void this.transport.disconnect();

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
