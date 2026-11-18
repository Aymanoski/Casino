/**
 * Realtime Synchronization Layer (/lib/realtime)
 *
 * Uses BroadcastChannel for instant cross-tab / cross-window synchronization
 * (e.g., Scorer Console -> Big Screen & Live Leaderboard), with a window 'storage'
 * event fallback. Structured behind a clean RealtimeTransport interface so a hosted
 * WebSocket/Realtime service can replace it later without touching UI components.
 */

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

export interface RealtimeMessage<T = Record<string, unknown>> {
  id: string;
  event: RealtimeEventName;
  payload: T;
  timestamp: string;
}

export type RealtimeListener<T = Record<string, unknown>> = (
  message: RealtimeMessage<T>
) => void;

export interface RealtimeTransport {
  publish: <T = Record<string, unknown>>(
    event: RealtimeEventName,
    payload: T
  ) => void;
  subscribe: (
    event: RealtimeEventName | '*',
    listener: RealtimeListener
  ) => () => void;
}

const CHANNEL_NAME = 'casino_el_al3ab_realtime_v1';
const STORAGE_BROADCAST_KEY = 'casino_el_al3ab_rt_ping_v1';

class BrowserRealtimeTransport implements RealtimeTransport {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<RealtimeEventName | '*', Set<RealtimeListener>> =
    new Map();
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (ev: MessageEvent<RealtimeMessage>) => {
          if (ev.data && ev.data.event) {
            this.notifyLocalListeners(ev.data);
          }
        };
      } catch {
        this.channel = null;
      }
    }

    // Storage event fallback for environments where BroadcastChannel isn't shared
    window.addEventListener('storage', (ev: StorageEvent) => {
      if (ev.key === STORAGE_BROADCAST_KEY && ev.newValue) {
        try {
          const message = JSON.parse(ev.newValue) as RealtimeMessage;
          if (message && message.event) {
            this.notifyLocalListeners(message);
          }
        } catch {
          // ignore malformed storage payload
        }
      }
    });
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
    this.ensureInitialized();
    const message: RealtimeMessage<T> = {
      id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Notify subscribers in the same window immediately
    this.notifyLocalListeners(message as RealtimeMessage);

    if (typeof window === 'undefined') return;

    // Broadcast across tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // Fallback below handles it
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
    this.ensureInitialized();
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

export const realtime: RealtimeTransport = new BrowserRealtimeTransport();
