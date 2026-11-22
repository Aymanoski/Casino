import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildPublicQuestionPayload,
  checkInvariants,
  computeQuizRankings,
  deriveAttemptState,
  getEffectiveQuizCutoff,
  getShuffledOptionOrder,
  normalizeQuizEmail,
  normalizeQuizPhone,
  previewQuizHandoff,
  selectShuffledQuestionIds,
} from '@/lib/engine';
import { commands } from '@/lib/commands';
import { quizRepo } from '@/lib/repos';
import { PermissionDeniedError } from '@/lib/repos/permissions';
import { realtime, type RealtimeEventName } from '@/lib/realtime';
import { createSeededQuizBundle, createSeedSnapshot } from '@/lib/seed';
import { storage } from '@/lib/storage';
import type { QuizAttempt, QuizAttemptEvent } from '@/lib/schemas';

describe('Registration Quiz Module (Demo) — Pure Engine, Commands, RBAC, Handoff & Invariants', () => {
  beforeEach(async () => {
    storage.invalidateCache();
    await storage.resetToSeed({
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      tablesCount: 4,
      slotMinutes: 30,
      includeDemoProgress: false,
      quizApplicantCount: 30,
    });
  });

  it('1. Deterministic seeded shuffle reproduces exact question order and 4-option permutation', () => {
    const bundle = createSeededQuizBundle({ applicantCount: 0 });
    expect(bundle.quizQuestions.length).toBeGreaterThanOrEqual(60);
    // Every seeded question must start as draft for human review
    expect(bundle.quizQuestions.every((q) => q.reviewStatus === 'draft')).toBe(true);

    const drawA1 = selectShuffledQuestionIds(bundle.quizQuestions, 20, 'seed-applicant-alpha');
    const drawA2 = selectShuffledQuestionIds(bundle.quizQuestions, 20, 'seed-applicant-alpha');
    const drawB = selectShuffledQuestionIds(bundle.quizQuestions, 20, 'seed-applicant-beta');

    expect(drawA1).toHaveLength(20);
    expect(new Set(drawA1).size).toBe(20);
    expect(drawA1).toEqual(drawA2);
    expect(drawA1).not.toEqual(drawB);

    const opt1 = getShuffledOptionOrder('att-1', drawA1[0], 'seed-applicant-alpha');
    const opt2 = getShuffledOptionOrder('att-1', drawA1[0], 'seed-applicant-alpha');
    const optDiffAttempt = getShuffledOptionOrder('att-2', drawA1[0], 'seed-applicant-beta');
    expect(opt1).toEqual(opt2);
    expect([...opt1].sort()).toEqual([0, 1, 2, 3]);
    expect([...optDiffAttempt].sort()).toEqual([0, 1, 2, 3]);

    // Public question payload must NEVER expose correctOptionIndex
    const payload = buildPublicQuestionPayload(
      bundle.quizQuestions[0],
      'att-1',
      0,
      'seed-applicant-alpha'
    );
    expect('correctOptionIndex' in payload).toBe(false);
    expect(payload.shuffledOptions).toHaveLength(4);
  });

  it('2. Scoring, timeouts (wrong + full 10s), tie-breaks, ranking & synced cutoff are derived purely from events', () => {
    const bundle = createSeededQuizBundle({ applicantCount: 0 });
    const qs = bundle.quizQuestions.slice(0, 4);
    const qMap = new Map(qs.map((q) => [q.id, q]));
    const baseMs = Date.parse('2027-03-01T18:00:00.000Z');

    const makeApplicant = (id: string, phone: string, email: string) => ({
      id,
      fullName: `Applicant ${id}`,
      fullNameAr: `متقدم ${id}`,
      phone,
      normalizedPhone: normalizeQuizPhone(phone),
      email,
      normalizedEmail: normalizeQuizEmail(email),
      verifiedAt: new Date(baseMs).toISOString(),
      verificationChannel: 'whatsapp_or_sms' as const,
      consentAcceptedAt: new Date(baseMs).toISOString(),
      createdAt: new Date(baseMs).toISOString(),
    });

    const applicants = [
      makeApplicant('a1', '010-1111-0001', 'a1@test.dev'), // 3/4 correct, 1 timeout (10s), total 16s
      makeApplicant('a2', '010-1111-0002', 'a2@test.dev'), // 3/4 correct, 1 wrong (3s), total 9s -> beats a1 on time!
      makeApplicant('a3', '010-1111-0003', 'a3@test.dev'), // 3/4 correct, total 9s, submitted 10s EARLIER -> beats a2 on submission time!
      makeApplicant('a4', '010-1111-0004', 'a4@test.dev'), // 4/4 correct, total 25s -> #1 overall!
    ];

    const attempts: QuizAttempt[] = applicants.map((a, idx) => ({
      id: `att-${a.id}`,
      applicantId: a.id,
      shuffleSeed: `s-${idx}`,
      questionIds: qs.map((q) => q.id),
      questionsCount: 4,
      secondsPerQuestion: 10,
      startedAt: new Date(baseMs + idx * 1000).toISOString(),
      createdAt: new Date(baseMs + idx * 1000).toISOString(),
    }));

    const events: QuizAttemptEvent[] = [];
    const addAttemptEvents = (
      aid: string,
      outcomes: Array<'correct' | 'wrong' | 'timeout'>,
      perAnswerMs: number,
      submitOffsetMs: number
    ) => {
      const attId = `att-${aid}`;
      events.push({
        id: `ev-${aid}-start`,
        attemptId: attId,
        applicantId: aid,
        type: 'started',
        createdAt: new Date(baseMs + submitOffsetMs - 30_000).toISOString(),
      });
      outcomes.forEach((out, idx) => {
        const q = qs[idx];
        const wrongIdx = (q.correctOptionIndex + 1) % 4;
        if (out === 'timeout') {
          events.push({
            id: `ev-${aid}-q${idx}`,
            attemptId: attId,
            applicantId: aid,
            type: 'timed_out',
            questionId: q.id,
            questionIndex: idx,
            responseTimeMs: 10_000,
            createdAt: new Date(baseMs + submitOffsetMs - 20_000 + idx * 1000).toISOString(),
          });
        } else {
          events.push({
            id: `ev-${aid}-q${idx}`,
            attemptId: attId,
            applicantId: aid,
            type: 'answered',
            questionId: q.id,
            questionIndex: idx,
            selectedOptionIndex: out === 'correct' ? q.correctOptionIndex : wrongIdx,
            responseTimeMs: perAnswerMs,
            createdAt: new Date(baseMs + submitOffsetMs - 20_000 + idx * 1000).toISOString(),
          });
        }
      });
      events.push({
        id: `ev-${aid}-fin`,
        attemptId: attId,
        applicantId: aid,
        type: 'finished',
        createdAt: new Date(baseMs + submitOffsetMs).toISOString(),
      });
    };

    // a1: 3 correct × 2s + 1 timeout (10s) = 16,000ms
    addAttemptEvents('a1', ['correct', 'correct', 'correct', 'timeout'], 2000, 60_000);
    // a2: 3 correct × 2.25s + 1 wrong × 2.25s = 9,000ms, submitted at +60s
    addAttemptEvents('a2', ['correct', 'correct', 'correct', 'wrong'], 2250, 60_000);
    // a3: same 3/4 & 9,000ms as a2, submitted 15s EARLIER (+45s)
    addAttemptEvents('a3', ['correct', 'correct', 'correct', 'wrong'], 2250, 45_000);
    // a4: 4/4 × 6.25s = 25,000ms
    addAttemptEvents('a4', ['correct', 'correct', 'correct', 'correct'], 6250, 70_000);

    // Check timeout math directly
    const a1Derived = deriveAttemptState(
      attempts[0],
      events.filter((e) => e.attemptId === 'att-a1'),
      qMap
    );
    expect(a1Derived.score).toBe(3);
    expect(a1Derived.timedOutCount).toBe(1);
    expect(a1Derived.totalResponseTimeMs).toBe(16_000);

    // Check ranking order & synced cutoff = 2
    const board = computeQuizRankings({
      applicants,
      attempts,
      events,
      questions: qs,
      handoffs: [],
      quizSettings: {
        ...bundle.quizSettings,
        questionsPerAttempt: 4,
        syncCutoffWithTournament: true,
      },
      tournamentSettings: {
        totalPlayers: 2,
        groupSize: 2,
        advancePerGroup: 1,
        pointsPerGroupWin: 3,
        tablesCount: 2,
        slotMinutes: 30,
        includeFinalWithMarwan: true,
      },
    });

    expect(board.rows.map((r) => r.applicant.id)).toEqual(['a4', 'a3', 'a2', 'a1']);
    expect(board.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(board.rows.map((r) => r.qualified)).toEqual([true, true, false, false]);
    expect(board.stats.cutoffN).toBe(2);

    // Custom cutoff override when syncCutoffWithTournament = false
    const customCutoff = getEffectiveQuizCutoff(
      { ...bundle.quizSettings, syncCutoffWithTournament: false, customCutoffN: 3 },
      {
        totalPlayers: 720,
        groupSize: 3,
        advancePerGroup: 1,
        pointsPerGroupWin: 3,
        tablesCount: 12,
        slotMinutes: 30,
        includeFinalWithMarwan: true,
      }
    );
    expect(customCutoff).toBe(3);
  });

  it('3. Refresh resumes using stored deadlines (never restarts clock), records integrity signals & emits realtime hooks', async () => {
    const publishedEvents: RealtimeEventName[] = [];
    const unsub = realtime.subscribe('*', (msg) => {
      if (msg.event.startsWith('quiz.')) {
        publishedEvents.push(msg.event);
      }
    });

    // Reduce attempt length to 3 questions so we complete a full attempt cleanly
    await quizRepo.updateSettings(
      { questionsPerAttempt: 3, secondsPerQuestion: 10 },
      'user-admin'
    );

    const reg = await quizRepo.registerApplicant({
      fullName: 'Nour Test',
      phone: '010-5555-9999',
      email: 'nour.test@example.com',
      consentAccepted: true,
    });
    expect(reg.status).toBe('registered_pending_verification');

    // Wrong OTP rejected
    await expect(
      quizRepo.verifyApplicant({ applicantId: reg.applicant.id, code: '000000' })
    ).rejects.toThrow();

    await quizRepo.verifyApplicant({
      applicantId: reg.applicant.id,
      code: '123456',
    });

    const t0 = Date.now();
    const started = await quizRepo.startAttempt({
      applicantId: reg.applicant.id,
      nowMs: t0,
    });
    const originalDeadline = started.derived.activeQuestionDeadlineAt;
    expect(originalDeadline).toBeTruthy();

    // Simulate page refresh 4 seconds later: ensureQuestionShown MUST NOT restart deadline
    const afterRefresh = await quizRepo.ensureQuestionShown({
      attemptId: started.attempt.id,
      questionIndex: 0,
      nowMs: t0 + 4000,
    });
    expect(afterRefresh.activeQuestionDeadlineAt).toBe(originalDeadline);
    expect(afterRefresh.activeQuestionRemainingMs).toBeLessThanOrEqual(6000);
    expect(afterRefresh.activeQuestionRemainingMs).toBeGreaterThan(5000);

    // Record real client-side integrity signals
    await quizRepo.recordIntegritySignal({
      attemptId: started.attempt.id,
      signalType: 'page_refresh',
      questionIndex: 0,
    });
    await quizRepo.recordIntegritySignal({
      attemptId: started.attempt.id,
      signalType: 'visibility_hidden',
      questionIndex: 0,
    });

    // Q0: answer after 4.2s
    const afterQ0 = await quizRepo.submitAnswer({
      attemptId: started.attempt.id,
      questionIndex: 0,
      selectedOptionIndex: 0,
      nowMs: t0 + 4200,
    });
    expect(afterQ0.currentQuestionIndex).toBe(1);
    expect(afterQ0.timeline[0].responseTimeMs).toBe(4200);

    // Q1: submit past stored deadline (12s later) -> automatically converts to timed_out (10,000ms)
    const afterQ1Late = await quizRepo.submitAnswer({
      attemptId: started.attempt.id,
      questionIndex: 1,
      selectedOptionIndex: 1,
      nowMs: t0 + 16_500,
    });
    expect(afterQ1Late.currentQuestionIndex).toBe(2);
    expect(afterQ1Late.timeline[1].outcome).toBe('timed_out');
    expect(afterQ1Late.timeline[1].responseTimeMs).toBe(10_000);

    // Q2: explicit timeout finishes attempt
    const finished = await quizRepo.recordTimeout({
      attemptId: started.attempt.id,
      questionIndex: 2,
      nowMs: t0 + 27_000,
    });
    expect(finished.status).toBe('finished');
    expect(finished.timedOutCount).toBe(2);
    expect(finished.integrity.pageRefresh).toBe(1);
    expect(finished.integrity.visibilityHidden).toBe(1);

    // Named realtime hook events emitted
    expect(publishedEvents).toContain('quiz.started');
    expect(publishedEvents).toContain('quiz.answered');
    expect(publishedEvents).toContain('quiz.timedOut');
    expect(publishedEvents).toContain('quiz.finished');
    unsub();

    // Public applicant session must NOT expose correctOptionIndex or rank before window closes
    const publicSess = await quizRepo.getApplicantSession(reg.applicant.id);
    expect(publicSess?.rankDisclosure.canShowRank).toBe(false);
    expect(publicSess?.rankDisclosure.rank).toBeNull();
    expect(publicSess?.attempt?.timeline.every((t) => t.correctOptionIndex === -1)).toBe(true);
  });

  it('4. Enforces strictly one attempt per verified phone/email and Super Admin-only audited reset', async () => {
    await quizRepo.updateSettings({ questionsPerAttempt: 3 }, 'user-admin');

    const reg1 = await quizRepo.registerApplicant({
      fullName: 'Salma OneTry',
      phone: '010-7777-8888',
      email: 'salma.onetry@example.com',
      consentAccepted: true,
    });
    await quizRepo.verifyApplicant({ applicantId: reg1.applicant.id, code: '123456' });
    const started = await quizRepo.startAttempt({ applicantId: reg1.applicant.id });

    // Finish all 3 questions via timeout
    for (let i = 0; i < 3; i += 1) {
      await quizRepo.recordTimeout({ attemptId: started.attempt.id, questionIndex: i });
    }

    // Attempt to re-register with formatted +20 variant of same phone -> blocked as already_finished
    const dupByPhone = await quizRepo.registerApplicant({
      fullName: 'Different Name',
      phone: '+201077778888',
      email: 'other.email@example.com',
      consentAccepted: true,
    });
    expect(dupByPhone.status).toBe('already_finished');

    // Attempt to re-register with uppercase variant of same email -> blocked as already_finished
    const dupByEmail = await quizRepo.registerApplicant({
      fullName: 'Different Name',
      phone: '011-2222-3333',
      email: 'SALMA.ONETRY@EXAMPLE.COM',
      consentAccepted: true,
    });
    expect(dupByEmail.status).toBe('already_finished');

    // Starting a second attempt directly must throw
    await expect(
      quizRepo.startAttempt({ applicantId: reg1.applicant.id })
    ).rejects.toThrow();

    // Non-Super Admin (Content Manager, Scorer) CANNOT reset an attempt
    await expect(
      quizRepo.resetAttempt({
        applicantId: reg1.applicant.id,
        reason: 'Trying without permission',
        actorUserId: 'user-content',
      })
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    await expect(
      quizRepo.resetAttempt({
        applicantId: reg1.applicant.id,
        reason: 'Scorer cannot reset',
        actorUserId: 'user-scorer-1',
      })
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    // Super Admin CAN reset with audit reason -> appends reset event (never deletes history)
    await quizRepo.resetAttempt({
      applicantId: reg1.applicant.id,
      reason: 'Verified power outage during Q2',
      actorUserId: 'user-admin',
    });

    const dbAfterReset = await storage.readSnapshot();
    const resetAudit = dbAfterReset.auditEntries.find(
      (a) => a.action === 'quiz.attemptReset' && a.entityId === started.attempt.id
    );
    expect(resetAudit).toBeTruthy();

    // Applicant can now legitimately start a brand new attempt while passing all invariants!
    const retry = await quizRepo.startAttempt({ applicantId: reg1.applicant.id });
    expect(retry.attempt.id).not.toBe(started.attempt.id);

    const invReport = checkInvariants(await storage.readSnapshot());
    expect(invReport.violations).toEqual([]);
  });

  it('5. RBAC enforces Content Manager question-bank-only access and protects applicant contacts', async () => {
    // Content Manager CAN list & create questions
    const bank = await quizRepo.listQuestionsForAdmin('user-content');
    expect(bank.questions.length).toBeGreaterThanOrEqual(60);

    const created = await quizRepo.createQuestion(
      {
        category: 'general',
        difficulty: 'easy',
        reviewStatus: 'draft',
        questionAr: 'كم عدد أيام الأسبوع؟',
        questionEn: 'How many days are in a week?',
        optionsAr: ['٥', '٦', '٧', '٨'],
        optionsEn: ['5', '6', '7', '8'],
        correctOptionIndex: 2,
      },
      'user-content'
    );
    expect(created.id).toBeTruthy();

    // Content Manager CANNOT view applicant results/contacts, change quiz settings, or run handoff
    await expect(quizRepo.getAdminResultsBoard('user-content')).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    await expect(quizRepo.getAdminDashboard('user-content')).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    await expect(
      quizRepo.updateSettings({ secondsPerQuestion: 15 }, 'user-content')
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      quizRepo.handoffQualifiedToTournament({ actorUserId: 'user-content', confirm: true })
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    // Scorer cannot even read admin question bank
    await expect(quizRepo.listQuestionsForAdmin('user-scorer-1')).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
  });

  it('6. Tournament handoff Impact Preview & idempotency: creates new players, skips duplicates, repeatable with 0 duplicates', async () => {
    // Cutoff follows tournament totalPlayers = 12; seeded 30 applicants include 5 overlaps (players 1..5)
    const preview1 = await quizRepo.previewHandoff('user-admin');
    expect(preview1.cutoffN).toBe(12);
    expect(preview1.totalQualified).toBe(12);
    expect(preview1.duplicateExistingPlayers.length).toBeGreaterThanOrEqual(1);
    expect(preview1.newPlayersToCreate.length).toBeGreaterThan(0);

    const dbBefore = await storage.readSnapshot();
    const beforePlayerCount = dbBefore.players.length;

    // First handoff execution
    const exec1 = await quizRepo.handoffQualifiedToTournament({
      actorUserId: 'user-admin',
      confirm: true,
    });
    expect(exec1.createdPlayersCount).toBe(preview1.newPlayersToCreate.length);
    expect(exec1.linkedExistingCount).toBe(preview1.duplicateExistingPlayers.length);

    const dbAfter1 = await storage.readSnapshot();
    expect(dbAfter1.players.length).toBe(beforePlayerCount + exec1.createdPlayersCount);
    // Every created player carries contact info and a valid 3D avatarKey
    for (const pid of exec1.createdPlayerIds) {
      const pl = dbAfter1.players.find((p) => p.id === pid);
      expect(pl).toBeTruthy();
      expect(pl?.contact.phone).toBeTruthy();
      expect(pl?.avatar.avatarKey).toMatch(/^avatar-\d{2}$/);
    }
    // Audited
    expect(
      dbAfter1.auditEntries.some((a) => a.action === 'quiz.handoffToTournament')
    ).toBe(true);
    // Zero consistency invariant violations
    expect(checkInvariants(dbAfter1).violations).toEqual([]);

    // Second handoff execution MUST be 100% idempotent (0 new players, 0 duplicates!)
    const preview2 = await quizRepo.previewHandoff('user-admin');
    expect(preview2.newPlayersToCreate).toHaveLength(0);
    expect(preview2.duplicateExistingPlayers).toHaveLength(0);
    expect(preview2.alreadyHandedOff).toHaveLength(12);

    const exec2 = await quizRepo.handoffQualifiedToTournament({
      actorUserId: 'user-admin',
      confirm: true,
    });
    expect(exec2.createdPlayersCount).toBe(0);
    expect(exec2.linkedExistingCount).toBe(0);

    const dbAfter2 = await storage.readSnapshot();
    expect(dbAfter2.players.length).toBe(dbAfter1.players.length);
    expect(checkInvariants(dbAfter2).violations).toEqual([]);
  });

  it('7. Default 1,200-applicant seed passes all 14 consistency invariants, and invariants catch corruptions loudly', () => {
    const fullSeed = createSeedSnapshot({
      totalPlayers: 720,
      quizApplicantCount: 1200,
    });

    expect(fullSeed.quizQuestions.length).toBe(64);
    expect(fullSeed.quizApplicants.length).toBe(1200);
    expect(fullSeed.quizAttempts.length).toBe(1200);
    expect(fullSeed.quizEvents.length).toBeGreaterThan(20_000);

    const cleanReport = checkInvariants(fullSeed);
    expect(cleanReport.totalChecks).toBe(14);
    expect(cleanReport.ok).toBe(true);
    expect(cleanReport.violations).toEqual([]);

    // Verify invariants detect injected quiz corruption (duplicate active attempt + orphan event + missing handoff player)
    const corrupted = {
      ...fullSeed,
      quizAttempts: [
        ...fullSeed.quizAttempts,
        {
          ...fullSeed.quizAttempts[0],
          id: 'qatt-illegal-dup',
        },
      ],
      quizEvents: [
        ...fullSeed.quizEvents,
        {
          id: 'qev-orphan-test',
          attemptId: 'qatt-missing',
          applicantId: 'qa-missing',
          type: 'started' as const,
          createdAt: new Date().toISOString(),
        },
      ],
      quizHandoffs: [
        {
          id: 'qh-broken-ref',
          applicantId: fullSeed.quizApplicants[0].id,
          attemptId: fullSeed.quizAttempts[0].id,
          playerId: 'player-does-not-exist',
          byUserId: 'user-admin',
          rankAtHandoff: 1,
          scoreAtHandoff: 19,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const brokenReport = checkInvariants(corrupted);
    expect(brokenReport.ok).toBe(false);
    const codes = new Set(brokenReport.violations.map((v) => v.code));
    expect(codes.has('QUIZ_ONE_ACTIVE_ATTEMPT_PER_APPLICANT')).toBe(true);
    expect(codes.has('QUIZ_NO_ORPHAN_EVENTS')).toBe(true);
    expect(codes.has('QUIZ_HANDOFF_NO_DUPLICATE_PLAYERS')).toBe(true);
  });
});
