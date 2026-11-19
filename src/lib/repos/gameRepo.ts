import type { Game, GameTimerState, Round } from '@/lib/schemas';
import { feedback } from '@/lib/feedback';
import { realtime } from '@/lib/realtime';
import { createDemoSeedState } from '@/lib/seed';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
import { assertRepoPermission } from './permissions';
import { recomputePlayerStatsInMemory } from './playerRepo';

export interface FinishGameResult {
  status: 'finished' | 'qualifying_tie' | 'tie_breaker_opened';
  game: Game;
  tiedPlayerIds?: string[];
  winners?: string[];
}

export interface BracketRoundSpec {
  nameEn: string;
  nameAr: string;
  gamesCount: number;
  advancePerGame: number;
  isFinal?: boolean;
}

export interface GenerateBracketInput {
  totalPlayers: number;
  playersPerGame: number;
  rounds: BracketRoundSpec[];
  includeFinalWithMarwan: boolean;
  startDateIso?: string;
}

export interface GenerateBracketResult {
  rounds: Round[];
  games: Game[];
}

const DEFAULT_TABLE_NAMES: Array<{ en: string; ar: string }> = [
  { en: 'Lantern Court', ar: 'قاعة الفانوس' },
  { en: 'Crescent Lounge', ar: 'صالون الهلال' },
  { en: 'Velvet Stage', ar: 'المسرح المخملي' },
  { en: 'Gold Majlis', ar: 'المجلس الذهبي' },
  { en: 'Starlight Hall', ar: 'قاعة النجوم' },
  { en: 'Nile Royale', ar: 'نايل رويال' },
  { en: 'Emerald Club', ar: 'النادي الزمردي' },
  { en: 'Cairo Crown', ar: 'تاج القاهرة' },
  { en: 'Sovereign Deck', ar: 'جناح النخبة' },
];

export const gameRepo = {
  async list(options?: {
    roundId?: string;
    scorerUserId?: string;
    status?: Game['status'];
    includeDemo?: boolean;
  }): Promise<Game[]> {
    const db = await storage.readSnapshot();
    let list = options?.includeDemo
      ? [...db.games]
      : db.games.filter((g) => !g.isDemo);
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
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const newGame: Game = {
      ...input,
      id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };

    // If marked as Final, ensure Marwan Serry is seated & unmark previous final
    if (newGame.isFinal) {
      db.games = db.games.map((g) =>
        !g.isDemo && g.isFinal ? { ...g, isFinal: false } : g
      );
      if (!newGame.playerIds.includes('player-marwan')) {
        newGame.playerIds = [
          ...newGame.playerIds.slice(0, 2),
          'player-marwan',
        ];
      }
    }

    db.games.push(newGame);
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'game.create',
      entityType: 'game',
      entityId: newGame.id,
      summary: `Created game "${newGame.tableName}"${newGame.isFinal ? ' (Grand Final)' : ''}`,
      summaryAr: `تم إنشاء مباراة "${newGame.tableNameAr || newGame.tableName}"${newGame.isFinal ? ' (النهائي الكبير)' : ''}`,
      before: null,
      after: {
        tableName: newGame.tableName,
        roundId: newGame.roundId,
        scorerUserId: newGame.scorerUserId,
        playerIds: newGame.playerIds,
        isFinal: newGame.isFinal,
      },
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
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const before = { ...db.games[idx] };
    const updated: Game = { ...before, ...patch };

    // If promoted to Grand Final, seat Marwan Serry and clear previous isFinal flag
    if (patch.isFinal === true) {
      db.games = db.games.map((g) =>
        g.id !== id && !g.isDemo && g.isFinal ? { ...g, isFinal: false } : g
      );
      if (!updated.playerIds.includes('player-marwan')) {
        const finalists = updated.playerIds.filter((pid) => pid !== 'player-marwan').slice(0, 2);
        while (finalists.length < 2) {
          finalists.push(`tbd-final-${finalists.length + 1}`);
        }
        updated.playerIds = [...finalists, 'player-marwan'];
      }
    }

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
      before: {
        tableName: before.tableName,
        status: before.status,
        scorerUserId: before.scorerUserId,
        scheduledAt: before.scheduledAt,
        playerIds: before.playerIds,
        isFinal: before.isFinal,
      },
      after: {
        tableName: updated.tableName,
        status: updated.status,
        scorerUserId: updated.scorerUserId,
        scheduledAt: updated.scheduledAt,
        playerIds: updated.playerIds,
        isFinal: updated.isFinal,
      },
    });

    realtime.publish('bracket.updated', { gameId: id });
    return updated;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const target = db.games.find((g) => g.id === id && !g.isDemo);
    if (!target) return false;

    db.games = db.games.filter((g) => g.id !== id);
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'game.remove',
      entityType: 'game',
      entityId: id,
      summary: `Removed game "${target.tableName}"`,
      summaryAr: `تم حذف المباراة "${target.tableNameAr || target.tableName}"`,
      before: {
        tableName: target.tableName,
        roundId: target.roundId,
        playerIds: target.playerIds,
      },
      after: null,
    });

    realtime.publish('bracket.updated', { gameId: id });
    return true;
  },

  async generateBracket(
    input: GenerateBracketInput,
    actorUserId = 'user-admin'
  ): Promise<GenerateBracketResult> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'bracket.manage');

    const prevRoundsCount = db.rounds.length;
    const prevGamesCount = db.games.filter((g) => !g.isDemo).length;

    const scorers = db.users.filter((u) => u.role === 'scorer');
    const fallbackScorerId = scorers[0]?.id ?? 'user-admin';
    const availableSegments = [...db.segments]
      .filter((s) => s.id !== 'seg-16')
      .sort((a, b) => a.order - b.order);
    const defaultSegIds =
      availableSegments.length >= 6
        ? availableSegments.slice(0, 6).map((s) => s.id)
        : availableSegments.map((s) => s.id);
    const safeSegIds = defaultSegIds.length > 0 ? defaultSegIds : ['seg-1'];

    const seededPlayers = [...db.players]
      .filter((p) => !p.isHost)
      .sort((a, b) => a.seed - b.seed);

    const baseStartMs = input.startDateIso
      ? new Date(input.startDateIso).getTime()
      : new Date('2026-11-20T20:00:00.000Z').getTime();
    const safeBaseMs = Number.isNaN(baseStartMs)
      ? Date.now() + 86_400_000
      : baseStartMs;

    const newRounds: Round[] = [];
    const newGames: Game[] = [];
    let gameSeq = 1;
    let scorerCursor = 0;

    input.rounds.forEach((spec, roundIdx) => {
      const isFinalRound = Boolean(spec.isFinal);
      const roundId = isFinalRound
        ? 'round-final'
        : roundIdx === input.rounds.length - (input.includeFinalWithMarwan ? 2 : 1) &&
            input.rounds.length >= 2
          ? 'round-semi'
          : `round-${roundIdx + 1}`;

      newRounds.push({
        id: roundId,
        name: { en: spec.nameEn, ar: spec.nameAr },
        order: roundIdx + 1,
        advancePerGame: Math.max(1, spec.advancePerGame),
        status: 'upcoming',
      });

      const gamesCount = isFinalRound ? 1 : Math.max(1, spec.gamesCount);
      for (let gIdx = 0; gIdx < gamesCount; gIdx++) {
        const scorerUserId =
          scorers.length > 0
            ? scorers[scorerCursor++ % scorers.length].id
            : fallbackScorerId;

        const scheduledAt = new Date(
          safeBaseMs + roundIdx * 86_400_000 + gIdx * 45 * 60_000
        ).toISOString();

        let playerIds: string[];
        if (isFinalRound && input.includeFinalWithMarwan) {
          playerIds = ['tbd-final-1', 'tbd-final-2', 'player-marwan'];
        } else if (roundIdx === 0) {
          const seatCount = Math.max(2, input.playersPerGame);
          playerIds = Array.from({ length: seatCount }, (_, sIdx) => {
            const globalSeat = gIdx * seatCount + sIdx;
            if (globalSeat < input.totalPlayers && seededPlayers[globalSeat]) {
              return seededPlayers[globalSeat].id;
            }
            return `tbd-r1-g${gIdx + 1}-s${sIdx + 1}`;
          });
        } else {
          const seatCount = Math.max(2, input.playersPerGame);
          playerIds = Array.from(
            { length: seatCount },
            (_, sIdx) => `tbd-r${roundIdx + 1}-g${gIdx + 1}-s${sIdx + 1}`
          );
        }

        const tableTheme =
          DEFAULT_TABLE_NAMES[(gameSeq - 1) % DEFAULT_TABLE_NAMES.length];
        const tableName = isFinalRound
          ? 'The Grand Final — Against Marwan Serry'
          : gamesCount === 1
            ? `${spec.nameEn}`
            : `Table ${gameSeq} — ${tableTheme.en}`;
        const tableNameAr = isFinalRound
          ? 'النهائي الكبير — في مواجهة مروان سري'
          : gamesCount === 1
            ? `${spec.nameAr}`
            : `طاولة ${gameSeq} — ${tableTheme.ar}`;

        newGames.push({
          id: `game-gen-${gameSeq++}`,
          roundId,
          tableName,
          tableNameAr,
          scheduledAt,
          status: 'scheduled',
          scorerUserId,
          playerIds,
          currentSegmentIndex: 0,
          segmentIds: isFinalRound
            ? availableSegments.slice(0, Math.min(8, availableSegments.length)).map((s) => s.id)
            : safeSegIds,
          isFinal: isFinalRound,
          isDemo: false,
          podOrder: gIdx + 1,
          timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
        });
      }
    });

    const preservedDemoGames = db.games.filter((g) => g.isDemo);
    const demoGameIds = new Set(preservedDemoGames.map((g) => g.id));

    db.rounds = newRounds;
    db.games = [...newGames, ...preservedDemoGames];
    // Preserve demo score/buzz events while clearing stale non-demo events from previous bracket topology
    db.scoreEvents = db.scoreEvents.filter((e) => demoGameIds.has(e.gameId));
    db.buzzEvents = db.buzzEvents.filter((b) => demoGameIds.has(b.gameId));

    // Sync bracketConfig inside settings
    const r1 = input.rounds[0]?.gamesCount ?? 1;
    const r2 = input.rounds[1]?.gamesCount ?? 1;
    const semiRound = input.rounds.find(
      (r, idx) =>
        !r.isFinal &&
        idx === input.rounds.length - (input.includeFinalWithMarwan ? 2 : 1)
    );
    db.settings = {
      ...db.settings,
      bracketConfig: {
        totalPlayers: input.totalPlayers,
        playersPerGame: input.playersPerGame,
        round1Games: r1,
        round2Games: r2,
        semiGames: semiRound?.gamesCount ?? 1,
        semiAdvanceCount: semiRound?.advancePerGame ?? 2,
      },
      updatedAt: new Date().toISOString(),
    };

    // Reset player statuses to registered (except Marwan host)
    db.players = db.players.map((p) =>
      p.isHost ? p : { ...p, status: 'registered' }
    );
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'bracket.generate',
      entityType: 'bracket',
      entityId: 'tournament-bracket',
      summary: `Generated flexible bracket: ${input.totalPlayers} players (${input.playersPerGame}/table) across ${newRounds.length} rounds and ${newGames.length} games${input.includeFinalWithMarwan ? ' + Marwan Serry Final' : ''}`,
      summaryAr: `تم توليد شجرة البطولة: ${input.totalPlayers} لاعب (${input.playersPerGame} لكل طاولة) عبر ${newRounds.length} جولات و${newGames.length} مباراة`,
      before: { roundsCount: prevRoundsCount, gamesCount: prevGamesCount },
      after: {
        totalPlayers: input.totalPlayers,
        playersPerGame: input.playersPerGame,
        roundsCount: newRounds.length,
        gamesCount: newGames.length,
        includeFinalWithMarwan: input.includeFinalWithMarwan,
      },
    });

    realtime.publish('bracket.updated', {});
    realtime.publish('settings.updated', { keys: ['bracketConfig'] });
    realtime.publish('player.updated', {});

    return { rounds: newRounds, games: newGames };
  },

  async startGame(id: string, actorUserId: string): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const current = db.games[idx];
    assertRepoPermission(db, actorUserId, 'game.operate', { game: current });

    const firstSegId =
      current.segmentIds[current.currentSegmentIndex] ?? current.segmentIds[0];
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
    assertRepoPermission(db, actorUserId, 'game.operate', { game: current });

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

    if (!updated.isDemo) {
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
    }

    feedback.play('segment.next');
    realtime.publish('segment.changed', {
      gameId: id,
      currentSegmentIndex: clampedIndex,
      segmentId: segId,
    });

    return updated;
  },

  async resetDemoGame(id = 'game-demo'): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const demoSeed = createDemoSeedState();
    const filteredGames = db.games.filter((g) => g.id !== id);
    const filteredScores = db.scoreEvents.filter((e) => e.gameId !== id);
    const filteredBuzzes = db.buzzEvents.filter((b) => b.gameId !== id);

    const resetGame = { ...demoSeed.game, id };
    db.games = [...filteredGames, resetGame];
    db.scoreEvents = [
      ...demoSeed.scoreEvents.map((e) => ({ ...e, gameId: id })),
      ...filteredScores,
    ];
    db.buzzEvents = [
      ...demoSeed.buzzEvents.map((b) => ({ ...b, gameId: id })),
      ...filteredBuzzes,
    ];
    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    realtime.publish('score.changed', { gameId: id, reset: true });
    realtime.publish('buzz.recorded', {
      gameId: id,
      playerId: resetGame.activeBuzzPlayerId ?? '',
      segmentId: resetGame.segmentIds[resetGame.currentSegmentIndex],
    });
    realtime.publish('segment.changed', {
      gameId: id,
      currentSegmentIndex: resetGame.currentSegmentIndex,
      segmentId: resetGame.segmentIds[resetGame.currentSegmentIndex],
    });
    if (resetGame.timer) {
      realtime.publish('timer.updated', { gameId: id, timer: resetGame.timer });
    }

    return resetGame;
  },

  async updateTimer(
    id: string,
    timer: GameTimerState,
    actorUserId?: string
  ): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const current = db.games[idx];
    assertRepoPermission(db, actorUserId, 'game.operate', { game: current });

    const updated: Game = {
      ...current,
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
    assertRepoPermission(db, actorUserId, 'game.operate', { game: current });

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
    actorUserId: string,
    options?: { autoOpenTieBreaker?: boolean }
  ): Promise<FinishGameResult | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const game = db.games[idx];
    assertRepoPermission(db, actorUserId, 'game.operate', { game });

    const round = db.rounds.find((r) => r.id === game.roundId);
    const advanceCount = round?.advancePerGame ?? 1;

    const totals = game.playerIds.map((pid) => {
      const score = db.scoreEvents
        .filter((e) => e.gameId === id && e.playerId === pid)
        .reduce((sum, e) => sum + e.delta, 0);
      return { playerId: pid, score };
    });

    totals.sort((a, b) => b.score - a.score);

    if (
      advanceCount < totals.length &&
      totals[advanceCount - 1].score === totals[advanceCount].score
    ) {
      const cutoffScore = totals[advanceCount - 1].score;
      const tiedPlayerIds = totals
        .filter((t) => t.score === cutoffScore)
        .map((t) => t.playerId);

      if (options?.autoOpenTieBreaker) {
        const tieBreakerSegId = 'seg-16';
        const nextSegIds = [...game.segmentIds, tieBreakerSegId];
        const newIndex = nextSegIds.length - 1;
        const seg = db.segments.find((s) => s.id === tieBreakerSegId);
        const dur = seg?.durationSec ?? 30;

        const updatedWithTb: Game = {
          ...game,
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
        db.games[idx] = updatedWithTb;
        await storage.writeSnapshot(db);

        const tiedNamesEn = tiedPlayerIds
          .map((pid) => db.players.find((p) => p.id === pid)?.fullName ?? pid)
          .join(' & ');
        const tiedNamesAr = tiedPlayerIds
          .map((pid) => db.players.find((p) => p.id === pid)?.fullNameAr ?? pid)
          .join(' و ');

        if (!game.isDemo) {
          await auditRepo.record({
            actorUserId,
            action: 'game.tiebreaker',
            entityType: 'game',
            entityId: id,
            summary: `Qualifying tie (${cutoffScore} pts: ${tiedNamesEn}) — auto-inserted Tie-Breaker segment in "${updatedWithTb.tableName}"`,
            summaryAr: `تعادل على التأهل (${cutoffScore} نقطة: ${tiedNamesAr}) — تم إدراج جولة الحسم تلقائياً في "${updatedWithTb.tableNameAr || updatedWithTb.tableName}"`,
            before: { segmentCount: game.segmentIds.length, cutoffScore, tiedPlayerIds },
            after: {
              segmentCount: nextSegIds.length,
              currentSegmentIndex: newIndex,
              segmentId: tieBreakerSegId,
            },
          });
        }

        feedback.play('segment.next');
        feedback.haptic('warning');

        realtime.publish('segment.changed', {
          gameId: id,
          currentSegmentIndex: newIndex,
          segmentId: tieBreakerSegId,
          isTieBreaker: true,
          tiedPlayerIds,
        });

        return {
          status: 'tie_breaker_opened',
          game: updatedWithTb,
          tiedPlayerIds,
        };
      }

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
        ? { ...game.timer, status: 'idle', remainingSec: 0, endsAt: null }
        : undefined,
    };

    db.games[idx] = updated;

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

  async reopenGame(id: string, actorUserId: string): Promise<Game | null> {
    const db = await storage.readSnapshot();
    const idx = db.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const current = db.games[idx];
    assertRepoPermission(db, actorUserId, 'game.reopen', { game: current });

    const segId =
      current.segmentIds[current.currentSegmentIndex] ?? current.segmentIds[0];
    const seg = db.segments.find((s) => s.id === segId);
    const dur = seg?.durationSec ?? 45;

    const updated: Game = {
      ...current,
      status: 'live',
      winnerPlayerId: undefined,
      advancingPlayerIds: undefined,
      finishedAt: undefined,
      activeBuzzPlayerId: null,
      timer: {
        status: 'idle',
        durationSec: dur,
        remainingSec: dur,
        endsAt: null,
      },
    };
    db.games[idx] = updated;

    db.players = db.players.map((p) => {
      if (!current.playerIds.includes(p.id) || p.isHost) return p;
      return { ...p, status: 'active' };
    });

    recomputePlayerStatsInMemory(db);
    await storage.writeSnapshot(db);

    if (!current.isDemo) {
      await auditRepo.record({
        actorUserId,
        action: 'game.reopen',
        entityType: 'game',
        entityId: id,
        summary: `Reopened finished session "${updated.tableName}" for scoring adjustments`,
        summaryAr: `تمت إعادة فتح الجلسة المنتهية "${updated.tableNameAr || updated.tableName}" للتعديل`,
        before: {
          status: current.status,
          winnerPlayerId: current.winnerPlayerId ?? null,
          finishedAt: current.finishedAt ?? null,
        },
        after: { status: 'live' },
      });
    }

    realtime.publish('game.started', { gameId: id, reopened: true });
    realtime.publish('bracket.updated', { gameId: id });
    return updated;
  },
};
