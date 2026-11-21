import type {
  Match,
  MatchResultType,
  MatchStatus,
  MatchTimerState,
  MatchType,
  Round,
  UserRole,
} from '@/lib/schemas';
import {
  commands,
  type CascadePolicy,
  type FinishMatchResult,
} from '@/lib/commands';
import {
  detectConflictsForMatch,
  detectScheduleConflicts,
  findNextFreeSlotForMatch,
  type ScheduleConflict,
} from '@/lib/engine';
import { storage } from '@/lib/storage';
import { redactMatchForRole, resolveViewerRole } from './permissions';

export type FinishGameResult = FinishMatchResult;

export interface BracketRoundSpec {
  nameEn: string;
  nameAr: string;
  gamesCount: number;
  advancePerGame: number;
  isFinal?: boolean;
}

export interface GenerateBracketInput {
  totalPlayers: number;
  playersPerGame?: number;
  groupSize?: number;
  advancePerGroup?: number;
  pointsPerGroupWin?: number;
  tablesCount?: number;
  slotMinutes?: number;
  rounds?: BracketRoundSpec[];
  includeFinalWithMarwan: boolean;
  startDateIso?: string;
}

export interface GenerateBracketResult {
  rounds: Round[];
  games: Match[];
  matches: Match[];
}

export const matchRepo = {
  async list(options?: {
    roundId?: string;
    groupId?: string;
    judgeUserId?: string;
    scorerUserId?: string;
    status?: MatchStatus;
    type?: MatchType;
    includeDemo?: boolean;
    viewerRole?: UserRole | 'visitor' | null;
    actorUserId?: string | null;
  }): Promise<Match[]> {
    const db = await storage.readSnapshot();
    const effectiveRole = resolveViewerRole(db, options);
    let list = options?.includeDemo
      ? [...db.matches]
      : db.matches.filter((m) => !m.isDemo);

    if (options?.roundId) {
      list = list.filter((m) => m.roundId === options.roundId);
    }
    if (options?.groupId) {
      list = list.filter((m) => m.groupId === options.groupId);
    }
    const judgeFilter = options?.judgeUserId ?? options?.scorerUserId;
    if (judgeFilter) {
      list = list.filter((m) => m.judgeUserId === judgeFilter);
    }
    if (options?.status) {
      list = list.filter((m) => m.status === options.status);
    }
    if (options?.type) {
      list = list.filter((m) => m.type === options.type);
    }

    return list.map((m) => redactMatchForRole(m, effectiveRole));
  },

  async get(
    id: string,
    options?: {
      viewerRole?: UserRole | 'visitor' | null;
      actorUserId?: string | null;
    }
  ): Promise<Match | null> {
    const found = await storage.getMatch(id);
    if (!found) return null;
    let effectiveRole = options?.viewerRole ?? null;
    if (!effectiveRole && options?.actorUserId) {
      const db = await storage.readSnapshot();
      effectiveRole = resolveViewerRole(db, options);
    }
    return redactMatchForRole(found, effectiveRole);
  },

  async getByRound(
    roundId: string,
    options?: {
      viewerRole?: UserRole | 'visitor' | null;
      actorUserId?: string | null;
    }
  ): Promise<Match[]> {
    const matches = await storage.getMatchesByRound(roundId);
    let effectiveRole = options?.viewerRole ?? null;
    if (!effectiveRole && options?.actorUserId) {
      const db = await storage.readSnapshot();
      effectiveRole = resolveViewerRole(db, options);
    }
    return matches
      .filter((m) => !m.isDemo)
      .map((m) => redactMatchForRole(m, effectiveRole));
  },

  async getByGroup(
    groupId: string,
    options?: {
      viewerRole?: UserRole | 'visitor' | null;
      actorUserId?: string | null;
    }
  ): Promise<Match[]> {
    const matches = await storage.getMatchesByGroup(groupId);
    let effectiveRole = options?.viewerRole ?? null;
    if (!effectiveRole && options?.actorUserId) {
      const db = await storage.readSnapshot();
      effectiveRole = resolveViewerRole(db, options);
    }
    return matches
      .filter((m) => !m.isDemo)
      .map((m) => redactMatchForRole(m, effectiveRole));
  },

  async getByJudge(
    judgeUserId: string,
    options?: {
      viewerRole?: UserRole | 'visitor' | null;
      actorUserId?: string | null;
    }
  ): Promise<Match[]> {
    const matches = await storage.getMatchesByJudge(judgeUserId);
    let effectiveRole = options?.viewerRole ?? null;
    if (!effectiveRole && options?.actorUserId) {
      const db = await storage.readSnapshot();
      effectiveRole = resolveViewerRole(db, options);
    }
    return matches
      .filter((m) => !m.isDemo)
      .map((m) => redactMatchForRole(m, effectiveRole));
  },

  async getByScorer(scorerUserId: string): Promise<Match[]> {
    return this.getByJudge(scorerUserId);
  },

  async getLiveGames(): Promise<Match[]> {
    return this.list({ status: 'live' });
  },

  async getLiveMatches(): Promise<Match[]> {
    return this.list({ status: 'live' });
  },

  // All write operations strictly delegate to the atomic Command Pipeline
  async create(
    input: {
      roundId: string;
      type?: MatchType;
      groupId?: string;
      tableNumber?: number;
      tableName: string;
      tableNameAr?: string;
      scheduledAt: string;
      judgeUserId?: string;
      scorerUserId?: string;
      playerIds: string[];
      segmentIds: string[];
      isFinal?: boolean;
    },
    actorUserId = 'user-admin'
  ): Promise<Match> {
    return commands.createMatch({
      roundId: input.roundId,
      type: input.type,
      groupId: input.groupId,
      tableNumber: input.tableNumber,
      tableName: input.tableName,
      tableNameAr: input.tableNameAr,
      scheduledAt: input.scheduledAt,
      judgeUserId: input.judgeUserId ?? input.scorerUserId ?? 'user-scorer-1',
      playerIds: input.playerIds,
      segmentIds: input.segmentIds,
      isFinal: input.isFinal,
      actorUserId,
    });
  },

  async update(
    id: string,
    patch: {
      roundId?: string;
      tableNumber?: number;
      tableName?: string;
      tableNameAr?: string;
      scheduledAt?: string;
      judgeUserId?: string;
      scorerUserId?: string;
      segmentIds?: string[];
      playerIds?: string[];
      isFinal?: boolean;
    },
    actorUserId = 'user-admin',
    expectedVersion?: number
  ): Promise<Match | null> {
    return commands.updateMatchMetadata({
      matchId: id,
      patch,
      actorUserId,
      expectedVersion,
    });
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    return commands.removeMatch({ matchId: id, actorUserId });
  },

  async generateBracket(
    input: GenerateBracketInput,
    actorUserId = 'user-admin'
  ): Promise<GenerateBracketResult> {
    const res = await commands.generateTournament({
      tournament: {
        totalPlayers: input.totalPlayers,
        groupSize: input.groupSize ?? input.playersPerGame ?? 3,
        advancePerGroup: input.advancePerGroup ?? 1,
        pointsPerGroupWin: input.pointsPerGroupWin ?? 3,
        tablesCount: input.tablesCount ?? 12,
        slotMinutes: input.slotMinutes ?? 30,
        includeFinalWithMarwan: input.includeFinalWithMarwan,
      },
      actorUserId,
    });
    return {
      rounds: res.rounds,
      games: res.matches,
      matches: res.matches,
    };
  },

  async startMatch(
    id: string,
    actorUserId: string,
    expectedVersion?: number
  ): Promise<Match | null> {
    return commands.startMatch({ matchId: id, actorUserId, expectedVersion });
  },

  async startGame(
    id: string,
    actorUserId: string,
    expectedVersion?: number
  ): Promise<Match | null> {
    return this.startMatch(id, actorUserId, expectedVersion);
  },

  async changeSegment(
    id: string,
    nextIndex: number,
    actorUserId: string,
    expectedVersion?: number
  ): Promise<Match | null> {
    return commands.changeSegment({
      matchId: id,
      nextIndex,
      actorUserId,
      expectedVersion,
    });
  },

  async updateTimer(
    id: string,
    timer: MatchTimerState,
    actorUserId?: string
  ): Promise<Match | null> {
    return commands.updateTimer({ matchId: id, timer, actorUserId });
  },

  async openTieBreaker(
    id: string,
    actorUserId: string,
    expectedVersion?: number
  ): Promise<Match | null> {
    return commands.openTieBreaker({ matchId: id, actorUserId, expectedVersion });
  },

  async finishMatch(
    id: string,
    actorUserId: string,
    options?: { autoOpenTieBreaker?: boolean; expectedVersion?: number }
  ): Promise<FinishMatchResult | null> {
    return commands.finishMatch({
      matchId: id,
      actorUserId,
      autoOpenTieBreaker: options?.autoOpenTieBreaker,
      expectedVersion: options?.expectedVersion,
    });
  },

  async finishGame(
    id: string,
    actorUserId: string,
    options?: { autoOpenTieBreaker?: boolean; expectedVersion?: number }
  ): Promise<FinishGameResult | null> {
    return this.finishMatch(id, actorUserId, options);
  },

  async reopenMatch(
    id: string,
    actorUserId: string,
    options?: {
      reason?: string;
      confirmCascade?: boolean;
      cascadePolicy?: CascadePolicy;
      expectedVersion?: number;
    }
  ): Promise<Match | null> {
    return commands.reopenMatch({
      matchId: id,
      actorUserId,
      reason: options?.reason,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async reopenGame(
    id: string,
    actorUserId: string,
    options?: {
      reason?: string;
      confirmCascade?: boolean;
      cascadePolicy?: CascadePolicy;
      expectedVersion?: number;
    }
  ): Promise<Match | null> {
    return this.reopenMatch(id, actorUserId, options);
  },

  async overrideResult(
    id: string,
    resultType: MatchResultType,
    winnerId: string | undefined,
    reason: string,
    actorUserId: string,
    options?: { confirmCascade?: boolean; cascadePolicy?: CascadePolicy; expectedVersion?: number }
  ): Promise<Match> {
    return commands.overrideResult({
      matchId: id,
      resultType,
      winnerId,
      reason,
      actorUserId,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async markAbsent(
    matchId: string,
    playerId: string,
    actorUserId: string,
    options?: { reason?: string; confirmCascade?: boolean; cascadePolicy?: CascadePolicy; expectedVersion?: number }
  ) {
    return commands.markAbsent({
      matchId,
      playerId,
      byUserId: actorUserId,
      reason: options?.reason,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async reverseAbsence(
    matchId: string,
    playerId: string,
    actorUserId: string,
    options?: { reason?: string; confirmCascade?: boolean; cascadePolicy?: CascadePolicy; expectedVersion?: number }
  ) {
    return commands.reverseAbsence({
      matchId,
      playerId,
      byUserId: actorUserId,
      reason: options?.reason,
      confirmCascade: options?.confirmCascade,
      cascadePolicy: options?.cascadePolicy,
      expectedVersion: options?.expectedVersion,
    });
  },

  async resetDemoGame(id = 'game-demo'): Promise<Match | null> {
    return commands.resetDemoMatch(id);
  },

  async autoSchedule(
    actorUserId = 'user-admin',
    options?: { onlyScheduled?: boolean; startIso?: string }
  ): Promise<{ rescheduledCount: number; remainingConflicts: number }> {
    return commands.autoScheduleAll({
      actorUserId,
      onlyScheduled: options?.onlyScheduled,
      startIso: options?.startIso,
    });
  },

  async detectConflicts(): Promise<ScheduleConflict[]> {
    const db = await storage.readSnapshot();
    return detectScheduleConflicts(db.matches, db.settings.tournament);
  },

  async detectConflictsForDraft(candidate: Match): Promise<ScheduleConflict[]> {
    const db = await storage.readSnapshot();
    return detectConflictsForMatch(candidate, db.matches, db.settings.tournament);
  },

  async findNextFreeSlot(
    candidate: Match
  ): Promise<{ tableNumber: number; judgeUserId: string; scheduledAt: string }> {
    const db = await storage.readSnapshot();
    return findNextFreeSlotForMatch(
      candidate,
      db.matches,
      db.users,
      db.settings.tournament
    );
  },
};
