'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Crown, Mail, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { sponsorRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Settings, Sponsor } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeading, StageDivider } from '@/components/brand';

export interface SponsorsSectionProps {
  settings: Settings | null;
}

export function SponsorsSection({ settings }: SponsorsSectionProps) {
  const { lang } = useI18n();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const list = await sponsorRepo.list();
      if (mounted) {
        setSponsors(list);
        setLoading(false);
      }
    };
    load();
    const unsub = realtime.subscribe('data.reset', load);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const contactEmail =
    settings?.contactEmail ?? 'partnerships@casinoelal3ab-pitch.com';

  return (
    <div id="sponsors" className="relative scroll-mt-20">
      <section className="theme-paper bg-paper paper-pattern py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              surface="paper"
              align="start"
              size="lg"
              title={
                lang === 'ar'
                  ? 'فئات الرعاية والشراكات'
                  : 'Partnership & Sponsor Tiers'
              }
              goldKeyword={lang === 'ar' ? 'الرعاية والشراكات' : 'Sponsor Tiers'}
              subtitle={
                lang === 'ar'
                  ? 'فئات مبدئية قابلة للتعديل من الإعدادات—الأسعار غير محددة في هذه النسخة، وجميع الحقوق تُنسق مباشرة مع فريق العرض.'
                  : 'Editable placeholder packages configured in Admin Settings—no fixed prices are listed here; final deliverables are tailored directly with partners.'
              }
            />

            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-end">
              <Badge variant="muted" className="border-outline/30 font-bold">
                {lang === 'ar'
                  ? 'فئات مبدئية · الأسعار عند التواصل'
                  : 'Placeholders · Contact Us for Packages'}
              </Badge>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/sponsors">
                  <span>{lang === 'ar' ? 'صفحة الرعاة' : 'All Sponsor Details'}</span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-72 w-full" />
              ))}
            </div>
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
                        ? 'border-[2.5px] border-outline bg-gradient-to-b from-gold-200 via-paper to-white shadow-sticker'
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
                            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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

                      <div>
                        <div className="inline-block rounded-input border border-border-paper bg-paper-2 px-2.5 py-1 text-[11px] font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                          {sponsor.logoText}
                        </div>
                        <h3 className="mt-2 font-display text-xl text-red-900 leading-snug">
                          {localizeText(lang, sponsor.name, sponsor.nameAr)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                          {localizeText(lang, sponsor.blurb, sponsor.blurbAr)}
                        </p>
                      </div>

                      <ul className="space-y-2 border-t border-border-paper pt-3 text-xs sm:text-sm text-ink">
                        {benefits.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-positive-ink"
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-border-paper pt-4">
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
                          <span>
                            {lang === 'ar' ? 'تواصل معنا' : 'Contact us'}
                          </span>
                        </a>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <StageDivider variant="scallop" from="paper" to="stage" />
    </div>
  );
}
