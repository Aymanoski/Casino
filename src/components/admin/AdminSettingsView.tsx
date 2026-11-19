'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Globe,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { settingsRepo } from '@/lib/repos';
import type { Language, Settings } from '@/lib/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormGrid } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import {
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from './adminFormatters';

export function AdminSettingsView() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  const { toast } = useToast();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Editable Form State
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
  const [totalPlayers, setTotalPlayers] = useState(27);
  const [playersPerGame, setPlayersPerGame] = useState(3);
  const [round1Games, setRound1Games] = useState(9);
  const [round2Games, setRound2Games] = useState(3);
  const [semiGames, setSemiGames] = useState(1);
  const [semiAdvanceCount, setSemiAdvanceCount] = useState(2);

  const mountedRef = useRef(true);
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
    setTotalPlayers(s.bracketConfig.totalPlayers);
    setPlayersPerGame(s.bracketConfig.playersPerGame);
    setRound1Games(s.bracketConfig.round1Games);
    setRound2Games(s.bracketConfig.round2Games);
    setSemiGames(s.bracketConfig.semiGames);
    setSemiAdvanceCount(s.bracketConfig.semiAdvanceCount);
  };

  const loadSettings = useCallback(async () => {
    try {
      const s = await settingsRepo.get();
      if (!mountedRef.current) return;
      setSettings(s);
      hydrateForm(s);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل إعدادات البطولة.'
          : 'Failed to load tournament settings.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadSettings();
    const unsub = realtime.subscribe('*', (msg) => {
      if (msg.event === 'settings.updated' || msg.event === 'data.reset') {
        loadSettings();
      }
    });
    return unsub;
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const updated = await settingsRepo.update(
        {
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
          bracketConfig: {
            totalPlayers: Math.max(4, totalPlayers),
            playersPerGame: Math.max(2, playersPerGame),
            round1Games: Math.max(1, round1Games),
            round2Games: Math.max(1, round2Games),
            semiGames: Math.max(1, semiGames),
            semiAdvanceCount: Math.max(1, semiAdvanceCount),
          },
        },
        user.id
      );
      setSettings(updated);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved',
        description:
          lang === 'ar'
            ? 'تم تحديث القيم المبدئية في جميع الصفحات وتسجيل العملية في سجل المراجعة.'
            : 'Placeholder details and defaults synced across all windows and logged in Audit.',
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حفظ الإعدادات' : 'Could not save settings',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    if (!user) return;
    setResetting(true);
    try {
      const fresh = await settingsRepo.resetDemoData(user.id);
      setSettings(fresh);
      hydrateForm(fresh);
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? 'تمت إعادة ضبط البيانات التجريبية'
            : 'Demo data restored',
        description:
          lang === 'ar'
            ? 'عاد كل شيء إلى حالة بطولة رمضان ٢٠٢٧ التجريبية الأصلية.'
            : 'All players, bracket rounds, scores, sponsors, and settings restored to factory seed.',
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل إعادة الضبط' : 'Reset failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResetting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton shape="card" className="h-72 w-full" />
        <Skeleton shape="card" className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          lang === 'ar'
            ? 'إعدادات البطولة والبيانات المبدئية'
            : 'Tournament Settings & Placeholders'
        }
        description={
          lang === 'ar'
            ? 'عدّل تفاصيل الفعالية المبدئية (الاسم، المواعيد، المكان، الجوائز)، الإعدادات الافتراضية للتصفيات واللغة، أو أعد ضبط البيانات التجريبية.'
            : 'Edit placeholder event metadata (dates, venue, prizes), default bracket parameters, language settings, or reset demo data.'
        }
        badge={
          <Badge variant="gold">
            {lang === 'ar' ? 'بيانات عرض قابلة للتعديل' : 'EDITABLE PLACEHOLDERS'}
          </Badge>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadSettings} />}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Event Placeholders */}
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
            <Input
              label={lang === 'ar' ? 'اسم البطولة (إنجليزي)' : 'Event Name (EN)'}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
            />
            <Input
              label={lang === 'ar' ? 'اسم البطولة (عربي)' : 'Event Name (AR)'}
              value={eventNameAr}
              onChange={(e) => setEventNameAr(e.target.value)}
              dir="rtl"
              required
            />
            <Input
              label={
                lang === 'ar'
                  ? 'مواعيد الفعالية — مبدئي (إنجليزي)'
                  : 'Event Dates — Placeholder (EN)'
              }
              value={eventDates}
              onChange={(e) => setEventDates(e.target.value)}
            />
            <Input
              label={
                lang === 'ar'
                  ? 'مواعيد الفعالية — مبدئي (عربي)'
                  : 'Event Dates — Placeholder (AR)'
              }
              value={eventDatesAr}
              onChange={(e) => setEventDatesAr(e.target.value)}
              dir="rtl"
            />
            <Input
              label={
                lang === 'ar'
                  ? 'موعد العد التنازلي لليلة النهائي'
                  : 'Final Night Countdown Target'
              }
              type="datetime-local"
              value={finalNightLocal}
              onChange={(e) => setFinalNightLocal(e.target.value)}
            />
            <Input
              label={
                lang === 'ar'
                  ? 'بريد التواصل للرعاية'
                  : 'Sponsor Partnerships Email'
              }
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              dir="ltr"
            />
            <Input
              label={lang === 'ar' ? 'المكان — مبدئي (إنجليزي)' : 'Venue — Placeholder (EN)'}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
            <Input
              label={lang === 'ar' ? 'المكان — مبدئي (عربي)' : 'Venue — Placeholder (AR)'}
              value={venueAr}
              onChange={(e) => setVenueAr(e.target.value)}
              dir="rtl"
            />
            <Input
              label={
                lang === 'ar'
                  ? 'وصف الجوائز — مبدئي (إنجليزي)'
                  : 'Prize Text — Placeholder (EN)'
              }
              value={prizeText}
              onChange={(e) => setPrizeText(e.target.value)}
            />
            <Input
              label={
                lang === 'ar'
                  ? 'وصف الجوائز — مبدئي (عربي)'
                  : 'Prize Text — Placeholder (AR)'
              }
              value={prizeTextAr}
              onChange={(e) => setPrizeTextAr(e.target.value)}
              dir="rtl"
            />
          </FormGrid>
        </section>

        {/* Section 2: Bracket Defaults */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="border-b border-border-paper pb-3">
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar'
                ? 'الإعدادات الافتراضية لشجرة التصفيات'
                : 'Default Bracket Configuration'}
            </h2>
            <p className="text-xs text-ink-muted">
              {lang === 'ar'
                ? 'القيم المبدئية المقترحة عند إنشاء مباريات أو إعادة توليد الشجرة.'
                : 'Default tournament blueprint parameters referenced by the Bracket Builder and public overview.'}
            </p>
          </div>

          <FormGrid columns={3}>
            <Input
              label={lang === 'ar' ? 'إجمالي اللاعبين' : 'Total Players'}
              type="number"
              min={4}
              max={128}
              value={totalPlayers}
              onChange={(e) => setTotalPlayers(Number(e.target.value) || 27)}
            />
            <Input
              label={lang === 'ar' ? 'اللاعبون في كل طاولة' : 'Players / Game'}
              type="number"
              min={2}
              max={6}
              value={playersPerGame}
              onChange={(e) => setPlayersPerGame(Number(e.target.value) || 3)}
            />
            <Input
              label={lang === 'ar' ? 'مباريات الدور الأول' : 'Round 1 Games'}
              type="number"
              min={1}
              max={32}
              value={round1Games}
              onChange={(e) => setRound1Games(Number(e.target.value) || 9)}
            />
            <Input
              label={lang === 'ar' ? 'مباريات الدور الثاني' : 'Round 2 Games'}
              type="number"
              min={1}
              max={16}
              value={round2Games}
              onChange={(e) => setRound2Games(Number(e.target.value) || 3)}
            />
            <Input
              label={lang === 'ar' ? 'مباريات نصف النهائي' : 'Semi-Final Games'}
              type="number"
              min={1}
              max={4}
              value={semiGames}
              onChange={(e) => setSemiGames(Number(e.target.value) || 1)}
            />
            <Input
              label={
                lang === 'ar'
                  ? 'المتأهلون من نصف النهائي'
                  : 'Semi-Final Advance Count'
              }
              type="number"
              min={1}
              max={4}
              value={semiAdvanceCount}
              onChange={(e) => setSemiAdvanceCount(Number(e.target.value) || 2)}
            />
          </FormGrid>
        </section>

        {/* Section 3: Language & Display Defaults */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="border-b border-border-paper pb-3">
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar'
                ? 'اللغة والأرقام وتفضيلات العرض'
                : 'Language & Display Defaults'}
            </h2>
          </div>

          <FormGrid columns={2}>
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                {lang === 'ar' ? 'اللغة الافتراضية' : 'Default Language'}
              </label>
              <div className="flex gap-2">
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value as Language)}
                  className="flex min-h-[44px] h-11 flex-1 rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink"
                >
                  <option value="en">English (LTR)</option>
                  <option value="ar">العربية (RTL)</option>
                </select>
                <Button
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={() => setLang(defaultLanguage)}
                >
                  <Globe className="h-4 w-4 text-red-600" />
                  <span>{lang === 'ar' ? 'تطبيق الآن' : 'Apply Now'}</span>
                </Button>
              </div>
            </div>

            <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-input border border-border-paper bg-paper px-4 py-2.5">
              <div>
                <div className="text-sm font-bold text-ink">
                  {lang === 'ar'
                    ? 'استخدام الأرقام العربية الشرقية (١٢٣)'
                    : 'Use Arabic-Indic Numerals (١٢٣)'}
                </div>
                <div className="text-xs text-ink-muted">
                  {lang === 'ar'
                    ? 'الأرقام الغربية (123) مفعّلة افتراضياً للوضوح في لوحات النقاط.'
                    : 'Western digits (123) are enabled by default across scoreboards.'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={useArabicIndicDigits}
                onChange={(e) => setUseArabicIndicDigits(e.target.checked)}
                className="h-5 w-5 accent-red-600 shrink-0"
              />
            </label>
          </FormGrid>

          {/* Phase 10 Delighters Status (Locked Off in Phases 1–9 per AGENTS.md §12) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-border-paper bg-paper px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
              <div>
                <div className="text-sm font-bold text-red-900">
                  {lang === 'ar'
                    ? 'طبقة المؤثرات الاحتفالية (Delighters — المرحلة ١٠)'
                    : 'Spectacle Delighters Layer (Phase 10 Hook)'}
                </div>
                <p className="text-xs text-ink-muted">
                  {lang === 'ar'
                    ? 'مطفأة افتراضياً في النسخة الأساسية (المراحل ١–٩) وجاهزة للتفعيل في المرحلة ١٠ بدون إعادة كتابة.'
                    : 'Disabled by default during Phases 1–9 per project spec; hook points are wired for Phase 10 activation.'}
                </p>
              </div>
            </div>
            <Badge variant="muted">
              {settings.delightersEnabled
                ? lang === 'ar'
                  ? 'مفعّل'
                  : 'ON'
                : lang === 'ar'
                  ? 'مطفأ (المرحلة ١٠)'
                  : 'OFF (Phase 10)'}
            </Badge>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" variant="red" size="lg" disabled={saving}>
            <Save className="h-4 w-4" />
            <span>
              {saving
                ? lang === 'ar'
                  ? 'جارٍ الحفظ...'
                  : 'Saving...'
                : lang === 'ar'
                  ? 'حفظ جميع الإعدادات'
                  : 'Save All Settings'}
            </span>
          </Button>
        </div>
      </form>

      {/* Danger Zone — Reset Demo Data */}
      <section className="rounded-card border border-negative bg-negative-soft/70 p-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
            <div>
              <h2 className="font-display text-lg text-negative">
                {lang === 'ar'
                  ? 'إعادة ضبط البيانات التجريبية'
                  : 'Reset Demo Data to Factory Seed'}
              </h2>
              <p className="text-xs text-ink-muted max-w-[65ch]">
                {lang === 'ar'
                  ? 'يعيد هذا الإجراء الـ ٢٧ لاعباً، الجولات، المباراة المباشرة (ربع النهائي ب)، سجل النقاط، والرعاة إلى حالة العرض الأصلية لرمضان ٢٠٢٧.'
                  : 'Restores all 27 seeded players, original rounds, live Quarter-Final B, score events, sponsors, and settings to the clean Ramadan 2027 pitch story.'}
              </p>
            </div>
          </div>

          <ConfirmDialog
            destructive
            title={
              lang === 'ar'
                ? 'تأكيد إعادة ضبط جميع البيانات؟'
                : 'Reset All Tournament Demo Data?'
            }
            description={
              lang === 'ar'
                ? 'سيتم فقدان أي لاعبين أو مباريات أو نقاط أضفتها محلياً وإعادة تحميل البيانات الافتراضية.'
                : 'Any locally created players, bracket edits, scores, or settings changes will be erased and replaced with the factory demo snapshot.'
            }
            confirmLabel={
              resetting
                ? lang === 'ar'
                  ? 'جارٍ الاستعادة...'
                  : 'Resetting...'
                : lang === 'ar'
                  ? 'نعم، أعد الضبط'
                  : 'Yes, Reset Demo Data'
            }
            cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
            onConfirm={handleResetDemo}
            trigger={
              <Button
                type="button"
                variant="destructiveSolid"
                size="md"
                disabled={resetting}
              >
                <RotateCcw className="h-4 w-4" />
                <span>
                  {lang === 'ar' ? 'إعادة ضبط البيانات' : 'Reset Demo Data'}
                </span>
              </Button>
            }
          />
        </div>
      </section>
    </div>
  );
}
