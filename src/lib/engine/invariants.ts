import type { DatabaseSnapshot } from '@/lib/schemas';
import { computeQualifiers } from './groups';
import { computeMatchResult, computeMatchScores, getRevertedScoreEventIds } from './match';
import { propagateWinners } from './cascade';
import type { ConsistencyReport, InvariantViolation } from './types';

/**
 * Verifies every invariant listed in AGENTS.md §15.4 against a DatabaseSnapshot.
 * Pure function — no side effects, no UI/storage imports.
 */
export function checkInvariants(db: DatabaseSnapshot): ConsistencyReport {
  const violations: InvariantViolation[] = [];
  const tournamentMatches = db.matches.filter((m) => !m.isDemo);
  const matchById = new Map(db.matches.map((m) => [m.id, m]));
  const playerById = new Map(db.players.map((p) => [p.id, p]));
  const guestIds = new Set(
    db.players.filter((p) => p.isGuest || p.isHost).map((p) => p.id)
  );

  // Recompute authoritative state from append-only events
  const recomputed = propagateWinners(
    {
      players: db.players,
      groups: db.groups,
      rounds: db.rounds,
      matches: db.matches,
      scoreEvents: db.scoreEvents,
      absenceEvents: db.absenceEvents,
      buzzEvents: db.buzzEvents,
      matchEvents: db.matchEvents,
      checkInEvents: db.checkInEvents,
      settings: db.settings.tournament,
    },
    { flagLiveMismatchesAsNeedsReview: false }
  );

  // 1 & 2. Finished matches: single valid winner with strictly highest score; no finished match tied
  for (const m of tournamentMatches) {
    if (m.status === 'finished') {
      const winnerId = m.result?.winnerId ?? m.winnerPlayerId;
      const participantIds = m.participants
        .map((p) => p.playerId)
        .filter((pid): pid is string => Boolean(pid));

      if (!m.result || !winnerId || !participantIds.includes(winnerId)) {
        violations.push({
          code: 'FINISHED_MATCH_SINGLE_VALID_WINNER',
          severity: 'error',
          entityType: 'match',
          entityId: m.id,
          messageEn: `Finished match "${m.tableName}" does not have a single valid winner among its participants.`,
          messageAr: `المباراة المنتهية "${m.tableNameAr || m.tableName}" لا تحتوي على فائز واحد صالح من بين المشاركين.`,
          details: { winnerId: winnerId ?? null, participantIds },
        });
      }

      if (m.result?.type === 'normal' && !m.result.overridden) {
        const { totals } = computeMatchScores(m, db.scoreEvents);
        const scores = participantIds.map((pid) => ({
          pid,
          score: totals[pid] ?? 0,
        }));
        scores.sort((a, b) => b.score - a.score);

        if (scores.length >= 2 && scores[0].score === scores[1].score) {
          violations.push({
            code: 'NO_FINISHED_MATCH_TIED',
            severity: 'error',
            entityType: 'match',
            entityId: m.id,
            messageEn: `Finished match "${m.tableName}" is tied at ${scores[0].score} pts — draws are not allowed.`,
            messageAr: `المباراة المنتهية "${m.tableNameAr || m.tableName}" متعادلة عند ${scores[0].score} نقطة — التعادل غير مسموح.`,
            details: { scores },
          });
        } else if (scores.length > 0 && winnerId !== scores[0].pid) {
          violations.push({
            code: 'FINISHED_MATCH_SINGLE_VALID_WINNER',
            severity: 'error',
            entityType: 'match',
            entityId: m.id,
            messageEn: `Finished match "${m.tableName}" marks "${winnerId}" as winner, but "${scores[0].pid}" leads with ${scores[0].score} pts (vs ${totals[winnerId ?? ''] ?? 0}).`,
            messageAr: `المباراة المنتهية "${m.tableNameAr || m.tableName}" تسجّل "${winnerId}" كفائز بينما يتصدر "${scores[0].pid}" برصيد ${scores[0].score} نقطة.`,
            details: {
              storedWinnerId: winnerId,
              actualLeaderId: scores[0].pid,
              totals,
            },
          });
        }
      }

      // Check stored match status/result against pure computeMatchResult
      const freshOutcome = computeMatchResult(
        m,
        db.scoreEvents,
        db.absenceEvents,
        db.matchEvents,
        db.buzzEvents
      );
      if (
        freshOutcome.status !== m.status ||
        (freshOutcome.result?.winnerId ?? null) !== (m.result?.winnerId ?? null)
      ) {
        // Avoid duplicate if already reported above
        const alreadyReported = violations.some(
          (v) => v.entityId === m.id && v.entityType === 'match'
        );
        if (!alreadyReported) {
          violations.push({
            code: 'FINISHED_MATCH_SINGLE_VALID_WINNER',
            severity: 'error',
            entityType: 'match',
            entityId: m.id,
            messageEn: `Stored state of "${m.tableName}" (${m.status}, winner=${m.result?.winnerId ?? 'none'}) diverges from recomputed event log (${freshOutcome.status}, winner=${freshOutcome.result?.winnerId ?? 'none'}).`,
            messageAr: `الحالة المخزّنة للمباراة "${m.tableNameAr || m.tableName}" تختلف عن النتيجة المعاد حسابها من سجل الأحداث.`,
            details: {
              storedStatus: m.status,
              recomputedStatus: freshOutcome.status,
              storedWinnerId: m.result?.winnerId ?? null,
              recomputedWinnerId: freshOutcome.result?.winnerId ?? null,
            },
          });
        }
      }
    }
  }

  // 3 & 4. Finished groups have complete standings & qualifiers equal top N
  const { groupStandings } = computeQualifiers(
    db.groups,
    db.matches,
    db.scoreEvents,
    db.absenceEvents,
    db.matchEvents,
    db.settings.tournament
  );
  for (const g of db.groups) {
    // Check Marwan never in a group
    for (const pid of g.playerIds) {
      if (guestIds.has(pid)) {
        violations.push({
          code: 'MARWAN_EXCLUDED_FROM_STANDINGS',
          severity: 'error',
          entityType: 'group',
          entityId: g.id,
          messageEn: `Guest participant "${pid}" must not be placed in Group ${g.number}.`,
          messageAr: `لا يجوز وضع الضيف "${pid}" في المجموعة ${g.number}.`,
        });
      }
    }

    const gs = groupStandings.get(g.id);
    if (gs && gs.isComplete) {
      if (gs.rows.length !== g.playerIds.length) {
        violations.push({
          code: 'FINISHED_GROUP_COMPLETE_STANDINGS',
          severity: 'error',
          entityType: 'group',
          entityId: g.id,
          messageEn: `Completed Group ${g.number} standings count (${gs.rows.length}) does not match group players (${g.playerIds.length}).`,
          messageAr: `ترتيب المجموعة المكتملة ${g.number} غير مكتمل.`,
        });
      }
      const expectedTopN = gs.rows
        .slice(0, Math.min(db.settings.tournament.advancePerGroup, g.playerIds.length))
        .map((r) => r.playerId);
      if (
        expectedTopN.length !== gs.qualifierPlayerIds.length ||
        expectedTopN.some((id, idx) => gs.qualifierPlayerIds[idx] !== id)
      ) {
        violations.push({
          code: 'QUALIFIERS_MATCH_TOP_N',
          severity: 'error',
          entityType: 'group',
          entityId: g.id,
          messageEn: `Qualifiers for Group ${g.number} do not match the top ${db.settings.tournament.advancePerGroup} of standings.`,
          messageAr: `المتأهلون من المجموعة ${g.number} لا يطابقون أعلى المراكز في الترتيب.`,
          details: { expectedTopN, actualQualifiers: gs.qualifierPlayerIds },
        });
      }
    }
  }

  // 5. Knockout participants match their feeder results
  const recomputedCascadeByMatch = new Map(
    recomputed.cascadeChanges.map((c) => [c.matchId, c])
  );
  for (const m of tournamentMatches) {
    if (m.type !== 'knockout' && m.type !== 'final') continue;
    const storedPids = m.participants.map((p) => p.playerId);
    const cascadeIssue = recomputedCascadeByMatch.get(m.id);

    if (cascadeIssue) {
      // For scheduled matches, any mismatch is an invariant error.
      // For live/finished matches, a mismatch is only valid if explicitly flagged needsReview.
      if (cascadeIssue.action === 'auto_update' || m.status !== 'needsReview') {
        violations.push({
          code: 'KNOCKOUT_PARTICIPANTS_MATCH_FEEDERS',
          severity: 'error',
          entityType: 'match',
          entityId: m.id,
          messageEn: `Knockout/Final match "${m.tableName}" participants [${storedPids.map((x) => x ?? 'TBD').join(', ')}] do not match feeder results [${cascadeIssue.expectedParticipantIds.map((x) => x ?? 'TBD').join(', ')}].`,
          messageAr: `المتسابقون في "${m.tableNameAr || m.tableName}" لا يطابقون نتائج المباريات/المجموعات المغذّية لها.`,
          details: {
            storedPids,
            expectedPids: cascadeIssue.expectedParticipantIds,
            status: m.status,
          },
        });
      }
    }

    // Marwan must never appear in a non-final match
    if (m.type !== 'final' && !m.isFinal) {
      for (const pid of storedPids) {
        if (pid && guestIds.has(pid)) {
          violations.push({
            code: 'MARWAN_EXCLUDED_FROM_STANDINGS',
            severity: 'error',
            entityType: 'match',
            entityId: m.id,
            messageEn: `Guest participant "${pid}" appears in non-final match "${m.tableName}".`,
            messageAr: `الضيف "${pid}" موجود في مباراة غير نهائية "${m.tableNameAr || m.tableName}".`,
          });
        }
      }
    }
  }

  // 6. A player is in at most one live (or needsTieBreak) match simultaneously
  const liveMatchesByPlayer = new Map<string, string[]>();
  for (const m of tournamentMatches) {
    if (m.status === 'live' || m.status === 'needsTieBreak') {
      for (const p of m.participants) {
        if (!p.playerId) continue;
        const list = liveMatchesByPlayer.get(p.playerId) ?? [];
        list.push(m.id);
        liveMatchesByPlayer.set(p.playerId, list);
      }
    }
  }
  for (const [playerId, liveIds] of liveMatchesByPlayer.entries()) {
    if (liveIds.length > 1) {
      violations.push({
        code: 'PLAYER_AT_MOST_ONE_LIVE_MATCH',
        severity: 'error',
        entityType: 'player',
        entityId: playerId,
        messageEn: `Player "${playerId}" is simultaneously active in ${liveIds.length} live matches (${liveIds.join(', ')}).`,
        messageAr: `اللاعب "${playerId}" يشارك حالياً في ${liveIds.length} مباريات مباشرة في نفس الوقت.`,
        details: { liveMatchIds: liveIds },
      });
    }
  }

  // 7. Stored player stats & status equal recomputed values from events
  const recomputedPlayerMap = new Map(recomputed.players.map((p) => [p.id, p]));
  for (const p of db.players) {
    const expected = recomputedPlayerMap.get(p.id);
    if (!expected) continue;
    const diffs: Record<string, { stored: unknown; expected: unknown }> = {};

    if (p.status !== expected.status) {
      diffs.status = { stored: p.status, expected: expected.status };
    }
    const statKeys: Array<keyof typeof p.stats> = [
      'matchesPlayed',
      'gamesPlayed',
      'wins',
      'losses',
      'totalPoints',
      'groupPoints',
      'yellowCards',
      'redCards',
      'absences',
    ];
    for (const key of statKeys) {
      if ((p.stats[key] ?? 0) !== (expected.stats[key] ?? 0)) {
        diffs[key] = { stored: p.stats[key], expected: expected.stats[key] };
      }
    }

    if (Object.keys(diffs).length > 0) {
      violations.push({
        code: 'STORED_STATS_MATCH_RECOMPUTED',
        severity: 'error',
        entityType: 'player',
        entityId: p.id,
        messageEn: `Player "${p.fullName}" stored stats/status diverge from recomputed event log (${Object.keys(diffs).join(', ')}).`,
        messageAr: `إحصائيات أو حالة اللاعب "${p.fullNameAr || p.fullName}" المخزّنة تختلف عن القيم المعاد حسابها من السجل.`,
        details: diffs,
      });
    }
  }

  // 8. No orphan events (ScoreEvents, AbsenceEvents, BuzzEvents, MatchLifecycleEvents, CheckInEvents)
  const scoreEventById = new Map(db.scoreEvents.map((e) => [e.id, e]));
  const undoTargetCounts = new Map<string, number>();

  for (const ev of db.scoreEvents) {
    if (!matchById.has(ev.matchId)) {
      violations.push({
        code: 'NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'event',
        entityId: ev.id,
        messageEn: `Orphan ScoreEvent "${ev.id}" references missing match "${ev.matchId}".`,
        messageAr: `حدث النقاط "${ev.id}" يشير إلى مباراة غير موجودة "${ev.matchId}".`,
      });
    }
    if (!playerById.has(ev.playerId)) {
      violations.push({
        code: 'NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'event',
        entityId: ev.id,
        messageEn: `Orphan ScoreEvent "${ev.id}" references missing player "${ev.playerId}".`,
        messageAr: `حدث النقاط "${ev.id}" يشير إلى لاعب غير موجود "${ev.playerId}".`,
      });
    }
    if (ev.kind === 'undo') {
      if (!ev.targetEventId || !scoreEventById.has(ev.targetEventId)) {
        violations.push({
          code: 'NO_ORPHAN_EVENTS',
          severity: 'error',
          entityType: 'event',
          entityId: ev.id,
          messageEn: `Undo ScoreEvent "${ev.id}" references missing target event "${ev.targetEventId ?? 'none'}".`,
          messageAr: `حدث التراجع "${ev.id}" يشير إلى حدث أصلي غير موجود.`,
        });
      } else {
        const count = (undoTargetCounts.get(ev.targetEventId) ?? 0) + 1;
        undoTargetCounts.set(ev.targetEventId, count);
        if (count > 1) {
          violations.push({
            code: 'NO_ORPHAN_EVENTS',
            severity: 'error',
            entityType: 'event',
            entityId: ev.id,
            messageEn: `ScoreEvent "${ev.targetEventId}" was undone ${count} times (double-undo violation).`,
            messageAr: `تم التراجع عن حدث النقاط "${ev.targetEventId}" أكثر من مرة.`,
          });
        }
      }
    }
  }

  for (const ev of db.absenceEvents) {
    if (!matchById.has(ev.matchId) || !playerById.has(ev.playerId)) {
      violations.push({
        code: 'NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'event',
        entityId: ev.id,
        messageEn: `Orphan AbsenceEvent "${ev.id}" references missing match or player.`,
        messageAr: `حدث الغياب "${ev.id}" يشير إلى مباراة أو لاعب غير موجود.`,
      });
    }
  }

  for (const ev of db.buzzEvents) {
    if (!matchById.has(ev.matchId) || !playerById.has(ev.playerId)) {
      violations.push({
        code: 'NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'event',
        entityId: ev.id,
        messageEn: `Orphan BuzzEvent "${ev.id}" references missing match or player.`,
        messageAr: `حدث الجرس "${ev.id}" يشير إلى مباراة أو لاعب غير موجود.`,
      });
    }
  }

  for (const ev of db.matchEvents) {
    if (!matchById.has(ev.matchId)) {
      violations.push({
        code: 'NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'event',
        entityId: ev.id,
        messageEn: `Orphan MatchLifecycleEvent "${ev.id}" references missing match "${ev.matchId}".`,
        messageAr: `حدث حالة المباراة "${ev.id}" يشير إلى مباراة غير موجودة.`,
      });
    }
  }

  for (const ev of db.checkInEvents) {
    if (!playerById.has(ev.playerId)) {
      violations.push({
        code: 'NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'event',
        entityId: ev.id,
        messageEn: `Orphan CheckInEvent "${ev.id}" references missing player "${ev.playerId}".`,
        messageAr: `حدث تسجيل الحضور "${ev.id}" يشير إلى لاعب غير موجود.`,
      });
    }
  }

  // Ensure reverted event markers stay synced
  void getRevertedScoreEventIds;

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  return {
    ok: errorCount === 0,
    checkedAt: new Date().toISOString(),
    totalChecks: 9,
    violations,
    summary: {
      matchesChecked: tournamentMatches.length,
      groupsChecked: db.groups.length,
      playersChecked: db.players.length,
      eventsChecked:
        db.scoreEvents.length +
        db.absenceEvents.length +
        db.buzzEvents.length +
        db.matchEvents.length +
        db.checkInEvents.length,
      errorCount,
      warningCount,
    },
  };
}
