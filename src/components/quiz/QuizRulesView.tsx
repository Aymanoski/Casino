'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Ban,
  Clock,
  Eye,
  Play,
  ShieldAlert,
  Shuffle,
  Trophy,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  quizRepo,
  type ApplicantQuizSessionView,
} from '@/lib/repos';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SunburstStage } from '@/components/brand/SunburstStage';
import { QuizDemoBanner } from './QuizDemoBanner';
import { readStoredApplicantSession } from './quizHelpers';

export function QuizRulesView() {
  const router = useRouter();
  const { lang } = useI18n();
  const [session, setSession] = useState<ApplicantQuizSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdownStep, setCountdownStep] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = readStoredApplicantSession();
    if (!stored) {
      router.replace('/quiz/register');
      return;
    }
    quizRepo
      .getApplicantSession(stored.applicantId)
      .then((sess) => {
        if (!sess) {
          router.replace('/quiz/register');
          return;
        }
        if (!sess.applicant.verifiedAt) {
          router.replace('/quiz/register');
          return;
        }
        if (sess.attempt?.status === 'finished') {
          router.replace('/quiz/result');
          return;
        }
        if (sess.attempt && sess.attempt.status !== 'reset') {
          router.replace('/quiz/play');
          return;
        }
        setSession(sess);
      })
      .catch(() => {
        router.replace('/quiz/register');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const launchAttempt = async (applicantId: string) => {
    setStarting(true);
    setError(null);
    try {
      await quizRepo.startAttempt({ applicantId });
      router.push('/quiz/play');
    } catch (err) {
      setCountdownStep(null);
      setStarting(false);
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذر بدء الاختبار. حاول مرة أخرى.'
            : 'Could not start the quiz attempt.'
      );
    }
  };

  const handleReadyClick = () => {
    if (!session || starting || countdownStep !== null) return;
    setError(null);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      void launchAttempt(session.applicant.id);
      return;
    }

    setCountdownStep(3);
    let current = 3;
    intervalRef.current = window.setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdownStep(current);
      } else {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setCountdownStep(0);
        void launchAttempt(session.applicant.id);
      }
    }, 850);
  };

  if (loading || !session) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  const qCount = session.settings.questionsPerAttempt;
  const qSec = session.settings.secondsPerQuestion;
  const cutoff = session.settings.effectiveCutoffN;

  const rules = [
    {
      icon: Shuffle,
      title: lang === 'ar' ? `${qCount} سؤالاً عشوائياً لك وحدك` : `${qCount} Shuffled Questions`,
      body:
        lang === 'ar'
          ? 'يتم سحب الأسئلة وترتيب خياراتها الأربعة عشوائياً باستخدام بذرة فريدة لمحاولتك.'
          : 'Questions and their 4 answer choices are randomly shuffled uniquely for your attempt.',
    },
    {
      icon: Clock,
      title: lang === 'ar' ? `${qSec} ثوانٍ لكل سؤال فقط` : `${qSec} Seconds per Question`,
      body:
        lang === 'ar'
          ? 'ينتقل الاختبار تلقائياً فور اختيارك أو انتهاء الوقت. انتهاء الوقت يُحسب خطأً بزمن كامل (١٠ ثوانٍ).'
          : 'Answering moves on immediately. A timeout counts as wrong with the full 10-second duration.',
    },
    {
      icon: Ban,
      title: lang === 'ar' ? 'لا يوجد رجوع ولا إيقاف مؤقت' : 'No Going Back, No Pause',
      body:
        lang === 'ar'
          ? 'إعادة تحميل الصفحة لا تعيد ضبط العداد — يُستكمل السؤال بنفس الموعد النهائي المحفوظ.'
          : 'You cannot return to earlier questions or pause. Refreshing resumes on the stored deadline.',
    },
    {
      icon: Trophy,
      title: lang === 'ar' ? `التصنيف لأعلى ${cutoff} متسابق` : `Top ${cutoff} Qualification Cutoff`,
      body:
        lang === 'ar'
          ? 'يُرتّب المتقدمون حسب أعلى عدد إجابات صحيحة، ثم أقل زمن إجمالي، ثم أسبقية التسليم.'
          : 'Ranked by highest score, then fastest total response time, then earlier submission.',
    },
    {
      icon: Eye,
      title: lang === 'ar' ? 'محاولة واحدة ومراقبة نزاهة' : 'One Attempt & Fair-Play Signals',
      body:
        lang === 'ar'
          ? 'تُحفظ إشارات مغادرة التبويب أو إعادة التحميل أو محاولة النسخ للمراجعة الإدارية.'
          : 'Tab switches, page refreshes, and copy attempts are logged as client-side fair-play signals.',
    },
  ];

  return (
    <div className="theme-paper flex-1 bg-paper py-6 sm:py-10">
      {/* Full-Screen 3-2-1 Get-Ready Countdown Overlay */}
      {countdownStep !== null && (
        <div
          data-testid="quiz-ready-countdown"
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <SunburstStage className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <p className="text-base sm:text-xl font-extrabold uppercase tracking-wider text-white/90">
              {lang === 'ar' ? 'استعد للانطلاق...' : 'GET READY...'}
            </p>
            <div className="mt-4 font-score text-[clamp(6rem,28vw,12rem)] font-black leading-none text-gold-sticker-lg tabular-nums">
              {countdownStep > 0
                ? countdownStep
                : lang === 'ar'
                  ? 'انطلق!'
                  : 'GO!'}
            </div>
            <p className="mt-4 text-sm font-semibold text-white/90">
              {lang === 'ar'
                ? 'أبقِ إصبعك جاهزاً — الساعة تبدأ فور ظهور السؤال الأول!'
                : 'Keep your eyes on the screen — the 10-second clock starts on Question 1!'}
            </p>
          </SunburstStage>
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-5 px-4">
        <QuizDemoBanner surface="paper" />

        <div className="rounded-card border-[3px] border-outline bg-white p-5 shadow-sticker sm:p-7 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-gold-200 px-3 py-0.5 text-xs font-extrabold text-red-900">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? `أهلاً ${session.applicant.fullNameAr || session.applicant.fullName}`
                  : `Welcome, ${session.applicant.fullName}`}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-red-900">
              {lang === 'ar' ? 'قواعد الاختبار قبل البدء' : 'Quiz Rules Before You Start'}
            </h1>
            <p className="text-sm text-ink-muted">
              {lang === 'ar'
                ? 'تأكد من استقرار اتصالك بالإنترنت وعدم تبديل التبويبات خلال الدقائق الثلاث القادمة.'
                : 'Make sure you have ~3 uninterrupted minutes before starting the countdown.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-card border-2 border-negative bg-negative-soft p-3.5 text-sm font-semibold text-red-900"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            {rules.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  className="flex items-start gap-3.5 rounded-card border border-border-paper bg-paper p-3.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white text-red-700 shadow-sticker-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm sm:text-base font-extrabold text-red-900">
                      {r.title}
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-ink-muted">
                      {r.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={starting}
              onClick={handleReadyClick}
              data-testid="quiz-ready-cta"
              className="flex-1 min-h-[58px] text-base"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'أنا جاهز — ابدأ العد ٣-٢-١'
                  : 'I’m Ready — Start 3-2-1 Countdown'}
              </span>
            </Button>
            <Button asChild variant="secondary" size="lg" className="min-h-[54px]">
              <Link href="/quiz">
                <span>{lang === 'ar' ? 'الرجوع' : 'Back'}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
