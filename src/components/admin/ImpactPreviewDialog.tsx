'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { CascadeImpact } from '@/lib/engine';
import type { CascadePolicy } from '@/lib/commands';
import { cn } from '@/lib/utils';
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

export interface ImpactPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impact: CascadeImpact | null;
  actionTitleEn?: string;
  actionTitleAr?: string;
  busy?: boolean;
  onConfirm: (policy: CascadePolicy) => Promise<void> | void;
}

/**
 * Impact Preview Dialog (AGENTS.md §15.4):
 * Shown whenever an admin edit, revert, reopen, absence reversal, or override affects
 * downstream live/finished matches. Forces explicit Super Admin confirmation and lets
 * them choose the cascade policy (default: invalidate downstream matches for replay).
 */
export function ImpactPreviewDialog({
  open,
  onOpenChange,
  impact,
  actionTitleEn = 'Confirm Downstream Cascade',
  actionTitleAr = 'تأكيد أثر التعديل على الجولات التالية',
  busy = false,
  onConfirm,
}: ImpactPreviewDialogProps) {
  const { lang } = useI18n();
  const [policy, setPolicy] = useState<CascadePolicy>('invalidateForReplay');

  if (!impact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <DialogTitle>
              {lang === 'ar' ? actionTitleAr : actionTitleEn}
            </DialogTitle>
          </div>
          <DialogDescription>
            {lang === 'ar' ? impact.summaryAr : impact.summaryEn}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52dvh] space-y-4 overflow-y-auto pe-1">
          {/* Primary Match Winner/Status Flips */}
          {impact.winnerChanges.length > 0 && (
            <div className="space-y-2 rounded-input border border-border-paper bg-paper p-3.5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                <GitBranch className="h-4 w-4 text-red-600" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'نتائج المباريات التي ستتغيّر'
                    : 'Match Outcomes Updated'}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs sm:text-sm">
                {impact.winnerChanges.map((wc) => (
                  <li
                    key={wc.matchId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-border-paper bg-white px-3 py-2"
                  >
                    <span className="font-bold text-ink">{wc.tableName}</span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                      <Badge variant="muted">
                        {wc.beforeStatus}
                        {wc.beforeWinnerId ? ` · ${wc.beforeWinnerId}` : ''}
                      </Badge>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-ink-muted rtl:rotate-180"
                        aria-hidden="true"
                      />
                      <Badge variant="gold">
                        {wc.afterStatus}
                        {wc.afterWinnerId ? ` · ${wc.afterWinnerId}` : ''}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Downstream Live / Finished Matches Requiring Confirmation */}
          {impact.reviewRequiredMatches.length > 0 && (
            <div className="space-y-2.5 rounded-input border-2 border-negative bg-negative-soft p-3.5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-negative">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? `مباريات بدأت أو انتهت بالفعل (${impact.reviewRequiredMatches.length})`
                    : `Live / Finished Downstream Matches Affected (${impact.reviewRequiredMatches.length})`}
                </span>
              </div>
              <p className="text-xs text-ink">
                {lang === 'ar'
                  ? 'لن يقوم النظام بإعادة كتابة سجل المباريات الجارية أو المنتهية بصمت. اختر السياسة المناسبة أدناه:'
                  : 'History is never silently rewritten. Choose how to handle affected downstream matches that have already started or finished:'}
              </p>
              <ul className="space-y-1.5 text-xs">
                {impact.reviewRequiredMatches.map((m) => (
                  <li
                    key={m.matchId}
                    className="rounded-input border border-negative/30 bg-white px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-ink">
                        {lang === 'ar' ? m.tableNameAr || m.tableName : m.tableName}
                      </span>
                      <Badge variant="negative">{m.currentStatus}</Badge>
                    </div>
                    <p className="mt-1 text-ink-muted">
                      {lang === 'ar' ? m.reasonAr : m.reasonEn}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Cascade Policy Selector */}
              <div
                role="radiogroup"
                aria-label={
                  lang === 'ar' ? 'سياسة التعامل مع المباريات المتأثرة' : 'Cascade policy'
                }
                className="grid gap-2 pt-1 sm:grid-cols-2"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={policy === 'invalidateForReplay'}
                  onClick={() => setPolicy('invalidateForReplay')}
                  className={cn(
                    'flex min-h-[44px] flex-col items-start gap-1 rounded-input border-2 p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    policy === 'invalidateForReplay'
                      ? 'border-outline bg-white shadow-sticker-sm'
                      : 'border-border-paper bg-paper/70 hover:bg-white'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
                    <RefreshCw className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'إلغاء وإعادة اللعب (افتراضي)'
                        : 'Invalidate & Mark for Replay (Default)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-muted">
                    {lang === 'ar'
                      ? 'تحديث المتسابقين وإعادة جدولة المباريات المتأثرة مع حفظ السجل السابق.'
                      : 'Updates participants and resets downstream matches to scheduled (old events preserved in append-only log).'}
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={policy === 'markNeedsReview'}
                  onClick={() => setPolicy('markNeedsReview')}
                  className={cn(
                    'flex min-h-[44px] flex-col items-start gap-1 rounded-input border-2 p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    policy === 'markNeedsReview'
                      ? 'border-outline bg-white shadow-sticker-sm'
                      : 'border-border-paper bg-paper/70 hover:bg-white'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'تمييز للمراجعة فقط (needsReview)'
                        : 'Flag as Needs Review Only'}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-muted">
                    {lang === 'ar'
                      ? 'الإبقاء على المباريات كما هي مع تمييزها للمراجعة اليدوية لاحقاً.'
                      : 'Leaves downstream matches flagged as needsReview for manual resolution later.'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Auto-Updated Scheduled Downstream Matches */}
          {impact.autoUpdatedMatches.length > 0 && (
            <div className="space-y-2 rounded-input border border-positive/40 bg-positive-soft p-3.5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-positive-ink">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? `مباريات لم تبدأ ستُحدّث تلقائياً (${impact.autoUpdatedMatches.length})`
                    : `Not-Started Matches Auto-Updated (${impact.autoUpdatedMatches.length})`}
                </span>
              </div>
              <ul className="space-y-1 text-xs text-ink">
                {impact.autoUpdatedMatches.map((m) => (
                  <li key={m.matchId} className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {lang === 'ar' ? m.tableNameAr || m.tableName : m.tableName}
                    </span>
                    <Badge variant="positive">
                      {lang === 'ar' ? 'تحديث تلقائي' : 'Auto-Update'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="red"
            size="md"
            disabled={busy}
            onClick={() => onConfirm(policy)}
          >
            {busy
              ? lang === 'ar'
                ? 'جاري التطبيق...'
                : 'Applying...'
              : lang === 'ar'
                ? 'تأكيد وتطبيق التغيير'
                : 'Confirm & Apply Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
