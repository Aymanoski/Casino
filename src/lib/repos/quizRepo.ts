import type {
  PublicQuizQuestionPayload,
  QuizApplicant,
  QuizQuestion,
  QuizSettings,
} from '@/lib/schemas';
import {
  buildPublicQuestionPayload,
  computeQuizRankings,
  deriveAttemptState,
  getEffectiveQuizCutoff,
  getQuizWindowState,
  previewQuizHandoff,
  selectEligibleQuestionPool,
  type DerivedQuizAttempt,
  type DerivedQuizBoard,
  type QuizDashboardStats,
  type QuizHandoffPreview,
  type QuizWindowState,
} from '@/lib/engine';
import { commands, type QuizQuestionInput } from '@/lib/commands';
import { storage } from '@/lib/storage';
import { assertRepoPermission } from './permissions';

/**
 * Public-safe overview returned to /quiz* routes (NO applicant contacts, NO correct answers).
 */
export interface PublicQuizOverview {
  questionsPerAttempt: number;
  secondsPerQuestion: number;
  effectiveCutoffN: number;
  windowStartsAt: string;
  windowEndsAt: string;
  windowState: QuizWindowState;
  verificationChannel: QuizSettings['verificationChannel'];
  showRankImmediately: boolean;
  retakePolicy: QuizSettings['retakePolicy'];
  demoVerificationCode: string;
  totalQuestionsInBank: number;
  approvedQuestionsCount: number;
  usingDraftFallback: boolean;
}

/**
 * Applicant-safe session view for /quiz/register, /quiz/rules, /quiz/play, /quiz/result.
 * NEVER includes correctOptionIndex or other applicants' personal contact details.
 */
export interface ApplicantQuizSessionView {
  applicant: {
    id: string;
    fullName: string;
    fullNameAr: string;
    verifiedAt: string | null;
    verificationChannel: QuizApplicant['verificationChannel'];
    maskedPhone: string;
    maskedEmail: string;
  };
  windowState: QuizWindowState;
  settings: PublicQuizOverview;
  attempt: DerivedQuizAttempt | null;
  activeQuestion: PublicQuizQuestionPayload | null;
  /** Populated ONLY when window is closed OR showRankImmediately is true */
  rankDisclosure: {
    canShowRank: boolean;
    rank: number | null;
    qualified: boolean;
    cutoffN: number;
    totalFinished: number;
  };
}

export interface AdminQuizAttemptDetail {
  applicant: QuizApplicant;
  derived: DerivedQuizAttempt;
  rank: number | null;
  qualified: boolean;
  cutoffN: number;
  handedOffPlayerId: string | null;
  questionsById: Record<string, QuizQuestion>;
}

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

export const quizRepo = {
  /**
   * Public read: safe overview & window status for /quiz* screens.
   */
  async getPublicOverview(nowMs: number = Date.now()): Promise<PublicQuizOverview> {
    const db = await storage.readSnapshot();
    const qs = db.settings.quiz;
    const poolInfo = selectEligibleQuestionPool(
      db.quizQuestions,
      qs.questionsPerAttempt
    );
    return {
      questionsPerAttempt: qs.questionsPerAttempt,
      secondsPerQuestion: qs.secondsPerQuestion,
      effectiveCutoffN: getEffectiveQuizCutoff(qs, db.settings.tournament),
      windowStartsAt: qs.windowStartsAt,
      windowEndsAt: qs.windowEndsAt,
      windowState: getQuizWindowState(qs, nowMs),
      verificationChannel: qs.verificationChannel,
      showRankImmediately: qs.showRankImmediately,
      retakePolicy: qs.retakePolicy,
      demoVerificationCode: qs.demoVerificationCode,
      totalQuestionsInBank: db.quizQuestions.length,
      approvedQuestionsCount: poolInfo.approvedCount,
      usingDraftFallback: poolInfo.usingDraftFallback,
    };
  },

  /**
   * Public applicant session read: strictly scoped to the given applicantId.
   * Strips correctOptionIndex and masks contacts so sensitive answers/PII never leak.
   */
  async getApplicantSession(
    applicantId: string,
    nowMs: number = Date.now()
  ): Promise<ApplicantQuizSessionView | null> {
    const db = await storage.readSnapshot();
    const applicant = db.quizApplicants.find((a) => a.id === applicantId);
    if (!applicant) return null;

    const overview = await this.getPublicOverview(nowMs);
    const questionById = new Map(db.quizQuestions.map((q) => [q.id, q]));

    // Find active non-reset attempt
    const attempts = db.quizAttempts
      .filter((a) => a.applicantId === applicant.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    let activeAttempt: DerivedQuizAttempt | null = null;
    for (const attempt of attempts) {
      const evs = db.quizEvents.filter((e) => e.attemptId === attempt.id);
      const derived = deriveAttemptState(attempt, evs, questionById, nowMs);
      if (derived.status !== 'reset') {
        activeAttempt = derived;
        break;
      }
    }

    let activeQuestion: PublicQuizQuestionPayload | null = null;
    if (
      activeAttempt &&
      (activeAttempt.status === 'in_progress' ||
        activeAttempt.status === 'abandoned') &&
      activeAttempt.activeQuestionId
    ) {
      const q = questionById.get(activeAttempt.activeQuestionId);
      if (q) {
        activeQuestion = buildPublicQuestionPayload(
          q,
          activeAttempt.attempt.id,
          activeAttempt.currentQuestionIndex,
          activeAttempt.attempt.shuffleSeed
        );
      }
    }

    const canShowRank =
      overview.showRankImmediately || overview.windowState.status === 'closed';

    let rank: number | null = null;
    let qualified = false;
    let totalFinished = 0;

    if (canShowRank && activeAttempt && activeAttempt.status === 'finished') {
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
      const row = board.rowByApplicantId.get(applicant.id);
      rank = row?.rank ?? null;
      qualified = Boolean(row?.qualified);
      totalFinished = board.stats.finishedCount;
    }

    return {
      applicant: {
        id: applicant.id,
        fullName: applicant.fullName,
        fullNameAr: applicant.fullNameAr || applicant.fullName,
        verifiedAt: applicant.verifiedAt,
        verificationChannel: applicant.verificationChannel,
        maskedPhone: maskPhone(applicant.phone),
        maskedEmail: maskEmail(applicant.email),
      },
      windowState: overview.windowState,
      settings: overview,
      attempt: activeAttempt
        ? {
            ...activeAttempt,
            // Redact correctOptionIndex from public/applicant timeline so answers never leak
            timeline: activeAttempt.timeline.map((t) => ({
              ...t,
              correctOptionIndex: -1,
            })),
          }
        : null,
      activeQuestion,
      rankDisclosure: {
        canShowRank,
        rank,
        qualified,
        cutoffN: overview.effectiveCutoffN,
        totalFinished,
      },
    };
  },

  /**
   * Super Admin-only dashboard KPIs, histogram, window state & bank summary.
   */
  async getAdminDashboard(
    actorUserId: string,
    nowMs: number = Date.now()
  ): Promise<{
    stats: QuizDashboardStats;
    windowState: QuizWindowState;
    settings: QuizSettings;
    tournamentTotalPlayers: number;
    bankSummary: {
      total: number;
      approved: number;
      draft: number;
      usingDraftFallback: boolean;
      byCategory: Record<string, number>;
    };
  }> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'quiz.readResults');
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
    const poolInfo = selectEligibleQuestionPool(
      db.quizQuestions,
      db.settings.quiz.questionsPerAttempt
    );
    const byCategory: Record<string, number> = {
      general: 0,
      egyptian_cinema: 0,
      music: 0,
      wordplay_logic: 0,
    };
    for (const q of db.quizQuestions) {
      byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
    }

    return {
      stats: board.stats,
      windowState: getQuizWindowState(db.settings.quiz, nowMs),
      settings: db.settings.quiz,
      tournamentTotalPlayers: db.settings.tournament.totalPlayers,
      bankSummary: {
        total: db.quizQuestions.length,
        approved: poolInfo.approvedCount,
        draft: poolInfo.draftCount,
        usingDraftFallback: poolInfo.usingDraftFallback,
        byCategory,
      },
    };
  },

  /**
   * Super Admin-only full derived results board (includes applicant contacts & integrity signals).
   */
  async getAdminResultsBoard(
    actorUserId: string,
    nowMs: number = Date.now()
  ): Promise<DerivedQuizBoard> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'quiz.readResults');
    assertRepoPermission(db, actorUserId, 'quiz.readApplicantContacts');
    return computeQuizRankings({
      applicants: db.quizApplicants,
      attempts: db.quizAttempts,
      events: db.quizEvents,
      questions: db.quizQuestions,
      handoffs: db.quizHandoffs,
      quizSettings: db.settings.quiz,
      tournamentSettings: db.settings.tournament,
      nowMs,
    });
  },

  /**
   * Super Admin-only detailed per-question timeline for the results drawer.
   */
  async getAdminApplicantDetail(
    applicantId: string,
    actorUserId: string,
    nowMs: number = Date.now()
  ): Promise<AdminQuizAttemptDetail | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'quiz.readResults');
    assertRepoPermission(db, actorUserId, 'quiz.readApplicantContacts');

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
    const row = board.rowByApplicantId.get(applicantId);
    if (!row || !row.activeAttempt) return null;

    const questionsById: Record<string, QuizQuestion> = {};
    for (const q of db.quizQuestions) {
      questionsById[q.id] = q;
    }

    return {
      applicant: row.applicant,
      derived: row.activeAttempt,
      rank: row.rank,
      qualified: row.qualified,
      cutoffN: board.stats.cutoffN,
      handedOffPlayerId: row.handedOffPlayerId,
      questionsById,
    };
  },

  /**
   * Super Admin + Content Manager question bank read.
   */
  async listQuestionsForAdmin(actorUserId: string): Promise<{
    questions: QuizQuestion[];
    questionsPerAttempt: number;
    usingDraftFallback: boolean;
    approvedCount: number;
    draftCount: number;
  }> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'quiz.manageQuestions');
    const poolInfo = selectEligibleQuestionPool(
      db.quizQuestions,
      db.settings.quiz.questionsPerAttempt
    );
    return {
      questions: db.quizQuestions,
      questionsPerAttempt: db.settings.quiz.questionsPerAttempt,
      usingDraftFallback: poolInfo.usingDraftFallback,
      approvedCount: poolInfo.approvedCount,
      draftCount: poolInfo.draftCount,
    };
  },

  /**
   * Super Admin-only quiz settings read.
   */
  async getSettingsForAdmin(actorUserId: string): Promise<{
    quiz: QuizSettings;
    tournamentTotalPlayers: number;
    bankSize: number;
    windowState: QuizWindowState;
  }> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'quiz.manageSettings');
    return {
      quiz: db.settings.quiz,
      tournamentTotalPlayers: db.settings.tournament.totalPlayers,
      bankSize: db.quizQuestions.length,
      windowState: getQuizWindowState(db.settings.quiz),
    };
  },

  /**
   * Super Admin-only Impact Preview before handing off qualified applicants to the tournament.
   */
  async previewHandoff(actorUserId: string): Promise<QuizHandoffPreview> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'quiz.handoff');
    return previewQuizHandoff(db);
  },

  // --- Command-delegating write operations ---
  registerApplicant: commands.registerQuizApplicant,
  verifyApplicant: commands.verifyQuizApplicant,
  startAttempt: commands.startQuizAttempt,
  ensureQuestionShown: commands.ensureQuizQuestionShown,
  submitAnswer: commands.submitQuizAnswer,
  recordTimeout: commands.recordQuizTimeout,
  recordIntegritySignal: commands.recordQuizIntegritySignal,
  resetAttempt: commands.resetQuizAttempt,
  createQuestion: (input: QuizQuestionInput, actorUserId: string) =>
    commands.createQuizQuestion(input, actorUserId),
  updateQuestion: (
    id: string,
    patch: Partial<QuizQuestionInput>,
    actorUserId: string
  ) => commands.updateQuizQuestion(id, patch, actorUserId),
  deleteQuestion: (id: string, actorUserId: string) =>
    commands.deleteQuizQuestion(id, actorUserId),
  bulkImportQuestions: (inputs: QuizQuestionInput[], actorUserId: string) =>
    commands.bulkImportQuizQuestions(inputs, actorUserId),
  bulkSetQuestionsReviewStatus: (
    ids: string[],
    reviewStatus: QuizQuestion['reviewStatus'],
    actorUserId: string
  ) => commands.bulkSetQuizQuestionsReviewStatus(ids, reviewStatus, actorUserId),
  updateSettings: (patch: Partial<QuizSettings>, actorUserId: string) =>
    commands.updateQuizSettings(patch, actorUserId),
  handoffQualifiedToTournament: commands.handoffQualifiedToTournament,
};
