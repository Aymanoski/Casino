'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { contentRepo, settingsRepo } from '@/lib/repos';
import type { ContentCategory, ContentItem, Settings } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { formatAdminTimeShort } from './adminFormatters';

const CONTENT_CATEGORIES: Array<{
  id: ContentCategory;
  en: string;
  ar: string;
}> = [
  { id: 'announcement', en: 'Announcements', ar: 'الإعلانات' },
  { id: 'rule', en: 'Rules', ar: 'القوانين' },
  { id: 'scheduleBlurb', en: 'Schedule Blurbs', ar: 'نصوص الجدول' },
  { id: 'pitchCopy', en: 'Pitch Copy', ar: 'نصوص العرض' },
];

interface ContentFormState {
  key: string;
  category: ContentCategory;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  badgeEn: string;
  badgeAr: string;
}

export function AdminContentView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | ContentCategory>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [form, setForm] = useState<ContentFormState>({
    key: '',
    category: 'announcement',
    titleEn: '',
    titleAr: '',
    bodyEn: '',
    bodyAr: '',
    badgeEn: '',
    badgeAr: '',
  });
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [allContent, appSettings] = await Promise.all([
        contentRepo.list(),
        settingsRepo.get(),
      ]);
      if (!mountedRef.current) return;
      setItems(allContent);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError(
        lang === 'ar' ? 'تعذر تحميل عناصر المحتوى.' : 'Failed to load content items.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (msg.event === 'content.updated' || msg.event === 'data.reset') {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;

  const visibleItems = useMemo(() => {
    if (activeCategory === 'all') return items;
    return items.filter((i) => i.category === activeCategory);
  }, [items, activeCategory]);

  const openCreate = () => {
    const defaultCat = activeCategory === 'all' ? 'announcement' : activeCategory;
    setEditing(null);
    setForm({
      key: `${defaultCat}-${Date.now().toString().slice(-4)}`,
      category: defaultCat,
      titleEn: '',
      titleAr: '',
      bodyEn: '',
      bodyAr: '',
      badgeEn: '',
      badgeAr: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    setEditing(item);
    setForm({
      key: item.key,
      category: item.category,
      titleEn: item.titleEn,
      titleAr: item.titleAr,
      bodyEn: item.bodyEn,
      bodyAr: item.bodyAr,
      badgeEn: item.badgeEn ?? '',
      badgeAr: item.badgeAr ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.titleEn.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await contentRepo.update(
          editing.id,
          {
            key: form.key.trim() || editing.key,
            category: form.category,
            titleEn: form.titleEn.trim(),
            titleAr: form.titleAr.trim() || form.titleEn.trim(),
            bodyEn: form.bodyEn.trim(),
            bodyAr: form.bodyAr.trim() || form.bodyEn.trim(),
            badgeEn: form.badgeEn.trim() || undefined,
            badgeAr: form.badgeAr.trim() || undefined,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم تحديث المحتوى' : 'Content item updated',
        });
      } else {
        await contentRepo.create(
          {
            key: form.key.trim() || `item-${Date.now()}`,
            category: form.category,
            titleEn: form.titleEn.trim(),
            titleAr: form.titleAr.trim() || form.titleEn.trim(),
            bodyEn: form.bodyEn.trim(),
            bodyAr: form.bodyAr.trim() || form.bodyEn.trim(),
            badgeEn: form.badgeEn.trim() || undefined,
            badgeAr: form.badgeAr.trim() || undefined,
            order: items.length + 1,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تمت إضافة عنصر المحتوى' : 'Content item created',
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

  const handleMove = async (index: number, delta: -1 | 1) => {
    if (!user || activeCategory !== 'all') return;
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(nextIdx, 0, moved);
    await contentRepo.reorder(
      next.map((i) => i.id),
      user.id
    );
    await loadData();
  };

  const handleDelete = async (item: ContentItem) => {
    if (!user) return;
    try {
      await contentRepo.remove(item.id, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم حذف المحتوى' : 'Content item removed',
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر الحذف' : 'Remove failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const getCategoryLabel = (cat: ContentCategory) => {
    const found = CONTENT_CATEGORIES.find((c) => c.id === cat);
    return found ? (lang === 'ar' ? found.ar : found.en) : cat;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} shape="card" className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'المحتوى والإعلانات والقوانين' : 'Content, Schedule & Rules'}
        description={
          lang === 'ar'
            ? 'تحرير الإعلانات، نصوص القوانين، ملاحظات الجدول، ونصوص العرض التقديمي باللغتين الإنجليزية والعربية.'
            : 'Author and organize bilingual announcements, tournament rules, schedule blurbs, and pitch copy.'
        }
        actions={
          <>
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/sponsors">
                <Award className="h-4 w-4 text-gold-600" />
                <span>{lang === 'ar' ? 'الرعاة' : 'Sponsors'}</span>
              </Link>
            </Button>
            <Button asChild variant="calm" size="sm">
              <Link href="/admin/segments">
                <Layers className="h-4 w-4 text-red-600" />
                <span>{lang === 'ar' ? 'أوصاف الفقرات' : 'Segment Copy'}</span>
              </Link>
            </Button>
            <Button type="button" variant="red" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'ar' ? 'إضافة محتوى' : 'Add Content'}</span>
            </Button>
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <Tabs
        value={activeCategory}
        onValueChange={(v) => setActiveCategory(v as 'all' | ContentCategory)}
      >
        <TabsList>
          <TabsTrigger value="all">
            {lang === 'ar' ? `الكل (${items.length})` : `All (${items.length})`}
          </TabsTrigger>
          {CONTENT_CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {lang === 'ar' ? cat.ar : cat.en}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visibleItems.length === 0 ? (
        <EmptyState
          compact
          title={lang === 'ar' ? 'لا توجد عناصر في هذا القسم' : 'No content items in this section'}
          description={
            lang === 'ar'
              ? 'أضف إعلاناً أو قاعدة أو ملاحظة جدول جديدة لتظهر فوراً في الصفحات العامة.'
              : 'Create a new announcement, rule, or schedule blurb to publish across public pages.'
          }
          action={
            <Button type="button" variant="red" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'ar' ? 'إضافة عنصر' : 'Create Item'}</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-card border border-border-paper bg-white p-4 sm:p-5 shadow-soft flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{getCategoryLabel(item.category)}</Badge>
                  {(item.badgeEn || item.badgeAr) && (
                    <Badge variant="gold">
                      {localizeText(lang, item.badgeEn ?? '', item.badgeAr)}
                    </Badge>
                  )}
                  <code
                    dir="ltr"
                    className="rounded-chip-sm bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted"
                  >
                    {item.key}
                  </code>
                </div>

                <h3 className="font-display text-lg text-red-900">
                  {localizeText(lang, item.titleEn, item.titleAr)}
                </h3>
                <p className="text-sm text-ink leading-relaxed max-w-[70ch]">
                  {localizeText(lang, item.bodyEn, item.bodyAr)}
                </p>

                <div className="rounded-input border border-border-paper bg-paper px-3 py-2 text-xs text-ink-muted">
                  <span className="font-bold text-red-900 me-1.5">
                    {lang === 'ar' ? 'النسخة الإنجليزية:' : 'Arabic copy:'}
                  </span>
                  <span dir={lang === 'ar' ? 'ltr' : 'rtl'}>
                    {lang === 'ar' ? item.titleEn : item.titleAr}
                  </span>
                </div>

                <div className="text-[11px] text-ink-faint tabular-nums">
                  {lang === 'ar' ? 'آخر تحديث:' : 'Last updated:'}{' '}
                  {formatAdminTimeShort(item.updatedAt, lang, useArabicIndic)}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeCategory === 'all' && (
                  <>
                    <Button
                      type="button"
                      variant="calm"
                      size="icon"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      aria-label={lang === 'ar' ? 'تحريك لأعلى' : 'Move up'}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="calm"
                      size="icon"
                      disabled={idx === items.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      aria-label={lang === 'ar' ? 'تحريك لأسفل' : 'Move down'}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="calm"
                  size="icon"
                  onClick={() => openEdit(item)}
                  aria-label={lang === 'ar' ? 'تعديل' : 'Edit content'}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <ConfirmDialog
                  destructive
                  title={lang === 'ar' ? 'حذف عنصر المحتوى؟' : 'Delete Content Item?'}
                  description={
                    lang === 'ar'
                      ? `سيتم حذف "${item.titleAr}" نهائياً.`
                      : `Delete "${item.titleEn}"? This action is recorded in the audit log.`
                  }
                  confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
                  cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  onConfirm={() => handleDelete(item)}
                  trigger={
                    <Button
                      type="button"
                      variant="calm"
                      size="icon"
                      aria-label={lang === 'ar' ? 'حذف' : 'Delete content'}
                    >
                      <Trash2 className="h-4 w-4 text-negative" />
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Content Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? lang === 'ar'
                  ? 'تعديل عنصر المحتوى'
                  : 'Edit Content Item'
                : lang === 'ar'
                  ? 'إضافة عنصر محتوى جديد'
                  : 'Create Content Item'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'النصوص الأصلية ثنائية اللغة تظهر فوراً في الصفحات العامة للبطولة.'
                : 'Bilingual copy publishes immediately to public tournament pages and writes an audit entry.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
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
                      category: e.target.value as ContentCategory,
                    }))
                  }
                  className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink"
                >
                  {CONTENT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'ar' ? c.ar : c.en}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={lang === 'ar' ? 'المفتاح (Key Slug)' : 'Content Key'}
                value={form.key}
                onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))}
                dir="ltr"
                required
              />
              <Input
                label={lang === 'ar' ? 'العنوان (إنجليزي)' : 'Title (EN)'}
                value={form.titleEn}
                onChange={(e) => setForm((s) => ({ ...s, titleEn: e.target.value }))}
                required
              />
              <Input
                label={lang === 'ar' ? 'العنوان (عربي)' : 'Title (AR)'}
                value={form.titleAr}
                onChange={(e) => setForm((s) => ({ ...s, titleAr: e.target.value }))}
                dir="rtl"
                required
              />
              <Input
                label={lang === 'ar' ? 'شارة اختيارية (إنجليزي)' : 'Badge (EN, optional)'}
                value={form.badgeEn}
                onChange={(e) => setForm((s) => ({ ...s, badgeEn: e.target.value }))}
                placeholder="LIVE TONIGHT"
              />
              <Input
                label={lang === 'ar' ? 'شارة اختيارية (عربي)' : 'Badge (AR, optional)'}
                value={form.badgeAr}
                onChange={(e) => setForm((s) => ({ ...s, badgeAr: e.target.value }))}
                placeholder="مباشر الليلة"
                dir="rtl"
              />
            </FormGrid>

            <FormGrid columns={2}>
              <Textarea
                label={lang === 'ar' ? 'النص (إنجليزي)' : 'Body (EN)'}
                value={form.bodyEn}
                onChange={(e) => setForm((s) => ({ ...s, bodyEn: e.target.value }))}
                rows={4}
                required
              />
              <Textarea
                label={lang === 'ar' ? 'النص (عربي)' : 'Body (AR)'}
                value={form.bodyAr}
                onChange={(e) => setForm((s) => ({ ...s, bodyAr: e.target.value }))}
                rows={4}
                dir="rtl"
                required
              />
            </FormGrid>

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
                      ? 'نشر المحتوى'
                      : 'Publish Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
