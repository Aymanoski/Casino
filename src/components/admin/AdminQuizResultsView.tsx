'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Flag,
  Mail,
  Phone,
  RotateCcw,
  Scissors,
  Search,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type {
  DerivedApplicantResultRow,
  DerivedQualificationStatus,
  DerivedQuizBoard,
} from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { quizRepo, type AdminQuizAttemptDetail } from '@/lib/repos';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { VirtualList, type VirtualListHandle } from '@/components/ui/virtual-list';
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
  getQuizStatusBadge,
  QUIZ_CATEGORY_LABELS,
} from '@/components/quiz/quizHelpers';

type VirtualTableEntry =
  | { kind: 'row'; row: DerivedApplicantResultRow }
  | { kind: 'cutoff_divider'; cutoffN: number };

function escapeCsvCell(val: string | number | null | undefined): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AdminQuizResultsView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [board, setBoard] = useState<DerivedQuizBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DerivedQualificationStatus>('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Modals / Drawers
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminQuizAttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Super Admin Reset Attempt Form inside Drawer
  const [resetReason, setResetReason] = useState('');
  const [resetting, setResetting] = useState(false);

  const listRef = useRef<VirtualListHandle | null>(null);

  const loadBoard = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const res = await quizRepo.getAdminResultsBoard(user.id);
      setBoard(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz results.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadBoard();
    const unsubs = [
      realtime.subscribe('quiz.started', loadBoard),
      realtime.subscribe('quiz.finished', loadBoard),
      realtime.subscribe('quiz.reset', loadBoard),
      realtime.subscribe('quiz.settingsUpdated', loadBoard),
      realtime.subscribe('quiz.handoffCompleted', loadBoard),
      realtime.subscribe('settings.updated', loadBoard),
      realtime.subscribe('data.reset', loadBoard),
    ];
    return () => unsubs.forEach((u) => u());
  }, [loadBoard]);

  const openApplicantDetail = async (applicantId: string) => {
    if (!user) return;
    setSelectedApplicantId(applicantId);
    setDetail(null);
    setResetReason('');
    setDetailLoading(true);
    try {
      const res = await quizRepo.getAdminApplicantDetail(applicantId, user.id);
      setDetail(res);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedApplicantId || !resetReason.trim()) return;
    setResetting(true);
    try {
      await quizRepo.resetAttempt({
        applicantId: selectedApplicantId,
        reason: resetReason.trim(),
        actorUserId: user.id,
      });
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تمت إعادة ضبط المحاولة' : 'Attempt Reset',
        description:
          lang === 'ar'
            ? 'تم تسجيل حدث إعادة الضبط في سجل المراجعة ويمكن للمتقدم بدء محاولة جديدة الآن.'
            : 'Audit entry logged. The applicant can now start a fresh attempt.',
      });
      setSelectedApplicantId(null);
      setDetail(null);
      await loadBoard();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر إعادة الضبط' : 'Reset Failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResetting(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!board) return [];
    const q = search.trim().toLowerCase();
    return board.rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (flaggedOnly && !row.isFlagged) return false;
      if (q) {
        const hay = `${row.applicant.fullName} ${row.applicant.fullNameAr} ${row.applicant.phone} ${row.applicant.email} ${row.rank ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [board, search, statusFilter, flaggedOnly]);

  // Inject visible cutoff line divider strictly between rank <= cutoffN and rank > cutoffN
  const { virtualEntries, cutoffEntryIndex } = useMemo(() => {
    if (!board) return { virtualEntries: [] as VirtualTableEntry[], cutoffEntryIndex: -1 };
    const entries: VirtualTableEntry[] = [];
    const cutoffN = board.stats.cutoffN;
    let inserted = false;
    let dividerIdx = -1;

    for (const row of filteredRows) {
      if (
        !inserted &&
        ((row.rank !== null && row.rank > cutoffN) || row.rank === null) &&
        entries.length > 0 &&
        entries[entries.length - 1].kind === 'row' &&
        (entries[entries.length - 1] as { kind: 'row'; row: DerivedApplicantResultRow }).row.qualified
      ) {
        dividerIdx = entries.length;
        entries.push({ kind: 'cutoff_divider', cutoffN });
        inserted = true;
      }
      entries.push({ kind: 'row', row });
    }
    return { virtualEntries: entries, cutoffEntryIndex: dividerIdx };
  }, [board, filteredRows]);

  const handleExportCsv = () => {
    const header = [
      'Rank',
      'FullName',
      'FullNameAr',
      'Phone',
      'Email',
      'Status',
      'Score',
      'TotalTimeMs',
      'SubmittedAt',
      'ClientSignalsTotal',
      'TabSwitches',
      'Refreshes',
      'CopyAttempts',
      'HandedOffPlayerId',
    ];
    const lines = [
      header.join(','),
      ...filteredRows.map((r) =>
        [
          r.rank ?? '',
          r.applicant.fullName,
          r.applicant.fullNameAr,
          r.applicant.phone,
          r.applicant.email,
          r.status,
          r.score ?? '',
          r.totalResponseTimeMs ?? '',
          r.submittedAt ?? '',
          r.integrity.total,
          r.integrity.visibilityHidden,
          r.integrity.pageRefresh,
          r.integrity.copyAttempt,
          r.handedOffPlayerId ?? '',
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casino-quiz-results-${filteredRows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-[520px] w-full rounded-card" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <AdminErrorBanner
        message={error ?? (lang === 'ar' ? 'تعذر تحميل النتائج.' : 'Failed to load results.')}
        onRetry={() => void loadBoard()}
        retryLabel={lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
      />
    );
  }

  const { stats } = board;

  return (
    <div className="space-y-6">
      <QuizDemoBanner surface="paper" />

      <AdminPageHeader
        title={lang === 'ar' ? 'نتائج المتقدمين وترحيل المتأهلين' : 'Quiz Results & Tournament Handoff'}
        description={
          lang === 'ar'
            ? 'جدول افتراضي سريع لأكثر من ١٢٠٠ متقدم مع خط التأهل الواضح، إشارات المتصفح، الجدول الزمني لكل سؤال، والترحيل للبطولة.'
            : 'Virtualized results table (1,200+ applicants) with live cutoff divider, client-side integrity signals, per-question timeline drawer, audited resets, and idempotent tournament handoff.'
        }
        actions={
          <>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setHandoffOpen(true)}
              data-testid="quiz-handoff-open-btn"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'ترحيل المتأهلين للبطولة'
                  : 'Send Qualified to Tournament'}
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleExportCsv}
              data-testid="quiz-export-csv-btn"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </Button>
          </>
        }
      />

      <AdminStatChipStrip
        items={[
          {
            id: 'res-total',
            value: stats.totalApplicants,
            label: lang === 'ar' ? 'إجمالي المتقدمين' : 'Applicants',
            detail:
              lang === 'ar'
                ? `${filteredRows.length} معروض بعد التصفية`
                : `${filteredRows.length} matching filters`,
            tone: 'red',
          },
          {
            id: 'res-qual',
            value: stats.qualifiedCount,
            label: lang === 'ar' ? `متأهل (أعلى ${stats.cutoffN})` : `Qualified (Top ${stats.cutoffN})`,
            detail:
              lang === 'ar'
                ? `${stats.handedOffCount} تم ترحيلهم للبطولة`
                : `${stats.handedOffCount} handed off`,
            tone: 'gold',
          },
          {
            id: 'res-wait',
            value: stats.waitlistedCount,
            label: lang === 'ar' ? 'قائمة الانتظار' : 'Waitlisted',
            detail:
              lang === 'ar'
                ? `${stats.abandonedCount + stats.inProgressCount} لم يكملوا`
                : `${stats.abandonedCount + stats.inProgressCount} incomplete`,
            tone: 'white',
          },
          {
            id: 'res-flag',
            value: stats.flaggedCount,
            label: lang === 'ar' ? 'إشارات متصفح (عرض)' : 'Client-Side Signals',
            detail:
              lang === 'ar'
                ? 'تبديل تبويب / تحديث / نسخ'
                : 'Tab switch / refresh / copy',
            tone: 'blue',
          },
        ]}
      />

      {/* Search, Filter & Jump-to-Cutoff Toolbar */}
      <div className="flex flex-col gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            data-testid="quiz-results-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث بالاسم أو الهاتف أو البريد أو المركز...'
                : 'Search name, phone, email, or rank...'
            }
            className="min-h-[44px] ps-9 text-base"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={lang === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | DerivedQualificationStatus)
            }
            className="min-h-[44px] rounded-input border-2 border-border-paper bg-white px-3 text-base font-bold text-ink"
          >
            <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
            <option value="qualified">{lang === 'ar' ? 'متأهل' : 'Qualified'}</option>
            <option value="waitlisted">{lang === 'ar' ? 'قائمة انتظار' : 'Waitlisted'}</option>
            <option value="in_progress">{lang === 'ar' ? 'قيد الحل' : 'In Progress'}</option>
            <option value="abandoned">{lang === 'ar' ? 'غير مكتمل' : 'Incomplete'}</option>
          </select>

          <button
            type="button"
            data-testid="quiz-filter-flagged"
            aria-pressed={flaggedOnly}
            onClick={() => setFlaggedOnly((v) => !v)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 px-3.5 text-xs font-extrabold transition-colors ${
              flaggedOnly
                ? 'border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                : 'border-border-paper bg-paper text-ink hover:bg-paper-2'
            }`}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? `إشارات متصفح (${stats.flaggedCount})`
                : `Client Signals (${stats.flaggedCount})`}
            </span>
          </button>

          {cutoffEntryIndex !== -1 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="quiz-jump-cutoff"
              onClick={() => listRef.current?.scrollToIndex(cutoffEntryIndex, 'auto')}
            >
              <Scissors className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? `الانتقال لخط التأهل (#${stats.cutoffN})`
                  : `Jump to Cutoff (#${stats.cutoffN})`}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Virtualized Results Container */}
      <div className="overflow-hidden rounded-card border border-border-paper bg-white shadow-soft">
        {/* Desktop Column Header */}
        <div className="hidden md:grid grid-cols-12 gap-2 border-b-2 border-outline/15 bg-paper px-4 py-2.5 text-xs font-extrabold uppercase text-red-900">
          <div className="col-span-1">{lang === 'ar' ? 'المركز' : 'Rank'}</div>
          <div className="col-span-3">{lang === 'ar' ? 'المتقدم والتواصل' : 'Applicant & Contact'}</div>
          <div className="col-span-2">{lang === 'ar' ? 'الدرجة والزمن' : 'Score & Time'}</div>
          <div className="col-span-2">{lang === 'ar' ? 'الحالة' : 'Status'}</div>
          <div className="col-span-2">
            {lang === 'ar' ? 'إشارات متصفح (عرض)' : 'Client Signals (Demo)'}
          </div>
          <div className="col-span-2 text-end">{lang === 'ar' ? 'التفاصيل' : 'Inspect'}</div>
        </div>

        <div className="p-2 sm:p-3" data-testid="quiz-results-virtual-list">
          <VirtualList<VirtualTableEntry>
            ref={listRef}
            items={virtualEntries}
            rowHeight={86}
            height={580}
            gap={8}
            overscan={6}
            ariaLabel={lang === 'ar' ? 'جدول نتائج متقدمي الاختبار' : 'Quiz applicant results'}
            getKey={(entry, idx) =>
              entry.kind === 'cutoff_divider'
                ? `cutoff-${entry.cutoffN}`
                : `${entry.row.applicant.id}-${idx}`
            }
            emptyState={
              <div className="py-12 text-center text-sm text-ink-muted">
                {lang === 'ar'
                  ? 'لا توجد نتائج مطابقة للبحث.'
                  : 'No applicants match the current filter.'}
              </div>
            }
            renderItem={(entry) => {
              if (entry.kind === 'cutoff_divider') {
                return (
                  <div
                    data-testid="quiz-cutoff-divider"
                    className="flex h-full items-center justify-center gap-3 rounded-card border-2 border-dashed border-red-600 bg-gold-200/55 px-4 text-center"
                  >
                    <Scissors className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-black uppercase text-red-900">
                      {lang === 'ar'
                        ? `خط التأهل الرسمي: أعلى ${entry.cutoffN} متقدم يتأهلون للبطولة — ما يلي في قائمة الانتظار`
                        : `OFFICIAL CUTOFF LINE: TOP ${entry.cutoffN} QUALIFY FOR TOURNAMENT — BELOW IS WAITLISTED`}
                    </span>
                  </div>
                );
              }

              const row = entry.row;
              const badge = getQuizStatusBadge(row.status, lang);

              return (
                <div className="grid h-full grid-cols-12 items-center gap-2 rounded-card border border-border-paper bg-white px-3 py-2 text-xs hover:bg-paper/70 transition-colors">
                  {/* Rank */}
                  <div className="col-span-2 md:col-span-1">
                    <span
                      className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-button px-2 font-score text-lg font-black tabular-nums ${
                        row.qualified
                          ? 'border border-outline bg-gold-300 text-red-900'
                          : 'bg-paper text-ink-muted'
                      }`}
                    >
                      {row.rank !== null ? `#${row.rank}` : '—'}
                    </span>
                  </div>

                  {/* Applicant + Admin-only Contact */}
                  <div className="col-span-6 md:col-span-3 min-w-0">
                    <div className="truncate text-sm font-extrabold text-red-900">
                      {lang === 'ar'
                        ? row.applicant.fullNameAr || row.applicant.fullName
                        : row.applicant.fullName}
                    </div>
                    <div className="truncate text-[11px] text-ink-muted" dir="ltr">
                      {row.applicant.phone} · {row.applicant.email}
                    </div>
                  </div>

                  {/* Score & Time */}
                  <div className="col-span-4 md:col-span-2 text-end md:text-start">
                    <div className="font-score text-lg font-black text-red-900 tabular-nums leading-none">
                      {row.score !== null
                        ? `${row.score}/${row.activeAttempt?.questionsCount ?? 20}`
                        : '—'}
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-ink-muted tabular-nums">
                      {row.totalResponseTimeMs !== null
                        ? formatResponseTimeMs(row.totalResponseTimeMs, lang)
                        : '—'}
                    </div>
                  </div>

                  {/* Status + Handoff Badge */}
                  <div className="hidden md:flex md:col-span-2 flex-wrap items-center gap-1">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {row.handedOffPlayerId && (
                      <Badge variant="gold">
                        {lang === 'ar' ? 'في البطولة' : 'In Roster'}
                      </Badge>
                    )}
                  </div>

                  {/* Client-side Integrity Signals */}
                  <div className="hidden md:flex md:col-span-2 items-center">
                    {row.isFlagged ? (
                      <Badge variant="negative">
                        <Flag className="h-3 w-3" aria-hidden="true" />
                        <span>
                          {lang === 'ar'
                            ? `${row.integrity.total} إشارة متصفح`
                            : `${row.integrity.total} client signal(s)`}
                        </span>
                      </Badge>
                    ) : (
                      <span className="text-[11px] font-semibold text-positive-ink">
                        {lang === 'ar' ? 'نظيف' : 'Clean'}
                      </span>
                    )}
                  </div>

                  {/* Inspect Button */}
                  <div className="col-span-12 md:col-span-2 flex items-center justify-between md:justify-end gap-2">
                    <div className="flex items-center gap-1 md:hidden">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {row.isFlagged && (
                        <Badge variant="negative">
                          <Flag className="h-3 w-3" /> {row.integrity.total}
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="calm"
                      size="sm"
                      disabled={!row.activeAttempt}
                      onClick={() => void openApplicantDetail(row.applicant.id)}
                      data-testid={`quiz-inspect-${row.applicant.id}`}
                      className="min-h-[36px]"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'السجل' : 'Timeline'}</span>
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* Applicant Per-Question Timeline Drawer / Dialog */}
      <Dialog
        open={Boolean(selectedApplicantId)}
        onOpenChange={(open) => !open && setSelectedApplicantId(null)}
      >
        <DialogContent
          data-testid="quiz-applicant-drawer"
          className="sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>
              {detail
                ? lang === 'ar'
                  ? detail.applicant.fullNameAr || detail.applicant.fullName
                  : detail.applicant.fullName
                : lang === 'ar'
                  ? 'تفاصيل المتقدم'
                  : 'Applicant Timeline'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'بيانات التواصل (للإدارة فقط)، إشارات المتصفح، والجدول الزمني المشتق لكل سؤال.'
                : 'Admin-only contact details, honest client-side signals, and pure event-derived per-question timeline.'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && <Skeleton className="h-64 w-full rounded-card" />}

          {!detailLoading && detail && (
            <div className="space-y-4">
              {/* Contact & Summary Card (Admin Only) */}
              <div className="rounded-card border border-border-paper bg-paper p-4 space-y-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.rank !== null && (
                      <Badge variant={detail.qualified ? 'positive' : 'neutral'}>
                        #{detail.rank}{' '}
                        {detail.qualified
                          ? lang === 'ar'
                            ? 'متأهل'
                            : 'Qualified'
                          : lang === 'ar'
                            ? 'انتظار'
                            : 'Waitlisted'}
                      </Badge>
                    )}
                    <Badge variant="gold">
                      {detail.derived.score}/{detail.derived.questionsCount} ·{' '}
                      {formatResponseTimeMs(detail.derived.totalResponseTimeMs, lang)}
                    </Badge>
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted">
                    seed: {detail.derived.attempt.shuffleSeed}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 text-xs font-semibold text-red-900">
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <Phone className="h-3.5 w-3.5 text-red-600" />
                    <span>{detail.applicant.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <Mail className="h-3.5 w-3.5 text-red-600" />
                    <span className="truncate">{detail.applicant.email}</span>
                  </div>
                </div>

                {detail.derived.submittedAt && (
                  <div className="text-[11px] text-ink-muted">
                    {lang === 'ar' ? 'وقت التسليم: ' : 'Submitted: '}
                    {formatQuizTimestamp(detail.derived.submittedAt, lang)}
                  </div>
                )}
              </div>

              {/* Honest Client-Side Signals Box */}
              <div className="rounded-card border border-border-paper bg-white p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-red-900">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    {lang === 'ar'
                      ? 'إشارات النزاهة من المتصفح (Client-side signals — عرض)'
                      : 'Client-Side Integrity Signals (Browser Demo)'}
                  </span>
                  <Badge variant={detail.derived.isFlagged ? 'negative' : 'positive'}>
                    {detail.derived.isFlagged
                      ? `${detail.derived.integrity.total} flag(s)`
                      : lang === 'ar'
                        ? 'بدون إشارات'
                        : 'None'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-button bg-paper p-2">
                    <div className="font-score text-lg font-black text-red-900">
                      {detail.derived.integrity.visibilityHidden}
                    </div>
                    <div className="text-[10px] font-bold text-ink-muted">
                      {lang === 'ar' ? 'مغادرة التبويب' : 'Tab Left'}
                    </div>
                  </div>
                  <div className="rounded-button bg-paper p-2">
                    <div className="font-score text-lg font-black text-red-900">
                      {detail.derived.integrity.pageRefresh}
                    </div>
                    <div className="text-[10px] font-bold text-ink-muted">
                      {lang === 'ar' ? 'إعادة تحميل' : 'Refreshes'}
                    </div>
                  </div>
                  <div className="rounded-button bg-paper p-2">
                    <div className="font-score text-lg font-black text-red-900">
                      {detail.derived.integrity.copyAttempt}
                    </div>
                    <div className="text-[10px] font-bold text-ink-muted">
                      {lang === 'ar' ? 'محاولة نسخ' : 'Copy Attempts'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Question Timeline */}
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-red-900">
                  {lang === 'ar'
                    ? 'الجدول الزمني للأسئلة (٢٠ سؤالاً):'
                    : 'Per-Question Event Timeline:'}
                </div>
                <div className="max-h-60 overflow-y-auto rounded-card border border-border-paper divide-y divide-border-paper text-xs">
                  {detail.derived.timeline.map((item) => {
                    const q = detail.questionsById[item.questionId];
                    const cat = q ? QUIZ_CATEGORY_LABELS[q.category] : null;
                    return (
                      <div
                        key={item.questionIndex}
                        className="flex items-start justify-between gap-3 px-3 py-2.5 bg-white"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 font-extrabold text-red-900">
                            <span>Q{item.questionIndex + 1}</span>
                            {cat && (
                              <span className="text-[10px] font-bold text-ink-muted">
                                · {lang === 'ar' ? cat.ar : cat.en}
                              </span>
                            )}
                          </div>
                          {q && (
                            <p className="line-clamp-1 text-ink-muted">
                              {lang === 'ar' ? q.questionAr : q.questionEn}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-ink-muted tabular-nums">
                            {item.outcome === 'pending' || item.outcome === 'unseen'
                              ? '—'
                              : formatResponseTimeMs(item.responseTimeMs, lang)}
                          </span>
                          {item.outcome === 'correct' && (
                            <Badge variant="positive">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{lang === 'ar' ? 'صحيح' : 'Correct'}</span>
                            </Badge>
                          )}
                          {item.outcome === 'wrong' && (
                            <Badge variant="negative">
                              <XCircle className="h-3 w-3" />
                              <span>{lang === 'ar' ? 'خطأ' : 'Wrong'}</span>
                            </Badge>
                          )}
                          {item.outcome === 'timed_out' && (
                            <Badge variant="gold">
                              <Clock className="h-3 w-3" />
                              <span>{lang === 'ar' ? 'انتهى الوقت' : 'Timeout'}</span>
                            </Badge>
                          )}
                          {(item.outcome === 'pending' || item.outcome === 'unseen') && (
                            <Badge variant="neutral">
                              {lang === 'ar' ? 'لم يُجب' : 'Unanswered'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Super Admin Audited Attempt Reset */}
              <form
                onSubmit={handleResetAttempt}
                className="rounded-card border-2 border-negative/40 bg-negative-soft/40 p-4 space-y-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
                  <AlertTriangle className="h-4 w-4 text-negative" />
                  <span>
                    {lang === 'ar'
                      ? 'إعادة ضبط المحاولة (صلاحية مدير البطولة فقط · موثّق في سجل المراجعة)'
                      : 'Reset Attempt (Super Admin Only · Audited)'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="text"
                    required
                    minLength={3}
                    data-testid="quiz-reset-reason-input"
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'اكتب سبب إعادة الضبط (مثال: انقطاع تقني موثّق)...'
                        : 'Enter audit reason (e.g. Verified connection outage)...'
                    }
                    className="flex-1 bg-white text-base"
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={resetting || resetReason.trim().length < 3}
                    data-testid="quiz-reset-attempt-btn"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>
                      {resetting
                        ? lang === 'ar'
                          ? 'جاري الضبط...'
                          : 'Resetting...'
                        : lang === 'ar'
                          ? 'إعادة ضبط المحاولة'
                          : 'Reset Attempt'}
                    </span>
                  </Button>
                </div>
              </form>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelectedApplicantId(null)}
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuizHandoffDialog
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
        onCompleted={() => void loadBoard()}
      />
    </div>
  );
}
