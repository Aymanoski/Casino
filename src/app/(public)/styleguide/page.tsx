'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Crown,
  Flame,
  Globe,
  Hash,
  Layers,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Undo2,
  Wand2,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { playerRepo, segmentRepo, settingsRepo } from '@/lib/repos';
import type { Player, Segment } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
import {
  Badge,
  BracketNode,
  BracketTrack,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfettiShapes,
  ConfirmDialog,
  CrescentStar,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  FormGrid,
  GoldDivider,
  Input,
  Lantern,
  LanternCluster,
  LiveBadge,
  MarqueeBulbs,
  PlayerAvatar,
  PlayerPanel,
  PlayerPanelSkeleton,
  PlayingCardFan,
  PlayingCardMotif,
  PlayingDice,
  ScoreboardRow,
  ScoreChip,
  SectionHeading,
  SelectField,
  Skeleton,
  Spotlight,
  StageDivider,
  StickerBadge,
  SunburstStage,
  SwirlOrnament,
  TableRowSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
  TimerRing,
} from '@/components/ui';

interface SandboxPlayer {
  id: string;
  nameEn: string;
  nameAr: string;
  nicknameEn: string;
  nicknameAr: string;
  avatarSeed: string;
  score: number;
  gamesPlayed: number;
  wins: number;
  isHost?: boolean;
  lastDelta: number | null;
}

export default function StyleguidePage() {
  const { lang, setLang } = useI18n();
  const { toast } = useToast();

  const [useArabicIndic, setUseArabicIndic] = useState(false);
  const [bilingualPreview, setBilingualPreview] = useState(true);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState<string>('player-1');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('player-1');

  // Timer states for Stage Gold, Paper Red, and Urgent Last-5s Flash
  const [timerRemaining, setTimerRemaining] = useState<number>(24);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>(
    'running'
  );
  const [urgentRemaining, setUrgentRemaining] = useState<number>(4);

  // Form & Table filter states
  const [customPoints, setCustomPoints] = useState<string>('15');
  const [selectedCategory, setSelectedCategory] = useState<string>('music');
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string>('all');
  const [scorerNote, setScorerNote] = useState<string>(
    'Guessed the reversed Amr Diab chorus in 3 seconds!'
  );
  const [showTableEmpty, setShowTableEmpty] = useState<boolean>(false);

  // Loaded via async repos (zero direct seed imports per AGENTS.md §6)
  const [seededPlayers, setSeededPlayers] = useState<Player[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [sandboxPlayers, setSandboxPlayers] = useState<SandboxPlayer[]>([
    {
      id: 'player-1',
      nameEn: 'Omar Hassan',
      nameAr: 'عمر حسن',
      nicknameEn: 'The Fox',
      nicknameAr: 'الثعلب',
      avatarSeed: 'omar-fox',
      score: 65,
      gamesPlayed: 2,
      wins: 2,
      lastDelta: 10,
    },
    {
      id: 'player-19',
      nameEn: 'Salma Reda',
      nameAr: 'سلمى رضا',
      nicknameEn: 'Salsabeel',
      nicknameAr: 'سلسبيل',
      avatarSeed: 'salma-salsabeel',
      score: 55,
      gamesPlayed: 2,
      wins: 2,
      lastDelta: 5,
    },
    {
      id: 'player-marwan',
      nameEn: 'Marwan Serry',
      nameAr: 'مروان سري',
      nicknameEn: 'The Boss',
      nicknameAr: 'صاحب الكازينو',
      avatarSeed: 'marwan-host',
      score: 60,
      gamesPlayed: 1,
      wins: 1,
      isHost: true,
      lastDelta: -5,
    },
  ]);

  useEffect(() => {
    let mounted = true;
    const loadFromRepos = async () => {
      const [allPlayers, allSegments, settings] = await Promise.all([
        playerRepo.list({ includeHost: true }),
        segmentRepo.list(),
        settingsRepo.get(),
      ]);
      if (!mounted) return;
      setSeededPlayers(allPlayers.slice(0, 8));
      setSegments(allSegments.slice(0, 8));
      setUseArabicIndic(settings.useArabicIndicDigits);
    };
    loadFromRepos();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (timerStatus !== 'running') return;
    const interval = setInterval(() => {
      setTimerRemaining((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStatus]);

  const applySandboxDelta = (playerId: string, delta: number) => {
    setSandboxPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId
          ? { ...p, score: p.score + delta, lastDelta: delta }
          : p
      )
    );
    const target = sandboxPlayers.find((p) => p.id === playerId);
    const targetName = target
      ? localizeText(lang, target.nameEn, target.nameAr)
      : playerId;

    toast({
      variant: delta >= 0 ? 'positive' : 'negative',
      title:
        lang === 'ar'
          ? `${delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`} نقطة لـ ${targetName}`
          : `${delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`} pts applied to ${targetName}`,
      description:
        lang === 'ar'
          ? 'تم تحديث لوحة الصدارة والعداد المتحرك فوراً.'
          : 'Animated counter and delta flash triggered immediately.',
    });
  };

  const sortedSandbox = [...sandboxPlayers].sort((a, b) => b.score - a.score);

  const visibleSegments =
    tableCategoryFilter === 'all'
      ? segments
      : segments.filter((s) => s.category === tableCategoryFilter);

  const paletteGroups = [
    {
      title: lang === 'ar' ? 'أحمر المسرح (Stage Red)' : 'Brand Red (The Stage)',
      swatches: [
        { token: '--red-100', hex: '#FDE7EB', bg: 'bg-red-100', darkInk: true },
        { token: '--red-400', hex: '#E5405C', bg: 'bg-red-400', darkInk: false },
        { token: '--red-600', hex: '#C4163A', bg: 'bg-red-600', darkInk: false },
        { token: '--red-700', hex: '#A81233', bg: 'bg-red-700', darkInk: false },
        { token: '--red-800', hex: '#7E0D26', bg: 'bg-red-800', darkInk: false },
        { token: '--red-900', hex: '#4F0716', bg: 'bg-red-900', darkInk: false },
      ],
    },
    {
      title: lang === 'ar' ? 'الذهبي والبرتقالي (The Star)' : 'Gold & Orange (The Star)',
      swatches: [
        { token: '--gold-200', hex: '#FFE899', bg: 'bg-gold-200', darkInk: true },
        { token: '--gold-300', hex: '#FFD54A', bg: 'bg-gold-300', darkInk: true },
        { token: '--gold-400', hex: '#FFC12B', bg: 'bg-gold-400', darkInk: true },
        { token: '--gold-500', hex: '#FF9F1C', bg: 'bg-gold-500', darkInk: true },
        { token: '--gold-600', hex: '#E8740C', bg: 'bg-gold-600', darkInk: false },
      ],
    },
    {
      title: lang === 'ar' ? 'الورق والأبيض (Paper & Ink)' : 'White, Paper & Ink',
      swatches: [
        { token: '--white', hex: '#FFFFFF', bg: 'bg-white', darkInk: true },
        { token: '--paper', hex: '#FFF9F0', bg: 'bg-paper', darkInk: true },
        { token: '--paper-2', hex: '#FBEFE0', bg: 'bg-paper-2', darkInk: true },
        { token: '--ink', hex: '#2A0A10', bg: 'bg-ink', darkInk: false },
        { token: '--ink-muted', hex: '#6B4A50', bg: 'bg-ink-muted', darkInk: false },
      ],
    },
    {
      title: lang === 'ar' ? 'الأزرق الكهربائي والحالات' : 'Electric Blue & Status',
      swatches: [
        { token: '--blue-100', hex: '#E6EEFF', bg: 'bg-blue-100', darkInk: true },
        { token: '--blue-300', hex: '#7FA8FF', bg: 'bg-blue-300', darkInk: true },
        { token: '--blue-500', hex: '#2F6BFF', bg: 'bg-blue-500', darkInk: false },
        { token: '--blue-600', hex: '#1F4FD8', bg: 'bg-blue-600', darkInk: false },
        { token: '--positive', hex: '#1FA971', bg: 'bg-positive', darkInk: true },
        { token: '--negative', hex: '#B3001B', bg: 'bg-negative', darkInk: false },
      ],
    },
  ];

  return (
    <div className="min-h-dvh pb-16">
      {/* 0. STYLEGUIDE INSPECTOR BAR */}
      <div className="relative md:sticky md:top-header-h [@media(max-height:740px)]:static z-30 border-b-2 border-outline bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-content-wide 3xl:max-w-stage flex-col gap-3 px-safe py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ScoreChip value="★" tone="red" size="sm" className="shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-display text-fluid-lg text-red-900">
                  {lang === 'ar'
                    ? 'دليل نظام التصميم — كازينو الألعاب'
                    : 'Casino El Al3ab — Stage & Paper Styleguide'}
                </span>
                <Badge variant="gold" className="hidden sm:inline-flex shrink-0">
                  DESIGN.md · Stage & Paper
                </Badge>
              </div>
              <p className="truncate text-xs text-ink-muted">
                {lang === 'ar'
                  ? 'أحمر المسرح المشع، الذهبي، الأبيض، ولمسة الأزرق الكهربائي (٣٢٠–٢٥٦٠ بكسل)'
                  : 'Sunburst Stage, Paper clarity, sticker outlines, Lilita One / Lalezar / Bebas Neue / Cairo'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Explicit EN (LTR) / AR (RTL) Switcher */}
            <div
              role="group"
              aria-label="Language & Direction Mode"
              className="inline-flex rounded-pill border-2 border-outline bg-paper-2 p-0.5 shadow-sticker-sm"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`min-h-[44px] rounded-pill px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  lang === 'en'
                    ? 'bg-red-600 text-white shadow-sticker-sm'
                    : 'text-ink hover:text-red-900'
                }`}
              >
                EN · LTR
              </button>
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`min-h-[44px] rounded-pill px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  lang === 'ar'
                    ? 'bg-red-600 text-white shadow-sticker-sm'
                    : 'text-ink hover:text-red-900'
                }`}
              >
                عربي · RTL
              </button>
            </div>

            {/* Western vs Arabic-Indic Digits */}
            <button
              type="button"
              onClick={() => setUseArabicIndic((prev) => !prev)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-outline px-3.5 text-xs font-extrabold shadow-sticker-sm transition-colors ${
                useArabicIndic
                  ? 'bg-gold-400 text-red-900'
                  : 'bg-white text-ink hover:bg-paper'
              }`}
            >
              <Hash className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>{useArabicIndic ? '١٢٣ (هندي)' : '123 (Western)'}</span>
            </button>

            {/* Dual EN/AR Specimen Toggle */}
            <button
              type="button"
              onClick={() => setBilingualPreview((prev) => !prev)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-outline px-3.5 text-xs font-extrabold shadow-sticker-sm transition-colors ${
                bilingualPreview
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-ink hover:bg-paper'
              }`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span>
                {lang === 'ar' ? 'معاينة EN + AR' : 'Dual EN/AR Specimen'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. STAGE HERO SHOWCASE: Red Sunburst + Spotlight + Gold Sticker Headlines + Dice/Cards + Subtle Lanterns */}
      <SunburstStage as="section" className="py-section-y">
        <Spotlight overlayOnly intensity="dramatic" beams="triple" />

        <div className="relative z-10 mx-auto max-w-content-wide 3xl:max-w-stage space-y-8 sm:space-y-10 px-safe">
          {/* Decorative Top Row: Dice + LiveBadge + Subtle Lanterns */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PlayingDice value={5} size="md" tilt={-12} float />
              <PlayingCardMotif
                suit="star"
                cornerText="A"
                tone="gold"
                size="sm"
                tilt={10}
                float
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <LiveBadge
                surface="stage"
                size="lg"
                label={
                  lang === 'ar'
                    ? 'مباشر · استوديو كازينو الألعاب'
                    : 'LIVE · CASINO EL AL3AB STAGE'
                }
              />
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <LanternCluster className="scale-90" />
            </div>
          </div>

          {/* Giant Gold-to-Orange Sticker Outlined Headline */}
          <div className="relative">
            <div className="hidden lg:block absolute -top-4 start-4">
              <SwirlOrnament tone="gold" size="lg" />
            </div>
            <div className="hidden lg:block absolute -top-4 end-4">
              <SwirlOrnament tone="white" size="lg" flip />
            </div>

            <SectionHeading
              as="h1"
              size="xl"
              align="center"
              surface="stage"
              eyebrow={
                lang === 'ar'
                  ? 'هوية العرض التلفزيوني المبهجة · Stage & Paper'
                  : 'GAME-SHOW DESIGN SYSTEM · STAGE & PAPER'
              }
              title={
                lang === 'ar'
                  ? 'ليالي رمضان داخل كازينو الألعاب'
                  : 'The Final. Two Finalists. One Marwan Serry.'
              }
              goldKeyword={lang === 'ar' ? 'كازينو الألعاب' : 'Marwan Serry.'}
              subtitle={
                lang === 'ar'
                  ? 'خلفية أشعة الشمس الحمراء، خطوط ذهبية متدرجة بإطار عنابي، بطاقات بيضاء بظل ستيكر صلب، ولمسة أزرق كهربائي واضحة.'
                  : 'Crimson sunburst stages, glossy gold-to-orange sticker typography, crisp white Paper clarity, and electric blue contrast sparks.'
              }
            />
          </div>

          {/* Primary Stage Actions + Confetti */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="gold" size="lg">
                <Zap className="h-5 w-5 shrink-0 fill-current" />
                <span>
                  {lang === 'ar' ? 'جرّب المحاكي المباشر' : 'Try Live Stage Demo'}
                </span>
              </Button>
              <Button variant="secondary" size="lg">
                <Trophy className="h-5 w-5 shrink-0 text-red-600" />
                <span>
                  {lang === 'ar' ? 'باقات الرعاية' : 'Sponsor the Final'}
                </span>
              </Button>
              <Button variant="info" size="lg">
                <span>{lang === 'ar' ? 'جدول البطولة' : 'View Schedule'}</span>
              </Button>
            </div>
            <ConfettiShapes className="h-12 w-full max-w-md opacity-95" variant="stage" />
          </div>

          {/* Dual EN / AR Typography & Surface Specimen Cards */}
          {bilingualPreview && (
            <div className="grid gap-grid-gap lg:grid-cols-2">
              <Card appearance="sticker" dir="ltr" lang="en" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="gold">ENGLISH · LTR SPECIMEN</Badge>
                  <span className="text-xs font-bold text-ink-muted">
                    Lilita One + Bebas Neue + Inter
                  </span>
                </div>
                <SectionHeading
                  size="md"
                  surface="paper"
                  eyebrow="PAPER HEADLINE TREATMENT"
                  title="Two Finalists. One Golden Seat."
                  goldKeyword="Golden Seat."
                  subtitle="Chunky maroon headline on warm Paper, gold-highlighted keyword, 20px card radius, 14px button radius, and mirrored RTL sticker shadows."
                />
                <div className="flex items-baseline gap-4 border-t border-border-paper pt-3">
                  <span className="font-score text-4xl font-black text-red-900 tabular-nums">
                    1,250
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Bebas Neue Tabular Numerals
                  </span>
                </div>
              </Card>

              <Card appearance="sticker" dir="rtl" lang="ar" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="red">العربية · نموذج RTL</Badge>
                  <span className="text-xs font-bold text-ink-muted">
                    Lalezar + Cairo (900 Tabular)
                  </span>
                </div>
                <SectionHeading
                  size="md"
                  surface="paper"
                  eyebrow="عرض ليلة النهائي الكبرى"
                  title="متأهلان اثنان في مواجهة مروان سري"
                  goldKeyword="مروان سري"
                  subtitle="تصميم ثنائي اللغة أصيل بخط Lalezar للعناوين و Cairo للنصوص والأرقام مع تباين يتجاوز معيار WCAG AA."
                />
                <div className="flex items-baseline gap-4 border-t border-border-paper pt-3">
                  <span className="font-score text-4xl font-black text-red-600 tabular-nums">
                    ١٬٢٥٠
                  </span>
                  <span className="text-xs font-bold text-ink-muted">
                    أرقام جدولية ثابتة العرض بخط Cairo 900
                  </span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </SunburstStage>

      {/* ZigZag Sticker Transition: Stage -> Paper */}
      <StageDivider variant="zigzag" from="stage" to="paper" />

      {/* MAIN PAPER CONTENT BODY */}
      <div className="mx-auto max-w-content-wide 3xl:max-w-stage space-y-12 sm:space-y-16 px-safe pt-10 sm:pt-12">
        {/* 2. COLOR TOKENS & WCAG AA CONTRAST RULES */}
        <section className="space-y-6" aria-labelledby="section-tokens">
          <SectionHeading
            id="section-tokens"
            size="md"
            surface="paper"
            eyebrow={lang === 'ar' ? '١. الألوان والتباين' : '1. PALETTE & CONTRAST RULES'}
            title={
              lang === 'ar'
                ? 'باليتة الألوان وقواعد القراءة (WCAG AA)'
                : 'Color Tokens, Gradients & Readability Rules'
            }
            goldKeyword={lang === 'ar' ? 'القراءة' : 'Readability'}
            subtitle={
              lang === 'ar'
                ? 'الأبيض على الأحمر لكل المقاسات، الذهبي على الأحمر للعناوين الكبيرة فقط (+24px)، الأزرق على الأبيض/الورق أو بإطار أبيض، والزائد/الناقص بالرمز والشكل دائماً.'
                : 'White on red at any size, gold on red only for large 24px+ display type, blue never touching red directly, and + / − never shown by color alone.'
            }
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {paletteGroups.map((group) => (
              <Card key={group.title} appearance="calm" className="space-y-3">
                <h3 className="font-display text-base text-red-900">{group.title}</h3>
                <div className="space-y-2">
                  {group.swatches.map((sw) => (
                    <div
                      key={sw.token}
                      className="flex items-center justify-between gap-2 rounded-input border border-border-paper p-2 bg-paper"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`h-8 w-8 shrink-0 rounded-[8px] border-2 border-outline ${sw.bg}`}
                          aria-hidden="true"
                        />
                        <span className="truncate font-mono text-xs font-bold text-ink">
                          {sw.token}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {sw.hex}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Contrast Rules Visual Guardrails */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-card border-[2.5px] border-outline bg-red-600 p-card-pad text-white shadow-sticker space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="white">RULE 1 · RED STAGE</Badge>
                <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
              </div>
              <p className="font-display text-2xl text-gold-sticker">
                {lang === 'ar' ? 'عنوان ذهبي كبير (+24px)' : 'Large Gold Display (24px+)'}
              </p>
              <p className="text-sm font-medium text-white">
                {lang === 'ar'
                  ? 'النصوص العادية والفقرات على الخلفية الحمراء تكون باللون الأبيض دائماً لتحقيق تباين عالٍ.'
                  : 'Body copy and small labels on --red-600 always use crisp #FFFFFF (6.0:1+ AA).'}
              </p>
            </div>

            <div className="rounded-card border-[2.5px] border-outline bg-red-600 p-card-pad text-white shadow-sticker space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="info">RULE 2 · BLUE ON RED</Badge>
                <ShieldCheck className="h-5 w-5 text-white shrink-0" />
              </div>
              <p className="font-display text-2xl text-white">
                {lang === 'ar' ? 'حاجز أبيض للأزرق' : 'White-Buffered Blue'}
              </p>
              <p className="text-sm font-medium text-white">
                {lang === 'ar'
                  ? 'لا يلامس الأزرق الأحمر مباشرة؛ إما على الورق الأبيض أو داخل إطار أبيض واضح.'
                  : 'Blue never sits directly on red: it lives on Paper or inside a white-bordered chip / focus ring.'}
              </p>
            </div>

            <Card appearance="sticker" className="bg-white text-ink space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="gold">RULE 3 · PLUS / MINUS</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="positive" className="text-sm font-extrabold">
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>+10</span>
                </Badge>
                <Badge variant="negative" className="text-sm font-extrabold">
                  <Minus className="h-4 w-4 stroke-[3]" />
                  <span>−5</span>
                </Badge>
              </div>
              <p className="text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'الزيادة والخصم تظهران دائماً بعلامة (+ / −) وأيقونة واضحة، وليس باللون فقط.'
                  : 'Positive & negative points always pair color with explicit + / − signs and Plus/Minus icons.'}
              </p>
            </Card>
          </div>
        </section>

        <GoldDivider
          ornament="dice"
          label={
            lang === 'ar'
              ? '٢. مقارنة السمات الثلاث: Stage و Paper و Stage-Dark'
              : '2. STAGE vs PAPER vs STAGE-DARK SURFACES'
          }
        />

        {/* 3. SIDE-BY-SIDE THEME COMPARISON */}
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* STAGE THEME DEMO */}
            <SunburstStage
              as="div"
              animateRays={false}
              className="rounded-card border-[3px] border-outline p-5 sm:p-7 shadow-sticker-lg"
            >
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StickerBadge tone="white">STAGE THEME (.theme-stage)</StickerBadge>
                  <LiveBadge surface="stage" size="sm" />
                </div>

                <SectionHeading
                  size="md"
                  surface="stage"
                  title={
                    lang === 'ar'
                      ? 'أزرار ذهبية وبطاقات ستيكر بيضاء'
                      : 'Gold Actions & White Sticker Cards'
                  }
                  goldKeyword={lang === 'ar' ? 'ذهبية' : 'Gold Actions'}
                  subtitle={
                    lang === 'ar'
                      ? 'تُستخدم لواجهة العرض الرئيسية، ليلة النهائي، وشاشة الصالة العملاقة.'
                      : 'Used for Hero moments, Final Night, Big Screen, and live celebrations.'
                  }
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="md">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>{lang === 'ar' ? 'زر رئيسي ذهبي' : 'Stage Primary (Gold)'}</span>
                  </Button>
                  <Button variant="secondary" size="md">
                    <span>{lang === 'ar' ? 'ثانوي أبيض' : 'Stage Secondary'}</span>
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 items-center">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {lang === 'ar' ? 'بطاقة ستيكر بيضاء' : 'Stage Sticker Card'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-ink-muted">
                        {lang === 'ar'
                          ? 'إطار عنابي سميك ٢.٥ بكسل مع ظل ستيكر صلب ينعكس في العربية.'
                          : '2.5px maroon outline + mirrored hard offset sticker shadow.'}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex justify-center">
                    <TimerRing
                      durationSec={30}
                      remainingSec={21}
                      status="running"
                      surface="stage"
                      size="sm"
                      useArabicIndicDigits={useArabicIndic}
                    />
                  </div>
                </div>
              </div>
            </SunburstStage>

            {/* PAPER THEME DEMO */}
            <div className="theme-paper rounded-card border-[3px] border-outline bg-paper p-5 sm:p-7 text-ink shadow-sticker-lg">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StickerBadge tone="red">PAPER THEME (.theme-paper)</StickerBadge>
                  <LiveBadge surface="paper" size="sm" />
                </div>

                <SectionHeading
                  size="md"
                  surface="paper"
                  title={
                    lang === 'ar'
                      ? 'أزرار حمراء وبطاقات هادئة للقراءة'
                      : 'Red Actions & Calm Paper Clarity'
                  }
                  goldKeyword={lang === 'ar' ? 'هادئة' : 'Paper Clarity'}
                  subtitle={
                    lang === 'ar'
                      ? 'تُستخدم للوحة الإدارة، الجداول، النماذج، القوانين، وصفحات اللاعبين.'
                      : 'Used for Admin, Data Tables, Forms, Rules, Schedule, and Contestant pages.'
                  }
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="md">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{lang === 'ar' ? 'زر رئيسي أحمر' : 'Paper Primary (Red)'}</span>
                  </Button>
                  <Button variant="secondary" size="md">
                    <span>{lang === 'ar' ? 'ثانوي بإطار أحمر' : 'Paper Secondary'}</span>
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 items-center">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {lang === 'ar' ? 'بطاقة ورقية هادئة' : 'Calm Paper Card'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-ink-muted">
                        {lang === 'ar'
                          ? 'إطار رقيق هادئ وظل ناعم لعرض البيانات الكثيفة بدون ضجيج بصري.'
                          : '1px --border-paper + soft shadow for dense admin and reading layouts.'}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex justify-center">
                    <TimerRing
                      durationSec={30}
                      remainingSec={18}
                      status="running"
                      surface="paper"
                      size="sm"
                      useArabicIndicDigits={useArabicIndic}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STAGE-DARK (SCORER CONSOLE) STRIP */}
          <div className="theme-stage-dark rounded-card border-[3px] border-outline bg-red-900 p-5 sm:p-7 text-white shadow-sticker-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold">STAGE-DARK · SCORER CONSOLE</Badge>
                  <LiveBadge surface="stage" size="sm" />
                </div>
                <h3 className="font-display text-fluid-2xl text-white">
                  {lang === 'ar'
                    ? 'لوحة الحكم الليلية (تباين فائق · أزرار 56px+)'
                    : 'Scorer Console Mode (Deep Maroon, Blue Selected Ring, 56px+ Targets)'}
                </h3>
              </div>
              <Button variant="gold" size="scorer">
                <Undo2 className="h-5 w-5 shrink-0" />
                <span>{lang === 'ar' ? 'تراجع عن آخر حركة' : 'Undo Last Action'}</span>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <PlayerPanel
                surface="dark"
                variant="scorer"
                name={lang === 'ar' ? 'عمر حسن' : 'Omar Hassan'}
                nickname={lang === 'ar' ? 'الثعلب' : 'The Fox'}
                avatarSeed="omar-fox"
                score={sandboxPlayers[0].score}
                rank={1}
                isSelected
                isBuzzed={buzzedPlayerId === 'player-1'}
                presetPoints={[10, 5, -5]}
                useArabicIndicDigits={useArabicIndic}
                onBuzz={() => setBuzzedPlayerId('player-1')}
                onApplyPreset={(pts) => applySandboxDelta('player-1', pts)}
              />
              <PlayerPanel
                surface="dark"
                variant="scorer"
                name={lang === 'ar' ? 'سلمى رضا' : 'Salma Reda'}
                nickname={lang === 'ar' ? 'سلسبيل' : 'Salsabeel'}
                avatarSeed="salma-salsabeel"
                score={sandboxPlayers[1].score}
                rank={2}
                isBuzzed={buzzedPlayerId === 'player-19'}
                presetPoints={[10, 5, -5]}
                useArabicIndicDigits={useArabicIndic}
                onBuzz={() => setBuzzedPlayerId('player-19')}
                onApplyPreset={(pts) => applySandboxDelta('player-19', pts)}
              />
            </div>
          </div>
        </section>

        <GoldDivider
          ornament="suits"
          label={
            lang === 'ar'
              ? '٣. محاكي الطاولة المباشرة (PlayerPanel + ScoreboardRow + TimerRing)'
              : '3. LIVE BROADCAST TABLE SANDBOX'
          }
        />

        {/* 4. INTERACTIVE SANDBOX: PLAYER PANELS, SCOREBOARD ROWS & TIMERS */}
        <section className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              size="md"
              surface="paper"
              eyebrow={lang === 'ar' ? 'مكونات برنامج المسابقات' : 'BROADCAST SANDBOX'}
              title={
                lang === 'ar'
                  ? 'لوحات اللاعبين ولوحة الصدارة والمؤقت'
                  : 'Player Panels, Scoreboard & Timer Ring'
              }
              goldKeyword={lang === 'ar' ? 'الصدارة' : 'Scoreboard'}
              subtitle={
                lang === 'ar'
                  ? 'اضغط لتحديد اللاعب (حلقة زرقاء) أو ضغط الجرس (حلقة ذهبية) أو تطبيق النقاط.'
                  : 'Tap any panel to select (blue ring), trigger Buzzed First (gold pulse), or apply +/- points with instant counter & rank reorder.'
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="red"
                size="sm"
                onClick={() => applySandboxDelta(buzzedPlayerId, 10)}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>
                  {lang === 'ar' ? '+١٠ للاعب الضاغط' : '+10 pts to Buzzed'}
                </span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => applySandboxDelta(buzzedPlayerId, -5)}
              >
                <Minus className="h-4 w-4 shrink-0" />
                <span>{lang === 'ar' ? '−٥ خصم' : '−5 Penalty'}</span>
              </Button>
            </div>
          </div>

          {/* 3-Player Sticker Panel Grid */}
          <div className="grid grid-cols-1 gap-grid-gap md:grid-cols-2 xl:grid-cols-3">
            {sandboxPlayers.map((p) => {
              const rank =
                sortedSandbox.findIndex((item) => item.id === p.id) + 1;
              return (
                <PlayerPanel
                  key={p.id}
                  playerId={p.id}
                  surface="light"
                  name={localizeText(lang, p.nameEn, p.nameAr)}
                  nickname={localizeText(lang, p.nicknameEn, p.nicknameAr)}
                  avatarSeed={p.avatarSeed}
                  score={p.score}
                  rank={rank}
                  isBuzzed={buzzedPlayerId === p.id}
                  isSelected={selectedPlayerId === p.id}
                  isWinner={rank === 1}
                  isHost={p.isHost}
                  useArabicIndicDigits={useArabicIndic}
                  presetPoints={[10, 5, -5]}
                  onSelect={() => setSelectedPlayerId(p.id)}
                  onBuzz={() => {
                    setBuzzedPlayerId(p.id);
                    setSelectedPlayerId(p.id);
                    toast({
                      variant: 'gold',
                      title:
                        lang === 'ar'
                          ? `⚡ ${p.nameAr} ضغط الجرس أولاً!`
                          : `⚡ ${p.nameEn} buzzed first!`,
                    });
                  }}
                  onApplyPreset={(pts) => applySandboxDelta(p.id, pts)}
                />
              );
            })}
          </div>

          {/* ScoreboardRow + TimerRing Gallery */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-fluid-xl text-red-900">
                  {lang === 'ar'
                    ? 'صفوف لوحة الصدارة (ScoreboardRow)'
                    : 'Animated Scoreboard Rows'}
                </h3>
                <Badge variant="info">
                  {lang === 'ar' ? 'ترتيب تلقائي + أيقونة +/-' : 'Auto Rank + +/- Icons'}
                </Badge>
              </div>

              <div className="space-y-3">
                {sortedSandbox.map((p, index) => (
                  <ScoreboardRow
                    key={p.id}
                    rank={index + 1}
                    name={localizeText(lang, p.nameEn, p.nameAr)}
                    nickname={localizeText(lang, p.nicknameEn, p.nicknameAr)}
                    avatarSeed={p.avatarSeed}
                    score={p.score}
                    recentDelta={p.lastDelta}
                    gamesPlayed={p.gamesPlayed}
                    wins={p.wins}
                    isHost={p.isHost}
                    isHighlighted={buzzedPlayerId === p.id}
                    statusLabel={
                      p.isHost
                        ? lang === 'ar'
                          ? 'المضيف'
                          : 'THE HOST'
                        : lang === 'ar'
                          ? 'متأهل'
                          : 'FINALIST'
                    }
                    useArabicIndicDigits={useArabicIndic}
                  />
                ))}
              </div>
            </div>

            <Card appearance="sticker" className="flex flex-col justify-between lg:col-span-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-fluid-xl text-red-900">
                    {lang === 'ar'
                      ? 'حلقات المؤقت (Stage · Paper · 5s)'
                      : 'Timer Rings (Stage · Paper · 5s Flash)'}
                  </h3>
                  <Badge variant="negative">≤ 5s White Flash</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {lang === 'ar'
                    ? 'حلقة ذهبية على المسرح وحمراء على الورق، مع نبض وإطار أبيض وامض في آخر ٥ ثوانٍ.'
                    : 'Gold ring on Stage, red ring on Paper, plus pulsing white flash border in the final 5 seconds.'}
                </p>
              </div>

              <div className="my-5 flex flex-wrap items-start justify-around gap-4">
                <div className="flex flex-col items-center gap-2">
                  <TimerRing
                    durationSec={30}
                    remainingSec={timerRemaining}
                    status={timerStatus}
                    surface="paper"
                    size="sm"
                    showControls
                    useArabicIndicDigits={useArabicIndic}
                    onStart={() => setTimerStatus('running')}
                    onPause={() => setTimerStatus('paused')}
                    onReset={() => {
                      setTimerStatus('idle');
                      setTimerRemaining(30);
                    }}
                  />
                  <span className="text-xs font-bold text-ink-muted">
                    {lang === 'ar' ? 'ورق (أحمر)' : 'Paper (Red)'}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 rounded-card border-2 border-outline bg-red-600 p-3 shadow-sticker-sm">
                  <TimerRing
                    durationSec={30}
                    remainingSec={urgentRemaining}
                    status="running"
                    surface="stage"
                    size="sm"
                    useArabicIndicDigits={useArabicIndic}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setUrgentRemaining((prev) => (prev <= 1 ? 5 : prev - 1))
                    }
                  >
                    {lang === 'ar' ? 'اختبار ٥->١ ث' : 'Step 5s → 1s'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <GoldDivider
          ornament="crescent"
          label={
            lang === 'ar'
              ? '٤. شجرة البطولة (BracketNode + المقعد الذهبي)'
              : '4. BRACKET NODES & GOLDEN SEAT BOSS NODE'
          }
        />

        {/* 5. BRACKET NODES */}
        <section className="space-y-6">
          <BracketTrack
            title={
              lang === 'ar'
                ? 'اسحب أفقياً أو كبّر (٤٤ بكسل لمس)'
                : 'Horizontal Pan & Zoom Bracket Track'
            }
          >
            <div className="grid min-w-[260px] grid-cols-1 gap-6 lg:min-w-[820px] lg:grid-cols-3 lg:items-center">
              <BracketNode
                roundLabel={lang === 'ar' ? 'ربع النهائي · طاولة أ' : 'QUARTER-FINAL · TABLE A'}
                tableName={lang === 'ar' ? 'طاولة أ (منتهية)' : 'Table A (Finished)'}
                status="finished"
                useArabicIndicDigits={useArabicIndic}
                players={[
                  {
                    id: 'p1',
                    name: lang === 'ar' ? 'عمر حسن' : 'Omar Hassan',
                    nickname: lang === 'ar' ? 'الثعلب' : 'The Fox',
                    avatarSeed: 'omar',
                    score: 85,
                    isWinner: true,
                    isAdvancing: true,
                  },
                  {
                    id: 'p2',
                    name: lang === 'ar' ? 'يوسف عادل' : 'Youssef Adel',
                    nickname: lang === 'ar' ? 'جو' : 'Joe',
                    avatarSeed: 'joe',
                    score: 60,
                  },
                  {
                    id: 'p3',
                    name: lang === 'ar' ? 'مصطفى جمال' : 'Mostafa Gamal',
                    nickname: lang === 'ar' ? 'توفا' : 'Tofa',
                    avatarSeed: 'tofa',
                    score: 45,
                  },
                ]}
              />

              <BracketNode
                roundLabel={lang === 'ar' ? 'ربع النهائي · طاولة ب' : 'QUARTER-FINAL · TABLE B'}
                tableName={lang === 'ar' ? 'طاولة ب (مباشر الآن)' : 'Table B (Live Now)'}
                status="live"
                useArabicIndicDigits={useArabicIndic}
                players={[
                  {
                    id: 'p4',
                    name: lang === 'ar' ? 'سلمى رضا' : 'Salma Reda',
                    nickname: lang === 'ar' ? 'سلسبيل' : 'Salsabeel',
                    avatarSeed: 'salma',
                    score: 55,
                    isAdvancing: true,
                  },
                  {
                    id: 'p5',
                    name: lang === 'ar' ? 'كريم نبيل' : 'Karim Nabil',
                    nickname: lang === 'ar' ? 'كيه ناب' : 'K-Nab',
                    avatarSeed: 'karim',
                    score: 50,
                  },
                  {
                    id: 'p6',
                    name: lang === 'ar' ? 'أحمد سمير' : 'Ahmed Samir',
                    nickname: lang === 'ar' ? 'سمورة' : 'Sammoora',
                    avatarSeed: 'ahmed',
                    score: 35,
                  },
                ]}
              />

              <BracketNode
                isFinal
                roundLabel={lang === 'ar' ? 'النهائي الكبير · ليلة الحسم' : 'GRAND FINAL · GOLDEN SEAT'}
                tableName={lang === 'ar' ? 'مواجهة مروان سري' : 'Final vs Marwan Serry'}
                status="scheduled"
                useArabicIndicDigits={useArabicIndic}
                players={[
                  {
                    id: 'p-marwan',
                    name: lang === 'ar' ? 'مروان سري' : 'Marwan Serry',
                    nickname: lang === 'ar' ? 'المضيف' : 'The Host',
                    avatarSeed: 'marwan-host',
                    isHost: true,
                  },
                  {
                    id: 'sf-1',
                    name: lang === 'ar' ? 'المتأهل الأول' : 'Finalist #1',
                    isPlaceholder: true,
                  },
                  {
                    id: 'sf-2',
                    name: lang === 'ar' ? 'المتأهل الثاني' : 'Finalist #2',
                    isPlaceholder: true,
                  },
                ]}
              />
            </div>
          </BracketTrack>
        </section>

        <GoldDivider
          ornament="dice"
          label={
            lang === 'ar'
              ? '٥. فيشات الكازينو (الأربعة الكلاسيكية) والشارات والصور الرمزية'
              : '5. CASINO CHIPS (4 CLASSIC + SCORE), BADGES & AVATARS'
          }
        />

        {/* 6. CHIPS, BADGES & AVATARS */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card appearance="sticker" className="space-y-6">
            <div>
              <h3 className="font-display text-fluid-xl text-red-900">
                {lang === 'ar'
                  ? 'فيشات الكازينو (الأحمر والأبيض والأزرق والذهبي + النقاط)'
                  : 'Casino Chips (Red, White, Blue, Gold + Score Chips)'}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'فيشات دائرية بإطار عنابي صلب وحلقة متقطعة، مع علامة +/- دائماً.'
                  : 'Circular chips with dashed inner ring, thick maroon outline, and explicit + / − indicators.'}
              </p>
            </div>

            {/* Classic 4 Chips + Positive/Negative */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <ScoreChip value="01" tone="red" size="md" subtitle="STEP" />
              <ScoreChip value="02" tone="white" size="md" subtitle="STEP" />
              <ScoreChip value="03" tone="blue" size="md" subtitle="INFO" />
              <ScoreChip value="★" tone="gold" size="lg" subtitle="FINAL" />
              <ScoreChip
                value={10}
                tone="positive"
                size="lg"
                showSign
                subtitle="PTS"
                useArabicIndicDigits={useArabicIndic}
                onClick={() => applySandboxDelta(selectedPlayerId, 10)}
              />
              <ScoreChip
                value={-5}
                tone="negative"
                size="md"
                showSign
                subtitle="PEN"
                useArabicIndicDigits={useArabicIndic}
                onClick={() => applySandboxDelta(selectedPlayerId, -5)}
              />
            </div>

            <div className="space-y-3 border-t border-border-paper pt-4">
              <span className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar' ? 'الشارات وحالات الفقرات' : 'Status & Category Badges'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <LiveBadge surface="paper" size="sm" />
                <LiveBadge surface="stage" size="sm" />
                <Badge variant="gold">★ Winner Gold</Badge>
                <Badge variant="upcoming">Upcoming Blue</Badge>
                <Badge variant="muted">Finished Neutral</Badge>
                <Badge variant="positive">
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  <span>+10 Added</span>
                </Badge>
                <Badge variant="negative">
                  <Minus className="h-3.5 w-3.5 stroke-[3]" />
                  <span>−5 Deducted</span>
                </Badge>
                <Badge variant="red">Music Segment</Badge>
                <Badge variant="white">Wordplay</Badge>
              </div>
            </div>
          </Card>

          <Card appearance="sticker" className="space-y-6">
            <div>
              <h3 className="font-display text-fluid-xl text-red-900">
                {lang === 'ar'
                  ? 'الصور الرمزية الهندسية المولّدة (بدون صور أشخاص)'
                  : 'Generated Geometric Avatars (No Real Photos)'}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'حلقات سميكة بألوان الهوية الجديدة وحالة التحديد بالحلقة الزرقاء وحالة الجرس بالحلقة الذهبية.'
                  : 'Deterministic SVG patterns in brand red/maroon/blue/gold rings. Selected = blue ring; Buzzed = gold ring.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <PlayerAvatar
                  name="Marwan Serry"
                  avatarSeed="marwan"
                  size="xl"
                  isHost
                  rank={1}
                />
                <span className="text-xs font-extrabold text-red-900">
                  Marwan (Host)
                </span>
              </div>

              {(seededPlayers.length > 0
                ? seededPlayers.filter((p) => !p.isHost).slice(0, 5)
                : [
                    { id: '1', fullName: 'Omar Hassan', avatarSeed: 'seed-0' },
                    { id: '2', fullName: 'Youssef Adel', avatarSeed: 'seed-1' },
                    { id: '3', fullName: 'Salma Reda', avatarSeed: 'seed-2' },
                    { id: '4', fullName: 'Karim Nabil', avatarSeed: 'seed-3' },
                    { id: '5', fullName: 'Mariam Hatem', avatarSeed: 'seed-4' },
                  ]
              ).map((p, idx) => (
                <div key={p.id} className="flex flex-col items-center gap-1.5">
                  <PlayerAvatar
                    name={p.fullName}
                    avatarSeed={p.avatarSeed}
                    size={idx === 0 ? 'lg' : 'md'}
                    buzzed={idx === 0}
                    selected={idx === 1}
                    rank={idx + 2}
                  />
                  <span className="max-w-[84px] truncate text-xs font-semibold text-ink-muted">
                    {p.fullName.split(' ')[0]}
                    {idx === 0 ? ' (Buzz)' : idx === 1 ? ' (Blue)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <GoldDivider
          ornament="suits"
          label={
            lang === 'ar'
              ? '٦. الأزرار والبطاقات والنماذج والنوافذ المنبثقة'
              : '6. BUTTONS, CARDS, FORMS (BLUE FOCUS) & DIALOGS'
          }
        />

        {/* 7. BUTTONS & CARDS */}
        <section className="space-y-8">
          <Card appearance="sticker" className="space-y-6">
            <div>
              <h3 className="font-display text-fluid-xl text-red-900">
                {lang === 'ar'
                  ? 'الأزرار (١٤ بكسل · ظل ستيكر · هبوط عند الضغط)'
                  : 'Buttons (14px Radius · Blue Focus Ring · Tactile Pressed-Sink)'}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'اضغط مع الاستمرار على أي زر لمشاهدة هبوط الزر وتلاشي الظل الصلب، وتنقل بـ Tab لمشاهدة حلقة التركيز الزرقاء.'
                  : 'Press and hold any button to feel the shadow collapse; tab through for the 3px electric blue focus ring with 2px white offset.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="gold">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{lang === 'ar' ? 'ذهبي (Stage)' : 'Gold Stage Primary'}</span>
              </Button>
              <Button variant="red">
                <Crown className="h-4 w-4 shrink-0" />
                <span>{lang === 'ar' ? 'أحمر (Paper)' : 'Red Paper Primary'}</span>
              </Button>
              <Button variant="secondary">
                <span>{lang === 'ar' ? 'ثانوي أبيض' : 'Secondary White'}</span>
              </Button>
              <Button variant="info">
                <span>{lang === 'ar' ? 'أزرق معلومات' : 'Info Blue'}</span>
              </Button>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>{lang === 'ar' ? 'حذف عنابي' : 'Destructive Maroon'}</span>
              </Button>
              <Button variant="destructiveSolid">
                <Flame className="h-4 w-4 shrink-0" />
                <span>{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </Button>
              <Button variant="ghost">
                <span>{lang === 'ar' ? 'زر خفيف' : 'Ghost'}</span>
              </Button>
              <Button variant="red" disabled>
                <span>{lang === 'ar' ? 'معطّل' : 'Disabled'}</span>
              </Button>
            </div>

            <div className="space-y-3 border-t border-border-paper pt-4">
              <span className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar'
                  ? 'المقاسات (≥ 44px للجميع، ≥ 56px للوحة الحكم)'
                  : 'Sizes (44px+ Standard, 56px+ Scorer Console)'}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm">
                  Small (44px)
                </Button>
                <Button variant="secondary" size="md">
                  Medium (44px)
                </Button>
                <Button variant="secondary" size="lg">
                  Large (48px)
                </Button>
                <Button variant="gold" size="scorer" className="w-full sm:w-auto">
                  <Zap className="h-5 w-5 shrink-0 fill-current" />
                  <span>
                    {lang === 'ar'
                      ? 'زر لوحة الحكم الكبير (56px+)'
                      : 'Scorer Console Action (56px+)'}
                  </span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Calm vs Premium Marquee Ribbon Card */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card appearance="calm">
              <CardHeader>
                <Badge variant="muted" className="w-fit">
                  CALM PAPER CARD
                </Badge>
                <CardTitle>
                  {lang === 'ar'
                    ? 'بطاقة هادئة للإدارة والبيانات'
                    : 'Calm Paper Card (Admin & Reading)'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ar'
                    ? 'نصف قطر ٢٠ بكسل، حدود رقيقة بلون --border-paper وظل ناعم، لتسهيل القراءة الطويلة.'
                    : '20px corner radius, 1px --border-paper, and --shadow-soft for dense tables and editorial pages.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink">
                  {lang === 'ar'
                    ? 'محتوى واضح بخط Cairo وحجم خط مريح للعين.'
                    : 'Crisp --ink typography with high contrast on white surface.'}
                </p>
              </CardContent>
              <CardFooter>
                <span className="text-xs font-semibold text-ink-muted">Calm surface</span>
                <Button variant="red" size="sm">
                  {lang === 'ar' ? 'فتح' : 'Open'}
                </Button>
              </CardFooter>
            </Card>

            <Card
              premium
              marquee="perimeter"
              bulbCount={12}
              ribbonLabel={lang === 'ar' ? '★ المقعد الذهبي' : '★ GOLDEN SEAT'}
            >
              <CardHeader className="pt-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="gold">PREMIUM MARQUEE CARD</Badge>
                  <CrescentStar size="sm" glow />
                </div>
                <CardTitle>
                  {lang === 'ar'
                    ? 'بطاقة النهائي بإضاءة المسرح وشريط ذهبي'
                    : 'Premium Marquee Card with Gold Ribbon'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ar'
                    ? 'مصابيح متتابعة حول الإطار وشريط زاوية ذهبي لليلة النهائي ومواجهة مروان سري.'
                    : 'Warm chasing marquee bulbs and gold corner ribbon for Marwan Serry’s Final Night.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MarqueeBulbs variant="strip" bulbCount={12} />
              </CardContent>
              <CardFooter>
                <span className="text-xs font-bold text-red-800">
                  Respects prefers-reduced-motion
                </span>
                <Button variant="gold" size="sm">
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span>{lang === 'ar' ? 'المقعد الذهبي' : 'Golden Seat'}</span>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* 8. FORMS (BLUE FOCUS), DIALOGS & TOASTS */}
        <section className="grid gap-6 lg:grid-cols-12">
          <Card appearance="calm" className="space-y-5 lg:col-span-7">
            <div>
              <h3 className="font-display text-fluid-xl text-red-900">
                {lang === 'ar'
                  ? 'حقول النماذج (إطار أزرق عند التركيز + خط 16px+)'
                  : 'Forms (White Inputs · Electric Blue Focus Ring · 16px+ Font)'}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'خلفية بيضاء وحدود ٢ بكسل تتحول إلى الأزرق الكهربائي عند التركيز مع أيقونة خطأ واضحة.'
                  : 'White inputs, 2px --border-paper turning electric blue on focus, and inline validation with AlertCircle icon.'}
              </p>
            </div>

            <FormGrid columns={2}>
              <Input
                label={lang === 'ar' ? 'نقاط مخصصة' : 'Custom Points Delta'}
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
                helperText={
                  lang === 'ar'
                    ? 'اضغط داخل الحقل لرؤية التركيز الأزرق'
                    : 'Focus this input to verify the blue ring'
                }
              />

              <SelectField
                label={lang === 'ar' ? 'فئة الفقرة' : 'Segment Category'}
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                helperText="Radix Select in Paper theme"
                options={[
                  {
                    value: 'music',
                    label: lang === 'ar' ? 'موسيقى وغناء' : 'Music & Singing',
                  },
                  {
                    value: 'wordplay',
                    label: lang === 'ar' ? 'لعب بالكلمات وسرعة' : 'Wordplay & Speed',
                  },
                  {
                    value: 'popculture',
                    label: lang === 'ar' ? 'سينما وثقافة شعبية' : 'Cinema & Pop Culture',
                  },
                  {
                    value: 'general',
                    label: lang === 'ar' ? 'معلومات عامة' : 'General Knowledge',
                  },
                ]}
              />
            </FormGrid>

            <Input
              label={lang === 'ar' ? 'حالة خطأ التحقق' : 'Inline Validation Error State'}
              defaultValue="invalid-delta"
              error={
                lang === 'ar'
                  ? 'يجب إدخال رقم صحيح للنقاط قبل الاعتماد.'
                  : 'Please enter a valid numeric point delta before applying.'
              }
            />

            <Textarea
              label={lang === 'ar' ? 'ملاحظة الحكم الاختيارية' : 'Scorer Audit Note'}
              value={scorerNote}
              onChange={(e) => setScorerNote(e.target.value)}
              helperText="Recorded on ScoreEvent & AuditEntry."
            />
          </Card>

          <Card appearance="sticker" className="flex flex-col justify-between space-y-6 lg:col-span-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-fluid-xl text-red-900">
                  {lang === 'ar'
                    ? 'النوافذ الحوارية والتنبيهات (Sticker Outline)'
                    : 'Sticker Dialogs (Bottom Sheet on Phones) & Toasts'}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {lang === 'ar'
                    ? 'سطح أبيض بإطار ستيكر صلب ولوحة سفلية على الهواتف، مع تأكيد صريح للإجراءات الخطرة.'
                    : 'White surface, thick maroon sticker border, bottom sheet on <640px phones, explicit confirm for destructive actions.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full xs:w-auto">
                      <Wand2 className="h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        {lang === 'ar' ? 'فتح نافذة قياسية' : 'Open Sticker Dialog'}
                      </span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {lang === 'ar'
                          ? 'فتح فقرة الحسم وكسر التعادل'
                          : 'Open Tie-Breaker Segment'}
                      </DialogTitle>
                      <DialogDescription>
                        {lang === 'ar'
                          ? 'يوجد تعادل في النقاط المؤهلة على هذه الطاولة. هل ترغب في إلحاق الفقرة رقم ١٦ الآن؟'
                          : 'A qualifying tie exists across the advancement cutoff. Append Segment #16 (Tie-Breaker Challenge) now?'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-input border-2 border-outline bg-paper-2 p-4 text-xs font-bold text-red-900">
                      {lang === 'ar'
                        ? 'الفقرة ١٦: جولة التحدي / الحسم — نقاط مقترحة: +10 / −5'
                        : 'Segment #16: Tie-Breaker & Penalty Challenge — Presets: +10 / −5'}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="secondary">
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="red"
                          onClick={() =>
                            toast({
                              variant: 'gold',
                              title:
                                lang === 'ar'
                                  ? 'تم فتح جولة الحسم'
                                  : 'Tie-Breaker Segment Opened',
                            })
                          }
                        >
                          {lang === 'ar' ? 'بدء جولة الحسم' : 'Start Tie-Breaker'}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <ConfirmDialog
                  destructive
                  trigger={
                    <Button variant="destructive" className="w-full xs:w-auto">
                      <RotateCcw className="h-4 w-4 shrink-0" />
                      <span>
                        {lang === 'ar' ? 'تأكيد خطر' : 'Destructive Confirm'}
                      </span>
                    </Button>
                  }
                  title={
                    lang === 'ar'
                      ? 'إعادة ضبط بيانات البطولة التجريبية؟'
                      : 'Reset All Tournament Demo Data?'
                  }
                  description={
                    lang === 'ar'
                      ? 'سيؤدي هذا الإجراء إلى مسح التعديلات المحلية واستعادة حالة البطولة الافتراضية.'
                      : 'This restores all 27 players, 14 games, and score events to their seeded state.'
                  }
                  confirmLabel={
                    lang === 'ar' ? 'نعم، إعادة الضبط الآن' : 'Yes, Reset Demo Data'
                  }
                  cancelLabel={lang === 'ar' ? 'تراجع' : 'Cancel'}
                  onConfirm={() =>
                    toast({
                      variant: 'negative',
                      title:
                        lang === 'ar'
                          ? 'تم تنفيذ إعادة الضبط'
                          : 'Destructive Action Confirmed',
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border-paper pt-4">
              <span className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar' ? 'تجربة التنبيهات الفورية' : 'Trigger Toast Variants'}
              </span>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'gold',
                      title: lang === 'ar' ? 'تنبيه ذهبي' : 'Gold Show Notice',
                      description: 'Segment 4 of 6 is live on Table B.',
                    })
                  }
                >
                  <Bell className="h-3.5 w-3.5 shrink-0 text-gold-600" />
                  <span>Gold Toast</span>
                </Button>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'positive',
                      title: lang === 'ar' ? '+١٠ نقاط مضافة' : '+10 Points Recorded',
                      description: 'Synced via BroadcastChannel.',
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-positive-ink" />
                  <span>+Positive Toast</span>
                </Button>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'negative',
                      title: lang === 'ar' ? '−٥ نقاط خصم' : '−5 Penalty Applied',
                      description: 'Incorrect buzz response.',
                    })
                  }
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-negative" />
                  <span>−Negative Toast</span>
                </Button>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'info',
                      title: lang === 'ar' ? 'حضور مسجّل' : 'Player Checked In',
                      description: 'Gate staff confirmed readiness.',
                    })
                  }
                >
                  <span>Blue Info Toast</span>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <GoldDivider
          ornament="crescent"
          label={
            lang === 'ar'
              ? '٧. الجداول الورقية المتجاوبة وحالة الفراغ بالزهر والكروت'
              : '7. PAPER DATA TABLE, DICE EMPTY STATE & SKELETONS'
          }
        />

        {/* 9. PAPER DATA TABLE, DICE EMPTY STATE & SKELETONS */}
        <section className="space-y-6">
          <Tabs defaultValue="table">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="table">
                  <Layers className="h-4 w-4 shrink-0" />
                  <span>
                    {lang === 'ar' ? 'جدول البيانات الورقي' : 'Paper DataTable'}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="empty">
                  <span>
                    {lang === 'ar' ? 'حالة الفراغ (زهر وكروت)' : 'Dice & Card EmptyState'}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="skeletons">
                  <span>
                    {lang === 'ar' ? 'هياكل التحميل' : 'Paper Skeletons'}
                  </span>
                </TabsTrigger>
              </TabsList>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTableEmpty((prev) => !prev)}
              >
                {showTableEmpty
                  ? lang === 'ar'
                    ? 'إظهار الصفوف (٨ فقرات)'
                    : 'Populate Rows'
                  : lang === 'ar'
                    ? 'معاينة الجدول الفارغ'
                    : 'Simulate Empty Table'}
              </Button>
            </div>

            <TabsContent value="table" className="mt-6">
              <DataTable
                data={showTableEmpty ? [] : visibleSegments}
                getRowKey={(seg) => seg.id}
                searchPlaceholder={
                  lang === 'ar'
                    ? 'ابحث في فقرات البرنامج...'
                    : 'Search show segments by title or category...'
                }
                searchFilter={(seg, q) =>
                  seg.nameEn.toLowerCase().includes(q) ||
                  seg.nameAr.toLowerCase().includes(q) ||
                  seg.category.toLowerCase().includes(q)
                }
                filterLabel={lang === 'ar' ? 'تصفية الفئة' : 'Filter Category'}
                filterSlot={
                  <div className="w-full md:w-52">
                    <SelectField
                      value={tableCategoryFilter}
                      onValueChange={setTableCategoryFilter}
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      options={[
                        {
                          value: 'all',
                          label: lang === 'ar' ? 'جميع الفئات' : 'All Categories',
                        },
                        {
                          value: 'music',
                          label: lang === 'ar' ? 'موسيقى وغناء' : 'Music & Singing',
                        },
                        {
                          value: 'wordplay',
                          label: lang === 'ar' ? 'كلمات وسرعة' : 'Wordplay & Speed',
                        },
                      ]}
                    />
                  </div>
                }
                emptyTitle={
                  lang === 'ar'
                    ? 'لا توجد فقرات مطابقة للبحث'
                    : 'No Matching Show Segments'
                }
                emptyDescription={
                  lang === 'ar'
                    ? 'جرّب مسح التصفية أو الضغط على إظهار الصفوف.'
                    : 'Clear the search filter or click "Populate Rows" above.'
                }
                columns={[
                  {
                    key: 'order',
                    header: '#',
                    sortable: true,
                    mobileRole: 'badge',
                    sortAccessor: (seg) => seg.order,
                    render: (seg) => (
                      <ScoreChip
                        value={seg.order}
                        tone="gold"
                        size="sm"
                        useArabicIndicDigits={useArabicIndic}
                      />
                    ),
                  },
                  {
                    key: 'nameEn',
                    header:
                      lang === 'ar' ? 'اسم الفقرة (EN / AR)' : 'Segment Title (EN / AR)',
                    sortable: true,
                    mobileRole: 'title',
                    sortAccessor: (seg) => seg.nameEn,
                    render: (seg) => (
                      <div className="min-w-[150px]">
                        <div className="font-bold text-ink">
                          {localizeText(lang, seg.nameEn, seg.nameAr)}
                        </div>
                        <div className="text-xs text-ink-muted">
                          {lang === 'ar' ? seg.nameEn : seg.nameAr}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'category',
                    header: lang === 'ar' ? 'الفئة' : 'Category',
                    sortable: true,
                    sortAccessor: (seg) => seg.category,
                    render: (seg) => (
                      <Badge
                        variant={
                          seg.category === 'music'
                            ? 'red'
                            : seg.category === 'wordplay'
                              ? 'gold'
                              : 'info'
                        }
                        className="uppercase"
                      >
                        {seg.category}
                      </Badge>
                    ),
                  },
                  {
                    key: 'presets',
                    header: lang === 'ar' ? 'النقاط المسبقة' : 'Preset Points',
                    render: (seg) => (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {seg.presetPoints.map((pt) => (
                          <Badge
                            key={pt}
                            variant={pt > 0 ? 'positive' : 'negative'}
                            className="tabular-nums"
                          >
                            {pt > 0 ? (
                              <Plus className="h-3 w-3 stroke-[3]" />
                            ) : (
                              <Minus className="h-3 w-3 stroke-[3]" />
                            )}
                            <span>{Math.abs(pt)}</span>
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </TabsContent>

            <TabsContent value="empty" className="mt-6">
              <EmptyState
                title={
                  lang === 'ar'
                    ? 'لم تبدأ أي مباراة في هذه الجولة بعد'
                    : 'No Active Games in This Round Yet'
                }
                description={
                  lang === 'ar'
                    ? 'بمجرد أن يبدأ حكم الطاولة الجلسة ستظهر النتائج المباشرة هنا تلقائياً.'
                    : 'Once a table scorer starts a session, live standings and events appear right here.'
                }
                action={
                  <Button
                    variant="red"
                    size="sm"
                    onClick={() =>
                      toast({
                        variant: 'gold',
                        title:
                          lang === 'ar'
                            ? 'تم تشغيل الجلسة التجريبية'
                            : 'EmptyState Action Triggered',
                      })
                    }
                  >
                    <Play className="h-4 w-4 shrink-0 fill-current" />
                    <span>
                      {lang === 'ar' ? 'تشغيل مباراة تجريبية' : 'Launch Demo Session'}
                    </span>
                  </Button>
                }
              />
            </TabsContent>

            <TabsContent value="skeletons" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                <PlayerPanelSkeleton />
                <PlayerPanelSkeleton />
                <PlayerPanelSkeleton />
              </div>
              <div className="overflow-hidden rounded-card border border-border-paper">
                <TableRowSkeleton columns={4} />
                <TableRowSkeleton columns={4} />
                <TableRowSkeleton columns={4} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton shape="pill" className="h-12 w-12 shrink-0" />
                <Skeleton className="h-11 w-full max-w-[12rem]" />
                <Skeleton shape="card" className="h-16 min-w-[140px] flex-1" />
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>

      {/* 10. ORIGINAL SIGNATURE MOTIFS SHOWCASE (STAGE BAND) */}
      <div className="mt-14">
        <StageDivider variant="scallop" from="paper" to="stage" />
        <SunburstStage as="section" className="py-section-y">
          <div className="mx-auto max-w-content-wide 3xl:max-w-stage space-y-10 px-safe">
            <SectionHeading
              size="lg"
              align="center"
              surface="stage"
              eyebrow={
                lang === 'ar'
                  ? '٨. الزخارف الأصلية (SVG/CSS مبتكرة ١٠٠٪)'
                  : '8. ORIGINAL SIGNATURE MOTIFS GALLERY'
              }
              title={
                lang === 'ar'
                  ? 'النرد، الكروت، الفيشات، الدوامات والزخارف الرمضانية'
                  : 'Dice, Cards, Chips, Swirls, Confetti & Ramadan Accents'
              }
              goldKeyword={lang === 'ar' ? 'الفيشات' : 'Chips, Swirls,'}
              subtitle={
                lang === 'ar'
                  ? 'رسوم فيكتور أصلية بالكامل بحدود عنابية سميكة دون أي نسخ لشعارات أو رسومات من البرنامج الحقيقي.'
                  : '100% original SVG/CSS game-show stickers with thick maroon outlines, keeping lanterns & crescent as a warm secondary accent.'
              }
            />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {/* Dice + Cards */}
              <Card appearance="sticker" className="flex flex-col items-center justify-between text-center">
                <Badge variant="gold">DICE & PLAYING CARDS</Badge>
                <div className="my-6 flex items-center justify-center gap-4">
                  <PlayingDice value={5} size="lg" tilt={-10} float />
                  <PlayingCardFan float />
                </div>
                <p className="text-xs font-medium text-ink-muted">
                  Original sticker-outlined dice & game-show cards (zero gambling motifs).
                </p>
              </Card>

              {/* Classic 4 Chips */}
              <Card appearance="sticker" className="flex flex-col items-center justify-between text-center">
                <Badge variant="red">4 CLASSIC CASINO CHIPS</Badge>
                <div className="my-6 grid grid-cols-2 gap-3">
                  <ScoreChip value="R" tone="red" size="md" subtitle="RED" />
                  <ScoreChip value="W" tone="white" size="md" subtitle="WHITE" />
                  <ScoreChip value="B" tone="blue" size="md" subtitle="BLUE" />
                  <ScoreChip value="G" tone="gold" size="md" subtitle="GOLD" />
                </div>
                <p className="text-xs font-medium text-ink-muted">
                  Red, White, Blue (white-buffered) & Gold chips for steps & scores.
                </p>
              </Card>

              {/* Swirls & Confetti */}
              <Card appearance="sticker" className="flex flex-col items-center justify-between text-center">
                <Badge variant="info">SWIRLS & CONFETTI</Badge>
                <div className="my-5 flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center justify-center gap-4">
                    <SwirlOrnament tone="gold" size="lg" />
                    <SwirlOrnament tone="maroon" size="lg" flip />
                  </div>
                  <ConfettiShapes variant="paper" className="h-12 w-full" />
                </div>
                <p className="text-xs font-medium text-ink-muted">
                  Spiral doodles, 4-point sparks & confetti ribbons in brand colors.
                </p>
              </Card>

              {/* Subtle Secondary Ramadan Accents */}
              <Card appearance="sticker" className="flex flex-col items-center justify-between text-center">
                <Badge variant="white">SECONDARY RAMADAN ACCENT</Badge>
                <div className="my-4 flex items-end justify-center gap-4">
                  <Lantern size="sm" chainLength={8} />
                  <CrescentStar size="xl" glow />
                  <Lantern size="md" chainLength={6} />
                </div>
                <p className="text-xs font-medium text-ink-muted">
                  Subtle Fanous & Crescent Star accents in warm gold & maroon outline.
                </p>
              </Card>
            </div>
          </div>
        </SunburstStage>
      </div>
    </div>
  );
}
