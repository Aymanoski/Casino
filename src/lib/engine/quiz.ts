import type {
  DatabaseSnapshot,
  Player,
  PublicQuizQuestionPayload,
  QuizApplicant,
  QuizAttempt,
  QuizAttemptEvent,
  QuizHandoffEvent,
  QuizQuestion,
  QuizSettings,
  TournamentSettings,
} from '@/lib/schemas';
import type { InvariantViolation } from './types';

/**
 * Pure Registration Quiz Engine (/lib/engine/quiz.ts)
 *
 * ZERO UI imports, ZERO React imports, ZERO storage imports, ZERO realtime imports.
 * Every derived quiz field (shuffled question order, shuffled answer order, deadlines,
 * score, total response time, attempt status, ranking, cutoff qualification,
 * histogram, integrity flags, handoff impact preview, and consistency invariants)
 * is computed deterministically here from immutable attempts + append-only events.
 */

export type QuizWindowStatus = 'upcoming' | 'open' | 'closed';

export interface QuizWindowState {
  status: QuizWindowStatus;
  startsAtMs: number;
  endsAtMs: number;
  msUntilStart: number;
  msUntilEnd: number;
}

export type DerivedQuizAttemptStatus =
  | 'in_progress'
  | 'finished'
  | 'abandoned'
  | 'reset';

export type DerivedQualificationStatus =
  | 'qualified'
  | 'waitlisted'
  | 'in_progress'
  | 'abandoned'
  | 'not_started';

export interface DerivedQuestionTimelineItem {
  questionIndex: number;
  questionId: string;
  shuffledOptionOrder: [number, number, number, number];
  outcome: 'correct' | 'wrong' | 'timed_out' | 'pending' | 'unseen';
  selectedOptionIndex?: number;
  displayedSlotIndex?: number;
  correctOptionIndex: number;
  shownAt?: string;
  deadlineAt?: string;
  answeredAt?: string;
  responseTimeMs: number;
}

export interface DerivedIntegrityCounts {
  visibilityHidden: number;
  pageRefresh: number;
  copyAttempt: number;
  total: number;
}

export interface DerivedQuizAttempt {
  attempt: QuizAttempt;
  status: DerivedQuizAttemptStatus;
  score: number;
  questionsCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  timedOutCount: number;
  totalResponseTimeMs: number;
  startedAt: string;
  submittedAt: string | null;
  currentQuestionIndex: number;
  activeQuestionId: string | null;
  activeQuestionShownAt: string | null;
  activeQuestionDeadlineAt: string | null;
  activeQuestionRemainingMs: number | null;
  resetAt: string | null;
  resetReason: string | null;
  resetByUserId: string | null;
  integrity: DerivedIntegrityCounts;
  isFlagged: boolean;
  timeline: DerivedQuestionTimelineItem[];
}

export interface DerivedApplicantResultRow {
  applicant: QuizApplicant;
  activeAttempt: DerivedQuizAttempt | null;
  priorResetCount: number;
  status: DerivedQualificationStatus;
  rank: number | null;
  score: number | null;
  totalResponseTimeMs: number | null;
  submittedAt: string | null;
  qualified: boolean;
  handedOffPlayerId: string | null;
  handedOffAt: string | null;
  integrity: DerivedIntegrityCounts;
  isFlagged: boolean;
}

export interface QuizScoreHistogramBin {
  score: number;
  totalCount: number;
  qualifiedCount: number;
  waitlistedCount: number;
}

export interface QuizDashboardStats {
  totalApplicants: number;
  verifiedApplicants: number;
  totalActiveAttempts: number;
  finishedCount: number;
  inProgressCount: number;
  abandonedCount: number;
  notStartedCount: number;
  resetAttemptsCount: number;
  completionRate: number;
  averageScore: number;
  averageResponseTimeMs: number;
  flaggedCount: number;
  cutoffN: number;
  cutoffScore: number | null;
  cutoffTimeMs: number | null;
  qualifiedCount: number;
  waitlistedCount: number;
  handedOffCount: number;
  scoreHistogram: QuizScoreHistogramBin[];
}

export interface DerivedQuizBoard {
  rows: DerivedApplicantResultRow[];
  rowByApplicantId: Map<string, DerivedApplicantResultRow>;
  attemptById: Map<string, DerivedQuizAttempt>;
  stats: QuizDashboardStats;
}

export interface QuizHandoffPreviewItem {
  applicantId: string;
  attemptId: string;
  fullName: string;
  fullNameAr: string;
  phone: string;
  email: string;
  rank: number;
  score: number;
  totalResponseTimeMs: number;
  existingPlayerId?: string;
  reasonEn?: string;
  reasonAr?: string;
}

export interface QuizHandoffPreview {
  cutoffN: number;
  totalQualified: number;
  newPlayersToCreate: QuizHandoffPreviewItem[];
  alreadyHandedOff: QuizHandoffPreviewItem[];
  duplicateExistingPlayers: QuizHandoffPreviewItem[];
  conflicts: QuizHandoffPreviewItem[];
  summaryEn: string;
  summaryAr: string;
}

// ---------------------------------------------------------------------------
// Normalization & Deterministic Seeded PRNG
// ---------------------------------------------------------------------------

export function normalizeQuizPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0020') && digits.length >= 14) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith('20') && digits.length === 12 && digits[2] === '1') {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function normalizeQuizEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function hashSeedToUint32(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createSeededRng(seed: string): () => number {
  let a = hashSeedToUint32(seed) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle<T>(
  items: readonly T[],
  seed: string
): T[] {
  const arr = [...items];
  const rng = createSeededRng(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Settings, Window & Question Pool Helpers
// ---------------------------------------------------------------------------

export function getEffectiveQuizCutoff(
  quizSettings: QuizSettings,
  tournamentSettings: TournamentSettings
): number {
  const raw = quizSettings.syncCutoffWithTournament
    ? tournamentSettings.totalPlayers
    : quizSettings.customCutoffN;
  return Math.max(1, Math.floor(raw));
}

export function getQuizWindowState(
  quizSettings: QuizSettings,
  nowMs: number = Date.now()
): QuizWindowState {
  const startsAtMs = Date.parse(quizSettings.windowStartsAt);
  const endsAtMs = Date.parse(quizSettings.windowEndsAt);
  const safeStart = Number.isFinite(startsAtMs) ? startsAtMs : nowMs - 3600_000;
  const safeEnd = Number.isFinite(endsAtMs) ? endsAtMs : nowMs + 3600_000;

  if (nowMs < safeStart) {
    return {
      status: 'upcoming',
      startsAtMs: safeStart,
      endsAtMs: safeEnd,
      msUntilStart: safeStart - nowMs,
      msUntilEnd: safeEnd - nowMs,
    };
  }
  if (nowMs > safeEnd) {
    return {
      status: 'closed',
      startsAtMs: safeStart,
      endsAtMs: safeEnd,
      msUntilStart: 0,
      msUntilEnd: 0,
    };
  }
  return {
    status: 'open',
    startsAtMs: safeStart,
    endsAtMs: safeEnd,
    msUntilStart: 0,
    msUntilEnd: Math.max(0, safeEnd - nowMs),
  };
}

/**
 * Selects the active question bank pool for attempts:
 * - Uses approved questions exclusively once >= questionsPerAttempt are approved.
 * - Falls back to draft questions in Demo Mode so seeded draft questions remain playable out of the box.
 */
export function selectEligibleQuestionPool(
  questions: readonly QuizQuestion[],
  questionsPerAttempt: number
): {
  pool: QuizQuestion[];
  usingDraftFallback: boolean;
  approvedCount: number;
  draftCount: number;
} {
  const approved = questions.filter((q) => q.reviewStatus === 'approved');
  const draftCount = questions.length - approved.length;
  if (approved.length >= questionsPerAttempt) {
    return {
      pool: approved,
      usingDraftFallback: false,
      approvedCount: approved.length,
      draftCount,
    };
  }
  return {
    pool: [...questions],
    usingDraftFallback: true,
    approvedCount: approved.length,
    draftCount,
  };
}

/**
 * Deterministically selects `count` unique question IDs in shuffled order for an attempt.
 * Sorts by ID first so input storage ordering never alters deterministic replay.
 */
export function selectShuffledQuestionIds(
  questions: readonly QuizQuestion[],
  count: number,
  shuffleSeed: string
): string[] {
  const canonicalIds = [...questions].map((q) => q.id).sort();
  const shuffled = deterministicShuffle(canonicalIds, `questions:${shuffleSeed}`);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Deterministically shuffles answer option indices [0, 1, 2, 3] per (attemptId, questionId, shuffleSeed).
 * Returned tuple maps displayed slotIndex (0..3) -> canonical option index (0..3).
 */
export function getShuffledOptionOrder(
  attemptId: string,
  questionId: string,
  shuffleSeed: string
): [number, number, number, number] {
  const shuffled = deterministicShuffle(
    [0, 1, 2, 3] as const,
    `options:${shuffleSeed}:${attemptId}:${questionId}`
  );
  return [shuffled[0], shuffled[1], shuffled[2], shuffled[3]];
}

/**
 * Builds the public/applicant-safe question payload (never includes correctOptionIndex).
 */
export function buildPublicQuestionPayload(
  question: QuizQuestion,
  attemptId: string,
  questionIndex: number,
  shuffleSeed: string
): PublicQuizQuestionPayload {
  const order = getShuffledOptionOrder(attemptId, question.id, shuffleSeed);
  return {
    id: question.id,
    questionIndex,
    category: question.category,
    difficulty: question.difficulty,
    questionAr: question.questionAr,
    questionEn: question.questionEn,
    shuffledOptions: order.map((canonicalIdx, slotIdx) => ({
      slotIndex: slotIdx as 0 | 1 | 2 | 3,
      canonicalIndex: canonicalIdx as 0 | 1 | 2 | 3,
      labelAr: question.optionsAr[canonicalIdx],
      labelEn: question.optionsEn[canonicalIdx],
    })),
  };
}

// ---------------------------------------------------------------------------
// Pure Event-Sourced Attempt Derivation
// ---------------------------------------------------------------------------

export function deriveAttemptState(
  attempt: QuizAttempt,
  attemptEvents: readonly QuizAttemptEvent[],
  questionById: Map<string, QuizQuestion>,
  nowMs: number = Date.now()
): DerivedQuizAttempt {
  // Sort events chronologically without mutating input
  const sorted =
    attemptEvents.length <= 1
      ? attemptEvents
      : [...attemptEvents].sort((a, b) => {
          const dt = Date.parse(a.createdAt) - Date.parse(b.createdAt);
          return dt !== 0 ? dt : a.id.localeCompare(b.id);
        });

  const shownByIndex = new Map<number, QuizAttemptEvent>();
  const resolvedByIndex = new Map<number, QuizAttemptEvent>();
  let finishedEvent: QuizAttemptEvent | null = null;
  let resetEvent: QuizAttemptEvent | null = null;
  let startedEvent: QuizAttemptEvent | null = null;
  let lastActivityMs = Date.parse(attempt.startedAt) || nowMs;

  const integrity: DerivedIntegrityCounts = {
    visibilityHidden: 0,
    pageRefresh: 0,
    copyAttempt: 0,
    total: 0,
  };

  for (const ev of sorted) {
    const evMs = Date.parse(ev.createdAt);
    if (Number.isFinite(evMs) && evMs > lastActivityMs) {
      lastActivityMs = evMs;
    }

    switch (ev.type) {
      case 'started':
        if (!startedEvent) startedEvent = ev;
        break;
      case 'question_shown':
        if (
          typeof ev.questionIndex === 'number' &&
          !shownByIndex.has(ev.questionIndex)
        ) {
          shownByIndex.set(ev.questionIndex, ev);
        }
        break;
      case 'answered':
      case 'timed_out':
        if (
          typeof ev.questionIndex === 'number' &&
          !resolvedByIndex.has(ev.questionIndex)
        ) {
          resolvedByIndex.set(ev.questionIndex, ev);
        }
        break;
      case 'finished':
        if (!finishedEvent) finishedEvent = ev;
        break;
      case 'reset':
        resetEvent = ev;
        break;
      case 'integrity_signal':
        if (ev.signalType === 'visibility_hidden') {
          integrity.visibilityHidden += 1;
          integrity.total += 1;
        } else if (ev.signalType === 'page_refresh') {
          integrity.pageRefresh += 1;
          integrity.total += 1;
        } else if (ev.signalType === 'copy_attempt') {
          integrity.copyAttempt += 1;
          integrity.total += 1;
        }
        break;
      default:
        break;
    }
  }

  const maxQuestionMs = attempt.secondsPerQuestion * 1000;
  const timeline: DerivedQuestionTimelineItem[] = [];
  let correctCount = 0;
  let wrongCount = 0;
  let timedOutCount = 0;
  let totalResponseTimeMs = 0;
  let firstUnresolvedIndex = -1;
  let lastResolvedAt: string | null = null;

  for (let i = 0; i < attempt.questionIds.length; i += 1) {
    const qId = attempt.questionIds[i];
    const q = questionById.get(qId);
    const correctOptionIndex = q ? q.correctOptionIndex : -1;
    const shuffledOptionOrder = getShuffledOptionOrder(
      attempt.id,
      qId,
      attempt.shuffleSeed
    );
    const shownEv = shownByIndex.get(i);
    const resolvedEv = resolvedByIndex.get(i);

    if (resolvedEv) {
      lastResolvedAt = resolvedEv.createdAt;
      if (resolvedEv.type === 'timed_out') {
        timedOutCount += 1;
        // Timeout always counts as wrong and records full secondsPerQuestion time
        totalResponseTimeMs += maxQuestionMs;
        timeline.push({
          questionIndex: i,
          questionId: qId,
          shuffledOptionOrder,
          outcome: 'timed_out',
          correctOptionIndex,
          shownAt: resolvedEv.shownAt ?? shownEv?.shownAt ?? shownEv?.createdAt,
          deadlineAt: resolvedEv.deadlineAt ?? shownEv?.deadlineAt,
          answeredAt: resolvedEv.createdAt,
          responseTimeMs: maxQuestionMs,
        });
      } else {
        const selected = resolvedEv.selectedOptionIndex;
        const isCorrect =
          typeof selected === 'number' &&
          correctOptionIndex >= 0 &&
          selected === correctOptionIndex;
        if (isCorrect) {
          correctCount += 1;
        } else {
          wrongCount += 1;
        }

        let responseMs = resolvedEv.responseTimeMs;
        if (typeof responseMs !== 'number' || !Number.isFinite(responseMs)) {
          const shownIso = resolvedEv.shownAt ?? shownEv?.shownAt ?? shownEv?.createdAt;
          const shownMs = shownIso ? Date.parse(shownIso) : NaN;
          const ansMs = Date.parse(resolvedEv.createdAt);
          responseMs =
            Number.isFinite(shownMs) && Number.isFinite(ansMs)
              ? Math.max(0, Math.min(maxQuestionMs, ansMs - shownMs))
              : maxQuestionMs;
        } else {
          responseMs = Math.max(0, Math.min(maxQuestionMs, Math.round(responseMs)));
        }

        totalResponseTimeMs += responseMs;
        const displayedSlot =
          typeof resolvedEv.displayedSlotIndex === 'number'
            ? resolvedEv.displayedSlotIndex
            : typeof selected === 'number'
              ? shuffledOptionOrder.indexOf(selected)
              : undefined;

        timeline.push({
          questionIndex: i,
          questionId: qId,
          shuffledOptionOrder,
          outcome: isCorrect ? 'correct' : 'wrong',
          selectedOptionIndex: selected,
          displayedSlotIndex:
            typeof displayedSlot === 'number' && displayedSlot >= 0
              ? displayedSlot
              : undefined,
          correctOptionIndex,
          shownAt: resolvedEv.shownAt ?? shownEv?.shownAt ?? shownEv?.createdAt,
          deadlineAt: resolvedEv.deadlineAt ?? shownEv?.deadlineAt,
          answeredAt: resolvedEv.createdAt,
          responseTimeMs: responseMs,
        });
      }
    } else {
      if (firstUnresolvedIndex === -1) {
        firstUnresolvedIndex = i;
      }
      timeline.push({
        questionIndex: i,
        questionId: qId,
        shuffledOptionOrder,
        outcome: shownEv ? 'pending' : 'unseen',
        correctOptionIndex,
        shownAt: shownEv?.shownAt ?? shownEv?.createdAt,
        deadlineAt: shownEv?.deadlineAt,
        responseTimeMs: 0,
      });
    }
  }

  const answeredCount = correctCount + wrongCount + timedOutCount;
  const allQuestionsDone = answeredCount >= attempt.questionIds.length;
  const staleThresholdMs =
    attempt.questionIds.length * maxQuestionMs + 15 * 60 * 1000;

  let status: DerivedQuizAttemptStatus;
  if (resetEvent) {
    status = 'reset';
  } else if (finishedEvent || allQuestionsDone) {
    status = 'finished';
  } else if (nowMs - lastActivityMs > staleThresholdMs) {
    status = 'abandoned';
  } else {
    status = 'in_progress';
  }

  const currentQuestionIndex =
    status === 'finished' || firstUnresolvedIndex === -1
      ? attempt.questionIds.length
      : firstUnresolvedIndex;

  let activeQuestionId: string | null = null;
  let activeQuestionShownAt: string | null = null;
  let activeQuestionDeadlineAt: string | null = null;
  let activeQuestionRemainingMs: number | null = null;

  if (
    (status === 'in_progress' || status === 'abandoned') &&
    currentQuestionIndex < attempt.questionIds.length
  ) {
    activeQuestionId = attempt.questionIds[currentQuestionIndex];
    const shownEv = shownByIndex.get(currentQuestionIndex);
    if (shownEv) {
      activeQuestionShownAt = shownEv.shownAt ?? shownEv.createdAt;
      const shownMs = Date.parse(activeQuestionShownAt);
      const deadlineIso =
        shownEv.deadlineAt ??
        (Number.isFinite(shownMs)
          ? new Date(shownMs + maxQuestionMs).toISOString()
          : null);
      activeQuestionDeadlineAt = deadlineIso;
      if (deadlineIso) {
        const dlMs = Date.parse(deadlineIso);
        activeQuestionRemainingMs = Number.isFinite(dlMs)
          ? Math.max(0, dlMs - nowMs)
          : 0;
      }
    }
  }

  const submittedAt =
    status === 'finished'
      ? (finishedEvent?.createdAt ?? lastResolvedAt ?? attempt.startedAt)
      : null;

  return {
    attempt,
    status,
    score: correctCount,
    questionsCount: attempt.questionIds.length,
    answeredCount,
    correctCount,
    wrongCount,
    timedOutCount,
    totalResponseTimeMs,
    startedAt: startedEvent?.createdAt ?? attempt.startedAt,
    submittedAt,
    currentQuestionIndex,
    activeQuestionId,
    activeQuestionShownAt,
    activeQuestionDeadlineAt,
    activeQuestionRemainingMs,
    resetAt: resetEvent?.createdAt ?? null,
    resetReason: resetEvent?.reason ?? null,
    resetByUserId: resetEvent?.byUserId ?? null,
    integrity,
    isFlagged: integrity.total > 0,
    timeline,
  };
}

// ---------------------------------------------------------------------------
// Ranking, Cutoff & Dashboard Stats Derivation
// ---------------------------------------------------------------------------

export function compareFinishedAttempts(
  a: DerivedQuizAttempt,
  b: DerivedQuizAttempt
): number {
  // 1. Higher score wins
  if (a.score !== b.score) return b.score - a.score;
  // 2. Lower total response time wins
  if (a.totalResponseTimeMs !== b.totalResponseTimeMs) {
    return a.totalResponseTimeMs - b.totalResponseTimeMs;
  }
  // 3. Earlier submission time wins
  const aSub = a.submittedAt ? Date.parse(a.submittedAt) : Number.MAX_SAFE_INTEGER;
  const bSub = b.submittedAt ? Date.parse(b.submittedAt) : Number.MAX_SAFE_INTEGER;
  if (aSub !== bSub) return aSub - bSub;
  // 4. Deterministic tie-break by attemptId
  return a.attempt.id.localeCompare(b.attempt.id);
}

export function computeQuizRankings(input: {
  applicants: readonly QuizApplicant[];
  attempts: readonly QuizAttempt[];
  events: readonly QuizAttemptEvent[];
  questions: readonly QuizQuestion[];
  handoffs: readonly QuizHandoffEvent[];
  quizSettings: QuizSettings;
  tournamentSettings: TournamentSettings;
  nowMs?: number;
}): DerivedQuizBoard {
  const nowMs = input.nowMs ?? Date.now();
  const cutoffN = getEffectiveQuizCutoff(
    input.quizSettings,
    input.tournamentSettings
  );
  const questionById = new Map(input.questions.map((q) => [q.id, q]));

  // Group events by attemptId in a single O(E) pass
  const eventsByAttempt = new Map<string, QuizAttemptEvent[]>();
  for (const ev of input.events) {
    let arr = eventsByAttempt.get(ev.attemptId);
    if (!arr) {
      arr = [];
      eventsByAttempt.set(ev.attemptId, arr);
    }
    arr.push(ev);
  }

  // Derive every attempt once
  const attemptById = new Map<string, DerivedQuizAttempt>();
  const attemptsByApplicant = new Map<string, DerivedQuizAttempt[]>();
  let resetAttemptsCount = 0;

  for (const attempt of input.attempts) {
    const derived = deriveAttemptState(
      attempt,
      eventsByAttempt.get(attempt.id) ?? [],
      questionById,
      nowMs
    );
    attemptById.set(attempt.id, derived);
    if (derived.status === 'reset') {
      resetAttemptsCount += 1;
    }
    let list = attemptsByApplicant.get(attempt.applicantId);
    if (!list) {
      list = [];
      attemptsByApplicant.set(attempt.applicantId, list);
    }
    list.push(derived);
  }

  // Latest handoff record per applicant
  const handoffByApplicant = new Map<string, QuizHandoffEvent>();
  for (const h of input.handoffs) {
    handoffByApplicant.set(h.applicantId, h);
  }

  // Pick each applicant's active (non-reset) attempt
  const finishedAttempts: DerivedQuizAttempt[] = [];
  const activeAttemptByApplicant = new Map<string, DerivedQuizAttempt | null>();
  const resetCountByApplicant = new Map<string, number>();

  for (const applicant of input.applicants) {
    const list = attemptsByApplicant.get(applicant.id) ?? [];
    const resets = list.filter((a) => a.status === 'reset').length;
    resetCountByApplicant.set(applicant.id, resets);

    const activeList = list
      .filter((a) => a.status !== 'reset')
      .sort(
        (a, b) =>
          Date.parse(b.attempt.createdAt) - Date.parse(a.attempt.createdAt)
      );
    const active = activeList[0] ?? null;
    activeAttemptByApplicant.set(applicant.id, active);

    if (active && active.status === 'finished') {
      finishedAttempts.push(active);
    }
  }

  // Rank finished active attempts deterministically
  finishedAttempts.sort(compareFinishedAttempts);
  const rankByAttemptId = new Map<string, number>();
  for (let i = 0; i < finishedAttempts.length; i += 1) {
    rankByAttemptId.set(finishedAttempts[i].attempt.id, i + 1);
  }

  const maxScoreBin = Math.max(
    input.quizSettings.questionsPerAttempt,
    ...finishedAttempts.map((a) => a.questionsCount),
    20
  );
  const histogramBins: QuizScoreHistogramBin[] = [];
  for (let s = 0; s <= maxScoreBin; s += 1) {
    histogramBins.push({
      score: s,
      totalCount: 0,
      qualifiedCount: 0,
      waitlistedCount: 0,
    });
  }

  let finishedCount = 0;
  let inProgressCount = 0;
  let abandonedCount = 0;
  let notStartedCount = 0;
  let flaggedCount = 0;
  let scoreSum = 0;
  let timeSumMs = 0;
  let qualifiedCount = 0;
  let waitlistedCount = 0;
  let handedOffCount = 0;
  let verifiedApplicants = 0;

  const rows: DerivedApplicantResultRow[] = [];
  const rowByApplicantId = new Map<string, DerivedApplicantResultRow>();

  for (const applicant of input.applicants) {
    if (applicant.verifiedAt) verifiedApplicants += 1;
    const active = activeAttemptByApplicant.get(applicant.id) ?? null;
    const priorResetCount = resetCountByApplicant.get(applicant.id) ?? 0;
    const handoff = handoffByApplicant.get(applicant.id) ?? null;
    if (handoff) handedOffCount += 1;

    let status: DerivedQualificationStatus = 'not_started';
    let rank: number | null = null;
    let score: number | null = null;
    let totalResponseTimeMs: number | null = null;
    let submittedAt: string | null = null;
    let qualified = false;

    const integrity: DerivedIntegrityCounts = active
      ? active.integrity
      : { visibilityHidden: 0, pageRefresh: 0, copyAttempt: 0, total: 0 };
    const isFlagged = Boolean(active?.isFlagged);
    if (isFlagged) flaggedCount += 1;

    if (!active) {
      notStartedCount += 1;
    } else if (active.status === 'finished') {
      finishedCount += 1;
      rank = rankByAttemptId.get(active.attempt.id) ?? null;
      score = active.score;
      totalResponseTimeMs = active.totalResponseTimeMs;
      submittedAt = active.submittedAt;
      qualified = rank !== null && rank <= cutoffN;
      status = qualified ? 'qualified' : 'waitlisted';
      scoreSum += active.score;
      timeSumMs += active.totalResponseTimeMs;

      const bin = histogramBins[Math.min(active.score, histogramBins.length - 1)];
      if (bin) {
        bin.totalCount += 1;
        if (qualified) {
          bin.qualifiedCount += 1;
          qualifiedCount += 1;
        } else {
          bin.waitlistedCount += 1;
          waitlistedCount += 1;
        }
      }
    } else if (active.status === 'in_progress') {
      inProgressCount += 1;
      status = 'in_progress';
      score = active.score;
      totalResponseTimeMs = active.totalResponseTimeMs;
    } else {
      abandonedCount += 1;
      status = 'abandoned';
      score = active.score;
      totalResponseTimeMs = active.totalResponseTimeMs;
    }

    const row: DerivedApplicantResultRow = {
      applicant,
      activeAttempt: active,
      priorResetCount,
      status,
      rank,
      score,
      totalResponseTimeMs,
      submittedAt,
      qualified,
      handedOffPlayerId: handoff?.playerId ?? null,
      handedOffAt: handoff?.createdAt ?? null,
      integrity,
      isFlagged,
    };
    rows.push(row);
    rowByApplicantId.set(applicant.id, row);
  }

  // Sort display rows: ranked finished attempts first (1..K), then in_progress, abandoned, not_started
  const statusWeight: Record<DerivedQualificationStatus, number> = {
    qualified: 0,
    waitlisted: 1,
    in_progress: 2,
    abandoned: 3,
    not_started: 4,
  };
  rows.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    const sw = statusWeight[a.status] - statusWeight[b.status];
    if (sw !== 0) return sw;
    return Date.parse(b.applicant.createdAt) - Date.parse(a.applicant.createdAt);
  });

  const cutoffRow =
    finishedAttempts.length > 0
      ? finishedAttempts[Math.min(cutoffN, finishedAttempts.length) - 1]
      : null;

  const totalActiveAttempts = finishedCount + inProgressCount + abandonedCount;
  const completionRate =
    totalActiveAttempts > 0
      ? Math.round((finishedCount / totalActiveAttempts) * 1000) / 10
      : 0;

  return {
    rows,
    rowByApplicantId,
    attemptById,
    stats: {
      totalApplicants: input.applicants.length,
      verifiedApplicants,
      totalActiveAttempts,
      finishedCount,
      inProgressCount,
      abandonedCount,
      notStartedCount,
      resetAttemptsCount,
      completionRate,
      averageScore:
        finishedCount > 0 ? Math.round((scoreSum / finishedCount) * 10) / 10 : 0,
      averageResponseTimeMs:
        finishedCount > 0 ? Math.round(timeSumMs / finishedCount) : 0,
      flaggedCount,
      cutoffN,
      cutoffScore: cutoffRow ? cutoffRow.score : null,
      cutoffTimeMs: cutoffRow ? cutoffRow.totalResponseTimeMs : null,
      qualifiedCount,
      waitlistedCount,
      handedOffCount,
      scoreHistogram: histogramBins,
    },
  };
}

// ---------------------------------------------------------------------------
// Tournament Handoff Impact Preview (Idempotent, Zero-Duplicate)
// ---------------------------------------------------------------------------

export function previewQuizHandoff(
  db: DatabaseSnapshot,
  nowMs: number = Date.now()
): QuizHandoffPreview {
  const board = computeQuizRankings({
    applicants: db.quizApplicants,
    attempts: db.quizAttempts,
    events: db.quizEvents,
    questions: db.quizQuestions,
    handoffs: db.quizHandoffs,
    quizSettings: db.settings.quiz,
    tournamentSettings: db.settings.tournament,
    nowMs,
  });

  const playerById = new Map(db.players.map((p) => [p.id, p]));
  const playerByPhone = new Map<string, Player>();
  const playerByEmail = new Map<string, Player>();
  for (const p of db.players) {
    if (p.isGuest || p.isHost) continue;
    const normPhone = normalizeQuizPhone(p.contact.phone || p.phone);
    const normEmail = normalizeQuizEmail(p.contact.email || p.email);
    if (normPhone) playerByPhone.set(normPhone, p);
    if (normEmail) playerByEmail.set(normEmail, p);
  }

  const newPlayersToCreate: QuizHandoffPreviewItem[] = [];
  const alreadyHandedOff: QuizHandoffPreviewItem[] = [];
  const duplicateExistingPlayers: QuizHandoffPreviewItem[] = [];
  const conflicts: QuizHandoffPreviewItem[] = [];

  const qualifiedRows = board.rows.filter(
    (r) => r.qualified && r.activeAttempt && r.rank !== null && r.score !== null
  );

  for (const row of qualifiedRows) {
    const base: QuizHandoffPreviewItem = {
      applicantId: row.applicant.id,
      attemptId: row.activeAttempt!.attempt.id,
      fullName: row.applicant.fullName,
      fullNameAr: row.applicant.fullNameAr || row.applicant.fullName,
      phone: row.applicant.phone,
      email: row.applicant.email,
      rank: row.rank!,
      score: row.score!,
      totalResponseTimeMs: row.totalResponseTimeMs ?? 0,
    };

    // 1. Already handed off cleanly to an existing player
    if (row.handedOffPlayerId && playerById.has(row.handedOffPlayerId)) {
      alreadyHandedOff.push({
        ...base,
        existingPlayerId: row.handedOffPlayerId,
        reasonEn: 'Already handed off to tournament roster',
        reasonAr: 'تم ترحيله مسبقاً إلى قائمة لاعبي البطولة',
      });
      continue;
    }

    // 2. Check matches in current tournament Players by phone and email
    const byPhone = playerByPhone.get(row.applicant.normalizedPhone);
    const byEmail = playerByEmail.get(row.applicant.normalizedEmail);

    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      conflicts.push({
        ...base,
        existingPlayerId: byPhone.id,
        reasonEn: `Phone matches player "${byPhone.fullName}" while email matches "${byEmail.fullName}"`,
        reasonAr: `رقم الهاتف يطابق "${byPhone.fullNameAr || byPhone.fullName}" بينما البريد يطابق "${byEmail.fullNameAr || byEmail.fullName}"`,
      });
      continue;
    }

    const existing = byPhone ?? byEmail;
    if (existing) {
      duplicateExistingPlayers.push({
        ...base,
        existingPlayerId: existing.id,
        reasonEn:
          byPhone && byEmail
            ? `Matches existing player "${existing.fullName}" (phone & email)`
            : byPhone
              ? `Phone already registered to player "${existing.fullName}"`
              : `Email already registered to player "${existing.fullName}"`,
        reasonAr:
          byPhone && byEmail
            ? `يطابق اللاعب الحالي "${existing.fullNameAr || existing.fullName}" (الهاتف والبريد)`
            : byPhone
              ? `رقم الهاتف مسجّل مسبقاً للاعب "${existing.fullNameAr || existing.fullName}"`
              : `البريد مسجّل مسبقاً للاعب "${existing.fullNameAr || existing.fullName}"`,
      });
      continue;
    }

    newPlayersToCreate.push(base);
  }

  return {
    cutoffN: board.stats.cutoffN,
    totalQualified: qualifiedRows.length,
    newPlayersToCreate,
    alreadyHandedOff,
    duplicateExistingPlayers,
    conflicts,
    summaryEn: `${newPlayersToCreate.length} new players will be created, ${duplicateExistingPlayers.length} existing roster duplicates linked/skipped, ${alreadyHandedOff.length} already handed off, and ${conflicts.length} conflicts flagged.`,
    summaryAr: `سيتم إنشاء ${newPlayersToCreate.length} لاعب جديد، وربط/تخطي ${duplicateExistingPlayers.length} مطابقات موجودة، و${alreadyHandedOff.length} تم ترحيلهم مسبقاً، مع ${conflicts.length} تعارضات.`,
  };
}

// ---------------------------------------------------------------------------
// Consistency Invariants (AGENTS.md §16.4, integrated into checkInvariants)
// ---------------------------------------------------------------------------

export function checkQuizInvariants(db: DatabaseSnapshot): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const applicants = db.quizApplicants ?? [];
  const attempts = db.quizAttempts ?? [];
  const events = db.quizEvents ?? [];
  const questions = db.quizQuestions ?? [];
  const handoffs = db.quizHandoffs ?? [];

  const applicantById = new Map(applicants.map((a) => [a.id, a]));
  const attemptById = new Map(attempts.map((a) => [a.id, a]));
  const playerById = new Map(db.players.map((p) => [p.id, p]));

  // Q1. No orphan quiz attempts or events
  for (const attempt of attempts) {
    if (!applicantById.has(attempt.applicantId)) {
      violations.push({
        code: 'QUIZ_NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'quiz_attempt',
        entityId: attempt.id,
        messageEn: `QuizAttempt "${attempt.id}" references missing applicant "${attempt.applicantId}".`,
        messageAr: `المحاولة "${attempt.id}" تشير إلى متقدم غير موجود "${attempt.applicantId}".`,
      });
    }
  }
  for (const ev of events) {
    if (!attemptById.has(ev.attemptId) || !applicantById.has(ev.applicantId)) {
      violations.push({
        code: 'QUIZ_NO_ORPHAN_EVENTS',
        severity: 'error',
        entityType: 'quiz_event',
        entityId: ev.id,
        messageEn: `Orphan QuizAttemptEvent "${ev.id}" references missing attempt "${ev.attemptId}" or applicant "${ev.applicantId}".`,
        messageAr: `حدث الاختبار "${ev.id}" يشير إلى محاولة أو متقدم غير موجود.`,
      });
    }
  }

  // Derive full quiz board purely from events
  const board = computeQuizRankings({
    applicants,
    attempts,
    events,
    questions,
    handoffs,
    quizSettings: db.settings.quiz,
    tournamentSettings: db.settings.tournament,
  });

  // Q2. At most one active (non-reset) attempt per verified applicant / phone / email
  const activeByApplicant = new Map<string, string[]>();
  const activeByPhone = new Map<string, string[]>();
  const activeByEmail = new Map<string, string[]>();

  for (const derived of board.attemptById.values()) {
    if (derived.status === 'reset') continue;
    const aid = derived.attempt.applicantId;
    const aList = activeByApplicant.get(aid) ?? [];
    aList.push(derived.attempt.id);
    activeByApplicant.set(aid, aList);

    const applicant = applicantById.get(aid);
    if (applicant) {
      const pList = activeByPhone.get(applicant.normalizedPhone) ?? [];
      pList.push(derived.attempt.id);
      activeByPhone.set(applicant.normalizedPhone, pList);

      const eList = activeByEmail.get(applicant.normalizedEmail) ?? [];
      eList.push(derived.attempt.id);
      activeByEmail.set(applicant.normalizedEmail, eList);
    }
  }

  for (const [aid, ids] of activeByApplicant.entries()) {
    if (ids.length > 1) {
      violations.push({
        code: 'QUIZ_ONE_ACTIVE_ATTEMPT_PER_APPLICANT',
        severity: 'error',
        entityType: 'quiz_applicant',
        entityId: aid,
        messageEn: `Quiz applicant "${aid}" has ${ids.length} active (non-reset) attempts (${ids.join(', ')}).`,
        messageAr: `المتقدم "${aid}" لديه ${ids.length} محاولات نشطة في وقت واحد.`,
      });
    }
  }
  for (const [phone, ids] of activeByPhone.entries()) {
    if (ids.length > 1) {
      violations.push({
        code: 'QUIZ_ONE_ACTIVE_ATTEMPT_PER_APPLICANT',
        severity: 'error',
        entityType: 'quiz_applicant',
        entityId: phone,
        messageEn: `Duplicate active quiz attempts share normalized phone "${phone}" (${ids.join(', ')}).`,
        messageAr: `توجد محاولات نشطة مكررة لنفس رقم الهاتف "${phone}".`,
      });
    }
  }
  for (const [email, ids] of activeByEmail.entries()) {
    if (ids.length > 1) {
      violations.push({
        code: 'QUIZ_ONE_ACTIVE_ATTEMPT_PER_APPLICANT',
        severity: 'error',
        entityType: 'quiz_applicant',
        entityId: email,
        messageEn: `Duplicate active quiz attempts share normalized email "${email}" (${ids.join(', ')}).`,
        messageAr: `توجد محاولات نشطة مكررة لنفس البريد الإلكتروني "${email}".`,
      });
    }
  }

  // Q3. Ranking monotonicity & timeout/score consistency
  const rankedRows = board.rows.filter((r) => r.rank !== null);
  for (let i = 0; i < rankedRows.length; i += 1) {
    const curr = rankedRows[i];
    if (curr.rank !== i + 1) {
      violations.push({
        code: 'QUIZ_RANKING_ORDER_CONSISTENT',
        severity: 'error',
        entityType: 'quiz_attempt',
        entityId: curr.activeAttempt?.attempt.id ?? curr.applicant.id,
        messageEn: `Quiz rank sequence gap at index ${i}: expected ${i + 1}, got ${curr.rank}.`,
        messageAr: `خلل في تسلسل ترتيب الاختبار عند المركز ${i + 1}.`,
      });
    }
    if (i > 0) {
      const prev = rankedRows[i - 1];
      if (
        prev.activeAttempt &&
        curr.activeAttempt &&
        compareFinishedAttempts(prev.activeAttempt, curr.activeAttempt) > 0
      ) {
        violations.push({
          code: 'QUIZ_RANKING_ORDER_CONSISTENT',
          severity: 'error',
          entityType: 'quiz_attempt',
          entityId: curr.activeAttempt.attempt.id,
          messageEn: `Quiz rank #${curr.rank} outranks #${prev.rank} on score/response time.`,
          messageAr: `المركز #${curr.rank} يتفوق على المركز #${prev.rank} في النتيجة أو الزمن.`,
        });
      }
    }
  }

  // Q4. Cutoff qualification matches top-N finished attempts
  const expectedQualified = Math.min(rankedRows.length, board.stats.cutoffN);
  const actualQualified = board.rows.filter((r) => r.qualified).length;
  if (actualQualified !== expectedQualified) {
    violations.push({
      code: 'QUIZ_CUTOFF_CONSISTENT',
      severity: 'error',
      entityType: 'quiz_attempt',
      entityId: 'quiz-cutoff',
      messageEn: `Qualified applicant count (${actualQualified}) does not match min(finished=${rankedRows.length}, cutoff=${board.stats.cutoffN}).`,
      messageAr: `عدد المتأهلين (${actualQualified}) لا يطابق حد التأهل (${expectedQualified}).`,
    });
  }

  // Q5. Handoff integrity: valid references & zero duplicate players per applicant
  const handoffByApplicant = new Map<string, Set<string>>();
  const handoffByPlayer = new Map<string, Set<string>>();

  for (const h of handoffs) {
    if (!applicantById.has(h.applicantId)) {
      violations.push({
        code: 'QUIZ_HANDOFF_NO_DUPLICATE_PLAYERS',
        severity: 'error',
        entityType: 'quiz_handoff',
        entityId: h.id,
        messageEn: `QuizHandoffEvent "${h.id}" references missing applicant "${h.applicantId}".`,
        messageAr: `سجل الترحيل "${h.id}" يشير إلى متقدم غير موجود.`,
      });
    }
    if (!playerById.has(h.playerId)) {
      violations.push({
        code: 'QUIZ_HANDOFF_NO_DUPLICATE_PLAYERS',
        severity: 'error',
        entityType: 'quiz_handoff',
        entityId: h.id,
        messageEn: `QuizHandoffEvent "${h.id}" references missing tournament player "${h.playerId}".`,
        messageAr: `سجل الترحيل "${h.id}" يشير إلى لاعب غير موجود في البطولة.`,
      });
    }
    const pSet = handoffByApplicant.get(h.applicantId) ?? new Set<string>();
    pSet.add(h.playerId);
    handoffByApplicant.set(h.applicantId, pSet);

    const aSet = handoffByPlayer.get(h.playerId) ?? new Set<string>();
    aSet.add(h.applicantId);
    handoffByPlayer.set(h.playerId, aSet);
  }

  for (const [aid, pSet] of handoffByApplicant.entries()) {
    if (pSet.size > 1) {
      violations.push({
        code: 'QUIZ_HANDOFF_NO_DUPLICATE_PLAYERS',
        severity: 'error',
        entityType: 'quiz_handoff',
        entityId: aid,
        messageEn: `Quiz applicant "${aid}" was handed off to ${pSet.size} different players (${Array.from(pSet).join(', ')}).`,
        messageAr: `تم ترحيل المتقدم "${aid}" إلى أكثر من لاعب في البطولة.`,
      });
    }
  }
  for (const [pid, aSet] of handoffByPlayer.entries()) {
    if (aSet.size > 1) {
      violations.push({
        code: 'QUIZ_HANDOFF_NO_DUPLICATE_PLAYERS',
        severity: 'error',
        entityType: 'quiz_handoff',
        entityId: pid,
        messageEn: `Tournament player "${pid}" is linked to ${aSet.size} different quiz applicants.`,
        messageAr: `اللاعب "${pid}" مرتبط بأكثر من متقدم مختلف في الاختبار.`,
      });
    }
  }

  return violations;
}
