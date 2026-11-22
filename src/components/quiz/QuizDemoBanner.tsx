'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Info, Server, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface QuizDemoBannerProps {
  /** 'stage' = crimson stage surface; 'paper' = warm cream admin/content surface */
  surface?: 'stage' | 'paper';
  /** Compact inline pill (for top bar / play screen) vs expanded strip */
  compact?: boolean;
  showHowItWorksLink?: boolean;
  className?: string;
}

/**
 * Persistent Demo Honesty Pill (AGENTS.md §16.4):
 * Shown across all applicant (/quiz*) and admin (/admin/quiz*) screens so clients
 * clearly understand that timing & OTP run locally in the browser in this demo,
 * while the production version enforces them strictly on the server.
 */
export function QuizDemoBanner({
  surface = 'paper',
  compact = false,
  showHowItWorksLink = true,
  className,
}: QuizDemoBannerProps) {
  const { lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const isStage = surface === 'stage';

  if (compact) {
    return (
      <div className={cn('relative inline-flex items-center', className)}>
        <button
          type="button"
          data-testid="quiz-demo-mode-pill"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            'inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border-2 border-outline px-3 py-1 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal shadow-sticker-sm transition-transform active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
            isStage
              ? 'bg-gold-300 text-red-900'
              : 'bg-gold-200 text-red-900'
          )}
        >
          <Server className="h-3.5 w-3.5 shrink-0 text-red-900" aria-hidden="true" />
          <span className="sm:hidden">
            {lang === 'ar' ? 'تجريبي' : 'DEMO'}
          </span>
          <span className="hidden sm:inline">
            {lang === 'ar' ? 'وضع العرض التجريبي' : 'DEMO MODE'}
          </span>
          <Info className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        </button>

        {expanded && (
          <div
            role="dialog"
            aria-label={lang === 'ar' ? 'معلومات وضع العرض التجريبي' : 'Demo mode details'}
            className="absolute top-full end-0 z-50 mt-2 w-[min(90vw,340px)] rounded-card border-[2.5px] border-outline bg-white p-4 text-start text-xs leading-relaxed text-ink shadow-sticker-lg"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-extrabold text-red-900">
                {lang === 'ar' ? 'نسخة عرض أمامية فقط (Demo)' : 'Frontend-Only Demo Mode'}
              </span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-button border border-border-paper text-ink hover:bg-paper-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-ink-muted">
              {lang === 'ar'
                ? 'في هذا النموذج التجريبي يعمل المؤقت والتحقق من الرمز محلياً داخل المتصفح (IndexedDB). في النسخة الفعلية يتم فرض التوقيت والتحقق ومنع التكرار وتسليم الأسئلة بالكامل على الخادم (Server-side).'
                : 'In this browser demo, the countdown timer and OTP verification run locally in IndexedDB. In the production version, deadlines, verification, answer secrecy, and single-attempt enforcement run strictly on the server.'}
            </p>
            {showHowItWorksLink && (
              <Link
                href="/quiz/how-it-works"
                onClick={() => setExpanded(false)}
                className="mt-2.5 inline-flex items-center gap-1 font-bold text-blue-600 underline underline-offset-4 hover:text-blue-800"
              >
                {lang === 'ar'
                  ? 'اقرأ كيف يعمل النظام الحقيقي ←'
                  : 'See how the real system works →'}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="quiz-demo-mode-pill"
      className={cn(
        'flex flex-col gap-2 rounded-card border-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between',
        isStage
          ? 'border-outline bg-white text-ink shadow-sticker-sm'
          : 'border-gold-500/70 bg-gold-200/35 text-ink',
        className
      )}
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border-2 border-outline bg-gold-400 px-2.5 py-0.5 text-[11px] font-black uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
          <Server className="h-3 w-3" aria-hidden="true" />
          {lang === 'ar' ? 'وضع العرض التجريبي' : 'DEMO MODE'}
        </span>
        <p className="font-medium leading-relaxed text-ink">
          {lang === 'ar'
            ? 'المؤقت والتحقق يعملان محلياً في المتصفح للعرض فقط — النسخة الحقيقية تفرضهما بالكامل على الخادم (Server-side).'
            : 'Timer and verification run locally in your browser for this demo — the real version enforces both strictly on the server.'}
        </p>
      </div>
      {showHowItWorksLink && (
        <Link
          href="/quiz/how-it-works"
          className="inline-flex min-h-[36px] shrink-0 items-center font-bold text-blue-600 underline decoration-blue-500/60 underline-offset-4 hover:text-blue-800"
        >
          {lang === 'ar' ? 'كيف يعمل النظام الحقيقي؟' : 'How the real system works'}
        </Link>
      )}
    </div>
  );
}
