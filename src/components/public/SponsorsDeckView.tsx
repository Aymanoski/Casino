'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Mail,
  Minus,
  Sparkles,
  Tv,
  Users,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  gameRepo,
  playerRepo,
  segmentRepo,
  settingsRepo,
  sponsorRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Settings, Sponsor, SponsorTier } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { SectionHeading } from '@/components/brand/SectionHeading';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface SponsorsDataset {
  sponsors: Sponsor[];
  settings: Settings;
  playerCount: number;
  gameCount: number;
  segmentCount: number;
}

const DELIVERABLE_MATRIX: Array<{
  id: string;
  labelEn: string;
  labelAr: string;
  included: Record<SponsorTier, boolean>;
}> = [
  {
    id: 'stage-marquee',
    labelEn: 'Main Stage & Broadcast Marquee Lockup',
    labelAr: 'ظهور الشعار على المسرح الرئيسي وإطار البث',
    included: { presenting: true, finalNight: true, segment: false, community: false },
  },
  {
    id: 'final-golden-seat',
    labelEn: 'Grand Final Night & Golden Seat Association (vs. Marwan Serry)',
    labelAr: 'الاقتران بليلة النهائي الكبير والمقعد الذهبي (مع مروان سري)',
    included: { presenting: true, finalNight: true, segment: false, community: false },
  },
  {
    id: 'branded-segment',
    labelEn: 'Dedicated Branded Game Segment & Timer Presence',
    labelAr: 'فقرة تحدي مخصصة باسم الراعي مع ظهور على المؤقت',
    included: { presenting: true, finalNight: false, segment: true, community: true },
  },
  {
    id: 'big-screen',
    labelEn: 'Live Venue Big Screen & Scoreboard Overlay',
    labelAr: 'الظهور على شاشات العرض العملاقة ولوحة النقاط المباشرة',
    included: { presenting: true, finalNight: true, segment: true, community: false },
  },
  {
    id: 'web-platform',
    labelEn: 'Public Bracket, Schedule & Live Leaderboard Placement',
    labelAr: 'الظهور في صفحات الشجرة والجدول ولوحة الصدارة المباشرة',
    included: { presenting: true, finalNight: true, segment: true, community: true },
  },
  {
    id: 'vip-hospitality',
    labelEn: 'Executive Final Night Taping & Hospitality Lounge',
    labelAr: 'مقاعد كبار الشخصيات وضيافة تصوير ليلة النهائي',
    included: { presenting: true, finalNight: true, segment: false, community: false },
  },
];

export function SponsorsDeckView() {
  const { lang } = useI18n();
  const { toast } = useToast();

  const [data, setData] = useState<SponsorsDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [sponsors, settings, players, games, segments] = await Promise.all([
          sponsorRepo.list(),
          settingsRepo.get(),
          playerRepo.list({ includeHost: false }),
          gameRepo.list(),
          segmentRepo.list(),
        ]);

        if (seq !== loadSeqRef.current) return;
        setData({
          sponsors: [...sponsors].sort((a, b) => a.order - b.order),
          settings,
          playerCount: players.length,
          gameCount: games.length,
          segmentCount: segments.length,
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل بيانات الرعاية.'
              : 'Failed to load sponsor packages.'
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
        msg.event === 'sponsor.updated' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadAll(false);
      }
    });
    return () => unsub();
  }, [loadAll]);

  const handleCopyEmail = useCallback(async () => {
    const email =
      data?.settings.contactEmail ?? 'partnerships@casinoelal3ab-pitch.com';
    try {
      await navigator.clipboard.writeText(email);
      toast({
        variant: 'positive',
        title:
          lang === 'ar' ? 'تم نسخ بريد التواصل' : 'Partnership Email Copied',
        description: email,
      });
    } catch {
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'بريد الرعاية والشراكات' : 'Partnership Contact',
        description: email,
      });
    }
  }, [data, lang, toast]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-12">
          <div className="mx-auto max-w-content-wide px-safe space-y-4">
            <Skeleton className="h-12 w-80 max-w-full bg-white/25" />
            <Skeleton className="h-5 w-96 max-w-full bg-white/20" />
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
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

  const { sponsors, settings, playerCount, gameCount, segmentCount } = data;
  const contactEmail = settings.contactEmail;

  return (
    <div className="flex min-w-0 w-full flex-col">
      {/* 1. STAGE PITCH HERO */}
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'شراكات وفئات رعاية البطولة'
            : 'Sponsors & Partnership Tiers'
        }
        goldHighlight={lang === 'ar' ? 'رعاية البطولة' : 'Partnership Tiers'}
        subtitle={
          lang === 'ar'
            ? 'باقات رعاية مرنة تضع علامتك التجارية في قلب المسرح المباشر، شاشات البث العملاقة، وليلة النهائي الكبير أمام مروان سري.'
            : 'Tailored brand partnership tiers placing partners across the live studio stage, venue Big Screens, interactive segments, and the Grand Final against Marwan Serry.'
        }
        showLanterns
        meta={
          <>
            <Badge variant="gold">
              <span>
                {lang === 'ar'
                  ? 'باقات مبدئية · الأسعار عند التواصل'
                  : 'PLACEHOLDER TIERS · CONTACT US FOR PACKAGES'}
              </span>
            </Badge>
            <Badge variant="white">
              <Users className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                {formatNumber(playerCount, { useArabicIndicDigits: useArabicIndic })}{' '}
                {lang === 'ar' ? 'متسابقاً' : 'Contestants'}
              </span>
            </Badge>
            <Badge variant="white">
              <Tv className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                {formatNumber(gameCount, { useArabicIndicDigits: useArabicIndic })}{' '}
                {lang === 'ar' ? 'جلسة بث' : 'Live Sessions'} ·{' '}
                {formatNumber(segmentCount, { useArabicIndicDigits: useArabicIndic })}{' '}
                {lang === 'ar' ? 'فقرة' : 'Segments'}
              </span>
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="gold" size="lg" asChild>
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                  'Sponsorship Inquiry — Ramadan Tournament Pitch'
                )}`}
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{lang === 'ar' ? 'تواصل معنا للرعاية' : 'Contact Us'}</span>
              </a>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleCopyEmail()}
            >
              <Copy className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{lang === 'ar' ? 'نسخ بريد الشراكات' : 'Copy Contact Email'}</span>
            </Button>
          </>
        }
      />

      {/* 2. PAPER BAND — PARTNERSHIP TIER CARDS */}
      <section className="theme-paper bg-paper py-section-y overflow-x-clip">
        <div className="mx-auto min-w-0 w-full max-w-content-wide px-safe space-y-8">
          <SectionHeading
            surface="paper"
            align="start"
            size="lg"
            title={
              lang === 'ar'
                ? 'باقات الرعاية المتاحة'
                : 'Available Partnership Tiers'
            }
            goldKeyword={lang === 'ar' ? 'الرعاية' : 'Partnership Tiers'}
            subtitle={
              lang === 'ar'
                ? 'جميع أسماء الرعاة الحالية نماذج مبدئية قابلة للتعديل من لوحة التحكم، دون أي شعارات رسمية أو أسعار ثابتة.'
                : 'All featured partner brands below are editable placeholder showcases managed in Admin Sponsors—no copyrighted logos and no fixed public pricing.'
            }
          />

          {sponsors.length === 0 ? (
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لا توجد فئات رعاية مسجلة حالياً'
                  : 'No sponsor tiers configured yet'
              }
              description={
                lang === 'ar'
                  ? 'يمكن لمدير المحتوى أو مدير البطولة إضافة باقات الرعاية من لوحة التحكم.'
                  : 'Add sponsor packages in Admin Sponsors to display them here.'
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {sponsors.map((sponsor) => {
                const isTopTier =
                  sponsor.tier === 'presenting' || sponsor.tier === 'finalNight';
                const benefits =
                  lang === 'ar' && sponsor.benefitsAr.length > 0
                    ? sponsor.benefitsAr
                    : sponsor.benefitsEn;

                return (
                  <article
                    key={sponsor.id}
                    className={cn(
                      'flex flex-col justify-between gap-5 rounded-card p-5 text-ink transition-transform duration-150 hover:-translate-y-0.5',
                      isTopTier
                        ? 'border-[2.5px] border-outline bg-gradient-to-b from-gold-200/75 via-paper to-white shadow-sticker'
                        : 'border border-border-paper bg-white shadow-soft'
                    )}
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant={
                            sponsor.tier === 'presenting'
                              ? 'gold'
                              : sponsor.tier === 'finalNight'
                                ? 'red'
                                : sponsor.tier === 'segment'
                                  ? 'info'
                                  : 'muted'
                          }
                        >
                          {isTopTier ? (
                            <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <Sparkles
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {localizeText(
                              lang,
                              sponsor.tierLabelEn,
                              sponsor.tierLabelAr
                            )}
                          </span>
                        </Badge>
                      </div>

                      <div className="min-w-0">
                        <div className="inline-block max-w-full truncate rounded-input border border-border-paper bg-paper-2 px-2.5 py-1 text-[11px] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                          {sponsor.logoText}
                        </div>
                        <h3 className="mt-2 font-display text-xl text-red-900 leading-snug break-words">
                          {localizeText(lang, sponsor.name, sponsor.nameAr)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted break-words">
                          {localizeText(lang, sponsor.blurb, sponsor.blurbAr)}
                        </p>
                      </div>

                      <ul className="space-y-2 border-t border-border-paper pt-3 text-xs sm:text-sm text-ink">
                        {benefits.map((item, idx) => (
                          <li key={idx} className="flex min-w-0 items-start gap-2">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-positive-ink"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2 border-t border-border-paper pt-4">
                      <div className="text-center text-xs font-extrabold uppercase text-ink-muted">
                        {lang === 'ar'
                          ? 'الاستثمار: حسب الباقة المخصصة'
                          : 'Investment: Custom Package'}
                      </div>
                      <Button
                        variant={isTopTier ? 'red' : 'secondary'}
                        size="md"
                        className="w-full"
                        asChild
                      >
                        <a
                          href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                            `${sponsor.tierLabelEn} — Ramadan Tournament Pitch`
                          )}`}
                        >
                          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{lang === 'ar' ? 'تواصل معنا' : 'Contact us'}</span>
                        </a>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* 3. SIDE-BY-SIDE DELIVERABLES COMPARISON MATRIX */}
          {sponsors.length > 0 && (
            <div className="min-w-0 w-full space-y-4 pt-6">
              <SectionHeading
                surface="paper"
                align="start"
                size="md"
                title={
                  lang === 'ar'
                    ? 'مقارنة مزايا وحقوق كل فئة'
                    : 'Tier Deliverables Comparison Matrix'
                }
                goldKeyword={lang === 'ar' ? 'كل فئة' : 'Comparison Matrix'}
                subtitle={
                  lang === 'ar'
                    ? 'نظرة سريعة على مساحات الظهور والحقوق المبدئية لكل مستوى رعاية (قابلة للتخصيص بالكامل).'
                    : 'At-a-glance overview of placeholder broadcast, stage, and digital placements across every sponsorship level.'
                }
              />

              {/* Mobile Scannable Deliverables Cards (< md) */}
              <div className="space-y-3 md:hidden">
                {DELIVERABLE_MATRIX.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-card border border-border-paper bg-white p-4 shadow-soft space-y-3"
                  >
                    <h3 className="text-sm font-bold text-ink leading-snug">
                      {lang === 'ar' ? row.labelAr : row.labelEn}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {sponsors.map((sp) => {
                        const hasIt = row.included[sp.tier];
                        return (
                          <div
                            key={sp.id}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-input border px-2.5 py-2 text-xs font-bold',
                              hasIt
                                ? 'border-positive bg-positive-soft text-positive-ink'
                                : 'border-border-paper bg-paper text-ink-muted'
                            )}
                          >
                            <span className="truncate">
                              {localizeText(lang, sp.tierLabelEn, sp.tierLabelAr)}
                            </span>
                            {hasIt ? (
                              <Check className="h-3.5 w-3.5 shrink-0 stroke-[3]" aria-hidden="true" />
                            ) : (
                              <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="rounded-card border-2 border-outline bg-gold-200/55 p-4 space-y-2">
                  <div className="font-display text-base text-red-900">
                    {lang === 'ar' ? 'قيمة الرعاية' : 'Package Pricing'}
                  </div>
                  <p className="text-xs font-medium text-red-900/90">
                    {lang === 'ar'
                      ? 'جميع الباقات مبدئية وتُحدد بالتواصل المباشر مع فريق الشراكات.'
                      : 'All packages are custom-tailored directly with partners—no fixed public pricing.'}
                  </p>
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                      'Sponsorship Packages — Pricing & Deliverables'
                    )}`}
                    className="inline-flex min-h-[44px] items-center text-sm font-extrabold text-blue-600 underline underline-offset-4 hover:text-blue-800"
                  >
                    {lang === 'ar' ? 'تواصل معنا للتفاصيل' : 'Contact us for package details'}
                  </a>
                </div>
              </div>

              {/* Tablet & Desktop Side-by-Side Matrix Table (md+) */}
              <div className="hidden md:block w-full max-w-full overflow-x-auto overscroll-x-contain rounded-card border border-border-paper bg-white shadow-soft">
                <table className="w-full min-w-[640px] border-collapse text-start text-sm">
                  <thead>
                    <tr className="border-b-2 border-outline/20 bg-paper-2">
                      <th
                        scope="col"
                        className="sticky start-0 z-10 bg-paper-2 px-4 py-3.5 text-start text-xs font-extrabold uppercase text-red-900"
                      >
                        {lang === 'ar' ? 'الميزة / مساحة الظهور' : 'Deliverable / Placement'}
                      </th>
                      {sponsors.map((sp) => (
                        <th
                          key={sp.id}
                          scope="col"
                          className="px-4 py-3.5 text-center text-xs font-extrabold text-red-900"
                        >
                          {localizeText(lang, sp.tierLabelEn, sp.tierLabelAr)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-paper">
                    {DELIVERABLE_MATRIX.map((row) => (
                      <tr key={row.id} className="hover:bg-paper/70 transition-colors">
                        <th
                          scope="row"
                          className="sticky start-0 z-10 bg-white px-4 py-3.5 text-start font-bold text-ink"
                        >
                          {lang === 'ar' ? row.labelAr : row.labelEn}
                        </th>
                        {sponsors.map((sp) => {
                          const hasIt = row.included[sp.tier];
                          return (
                            <td key={sp.id} className="px-4 py-3.5 text-center">
                              {hasIt ? (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill border border-positive bg-positive-soft text-positive-ink">
                                  <Check className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                                  <span className="sr-only">
                                    {lang === 'ar' ? 'مشمول' : 'Included'}
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-paper-2 text-ink-faint">
                                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span className="sr-only">
                                    {lang === 'ar' ? 'اختياري' : 'Optional'}
                                  </span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Pricing Row: strictly "Contact us", zero invented prices */}
                    <tr className="bg-gold-200/35">
                      <th
                        scope="row"
                        className="sticky start-0 z-10 bg-gold-200/70 px-4 py-4 text-start font-display text-base text-red-900"
                      >
                        {lang === 'ar' ? 'قيمة الرعاية' : 'Package Pricing'}
                      </th>
                      {sponsors.map((sp) => (
                        <td key={sp.id} className="px-3 py-3 text-center">
                          <a
                            href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                              `${sp.tierLabelEn} — Pricing & Deliverables`
                            )}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-button px-3 text-xs font-extrabold text-blue-600 underline underline-offset-4 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                          >
                            {lang === 'ar' ? 'تواصل معنا' : 'Contact us'}
                          </a>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <StageDivider variant="scallop" from="paper" to="stage" />

      {/* 4. STAGE CLOSING PITCH BANNER */}
      <SunburstStage variant="stage" className="py-section-y">
        <div className="mx-auto max-w-content px-safe">
          <div className="rounded-card border-[3px] border-outline bg-white p-6 sm:p-8 lg:p-10 text-ink shadow-sticker-lg text-center space-y-5">
            <h2 className="font-display text-fluid-3xl text-red-900 leading-tight">
              {lang === 'ar'
                ? 'صمّم شراكتك الرمضانية معنا الآن'
                : 'Co-Create Your Ramadan Partnership With Us'}
            </h2>
            <p className="mx-auto max-w-[58ch] break-words text-base leading-relaxed text-ink-muted">
              {lang === 'ar'
                ? `للعروض التفصيلية وحقوق ليلة النهائي مع مروان سري، راسل فريق الشراكات مباشرة على ${contactEmail}.`
                : `For custom deliverables, branded segments, and Final Night association with Marwan Serry, reach our partnerships team directly at ${contactEmail}.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button variant="red" size="lg" asChild>
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                    'Custom Partnership Inquiry — Ramadan Tournament'
                  )}`}
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'إرسال استفسار رعاية' : 'Email Partnerships Team'}</span>
                </a>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/final">
                  <span>{lang === 'ar' ? 'استعراض ليلة النهائي' : 'Explore Final Night'}</span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </SunburstStage>
    </div>
  );
}
