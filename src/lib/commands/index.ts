/**
 * Atomic Command Pipeline (/lib/commands)
 *
 * EVERY mutation in the entire application flows through this pipeline:
 * 1. Serialize through an in-process write queue (prevents interleaved read-modify-write).
 * 2. Check role & match-assignment permissions.
 * 3. Validate payload & check optimistic concurrency version on matches.
 * 4. Append immutable event(s) (never delete past events).
 * 5. Recompute derived state & cascade via pure /lib/engine.
 * 6. If downstream live/finished matches are impacted and not yet confirmed, abort & throw
 *    CascadeConfirmationRequiredError with full CascadeImpact for the Impact Preview dialog.
 * 7. Write actor audit entry + all automatic cascade audit entries.
 * 8. Run checkInvariants() — fail loudly in dev/test; auto-repair + log in production.
 * 9. Commit atomically to IndexedDB (delta commit or bulk write).
 * 10. Broadcast realtime events ONLY AFTER the IndexedDB commit resolves.
 */

import {
  AVATAR_LIBRARY_KEYS,
  MARWAN_PLAYER_ID,
  type AbsenceEvent,
  type AuditEntry,
  type Avatar,
  type BuzzEvent,
  type CheckInEvent,
  type CheckInStatus,
  type ContentItem,
  type DatabaseSnapshot,
  type Group,
  type Match,
  type MatchLifecycleEvent,
  type MatchResultType,
  type MatchTimerState,
  type Player,
  type PlayerContact,
  type Round,
  type ScoreEvent,
  type Segment,
  type Settings,
  type Sponsor,
  type TournamentSettings,
  type User,
} from '@/lib/schemas';
import {
  autoScheduleMatches,
  checkInvariants,
  computeMatchAbsences,
  computeMatchResult,
  computeTournamentBlueprint,
  detectScheduleConflicts,
  findNextFreeSlotForMatch,
  generateGroupRoundRobinPairs,
  generateGroups,
  generateKnockout,
  getTournamentProgress,
  previewCascadeImpact,
  propagateWinners,
  validateTournamentSettings,
  type CascadeImpact,
  type ConsistencyReport,
  type SettingsImpactPreview,
} from '@/lib/engine';
import { feedback } from '@/lib/feedback';
import {
  realtime,
  registerCrossTabCacheInvalidator,
  type RealtimeEventName,
} from '@/lib/realtime';
import { assertRepoPermission, PermissionDeniedError } from '@/lib/repos/permissions';
import {
  buildBracketConfigCompat,
  createDemoSeedState,
  deterministicAvatarKey,
  formatFakePhone,
  generateProceduralPlayers,
  type CreateSeedOptions,
} from '@/lib/seed';
import { storage, type StorageDelta } from '@/lib/storage';
import {
  CascadeConfirmationRequiredError,
  CommandValidationError,
  InvariantViolationError,
  VersionConflictError,
} from './errors';

// Ensure cross-tab realtime messages always invalidate local IndexedDB cache
registerCrossTabCacheInvalidator(() => storage.invalidateCache());

export type CascadePolicy = 'invalidateForReplay' | 'markNeedsReview';

export interface CascadeCommandOptions {
  confirmCascade?: boolean;
  cascadePolicy?: CascadePolicy;
  expectedVersion?: number;
}

interface RealtimeBroadcast {
  event: RealtimeEventName;
  payload: Record<string, unknown>;
}

interface ExecutionEnvelope<T> {
  result: T;
  nextDb: DatabaseSnapshot;
  delta?: StorageDelta;
  fullReplace?: boolean;
  broadcasts: RealtimeBroadcast[];
  skipInvariants?: boolean;
}

// Monotonic ID helper (guarantees unique chronological IDs even within same millisecond)
let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 5)}`;
}

// Monotonic ISO timestamp helper so rapid sequential events always preserve strict order
let lastIsoMs = 0;
function nextIsoTimestamp(): string {
  const now = Date.now();
  lastIsoMs = now > lastIsoMs ? now : lastIsoMs + 1;
  return new Date(lastIsoMs).toISOString();
}

// In-process serialization queue to guarantee atomic read -> validate -> commit ordering
let commandQueue: Promise<unknown> = Promise.resolve();
function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = commandQueue.then(fn, fn);
  commandQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

function createAuditRecord(input: {
  actorUserId: string;
  action: string;
  entityType: AuditEntry['entityType'];
  entityId: string;
  summary: string;
  summaryAr?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  automatic?: boolean;
}): AuditEntry {
  return {
    id: nextId('audit'),
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    summaryAr: input.summaryAr,
    before: input.before ?? null,
    after: input.after ?? null,
    automatic: input.automatic ?? false,
    createdAt: nextIsoTimestamp(),
  };
}

const ALLOWED_AVATAR_KEY_SET = new Set<string>(AVATAR_LIBRARY_KEYS);
export const MAX_AVATAR_PHOTO_BYTES = 310 * 1024; // ~300KB max (with small base64 header tolerance)
const ALLOWED_IMAGE_DATA_URL_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
] as const;

export function estimateDataUrlByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1).trim();
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function validatePlayerAvatarInput(
  avatar: Avatar,
  targetPlayer: Player
): Avatar {
  const rawKey = avatar.avatarKey?.trim() || targetPlayer.avatar.avatarKey || deterministicAvatarKey(targetPlayer.seed || 1);
  if (!ALLOWED_AVATAR_KEY_SET.has(rawKey)) {
    throw new CommandValidationError(
      `Invalid 3D avatar key "${rawKey}". Expected one of avatar-01..avatar-24.`
    );
  }

  const rawPhoto = avatar.photoUrl?.trim() ? avatar.photoUrl.trim() : null;
  if (rawPhoto) {
    if (
      targetPlayer.isGuest ||
      targetPlayer.isHost ||
      targetPlayer.id === MARWAN_PLAYER_ID
    ) {
      throw new CommandValidationError(
        'Marwan Serry is a name-only guest host and cannot have a profile photo.'
      );
    }

    const lower = rawPhoto.toLowerCase();
    const hasAllowedMime = ALLOWED_IMAGE_DATA_URL_PREFIXES.some((prefix) =>
      lower.startsWith(prefix)
    );
    if (!hasAllowedMime) {
      throw new CommandValidationError(
        'Invalid image file type. Only JPEG, PNG, and WebP profile photos are allowed.'
      );
    }

    const byteSize = estimateDataUrlByteSize(rawPhoto);
    if (byteSize > MAX_AVATAR_PHOTO_BYTES) {
      throw new CommandValidationError(
        `Profile photo is too large (${Math.round(byteSize / 1024)}KB). Maximum allowed size is 300KB.`
      );
    }
  }

  return {
    photoUrl: rawPhoto,
    avatarKey: rawKey,
  };
}

function assertVersion(match: Match, expectedVersion?: number): void {
  if (
    typeof expectedVersion === 'number' &&
    match.version !== expectedVersion
  ) {
    throw new VersionConflictError(match.id, expectedVersion, match.version);
  }
}

function computeDeltaBetweenSnapshots(
  before: DatabaseSnapshot,
  after: DatabaseSnapshot
): StorageDelta {
  const delta: StorageDelta = {};

  const diffById = <T extends { id: string }>(
    prevArr: T[],
    nextArr: T[]
  ): { put: T[]; del: string[] } => {
    const prevMap = new Map(prevArr.map((x) => [x.id, x]));
    const nextMap = new Map(nextArr.map((x) => [x.id, x]));
    const put: T[] = [];
    const del: string[] = [];

    for (const item of nextArr) {
      const prev = prevMap.get(item.id);
      if (prev === item) continue;
      if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
        put.push(item);
      }
    }
    for (const prev of prevArr) {
      if (!nextMap.has(prev.id)) {
        del.push(prev.id);
      }
    }
    return { put, del };
  };

  const pDiff = diffById(before.players, after.players);
  if (pDiff.put.length) delta.putPlayers = pDiff.put;
  if (pDiff.del.length) delta.deletePlayerIds = pDiff.del;

  const uDiff = diffById(before.users, after.users);
  if (uDiff.put.length) delta.putUsers = uDiff.put;
  if (uDiff.del.length) delta.deleteUserIds = uDiff.del;

  const gDiff = diffById(before.groups, after.groups);
  if (gDiff.put.length) delta.putGroups = gDiff.put;
  if (gDiff.del.length) delta.deleteGroupIds = gDiff.del;

  const rDiff = diffById(before.rounds, after.rounds);
  if (rDiff.put.length) delta.putRounds = rDiff.put;
  if (rDiff.del.length) delta.deleteRoundIds = rDiff.del;

  const segDiff = diffById(before.segments, after.segments);
  if (segDiff.put.length) delta.putSegments = segDiff.put;
  if (segDiff.del.length) delta.deleteSegmentIds = segDiff.del;

  const mDiff = diffById(before.matches, after.matches);
  if (mDiff.put.length) delta.putMatches = mDiff.put;
  if (mDiff.del.length) delta.deleteMatchIds = mDiff.del;

  const spDiff = diffById(before.sponsors, after.sponsors);
  if (spDiff.put.length) delta.putSponsors = spDiff.put;
  if (spDiff.del.length) delta.deleteSponsorIds = spDiff.del;

  const cDiff = diffById(before.contentItems, after.contentItems);
  if (cDiff.put.length) delta.putContentItems = cDiff.put;
  if (cDiff.del.length) delta.deleteContentItemIds = cDiff.del;

  // Append-only event stores (put any newly added or marker-updated items)
  const seDiff = diffById(before.scoreEvents, after.scoreEvents);
  if (seDiff.put.length) delta.putScoreEvents = seDiff.put;

  const abDiff = diffById(before.absenceEvents, after.absenceEvents);
  if (abDiff.put.length) delta.putAbsenceEvents = abDiff.put;

  const bzDiff = diffById(before.buzzEvents, after.buzzEvents);
  if (bzDiff.put.length) delta.putBuzzEvents = bzDiff.put;

  const meDiff = diffById(before.matchEvents, after.matchEvents);
  if (meDiff.put.length) delta.putMatchEvents = meDiff.put;

  const ciDiff = diffById(before.checkInEvents, after.checkInEvents);
  if (ciDiff.put.length) delta.putCheckInEvents = ciDiff.put;

  const auDiff = diffById(before.auditEntries, after.auditEntries);
  if (auDiff.put.length) delta.putAuditEntries = auDiff.put;

  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    delta.settings = after.settings;
  }

  return delta;
}

/**
 * Applies engine propagation + cascade policy to a working snapshot.
 * If downstream live/finished matches are affected and confirmCascade !== true,
 * throws CascadeConfirmationRequiredError so the UI can show Impact Preview.
 */
function applyPropagationAndCascade(
  beforeDb: DatabaseSnapshot,
  workingDb: DatabaseSnapshot,
  actorUserId: string,
  options?: {
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    isDemo?: boolean;
  }
): {
  impact: CascadeImpact;
  cascadeAuditEntries: AuditEntry[];
  cascadeBroadcasts: RealtimeBroadcast[];
} {
  const beforeEngineInput = {
    players: beforeDb.players,
    groups: beforeDb.groups,
    rounds: beforeDb.rounds,
    matches: beforeDb.matches,
    scoreEvents: beforeDb.scoreEvents,
    absenceEvents: beforeDb.absenceEvents,
    buzzEvents: beforeDb.buzzEvents,
    matchEvents: beforeDb.matchEvents,
    checkInEvents: beforeDb.checkInEvents,
    settings: beforeDb.settings.tournament,
  };

  const proposedEngineInput = {
    players: workingDb.players,
    groups: workingDb.groups,
    rounds: workingDb.rounds,
    matches: workingDb.matches,
    scoreEvents: workingDb.scoreEvents,
    absenceEvents: workingDb.absenceEvents,
    buzzEvents: workingDb.buzzEvents,
    matchEvents: workingDb.matchEvents,
    checkInEvents: workingDb.checkInEvents,
    settings: workingDb.settings.tournament,
  };

  const impact = previewCascadeImpact(beforeEngineInput, proposedEngineInput);

  if (impact.requiresConfirmation && !options?.confirmCascade) {
    throw new CascadeConfirmationRequiredError(impact);
  }

  const cascadeAuditEntries: AuditEntry[] = [];
  const cascadeBroadcasts: RealtimeBroadcast[] = [];
  const policy: CascadePolicy = options?.cascadePolicy ?? 'invalidateForReplay';

  // Handle confirmed downstream live/finished matches
  if (impact.reviewRequiredMatches.length > 0 && options?.confirmCascade) {
    for (const affected of impact.reviewRequiredMatches) {
      const mIdx = workingDb.matches.findIndex((m) => m.id === affected.matchId);
      if (mIdx === -1) continue;
      const targetMatch = workingDb.matches[mIdx];

      if (policy === 'invalidateForReplay') {
        const nextEpoch = (targetMatch.replayEpoch ?? 0) + 1;
        const invEvent: MatchLifecycleEvent = {
          id: nextId('me'),
          matchId: targetMatch.id,
          type: 'invalidatedForReplay',
          byUserId: actorUserId,
          reason: affected.reasonEn,
          payload: {
            previousStatus: affected.currentStatus,
            previousParticipants: affected.beforeParticipantIds,
            expectedParticipants: affected.expectedParticipantIds,
            newReplayEpoch: nextEpoch,
          },
          replayEpoch: nextEpoch,
          createdAt: nextIsoTimestamp(),
        };
        workingDb.matchEvents.unshift(invEvent);
        workingDb.matches[mIdx] = {
          ...targetMatch,
          replayEpoch: nextEpoch,
          currentSegmentIndex: 0,
          timer: { status: 'idle', durationSec: 45, remainingSec: 45, endsAt: null },
          version: targetMatch.version + 1,
        };

        cascadeAuditEntries.push(
          createAuditRecord({
            actorUserId,
            action: 'cascade.downstreamInvalidated',
            entityType: 'cascade',
            entityId: targetMatch.id,
            summary: `Cascade: invalidated "${targetMatch.tableName}" (was ${affected.currentStatus}) for replay (epoch ${nextEpoch}) after upstream change.`,
            summaryAr: `تحديث تلقائي متسلسل: تم إلغاء نتيجة "${targetMatch.tableNameAr || targetMatch.tableName}" لإعادة اللعب بعد تغيير نتيجة سابقة.`,
            before: {
              status: affected.currentStatus,
              participants: affected.beforeParticipantIds,
            },
            after: {
              status: 'scheduled',
              participants: affected.expectedParticipantIds,
              replayEpoch: nextEpoch,
            },
            automatic: true,
          })
        );
      } else {
        // policy === 'markNeedsReview'
        const reviewEvent: MatchLifecycleEvent = {
          id: nextId('me'),
          matchId: targetMatch.id,
          type: 'markedNeedsReview',
          byUserId: actorUserId,
          reason: affected.reasonEn,
          payload: {
            previousStatus: affected.currentStatus,
            expectedParticipants: affected.expectedParticipantIds,
          },
          replayEpoch: targetMatch.replayEpoch ?? 0,
          createdAt: nextIsoTimestamp(),
        };
        workingDb.matchEvents.unshift(reviewEvent);
        workingDb.matches[mIdx] = {
          ...targetMatch,
          version: targetMatch.version + 1,
        };

        cascadeAuditEntries.push(
          createAuditRecord({
            actorUserId,
            action: 'cascade.markedNeedsReview',
            entityType: 'cascade',
            entityId: targetMatch.id,
            summary: `Cascade: marked "${targetMatch.tableName}" as needsReview after upstream change.`,
            summaryAr: `تحديث تلقائي متسلسل: تم تمييز "${targetMatch.tableNameAr || targetMatch.tableName}" للمراجعة الإدارية بعد تغيير نتيجة سابقة.`,
            before: {
              status: affected.currentStatus,
              participants: affected.beforeParticipantIds,
            },
            after: {
              status: 'needsReview',
              expectedParticipants: affected.expectedParticipantIds,
            },
            automatic: true,
          })
        );
        cascadeBroadcasts.push({
          event: 'match.needsReview',
          payload: { matchId: targetMatch.id, reason: affected.reasonEn },
        });
      }
    }
  }

  // Final authoritative pure propagation pass (handles cascading across multiple rounds too!)
  const propagated = propagateWinners(
    {
      players: workingDb.players,
      groups: workingDb.groups,
      rounds: workingDb.rounds,
      matches: workingDb.matches,
      scoreEvents: workingDb.scoreEvents,
      absenceEvents: workingDb.absenceEvents,
      buzzEvents: workingDb.buzzEvents,
      matchEvents: workingDb.matchEvents,
      checkInEvents: workingDb.checkInEvents,
      settings: workingDb.settings.tournament,
    },
    { flagLiveMismatchesAsNeedsReview: policy === 'markNeedsReview' }
  );

  // If invalidating round N also changed round N+1 (cascading further downstream!),
  // handle any newly exposed scheduled auto-updates cleanly
  workingDb.matches = propagated.matches;
  workingDb.rounds = propagated.rounds;
  workingDb.players = propagated.players;

  // Automatic Group Deadlock Tie-Break Match creation (AGENTS.md §15.1):
  // When a group finishes all regular round-robin matches and remains deadlocked across
  // the qualification cutoff after rules 1–4, automatically spawn a scheduled tie-break match.
  if (!options?.isDemo) {
    let spawnedOrPrunedTieBreak = false;
    for (const gs of propagated.groupStandings.values()) {
      const existingUnfinishedTb = workingDb.matches.filter(
        (m) =>
          !m.isDemo &&
          m.groupId === gs.groupId &&
          m.isGroupTieBreak &&
          m.status !== 'finished' &&
          m.status !== 'void'
      );

      if (
        gs.needsTieBreakMatch &&
        gs.tiedCutoffPlayerIds.length >= 2 &&
        existingUnfinishedTb.length === 0
      ) {
        const group = workingDb.groups.find((g) => g.id === gs.groupId);
        if (group) {
          const tbId = `match-gtb-auto-g${group.number}-${Date.now()}-${++idCounter}`;
          const tiedPids = [...gs.tiedCutoffPlayerIds];
          const groupMatches = workingDb.matches.filter(
            (m) => !m.isDemo && m.groupId === group.id
          );
          const latestMs = groupMatches.reduce((max, m) => {
            const t = Date.parse(m.scheduledAt);
            return !Number.isNaN(t) && t > max ? t : max;
          }, Date.parse('2027-03-05T19:00:00.000Z'));

          const draftTb: Match = {
            id: tbId,
            type: 'group',
            groupId: group.id,
            roundId: group.roundId,
            round: 1,
            slot: groupMatches.length + 1,
            isGroupTieBreak: true,
            participants: tiedPids.map((pid, idx) => ({
              slotIndex: idx,
              playerId: pid,
              feeder: { kind: 'fixed' as const, playerId: pid },
            })),
            playerIds: tiedPids,
            tableNumber: 1,
            tableName: `Group ${group.number} · Automatic Tie-Break`,
            tableNameAr: `المجموعة ${group.number} · مباراة فاصلة تلقائية`,
            scheduledAt: new Date(
              latestMs + workingDb.settings.tournament.slotMinutes * 60_000
            ).toISOString(),
            judgeUserId:
              workingDb.users.find((u) => u.role === 'scorer')?.id ?? 'user-scorer-1',
            scorerUserId:
              workingDb.users.find((u) => u.role === 'scorer')?.id ?? 'user-scorer-1',
            segmentIds: ['seg-16'],
            currentSegmentIndex: 0,
            status: 'scheduled',
            result: null,
            isFinal: false,
            isDemo: false,
            replayEpoch: 0,
            version: 1,
            timer: { status: 'idle', durationSec: 30, remainingSec: 30 },
          };

          const freeSlot = findNextFreeSlotForMatch(
            draftTb,
            workingDb.matches,
            workingDb.users,
            workingDb.settings.tournament
          );
          draftTb.tableNumber = freeSlot.tableNumber;
          draftTb.judgeUserId = freeSlot.judgeUserId;
          draftTb.scorerUserId = freeSlot.judgeUserId;
          draftTb.scheduledAt = freeSlot.scheduledAt;

          workingDb.matches.push(draftTb);
          spawnedOrPrunedTieBreak = true;

          cascadeAuditEntries.push(
            createAuditRecord({
              actorUserId,
              action: 'cascade.groupTieBreakCreated',
              entityType: 'group',
              entityId: group.id,
              summary: `Auto-created tie-break match for deadlocked Group ${group.number} (${tiedPids.length} tied players on cutoff).`,
              summaryAr: `تم إنشاء مباراة فاصلة تلقائياً للمجموعة ${group.number} بسبب تساوي ${tiedPids.length} لاعبين في جميع معايير الترتيب.`,
              before: null,
              after: {
                matchId: tbId,
                tiedPlayerIds: tiedPids,
                tableNumber: draftTb.tableNumber,
                scheduledAt: draftTb.scheduledAt,
              },
              automatic: true,
            })
          );
        }
      } else if (!gs.needsTieBreakMatch && existingUnfinishedTb.length > 0) {
        // Prune an auto-spawned tie-break match if a score revert resolved the deadlock before it started
        for (const autoTb of existingUnfinishedTb) {
          if (
            autoTb.id.startsWith('match-gtb-auto-') &&
            autoTb.status === 'scheduled' &&
            !workingDb.scoreEvents.some((e) => e.matchId === autoTb.id) &&
            !workingDb.absenceEvents.some((e) => e.matchId === autoTb.id) &&
            !workingDb.matchEvents.some((e) => e.matchId === autoTb.id)
          ) {
            workingDb.matches = workingDb.matches.filter((m) => m.id !== autoTb.id);
            spawnedOrPrunedTieBreak = true;
          }
        }
      }
    }

    if (spawnedOrPrunedTieBreak) {
      const reProp = propagateWinners(
        {
          players: workingDb.players,
          groups: workingDb.groups,
          rounds: workingDb.rounds,
          matches: workingDb.matches,
          scoreEvents: workingDb.scoreEvents,
          absenceEvents: workingDb.absenceEvents,
          buzzEvents: workingDb.buzzEvents,
          matchEvents: workingDb.matchEvents,
          checkInEvents: workingDb.checkInEvents,
          settings: workingDb.settings.tournament,
        },
        { flagLiveMismatchesAsNeedsReview: policy === 'markNeedsReview' }
      );
      workingDb.matches = reProp.matches;
      workingDb.rounds = reProp.rounds;
      workingDb.players = reProp.players;
      cascadeBroadcasts.push({ event: 'bracket.updated', payload: {} });
    }
  }

  if (!options?.isDemo) {
    // Log automatic audit entries for auto-updated scheduled downstream matches
    for (const auto of propagated.cascadeChanges) {
      if (auto.action === 'auto_update') {
        const mIdx = workingDb.matches.findIndex((m) => m.id === auto.matchId);
        if (mIdx !== -1) {
          workingDb.matches[mIdx] = {
            ...workingDb.matches[mIdx],
            version: workingDb.matches[mIdx].version + 1,
          };
        }
        cascadeAuditEntries.push(
          createAuditRecord({
            actorUserId,
            action: 'cascade.participantUpdated',
            entityType: 'cascade',
            entityId: auto.matchId,
            summary: auto.reasonEn,
            summaryAr: auto.reasonAr,
            before: { participants: auto.beforeParticipantIds },
            after: { participants: auto.expectedParticipantIds },
            automatic: true,
          })
        );
      }
    }

    // Log automatic audit entries for winner/status recomputation changes (e.g. score revert flipping a winner)
    for (const wc of impact.winnerChanges) {
      if (wc.beforeWinnerId !== wc.afterWinnerId || wc.beforeStatus !== wc.afterStatus) {
        cascadeAuditEntries.push(
          createAuditRecord({
            actorUserId,
            action: 'cascade.matchOutcomeChanged',
            entityType: 'cascade',
            entityId: wc.matchId,
            summary: `Recomputed "${wc.tableName}": status ${wc.beforeStatus} → ${wc.afterStatus}, winner ${wc.beforeWinnerId ?? 'none'} → ${wc.afterWinnerId ?? 'none'}.`,
            summaryAr: `إعادة حساب "${wc.tableName}": الحالة ${wc.beforeStatus} ← ${wc.afterStatus}، الفائز ${wc.beforeWinnerId ?? 'لا يوجد'} ← ${wc.afterWinnerId ?? 'لا يوجد'}.`,
            before: { status: wc.beforeStatus, winnerId: wc.beforeWinnerId },
            after: { status: wc.afterStatus, winnerId: wc.afterWinnerId },
            automatic: true,
          })
        );
      }
    }
  }

  // Check if the Grand Final just became fully revealed (both challenger seats filled)
  const beforeFinal = beforeDb.matches.find((m) => m.type === 'final');
  const afterFinal = workingDb.matches.find((m) => m.type === 'final');
  if (
    beforeFinal &&
    afterFinal &&
    beforeFinal.participants.some((p) => !p.playerId) &&
    afterFinal.participants.every((p) => Boolean(p.playerId))
  ) {
    cascadeBroadcasts.push({
      event: 'final.revealed',
      payload: { gameId: afterFinal.id, matchId: afterFinal.id },
    });
  }

  if (
    propagated.cascadeChanges.length > 0 ||
    impact.winnerChanges.length > 0
  ) {
    cascadeBroadcasts.push({
      event: 'bracket.updated',
      payload: {},
    });
  }

  return { impact, cascadeAuditEntries, cascadeBroadcasts };
}

/**
 * Runs a transactional command:
 * Read -> Mutate working copy -> Check invariants -> Atomic IndexedDB Commit -> Broadcast!
 */
async function commitCommand<T>(
  actorUserId: string,
  handler: (
    beforeDb: DatabaseSnapshot,
    workingDb: DatabaseSnapshot
  ) => ExecutionEnvelope<T>
): Promise<T> {
  return runSerialized(async () => {
    const beforeDb = await storage.readSnapshot();
    const workingDb: DatabaseSnapshot = {
      version: beforeDb.version,
      players: [...beforeDb.players],
      users: [...beforeDb.users],
      groups: [...beforeDb.groups],
      rounds: [...beforeDb.rounds],
      segments: [...beforeDb.segments],
      matches: [...beforeDb.matches],
      scoreEvents: [...beforeDb.scoreEvents],
      absenceEvents: [...beforeDb.absenceEvents],
      buzzEvents: [...beforeDb.buzzEvents],
      matchEvents: [...beforeDb.matchEvents],
      checkInEvents: [...beforeDb.checkInEvents],
      auditEntries: [...beforeDb.auditEntries],
      sponsors: [...beforeDb.sponsors],
      contentItems: [...beforeDb.contentItems],
      settings: {
        ...beforeDb.settings,
        tournament: { ...beforeDb.settings.tournament },
        bracketConfig: { ...beforeDb.settings.bracketConfig },
      },
    };

    const envelope = handler(beforeDb, workingDb);

    // Run consistency invariants AFTER derived state recomputation and BEFORE committing!
    if (!envelope.skipInvariants) {
      const report = checkInvariants(envelope.nextDb);
      if (!report.ok) {
        if (!isProductionEnv()) {
          throw new InvariantViolationError(report);
        }
        // Production safety net: auto-repair via pure engine recomputation & log!
        const repaired = propagateWinners({
          players: envelope.nextDb.players,
          groups: envelope.nextDb.groups,
          rounds: envelope.nextDb.rounds,
          matches: envelope.nextDb.matches,
          scoreEvents: envelope.nextDb.scoreEvents,
          absenceEvents: envelope.nextDb.absenceEvents,
          buzzEvents: envelope.nextDb.buzzEvents,
          matchEvents: envelope.nextDb.matchEvents,
          checkInEvents: envelope.nextDb.checkInEvents,
          settings: envelope.nextDb.settings.tournament,
        });
        envelope.nextDb.players = repaired.players;
        envelope.nextDb.rounds = repaired.rounds;
        envelope.nextDb.matches = repaired.matches;
        envelope.nextDb.auditEntries.unshift(
          createAuditRecord({
            actorUserId,
            action: 'system.autoRepair',
            entityType: 'system',
            entityId: 'consistency',
            summary: `Auto-repaired ${report.violations.length} invariant violation(s) by recomputation in production.`,
            summaryAr: `تم الإصلاح التلقائي لـ ${report.violations.length} تعارض عبر إعادة الحساب.`,
            before: { violationCount: report.violations.length },
            after: { repaired: true },
            automatic: true,
          })
        );
      }
    }

    // Atomic IndexedDB commit
    if (envelope.fullReplace) {
      await storage.writeSnapshot(envelope.nextDb);
    } else {
      const delta =
        envelope.delta ?? computeDeltaBetweenSnapshots(beforeDb, envelope.nextDb);
      await storage.commitDelta(delta, envelope.nextDb);
    }

    // Broadcast realtime events ONLY AFTER commit has resolved
    for (const b of envelope.broadcasts) {
      realtime.publish(b.event, b.payload);
    }

    return envelope.result;
  });
}

// ============================================================================
// PUBLIC COMMAND API
// ============================================================================

export interface FinishMatchResult {
  status: 'finished' | 'needsTieBreak' | 'tie_breaker_opened';
  match: Match;
  /** Compatibility alias of match */
  game: Match;
  tiedPlayerIds?: string[];
  winnerId?: string;
  winners?: string[];
  advancedTo?: Array<{
    playerId: string;
    targetGameId: string;
    targetTableName: string;
    targetTableNameAr: string;
    seatIndex: number;
    isFinal: boolean;
  }>;
}

export const commands = {
  // --------------------------------------------------------------------------
  // SCORING & CARDS (AGENTS.md §15.2 & §15.4)
  // --------------------------------------------------------------------------

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
    if (input.delta !== 1 && input.delta !== -1) {
      throw new CommandValidationError(
        'Point delta must be +1 or −1. Use applyCard for Yellow (−1) or Red (−2) cards.'
      );
    }

    return commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);

      const isPostFinishAdjustment = match.status === 'finished' || match.status === 'needsReview';
      assertRepoPermission(
        db,
        input.byUserId,
        isPostFinishAdjustment ? 'score.manageHistory' : 'score.operate',
        { match }
      );

      if (!match.participants.some((p) => p.playerId === input.playerId)) {
        throw new CommandValidationError(
          `Player "${input.playerId}" is not a participant in match "${match.tableName}".`
        );
      }

      const event: ScoreEvent = {
        id: nextId('score'),
        matchId: match.id,
        gameId: match.id,
        segmentId: input.segmentId,
        playerId: input.playerId,
        delta: input.delta,
        note: input.note?.trim() || undefined,
        kind: 'point',
        byUserId: input.byUserId,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      db.scoreEvents.unshift(event);
      const updatedMatch: Match = { ...match, version: match.version + 1 };
      db.matches[mIdx] = updatedMatch;

      // O(1) fast path for actively LIVE matches: a live +1/−1 point cannot alter any
      // finished winner, group standing, qualifier, BYE, or knockout slot.
      // Dev/test still run checkInvariants() to guarantee 100% parity with propagateWinners().
      const isLiveFastPath = match.status === 'live';
      let cascadeAuditEntries: AuditEntry[] = [];
      let cascadeBroadcasts: RealtimeBroadcast[] = [];
      let updatedPlayer: Player | undefined;

      if (isLiveFastPath) {
        if (!match.isDemo) {
          const pIdx = db.players.findIndex((p) => p.id === input.playerId);
          if (pIdx !== -1 && !db.players[pIdx].isGuest && !db.players[pIdx].isHost) {
            const prevP = db.players[pIdx];
            updatedPlayer = {
              ...prevP,
              stats: {
                ...prevP.stats,
                totalPoints: prevP.stats.totalPoints + input.delta,
              },
            };
            db.players[pIdx] = updatedPlayer;
          }
        }
      } else {
        const propagated = applyPropagationAndCascade(
          beforeDb,
          db,
          input.byUserId,
          {
            confirmCascade: input.confirmCascade,
            cascadePolicy: input.cascadePolicy,
            isDemo: match.isDemo,
          }
        );
        cascadeAuditEntries = propagated.cascadeAuditEntries;
        cascadeBroadcasts = propagated.cascadeBroadcasts;
      }

      const player = updatedPlayer ?? db.players.find((p) => p.id === input.playerId);
      const signStr = input.delta > 0 ? `+${input.delta}` : `${input.delta}`;

      let actorAudit: AuditEntry | undefined;
      if (!match.isDemo) {
        actorAudit = createAuditRecord({
          actorUserId: input.byUserId,
          action: 'score.add',
          entityType: 'score',
          entityId: event.id,
          summary: `Applied ${signStr} pt to ${player?.fullName ?? input.playerId}${event.note ? ` (${event.note})` : ''}`,
          summaryAr: `تم احتساب ${signStr} نقطة للاعب ${player?.fullNameAr ?? input.playerId}${event.note ? ` (${event.note})` : ''}`,
          before: null,
          after: {
            matchId: match.id,
            playerId: input.playerId,
            delta: input.delta,
            kind: 'point',
          },
        });
        db.auditEntries.unshift(...cascadeAuditEntries, actorAudit);
      }

      if (input.delta >= 0) {
        feedback.play('score.positive');
        feedback.haptic('medium');
      } else {
        feedback.play('score.negative');
        feedback.haptic('warning');
      }

      return {
        result: event,
        nextDb: db,
        delta: isLiveFastPath
          ? {
              putMatches: [updatedMatch],
              putPlayers: updatedPlayer ? [updatedPlayer] : undefined,
              putScoreEvents: [event],
              putAuditEntries: actorAudit ? [actorAudit] : undefined,
            }
          : undefined,
        skipInvariants: isLiveFastPath && isProductionEnv(),
        broadcasts: [
          {
            event: 'score.changed',
            payload: {
              gameId: match.id,
              matchId: match.id,
              playerId: input.playerId,
              delta: input.delta,
              kind: 'point',
              scoreEventId: event.id,
            },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
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
    const delta = input.card === 'yellow' ? -1 : -2;
    const labelEn = input.card === 'yellow' ? 'Yellow card (−1)' : 'Red card (−2)';
    const labelAr = input.card === 'yellow' ? 'بطاقة صفراء (−١)' : 'بطاقة حمراء (−٢)';

    return commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);

      const isPostFinish = match.status === 'finished' || match.status === 'needsReview';
      assertRepoPermission(
        db,
        input.byUserId,
        isPostFinish ? 'score.manageHistory' : 'score.operate',
        { match }
      );

      if (!match.participants.some((p) => p.playerId === input.playerId)) {
        throw new CommandValidationError(
          `Player "${input.playerId}" is not a participant in match "${match.tableName}".`
        );
      }

      const trimmedNote = input.note?.trim();
      const noteText = trimmedNote ? `${labelEn}: ${trimmedNote}` : labelEn;

      const event: ScoreEvent = {
        id: nextId('score'),
        matchId: match.id,
        gameId: match.id,
        segmentId: input.segmentId,
        playerId: input.playerId,
        delta,
        note: noteText,
        kind: input.card,
        byUserId: input.byUserId,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      db.scoreEvents.unshift(event);
      const updatedMatch: Match = { ...match, version: match.version + 1 };
      db.matches[mIdx] = updatedMatch;

      const isLiveFastPath = match.status === 'live';
      let cascadeAuditEntries: AuditEntry[] = [];
      let cascadeBroadcasts: RealtimeBroadcast[] = [];
      let updatedPlayer: Player | undefined;

      if (isLiveFastPath) {
        if (!match.isDemo) {
          const pIdx = db.players.findIndex((p) => p.id === input.playerId);
          if (pIdx !== -1 && !db.players[pIdx].isGuest && !db.players[pIdx].isHost) {
            const prevP = db.players[pIdx];
            updatedPlayer = {
              ...prevP,
              stats: {
                ...prevP.stats,
                totalPoints: prevP.stats.totalPoints + delta,
                yellowCards: prevP.stats.yellowCards + (input.card === 'yellow' ? 1 : 0),
                redCards: prevP.stats.redCards + (input.card === 'red' ? 1 : 0),
              },
            };
            db.players[pIdx] = updatedPlayer;
          }
        }
      } else {
        const propagated = applyPropagationAndCascade(
          beforeDb,
          db,
          input.byUserId,
          {
            confirmCascade: input.confirmCascade,
            cascadePolicy: input.cascadePolicy,
            isDemo: match.isDemo,
          }
        );
        cascadeAuditEntries = propagated.cascadeAuditEntries;
        cascadeBroadcasts = propagated.cascadeBroadcasts;
      }

      const player = updatedPlayer ?? db.players.find((p) => p.id === input.playerId);
      let actorAudit: AuditEntry | undefined;
      if (!match.isDemo) {
        actorAudit = createAuditRecord({
          actorUserId: input.byUserId,
          action: input.card === 'yellow' ? 'score.yellowCard' : 'score.redCard',
          entityType: 'score',
          entityId: event.id,
          summary: `${labelEn} issued to ${player?.fullName ?? input.playerId}${trimmedNote ? ` (${trimmedNote})` : ''}`,
          summaryAr: `${labelAr} للاعب ${player?.fullNameAr ?? input.playerId}${trimmedNote ? ` (${trimmedNote})` : ''}`,
          before: null,
          after: {
            matchId: match.id,
            playerId: input.playerId,
            delta,
            kind: input.card,
          },
        });
        db.auditEntries.unshift(...cascadeAuditEntries, actorAudit);
      }

      feedback.play('score.negative');
      feedback.haptic('warning');

      return {
        result: event,
        nextDb: db,
        delta: isLiveFastPath
          ? {
              putMatches: [updatedMatch],
              putPlayers: updatedPlayer ? [updatedPlayer] : undefined,
              putScoreEvents: [event],
              putAuditEntries: actorAudit ? [actorAudit] : undefined,
            }
          : undefined,
        skipInvariants: isLiveFastPath && isProductionEnv(),
        broadcasts: [
          {
            event: 'score.changed',
            payload: {
              gameId: match.id,
              matchId: match.id,
              playerId: input.playerId,
              delta,
              kind: input.card,
              scoreEventId: event.id,
            },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  async undoLastScore(input: {
    matchId: string;
    byUserId: string;
    onlyOwn?: boolean;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<ScoreEvent | null> {
    const db = await storage.readSnapshot();
    const match = db.matches.find((m) => m.id === input.matchId);
    if (!match) return null;
    const actor = assertRepoPermission(db, input.byUserId, 'score.operate', { match });

    const enforceOwn = input.onlyOwn || actor?.role === 'scorer';
    const epoch = match.replayEpoch ?? 0;
    const target = db.scoreEvents.find(
      (e) =>
        e.matchId === input.matchId &&
        (e.replayEpoch ?? 0) === epoch &&
        e.kind !== 'undo' &&
        !e.undoneByEventId &&
        (!enforceOwn || e.byUserId === input.byUserId)
    );
    if (!target) return null;

    return this.revertEvent({
      matchId: input.matchId,
      targetEventId: target.id,
      byUserId: input.byUserId,
      confirmCascade: input.confirmCascade,
      cascadePolicy: input.cascadePolicy,
      expectedVersion: input.expectedVersion,
    });
  },

  async revertEvent(input: {
    matchId: string;
    targetEventId: string;
    byUserId: string;
    reason?: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<ScoreEvent | null> {
    return commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);

      const targetIdx = db.scoreEvents.findIndex(
        (e) =>
          e.id === input.targetEventId &&
          e.matchId === input.matchId &&
          e.kind !== 'undo' &&
          !e.undoneByEventId
      );
      if (targetIdx === -1) {
        return { result: null, nextDb: db, broadcasts: [] };
      }

      const target = db.scoreEvents[targetIdx];
      const isOwnScorerUndo =
        target.byUserId === input.byUserId &&
        (match.status === 'live' || match.status === 'needsTieBreak');
      assertRepoPermission(
        db,
        input.byUserId,
        isOwnScorerUndo ? 'score.operate' : 'score.manageHistory',
        { match }
      );

      const kindLabel =
        target.kind === 'yellow'
          ? 'Yellow card (−1)'
          : target.kind === 'red'
            ? 'Red card (−2)'
            : target.delta > 0
              ? `+${target.delta}`
              : `${target.delta}`;

      const undoEvent: ScoreEvent = {
        id: nextId('score'),
        matchId: match.id,
        gameId: match.id,
        segmentId: target.segmentId,
        playerId: target.playerId,
        delta: -target.delta,
        note: input.reason
          ? `Revert ${kindLabel}: ${input.reason}`
          : `Undo (${kindLabel})`,
        kind: 'undo',
        byUserId: input.byUserId,
        targetEventId: target.id,
        replayEpoch: target.replayEpoch ?? match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      const updatedTarget: ScoreEvent = {
        ...target,
        undoneByEventId: undoEvent.id,
      };
      db.scoreEvents[targetIdx] = updatedTarget;
      db.scoreEvents.unshift(undoEvent);
      const updatedMatch: Match = { ...match, version: match.version + 1 };
      db.matches[mIdx] = updatedMatch;

      // O(1) fast path when undoing an event on a currently LIVE match
      const isLiveFastPath = match.status === 'live';
      let cascadeAuditEntries: AuditEntry[] = [];
      let cascadeBroadcasts: RealtimeBroadcast[] = [];
      let updatedPlayer: Player | undefined;

      if (isLiveFastPath) {
        const sameEpoch = (target.replayEpoch ?? 0) === (match.replayEpoch ?? 0);
        if (!match.isDemo && sameEpoch) {
          const pIdx = db.players.findIndex((p) => p.id === target.playerId);
          if (pIdx !== -1 && !db.players[pIdx].isGuest && !db.players[pIdx].isHost) {
            const prevP = db.players[pIdx];
            updatedPlayer = {
              ...prevP,
              stats: {
                ...prevP.stats,
                totalPoints: prevP.stats.totalPoints + undoEvent.delta,
                yellowCards: Math.max(
                  0,
                  prevP.stats.yellowCards - (target.kind === 'yellow' ? 1 : 0)
                ),
                redCards: Math.max(
                  0,
                  prevP.stats.redCards - (target.kind === 'red' ? 1 : 0)
                ),
              },
            };
            db.players[pIdx] = updatedPlayer;
          }
        }
      } else {
        const propagated = applyPropagationAndCascade(
          beforeDb,
          db,
          input.byUserId,
          {
            confirmCascade: input.confirmCascade,
            cascadePolicy: input.cascadePolicy,
            isDemo: match.isDemo,
          }
        );
        cascadeAuditEntries = propagated.cascadeAuditEntries;
        cascadeBroadcasts = propagated.cascadeBroadcasts;
      }

      const player = updatedPlayer ?? db.players.find((p) => p.id === target.playerId);
      let actorAudit: AuditEntry | undefined;
      if (!match.isDemo) {
        actorAudit = createAuditRecord({
          actorUserId: input.byUserId,
          action: 'score.undo',
          entityType: 'score',
          entityId: undoEvent.id,
          summary: `Reverted ${kindLabel} for ${player?.fullName ?? target.playerId} in "${match.tableName}"${input.reason ? ` (${input.reason})` : ''}`,
          summaryAr: `تم عكس (${kindLabel}) للاعب ${player?.fullNameAr ?? target.playerId} في "${match.tableNameAr || match.tableName}"`,
          before: { targetEventId: target.id, delta: target.delta, kind: target.kind },
          after: { undoEventId: undoEvent.id, delta: undoEvent.delta },
        });
        db.auditEntries.unshift(...cascadeAuditEntries, actorAudit);
      }

      feedback.play('score.undo');
      feedback.haptic('light');

      return {
        result: undoEvent,
        nextDb: db,
        delta: isLiveFastPath
          ? {
              putMatches: [updatedMatch],
              putPlayers: updatedPlayer ? [updatedPlayer] : undefined,
              putScoreEvents: [updatedTarget, undoEvent],
              putAuditEntries: actorAudit ? [actorAudit] : undefined,
            }
          : undefined,
        skipInvariants: isLiveFastPath && isProductionEnv(),
        broadcasts: [
          {
            event: 'score.changed',
            payload: {
              gameId: match.id,
              matchId: match.id,
              playerId: target.playerId,
              delta: undoEvent.delta,
              kind: 'undo',
              scoreEventId: undoEvent.id,
              isUndo: true,
            },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  /**
   * Append-only score edit (AGENTS.md §15.4 Reversibility: never deletes or mutates past events).
   * Appends a compensating undo event for the original event AND appends the corrected event!
   */
  async editScoreEvent(input: {
    eventId: string;
    delta: number;
    kind?: 'point' | 'yellow' | 'red';
    note?: string;
    segmentId?: string;
    byUserId: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<ScoreEvent | null> {
    const resolvedKind =
      input.kind ?? (input.delta === -2 ? 'red' : 'point');
    const resolvedDelta =
      resolvedKind === 'yellow'
        ? -1
        : resolvedKind === 'red'
          ? -2
          : input.delta;

    if (
      resolvedKind === 'point' &&
      resolvedDelta !== 1 &&
      resolvedDelta !== -1
    ) {
      throw new CommandValidationError(
        'Edited score must be +1, −1, Yellow card (−1), or Red card (−2).'
      );
    }

    return commitCommand(input.byUserId, (beforeDb, db) => {
      const targetIdx = db.scoreEvents.findIndex((e) => e.id === input.eventId);
      if (targetIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const target = db.scoreEvents[targetIdx];
      if (target.kind === 'undo' || target.undoneByEventId) {
        throw new CommandValidationError('Cannot edit an already reverted or undo event.');
      }

      const mIdx = db.matches.findIndex((m) => m.id === target.matchId);
      if (mIdx === -1) throw new CommandValidationError('Match not found.');
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.byUserId, 'score.manageHistory', { match });

      // 1. Append compensating undo for original event
      const undoEvent: ScoreEvent = {
        id: nextId('score'),
        matchId: match.id,
        gameId: match.id,
        segmentId: target.segmentId,
        playerId: target.playerId,
        delta: -target.delta,
        note: `Replaced by admin edit`,
        kind: 'undo',
        byUserId: input.byUserId,
        targetEventId: target.id,
        replayEpoch: target.replayEpoch ?? match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };
      db.scoreEvents[targetIdx] = { ...target, undoneByEventId: undoEvent.id };

      // 2. Append replacement event (strictly +1, -1, yellow, or red)
      const finalKind: 'point' | 'yellow' | 'red' =
        input.kind ??
        (target.kind === 'yellow' && resolvedDelta === -1
          ? 'yellow'
          : target.kind === 'red' && resolvedDelta === -2
            ? 'red'
            : resolvedDelta === -2
              ? 'red'
              : 'point');

      const trimmedNote = input.note?.trim();
      const formattedNote =
        finalKind === 'yellow'
          ? trimmedNote
            ? trimmedNote.startsWith('Yellow card')
              ? trimmedNote
              : `Yellow card (−1): ${trimmedNote}`
            : 'Yellow card (−1)'
          : finalKind === 'red'
            ? trimmedNote
              ? trimmedNote.startsWith('Red card')
                ? trimmedNote
                : `Red card (−2): ${trimmedNote}`
              : 'Red card (−2)'
            : trimmedNote || undefined;

      const replacement: ScoreEvent = {
        id: nextId('score'),
        matchId: match.id,
        gameId: match.id,
        segmentId: input.segmentId ?? target.segmentId,
        playerId: target.playerId,
        delta: resolvedDelta,
        note: formattedNote,
        kind: finalKind,
        byUserId: input.byUserId,
        replayEpoch: target.replayEpoch ?? match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      db.scoreEvents.unshift(replacement, undoEvent);
      db.matches[mIdx] = { ...match, version: match.version + 1 };

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.byUserId,
        {
          confirmCascade: input.confirmCascade,
          cascadePolicy: input.cascadePolicy,
          isDemo: match.isDemo,
        }
      );

      const player = db.players.find((p) => p.id === target.playerId);
      const repLabel =
        finalKind === 'yellow'
          ? 'Yellow card (−1)'
          : finalKind === 'red'
            ? 'Red card (−2)'
            : resolvedDelta > 0
              ? `+${resolvedDelta}`
              : `${resolvedDelta}`;

      if (!match.isDemo) {
        db.auditEntries.unshift(
          ...cascadeAuditEntries,
          createAuditRecord({
            actorUserId: input.byUserId,
            action: 'score.edit',
            entityType: 'score',
            entityId: replacement.id,
            summary: `Edited score for ${player?.fullName ?? target.playerId}: ${target.delta} → ${repLabel} (via compensating revert + new event)`,
            summaryAr: `تعديل نقاط ${player?.fullNameAr ?? target.playerId}: ${target.delta} ← ${repLabel}`,
            before: { eventId: target.id, delta: target.delta, kind: target.kind, note: target.note ?? null },
            after: { eventId: replacement.id, delta: replacement.delta, kind: replacement.kind, note: replacement.note ?? null },
          })
        );
      }

      return {
        result: replacement,
        nextDb: db,
        broadcasts: [
          {
            event: 'score.changed',
            payload: {
              gameId: match.id,
              matchId: match.id,
              playerId: target.playerId,
              delta: resolvedDelta - target.delta,
              kind: finalKind,
              scoreEventId: replacement.id,
              isEdit: true,
            },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  // --------------------------------------------------------------------------
  // ABSENCE & WALKOVER (AGENTS.md §15.2)
  // --------------------------------------------------------------------------

  async markAbsent(input: {
    matchId: string;
    playerId: string;
    byUserId: string;
    reason?: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<{ match: Match; absenceEvent: AbsenceEvent; requiresAdminDecision: boolean }> {
    return commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.byUserId, 'match.operate', { match });

      const participant = match.participants.find((p) => p.playerId === input.playerId);
      if (!participant) {
        throw new CommandValidationError(`Player "${input.playerId}" is not in this match.`);
      }
      if (participant.guest) {
        throw new CommandValidationError('Guest host Marwan Serry cannot be marked absent.');
      }
      if (computeMatchAbsences(match, db.absenceEvents).has(input.playerId)) {
        throw new CommandValidationError('Player is already marked absent in this match.');
      }

      const absenceEvent: AbsenceEvent = {
        id: nextId('abs'),
        matchId: match.id,
        playerId: input.playerId,
        action: 'marked',
        reason: input.reason?.trim() || 'Marked absent by judge',
        byUserId: input.byUserId,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      db.absenceEvents.unshift(absenceEvent);
      db.matches[mIdx] = { ...match, version: match.version + 1 };

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.byUserId,
        {
          confirmCascade: input.confirmCascade,
          cascadePolicy: input.cascadePolicy,
          isDemo: match.isDemo,
        }
      );

      const updatedMatch = db.matches.find((m) => m.id === match.id)!;
      const outcome = computeMatchResult(
        updatedMatch,
        db.scoreEvents,
        db.absenceEvents,
        db.matchEvents,
        db.buzzEvents
      );
      const player = db.players.find((p) => p.id === input.playerId);

      if (!match.isDemo) {
        db.auditEntries.unshift(
          ...cascadeAuditEntries,
          createAuditRecord({
            actorUserId: input.byUserId,
            action: 'match.markAbsent',
            entityType: 'absence',
            entityId: match.id,
            summary: `Marked ${player?.fullName ?? input.playerId} absent in "${match.tableName}" → status: ${updatedMatch.status}${updatedMatch.result?.winnerId ? ` (walkover winner: ${updatedMatch.result.winnerId})` : ''}`,
            summaryAr: `تم تسجيل غياب ${player?.fullNameAr ?? input.playerId} في "${match.tableNameAr || match.tableName}" ← الحالة: ${updatedMatch.status}`,
            before: { status: match.status },
            after: {
              status: updatedMatch.status,
              result: updatedMatch.result,
              playerId: input.playerId,
            },
          })
        );
      }

      return {
        result: {
          match: updatedMatch,
          absenceEvent,
          requiresAdminDecision: outcome.requiresAdminDecision,
        },
        nextDb: db,
        broadcasts: [
          {
            event: 'absence.recorded',
            payload: {
              matchId: match.id,
              gameId: match.id,
              playerId: input.playerId,
              action: 'marked',
            },
          },
          ...(updatedMatch.status === 'finished'
            ? [
                {
                  event: 'game.finished' as RealtimeEventName,
                  payload: {
                    gameId: match.id,
                    matchId: match.id,
                    winnerPlayerId: updatedMatch.result?.winnerId,
                  },
                },
                {
                  event: 'match.finished' as RealtimeEventName,
                  payload: {
                    matchId: match.id,
                    gameId: match.id,
                    winnerId: updatedMatch.result?.winnerId,
                  },
                },
              ]
            : []),
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  async reverseAbsence(input: {
    matchId: string;
    playerId: string;
    byUserId: string;
    reason?: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<{ match: Match; absenceEvent: AbsenceEvent }> {
    return commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.byUserId, 'absence.reverse', { match });

      if (!computeMatchAbsences(match, db.absenceEvents).has(input.playerId)) {
        throw new CommandValidationError('Player is not currently marked absent in this match.');
      }

      const absenceEvent: AbsenceEvent = {
        id: nextId('abs'),
        matchId: match.id,
        playerId: input.playerId,
        action: 'reversed',
        reason: input.reason?.trim() || 'Absence reversed by Super Admin',
        byUserId: input.byUserId,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      db.absenceEvents.unshift(absenceEvent);
      db.matches[mIdx] = { ...match, version: match.version + 1 };

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.byUserId,
        {
          confirmCascade: input.confirmCascade,
          cascadePolicy: input.cascadePolicy,
          isDemo: match.isDemo,
        }
      );

      const updatedMatch = db.matches.find((m) => m.id === match.id)!;
      const player = db.players.find((p) => p.id === input.playerId);

      if (!match.isDemo) {
        db.auditEntries.unshift(
          ...cascadeAuditEntries,
          createAuditRecord({
            actorUserId: input.byUserId,
            action: 'match.reverseAbsence',
            entityType: 'absence',
            entityId: match.id,
            summary: `Reversed absence of ${player?.fullName ?? input.playerId} in "${match.tableName}" → status: ${updatedMatch.status}`,
            summaryAr: `تم إلغاء غياب ${player?.fullNameAr ?? input.playerId} في "${match.tableNameAr || match.tableName}" ← الحالة: ${updatedMatch.status}`,
            before: { status: match.status, result: match.result },
            after: { status: updatedMatch.status, result: updatedMatch.result },
          })
        );
      }

      return {
        result: { match: updatedMatch, absenceEvent },
        nextDb: db,
        broadcasts: [
          {
            event: 'absence.recorded',
            payload: {
              matchId: match.id,
              gameId: match.id,
              playerId: input.playerId,
              action: 'reversed',
            },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  // --------------------------------------------------------------------------
  // BUZZ & TIMER & SEGMENTS
  // --------------------------------------------------------------------------

  async recordBuzz(input: {
    matchId: string;
    segmentId: string;
    playerId: string;
    byUserId: string;
    expectedVersion?: number;
  }): Promise<BuzzEvent> {
    return commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.byUserId, 'score.operate', { match });

      const buzz: BuzzEvent = {
        id: nextId('buzz'),
        matchId: match.id,
        gameId: match.id,
        segmentId: input.segmentId,
        playerId: input.playerId,
        byUserId: input.byUserId,
        cleared: false,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };

      db.buzzEvents.unshift(buzz);
      const isLiveFastPath = match.status === 'live' || match.status === 'needsTieBreak';
      const updatedMatch: Match = isLiveFastPath
        ? { ...match, activeBuzzPlayerId: input.playerId, version: match.version + 1 }
        : { ...match, version: match.version + 1 };
      db.matches[mIdx] = updatedMatch;

      if (!isLiveFastPath) {
        applyPropagationAndCascade(beforeDb, db, input.byUserId, {
          confirmCascade: true,
          isDemo: match.isDemo,
        });
      }

      const player = db.players.find((p) => p.id === input.playerId);
      let actorAudit: AuditEntry | undefined;
      if (!match.isDemo) {
        actorAudit = createAuditRecord({
          actorUserId: input.byUserId,
          action: 'buzz.record',
          entityType: 'buzz',
          entityId: buzz.id,
          summary: `${player?.fullName ?? input.playerId} buzzed first`,
          summaryAr: `${player?.fullNameAr ?? input.playerId} ضغط الجرس أولاً`,
          before: null,
          after: { matchId: match.id, playerId: input.playerId, segmentId: input.segmentId },
        });
        db.auditEntries.unshift(actorAudit);
      }

      feedback.play('buzz');
      feedback.haptic('buzz');

      return {
        result: buzz,
        nextDb: db,
        delta: isLiveFastPath
          ? {
              putMatches: [updatedMatch],
              putBuzzEvents: [buzz],
              putAuditEntries: actorAudit ? [actorAudit] : undefined,
            }
          : undefined,
        skipInvariants: isLiveFastPath && isProductionEnv(),
        broadcasts: [
          {
            event: 'buzz.recorded',
            payload: {
              gameId: match.id,
              matchId: match.id,
              playerId: input.playerId,
              segmentId: input.segmentId,
              buzzId: buzz.id,
            },
          },
        ],
      };
    });
  },

  async clearBuzz(input: {
    matchId: string;
    byUserId: string;
    expectedVersion?: number;
  }): Promise<void> {
    await commitCommand(input.byUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: undefined, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.byUserId, 'score.operate', { match });

      const prevPlayerId = match.activeBuzzPlayerId ?? null;
      const segId = match.segmentIds[match.currentSegmentIndex] ?? match.segmentIds[0];
      const clearEvent: BuzzEvent = {
        id: nextId('buzz'),
        matchId: match.id,
        gameId: match.id,
        segmentId: segId,
        playerId: prevPlayerId ?? match.participants[0]?.playerId ?? 'player-1',
        byUserId: input.byUserId,
        cleared: true,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };
      db.buzzEvents.unshift(clearEvent);
      const isLiveFastPath = match.status === 'live' || match.status === 'needsTieBreak';
      const updatedMatch: Match = isLiveFastPath
        ? { ...match, activeBuzzPlayerId: null, version: match.version + 1 }
        : { ...match, version: match.version + 1 };
      db.matches[mIdx] = updatedMatch;

      if (!isLiveFastPath) {
        applyPropagationAndCascade(beforeDb, db, input.byUserId, {
          confirmCascade: true,
          isDemo: match.isDemo,
        });
      }

      let actorAudit: AuditEntry | undefined;
      if (!match.isDemo) {
        actorAudit = createAuditRecord({
          actorUserId: input.byUserId,
          action: 'buzz.clear',
          entityType: 'buzz',
          entityId: match.id,
          summary: `Cleared active buzzer highlight on "${match.tableName}"`,
          summaryAr: `تم مسح إشارة الجرس في "${match.tableNameAr || match.tableName}"`,
          before: { activeBuzzPlayerId: prevPlayerId },
          after: { activeBuzzPlayerId: null },
        });
        db.auditEntries.unshift(actorAudit);
      }

      return {
        result: undefined,
        nextDb: db,
        delta: isLiveFastPath
          ? {
              putMatches: [updatedMatch],
              putBuzzEvents: [clearEvent],
              putAuditEntries: actorAudit ? [actorAudit] : undefined,
            }
          : undefined,
        skipInvariants: isLiveFastPath && isProductionEnv(),
        broadcasts: [
          { event: 'buzz.cleared', payload: { gameId: match.id, matchId: match.id } },
        ],
      };
    });
  },

  async updateTimer(input: {
    matchId: string;
    timer: MatchTimerState;
    actorUserId?: string;
  }): Promise<Match | null> {
    return commitCommand(input.actorUserId ?? 'user-scorer-1', (_beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertRepoPermission(db, input.actorUserId, 'match.operate', { match });

      const updated: Match = {
        ...match,
        timer: input.timer,
      };
      db.matches[mIdx] = updated;

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          {
            event: 'timer.updated',
            payload: { gameId: match.id, matchId: match.id, timer: input.timer },
          },
        ],
      };
    });
  },

  async changeSegment(input: {
    matchId: string;
    nextIndex: number;
    actorUserId: string;
    expectedVersion?: number;
  }): Promise<Match | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.operate', { match });

      const clampedIndex = Math.max(
        0,
        Math.min(input.nextIndex, match.segmentIds.length - 1)
      );
      const segId = match.segmentIds[clampedIndex];
      const seg = db.segments.find((s) => s.id === segId);
      const dur = seg?.durationSec ?? 60;

      db.matchEvents.unshift({
        id: nextId('me'),
        matchId: match.id,
        type: 'segmentChanged',
        byUserId: input.actorUserId,
        payload: { fromIndex: match.currentSegmentIndex, toIndex: clampedIndex, segmentId: segId },
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      });

      db.matches[mIdx] = {
        ...match,
        currentSegmentIndex: clampedIndex,
        timer: { status: 'idle', durationSec: dur, remainingSec: dur, endsAt: null },
        version: match.version + 1,
      };

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
        isDemo: match.isDemo,
      });

      const updated = db.matches.find((m) => m.id === match.id)!;
      if (!match.isDemo) {
        db.auditEntries.unshift(
          createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'segment.change',
            entityType: 'match',
            entityId: match.id,
            summary: `Moved "${match.tableName}" to segment #${clampedIndex + 1} (${seg?.nameEn ?? segId})`,
            summaryAr: `انتقال "${match.tableNameAr || match.tableName}" إلى الفقرة #${clampedIndex + 1}`,
            before: { currentSegmentIndex: match.currentSegmentIndex },
            after: { currentSegmentIndex: clampedIndex, segmentId: segId },
          })
        );
      }

      feedback.play('segment.next');

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          {
            event: 'segment.changed',
            payload: {
              gameId: match.id,
              matchId: match.id,
              currentSegmentIndex: clampedIndex,
              segmentId: segId,
            },
          },
        ],
      };
    });
  },

  // --------------------------------------------------------------------------
  // MATCH LIFECYCLE: START, TIE-BREAKER, FINISH, REOPEN, OVERRIDE, REVIEW
  // --------------------------------------------------------------------------

  async startMatch(input: {
    matchId: string;
    actorUserId: string;
    expectedVersion?: number;
  }): Promise<Match | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.operate', { match });

      // Ensure all non-bye participants are resolved real players
      const playerIdSet = new Set(db.players.map((p) => p.id));
      const unresolved = match.participants.filter(
        (p) => !p.isBye && (!p.playerId || !playerIdSet.has(p.playerId))
      );
      if (unresolved.length > 0) {
        throw new CommandValidationError(
          `Cannot start "${match.tableName}" while ${unresolved.length} seat(s) are still TBD.`
        );
      }

      // Guard invariant: no player may be in 2 live matches simultaneously!
      if (!match.isDemo) {
        const myPids = new Set(
          match.participants
            .map((p) => p.playerId)
            .filter((id): id is string => Boolean(id))
        );
        const conflicting = db.matches.find(
          (other) =>
            !other.isDemo &&
            other.id !== match.id &&
            (other.status === 'live' || other.status === 'needsTieBreak') &&
            other.participants.some((p) => p.playerId && myPids.has(p.playerId))
        );
        if (conflicting) {
          throw new CommandValidationError(
            `Cannot start "${match.tableName}" because a participant is already playing live in "${conflicting.tableName}".`
          );
        }
      }

      const firstSegId =
        match.segmentIds[match.currentSegmentIndex] ?? match.segmentIds[0];
      const firstSeg = db.segments.find((s) => s.id === firstSegId);
      const dur = firstSeg?.durationSec ?? 60;

      db.matchEvents.unshift({
        id: nextId('me'),
        matchId: match.id,
        type: 'started',
        byUserId: input.actorUserId,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      });

      db.matches[mIdx] = {
        ...match,
        timer: { status: 'idle', durationSec: dur, remainingSec: dur, endsAt: null },
        version: match.version + 1,
      };

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.actorUserId,
        { confirmCascade: true, isDemo: match.isDemo }
      );

      const updated = db.matches.find((m) => m.id === match.id)!;
      if (!match.isDemo) {
        db.auditEntries.unshift(
          ...cascadeAuditEntries,
          createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'match.start',
            entityType: 'match',
            entityId: match.id,
            summary: `Started live match "${updated.tableName}"`,
            summaryAr: `بدء المباراة المباشرة "${updated.tableNameAr || updated.tableName}"`,
            before: { status: match.status },
            after: { status: updated.status, startedAt: updated.startedAt },
          })
        );
      }

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          { event: 'game.started', payload: { gameId: match.id, matchId: match.id } },
          { event: 'match.started', payload: { matchId: match.id, gameId: match.id } },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  async openTieBreaker(input: {
    matchId: string;
    actorUserId: string;
    expectedVersion?: number;
  }): Promise<Match | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.operate', { match });

      const tieBreakerSegId = 'seg-16';
      const nextSegIds = [...match.segmentIds, tieBreakerSegId];
      const newIndex = nextSegIds.length - 1;
      const seg = db.segments.find((s) => s.id === tieBreakerSegId);
      const dur = seg?.durationSec ?? 30;

      db.matchEvents.unshift({
        id: nextId('me'),
        matchId: match.id,
        type: 'tieBreakerOpened',
        byUserId: input.actorUserId,
        payload: { segmentId: tieBreakerSegId, currentSegmentIndex: newIndex },
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      });

      db.matches[mIdx] = {
        ...match,
        segmentIds: nextSegIds,
        currentSegmentIndex: newIndex,
        timer: { status: 'idle', durationSec: dur, remainingSec: dur, endsAt: null },
        version: match.version + 1,
      };

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
        isDemo: match.isDemo,
      });

      const updated = db.matches.find((m) => m.id === match.id)!;
      if (!match.isDemo) {
        db.auditEntries.unshift(
          createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'match.tiebreaker',
            entityType: 'match',
            entityId: match.id,
            summary: `Opened Sudden-Death Tie-Breaker segment in "${updated.tableName}"`,
            summaryAr: `تم فتح جولة الحسم الفاصلة في "${updated.tableNameAr || updated.tableName}"`,
            before: { segmentCount: match.segmentIds.length },
            after: { segmentCount: nextSegIds.length, currentSegmentIndex: newIndex },
          })
        );
      }

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          {
            event: 'segment.changed',
            payload: {
              gameId: match.id,
              matchId: match.id,
              currentSegmentIndex: newIndex,
              segmentId: tieBreakerSegId,
              isTieBreaker: true,
            },
          },
        ],
      };
    });
  },

  async finishMatch(input: {
    matchId: string;
    actorUserId: string;
    autoOpenTieBreaker?: boolean;
    expectedVersion?: number;
  }): Promise<FinishMatchResult | null> {
    return commitCommand<FinishMatchResult | null>(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.operate', { match });

      // Simulate appending a 'finished' lifecycle event through pure computeMatchResult
      const finishEvent: MatchLifecycleEvent = {
        id: nextId('me'),
        matchId: match.id,
        type: 'finished',
        byUserId: input.actorUserId,
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      };
      const simulatedOutcome = computeMatchResult(
        match,
        db.scoreEvents,
        db.absenceEvents,
        [finishEvent, ...db.matchEvents],
        db.buzzEvents
      );

      // Draws are NEVER allowed (AGENTS.md §15.1): if tied, status is needsTieBreak (no winner)
      if (simulatedOutcome.status === 'needsTieBreak') {
        if (input.autoOpenTieBreaker) {
          const tieBreakerSegId = 'seg-16';
          const nextSegIds = [...match.segmentIds, tieBreakerSegId];
          const newIndex = nextSegIds.length - 1;
          const seg = db.segments.find((s) => s.id === tieBreakerSegId);
          const dur = seg?.durationSec ?? 30;

          db.matchEvents.unshift({
            id: nextId('me'),
            matchId: match.id,
            type: 'tieBreakerOpened',
            byUserId: input.actorUserId,
            payload: {
              tiedPlayerIds: simulatedOutcome.tiedPlayerIds,
              segmentId: tieBreakerSegId,
            },
            replayEpoch: match.replayEpoch ?? 0,
            createdAt: nextIsoTimestamp(),
          });
          db.matches[mIdx] = {
            ...match,
            segmentIds: nextSegIds,
            currentSegmentIndex: newIndex,
            timer: { status: 'idle', durationSec: dur, remainingSec: dur, endsAt: null },
            version: match.version + 1,
          };

          applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
            confirmCascade: true,
            isDemo: match.isDemo,
          });
          const updatedTb = db.matches.find((m) => m.id === match.id)!;

          if (!match.isDemo) {
            db.auditEntries.unshift(
              createAuditRecord({
                actorUserId: input.actorUserId,
                action: 'match.tiebreaker',
                entityType: 'match',
                entityId: match.id,
                summary: `Scores tied in "${match.tableName}" — auto-inserted Sudden-Death Tie-Breaker segment.`,
                summaryAr: `تعادل النقاط في "${match.tableNameAr || match.tableName}" — تم فتح جولة الحسم تلقائياً.`,
                before: { tiedPlayerIds: simulatedOutcome.tiedPlayerIds },
                after: { segmentId: tieBreakerSegId, currentSegmentIndex: newIndex },
              })
            );
          }

          feedback.play('segment.next');
          feedback.haptic('warning');

          return {
            result: {
              status: 'tie_breaker_opened',
              match: updatedTb,
              game: updatedTb,
              tiedPlayerIds: simulatedOutcome.tiedPlayerIds,
            },
            nextDb: db,
            broadcasts: [
              {
                event: 'segment.changed',
                payload: {
                  gameId: match.id,
                  matchId: match.id,
                  currentSegmentIndex: newIndex,
                  segmentId: tieBreakerSegId,
                  isTieBreaker: true,
                  tiedPlayerIds: simulatedOutcome.tiedPlayerIds,
                },
              },
            ],
          };
        }

        // Persist finished attempt -> pure engine sets status = 'needsTieBreak' and result = null
        db.matchEvents.unshift(finishEvent);
        db.matches[mIdx] = { ...match, version: match.version + 1 };
        applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
          confirmCascade: true,
          isDemo: match.isDemo,
        });
        const tbMatch = db.matches.find((m) => m.id === match.id)!;

        return {
          result: {
            status: 'needsTieBreak',
            match: tbMatch,
            game: tbMatch,
            tiedPlayerIds: simulatedOutcome.tiedPlayerIds,
          },
          nextDb: db,
          broadcasts: [
            { event: 'bracket.updated', payload: { matchId: match.id, gameId: match.id } },
          ],
        };
      }

      // Clear winner -> append finished event & propagate!
      db.matchEvents.unshift(finishEvent);
      db.matches[mIdx] = {
        ...match,
        timer: match.timer
          ? { ...match.timer, status: 'idle', remainingSec: 0, endsAt: null }
          : undefined,
        version: match.version + 1,
      };

      const { impact, cascadeAuditEntries, cascadeBroadcasts } =
        applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
          confirmCascade: true,
          isDemo: match.isDemo,
        });

      const finishedMatch = db.matches.find((m) => m.id === match.id)!;
      const winnerId = finishedMatch.result?.winnerId;
      const winner = winnerId ? db.players.find((p) => p.id === winnerId) : null;

      const matchGroup = match.groupId
        ? db.groups.find((g) => g.id === match.groupId)
        : undefined;
      const matchGroupPlayerIds = matchGroup ? new Set(matchGroup.playerIds) : null;

      const advancedTo = impact.autoUpdatedMatches.map((chg) => {
        const tm = db.matches.find((m) => m.id === chg.matchId);
        // Derive the actual newly slotted player ID from before -> expected participant diff
        // (e.g. finishing the final group match may qualify the group's #1 player, not this match's winner).
        let slottedPlayerId = '';
        let seatIndex = -1;
        for (let i = 0; i < chg.expectedParticipantIds.length; i++) {
          const nextPid = chg.expectedParticipantIds[i];
          const prevPid = chg.beforeParticipantIds[i] ?? null;
          if (nextPid && nextPid !== prevPid) {
            if (!slottedPlayerId || (matchGroupPlayerIds && matchGroupPlayerIds.has(nextPid))) {
              slottedPlayerId = nextPid;
              seatIndex = i;
              if (!matchGroupPlayerIds || matchGroupPlayerIds.has(nextPid)) break;
            }
          }
        }
        if (!slottedPlayerId && winnerId) {
          slottedPlayerId = winnerId;
          seatIndex = chg.expectedParticipantIds.findIndex((pid) => pid === winnerId);
        }
        return {
          playerId: slottedPlayerId,
          targetGameId: chg.matchId,
          targetTableName: tm?.tableName ?? chg.tableName,
          targetTableNameAr: tm?.tableNameAr ?? chg.tableNameAr,
          seatIndex: Math.max(0, seatIndex),
          isFinal: Boolean(tm?.isFinal),
        };
      });

      if (!match.isDemo) {
        db.auditEntries.unshift(
          ...cascadeAuditEntries,
          createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'match.finish',
            entityType: 'match',
            entityId: match.id,
            summary: `Finished "${finishedMatch.tableName}" — Winner: ${winner?.fullName ?? winnerId ?? 'none'}`,
            summaryAr: `انتهاء "${finishedMatch.tableNameAr || finishedMatch.tableName}" — الفائز: ${winner?.fullNameAr ?? winnerId ?? ''}`,
            before: { status: match.status },
            after: {
              status: finishedMatch.status,
              result: finishedMatch.result,
            },
          })
        );
      }

      feedback.play('game.winner');
      feedback.haptic('winner');

      return {
        result: {
          status: 'finished',
          match: finishedMatch,
          game: finishedMatch,
          winnerId,
          winners: winnerId ? [winnerId] : [],
          advancedTo,
        },
        nextDb: db,
        broadcasts: [
          {
            event: 'game.finished',
            payload: {
              gameId: match.id,
              matchId: match.id,
              winnerPlayerId: winnerId,
              advancingPlayerIds: winnerId ? [winnerId] : [],
            },
          },
          {
            event: 'match.finished',
            payload: { matchId: match.id, gameId: match.id, winnerId },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  async reopenMatch(input: {
    matchId: string;
    actorUserId: string;
    reason?: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<Match | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.reopen', { match });

      // Prevent violating PLAYER_AT_MOST_ONE_LIVE_MATCH when reopening
      let nonDownstreamLiveConflict: Match | undefined;
      if (!match.isDemo) {
        const myPids = new Set(
          match.participants
            .map((p) => p.playerId)
            .filter((id): id is string => Boolean(id))
        );
        const liveConflict = db.matches.find(
          (other) =>
            !other.isDemo &&
            other.id !== match.id &&
            (other.status === 'live' || other.status === 'needsTieBreak') &&
            other.participants.some((p) => p.playerId && myPids.has(p.playerId))
        );
        if (liveConflict) {
          const isPotentiallyDownstream =
            liveConflict.type !== 'group' && liveConflict.round > match.round;
          if (!isPotentiallyDownstream) {
            const conflictPlayer = db.players.find((p) =>
              liveConflict.participants.some((lp) => lp.playerId === p.id && myPids.has(p.id))
            );
            throw new CommandValidationError(
              `Cannot reopen "${match.tableName}": ${conflictPlayer?.fullName ?? 'a participant'} is currently live in "${liveConflict.tableName}". Finish that match first.`
            );
          }
          nonDownstreamLiveConflict = liveConflict;
        }
      }

      const segId = match.segmentIds[match.currentSegmentIndex] ?? match.segmentIds[0];
      const seg = db.segments.find((s) => s.id === segId);
      const dur = seg?.durationSec ?? 45;

      db.matchEvents.unshift({
        id: nextId('me'),
        matchId: match.id,
        type: 'reopened',
        byUserId: input.actorUserId,
        reason: input.reason?.trim() || 'Reopened by Super Admin',
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      });

      db.matches[mIdx] = {
        ...match,
        timer: { status: 'idle', durationSec: dur, remainingSec: dur, endsAt: null },
        version: match.version + 1,
      };

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.actorUserId,
        {
          confirmCascade: input.confirmCascade,
          cascadePolicy: input.cascadePolicy,
          isDemo: match.isDemo,
        }
      );

      const updated = db.matches.find((m) => m.id === match.id)!;
      if (nonDownstreamLiveConflict) {
        const conflictAfter = db.matches.find((m) => m.id === nonDownstreamLiveConflict!.id);
        if (
          conflictAfter &&
          (conflictAfter.status === 'live' || conflictAfter.status === 'needsTieBreak')
        ) {
          throw new CommandValidationError(
            `Cannot reopen "${match.tableName}": a participant is still live in "${conflictAfter.tableName}".`
          );
        }
      }
      if (!match.isDemo) {
        db.auditEntries.unshift(
          ...cascadeAuditEntries,
          createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'match.reopen',
            entityType: 'match',
            entityId: match.id,
            summary: `Reopened "${updated.tableName}" for scoring adjustments`,
            summaryAr: `تمت إعادة فتح "${updated.tableNameAr || updated.tableName}" للتعديل`,
            before: { status: match.status, result: match.result },
            after: { status: updated.status },
          })
        );
      }

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          {
            event: 'game.started',
            payload: { gameId: match.id, matchId: match.id, reopened: true },
          },
          {
            event: 'match.started',
            payload: { matchId: match.id, gameId: match.id, reopened: true },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  async overrideResult(input: {
    matchId: string;
    resultType: MatchResultType;
    winnerId?: string;
    reason: string;
    actorUserId: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    expectedVersion?: number;
  }): Promise<Match> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.override', { match });

      if (input.resultType !== 'void') {
        if (
          !input.winnerId ||
          !match.participants.some((p) => p.playerId === input.winnerId)
        ) {
          throw new CommandValidationError(
            'Override winner must be a participant in this match.'
          );
        }
      }

      db.matchEvents.unshift({
        id: nextId('me'),
        matchId: match.id,
        type: 'overrideResult',
        byUserId: input.actorUserId,
        reason: input.reason.trim() || 'Super Admin decision',
        payload: {
          resultType: input.resultType,
          winnerId: input.resultType === 'void' ? undefined : input.winnerId,
        },
        replayEpoch: match.replayEpoch ?? 0,
        createdAt: nextIsoTimestamp(),
      });
      db.matches[mIdx] = { ...match, version: match.version + 1 };

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.actorUserId,
        {
          confirmCascade: input.confirmCascade,
          cascadePolicy: input.cascadePolicy,
          isDemo: match.isDemo,
        }
      );

      const updated = db.matches.find((m) => m.id === match.id)!;
      db.auditEntries.unshift(
        ...cascadeAuditEntries,
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'match.overrideResult',
          entityType: 'match',
          entityId: match.id,
          summary: `Super Admin overrode "${match.tableName}": ${input.resultType}${input.winnerId ? ` (winner: ${input.winnerId})` : ''} — ${input.reason}`,
          summaryAr: `قرار إداري للمباراة "${match.tableNameAr || match.tableName}": ${input.resultType}`,
          before: { status: match.status, result: match.result },
          after: { status: updated.status, result: updated.result },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          {
            event: 'match.finished',
            payload: { matchId: match.id, gameId: match.id, winnerId: updated.result?.winnerId },
          },
          ...cascadeBroadcasts,
        ],
      };
    });
  },

  async resolveNeedsReview(input: {
    matchId: string;
    action: 'invalidateForReplay' | 'keepAsIs';
    reason?: string;
    actorUserId: string;
    expectedVersion?: number;
  }): Promise<Match> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const mIdx = db.matches.findIndex((m) => m.id === input.matchId);
      if (mIdx === -1) throw new CommandValidationError(`Match "${input.matchId}" not found.`);
      const match = db.matches[mIdx];

      assertVersion(match, input.expectedVersion);
      assertRepoPermission(db, input.actorUserId, 'match.resolveReview', { match });

      if (input.action === 'invalidateForReplay') {
        const nextEpoch = (match.replayEpoch ?? 0) + 1;
        db.matchEvents.unshift({
          id: nextId('me'),
          matchId: match.id,
          type: 'invalidatedForReplay',
          byUserId: input.actorUserId,
          reason: input.reason ?? 'Resolved needsReview by invalidating for replay',
          payload: { newReplayEpoch: nextEpoch },
          replayEpoch: nextEpoch,
          createdAt: nextIsoTimestamp(),
        });
        db.matches[mIdx] = {
          ...match,
          replayEpoch: nextEpoch,
          currentSegmentIndex: 0,
          timer: { status: 'idle', durationSec: 45, remainingSec: 45, endsAt: null },
          version: match.version + 1,
        };
      } else {
        // Super Admin confirmed the played match as-is: pin the played participants
        // as fixed feeders so future propagation & invariants honor this explicit ruling.
        const pinnedParticipants = match.participants.map((p) =>
          p.playerId && !p.guest && !p.isBye
            ? { ...p, feeder: { kind: 'fixed' as const, playerId: p.playerId } }
            : p
        );
        db.matchEvents.unshift({
          id: nextId('me'),
          matchId: match.id,
          type: 'reviewResolved',
          byUserId: input.actorUserId,
          reason: input.reason ?? 'Super Admin confirmed existing match result',
          payload: {
            keptParticipants: pinnedParticipants.map((p) => p.playerId),
          },
          replayEpoch: match.replayEpoch ?? 0,
          createdAt: nextIsoTimestamp(),
        });
        db.matches[mIdx] = {
          ...match,
          participants: pinnedParticipants,
          version: match.version + 1,
        };
      }

      const { cascadeAuditEntries, cascadeBroadcasts } = applyPropagationAndCascade(
        beforeDb,
        db,
        input.actorUserId,
        {
          confirmCascade: true,
          cascadePolicy:
            input.action === 'invalidateForReplay'
              ? 'invalidateForReplay'
              : 'markNeedsReview',
        }
      );

      const updated = db.matches.find((m) => m.id === match.id)!;
      db.auditEntries.unshift(
        ...cascadeAuditEntries,
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'match.resolveReview',
          entityType: 'match',
          entityId: match.id,
          summary: `Resolved review on "${match.tableName}" with policy: ${input.action}`,
          summaryAr: `تمت تسوية مراجعة "${match.tableNameAr || match.tableName}" (${input.action})`,
          before: { status: match.status },
          after: { status: updated.status },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: cascadeBroadcasts,
      };
    });
  },

  /**
   * Previews cascade impact of a proposed revert / edit / reopen / absence reversal
   * WITHOUT committing or broadcasting anything. Used by the Impact Preview dialog!
   */
  async previewImpact(
    proposal:
      | { type: 'revertEvent'; matchId: string; targetEventId: string; byUserId: string }
      | { type: 'editScoreEvent'; eventId: string; delta: number; byUserId: string }
      | { type: 'reopenMatch'; matchId: string; actorUserId: string }
      | { type: 'reverseAbsence'; matchId: string; playerId: string; byUserId: string }
      | { type: 'overrideResult'; matchId: string; resultType: MatchResultType; winnerId?: string; actorUserId: string }
  ): Promise<CascadeImpact> {
    const beforeDb = await storage.readSnapshot();
    const workingDb = structuredClone(beforeDb);

    if (proposal.type === 'revertEvent') {
      const targetIdx = workingDb.scoreEvents.findIndex(
        (e) => e.id === proposal.targetEventId && e.matchId === proposal.matchId
      );
      if (targetIdx !== -1) {
        const target = workingDb.scoreEvents[targetIdx];
        const undoEv: ScoreEvent = {
          id: 'preview-undo',
          matchId: target.matchId,
          gameId: target.matchId,
          segmentId: target.segmentId,
          playerId: target.playerId,
          delta: -target.delta,
          kind: 'undo',
          byUserId: proposal.byUserId,
          targetEventId: target.id,
          replayEpoch: target.replayEpoch ?? 0,
          createdAt: new Date(Date.now() + 1000).toISOString(),
        };
        workingDb.scoreEvents[targetIdx] = { ...target, undoneByEventId: undoEv.id };
        workingDb.scoreEvents.unshift(undoEv);
      }
    } else if (proposal.type === 'editScoreEvent') {
      const targetIdx = workingDb.scoreEvents.findIndex((e) => e.id === proposal.eventId);
      if (targetIdx !== -1) {
        const target = workingDb.scoreEvents[targetIdx];
        const undoEv: ScoreEvent = {
          id: 'preview-undo',
          matchId: target.matchId,
          gameId: target.matchId,
          segmentId: target.segmentId,
          playerId: target.playerId,
          delta: -target.delta,
          kind: 'undo',
          byUserId: proposal.byUserId,
          targetEventId: target.id,
          replayEpoch: target.replayEpoch ?? 0,
          createdAt: new Date(Date.now() + 1000).toISOString(),
        };
        const repEv: ScoreEvent = {
          ...target,
          id: 'preview-rep',
          delta: proposal.delta,
          kind: 'point',
          createdAt: new Date(Date.now() + 2000).toISOString(),
        };
        workingDb.scoreEvents[targetIdx] = { ...target, undoneByEventId: undoEv.id };
        workingDb.scoreEvents.unshift(repEv, undoEv);
      }
    } else if (proposal.type === 'reopenMatch') {
      const m = workingDb.matches.find((x) => x.id === proposal.matchId);
      if (m) {
        workingDb.matchEvents.unshift({
          id: 'preview-reopen',
          matchId: m.id,
          type: 'reopened',
          byUserId: proposal.actorUserId,
          replayEpoch: m.replayEpoch ?? 0,
          createdAt: new Date(Date.now() + 1000).toISOString(),
        });
      }
    } else if (proposal.type === 'reverseAbsence') {
      const m = workingDb.matches.find((x) => x.id === proposal.matchId);
      if (m) {
        workingDb.absenceEvents.unshift({
          id: 'preview-rev-abs',
          matchId: m.id,
          playerId: proposal.playerId,
          action: 'reversed',
          byUserId: proposal.byUserId,
          replayEpoch: m.replayEpoch ?? 0,
          createdAt: new Date(Date.now() + 1000).toISOString(),
        });
      }
    } else if (proposal.type === 'overrideResult') {
      const m = workingDb.matches.find((x) => x.id === proposal.matchId);
      if (m) {
        workingDb.matchEvents.unshift({
          id: 'preview-ovr',
          matchId: m.id,
          type: 'overrideResult',
          byUserId: proposal.actorUserId,
          payload: { resultType: proposal.resultType, winnerId: proposal.winnerId },
          replayEpoch: m.replayEpoch ?? 0,
          createdAt: new Date(Date.now() + 1000).toISOString(),
        });
      }
    }

    return previewCascadeImpact(
      {
        players: beforeDb.players,
        groups: beforeDb.groups,
        rounds: beforeDb.rounds,
        matches: beforeDb.matches,
        scoreEvents: beforeDb.scoreEvents,
        absenceEvents: beforeDb.absenceEvents,
        buzzEvents: beforeDb.buzzEvents,
        matchEvents: beforeDb.matchEvents,
        checkInEvents: beforeDb.checkInEvents,
        settings: beforeDb.settings.tournament,
      },
      {
        players: workingDb.players,
        groups: workingDb.groups,
        rounds: workingDb.rounds,
        matches: workingDb.matches,
        scoreEvents: workingDb.scoreEvents,
        absenceEvents: workingDb.absenceEvents,
        buzzEvents: workingDb.buzzEvents,
        matchEvents: workingDb.matchEvents,
        checkInEvents: workingDb.checkInEvents,
        settings: workingDb.settings.tournament,
      }
    );
  },

  async createGroupTieBreakMatch(input: {
    groupId: string;
    playerIds: string[];
    actorUserId: string;
  }): Promise<Match> {
    if (input.playerIds.length < 2) {
      throw new CommandValidationError(
        'A group tie-break match requires at least 2 participants.'
      );
    }
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const group = db.groups.find((g) => g.id === input.groupId);
      if (!group) throw new CommandValidationError(`Group "${input.groupId}" not found.`);

      const scorers = db.users.filter((u) => u.role === 'scorer');
      const judgeUserId = scorers[0]?.id ?? 'user-admin';
      const matchId = nextId(`match-gtb-g${group.number}`);

      const draftMatch: Match = {
        id: matchId,
        type: 'group',
        groupId: group.id,
        roundId: group.roundId,
        round: 1,
        slot: db.matches.filter((m) => m.groupId === group.id).length + 1,
        isGroupTieBreak: true,
        participants: input.playerIds.map((pid, idx) => ({
          slotIndex: idx,
          playerId: pid,
          feeder: { kind: 'fixed' as const, playerId: pid },
        })),
        playerIds: [...input.playerIds],
        tableNumber: 1,
        tableName: `Group ${group.number} · Tie-Break Decider`,
        tableNameAr: `المجموعة ${group.number} · مباراة فاصلة`,
        scheduledAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        judgeUserId,
        scorerUserId: judgeUserId,
        segmentIds: ['seg-16'],
        currentSegmentIndex: 0,
        status: 'scheduled',
        result: null,
        isFinal: false,
        isDemo: false,
        replayEpoch: 0,
        version: 1,
        timer: { status: 'idle', durationSec: 30, remainingSec: 30 },
      };

      const freeSlot = findNextFreeSlotForMatch(
        draftMatch,
        db.matches,
        db.users,
        db.settings.tournament
      );
      draftMatch.tableNumber = freeSlot.tableNumber;
      draftMatch.judgeUserId = freeSlot.judgeUserId;
      draftMatch.scorerUserId = freeSlot.judgeUserId;
      draftMatch.scheduledAt = freeSlot.scheduledAt;

      db.matches.push(draftMatch);
      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'group.createTieBreak',
          entityType: 'group',
          entityId: group.id,
          summary: `Created Group ${group.number} tie-break match between ${input.playerIds.join(' vs ')}`,
          summaryAr: `تم إنشاء مباراة فاصلة للمجموعة ${group.number}`,
          before: null,
          after: { matchId, playerIds: input.playerIds },
        })
      );

      return {
        result: db.matches.find((m) => m.id === matchId)!,
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { groupId: group.id, matchId } }],
      };
    });
  },

  // --------------------------------------------------------------------------
  // DEMO EXHIBITION RESET
  // --------------------------------------------------------------------------

  async resetDemoMatch(matchId = 'game-demo'): Promise<Match> {
    return commitCommand('user-scorer-1', (_beforeDb, db) => {
      const dp1 = db.players.find((p) => p.id === 'player-1')?.id ?? db.players[0].id;
      const dp2 =
        db.players.find((p) => p.id === 'player-19')?.id ??
        db.players.find((p) => !p.isGuest && p.id !== dp1)?.id ??
        db.players[1].id;
      const demoSeed = createDemoSeedState([dp1, dp2]);
      const resetMatch = { ...demoSeed.match, id: matchId };

      db.matches = [...db.matches.filter((m) => m.id !== matchId), resetMatch];
      db.scoreEvents = [
        ...demoSeed.scoreEvents.map((e) => ({ ...e, matchId, gameId: matchId })),
        ...db.scoreEvents.filter((e) => e.matchId !== matchId),
      ];
      db.buzzEvents = [
        ...demoSeed.buzzEvents.map((b) => ({ ...b, matchId, gameId: matchId })),
        ...db.buzzEvents.filter((b) => b.matchId !== matchId),
      ];
      db.matchEvents = [
        ...demoSeed.matchEvents.map((me) => ({ ...me, matchId })),
        ...db.matchEvents.filter((me) => me.matchId !== matchId),
      ];

      return {
        result: resetMatch,
        nextDb: db,
        fullReplace: true,
        broadcasts: [
          { event: 'score.changed', payload: { gameId: matchId, matchId, reset: true } },
          {
            event: 'buzz.recorded',
            payload: {
              gameId: matchId,
              matchId,
              playerId: resetMatch.activeBuzzPlayerId ?? '',
              segmentId: resetMatch.segmentIds[resetMatch.currentSegmentIndex],
            },
          },
          {
            event: 'segment.changed',
            payload: {
              gameId: matchId,
              matchId,
              currentSegmentIndex: resetMatch.currentSegmentIndex,
              segmentId: resetMatch.segmentIds[resetMatch.currentSegmentIndex],
            },
          },
          ...(resetMatch.timer
            ? [
                {
                  event: 'timer.updated' as RealtimeEventName,
                  payload: { gameId: matchId, matchId, timer: resetMatch.timer },
                },
              ]
            : []),
        ],
      };
    });
  },

  // --------------------------------------------------------------------------
  // TOURNAMENT GENERATION, GROUPS, ROUNDS & STRUCTURAL MATCH CRUD
  // --------------------------------------------------------------------------

  async generateTournament(input: {
    tournament: Partial<TournamentSettings>;
    actorUserId: string;
    shuffleSeed?: number;
    preserveSeedOrder?: boolean;
    confirmStructuralRebuild?: boolean;
  }): Promise<{ groups: Group[]; rounds: Round[]; matches: Match[] }> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');

      const merged: TournamentSettings = {
        ...db.settings.tournament,
        ...input.tournament,
      };

      const validation = validateTournamentSettings(merged);
      if (!validation.valid) {
        throw new CommandValidationError(validation.errors[0].messageEn);
      }

      const progress = getTournamentProgress(
        db.matches,
        db.scoreEvents,
        db.absenceEvents,
        db.matchEvents
      );
      if (progress.started && input.confirmStructuralRebuild === false) {
        throw new CommandValidationError(
          `Tournament has already started (${progress.liveCount} live, ${progress.finishedCount} finished). Explicit Impact Preview confirmation is required.`
        );
      }

      // Ensure player roster satisfies merged.totalPlayers (preserve existing players & Marwan;
      // procedurally top up if scaling up, e.g., 12 -> 48 or 720)
      const nonGuests = db.players.filter((p) => !p.isGuest && !p.isHost);
      const guestPlayers = db.players.filter((p) => p.isGuest || p.isHost);
      if (nonGuests.length < merged.totalPlayers) {
        const procedural = generateProceduralPlayers(merged.totalPlayers);
        const existingIds = new Set(db.players.map((p) => p.id));
        const additions = procedural.filter(
          (p) => !p.isGuest && !p.isHost && !existingIds.has(p.id)
        );
        const needed = merged.totalPlayers - nonGuests.length;
        db.players = [
          ...nonGuests,
          ...additions.slice(0, needed),
          ...guestPlayers,
        ];
      }

      const groupRound: Round = {
        id: 'round-groups',
        name: { en: 'Group Stage — 1v1 Round-Robin', ar: 'دور المجموعات — دوري ١ ضد ١' },
        order: 1,
        stage: 'group',
        advancePerGame: merged.advancePerGroup,
        status: 'upcoming',
      };

      const groups = generateGroups(db.players, merged, {
        shuffleSeed: input.shuffleSeed,
        preserveOrder: input.preserveSeedOrder,
        roundId: groupRound.id,
      });

      const availableSegs = [...db.segments]
        .filter((s) => s.id !== 'seg-16')
        .sort((a, b) => a.order - b.order);
      const stdSegIds =
        availableSegs.length >= 6
          ? availableSegs.slice(0, 6).map((s) => s.id)
          : availableSegs.map((s) => s.id);
      const finalSegIds = availableSegs
        .slice(0, Math.min(8, availableSegs.length))
        .map((s) => s.id);

      const groupMatches: Match[] = [];
      let slot = 1;
      for (const group of groups) {
        const pairs = generateGroupRoundRobinPairs(group.playerIds);
        pairs.forEach(([pA, pB], idx) => {
          groupMatches.push({
            id: `match-g${group.number}-m${idx + 1}`,
            type: 'group',
            groupId: group.id,
            roundId: groupRound.id,
            round: 1,
            slot: slot++,
            isGroupTieBreak: false,
            participants: [
              { slotIndex: 0, playerId: pA, feeder: { kind: 'fixed', playerId: pA } },
              { slotIndex: 1, playerId: pB, feeder: { kind: 'fixed', playerId: pB } },
            ],
            playerIds: [pA, pB],
            tableNumber: 1,
            tableName: `Group ${group.number} · Match ${idx + 1}`,
            tableNameAr: `المجموعة ${group.number} · مباراة ${idx + 1}`,
            scheduledAt: new Date().toISOString(),
            judgeUserId: 'user-scorer-1',
            scorerUserId: 'user-scorer-1',
            segmentIds: stdSegIds.length ? stdSegIds : ['seg-1'],
            currentSegmentIndex: 0,
            status: 'scheduled',
            result: null,
            isFinal: false,
            isDemo: false,
            podOrder: slot - 1,
            replayEpoch: 0,
            version: 1,
            timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
          });
        });
      }

      const ko = generateKnockout(groups, merged, {
        startRoundOrder: 2,
        defaultSegmentIds: stdSegIds.length ? stdSegIds : ['seg-1'],
        finalSegmentIds: finalSegIds.length ? finalSegIds : ['seg-1'],
      });

      const scheduled = autoScheduleMatches(
        [...groupMatches, ...ko.matches],
        db.users,
        merged
      );

      const demoMatches = db.matches.filter((m) => m.isDemo);
      const demoIds = new Set(demoMatches.map((m) => m.id));

      db.groups = groups;
      db.rounds = [groupRound, ...ko.rounds];
      db.matches = [...scheduled, ...demoMatches];
      db.scoreEvents = db.scoreEvents.filter((e) => demoIds.has(e.matchId));
      db.absenceEvents = db.absenceEvents.filter((e) => demoIds.has(e.matchId));
      db.buzzEvents = db.buzzEvents.filter((b) => demoIds.has(b.matchId));
      db.matchEvents = db.matchEvents.filter((me) => demoIds.has(me.matchId));
      db.settings = {
        ...db.settings,
        tournament: merged,
        bracketConfig: buildBracketConfigCompat(merged),
        updatedAt: nextIsoTimestamp(),
      };

      const propagated = propagateWinners({
        players: db.players,
        groups: db.groups,
        rounds: db.rounds,
        matches: db.matches,
        scoreEvents: db.scoreEvents,
        absenceEvents: db.absenceEvents,
        buzzEvents: db.buzzEvents,
        matchEvents: db.matchEvents,
        checkInEvents: db.checkInEvents,
        settings: merged,
      });

      db.players = propagated.players;
      db.rounds = propagated.rounds;
      db.matches = propagated.matches;

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'tournament.generate',
          entityType: 'bracket',
          entityId: 'tournament-bracket',
          summary: `Generated ${merged.totalPlayers}-player tournament (${groups.length} groups of ${merged.groupSize}, ${scheduled.length} matches, ${ko.byesCount} BYEs).`,
          summaryAr: `تم توليد بطولة ${merged.totalPlayers} لاعب (${groups.length} مجموعة و${scheduled.length} مباراة).`,
          before: null,
          after: {
            ...merged,
            groupsCount: groups.length,
            matchesCount: scheduled.length,
            byesCount: ko.byesCount,
          },
        })
      );

      return {
        result: {
          groups: db.groups,
          rounds: db.rounds,
          matches: scheduled,
        },
        nextDb: db,
        fullReplace: true,
        broadcasts: [
          {
            event: 'tournament.generated',
            payload: {
              totalPlayers: merged.totalPlayers,
              groupsCount: groups.length,
              matchesCount: scheduled.length,
            },
          },
          { event: 'bracket.updated', payload: {} },
          { event: 'settings.updated', payload: { keys: ['tournament', 'bracketConfig'] } },
          { event: 'player.updated', payload: {} },
        ],
      };
    });
  },

  /**
   * Re-draws all groups randomly (or in seed order) BEFORE the tournament has started.
   * Regenerates all group round-robin 1v1 matches & auto-schedules conflict-free.
   */
  async redrawGroups(input: {
    actorUserId: string;
    shuffleSeed?: number;
    preserveSeedOrder?: boolean;
  }): Promise<{ groups: Group[]; matches: Match[] }> {
    const seed = input.shuffleSeed ?? Math.floor(Date.now() % 1_000_000_007);
    const res = await this.generateTournament({
      tournament: {},
      actorUserId: input.actorUserId,
      shuffleSeed: seed,
      preserveSeedOrder: input.preserveSeedOrder,
      confirmStructuralRebuild: false,
    });
    return { groups: res.groups, matches: res.matches };
  },

  /**
   * Moves or swaps a player between groups BEFORE the tournament has started.
   * Regenerates 1v1 round-robin matches for affected groups and reschedules conflict-free.
   */
  async movePlayerBetweenGroups(input: {
    playerId: string;
    targetGroupId: string;
    swapWithPlayerId?: string;
    actorUserId: string;
  }): Promise<{ groups: Group[]; affectedMatchIds: string[] }> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');

      const progress = getTournamentProgress(
        db.matches,
        db.scoreEvents,
        db.absenceEvents,
        db.matchEvents
      );
      if (progress.started) {
        throw new CommandValidationError(
          'Manual group moves are locked once the tournament has started.'
        );
      }

      const sourceGroupIdx = db.groups.findIndex((g) =>
        g.playerIds.includes(input.playerId)
      );
      const targetGroupIdx = db.groups.findIndex((g) => g.id === input.targetGroupId);
      if (sourceGroupIdx === -1) {
        throw new CommandValidationError(`Player "${input.playerId}" is not assigned to any group.`);
      }
      if (targetGroupIdx === -1) {
        throw new CommandValidationError(`Target group "${input.targetGroupId}" not found.`);
      }

      const sourceGroup = {
        ...db.groups[sourceGroupIdx],
        playerIds: [...db.groups[sourceGroupIdx].playerIds],
      };
      const targetGroup =
        sourceGroupIdx === targetGroupIdx
          ? sourceGroup
          : {
              ...db.groups[targetGroupIdx],
              playerIds: [...db.groups[targetGroupIdx].playerIds],
            };

      const srcPos = sourceGroup.playerIds.indexOf(input.playerId);

      if (input.swapWithPlayerId) {
        const tgtPos = targetGroup.playerIds.indexOf(input.swapWithPlayerId);
        if (tgtPos === -1) {
          throw new CommandValidationError(
            `Swap target player "${input.swapWithPlayerId}" is not in Group ${targetGroup.number}.`
          );
        }
        sourceGroup.playerIds[srcPos] = input.swapWithPlayerId;
        targetGroup.playerIds[tgtPos] = input.playerId;
      } else {
        if (sourceGroup.id === targetGroup.id) {
          throw new CommandValidationError('Select a different target group or a player to swap with.');
        }
        if (sourceGroup.playerIds.length <= 2) {
          throw new CommandValidationError(
            `Group ${sourceGroup.number} cannot have fewer than 2 players. Swap with a player instead.`
          );
        }
        sourceGroup.playerIds.splice(srcPos, 1);
        targetGroup.playerIds.push(input.playerId);
      }

      db.groups[sourceGroupIdx] = sourceGroup;
      if (targetGroupIdx !== sourceGroupIdx) {
        db.groups[targetGroupIdx] = targetGroup;
      }

      // Regenerate round-robin 1v1 matches for affected group(s)
      const affectedGroupIds = new Set<string>([sourceGroup.id, targetGroup.id]);
      const affectedGroups = [sourceGroup];
      if (targetGroup.id !== sourceGroup.id) affectedGroups.push(targetGroup);

      const availableSegs = [...db.segments]
        .filter((s) => s.id !== 'seg-16')
        .sort((a, b) => a.order - b.order);
      const stdSegIds =
        availableSegs.length >= 6
          ? availableSegs.slice(0, 6).map((s) => s.id)
          : availableSegs.map((s) => s.id);

      const preservedMatches = db.matches.filter(
        (m) => m.isDemo || m.type !== 'group' || !m.groupId || !affectedGroupIds.has(m.groupId)
      );
      let maxGroupSlot = preservedMatches
        .filter((m) => !m.isDemo && m.type === 'group')
        .reduce((max, m) => Math.max(max, m.slot), 0);

      const rebuiltGroupMatches: Match[] = [];
      for (const grp of affectedGroups) {
        const pairs = generateGroupRoundRobinPairs(grp.playerIds);
        pairs.forEach(([pA, pB], idx) => {
          rebuiltGroupMatches.push({
            id: `match-g${grp.number}-m${idx + 1}`,
            type: 'group',
            groupId: grp.id,
            roundId: grp.roundId,
            round: 1,
            slot: ++maxGroupSlot,
            isGroupTieBreak: false,
            participants: [
              { slotIndex: 0, playerId: pA, feeder: { kind: 'fixed', playerId: pA } },
              { slotIndex: 1, playerId: pB, feeder: { kind: 'fixed', playerId: pB } },
            ],
            playerIds: [pA, pB],
            tableNumber: 1,
            tableName: `Group ${grp.number} · Match ${idx + 1}`,
            tableNameAr: `المجموعة ${grp.number} · مباراة ${idx + 1}`,
            scheduledAt: '2027-03-05T19:00:00.000Z',
            judgeUserId: 'user-scorer-1',
            scorerUserId: 'user-scorer-1',
            segmentIds: stdSegIds.length ? stdSegIds : ['seg-1'],
            currentSegmentIndex: 0,
            status: 'scheduled',
            result: null,
            isFinal: false,
            isDemo: false,
            podOrder: maxGroupSlot,
            replayEpoch: 0,
            version: 1,
            timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
          });
        });
      }

      // Re-run conflict-free auto-scheduler across all non-demo matches so no double-bookings arise
      const demoMatches = preservedMatches.filter((m) => m.isDemo);
      const nonDemoMatches = [
        ...preservedMatches.filter((m) => !m.isDemo),
        ...rebuiltGroupMatches,
      ];
      const rescheduled = autoScheduleMatches(
        nonDemoMatches,
        db.users,
        db.settings.tournament
      );
      db.matches = [...rescheduled, ...demoMatches];

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      const movingPlayer = db.players.find((p) => p.id === input.playerId);
      const swapPlayer = input.swapWithPlayerId
        ? db.players.find((p) => p.id === input.swapWithPlayerId)
        : null;

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: input.swapWithPlayerId ? 'group.swapPlayers' : 'group.movePlayer',
          entityType: 'group',
          entityId: targetGroup.id,
          summary: swapPlayer
            ? `Swapped ${movingPlayer?.fullName ?? input.playerId} (Group ${sourceGroup.number}) with ${swapPlayer.fullName} (Group ${targetGroup.number}) and regenerated round-robin matches.`
            : `Moved ${movingPlayer?.fullName ?? input.playerId} from Group ${sourceGroup.number} to Group ${targetGroup.number} and regenerated round-robin matches.`,
          summaryAr: swapPlayer
            ? `تم تبديل ${movingPlayer?.fullNameAr ?? input.playerId} (المجموعة ${sourceGroup.number}) مع ${swapPlayer.fullNameAr} (المجموعة ${targetGroup.number}).`
            : `تم نقل ${movingPlayer?.fullNameAr ?? input.playerId} من المجموعة ${sourceGroup.number} إلى المجموعة ${targetGroup.number}.`,
          before: {
            sourceGroup: beforeDb.groups[sourceGroupIdx]?.playerIds,
            targetGroup: beforeDb.groups[targetGroupIdx]?.playerIds,
          },
          after: {
            sourceGroup: sourceGroup.playerIds,
            targetGroup: targetGroup.playerIds,
          },
        })
      );

      return {
        result: {
          groups: db.groups,
          affectedMatchIds: rebuiltGroupMatches.map((m) => m.id),
        },
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { groupId: targetGroup.id } }],
      };
    });
  },

  /**
   * Runs the conflict-free auto-scheduler across upcoming scheduled matches (default)
   * or all matches, guaranteeing zero player/table/judge double-bookings.
   */
  async autoScheduleAll(input: {
    actorUserId: string;
    onlyScheduled?: boolean;
    startIso?: string;
  }): Promise<{ rescheduledCount: number; remainingConflicts: number }> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const onlyScheduled = input.onlyScheduled ?? true;

      const scheduled = autoScheduleMatches(
        db.matches,
        db.users,
        db.settings.tournament,
        input.startIso ?? '2027-03-05T19:00:00.000Z',
        { onlyScheduled }
      );

      const beforeById = new Map(beforeDb.matches.map((m) => [m.id, m]));
      let rescheduledCount = 0;
      db.matches = scheduled.map((m) => {
        const prev = beforeById.get(m.id);
        if (
          prev &&
          (prev.tableNumber !== m.tableNumber ||
            prev.scheduledAt !== m.scheduledAt ||
            prev.judgeUserId !== m.judgeUserId)
        ) {
          rescheduledCount++;
          return { ...m, version: m.version + 1 };
        }
        return m;
      });

      const remainingConflicts = detectScheduleConflicts(
        db.matches,
        db.settings.tournament
      ).length;

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'schedule.autoAssign',
          entityType: 'bracket',
          entityId: 'auto-schedule',
          summary: `Auto-scheduled ${rescheduledCount} match(es) across ${db.settings.tournament.tablesCount} tables (${db.settings.tournament.slotMinutes} min slots, ${remainingConflicts} conflicts).`,
          summaryAr: `تمت الجدولة التلقائية لـ ${rescheduledCount} مباراة عبر ${db.settings.tournament.tablesCount} طاولات (${db.settings.tournament.slotMinutes} دقيقة لكل فترة).`,
          before: { onlyScheduled },
          after: { rescheduledCount, remainingConflicts },
        })
      );

      return {
        result: { rescheduledCount, remainingConflicts },
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { rescheduledCount } }],
      };
    });
  },

  /**
   * Read-only tiered Impact Preview for changing Admin Tournament Settings.
   */
  async previewSettingsImpact(input: {
    tournament: Partial<TournamentSettings>;
  }): Promise<SettingsImpactPreview> {
    const db = await storage.readSnapshot();
    const before = db.settings.tournament;
    const next: TournamentSettings = { ...before, ...input.tournament };
    const progress = getTournamentProgress(
      db.matches,
      db.scoreEvents,
      db.absenceEvents,
      db.matchEvents
    );

    const structuralChanged =
      before.totalPlayers !== next.totalPlayers ||
      before.groupSize !== next.groupSize ||
      before.advancePerGroup !== next.advancePerGroup ||
      before.includeFinalWithMarwan !== next.includeFinalWithMarwan;

    const scheduleChanged =
      before.tablesCount !== next.tablesCount ||
      before.slotMinutes !== next.slotMinutes;

    const scoringChanged = before.pointsPerGroupWin !== next.pointsPerGroupWin;

    if (!structuralChanged && !scheduleChanged && !scoringChanged) {
      return {
        tier: 'none',
        requiresConfirmation: false,
        tournamentStarted: progress.started,
        affectedScheduledCount: 0,
        affectedActiveOrFinishedCount: 0,
        affectedGroupsCount: 0,
        summaryEn: 'No tournament structure or scheduling parameters changed.',
        summaryAr: 'لم تتغير أي إعدادات لهيكل البطولة أو الجدول.',
      };
    }

    if (structuralChanged) {
      const nextBp = computeTournamentBlueprint(next);
      const activeOrFinished =
        progress.liveCount +
        progress.finishedCount +
        progress.needsTieBreakCount +
        progress.needsReviewCount +
        progress.voidCount;

      return {
        tier: 'structural',
        requiresConfirmation: progress.started,
        tournamentStarted: progress.started,
        affectedScheduledCount: progress.scheduledCount,
        affectedActiveOrFinishedCount: activeOrFinished,
        affectedGroupsCount: db.groups.length,
        summaryEn: progress.started
          ? `Structural change (${before.totalPlayers}/${before.groupSize}/${before.advancePerGroup} → ${next.totalPlayers}/${next.groupSize}/${next.advancePerGroup}) will rebuild ${nextBp.groupsCount} groups and ${nextBp.totalMatchesCount} matches, archiving ${activeOrFinished} live/finished match(es) and ${progress.eventsCount} recorded event(s).`
          : `Will build ${nextBp.groupsCount} groups, ${nextBp.groupMatchesCount} group matches, a ${nextBp.bracketSize}-slot knockout bracket (${nextBp.byesCount} BYEs), and ${nextBp.totalMatchesCount} total matches.`,
        summaryAr: progress.started
          ? `هذا التعديل الهيكلي سيعيد بناء ${nextBp.groupsCount} مجموعة و${nextBp.totalMatchesCount} مباراة، وسيؤدي لإعادة تعيين ${activeOrFinished} مباراة جارية/منتهية و${progress.eventsCount} حدث مسجّل.`
          : `سيتم إنشاء ${nextBp.groupsCount} مجموعة و${nextBp.groupMatchesCount} مباراة مجموعات وشجرة إقصائية من ${nextBp.bracketSize} مقعد (${nextBp.byesCount} تأهل تلقائي).`,
      };
    }

    if (scheduleChanged && !scoringChanged) {
      return {
        tier: 'schedule',
        requiresConfirmation: progress.started,
        tournamentStarted: progress.started,
        affectedScheduledCount: progress.scheduledCount,
        affectedActiveOrFinishedCount: 0,
        affectedGroupsCount: 0,
        summaryEn: progress.started
          ? `Schedule update (${next.tablesCount} tables × ${next.slotMinutes} min) will reschedule ${progress.scheduledCount} upcoming match(es) conflict-free while preserving all ${progress.finishedCount + progress.liveCount} live/finished match(es).`
          : `Schedule update will auto-assign ${progress.scheduledCount} scheduled matches across ${next.tablesCount} tables in ${next.slotMinutes}-minute slots.`,
        summaryAr: progress.started
          ? `تحديث الجدول (${next.tablesCount} طاولات × ${next.slotMinutes} دقيقة) سيعيد جدولة ${progress.scheduledCount} مباراة قادمة فقط مع الحفاظ على جميع المباريات الجارية والمنتهية.`
          : `سيتم توزيع ${progress.scheduledCount} مباراة مجدولة تلقائياً عبر ${next.tablesCount} طاولات بفترات ${next.slotMinutes} دقيقة.`,
      };
    }

    // Scoring-only (pointsPerGroupWin) -> run pure cascade impact preview!
    const cascadeImpact = previewCascadeImpact(
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
        settings: before,
      },
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
        settings: next,
      }
    );

    return {
      tier: 'scoring',
      requiresConfirmation: cascadeImpact.requiresConfirmation || progress.started,
      tournamentStarted: progress.started,
      affectedScheduledCount: cascadeImpact.autoUpdatedMatches.length,
      affectedActiveOrFinishedCount: cascadeImpact.reviewRequiredMatches.length,
      affectedGroupsCount: db.groups.length,
      cascadeImpact,
      summaryEn:
        cascadeImpact.summaryEn ||
        `Group win points changed (${before.pointsPerGroupWin} → ${next.pointsPerGroupWin}). Group standings will recompute in place.`,
      summaryAr:
        cascadeImpact.summaryAr ||
        `تغيير نقاط الفوز في المجموعات (${before.pointsPerGroupWin} ← ${next.pointsPerGroupWin}). سيتم إعادة حساب ترتيب المجموعات تلقائياً.`,
    };
  },

  async createMatch(input: {
    roundId: string;
    type?: Match['type'];
    groupId?: string;
    tableNumber?: number;
    tableName: string;
    tableNameAr?: string;
    scheduledAt: string;
    judgeUserId: string;
    playerIds: string[];
    segmentIds: string[];
    isFinal?: boolean;
    actorUserId: string;
  }): Promise<Match> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');

      const round = db.rounds.find((r) => r.id === input.roundId);
      const isFinal = Boolean(input.isFinal || input.type === 'final');
      const seatIds = [...input.playerIds];
      if (isFinal && !seatIds.includes(MARWAN_PLAYER_ID)) {
        seatIds.splice(2);
        while (seatIds.length < 2) seatIds.push(`tbd-final-${seatIds.length + 1}`);
        seatIds.push(MARWAN_PLAYER_ID);
      }

      const playerIdSet = new Set(db.players.map((p) => p.id));
      const participants = seatIds.map((pid, idx) => {
        const isGuest = pid === MARWAN_PLAYER_ID;
        const resolved = playerIdSet.has(pid) ? pid : null;
        return {
          slotIndex: idx,
          playerId: resolved,
          guest: isGuest,
          isBye: false,
          feeder: isGuest
            ? ({ kind: 'guest', playerId: MARWAN_PLAYER_ID } as const)
            : resolved
              ? ({ kind: 'fixed', playerId: resolved } as const)
              : undefined,
        };
      });

      const matchId = nextId('match');
      const newMatch: Match = {
        id: matchId,
        type: isFinal ? 'final' : (input.type ?? (input.groupId ? 'group' : 'knockout')),
        groupId: input.groupId,
        roundId: input.roundId,
        round: round?.order ?? 1,
        slot: db.matches.filter((m) => m.roundId === input.roundId && !m.isDemo).length + 1,
        isGroupTieBreak: false,
        participants,
        playerIds: seatIds,
        tableNumber: input.tableNumber ?? 1,
        tableName: input.tableName,
        tableNameAr: input.tableNameAr || input.tableName,
        scheduledAt: input.scheduledAt,
        judgeUserId: input.judgeUserId,
        scorerUserId: input.judgeUserId,
        segmentIds: input.segmentIds.length ? input.segmentIds : ['seg-1'],
        currentSegmentIndex: 0,
        status: 'scheduled',
        result: null,
        isFinal,
        isDemo: false,
        podOrder: db.matches.filter((m) => m.roundId === input.roundId && !m.isDemo).length + 1,
        replayEpoch: 0,
        version: 1,
        timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
      };

      if (isFinal) {
        db.matches = db.matches.map((m) =>
          !m.isDemo && m.isFinal ? { ...m, isFinal: false, type: 'knockout' } : m
        );
      }
      db.matches.push(newMatch);

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      const saved = db.matches.find((m) => m.id === matchId)!;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'match.create',
          entityType: 'match',
          entityId: matchId,
          summary: `Created match "${saved.tableName}"`,
          summaryAr: `تم إنشاء مباراة "${saved.tableNameAr}"`,
          before: null,
          after: {
            tableName: saved.tableName,
            roundId: saved.roundId,
            judgeUserId: saved.judgeUserId,
          },
        })
      );

      return {
        result: saved,
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { matchId, gameId: matchId } }],
      };
    });
  },

  /**
   * Updates ONLY structural / scheduling metadata on a match.
   * NEVER allows directly setting status, winnerPlayerId, result, or advancingPlayerIds!
   */
  async updateMatchMetadata(input: {
    matchId: string;
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
    };
    actorUserId: string;
    expectedVersion?: number;
  }): Promise<Match | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const idx = db.matches.findIndex((m) => m.id === input.matchId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };

      const before = db.matches[idx];
      assertVersion(before, input.expectedVersion);

      const nextJudge =
        input.patch.judgeUserId ?? input.patch.scorerUserId ?? before.judgeUserId;
      const nextIsFinal =
        input.patch.isFinal !== undefined ? input.patch.isFinal : before.isFinal;

      let nextParticipants = before.participants;
      if (input.patch.playerIds) {
        if (before.status !== 'scheduled') {
          throw new CommandValidationError(
            'Cannot manually reassign participants after a match has started.'
          );
        }
        const playerIdSet = new Set(db.players.map((p) => p.id));
        const rawIds = [...input.patch.playerIds];
        if (nextIsFinal && !rawIds.includes(MARWAN_PLAYER_ID)) {
          const nonGuest = rawIds.filter((pid) => pid !== MARWAN_PLAYER_ID).slice(0, 2);
          while (nonGuest.length < 2) nonGuest.push(`tbd-final-${nonGuest.length + 1}`);
          rawIds.splice(0, rawIds.length, ...nonGuest, MARWAN_PLAYER_ID);
        }
        nextParticipants = rawIds.map((pid, i) => {
          const isGuest = pid === MARWAN_PLAYER_ID;
          const resolved = playerIdSet.has(pid) ? pid : null;
          return {
            slotIndex: i,
            playerId: resolved,
            guest: isGuest,
            isBye: false,
            feeder: isGuest
              ? ({ kind: 'guest', playerId: MARWAN_PLAYER_ID } as const)
              : resolved
                ? ({ kind: 'fixed', playerId: resolved } as const)
                : before.participants[i]?.feeder,
          };
        });
      }

      if (input.patch.isFinal === true) {
        db.matches = db.matches.map((m) =>
          m.id !== before.id && !m.isDemo && m.isFinal
            ? { ...m, isFinal: false, type: 'knockout' }
            : m
        );
      }

      const nextSegs =
        input.patch.segmentIds && input.patch.segmentIds.length > 0
          ? input.patch.segmentIds
          : before.segmentIds;

      db.matches[idx] = {
        ...before,
        roundId: input.patch.roundId ?? before.roundId,
        tableNumber: input.patch.tableNumber ?? before.tableNumber,
        tableName: input.patch.tableName ?? before.tableName,
        tableNameAr: input.patch.tableNameAr ?? before.tableNameAr,
        scheduledAt: input.patch.scheduledAt ?? before.scheduledAt,
        judgeUserId: nextJudge,
        scorerUserId: nextJudge,
        segmentIds: nextSegs,
        currentSegmentIndex: Math.min(before.currentSegmentIndex, nextSegs.length - 1),
        isFinal: nextIsFinal,
        type: nextIsFinal ? 'final' : before.type === 'final' ? 'knockout' : before.type,
        participants: nextParticipants,
        version: before.version + 1,
      };

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      const updated = db.matches.find((m) => m.id === before.id)!;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'match.update',
          entityType: 'match',
          entityId: updated.id,
          summary: `Updated match metadata for "${updated.tableName}"`,
          summaryAr: `تم تحديث بيانات المباراة "${updated.tableNameAr}"`,
          before: {
            tableName: before.tableName,
            tableNumber: before.tableNumber,
            judgeUserId: before.judgeUserId,
            scheduledAt: before.scheduledAt,
          },
          after: {
            tableName: updated.tableName,
            tableNumber: updated.tableNumber,
            judgeUserId: updated.judgeUserId,
            scheduledAt: updated.scheduledAt,
          },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          { event: 'bracket.updated', payload: { matchId: updated.id, gameId: updated.id } },
        ],
      };
    });
  },

  async removeMatch(input: { matchId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const target = db.matches.find((m) => m.id === input.matchId && !m.isDemo);
      if (!target) return { result: false, nextDb: db, broadcasts: [] };

      const hasEvents =
        db.scoreEvents.some((e) => e.matchId === target.id) ||
        db.absenceEvents.some((e) => e.matchId === target.id) ||
        db.matchEvents.some((e) => e.matchId === target.id);
      if (hasEvents) {
        throw new CommandValidationError(
          'Cannot delete a match that already has recorded events. Use Reopen or Override instead.'
        );
      }

      db.matches = db.matches.filter((m) => m.id !== target.id);
      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'match.remove',
          entityType: 'match',
          entityId: target.id,
          summary: `Removed scheduled match "${target.tableName}"`,
          summaryAr: `تم حذف المباراة المجدولة "${target.tableNameAr}"`,
          before: { tableName: target.tableName, roundId: target.roundId },
          after: null,
        })
      );

      return {
        result: true,
        nextDb: db,
        broadcasts: [
          { event: 'bracket.updated', payload: { matchId: target.id, gameId: target.id } },
        ],
      };
    });
  },

  // --------------------------------------------------------------------------
  // PLAYERS, CHECK-IN EVENTS & AVATARS
  // --------------------------------------------------------------------------

  async createPlayer(input: {
    fullName: string;
    fullNameAr?: string;
    nickname: string;
    nicknameAr?: string;
    phone: string;
    whatsapp?: string;
    email: string;
    initialCheckInStatus?: CheckInStatus;
    seed?: number;
    actorUserId: string;
  }): Promise<Player> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'player.manage');
      const nonGuests = db.players.filter((p) => !p.isGuest && !p.isHost);
      const nextSeed =
        input.seed ??
        nonGuests.reduce((max, p) => Math.max(max, p.seed), 0) + 1;

      const cleanPhone = input.phone.trim() || formatFakePhone(nextSeed).phone;
      const cleanWa =
        input.whatsapp?.trim() ||
        cleanPhone.replace(/[^+\d]/g, '') ||
        formatFakePhone(nextSeed).whatsapp;
      const cleanEmail = input.email.trim().toLowerCase();

      const newPlayer: Player = {
        id: nextId('player'),
        fullName: input.fullName.trim(),
        fullNameAr: input.fullNameAr?.trim() || input.fullName.trim(),
        nickname: input.nickname.trim(),
        nicknameAr: input.nicknameAr?.trim() || input.nickname.trim(),
        avatarSeed: `seed-${nextSeed}-${input.nickname.toLowerCase().replace(/\s+/g, '')}`,
        avatar: { photoUrl: null, avatarKey: deterministicAvatarKey(nextSeed) },
        contact: { phone: cleanPhone, whatsapp: cleanWa, email: cleanEmail },
        phone: cleanPhone,
        email: cleanEmail,
        seed: nextSeed,
        isGuest: false,
        isHost: false,
        status: 'registered',
        stats: {
          matchesPlayed: 0,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          totalPoints: 0,
          groupPoints: 0,
          yellowCards: 0,
          redCards: 0,
          absences: 0,
        },
        createdAt: nextIsoTimestamp(),
      };

      db.players.push(newPlayer);
      if (input.initialCheckInStatus && input.initialCheckInStatus !== 'registered') {
        db.checkInEvents.unshift({
          id: nextId('ci'),
          playerId: newPlayer.id,
          status: input.initialCheckInStatus,
          byUserId: input.actorUserId,
          createdAt: nextIsoTimestamp(),
        });
      }

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      const saved = db.players.find((p) => p.id === newPlayer.id)!;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'player.create',
          entityType: 'player',
          entityId: saved.id,
          summary: `Created player ${saved.fullName} ("${saved.nickname}")`,
          summaryAr: `تم إضافة اللاعب ${saved.fullNameAr} ("${saved.nicknameAr}")`,
          before: null,
          after: { fullName: saved.fullName, email: saved.email, seed: saved.seed },
        })
      );

      return {
        result: saved,
        nextDb: db,
        broadcasts: [{ event: 'player.updated', payload: { playerId: saved.id } }],
      };
    });
  },

  async bulkCreatePlayers(input: {
    rows: Array<{
      fullName: string;
      fullNameAr?: string;
      nickname: string;
      nicknameAr?: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
      initialCheckInStatus?: CheckInStatus;
    }>;
    actorUserId: string;
  }): Promise<Player[]> {
    if (input.rows.length === 0) return [];
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'player.manage');
      let nextSeed =
        db.players
          .filter((p) => !p.isGuest && !p.isHost)
          .reduce((max, p) => Math.max(max, p.seed), 0) + 1;

      const created: Player[] = [];
      for (const row of input.rows) {
        const seed = nextSeed++;
        const cleanName = row.fullName.trim();
        const cleanNick = row.nickname.trim();
        const fakeContact = formatFakePhone(seed);
        const phone = row.phone?.trim() || fakeContact.phone;
        const whatsapp = row.whatsapp?.trim() || fakeContact.whatsapp;
        const email = (
          row.email?.trim() ||
          `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${seed}@players.casino`
        ).toLowerCase();

        const p: Player = {
          id: nextId('player'),
          fullName: cleanName,
          fullNameAr: row.fullNameAr?.trim() || cleanName,
          nickname: cleanNick,
          nicknameAr: row.nicknameAr?.trim() || cleanNick,
          avatarSeed: `seed-${seed}-${cleanNick.toLowerCase().replace(/\s+/g, '')}`,
          avatar: { photoUrl: null, avatarKey: deterministicAvatarKey(seed) },
          contact: { phone, whatsapp, email },
          phone,
          email,
          seed,
          isGuest: false,
          isHost: false,
          status: 'registered',
          stats: {
            matchesPlayed: 0,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            totalPoints: 0,
            groupPoints: 0,
            yellowCards: 0,
            redCards: 0,
            absences: 0,
          },
          createdAt: nextIsoTimestamp(),
        };
        created.push(p);
        db.players.push(p);
        if (row.initialCheckInStatus && row.initialCheckInStatus !== 'registered') {
          db.checkInEvents.unshift({
            id: nextId('ci'),
            playerId: p.id,
            status: row.initialCheckInStatus,
            byUserId: input.actorUserId,
            createdAt: nextIsoTimestamp(),
          });
        }
      }

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      const createdIdSet = new Set(created.map((p) => p.id));
      const savedCreated = db.players.filter((p) => createdIdSet.has(p.id));

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'player.bulkImport',
          entityType: 'player',
          entityId: `batch-${savedCreated.length}`,
          summary: `Bulk imported ${savedCreated.length} player(s) via CSV`,
          summaryAr: `تم استيراد ${savedCreated.length} لاعب عبر CSV`,
          before: null,
          after: { count: savedCreated.length },
        })
      );

      return {
        result: savedCreated,
        nextDb: db,
        broadcasts: [
          { event: 'player.updated', payload: { playerId: savedCreated[0]?.id } },
        ],
      };
    });
  },

  /**
   * Updates ONLY identity/contact/avatar/seed fields on a Player.
   * NEVER allows setting derived tournament status ('active' | 'eliminated' | 'finalist') or stats!
   */
  async updatePlayerProfile(input: {
    playerId: string;
    patch: {
      fullName?: string;
      fullNameAr?: string;
      nickname?: string;
      nicknameAr?: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
      seed?: number;
      avatar?: Avatar;
    };
    actorUserId: string;
  }): Promise<Player | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'player.manage');
      const idx = db.players.findIndex((p) => p.id === input.playerId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };

      const before = db.players[idx];
      const nextPhone = input.patch.phone ?? before.contact.phone;
      const nextWa = input.patch.whatsapp ?? before.contact.whatsapp;
      const nextEmail = input.patch.email ?? before.contact.email;
      const nextAvatar = input.patch.avatar
        ? validatePlayerAvatarInput(input.patch.avatar, before)
        : before.avatar;

      const updated: Player = {
        ...before,
        fullName: input.patch.fullName ?? before.fullName,
        fullNameAr: input.patch.fullNameAr ?? before.fullNameAr,
        nickname: input.patch.nickname ?? before.nickname,
        nicknameAr: input.patch.nicknameAr ?? before.nicknameAr,
        seed: input.patch.seed ?? before.seed,
        avatar: nextAvatar,
        contact: { phone: nextPhone, whatsapp: nextWa, email: nextEmail },
        phone: nextPhone,
        email: nextEmail,
      };
      db.players[idx] = updated;

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'player.update',
          entityType: 'player',
          entityId: updated.id,
          summary: `Updated player profile for ${updated.fullName}`,
          summaryAr: `تم تحديث بيانات اللاعب ${updated.fullNameAr}`,
          before: {
            fullName: before.fullName,
            nickname: before.nickname,
            phone: before.phone,
            email: before.email,
            avatarKey: before.avatar.avatarKey,
            hasPhoto: Boolean(before.avatar.photoUrl),
          },
          after: {
            fullName: updated.fullName,
            nickname: updated.nickname,
            phone: updated.phone,
            email: updated.email,
            avatarKey: updated.avatar.avatarKey,
            hasPhoto: Boolean(updated.avatar.photoUrl),
          },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'player.updated', payload: { playerId: updated.id } }],
      };
    });
  },

  async updatePlayerAvatar(input: {
    playerId: string;
    avatar: Avatar;
    actorUserId: string;
  }): Promise<Player | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'player.updateOwnAvatar', {
        targetPlayerId: input.playerId,
      });
      const idx = db.players.findIndex((p) => p.id === input.playerId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };

      const before = db.players[idx];
      const validatedAvatar = validatePlayerAvatarInput(input.avatar, before);
      const updated: Player = { ...before, avatar: validatedAvatar };
      db.players[idx] = updated;

      const photoRemoved = Boolean(before.avatar.photoUrl && !validatedAvatar.photoUrl);
      const photoUploaded = Boolean(validatedAvatar.photoUrl && validatedAvatar.photoUrl !== before.avatar.photoUrl);

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: photoRemoved
            ? 'player.removePhoto'
            : photoUploaded
              ? 'player.uploadPhoto'
              : 'player.updateAvatar',
          entityType: 'player',
          entityId: updated.id,
          summary: photoRemoved
            ? `Removed profile photo for ${updated.fullName} (reverted to 3D avatar ${updated.avatar.avatarKey})`
            : photoUploaded
              ? `Updated profile photo for ${updated.fullName}`
              : `Changed 3D avatar for ${updated.fullName} to ${updated.avatar.avatarKey}`,
          summaryAr: photoRemoved
            ? `تم حذف الصورة الشخصية للاعب ${updated.fullNameAr}`
            : photoUploaded
              ? `تم تحديث الصورة الشخصية للاعب ${updated.fullNameAr}`
              : `تم تغيير الأفاتار ثلاثي الأبعاد للاعب ${updated.fullNameAr}`,
          before: {
            avatarKey: before.avatar.avatarKey,
            hasPhoto: Boolean(before.avatar.photoUrl),
          },
          after: {
            avatarKey: updated.avatar.avatarKey,
            hasPhoto: Boolean(updated.avatar.photoUrl),
          },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'player.updated', payload: { playerId: updated.id } }],
      };
    });
  },

  async updateOwnPlayerProfile(input: {
    playerId: string;
    patch: {
      nickname?: string;
      nicknameAr?: string;
      avatar?: Avatar;
    };
    actorUserId: string;
  }): Promise<Player | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'player.updateOwnProfile', {
        targetPlayerId: input.playerId,
      });
      const idx = db.players.findIndex((p) => p.id === input.playerId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };

      const before = db.players[idx];
      const nextNick = input.patch.nickname !== undefined
        ? input.patch.nickname.trim()
        : before.nickname;
      if (!nextNick) {
        throw new CommandValidationError('Nickname cannot be empty.');
      }
      const nextNickAr = input.patch.nicknameAr !== undefined
        ? input.patch.nicknameAr.trim() || nextNick
        : before.nicknameAr;

      const nextAvatar = input.patch.avatar
        ? validatePlayerAvatarInput(input.patch.avatar, before)
        : before.avatar;

      const updated: Player = {
        ...before,
        nickname: nextNick,
        nicknameAr: nextNickAr,
        avatar: nextAvatar,
      };
      db.players[idx] = updated;

      // Sync linked player user display name if one exists
      const uIdx = db.users.findIndex((u) => u.playerId === updated.id);
      if (uIdx !== -1) {
        const u = db.users[uIdx];
        db.users[uIdx] = {
          ...u,
          name: `${updated.fullName} "${updated.nickname}"`,
          nameAr: `${updated.fullNameAr} "${updated.nicknameAr}"`,
        };
      }

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'player.updateOwnProfile',
          entityType: 'player',
          entityId: updated.id,
          summary: `Updated profile/avatar for ${updated.fullName} ("${updated.nickname}")`,
          summaryAr: `تم تحديث الملف الشخصي والصورة للاعب ${updated.fullNameAr} ("${updated.nicknameAr}")`,
          before: {
            nickname: before.nickname,
            nicknameAr: before.nicknameAr,
            avatarKey: before.avatar.avatarKey,
            hasPhoto: Boolean(before.avatar.photoUrl),
          },
          after: {
            nickname: updated.nickname,
            nicknameAr: updated.nicknameAr,
            avatarKey: updated.avatar.avatarKey,
            hasPhoto: Boolean(updated.avatar.photoUrl),
          },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: [
          { event: 'player.updated', payload: { playerId: updated.id } },
          ...(uIdx !== -1
            ? [{ event: 'user.updated' as RealtimeEventName, payload: { userId: db.users[uIdx].id } }]
            : []),
        ],
      };
    });
  },

  /**
   * Records gate arrival check-in via append-only CheckInEvent.
   * Player.status is derived by the pure engine from CheckInEvents + match progression.
   */
  async recordCheckIn(input: {
    playerId: string;
    status: CheckInStatus;
    actorUserId: string;
  }): Promise<Player | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      const actor = assertRepoPermission(db, input.actorUserId, 'player.checkIn');
      const allowed: readonly CheckInStatus[] = ['registered', 'checkedIn', 'absent'];
      if (!allowed.includes(input.status)) {
        throw new PermissionDeniedError(
          'player.checkIn',
          actor?.role ?? null,
          'Check-in only accepts arrival statuses: registered, checkedIn, or absent.'
        );
      }

      const target = db.players.find((p) => p.id === input.playerId);
      if (!target || target.isGuest || target.isHost) {
        return { result: null, nextDb: db, broadcasts: [] };
      }

      const event: CheckInEvent = {
        id: nextId('ci'),
        playerId: target.id,
        status: input.status,
        byUserId: input.actorUserId,
        createdAt: nextIsoTimestamp(),
      };
      db.checkInEvents.unshift(event);

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      const updated = db.players.find((p) => p.id === target.id)!;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action:
            input.status === 'checkedIn'
              ? 'player.checkIn'
              : input.status === 'absent'
                ? 'player.markAbsent'
                : 'player.statusChange',
          entityType: 'player',
          entityId: target.id,
          summary: `Recorded gate arrival "${input.status}" for ${target.fullName}`,
          summaryAr: `تسجيل حالة الوصول "${input.status}" للاعب ${target.fullNameAr}`,
          before: { status: target.status },
          after: { arrivalEvent: input.status, derivedStatus: updated.status },
        })
      );

      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'player.updated', payload: { playerId: target.id } }],
      };
    });
  },

  async removePlayer(input: { playerId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'player.manage');
      const target = db.players.find((p) => p.id === input.playerId);
      if (!target || target.isGuest || target.isHost) {
        return { result: false, nextDb: db, broadcasts: [] };
      }

      const hasEvents =
        db.scoreEvents.some((e) => e.playerId === target.id) ||
        db.absenceEvents.some((e) => e.playerId === target.id) ||
        db.buzzEvents.some((e) => e.playerId === target.id);
      if (hasEvents) {
        throw new CommandValidationError(
          `Cannot delete player "${target.fullName}" because they already have recorded match events.`
        );
      }

      db.players = db.players.filter((p) => p.id !== target.id);
      db.checkInEvents = db.checkInEvents.filter((e) => e.playerId !== target.id);
      db.groups = db.groups.map((g) => ({
        ...g,
        playerIds: g.playerIds.filter((pid) => pid !== target.id),
      }));

      applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
        confirmCascade: true,
      });

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'player.remove',
          entityType: 'player',
          entityId: target.id,
          summary: `Removed player ${target.fullName}`,
          summaryAr: `تم حذف اللاعب ${target.fullNameAr}`,
          before: { fullName: target.fullName, email: target.email },
          after: null,
        })
      );

      return {
        result: true,
        nextDb: db,
        broadcasts: [{ event: 'player.updated', payload: { playerId: target.id } }],
      };
    });
  },

  // --------------------------------------------------------------------------
  // CONTACT VIEW AUDIT (AGENTS.md §15.2)
  // --------------------------------------------------------------------------

  async logContactViewed(input: {
    targetType: 'player' | 'judge';
    targetId: string;
    matchId?: string;
    actorUserId: string;
  }): Promise<void> {
    await commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(
        db,
        input.actorUserId,
        input.targetType === 'player' ? 'contact.viewPlayer' : 'contact.viewJudge',
        {
          targetPlayerId: input.targetType === 'player' ? input.targetId : undefined,
          targetJudgeId: input.targetType === 'judge' ? input.targetId : undefined,
        }
      );

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'contact.viewed',
          entityType: 'contact',
          entityId: input.targetId,
          summary: `Viewed ${input.targetType} contact info (${input.targetId})${input.matchId ? ` for match ${input.matchId}` : ''}`,
          summaryAr: `تم عرض بيانات التواصل (${input.targetId})`,
          before: null,
          after: { targetType: input.targetType, matchId: input.matchId ?? null },
        })
      );

      return { result: undefined, nextDb: db, broadcasts: [] };
    });
  },

  // --------------------------------------------------------------------------
  // CONSISTENCY CHECK & REPAIR BY RECOMPUTATION (AGENTS.md §15.4)
  // --------------------------------------------------------------------------

  async runConsistencyCheck(actorUserId: string): Promise<ConsistencyReport> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'consistency.check');
    return checkInvariants(db);
  },

  async getStorageStats(actorUserId: string) {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'consistency.check');
    return storage.getStoreCounts();
  },

  async repairByRecomputation(actorUserId: string): Promise<{
    beforeReport: ConsistencyReport;
    afterReport: ConsistencyReport;
    repairedCount: number;
  }> {
    return commitCommand(actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, actorUserId, 'consistency.repair');
      const beforeReport = checkInvariants(db);

      // Clean any orphan events referencing non-existent matches/players
      const matchIdSet = new Set(db.matches.map((m) => m.id));
      const playerIdSet = new Set(db.players.map((p) => p.id));
      db.scoreEvents = db.scoreEvents.filter(
        (e) => matchIdSet.has(e.matchId) && playerIdSet.has(e.playerId)
      );
      db.absenceEvents = db.absenceEvents.filter(
        (e) => matchIdSet.has(e.matchId) && playerIdSet.has(e.playerId)
      );
      db.buzzEvents = db.buzzEvents.filter(
        (e) => matchIdSet.has(e.matchId) && playerIdSet.has(e.playerId)
      );
      db.matchEvents = db.matchEvents.filter((e) => matchIdSet.has(e.matchId));
      db.checkInEvents = db.checkInEvents.filter((e) => playerIdSet.has(e.playerId));

      // Re-run pure engine propagation across the entire tournament
      const propagated = propagateWinners({
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
      });

      db.players = propagated.players;
      db.rounds = propagated.rounds;
      db.matches = propagated.matches.map((m) => ({ ...m, version: m.version + 1 }));

      const afterReport = checkInvariants(db);
      const repairedCount = Math.max(
        0,
        beforeReport.violations.length - afterReport.violations.length
      );

      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId,
          action: 'system.repairConsistency',
          entityType: 'system',
          entityId: 'consistency-check',
          summary: `Repaired database projections by recomputation: ${beforeReport.violations.length} violation(s) → ${afterReport.violations.length} remaining.`,
          summaryAr: `تم إصلاح البيانات بإعادة الحساب: ${beforeReport.violations.length} تعارض ← ${afterReport.violations.length} متبقي.`,
          before: { violationsCount: beforeReport.violations.length },
          after: { violationsCount: afterReport.violations.length, repairedCount },
        })
      );

      return {
        result: { beforeReport, afterReport, repairedCount },
        nextDb: db,
        fullReplace: true,
        skipInvariants: true,
        broadcasts: [
          {
            event: 'consistency.repaired',
            payload: { violationsRepaired: repairedCount },
          },
          { event: 'bracket.updated', payload: {} },
          { event: 'player.updated', payload: {} },
        ],
      };
    });
  },

  // --------------------------------------------------------------------------
  // ROUNDS, USERS, SEGMENTS, CONTENT, SPONSORS, SETTINGS, RESET
  // --------------------------------------------------------------------------

  async createRound(input: {
    name: Round['name'];
    advancePerGame: number;
    stage?: Round['stage'];
    order?: number;
    actorUserId: string;
  }): Promise<Round> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const nextOrder =
        input.order ?? db.rounds.reduce((max, r) => Math.max(max, r.order), 0) + 1;
      const newRound: Round = {
        id: nextId('round'),
        name: input.name,
        order: nextOrder,
        stage: input.stage ?? 'knockout',
        advancePerGame: Math.max(1, input.advancePerGame),
        status: 'upcoming',
      };
      db.rounds.push(newRound);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'bracket.roundCreate',
          entityType: 'round',
          entityId: newRound.id,
          summary: `Created round "${newRound.name.en}"`,
          summaryAr: `تم إنشاء جولة "${newRound.name.ar}"`,
          before: null,
          after: { nameEn: newRound.name.en, order: newRound.order },
        })
      );
      return {
        result: newRound,
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { roundId: newRound.id } }],
      };
    });
  },

  async updateRound(input: {
    roundId: string;
    patch: { name?: Round['name']; advancePerGame?: number; order?: number };
    actorUserId: string;
  }): Promise<Round | null> {
    return commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const idx = db.rounds.findIndex((r) => r.id === input.roundId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const before = db.rounds[idx];
      db.rounds[idx] = {
        ...before,
        name: input.patch.name ?? before.name,
        advancePerGame: input.patch.advancePerGame ?? before.advancePerGame,
        order: input.patch.order ?? before.order,
      };
      applyPropagationAndCascade(beforeDb, db, input.actorUserId, { confirmCascade: true });
      const updated = db.rounds.find((r) => r.id === input.roundId)!;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'bracket.update',
          entityType: 'round',
          entityId: updated.id,
          summary: `Updated round "${updated.name.en}"`,
          summaryAr: `تم تحديث الجولة "${updated.name.ar}"`,
          before: { nameEn: before.name.en, advancePerGame: before.advancePerGame },
          after: { nameEn: updated.name.en, advancePerGame: updated.advancePerGame },
        })
      );
      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { roundId: updated.id } }],
      };
    });
  },

  async removeRound(input: { roundId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'bracket.manage');
      const target = db.rounds.find((r) => r.id === input.roundId);
      if (!target) return { result: false, nextDb: db, broadcasts: [] };
      const roundMatchIds = new Set(
        db.matches.filter((m) => m.roundId === input.roundId && !m.isDemo).map((m) => m.id)
      );
      if (db.scoreEvents.some((e) => roundMatchIds.has(e.matchId))) {
        throw new CommandValidationError('Cannot remove a round that already has recorded match events.');
      }
      db.rounds = db.rounds.filter((r) => r.id !== input.roundId);
      db.matches = db.matches.filter((m) => m.roundId !== input.roundId || m.isDemo);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'bracket.roundRemove',
          entityType: 'round',
          entityId: target.id,
          summary: `Removed round "${target.name.en}"`,
          summaryAr: `تم حذف الجولة "${target.name.ar}"`,
          before: { nameEn: target.name.en },
          after: null,
        })
      );
      return {
        result: true,
        nextDb: db,
        broadcasts: [{ event: 'bracket.updated', payload: { roundId: target.id } }],
      };
    });
  },

  async createUser(input: Omit<User, 'id'> & { actorUserId: string }): Promise<User> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'user.manage');
      const { actorUserId, ...rest } = input;
      const newUser: User = {
        ...rest,
        id: nextId('user'),
        name: rest.name.trim(),
        nameAr: rest.nameAr?.trim() || rest.name.trim(),
        email: rest.email.trim().toLowerCase(),
      };
      db.users.push(newUser);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId,
          action: 'user.create',
          entityType: 'user',
          entityId: newUser.id,
          summary: `Created manager/user ${newUser.name} (${newUser.role})`,
          summaryAr: `تم إنشاء حساب ${newUser.nameAr} (${newUser.role})`,
          before: null,
          after: { name: newUser.name, role: newUser.role, email: newUser.email },
        })
      );
      return {
        result: newUser,
        nextDb: db,
        broadcasts: [{ event: 'user.updated', payload: { userId: newUser.id } }],
      };
    });
  },

  async updateUser(input: {
    userId: string;
    patch: Partial<Omit<User, 'id'>>;
    actorUserId: string;
  }): Promise<User | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'user.manage');
      const idx = db.users.findIndex((u) => u.id === input.userId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const before = db.users[idx];
      const safePatch =
        input.userId === 'user-admin' && input.patch.role && input.patch.role !== 'superAdmin'
          ? { ...input.patch, role: 'superAdmin' as const }
          : input.patch;
      const updated: User = { ...before, ...safePatch };
      db.users[idx] = updated;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: before.role !== updated.role ? 'role.change' : 'user.update',
          entityType: 'user',
          entityId: updated.id,
          summary:
            before.role !== updated.role
              ? `Changed role for ${updated.name}: ${before.role} → ${updated.role}`
              : `Updated user ${updated.name}`,
          summaryAr: `تم تحديث بيانات ${updated.nameAr || updated.name}`,
          before: { role: before.role, name: before.name },
          after: { role: updated.role, name: updated.name },
        })
      );
      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'user.updated', payload: { userId: updated.id } }],
      };
    });
  },

  async removeUser(input: { userId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'user.manage');
      const target = db.users.find((u) => u.id === input.userId);
      if (!target || target.id === 'user-admin' || target.id === input.actorUserId) {
        return { result: false, nextDb: db, broadcasts: [] };
      }
      if (
        target.role === 'superAdmin' &&
        db.users.filter((u) => u.role === 'superAdmin').length <= 1
      ) {
        return { result: false, nextDb: db, broadcasts: [] };
      }
      db.users = db.users.filter((u) => u.id !== target.id);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'user.remove',
          entityType: 'user',
          entityId: target.id,
          summary: `Removed user ${target.name} (${target.role})`,
          summaryAr: `تم حذف المستخدم ${target.nameAr || target.name}`,
          before: { name: target.name, role: target.role },
          after: null,
        })
      );
      return {
        result: true,
        nextDb: db,
        broadcasts: [{ event: 'user.updated', payload: { userId: target.id } }],
      };
    });
  },

  async createSegment(
    input: Omit<Segment, 'id' | 'order'> & { order?: number; actorUserId: string }
  ): Promise<Segment> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'segment.manage');
      const { actorUserId, ...rest } = input;
      const nextOrder =
        rest.order ?? db.segments.reduce((max, s) => Math.max(max, s.order), 0) + 1;
      const seg: Segment = { ...rest, id: nextId('seg'), order: nextOrder };
      db.segments.push(seg);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId,
          action: 'segment.create',
          entityType: 'segment',
          entityId: seg.id,
          summary: `Created segment "${seg.nameEn}"`,
          summaryAr: `تم إضافة فقرة "${seg.nameAr}"`,
          before: null,
          after: { nameEn: seg.nameEn, category: seg.category },
        })
      );
      return {
        result: seg,
        nextDb: db,
        broadcasts: [{ event: 'segment.updated', payload: { segmentId: seg.id } }],
      };
    });
  },

  async updateSegment(input: {
    segmentId: string;
    patch: Partial<Omit<Segment, 'id'>>;
    actorUserId: string;
  }): Promise<Segment | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      const actor = assertRepoPermission(db, input.actorUserId, 'segment.editCopy');
      const idx = db.segments.findIndex((s) => s.id === input.segmentId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const before = db.segments[idx];
      if (actor?.role === 'content') {
        const restricted =
          (input.patch.category !== undefined && input.patch.category !== before.category) ||
          (input.patch.durationSec !== undefined &&
            input.patch.durationSec !== before.durationSec) ||
          (input.patch.order !== undefined && input.patch.order !== before.order);
        if (restricted) {
          throw new PermissionDeniedError(
            'segment.manage',
            'content',
            'Content managers may only edit segment descriptions and titles.'
          );
        }
      }
      const updated: Segment = { ...before, ...input.patch };
      db.segments[idx] = updated;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'segment.update',
          entityType: 'segment',
          entityId: updated.id,
          summary: `Updated segment "${updated.nameEn}"`,
          summaryAr: `تم تحديث فقرة "${updated.nameAr}"`,
          before: { nameEn: before.nameEn, descriptionEn: before.descriptionEn },
          after: { nameEn: updated.nameEn, descriptionEn: updated.descriptionEn },
        })
      );
      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'segment.updated', payload: { segmentId: updated.id } }],
      };
    });
  },

  async reorderSegments(input: {
    orderedIds: string[];
    actorUserId: string;
  }): Promise<Segment[]> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'segment.manage');
      const byId = new Map(db.segments.map((s) => [s.id, s]));
      const nextList: Segment[] = [];
      let order = 1;
      for (const id of input.orderedIds) {
        const s = byId.get(id);
        if (s) {
          nextList.push({ ...s, order: order++ });
          byId.delete(id);
        }
      }
      byId.forEach((s) => nextList.push({ ...s, order: order++ }));
      db.segments = nextList;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'segment.reorder',
          entityType: 'segment',
          entityId: 'segment-library',
          summary: `Reordered ${nextList.length} segments`,
          summaryAr: `تم إعادة ترتيب ${nextList.length} فقرة`,
          before: null,
          after: { order: nextList.map((s) => s.id) },
        })
      );
      return {
        result: nextList,
        nextDb: db,
        broadcasts: [{ event: 'segment.updated', payload: {} }],
      };
    });
  },

  async removeSegment(input: { segmentId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'segment.manage');
      const target = db.segments.find((s) => s.id === input.segmentId);
      if (!target || input.segmentId === 'seg-16') {
        return { result: false, nextDb: db, broadcasts: [] };
      }
      db.segments = db.segments
        .filter((s) => s.id !== input.segmentId)
        .sort((a, b) => a.order - b.order)
        .map((s, idx) => ({ ...s, order: idx + 1 }));
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'segment.remove',
          entityType: 'segment',
          entityId: target.id,
          summary: `Removed segment "${target.nameEn}"`,
          summaryAr: `تم حذف فقرة "${target.nameAr}"`,
          before: { nameEn: target.nameEn },
          after: null,
        })
      );
      return {
        result: true,
        nextDb: db,
        broadcasts: [{ event: 'segment.updated', payload: { segmentId: target.id } }],
      };
    });
  },

  async createContent(
    input: Omit<ContentItem, 'id' | 'updatedAt'> & { actorUserId: string }
  ): Promise<ContentItem> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'content.manage');
      const { actorUserId, ...rest } = input;
      const item: ContentItem = {
        ...rest,
        id: nextId('content'),
        order:
          rest.order ??
          db.contentItems.reduce((max, c) => Math.max(max, c.order), 0) + 1,
        updatedAt: nextIsoTimestamp(),
      };
      db.contentItems.push(item);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId,
          action: 'content.create',
          entityType: 'content',
          entityId: item.id,
          summary: `Created content "${item.titleEn}"`,
          summaryAr: `تمت إضافة محتوى "${item.titleAr}"`,
          before: null,
          after: { titleEn: item.titleEn, category: item.category },
        })
      );
      return {
        result: item,
        nextDb: db,
        broadcasts: [{ event: 'content.updated', payload: { contentId: item.id } }],
      };
    });
  },

  async updateContent(input: {
    contentId: string;
    patch: Partial<Omit<ContentItem, 'id'>>;
    actorUserId: string;
  }): Promise<ContentItem | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'content.manage');
      const idx = db.contentItems.findIndex((c) => c.id === input.contentId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const before = db.contentItems[idx];
      const updated: ContentItem = {
        ...before,
        ...input.patch,
        updatedAt: nextIsoTimestamp(),
      };
      db.contentItems[idx] = updated;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'content.update',
          entityType: 'content',
          entityId: updated.id,
          summary: `Updated content "${updated.titleEn}"`,
          summaryAr: `تم تحديث المحتوى "${updated.titleAr}"`,
          before: { titleEn: before.titleEn },
          after: { titleEn: updated.titleEn },
        })
      );
      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'content.updated', payload: { contentId: updated.id } }],
      };
    });
  },

  async reorderContent(input: {
    orderedIds: string[];
    actorUserId: string;
  }): Promise<ContentItem[]> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'content.manage');
      const byId = new Map(db.contentItems.map((c) => [c.id, c]));
      const nextList: ContentItem[] = [];
      let order = 1;
      for (const id of input.orderedIds) {
        const item = byId.get(id);
        if (item) {
          nextList.push({ ...item, order: order++ });
          byId.delete(id);
        }
      }
      byId.forEach((item) => nextList.push({ ...item, order: order++ }));
      db.contentItems = nextList;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'content.reorder',
          entityType: 'content',
          entityId: 'content-list',
          summary: `Reordered ${nextList.length} content items`,
          summaryAr: `تم إعادة ترتيب ${nextList.length} عنصر محتوى`,
        })
      );
      return {
        result: nextList,
        nextDb: db,
        broadcasts: [{ event: 'content.updated', payload: {} }],
      };
    });
  },

  async removeContent(input: { contentId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'content.manage');
      const target = db.contentItems.find((c) => c.id === input.contentId);
      if (!target) return { result: false, nextDb: db, broadcasts: [] };
      db.contentItems = db.contentItems.filter((c) => c.id !== input.contentId);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'content.remove',
          entityType: 'content',
          entityId: target.id,
          summary: `Removed content "${target.titleEn}"`,
          summaryAr: `تم حذف المحتوى "${target.titleAr}"`,
        })
      );
      return {
        result: true,
        nextDb: db,
        broadcasts: [{ event: 'content.updated', payload: { contentId: target.id } }],
      };
    });
  },

  async createSponsor(
    input: Omit<Sponsor, 'id'> & { actorUserId: string }
  ): Promise<Sponsor> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'sponsor.manage');
      const { actorUserId, ...rest } = input;
      const sponsor: Sponsor = {
        ...rest,
        id: nextId('sponsor'),
        order:
          rest.order || db.sponsors.reduce((max, s) => Math.max(max, s.order), 0) + 1,
      };
      db.sponsors.push(sponsor);
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId,
          action: 'sponsor.create',
          entityType: 'sponsor',
          entityId: sponsor.id,
          summary: `Added sponsor "${sponsor.name}"`,
          summaryAr: `تمت إضافة الراعي "${sponsor.nameAr || sponsor.name}"`,
        })
      );
      return {
        result: sponsor,
        nextDb: db,
        broadcasts: [{ event: 'sponsor.updated', payload: { sponsorId: sponsor.id } }],
      };
    });
  },

  async updateSponsor(input: {
    sponsorId: string;
    patch: Partial<Omit<Sponsor, 'id'>>;
    actorUserId: string;
  }): Promise<Sponsor | null> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'sponsor.manage');
      const idx = db.sponsors.findIndex((s) => s.id === input.sponsorId);
      if (idx === -1) return { result: null, nextDb: db, broadcasts: [] };
      const before = db.sponsors[idx];
      const updated: Sponsor = { ...before, ...input.patch };
      db.sponsors[idx] = updated;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'sponsor.update',
          entityType: 'sponsor',
          entityId: updated.id,
          summary: `Updated sponsor "${updated.name}"`,
          summaryAr: `تم تحديث الراعي "${updated.nameAr || updated.name}"`,
        })
      );
      return {
        result: updated,
        nextDb: db,
        broadcasts: [{ event: 'sponsor.updated', payload: { sponsorId: updated.id } }],
      };
    });
  },

  async reorderSponsors(input: {
    orderedIds: string[];
    actorUserId: string;
  }): Promise<Sponsor[]> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'sponsor.manage');
      const byId = new Map(db.sponsors.map((s) => [s.id, s]));
      const nextList: Sponsor[] = [];
      let order = 1;
      for (const id of input.orderedIds) {
        const s = byId.get(id);
        if (s) {
          nextList.push({ ...s, order: order++ });
          byId.delete(id);
        }
      }
      byId.forEach((s) => nextList.push({ ...s, order: order++ }));
      db.sponsors = nextList;
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'sponsor.reorder',
          entityType: 'sponsor',
          entityId: 'sponsors-list',
          summary: `Reordered ${nextList.length} sponsor tiers`,
          summaryAr: `تم إعادة ترتيب ${nextList.length} من فئات الرعاة`,
        })
      );
      return {
        result: nextList,
        nextDb: db,
        broadcasts: [{ event: 'sponsor.updated', payload: {} }],
      };
    });
  },

  async removeSponsor(input: { sponsorId: string; actorUserId: string }): Promise<boolean> {
    return commitCommand(input.actorUserId, (_beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'sponsor.manage');
      const target = db.sponsors.find((s) => s.id === input.sponsorId);
      if (!target) return { result: false, nextDb: db, broadcasts: [] };
      db.sponsors = db.sponsors
        .filter((s) => s.id !== input.sponsorId)
        .sort((a, b) => a.order - b.order)
        .map((s, idx) => ({ ...s, order: idx + 1 }));
      db.auditEntries.unshift(
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'sponsor.remove',
          entityType: 'sponsor',
          entityId: target.id,
          summary: `Removed sponsor "${target.name}"`,
          summaryAr: `تم حذف الراعي "${target.nameAr || target.name}"`,
        })
      );
      return {
        result: true,
        nextDb: db,
        broadcasts: [{ event: 'sponsor.updated', payload: { sponsorId: target.id } }],
      };
    });
  },

  async updateSettings(input: {
    patch: Partial<Omit<Settings, 'id'>>;
    actorUserId: string;
    confirmCascade?: boolean;
    cascadePolicy?: CascadePolicy;
    confirmStructuralRebuild?: boolean;
    rebuildTournament?: boolean;
    rescheduleUpcoming?: boolean;
  }): Promise<Settings> {
    const saved = await commitCommand(input.actorUserId, (beforeDb, db) => {
      assertRepoPermission(db, input.actorUserId, 'settings.manage');
      const before = db.settings;
      const nextTournament: TournamentSettings = input.patch.tournament
        ? { ...before.tournament, ...input.patch.tournament }
        : before.tournament;

      const validation = validateTournamentSettings(nextTournament);
      if (!validation.valid) {
        throw new CommandValidationError(validation.errors[0].messageEn);
      }

      const structuralChanged =
        before.tournament.totalPlayers !== nextTournament.totalPlayers ||
        before.tournament.groupSize !== nextTournament.groupSize ||
        before.tournament.advancePerGroup !== nextTournament.advancePerGroup ||
        before.tournament.includeFinalWithMarwan !== nextTournament.includeFinalWithMarwan;

      const scheduleChanged =
        before.tournament.tablesCount !== nextTournament.tablesCount ||
        before.tournament.slotMinutes !== nextTournament.slotMinutes;

      const progress = getTournamentProgress(
        db.matches,
        db.scoreEvents,
        db.absenceEvents,
        db.matchEvents
      );

      if (structuralChanged && progress.started && !input.confirmStructuralRebuild) {
        throw new CommandValidationError(
          `Tournament already started (${progress.liveCount} live, ${progress.finishedCount} finished). Confirm Impact Preview before applying structural settings.`
        );
      }

      const updated: Settings = {
        ...before,
        ...input.patch,
        tournament: nextTournament,
        bracketConfig:
          input.patch.bracketConfig ?? buildBracketConfigCompat(nextTournament),
        updatedAt: nextIsoTimestamp(),
      };
      db.settings = updated;

      let cascadeAuditEntries: AuditEntry[] = [];
      let cascadeBroadcasts: RealtimeBroadcast[] = [];

      // Schedule-only update: conflict-free reschedule of upcoming scheduled matches
      if (scheduleChanged && (input.rescheduleUpcoming ?? true) && !structuralChanged) {
        db.matches = autoScheduleMatches(
          db.matches,
          db.users,
          nextTournament,
          '2027-03-05T19:00:00.000Z',
          { onlyScheduled: true }
        );
      }

      // Scoring-only update (pointsPerGroupWin) or non-rebuild update: recompute via engine cascade
      if (
        !structuralChanged &&
        before.tournament.pointsPerGroupWin !== nextTournament.pointsPerGroupWin
      ) {
        const res = applyPropagationAndCascade(beforeDb, db, input.actorUserId, {
          confirmCascade: input.confirmCascade ?? false,
          cascadePolicy: input.cascadePolicy,
        });
        cascadeAuditEntries = res.cascadeAuditEntries;
        cascadeBroadcasts = res.cascadeBroadcasts;
      }

      db.auditEntries.unshift(
        ...cascadeAuditEntries,
        createAuditRecord({
          actorUserId: input.actorUserId,
          action: 'settings.update',
          entityType: 'settings',
          entityId: 'global-settings',
          summary: 'Updated tournament settings & placeholders',
          summaryAr: 'تم تحديث إعدادات البطولة والبيانات المبدئية',
          before: { eventName: before.eventName, tournament: before.tournament },
          after: { eventName: updated.eventName, tournament: updated.tournament },
        })
      );

      return {
        result: { updated, needsStructuralRebuild: structuralChanged && (input.rebuildTournament ?? true) },
        nextDb: db,
        broadcasts: [
          { event: 'settings.updated', payload: { keys: Object.keys(input.patch) } },
          { event: 'bracket.updated', payload: {} },
          ...cascadeBroadcasts,
        ],
      };
    });

    if (saved.needsStructuralRebuild) {
      await this.generateTournament({
        tournament: saved.updated.tournament,
        actorUserId: input.actorUserId,
        confirmStructuralRebuild: true,
      });
    }

    return saved.updated;
  },

  async resetDemoData(input?: {
    actorUserId?: string;
    seedOptions?: CreateSeedOptions;
  }): Promise<Settings> {
    const actorUserId = input?.actorUserId ?? 'user-admin';
    return runSerialized(async () => {
      const currentDb = await storage.readSnapshot();
      assertRepoPermission(currentDb, actorUserId, 'settings.manage');

      const freshDb = await storage.resetToSeed(input?.seedOptions);
      const resetAudit = createAuditRecord({
        actorUserId,
        action: 'system.reset',
        entityType: 'system',
        entityId: 'global-settings',
        summary: `Reset tournament demo data to factory seed (${freshDb.settings.tournament.totalPlayers} players, ${freshDb.groups.length} groups).`,
        summaryAr: `تمت إعادة ضبط البيانات التجريبية (${freshDb.settings.tournament.totalPlayers} لاعب).`,
        before: null,
        after: {
          version: freshDb.version,
          totalPlayers: freshDb.settings.tournament.totalPlayers,
        },
      });
      freshDb.auditEntries.unshift(resetAudit);
      await storage.commitDelta({ putAuditEntries: [resetAudit] }, freshDb);
      realtime.publish('data.reset', { reason: 'admin-reset' });
      return freshDb.settings;
    });
  },
};

export * from './errors';
