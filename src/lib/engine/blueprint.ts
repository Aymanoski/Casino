import type {
  AbsenceEvent,
  Match,
  MatchLifecycleEvent,
  ScoreEvent,
  TournamentSettings,
} from '@/lib/schemas';

export interface TournamentSettingError {
  field: keyof TournamentSettings;
  messageEn: string;
  messageAr: string;
}

export interface TournamentSettingsValidation {
  valid: boolean;
  errors: TournamentSettingError[];
}

export interface PlannedKnockoutRound {
  roundOrder: number;
  nameEn: string;
  nameAr: string;
  entrants: number;
  matchCount: number;
  byeCount: number;
  isFinal: boolean;
}

export interface TournamentBlueprint {
  totalPlayers: number;
  groupSize: number;
  advancePerGroup: number;
  pointsPerGroupWin: number;
  tablesCount: number;
  slotMinutes: number;
  includeFinalWithMarwan: boolean;
  groupsCount: number;
  groupSizes: number[];
  hasRemainderGroup: boolean;
  hasOddGroups: boolean;
  groupMatchesCount: number;
  qualifiersCount: number;
  bracketSize: number;
  byesCount: number;
  knockoutRounds: PlannedKnockoutRound[];
  knockoutMatchesCount: number;
  playableKnockoutMatchesCount: number;
  finalMatchesCount: number;
  totalMatchesCount: number;
  playableMatchesCount: number;
  concurrentCapacity: number;
  estimatedSlots: number;
  estimatedDurationMinutes: number;
  estimatedNights: number;
}

export interface TournamentProgressSummary {
  started: boolean;
  liveCount: number;
  finishedCount: number;
  needsTieBreakCount: number;
  needsReviewCount: number;
  voidCount: number;
  scheduledCount: number;
  completedGroupsCount: number;
  eventsCount: number;
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function knockoutRoundLabel(entrants: number): { en: string; ar: string } {
  if (entrants === 4) return { en: 'Semi-Finals', ar: 'نصف النهائي' };
  if (entrants === 8) return { en: 'Quarter-Finals', ar: 'ربع النهائي' };
  return { en: `Round of ${entrants}`, ar: `دور الـ ${entrants}` };
}

/**
 * Pure validation for Admin Tournament Settings (AGENTS.md §15.1).
 */
export function validateTournamentSettings(
  settings: TournamentSettings
): TournamentSettingsValidation {
  const errors: TournamentSettingError[] = [];

  if (
    !Number.isInteger(settings.totalPlayers) ||
    settings.totalPlayers < 4 ||
    settings.totalPlayers > 2000
  ) {
    errors.push({
      field: 'totalPlayers',
      messageEn: 'Total players must be a whole number between 4 and 2,000.',
      messageAr: 'يجب أن يكون إجمالي اللاعبين عدداً صحيحاً بين 4 و 2000.',
    });
  }

  if (
    !Number.isInteger(settings.groupSize) ||
    settings.groupSize < 2 ||
    settings.groupSize > 8
  ) {
    errors.push({
      field: 'groupSize',
      messageEn: 'Group size must be between 2 and 8 players per group.',
      messageAr: 'يجب أن يكون حجم المجموعة بين 2 و 8 لاعبين.',
    });
  }

  if (
    !Number.isInteger(settings.advancePerGroup) ||
    settings.advancePerGroup < 1 ||
    settings.advancePerGroup >= settings.groupSize
  ) {
    errors.push({
      field: 'advancePerGroup',
      messageEn: `Qualifiers per group must be at least 1 and less than group size (${settings.groupSize}).`,
      messageAr: `عدد المتأهلين من كل مجموعة يجب أن يكون 1 على الأقل وأقل من حجم المجموعة (${settings.groupSize}).`,
    });
  }

  if (
    !Number.isInteger(settings.pointsPerGroupWin) ||
    settings.pointsPerGroupWin < 1 ||
    settings.pointsPerGroupWin > 10
  ) {
    errors.push({
      field: 'pointsPerGroupWin',
      messageEn: 'Group win points must be between 1 and 10.',
      messageAr: 'نقاط الفوز في المجموعات يجب أن تكون بين 1 و 10.',
    });
  }

  if (
    !Number.isInteger(settings.tablesCount) ||
    settings.tablesCount < 1 ||
    settings.tablesCount > 64
  ) {
    errors.push({
      field: 'tablesCount',
      messageEn: 'Tables count must be between 1 and 64.',
      messageAr: 'عدد الطاولات يجب أن يكون بين 1 و 64.',
    });
  }

  if (
    !Number.isInteger(settings.slotMinutes) ||
    settings.slotMinutes < 5 ||
    settings.slotMinutes > 180
  ) {
    errors.push({
      field: 'slotMinutes',
      messageEn: 'Slot duration must be between 5 and 180 minutes.',
      messageAr: 'مدة الفترة الزمنية يجب أن تكون بين 5 و 180 دقيقة.',
    });
  }

  // Ensure at least 2 qualifiers reach the knockout / final stage
  if (errors.length === 0) {
    const bp = computeTournamentBlueprint(settings);
    if (bp.qualifiersCount < 2) {
      errors.push({
        field: 'totalPlayers',
        messageEn: 'Tournament must produce at least 2 qualifiers for the Final.',
        messageAr: 'يجب أن تنتج البطولة متأهلين اثنين على الأقل للنهائي.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Pure live math preview for Admin Tournament Settings & Bracket Builder.
 * Mirrors generateGroups() and generateKnockout() exactly.
 */
export function computeTournamentBlueprint(
  settings: TournamentSettings,
  judgesCount = 4
): TournamentBlueprint {
  const totalPlayers = Math.max(2, Math.floor(settings.totalPlayers || 4));
  const groupSize = Math.max(2, Math.floor(settings.groupSize || 3));
  const advancePerGroup = Math.max(
    1,
    Math.min(groupSize - 1, Math.floor(settings.advancePerGroup || 1))
  );
  const pointsPerGroupWin = Math.max(1, Math.floor(settings.pointsPerGroupWin || 3));
  const tablesCount = Math.max(1, Math.floor(settings.tablesCount || 1));
  const slotMinutes = Math.max(5, Math.floor(settings.slotMinutes || 30));
  const includeFinalWithMarwan = Boolean(settings.includeFinalWithMarwan);

  // Compute exact group size distribution (matches generateGroups: no 1-player orphan group)
  const groupSizes: number[] = [];
  if (totalPlayers <= groupSize) {
    groupSizes.push(totalPlayers);
  } else {
    let remaining = totalPlayers;
    while (remaining > 0) {
      groupSizes.push(Math.min(groupSize, remaining));
      remaining -= groupSize;
    }
    if (groupSizes.length >= 2 && groupSizes[groupSizes.length - 1] === 1) {
      groupSizes.pop();
      groupSizes[groupSizes.length - 1] += 1;
    }
  }

  const groupsCount = groupSizes.length;
  const hasRemainderGroup = groupSizes.some((sz) => sz !== groupSize);
  const hasOddGroups = groupsCount % 2 === 1;

  // n(n-1)/2 round-robin 1v1 matches per group
  const groupMatchesCount = groupSizes.reduce(
    (sum, n) => sum + (n * (n - 1)) / 2,
    0
  );

  const qualifiersCount = groupSizes.reduce(
    (sum, n) => sum + Math.min(advancePerGroup, n),
    0
  );

  const bracketSize = Math.max(2, nextPowerOfTwo(qualifiersCount));
  const byesCount = Math.max(0, bracketSize - qualifiersCount);

  const knockoutRounds: PlannedKnockoutRound[] = [];
  let order = 2;

  if (bracketSize === 2) {
    knockoutRounds.push({
      roundOrder: order++,
      nameEn: includeFinalWithMarwan
        ? 'The Grand Final — vs. Marwan Serry'
        : 'The Final',
      nameAr: includeFinalWithMarwan
        ? 'النهائي الكبير — في مواجهة مروان سري'
        : 'النهائي',
      entrants: includeFinalWithMarwan ? 3 : 2,
      matchCount: 1,
      byeCount: 0,
      isFinal: true,
    });
  } else {
    const stopAtEntrants = includeFinalWithMarwan ? 4 : 2;
    let entrants = bracketSize;
    let isFirstKo = true;

    while (entrants >= stopAtEntrants) {
      const matchCount = entrants / 2;
      const lbl =
        entrants === 2
          ? { en: 'The Final', ar: 'النهائي' }
          : knockoutRoundLabel(entrants);
      knockoutRounds.push({
        roundOrder: order++,
        nameEn: lbl.en,
        nameAr: lbl.ar,
        entrants,
        matchCount,
        byeCount: isFirstKo ? byesCount : 0,
        isFinal: entrants === 2,
      });
      isFirstKo = false;
      entrants /= 2;
    }

    if (includeFinalWithMarwan) {
      knockoutRounds.push({
        roundOrder: order++,
        nameEn: 'The Grand Final — vs. Marwan Serry',
        nameAr: 'النهائي الكبير — في مواجهة مروان سري',
        entrants: 3,
        matchCount: 1,
        byeCount: 0,
        isFinal: true,
      });
    }
  }

  const finalMatchesCount = knockoutRounds.filter((r) => r.isFinal).length;
  const knockoutMatchesCount = knockoutRounds
    .filter((r) => !r.isFinal)
    .reduce((sum, r) => sum + r.matchCount, 0);
  const playableKnockoutMatchesCount = Math.max(0, knockoutMatchesCount - byesCount);
  const totalMatchesCount =
    groupMatchesCount + knockoutMatchesCount + finalMatchesCount;
  const playableMatchesCount =
    groupMatchesCount + playableKnockoutMatchesCount + finalMatchesCount;

  const concurrentCapacity = Math.max(1, Math.min(tablesCount, Math.max(1, judgesCount)));
  // Group slots + sequential KO round slots (each KO round starts after previous completes)
  const groupSlots = Math.ceil(groupMatchesCount / concurrentCapacity);
  const koSlots = knockoutRounds.reduce(
    (sum, r) =>
      sum + Math.ceil(Math.max(0, r.matchCount - r.byeCount) / concurrentCapacity),
    0
  );
  const estimatedSlots = Math.max(1, groupSlots + koSlots);
  const estimatedDurationMinutes = estimatedSlots * slotMinutes;
  // Assume ~5 hours (300 mins) of nightly Ramadan studio play
  const estimatedNights = Math.max(1, Math.ceil(estimatedDurationMinutes / 300));

  return {
    totalPlayers,
    groupSize,
    advancePerGroup,
    pointsPerGroupWin,
    tablesCount,
    slotMinutes,
    includeFinalWithMarwan,
    groupsCount,
    groupSizes,
    hasRemainderGroup,
    hasOddGroups,
    groupMatchesCount,
    qualifiersCount,
    bracketSize,
    byesCount,
    knockoutRounds,
    knockoutMatchesCount,
    playableKnockoutMatchesCount,
    finalMatchesCount,
    totalMatchesCount,
    playableMatchesCount,
    concurrentCapacity,
    estimatedSlots,
    estimatedDurationMinutes,
    estimatedNights,
  };
}

/**
 * Checks whether the tournament has already started (any non-demo, non-BYE match
 * has left 'scheduled' or has recorded score/absence/lifecycle events).
 */
export function getTournamentProgress(
  matches: Match[],
  scoreEvents: ScoreEvent[],
  absenceEvents: AbsenceEvent[],
  matchEvents: MatchLifecycleEvent[]
): TournamentProgressSummary {
  const realMatches = matches.filter((m) => !m.isDemo);
  const nonByeMatches = realMatches.filter((m) => !m.participants.some((p) => p.isBye));
  const demoIds = new Set(matches.filter((m) => m.isDemo).map((m) => m.id));

  let liveCount = 0;
  let finishedCount = 0;
  let needsTieBreakCount = 0;
  let needsReviewCount = 0;
  let voidCount = 0;
  let scheduledCount = 0;

  for (const m of nonByeMatches) {
    if (m.status === 'live') liveCount++;
    else if (m.status === 'finished') finishedCount++;
    else if (m.status === 'needsTieBreak') needsTieBreakCount++;
    else if (m.status === 'needsReview') needsReviewCount++;
    else if (m.status === 'void') voidCount++;
    else scheduledCount++;
  }

  const realEventsCount =
    scoreEvents.filter((e) => !demoIds.has(e.matchId)).length +
    absenceEvents.filter((e) => !demoIds.has(e.matchId)).length +
    matchEvents.filter((e) => !demoIds.has(e.matchId)).length;

  // Count groups where every regular match is finished
  const groupMatchesMap = new Map<string, Match[]>();
  for (const m of realMatches) {
    if (m.type === 'group' && m.groupId && !m.isGroupTieBreak) {
      const list = groupMatchesMap.get(m.groupId) ?? [];
      list.push(m);
      groupMatchesMap.set(m.groupId, list);
    }
  }
  let completedGroupsCount = 0;
  for (const list of groupMatchesMap.values()) {
    if (list.length > 0 && list.every((m) => m.status === 'finished')) {
      completedGroupsCount++;
    }
  }

  const started =
    liveCount > 0 ||
    finishedCount > 0 ||
    needsTieBreakCount > 0 ||
    needsReviewCount > 0 ||
    voidCount > 0 ||
    realEventsCount > 0;

  return {
    started,
    liveCount,
    finishedCount,
    needsTieBreakCount,
    needsReviewCount,
    voidCount,
    scheduledCount,
    completedGroupsCount,
    eventsCount: realEventsCount,
  };
}
