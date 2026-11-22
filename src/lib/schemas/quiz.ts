import { z } from 'zod';

/**
 * Registration Quiz Module (Demo) Schemas — AGENTS.md §16
 *
 * Event-sourced single source of truth:
 * - QuizAttempt stores ONLY immutable seed/configuration (NO derived score, time, status, rank, or qualification).
 * - QuizAttemptEvent is the append-only event log (started, question_shown, answered, timed_out, finished, reset, integrity_signal).
 * - QuizHandoffEvent records idempotent applicant -> tournament Player handoffs.
 * - All scores, response times, ranks, cutoff qualification, histograms, and integrity flags are derived purely in /lib/engine/quiz.ts.
 */

export const QuizCategorySchema = z.enum([
  'general',
  'egyptian_cinema',
  'music',
  'wordplay_logic',
]);
export type QuizCategory = z.infer<typeof QuizCategorySchema>;

export const QuizDifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type QuizDifficulty = z.infer<typeof QuizDifficultySchema>;

export const QuizReviewStatusSchema = z.enum(['draft', 'approved']);
export type QuizReviewStatus = z.infer<typeof QuizReviewStatusSchema>;

export const QuizVerificationChannelSchema = z.enum([
  'whatsapp_or_sms',
  'whatsapp',
  'sms',
  'email',
]);
export type QuizVerificationChannel = z.infer<
  typeof QuizVerificationChannelSchema
>;

export const QuizRetakePolicySchema = z.enum(['single_attempt']);
export type QuizRetakePolicy = z.infer<typeof QuizRetakePolicySchema>;

export const QuizIntegritySignalTypeSchema = z.enum([
  'visibility_hidden',
  'page_refresh',
  'copy_attempt',
]);
export type QuizIntegritySignalType = z.infer<
  typeof QuizIntegritySignalTypeSchema
>;

export const QuizAttemptEventTypeSchema = z.enum([
  'started',
  'question_shown',
  'answered',
  'timed_out',
  'finished',
  'reset',
  'integrity_signal',
]);
export type QuizAttemptEventType = z.infer<typeof QuizAttemptEventTypeSchema>;

export const QuizSettingsSchema = z.object({
  questionsPerAttempt: z.number().int().min(3).max(50).default(20),
  secondsPerQuestion: z.number().int().min(3).max(60).default(10),
  /** When true, effective cutoff follows Settings.tournament.totalPlayers (default 720) */
  syncCutoffWithTournament: z.boolean().default(true),
  /** Used when syncCutoffWithTournament is false */
  customCutoffN: z.number().int().min(1).max(5000).default(720),
  windowStartsAt: z.string(),
  windowEndsAt: z.string(),
  verificationChannel: QuizVerificationChannelSchema.default('whatsapp_or_sms'),
  /** Default false: show score & total time now, announce official rank after window closes */
  showRankImmediately: z.boolean().default(false),
  retakePolicy: QuizRetakePolicySchema.default('single_attempt'),
  /** Visible mock OTP code in Demo Mode */
  demoVerificationCode: z.string().min(4).max(10).default('123456'),
});
export type QuizSettings = z.infer<typeof QuizSettingsSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  category: QuizCategorySchema,
  difficulty: QuizDifficultySchema,
  /** Every seeded question starts as 'draft' so a human must review factual accuracy & Arabic wording */
  reviewStatus: QuizReviewStatusSchema.default('draft'),
  questionAr: z.string().min(1),
  questionEn: z.string().min(1),
  optionsAr: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  optionsEn: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  /** Canonical index (0..3) in optionsAr / optionsEn before per-applicant shuffling */
  correctOptionIndex: z.number().int().min(0).max(3),
  explanationAr: z.string().optional(),
  explanationEn: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizApplicantSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  fullNameAr: z.string().default(''),
  phone: z.string().min(1),
  normalizedPhone: z.string().min(1),
  email: z.string().email(),
  normalizedEmail: z.string().min(1),
  verifiedAt: z.string().nullable().default(null),
  verificationChannel: QuizVerificationChannelSchema.default('whatsapp_or_sms'),
  consentAcceptedAt: z.string(),
  createdAt: z.string(),
});
export type QuizApplicant = z.infer<typeof QuizApplicantSchema>;

/**
 * Immutable attempt metadata & deterministic shuffle seed.
 * Contains ZERO stored derived values (score, totalResponseTimeMs, status, rank, qualified).
 */
export const QuizAttemptSchema = z.object({
  id: z.string(),
  applicantId: z.string(),
  shuffleSeed: z.string().min(1),
  /** Ordered question IDs deterministically drawn at attempt start */
  questionIds: z.array(z.string()).min(1),
  questionsCount: z.number().int().positive(),
  secondsPerQuestion: z.number().int().positive(),
  startedAt: z.string(),
  createdAt: z.string(),
});
export type QuizAttempt = z.infer<typeof QuizAttemptSchema>;

/**
 * Append-only event log for quiz attempts (Single Source of Truth).
 */
export const QuizAttemptEventSchema = z.object({
  id: z.string(),
  attemptId: z.string(),
  applicantId: z.string(),
  type: QuizAttemptEventTypeSchema,
  questionId: z.string().optional(),
  questionIndex: z.number().int().nonnegative().optional(),
  /** Canonical option index (0..3) in QuizQuestion.optionsAr/En */
  selectedOptionIndex: z.number().int().min(0).max(3).optional(),
  /** Displayed shuffled button slot (0..3) */
  displayedSlotIndex: z.number().int().min(0).max(3).optional(),
  shownAt: z.string().optional(),
  deadlineAt: z.string().optional(),
  responseTimeMs: z.number().int().nonnegative().optional(),
  signalType: QuizIntegritySignalTypeSchema.optional(),
  reason: z.string().optional(),
  byUserId: z.string().optional(),
  createdAt: z.string(),
});
export type QuizAttemptEvent = z.infer<typeof QuizAttemptEventSchema>;

/**
 * Append-only record linking a qualified quiz applicant to their created/matched tournament Player.
 */
export const QuizHandoffEventSchema = z.object({
  id: z.string(),
  applicantId: z.string(),
  attemptId: z.string(),
  playerId: z.string(),
  byUserId: z.string(),
  rankAtHandoff: z.number().int().positive(),
  scoreAtHandoff: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type QuizHandoffEvent = z.infer<typeof QuizHandoffEventSchema>;

/**
 * Public/applicant-safe question payload (NEVER exposes correctOptionIndex).
 */
export interface PublicQuizQuestionPayload {
  id: string;
  questionIndex: number;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  questionAr: string;
  questionEn: string;
  /** Options already arranged in the applicant's deterministic shuffled order */
  shuffledOptions: Array<{
    slotIndex: 0 | 1 | 2 | 3;
    canonicalIndex: 0 | 1 | 2 | 3;
    labelAr: string;
    labelEn: string;
  }>;
}
