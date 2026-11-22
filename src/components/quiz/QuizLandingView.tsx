'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  quizRepo,
  type ApplicantQuizSessionView,
  type PublicQuizOverview,
} from '@/lib/repos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SunburstStage, StageDivider } from '@/components/brand/SunburstStage';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { PlayingDice, PlayingCardMotif } from '@/components/brand/GameMotifs';
import { CrescentStarIcon } from '@/components/motifs/RamadanMotifs';
import { QuizDemoBanner } from './QuizDemoBanner';
import {
  clearStoredApplicantSession,
  formatQuizTimestamp,
  formatWindowRemaining,
  getWindowStatusCopy,
  readStoredApplicantSession,
} from './quizHelpers';

export function QuizLandingView() {
  const { lang } = useI18n();
  const [overview, setOverview] = useState<PublicQuizOverview | null>(null);
  const [session, setSession] = useState<ApplicantQuizSessionView | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const now = Date.now();
      const ov = await quizRepo.getPublicOverview(now);
      const stored = readStoredApplicantSession();
      const sess = stored
        ? await quizRepo.getApplicantSession(stored.applicantId, now)
        : null;
      if (stored && !sess) {
        clearStoredApplicantSession();
      }
      setOverview(ov);
      setSession(sess);
      setNowMs(now);
    } catch {
      // Keep UI responsive rather than stuck on skeletons
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub1 = realtime.subscribe('quiz.settingsUpdated', loadData);
    const unsub2 = realtime.subscribe('quiz.reset', loadData);
    const unsub3 = realtime.subscribe('data.reset', loadData);
    const unsub4 = realtime.subscribe('settings.updated', loadData);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  // Tick window countdown every second
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  if (loading || !overview) {
    return (
      <div className="mx-auto w-full max-w-content space-y-6 px-4 py-10">
        <Skeleton className="h-72 w-full rounded-card" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
        </div>
      </div>
    );
  }

  const startsAtMs = Date.parse(overview.windowStartsAt);
  const endsAtMs = Date.parse(overview.windowEndsAt);
  const liveWindowStatus =
    nowMs < startsAtMs ? 'upcoming' : nowMs > endsAtMs ? 'closed' : 'open';
  const liveMsRemaining =
    liveWindowStatus === 'upcoming'
      ? Math.max(0, startsAtMs - nowMs)
      : liveWindowStatus === 'open'
        ? Math.max(0, endsAtMs - nowMs)
        : 0;
  const windowCopy = getWindowStatusCopy(liveWindowStatus, lang);

  const hasFinishedAttempt = session?.attempt?.status === 'finished';
  const hasInProgressAttempt =
    session?.attempt?.status === 'in_progress' ||
    session?.attempt?.status === 'abandoned';

  const handleSwitchDemoApplicant = () => {
    clearStoredApplicantSession();
    setSession(null);
  };

  return (
    <div className="flex flex-col">
      {/* STAGE HERO */}
      <SunburstStage className="py-10 sm:py-14 lg:py-16">
        <div className="pointer-events-none absolute start-4 top-6 hidden opacity-85 lg:block">
          <PlayingDice value={5} size="md" tilt={-12} />
        </div>
        <div className="pointer-events-none absolute end-6 top-8 hidden opacity-85 lg:block">
          <PlayingCardMotif suit="diamond" size="md" tilt={12} />
        </div>

        <div className="mx-auto max-w-content px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-white px-3.5 py-1 text-xs font-extrabold text-red-900 shadow-sticker-sm">
                <CrescentStarIcon className="h-4 w-4 text-gold-600" />
                <span>
                  {lang === 'ar'
                    ? 'المرحلة الأولى · تصفية المتقدمين لرمضان ٢٠٢٧'
                    : 'STAGE 1 · RAMADAN 2027 QUALIFIER'}
                </span>
              </span>
              <Badge
                variant={
                  windowCopy.tone === 'positive'
                    ? 'positive'
                    : windowCopy.tone === 'info'
                      ? 'info'
                      : 'negative'
                }
                className="border-2 border-white shadow-sticker-sm"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{windowCopy.label}</span>
              </Badge>
            </div>

            <h1 className="font-display text-fluid-hero leading-[1.15] text-gold-sticker-lg">
              {lang === 'ar'
                ? 'اختبار التأهيل لبطولة كازينو الألعاب'
                : 'Casino El Al3ab Qualification Quiz'}
            </h1>

            <p className="mx-auto mt-4 max-w-[58ch] text-base sm:text-lg font-semibold leading-relaxed text-white/95">
              {lang === 'ar'
                ? `أجب عن ${overview.questionsPerAttempt} سؤالاً عشوائياً في ${overview.secondsPerQuestion} ثوانٍ لكل سؤال. أصحاب أعلى ${overview.effectiveCutoffN} نتيجة وأسرع زمن يحجزون مقعدهم في دور المجموعات وصولاً للنهائي ضد مروان سري!`
                : `Answer ${overview.questionsPerAttempt} randomized rapid-fire questions — ${overview.secondsPerQuestion} seconds each. The top ${overview.effectiveCutoffN} scorers (with total response time as tie-breaker) qualify for the Ramadan tournament and a shot at Marwan Serry in the Grand Final!`}
            </p>

            {/* Key Specs Sticker Strip */}
            <div className="mt-6 grid grid-cols-3 gap-2.5 sm:mx-auto sm:max-w-xl sm:gap-4">
              <div className="rounded-card border-[2.5px] border-outline bg-white p-3 text-center text-ink shadow-sticker-sm">
                <div className="font-score text-2xl sm:text-3xl font-black text-red-700 tabular-nums">
                  {overview.questionsPerAttempt}
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold text-ink-muted">
                  {lang === 'ar' ? 'سؤالاً عشوائياً' : 'Questions'}
                </div>
              </div>
              <div className="rounded-card border-[2.5px] border-outline bg-white p-3 text-center text-ink shadow-sticker-sm">
                <div className="font-score text-2xl sm:text-3xl font-black text-red-700 tabular-nums">
                  {overview.secondsPerQuestion}s
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold text-ink-muted">
                  {lang === 'ar' ? 'لكل سؤال' : 'Per Question'}
                </div>
              </div>
              <div className="rounded-card border-[2.5px] border-outline bg-white p-3 text-center text-ink shadow-sticker-sm">
                <div className="font-score text-2xl sm:text-3xl font-black text-red-700 tabular-nums">
                  {overview.effectiveCutoffN}
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold text-ink-muted">
                  {lang === 'ar' ? 'مقعداً للتأهل' : 'Qualifying Seats'}
                </div>
              </div>
            </div>

            {/* Live Window Countdown Card */}
            <div
              data-testid="quiz-window-card"
              className="mx-auto mt-6 max-w-xl rounded-card border-[2.5px] border-outline bg-red-900/90 p-4 text-white shadow-sticker"
            >
              <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                <div className="text-start">
                  <div className="text-xs font-bold text-white/85">
                    {liveWindowStatus === 'open'
                      ? lang === 'ar'
                        ? 'الوقت المتبقي قبل إغلاق الاختبار'
                        : 'Time remaining before quiz window closes'
                      : liveWindowStatus === 'upcoming'
                        ? lang === 'ar'
                          ? 'يفتح باب الاختبار خلال'
                          : 'Quiz window opens in'
                        : lang === 'ar'
                          ? 'تم إغلاق باب التقديم والاختبار'
                          : 'Qualification window has closed'}
                  </div>
                  <div className="mt-0.5 text-lg sm:text-xl font-black text-gold-300 tabular-nums">
                    {liveWindowStatus === 'closed'
                      ? formatQuizTimestamp(overview.windowEndsAt, lang)
                      : formatWindowRemaining(liveMsRemaining, lang)}
                  </div>
                </div>
                <div className="text-center sm:text-end text-[11px] text-white/80">
                  <div>
                    {lang === 'ar' ? 'الفتح: ' : 'Opens: '}
                    <span className="font-bold text-white">
                      {formatQuizTimestamp(overview.windowStartsAt, lang)}
                    </span>
                  </div>
                  <div>
                    {lang === 'ar' ? 'الإغلاق: ' : 'Closes: '}
                    <span className="font-bold text-white">
                      {formatQuizTimestamp(overview.windowEndsAt, lang)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Existing Session Resume Banner OR Primary Start CTA */}
            {session && (hasInProgressAttempt || hasFinishedAttempt) ? (
              <div className="mx-auto mt-6 max-w-xl rounded-card border-[3px] border-outline bg-white p-4 text-start text-ink shadow-sticker">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold uppercase text-red-700">
                      {hasFinishedAttempt
                        ? lang === 'ar'
                          ? 'لديك محاولة مكتملة محفوظة'
                          : 'Completed Attempt Saved'
                        : lang === 'ar'
                          ? 'لديك محاولة جارية لم تكتمل'
                          : 'Attempt In Progress'}
                    </div>
                    <div className="truncate text-base font-black text-red-900">
                      {lang === 'ar'
                        ? session.applicant.fullNameAr || session.applicant.fullName
                        : session.applicant.fullName}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="gold" size="md">
                      <Link
                        href={hasFinishedAttempt ? '/quiz/result' : '/quiz/play'}
                        data-testid="quiz-resume-cta"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {hasFinishedAttempt
                            ? lang === 'ar'
                              ? 'عرض نتيجتي'
                              : 'View My Result'
                            : lang === 'ar'
                              ? 'متابعة الاختبار'
                              : 'Resume Quiz'}
                        </span>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSwitchDemoApplicant}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'متقدم تجريبي آخر' : 'Try New Applicant'}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {liveWindowStatus === 'open' ? (
                  <Button
                    asChild
                    variant="gold"
                    size="lg"
                    className="w-full sm:w-auto min-h-[56px] px-8 text-base"
                  >
                    <Link href="/quiz/register" data-testid="quiz-start-cta">
                      <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'ابدأ الاختبار الآن' : 'Start Qualification Quiz'}
                      </span>
                      <Arrow className="h-5 w-5" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled
                    data-testid="quiz-start-cta"
                    className="w-full sm:w-auto min-h-[56px] px-8 text-base opacity-90"
                  >
                    <Clock className="h-5 w-5" aria-hidden="true" />
                    <span>
                      {liveWindowStatus === 'upcoming'
                        ? lang === 'ar'
                          ? 'التسجيل يفتح قريباً'
                          : 'Registration Opens Soon'
                        : lang === 'ar'
                          ? 'انتهت فترة الاختبار'
                          : 'Quiz Window Closed'}
                    </span>
                  </Button>
                )}

                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto min-h-[52px]"
                >
                  <Link href="/quiz/how-it-works" data-testid="quiz-how-it-works-cta">
                    <HelpCircle className="h-5 w-5 text-red-700" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'كيف يعمل النظام الحقيقي؟'
                        : 'How the Real System Works'}
                    </span>
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </SunburstStage>

      <StageDivider variant="zigzag" from="stage" to="paper" />

      {/* PAPER SECTION: 3 STEPS + FAIR PLAY + DEMO HONESTY */}
      <section className="theme-paper bg-paper py-10 sm:py-14">
        <div className="mx-auto max-w-content space-y-8 px-4 sm:px-6">
          <QuizDemoBanner surface="paper" />

          <div className="text-center space-y-2">
            <h2 className="font-display text-3xl sm:text-4xl text-red-900">
              {lang === 'ar' ? 'كيف يعمل الاختبار في ٣ خطوات؟' : 'How It Works in 3 Steps'}
            </h2>
            <p className="mx-auto max-w-[60ch] text-sm sm:text-base text-ink-muted">
              {lang === 'ar'
                ? 'تجربة سريعة وعادلة مصممة خصيصاً للهاتف المحمول، بدون تسجيل دخول معقد.'
                : 'A fast, fair, phone-first qualification sprint — no password setup required.'}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-card border-[2.5px] border-outline bg-white p-5 shadow-sticker">
              <div className="mb-4 flex items-center gap-3">
                <ScoreChip value={1} tone="gold" size="md" />
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-red-100 text-red-700">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-lg font-black text-red-900">
                {lang === 'ar' ? 'سجّل بياناتك وأكّد رقمك' : 'Register & Verify'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {lang === 'ar'
                  ? 'أدخل اسمك ورقم موبايلك وبريدك الإلكتروني وأكّد الرمز لمرة واحدة. لكل متسابق محاولة واحدة فقط لضمان العدالة.'
                  : 'Enter your full name, phone, and email, then verify your 6-digit code. Strictly one attempt per verified person.'}
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-card border-[2.5px] border-outline bg-white p-5 shadow-sticker">
              <div className="mb-4 flex items-center gap-3">
                <ScoreChip value={2} tone="red" size="md" />
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-gold-200 text-red-900">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-lg font-black text-red-900">
                {lang === 'ar'
                  ? `${overview.questionsPerAttempt} سؤال × ${overview.secondsPerQuestion} ثوانٍ`
                  : `${overview.questionsPerAttempt} Questions × ${overview.secondsPerQuestion}s`}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {lang === 'ar'
                  ? 'أسئلة عشوائية مرتبة خصيصاً لك بترتيب خيارات فريد. لا يوجد رجوع أو إيقاف مؤقت — السرعة والدقة هما المفتاح.'
                  : 'Every applicant gets a uniquely shuffled set of questions and answer positions. No going back, no pause — accuracy plus speed.'}
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-card border-[2.5px] border-outline bg-white p-5 shadow-sticker">
              <div className="mb-4 flex items-center gap-3">
                <ScoreChip value={3} tone="blue" size="md" />
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-blue-100 text-blue-800">
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-lg font-black text-red-900">
                {lang === 'ar'
                  ? `تأهل أعلى ${overview.effectiveCutoffN} للبطولة`
                  : `Top ${overview.effectiveCutoffN} Qualify`}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {lang === 'ar'
                  ? 'الترتيب حسب عدد الإجابات الصحيحة، ثم أقل زمن إجمالي، ثم الأسبقية في التسليم. ينتقل المتأهلون مباشرة لقرعة المجموعات.'
                  : 'Ranked by score descending, then total response time ascending, then earlier submission. Qualifiers move straight into the tournament draw.'}
              </p>
            </div>
          </div>

          {/* Fair-Play Trust Strip */}
          <div className="rounded-card border border-border-paper bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-positive-soft text-positive-ink">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-red-900">
                    {lang === 'ar' ? 'قواعد النزاهة والشفافية' : 'Fairness & Transparency'}
                  </h3>
                  <ul className="space-y-1 text-sm text-ink-muted">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? 'إعادة تحميل الصفحة لا تعيد ضبط المؤقت — يستكمل العد من الموعد الأصلي.'
                          : 'Refreshing the page never restarts the clock — it resumes from your stored deadline.'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? 'انتهاء الـ ١٠ ثوانٍ يُحسب إجابة خاطئة بزمن كامل (١٠ ثوانٍ) وينتقل تلقائياً.'
                          : 'A timeout counts as wrong with the full 10-second duration and moves on automatically.'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? 'لا تظهر الإجابات الصحيحة أثناء الاختبار للحفاظ على تكافؤ الفرص بين الجميع.'
                          : 'Correct answers are never revealed during the quiz window so every applicant gets a fair shot.'}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
              <Button asChild variant="secondary" size="sm" className="shrink-0">
                <Link href="/admin/quiz">
                  <span>{lang === 'ar' ? 'معاينة لوحة الإدارة' : 'Preview Admin View'}</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
