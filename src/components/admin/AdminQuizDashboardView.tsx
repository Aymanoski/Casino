'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock,
  ExternalLink,
  Flag,
  Send,
  Sliders,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { QuizDashboardStats, QuizWindowState } from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { quizRepo } from '@/lib/repos';
import type { QuizSettings } from '@/lib/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { QuizHandoffDialog } from './QuizHandoffDialog';
import { QuizDemoBanner } from '@/components/quiz/QuizDemoBanner';
import {
  formatQuizTimestamp,
  formatResponseTimeMs,
  getWindowStatusCopy,
  QUIZ_CATEGORY_LABELS,
} from '@/components/quiz/quizHelpers';

interface DashboardPayload {
  stats: QuizDashboardStats;
  windowState: QuizWindowState;
  settings: QuizSettings;
  tournamentTotalPlayers: number;
  bankSummary: {
    total: number;
    approved: number;
    draft: number;
    usingDraftFallback: boolean;
    byCategory: Record<string, number>;
  };
}

export function AdminQuizDashboardView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const res = await quizRepo.getAdminDashboard(user.id);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz dashboard.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDashboard();
    const unsubs = [
      realtime.subscribe('quiz.started', loadDashboard),
      realtime.subscribe('quiz.finished', loadDashboard),
      realtime.subscribe('quiz.reset', loadDashboard),
      realtime.subscribe('quiz.questionUpdated', loadDashboard),
      realtime.subscribe('quiz.settingsUpdated', loadDashboard),
      realtime.subscribe('quiz.handoffCompleted', loadDashboard),
      realtime.subscribe('settings.updated', loadDashboard),
      realtime.subscribe('data.reset', loadDashboard),
    ];
    return () => unsubs.forEach((u) => u());
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 w-full rounded-card" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <AdminErrorBanner
        message={error ?? (lang === 'ar' ? 'تعذر تحميل لوحة الاختبار.' : 'Unable to load quiz dashboard.')}
        onRetry={() => void loadDashboard()}
        retryLabel={lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
      />
    );
  }

  const { stats, windowState, settings, bankSummary } = data;
  const windowCopy = getWindowStatusCopy(windowState.status, lang);
  const maxBinCount = Math.max(
    1,
    ...stats.scoreHistogram.map((b) => b.totalCount)
  );

  return (
    <div className="space-y-6">
      <QuizDemoBanner surface="paper" />

      <AdminPageHeader
        title={lang === 'ar' ? 'لوحة اختبار التأهيل للبطولة' : 'Registration Quiz Dashboard'}
        description={
          lang === 'ar'
            ? 'نظرة شاملة على المتقدمين، نسبة الإكمال، توزيع الدرجات، خط التأهل، وترحيل المتأهلين للبطولة.'
            : 'Live overview of applicants, completion rates, score distribution, top-N cutoff, and tournament handoff.'
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
        actions={
          <>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setHandoffOpen(true)}
              data-testid="quiz-dashboard-handoff-btn"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'ترحيل المتأهلين للبطولة'
                  : 'Send Qualified to Tournament'}
              </span>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link href="/quiz" target="_blank">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>{lang === 'ar' ? 'معاينة شاشة المتقدم' : 'Open /quiz'}</span>
              </Link>
            </Button>
          </>
        }
      />

      {/* Draft Review Alert */}
      {bankSummary.usingDraftFallback && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-card border-2 border-gold-500 bg-gold-200/35 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
            <div className="text-sm text-red-900">
              <strong className="block font-extrabold">
                {lang === 'ar'
                  ? `${bankSummary.draft} سؤالاً بانتظار المراجعة البشرية (مسودة)`
                  : `${bankSummary.draft} Seeded Questions Need Human Review (Draft)`}
              </strong>
              <span className="text-xs text-ink-muted">
                {lang === 'ar'
                  ? `المعتمد حالياً: ${bankSummary.approved} من أصل ${settings.questionsPerAttempt} مطلوبة. في وضع العرض التجريبي يتم السحب من المسودات حتى يتم اعتماد ${settings.questionsPerAttempt}+ سؤالاً.`
                  : `Currently ${bankSummary.approved} approved (${settings.questionsPerAttempt} required). Demo Mode falls back to draft questions until a human reviews & approves at least ${settings.questionsPerAttempt}.`}
              </span>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm" className="shrink-0">
            <Link href="/admin/quiz/questions?review=draft">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'مراجعة الأسئلة' : 'Review Questions'}</span>
            </Link>
          </Button>
        </div>
      )}

      {/* Key KPI Casino Chips */}
      <AdminStatChipStrip
        items={[
          {
            id: 'applicants',
            value: stats.totalApplicants,
            label: lang === 'ar' ? 'إجمالي المتقدمين' : 'Total Applicants',
            detail:
              lang === 'ar'
                ? `${stats.finishedCount} مكتمل · ${stats.abandonedCount + stats.inProgressCount} غير مكتمل`
                : `${stats.finishedCount} finished · ${stats.abandonedCount + stats.inProgressCount} incomplete`,
            tone: 'red',
          },
          {
            id: 'completion',
            value: `${stats.completionRate}%`,
            label: lang === 'ar' ? 'نسبة إكمال الاختبار' : 'Completion Rate',
            detail:
              lang === 'ar'
                ? `${stats.totalActiveAttempts} محاولة نشطة (${stats.resetAttemptsCount} أُعيد ضبطها)`
                : `${stats.totalActiveAttempts} active attempts (${stats.resetAttemptsCount} reset)`,
            tone: 'blue',
          },
          {
            id: 'average',
            value: stats.averageScore,
            label:
              lang === 'ar'
                ? `متوسط الدرجات (من ${settings.questionsPerAttempt})`
                : `Average Score (of ${settings.questionsPerAttempt})`,
            detail:
              lang === 'ar'
                ? `متوسط الزمن: ${formatResponseTimeMs(stats.averageResponseTimeMs, lang)}`
                : `Avg time: ${formatResponseTimeMs(stats.averageResponseTimeMs, lang)}`,
            tone: 'gold',
          },
          {
            id: 'cutoff',
            value: stats.cutoffN,
            label: lang === 'ar' ? 'خط التأهل (أعلى N)' : 'Top-N Cutoff',
            detail:
              lang === 'ar'
                ? `${stats.qualifiedCount} متأهل · ${stats.handedOffCount} تم ترحيلهم`
                : `${stats.qualifiedCount} qualified · ${stats.handedOffCount} handed off`,
            tone: 'white',
          },
        ]}
      />

      {/* Score Histogram with Visible Cutoff Line */}
      <section
        aria-labelledby="histogram-title"
        data-testid="admin-quiz-histogram"
        className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h2 id="histogram-title" className="text-lg font-black text-red-900">
                {lang === 'ar'
                  ? 'توزيع درجات المتقدمين وخط التأهل'
                  : 'Score Distribution & Qualification Cutoff Line'}
              </h2>
            </div>
            <p className="text-xs text-ink-muted">
              {stats.cutoffScore !== null
                ? lang === 'ar'
                  ? `خط التأهل الحالي (المركز #${stats.cutoffN}): درجة ${stats.cutoffScore}/${settings.questionsPerAttempt} بزمن ${formatResponseTimeMs(stats.cutoffTimeMs ?? 0, lang)} أو أسرع.`
                  : `Current cutoff (#${stats.cutoffN}): score ${stats.cutoffScore}/${settings.questionsPerAttempt} in ${formatResponseTimeMs(stats.cutoffTimeMs ?? 0, lang)} or faster.`
                : lang === 'ar'
                  ? 'لا توجد محاولات مكتملة بعد.'
                  : 'No completed attempts yet.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-positive-ink">
              <span className="h-3 w-3 rounded-sm bg-positive" aria-hidden="true" />
              {lang === 'ar' ? `متأهل (${stats.qualifiedCount})` : `Qualified (${stats.qualifiedCount})`}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span className="h-3 w-3 rounded-sm bg-red-900/25" aria-hidden="true" />
              {lang === 'ar' ? `انتظار (${stats.waitlistedCount})` : `Waitlisted (${stats.waitlistedCount})`}
            </span>
            {stats.cutoffScore !== null && (
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <span className="h-3 w-0.5 bg-red-600" aria-hidden="true" />
                {lang === 'ar' ? `خط القطع (${stats.cutoffScore})` : `Cutoff (${stats.cutoffScore})`}
              </span>
            )}
          </div>
        </div>

        {/* Horizontal scroll guard on narrow phones, full fluid bars on md+ */}
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[540px] items-end gap-1.5 pt-6 h-56 px-1">
            {stats.scoreHistogram.map((bin) => {
              const totalPct = Math.round((bin.totalCount / maxBinCount) * 100);
              const qualPct =
                bin.totalCount > 0
                  ? Math.round((bin.qualifiedCount / bin.totalCount) * 100)
                  : 0;
              const isCutoffBin = stats.cutoffScore === bin.score;

              return (
                <div
                  key={bin.score}
                  className="relative flex h-full flex-1 flex-col items-center justify-end gap-1"
                  title={
                    lang === 'ar'
                      ? `الدرجة ${bin.score}: ${bin.totalCount} متقدم (${bin.qualifiedCount} متأهل، ${bin.waitlistedCount} انتظار)`
                      : `Score ${bin.score}: ${bin.totalCount} total (${bin.qualifiedCount} qualified, ${bin.waitlistedCount} waitlisted)`
                  }
                >
                  {isCutoffBin && (
                    <div
                      data-testid="histogram-cutoff-marker"
                      className="pointer-events-none absolute inset-y-0 start-0 z-10 border-s-2 border-dashed border-red-600"
                    >
                      <span className="absolute -top-6 start-1 whitespace-nowrap rounded-pill border border-outline bg-gold-300 px-2 py-0.5 text-[10px] font-black text-red-900 shadow-sticker-sm">
                        {lang === 'ar' ? `القطع #${stats.cutoffN}` : `Cutoff #${stats.cutoffN}`}
                      </span>
                    </div>
                  )}

                  <span className="text-[10px] font-bold text-ink-muted tabular-nums">
                    {bin.totalCount > 0 ? bin.totalCount : ''}
                  </span>

                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-t-md border border-border-paper bg-red-900/15"
                    style={{
                      height: `${Math.max(bin.totalCount > 0 ? 6 : 2, totalPct)}%`,
                    }}
                  >
                    {bin.qualifiedCount > 0 && (
                      <div
                        className="w-full bg-positive transition-[height]"
                        style={{ height: `${qualPct}%` }}
                      />
                    )}
                  </div>

                  <span
                    className={`text-[11px] font-extrabold tabular-nums ${
                      isCutoffBin ? 'text-red-700' : 'text-ink-muted'
                    }`}
                  >
                    {bin.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom 2-Column Operations Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Window & Integrity Summary */}
        <div className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-black text-red-900">
              {lang === 'ar' ? 'نافذة الاختبار وإشارات النزاهة' : 'Time Window & Integrity Signals'}
            </h2>
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/quiz/settings">
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'تعديل الإعدادات' : 'Settings'}</span>
              </Link>
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-card border border-border-paper bg-paper p-3">
              <dt className="text-xs font-bold text-ink-muted">
                {lang === 'ar' ? 'فتح النافذة' : 'Opens'}
              </dt>
              <dd className="mt-0.5 font-extrabold text-red-900">
                {formatQuizTimestamp(settings.windowStartsAt, lang)}
              </dd>
            </div>
            <div className="rounded-card border border-border-paper bg-paper p-3">
              <dt className="text-xs font-bold text-ink-muted">
                {lang === 'ar' ? 'إغلاق النافذة' : 'Closes'}
              </dt>
              <dd className="mt-0.5 font-extrabold text-red-900">
                {formatQuizTimestamp(settings.windowEndsAt, lang)}
              </dd>
            </div>
            <div className="rounded-card border border-border-paper bg-paper p-3">
              <dt className="text-xs font-bold text-ink-muted flex items-center gap-1">
                <Flag className="h-3.5 w-3.5 text-negative" aria-hidden="true" />
                {lang === 'ar' ? 'إشارات متصفح (عرض)' : 'Client-side Signals'}
              </dt>
              <dd className="mt-0.5 font-score text-2xl font-black text-red-900 tabular-nums">
                {stats.flaggedCount}
              </dd>
            </div>
            <div className="rounded-card border border-border-paper bg-paper p-3">
              <dt className="text-xs font-bold text-ink-muted">
                {lang === 'ar' ? 'تزامن حد التأهل' : 'Cutoff Sync'}
              </dt>
              <dd className="mt-0.5 font-extrabold text-red-900">
                {settings.syncCutoffWithTournament
                  ? lang === 'ar'
                    ? `متزامن مع البطولة (${data.tournamentTotalPlayers})`
                    : `Synced (${data.tournamentTotalPlayers})`
                  : lang === 'ar'
                    ? `مخصص (${settings.customCutoffN})`
                    : `Custom (${settings.customCutoffN})`}
              </dd>
            </div>
          </dl>

          <Button asChild variant="secondary" size="md" className="w-full">
            <Link href="/admin/quiz/results">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? `عرض جدول النتائج الكامل (${stats.totalApplicants} متقدم)`
                  : `Open Full Results Table (${stats.totalApplicants} Applicants)`}
              </span>
            </Link>
          </Button>
        </div>

        {/* Question Bank Breakdown */}
        <div className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-black text-red-900">
              {lang === 'ar' ? 'حالة بنك الأسئلة' : 'Question Bank Summary'}
            </h2>
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/quiz/questions">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'إدارة البنك' : 'Manage Bank'}</span>
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['general', 'egyptian_cinema', 'music', 'wordplay_logic'] as const).map(
              (cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between rounded-card border border-border-paper bg-paper p-3"
                >
                  <span className="text-xs sm:text-sm font-bold text-red-900">
                    {lang === 'ar'
                      ? QUIZ_CATEGORY_LABELS[cat].ar
                      : QUIZ_CATEGORY_LABELS[cat].en}
                  </span>
                  <Badge variant={QUIZ_CATEGORY_LABELS[cat].badgeVariant}>
                    {bankSummary.byCategory[cat] ?? 0}
                  </Badge>
                </div>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border-paper bg-paper px-3.5 py-2.5 text-xs font-bold">
            <span className="text-ink-muted">
              {lang === 'ar'
                ? `الإجمالي: ${bankSummary.total} سؤال`
                : `Total: ${bankSummary.total} questions`}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="positive">
                {lang === 'ar'
                  ? `معتمد: ${bankSummary.approved}`
                  : `Approved: ${bankSummary.approved}`}
              </Badge>
              <Badge variant="gold">
                {lang === 'ar'
                  ? `بانتظار المراجعة: ${bankSummary.draft}`
                  : `Draft: ${bankSummary.draft}`}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <QuizHandoffDialog
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
        onCompleted={() => void loadDashboard()}
      />
    </div>
  );
}
