'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ClipboardCheck, Server, Timer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Settings } from '@/lib/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreChip } from '@/components/brand/ScoreChip';

/**
 * Compact Registration Quiz Demo Callout on `/` (Step 0 A12).
 * Sits cleanly in the Paper flow without displacing Marwan Serry's Final Night Hero.
 */
export function QuizCalloutBanner({ settings }: { settings: Settings | null }) {
  const { lang } = useI18n();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const qCount = settings?.quiz?.questionsPerAttempt ?? 20;
  const qSec = settings?.quiz?.secondsPerQuestion ?? 10;
  const cutoff = settings?.quiz?.syncCutoffWithTournament
    ? (settings?.tournament?.totalPlayers ?? 720)
    : (settings?.quiz?.customCutoffN ?? 720);

  return (
    <section
      aria-labelledby="quiz-callout-heading"
      className="theme-paper bg-paper py-10 sm:py-12"
    >
      <div className="mx-auto max-w-content-wide px-safe">
        <div className="relative overflow-hidden rounded-card border-[3px] border-outline bg-white p-5 shadow-sticker sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gold">
                  <Server className="h-3 w-3" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'مرحلة التأهيل · نموذج تجريبي' : 'QUALIFICATION STAGE · DEMO'}</span>
                </Badge>
                <Badge variant="info">
                  <Timer className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? `${qCount} سؤال × ${qSec} ثوانٍ`
                      : `${qCount} Questions × ${qSec}s`}
                  </span>
                </Badge>
              </div>

              <h2
                id="quiz-callout-heading"
                className="font-display text-2xl sm:text-3xl leading-tight text-red-900"
              >
                {lang === 'ar'
                  ? 'كيف يتأهل المتسابقون إلى دور المجموعات؟ جرّب اختبار التسجيل!'
                  : 'How Do Contestants Qualify? Try the Registration Quiz Demo!'}
              </h2>

              <p className="max-w-[66ch] text-sm sm:text-base text-ink-muted leading-relaxed">
                {lang === 'ar'
                  ? `قبل انطلاق البطولة، يتنافس المتقدمون في اختبار سريع من ${qCount} سؤالاً عشوائياً (${qSec} ثوانٍ لكل سؤال). يتأهل أصحاب أعلى ${cutoff} نتيجة وأسرع زمن تلقائياً إلى دور المجموعات.`
                  : `Before group play begins, applicants take a fast ${qCount}-question randomized trivia sprint (${qSec}s per question). The top ${cutoff} by score and fastest response time qualify for the tournament roster.`}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <ScoreChip value={qCount} tone="gold" size="sm" />
                <ScoreChip value={`${qSec}s`} tone="red" size="sm" />
                <ScoreChip value={cutoff} tone="blue" size="sm" />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button asChild variant="primary" size="md">
                  <Link href="/quiz" data-testid="landing-quiz-cta">
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'جرّب اختبار التسجيل' : 'Try Registration Quiz'}
                    </span>
                    <Arrow className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="md">
                  <Link href="/quiz/how-it-works">
                    <span>
                      {lang === 'ar' ? 'كيف يعمل النظام؟' : 'How It Works'}
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
