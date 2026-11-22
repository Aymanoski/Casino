'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Globe, HelpCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { SkipLink } from '@/components/layout/SkipLink';
import { FanousIcon } from '@/components/motifs/RamadanMotifs';
import { QuizDemoBanner } from './QuizDemoBanner';

const QUIZ_AR_DEFAULT_FLAG = 'casino_quiz_ar_default_applied_v1';

/**
 * Dedicated phone-first wrapper for all /quiz* applicant routes (AGENTS.md §16.2).
 * - Defaults first-time visitors on /quiz* to Arabic RTL (unless ?lang= / ?tabLang= is explicitly passed),
 *   while keeping the EN | عربي toggle always reachable (locked during live /quiz/play countdowns).
 * - Always displays the persistent DEMO MODE honesty pill.
 */
export function QuizApplicantShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { lang, setLang, toggleLang, t } = useI18n();
  const isPlayRoute = pathname === '/quiz/play';

  // Arabic-first default on /quiz* (confirmed Step 0 A2), respecting explicit ?lang= / ?tabLang= overrides
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('lang') || params.get('tabLang')) {
        window.sessionStorage.setItem(QUIZ_AR_DEFAULT_FLAG, '1');
        return;
      }
      if (!window.sessionStorage.getItem(QUIZ_AR_DEFAULT_FLAG)) {
        window.sessionStorage.setItem(QUIZ_AR_DEFAULT_FLAG, '1');
        setLang('ar');
      }
    } catch {
      // ignore storage errors
    }
  }, [setLang]);

  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <SkipLink />

      {/* Focused Stage-Red Top Bar */}
      <header className="sticky top-0 z-40 border-b-[3px] border-outline bg-red-700/95 text-white backdrop-blur-sm">
        <div className="mx-auto flex max-w-content items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {!isPlayRoute ? (
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-button px-1.5 text-white hover:text-gold-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white shadow-sticker-sm">
                  <FanousIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black leading-tight text-white">
                    {t.brandName}
                  </span>
                  <span className="hidden truncate text-[11px] font-semibold text-white/85 sm:block">
                    {lang === 'ar' ? 'اختبار التأهيل للبطولة' : 'Qualification Quiz'}
                  </span>
                </span>
              </Link>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white shadow-sticker-sm">
                  <FanousIcon className="h-5 w-5" />
                </span>
                <span className="truncate text-sm font-black text-white">
                  {lang === 'ar' ? 'اختبار كازينو الألعاب' : 'Casino Quiz'}
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <QuizDemoBanner
              surface="stage"
              compact
              showHowItWorksLink={!isPlayRoute}
            />

            {!isPlayRoute && (
              <Link
                href="/quiz/how-it-works"
                aria-label={lang === 'ar' ? 'كيف يعمل النظام الحقيقي' : 'How it works'}
                className="hidden min-h-[40px] items-center gap-1.5 rounded-button border-2 border-outline bg-white px-3 py-1.5 text-xs font-extrabold text-red-900 shadow-sticker-sm hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:inline-flex"
              >
                <HelpCircle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                <span>{lang === 'ar' ? 'كيف يعمل؟' : 'How It Works'}</span>
              </Link>
            )}

            {!isPlayRoute && (
              <button
                type="button"
                data-testid="quiz-lang-toggle"
                onClick={toggleLang}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-pill border-2 border-outline bg-gold-400 px-3 py-1.5 text-xs font-black text-red-900 shadow-sticker-sm sticker-press hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Globe className="h-3.5 w-3.5 text-red-900" aria-hidden="true" />
                <span>{t.common.switchLanguage}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>

      {!isPlayRoute && (
        <footer className="border-t-[3px] border-outline bg-red-900 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white">
          <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-3 px-4 text-center text-xs sm:flex-row sm:text-start">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-white/95 underline decoration-gold-300/70 underline-offset-4 hover:text-gold-200"
            >
              <BackArrow className="h-4 w-4" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'العودة إلى منصة البطولة الرئيسية'
                  : 'Back to Main Tournament Platform'}
              </span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-4 text-white/85">
              <Link href="/quiz" className="hover:text-white hover:underline">
                {lang === 'ar' ? 'صفحة الاختبار' : 'Quiz Home'}
              </Link>
              <Link href="/quiz/how-it-works" className="hover:text-white hover:underline">
                {lang === 'ar' ? 'كيف يعمل النظام الحقيقي' : 'Real System Architecture'}
              </Link>
              <Link href="/admin/quiz" className="hover:text-white hover:underline">
                {lang === 'ar' ? 'لوحة إدارة الاختبار' : 'Quiz Admin'}
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
