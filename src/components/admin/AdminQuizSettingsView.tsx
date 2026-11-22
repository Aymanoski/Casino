'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { quizRepo } from '@/lib/repos';
import type { QuizSettings, QuizVerificationChannel } from '@/lib/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormGrid } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { QuizDemoBanner } from '@/components/quiz/QuizDemoBanner';
import {
  getWindowStatusCopy,
  QUIZ_VERIFICATION_CHANNEL_COPY,
} from '@/components/quiz/quizHelpers';

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(val: string): string {
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function AdminQuizSettingsView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tournamentTotalPlayers, setTournamentTotalPlayers] = useState(720);
  const [bankSize, setBankSize] = useState(64);

  const [form, setForm] = useState<QuizSettings | null>(null);
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const data = await quizRepo.getSettingsForAdmin(user.id);
      setForm(data.quiz);
      setTournamentTotalPlayers(data.tournamentTotalPlayers);
      setBankSize(data.bankSize);
      setStartLocal(isoToDatetimeLocal(data.quiz.windowStartsAt));
      setEndLocal(isoToDatetimeLocal(data.quiz.windowEndsAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz settings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const applyWindowPreset = (preset: 'open' | 'upcoming' | 'closed') => {
    const now = Date.now();
    let sMs = now - 48 * 3600_000;
    let eMs = now + 5 * 24 * 3600_000;
    if (preset === 'upcoming') {
      sMs = now + 2 * 3600_000;
      eMs = now + 5 * 24 * 3600_000;
    } else if (preset === 'closed') {
      sMs = now - 5 * 24 * 3600_000;
      eMs = now - 60 * 60_000;
    }
    const sIso = new Date(sMs).toISOString();
    const eIso = new Date(eMs).toISOString();
    setStartLocal(isoToDatetimeLocal(sIso));
    setEndLocal(isoToDatetimeLocal(eIso));
    setForm((prev) =>
      prev ? { ...prev, windowStartsAt: sIso, windowEndsAt: eIso } : prev
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await quizRepo.updateSettings(
        {
          ...form,
          windowStartsAt: datetimeLocalToIso(startLocal),
          windowEndsAt: datetimeLocalToIso(endLocal),
        },
        user.id
      );
      setForm(updated);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم حفظ إعدادات الاختبار' : 'Quiz Settings Saved',
        description:
          lang === 'ar'
            ? 'تم تحديث القواعد وخط التأهل ونافذة الاختبار وتسجيل التعديل في سجل المراجعة.'
            : 'Rules, cutoff, and time window updated and recorded in the Audit Log.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save quiz settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  const effectiveCutoff = form.syncCutoffWithTournament
    ? tournamentTotalPlayers
    : form.customCutoffN;
  const nowMs = Date.now();
  const sMs = Date.parse(datetimeLocalToIso(startLocal));
  const eMs = Date.parse(datetimeLocalToIso(endLocal));
  const previewWindowStatus =
    nowMs < sMs ? 'upcoming' : nowMs > eMs ? 'closed' : 'open';
  const windowCopy = getWindowStatusCopy(previewWindowStatus, lang);

  return (
    <div className="space-y-6">
      <QuizDemoBanner surface="paper" />

      <AdminPageHeader
        title={lang === 'ar' ? 'إعدادات اختبار التسجيل' : 'Registration Quiz Settings'}
        description={
          lang === 'ar'
            ? 'تحكم في عدد الأسئلة، زمن كل سؤال، خط التأهل المرتبط بالبطولة، النافذة الزمنية، وصيغة التحقق.'
            : 'Adjust question count, timer duration, top-N cutoff sync, time window, verification channel, and rank disclosure.'
        }
        badge={
          <Badge
            variant={
              windowCopy.tone === 'positive'
                ? 'positive'
                : windowCopy.tone === 'info'
                  ? 'info'
                  : 'negative'
            }
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{windowCopy.label}</span>
          </Badge>
        }
      />

      {error && <AdminErrorBanner message={error} />}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Rules & Cutoff */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-5">
          <h2 className="text-base font-black text-red-900">
            {lang === 'ar' ? '١. قواعد المحاولة وخط التأهل' : '1. Attempt Rules & Top-N Cutoff'}
          </h2>

          <FormGrid columns={2}>
            <div className="space-y-1.5">
              <label
                htmlFor="qs-per-attempt"
                className="block text-sm font-bold text-red-900"
              >
                {lang === 'ar' ? 'عدد الأسئلة لكل محاولة' : 'Questions per Attempt'}
              </label>
              <Input
                id="qs-per-attempt"
                data-testid="quiz-setting-questions"
                type="number"
                min={3}
                max={Math.min(50, bankSize)}
                value={form.questionsPerAttempt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    questionsPerAttempt: Math.max(3, Number(e.target.value) || 20),
                  })
                }
                className="min-h-[46px] text-base"
              />
              <p className="text-xs text-ink-muted">
                {lang === 'ar'
                  ? `المتاح في بنك الأسئلة حالياً: ${bankSize} سؤالاً`
                  : `Available in question bank: ${bankSize} questions`}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="qs-seconds"
                className="block text-sm font-bold text-red-900"
              >
                {lang === 'ar' ? 'الزمن لكل سؤال (بالثواني)' : 'Seconds per Question'}
              </label>
              <Input
                id="qs-seconds"
                data-testid="quiz-setting-seconds"
                type="number"
                min={3}
                max={60}
                value={form.secondsPerQuestion}
                onChange={(e) =>
                  setForm({
                    ...form,
                    secondsPerQuestion: Math.max(3, Number(e.target.value) || 10),
                  })
                }
                className="min-h-[46px] text-base"
              />
              <p className="text-xs text-ink-muted">
                {lang === 'ar'
                  ? `الحد الأقصى للمحاولة: ${form.questionsPerAttempt * form.secondsPerQuestion} ثانية`
                  : `Max attempt time: ${form.questionsPerAttempt * form.secondsPerQuestion} seconds`}
              </p>
            </div>
          </FormGrid>

          {/* Cutoff Sync Toggle */}
          <div className="rounded-card border border-border-paper bg-paper p-4 space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                data-testid="quiz-sync-cutoff-toggle"
                checked={form.syncCutoffWithTournament}
                onChange={(e) =>
                  setForm({
                    ...form,
                    syncCutoffWithTournament: e.target.checked,
                  })
                }
                className="mt-1 h-5 w-5 shrink-0 accent-red-600"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-extrabold text-red-900">
                  {lang === 'ar'
                    ? `مزامنة خط التأهل تلقائياً مع عدد لاعبي البطولة (${tournamentTotalPlayers})`
                    : `Sync top-N cutoff with tournament totalPlayers (${tournamentTotalPlayers})`}
                </div>
                <p className="text-xs text-ink-muted">
                  {lang === 'ar'
                    ? 'عند التفعيل، أي تغيير في عدد لاعبي البطولة يحدّث خط التأهل في الاختبار تلقائياً.'
                    : 'When enabled, changing totalPlayers in Tournament Settings automatically updates the quiz cutoff.'}
                </p>
              </div>
            </label>

            {!form.syncCutoffWithTournament && (
              <div className="max-w-xs space-y-1.5 pt-1">
                <label
                  htmlFor="qs-custom-cutoff"
                  className="block text-xs font-bold text-red-900"
                >
                  {lang === 'ar' ? 'عدد المتأهلين المخصص (Top N)' : 'Custom Cutoff (Top N)'}
                </label>
                <Input
                  id="qs-custom-cutoff"
                  data-testid="quiz-setting-custom-cutoff"
                  type="number"
                  min={1}
                  max={5000}
                  value={form.customCutoffN}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customCutoffN: Math.max(1, Number(e.target.value) || 720),
                    })
                  }
                  className="min-h-[44px] text-base"
                />
              </div>
            )}

            <div className="inline-flex items-center gap-2 rounded-pill border border-outline/30 bg-white px-3 py-1 text-xs font-extrabold text-red-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-positive-ink" />
              <span>
                {lang === 'ar'
                  ? `خط التأهل الفعّال حالياً: أعلى ${effectiveCutoff} متقدم`
                  : `Effective Cutoff: Top ${effectiveCutoff} Applicants`}
              </span>
            </div>
          </div>
        </section>

        {/* Time Window & Quick Demo Presets */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-black text-red-900">
              {lang === 'ar' ? '٢. النافذة الزمنية للاختبار' : '2. Quiz Time Window'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="calm"
                size="sm"
                data-testid="quiz-window-preset-open"
                onClick={() => applyWindowPreset('open')}
              >
                <Sparkles className="h-3.5 w-3.5 text-positive-ink" />
                <span>{lang === 'ar' ? 'مفتوح الآن' : 'Preset: Open Now'}</span>
              </Button>
              <Button
                type="button"
                variant="calm"
                size="sm"
                data-testid="quiz-window-preset-upcoming"
                onClick={() => applyWindowPreset('upcoming')}
              >
                <span>{lang === 'ar' ? 'يفتح بعد ساعتين' : 'Preset: Upcoming'}</span>
              </Button>
              <Button
                type="button"
                variant="calm"
                size="sm"
                data-testid="quiz-window-preset-closed"
                onClick={() => applyWindowPreset('closed')}
              >
                <span>{lang === 'ar' ? 'مغلق (كشف الترتيب)' : 'Preset: Closed'}</span>
              </Button>
            </div>
          </div>

          <FormGrid columns={2}>
            <div className="space-y-1.5">
              <label
                htmlFor="qs-start"
                className="block text-sm font-bold text-red-900"
              >
                {lang === 'ar' ? 'وقت فتح الاختبار' : 'Opens At'}
              </label>
              <Input
                id="qs-start"
                type="datetime-local"
                dir="ltr"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="min-h-[46px] text-base"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="qs-end"
                className="block text-sm font-bold text-red-900"
              >
                {lang === 'ar' ? 'وقت إغلاق الاختبار' : 'Closes At'}
              </label>
              <Input
                id="qs-end"
                type="datetime-local"
                dir="ltr"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="min-h-[46px] text-base"
              />
            </div>
          </FormGrid>
        </section>

        {/* Verification, Rank Visibility & Retake Policy */}
        <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-5">
          <h2 className="text-base font-black text-red-900">
            {lang === 'ar'
              ? '٣. التحقق، عرض الترتيب، وسياسة الإعادة'
              : '3. Verification, Rank Visibility & Retake Policy'}
          </h2>

          <FormGrid columns={2}>
            <div className="space-y-1.5">
              <label
                htmlFor="qs-channel"
                className="block text-sm font-bold text-red-900"
              >
                {lang === 'ar' ? 'قناة التحقق المعروضة للمتقدم' : 'Verification Channel Wording'}
              </label>
              <select
                id="qs-channel"
                data-testid="quiz-setting-channel"
                value={form.verificationChannel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    verificationChannel: e.target.value as QuizVerificationChannel,
                  })
                }
                className="flex min-h-[46px] w-full rounded-input border-2 border-border-paper bg-white px-3 py-2 text-base font-semibold text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
              >
                {(
                  Object.keys(
                    QUIZ_VERIFICATION_CHANNEL_COPY
                  ) as QuizVerificationChannel[]
                ).map((ch) => (
                  <option key={ch} value={ch}>
                    {lang === 'ar'
                      ? QUIZ_VERIFICATION_CHANNEL_COPY[ch].labelAr
                      : QUIZ_VERIFICATION_CHANNEL_COPY[ch].labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="qs-demo-otp"
                className="block text-sm font-bold text-red-900"
              >
                {lang === 'ar' ? 'رمز التحقق التجريبي (Demo OTP)' : 'Demo Mode Test Code'}
              </label>
              <Input
                id="qs-demo-otp"
                type="text"
                dir="ltr"
                value={form.demoVerificationCode}
                onChange={(e) =>
                  setForm({ ...form, demoVerificationCode: e.target.value })
                }
                className="min-h-[46px] text-base font-bold"
              />
            </div>
          </FormGrid>

          <label className="flex cursor-pointer items-start gap-3 rounded-card border border-border-paper bg-paper p-4">
            <input
              type="checkbox"
              data-testid="quiz-setting-show-rank"
              checked={form.showRankImmediately}
              onChange={(e) =>
                setForm({ ...form, showRankImmediately: e.target.checked })
              }
              className="mt-1 h-5 w-5 shrink-0 accent-red-600"
            />
            <div className="space-y-0.5">
              <div className="text-sm font-extrabold text-red-900">
                {lang === 'ar'
                  ? 'إظهار الترتيب المبدئي وحالة التأهل فوراً على شاشة النتيجة'
                  : 'Reveal live rank & qualification immediately on /quiz/result'}
              </div>
              <p className="text-xs text-ink-muted">
                {lang === 'ar'
                  ? 'الوضع الافتراضي (مغلق): يرى المتقدم درجته وزمنه فوراً، ويُعلن الترتيب الرسمي بعد إغلاق النافذة.'
                  : 'Default (OFF): applicants see score and total time right away; official rank is revealed only after the window closes.'}
              </p>
            </div>
          </label>

          {/* Retake Policy Summary */}
          <div className="flex items-start gap-3 rounded-card border border-border-paper bg-paper p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-red-100 text-red-700">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-extrabold text-red-900">
                <span>{lang === 'ar' ? 'سياسة إعادة المحاولة:' : 'Retake Policy:'}</span>
                <Badge variant="gold">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'محاولة واحدة لكل شخص'
                      : 'Single Attempt per Person'}
                  </span>
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                {lang === 'ar'
                  ? 'لكل رقم هاتف أو بريد إلكتروني موثّق محاولة واحدة فقط. مدير البطولة (Super Admin) فقط يمكنه إعادة ضبط محاولة متقدم معين من صفحة النتائج مع كتابة السبب وتوثيقه في سجل المراجعة.'
                  : 'Strictly one attempt per verified phone or email. Only a Super Admin can reset an attempt from the Results table, requiring a reason and writing an immutable audit entry.'}
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving}
            data-testid="quiz-settings-save"
            className="w-full sm:w-auto min-h-[52px]"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>
              {saving
                ? lang === 'ar'
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : lang === 'ar'
                  ? 'حفظ إعدادات الاختبار'
                  : 'Save Quiz Settings'}
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}
