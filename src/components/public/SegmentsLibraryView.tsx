'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Crown,
  Minus,
  MonitorPlay,
  Plus,
  Search,
  Sparkles,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  gameRepo,
  roundRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Game,
  Round,
  Segment,
  SegmentCategory,
  Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiveBadge, ScoreChip } from '@/components/brand';
import {
  formatPublicDateTime,
  SEGMENT_CATEGORY_INFO,
} from './publicFormatters';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface SegmentsDataset {
  segments: Segment[];
  games: Game[];
  rounds: Round[];
  settings: Settings;
}

type CategoryFilter = 'all' | SegmentCategory;

export function SegmentsLibraryView() {
  const { lang } = useI18n();
  const searchParams = useSearchParams();

  const [data, setData] = useState<SegmentsDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const loadSeqRef = useRef(0);
  const deepLinkDoneRef = useRef(false);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [segments, games, rounds, settings] = await Promise.all([
          segmentRepo.list(),
          gameRepo.list(),
          roundRepo.list(),
          settingsRepo.get(),
        ]);

        if (seq !== loadSeqRef.current) return;
        setData({
          segments: [...segments].sort((a, b) => a.order - b.order),
          games,
          rounds,
          settings,
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل مكتبة الفقرات.'
              : 'Failed to load segments library.'
        );
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void loadAll(true);
    const unsub = realtime.subscribe('*', () => {
      void loadAll(false);
    });
    return () => unsub();
  }, [loadAll]);

  useEffect(() => {
    if (!data || deepLinkDoneRef.current) return;
    const qSeg = searchParams.get('segment');
    if (qSeg && data.segments.some((s) => s.id === qSeg)) {
      setSelectedSegmentId(qSeg);
    }
    deepLinkDoneRef.current = true;
  }, [data, searchParams]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const derived = useMemo(() => {
    if (!data) return null;
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));

    // Map each segment ID to the tournament games featuring it
    const gamesBySegment = new Map<string, Game[]>();
    for (const seg of data.segments) {
      gamesBySegment.set(
        seg.id,
        data.games.filter((g) => g.segmentIds.includes(seg.id))
      );
    }

    const q = normalizeSearchText(searchQuery);
    const filtered = data.segments.filter((seg) => {
      if (category !== 'all' && seg.category !== category) return false;
      if (!q) return true;
      const cat = SEGMENT_CATEGORY_INFO[seg.category];
      const haystack = normalizeSearchText(
        `${seg.nameEn} ${seg.nameAr} ${seg.descriptionEn} ${seg.descriptionAr} ${cat.labelEn} ${cat.labelAr} #${seg.order}`
      );
      return haystack.includes(q);
    });

    const counts: Record<CategoryFilter, number> = {
      all: data.segments.length,
      music: data.segments.filter((s) => s.category === 'music').length,
      wordplay: data.segments.filter((s) => s.category === 'wordplay').length,
      popculture: data.segments.filter((s) => s.category === 'popculture').length,
      general: data.segments.filter((s) => s.category === 'general').length,
      special: data.segments.filter((s) => s.category === 'special').length,
    };

    const selectedIndex = selectedSegmentId
      ? data.segments.findIndex((s) => s.id === selectedSegmentId)
      : -1;
    const selectedSegment =
      selectedIndex >= 0 ? data.segments[selectedIndex] : null;
    const prevSegment =
      selectedIndex > 0 ? data.segments[selectedIndex - 1] : null;
    const nextSegment =
      selectedIndex >= 0 && selectedIndex < data.segments.length - 1
        ? data.segments[selectedIndex + 1]
        : null;

    return {
      roundMap,
      gamesBySegment,
      filtered,
      counts,
      selectedSegment,
      prevSegment,
      nextSegment,
    };
  }, [data, category, searchQuery, selectedSegmentId]);

  const selectSegment = useCallback((segId: string | null) => {
    setSelectedSegmentId(segId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (segId) {
        url.searchParams.set('segment', segId);
      } else {
        url.searchParams.delete('segment');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-12">
          <div className="mx-auto max-w-content-wide px-safe space-y-4">
            <Skeleton className="h-12 w-72 bg-white/25" />
            <Skeleton className="h-5 w-96 max-w-full bg-white/20" />
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !derived) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadAll(true)}
        />
      </div>
    );
  }

  const categoryTabs: Array<{ value: CategoryFilter; en: string; ar: string }> = [
    { value: 'all', en: 'All Segments', ar: 'جميع الفقرات' },
    { value: 'music', en: 'Music & Singing', ar: 'موسيقى وغناء' },
    { value: 'wordplay', en: 'Wordplay & Speed', ar: 'كلمات وسرعة' },
    { value: 'popculture', en: 'Cinema & Pop', ar: 'سينما وثقافة' },
    { value: 'general', en: 'General', ar: 'معلومات عامة' },
    { value: 'special', en: 'Special & Tie-Breaker', ar: 'خاصة وحسم' },
  ];

  const selectedGames = derived.selectedSegment
    ? (derived.gamesBySegment.get(derived.selectedSegment.id) ?? [])
    : [];

  return (
    <div className="flex flex-col">
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'مكتبة فقرات وتحديات البطولة'
            : 'Tournament Segments Library'
        }
        goldHighlight={lang === 'ar' ? 'فقرات وتحديات' : 'Segments Library'}
        subtitle={
          lang === 'ar'
            ? 'استكشف تفاصيل كل فقرة، مؤقتها، نقاطها الفورية، والمباريات التي تتضمنها عبر البطولة.'
            : 'Inspect every original game-show segment: rules, timer settings, preset scoring chips, and which tournament tables feature it.'
        }
        compact
        meta={
          <>
            <Badge variant="gold">
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {formatNumber(data.segments.length, {
                  useArabicIndicDigits: useArabicIndic,
                })}{' '}
                {lang === 'ar' ? 'فقرة أصلية' : 'Original Segments'}
              </span>
            </Badge>
            <Badge variant="white">
              <span>
                {lang === 'ar' ? '٥ فئات تنافسية' : '5 Competitive Categories'}
              </span>
            </Badge>
          </>
        }
        actions={
          <Button variant="secondary" size="md" asChild>
            <Link href="/rules">
              <span>{lang === 'ar' ? 'قوانين النقاط والجرس' : 'Scoring & Buzzer Rules'}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <section className="theme-paper bg-paper py-8 sm:py-12">
        <div className="mx-auto max-w-content-wide px-safe space-y-6">
          {/* Category Tabs & Search */}
          <div className="space-y-4 rounded-card border border-border-paper bg-white p-4 shadow-soft">
            <Tabs
              value={category}
              onValueChange={(v) => setCategory(v as CategoryFilter)}
            >
              <TabsList
                aria-label={
                  lang === 'ar'
                    ? 'تصفية الفقرات حسب الفئة'
                    : 'Filter segments by category'
                }
              >
                {categoryTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    <span>{lang === 'ar' ? tab.ar : tab.en}</span>
                    <span className="rounded-pill bg-black/10 px-1.5 py-0.5 text-[11px] tabular-nums">
                      {formatNumber(derived.counts[tab.value], {
                        useArabicIndicDigits: useArabicIndic,
                      })}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="space-y-1.5">
              <label
                htmlFor="segments-search"
                className="block text-xs font-bold uppercase text-ink-muted"
              >
                {lang === 'ar'
                  ? 'ابحث في أسماء ووصف الفقرات'
                  : 'Search segments by title or description'}
              </label>
              <div className="relative max-w-md">
                <Search
                  className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <Input
                  id="segments-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'مثال: أغنية، كلمات معكوسة، سينما...'
                      : 'e.g. Song, Reversed Words, Cinema...'
                  }
                  className="ps-10 pe-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                    className="absolute end-1 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-pill text-ink-muted hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Segment Cards Grid */}
          {derived.filtered.length === 0 ? (
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لا توجد فقرات مطابقة للبحث'
                  : 'No segments match your search'
              }
              description={
                lang === 'ar'
                  ? 'أعد ضبط البحث أو الفئة لاستعراض مكتبة الفقرات الكاملة.'
                  : 'Clear the search filter or switch to All Segments to browse the full library.'
              }
              action={
                <Button
                  variant="red"
                  onClick={() => {
                    setCategory('all');
                    setSearchQuery('');
                  }}
                >
                  {lang === 'ar' ? 'عرض جميع الفقرات' : 'Show All Segments'}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {derived.filtered.map((seg) => {
                const cat = SEGMENT_CATEGORY_INFO[seg.category];
                const CatIcon = cat.Icon;
                const featuredGames = derived.gamesBySegment.get(seg.id) ?? [];
                const isTieBreaker = seg.id === 'seg-16';

                return (
                  <article
                    key={seg.id}
                    className={cn(
                      'flex flex-col justify-between gap-4 rounded-card bg-white p-5 text-ink transition-transform duration-150 hover:-translate-y-0.5',
                      isTieBreaker
                        ? 'border-[2.5px] border-outline bg-gradient-to-b from-gold-200/40 via-white to-white shadow-sticker'
                        : 'border border-border-paper shadow-soft'
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={cat.badgeVariant}>
                          <CatIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{lang === 'ar' ? cat.labelAr : cat.labelEn}</span>
                        </Badge>
                        <span className="font-score text-lg font-black text-ink-muted tabular-nums">
                          #{formatNumber(String(seg.order).padStart(2, '0'), {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </span>
                      </div>

                      <div>
                        <h2 className="font-display text-xl text-red-900 leading-snug">
                          {localizeText(lang, seg.nameEn, seg.nameAr)}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                          {localizeText(lang, seg.descriptionEn, seg.descriptionAr)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border-paper pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                          <span>
                            {seg.durationSec
                              ? `${formatNumber(seg.durationSec, { useArabicIndicDigits: useArabicIndic })}s`
                              : lang === 'ar'
                                ? 'مؤقت مرن'
                                : 'Flexible timer'}
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
                                  <Plus
                                    className="h-2.5 w-2.5 stroke-[3]"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Minus
                                    className="h-2.5 w-2.5 stroke-[3]"
                                    aria-hidden="true"
                                  />
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

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-muted">
                          {isTieBreaker
                            ? lang === 'ar'
                              ? 'تُفعّل تلقائياً عند التعادل'
                              : 'Auto-inserted on qualifying ties'
                            : featuredGames.length > 0
                              ? lang === 'ar'
                                ? featuredGames.length === 1
                                  ? 'في طاولة واحدة'
                                  : featuredGames.length === 2
                                    ? 'في طاولتين'
                                    : `في ${formatNumber(featuredGames.length, { useArabicIndicDigits: useArabicIndic })} ${featuredGames.length <= 10 ? 'طاولات' : 'طاولة'}`
                                : `Played in ${featuredGames.length} ${featuredGames.length === 1 ? 'table' : 'tables'}`
                              : lang === 'ar'
                                ? 'متاحة لاختيار المباريات'
                                : 'Available in segment pool'}
                        </span>

                        <Button
                          variant="calm"
                          size="sm"
                          onClick={() => selectSegment(seg.id)}
                        >
                          <span>
                            {lang === 'ar' ? 'تفاصيل الفقرة' : 'Inspect Details'}
                          </span>
                          <ArrowRight
                            className="h-3.5 w-3.5 rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* DEEP-LINKABLE SEGMENT DETAIL INSPECTOR SHEET / MODAL */}
      <Dialog
        open={Boolean(derived.selectedSegment)}
        onOpenChange={(open) => {
          if (!open) selectSegment(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {derived.selectedSegment && (() => {
            const seg = derived.selectedSegment;
            const cat = SEGMENT_CATEGORY_INFO[seg.category];
            const CatIcon = cat.Icon;

            return (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={cat.badgeVariant}>
                      <CatIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{lang === 'ar' ? cat.labelAr : cat.labelEn}</span>
                    </Badge>
                    <Badge variant="muted" className="tabular-nums">
                      #{formatNumber(String(seg.order).padStart(2, '0'), {
                        useArabicIndicDigits: useArabicIndic,
                      })}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted tabular-nums">
                      <Timer className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                      <span>
                        {seg.durationSec
                          ? `${formatNumber(seg.durationSec, { useArabicIndicDigits: useArabicIndic })} ${lang === 'ar' ? 'ثانية' : 'seconds'}`
                          : lang === 'ar'
                            ? 'مؤقت مرن'
                            : 'Flexible timer'}
                      </span>
                    </span>
                  </div>

                  <DialogTitle>
                    {localizeText(lang, seg.nameEn, seg.nameAr)}
                  </DialogTitle>

                  {/* Show bilingual counterpart title so bilingual hosts & players always have both */}
                  <div className="text-sm font-bold text-red-700">
                    {lang === 'ar' ? seg.nameEn : seg.nameAr}
                  </div>

                  <DialogDescription>
                    {localizeText(lang, seg.descriptionEn, seg.descriptionAr)}
                  </DialogDescription>
                </DialogHeader>

                {/* Scoring Presets Breakdown */}
                <div className="space-y-3 rounded-input border border-border-paper bg-paper p-4">
                  <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                    {lang === 'ar'
                      ? 'أزرار النقاط الفورية في لوحة الحكم'
                      : 'Scorer Console Point Presets'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3">
                    {seg.presetPoints.map((pts) => (
                      <ScoreChip
                        key={pts}
                        value={pts}
                        tone={pts > 0 ? 'positive' : 'negative'}
                        showSign
                        useArabicIndicDigits={useArabicIndic}
                        size="md"
                      />
                    ))}
                    <p className="min-w-[180px] flex-1 text-xs leading-relaxed text-ink-muted">
                      {lang === 'ar'
                        ? 'بالإضافة لإدخال نقاط مخصصة (+/-) مع ملاحظة اختيارية وتراجع فوري من لوحة الحكم.'
                        : 'Plus free custom positive/negative amounts with optional notes and instant undo in the Scorer Console.'}
                    </p>
                  </div>
                </div>

                {/* Stage Flow */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                    {lang === 'ar' ? 'كيف تُلعب على المسرح' : 'How It Plays on Stage'}
                  </h3>
                  <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
                    <div className="rounded-input border border-border-paper bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5 font-extrabold text-red-900">
                        <Zap className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span>{lang === 'ar' ? '١. الجرس أولاً' : '1. First Buzz'}</span>
                      </div>
                      <p className="text-ink-muted leading-relaxed">
                        {lang === 'ar'
                          ? 'يضغط الحكم اسم المتسابق الأسرع لإضاءة بطاقته على شاشة العرض.'
                          : 'Scorer taps who buzzed first to light up their panel on the Big Screen.'}
                      </p>
                    </div>
                    <div className="rounded-input border border-border-paper bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5 font-extrabold text-red-900">
                        <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span>{lang === 'ar' ? '٢. تحت المؤقت' : '2. Beat the Clock'}</span>
                      </div>
                      <p className="text-ink-muted leading-relaxed">
                        {lang === 'ar'
                          ? 'تومض شاشة العرض تحذيراً بصرياً في آخر ٥ ثوانٍ من الفقرة.'
                          : 'The countdown pulses with a high-contrast visual flash in the final 5 seconds.'}
                      </p>
                    </div>
                    <div className="rounded-input border border-border-paper bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5 font-extrabold text-red-900">
                        <Sparkles className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span>{lang === 'ar' ? '٣. رصد فوري' : '3. Live Tally'}</span>
                      </div>
                      <p className="text-ink-muted leading-relaxed">
                        {lang === 'ar'
                          ? 'تُضاف النقاط أو تُخصم فتتحدث لوحة الصدارة والجدول لحظياً.'
                          : 'Points apply immediately, syncing across the Big Screen and live leaderboard.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tournament Tables Featuring This Segment */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                      {lang === 'ar'
                        ? 'الطاولات التي تتضمن هذه الفقرة'
                        : 'Tournament Tables Featuring This Segment'}
                    </h3>
                    <span className="text-xs font-bold text-ink-muted tabular-nums">
                      {formatNumber(selectedGames.length, {
                        useArabicIndicDigits: useArabicIndic,
                      })}
                    </span>
                  </div>

                  {selectedGames.length === 0 ? (
                    <p className="rounded-input border border-dashed border-border-paper bg-paper p-3 text-xs text-ink-muted">
                      {seg.id === 'seg-16'
                        ? lang === 'ar'
                          ? 'جولة الحسم الفاصلة غير مجدولة مسبقاً—يتم إدراجها تلقائياً في أي طاولة تنتهي بتعادل على بطاقة التأهل.'
                          : 'Sudden-Death Tie-Breaker is never pre-scheduled—it auto-inserts into any table that ends tied across a qualifying cutoff.'
                        : lang === 'ar'
                          ? 'هذه الفقرة متاحة ضمن المكتبة ولم تُعيّن بعد لطاولة محددة في الشجرة الحالية.'
                          : 'This segment is ready in the library and not yet assigned to a table in the current bracket.'}
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pe-1">
                      {selectedGames.map((game) => {
                        const round = derived.roundMap.get(game.roundId);
                        return (
                          <div
                            key={game.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-border-paper bg-paper px-3 py-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 font-bold text-ink truncate">
                                {game.isFinal && (
                                  <Crown
                                    className="h-3.5 w-3.5 shrink-0 text-gold-600"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="truncate">
                                  {localizeText(lang, game.tableName, game.tableNameAr)}
                                </span>
                              </div>
                              <div className="text-[11px] text-ink-muted">
                                {round
                                  ? localizeText(lang, round.name.en, round.name.ar)
                                  : ''}{' '}
                                ·{' '}
                                {formatPublicDateTime(
                                  game.scheduledAt,
                                  lang,
                                  useArabicIndic
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {game.status === 'live' ? (
                                <Link
                                  href={`/screen/${game.id}`}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-pill px-2 text-xs font-bold text-red-700 hover:underline"
                                >
                                  <LiveBadge surface="paper" size="sm" />
                                  <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                              ) : (
                                <Link
                                  href={`/bracket?game=${encodeURIComponent(game.id)}`}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-button px-2 text-xs font-bold text-blue-600 underline hover:text-blue-800"
                                >
                                  <span>{lang === 'ar' ? 'عرض' : 'Inspect'}</span>
                                  <ArrowRight
                                    className="h-3 w-3 rtl:rotate-180"
                                    aria-hidden="true"
                                  />
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter className="sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="calm"
                      size="sm"
                      disabled={!derived.prevSegment}
                      onClick={() =>
                        derived.prevSegment && selectSegment(derived.prevSegment.id)
                      }
                    >
                      <ArrowLeft
                        className="h-4 w-4 rtl:rotate-180"
                        aria-hidden="true"
                      />
                      <span>{lang === 'ar' ? 'السابقة' : 'Previous'}</span>
                    </Button>
                    <Button
                      variant="calm"
                      size="sm"
                      disabled={!derived.nextSegment}
                      onClick={() =>
                        derived.nextSegment && selectSegment(derived.nextSegment.id)
                      }
                    >
                      <span>{lang === 'ar' ? 'التالية' : 'Next'}</span>
                      <ArrowRight
                        className="h-4 w-4 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>

                  <Button variant="red" size="sm" onClick={() => selectSegment(null)}>
                    {lang === 'ar' ? 'إغلاق' : 'Done'}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
