'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clapperboard,
  Clock,
  Globe,
  Minus,
  Music,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { segmentRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Segment, SegmentCategory, Settings } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHeading } from '@/components/brand/SectionHeading';
import { StageDivider } from '@/components/brand/SunburstStage';

const CATEGORY_META: Record<
  SegmentCategory,
  {
    labelEn: string;
    labelAr: string;
    badgeVariant: BadgeProps['variant'];
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  music: {
    labelEn: 'Music & Singing',
    labelAr: 'موسيقى وغناء',
    badgeVariant: 'red',
    Icon: Music,
  },
  wordplay: {
    labelEn: 'Wordplay & Speed',
    labelAr: 'ألعاب كلمات وسرعة',
    badgeVariant: 'info',
    Icon: Zap,
  },
  popculture: {
    labelEn: 'Pop Culture & Cinema',
    labelAr: 'سينما وثقافة شعبية',
    badgeVariant: 'gold',
    Icon: Clapperboard,
  },
  general: {
    labelEn: 'General Knowledge',
    labelAr: 'معلومات عامة',
    badgeVariant: 'neutral',
    Icon: Globe,
  },
  special: {
    labelEn: 'Special & Tie-Breaker',
    labelAr: 'فقرات خاصة وحاسمة',
    badgeVariant: 'positive',
    Icon: Sparkles,
  },
};

type FilterValue = 'all' | 'music' | 'wordplay' | 'popculture' | 'generalSpecial';

export interface SegmentsSectionProps {
  settings: Settings | null;
}

export function SegmentsSection({ settings }: SegmentsSectionProps) {
  const { lang } = useI18n();
  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const list = await segmentRepo.list();
      if (mounted) {
        setSegments(list);
        setLoading(false);
      }
    };
    load();
    const unsub1 = realtime.subscribe('segment.updated', load);
    const unsub2 = realtime.subscribe('data.reset', load);
    return () => {
      mounted = false;
      unsub1();
      unsub2();
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return segments;
    if (filter === 'generalSpecial') {
      return segments.filter(
        (s) => s.category === 'general' || s.category === 'special'
      );
    }
    return segments.filter((s) => s.category === filter);
  }, [segments, filter]);

  const filterTabs: Array<{ value: FilterValue; labelEn: string; labelAr: string }> = [
    { value: 'all', labelEn: `All (${segments.length})`, labelAr: `الكل (${formatNumber(segments.length, { useArabicIndicDigits: useArabicIndic })})` },
    { value: 'music', labelEn: 'Music', labelAr: 'الموسيقى' },
    { value: 'wordplay', labelEn: 'Wordplay', labelAr: 'الكلمات' },
    { value: 'popculture', labelEn: 'Cinema & Pop', labelAr: 'السينما' },
    { value: 'generalSpecial', labelEn: 'General & Tie-Breaker', labelAr: 'عامة وحاسمة' },
  ];

  return (
    <div className="relative">
      <section className="theme-paper bg-paper py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              surface="paper"
              align="start"
              size="lg"
              title={
                lang === 'ar'
                  ? 'ست عشرة فقرة ترفيهية مبتكرة'
                  : 'Sixteen Original Show Segments'
              }
              goldKeyword={lang === 'ar' ? 'فقرة ترفيهية' : 'Show Segments'}
              subtitle={
                lang === 'ar'
                  ? 'مكتبة فقرات أصلية بالكامل قابلة للتعديل من لوحة التحكم، تجمع بين تحديات الأغاني وسرعة البديهة والثقافة الشعبية.'
                  : 'An original, admin-editable library mixing musical hooks, verbal sprints, cinema trivia, and sudden-death tie-breakers.'
              }
            />

            <Button variant="red" size="md" asChild className="self-start lg:self-end">
              <Link href="/segments">
                <span>
                  {lang === 'ar' ? 'تصفح مكتبة الفقرات' : 'Browse Full Segment Library'}
                </span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as FilterValue)}
          >
            <TabsList aria-label={lang === 'ar' ? 'تصفية الفقرات حسب الفئة' : 'Filter segments by category'}>
              {filterTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {lang === 'ar' ? tab.labelAr : tab.labelEn}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((seg) => {
                const meta = CATEGORY_META[seg.category];
                const CatIcon = meta.Icon;

                return (
                  <article
                    key={seg.id}
                    className="flex flex-col justify-between gap-4 rounded-card border border-border-paper bg-white p-5 text-ink shadow-soft transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={meta.badgeVariant}>
                          <CatIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'ar' ? meta.labelAr : meta.labelEn}
                          </span>
                        </Badge>
                        <span className="font-score text-lg font-black text-ink-muted tabular-nums">
                          #{formatNumber(String(seg.order).padStart(2, '0'), {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-xl text-red-900 leading-snug">
                          {localizeText(lang, seg.nameEn, seg.nameAr)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                          {localizeText(lang, seg.descriptionEn, seg.descriptionAr)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-paper pt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span>
                          {seg.durationSec
                            ? `${formatNumber(seg.durationSec, { useArabicIndicDigits: useArabicIndic })}s`
                            : lang === 'ar'
                              ? 'مؤقت مرن'
                              : 'Flexible'}
                        </span>
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {seg.presetPoints.map((pts) => {
                          const isPos = pts > 0;
                          return (
                            <span
                              key={pts}
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-pill border px-2 py-0.5 font-score text-xs font-black tabular-nums',
                                isPos
                                  ? 'border-positive bg-positive-soft text-positive-ink'
                                  : 'border-outline bg-negative text-white'
                              )}
                            >
                              {isPos ? (
                                <Plus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                              ) : (
                                <Minus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                              )}
                              <span>
                                {formatNumber(Math.abs(pts), {
                                  useArabicIndicDigits: useArabicIndic,
                                })}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <StageDivider variant="zigzag" from="paper" to="stage" />
    </div>
  );
}
