'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Crown,
  Minus,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  contentRepo,
  roundRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { ContentItem, Round, Segment, Settings } from '@/lib/schemas';
import { formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface RulesDataset {
  rules: ContentItem[];
  rounds: Round[];
  tieBreaker: Segment | null;
  totalSegments: number;
  settings: Settings;
}

export function RulesView() {
  const { lang } = useI18n();

  const [data, setData] = useState<RulesDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [rules, rounds, segments, settings] = await Promise.all([
          contentRepo.list({ category: 'rule' }),
          roundRepo.list(),
          segmentRepo.list(),
          settingsRepo.get(),
        ]);

        if (seq !== loadSeqRef.current) return;
        const tieBreaker = segments.find((s) => s.id === 'seg-16') ?? null;
        setData({
          rules,
          rounds: [...rounds].sort((a, b) => a.order - b.order),
          tieBreaker,
          totalSegments: segments.length,
          settings,
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل القوانين.'
              : 'Failed to load tournament rules.'
        );
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void loadAll(true);
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'content.updated' ||
        msg.event === 'segment.updated' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadAll(false);
      }
    });
    return () => unsub();
  }, [loadAll]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-12">
          <div className="mx-auto max-w-content-wide px-safe space-y-4">
            <Skeleton className="h-12 w-72 bg-white/25" />
            <Skeleton className="h-5 w-96 max-w-full bg-white/20" />
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-64 lg:col-span-3" />
          <div className="space-y-4 lg:col-span-9">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadAll(true)}
        />
      </div>
    );
  }

  const { rules, rounds, tieBreaker, totalSegments, settings } = data;
  const cfg = settings.bracketConfig;

  const tocSections = [
    {
      id: 'official-rules',
      labelEn: 'Official Show Rules',
      labelAr: 'قوانين البطولة الرسمية',
    },
    {
      id: 'bracket-progression',
      labelEn: 'Bracket & Advancement',
      labelAr: 'نظام الأدوار والتأهل',
    },
    {
      id: 'scoring-tiebreaker',
      labelEn: 'Scoring & Tie-Breaker',
      labelAr: 'احتساب النقاط وجولة الحسم',
    },
    {
      id: 'fair-play',
      labelEn: 'Fair Play & Integrity',
      labelAr: 'اللعب النظيف والنزاهة',
    },
  ];

  return (
    <div className="flex flex-col">
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'القوانين ونظام اللعب الرسمي'
            : 'Official Tournament Rules & Format'
        }
        goldHighlight={lang === 'ar' ? 'القوانين' : 'Official Tournament Rules'}
        subtitle={
          lang === 'ar'
            ? 'كل ما يحتاج المتسابقون والجمهور معرفته عن نظام الـ ٣ لاعبين، الجرس اليدوي، احتساب النقاط، والطريق إلى مواجهة مروان سري.'
            : 'Everything contestants and spectators need to know about 3-player sessions, stage buzzing, scoring presets, tie-breakers, and qualifying for the Final.'
        }
        compact
        meta={
          <>
            <Badge variant="white">
              <Users className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                {formatNumber(cfg.playersPerGame, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'لاعبين / طاولة' : 'Players / Table'}
              </span>
            </Badge>
            <Badge variant="white">
              <Zap className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                {lang === 'ar' ? 'جرس المسرح عبر الحكم' : 'Scorer-Locked Stage Buzzer'}
              </span>
            </Badge>
            <Badge variant="gold">
              <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'أفضل ٢ يواجهان مروان سري'
                  : 'Top 2 Face Marwan Serry'}
              </span>
            </Badge>
          </>
        }
        actions={
          <Button variant="gold" size="md" asChild>
            <Link href="/segments">
              <span>
                {lang === 'ar'
                  ? `استعراض الـ ${formatNumber(totalSegments, { useArabicIndicDigits: useArabicIndic })} فقرة`
                  : `Explore All ${totalSegments} Segments`}
              </span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {/* PAPER EDITORIAL TWO-COLUMN READING LAYOUT */}
      <section className="theme-paper bg-paper py-8 sm:py-12 overflow-x-clip">
        <div className="mx-auto min-w-0 w-full max-w-content-wide px-safe">
          {/* Mobile Horizontal Jump Links */}
          <nav
            aria-label={lang === 'ar' ? 'أقسام القوانين' : 'Rules sections'}
            className="mb-6 flex w-full max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar pb-1 lg:hidden"
          >
            {tocSections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-pill border-2 border-outline bg-white px-4 py-2 text-xs font-extrabold text-red-900 shadow-sticker-sm"
              >
                {lang === 'ar' ? sec.labelAr : sec.labelEn}
              </a>
            ))}
          </nav>

          <div className="grid min-w-0 gap-8 lg:grid-cols-12 lg:items-start">
            {/* Desktop Sticky Table of Contents */}
            <aside className="hidden min-w-0 lg:block lg:col-span-3 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] space-y-4">
              <nav
                aria-label={lang === 'ar' ? 'فهرس القوانين' : 'Rules table of contents'}
                className="rounded-card border border-border-paper bg-white p-4 shadow-soft space-y-2"
              >
                <div className="flex items-center gap-2 border-b border-border-paper pb-2.5 text-xs font-extrabold uppercase text-red-900">
                  <BookOpen className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'محتويات القوانين' : 'On This Page'}</span>
                </div>
                <ul className="space-y-1">
                  {tocSections.map((sec) => (
                    <li key={sec.id}>
                      <a
                        href={`#${sec.id}`}
                        className="flex min-h-[44px] items-center rounded-input px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-paper-2 hover:text-red-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                      >
                        {lang === 'ar' ? sec.labelAr : sec.labelEn}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="rounded-card border border-border-paper bg-paper-2/80 p-4 space-y-3 text-sm">
                <p className="font-bold text-red-900">
                  {lang === 'ar' ? 'روابط سريعة' : 'Quick Links'}
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="red" size="sm" className="w-full" asChild>
                    <Link href="/bracket">
                      {lang === 'ar' ? 'شجرة البطولة' : 'Interactive Bracket'}
                    </Link>
                  </Button>
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link href="/schedule">
                      {lang === 'ar' ? 'جدول المواعيد' : 'Event Schedule'}
                    </Link>
                  </Button>
                </div>
              </div>
            </aside>

            {/* Main Reading Column */}
            <div className="min-w-0 w-full space-y-10 lg:col-span-9 max-w-[74ch]">
              {/* Section 1: Official Rules from contentRepo */}
              <section id="official-rules" className="scroll-mt-24 space-y-4">
                <h2 className="font-display text-fluid-2xl text-red-900">
                  {lang === 'ar'
                    ? 'قوانين البطولة الرسمية'
                    : 'Official Show Rules'}
                </h2>

                {rules.length === 0 ? (
                  <EmptyState
                    title={
                      lang === 'ar'
                        ? 'لم تُنشر قوانين نصية بعد'
                        : 'No custom rule articles published yet'
                    }
                    description={
                      lang === 'ar'
                        ? 'يمكن لمدير المحتوى إضافة وتحديث بنود القوانين من لوحة إدارة المحتوى.'
                        : 'Content Managers can add and publish official rule articles in Admin Content.'
                    }
                  />
                ) : (
                  <div className="divide-y divide-border-paper rounded-card border border-border-paper bg-white shadow-soft overflow-hidden">
                    {rules.map((rule) => (
                      <article key={rule.id} className="min-w-0 p-5 sm:p-6 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="min-w-0 font-display text-xl text-red-900 leading-snug break-words">
                            {localizeText(lang, rule.titleEn, rule.titleAr)}
                          </h3>
                          {rule.badgeEn && (
                            <Badge variant="gold" className="shrink-0">
                              {localizeText(lang, rule.badgeEn, rule.badgeAr)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-base leading-relaxed text-ink break-words">
                          {localizeText(lang, rule.bodyEn, rule.bodyAr)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Section 2: Dynamic Bracket & Advancement Format */}
              <section id="bracket-progression" className="scroll-mt-24 space-y-4">
                <h2 className="font-display text-fluid-2xl text-red-900">
                  {lang === 'ar'
                    ? 'نظام الأدوار والتأهل'
                    : 'Bracket & Advancement Format'}
                </h2>
                <p className="text-base leading-relaxed text-ink-muted">
                  {lang === 'ar'
                    ? `تُدار البطولة الحالية بمشاركة ${formatNumber(cfg.totalPlayers, { useArabicIndicDigits: useArabicIndic })} متسابقاً بواقع ${formatNumber(cfg.playersPerGame, { useArabicIndicDigits: useArabicIndic })} لاعبين على كل طاولة مع حكم نقاط مستقل لكل جلسة.`
                    : `The current tournament is configured for ${cfg.totalPlayers} contestants seated ${cfg.playersPerGame} per table, with an independent table scorer operating each session concurrently.`}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {rounds.map((round) => {
                    const isFinal = round.id === 'round-final';
                    return (
                      <div
                        key={round.id}
                        className="min-w-0 rounded-card border border-border-paper bg-white p-4 shadow-soft space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="min-w-0 flex-1 font-display text-lg text-red-900 leading-snug break-words">
                            {localizeText(lang, round.name.en, round.name.ar)}
                          </h3>
                          <Badge variant={isFinal ? 'gold' : 'red'} className="shrink-0">
                            {lang === 'ar'
                              ? `المرحلة ${formatNumber(round.order, { useArabicIndicDigits: useArabicIndic })}`
                              : `Stage ${formatNumber(round.order, { useArabicIndicDigits: useArabicIndic })}`}
                          </Badge>
                        </div>
                        <p className="text-xs font-extrabold text-red-700">
                          {isFinal
                            ? lang === 'ar'
                              ? 'بطل واحد'
                              : '1 Champion'
                            : lang === 'ar'
                              ? `يتأهل أفضل ${formatNumber(round.advancePerGame, { useArabicIndicDigits: useArabicIndic })} لكل طاولة`
                              : `Top ${formatNumber(round.advancePerGame, { useArabicIndicDigits: useArabicIndic })} Advances per Table`}
                        </p>
                        <p className="text-sm text-ink-muted leading-relaxed break-words">
                          {isFinal
                            ? lang === 'ar'
                              ? 'يتنافس المتأهلان النهائيان أمام مروان سري على طاولة اللقب المباشرة.'
                              : 'The two Semi-Final qualifiers battle Marwan Serry in a 3-seat finale.'
                            : lang === 'ar'
                              ? 'الفائز هو صاحب أعلى مجموع نقاط عبر جميع فقرات الطاولة.'
                              : 'Highest cumulative score across all session segments advances.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Section 3: Scoring, Presets & Tie-Breaker #16 */}
              <section id="scoring-tiebreaker" className="scroll-mt-24 space-y-4">
                <h2 className="font-display text-fluid-2xl text-red-900">
                  {lang === 'ar'
                    ? 'احتساب النقاط وجولة الحسم التلقائية'
                    : 'Scoring, Buzzer & Sudden-Death Tie-Breaker'}
                </h2>

                <div className="rounded-card border border-border-paper bg-white p-5 sm:p-6 shadow-soft space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <ScoreChip
                      value={10}
                      tone="positive"
                      showSign
                      useArabicIndicDigits={useArabicIndic}
                      size="md"
                    />
                    <ScoreChip
                      value={5}
                      tone="positive"
                      showSign
                      useArabicIndicDigits={useArabicIndic}
                      size="md"
                    />
                    <ScoreChip
                      value={-5}
                      tone="negative"
                      showSign
                      useArabicIndicDigits={useArabicIndic}
                      size="md"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-display text-lg text-red-900">
                        {lang === 'ar'
                          ? 'نقاط الفقرات والتعديل المخصص'
                          : 'Segment Presets & Custom Adjustments'}
                      </h3>
                      <p className="text-sm text-ink-muted leading-relaxed">
                        {lang === 'ar'
                          ? 'كل فقرة لها أزرار نقاط سريعة (مثل +١٠ و+٥ و−٥) بالإضافة لإمكانية إدخال أي رقم موجب أو سالب مع ملاحظة موثّقة في سجل المراجعة.'
                          : 'Each segment ships with quick point presets (typically +10, +5, −5) plus custom positive or negative scorer input with an optional note recorded to the tamper-evident history.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-border-paper pt-4 sm:grid-cols-2 text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border border-positive bg-positive-soft text-positive-ink">
                        <Plus className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-bold text-ink">
                          {lang === 'ar' ? 'الإجابة الصحيحة والمكافآت' : 'Correct Answers & Bonuses'}
                        </p>
                        <p className="text-ink-muted">
                          {lang === 'ar'
                            ? 'يضغط الحكم اسم أول من كبس الجرس ثم يمنح النقاط الفورية فور صحة الإجابة.'
                            : 'The scorer locks in who buzzed first and awards points immediately on a valid answer.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border border-outline bg-negative text-white">
                        <Minus className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-bold text-ink">
                          {lang === 'ar' ? 'خصم الخطأ أو المقاطعة' : 'Wrong-Buzz Penalties'}
                        </p>
                        <p className="text-ink-muted">
                          {lang === 'ar'
                            ? 'الإجابة الخاطئة أو انتهاء المؤقت قد تعرّض اللاعب لخصم نقاط، وتُعرض دائماً بعلامة − واضحة.'
                            : 'Wrong interrupts or expired answers may incur a −5 penalty, always clearly signed and logged.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sudden-Death Tie-Breaker Callout */}
                  <div className="rounded-input border-2 border-outline bg-gold-200/55 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="red">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'جولة الحسم #١٦' : 'TIE-BREAKER #16'}
                        </span>
                      </Badge>
                      <h3 className="font-display text-lg text-red-900">
                        {tieBreaker
                          ? localizeText(lang, tieBreaker.nameEn, tieBreaker.nameAr)
                          : lang === 'ar'
                            ? 'جولة التحدي / الحسم'
                            : 'Tie-Breaker and Penalty Challenge'}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-red-900">
                      {lang === 'ar'
                        ? 'إذا تساوى متسابقان أو أكثر على خط التأهل (المركز الأول في الأدوار الأولى، أو المركز الثاني والثالث في نصف النهائي)، يُمنع إنهاء الطاولة تلقائياً وتُضاف جولة الحسم السريعة (٣٠ ثانية) فوراً لحسم المتأهل.'
                        : 'Whenever contestants tie across an advancement cutoff (1st place in standard rounds, or 2nd/3rd in the Top-2 Semi-Final), the Scorer Console automatically appends the 30-second Sudden-Death Tie-Breaker segment before locking winners.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 4: Fair Play & Skill Show Integrity */}
              <section id="fair-play" className="scroll-mt-24 space-y-4">
                <h2 className="font-display text-fluid-2xl text-red-900">
                  {lang === 'ar'
                    ? 'اللعب النظيف والنزاهة'
                    : 'Fair Play & Show Integrity'}
                </h2>

                <div className="rounded-card border border-border-paper bg-white p-5 sm:p-6 shadow-soft space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-paper-2 text-red-900">
                      <Scale className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1.5">
                      <h3 className="font-display text-lg text-red-900">
                        {lang === 'ar'
                          ? 'مسابقة مهارة وثقافة عامة بالكامل'
                          : '100% Skill, Speed & Trivia Competition'}
                      </h3>
                      <p className="text-sm sm:text-base leading-relaxed text-ink-muted">
                        {lang === 'ar'
                          ? 'بطولة كازينو الألعاب الرمضانية هي برنامج مسابقات ترفيهي وثقافي يعتمد كلياً على المعرفة وسرعة البديهة—لا توجد أي مراهنات مالية أو ألعاب حظ بأموال حقيقية.'
                          : 'This Ramadan tournament is strictly a comedy, trivia, and quick-wit game show. No real-money wagering, cash pots, or gambling mechanics exist anywhere in the event.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 border-t border-border-paper pt-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-positive-soft text-positive-ink">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1.5">
                      <h3 className="font-display text-lg text-red-900">
                        {lang === 'ar'
                          ? 'سجل نقاط موثّق بالتاريخ والوقت'
                          : 'Timestamped Scoring & Full Transparency'}
                      </h3>
                      <p className="text-sm sm:text-base leading-relaxed text-ink-muted">
                        {lang === 'ar'
                          ? 'كل حركة نقاط وتراجع عنها تُحفظ تلقائياً بالتاريخ والوقت واسم الحكم، ويمكن لكل متسابق مراجعة سجل نقاطه فقرة بفقرة عبر بوابة اللاعب.'
                          : 'Every point award, deduction, and undo is stored with an exact date, time, and scorer record—and contestants can inspect their complete segment-by-segment log in the Player Portal.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-border-paper pt-4">
                    <Button variant="red" size="md" asChild>
                      <Link href="/segments">
                        <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'تصفح فقرات التحدي' : 'Explore Segments'}
                        </span>
                      </Link>
                    </Button>
                    <Button variant="secondary" size="md" asChild>
                      <Link href="/final">
                        <Crown className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'تفاصيل ليلة النهائي' : 'Final Night Details'}
                        </span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
