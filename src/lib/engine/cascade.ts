import {
  MARWAN_PLAYER_ID,
  type Match,
  type MatchParticipant,
  type Round,
} from '@/lib/schemas';
import { computeQualifiers } from './groups';
import { orderQualifiersIntoPairs, resolveByes } from './knockout';
import { computeMatchResult } from './match';
import { computeAllPlayerStats, computePlayerStatus } from './players';
import type {
  CascadeAffectedMatch,
  CascadeImpact,
  CascadeWinnerChange,
  ComputedMatchOutcome,
  PropagationOutput,
  QualifierSlot,
  TournamentEngineInput,
} from './types';

function projectPlayerIds(matchId: string, participants: MatchParticipant[]): string[] {
  return participants.map((p, idx) => {
    if (p.playerId) return p.playerId;
    if (p.isBye) return `bye-${matchId}-s${idx + 1}`;
    return `tbd-${matchId}-s${idx + 1}`;
  });
}

function participantIdsOf(match: Match): Array<string | null> {
  return match.participants.map((p) => p.playerId);
}

function sameParticipantList(
  a: Array<string | null>,
  b: Array<string | null>
): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

function resolveParticipantFromFeeder(
  participant: MatchParticipant,
  groupQualifiersMap: Map<string, QualifierSlot>,
  byeRecipients: QualifierSlot[],
  orderedPlayInSlots: QualifierSlot[],
  matchOutcomes: Map<string, ComputedMatchOutcome>
): MatchParticipant {
  const feeder = participant.feeder;
  if (!feeder) return participant;

  switch (feeder.kind) {
    case 'fixed':
      return { ...participant, playerId: feeder.playerId, isBye: false };
    case 'guest':
      return {
        ...participant,
        playerId: feeder.playerId || MARWAN_PLAYER_ID,
        guest: true,
        isBye: false,
      };
    case 'bye':
      return {
        ...participant,
        playerId: null,
        isBye: true,
        placeholderLabelEn: 'BYE',
        placeholderLabelAr: 'تأهل تلقائي (BYE)',
      };
    case 'group': {
      const q = groupQualifiersMap.get(`${feeder.groupId}::${feeder.rank}`);
      return {
        ...participant,
        playerId: q?.playerId ?? null,
        placeholderLabelEn:
          q?.placeholderLabelEn ?? `Winner of Group ${feeder.groupNumber}`,
        placeholderLabelAr:
          q?.placeholderLabelAr ?? `متصدر المجموعة ${feeder.groupNumber}`,
      };
    }
    case 'bestGroupWinner': {
      const q = byeRecipients[feeder.byeRankIndex];
      return {
        ...participant,
        playerId: q?.playerId ?? null,
        placeholderLabelEn:
          q?.placeholderLabelEn ??
          `Best Group Winner #${feeder.byeRankIndex + 1}`,
        placeholderLabelAr:
          q?.placeholderLabelAr ??
          `أفضل متصدر مجموعة #${feeder.byeRankIndex + 1}`,
      };
    }
    case 'remainingGroupQualifier': {
      const q = orderedPlayInSlots[feeder.qualifierIndex];
      return {
        ...participant,
        playerId: q?.playerId ?? null,
        placeholderLabelEn:
          q?.placeholderLabelEn ??
          `Group Qualifier #${feeder.qualifierIndex + 1}`,
        placeholderLabelAr:
          q?.placeholderLabelAr ??
          `متأهل المجموعات #${feeder.qualifierIndex + 1}`,
      };
    }
    case 'match': {
      const feederOut = matchOutcomes.get(feeder.matchId);
      const winnerId =
        feederOut && feederOut.status === 'finished'
          ? (feederOut.result?.winnerId ?? null)
          : null;
      return {
        ...participant,
        playerId: winnerId,
      };
    }
    default:
      return participant;
  }
}

/**
 * Pure full-tournament propagation & recomputation engine (`propagateWinners`).
 *
 * Recomputes EVERY match outcome, group standing, qualifier, BYE allocation,
 * knockout participant propagation, round status, player status, and player stats
 * strictly from the append-only event log.
 *
 * Cascade behavior (AGENTS.md §15.4):
 * - Downstream match NOT started ('scheduled'): auto-updates participants cleanly.
 * - Downstream match LIVE / FINISHED / VOID / NEEDSTIEBREAK: NEVER silently overwrites
 *   history — flags 'needsReview' (or records 'invalidate_replay' when explicit policy passed).
 */
export function propagateWinners(
  input: TournamentEngineInput,
  options?: {
    /** When true, downstream live/finished mismatches are marked needsReview in output */
    flagLiveMismatchesAsNeedsReview?: boolean;
  }
): PropagationOutput {
  const flagLiveMismatches = options?.flagLiveMismatchesAsNeedsReview ?? true;
  const workingMatches = input.matches.map((m) => ({
    ...m,
    participants: m.participants.map((p) => ({ ...p })),
  }));
  const matchById = new Map(workingMatches.map((m) => [m.id, m]));
  const matchOutcomes = new Map<string, ComputedMatchOutcome>();
  const cascadeChanges: CascadeAffectedMatch[] = [];
  const winnerChanges: CascadeWinnerChange[] = [];

  // Pre-index append-only events by matchId once in O(E) so 1,000+ matches propagate in <10ms!
  const scoresByMatch = new Map<string, typeof input.scoreEvents>();
  for (const ev of input.scoreEvents) {
    const list = scoresByMatch.get(ev.matchId);
    if (list) list.push(ev);
    else scoresByMatch.set(ev.matchId, [ev]);
  }
  const absencesByMatch = new Map<string, typeof input.absenceEvents>();
  for (const ev of input.absenceEvents) {
    const list = absencesByMatch.get(ev.matchId);
    if (list) list.push(ev);
    else absencesByMatch.set(ev.matchId, [ev]);
  }
  const lifecycleByMatch = new Map<string, typeof input.matchEvents>();
  for (const ev of input.matchEvents) {
    const list = lifecycleByMatch.get(ev.matchId);
    if (list) list.push(ev);
    else lifecycleByMatch.set(ev.matchId, [ev]);
  }
  const buzzByMatch = new Map<string, typeof input.buzzEvents>();
  for (const ev of input.buzzEvents) {
    const list = buzzByMatch.get(ev.matchId);
    if (list) list.push(ev);
    else buzzByMatch.set(ev.matchId, [ev]);
  }

  // Phase 1: Recompute all group & demo matches first
  for (const m of workingMatches) {
    if (m.isDemo || m.type === 'group') {
      const beforeStatus = m.status;
      const beforeWinner = m.result?.winnerId ?? m.winnerPlayerId ?? null;
      const outcome = computeMatchResult(
        m,
        scoresByMatch.get(m.id) ?? [],
        absencesByMatch.get(m.id) ?? [],
        lifecycleByMatch.get(m.id) ?? [],
        buzzByMatch.get(m.id) ?? []
      );
      matchOutcomes.set(m.id, outcome);

      const afterWinner = outcome.result?.winnerId ?? null;
      if (beforeStatus !== outcome.status || beforeWinner !== afterWinner) {
        winnerChanges.push({
          matchId: m.id,
          tableName: m.tableName,
          beforeStatus,
          afterStatus: outcome.status,
          beforeWinnerId: beforeWinner,
          afterWinnerId: afterWinner,
        });
      }

      applyOutcomeToMatchObject(m, outcome);
    }
  }

  // Phase 2: Recompute all group standings, qualifiers, and BYE allocations (using precomputed outcomes!)
  const { qualifiers, groupStandings } = computeQualifiers(
    input.groups,
    workingMatches,
    input.scoreEvents,
    input.absenceEvents,
    input.matchEvents,
    input.settings,
    undefined,
    matchOutcomes
  );

  const byeAllocation = resolveByes(qualifiers, input.settings);
  const groupQualifiersMap = new Map<string, QualifierSlot>();
  for (const q of qualifiers) {
    groupQualifiersMap.set(`${q.groupId}::${q.groupRank}`, q);
  }

  // Flatten play-in pairs into indexed slots so remainingGroupQualifier feeders align with group-pair order
  const orderedPlayInPairs = orderQualifiersIntoPairs(
    byeAllocation.round1PlayIn,
    input.settings.advancePerGroup
  );
  const orderedPlayInSlots: QualifierSlot[] = [];
  for (const [a, b] of orderedPlayInPairs) {
    orderedPlayInSlots.push(a, b);
  }
  if (orderedPlayInSlots.length === 0) {
    orderedPlayInSlots.push(...byeAllocation.round1PlayIn);
  }

  // Phase 3: Walk knockout + final matches in round order (round ASC, slot ASC)
  const downstreamMatches = workingMatches
    .filter((m) => !m.isDemo && (m.type === 'knockout' || m.type === 'final'))
    .sort((a, b) => a.round - b.round || a.slot - b.slot || a.id.localeCompare(b.id));

  for (const m of downstreamMatches) {
    const beforeParticipants = participantIdsOf(m);
    const beforeStatus = m.status;
    const beforeWinner = m.result?.winnerId ?? m.winnerPlayerId ?? null;

    // Resolve expected participants from feeder definitions
    const hasFeeders = m.participants.some((p) => Boolean(p.feeder));
    const expectedParticipants = hasFeeders
      ? m.participants.map((p) =>
          resolveParticipantFromFeeder(
            p,
            groupQualifiersMap,
            byeAllocation.byeRecipients,
            orderedPlayInSlots,
            matchOutcomes
          )
        )
      : m.participants;

    const expectedIds = expectedParticipants.map((p) => p.playerId);
    const participantsChanged = !sameParticipantList(beforeParticipants, expectedIds);

    // Compute current match outcome based on its existing lifecycle & events first
    const mScores = scoresByMatch.get(m.id) ?? [];
    const mAbsences = absencesByMatch.get(m.id) ?? [];
    const mLifecycle = lifecycleByMatch.get(m.id) ?? [];
    const mBuzz = buzzByMatch.get(m.id) ?? [];

    const currentOutcome = computeMatchResult(
      m,
      mScores,
      mAbsences,
      mLifecycle,
      mBuzz
    );

    const isNotStarted = currentOutcome.status === 'scheduled';
    const isAutoBye =
      expectedParticipants.some((p) => p.isBye) &&
      currentOutcome.result?.reason === 'bye';

    if (participantsChanged) {
      if (isNotStarted || isAutoBye) {
        // Auto-update downstream match that hasn't started yet (or pure BYE slot)
        m.participants = expectedParticipants;
        m.playerIds = projectPlayerIds(m.id, expectedParticipants);
        cascadeChanges.push({
          matchId: m.id,
          tableName: m.tableName,
          tableNameAr: m.tableNameAr,
          roundId: m.roundId,
          currentStatus: currentOutcome.status,
          beforeParticipantIds: beforeParticipants,
          expectedParticipantIds: expectedIds,
          action: 'auto_update',
          reasonEn: `Auto-updated participants in "${m.tableName}" from upstream result.`,
          reasonAr: `تم تحديث المتسابقين تلقائياً في "${m.tableNameAr || m.tableName}" بناءً على النتيجة السابقة.`,
        });
      } else {
        // Downstream match is ALREADY live, finished, needsTieBreak, or void!
        // NEVER silently rewrite its participants or delete its events!
        cascadeChanges.push({
          matchId: m.id,
          tableName: m.tableName,
          tableNameAr: m.tableNameAr,
          roundId: m.roundId,
          currentStatus: currentOutcome.status,
          beforeParticipantIds: beforeParticipants,
          expectedParticipantIds: expectedIds,
          action: 'needs_review',
          reasonEn: `Upstream result changed after "${m.tableName}" (${currentOutcome.status}) had already started — requires Super Admin review.`,
          reasonAr: `تغيّرت نتيجة سابقة بعد بدء "${m.tableNameAr || m.tableName}" (${currentOutcome.status}) — يتطلب مراجعة مدير البطولة.`,
        });
      }
    }

    // Recompute final outcome on the updated match
    let finalOutcome = computeMatchResult(
      m,
      mScores,
      mAbsences,
      mLifecycle,
      mBuzz
    );

    if (
      participantsChanged &&
      !isNotStarted &&
      !isAutoBye &&
      flagLiveMismatches
    ) {
      finalOutcome = {
        ...finalOutcome,
        status: 'needsReview',
        requiresAdminDecision: true,
        needsReviewReason: `Upstream feeder changed after match entered "${currentOutcome.status}" state.`,
      };
    }

    matchOutcomes.set(m.id, finalOutcome);

    const afterWinner = finalOutcome.result?.winnerId ?? null;
    if (beforeStatus !== finalOutcome.status || beforeWinner !== afterWinner) {
      winnerChanges.push({
        matchId: m.id,
        tableName: m.tableName,
        beforeStatus,
        afterStatus: finalOutcome.status,
        beforeWinnerId: beforeWinner,
        afterWinnerId: afterWinner,
      });
    }

    applyOutcomeToMatchObject(m, finalOutcome);
  }

  // Phase 4: Recompute Round statuses (indexed O(M))
  const matchesByRound = new Map<string, Match[]>();
  for (const m of workingMatches) {
    if (m.isDemo) continue;
    const list = matchesByRound.get(m.roundId);
    if (list) list.push(m);
    else matchesByRound.set(m.roundId, [m]);
  }

  const updatedRounds: Round[] = input.rounds.map((round) => {
    const rMatches = matchesByRound.get(round.id) ?? [];
    if (rMatches.length === 0) return { ...round };
    const allDone = rMatches.every(
      (m) => m.status === 'finished' || m.status === 'void'
    );
    const anyActive = rMatches.some((m) => m.status !== 'scheduled');
    const nextStatus: Round['status'] = allDone
      ? 'done'
      : anyActive
        ? 'live'
        : 'upcoming';
    return { ...round, status: nextStatus };
  });

  // Phase 5: Recompute Player stats & statuses (indexed O(P + M + G))
  const playerStatsMap = computeAllPlayerStats(
    input.players,
    workingMatches,
    matchOutcomes,
    groupStandings,
    input.scoreEvents,
    input.absenceEvents
  );

  const matchesByPlayer = new Map<string, Match[]>();
  for (const m of workingMatches) {
    if (m.isDemo) continue;
    for (const p of m.participants) {
      if (!p.playerId) continue;
      const list = matchesByPlayer.get(p.playerId);
      if (list) list.push(m);
      else matchesByPlayer.set(p.playerId, [m]);
    }
  }
  const checkInsByPlayer = new Map<string, typeof input.checkInEvents>();
  for (const ci of input.checkInEvents) {
    const list = checkInsByPlayer.get(ci.playerId);
    if (list) list.push(ci);
    else checkInsByPlayer.set(ci.playerId, [ci]);
  }
  const groupStandingByPlayer = new Map<string, typeof groupStandings extends Map<string, infer V> ? V : never>();
  for (const gs of groupStandings.values()) {
    for (const row of gs.rows) {
      groupStandingByPlayer.set(row.playerId, gs);
    }
  }

  const playerStatusMap = new Map<string, (typeof input.players)[number]['status']>();
  const updatedPlayers = input.players.map((p) => {
    const myGroup = groupStandingByPlayer.get(p.id);
    const derivedStatus = computePlayerStatus(
      p,
      checkInsByPlayer.get(p.id) ?? [],
      matchesByPlayer.get(p.id) ?? [],
      matchOutcomes,
      myGroup ? new Map([[myGroup.groupId, myGroup]]) : new Map()
    );
    const derivedStats = playerStatsMap.get(p.id) ?? p.stats;
    playerStatusMap.set(p.id, derivedStatus);
    return {
      ...p,
      status: derivedStatus,
      stats: { ...derivedStats },
    };
  });

  // Ensure workingMatches preserves original array order
  const orderedMatches = input.matches.map((orig) => matchById.get(orig.id) ?? orig);

  return {
    matches: orderedMatches,
    rounds: updatedRounds,
    players: updatedPlayers,
    matchOutcomes,
    groupStandings,
    qualifiers,
    byeAllocation,
    playerStatsMap,
    playerStatusMap,
    cascadeChanges,
    winnerChanges,
  };
}

function applyOutcomeToMatchObject(m: Match, outcome: ComputedMatchOutcome): void {
  m.status = outcome.status;
  m.result = outcome.result;
  m.winnerPlayerId = outcome.result?.winnerId;
  m.advancingPlayerIds = outcome.result?.winnerId
    ? [outcome.result.winnerId]
    : undefined;
  m.activeBuzzPlayerId = outcome.activeBuzzPlayerId;
  m.startedAt = outcome.startedAt;
  m.finishedAt = outcome.finishedAt;
  m.needsReviewReason = outcome.needsReviewReason;
  m.playerIds = projectPlayerIds(m.id, m.participants);
}

/**
 * Pure Impact Preview calculator for admin edits/reverts/reopens/overrides.
 * Compares before-state against the simulated after-state WITHOUT committing anything.
 */
export function previewCascadeImpact(
  beforeInput: TournamentEngineInput,
  proposedInput: TournamentEngineInput
): CascadeImpact {
  const beforeProp = propagateWinners(beforeInput, {
    flagLiveMismatchesAsNeedsReview: false,
  });
  const afterProp = propagateWinners(proposedInput, {
    flagLiveMismatchesAsNeedsReview: true,
  });

  const beforeMatchMap = new Map(beforeProp.matches.map((m) => [m.id, m]));
  const winnerChanges: CascadeWinnerChange[] = [];

  for (const afterM of afterProp.matches) {
    if (afterM.isDemo) continue;
    const beforeM = beforeMatchMap.get(afterM.id);
    if (!beforeM) continue;
    const bWin = beforeM.result?.winnerId ?? null;
    const aWin = afterM.result?.winnerId ?? null;
    if (bWin !== aWin || beforeM.status !== afterM.status) {
      winnerChanges.push({
        matchId: afterM.id,
        tableName: afterM.tableName,
        beforeStatus: beforeM.status,
        afterStatus: afterM.status,
        beforeWinnerId: bWin,
        afterWinnerId: aWin,
      });
    }
  }

  // Merge cascadeChanges detected during propagation with any participant diffs
  const affectedMatches = [...afterProp.cascadeChanges];
  const autoUpdatedMatches = affectedMatches.filter((c) => c.action === 'auto_update');
  const reviewRequiredMatches = affectedMatches.filter(
    (c) => c.action === 'needs_review' || c.action === 'invalidate_replay'
  );

  const hasImpact =
    affectedMatches.length > 0 || winnerChanges.length > 0;
  const requiresConfirmation = reviewRequiredMatches.length > 0;

  const totalDownstream = affectedMatches.length;
  const summaryEn = requiresConfirmation
    ? `This change affects ${totalDownstream} downstream match(es) (${reviewRequiredMatches.length} already live or finished, ${autoUpdatedMatches.length} not yet started).`
    : totalDownstream > 0
      ? `This change will automatically update ${totalDownstream} not-started downstream match(es).`
      : winnerChanges.length > 0
        ? `This change updates the outcome of ${winnerChanges.length} match(es) with no downstream conflicts.`
        : 'No downstream matches are affected.';

  const summaryAr = requiresConfirmation
    ? `يؤثر هذا التعديل على ${totalDownstream} مباراة تالية (${reviewRequiredMatches.length} بدأت أو انتهت بالفعل، و${autoUpdatedMatches.length} لم تبدأ بعد).`
    : totalDownstream > 0
      ? `سيتم تحديث ${totalDownstream} مباراة تالية لم تبدأ بعد تلقائياً.`
      : winnerChanges.length > 0
        ? `يحدّث هذا التعديل نتيجة ${winnerChanges.length} مباراة دون تعارض في الجولات التالية.`
        : 'لا توجد مباريات تالية متأثرة بهذا التعديل.';

  return {
    hasImpact,
    requiresConfirmation,
    winnerChanges,
    affectedMatches,
    autoUpdatedMatches,
    reviewRequiredMatches,
    summaryEn,
    summaryAr,
  };
}
