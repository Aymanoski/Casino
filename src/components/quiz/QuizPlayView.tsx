'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Clock,
  Keyboard,
  ShieldAlert,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  quizRepo,
  type ApplicantQuizSessionView,
} from '@/lib/repos';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SunburstStage } from '@/components/brand/SunburstStage';
import { QuizCountdownRing } from './QuizCountdownRing';
import {
  QUIZ_CATEGORY_LABELS,
  QUIZ_MOUNT_MARKER_PREFIX,
  readStoredApplicantSession,
} from './quizHelpers';

const ADVANCE_FEEDBACK_MS = 280;
const TIMEOUT_BANNER_MS = 650;

export function QuizPlayView() {
  const router = useRouter();
  const { lang } = useI18n();

  const [session, setSession] = useState<ApplicantQuizSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingMs, setRemainingMs] = useState<number>(10_000);
  const [phase, setPhase] = useState<'answering' | 'recorded' | 'timeout'>('answering');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [integrityToast, setIntegrityToast] = useState<string | null>(null);

  const applicantIdRef = useRef<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const questionIdxRef = useRef<number>(0);
  const busyRef = useRef<boolean>(false);
  const timeoutHandledForIdxRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showIntegrityNotice = useCallback((msg: string) => {
    setIntegrityToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setIntegrityToast(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const syncSession = useCallback(
    async (applicantId: string, checkRefreshSignal = false) => {
      const now = Date.now();
      let sess = await quizRepo.getApplicantSession(applicantId, now);
      if (!sess || !sess.attempt) {
        router.replace('/quiz/register');
        return;
      }

      if (sess.attempt.status === 'finished') {
        router.replace('/quiz/result');
        return;
      }

      if (sess.attempt.status === 'reset') {
        router.replace('/quiz/rules');
        return;
      }

      const attemptId = sess.attempt.attempt.id;
      attemptIdRef.current = attemptId;
      questionIdxRef.current = sess.attempt.currentQuestionIndex;

      // Detect genuine browser refresh mid-attempt (sessionStorage survives F5 in same tab)
      if (checkRefreshSignal && typeof window !== 'undefined') {
        const markerKey = `${QUIZ_MOUNT_MARKER_PREFIX}${attemptId}`;
        if (window.sessionStorage.getItem(markerKey)) {
          await quizRepo.recordIntegritySignal({
            attemptId,
            signalType: 'page_refresh',
            questionIndex: sess.attempt.currentQuestionIndex,
          });
          showIntegrityNotice(
            lang === 'ar'
              ? 'تم استكمال السؤال من التوقيت الأصلي (سُجلت إعادة التحميل كإشارة نزاهة).'
              : 'Resumed from stored deadline (page refresh logged as a client-side signal).'
          );
        } else {
          window.sessionStorage.setItem(markerKey, '1');
        }
      }

      // Ensure question_shown exists (idempotent — NEVER resets stored deadline!)
      if (!sess.attempt.activeQuestionDeadlineAt) {
        await quizRepo.ensureQuestionShown({
          attemptId,
          questionIndex: sess.attempt.currentQuestionIndex,
          nowMs: Date.now(),
        });
        sess = await quizRepo.getApplicantSession(applicantId, Date.now());
        if (!sess || !sess.attempt) return;
      }

      // If stored deadline already expired while away/refreshing, immediately record timeout
      const dlIso = sess.attempt.activeQuestionDeadlineAt;
      const dlMs = dlIso ? Date.parse(dlIso) : NaN;
      if (Number.isFinite(dlMs) && Date.now() >= dlMs) {
        const updated = await quizRepo.recordTimeout({
          attemptId,
          questionIndex: sess.attempt.currentQuestionIndex,
          nowMs: Date.now(),
        });
        if (updated.status === 'finished') {
          router.replace('/quiz/result');
          return;
        }
        const refreshed = await quizRepo.getApplicantSession(applicantId, Date.now());
        if (refreshed && refreshed.attempt) {
          sess = refreshed;
          questionIdxRef.current = refreshed.attempt.currentQuestionIndex;
        }
      }

      const activeAttempt = sess.attempt;
      if (!activeAttempt) return;
      const freshDl = activeAttempt.activeQuestionDeadlineAt
        ? Date.parse(activeAttempt.activeQuestionDeadlineAt)
        : Date.now() + activeAttempt.attempt.secondsPerQuestion * 1000;

      setRemainingMs(Math.max(0, freshDl - Date.now()));
      setSelectedSlot(null);
      setPhase('answering');
      busyRef.current = false;
      timeoutHandledForIdxRef.current = -1;
      setSession(sess);
      setLoading(false);
    },
    [lang, router, showIntegrityNotice]
  );

  // Initial mount & resume check
  useEffect(() => {
    const stored = readStoredApplicantSession();
    if (!stored) {
      router.replace('/quiz/register');
      return;
    }
    applicantIdRef.current = stored.applicantId;
    void syncSession(stored.applicantId, true);
  }, [router, syncSession]);

  // Real browser client-side integrity signal listeners (visibilitychange + copy + contextmenu)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && attemptIdRef.current) {
        void quizRepo.recordIntegritySignal({
          attemptId: attemptIdRef.current,
          signalType: 'visibility_hidden',
          questionIndex: questionIdxRef.current,
        });
      } else if (!document.hidden && attemptIdRef.current) {
        showIntegrityNotice(
          lang === 'ar'
            ? 'تنبيه: تم تسجيل مغادرة الصفحة كإشارة نزاهة للمراجعة.'
            : 'Notice: Leaving this tab was logged as a client-side integrity signal.'
        );
      }
    };

    const onCopyOrContext = (e: Event) => {
      if (!attemptIdRef.current) return;
      e.preventDefault();
      void quizRepo.recordIntegritySignal({
        attemptId: attemptIdRef.current,
        signalType: 'copy_attempt',
        questionIndex: questionIdxRef.current,
      });
      showIntegrityNotice(
        lang === 'ar'
          ? 'النسخ غير مسموح أثناء الاختبار (تم تسجيل المحاولة).'
          : 'Copying is disabled during the quiz (attempt logged).'
      );
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopyOrContext);
    document.addEventListener('contextmenu', onCopyOrContext);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopyOrContext);
      document.removeEventListener('contextmenu', onCopyOrContext);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [lang, showIntegrityNotice]);

  // Handle timeout automatically
  const triggerTimeout = useCallback(async () => {
    if (!session?.attempt || busyRef.current) return;
    const idx = session.attempt.currentQuestionIndex;
    if (timeoutHandledForIdxRef.current === idx) return;
    timeoutHandledForIdxRef.current = idx;
    busyRef.current = true;
    setPhase('timeout');
    setRemainingMs(0);

    try {
      const updated = await quizRepo.recordTimeout({
        attemptId: session.attempt.attempt.id,
        questionIndex: idx,
        nowMs: Date.now(),
      });

      window.setTimeout(() => {
        if (updated.status === 'finished') {
          router.replace('/quiz/result');
        } else if (applicantIdRef.current) {
          void syncSession(applicantIdRef.current, false);
        }
      }, TIMEOUT_BANNER_MS);
    } catch {
      busyRef.current = false;
    }
  }, [router, session, syncSession]);

  // Wall-clock deadline synced animation loop (never restarts or drifts)
  useEffect(() => {
    if (
      loading ||
      !session?.attempt ||
      !session.attempt.activeQuestionDeadlineAt ||
      phase !== 'answering'
    ) {
      return;
    }

    const deadlineMs = Date.parse(session.attempt.activeQuestionDeadlineAt);
    if (!Number.isFinite(deadlineMs)) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const left = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        void triggerTimeout();
        return;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [loading, phase, session, triggerTimeout]);

  // Select an answer option (instant neutral feedback, never reveals right/wrong)
  const handleSelectOption = useCallback(
    async (slotIndex: 0 | 1 | 2 | 3, canonicalIndex: 0 | 1 | 2 | 3) => {
      if (!session?.attempt || busyRef.current || phase !== 'answering') return;
      busyRef.current = true;
      setSelectedSlot(slotIndex);
      setPhase('recorded');

      try {
        const updated = await quizRepo.submitAnswer({
          attemptId: session.attempt.attempt.id,
          questionIndex: session.attempt.currentQuestionIndex,
          selectedOptionIndex: canonicalIndex,
          displayedSlotIndex: slotIndex,
          nowMs: Date.now(),
        });

        window.setTimeout(() => {
          if (updated.status === 'finished') {
            router.replace('/quiz/result');
          } else if (applicantIdRef.current) {
            void syncSession(applicantIdRef.current, false);
          }
        }, ADVANCE_FEEDBACK_MS);
      } catch {
        busyRef.current = false;
        setPhase('answering');
        setSelectedSlot(null);
      }
    },
    [phase, router, session, syncSession]
  );

  // Desktop keyboard shortcuts: 1, 2, 3, 4
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'answering' || !session?.activeQuestion) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx === -1) return;
      const opt = session.activeQuestion.shuffledOptions[idx];
      if (!opt) return;
      e.preventDefault();
      void handleSelectOption(opt.slotIndex, opt.canonicalIndex);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectOption, phase, session]);

  if (loading || !session || !session.attempt || !session.activeQuestion) {
    return (
      <SunburstStage className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-5">
          <Skeleton className="mx-auto h-40 w-40 rounded-pill bg-white/20" />
          <Skeleton className="h-32 w-full rounded-card bg-white/20" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-16 w-full rounded-card bg-white/20" />
            <Skeleton className="h-16 w-full rounded-card bg-white/20" />
            <Skeleton className="h-16 w-full rounded-card bg-white/20" />
            <Skeleton className="h-16 w-full rounded-card bg-white/20" />
          </div>
        </div>
      </SunburstStage>
    );
  }

  const attempt = session.attempt;
  const question = session.activeQuestion;
  const qNum = attempt.currentQuestionIndex + 1;
  const qTotal = attempt.questionsCount;
  const totalMs = attempt.attempt.secondsPerQuestion * 1000;
  const catMeta = QUIZ_CATEGORY_LABELS[question.category];
  const progressPct = Math.round(((qNum - 1) / Math.max(1, qTotal)) * 100);
  const slotLetters =
    lang === 'ar' ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];

  return (
    <SunburstStage className="flex flex-1 flex-col justify-between py-4 sm:py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] select-none">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-between gap-4 px-4 sm:gap-5">
        {/* Progress Header */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              data-testid="quiz-progress-label"
              className="inline-flex items-center gap-2 rounded-pill border-2 border-outline bg-white px-3.5 py-1 text-xs sm:text-sm font-black text-red-900 shadow-sticker-sm tabular-nums"
            >
              <span>
                {lang === 'ar'
                  ? `السؤال ${qNum} من ${qTotal}`
                  : `Question ${qNum} of ${qTotal}`}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-white px-3 py-1 text-xs font-extrabold text-red-900 shadow-sticker-sm">
              <span>{lang === 'ar' ? catMeta.ar : catMeta.en}</span>
            </div>
          </div>

          {/* Crisp Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={qNum}
            aria-valuemin={1}
            aria-valuemax={qTotal}
            className="h-3 w-full overflow-hidden rounded-pill border-2 border-outline bg-red-900/80 p-0.5"
          >
            <div
              className="h-full rounded-pill bg-gold-gradient transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(5, progressPct)}%` }}
            />
          </div>

          {integrityToast && (
            <div
              role="status"
              data-testid="quiz-integrity-notice"
              className="flex items-center gap-2 rounded-card border-2 border-outline bg-gold-200 px-3.5 py-2 text-xs font-bold text-red-900 shadow-sticker-sm"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-800" aria-hidden="true" />
              <span>{integrityToast}</span>
            </div>
          )}
        </div>

        {/* Center: Huge 10-Second Countdown + Question Card */}
        <div className="flex flex-col items-center gap-4 sm:gap-5">
          <QuizCountdownRing
            totalMs={totalMs}
            remainingMs={remainingMs}
            isTimedOut={phase === 'timeout'}
          />

          {/* Timeout / Recorded Neutral Feedback Strip */}
          <div className="min-h-[36px] flex items-center justify-center">
            {phase === 'timeout' && (
              <div
                role="alert"
                data-testid="quiz-timeout-banner"
                className="inline-flex items-center gap-2 rounded-pill border-2 border-white bg-red-900 px-4 py-1.5 text-sm font-black text-gold-200 shadow-sticker-sm"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'انتهى الوقت — تم احتساب ١٠ ثوانٍ والانتقال للتالي'
                    : 'Time’s up — 10s recorded, advancing...'}
                </span>
              </div>
            )}
            {phase === 'recorded' && (
              <div
                role="status"
                data-testid="quiz-answer-recorded"
                className="inline-flex items-center gap-2 rounded-pill border-2 border-white bg-blue-600 px-4 py-1.5 text-sm font-black text-white shadow-sticker-sm"
              >
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'تم تسجيل إجابتك!' : 'Answer recorded!'}
                </span>
              </div>
            )}
          </div>

          {/* Question Sticker Card */}
          <div
            data-testid="quiz-question-card"
            className="w-full rounded-card border-[3px] border-outline bg-white p-5 sm:p-7 text-center text-ink shadow-sticker-lg"
          >
            <h1
              data-testid="quiz-question-text"
              className={cn(
                'font-extrabold text-red-900',
                lang === 'ar'
                  ? 'text-xl sm:text-2xl leading-[1.7]'
                  : 'text-lg sm:text-2xl leading-snug'
              )}
            >
              {lang === 'ar' ? question.questionAr : question.questionEn}
            </h1>
          </div>
        </div>

        {/* 4 Large Thumb-Friendly Answer Buttons (2x2 on sm+, stacked on phones) */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {question.shuffledOptions.map((opt) => {
              const isChosen = selectedSlot === opt.slotIndex;
              const isDisabled = phase !== 'answering';
              return (
                <button
                  key={`${question.id}-${opt.slotIndex}`}
                  type="button"
                  disabled={isDisabled}
                  data-testid={`quiz-option-${opt.slotIndex}`}
                  data-canonical-index={opt.canonicalIndex}
                  onClick={() =>
                    void handleSelectOption(opt.slotIndex, opt.canonicalIndex)
                  }
                  className={cn(
                    'group relative flex min-h-[60px] sm:min-h-[68px] w-full items-center gap-3 rounded-card border-[3px] px-4 py-3 text-start transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    isChosen
                      ? 'border-white bg-blue-600 text-white shadow-[0_0_0_3px_var(--outline)] scale-[0.99]'
                      : isDisabled
                        ? 'border-outline/70 bg-white/80 text-ink/70 cursor-not-allowed'
                        : 'border-outline bg-white text-red-900 shadow-sticker sticker-press hover:bg-paper-2'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-button border-2 text-sm font-black tabular-nums',
                      isChosen
                        ? 'border-white bg-white text-blue-700'
                        : 'border-outline bg-gold-300 text-red-900'
                    )}
                  >
                    {slotLetters[opt.slotIndex]}
                  </span>
                  <span
                    className={cn(
                      'flex-1 font-bold break-words',
                      lang === 'ar'
                        ? 'text-base sm:text-lg leading-[1.6]'
                        : 'text-base leading-snug'
                    )}
                  >
                    {lang === 'ar' ? opt.labelAr : opt.labelEn}
                  </span>
                  <kbd
                    aria-hidden="true"
                    className={cn(
                      'hidden h-7 w-7 shrink-0 items-center justify-center rounded-highlight border text-xs font-extrabold md:inline-flex',
                      isChosen
                        ? 'border-white/60 bg-blue-800 text-white'
                        : 'border-border-paper bg-paper text-ink-muted'
                    )}
                  >
                    {opt.slotIndex + 1}
                  </kbd>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gold-300" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'لا يمكن الرجوع للسؤال السابق'
                  : 'No going back once answered'}
              </span>
            </span>
            <span className="hidden items-center gap-1.5 md:inline-flex">
              <Keyboard className="h-3.5 w-3.5 text-gold-300" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'اختصارات لوحة المفاتيح: ١ - ٤'
                  : 'Keyboard shortcuts: 1 – 4'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </SunburstStage>
  );
}
