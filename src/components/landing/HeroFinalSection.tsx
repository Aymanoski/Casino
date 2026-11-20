'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Calendar, Crown, MapPin, Play, Sparkles, Trophy } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Player, Settings } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrescentStar } from '@/components/brand/CrescentStar';
import { FinalCountdown } from '@/components/brand/FinalCountdown';
import { LanternCluster } from '@/components/brand/Lantern';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { PlayingCardFan, PlayingDice } from '@/components/brand/GameMotifs';
import { Spotlight } from '@/components/brand/Spotlight';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';

export interface HeroFinalSectionProps {
  settings: Settings | null;
  marwanPlayer: Player | null;
}

export function HeroFinalSection({
  settings,
  marwanPlayer,
}: HeroFinalSectionProps) {
  const { lang } = useI18n();
  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const targetIso = settings?.finalNightIso ?? '2027-03-22T21:00:00.000Z';

  const marwanName = marwanPlayer
    ? localizeText(lang, marwanPlayer.fullName, marwanPlayer.fullNameAr)
    : lang === 'ar'
      ? 'مروان سري'
      : 'Marwan Serry';

  const eventDates = settings
    ? localizeText(lang, settings.eventDates, settings.eventDatesAr)
    : lang === 'ar'
      ? 'رمضان ٢٠٢٧ · الليالي ١٤ إلى ١٨ (موعد مبدئي)'
      : 'Ramadan 2027 · Nights 14–18 (Placeholder)';

  const venue = settings
    ? localizeText(lang, settings.venue, settings.venueAr)
    : lang === 'ar'
      ? 'استوديو النيل الكبير، القاهرة (موقع مبدئي)'
      : 'Grand Nile Studio, Cairo (Placeholder Venue)';

  const qualifierSeats = [
    {
      id: 'seat-1',
      badge: lang === 'ar' ? 'مقعد ١' : 'SEAT #1',
      title: lang === 'ar' ? 'المتأهل الأول' : 'Finalist #1',
      subtitle:
        lang === 'ar'
          ? 'بطل نصف النهائي · الأول'
          : 'Semi-Final Winner · Top 2',
      initials: '01',
    },
    {
      id: 'seat-2',
      badge: lang === 'ar' ? 'مقعد ٢' : 'SEAT #2',
      title: lang === 'ar' ? 'المتأهل الثاني' : 'Finalist #2',
      subtitle:
        lang === 'ar'
          ? 'وصيف نصف النهائي · الثاني'
          : 'Semi-Final Runner-Up · Top 2',
      initials: '02',
    },
  ];

  return (
    <div className="relative">
      <SunburstStage
        variant="stage"
        className="pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20"
      >
        <Spotlight intensity="medium" beams="dual" overlayOnly />

        {/* Subtle Secondary Ramadan Lantern Cluster (Desktop & Tablet) */}
        <div
          className="pointer-events-none absolute -top-2 end-6 z-0 hidden xl:block opacity-90"
          aria-hidden="true"
        >
          <LanternCluster />
        </div>

        <div className="mx-auto max-w-content-wide px-safe">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Start Column: Headline, Countdown & Primary CTAs (immediately visible for crisp LCP) */}
            <div className="min-w-0 space-y-6 lg:col-span-6 text-start">
              <h1 className="font-display text-fluid-hero text-white [text-shadow:0_4px_0_var(--red-900)] ltr:tracking-tight ltr:leading-[1.06] rtl:tracking-normal rtl:leading-[1.28]">
                {lang === 'ar' ? (
                  <>
                    النهائي الكبير. متأهلان.
                    <br />
                    <span className="text-gold-sticker-lg">ومروان سري.</span>
                  </>
                ) : (
                  <>
                    The Final. Two Finalists.
                    <br />
                    <span className="text-gold-sticker-lg">One Marwan Serry.</span>
                  </>
                )}
              </h1>

              <p className="max-w-[54ch] text-fluid-lg leading-relaxed text-white/95">
                {lang === 'ar'
                  ? '٢٧ متسابقاً يتنافسون طوال ليالي رمضان في طاولات الموسيقى وسرعة البديهة والثقافة—لانتزاع مقعدين فقط أمام مروان سري على طاولة النهائي المباشرة.'
                  : 'Twenty-seven challengers battle across music, wordplay, and trivia tables all Ramadan—for just two seats opposite Marwan Serry under the Final Night lights.'}
              </p>

              {/* Isolated 1s Countdown to Placeholder Final Night Date from Settings */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-white">
                  <CrescentStar size="sm" glow />
                  <span>
                    {lang === 'ar'
                      ? 'العد التنازلي لليلة النهائي'
                      : 'COUNTDOWN TO FINAL NIGHT'}
                  </span>
                  <span className="rounded-pill border border-outline bg-white px-2.5 py-0.5 text-[11px] font-bold text-red-900 shadow-sticker-sm">
                    {lang === 'ar' ? 'موعد مبدئي' : 'PLACEHOLDER DATE'}
                  </span>
                </div>

                <FinalCountdown
                  targetIso={targetIso}
                  useArabicIndicDigits={useArabicIndic}
                  size="compact"
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm font-medium text-white/95">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden="true" />
                    <span>{eventDates}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden="true" />
                    <span>{venue}</span>
                  </span>
                </div>
              </div>

              {/* Primary & Secondary CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button variant="gold" size="lg" asChild>
                  <a href="#live-demo">
                    <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'جرّب البث المباشر الآن' : 'See the live demo'}
                    </span>
                  </a>
                </Button>

                <Button variant="secondary" size="lg" asChild>
                  <a href="#sponsors">
                    <Sparkles className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'رعاية ليلة النهائي' : 'Sponsor the final'}
                    </span>
                  </a>
                </Button>
              </div>
            </div>

            {/* End Column: Marquee-Framed 3-Seat Final Card + Game-Show Motifs */}
            <div className="relative min-w-0 lg:col-span-6">
              {/* Decorative Dice & Playing Card Fan (Outside card bounds on sm+) */}
              <div
                className="pointer-events-none absolute -top-6 -start-3 z-20 hidden sm:block"
                aria-hidden="true"
              >
                <PlayingDice value={6} size="md" tilt={-10} accent="gold" float />
              </div>
              <div
                className="pointer-events-none absolute -bottom-6 -end-2 z-20 hidden sm:block"
                aria-hidden="true"
              >
                <PlayingCardFan float />
              </div>

              <MarqueeBulbs variant="perimeter" bulbCount={14} className="w-full">
                <div className="rounded-card border-[3px] border-outline bg-white p-4 sm:p-6 text-ink shadow-sticker-lg">
                  {/* Final Table Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border-paper pb-3">
                    <div className="flex items-center gap-2">
                      <LiveBadge
                        surface="paper"
                        size="sm"
                        pulse={false}
                        label={
                          lang === 'ar'
                            ? 'طاولة النهائي · ٣ مقاعد'
                            : 'FINAL TABLE · 3 SEATS'
                        }
                      />
                    </div>
                    <Badge variant="muted" className="text-xs font-bold">
                      {lang === 'ar'
                        ? '٨ فقرات حاسمة'
                        : '8 Championship Segments'}
                    </Badge>
                  </div>

                  {/* Seat #3: Marwan Serry's Golden Seat (Name Only, No Photo) */}
                  <div className="mt-4 rounded-card border-[2.5px] border-outline bg-gold-gradient p-4 text-red-900 shadow-sticker">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-red-900 px-3 py-0.5 text-[11px] font-black uppercase ltr:tracking-wider rtl:tracking-normal text-gold-200">
                        <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar'
                            ? 'المقعد الذهبي · المضيف'
                            : 'THE GOLDEN SEAT · HOST'}
                        </span>
                      </span>
                      <span className="text-xs font-extrabold text-red-900">
                        {lang === 'ar' ? 'المقعد ٣' : 'SEAT 03'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <PlayerAvatar
                        name={marwanName}
                        avatarSeed="golden-seat-marwan"
                        size="lg"
                        isHost
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-display text-2xl sm:text-3xl text-red-900 leading-tight">
                          {marwanName}
                        </h2>
                        <p className="mt-0.5 text-xs sm:text-sm font-bold text-red-900/90">
                          {lang === 'ar'
                            ? 'ينتظر الفائزين من نصف النهائي في مواجهة ٣ لاعبين'
                            : 'Awaits the top 2 semi-finalists in a 3-player finale'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* VS Separator */}
                  <div className="relative my-3.5 flex items-center justify-center" aria-hidden="true">
                    <div className="h-[2px] flex-1 bg-border-paper" />
                    <span className="mx-3 inline-flex h-8 w-11 items-center justify-center rounded-pill border-2 border-outline bg-red-600 font-display text-xs font-black text-white shadow-sticker-sm">
                      VS
                    </span>
                    <div className="h-[2px] flex-1 bg-border-paper" />
                  </div>

                  {/* Seats #1 & #2: Open Qualifier Finalists */}
                  <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                    {qualifierSeats.map((seat) => (
                      <div
                        key={seat.id}
                        className="flex flex-col justify-between gap-3 rounded-card border-2 border-dashed border-red-900/45 bg-paper p-3.5 text-ink"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="upcoming" className="px-2.5 py-0.5 text-[11px]">
                            {seat.badge}
                          </Badge>
                          <Trophy className="h-4 w-4 text-red-600/75" aria-hidden="true" />
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border-2 border-dashed border-red-900/50 bg-white font-score text-lg font-black text-red-900"
                            aria-hidden="true"
                          >
                            {seat.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-display text-base sm:text-lg text-red-900">
                              {seat.title}
                            </div>
                            <div className="text-xs font-medium text-ink-muted leading-snug">
                              {seat.subtitle}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Card Quick Links (Always >= 44px touch targets, Blue links on White) */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t-2 border-border-paper pt-3 text-xs sm:text-sm font-bold">
                    <Link
                      href="/final"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button px-2 text-blue-600 underline underline-offset-4 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                    >
                      <span>
                        {lang === 'ar' ? 'عرض تفاصيل ليلة النهائي' : 'Inspect Final Night'}
                      </span>
                      <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>

                    <Link
                      href="/bracket"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-button px-2 text-blue-600 underline underline-offset-4 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                    >
                      <span>
                        {lang === 'ar' ? 'شاهد طريق التأهل (٢٧ لاعباً)' : '27-Player Bracket Path'}
                      </span>
                      <ArrowDownRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </MarqueeBulbs>
            </div>
          </div>
        </div>
      </SunburstStage>

      <StageDivider variant="zigzag" from="stage" to="paper" />
    </div>
  );
}
