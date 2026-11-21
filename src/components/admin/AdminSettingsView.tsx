'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Crown,
  Database,
  Globe,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  computeTournamentBlueprint,
  validateTournamentSettings,
  type SettingsImpactPreview,
  type TournamentProgressSummary,
} from '@/lib/engine';
import { groupRepo, settingsRepo, userRepo } from '@/lib/repos';
import type { Language, Settings, TournamentSettings } from '@/lib/schemas';
import { cn, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormGrid } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import {
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from './adminFormatters';

export const DEMO_SEED_PRESETS = [
  {
    size: 12 as const,
    labelEn: '12 Players (Quick Pitch)',
    labelAr: '12 لاعب (عرض سريع)',
    descEn: '4 groups of 3 · 12 group matches · 4-slot KO + Marwan Final',
    descAr: '4 مجموعات من 3 · 12 مباراة · تصفيات 4 مقاعد + نهائي مروان',
    options: {
      totalPlayers: 12,
      groupSize: 3,
      advancePerGroup: 1,
      pointsPerGroupWin: 3,
      tablesCount: 4,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
      includeDemoProgress: true,
    },
  },
  {
    size: 48 as const,
    labelEn: '48 Players (Top-2 Advance)',
    labelAr: '48 لاعب (تأهل أول وثانٍ)',
    descEn: '16 groups of 3 · Top 2 advance · 32-slot KO + Marwan Final',
    descAr: '16 مجموعة من 3 · تأهل أول 2 · شجرة 32 مقعد + نهائي مروان',
    options: {
      totalPlayers: 48,
      groupSize: 3,
      advancePerGroup: 2,
      pointsPerGroupWin: 3,
      tablesCount: 6,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
      includeDemoProgress: true,
    },
  },
  {
    size: 720 as const,
    labelEn: '720 Players (Full Ramadan Scale)',
    labelAr: '720 لاعب (حجم بطولة رمضان الكامل)',
    descEn: '240 groups of 3 · 720 group matches · 256-slot KO (16 BYEs) + Marwan Final',
    descAr: '240 مجموعة من 3 · 720 مباراة · شجرة 256 مقعد (16 BYE) + نهائي مروان',
    options: {
      totalPlayers: 720,
      groupSize: 3,
      advancePerGroup: 1,
      pointsPerGroupWin: 3,
      tablesCount: 12,
      slotMinutes: 30,
      includeFinalWithMarwan: true,
      includeDemoProgress: true,
    },
  },
];

export function AdminSettingsView() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  const { toast } = useToast();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [progress, setProgress] = useState<TournamentProgressSummary | null>(null);
  const [judgesCount, setJudgesCount] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingPreset, setResettingPreset] = useState<number | null>(null);

  const [eventName, setEventName] = useState('');
  const [eventNameAr, setEventNameAr] = useState('');
  const [eventDates, setEventDates] = useState('');
  const [eventDatesAr, setEventDatesAr] = useState('');
  const [finalNightLocal, setFinalNightLocal] = useState('');
  const [venue, setVenue] = useState('');
  const [venueAr, setVenueAr] = useState('');
  const [prizeText, setPrizeText] = useState('');
  const [prizeTextAr, setPrizeTextAr] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('en');
  const [useArabicIndicDigits, setUseArabicIndicDigits] = useState(false);

  const [totalPlayers, setTotalPlayers] = useState(720);
  const [groupSize, setGroupSize] = useState(3);
  const [advancePerGroup, setAdvancePerGroup] = useState(1);
  const [pointsPerGroupWin, setPointsPerGroupWin] = useState(3);
  const [tablesCount, setTablesCount] = useState(12);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [includeFinalWithMarwan, setIncludeFinalWithMarwan] = useState(true);

  const [pendingImpact, setPendingImpact] = useState<SettingsImpactPreview | null>(null);
  const [impactDialogOpen, setImpactDialogOpen] = useState(false);
  const [cascadePolicy, setCascadePolicy] = useState<
    'invalidateForReplay' | 'markNeedsReview'
  >('invalidateForReplay');

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const defaultLangSelectId = React.useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hydrateForm = (s: Settings) => {
    setEventName(s.eventName);
    setEventNameAr(s.eventNameAr);
    setEventDates(s.eventDates);
    setEventDatesAr(s.eventDatesAr);
    setFinalNightLocal(toDateTimeLocalInput(s.finalNightIso));
    setVenue(s.venue);
    setVenueAr(s.venueAr);
    setPrizeText(s.prizeText);
    setPrizeTextAr(s.prizeTextAr);
    setContactEmail(s.contactEmail);
    setDefaultLanguage(s.defaultLanguage);
    setUseArabicIndicDigits(s.useArabicIndicDigits);
    setTotalPlayers(s.tournament.totalPlayers);
    setGroupSize(s.tournament.groupSize);
    setAdvancePerGroup(s.tournament.advancePerGroup);
    setPointsPerGroupWin(s.tournament.pointsPerGroupWin);
    setTablesCount(s.tournament.tablesCount);
    setSlotMinutes(s.tournament.slotMinutes);
    setIncludeFinalWithMarwan(s.tournament.includeFinalWithMarwan);
  };

  const loadSettings = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [s, prog, users] = await Promise.all([
        settingsRepo.get(),
        groupRepo.getTournamentProgress(),
        userRepo.list(),
      ]);
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setSettings(s);
      setProgress(prog);
      setJudgesCount(Math.max(1, users.filter((u) => u.role === 'scorer').length));
      hydrateForm(s);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل إعدادات البطولة.'
          : 'Failed to load tournament settings.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadSettings();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset' ||
        msg.event === 'tournament.generated' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished'
      ) {
        void loadSettings();
      }
    });
    return unsub;
  }, [loadSettings]);

  const draftTournament = useMemo<TournamentSettings>(
    () => ({
      totalPlayers,
      groupSize,
      advancePerGroup,
      pointsPerGroupWin,
      tablesCount,
      slotMinutes,
      includeFinalWithMarwan,
    }),
    [
      totalPlayers,
      groupSize,
      advancePerGroup,
      pointsPerGroupWin,
      tablesCount,
      slotMinutes,
      includeFinalWithMarwan,
    ]
  );

  const validation = useMemo(
    () => validateTournamentSettings(draftTournament),
    [draftTournament]
  );

  const errorByField = useMemo(() => {
    const map = new Map<keyof TournamentSettings, string>();
    for (const err of validation.errors) {
      if (!map.has(err.field)) {
        map.set(err.field, lang === 'ar' ? err.messageAr : err.messageEn);
      }
    }
    return map;
  }, [validation.errors, lang]);

  const blueprint = useMemo(
    () => computeTournamentBlueprint(draftTournament, judgesCount),
    [draftTournament, judgesCount]
  );

  const buildPatch = (): Partial<Omit<Settings, 'id'>> => ({
    eventName: eventName.trim(),
    eventNameAr: eventNameAr.trim() || eventName.trim(),
    eventDates: eventDates.trim(),
    eventDatesAr: eventDatesAr.trim() || eventDates.trim(),
    finalNightIso: fromDateTimeLocalInput(finalNightLocal),
    venue: venue.trim(),
    venueAr: venueAr.trim() || venue.trim(),
    prizeText: prizeText.trim(),
    prizeTextAr: prizeTextAr.trim() || prizeText.trim(),
    contactEmail: contactEmail.trim(),
    defaultLanguage,
    useArabicIndicDigits,
    tournament: draftTournament,
  });

  const executeSave = async (confirmOptions?: {
    confirmCascade?: boolean;
    cascadePolicy?: 'invalidateForReplay' | 'markNeedsReview';
    confirmStructuralRebuild?: boolean;
    rebuildTournament?: boolean;
    rescheduleUpcoming?: boolean;
  }) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await settingsRepo.update(buildPatch(), user.id, confirmOptions);
      setSettings(updated);
      setImpactDialogOpen(false);
      setPendingImpact(null);
      await loadSettings();
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم حفظ الإعدادات وتحديث البطولة' : 'Settings saved & synced',
        description:
          lang === 'ar'
            ? 'تم تطبيق التعديلات عبر المحرك الرسمي وتسجيل العملية في سجل المراجعة.'
            : 'Updated atomically through the tournament engine and logged in Audit.',
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حفظ الإعدادات' : 'Could not save settings',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validation.valid) return;

    try {
      const impact = await settingsRepo.previewImpact(draftTournament);
      if (impact.requiresConfirmation) {
        setPendingImpact(impact);
        setImpactDialogOpen(true);
        return;
      }

      await executeSave({
        confirmCascade: true,
        confirmStructuralRebuild: true,
        rebuildTournament: impact.tier === 'structural',
        rescheduleUpcoming: impact.tier === 'schedule',
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر فحص تأثير التغييرات' : 'Impact preview failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleLoadSeedPreset = async (
    preset: (typeof DEMO_SEED_PRESETS)[number]
  ) => {
    if (!user) return;
    setResettingPreset(preset.size);
    try {
      const fresh = await settingsRepo.resetDemoData(user.id, preset.options);
      setSettings(fresh);
      hydrateForm(fresh);
      await loadSettings();
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? `تم تحميل نموذج ${preset.size} لاعب بنجاح`
            : `Loaded ${preset.size}-player demo preset`,
        description: lang === 'ar' ? preset.descAr : preset.descEn,
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل تحميل البيانات' : 'Preset load failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setResettingPreset(null);
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton shape="card" className="h-72 w-full" />
        <Skeleton shape="card" className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          lang === 'ar'
            ? 'إعدادات البطولة والهيكلة'
            : 'Tournament Settings & Structure'
        }
        description={
          lang === 'ar'
            ? 'تحكم في أعداد اللاعبين والمجموعات والمتأهلين والطاولات مع معاينة فورية للأرقام وتأثير التعديلات، أو بدّل بين نماذج 12 / 48 / 720 لاعباً.'
            : 'Adjust player count, group size, qualification, scoring, and studio table scheduling with live math preview, tiered Impact Preview, and 12 / 48 / 720 seed presets.'
        }
        badge={
          progress?.started ? (
            <Badge variant="gold">
              {lang === 'ar' ? 'البطولة قيد التشغيل' : 'TOURNAMENT IN PROGRESS'}
            </Badge>
          ) : (
            <Badge variant="info">
              {lang === 'ar' ? 'قبل الانطلاق' : 'PRE-TOURNAMENT'}
            </Badge>
          )
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadSettings} />}

      <form onSubmit={handleSaveSubmit} className="space-y-6">
        {/* Section 1: Adjustable Tournament Structure + Live Math Preview */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3">
            <div>
              <h2 className="font-display text-xl text-red-900">
                {lang === 'ar'
                  ? 'هيكلة البطولة والجدولة (قابلة للتعديل بالكامل)'
                  : 'Tournament Structure & Scheduling Parameters'}
              </h2>
              <p className="text-xs text-ink-muted">
                {lang === 'ar'
                  ? 'كل تغيير يُعيد حساب المجموعات والمباريات والتأهل التلقائي (BYE) فورياً. أي تغيير بعد انطلاق البطولة يتطلب تأكيد معاينة التأثير.'
                  : 'Every edit updates the live blueprint immediately. Mid-tournament changes require Impact Preview confirmation.'}
              </p>
            </div>
            {progress?.started && (
              <Badge variant="negative">
                {lang === 'ar'
                  ? `${progress.liveCount} مباشر · ${progress.finishedCount} منتهية`
                  : `${progress.liveCount} live · ${progress.finishedCount} finished`}
              </Badge>
            )}
          </div>

          <FormGrid columns={3}>
            <Input
              label={lang === 'ar' ? 'إجمالي اللاعبين (totalPlayers)' : 'Total Players'}
              type="number"
              min={4}
              max={2000}
              value={totalPlayers}
              onChange={(e) => setTotalPlayers(parseInt(e.target.value || '0', 10))}
              error={errorByField.get('totalPlayers')}
              helperText={lang === 'ar' ? 'الافتراضي: 720 لاعب' : 'Default: 720 players'}
            />
            <Input
              label={lang === 'ar' ? 'حجم المجموعة (groupSize)' : 'Group Size'}
              type="number"
              min={2}
              max={8}
              value={groupSize}
              onChange={(e) => setGroupSize(parseInt(e.target.value || '0', 10))}
              error={errorByField.get('groupSize')}
              helperText={
                lang === 'ar'
                  ? '3 لاعبين = 3 مباريات (A ضد B، B ضد C، A ضد C)'
                  : '3 players = 3 matches (A v B, B v C, A v C)'
              }
            />
            <Input
              label={
                lang === 'ar'
                  ? 'المتأهلون من كل مجموعة (advancePerGroup)'
                  : 'Advance Per Group'
              }
              type="number"
              min={1}
              max={Math.max(1, groupSize - 1)}
              value={advancePerGroup}
              onChange={(e) => setAdvancePerGroup(parseInt(e.target.value || '0', 10))}
              error={errorByField.get('advancePerGroup')}
              helperText={
                lang === 'ar'
                  ? 'الأول فقط (1) أو أكثر بمواجهات متطابقة المراكز'
                  : '1st place (1) or rank-matched pairs when > 1'
              }
            />
            <Input
              label={
                lang === 'ar'
                  ? 'نقاط الفوز بالمجموعات (pointsPerGroupWin)'
                  : 'Points Per Group Win'
              }
              type="number"
              min={1}
              max={10}
              value={pointsPerGroupWin}
              onChange={(e) => setPointsPerGroupWin(parseInt(e.target.value || '0', 10))}
              error={errorByField.get('pointsPerGroupWin')}
              helperText={lang === 'ar' ? 'الافتراضي: 3 نقاط (الخسارة 0)' : 'Default: 3 pts (loss 0, no draws)'}
            />
            <Input
              label={lang === 'ar' ? 'عدد طاولات الاستوديو (tablesCount)' : 'Studio Tables Count'}
              type="number"
              min={1}
              max={64}
              value={tablesCount}
              onChange={(e) => setTablesCount(parseInt(e.target.value || '0', 10))}
              error={errorByField.get('tablesCount')}
              helperText={
                lang === 'ar'
                  ? `عدد الحكام الحاليين: ${judgesCount}`
                  : `Active judges in pool: ${judgesCount}`
              }
            />
            <Input
              label={lang === 'ar' ? 'مدة الفترة الزمنية بالدقائق (slotMinutes)' : 'Slot Duration (Minutes)'}
              type="number"
              min={5}
              max={180}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(parseInt(e.target.value || '0', 10))}
              error={errorByField.get('slotMinutes')}
              helperText={lang === 'ar' ? 'الافتراضي: 30 دقيقة للمباراة' : 'Default: 30 min per match slot'}
            />
          </FormGrid>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-input border border-border-paper bg-paper px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={includeFinalWithMarwan}
              onChange={(e) => setIncludeFinalWithMarwan(e.target.checked)}
              className="h-5 w-5 accent-red-600"
            />
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-red-900">
              <Crown className="h-4 w-4 text-gold-600" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'النهائي الكبير (1 ضد 1 ضد 1): آخر متأهلين + مروان سري (ضيف شرف خارج الترتيب والإحصائيات)'
                  : '1v1v1 Grand Final: Last 2 Finalists + Marwan Serry (Guest participant excluded from rankings & stats)'}
              </span>
            </span>
          </label>

          {/* LIVE RESULTING NUMBERS PREVIEW */}
          <div className="rounded-card border-2 border-outline bg-paper p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-base text-red-900">
                {lang === 'ar'
                  ? 'المعاينة الفورية لأرقام البطولة الناتجة'
                  : 'Live Preview — Resulting Tournament Math'}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {blueprint.hasOddGroups && (
                  <Badge variant="gold">
                    {lang === 'ar' ? 'عدد مجموعات فردي (تأهل تلقائي)' : 'Odd Groups · BYEs Auto-Handled'}
                  </Badge>
                )}
                {blueprint.hasRemainderGroup && (
                  <Badge variant="info">
                    {lang === 'ar'
                      ? `آخر مجموعة: ${blueprint.groupSizes[blueprint.groupSizes.length - 1]} لاعبين`
                      : `Last Group: ${blueprint.groupSizes[blueprint.groupSizes.length - 1]} players`}
                  </Badge>
                )}
                {!validation.valid && (
                  <Badge variant="negative">
                    {lang === 'ar' ? 'تحقق من القيم أعلاه' : 'Fix Validation Errors'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: lang === 'ar' ? 'المجموعات' : 'Groups', value: blueprint.groupsCount, tone: 'red' as const },
                { label: lang === 'ar' ? 'مباريات المجموعات' : 'Group Matches', value: blueprint.groupMatchesCount, tone: 'white' as const },
                { label: lang === 'ar' ? 'المتأهلون للإقصاء' : 'Qualifiers', value: blueprint.qualifiersCount, tone: 'blue' as const },
                { label: lang === 'ar' ? 'حجم الشجرة' : 'Bracket Size', value: blueprint.bracketSize, tone: 'gold' as const },
                { label: lang === 'ar' ? 'مقاعد BYE' : 'BYE Slots', value: blueprint.byesCount, tone: blueprint.byesCount > 0 ? ('gold' as const) : ('white' as const) },
                { label: lang === 'ar' ? 'إجمالي المباريات' : 'Total Matches', value: blueprint.totalMatchesCount, tone: 'red' as const },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-border-paper bg-white p-3 text-center"
                >
                  <ScoreChip
                    value={stat.value}
                    tone={stat.tone}
                    size="sm"
                    showSign={false}
                    useArabicIndicDigits={useArabicIndicDigits}
                  />
                  <span className="text-[11px] font-bold text-ink-muted">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-pill border border-border-paper bg-white px-2.5 py-1 font-bold text-red-900">
                {lang === 'ar'
                  ? `المجموعات (${formatNumber(blueprint.groupsCount, { useArabicIndicDigits })} × ${formatNumber(blueprint.groupSize, { useArabicIndicDigits })})`
                  : `Groups (${formatNumber(blueprint.groupsCount, { useArabicIndicDigits })}×${formatNumber(blueprint.groupSize, { useArabicIndicDigits })})`}
              </span>
              {blueprint.knockoutRounds.map((kr) => (
                <React.Fragment key={kr.roundOrder}>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-ink-muted rtl:rotate-180"
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'rounded-pill border px-2.5 py-1 font-bold',
                      kr.isFinal
                        ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
                        : 'border-border-paper bg-white text-ink'
                    )}
                  >
                    {lang === 'ar' ? kr.nameAr : kr.nameEn}
                    {kr.byeCount > 0 ? ` (${kr.byeCount} BYE)` : ''}
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-border-paper pt-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                {lang === 'ar'
                  ? `السعة المتزامنة: ${blueprint.concurrentCapacity} طاولات/فترة · ~${blueprint.estimatedSlots} فترة (${Math.round(blueprint.estimatedDurationMinutes / 60)} ساعة ≈ ${blueprint.estimatedNights} ليالٍ رمضانية)`
                  : `Concurrent capacity: ${blueprint.concurrentCapacity} tables/slot · ~${blueprint.estimatedSlots} slots (${Math.round(blueprint.estimatedDurationMinutes / 60)}h ≈ ${blueprint.estimatedNights} Ramadan nights)`}
              </span>
            </div>
          </div>
        </section>

        {/* Section 2: Event Placeholders */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3">
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar'
                ? 'هوية الحدث والبيانات المبدئية'
                : 'Event Identity & Pitch Placeholders'}
            </h2>
            <Badge variant="info">
              {lang === 'ar' ? 'يظهر على الصفحة الرئيسية' : 'Live on / & /final'}
            </Badge>
          </div>

          <FormGrid columns={2}>
            <Input label={lang === 'ar' ? 'اسم البطولة (إنجليزي)' : 'Event Name (EN)'} value={eventName} onChange={(e) => setEventName(e.target.value)} required />
            <Input label={lang === 'ar' ? 'اسم البطولة (عربي)' : 'Event Name (AR)'} value={eventNameAr} onChange={(e) => setEventNameAr(e.target.value)} dir="rtl" required />
            <Input label={lang === 'ar' ? 'مواعيد الفعالية — مبدئي (إنجليزي)' : 'Event Dates — Placeholder (EN)'} value={eventDates} onChange={(e) => setEventDates(e.target.value)} />
            <Input label={lang === 'ar' ? 'مواعيد الفعالية — مبدئي (عربي)' : 'Event Dates — Placeholder (AR)'} value={eventDatesAr} onChange={(e) => setEventDatesAr(e.target.value)} dir="rtl" />
            <Input label={lang === 'ar' ? 'موعد العد التنازلي لليلة النهائي' : 'Final Night Countdown Target'} type="datetime-local" value={finalNightLocal} onChange={(e) => setFinalNightLocal(e.target.value)} />
            <Input label={lang === 'ar' ? 'بريد التواصل للرعاية' : 'Sponsor Partnerships Email'} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} dir="ltr" />
            <Input label={lang === 'ar' ? 'المكان — مبدئي (إنجليزي)' : 'Venue — Placeholder (EN)'} value={venue} onChange={(e) => setVenue(e.target.value)} />
            <Input label={lang === 'ar' ? 'المكان — مبدئي (عربي)' : 'Venue — Placeholder (AR)'} value={venueAr} onChange={(e) => setVenueAr(e.target.value)} dir="rtl" />
            <Input label={lang === 'ar' ? 'وصف الجوائز — مبدئي (إنجليزي)' : 'Prize Text — Placeholder (EN)'} value={prizeText} onChange={(e) => setPrizeText(e.target.value)} />
            <Input label={lang === 'ar' ? 'وصف الجوائز — مبدئي (عربي)' : 'Prize Text — Placeholder (AR)'} value={prizeTextAr} onChange={(e) => setPrizeTextAr(e.target.value)} dir="rtl" />
          </FormGrid>
        </section>

        {/* Section 3: Language & Phase 10 Guardrail */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="flex items-center gap-2 border-b border-border-paper pb-3">
            <Globe className="h-5 w-5 text-red-600" aria-hidden="true" />
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar' ? 'اللغة والأرقام وتأثيرات العرض' : 'Language, Numerals & Delighters'}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={defaultLangSelectId} className="text-sm font-bold text-ink">
                {lang === 'ar' ? 'اللغة الافتراضية' : 'Default Language'}
              </label>
              <select
                id={defaultLangSelectId}
                value={defaultLanguage}
                onChange={(e) => {
                  const next = e.target.value as Language;
                  setDefaultLanguage(next);
                  setLang(next);
                }}
                className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
              >
                <option value="en">English (LTR)</option>
                <option value="ar">العربية (RTL)</option>
              </select>
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 self-end rounded-input border border-border-paper bg-paper px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={useArabicIndicDigits}
                onChange={(e) => setUseArabicIndicDigits(e.target.checked)}
                className="h-5 w-5 accent-red-600"
              />
              <span className="text-sm font-bold text-ink">
                {lang === 'ar'
                  ? 'استخدام الأرقام العربية الهندية (٠١٢٣)'
                  : 'Display Arabic-Indic digits (٠١٢٣)'}
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-border-paper bg-paper px-4 py-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-2 font-bold text-red-900">
              <Sparkles className="h-4 w-4 text-gold-600" aria-hidden="true" />
              {lang === 'ar'
                ? 'طبقة المؤثرات الاحتفالية (المرحلة 10 — Delighters): مطفأة افتراضياً حتى اعتماد النسخة الأساسية.'
                : 'Phase 10 Delighters layer: OFF by default until Change Request 1 is complete.'}
            </span>
            <Badge variant="muted">OFF</Badge>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="submit"
            variant="red"
            size="lg"
            disabled={saving || !validation.valid}
            className="gap-2"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>
              {saving
                ? lang === 'ar'
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : lang === 'ar'
                  ? 'حفظ إعدادات البطولة'
                  : 'Save Tournament Settings'}
            </span>
          </Button>
        </div>
      </form>

      {/* Section 4: Procedural Demo Seed Presets (12 / 48 / 720) & Reset */}
      <section className="rounded-card border-2 border-red-600/30 bg-white p-5 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-red-600" aria-hidden="true" />
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar'
                ? 'نماذج البيانات التجريبية التوليدية (12 / 48 / 720 لاعب)'
                : 'Procedural Demo Seed Presets (12 / 48 / 720 Players)'}
            </h2>
          </div>
          <Badge variant="gold">IndexedDB</Badge>
        </div>

        <p className="text-xs text-ink-muted">
          {lang === 'ar'
            ? 'بدّل حجم البطولة التجريبية بنقرة واحدة لتجربة العرض السريع (12)، أو التأهل المزدوج (48)، أو سعة رمضان الكاملة (720 لاعباً و240 مجموعة). يتم التوليد بدون تجميد الصفحة.'
            : 'Switch tournament scale in one click to test quick pitch (12), rank-matched Top-2 (48), or full Ramadan capacity (720 players, 240 groups, 16 BYEs). Non-blocking generation with fake contacts (010-0000-0001).'}
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          {DEMO_SEED_PRESETS.map((preset) => {
            const isCurrent = settings.tournament.totalPlayers === preset.size;
            const isBusy = resettingPreset === preset.size;
            return (
              <div
                key={preset.size}
                className={cn(
                  'flex flex-col justify-between gap-3 rounded-card border p-4',
                  isCurrent ? 'border-red-600 bg-paper' : 'border-border-paper bg-white'
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base text-red-900">
                      {lang === 'ar' ? preset.labelAr : preset.labelEn}
                    </span>
                    {isCurrent && (
                      <Badge variant="gold">
                        {lang === 'ar' ? 'الحالي' : 'ACTIVE'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted">
                    {lang === 'ar' ? preset.descAr : preset.descEn}
                  </p>
                </div>

                <ConfirmDialog
                  title={
                    lang === 'ar'
                      ? `تحميل نموذج ${preset.size} لاعب؟`
                      : `Load ${preset.size}-Player Demo Preset?`
                  }
                  description={
                    lang === 'ar'
                      ? `سيستبدل هذا الإجراء البيانات الحالية بنموذج ${preset.size} لاعب كامل (بما في ذلك دور المجموعات وشجرة الإقصاء ومباريات مباشرة تجريبية).`
                      : `Replaces the current IndexedDB state with a fresh ${preset.size}-player tournament (${preset.descEn}).`
                  }
                  confirmLabel={lang === 'ar' ? `توليد ${preset.size} لاعب` : `Generate ${preset.size} Players`}
                  cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  destructive
                  onConfirm={() => handleLoadSeedPreset(preset)}
                  trigger={
                    <Button
                      type="button"
                      variant={isCurrent ? 'secondary' : 'calm'}
                      disabled={resettingPreset !== null}
                      className="w-full gap-2"
                    >
                      <RotateCcw className={cn('h-4 w-4', isBusy && 'animate-spin')} aria-hidden="true" />
                      <span>
                        {isBusy
                          ? lang === 'ar'
                            ? 'جاري التوليد...'
                            : 'Generating...'
                          : isCurrent
                            ? lang === 'ar'
                              ? `إعادة ضبط (${preset.size})`
                              : `Reset ${preset.size} Demo`
                            : lang === 'ar'
                              ? `تحميل ${preset.size} لاعب`
                              : `Switch to ${preset.size}`}
                      </span>
                    </Button>
                  }
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Tiered Impact Preview Confirmation Dialog */}
      <Dialog
        open={impactDialogOpen}
        onOpenChange={(o) => {
          if (!saving) setImpactDialogOpen(o);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              {pendingImpact?.tier === 'structural' ? (
                <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-gold-600" aria-hidden="true" />
              )}
              <span>
                {lang === 'ar'
                  ? 'معاينة تأثير تعديل إعدادات البطولة'
                  : 'Settings Change — Impact Preview'}
              </span>
            </DialogTitle>
            <DialogDescription>
              {pendingImpact
                ? lang === 'ar'
                  ? pendingImpact.summaryAr
                  : pendingImpact.summaryEn
                : ''}
            </DialogDescription>
          </DialogHeader>

          {pendingImpact && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-input border border-border-paper bg-paper p-3">
                  <div className="font-score text-2xl text-red-900 tabular-nums">
                    {formatNumber(pendingImpact.affectedGroupsCount, { useArabicIndicDigits })}
                  </div>
                  <div className="text-[11px] font-bold text-ink-muted">
                    {lang === 'ar' ? 'المجموعات' : 'Groups'}
                  </div>
                </div>
                <div className="rounded-input border border-border-paper bg-paper p-3">
                  <div className="font-score text-2xl text-blue-600 tabular-nums">
                    {formatNumber(pendingImpact.affectedScheduledCount, { useArabicIndicDigits })}
                  </div>
                  <div className="text-[11px] font-bold text-ink-muted">
                    {lang === 'ar' ? 'مباريات مجدولة' : 'Upcoming Matches'}
                  </div>
                </div>
                <div className="rounded-input border border-negative/40 bg-red-100/60 p-3">
                  <div className="font-score text-2xl text-negative tabular-nums">
                    {formatNumber(pendingImpact.affectedActiveOrFinishedCount, { useArabicIndicDigits })}
                  </div>
                  <div className="text-[11px] font-bold text-negative">
                    {lang === 'ar' ? 'مباشرة / منتهية' : 'Live / Finished'}
                  </div>
                </div>
              </div>

              {pendingImpact.tier === 'scoring' &&
                pendingImpact.cascadeImpact?.requiresConfirmation && (
                  <div className="space-y-2 rounded-input border border-border-paper bg-paper p-3">
                    <div className="text-xs font-extrabold text-red-900">
                      {lang === 'ar'
                        ? 'سياسة التعامل مع المباريات التالية التي بدأت بالفعل:'
                        : 'Downstream live/finished match policy:'}
                    </div>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs font-semibold">
                      <input
                        type="radio"
                        name="settingsCascadePolicy"
                        checked={cascadePolicy === 'invalidateForReplay'}
                        onChange={() => setCascadePolicy('invalidateForReplay')}
                      />
                      <span>
                        {lang === 'ar'
                          ? 'إلغاء النتيجة لإعادة اللعب (الافتراضي — يحتفظ بسجل الأحداث القديم)'
                          : 'Invalidate downstream matches for replay (default — preserves audit history)'}
                      </span>
                    </label>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs font-semibold">
                      <input
                        type="radio"
                        name="settingsCascadePolicy"
                        checked={cascadePolicy === 'markNeedsReview'}
                        onChange={() => setCascadePolicy('markNeedsReview')}
                      />
                      <span>
                        {lang === 'ar'
                          ? 'تمييزها بحالة «مراجعة إدارية» دون تعديل تلقائي'
                          : 'Flag downstream matches as needsReview without rewriting'}
                      </span>
                    </label>
                  </div>
                )}

              {pendingImpact.tier === 'structural' && (
                <div className="rounded-input border border-negative/30 bg-red-100/50 p-3 text-xs font-semibold text-red-900">
                  {lang === 'ar'
                    ? 'تنبيه: تغيير عدد اللاعبين أو حجم المجموعة أو عدد المتأهلين بعد انطلاق البطولة سيعيد بناء المجموعات وشجرة الإقصاء بالكامل ويصفّر المباريات الجارية والمنتهية.'
                    : 'Warning: Changing totalPlayers, groupSize, or advancePerGroup mid-tournament regenerates all groups and knockout rounds from scratch.'}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="calm"
              disabled={saving}
              onClick={() => setImpactDialogOpen(false)}
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant={pendingImpact?.tier === 'structural' ? 'destructive' : 'red'}
              disabled={saving}
              onClick={() =>
                executeSave({
                  confirmCascade: true,
                  cascadePolicy,
                  confirmStructuralRebuild: true,
                  rebuildTournament: pendingImpact?.tier === 'structural',
                  rescheduleUpcoming: pendingImpact?.tier === 'schedule',
                })
              }
            >
              {saving
                ? lang === 'ar'
                  ? 'جاري التطبيق...'
                  : 'Applying...'
                : pendingImpact?.tier === 'structural'
                  ? lang === 'ar'
                    ? 'تأكيد وإعادة بناء البطولة'
                    : 'Confirm & Rebuild Tournament'
                  : pendingImpact?.tier === 'schedule'
                    ? lang === 'ar'
                      ? 'تأكيد وإعادة جدولة القادمة فقط'
                      : 'Confirm & Reschedule Upcoming'
                    : lang === 'ar'
                      ? 'تأكيد وتحديث الترتيب'
                      : 'Confirm & Recompute Standings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
