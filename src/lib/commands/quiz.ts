import {
  QuizQuestionSchema,
  QuizSettingsSchema,
  type AuditEntry,
  type DatabaseSnapshot,
  type Player,
  type QuizApplicant,
  type QuizAttempt,
  type QuizAttemptEvent,
  type QuizCategory,
  type QuizDifficulty,
  type QuizHandoffEvent,
  type QuizIntegritySignalType,
  type QuizQuestion,
  type QuizReviewStatus,
  type QuizSettings,
  type QuizVerificationChannel,
} from '@/lib/schemas';
import {
  computeQuizRankings,
  deriveAttemptState,
  getQuizWindowState,
  normalizeQuizEmail,
  normalizeQuizPhone,
  previewQuizHandoff,
  selectEligibleQuestionPool,
  selectShuffledQuestionIds,
  type DerivedQuizAttempt,
  type QuizHandoffPreview,
} from '@/lib/engine';
import { feedback } from '@/lib/feedback';
import type { RealtimeEventName } from '@/lib/realtime';
import { assertRepoPermission } from '@/lib/repos/permissions';
import { deterministicAvatarKey } from '@/lib/seed';
import { CommandValidationError } from './errors';

export interface QuizCommandBroadcast {
  event: RealtimeEventName;
  payload: Record<string, unknown>;
}

export interface QuizExecutionEnvelope<T> {
  result: T;
  nextDb: DatabaseSnapshot;
  broadcasts: QuizCommandBroadcast[];
  skipInvariants?: boolean;
}

export interface QuizCommandPrimitives {
  commitCommand: <T>(
    actorUserId: string,
    handler: (
      beforeDb: DatabaseSnapshot,
      workingDb: DatabaseSnapshot
    ) => QuizExecutionEnvelope<T>
  ) => Promise<T>;
  createAuditRecord: (input: {
    actorUserId: string;
    action: string;
    entityType: AuditEntry['entityType'];
    entityId: string;
    summary: string;
    summaryAr?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    automatic?: boolean;
  }) => AuditEntry;
  nextId: (prefix: string) => string;
  nextIsoTimestamp: () => string;
}

export interface RegisterQuizApplicantInput {
  fullName: string;
  fullNameAr?: string;
  phone: string;
  email: string;
  consentAccepted: boolean;
  verificationChannel?: QuizVerificationChannel;
}

export interface RegisterQuizApplicantResult {
  status: 'registered_pending_verification' | 'already_verified' | 'resume_attempt' | 'already_finished';
  applicant: QuizApplicant;
  activeAttempt: DerivedQuizAttempt | null;
}

export interface StartQuizAttemptResult {
  attempt: QuizAttempt;
  derived: DerivedQuizAttempt;
  usingDraftFallback: boolean;
}

export interface QuizQuestionInput {
  category: QuizCategory;
  difficulty: QuizDifficulty;
  reviewStatus?: QuizReviewStatus;
  questionAr: string;
  questionEn: string;
  optionsAr: [string, string, string, string];
  optionsEn: [string, string, string, string];
  correctOptionIndex: number;
  explanationAr?: string;
  explanationEn?: string;
}

export interface QuizHandoffExecutionResult {
  preview: QuizHandoffPreview;
  createdPlayersCount: number;
  linkedExistingCount: number;
  alreadyHandedOffCount: number;
  conflictsCount: number;
  createdPlayerIds: string[];
}

function getActiveAttemptForApplicant(
  db: DatabaseSnapshot,
  applicantId: string,
  nowMs: number
): DerivedQuizAttempt | null {
  const questionById = new Map(db.quizQuestions.map((q) => [q.id, q]));
  const attempts = db.quizAttempts
    .filter((a) => a.applicantId === applicantId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  for (const attempt of attempts) {
    const evs = db.quizEvents.filter((e) => e.attemptId === attempt.id);
    const derived = deriveAttemptState(attempt, evs, questionById, nowMs);
    if (derived.status !== 'reset') {
      return derived;
    }
  }
  return null;
}

function normalizeWhatsappFromPhone(phone: string): string {
  const digits = normalizeQuizPhone(phone);
  if (digits.startsWith('01') && digits.length === 11) {
    return `+2${digits}`;
  }
  return phone.trim();
}

export function createQuizCommands(p: QuizCommandPrimitives) {
  return {
    /**
     * Public applicant registration step (AGENTS.md §16.1 & §16.2).
     * Enforces one-attempt-per-person by normalized phone OR email without leaking other records.
     */
    async registerQuizApplicant(
      input: RegisterQuizApplicantInput
    ): Promise<RegisterQuizApplicantResult> {
      const fullName = input.fullName.trim();
      const fullNameAr = (input.fullNameAr ?? '').trim() || fullName;
      const phone = input.phone.trim();
      const email = input.email.trim();
      const normalizedPhone = normalizeQuizPhone(phone);
      const normalizedEmail = normalizeQuizEmail(email);

      if (fullName.length < 2) {
        throw new CommandValidationError(
          'Please enter your full name (at least 2 characters).'
        );
      }
      if (normalizedPhone.length < 8) {
        throw new CommandValidationError(
          'Please enter a valid mobile phone number.'
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new CommandValidationError('Please enter a valid email address.');
      }
      if (!input.consentAccepted) {
        throw new CommandValidationError(
          'You must accept the quiz terms and privacy notice to continue.'
        );
      }

      return p.commitCommand<RegisterQuizApplicantResult>('public-applicant', (_before, db) => {
        const nowMs = Date.now();
        const nowIso = p.nextIsoTimestamp();
        const windowState = getQuizWindowState(db.settings.quiz, nowMs);

        // Find any existing applicant matching normalizedPhone OR normalizedEmail
        const matchingApplicants = db.quizApplicants.filter(
          (a) =>
            a.normalizedPhone === normalizedPhone ||
            a.normalizedEmail === normalizedEmail
        );

        // Check if ANY matching applicant already has an active (non-reset) attempt
        for (const existing of matchingApplicants) {
          const active = getActiveAttemptForApplicant(db, existing.id, nowMs);
          if (active) {
            if (active.status === 'finished') {
              return {
                result: {
                  status: 'already_finished',
                  applicant: existing,
                  activeAttempt: active,
                },
                nextDb: db,
                broadcasts: [],
                skipInvariants: true,
              };
            }
            return {
              result: {
                status: 'resume_attempt',
                applicant: existing,
                activeAttempt: active,
              },
              nextDb: db,
              broadcasts: [],
              skipInvariants: true,
            };
          }
        }

        if (windowState.status !== 'open') {
          throw new CommandValidationError(
            windowState.status === 'upcoming'
              ? 'The registration quiz window has not opened yet.'
              : 'The registration quiz window is now closed.'
          );
        }

        // Reuse existing applicant record if their previous attempt was reset or never verified
        const exactExisting = matchingApplicants[0];
        if (exactExisting) {
          const updated: QuizApplicant = {
            ...exactExisting,
            fullName,
            fullNameAr,
            phone,
            normalizedPhone,
            email,
            normalizedEmail,
            verificationChannel:
              input.verificationChannel ?? db.settings.quiz.verificationChannel,
            consentAcceptedAt: nowIso,
          };
          const idx = db.quizApplicants.findIndex((a) => a.id === updated.id);
          db.quizApplicants[idx] = updated;
          return {
            result: {
              status: updated.verifiedAt
                ? 'already_verified'
                : 'registered_pending_verification',
              applicant: updated,
              activeAttempt: null,
            },
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }

        const created: QuizApplicant = {
          id: p.nextId('qa'),
          fullName,
          fullNameAr,
          phone,
          normalizedPhone,
          email,
          normalizedEmail,
          verifiedAt: null,
          verificationChannel:
            input.verificationChannel ?? db.settings.quiz.verificationChannel,
          consentAcceptedAt: nowIso,
          createdAt: nowIso,
        };
        db.quizApplicants.push(created);

        return {
          result: {
            status: 'registered_pending_verification',
            applicant: created,
            activeAttempt: null,
          },
          nextDb: db,
          broadcasts: [],
          skipInvariants: true,
        };
      });
    },

    /**
     * Mock OTP verification (demo code from settings.quiz.demoVerificationCode, default 123456).
     */
    async verifyQuizApplicant(input: {
      applicantId: string;
      code: string;
    }): Promise<QuizApplicant> {
      return p.commitCommand<QuizApplicant>('public-applicant', (_before, db) => {
        const idx = db.quizApplicants.findIndex(
          (a) => a.id === input.applicantId
        );
        if (idx === -1) {
          throw new CommandValidationError('Applicant registration not found.');
        }
        const expected = db.settings.quiz.demoVerificationCode.trim();
        if (input.code.trim() !== expected) {
          throw new CommandValidationError(
            `Invalid verification code. In Demo Mode, enter ${expected}.`
          );
        }
        const updated: QuizApplicant = {
          ...db.quizApplicants[idx],
          verifiedAt: db.quizApplicants[idx].verifiedAt ?? p.nextIsoTimestamp(),
        };
        db.quizApplicants[idx] = updated;
        return {
          result: updated,
          nextDb: db,
          broadcasts: [],
          skipInvariants: true,
        };
      });
    },

    /**
     * Starts a deterministic seeded attempt (or resumes an existing in-progress attempt
     * without resetting the clock). Blocks duplicate attempts per verified person.
     */
    async startQuizAttempt(input: {
      applicantId: string;
      nowMs?: number;
    }): Promise<StartQuizAttemptResult> {
      const result = await p.commitCommand('public-applicant', (_before, db) => {
        const nowMs = input.nowMs ?? Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const applicant = db.quizApplicants.find(
          (a) => a.id === input.applicantId
        );
        if (!applicant) {
          throw new CommandValidationError('Applicant record not found.');
        }
        if (!applicant.verifiedAt) {
          throw new CommandValidationError(
            'Please complete verification before starting the quiz.'
          );
        }

        const { pool, usingDraftFallback } = selectEligibleQuestionPool(
          db.quizQuestions,
          db.settings.quiz.questionsPerAttempt
        );

        // Enforce strictly one active attempt per person (same applicantId OR phone/email)
        const matchingApplicants = db.quizApplicants.filter(
          (a) =>
            a.id === applicant.id ||
            a.normalizedPhone === applicant.normalizedPhone ||
            a.normalizedEmail === applicant.normalizedEmail
        );

        for (const match of matchingApplicants) {
          const active = getActiveAttemptForApplicant(db, match.id, nowMs);
          if (active) {
            if (active.status === 'finished') {
              throw new CommandValidationError(
                'You have already completed your single allowed quiz attempt.'
              );
            }
            if (match.id === applicant.id) {
              // Idempotent resume of own in-progress attempt — never restarts clock!
              return {
                result: {
                  attempt: active.attempt,
                  derived: active,
                  usingDraftFallback,
                },
                nextDb: db,
                broadcasts: [],
                skipInvariants: true,
              };
            }
            throw new CommandValidationError(
              'An attempt is already in progress for this verified phone or email.'
            );
          }
        }

        const windowState = getQuizWindowState(db.settings.quiz, nowMs);
        if (windowState.status !== 'open') {
          throw new CommandValidationError(
            windowState.status === 'upcoming'
              ? 'The quiz window is not open yet.'
              : 'The quiz window has closed.'
          );
        }

        const count = Math.min(db.settings.quiz.questionsPerAttempt, pool.length);
        if (count === 0) {
          throw new CommandValidationError(
            'No quiz questions are available in the question bank.'
          );
        }

        const attemptId = p.nextId('qatt');
        const shuffleSeed = `seed-${attemptId}-${nowMs}`;
        const questionIds = selectShuffledQuestionIds(pool, count, shuffleSeed);
        const secondsPerQuestion = db.settings.quiz.secondsPerQuestion;

        const attempt: QuizAttempt = {
          id: attemptId,
          applicantId: applicant.id,
          shuffleSeed,
          questionIds,
          questionsCount: questionIds.length,
          secondsPerQuestion,
          startedAt: nowIso,
          createdAt: nowIso,
        };
        db.quizAttempts.push(attempt);

        const startedEvent: QuizAttemptEvent = {
          id: p.nextId('qev'),
          attemptId,
          applicantId: applicant.id,
          type: 'started',
          createdAt: nowIso,
        };
        const firstDeadlineIso = new Date(
          nowMs + secondsPerQuestion * 1000
        ).toISOString();
        const firstShownEvent: QuizAttemptEvent = {
          id: p.nextId('qev'),
          attemptId,
          applicantId: applicant.id,
          type: 'question_shown',
          questionId: questionIds[0],
          questionIndex: 0,
          shownAt: nowIso,
          deadlineAt: firstDeadlineIso,
          createdAt: new Date(nowMs + 1).toISOString(),
        };
        db.quizEvents.push(startedEvent, firstShownEvent);

        const questionById = new Map(db.quizQuestions.map((q) => [q.id, q]));
        const derived = deriveAttemptState(
          attempt,
          [startedEvent, firstShownEvent],
          questionById,
          nowMs
        );

        return {
          result: { attempt, derived, usingDraftFallback },
          nextDb: db,
          broadcasts: [
            {
              event: 'quiz.started',
              payload: { applicantId: applicant.id, attemptId },
            },
          ],
        };
      });

      feedback.play('quiz.started');
      feedback.haptic('medium');
      return result;
    },

    /**
     * Ensures a `question_shown` deadline record exists for `(attemptId, questionIndex)`.
     * Never overwrites or restarts an already recorded deadline (refresh-safe).
     */
    async ensureQuizQuestionShown(input: {
      attemptId: string;
      questionIndex: number;
      nowMs?: number;
    }): Promise<DerivedQuizAttempt> {
      return p.commitCommand<DerivedQuizAttempt>('public-applicant', (_before, db) => {
        const nowMs = input.nowMs ?? Date.now();
        const attempt = db.quizAttempts.find((a) => a.id === input.attemptId);
        if (!attempt) {
          throw new CommandValidationError('Quiz attempt not found.');
        }
        const evs = db.quizEvents.filter((e) => e.attemptId === attempt.id);
        const questionById = new Map(db.quizQuestions.map((q) => [q.id, q]));
        const existingDerived = deriveAttemptState(
          attempt,
          evs,
          questionById,
          nowMs
        );

        if (
          existingDerived.status === 'finished' ||
          existingDerived.status === 'reset'
        ) {
          return {
            result: existingDerived,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }

        const alreadyShown = evs.some(
          (e) =>
            e.type === 'question_shown' &&
            e.questionIndex === input.questionIndex
        );
        if (alreadyShown || input.questionIndex !== existingDerived.currentQuestionIndex) {
          return {
            result: existingDerived,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }

        const qId = attempt.questionIds[input.questionIndex];
        const shownIso = new Date(nowMs).toISOString();
        const deadlineIso = new Date(
          nowMs + attempt.secondsPerQuestion * 1000
        ).toISOString();
        const shownEvent: QuizAttemptEvent = {
          id: p.nextId('qev'),
          attemptId: attempt.id,
          applicantId: attempt.applicantId,
          type: 'question_shown',
          questionId: qId,
          questionIndex: input.questionIndex,
          shownAt: shownIso,
          deadlineAt: deadlineIso,
          createdAt: shownIso,
        };
        db.quizEvents.push(shownEvent);

        const nextDerived = deriveAttemptState(
          attempt,
          [...evs, shownEvent],
          questionById,
          nowMs
        );
        return {
          result: nextDerived,
          nextDb: db,
          broadcasts: [],
          skipInvariants: true,
        };
      });
    },

    /**
     * Submits an answer for the active question, automatically advancing to the next question
     * (or finishing the attempt on the last question). No going back; late answers become timeouts.
     */
    async submitQuizAnswer(input: {
      attemptId: string;
      questionIndex: number;
      selectedOptionIndex: number;
      displayedSlotIndex?: number;
      nowMs?: number;
    }): Promise<DerivedQuizAttempt> {
      let didFinish = false;
      let didTimeout = false;

      const derived = await p.commitCommand('public-applicant', (_before, db) => {
        const nowMs = input.nowMs ?? Date.now();
        const attempt = db.quizAttempts.find((a) => a.id === input.attemptId);
        if (!attempt) {
          throw new CommandValidationError('Quiz attempt not found.');
        }

        const evs = db.quizEvents.filter((e) => e.attemptId === attempt.id);
        const questionById = new Map(db.quizQuestions.map((q) => [q.id, q]));
        const current = deriveAttemptState(attempt, evs, questionById, nowMs);

        if (current.status === 'reset') {
          throw new CommandValidationError(
            'This quiz attempt was reset by an administrator.'
          );
        }
        if (current.status === 'finished') {
          return {
            result: current,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }
        if (input.questionIndex !== current.currentQuestionIndex) {
          // Idempotent guard against duplicate clicks or back-button tampering
          return {
            result: current,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }
        if (input.selectedOptionIndex < 0 || input.selectedOptionIndex > 3) {
          throw new CommandValidationError('Invalid answer option index.');
        }

        const qId = attempt.questionIds[input.questionIndex];
        const maxQMs = attempt.secondsPerQuestion * 1000;
        const shownIso =
          current.activeQuestionShownAt ?? new Date(nowMs).toISOString();
        const shownMs = Date.parse(shownIso);
        const deadlineIso =
          current.activeQuestionDeadlineAt ??
          new Date(shownMs + maxQMs).toISOString();
        const deadlineMs = Date.parse(deadlineIso);

        const newEvents: QuizAttemptEvent[] = [];
        const broadcasts: QuizCommandBroadcast[] = [];
        const answerIso = new Date(nowMs).toISOString();

        // Enforce stored deadline (small 250ms UI click tolerance)
        if (Number.isFinite(deadlineMs) && nowMs > deadlineMs + 250) {
          didTimeout = true;
          newEvents.push({
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'timed_out',
            questionId: qId,
            questionIndex: input.questionIndex,
            shownAt: shownIso,
            deadlineAt: deadlineIso,
            responseTimeMs: maxQMs,
            createdAt: answerIso,
          });
          broadcasts.push({
            event: 'quiz.timedOut',
            payload: {
              applicantId: attempt.applicantId,
              attemptId: attempt.id,
              questionIndex: input.questionIndex,
            },
          });
        } else {
          const responseTimeMs = Number.isFinite(shownMs)
            ? Math.max(0, Math.min(maxQMs, Math.round(nowMs - shownMs)))
            : maxQMs;
          newEvents.push({
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'answered',
            questionId: qId,
            questionIndex: input.questionIndex,
            selectedOptionIndex: input.selectedOptionIndex,
            displayedSlotIndex: input.displayedSlotIndex,
            shownAt: shownIso,
            deadlineAt: deadlineIso,
            responseTimeMs,
            createdAt: answerIso,
          });
          broadcasts.push({
            event: 'quiz.answered',
            payload: {
              applicantId: attempt.applicantId,
              attemptId: attempt.id,
              questionIndex: input.questionIndex,
            },
          });
        }

        const isLast = input.questionIndex >= attempt.questionIds.length - 1;
        if (isLast) {
          didFinish = true;
          newEvents.push({
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'finished',
            createdAt: new Date(nowMs + 1).toISOString(),
          });
        } else {
          const nextIdx = input.questionIndex + 1;
          const nextStartMs = nowMs + 1;
          newEvents.push({
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'question_shown',
            questionId: attempt.questionIds[nextIdx],
            questionIndex: nextIdx,
            shownAt: new Date(nextStartMs).toISOString(),
            deadlineAt: new Date(nextStartMs + maxQMs).toISOString(),
            createdAt: new Date(nextStartMs).toISOString(),
          });
        }

        db.quizEvents.push(...newEvents);
        const updatedDerived = deriveAttemptState(
          attempt,
          [...evs, ...newEvents],
          questionById,
          nowMs
        );

        if (isLast) {
          broadcasts.push({
            event: 'quiz.finished',
            payload: {
              applicantId: attempt.applicantId,
              attemptId: attempt.id,
              score: updatedDerived.score,
              totalResponseTimeMs: updatedDerived.totalResponseTimeMs,
            },
          });
        }

        return {
          result: updatedDerived,
          nextDb: db,
          broadcasts,
          // Full invariants checked automatically on finish (fast O(1) path during mid-attempt ticks)
          skipInvariants: !isLast,
        };
      });

      if (didTimeout) {
        feedback.play('quiz.timedOut');
        feedback.haptic('warning');
      } else {
        feedback.play('quiz.answered');
        feedback.haptic('light');
      }
      if (didFinish) {
        feedback.play('quiz.finished');
        feedback.haptic('winner');
      }
      return derived;
    },

    /**
     * Records a timeout for the active question (counts as wrong + full secondsPerQuestion time)
     * and advances to the next question or finishes the attempt.
     */
    async recordQuizTimeout(input: {
      attemptId: string;
      questionIndex: number;
      nowMs?: number;
    }): Promise<DerivedQuizAttempt> {
      let didFinish = false;

      const derived = await p.commitCommand('public-applicant', (_before, db) => {
        const nowMs = input.nowMs ?? Date.now();
        const attempt = db.quizAttempts.find((a) => a.id === input.attemptId);
        if (!attempt) {
          throw new CommandValidationError('Quiz attempt not found.');
        }
        const evs = db.quizEvents.filter((e) => e.attemptId === attempt.id);
        const questionById = new Map(db.quizQuestions.map((q) => [q.id, q]));
        const current = deriveAttemptState(attempt, evs, questionById, nowMs);

        if (
          current.status === 'finished' ||
          current.status === 'reset' ||
          input.questionIndex !== current.currentQuestionIndex
        ) {
          return {
            result: current,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }

        const qId = attempt.questionIds[input.questionIndex];
        const maxQMs = attempt.secondsPerQuestion * 1000;
        const shownIso =
          current.activeQuestionShownAt ??
          new Date(nowMs - maxQMs).toISOString();
        const deadlineIso =
          current.activeQuestionDeadlineAt ?? new Date(nowMs).toISOString();
        const nowIso = new Date(nowMs).toISOString();

        const newEvents: QuizAttemptEvent[] = [
          {
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'timed_out',
            questionId: qId,
            questionIndex: input.questionIndex,
            shownAt: shownIso,
            deadlineAt: deadlineIso,
            responseTimeMs: maxQMs,
            createdAt: nowIso,
          },
        ];

        const broadcasts: QuizCommandBroadcast[] = [
          {
            event: 'quiz.timedOut',
            payload: {
              applicantId: attempt.applicantId,
              attemptId: attempt.id,
              questionIndex: input.questionIndex,
            },
          },
        ];

        const isLast = input.questionIndex >= attempt.questionIds.length - 1;
        if (isLast) {
          didFinish = true;
          newEvents.push({
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'finished',
            createdAt: new Date(nowMs + 1).toISOString(),
          });
        } else {
          const nextIdx = input.questionIndex + 1;
          const nextStartMs = nowMs + 1;
          newEvents.push({
            id: p.nextId('qev'),
            attemptId: attempt.id,
            applicantId: attempt.applicantId,
            type: 'question_shown',
            questionId: attempt.questionIds[nextIdx],
            questionIndex: nextIdx,
            shownAt: new Date(nextStartMs).toISOString(),
            deadlineAt: new Date(nextStartMs + maxQMs).toISOString(),
            createdAt: new Date(nextStartMs).toISOString(),
          });
        }

        db.quizEvents.push(...newEvents);
        const updatedDerived = deriveAttemptState(
          attempt,
          [...evs, ...newEvents],
          questionById,
          nowMs
        );

        if (isLast) {
          broadcasts.push({
            event: 'quiz.finished',
            payload: {
              applicantId: attempt.applicantId,
              attemptId: attempt.id,
              score: updatedDerived.score,
              totalResponseTimeMs: updatedDerived.totalResponseTimeMs,
            },
          });
        }

        return {
          result: updatedDerived,
          nextDb: db,
          broadcasts,
          skipInvariants: !isLast,
        };
      });

      feedback.play('quiz.timedOut');
      feedback.haptic('warning');
      if (didFinish) {
        feedback.play('quiz.finished');
      }
      return derived;
    },

    /**
     * Records a genuine browser client-side integrity signal (tab hidden, page refresh, copy attempt).
     */
    async recordQuizIntegritySignal(input: {
      attemptId: string;
      signalType: QuizIntegritySignalType;
      questionIndex?: number;
    }): Promise<void> {
      await p.commitCommand('public-applicant', (_before, db) => {
        const attempt = db.quizAttempts.find((a) => a.id === input.attemptId);
        if (!attempt) {
          return {
            result: undefined,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }
        const evs = db.quizEvents.filter((e) => e.attemptId === attempt.id);
        const alreadyEnded = evs.some(
          (e) => e.type === 'finished' || e.type === 'reset'
        );
        if (alreadyEnded) {
          return {
            result: undefined,
            nextDb: db,
            broadcasts: [],
            skipInvariants: true,
          };
        }
        const qIdx = input.questionIndex;
        const qId =
          typeof qIdx === 'number' ? attempt.questionIds[qIdx] : undefined;

        db.quizEvents.push({
          id: p.nextId('qev'),
          attemptId: attempt.id,
          applicantId: attempt.applicantId,
          type: 'integrity_signal',
          questionId: qId,
          questionIndex: qIdx,
          signalType: input.signalType,
          createdAt: p.nextIsoTimestamp(),
        });

        return {
          result: undefined,
          nextDb: db,
          broadcasts: [],
          skipInvariants: true,
        };
      });
    },

    /**
     * Super Admin-only audited attempt reset (appends a `reset` event, never deletes history).
     */
    async resetQuizAttempt(input: {
      applicantId: string;
      reason: string;
      actorUserId: string;
    }): Promise<{ attemptId: string; applicantId: string }> {
      const reason = input.reason.trim();
      if (reason.length < 3) {
        throw new CommandValidationError(
          'Please provide a brief reason (at least 3 characters) for resetting this attempt.'
        );
      }

      return p.commitCommand(input.actorUserId, (_before, db) => {
        assertRepoPermission(db, input.actorUserId, 'quiz.resetAttempt');
        const applicant = db.quizApplicants.find(
          (a) => a.id === input.applicantId
        );
        if (!applicant) {
          throw new CommandValidationError('Quiz applicant not found.');
        }

        const active = getActiveAttemptForApplicant(db, applicant.id, Date.now());
        if (!active) {
          throw new CommandValidationError(
            'This applicant has no active quiz attempt to reset.'
          );
        }

        const nowIso = p.nextIsoTimestamp();
        const resetEvent: QuizAttemptEvent = {
          id: p.nextId('qev'),
          attemptId: active.attempt.id,
          applicantId: applicant.id,
          type: 'reset',
          reason,
          byUserId: input.actorUserId,
          createdAt: nowIso,
        };
        db.quizEvents.push(resetEvent);

        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'quiz.attemptReset',
            entityType: 'quiz_attempt',
            entityId: active.attempt.id,
            summary: `Reset quiz attempt for "${applicant.fullName}" (was ${active.status}, score ${active.score}/${active.questionsCount}). Reason: ${reason}`,
            summaryAr: `تمت إعادة ضبط محاولة الاختبار للمتقدم "${applicant.fullNameAr || applicant.fullName}" (النتيجة السابقة ${active.score}/${active.questionsCount}). السبب: ${reason}`,
            before: {
              attemptId: active.attempt.id,
              status: active.status,
              score: active.score,
              totalResponseTimeMs: active.totalResponseTimeMs,
            },
            after: {
              attemptId: active.attempt.id,
              status: 'reset',
              reason,
            },
          })
        );

        return {
          result: { attemptId: active.attempt.id, applicantId: applicant.id },
          nextDb: db,
          broadcasts: [
            {
              event: 'quiz.reset',
              payload: {
                applicantId: applicant.id,
                attemptId: active.attempt.id,
              },
            },
          ],
        };
      });
    },

    /**
     * Question Bank CRUD & CSV Import (Super Admin + Content Manager).
     */
    async createQuizQuestion(
      input: QuizQuestionInput,
      actorUserId: string
    ): Promise<QuizQuestion> {
      return p.commitCommand(actorUserId, (_before, db) => {
        assertRepoPermission(db, actorUserId, 'quiz.manageQuestions');
        const nowIso = p.nextIsoTimestamp();
        const parsed = QuizQuestionSchema.safeParse({
          id: p.nextId('qq'),
          category: input.category,
          difficulty: input.difficulty,
          reviewStatus: input.reviewStatus ?? 'draft',
          questionAr: input.questionAr.trim(),
          questionEn: input.questionEn.trim(),
          optionsAr: input.optionsAr.map((o) => o.trim()),
          optionsEn: input.optionsEn.map((o) => o.trim()),
          correctOptionIndex: input.correctOptionIndex,
          explanationAr: input.explanationAr?.trim() || undefined,
          explanationEn: input.explanationEn?.trim() || undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        if (!parsed.success) {
          throw new CommandValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid quiz question payload.'
          );
        }

        db.quizQuestions.unshift(parsed.data);
        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId,
            action: 'quiz.questionCreate',
            entityType: 'quiz_question',
            entityId: parsed.data.id,
            summary: `Created quiz question (${parsed.data.category}, ${parsed.data.difficulty}, ${parsed.data.reviewStatus}): "${parsed.data.questionEn.slice(0, 72)}"`,
            summaryAr: `تمت إضافة سؤال اختبار جديد (${parsed.data.reviewStatus}): "${parsed.data.questionAr.slice(0, 72)}"`,
            before: null,
            after: {
              id: parsed.data.id,
              category: parsed.data.category,
              reviewStatus: parsed.data.reviewStatus,
            },
          })
        );

        return {
          result: parsed.data,
          nextDb: db,
          broadcasts: [
            {
              event: 'quiz.questionUpdated',
              payload: { questionId: parsed.data.id },
            },
          ],
          skipInvariants: true,
        };
      });
    },

    async updateQuizQuestion(
      id: string,
      patch: Partial<QuizQuestionInput>,
      actorUserId: string
    ): Promise<QuizQuestion> {
      return p.commitCommand(actorUserId, (_before, db) => {
        assertRepoPermission(db, actorUserId, 'quiz.manageQuestions');
        const idx = db.quizQuestions.findIndex((q) => q.id === id);
        if (idx === -1) {
          throw new CommandValidationError('Quiz question not found.');
        }
        const prev = db.quizQuestions[idx];
        const candidate = {
          ...prev,
          ...patch,
          questionAr: (patch.questionAr ?? prev.questionAr).trim(),
          questionEn: (patch.questionEn ?? prev.questionEn).trim(),
          optionsAr: (patch.optionsAr ?? prev.optionsAr).map((o) => o.trim()),
          optionsEn: (patch.optionsEn ?? prev.optionsEn).map((o) => o.trim()),
          explanationAr:
            patch.explanationAr !== undefined
              ? patch.explanationAr.trim() || undefined
              : prev.explanationAr,
          explanationEn:
            patch.explanationEn !== undefined
              ? patch.explanationEn.trim() || undefined
              : prev.explanationEn,
          updatedAt: p.nextIsoTimestamp(),
        };
        const parsed = QuizQuestionSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new CommandValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid quiz question update.'
          );
        }

        db.quizQuestions[idx] = parsed.data;
        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId,
            action: 'quiz.questionUpdate',
            entityType: 'quiz_question',
            entityId: id,
            summary: `Updated quiz question "${parsed.data.questionEn.slice(0, 64)}" (${prev.reviewStatus} → ${parsed.data.reviewStatus}).`,
            summaryAr: `تم تحديث سؤال الاختبار "${parsed.data.questionAr.slice(0, 64)}" (${prev.reviewStatus} ← ${parsed.data.reviewStatus}).`,
            before: {
              category: prev.category,
              difficulty: prev.difficulty,
              reviewStatus: prev.reviewStatus,
              correctOptionIndex: prev.correctOptionIndex,
            },
            after: {
              category: parsed.data.category,
              difficulty: parsed.data.difficulty,
              reviewStatus: parsed.data.reviewStatus,
              correctOptionIndex: parsed.data.correctOptionIndex,
            },
          })
        );

        return {
          result: parsed.data,
          nextDb: db,
          broadcasts: [
            { event: 'quiz.questionUpdated', payload: { questionId: id } },
          ],
          skipInvariants: true,
        };
      });
    },

    async deleteQuizQuestion(id: string, actorUserId: string): Promise<void> {
      await p.commitCommand(actorUserId, (_before, db) => {
        assertRepoPermission(db, actorUserId, 'quiz.manageQuestions');
        const idx = db.quizQuestions.findIndex((q) => q.id === id);
        if (idx === -1) {
          throw new CommandValidationError('Quiz question not found.');
        }
        const minRequired = db.settings.quiz.questionsPerAttempt;
        if (db.quizQuestions.length - 1 < minRequired) {
          throw new CommandValidationError(
            `Cannot delete question: at least ${minRequired} questions are required to run an attempt.`
          );
        }
        const removed = db.quizQuestions[idx];
        db.quizQuestions.splice(idx, 1);

        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId,
            action: 'quiz.questionDelete',
            entityType: 'quiz_question',
            entityId: id,
            summary: `Deleted quiz question "${removed.questionEn.slice(0, 72)}".`,
            summaryAr: `تم حذف سؤال الاختبار "${removed.questionAr.slice(0, 72)}".`,
            before: {
              id: removed.id,
              category: removed.category,
              reviewStatus: removed.reviewStatus,
            },
            after: null,
          })
        );

        return {
          result: undefined,
          nextDb: db,
          broadcasts: [
            { event: 'quiz.questionUpdated', payload: { questionId: id } },
          ],
          skipInvariants: true,
        };
      });
    },

    async bulkImportQuizQuestions(
      inputs: QuizQuestionInput[],
      actorUserId: string
    ): Promise<QuizQuestion[]> {
      if (inputs.length === 0) {
        throw new CommandValidationError('No valid questions to import.');
      }
      return p.commitCommand(actorUserId, (_before, db) => {
        assertRepoPermission(db, actorUserId, 'quiz.manageQuestions');
        const created: QuizQuestion[] = [];
        for (const item of inputs) {
          const nowIso = p.nextIsoTimestamp();
          const parsed = QuizQuestionSchema.safeParse({
            id: p.nextId('qq'),
            category: item.category,
            difficulty: item.difficulty,
            reviewStatus: item.reviewStatus ?? 'draft',
            questionAr: item.questionAr.trim(),
            questionEn: item.questionEn.trim(),
            optionsAr: item.optionsAr.map((o) => o.trim()),
            optionsEn: item.optionsEn.map((o) => o.trim()),
            correctOptionIndex: item.correctOptionIndex,
            explanationAr: item.explanationAr?.trim() || undefined,
            explanationEn: item.explanationEn?.trim() || undefined,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          if (!parsed.success) {
            throw new CommandValidationError(
              parsed.error.issues[0]?.message ??
                'Invalid question row in CSV import.'
            );
          }
          created.push(parsed.data);
        }

        db.quizQuestions.unshift(...created);
        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId,
            action: 'quiz.questionBulkImport',
            entityType: 'quiz_question',
            entityId: 'quiz-bank',
            summary: `Imported ${created.length} quiz questions via CSV (all marked for review per row status).`,
            summaryAr: `تم استيراد ${created.length} سؤالاً جديداً إلى بنك الأسئلة عبر ملف CSV.`,
            before: { totalQuestions: db.quizQuestions.length - created.length },
            after: { totalQuestions: db.quizQuestions.length, importedCount: created.length },
          })
        );

        return {
          result: created,
          nextDb: db,
          broadcasts: [{ event: 'quiz.questionUpdated', payload: {} }],
          skipInvariants: true,
        };
      });
    },

    async bulkSetQuizQuestionsReviewStatus(
      ids: string[],
      reviewStatus: QuizReviewStatus,
      actorUserId: string
    ): Promise<number> {
      if (ids.length === 0) return 0;
      return p.commitCommand(actorUserId, (_before, db) => {
        assertRepoPermission(db, actorUserId, 'quiz.manageQuestions');
        const idSet = new Set(ids);
        const nowIso = p.nextIsoTimestamp();
        let changed = 0;

        db.quizQuestions = db.quizQuestions.map((q) => {
          if (!idSet.has(q.id) || q.reviewStatus === reviewStatus) return q;
          changed += 1;
          return { ...q, reviewStatus, updatedAt: nowIso };
        });

        if (changed > 0) {
          db.auditEntries.unshift(
            p.createAuditRecord({
              actorUserId,
              action: 'quiz.questionBulkReview',
              entityType: 'quiz_question',
              entityId: 'quiz-bank',
              summary: `Marked ${changed} quiz question(s) as "${reviewStatus}".`,
              summaryAr: `تم تغيير حالة مراجعة ${changed} سؤالاً إلى "${reviewStatus === 'approved' ? 'معتمد' : 'مسودة'}".`,
              before: { count: changed },
              after: { reviewStatus, count: changed },
            })
          );
        }

        return {
          result: changed,
          nextDb: db,
          broadcasts: [{ event: 'quiz.questionUpdated', payload: {} }],
          skipInvariants: true,
        };
      });
    },

    /**
     * Super Admin-only quiz settings update.
     */
    async updateQuizSettings(
      patch: Partial<QuizSettings>,
      actorUserId: string
    ): Promise<QuizSettings> {
      return p.commitCommand(actorUserId, (_before, db) => {
        assertRepoPermission(db, actorUserId, 'quiz.manageSettings');
        const prev = db.settings.quiz;
        const candidate = { ...prev, ...patch };
        const parsed = QuizSettingsSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new CommandValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid quiz settings.'
          );
        }
        const next = parsed.data;
        const startMs = Date.parse(next.windowStartsAt);
        const endMs = Date.parse(next.windowEndsAt);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
          throw new CommandValidationError(
            'Quiz window close time must be after the open time.'
          );
        }
        if (next.questionsPerAttempt > db.quizQuestions.length) {
          throw new CommandValidationError(
            `Questions per attempt (${next.questionsPerAttempt}) exceeds available bank size (${db.quizQuestions.length}).`
          );
        }

        db.settings = {
          ...db.settings,
          quiz: next,
          updatedAt: p.nextIsoTimestamp(),
        };

        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId,
            action: 'quiz.settingsUpdate',
            entityType: 'quiz_settings',
            entityId: 'global-settings',
            summary: `Updated quiz settings (${next.questionsPerAttempt} Qs × ${next.secondsPerQuestion}s, cutoff ${next.syncCutoffWithTournament ? `synced=${db.settings.tournament.totalPlayers}` : next.customCutoffN}).`,
            summaryAr: `تم تحديث إعدادات اختبار التسجيل (${next.questionsPerAttempt} سؤال × ${next.secondsPerQuestion} ثوانٍ).`,
            before: prev as unknown as Record<string, unknown>,
            after: next as unknown as Record<string, unknown>,
          })
        );

        return {
          result: next,
          nextDb: db,
          broadcasts: [
            {
              event: 'quiz.settingsUpdated',
              payload: { keys: Object.keys(patch) },
            },
            { event: 'settings.updated', payload: { keys: ['quiz'] } },
          ],
        };
      });
    },

    /**
     * Super Admin-only idempotent handoff: sends qualified quiz applicants to the tournament
     * as real `Player` records (with contact info + deterministic 3D avatars), links existing
     * matches without creating duplicates, skips conflicts, audits, and verifies all invariants.
     */
    async handoffQualifiedToTournament(input: {
      actorUserId: string;
      confirm: boolean;
    }): Promise<QuizHandoffExecutionResult> {
      if (!input.confirm) {
        throw new CommandValidationError(
          'Explicit Super Admin confirmation is required to hand off qualified applicants.'
        );
      }

      return p.commitCommand(input.actorUserId, (_before, db) => {
        assertRepoPermission(db, input.actorUserId, 'quiz.handoff');
        const nowMs = Date.now();
        const preview = previewQuizHandoff(db, nowMs);

        // Compute next available player seed cleanly
        let maxSeed = db.players
          .filter((pl) => !pl.isGuest && !pl.isHost)
          .reduce((acc, pl) => Math.max(acc, pl.seed), 0);

        const createdPlayerIds: string[] = [];
        const newPlayers: Player[] = [];
        const newHandoffs: QuizHandoffEvent[] = [];

        // 1. Create genuinely new tournament Player records
        for (const item of preview.newPlayersToCreate) {
          maxSeed += 1;
          const playerId = p.nextId('player-quiz');
          const firstTokenEn = item.fullName.trim().split(/\s+/)[0] || item.fullName;
          const firstTokenAr =
            (item.fullNameAr || item.fullName).trim().split(/\s+/)[0] ||
            firstTokenEn;
          const createdAt = p.nextIsoTimestamp();

          const player: Player = {
            id: playerId,
            fullName: item.fullName,
            fullNameAr: item.fullNameAr || item.fullName,
            nickname: firstTokenEn,
            nicknameAr: firstTokenAr,
            avatarSeed: `quiz-seed-${maxSeed}-${item.applicantId}`,
            avatar: {
              photoUrl: null,
              avatarKey: deterministicAvatarKey(maxSeed),
            },
            contact: {
              phone: item.phone,
              whatsapp: normalizeWhatsappFromPhone(item.phone),
              email: item.email,
            },
            phone: item.phone,
            email: item.email,
            seed: maxSeed,
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
            createdAt,
          };

          newPlayers.push(player);
          createdPlayerIds.push(playerId);

          newHandoffs.push({
            id: p.nextId('qh'),
            applicantId: item.applicantId,
            attemptId: item.attemptId,
            playerId,
            byUserId: input.actorUserId,
            rankAtHandoff: item.rank,
            scoreAtHandoff: item.score,
            createdAt,
          });
        }

        // 2. Link qualified applicants who already exist in the tournament roster (ZERO duplicate Player rows)
        const existingLinkedPlayerIds = new Set(
          db.quizHandoffs.map((h) => h.playerId)
        );
        let linkedExistingCount = 0;
        for (const dup of preview.duplicateExistingPlayers) {
          if (!dup.existingPlayerId || existingLinkedPlayerIds.has(dup.existingPlayerId)) {
            continue;
          }
          existingLinkedPlayerIds.add(dup.existingPlayerId);
          linkedExistingCount += 1;
          newHandoffs.push({
            id: p.nextId('qh'),
            applicantId: dup.applicantId,
            attemptId: dup.attemptId,
            playerId: dup.existingPlayerId,
            byUserId: input.actorUserId,
            rankAtHandoff: dup.rank,
            scoreAtHandoff: dup.score,
            createdAt: p.nextIsoTimestamp(),
          });
        }

        if (newPlayers.length > 0) {
          db.players.push(...newPlayers);
        }
        if (newHandoffs.length > 0) {
          db.quizHandoffs.push(...newHandoffs);
        }

        db.auditEntries.unshift(
          p.createAuditRecord({
            actorUserId: input.actorUserId,
            action: 'quiz.handoffToTournament',
            entityType: 'quiz_handoff',
            entityId: 'tournament-roster',
            summary: `Quiz handoff executed: created ${newPlayers.length} new tournament players, linked ${linkedExistingCount} existing roster matches, skipped ${preview.alreadyHandedOff.length} already handed off, ${preview.conflicts.length} conflicts.`,
            summaryAr: `تم ترحيل متأهلي الاختبار إلى البطولة: إنشاء ${newPlayers.length} لاعب جديد، ربط ${linkedExistingCount} مطابقات حالية، تخطي ${preview.alreadyHandedOff.length} مرحّلين مسبقاً، و${preview.conflicts.length} تعارضات.`,
            before: {
              playersCount: db.players.length - newPlayers.length,
              handoffsCount: db.quizHandoffs.length - newHandoffs.length,
            },
            after: {
              playersCount: db.players.length,
              handoffsCount: db.quizHandoffs.length,
              createdPlayersCount: newPlayers.length,
              linkedExistingCount,
              conflictsCount: preview.conflicts.length,
            },
          })
        );

        return {
          result: {
            preview,
            createdPlayersCount: newPlayers.length,
            linkedExistingCount,
            alreadyHandedOffCount: preview.alreadyHandedOff.length,
            conflictsCount: preview.conflicts.length,
            createdPlayerIds,
          },
          nextDb: db,
          broadcasts: [
            {
              event: 'quiz.handoffCompleted',
              payload: {
                createdCount: newPlayers.length,
                linkedCount: linkedExistingCount,
              },
            },
            ...(newPlayers.length > 0
              ? [{ event: 'player.updated' as const, payload: {} }]
              : []),
          ],
        };
      });
    },
  };
}
