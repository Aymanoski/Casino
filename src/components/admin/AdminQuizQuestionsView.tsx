'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { buildPublicQuestionPayload } from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { quizRepo } from '@/lib/repos';
import type {
  QuizCategory,
  QuizDifficulty,
  QuizQuestion,
  QuizReviewStatus,
} from '@/lib/schemas';
import type { QuizQuestionInput } from '@/lib/commands';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { QuizDemoBanner } from '@/components/quiz/QuizDemoBanner';
import {
  QUIZ_CATEGORY_LABELS,
  QUIZ_DIFFICULTY_LABELS,
} from '@/components/quiz/quizHelpers';

const CATEGORIES: QuizCategory[] = [
  'general',
  'egyptian_cinema',
  'music',
  'wordplay_logic',
];
const DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard'];

const SAMPLE_IMPORT_CSV = `category,difficulty,reviewStatus,questionAr,questionEn,option1Ar,option2Ar,option3Ar,option4Ar,option1En,option2En,option3En,option4En,correctIndex
general,easy,draft,ما هو أكبر كوكب في المجموعة الشمسية؟,What is the largest planet in our solar system?,المريخ,المشتري,زحل,الأرض,Mars,Jupiter,Saturn,Earth,2
egyptian_cinema,medium,draft,من هو بطل فيلم عسل أسود (٢٠١٠)؟,Who starred in the 2010 Egyptian film "Assal Eswed"?,أحمد حلمي,أحمد السقا,كريم عبد العزيز,أحمد عز,Ahmed Helmy,Ahmed El Sakka,Karim Abdel Aziz,Ahmed Ezz,1
wordplay_logic,easy,draft,كم يساوي ٩ × ٩؟,What is 9 × 9?,٧٢,٨١,٩٠,٩٩,72,81,90,99,2
invalid_cat,easy,draft,سؤال غير صالح للاختبار,Invalid category test row,أ,ب,ج,د,A,B,C,D,1`;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

interface ParsedCsvRow {
  rowNum: number;
  valid: boolean;
  error?: string;
  data?: QuizQuestionInput;
}

function parseQuestionsCsv(raw: string): ParsedCsvRow[] {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const startIdx = lines[0].toLowerCase().includes('questionar') ? 1 : 0;
  const rows: ParsedCsvRow[] = [];

  for (let i = startIdx; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const rowNum = i + 1;
    if (cols.length < 14) {
      rows.push({
        rowNum,
        valid: false,
        error: `Expected 14 columns, found ${cols.length}.`,
      });
      continue;
    }
    const [
      cat,
      diff,
      rev,
      qAr,
      qEn,
      o1Ar,
      o2Ar,
      o3Ar,
      o4Ar,
      o1En,
      o2En,
      o3En,
      o4En,
      correctRaw,
    ] = cols;

    if (!CATEGORIES.includes(cat as QuizCategory)) {
      rows.push({
        rowNum,
        valid: false,
        error: `Invalid category "${cat}". Use: ${CATEGORIES.join(', ')}.`,
      });
      continue;
    }
    if (!DIFFICULTIES.includes(diff as QuizDifficulty)) {
      rows.push({
        rowNum,
        valid: false,
        error: `Invalid difficulty "${diff}". Use: easy, medium, hard.`,
      });
      continue;
    }
    const reviewStatus: QuizReviewStatus =
      rev === 'approved' ? 'approved' : 'draft';
    const correctNum = Number(correctRaw);
    // Accept 1..4 (human CSV convention)
    if (!Number.isInteger(correctNum) || correctNum < 1 || correctNum > 4) {
      rows.push({
        rowNum,
        valid: false,
        error: `correctIndex must be 1, 2, 3, or 4 (got "${correctRaw}").`,
      });
      continue;
    }
    if (!qAr || !qEn || !o1Ar || !o2Ar || !o3Ar || !o4Ar || !o1En || !o2En || !o3En || !o4En) {
      rows.push({
        rowNum,
        valid: false,
        error: 'Both Arabic and English question text and all 4 options are required.',
      });
      continue;
    }

    rows.push({
      rowNum,
      valid: true,
      data: {
        category: cat as QuizCategory,
        difficulty: diff as QuizDifficulty,
        reviewStatus,
        questionAr: qAr,
        questionEn: qEn,
        optionsAr: [o1Ar, o2Ar, o3Ar, o4Ar],
        optionsEn: [o1En, o2En, o3En, o4En],
        correctOptionIndex: correctNum - 1,
      },
    });
  }
  return rows;
}

function emptyQuestionForm(): QuizQuestionInput {
  return {
    category: 'general',
    difficulty: 'medium',
    reviewStatus: 'draft',
    questionAr: '',
    questionEn: '',
    optionsAr: ['', '', '', ''],
    optionsEn: ['', '', '', ''],
    correctOptionIndex: 0,
    explanationAr: '',
    explanationEn: '',
  };
}

export function AdminQuizQuestionsView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState(20);
  const [usingDraftFallback, setUsingDraftFallback] = useState(true);
  const [approvedCount, setApprovedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | QuizCategory>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | QuizDifficulty>('all');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);

  // Editor Dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuizQuestionInput>(emptyQuestionForm);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<QuizQuestion | null>(null);

  // Shuffled Applicant Preview Dialog
  const [previewQuestion, setPreviewQuestion] = useState<QuizQuestion | null>(null);
  const [previewSeedIdx, setPreviewSeedIdx] = useState(1);
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>('ar');

  // CSV Import Dialog
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('review') === 'draft') {
        setNeedsReviewOnly(true);
      }
    }
  }, []);

  const loadBank = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const data = await quizRepo.listQuestionsForAdmin(user.id);
      setQuestions(data.questions);
      setQuestionsPerAttempt(data.questionsPerAttempt);
      setUsingDraftFallback(data.usingDraftFallback);
      setApprovedCount(data.approvedCount);
      setDraftCount(data.draftCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question bank.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadBank();
    const u1 = realtime.subscribe('quiz.questionUpdated', loadBank);
    const u2 = realtime.subscribe('data.reset', loadBank);
    return () => {
      u1();
      u2();
    };
  }, [loadBank]);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (needsReviewOnly && item.reviewStatus !== 'draft') return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (difficultyFilter !== 'all' && item.difficulty !== difficultyFilter) return false;
      if (q) {
        const hay = `${item.questionAr} ${item.questionEn} ${item.optionsAr.join(' ')} ${item.optionsEn.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [questions, search, categoryFilter, difficultyFilter, needsReviewOnly]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyQuestionForm());
    setEditorOpen(true);
  };

  const openEdit = (q: QuizQuestion) => {
    setEditingId(q.id);
    setForm({
      category: q.category,
      difficulty: q.difficulty,
      reviewStatus: q.reviewStatus,
      questionAr: q.questionAr,
      questionEn: q.questionEn,
      optionsAr: [...q.optionsAr] as [string, string, string, string],
      optionsEn: [...q.optionsEn] as [string, string, string, string],
      correctOptionIndex: q.correctOptionIndex,
      explanationAr: q.explanationAr ?? '',
      explanationEn: q.explanationEn ?? '',
    });
    setEditorOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      if (editingId) {
        await quizRepo.updateQuestion(editingId, form, user.id);
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم تحديث السؤال' : 'Question Updated',
        });
      } else {
        await quizRepo.createQuestion(form, user.id);
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تمت إضافة السؤال بنجاح' : 'Question Created',
        });
      }
      setEditorOpen(false);
      await loadBank();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر الحفظ' : 'Save Failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApprove = async (q: QuizQuestion) => {
    if (!user) return;
    const nextStatus: QuizReviewStatus =
      q.reviewStatus === 'approved' ? 'draft' : 'approved';
    await quizRepo.updateQuestion(q.id, { reviewStatus: nextStatus }, user.id);
    toast({
      variant: 'positive',
      title:
        nextStatus === 'approved'
          ? lang === 'ar'
            ? 'تم اعتماد السؤال'
            : 'Question Approved'
          : lang === 'ar'
            ? 'تمت إعادته للمسودة'
            : 'Returned to Draft',
    });
    await loadBank();
  };

  const handleApproveFiltered = async () => {
    if (!user) return;
    const draftIds = filteredQuestions
      .filter((q) => q.reviewStatus === 'draft')
      .map((q) => q.id);
    if (draftIds.length === 0) return;
    const count = await quizRepo.bulkSetQuestionsReviewStatus(
      draftIds,
      'approved',
      user.id
    );
    toast({
      variant: 'positive',
      title:
        lang === 'ar'
          ? `تم اعتماد ${count} سؤالاً`
          : `Approved ${count} Question(s)`,
    });
    await loadBank();
  };

  const handleDeleteConfirm = async () => {
    if (!user || !deleteTarget) return;
    try {
      await quizRepo.deleteQuestion(deleteTarget.id, user.id);
      toast({
        variant: 'positive',
        title: lang === 'ar' ? 'تم حذف السؤال' : 'Question Deleted',
      });
      setDeleteTarget(null);
      await loadBank();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'لا يمكن الحذف' : 'Cannot Delete',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const parsedCsvRows = useMemo(() => parseQuestionsCsv(csvText), [csvText]);
  const validCsvRows = useMemo(
    () => parsedCsvRows.filter((r) => r.valid && r.data).map((r) => r.data!),
    [parsedCsvRows]
  );
  const invalidCsvRows = useMemo(
    () => parsedCsvRows.filter((r) => !r.valid),
    [parsedCsvRows]
  );

  const handleCsvImport = async () => {
    if (!user || validCsvRows.length === 0) return;
    setImporting(true);
    try {
      const created = await quizRepo.bulkImportQuestions(validCsvRows, user.id);
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? `تم استيراد ${created.length} سؤالاً بنجاح`
            : `Imported ${created.length} Question(s)`,
      });
      setCsvText('');
      setImportOpen(false);
      await loadBank();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل الاستيراد' : 'Import Failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([`\uFEFF${SAMPLE_IMPORT_CSV}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'casino-quiz-questions-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const shuffledPreviewPayload = useMemo(() => {
    if (!previewQuestion) return null;
    return buildPublicQuestionPayload(
      previewQuestion,
      `preview-attempt-${previewSeedIdx}`,
      0,
      `demo-preview-seed-${previewSeedIdx}`
    );
  }, [previewQuestion, previewSeedIdx]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (error) {
    return (
      <AdminErrorBanner
        message={error}
        onRetry={() => void loadBank()}
        retryLabel={lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <QuizDemoBanner surface="paper" />

      <AdminPageHeader
        title={lang === 'ar' ? 'بنك أسئلة اختبار التسجيل' : 'Quiz Question Bank'}
        description={
          lang === 'ar'
            ? 'إنشاء وتعديل واستيراد الأسئلة باللغتين العربية والإنجليزية، ومراجعة المسودات ومعاينة الترتيب العشوائي.'
            : 'Create, edit, CSV-import, and human-review bilingual Arabic & English questions with shuffled applicant preview.'
        }
        actions={
          <>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openCreate}
              data-testid="quiz-add-question-btn"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'إضافة سؤال' : 'Add Question'}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setImportOpen(true)}
              data-testid="quiz-import-csv-btn"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'استيراد CSV' : 'Import CSV'}</span>
            </Button>
          </>
        }
      />

      {usingDraftFallback && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-card border-2 border-gold-500 bg-gold-200/35 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
            <div className="text-sm text-red-900">
              <strong className="font-extrabold">
                {lang === 'ar'
                  ? 'وضع المسودة نشط للمراجعة البشرية'
                  : 'All Seeded Questions Start as Draft for Human Review'}
              </strong>
              <p className="text-xs text-ink-muted mt-0.5">
                {lang === 'ar'
                  ? `الأسئلة المعتمدة حالياً (${approvedCount}) أقل من المطلوب للمحاولة (${questionsPerAttempt}). يرجى مراجعة دقة المعلومات والصياغة العربية واعتمادها قبل الإطلاق.`
                  : `Approved questions (${approvedCount}) are below ${questionsPerAttempt}. In Demo Mode, /quiz/play falls back to draft questions until a human editor verifies facts & Arabic phrasing and approves them.`}
              </p>
            </div>
          </div>
          {filteredQuestions.some((q) => q.reviewStatus === 'draft') && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleApproveFiltered()}
              className="shrink-0"
            >
              <CheckCircle2 className="h-4 w-4 text-positive-ink" />
              <span>
                {lang === 'ar'
                  ? `اعتماد المعروض (${filteredQuestions.filter((q) => q.reviewStatus === 'draft').length})`
                  : `Approve Shown (${filteredQuestions.filter((q) => q.reviewStatus === 'draft').length})`}
              </span>
            </Button>
          )}
        </div>
      )}

      <AdminStatChipStrip
        items={[
          {
            id: 'total-q',
            value: questions.length,
            label: lang === 'ar' ? 'إجمالي الأسئلة' : 'Total Questions',
            tone: 'red',
          },
          {
            id: 'draft-q',
            value: draftCount,
            label: lang === 'ar' ? 'بانتظار المراجعة (مسودة)' : 'Needs Human Review',
            tone: 'gold',
          },
          {
            id: 'approved-q',
            value: approvedCount,
            label: lang === 'ar' ? 'أسئلة معتمدة' : 'Approved',
            tone: 'blue',
          },
          {
            id: 'req-q',
            value: questionsPerAttempt,
            label: lang === 'ar' ? 'لكل محاولة' : 'Per Attempt',
            tone: 'white',
          },
        ]}
      />

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث في نص السؤال أو الخيارات (عربي / إنجليزي)...'
                : 'Search Arabic or English question text & options...'
            }
            className="min-h-[44px] ps-9 text-base"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={lang === 'ar' ? 'تصفية حسب الفئة' : 'Filter by category'}
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as 'all' | QuizCategory)
            }
            className="min-h-[44px] rounded-input border-2 border-border-paper bg-white px-3 text-base font-bold text-ink"
          >
            <option value="all">
              {lang === 'ar' ? 'كل الفئات' : 'All Categories'}
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {lang === 'ar'
                  ? QUIZ_CATEGORY_LABELS[c].ar
                  : QUIZ_CATEGORY_LABELS[c].en}
              </option>
            ))}
          </select>

          <select
            aria-label={lang === 'ar' ? 'تصفية حسب الصعوبة' : 'Filter by difficulty'}
            value={difficultyFilter}
            onChange={(e) =>
              setDifficultyFilter(e.target.value as 'all' | QuizDifficulty)
            }
            className="min-h-[44px] rounded-input border-2 border-border-paper bg-white px-3 text-base font-bold text-ink"
          >
            <option value="all">
              {lang === 'ar' ? 'كل المستويات' : 'All Difficulties'}
            </option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {lang === 'ar'
                  ? QUIZ_DIFFICULTY_LABELS[d].ar
                  : QUIZ_DIFFICULTY_LABELS[d].en}
              </option>
            ))}
          </select>

          <button
            type="button"
            data-testid="quiz-filter-needs-review"
            aria-pressed={needsReviewOnly}
            onClick={() => setNeedsReviewOnly((v) => !v)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 px-3.5 text-xs font-extrabold transition-colors ${
              needsReviewOnly
                ? 'border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                : 'border-border-paper bg-paper text-ink hover:bg-paper-2'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? `يحتاج مراجعة بشرية (${draftCount})`
                : `Needs Human Review (${draftCount})`}
            </span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3" data-testid="quiz-questions-list">
        {filteredQuestions.length === 0 ? (
          <div className="rounded-card border border-border-paper bg-white p-10 text-center text-sm text-ink-muted">
            {lang === 'ar'
              ? 'لا توجد أسئلة مطابقة لخيارات التصفية.'
              : 'No questions match your current filters.'}
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const cat = QUIZ_CATEGORY_LABELS[q.category];
            const diff = QUIZ_DIFFICULTY_LABELS[q.difficulty];
            return (
              <article
                key={q.id}
                className="rounded-card border border-border-paper bg-white p-4 sm:p-5 shadow-soft space-y-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-ink-muted">
                        {q.id}
                      </span>
                      <Badge variant={cat.badgeVariant}>
                        {lang === 'ar' ? cat.ar : cat.en}
                      </Badge>
                      <Badge variant="neutral">
                        {lang === 'ar' ? diff.ar : diff.en}
                      </Badge>
                      <Badge
                        variant={
                          q.reviewStatus === 'approved' ? 'positive' : 'gold'
                        }
                      >
                        {q.reviewStatus === 'approved'
                          ? lang === 'ar'
                            ? 'معتمد'
                            : 'Approved'
                          : lang === 'ar'
                            ? 'مسودة · يحتاج مراجعة'
                            : 'Draft · Needs Review'}
                      </Badge>
                    </div>

                    <h3 className="text-base font-extrabold leading-relaxed text-red-900" dir="rtl">
                      {q.questionAr}
                    </h3>
                    <p className="text-sm font-medium text-ink-muted" dir="ltr">
                      {q.questionEn}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="calm"
                      size="sm"
                      onClick={() => {
                        setPreviewQuestion(q);
                        setPreviewSeedIdx((n) => n + 1);
                        setPreviewLang(lang);
                      }}
                      data-testid={`quiz-preview-btn-${q.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'معاينة عشوائية' : 'Preview'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="calm"
                      size="sm"
                      onClick={() => void handleToggleApprove(q)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-positive-ink" />
                      <span>
                        {q.reviewStatus === 'approved'
                          ? lang === 'ar'
                            ? 'إرجاع لمسودة'
                            : 'Unapprove'
                          : lang === 'ar'
                            ? 'اعتماد'
                            : 'Approve'}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="calm"
                      size="sm"
                      onClick={() => openEdit(q)}
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="calm"
                      size="sm"
                      onClick={() => setDeleteTarget(q)}
                      aria-label={lang === 'ar' ? 'حذف السؤال' : 'Delete question'}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-negative" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* 4 Options Preview Strip */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  {q.optionsAr.map((optAr, idx) => {
                    const isCorrect = idx === q.correctOptionIndex;
                    return (
                      <div
                        key={idx}
                        className={`rounded-button border px-3 py-2 ${
                          isCorrect
                            ? 'border-positive bg-positive-soft font-extrabold text-positive-ink'
                            : 'border-border-paper bg-paper text-ink-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span dir="rtl">{optAr}</span>
                          {isCorrect && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] opacity-85" dir="ltr">
                          {q.optionsEn[idx]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Create / Edit Question Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? lang === 'ar'
                  ? 'تعديل سؤال الاختبار'
                  : 'Edit Quiz Question'
                : lang === 'ar'
                  ? 'إضافة سؤال جديد لبنك الأسئلة'
                  : 'Create New Quiz Question'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'أدخل السؤال والخيارات الأربعة باللغتين العربية والإنجليزية وحدد الإجابة الصحيحة.'
                : 'Enter both Arabic and English question text, all 4 options, and select the correct answer.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveQuestion} className="space-y-4">
            <FormGrid columns={3}>
              <div className="space-y-1">
                <label className="text-xs font-bold text-red-900">
                  {lang === 'ar' ? 'الفئة' : 'Category'}
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as QuizCategory })
                  }
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base font-bold"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {lang === 'ar'
                        ? QUIZ_CATEGORY_LABELS[c].ar
                        : QUIZ_CATEGORY_LABELS[c].en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-red-900">
                  {lang === 'ar' ? 'الصعوبة' : 'Difficulty'}
                </label>
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      difficulty: e.target.value as QuizDifficulty,
                    })
                  }
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base font-bold"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {lang === 'ar'
                        ? QUIZ_DIFFICULTY_LABELS[d].ar
                        : QUIZ_DIFFICULTY_LABELS[d].en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-red-900">
                  {lang === 'ar' ? 'حالة المراجعة' : 'Review Status'}
                </label>
                <select
                  value={form.reviewStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reviewStatus: e.target.value as QuizReviewStatus,
                    })
                  }
                  className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-2.5 text-base font-bold"
                >
                  <option value="draft">
                    {lang === 'ar' ? 'مسودة (تحتاج مراجعة)' : 'Draft (Needs Review)'}
                  </option>
                  <option value="approved">
                    {lang === 'ar' ? 'معتمد (جاهز)' : 'Approved'}
                  </option>
                </select>
              </div>
            </FormGrid>

            <div className="space-y-1">
              <label className="text-xs font-bold text-red-900">
                {lang === 'ar' ? 'نص السؤال بالعربية *' : 'Question (Arabic) *'}
              </label>
              <Textarea
                required
                dir="rtl"
                rows={2}
                value={form.questionAr}
                onChange={(e) => setForm({ ...form, questionAr: e.target.value })}
                className="text-base"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-red-900">
                {lang === 'ar' ? 'نص السؤال بالإنجليزية *' : 'Question (English) *'}
              </label>
              <Textarea
                required
                dir="ltr"
                rows={2}
                value={form.questionEn}
                onChange={(e) => setForm({ ...form, questionEn: e.target.value })}
                className="text-base"
              />
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-extrabold text-red-900">
                {lang === 'ar'
                  ? 'الخيارات الأربعة (اختر الدائرة بجانب الإجابة الصحيحة):'
                  : '4 Options (select the radio button for the correct answer):'}
              </div>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`grid gap-2 rounded-card border p-2.5 sm:grid-cols-12 items-center ${
                    form.correctOptionIndex === idx
                      ? 'border-positive bg-positive-soft/60'
                      : 'border-border-paper bg-paper/50'
                  }`}
                >
                  <label className="sm:col-span-2 flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-red-900">
                    <input
                      type="radio"
                      name="correctOptionIndex"
                      checked={form.correctOptionIndex === idx}
                      onChange={() =>
                        setForm({ ...form, correctOptionIndex: idx })
                      }
                      className="h-4 w-4 accent-red-600"
                    />
                    <span>#{idx + 1}</span>
                  </label>
                  <Input
                    required
                    dir="rtl"
                    placeholder={`الخيار ${idx + 1} (عربي)`}
                    value={form.optionsAr[idx]}
                    onChange={(e) => {
                      const next = [...form.optionsAr] as [string, string, string, string];
                      next[idx] = e.target.value;
                      setForm({ ...form, optionsAr: next });
                    }}
                    className="sm:col-span-5 text-base"
                  />
                  <Input
                    required
                    dir="ltr"
                    placeholder={`Option ${idx + 1} (English)`}
                    value={form.optionsEn[idx]}
                    onChange={(e) => {
                      const next = [...form.optionsEn] as [string, string, string, string];
                      next[idx] = e.target.value;
                      setForm({ ...form, optionsEn: next });
                    }}
                    className="sm:col-span-5 text-base"
                  />
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditorOpen(false)}
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving
                  ? lang === 'ar'
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : lang === 'ar'
                    ? 'حفظ السؤال'
                    : 'Save Question'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shuffled Applicant Preview Dialog */}
      <Dialog
        open={Boolean(previewQuestion)}
        onOpenChange={(open) => !open && setPreviewQuestion(null)}
      >
        <DialogContent data-testid="quiz-preview-shuffled" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ar'
                ? 'معاينة شاشة المتقدم (بترتيب عشوائي)'
                : 'Shuffled Applicant Preview'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'هكذا يظهر السؤال للمتقدم بترتيب خيارات فريد حسب بذرة المحاولة.'
                : 'Shows how answer positions permute deterministically for each applicant seed.'}
            </DialogDescription>
          </DialogHeader>

          {previewQuestion && shuffledPreviewPayload && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-ink-muted">
                  seed: demo-preview-seed-{previewSeedIdx}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="calm"
                    size="sm"
                    onClick={() =>
                      setPreviewLang((l) => (l === 'ar' ? 'en' : 'ar'))
                    }
                  >
                    {previewLang === 'ar' ? 'EN' : 'عربي'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPreviewSeedIdx((n) => n + 1)}
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>{lang === 'ar' ? 'إعادة الخلط' : 'Re-shuffle'}</span>
                  </Button>
                </div>
              </div>

              <div
                dir={previewLang === 'ar' ? 'rtl' : 'ltr'}
                className="rounded-card border-[3px] border-outline bg-red-600 p-4 text-white shadow-sticker space-y-3"
              >
                <div className="rounded-card border-2 border-outline bg-white p-4 text-center text-base font-black text-red-900">
                  {previewLang === 'ar'
                    ? shuffledPreviewPayload.questionAr
                    : shuffledPreviewPayload.questionEn}
                </div>
                <div className="grid gap-2">
                  {shuffledPreviewPayload.shuffledOptions.map((opt) => {
                    const isCorrect =
                      opt.canonicalIndex === previewQuestion.correctOptionIndex;
                    return (
                      <div
                        key={opt.slotIndex}
                        className="flex items-center justify-between gap-2 rounded-button border-2 border-outline bg-white px-3 py-2.5 text-sm font-bold text-red-900"
                      >
                        <span>
                          {opt.slotIndex + 1}.{' '}
                          {previewLang === 'ar' ? opt.labelAr : opt.labelEn}
                        </span>
                        {isCorrect && (
                          <Badge variant="positive">
                            {lang === 'ar' ? 'الإجابة الصحيحة (للإدارة فقط)' : 'Correct (Admin only)'}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import with Validation & Preview Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ar'
                ? 'استيراد أسئلة من CSV مع التحقق والمعاينة'
                : 'Import Quiz Questions from CSV'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'الأعمدة: category, difficulty, reviewStatus, questionAr, questionEn, option1..4Ar, option1..4En, correctIndex (1-4).'
                : 'Columns: category, difficulty, reviewStatus, questionAr, questionEn, option1..4Ar, option1..4En, correctIndex (1-4).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="quiz-load-sample-csv"
                onClick={() => setCsvText(SAMPLE_IMPORT_CSV)}
              >
                {lang === 'ar'
                  ? 'تحميل مثال CSV (٣ صالحة + ١ خطأ)'
                  : 'Load Sample CSV (3 valid + 1 error)'}
              </Button>
              <Button
                type="button"
                variant="calm"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{lang === 'ar' ? 'تنزيل القالب' : 'Download Template'}</span>
              </Button>
            </div>

            <Textarea
              rows={6}
              dir="ltr"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="category,difficulty,reviewStatus,questionAr,questionEn,..."
              className="font-mono text-base"
            />

            {parsedCsvRows.length > 0 && (
              <div className="space-y-2 rounded-card border border-border-paper bg-paper p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-extrabold">
                  <Badge variant="positive">
                    {lang === 'ar'
                      ? `صفوف صالحة: ${validCsvRows.length}`
                      : `Valid rows: ${validCsvRows.length}`}
                  </Badge>
                  {invalidCsvRows.length > 0 && (
                    <Badge variant="negative">
                      {lang === 'ar'
                        ? `صفوف بها أخطاء: ${invalidCsvRows.length}`
                        : `Invalid rows: ${invalidCsvRows.length}`}
                    </Badge>
                  )}
                </div>

                {invalidCsvRows.length > 0 && (
                  <ul className="space-y-1 text-negative font-semibold">
                    {invalidCsvRows.map((r) => (
                      <li key={r.rowNum} className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Row #{r.rowNum}: {r.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {validCsvRows.length > 0 && (
                  <div className="max-h-32 overflow-y-auto divide-y divide-border-paper rounded-button border border-border-paper bg-white">
                    {validCsvRows.map((row, i) => (
                      <div key={i} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                        <span className="truncate font-bold text-red-900">
                          {lang === 'ar' ? row.questionAr : row.questionEn}
                        </span>
                        <Badge variant="gold">{row.category}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setImportOpen(false)}
            >
              {lang === 'ar' ? 'إغلاق' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={validCsvRows.length === 0 || importing}
              onClick={() => void handleCsvImport()}
              data-testid="quiz-confirm-import-csv"
            >
              {importing
                ? lang === 'ar'
                  ? 'جاري الاستيراد...'
                  : 'Importing...'
                : lang === 'ar'
                  ? `استيراد ${validCsvRows.length} سؤال صالح`
                  : `Import ${validCsvRows.length} Valid Row(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={lang === 'ar' ? 'حذف السؤال نهائياً؟' : 'Delete Question?'}
        description={
          lang === 'ar'
            ? `هل أنت متأكد من حذف السؤال "${deleteTarget?.questionAr ?? ''}"؟`
            : `Are you sure you want to delete "${deleteTarget?.questionEn ?? ''}"?`
        }
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
