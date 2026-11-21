import type {
  AbsenceEvent,
  BuzzEvent,
  Player,
  ScoreEvent,
  ScoreEventKind,
} from '@/lib/schemas';
import {
  computeLeaderboard,
  computeMatchResult,
  computeMatchScores,
  computeQualifiers,
} from '@/lib/engine';
import { commands, type CascadePolicy } from '@/lib/commands';
import { storage } from '@/lib/storage';

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  totalPoints: number;
  matchesPlayed: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  groupPoints: number;
  yellowCards: number;
  redCards: number;
  absences: number;
}

export const scoreRepo = {
  async list(options?: {
    matchId?: string;
    gameId?: string;
    playerId?: string;
    roundId?: string;
    scorerUserId?: string;
    order?: 'newest' | 'oldest';
    includeDemo?: boolean;
  }): Promise<ScoreEvent[]> {
    const matchFilter = options?.matchId ?? options?.gameId;

    // Fast indexed path for single-match or single-player lookups (scales to 100k+ events!)
    if (matchFilter && !options?.roundId) {
      let events = await storage.getScoreEventsByMatch(matchFilter);
      if (options?.playerId) {
        events = events.filter((e) => e.playerId === options.playerId);
      }
      if (options?.scorerUserId) {
        events = events.filter((e) => e.byUserId === options.scorerUserId);
      }
      events.sort((a, b) => {
        const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
        return options?.order === 'oldest' ? -diff : diff;
      });
      return events;
    }

    const db = await storage.readSnapshot();
    const demoMatchIds = new Set(
      db.matches.filter((m) => m.isDemo).map((m) => m.id)
    );
    let events = [...db.scoreEvents];

    if (matchFilter) {
      events = events.filter((e) => e.matchId === matchFilter);
    } else if (!options?.includeDemo) {
      events = events.filter((e) => !demoMatchIds.has(e.matchId));
    }
    if (options?.playerId) {
      events = events.filter((e) => e.playerId === options.playerId);
    }
    if (options?.scorerUserId) {
      events = events.filter((e) => e.byUserId === options.scorerUserId);
    }
    if (options?.roundId) {
      const roundMatchIds = new Set(
        db.matches.filter((m) => m.roundId === options.roundId).map((m) => m.id)
      );
      events = events.filter((e) => roundMatchIds.has(e.matchId));
    }

    events.sort((a, b) => {
      const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return options?.order === 'oldest' ? -diff : diff;
    });

    return events;
  },

  async listByGame(gameId: string): Promise<ScoreEvent[]> {
    return this.list({ matchId: gameId, order: 'newest' });
  },

  async listByMatch(matchId: string): Promise<ScoreEvent[]> {
    return this.list({ matchId, order: 'newest' });
  },

  async listByPlayer(playerId: string): Promise<ScoreEvent[]> {
    return this.list({ playerId, order: 'newest' });
  },

  async listBuzzByGame(gameId: string): Promise<BuzzEvent[]> {
    const buzzes = await storage.getBuzzEventsByMatch(gameId);
    return buzzes.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  },

  async listAbsencesByMatch(matchId: string): Promise<AbsenceEvent[]> {
    const absences = await storage.getAbsenceEventsByMatch(matchId);
    return absences.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  },

  async getGameTotals(gameId: string): Promise<Record<string, number>> {
    const match = await storage.getMatch(gameId);
    if (!match) return {};
    const events = await storage.getScoreEventsByMatch(gameId);
    return computeMatchScores(match, events).totals;
  },

  /** Single-pass batched match totals avoiding N+1 IndexedDB calls across 1,000+ matches */
  async getTotalsForMatches(
    matchIds?: string[]
  ): Promise<Record<string, Record<string, number>>> {
    const db = await storage.readSnapshot();
    const filterSet = matchIds ? new Set(matchIds) : null;
    const matchById = new Map<string, (typeof db.matches)[number]>();
    const out: Record<string, Record<string, number>> = {};

    for (const m of db.matches) {
      if (filterSet && !filterSet.has(m.id)) continue;
      matchById.set(m.id, m);
      const t: Record<string, number> = {};
      for (const p of m.participants) {
        if (p.playerId) t[p.playerId] = 0;
      }
      out[m.id] = t;
    }

    for (const ev of db.scoreEvents) {
      const m = matchById.get(ev.matchId);
      if (!m) continue;
      if ((ev.replayEpoch ?? 0) !== (m.replayEpoch ?? 0)) continue;
      const t = out[m.id];
      t[ev.playerId] = (t[ev.playerId] ?? 0) + ev.delta;
    }

    return out;
  },

  async getMatchScoreSummary(matchId: string) {
    const match = await storage.getMatch(matchId);
    if (!match) {
      return {
        totals: {} as Record<string, number>,
        yellowCardsByPlayer: {} as Record<string, number>,
        redCardsByPlayer: {} as Record<string, number>,
      };
    }
    const events = await storage.getScoreEventsByMatch(matchId);
    return computeMatchScores(match, events);
  },

  async getLeaderboard(options?: {
    roundId?: string;
    includeHost?: boolean;
  }): Promise<LeaderboardEntry[]> {
    const db = await storage.readSnapshot();
    const matchOutcomes = new Map(
      db.matches
        .filter((m) => !m.isDemo)
        .map((m) => [
          m.id,
          computeMatchResult(
            m,
            db.scoreEvents,
            db.absenceEvents,
            db.matchEvents,
            db.buzzEvents
          ),
        ])
    );
    const { groupStandings } = computeQualifiers(
      db.groups,
      db.matches,
      db.scoreEvents,
      db.absenceEvents,
      db.matchEvents,
      db.settings.tournament
    );
    // Per AGENTS.md §15.1, Marwan Serry (guest) is ALWAYS excluded from leaderboard rankings
    return computeLeaderboard(
      db.players,
      db.matches,
      matchOutcomes,
      groupStandings,
      db.scoreEvents,
      db.absenceEvents,
      { roundId: options?.roundId }
    );
  },

  // Write methods strictly delegate to the atomic Command Pipeline
  async applyScore(input: {
    gameId?: string;
    matchId?: string;
    segmentId: string;
    playerId: string;
    delta: number;
    note?: string;
    kind?: ScoreEventKind | 'preset' | 'custom';
    byUserId: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<ScoreEvent> {
    const matchId = input.matchId ?? input.gameId ?? '';
    if (input.kind === 'yellow' || input.kind === 'red') {
      return commands.applyCard({
        matchId,
        segmentId: input.segmentId,
        playerId: input.playerId,
        card: input.kind,
        note: input.note,
        byUserId: input.byUserId,
        confirmCascade: input.confirmCascade,
        cascadePolicy: input.cascadePolicy,
        expectedVersion: input.expectedVersion,
      });
    }
    return commands.applyPoint({
      matchId,
      segmentId: input.segmentId,
      playerId: input.playerId,
      delta: input.delta,
      note: input.note,
      byUserId: input.byUserId,
      confirmCascade: input.confirmCascade,
      cascadePolicy: input.cascadePolicy,
      expectedVersion: input.expectedVersion,
    });
  },

  async applyPoint(input: {
    matchId: string;
    segmentId: string;
    playerId: string;
    delta: number;
    note?: string;
    byUserId: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<ScoreEvent> {
    return commands.applyPoint(input);
  },

  async applyCard(input: {
    matchId: string;
    segmentId: string;
    playerId: string;
    card: 'yellow' | 'red';
    note?: string;
    byUserId: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<ScoreEvent> {
    return commands.applyCard(input);
  },

  async undoLastScore(
    gameId: string,
    byUserId: string,
    options?: {
      onlyOwn?: boolean;
      confirmCascade?: boolean;
      cascadePolicy?: CascadePolicy;
      expectedVersion?: number;
    }
  ): Promise<ScoreEvent | null> {
    return commands.undoLastScore({
      matchId: gameId,
      byUserId,
      onlyOwn: options?.onlyOwn,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async undoScoreEventById(
    gameId: string,
    targetEventId: string,
    byUserId: string,
    options?: {
      reason?: string;
      confirmCascade?: boolean;
      cascadePolicy?: CascadePolicy;
      expectedVersion?: number;
    }
  ): Promise<ScoreEvent | null> {
    return commands.revertEvent({
      matchId: gameId,
      targetEventId,
      byUserId,
      reason: options?.reason,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async editScoreEvent(
    eventId: string,
    patch: { delta: number; note?: string; segmentId?: string },
    byUserId: string,
    options?: {
      confirmCascade?: boolean;
      cascadePolicy?: CascadePolicy;
      expectedVersion?: number;
    }
  ): Promise<ScoreEvent | null> {
    return commands.editScoreEvent({
      eventId,
      delta: patch.delta,
      note: patch.note,
      segmentId: patch.segmentId,
      byUserId,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async recordBuzz(input: {
    gameId?: string;
    matchId?: string;
    segmentId: string;
    playerId: string;
    byUserId: string;
    expectedVersion?: number;
  }): Promise<BuzzEvent> {
    return commands.recordBuzz({
      matchId: input.matchId ?? input.gameId ?? '',
      segmentId: input.segmentId,
      playerId: input.playerId,
      byUserId: input.byUserId,
      expectedVersion: input.expectedVersion,
    });
  },

  async clearBuzz(
    gameId: string,
    byUserId: string,
    expectedVersion?: number
  ): Promise<void> {
    return commands.clearBuzz({
      matchId: gameId,
      byUserId,
      expectedVersion,
    });
  },
};
