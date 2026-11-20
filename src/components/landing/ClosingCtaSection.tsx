'use client';

import React from 'react';
import Link from 'next/link';
import { Crown, LayoutDashboard, Play, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Player } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CrescentStar } from '@/components/brand/CrescentStar';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';
import { PlayingCardMotif, PlayingDice } from '@/components/brand/GameMotifs';
import { Spotlight } from '@/components/brand/Spotlight';
import { SunburstStage } from '@/components/brand/SunburstStage';

export interface ClosingCtaSectionProps {
  marwanPlayer: Player | null;
}

export function ClosingCtaSection({ marwanPlayer }: ClosingCtaSectionProps) {
  const { lang } = useI18n();
  const marwanName = marwanPlayer
    ? localizeText(lang, marwanPlayer.fullName, marwanPlayer.fullNameAr)
    : lang === 'ar'
      ? 'مروان سري'
      : 'Marwan Serry';

  return (
    <SunburstStage variant="stage" className="py-section-y">
      <Spotlight intensity="dramatic" beams="triple" overlayOnly />

      <div className="mx-auto max-w-content-wide px-safe">
        <div className="relative mx-auto max-w-4xl">
          {/* Corner Game-Show Sticker Motifs on md+ */}
          <div
            className="pointer-events-none absolute -top-7 -start-6 z-20 hidden md:block"
            aria-hidden="true"
          >
            <PlayingDice value={5} size="md" tilt={-12} accent="red" float />
          </div>
          <div
            className="pointer-events-none absolute -bottom-7 -end-6 z-20 hidden md:block"
            aria-hidden="true"
          >
            <PlayingCardMotif
              suit="crown"
              cornerText="★"
              tone="gold"
              size="md"
              tilt={10}
              float
            />
          </div>

          <MarqueeBulbs variant="perimeter" bulbCount={16}>
            <div className="rounded-card border-[3px] border-outline bg-gradient-to-b from-gold-200 via-paper to-white p-6 sm:p-10 text-center text-ink shadow-sticker-lg space-y-6">
              <div className="flex items-center justify-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-pill border-[2.5px] border-outline bg-gold-gradient text-red-900 shadow-sticker-sm">
                  <Crown className="h-6 w-6" aria-hidden="true" />
                </span>
                <CrescentStar size="lg" glow />
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-fluid-3xl text-red-900 ltr:tracking-tight ltr:leading-[1.12] rtl:tracking-normal rtl:leading-[1.32]">
                  {lang === 'ar' ? (
                    <>
                      يا <span className="text-paper-highlight">{marwanName}</span>، المقعد الذهبي ينتظرك.
                    </>
                  ) : (
                    <>
                      Take the Final Seat,{' '}
                      <span className="text-paper-highlight">{marwanName}</span>.
                    </>
                  )}
                </h2>

                <p className="mx-auto max-w-2xl text-fluid-base leading-relaxed text-ink-muted">
                  {lang === 'ar'
                    ? '٢٧ متنافساً، ١٦ فقرة أصلية، تحكيم مباشر بلا أخطاء، وشاشة عرض جاهزة للاستوديو—الشيء الوحيد المتبقي هو انضمامك إلى ليلة النهائي.'
                    : 'Twenty-seven challengers, sixteen original segments, instant live scoring, and studio broadcast screens—all built and waiting for Final Night with you at the table.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <Button variant="gold" size="lg" asChild>
                  <Link href="/final">
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'معاينة ليلة النهائي'
                        : 'Preview Final Night'}
                    </span>
                  </Link>
                </Button>

                <Button variant="red" size="lg" asChild>
                  <a href="#live-demo">
                    <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'أعد تجربة البث الحي' : 'Replay Live Demo'}
                    </span>
                  </a>
                </Button>

                <Button variant="info" size="lg" asChild>
                  <Link href="/admin">
                    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'استعرض لوحة الإدارة' : 'Inspect Admin Studio'}
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </MarqueeBulbs>
        </div>
      </div>
    </SunburstStage>
  );
}
