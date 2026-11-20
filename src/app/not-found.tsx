'use client';

import React from 'react';
import Link from 'next/link';
import { Crown, GitBranch, Home, Trophy } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { SkipLink } from '@/components/layout/SkipLink';
import { Button } from '@/components/ui/button';
import { PlayingCardMotif, PlayingDice } from '@/components/brand/GameMotifs';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';

export default function NotFound() {
  const { lang } = useI18n();

  return (
    <div className="theme-paper flex min-h-dvh flex-col bg-paper text-ink">
      <SkipLink />
      <PublicHeader />

      <SunburstStage as="div" className="py-12 sm:py-16">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-safe text-center space-y-5">
          <div className="flex items-center justify-center gap-3" aria-hidden="true">
            <PlayingDice value={4} size="md" tilt={-12} accent="gold" />
            <PlayingCardMotif suit="star" cornerText="?" tone="white" size="md" tilt={4} />
            <PlayingDice value={4} size="md" tilt={12} accent="blue" />
          </div>

          <h1 className="font-display text-fluid-hero text-white [text-shadow:0_4px_0_var(--red-900)] leading-none">
            <span className="text-gold-sticker-lg">404</span>
          </h1>

          <p className="font-display text-fluid-2xl text-white [text-shadow:0_2px_0_var(--red-900)]">
            {lang === 'ar'
              ? 'هذه الطاولة غير موجودة في البطولة'
              : 'That Table Is Not on Tonight’s Floor'}
          </p>

          <p className="max-w-lg text-sm sm:text-base leading-relaxed text-white/95">
            {lang === 'ar'
              ? 'الرابط الذي طلبته غير متوفر أو تم نقله. يمكنك العودة إلى الصفحة الرئيسية أو متابعة شجرة البطولة ولوحة الصدارة المباشرة.'
              : 'The route you followed does not exist or has moved. Jump right back to the main stage, live bracket, or tournament standings.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="gold" size="lg" asChild>
              <Link href="/">
                <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{lang === 'ar' ? 'الصفحة الرئيسية' : 'Back to Pitch Home'}</span>
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/bracket">
                <GitBranch className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{lang === 'ar' ? 'شجرة البطولة' : 'Live Bracket'}</span>
              </Link>
            </Button>
          </div>
        </div>
      </SunburstStage>
      <StageDivider variant="zigzag" from="stage" to="paper" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-safe py-8 sm:py-10 outline-none"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/leaderboard"
            className="flex min-h-[56px] items-center gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft transition-colors hover:border-outline hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-lg text-red-900">
                {lang === 'ar' ? 'لوحة الصدارة المباشرة' : 'Live Leaderboard'}
              </div>
              <div className="text-xs text-ink-muted">
                {lang === 'ar' ? 'تابع ترتيب جميع المتسابقين الآن' : 'Track all 27 contestants live'}
              </div>
            </div>
          </Link>

          <Link
            href="/final"
            className="flex min-h-[56px] items-center gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft transition-colors hover:border-outline hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-red-600 text-white shadow-sticker-sm">
              <Crown className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-lg text-red-900">
                {lang === 'ar' ? 'ليلة النهائي الكبير' : 'Final Night Showcase'}
              </div>
              <div className="text-xs text-ink-muted">
                {lang === 'ar' ? 'مقعدان أمام مروان سري' : 'Two finalists vs. Marwan Serry'}
              </div>
            </div>
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
