'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Home,
  Hourglass,
  RotateCcw,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  quizRepo,
  type ApplicantQuizSessionView,
} from '@/lib/repos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SunburstStage, StageDivider } from '@/components/brand/SunburstStage';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { QuizDemoBanner } from './QuizDemoBanner';
import {
  clearStoredApplicantSession,
  formatQuizTimestamp,
  formatResponseTimeMs,
  readStoredApplicantSession,
} from './quizHelpers';

export function QuizResultView() {
  const router = useRouter();
  const { lang } = useI18n();
  const [session, setSession] = useState<ApplicantQuizSessionView | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      const stored = readStoredApplicantSession();
      if (!stored) {
        return;
      }
      const sess = await quizRepo.getApplicantSession(stored.applicantId);
      setSession(sess);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
    const u1 = realtime.subscribe('quiz.settingsUpdated', loadSession);
    const u2 = realtime.subscribe('quiz.reset', loadSession);
    return () => {
      u1();
      u2();
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10">
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-44 w-full rounded-card" />
      </div>
    );
  }

  if (!session || !session.attempt || session.attempt.status !== 'finished') {
    return (
      <div className="theme-paper flex-1 bg-paper py-12">
        <div className="mx-auto max-w-lg px-4 text-center space-y-4">
          <div className="rounded-card border-[3px] border-outline bg-white p-6 shadow-sticker space-y-4">
            <h1 className="font-display text-2xl text-red-900">
              {lang === 'ar'
                ? 'لا توجد نتيجة مكتملة بعد'
                : 'No Completed Attempt Found'}
            </h1>
            <p className="text-sm text-ink-muted">
              {lang === 'ar'
                ? 'ابدأ التسجيل وخوض اختبار الـ ٢٠ سؤالاً لتحصل على نتيجتك فوراً.'
                : 'Register and complete the 20-question qualification quiz to see your score and time.'}
            </p>
            <Button asChild variant="primary" size="lg">
              <Link href="/quiz">
                <span>{lang === 'ar' ? 'الذهاب لصفحة الاختبار' : 'Go to Quiz Home'}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const attempt = session.attempt;
  const disclosure = session.rankDisclosure;

  const handleTryAnotherDemo = () => {
    clearStoredApplicantSession();
    router.push('/quiz/register');
  };

  return (
    <div className="flex flex-1 flex-col">
      <SunburstStage className="py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-pill border-2 border-outline bg-white px-4 py-1 text-xs font-black text-red-900 shadow-sticker-sm">
            <CheckCircle2 className="h-4 w-4 text-positive-ink" aria-hidden="true" />
            <span>
              {lang === 'ar' ? 'تم استلام إجاباتك بنجاح' : 'SUBMISSION RECORDED'}
            </span>
          </div>

          <h1 className="mt-4 font-display text-fluid-hero leading-tight text-gold-sticker-lg">
            {lang === 'ar'
              ? `أحسنت يا ${session.applicant.fullNameAr || session.applicant.fullName}!`
              : `Well Played, ${session.applicant.fullName}!`}
          </h1>

          {/* Primary Score & Time Chips */}
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-card border-[3px] border-outline bg-white p-5 text-ink shadow-sticker">
              <div className="flex items-center justify-center gap-3">
                <ScoreChip value={attempt.score} tone="gold" size="lg" />
                <div className="text-start">
                  <div className="text-xs font-extrabold uppercase text-ink-muted">
                    {lang === 'ar' ? 'نتيجتك النهائية' : 'Your Score'}
                  </div>
                  <div
                    data-testid="quiz-result-score"
                    dir="ltr"
                    className="font-score text-3xl sm:text-4xl font-black text-red-900 tabular-nums"
                  >
                    {attempt.score} / {attempt.questionsCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-card border-[3px] border-outline bg-white p-5 text-ink shadow-sticker">
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-blue-100 text-blue-800 shadow-sticker-sm">
                  <Clock className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="text-start">
                  <div className="text-xs font-extrabold uppercase text-ink-muted">
                    {lang === 'ar' ? 'إجمالي زمن الإجابة' : 'Total Response Time'}
                  </div>
                  <div
                    data-testid="quiz-result-time"
                    className="font-score text-3xl sm:text-4xl font-black text-red-900 tabular-nums"
                  >
                    {formatResponseTimeMs(attempt.totalResponseTimeMs, lang)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-white/95">
            <span className="rounded-pill border border-white/30 bg-red-900/70 px-3 py-1 tabular-nums">
              {lang === 'ar'
                ? `إجابات في الوقت: ${attempt.questionsCount - attempt.timedOutCount}`
                : `Answered in time: ${attempt.questionsCount - attempt.timedOutCount}`}
            </span>
            <span className="rounded-pill border border-white/30 bg-red-900/70 px-3 py-1 tabular-nums">
              {lang === 'ar'
                ? `انتهى وقتها: ${attempt.timedOutCount}`
                : `Timed out: ${attempt.timedOutCount}`}
            </span>
            {attempt.submittedAt && (
              <span className="rounded-pill border border-white/30 bg-red-900/70 px-3 py-1">
                {formatQuizTimestamp(attempt.submittedAt, lang)}
              </span>
            )}
          </div>
        </div>
      </SunburstStage>

      <StageDivider variant="scallop" from="stage" to="paper" />

      {/* PAPER SECTION: RANK STATUS + NEXT STEPS */}
      <section className="theme-paper flex-1 bg-paper py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-5 px-4">
          <QuizDemoBanner surface="paper" />

          {/* Window-Aware Rank Disclosure Card */}
          <div
            data-testid="quiz-result-rank-card"
            className="rounded-card border-[3px] border-outline bg-white p-5 sm:p-6 shadow-sticker space-y-3"
          >
            {disclosure.canShowRank && disclosure.rank !== null ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-gold-600" aria-hidden="true" />
                    <h2 className="font-display text-2xl text-red-900">
                      {lang === 'ar' ? 'ترتيبك الرسمي' : 'Your Official Rank'}
                    </h2>
                  </div>
                  <Badge variant={disclosure.qualified ? 'positive' : 'neutral'}>
                    {disclosure.qualified
                      ? lang === 'ar'
                        ? `متأهل (ضمن أعلى ${disclosure.cutoffN})`
                        : `Qualified (Top ${disclosure.cutoffN})`
                      : lang === 'ar'
                        ? 'قائمة الانتظار'
                        : 'Waitlisted'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    data-testid="quiz-result-rank"
                    className="font-score text-5xl font-black text-red-700 tabular-nums"
                  >
                    #{disclosure.rank}
                  </span>
                  <span className="text-sm font-bold text-ink-muted">
                    {lang === 'ar'
                      ? `من أصل ${disclosure.totalFinished} متقدم أتموا الاختبار (خط التأهل: أعلى ${disclosure.cutoffN})`
                      : `out of ${disclosure.totalFinished} completed attempts (cutoff: Top ${disclosure.cutoffN})`}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-gold-200 text-red-900">
                    <Hourglass className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl text-red-900">
                      {lang === 'ar'
                        ? 'الترتيب الرسمي يُعلن بعد إغلاق باب الاختبار'
                        : 'Official Rank Announced After Window Closes'}
                    </h2>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-ink-muted">
                  {lang === 'ar'
                    ? `تم تثبيت درجتك (${attempt.score}/${attempt.questionsCount}) وزمنك الإجمالي (${formatResponseTimeMs(attempt.totalResponseTimeMs, lang)}). سيتم إعلان الترتيب النهائي وأسماء المتأهلين (أعلى ${disclosure.cutoffN}) فور إغلاق باب الاختبار يوم ${formatQuizTimestamp(session.settings.windowEndsAt, lang)}.`
                    : `Your score (${attempt.score}/${attempt.questionsCount}) and total response time (${formatResponseTimeMs(attempt.totalResponseTimeMs, lang)}) are locked in. Official rankings and the top ${disclosure.cutoffN} qualifiers will be announced once the window closes on ${formatQuizTimestamp(session.settings.windowEndsAt, lang)}.`}
                </p>
                <div className="rounded-card border border-border-paper bg-paper p-3 text-xs text-ink-muted flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'لضمان نزاهة المنافسة، لا يتم كشف الإجابات الصحيحة قبل إغلاق باب الاختبار. (في وضع العرض يمكنك تفعيل "إظهار الترتيب فوراً" أو إغلاق النافذة من إعدادات الاختبار لمعاينة شاشة الترتيب).'
                      : 'To keep the competition fair, correct answers remain hidden until the window closes. (In Demo Mode, Super Admins can toggle instant rank preview or close the window in Quiz Settings.)'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild variant="primary" size="md">
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'استكشف البطولة الرئيسية' : 'Explore Tournament'}</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link href="/quiz/how-it-works">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'كيف يعمل النظام الحقيقي؟' : 'How the Real System Works'}
                </span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="calm"
              size="md"
              onClick={handleTryAnotherDemo}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'اختبار متقدم تجريبي جديد'
                  : 'Test Another Demo Applicant'}
              </span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
