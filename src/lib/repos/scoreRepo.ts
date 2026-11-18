import type {
  BuzzEvent,
  Player,
  ScoreEvent,
  ScoreEventKind,
} from '@/lib/schemas';
import { feedback } from '@/lib/feedback';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { recomputePlayerStatsInMemory } from './playerRepo';

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  totalPoints: number;
  gamesPlayed: number;
  wins: number;
}

export const scoreRepo = {
  async list(options?: {
    gameId?: string;
    playerId?: string;
    roundId?: string;
    scorerUserId?: string;
    order?: 'newest' | 'oldest';
  }): Promise<ScoreEvent[]> {
    const db = await storage.readSnapshot();
    let events = [...db.scoreEvents];

    if (options?.gameId) {
      events = events.filter((e) => e.gameId === options.gameId);
    }
    if (options?.playerId) {
      events = events.filter((e) => e.playerId === options.playerId);
    }
    if (options?.scorerUserId) {
      events = events.filter((e) => e.byUserId === options.scorerUserId);
    }
    if (options?.roundId) {
      const roundGameIds = new Set(
        db.games.filter((g) => g.roundId === options.roundId).map((g) => g.id)
      );
      events = events.filter((e) => roundGameIds.has(e.gameId));
    }

    events.sort((a, b) => {
      const diff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return options?.order === 'oldest' ? -diff : diff;
    });

    return events;
  },

  async listByGame(gameId: string): Promise<ScoreEvent[]> {
    return this.list({ gameId, order: 'newest' });
  },

  async listByPlayer(playerId: string): Promise<ScoreEvent[]> {
    return this.list({ playerId, order: 'newest' });
  },

  async listBuzzByGame(gameId: string): Promise<BuzzEvent[]> {
    const db = await storage.readSnapshot();
    return db.buzzEvents
      .filter((b) => b.gameId === gameId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  async getGameTotals(gameId: string): Promise<Record<string, number>> {
    const db = await storage.readSnapshot();
    const game = db.games.find((g) => g.id === gameId);
    const totals: Record<string, number> = {};
    if (game) {
      for (const pid of game.playerIds) {
        totals[pid] = 0;
      }
    }
    for (const ev of db.scoreEvents) {
      if (ev.gameId === gameId) {
        totals[ev.playerId] = (totals[ev.playerId] ?? 0) + ev.delta;
      }
    }
    return totals;
  },

  async getLeaderboard(options?: {
    roundId?: string;
    includeHost?: boolean;
  }): Promise<LeaderboardEntry[]> {
    const db = await storage.readSnapshot();
    const players = options?.includeHost
      ? db.players
      : db.players.filter((p) => !p.isHost);

    const allowedGameIds = options?.roundId
      ? new Set(
          db.games
            .filter((g) => g.roundId === options.roundId)
            .map((g) => g.id)
        )
      : null;

    const entries = players.map((player) => {
      const events = db.scoreEvents.filter(
        (e) =>
          e.playerId === player.id &&
          (!allowedGameIds || allowedGameIds.has(e.gameId))
      );
      const totalPoints = events.reduce((sum, e) => sum + e.delta, 0);
      const gamesPlayed = db.games.filter(
        (g) =>
          (!allowedGameIds || allowedGameIds.has(g.id)) &&
          (g.status === 'finished' || g.status === 'live') &&
          g.playerIds.includes(player.id)
      ).length;
      const wins = db.games.filter(
        (g) =>
          (!allowedGameIds || allowedGameIds.has(g.id)) &&
          g.status === 'finished' &&
          g.winnerPlayerId === player.id
      ).length;

      return {
        rank: 0,
        player,
        totalPoints,
        gamesPlayed,
        wins,
      };
    });

    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.player.seed - b.player.seed;
    });

    return entries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  },

  async applyScore(input: {
    gameId: string;
    segmentId: string;
    playerId: string;
    delta: number;
    note?: string;
    kind: Extract<ScoreEventKind, 'preset' | 'custom'>;
    byUserId: string;
  }): Promise<ScoreEvent> {
    const db = await storage.readSnapshot();
    const event: ScoreEvent = {
      id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      gameId: input.gameId,
      segmentId: input.segmentId,
      playerId: input.playerId,
      delta: input.delta,
      note: input.note?.trim() || undefined,
      kind: input.kind,
      byUserId: input.byUserId,
      createdAt: new Date().toISOString(),
    };

    db.scoreEvents.unshift(event);
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    const player = db.players.find((p) => p.id === input.playerId);
    const signStr = input.delta > 0 ? `+${input.delta}` : `${input.delta}`;

    await auditRepo.record({
      actorUserId: input.byUserId,
      action: 'score.add',
      entityType: 'score',
      entityId: event.id,
      summary: `Applied ${signStr} pts to ${player?.fullName ?? input.playerId}${input.note ? ` (${input.note})` : ''}`,
      summaryAr: `تم احتساب ${signStr} نقطة للاعب ${player?.fullNameAr ?? input.playerId}${input.note ? ` (${input.note})` : ''}`,
      before: null,
      after: {
        gameId: input.gameId,
        playerId: input.playerId,
        delta: input.delta,
        kind: input.kind,
      },
    });

    if (input.delta >= 0) {
      feedback.play('score.positive');
      feedback.haptic('medium');
    } else {
      feedback.play('score.negative');
      feedback.haptic('warning');
    }

    realtime.publish('score.changed', {
      gameId: input.gameId,
      playerId: input.playerId,
      delta: input.delta,
      scoreEventId: event.id,
    });

    return event;
  },

  async undoLastScore(
    gameId: string,
    byUserId: string
  ): Promise<ScoreEvent | null> {
    const db = await storage.readSnapshot();
    // Find newest non-undo event in this game that hasn't been undone yet
    const targetIdx = db.scoreEvents.findIndex(
      (e) =>
        e.gameId === gameId &&
        e.kind !== 'undo' &&
        !e.undoneByEventId
    );
    if (targetIdx === -1) return null;

    const target = db.scoreEvents[targetIdx];
    const undoEvent: ScoreEvent = {
      id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      gameId,
      segmentId: target.segmentId,
      playerId: target.playerId,
      delta: -target.delta,
      note: `Undo (${target.delta > 0 ? `+${target.delta}` : target.delta})`,
      kind: 'undo',
      byUserId,
      targetEventId: target.id,
      createdAt: new Date().toISOString(),
    };

    db.scoreEvents[targetIdx] = {
      ...target,
      undoneByEventId: undoEvent.id,
    };
    db.scoreEvents.unshift(undoEvent);
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    const player = db.players.find((p) => p.id === target.playerId);

    await auditRepo.record({
      actorUserId: byUserId,
      action: 'score.undo',
      entityType: 'score',
      entityId: undoEvent.id,
      summary: `Undid ${target.delta > 0 ? `+${target.delta}` : target.delta} pts for ${player?.fullName ?? target.playerId}`,
      summaryAr: `تم التراجع عن ${target.delta > 0 ? `+${target.delta}` : target.delta} نقطة للاعب ${player?.fullNameAr ?? target.playerId}`,
      before: { targetEventId: target.id, delta: target.delta },
      after: { undoEventId: undoEvent.id, delta: undoEvent.delta },
    });

    feedback.play('score.undo');
    feedback.haptic('light');

    realtime.publish('score.changed', {
      gameId,
      playerId: target.playerId,
      delta: undoEvent.delta,
      scoreEventId: undoEvent.id,
      isUndo: true,
    });

    return undoEvent;
  },

  async recordBuzz(input: {
    gameId: string;
    segmentId: string;
    playerId: string;
    byUserId: string;
  }): Promise<BuzzEvent> {
    const db = await storage.readSnapshot();
    const buzz: BuzzEvent = {
      id: `buzz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      gameId: input.gameId,
      segmentId: input.segmentId,
      playerId: input.playerId,
      byUserId: input.byUserId,
      cleared: false,
      createdAt: new Date().toISOString(),
    };

    db.buzzEvents.unshift(buzz);
    const gameIdx = db.games.findIndex((g) => g.id === input.gameId);
    if (gameIdx !== -1) {
      db.games[gameIdx] = {
        ...db.games[gameIdx],
        activeBuzzPlayerId: input.playerId,
      };
    }

    await storage.writeSnapshot(db);

    const player = db.players.find((p) => p.id === input.playerId);
    await auditRepo.record({
      actorUserId: input.byUserId,
      action: 'buzz.record',
      entityType: 'buzz',
      entityId: buzz.id,
      summary: `${player?.fullName ?? input.playerId} buzzed first`,
      summaryAr: `${player?.fullNameAr ?? input.playerId} ضغط الجرس أولاً`,
      before: null,
      after: { gameId: input.gameId, playerId: input.playerId, segmentId: input.segmentId },
    });

    feedback.play('buzz');
    feedback.haptic('buzz');

    realtime.publish('buzz.recorded', {
      gameId: input.gameId,
      playerId: input.playerId,
      segmentId: input.segmentId,
      buzzId: buzz.id,
    });

    return buzz;
  },

  async clearBuzz(gameId: string, byUserId: string): Promise<void> {
    const db = await storage.readSnapshot();
    const gameIdx = db.games.findIndex((g) => g.id === gameId);
    if (gameIdx === -1) return;

    const prevPlayerId = db.games[gameIdx].activeBuzzPlayerId;
    db.games[gameIdx] = {
      ...db.games[gameIdx],
      activeBuzzPlayerId: null,
    };
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId: byUserId,
      action: 'buzz.clear',
      entityType: 'buzz',
      entityId: gameId,
      summary: `Cleared active buzzer highlight on ${gameId.toUpperCase()}`,
      summaryAr: `تم مسح إشارة الجرس في المباراة ${gameId.toUpperCase()}`,
      before: { activeBuzzPlayerId: prevPlayerId },
      after: { activeBuzzPlayerId: null },
    });

    realtime.publish('buzz.cleared', { gameId });
  },
};
