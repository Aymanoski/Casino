'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { sponsorRepo } from '@/lib/repos';
import type { Sponsor, SponsorTier } from '@/lib/schemas';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { getSponsorTierMeta } from './adminFormatters';

const SPONSOR_TIERS: SponsorTier[] = [
  'presenting',
  'finalNight',
  'segment',
  'community',
];

interface SponsorFormState {
  name: string;
  nameAr: string;
  tier: SponsorTier;
  tierLabelEn: string;
  tierLabelAr: string;
  logoText: string;
  blurb: string;
  blurbAr: string;
  benefitsEnText: string;
  benefitsArText: string;
}

export function AdminSponsorsView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState<SponsorFormState>({
    name: '',
    nameAr: '',
    tier: 'segment',
    tierLabelEn: 'Segment Partner',
    tierLabelAr: 'راعي الفقرات التفاعلية',
    logoText: '',
    blurb: '',
    blurbAr: '',
    benefitsEnText: '',
    benefitsArText: '',
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
      const list = await sponsorRepo.list();
      if (!mountedRef.current) return;
      setSponsors(list);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError(
        lang === 'ar' ? 'تعذر تحميل فئات الرعاة.' : 'Failed to load sponsor tiers.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (msg.event === 'sponsor.updated' || msg.event === 'data.reset') {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      nameAr: '',
      tier: 'segment',
      tierLabelEn: 'Segment Partner',
      tierLabelAr: 'راعي الفقرات التفاعلية',
      logoText: '',
      blurb: '',
      blurbAr: '',
      benefitsEnText:
        'Branded badge on Big Screen overlays\nContact us for partnership package',
      benefitsArText: 'ظهور الشعار على شاشة العرض\nتواصل معنا لتفاصيل الرعاية',
    });
    setDialogOpen(true);
  };

  const openEdit = (sp: Sponsor) => {
    setEditing(sp);
    setForm({
      name: sp.name,
      nameAr: sp.nameAr,
      tier: sp.tier,
      tierLabelEn: sp.tierLabelEn,
      tierLabelAr: sp.tierLabelAr,
      logoText: sp.logoText,
      blurb: sp.blurb,
      blurbAr: sp.blurbAr,
      benefitsEnText: sp.benefitsEn.join('\n'),
      benefitsArText: sp.benefitsAr.join('\n'),
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setSaving(true);
    try {
      const benefitsEn = form.benefitsEnText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const benefitsAr = form.benefitsArText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (editing) {
        await sponsorRepo.update(
          editing.id,
          {
            name: form.name.trim(),
            nameAr: form.nameAr.trim() || form.name.trim(),
            tier: form.tier,
            tierLabelEn: form.tierLabelEn.trim(),
            tierLabelAr: form.tierLabelAr.trim() || form.tierLabelEn.trim(),
            logoText: form.logoText.trim().toUpperCase(),
            blurb: form.blurb.trim(),
            blurbAr: form.blurbAr.trim() || form.blurb.trim(),
            benefitsEn,
            benefitsAr,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم تحديث فئة الراعي' : 'Sponsor tier updated',
        });
      } else {
        await sponsorRepo.create(
          {
            name: form.name.trim(),
            nameAr: form.nameAr.trim() || form.name.trim(),
            tier: form.tier,
            tierLabelEn: form.tierLabelEn.trim(),
            tierLabelAr: form.tierLabelAr.trim() || form.tierLabelEn.trim(),
            logoText: form.logoText.trim().toUpperCase() || 'PARTNER',
            blurb: form.blurb.trim(),
            blurbAr: form.blurbAr.trim() || form.blurb.trim(),
            benefitsEn,
            benefitsAr,
            order: sponsors.length + 1,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تمت إضافة الراعي' : 'Sponsor tier created',
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

  const handleMove = async (idx: number, delta: -1 | 1) => {
    if (!user) return;
    const target = idx + delta;
    if (target < 0 || target >= sponsors.length) return;
    const next = [...sponsors];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    await sponsorRepo.reorder(
      next.map((s) => s.id),
      user.id
    );
    await loadData();
  };

  const handleDelete = async (sp: Sponsor) => {
    if (!user) return;
    try {
      await sponsorRepo.remove(sp.id, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم حذف الراعي' : 'Sponsor tier removed',
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} shape="card" className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'فئات الرعاة والشركاء' : 'Sponsor Tiers & Packages'}
        description={
          lang === 'ar'
            ? 'إدارة فئات الرعاية الظاهرة على صفحة العرض الرئيسية وصفحة الرعاة. استخدم نصوصاً مبدئية وعبارة «تواصل معنا» بدلاً من الأسعار.'
            : 'Manage sponsor packages shown on the pitch hero and /sponsors page. Use text lockups and "Contact us" instead of prices.'
        }
        badge={
          <Badge variant="white">
            <ShieldCheck className="h-3.5 w-3.5 text-positive-ink" />
            <span>
              {lang === 'ar'
                ? 'شعارات نصية فقط · بدون أسعار'
                : 'Text lockups only · Placeholders'}
            </span>
          </Badge>
        }
        actions={
          <Button type="button" variant="red" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span>{lang === 'ar' ? 'إضافة فئة راعٍ' : 'Add Sponsor Tier'}</span>
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      {sponsors.length === 0 ? (
        <EmptyState
          compact
          title={lang === 'ar' ? 'لا توجد فئات رعاية' : 'No sponsor tiers yet'}
          description={
            lang === 'ar'
              ? 'أضف باقة رعاية جديدة لتظهر في العرض التقديمي.'
              : 'Create a placeholder sponsor tier for the pitch showcase.'
          }
          action={
            <Button type="button" variant="red" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'ar' ? 'إضافة راعٍ' : 'Add Sponsor'}</span>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sponsors.map((sp, idx) => {
            const tierMeta = getSponsorTierMeta(sp.tier, lang);
            const benefits = lang === 'ar' ? sp.benefitsAr : sp.benefitsEn;
            return (
              <div
                key={sp.id}
                className="flex flex-col justify-between gap-4 rounded-card border border-border-paper bg-white p-5 shadow-soft"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Badge variant={tierMeta.variant}>
                        {localizeText(lang, sp.tierLabelEn, sp.tierLabelAr)}
                      </Badge>
                      <h3 className="font-display text-xl text-red-900">
                        {localizeText(lang, sp.name, sp.nameAr)}
                      </h3>
                    </div>

                    {/* Text-only Logo Lockup */}
                    <div className="rounded-button border-2 border-outline bg-paper px-3 py-1.5 font-display text-sm tracking-wide text-red-900 shadow-sticker-sm">
                      {sp.logoText}
                    </div>
                  </div>

                  <p className="text-sm text-ink-muted leading-relaxed">
                    {localizeText(lang, sp.blurb, sp.blurbAr)}
                  </p>

                  {benefits.length > 0 && (
                    <ul className="space-y-1.5 border-t border-border-paper pt-3 text-xs text-ink">
                      {benefits.map((b, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive-ink" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border-paper pt-3">
                  <span className="text-xs font-bold text-ink-muted">
                    {lang === 'ar' ? 'الترتيب:' : 'Order:'} #{sp.order}
                  </span>
                  <div className="flex items-center gap-1.5">
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
                      disabled={idx === sponsors.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      aria-label={lang === 'ar' ? 'تحريك لأسفل' : 'Move down'}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="calm"
                      size="icon"
                      onClick={() => openEdit(sp)}
                      aria-label={lang === 'ar' ? 'تعديل' : 'Edit sponsor'}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      destructive
                      title={lang === 'ar' ? 'حذف الراعي؟' : 'Remove Sponsor Tier?'}
                      description={
                        lang === 'ar'
                          ? `سيتم حذف "${sp.nameAr || sp.name}" من قائمة الرعاة.`
                          : `Remove "${sp.name}" from sponsor packages?`
                      }
                      confirmLabel={lang === 'ar' ? 'حذف' : 'Remove'}
                      cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      onConfirm={() => handleDelete(sp)}
                      trigger={
                        <Button
                          type="button"
                          variant="calm"
                          size="icon"
                          aria-label={lang === 'ar' ? 'حذف' : 'Delete sponsor'}
                        >
                          <Trash2 className="h-4 w-4 text-negative" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Sponsor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? lang === 'ar'
                  ? 'تعديل باقة الرعاية'
                  : 'Edit Sponsor Tier'
                : lang === 'ar'
                  ? 'إضافة باقة رعاية جديدة'
                  : 'Create Sponsor Tier'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'استخدم شعارات نصية فقط (بدون صور علامات تجارية حقيقية) وعبارة «تواصل معنا» بدلاً من الأسعار.'
                : 'Use text lockups only (no real third-party logos) and "Contact us" copy instead of prices.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <FormGrid columns={2}>
              <Input
                label={lang === 'ar' ? 'اسم الراعي (إنجليزي)' : 'Sponsor Name (EN)'}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                required
              />
              <Input
                label={lang === 'ar' ? 'اسم الراعي (عربي)' : 'Sponsor Name (AR)'}
                value={form.nameAr}
                onChange={(e) => setForm((s) => ({ ...s, nameAr: e.target.value }))}
                dir="rtl"
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                  {lang === 'ar' ? 'الفئة' : 'Tier'}
                </label>
                <select
                  value={form.tier}
                  onChange={(e) => {
                    const tier = e.target.value as SponsorTier;
                    setForm((s) => ({
                      ...s,
                      tier,
                      tierLabelEn: getSponsorTierMeta(tier, 'en').label,
                      tierLabelAr: getSponsorTierMeta(tier, 'ar').label,
                    }));
                  }}
                  className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink"
                >
                  {SPONSOR_TIERS.map((tKey) => (
                    <option key={tKey} value={tKey}>
                      {getSponsorTierMeta(tKey, lang).label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={lang === 'ar' ? 'نص الشعار (Logo Text)' : 'Logo Text Lockup'}
                value={form.logoText}
                onChange={(e) =>
                  setForm((s) => ({ ...s, logoText: e.target.value }))
                }
                placeholder="NILE CROWN"
                required
              />
              <Input
                label={lang === 'ar' ? 'تسمية الفئة (إنجليزي)' : 'Tier Label (EN)'}
                value={form.tierLabelEn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, tierLabelEn: e.target.value }))
                }
              />
              <Input
                label={lang === 'ar' ? 'تسمية الفئة (عربي)' : 'Tier Label (AR)'}
                value={form.tierLabelAr}
                onChange={(e) =>
                  setForm((s) => ({ ...s, tierLabelAr: e.target.value }))
                }
                dir="rtl"
              />
            </FormGrid>

            <FormGrid columns={2}>
              <Textarea
                label={lang === 'ar' ? 'نبذة مختصرة (إنجليزي)' : 'Blurb (EN)'}
                value={form.blurb}
                onChange={(e) => setForm((s) => ({ ...s, blurb: e.target.value }))}
                rows={3}
                required
              />
              <Textarea
                label={lang === 'ar' ? 'نبذة مختصرة (عربي)' : 'Blurb (AR)'}
                value={form.blurbAr}
                onChange={(e) =>
                  setForm((s) => ({ ...s, blurbAr: e.target.value }))
                }
                rows={3}
                dir="rtl"
              />
              <Textarea
                label={
                  lang === 'ar'
                    ? 'المميزات (إنجليزي — سطر لكل ميزة)'
                    : 'Benefits (EN — 1 per line)'
                }
                value={form.benefitsEnText}
                onChange={(e) =>
                  setForm((s) => ({ ...s, benefitsEnText: e.target.value }))
                }
                rows={4}
              />
              <Textarea
                label={
                  lang === 'ar'
                    ? 'المميزات (عربي — سطر لكل ميزة)'
                    : 'Benefits (AR — 1 per line)'
                }
                value={form.benefitsArText}
                onChange={(e) =>
                  setForm((s) => ({ ...s, benefitsArText: e.target.value }))
                }
                rows={4}
                dir="rtl"
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
                      ? 'حفظ التغييرات'
                      : 'Save Changes'
                    : lang === 'ar'
                      ? 'إضافة الباقة'
                      : 'Create Tier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
