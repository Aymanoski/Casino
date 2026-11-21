import type { Match, TournamentSettings, User } from '@/lib/schemas';

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
  startIso = '2027-03-05T19:00:00.000Z'
): Match[] {
  const tablesCount = Math.max(1, settings.tablesCount);
  const slotMinutes = Math.max(5, settings.slotMinutes);
  const slotMs = slotMinutes * 60_000;
  const baseMs = Date.parse(startIso) || Date.parse('2027-03-05T19:00:00.000Z');

  const judgePool = judges.filter((u) => u.role === 'scorer');
  const fallbackJudges =
    judgePool.length > 0 ? judgePool : judges.filter((u) => u.role === 'superAdmin');
  const effectiveJudges =
    fallbackJudges.length > 0
      ? fallbackJudges.map((j) => j.id)
      : ['user-scorer-1'];

  // Max concurrent matches per slot = min(tablesCount, effectiveJudges.length)
  // Wait: if tablesCount > judges, a judge cannot cover two tables simultaneously,
  // so track busyPlayers[slot], busyTables[slot], busyJudges[slot].
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

  // Schedule rounds in ascending round order so later rounds never precede earlier rounds
  const sorted = [...matches].sort(
    (a, b) => a.round - b.round || a.slot - b.slot || a.id.localeCompare(b.id)
  );

  let minSlotForRound = 0;
  let lastRound = sorted[0]?.round ?? 1;
  let maxSlotUsedInRound = 0;
  const scheduledMap = new Map<string, Match>();

  for (const m of sorted) {
    if (m.isDemo) {
      scheduledMap.set(m.id, m);
      continue;
    }

    if (m.round !== lastRound) {
      minSlotForRound = maxSlotUsedInRound + 1;
      lastRound = m.round;
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

    let chosenSlot = minSlotForRound;
    let chosenTable = 1;
    let chosenJudge = effectiveJudges[0];
    let placed = false;

    for (let slot = minSlotForRound; slot < minSlotForRound + 5000; slot++) {
      const busyPlayers = getSet(busyPlayersBySlot, slot);
      const hasPlayerConflict = playerIds.some((pid) => busyPlayers.has(pid));
      if (hasPlayerConflict) continue;

      const busyTables = getSet(busyTablesBySlot, slot);
      let freeTable: number | null = null;
      for (let t = 1; t <= tablesCount; t++) {
        if (!busyTables.has(t)) {
          freeTable = t;
          break;
        }
      }
      if (freeTable === null) continue;

      const busyJudges = getSet(busyJudgesBySlot, slot);
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
