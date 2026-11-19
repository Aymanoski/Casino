'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { segmentRepo, settingsRepo } from '@/lib/repos';
import type { Segment, SegmentCategory, Settings } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
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
import { EmptyState } from '@/components/ui/empty-state';
import { FormGrid } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { ScoreChip } from '@/components/brand';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { getSegmentCategoryMeta } from './adminFormatters';

const CATEGORIES: SegmentCategory[] = [
  'music',
  'wordplay',
  'popculture',
  'general',
  'special',
];

interface SegmentFormState {
  nameEn: string;
  nameAr: string;
  category: SegmentCategory;
  descriptionEn: string;
  descriptionAr: string;
  hasTimer: boolean;
  durationSec: string;
  presetPoints: number[];
}

export function AdminSegmentsView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | SegmentCategory>('all');
  const [search, setSearch] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);
  const [form, setForm] = useState<SegmentFormState>({
    nameEn: '',
    nameAr: '',
    category: 'music',
    descriptionEn: '',
    descriptionAr: '',
    hasTimer: true,
    durationSec: '45',
    presetPoints: [10, 5, -5],
  });
  const [newPresetVal, setNewPresetVal] = useState('');
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';
  const isContentOnly = user?.role === 'content';

  const loadData = useCallback(async () => {
    try {
      const [allSegments, appSettings] = await Promise.all([
        segmentRepo.list(),
        settingsRepo.get(),
      ]);
      if (!mountedRef.current) return;
      setSegments(allSegments);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError(
        lang === 'ar' ? 'تعذر تحميل مكتبة الفقرات.' : 'Failed to load segments library.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (msg.event === 'segment.updated' || msg.event === 'data.reset') {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const canReorder = isSuperAdmin && categoryFilter === 'all' && !search.trim();

  const visibleSegments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return segments.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.nameEn.toLowerCase().includes(q) ||
        s.nameAr.toLowerCase().includes(q) ||
        s.descriptionEn.toLowerCase().includes(q) ||
        s.descriptionAr.toLowerCase().includes(q)
      );
    });
  }, [segments, categoryFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      nameEn: '',
      nameAr: '',
      category: 'music',
      descriptionEn: '',
      descriptionAr: '',
      hasTimer: true,
      durationSec: '45',
      presetPoints: [10, 5, -5],
    });
    setNewPresetVal('');
    setDialogOpen(true);
  };

  const openEdit = (seg: Segment) => {
    setEditing(seg);
    setForm({
      nameEn: seg.nameEn,
      nameAr: seg.nameAr,
      category: seg.category,
      descriptionEn: seg.descriptionEn,
      descriptionAr: seg.descriptionAr,
      hasTimer: Boolean(seg.durationSec),
      durationSec: String(seg.durationSec ?? 45),
      presetPoints: [...seg.presetPoints],
    });
    setNewPresetVal('');
    setDialogOpen(true);
  };

  const handleAddPreset = () => {
    const parsed = Number.parseInt(newPresetVal.trim(), 10);
    if (Number.isNaN(parsed) || parsed === 0) return;
    if (!form.presetPoints.includes(parsed)) {
      setForm((prev) => ({
        ...prev,
        presetPoints: [...prev.presetPoints, parsed],
      }));
    }
    setNewPresetVal('');
  };

  const handleMove = async (index: number, delta: -1 | 1) => {
    if (!user || !canReorder) return;
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= segments.length) return;
    const reordered = [...segments];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    try {
      await segmentRepo.reorder(
        reordered.map((s) => s.id),
        user.id
      );
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر إعادة الترتيب' : 'Reorder failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDropReorder = async (targetId: string) => {
    if (!user || !canReorder || !draggedId || draggedId === targetId) return;
    const fromIdx = segments.findIndex((s) => s.id === draggedId);
    const toIdx = segments.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...segments];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraggedId(null);
    try {
      await segmentRepo.reorder(
        next.map((s) => s.id),
        user.id
      );
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم تحديث ترتيب الفقرات' : 'Segment order updated',
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر الترتيب' : 'Reorder failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.nameEn.trim() || !form.nameAr.trim()) return;

    setSaving(true);
    try {
      const durationSec = form.hasTimer
        ? Math.max(10, Number.parseInt(form.durationSec, 10) || 45)
        : undefined;

      if (editing) {
        const patch = isContentOnly
          ? {
              nameEn: form.nameEn.trim(),
              nameAr: form.nameAr.trim(),
              descriptionEn: form.descriptionEn.trim(),
              descriptionAr: form.descriptionAr.trim(),
            }
          : {
              nameEn: form.nameEn.trim(),
              nameAr: form.nameAr.trim(),
              category: form.category,
              descriptionEn: form.descriptionEn.trim(),
              descriptionAr: form.descriptionAr.trim(),
              durationSec,
              presetPoints:
                form.presetPoints.length > 0 ? form.presetPoints : [10, 5, -5],
            };

        await segmentRepo.update(editing.id, patch, user.id);
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم تحديث الفقرة' : 'Segment updated',
          description: localizeText(lang, form.nameEn, form.nameAr),
        });
      } else {
        await segmentRepo.create(
          {
            nameEn: form.nameEn.trim(),
            nameAr: form.nameAr.trim(),
            category: form.category,
            descriptionEn: form.descriptionEn.trim(),
            descriptionAr: form.descriptionAr.trim(),
            durationSec,
            presetPoints:
              form.presetPoints.length > 0 ? form.presetPoints : [10, 5, -5],
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تمت إضافة الفقرة الجديدة' : 'Segment created',
          description: localizeText(lang, form.nameEn, form.nameAr),
        });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل الحفظ' : 'Save failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (seg: Segment) => {
    if (!user) return;
    try {
      const ok = await segmentRepo.remove(seg.id, user.id);
      if (ok) {
        toast({
          variant: 'info',
          title: lang === 'ar' ? 'تم حذف الفقرة' : 'Segment removed',
          description: localizeText(lang, seg.nameEn, seg.nameAr),
        });
        await loadData();
      }
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حذف الفقرة' : 'Remove failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} shape="card" className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'مكتبة فقرات التحدي' : 'Segments Library'}
        description={
          isContentOnly
            ? lang === 'ar'
              ? 'وضع مدير المحتوى: يمكنك تحرير أسماء وأوصاف الفقرات باللغتين؛ النقاط والترتيب والمؤقتات مخصصة لمدير البطولة.'
              : 'Content Manager scope: you may edit bilingual segment titles and descriptions; scoring presets, timers, and ordering are locked to Super Admin.'
            : lang === 'ar'
              ? 'إدارة فقرات البطولة، إعادة الترتيب بالسحب أو الأسهم، تخصيص النقاط المسبقة والمؤقتات الاختيارية باللغتين.'
              : 'Create, edit, reorder, and configure segment categories, scoring presets, optional timers, and bilingual EN/AR copy.'
        }
        badge={
          isContentOnly ? (
            <Badge variant="info">
              <Lock className="h-3 w-3" />
              <span>{lang === 'ar' ? 'تحرير النصوص فقط' : 'Copy-Edit Scope'}</span>
            </Badge>
          ) : undefined
        }
        actions={
          isSuperAdmin ? (
            <Button type="button" variant="red" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'ar' ? 'إضافة فقرة جديدة' : 'Add Segment'}</span>
            </Button>
          ) : undefined
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      {/* Search + Category Filter Strip */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث في الفقرات بالعربية أو الإنجليزية...'
                : 'Search segments in EN or AR...'
            }
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'min-h-[44px] rounded-pill border px-3.5 text-xs font-bold transition-colors',
              categoryFilter === 'all'
                ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                : 'border-border-paper bg-white text-ink hover:bg-paper-2'
            )}
          >
            {lang === 'ar' ? `الكل (${segments.length})` : `All (${segments.length})`}
          </button>
          {CATEGORIES.map((cat) => {
            const meta = getSegmentCategoryMeta(cat, lang);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'min-h-[44px] rounded-pill border px-3.5 text-xs font-bold transition-colors',
                  categoryFilter === cat
                    ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                    : 'border-border-paper bg-white text-ink hover:bg-paper-2'
                )}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segment List */}
      {visibleSegments.length === 0 ? (
        <EmptyState
          compact
          title={lang === 'ar' ? 'لا توجد فقرات مطابقة' : 'No matching segments'}
          description={
            lang === 'ar'
              ? 'جرّب مسح البحث أو تغيير التصنيف.'
              : 'Try clearing the search query or switching category.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {visibleSegments.map((seg, idx) => {
            const catMeta = getSegmentCategoryMeta(seg.category, lang);
            const isProtectedTieBreaker = seg.id === 'seg-16';
            return (
              <div
                key={seg.id}
                draggable={canReorder}
                onDragStart={() => setDraggedId(seg.id)}
                onDragOver={(e) => {
                  if (canReorder) e.preventDefault();
                }}
                onDrop={() => handleDropReorder(seg.id)}
                onDragEnd={() => setDraggedId(null)}
                className={cn(
                  'flex flex-col gap-3 rounded-card border border-border-paper bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between',
                  draggedId === seg.id && 'opacity-50 ring-2 ring-blue-500'
                )}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {canReorder && (
                    <div className="mt-1 hidden sm:flex cursor-grab text-ink-faint">
                      <GripVertical className="h-5 w-5" />
                    </div>
                  )}

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-border-paper bg-paper-2 font-score text-lg font-black tabular-nums text-red-900">
                    {formatNumber(seg.order, { useArabicIndicDigits: useArabicIndic })}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg text-red-900 leading-snug">
                        {localizeText(lang, seg.nameEn, seg.nameAr)}
                      </h3>
                      <Badge variant={catMeta.variant}>{catMeta.label}</Badge>
                      {seg.durationSec ? (
                        <Badge variant="white">
                          <Clock className="h-3 w-3 text-red-600" />
                          <span>
                            {formatNumber(seg.durationSec, {
                              useArabicIndicDigits: useArabicIndic,
                            })}
                            s
                          </span>
                        </Badge>
                      ) : (
                        <Badge variant="muted">
                          {lang === 'ar' ? 'بدون مؤقت' : 'Untimed'}
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs font-semibold text-ink-muted">
                      {lang === 'ar' ? seg.nameEn : seg.nameAr}
                    </div>
                    <p className="text-xs text-ink leading-relaxed max-w-[70ch]">
                      {localizeText(lang, seg.descriptionEn, seg.descriptionAr)}
                    </p>
                  </div>
                </div>

                {/* Right: Preset Chips + Reorder + Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end shrink-0">
                  <div className="flex items-center gap-1.5">
                    {seg.presetPoints.map((pts, pIdx) => (
                      <ScoreChip
                        key={`${seg.id}-pt-${pIdx}`}
                        value={pts}
                        showSign
                        size="sm"
                        useArabicIndicDigits={useArabicIndic}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    {canReorder && (
                      <>
                        <Button
                          type="button"
                          variant="calm"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, -1)}
                          aria-label={lang === 'ar' ? 'نقل لأعلى' : 'Move up'}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="calm"
                          size="icon"
                          disabled={idx === segments.length - 1}
                          onClick={() => handleMove(idx, 1)}
                          aria-label={lang === 'ar' ? 'نقل لأسفل' : 'Move down'}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      variant="calm"
                      size="icon"
                      onClick={() => openEdit(seg)}
                      aria-label={lang === 'ar' ? 'تعديل الفقرة' : 'Edit segment'}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    {isSuperAdmin && !isProtectedTieBreaker && (
                      <ConfirmDialog
                        destructive
                        title={lang === 'ar' ? 'حذف الفقرة؟' : 'Remove Segment?'}
                        description={
                          lang === 'ar'
                            ? `سيتم حذف فقرة "${seg.nameAr}" من المكتبة.`
                            : `Remove "${seg.nameEn}" from the segment library?`
                        }
                        confirmLabel={lang === 'ar' ? 'حذف' : 'Remove'}
                        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        onConfirm={() => handleDelete(seg)}
                        trigger={
                          <Button
                            type="button"
                            variant="calm"
                            size="icon"
                            aria-label={lang === 'ar' ? 'حذف الفقرة' : 'Delete segment'}
                          >
                            <Trash2 className="h-4 w-4 text-negative" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Segment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isContentOnly
                  ? lang === 'ar'
                    ? 'تحرير وصف الفقرة'
                    : 'Edit Segment Copy'
                  : lang === 'ar'
                    ? 'تعديل الفقرة'
                    : 'Edit Segment'
                : lang === 'ar'
                  ? 'إضافة فقرة جديدة'
                  : 'Create Segment'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'اكتب وصفاً أصلياً ومختصراً للفقرة باللغتين مع ضبط النقاط والمؤقت.'
                : 'Author original bilingual titles and descriptions, plus scoring presets and optional timer.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <FormGrid columns={2}>
              <Input
                label={lang === 'ar' ? 'اسم الفقرة (إنجليزي)' : 'Segment Name (EN)'}
                value={form.nameEn}
                onChange={(e) => setForm((s) => ({ ...s, nameEn: e.target.value }))}
                required
              />
              <Input
                label={lang === 'ar' ? 'اسم الفقرة (عربي)' : 'Segment Name (AR)'}
                value={form.nameAr}
                onChange={(e) => setForm((s) => ({ ...s, nameAr: e.target.value }))}
                dir="rtl"
                required
              />
            </FormGrid>

            <FormGrid columns={2}>
              <Textarea
                label={lang === 'ar' ? 'الوصف (إنجليزي)' : 'Description (EN)'}
                value={form.descriptionEn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, descriptionEn: e.target.value }))
                }
                rows={3}
              />
              <Textarea
                label={lang === 'ar' ? 'الوصف (عربي)' : 'Description (AR)'}
                value={form.descriptionAr}
                onChange={(e) =>
                  setForm((s) => ({ ...s, descriptionAr: e.target.value }))
                }
                rows={3}
                dir="rtl"
              />
            </FormGrid>

            {isSuperAdmin && (
              <>
                <FormGrid columns={2}>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                      {lang === 'ar' ? 'التصنيف' : 'Category'}
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          category: e.target.value as SegmentCategory,
                        }))
                      }
                      className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {getSegmentCategoryMeta(cat, lang).label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                        {lang === 'ar' ? 'المؤقت (اختياري)' : 'Optional Timer (sec)'}
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                        <input
                          type="checkbox"
                          checked={form.hasTimer}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, hasTimer: e.target.checked }))
                          }
                          className="h-4 w-4 accent-red-600"
                        />
                        <span>{lang === 'ar' ? 'تفعيل' : 'Timed'}</span>
                      </label>
                    </div>
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      disabled={!form.hasTimer}
                      value={form.durationSec}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, durationSec: e.target.value }))
                      }
                    />
                  </div>
                </FormGrid>

                {/* Preset Points Editor */}
                <div className="space-y-2.5 rounded-input border border-border-paper bg-paper p-3.5">
                  <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                    {lang === 'ar' ? 'أزرار النقاط المسبقة' : 'Preset Point Buttons'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.presetPoints.map((pt, idx) => (
                      <div key={`${pt}-${idx}`} className="relative">
                        <ScoreChip value={pt} showSign size="sm" />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((s) => ({
                              ...s,
                              presetPoints: s.presetPoints.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label={lang === 'ar' ? 'إزالة النقطة' : 'Remove preset'}
                          className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-pill border border-outline bg-white text-negative shadow-sm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={newPresetVal}
                        onChange={(e) => setNewPresetVal(e.target.value)}
                        placeholder="+15 / -10"
                        className="h-11 w-28 rounded-input border-2 border-border-paper bg-white px-2.5 text-base font-bold text-ink"
                      />
                      <Button
                        type="button"
                        variant="surface"
                        size="sm"
                        onClick={handleAddPreset}
                      >
                        <Plus className="h-4 w-4" />
                        <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogOpen(false)}
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" variant="red" disabled={saving}>
                {saving
                  ? lang === 'ar'
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : editing
                    ? lang === 'ar'
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : lang === 'ar'
                      ? 'إنشاء الفقرة'
                      : 'Create Segment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
