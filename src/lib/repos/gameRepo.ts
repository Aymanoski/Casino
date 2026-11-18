import type { Game, GameTimerState } from '@/lib/schemas';
import { feedback } from '@/lib/feedback';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { recomputePlayerStatsInMemory } from './playerRepo';

export interface FinishGameResult {
  status: 'finished' | 'qualifying_tie';
  game: Game;
  tiedPlayerIds?: string[];
  winners?: string[];
}

export const gameRepo = {
  async list(options?: {
    roundId?: string;
    scorerUserId?: string;
    status?: Game['status'];
  }): Promise<Game[]> {
    const db = await storage.readSnapshot();
    let list = [...db.games];
    if (options?.roundId) {
      list = list.filter((g) => g.roundId === options.roundId);
    }
    if (options?.scorerUserId) {
      list = list.filter((g) => g.scorerUserId === options.scorerUserId);
    }
    if (options?.status) {
      list = list.filter((g) => g.status === options.status);
    }
    return list;
  },

  async get(id: string): Promise<Game | null> {
    const db = await storage.readSnapshot();
    return db.games.find((g) => g.id === id) ?? null;
  },

  async getByRound(roundId: string): Promise<Game[]> {
    return this.list({ roundId });
  },

  async getByScorer(scorerUserId: string): Promise<Game[]> {
    return this.list({ scorerUserId });
  },

  async getLiveGames(): Promise<Game[]> {
    return this.list({ status: 'live' });
  },

  async create(
    input: Omit<Game, 'id'>,
    actorUserId = 'user-admin'
  ): Promise<Game> {
    const db = await storage.readSnapshot();
    const newGame: Game = {
      ...input,
      id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    db.games.push(newGame);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'game.create',
      entityType: 'game',
      entityId: newGame.id,
      summary: `Created game "${newGame.tableName}"`,
      summaryAr: `تم إنشاء مباراة "${newGame.tableNameAr || newGame.tableName}"`,
      before: null,
      after: { tableName: newGame.tableName, playerIds: newGame.playerIds },
    });

    realtime.publish('bracket.updated', { gameId: newGame.id });
    return newGame;
  },

  async update(
    id: string,
    patch: Partial<Omit<Game, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const before = { ...db.games[idx] };
    const updated: Game = { ...db.games[idx], ...patch };
    db.games[idx] = updated;
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'game.update',
      entityType: 'game',
      entityId: id,
      summary: `Updated game "${updated.tableName}"`,
      summaryAr: `تم تحديث المباراة "${updated.tableNameAr || updated.tableName}"`,
      before: { status: before.status, scorerUserId: before.scorerUserId },
      after: { status: updated.status, scorerUserId: updated.scorerUserId },
    });

    realtime.publish('bracket.updated', { gameId: id });
    return updated;
  },

  async startGame(id: string, actorUserId: string): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const current = db.games[idx];
    const firstSegId = current.segmentIds[current.currentSegmentIndex] ?? current.segmentIds[0];
    const firstSeg = db.segments.find((s) => s.id === firstSegId);
    const dur = firstSeg?.durationSec ?? 60;

    const updated: Game = {
      ...current,
      status: 'live',
      startedAt: current.startedAt ?? new Date().toISOString(),
      timer: {
        status: 'idle',
        durationSec: dur,
        remainingSec: dur,
        endsAt: null,
      },
    };
    db.games[idx] = updated;
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'game.start',
      entityType: 'game',
      entityId: id,
      summary: `Started live game "${updated.tableName}"`,
      summaryAr: `بدء المباراة المباشرة "${updated.tableNameAr || updated.tableName}"`,
      before: { status: current.status },
      after: { status: 'live', startedAt: updated.startedAt },
    });

    realtime.publish('game.started', { gameId: id });
    return updated;
  },

  async changeSegment(
    id: string,
    nextIndex: number,
    actorUserId: string
  ): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const current = db.games[idx];
    const clampedIndex = Math.max(
      0,
      Math.min(nextIndex, current.segmentIds.length - 1)
    );
    const segId = current.segmentIds[clampedIndex];
    const seg = db.segments.find((s) => s.id === segId);
    const dur = seg?.durationSec ?? 60;

    const updated: Game = {
      ...current,
      currentSegmentIndex: clampedIndex,
      activeBuzzPlayerId: null,
      timer: {
        status: 'idle',
        durationSec: dur,
        remainingSec: dur,
        endsAt: null,
      },
    };
    db.games[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'segment.change',
      entityType: 'game',
      entityId: id,
      summary: `Moved "${updated.tableName}" to segment #${clampedIndex + 1} (${seg?.nameEn ?? segId})`,
      summaryAr: `انتقال "${updated.tableNameAr || updated.tableName}" إلى الفقرة #${clampedIndex + 1} (${seg?.nameAr ?? segId})`,
      before: { currentSegmentIndex: current.currentSegmentIndex },
      after: { currentSegmentIndex: clampedIndex, segmentId: segId },
    });

    feedback.play('segment.next');
    realtime.publish('segment.changed', {
      gameId: id,
      currentSegmentIndex: clampedIndex,
      segmentId: segId,
    });

    return updated;
  },

  async updateTimer(
    id: string,
    timer: GameTimerState,
    _actorUserId?: string
  ): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const updated: Game = {
      ...db.games[idx],
      timer,
    };
    db.games[idx] = updated;
    await storage.writeSnapshot(db);

    realtime.publish('timer.updated', {
      gameId: id,
      timer,
    });
    return updated;
  },

  async openTieBreaker(
    id: string,
    actorUserId: string
  ): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const current = db.games[idx];
    const tieBreakerSegId = 'seg-16';
    const nextSegIds = [...current.segmentIds, tieBreakerSegId];
    const newIndex = nextSegIds.length - 1;
    const seg = db.segments.find((s) => s.id === tieBreakerSegId);
    const dur = seg?.durationSec ?? 30;

    const updated: Game = {
      ...current,
      segmentIds: nextSegIds,
      currentSegmentIndex: newIndex,
      activeBuzzPlayerId: null,
      timer: {
        status: 'idle',
        durationSec: dur,
        remainingSec: dur,
        endsAt: null,
      },
    };
    db.games[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'game.tiebreaker',
      entityType: 'game',
      entityId: id,
      summary: `Opened Sudden-Death Tie-Breaker segment in "${updated.tableName}"`,
      summaryAr: `تم فتح جولة الحسم الفاصلة في "${updated.tableNameAr || updated.tableName}"`,
      before: { segmentCount: current.segmentIds.length },
      after: { segmentCount: nextSegIds.length, currentSegmentIndex: newIndex },
    });

    realtime.publish('segment.changed', {
      gameId: id,
      currentSegmentIndex: newIndex,
      segmentId: tieBreakerSegId,
      isTieBreaker: true,
    });

    return updated;
  },

  async finishGame(
    id: string,
    actorUserId: string
  ): Promise<FinishGameResult | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const game = db.games[idx];
    const round = db.rounds.find((r) => r.id === game.roundId);
    const advanceCount = round?.advancePerGame ?? 1;

    // Compute totals for the 3 players
    const totals = game.playerIds.map((pid) => {
      const score = db.scoreEvents
        .filter((e) => e.gameId === id && e.playerId === pid)
        .reduce((sum, e) => sum + e.delta, 0);
      return { playerId: pid, score };
    });

    totals.sort((a, b) => b.score - a.score);

    // Check if there is a Qualifying Tie across the advancement cutoff (advanceCount - 1 vs advanceCount)
    if (
      advanceCount < totals.length &&
      totals[advanceCount - 1].score === totals[advanceCount].score
    ) {
      const cutoffScore = totals[advanceCount - 1].score;
      const tiedPlayerIds = totals
        .filter((t) => t.score === cutoffScore)
        .map((t) => t.playerId);

      return {
        status: 'qualifying_tie',
        game,
        tiedPlayerIds,
      };
    }

    const advancingPlayerIds = totals
      .slice(0, advanceCount)
      .map((t) => t.playerId);
    const winnerPlayerId = totals[0].playerId;

    const updated: Game = {
      ...game,
      status: 'finished',
      winnerPlayerId,
      advancingPlayerIds,
      activeBuzzPlayerId: null,
      finishedAt: new Date().toISOString(),
      timer: game.timer
        ? { ...game.timer, status: 'idle', remainingSec: 0 }
        : undefined,
    };

    db.games[idx] = updated;

    // Update player statuses (non-advancing become 'eliminated', finalists become 'finalist')
    const advSet = new Set(advancingPlayerIds);
    db.players = db.players.map((p) => {
      if (!game.playerIds.includes(p.id) || p.isHost) return p;
      if (advSet.has(p.id)) {
        return {
          ...p,
          status: game.roundId === 'round-semi' ? 'finalist' : 'active',
        };
      }
      return { ...p, status: 'eliminated' };
    });

    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    const winner = db.players.find((p) => p.id === winnerPlayerId);
    await auditRepo.record({
      actorUserId,
      action: 'game.finish',
      entityType: 'game',
      entityId: id,
      summary: `Finished "${updated.tableName}" — Winner: ${winner?.fullName ?? winnerPlayerId}`,
      summaryAr: `انتهاء "${updated.tableNameAr || updated.tableName}" — الفائز: ${winner?.fullNameAr ?? winnerPlayerId}`,
      before: { status: game.status },
      after: { status: 'finished', winnerPlayerId, advancingPlayerIds },
    });

    feedback.play('game.winner');
    feedback.haptic('winner');

    realtime.publish('game.finished', {
      gameId: id,
      winnerPlayerId,
      advancingPlayerIds,
    });

    return {
      status: 'finished',
      game: updated,
      winners: advancingPlayerIds,
    };
  },
};
