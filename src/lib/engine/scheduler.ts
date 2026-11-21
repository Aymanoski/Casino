import type { Match, TournamentSettings, User } from '@/lib/schemas';
import type { ScheduleConflict } from './types';

export interface AutoScheduleOptions {
  /** When true, preserves locked/live/finished matches and schedules only 'scheduled' matches around them */
  onlyScheduled?: boolean;
  /** Optional explicit match IDs whose slot/table/judge should stay pinned */
  pinnedMatchIds?: Set<string>;
}

/**
 * Conflict-free auto-scheduler per AGENTS.md §15.1:
 * Assigns tableNumber (1..tablesCount), scheduledAt time slot (slotMinutes intervals),
 * and judgeUserId (scorer) so that NO player, NO table, and NO judge is ever double-booked
 * in the same time slot.
 */
export function autoScheduleMatches(
  matches: Match[],
  judges: User[],
  settings: TournamentSettings,
  startIso = '2027-03-05T19:00:00.000Z',
  options?: AutoScheduleOptions
): Match[] {
  const tablesCount = Math.max(1, settings.tablesCount);
  const slotMinutes = Math.max(5, settings.slotMinutes);
  const slotMs = slotMinutes * 60_000;
  const baseMs = Date.parse(startIso) || Date.parse('2027-03-05T19:00:00.000Z');
  const onlyScheduled = options?.onlyScheduled ?? false;
  const pinnedIds = options?.pinnedMatchIds;

  const judgePool = judges.filter((u) => u.role === 'scorer');
  const fallbackJudges =
    judgePool.length > 0 ? judgePool : judges.filter((u) => u.role === 'superAdmin');
  const effectiveJudges =
    fallbackJudges.length > 0
      ? fallbackJudges.map((j) => j.id)
      : ['user-scorer-1'];

  const busyPlayersBySlot = new Map<number, Set<string>>();
  const busyTablesBySlot = new Map<number, Set<number>>();
  const busyJudgesBySlot = new Map<number, Set<string>>();

  const getSet = <K, V>(map: Map<K, Set<V>>, key: K): Set<V> => {
    let s = map.get(key);
    if (!s) {
      s = new Set<V>();
      map.set(key, s);
    }
    return s;
  };

  const isLocked = (m: Match): boolean => {
    if (m.isDemo) return true;
    if (pinnedIds?.has(m.id)) return true;
    if (onlyScheduled && m.status !== 'scheduled') return true;
    return false;
  };

  // Pre-seed busy resource sets from locked (live/finished/pinned) matches so newly scheduled
  // matches never collide with already-active or completed studio slots.
  const lockedMaxSlotByRound = new Map<number, number>();
  for (const m of matches) {
    if (!isLocked(m) || m.isDemo) continue;
    if (m.participants.some((p) => p.isBye)) continue;
    const mMs = Date.parse(m.scheduledAt);
    if (Number.isNaN(mMs)) continue;
    const slotIdx = Math.max(0, Math.round((mMs - baseMs) / slotMs));
    getSet(busyTablesBySlot, slotIdx).add(m.tableNumber);
    getSet(busyJudgesBySlot, slotIdx).add(m.judgeUserId);
    const pSet = getSet(busyPlayersBySlot, slotIdx);
    for (const p of m.participants) {
      if (p.playerId) pSet.add(p.playerId);
    }
    const prevMax = lockedMaxSlotByRound.get(m.round) ?? -1;
    if (slotIdx > prevMax) lockedMaxSlotByRound.set(m.round, slotIdx);
  }

  // Schedule rounds in ascending round order so later rounds never precede earlier rounds
  const sorted = [...matches].sort(
    (a, b) => a.round - b.round || a.slot - b.slot || a.id.localeCompare(b.id)
  );

  let minSlotForRound = 0;
  let lastRound = sorted[0]?.round ?? 1;
  let maxSlotUsedInRound = lockedMaxSlotByRound.get(lastRound) ?? -1;
  const scheduledMap = new Map<string, Match>();

  // Track earliest potentially open slot cursor per round to keep 1,000+ match scheduling O(M)!
  let freeSlotCursor = 0;
  const maxConcurrent = Math.min(tablesCount, effectiveJudges.length);

  for (const m of sorted) {
    if (m.isDemo) {
      scheduledMap.set(m.id, m);
      continue;
    }

    if (m.round !== lastRound) {
      minSlotForRound = Math.max(0, maxSlotUsedInRound + 1);
      lastRound = m.round;
      freeSlotCursor = minSlotForRound;
      maxSlotUsedInRound = Math.max(
        minSlotForRound - 1,
        lockedMaxSlotByRound.get(lastRound) ?? -1
      );
    }

    if (isLocked(m)) {
      scheduledMap.set(m.id, m);
      continue;
    }

    // BYE matches don't consume a physical table or judge slot
    const isByeMatch = m.participants.some((p) => p.isBye);
    if (isByeMatch) {
      scheduledMap.set(m.id, {
        ...m,
        scheduledAt: new Date(baseMs + minSlotForRound * slotMs).toISOString(),
      });
      continue;
    }

    const playerIds = m.participants
      .map((p) => p.playerId)
      .filter((pid): pid is string => Boolean(pid));

    // Advance freeSlotCursor past completely full slots
    while (
      (busyTablesBySlot.get(freeSlotCursor)?.size ?? 0) >= maxConcurrent ||
      (busyJudgesBySlot.get(freeSlotCursor)?.size ?? 0) >= effectiveJudges.length
    ) {
      freeSlotCursor++;
    }

    let chosenSlot = freeSlotCursor;
    let chosenTable = 1;
    let chosenJudge = effectiveJudges[0];
    let placed = false;

    for (let slot = Math.max(minSlotForRound, freeSlotCursor); slot < freeSlotCursor + 10000; slot++) {
      const busyTables = getSet(busyTablesBySlot, slot);
      if (busyTables.size >= maxConcurrent) continue;

      const busyJudges = getSet(busyJudgesBySlot, slot);
      if (busyJudges.size >= effectiveJudges.length) continue;

      const busyPlayers = getSet(busyPlayersBySlot, slot);
      if (playerIds.length > 0 && playerIds.some((pid) => busyPlayers.has(pid))) {
        continue;
      }

      let freeTable: number | null = null;
      for (let t = 1; t <= tablesCount; t++) {
        if (!busyTables.has(t)) {
          freeTable = t;
          break;
        }
      }
      if (freeTable === null) continue;

      const freeJudge = effectiveJudges.find((j) => !busyJudges.has(j)) ?? null;
      if (!freeJudge) continue;

      chosenSlot = slot;
      chosenTable = freeTable;
      chosenJudge = freeJudge;
      placed = true;
      break;
    }

    if (placed) {
      const busyPlayers = getSet(busyPlayersBySlot, chosenSlot);
      for (const pid of playerIds) busyPlayers.add(pid);
      getSet(busyTablesBySlot, chosenSlot).add(chosenTable);
      getSet(busyJudgesBySlot, chosenSlot).add(chosenJudge);
      if (chosenSlot > maxSlotUsedInRound) maxSlotUsedInRound = chosenSlot;
    }

    scheduledMap.set(m.id, {
      ...m,
      tableNumber: chosenTable,
      judgeUserId: chosenJudge,
      scorerUserId: chosenJudge,
      scheduledAt: new Date(baseMs + chosenSlot * slotMs).toISOString(),
    });
  }

  return matches.map((m) => scheduledMap.get(m.id) ?? m);
}

/**
 * Pure schedule conflict detector for manual overrides & schedule health audits.
 * Flags any overlapping [scheduledAt, scheduledAt + slotMinutes) window where:
 *  - the same player is booked in two matches simultaneously,
 *  - the same table number is assigned to two matches simultaneously, or
 *  - the same judge is assigned to two matches simultaneously.
 */
export function detectScheduleConflicts(
  matches: Match[],
  settings: TournamentSettings
): ScheduleConflict[] {
  const slotMs = Math.max(5, settings.slotMinutes) * 60_000;
  const activeMatches = matches
    .filter(
      (m) =>
        !m.isDemo &&
        m.status !== 'void' &&
        !m.participants.some((p) => p.isBye)
    )
    .map((m) => ({
      match: m,
      startMs: Date.parse(m.scheduledAt),
      playerIds: m.participants
        .map((p) => p.playerId)
        .filter((pid): pid is string => Boolean(pid)),
    }))
    .filter((entry) => !Number.isNaN(entry.startMs))
    .sort((a, b) => a.startMs - b.startMs || a.match.id.localeCompare(b.match.id));

  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < activeMatches.length; i++) {
    const a = activeMatches[i];
    const aEnd = a.startMs + slotMs;

    for (let j = i + 1; j < activeMatches.length; j++) {
      const b = activeMatches[j];
      // Sorted by startMs ascending: once b starts >= aEnd, no later match can overlap a
      if (b.startMs >= aEnd) break;

      // Table double-booking
      if (a.match.tableNumber === b.match.tableNumber) {
        conflicts.push({
          kind: 'table',
          matchId: a.match.id,
          conflictingMatchId: b.match.id,
          conflictingTableName: b.match.tableName,
          conflictingTableNameAr: b.match.tableNameAr || b.match.tableName,
          resourceId: String(a.match.tableNumber),
          slotStartIso: a.match.scheduledAt,
          messageEn: `Table #${a.match.tableNumber} is double-booked with "${b.match.tableName}".`,
          messageAr: `الطاولة #${a.match.tableNumber} محجوزة أيضاً لمباراة "${b.match.tableNameAr || b.match.tableName}" في نفس الوقت.`,
        });
        conflicts.push({
          kind: 'table',
          matchId: b.match.id,
          conflictingMatchId: a.match.id,
          conflictingTableName: a.match.tableName,
          conflictingTableNameAr: a.match.tableNameAr || a.match.tableName,
          resourceId: String(b.match.tableNumber),
          slotStartIso: b.match.scheduledAt,
          messageEn: `Table #${b.match.tableNumber} is double-booked with "${a.match.tableName}".`,
          messageAr: `الطاولة #${b.match.tableNumber} محجوزة أيضاً لمباراة "${a.match.tableNameAr || a.match.tableName}" في نفس الوقت.`,
        });
      }

      // Judge double-booking
      if (a.match.judgeUserId && a.match.judgeUserId === b.match.judgeUserId) {
        conflicts.push({
          kind: 'judge',
          matchId: a.match.id,
          conflictingMatchId: b.match.id,
          conflictingTableName: b.match.tableName,
          conflictingTableNameAr: b.match.tableNameAr || b.match.tableName,
          resourceId: a.match.judgeUserId,
          slotStartIso: a.match.scheduledAt,
          messageEn: `Judge is double-booked with "${b.match.tableName}".`,
          messageAr: `الحكم مكلّف أيضاً بمباراة "${b.match.tableNameAr || b.match.tableName}" في نفس التوقيت.`,
        });
        conflicts.push({
          kind: 'judge',
          matchId: b.match.id,
          conflictingMatchId: a.match.id,
          conflictingTableName: a.match.tableName,
          conflictingTableNameAr: a.match.tableNameAr || a.match.tableName,
          resourceId: b.match.judgeUserId,
          slotStartIso: b.match.scheduledAt,
          messageEn: `Judge is double-booked with "${a.match.tableName}".`,
          messageAr: `الحكم مكلّف أيضاً بمباراة "${a.match.tableNameAr || a.match.tableName}" في نفس التوقيت.`,
        });
      }

      // Player double-booking
      if (a.playerIds.length > 0 && b.playerIds.length > 0) {
        for (const pid of a.playerIds) {
          if (b.playerIds.includes(pid)) {
            conflicts.push({
              kind: 'player',
              matchId: a.match.id,
              conflictingMatchId: b.match.id,
              conflictingTableName: b.match.tableName,
              conflictingTableNameAr: b.match.tableNameAr || b.match.tableName,
              resourceId: pid,
              slotStartIso: a.match.scheduledAt,
              messageEn: `Player "${pid}" is double-booked with "${b.match.tableName}".`,
              messageAr: `اللاعب "${pid}" لديه تعارض موعد مع "${b.match.tableNameAr || b.match.tableName}".`,
            });
            conflicts.push({
              kind: 'player',
              matchId: b.match.id,
              conflictingMatchId: a.match.id,
              conflictingTableName: a.match.tableName,
              conflictingTableNameAr: a.match.tableNameAr || a.match.tableName,
              resourceId: pid,
              slotStartIso: b.match.scheduledAt,
              messageEn: `Player "${pid}" is double-booked with "${a.match.tableName}".`,
              messageAr: `اللاعب "${pid}" لديه تعارض موعد مع "${a.match.tableNameAr || a.match.tableName}".`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Checks conflicts for a single candidate match edit against all other matches.
 */
export function detectConflictsForMatch(
  candidate: Match,
  allMatches: Match[],
  settings: TournamentSettings
): ScheduleConflict[] {
  const others = allMatches.filter((m) => m.id !== candidate.id);
  const all = [...others, candidate];
  return detectScheduleConflicts(all, settings).filter(
    (c) => c.matchId === candidate.id
  );
}

/**
 * Finds the earliest conflict-free (tableNumber, judgeUserId, scheduledAt) slot
 * for a single match starting at or after its current scheduledAt.
 */
export function findNextFreeSlotForMatch(
  candidate: Match,
  allMatches: Match[],
  judges: User[],
  settings: TournamentSettings
): { tableNumber: number; judgeUserId: string; scheduledAt: string } {
  const tablesCount = Math.max(1, settings.tablesCount);
  const slotMs = Math.max(5, settings.slotMinutes) * 60_000;
  const startMs =
    Date.parse(candidate.scheduledAt) || Date.parse('2027-03-05T19:00:00.000Z');
  const judgeIds = judges.filter((u) => u.role === 'scorer').map((u) => u.id);
  const effectiveJudges = judgeIds.length > 0 ? judgeIds : [candidate.judgeUserId || 'user-scorer-1'];

  // Try preferred judge first, then other judges
  const judgeOrder = [
    ...(effectiveJudges.includes(candidate.judgeUserId) ? [candidate.judgeUserId] : []),
    ...effectiveJudges.filter((j) => j !== candidate.judgeUserId),
  ];

  const others = allMatches.filter(
    (m) =>
      m.id !== candidate.id &&
      !m.isDemo &&
      m.status !== 'void' &&
      !m.participants.some((p) => p.isBye)
  );
  const candidatePlayers = new Set(
    candidate.participants
      .map((p) => p.playerId)
      .filter((pid): pid is string => Boolean(pid))
  );

  for (let step = 0; step < 2000; step++) {
    const slotStart = startMs + step * slotMs;
    const slotEnd = slotStart + slotMs;

    const overlapping = others.filter((m) => {
      const ms = Date.parse(m.scheduledAt);
      if (Number.isNaN(ms)) return false;
      return ms < slotEnd && ms + slotMs > slotStart;
    });

    const playerBusy = overlapping.some((m) =>
      m.participants.some((p) => p.playerId && candidatePlayers.has(p.playerId))
    );
    if (playerBusy) continue;

    const busyTables = new Set(overlapping.map((m) => m.tableNumber));
    const busyJudges = new Set(overlapping.map((m) => m.judgeUserId));

    let freeTable: number | null = null;
    if (!busyTables.has(candidate.tableNumber) && candidate.tableNumber <= tablesCount) {
      freeTable = candidate.tableNumber;
    } else {
      for (let t = 1; t <= tablesCount; t++) {
        if (!busyTables.has(t)) {
          freeTable = t;
          break;
        }
      }
    }
    if (freeTable === null) continue;

    const freeJudge = judgeOrder.find((j) => !busyJudges.has(j));
    if (!freeJudge) continue;

    return {
      tableNumber: freeTable,
      judgeUserId: freeJudge,
      scheduledAt: new Date(slotStart).toISOString(),
    };
  }

  return {
    tableNumber: candidate.tableNumber,
    judgeUserId: candidate.judgeUserId,
    scheduledAt: candidate.scheduledAt,
  };
}
