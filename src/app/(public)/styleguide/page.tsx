'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Flame,
  Globe,
  Hash,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { playerRepo, segmentRepo, settingsRepo } from '@/lib/repos';
import type { Player, Segment } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
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
  Input,
  PlayerPanelSkeleton,
  SelectField,
  Skeleton,
  TableRowSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@/components/ui';
import {
  ArabesqueBackground,
  CrescentStar,
  GoldDivider,
  Lantern,
  LanternCluster,
  LiveBadge,
  MarqueeBulbs,
  PlayerAvatar,
  PlayerPanel,
  ScoreboardRow,
  ScoreChip,
  SectionHeading,
  Spotlight,
  TimerRing,
} from '@/components/brand';

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

  // Timer states for normal & urgent demonstration
  const [timerRemaining, setTimerRemaining] = useState<number>(24);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>(
    'running'
  );
  const [urgentRemaining, setUrgentRemaining] = useState<number>(4);

  // Form states
  const [customPoints, setCustomPoints] = useState<string>('15');
  const [selectedCategory, setSelectedCategory] = useState<string>('music');
  const [scorerNote, setScorerNote] = useState<string>(
    'Guessed the reversed Amr Diab chorus in 3 seconds!'
  );
  const [showTableEmpty, setShowTableEmpty] = useState<boolean>(false);

  // Loaded from repos (zero direct seed imports per AGENTS.md §6)
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
      setSegments(allSegments.slice(0, 6));
      setUseArabicIndic(settings.useArabicIndicDigits);
    };
    loadFromRepos();
    return () => {
      mounted = false;
    };
  }, []);

  // Countdown tick for live timer ring when running
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
          ? `${delta > 0 ? `+${delta}` : delta} نقطة لـ ${targetName}`
          : `${delta > 0 ? `+${delta}` : delta} pts applied to ${targetName}`,
      description:
        lang === 'ar'
          ? 'تم تحديث لوحة الصدارة والعداد المتحرك فوراً.'
          : 'Animated counter and delta flash triggered immediately.',
    });
  };

  const sortedSandbox = [...sandboxPlayers].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Styleguide Inspector & Direction Switcher Bar */}
      <div className="sticky top-16 sm:top-20 z-40 border-b border-border-strong bg-bg-raised/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <ScoreChip value="P2" size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold text-gold-gradient">
                  {lang === 'ar'
                    ? 'دليل نظام التصميم — ليالي كازينو رمضان'
                    : 'Ramadan Casino Night — Design System & Styleguide'}
                </span>
                <Badge variant="gold" className="hidden sm:inline-flex">
                  DESIGN.md v2.0
                </Badge>
              </div>
              <p className="text-xs text-text-muted">
                {lang === 'ar'
                  ? 'جميع المكونات في /components/ui و /components/brand (يدعم العربية RTL والإنجليزية LTR)'
                  : 'Complete component library in /components/ui & /components/brand (EN/LTR + AR/RTL verified)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Explicit EN (LTR) / AR (RTL) Switcher */}
            <div
              role="group"
              aria-label="Language & Direction Mode"
              className="inline-flex rounded-pill border border-border-strong bg-surface p-0.5"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-pill px-3 py-1 text-xs font-semibold transition-all ${
                  lang === 'en'
                    ? 'bg-gold-gradient text-bg shadow-glow-gold'
                    : 'text-text-muted hover:text-ivory'
                }`}
              >
                EN · LTR
              </button>
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`rounded-pill px-3 py-1 text-xs font-semibold transition-all ${
                  lang === 'ar'
                    ? 'bg-gold-gradient text-bg shadow-glow-gold'
                    : 'text-text-muted hover:text-ivory'
                }`}
              >
                عربي · RTL
              </button>
            </div>

            {/* Western vs Arabic-Indic Digits Toggle */}
            <button
              type="button"
              onClick={() => setUseArabicIndic((prev) => !prev)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors ${
                useArabicIndic
                  ? 'border-gold-500 bg-gold-500/20 text-gold-100'
                  : 'border-border bg-surface text-text-muted hover:text-ivory'
              }`}
            >
              <Hash className="h-3.5 w-3.5 text-gold-500" />
              <span>{useArabicIndic ? '١٢٣ (هندي)' : '123 (Western)'}</span>
            </button>

            {/* Dual EN/AR Specimen Card Toggle */}
            <button
              type="button"
              onClick={() => setBilingualPreview((prev) => !prev)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors ${
                bilingualPreview
                  ? 'border-gold-500 bg-gold-500/20 text-gold-100'
                  : 'border-border bg-surface text-text-muted hover:text-ivory'
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-gold-500" />
              <span>
                {lang === 'ar'
                  ? 'معاينة ثنائية (EN + AR)'
                  : 'Dual EN/AR Specimen'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. HERO SHOWCASE: Spotlight + ArabesqueBackground + Lanterns + SectionHeading + MarqueeBulbs */}
      <Spotlight intensity="dramatic" beams="triple" className="border-b border-border">
        <ArabesqueBackground className="py-12 md:py-16">
          <div className="mx-auto max-w-content space-y-10 px-4 md:px-6">
            {/* Hanging Lanterns Row */}
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
              <LanternCluster />
              <div className="flex flex-col items-center gap-2 sm:pt-4">
                <LiveBadge
                  size="lg"
                  label={
                    lang === 'ar'
                      ? 'مباشر · استوديو كازينو الألعاب'
                      : 'LIVE · CASINO EL AL3AB STUDIO'
                  }
                />
              </div>
              <LanternCluster className="hidden sm:inline-flex" />
            </div>

            {/* SectionHeading in active language */}
            <SectionHeading
              as="h1"
              size="xl"
              align="center"
              eyebrow={
                lang === 'ar'
                  ? 'المرحلة الثانية · نظام التصميم المتكامل'
                  : 'PHASE 2 · COMPLETE DESIGN SYSTEM'
              }
              title={
                lang === 'ar'
                  ? 'ليلة رمضانية فاخرة داخل كازينو الألعاب'
                  : 'A Luxurious Ramadan Night Inside The Casino'
              }
              goldKeyword={lang === 'ar' ? 'كازينو الألعاب' : 'Casino'}
              subtitle={
                lang === 'ar'
                  ? 'تم بناء جميع المكونات بدقة وفق ملف DESIGN.md: أزرار الحكم، البطاقات المضيئة، الفوانيس المتحركة، عدادات النقاط، وحلقات المؤقت.'
                  : 'Every UI and Brand primitive crafted to DESIGN.md: midnight depths, precious gold gradients, swaying lanterns, poker chips, and broadcast scoreboards.'
              }
            />

            {/* Side-by-Side EN (LTR) & AR (RTL) Typography & Heading Specimen */}
            {bilingualPreview && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card dir="ltr" lang="en" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="gold">ENGLISH · LTR SPECIMEN</Badge>
                    <span className="text-xs text-text-muted">
                      Cormorant Garamond + Bebas Neue + Inter
                    </span>
                  </div>
                  <SectionHeading
                    size="md"
                    eyebrow="FINAL NIGHT SHOWCASE"
                    title="Two Finalists. One Marwan Serry."
                    goldKeyword="Marwan Serry."
                    subtitle="Tabular score counters, 14px button radius, 20px card radius, and 1px gold-tinted borders."
                  />
                </Card>

                <Card dir="rtl" lang="ar" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="gold">العربية · نموذج RTL</Badge>
                    <span className="text-xs text-text-muted">
                      Reem Kufi + Cairo (Tabular)
                    </span>
                  </div>
                  <SectionHeading
                    size="md"
                    eyebrow="عرض ليلة النهائي الكبرى"
                    title="متأهلان اثنان في مواجهة مروان سري"
                    goldKeyword="مروان سري"
                    subtitle="تصميم ثنائي اللغة أصيل يدعم الاتجاه من اليمين لليسار مع تباين ألوان يتجاوز معيار WCAG AA."
                  />
                </Card>
              </div>
            )}

            <GoldDivider
              ornament="suits"
              label={
                lang === 'ar'
                  ? '١. محاكي الطاولة المباشرة (PlayerPanel + ScoreboardRow + TimerRing)'
                  : '1. LIVE BROADCAST TABLE SANDBOX'
              }
            />
          </div>
        </ArabesqueBackground>
      </Spotlight>

      <div className="mx-auto max-w-content space-y-16 px-4 pt-12 md:px-6">
        {/* 2. PLAYER PANELS, SCOREBOARD ROWS, SCORE CHIPS & TIMER RING */}
        <section className="space-y-8" aria-labelledby="section-game-components">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              id="section-game-components"
              size="md"
              eyebrow={
                lang === 'ar'
                  ? 'مكونات برنامج المسابقات'
                  : 'GAME-SHOW BROADCAST COMPONENTS'
              }
              title={
                lang === 'ar'
                  ? 'لوحات اللاعبين ولوحة الصدارة والمؤقت'
                  : 'Player Panels, Scoreboard & Timer Ring'
              }
              goldKeyword={lang === 'ar' ? 'الصدارة' : 'Scoreboard'}
              subtitle={
                lang === 'ar'
                  ? 'اضغط على أزرار النقاط (+10، +5، -5) أو زر الجرس لمشاهدة الحركة الفورية وتبديل المراكز.'
                  : 'Tap any preset point button (+10, +5, -5) or "Buzzed First" target below to test animated counters, delta flashes, and rank reordering.'
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => applySandboxDelta(buzzedPlayerId, 10)}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {lang === 'ar'
                    ? '+١٠ للاعب الضاغط'
                    : '+10 pts to Buzzed Player'}
                </span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => applySandboxDelta(buzzedPlayerId, -5)}
              >
                <span>
                  {lang === 'ar'
                    ? '-٥ عقوبة للاعب الضاغط'
                    : '-5 Penalty to Buzzed'}
                </span>
              </Button>
            </div>
          </div>

          {/* 3-Player Panel Grid (Final Night Preview: 2 Finalists + Marwan Serry Boss Seat) */}
          <div className="grid gap-6 lg:grid-cols-3">
            {sandboxPlayers.map((p) => {
              const rank =
                sortedSandbox.findIndex((item) => item.id === p.id) + 1;
              const isBuzzed = buzzedPlayerId === p.id;
              const isSelected = selectedPlayerId === p.id;

              return (
                <PlayerPanel
                  key={p.id}
                  playerId={p.id}
                  name={localizeText(lang, p.nameEn, p.nameAr)}
                  nickname={localizeText(lang, p.nicknameEn, p.nicknameAr)}
                  avatarSeed={p.avatarSeed}
                  score={p.score}
                  rank={rank}
                  isBuzzed={isBuzzed}
                  isSelected={isSelected}
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
                      description:
                        lang === 'ar'
                          ? 'تم تفعيل الحلقة الذهبية المضيئة.'
                          : 'Pulsing gold ring activated on PlayerPanel.',
                    });
                  }}
                  onApplyPreset={(pts) => applySandboxDelta(p.id, pts)}
                />
              );
            })}
          </div>

          {/* ScoreboardRow + TimerRing Showcase */}
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Live Reordering Scoreboard Rows */}
            <div className="space-y-4 lg:col-span-7">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-gold-100">
                  {lang === 'ar'
                    ? 'صفوف لوحة الصدارة (ScoreboardRow)'
                    : 'Animated Scoreboard Rows (ScoreboardRow)'}
                </h3>
                <Badge variant="gold">
                  {lang === 'ar'
                    ? 'ترتيب تلقائي + وميض النقاط'
                    : 'Layout Reorder + Delta Flash'}
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
                          : 'THE BOSS'
                        : lang === 'ar'
                          ? 'متأهل للنهائي'
                          : 'FINALIST'
                    }
                    useArabicIndicDigits={useArabicIndic}
                  />
                ))}
              </div>
            </div>

            {/* TimerRing Showcase (Standard Gold + Last-5-Seconds Ruby Pulse) */}
            <Card premium className="flex flex-col justify-between lg:col-span-5">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-bold text-gold-100">
                    {lang === 'ar'
                      ? 'حلقة المؤقت (TimerRing)'
                      : 'Segment Timer Ring (TimerRing)'}
                  </h3>
                  <Badge variant="negative">
                    {lang === 'ar' ? 'نبض ياقوتي بآخر ٥ ثوانٍ' : 'Ruby Pulse ≤ 5s'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {lang === 'ar'
                    ? 'حلقة تقدم ذهبية تتحول إلى اللون الياقوتي وتنبض في آخر ٥ ثوانٍ.'
                    : 'Circular gold progress ring; turns casino ruby and pulses in the final 5 seconds.'}
                </p>
              </div>

              <div className="my-6 flex flex-wrap items-center justify-around gap-6">
                <div className="flex flex-col items-center gap-2">
                  <TimerRing
                    durationSec={30}
                    remainingSec={timerRemaining}
                    status={timerStatus}
                    size="md"
                    showControls
                    useArabicIndicDigits={useArabicIndic}
                    onStart={() => setTimerStatus('running')}
                    onPause={() => setTimerStatus('paused')}
                    onReset={() => {
                      setTimerStatus('idle');
                      setTimerRemaining(30);
                    }}
                  />
                  <span className="text-xs font-medium text-text-muted">
                    {lang === 'ar' ? 'الوضع القياسي (ذهبي)' : 'Standard Gold State'}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <TimerRing
                    durationSec={30}
                    remainingSec={urgentRemaining}
                    status="running"
                    size="md"
                    useArabicIndicDigits={useArabicIndic}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="surface"
                      size="sm"
                      onClick={() =>
                        setUrgentRemaining((prev) => (prev <= 1 ? 5 : prev - 1))
                      }
                    >
                      {lang === 'ar' ? 'تغيير الثانية (١-٥)' : 'Step 5s → 1s'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <GoldDivider
          ornament="crescent"
          label={
            lang === 'ar'
              ? '٢. فيشات النقاط والشارات والصور الرمزية'
              : '2. POKER SCORE CHIPS, BADGES & GENERATED AVATARS'
          }
        />

        {/* 3. SCORE CHIPS, BADGES, LIVE BADGE & PLAYER AVATARS */}
        <section className="grid gap-8 lg:grid-cols-2">
          {/* ScoreChip & Badges */}
          <Card className="space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold text-gold-100">
                {lang === 'ar'
                  ? 'فيشات النقاط (ScoreChip) والشارات (Badge / LiveBadge)'
                  : 'ScoreChip (Poker Chip), Badge & LiveBadge'}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {lang === 'ar'
                  ? 'فيشات دائرية بحلقة متقطعة وأرقام ثابتة العرض، ملونة حسب الحالة.'
                  : 'Circular poker chips with dashed inner ring, tabular numerals, and status coding.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
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
                value={5}
                tone="positive"
                size="md"
                showSign
                useArabicIndicDigits={useArabicIndic}
                onClick={() => applySandboxDelta(selectedPlayerId, 5)}
              />
              <ScoreChip
                value={-5}
                tone="negative"
                size="md"
                showSign
                useArabicIndicDigits={useArabicIndic}
                onClick={() => applySandboxDelta(selectedPlayerId, -5)}
              />
              <ScoreChip
                value="★"
                tone="neutral"
                size="md"
                subtitle="FINAL"
              />
              <ScoreChip
                value={100}
                tone="neutral"
                size="xl"
                subtitle="BOSS"
                useArabicIndicDigits={useArabicIndic}
              />
              <ScoreChip value="LIVE" tone="live" size="sm" />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gold-300">
                {lang === 'ar'
                  ? 'جميع حالات الشارات (Badge & LiveBadge)'
                  : 'All Badge & LiveBadge Variants'}
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <LiveBadge size="sm" />
                <LiveBadge
                  size="md"
                  label={lang === 'ar' ? 'مباشر · طاولة ب' : 'LIVE · TABLE B'}
                />
                <Badge variant="gold">★ Gold Accent</Badge>
                <Badge variant="positive">+10 Emerald Positive</Badge>
                <Badge variant="negative">-5 Ruby Negative</Badge>
                <Badge variant="info">Round 2 Info</Badge>
                <Badge variant="muted">Scheduled Muted</Badge>
              </div>
            </div>
          </Card>

          {/* PlayerAvatar Geometric Patterns */}
          <Card className="space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold text-gold-100">
                {lang === 'ar'
                  ? 'الصور الرمزية المولّدة هندسياً (PlayerAvatar)'
                  : 'Generated Geometric Avatars (PlayerAvatar)'}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {lang === 'ar'
                  ? 'أنماط هندسية إسلامية وكازينو مولّدة برمجياً مع الأحرف الأولى داخل إطار ذهبي (بدون صور أشخاص حقيقيين).'
                  : '6 deterministic geometric SVG patterns + initials in gold rings. Strictly no real photos per AGENTS.md §10.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <PlayerAvatar
                  name="Marwan Serry"
                  avatarSeed="marwan"
                  size="xl"
                  isHost
                  rank={1}
                />
                <span className="text-xs font-semibold text-gold-300">
                  Marwan (Host)
                </span>
              </div>

              {(seededPlayers.length > 0
                ? seededPlayers.filter((p) => !p.isHost).slice(0, 5)
                : [
                    {
                      id: '1',
                      fullName: 'Omar Hassan',
                      avatarSeed: 'seed-0',
                    },
                    {
                      id: '2',
                      fullName: 'Youssef Adel',
                      avatarSeed: 'seed-1',
                    },
                    {
                      id: '3',
                      fullName: 'Salma Reda',
                      avatarSeed: 'seed-2',
                    },
                    {
                      id: '4',
                      fullName: 'Karim Nabil',
                      avatarSeed: 'seed-3',
                    },
                    {
                      id: '5',
                      fullName: 'Mariam Hatem',
                      avatarSeed: 'seed-4',
                    },
                  ]
              ).map((p, idx) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-1.5"
                >
                  <PlayerAvatar
                    name={p.fullName}
                    avatarSeed={p.avatarSeed}
                    size={idx === 0 ? 'lg' : 'md'}
                    buzzed={idx === 0}
                    rank={idx + 2}
                  />
                  <span className="max-w-[84px] truncate text-xs text-text-muted">
                    {p.fullName.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <GoldDivider
          ornament="crescent"
          label={
            lang === 'ar'
              ? '٣. الأزرار والبطاقات القياسية والفاخرة'
              : '3. BUTTONS & CARDS (STANDARD + PREMIUM MARQUEE)'
          }
        />

        {/* 4. BUTTONS & CARDS */}
        <section className="space-y-8">
          <Card className="space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold text-gold-100">
                {lang === 'ar'
                  ? 'الأزرار (Button — جميع الأحجام والحالات)'
                  : 'Buttons (Primary, Secondary, Destructive, Large Scorer 56px+)'}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {lang === 'ar'
                  ? 'تدرج ذهبي للأزرار الرئيسية، إطار ذهبي للثانوية، ياقوتي للحذف، وحجم كبير خاص بلوحة الحكم (٥٦ بكسل على الأقل).'
                  : '14px radius, 2px gold focus ring with offset, soft gold glow on hover, and 56px+ tall scorer console touch targets.'}
              </p>
            </div>

            {/* Variants */}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">
                <Sparkles className="h-4 w-4" />
                <span>
                  {lang === 'ar' ? 'زر رئيسي ذهبي' : 'Primary Gold Gradient'}
                </span>
              </Button>

              <Button variant="secondary">
                <span>
                  {lang === 'ar' ? 'زر ثانوي بإطار ذهبي' : 'Secondary Gold Border'}
                </span>
              </Button>

              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                <span>
                  {lang === 'ar' ? 'حذف / إجراء خطر' : 'Destructive Ruby Outline'}
                </span>
              </Button>

              <Button variant="destructiveSolid">
                <Flame className="h-4 w-4" />
                <span>
                  {lang === 'ar' ? 'تأكيد الحذف النهائي' : 'Destructive Confirm Fill'}
                </span>
              </Button>

              <Button variant="surface">
                <span>{lang === 'ar' ? 'سطح مرتفع' : 'Elevated Surface'}</span>
              </Button>

              <Button variant="ghost">
                <span>{lang === 'ar' ? 'زر شفاف' : 'Ghost Action'}</span>
              </Button>

              <Button variant="primary" disabled>
                <span>{lang === 'ar' ? 'معطّل' : 'Disabled State'}</span>
              </Button>
            </div>

            {/* Sizes including Large Scorer Size */}
            <div className="space-y-3 border-t border-border pt-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gold-300">
                {lang === 'ar'
                  ? 'مقاسات الأزرار (بما في ذلك حجم لوحة الحكم Scorer ≥ 56px)'
                  : 'Button Sizes (sm, md, lg, scorer ≥ 56px)'}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm">
                  Small (36px)
                </Button>
                <Button variant="secondary" size="md">
                  Medium (44px)
                </Button>
                <Button variant="secondary" size="lg">
                  Large (48px)
                </Button>
                <Button variant="primary" size="scorer">
                  <Zap className="h-5 w-5 fill-current" />
                  <span>
                    {lang === 'ar'
                      ? 'حجم لوحة الحكم الكبير (56px+)'
                      : 'Scorer Console Action (56px+)'}
                  </span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Standard vs Premium Card with Marquee Bulbs */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Badge variant="muted" className="w-fit">
                  STANDARD CARD (--surface)
                </Badge>
                <CardTitle>
                  {lang === 'ar'
                    ? 'بطاقة قياسية بإطار ذهبي خفيف'
                    : 'Standard Surface Card'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ar'
                    ? 'حواف دائرية ٢٠ بكسل، إضاءة علوية داخلية ناعمة، وتوهج ذهبي خفيف عند التمرير.'
                    : '20px corner radius, 1px gold-tinted border (--border), soft top inner highlight, and subtle gold hover glow.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ivory/90">
                  {lang === 'ar'
                    ? 'تُستخدم للأقسام العامة، بطاقات الفقرات، وإحصائيات لوحة التحكم.'
                    : 'Used across segment libraries, schedule blocks, and admin studio panels.'}
                </p>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-text-muted">24px–32px padding</span>
                <Button variant="secondary" size="sm">
                  {lang === 'ar' ? 'استكشاف' : 'Explore'}
                </Button>
              </CardFooter>
            </Card>

            <Card premium marquee="perimeter" bulbCount={12}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="gold">PREMIUM MARQUEE CARD</Badge>
                  <CrescentStar size="sm" glow />
                </div>
                <CardTitle className="text-gold-gradient">
                  {lang === 'ar'
                    ? 'بطاقة العرض الفاخرة بإضاءة المسرح (Marquee Bulbs)'
                    : 'Premium Stage Card with Marquee Bulbs'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ar'
                    ? 'تتضمن مصابيح المسرح الدافئة المتتابعة وزخارف الزوايا الذهبية لليلة النهائي ومقعد مروان سري.'
                    : 'Features chasing warm marquee bulbs around the perimeter and corner gold filigree ornaments for Final Night and Marwan Serry’s seat.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MarqueeBulbs variant="strip" bulbCount={14} />
              </CardContent>
              <CardFooter>
                <span className="text-xs text-gold-300">
                  Respects prefers-reduced-motion
                </span>
                <Button variant="primary" size="sm">
                  <Trophy className="h-4 w-4" />
                  <span>{lang === 'ar' ? 'المقعد الذهبي' : 'Golden Seat'}</span>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <GoldDivider
          ornament="crescent"
          label={
            lang === 'ar'
              ? '٤. النماذج والحقول والنوافذ المنبثقة والتنبيهات'
              : '4. FORMS (INPUT / SELECT / TEXTAREA), DIALOG & TOAST'
          }
        />

        {/* 5. FORMS, DIALOGS & TOASTS */}
        <section className="grid gap-8 lg:grid-cols-12">
          {/* Form Controls: Input, Select, Textarea */}
          <Card className="space-y-5 lg:col-span-7">
            <div>
              <h3 className="font-display text-2xl font-bold text-gold-100">
                {lang === 'ar'
                  ? 'حقول الإدخال والاختيار (Input, Select, Textarea)'
                  : 'Form Controls (Input, Select, Textarea)'}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {lang === 'ar'
                  ? 'خلفية surface-2، إطار تركيز ذهبي، ورسائل تحقق باللون الياقوتي.'
                  : 'Surface-2 background, 12px radius, gold focus ring, and inline ruby validation.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={lang === 'ar' ? 'نقاط مخصصة (حكم الطاولة)' : 'Custom Points Delta'}
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
                helperText={
                  lang === 'ar'
                    ? 'أدخل قيمة موجبة أو سالبة'
                    : 'Enter positive or negative integer'
                }
              />

              <SelectField
                label={lang === 'ar' ? 'فئة الفقرة' : 'Segment Category'}
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                helperText={
                  lang === 'ar'
                    ? 'قائمة منسدلة مبنية على Radix Select'
                    : 'Radix Select themed to midnight & gold'
                }
                options={[
                  {
                    value: 'music',
                    label:
                      lang === 'ar'
                        ? 'موسيقى وغناء (Music & Singing)'
                        : 'Music & Singing',
                  },
                  {
                    value: 'wordplay',
                    label:
                      lang === 'ar'
                        ? 'لعب بالكلمات وسرعة (Wordplay)'
                        : 'Wordplay & Speed',
                  },
                  {
                    value: 'popculture',
                    label:
                      lang === 'ar'
                        ? 'سينما وثقافة شعبية (Pop Culture)'
                        : 'Cinema & Pop Culture',
                  },
                  {
                    value: 'general',
                    label:
                      lang === 'ar'
                        ? 'معلومات عامة (General Trivia)'
                        : 'General Knowledge',
                  },
                ]}
              />
            </div>

            <Input
              label={
                lang === 'ar'
                  ? 'مثال لحقل بخطأ تحقق (Inline Ruby Validation)'
                  : 'Validation Error State Specimen'
              }
              defaultValue="invalid-score-delta"
              error={
                lang === 'ar'
                  ? 'يجب إدخال رقم صحيح للنقاط قبل الاعتماد.'
                  : 'Please enter a valid numeric point delta before applying.'
              }
            />

            <Textarea
              label={
                lang === 'ar'
                  ? 'ملاحظة الحكم الاختيارية (Textarea)'
                  : 'Scorer Audit Note (Textarea)'
              }
              value={scorerNote}
              onChange={(e) => setScorerNote(e.target.value)}
              helperText={
                lang === 'ar'
                  ? 'تُحفظ هذه الملاحظة في سجل النتائج وسجل المراجعة.'
                  : 'Recorded on both ScoreEvent and AuditEntry.'
              }
            />
          </Card>

          {/* Dialogs & Toasts */}
          <Card className="flex flex-col justify-between space-y-6 lg:col-span-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-gold-100">
                  {lang === 'ar'
                    ? 'النوافذ الحوارية (Dialog) والتنبيهات (Toast)'
                    : 'Dialogs & Toast Notifications'}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {lang === 'ar'
                    ? 'نوافذ منتصف الليل بإطار ذهبي، مع زر تأكيد ياقوتي صريح للإجراءات الخطرة.'
                    : 'Midnight surface with gold border. Destructive confirmations require an explicit ruby confirm button.'}
                </p>
              </div>

              {/* Dialog Triggers */}
              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">
                      <Wand2 className="h-4 w-4 text-gold-500" />
                      <span>
                        {lang === 'ar' ? 'فتح نافذة قياسية' : 'Open Standard Dialog'}
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
                          ? 'يوجد تعادل في النقاط المؤهلة على هذه الطاولة. هل ترغب في إلحاق الفقرة رقم ١٦ (جولة التحدي والحسم) الآن؟'
                          : 'A qualifying tie exists across the advancement cutoff. Append Segment #16 (Tie-Breaker Challenge) to resolve the winner?'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-input border border-border bg-surface-2 p-4 text-xs text-gold-100">
                      {lang === 'ar'
                        ? 'الفقرة ١٦: جولة التحدي / الحسم — نقاط مقترحة: +10 / -5'
                        : 'Segment #16: Tie-Breaker & Penalty Challenge — Presets: +10 / -5'}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="secondary">
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="primary"
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
                    <Button variant="destructive">
                      <RotateCcw className="h-4 w-4" />
                      <span>
                        {lang === 'ar'
                          ? 'نافذة تأكيد خطرة (Ruby)'
                          : 'Destructive Confirm Dialog'}
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
                      ? 'سيؤدي هذا الإجراء إلى مسح جميع التعديلات المحلية واستعادة حالة البطولة الافتراضية لرمضان ٢٠٢٧.'
                      : 'This action restores all 27 players, 14 games, and score events to their initial seeded state.'
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
                          ? 'تم تأكيد الإجراء'
                          : 'Destructive Action Confirmed',
                      description:
                        lang === 'ar'
                          ? 'تم تنفيذ أمر التأكيد الياقوتي بنجاح.'
                          : 'Explicit ruby confirmation callback executed.',
                    })
                  }
                />
              </div>
            </div>

            {/* Toast Triggers */}
            <div className="space-y-3 border-t border-border pt-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gold-300">
                {lang === 'ar'
                  ? 'تجربة التنبيهات الفورية (Toast Variants)'
                  : 'Trigger Toast Notifications'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'gold',
                      title:
                        lang === 'ar'
                          ? 'تنبيه ذهبي فاخر'
                          : 'Gold Broadcast Notice',
                      description:
                        lang === 'ar'
                          ? 'بدأت الفقرة الرابعة على طاولة ب المباشرة.'
                          : 'Segment 4 of 6 is now live on Table B.',
                    })
                  }
                >
                  <Bell className="h-3.5 w-3.5 text-gold-500" />
                  <span>Gold Toast</span>
                </Button>

                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'positive',
                      title:
                        lang === 'ar' ? '+١٠ نقاط مضافة' : '+10 Points Recorded',
                      description:
                        lang === 'ar'
                          ? 'تم تحديث الرصيد وبث الحدث عبر BroadcastChannel.'
                          : 'Synced to Big Screen via BroadcastChannel.',
                    })
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                  <span>Emerald Toast</span>
                </Button>

                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'negative',
                      title:
                        lang === 'ar' ? '-٥ نقاط خصم' : '-5 Penalty Applied',
                      description:
                        lang === 'ar'
                          ? 'إجابة خاطئة قبل انتهاء الوقت.'
                          : 'Incorrect buzz response recorded.',
                    })
                  }
                >
                  <Flame className="h-3.5 w-3.5 text-negative" />
                  <span>Ruby Toast</span>
                </Button>

                <Button
                  variant="surface"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant: 'info',
                      title:
                        lang === 'ar'
                          ? 'تم تسجيل حضور اللاعب'
                          : 'Player Checked In',
                      description:
                        lang === 'ar'
                          ? 'بوابة الحضور: عمر حسن جاهز للطاولة.'
                          : 'Gate Staff marked contestant ready.',
                    })
                  }
                >
                  <span>Info Toast</span>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <GoldDivider
          ornament="crescent"
          label={
            lang === 'ar'
              ? '٥. التبويبات والجداول وحالات الفراغ والتحميل'
              : '5. TABS, ADMIN DATA TABLE, EMPTY STATE & SKELETONS'
          }
        />

        {/* 6. TABS, TABLE, EMPTY STATE & SKELETONS */}
        <section className="space-y-8">
          <Tabs defaultValue="table">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="table">
                  <Layers className="h-4 w-4 text-gold-500" />
                  <span>
                    {lang === 'ar'
                      ? 'جدول البيانات (DataTable)'
                      : 'Sortable Admin Table'}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="empty">
                  <span>
                    {lang === 'ar'
                      ? 'حالة الفراغ بالفانوس (EmptyState)'
                      : 'Lantern EmptyState'}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="skeletons">
                  <span>
                    {lang === 'ar'
                      ? 'هياكل التحميل (Skeletons)'
                      : 'Loading Skeletons'}
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
                    ? 'إظهار بيانات الجدول (٦ فقرات)'
                    : 'Populate Table Rows'
                  : lang === 'ar'
                    ? 'معاينة الجدول الفارغ'
                    : 'Simulate Empty Table'}
              </Button>
            </div>

            <TabsContent value="table" className="mt-6">
              <DataTable
                data={showTableEmpty ? [] : segments}
                getRowKey={(seg) => seg.id}
                searchPlaceholder={
                  lang === 'ar'
                    ? 'ابحث في فقرات البرنامج بالاسم أو الفئة...'
                    : 'Search show segments by English/Arabic title or category...'
                }
                searchFilter={(seg, q) =>
                  seg.nameEn.toLowerCase().includes(q) ||
                  seg.nameAr.toLowerCase().includes(q) ||
                  seg.category.toLowerCase().includes(q)
                }
                emptyTitle={
                  lang === 'ar'
                    ? 'لا توجد فقرات مطابقة للبحث'
                    : 'No Matching Show Segments'
                }
                emptyDescription={
                  lang === 'ar'
                    ? 'جرّب تغيير كلمات البحث أو استعد قائمة الفقرات الافتراضية.'
                    : 'Try clearing the search filter or click "Populate Table Rows" above.'
                }
                columns={[
                  {
                    key: 'order',
                    header: lang === 'ar' ? '#' : '#',
                    sortable: true,
                    sortAccessor: (seg) => seg.order,
                    render: (seg) => (
                      <ScoreChip
                        value={seg.order}
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
                    sortAccessor: (seg) => seg.nameEn,
                    render: (seg) => (
                      <div>
                        <div className="font-semibold text-ivory">
                          {localizeText(lang, seg.nameEn, seg.nameAr)}
                        </div>
                        <div className="text-xs text-text-muted">
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
                      <Badge variant="gold" className="uppercase">
                        {seg.category}
                      </Badge>
                    ),
                  },
                  {
                    key: 'presets',
                    header: lang === 'ar' ? 'النقاط المسبقة' : 'Preset Points',
                    render: (seg) => (
                      <div className="flex items-center gap-1.5">
                        {seg.presetPoints.map((pt) => (
                          <Badge
                            key={pt}
                            variant={pt > 0 ? 'positive' : 'negative'}
                            className="tabular-nums"
                          >
                            {pt > 0 ? `+${pt}` : pt}
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
                    ? 'بمجرد أن يبدأ حكم الطاولة الجلسة من لوحة التحكم، ستظهر النتائج المباشرة هنا تلقائياً.'
                    : 'As soon as a table scorer starts a session from the Scorer Console, live standings and events will illuminate here.'
                }
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      toast({
                        variant: 'gold',
                        title:
                          lang === 'ar'
                            ? 'تم تنشيط إجراء الحالة الفارغة'
                            : 'EmptyState CTA Triggered',
                      })
                    }
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>
                      {lang === 'ar'
                        ? 'تشغيل مباراة تجريبية'
                        : 'Launch Demo Session'}
                    </span>
                  </Button>
                }
              />
            </TabsContent>

            <TabsContent value="skeletons" className="mt-6 space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <PlayerPanelSkeleton />
                <PlayerPanelSkeleton />
                <PlayerPanelSkeleton />
              </div>
              <div className="overflow-hidden rounded-card border border-border">
                <TableRowSkeleton columns={4} />
                <TableRowSkeleton columns={4} />
                <TableRowSkeleton columns={4} />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton shape="pill" className="h-12 w-12" />
                <Skeleton className="h-11 w-48" />
                <Skeleton shape="card" className="h-16 flex-1" />
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <GoldDivider
          ornament="suits"
          label={
            lang === 'ar'
              ? '٦. الزخارف الرمضانية وعناصر الهوية البصرية'
              : '6. SIGNATURE RAMADAN & CASINO MOTIFS'
          }
        />

        {/* 7. MOTIFS GALLERY: Lantern sizes, CrescentStar, MarqueeBulbs, GoldDivider */}
        <section className="grid gap-6 md:grid-cols-3">
          <Card className="flex flex-col items-center justify-between text-center">
            <div className="space-y-1">
              <Badge variant="gold">SWAYING SVG FANOUS</Badge>
              <h3 className="font-display text-xl font-bold text-ivory">
                {lang === 'ar' ? 'فانوس رمضان المتأرجح' : 'Lantern (sm / md / lg)'}
              </h3>
            </div>
            <div className="my-4 flex items-end justify-center gap-5">
              <Lantern size="sm" chainLength={10} />
              <Lantern size="md" chainLength={6} />
              <Lantern size="lg" chainLength={4} />
            </div>
            <p className="text-xs text-text-muted">
              {lang === 'ar'
                ? 'حركة تأرجح هادئة (٣ إلى ٥ ثوانٍ) تتوقف تلقائياً عند تفعيل تقليل الحركة.'
                : 'Gentle 3–5s sway loop; automatically pauses when prefers-reduced-motion is active.'}
            </p>
          </Card>

          <Card className="flex flex-col items-center justify-between text-center">
            <div className="space-y-1">
              <Badge variant="gold">CRESCENT, STAR & SUITS</Badge>
              <h3 className="font-display text-xl font-bold text-ivory">
                {lang === 'ar' ? 'الهلال والنجمة وأوراق اللعب' : 'CrescentStar & Card Suits'}
              </h3>
            </div>
            <div className="my-6 flex items-center justify-center gap-5">
              <CrescentStar size="sm" />
              <CrescentStar size="md" glow />
              <CrescentStar size="lg" glow />
              <CrescentStar size="xl" glow />
            </div>
            <div className="w-full space-y-2">
              <GoldDivider ornament="crescent" className="py-1" />
              <GoldDivider ornament="suits" className="py-1" />
            </div>
          </Card>

          <ArabesqueBackground className="rounded-card border border-border-strong bg-bg-raised p-6 flex flex-col justify-between text-center">
            <div className="space-y-1">
              <Badge variant="gold">ARABESQUE + MARQUEE</Badge>
              <h3 className="font-display text-xl font-bold text-ivory">
                {lang === 'ar'
                  ? 'خلفية الأرابيسك ومصابيح المسرح'
                  : 'Arabesque & Marquee Strip'}
              </h3>
            </div>
            <div className="my-6 space-y-3">
              <MarqueeBulbs variant="strip" bulbCount={10} tone="gold" />
              <MarqueeBulbs variant="strip" bulbCount={10} tone="ruby" />
            </div>
            <p className="text-xs text-text-muted">
              {lang === 'ar'
                ? 'نسيج هندسي إسلامي بشفافية ٥.٥٪ مع أضواء المسرح الدافئة.'
                : 'Low-opacity (5.5%) 8-point geometric star tessellation with warm stage bulbs.'}
            </p>
          </ArabesqueBackground>
        </section>
      </div>
    </div>
  );
}
