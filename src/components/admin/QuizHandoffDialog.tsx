'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { QuizHandoffPreview } from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { quizRepo } from '@/lib/repos';
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
import { useToast } from '@/components/ui/toast';
import { formatResponseTimeMs } from '@/components/quiz/quizHelpers';

export interface QuizHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

/**
 * Impact Preview + Confirmed Super Admin Handoff Dialog (AGENTS.md §16.3).
 * Safely repeatable: creates new tournament Player records for qualified applicants,
 * links existing phone/email matches without creating duplicates, and flags conflicts.
 */
export function QuizHandoffDialog({
  open,
  onOpenChange,
  onCompleted,
}: QuizHandoffDialogProps) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [preview, setPreview] = useState<QuizHandoffPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    quizRepo
      .previewHandoff(user.id)
      .then((res) => {
        if (mounted) {
          setPreview(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load impact preview.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [open, user]);

  const handleConfirm = async () => {
    if (!user || !preview) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await quizRepo.handoffQualifiedToTournament({
        actorUserId: user.id,
        confirm: true,
      });
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? 'تم ترحيل المتأهلين للبطولة بنجاح'
            : 'Qualified Applicants Handed Off',
        description:
          lang === 'ar'
            ? `تم إنشاء ${res.createdPlayersCount} لاعب جديد وربط ${res.linkedExistingCount} مطابقات حالية دون أي تكرار.`
            : `Created ${res.createdPlayersCount} new player(s) and linked ${res.linkedExistingCount} existing roster match(es) with zero duplicates.`,
      });
      onCompleted?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذر تنفيذ الترحيل.'
            : 'Could not execute tournament handoff.'
      );
    } finally {
      setExecuting(false);
    }
  };

  const actionableCount =
    (preview?.newPlayersToCreate.length ?? 0) +
    (preview?.duplicateExistingPlayers.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="quiz-handoff-dialog"
        className="sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            {lang === 'ar'
              ? 'معاينة أثر ترحيل المتأهلين إلى البطولة'
              : 'Impact Preview: Send Qualified Applicants to Tournament'}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ar'
              ? 'سيتم إنشاء حسابات لاعبين (مع بيانات التواصل والصور الرمزية ثلاثية الأبعاد) عبر خط أوامر البطولة مع تسجيل سجل مراجعة كامل ودون إنشاء أي تكرار عند إعادة التشغيل.'
              : 'Creates tournament Player records (with contacts and deterministic 3D avatars) through the existing command pipeline, logs audit entries, and safely skips duplicates on repeat runs.'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin text-red-600" />
            <span>
              {lang === 'ar' ? 'جاري فحص المتأهلين والمطابقات...' : 'Computing Impact Preview...'}
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-card border-2 border-negative bg-negative-soft p-3.5 text-sm font-semibold text-red-900"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
            <span>{error}</span>
          </div>
        )}

        {!loading && preview && (
          <div className="space-y-4">
            {/* 4 Impact Buckets */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-card border-2 border-outline bg-positive-soft p-3 text-center">
                <div
                  data-testid="handoff-preview-new-count"
                  className="font-score text-3xl font-black text-positive-ink tabular-nums"
                >
                  {preview.newPlayersToCreate.length}
                </div>
                <div className="text-xs font-extrabold text-red-900">
                  {lang === 'ar' ? 'لاعب جديد سيُنشأ' : 'New Players'}
                </div>
              </div>

              <div className="rounded-card border border-border-paper bg-gold-200/40 p-3 text-center">
                <div
                  data-testid="handoff-preview-dup-count"
                  className="font-score text-3xl font-black text-red-900 tabular-nums"
                >
                  {preview.duplicateExistingPlayers.length}
                </div>
                <div className="text-xs font-extrabold text-ink-muted">
                  {lang === 'ar' ? 'مطابقات حالية (تخطّي)' : 'Roster Duplicates'}
                </div>
              </div>

              <div className="rounded-card border border-border-paper bg-blue-100/70 p-3 text-center">
                <div
                  data-testid="handoff-preview-already-count"
                  className="font-score text-3xl font-black text-blue-800 tabular-nums"
                >
                  {preview.alreadyHandedOff.length}
                </div>
                <div className="text-xs font-extrabold text-ink-muted">
                  {lang === 'ar' ? 'مُرحّل مسبقاً' : 'Already Handed Off'}
                </div>
              </div>

              <div className="rounded-card border border-border-paper bg-negative-soft/70 p-3 text-center">
                <div
                  data-testid="handoff-preview-conflict-count"
                  className="font-score text-3xl font-black text-negative tabular-nums"
                >
                  {preview.conflicts.length}
                </div>
                <div className="text-xs font-extrabold text-ink-muted">
                  {lang === 'ar' ? 'تعارضات للمراجعة' : 'Conflicts'}
                </div>
              </div>
            </div>

            <p className="rounded-card border border-border-paper bg-paper p-3 text-xs sm:text-sm font-semibold text-red-900">
              {lang === 'ar' ? preview.summaryAr : preview.summaryEn}
            </p>

            {/* Sample of Existing Roster Duplicates */}
            {preview.duplicateExistingPlayers.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
                  <UserCheck className="h-4 w-4 text-gold-600" />
                  <span>
                    {lang === 'ar'
                      ? `متأهلون موجودون بالفعل في قائمة البطولة (سيتم ربطهم دون تكرار — ${preview.duplicateExistingPlayers.length})`
                      : `Qualified applicants already in tournament roster (linked without duplication — ${preview.duplicateExistingPlayers.length})`}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-card border border-border-paper bg-paper/70 divide-y divide-border-paper text-xs">
                  {preview.duplicateExistingPlayers.slice(0, 8).map((item) => (
                    <div
                      key={item.applicantId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="font-bold text-red-900">
                        #{item.rank} · {lang === 'ar' ? item.fullNameAr : item.fullName}
                      </span>
                      <span className="text-ink-muted">
                        {lang === 'ar' ? item.reasonAr : item.reasonEn}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conflicts Warning */}
            {preview.conflicts.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-negative">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    {lang === 'ar'
                      ? 'تعارضات بيانات (تُترك للمراجعة اليدوية):'
                      : 'Data conflicts (skipped for manual resolution):'}
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto rounded-card border border-negative bg-negative-soft/50 divide-y divide-negative/20 text-xs">
                  {preview.conflicts.map((item) => (
                    <div key={item.applicantId} className="px-3 py-2">
                      <span className="font-bold text-red-900">
                        #{item.rank} {lang === 'ar' ? item.fullNameAr : item.fullName}:
                      </span>{' '}
                      <span className="text-ink-muted">
                        {lang === 'ar' ? item.reasonAr : item.reasonEn}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview of Top New Players to Create */}
            {preview.newPlayersToCreate.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
                  <UserPlus className="h-4 w-4 text-positive-ink" />
                  <span>
                    {lang === 'ar'
                      ? `أوائل اللاعبين الجدد المقرر إنشاؤهم (إجمالي ${preview.newPlayersToCreate.length}):`
                      : `Top new tournament players to create (${preview.newPlayersToCreate.length} total):`}
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-card border border-border-paper bg-white divide-y divide-border-paper text-xs">
                  {preview.newPlayersToCreate.slice(0, 6).map((item) => (
                    <div
                      key={item.applicantId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="font-extrabold text-red-900">
                          #{item.rank} · {lang === 'ar' ? item.fullNameAr : item.fullName}
                        </span>
                        <span dir="ltr" className="ms-2 text-ink-muted">
                          {item.phone}
                        </span>
                      </div>
                      <Badge variant="positive">
                        {item.score} pts · {formatResponseTimeMs(item.totalResponseTimeMs, lang)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actionableCount === 0 && (
              <div className="flex items-center gap-2 rounded-card border border-positive bg-positive-soft p-3 text-sm font-bold text-positive-ink">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'تم ترحيل جميع المتأهلين بالفعل — لا يوجد لاعبون جدد لإنشائهم (العملية آمنة ضد التكرار).'
                    : 'All eligible qualifiers are already handed off — zero duplicates will be created.'}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={executing}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={loading || executing || !preview || actionableCount === 0}
            onClick={() => void handleConfirm()}
            data-testid="quiz-handoff-confirm-btn"
          >
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>
              {executing
                ? lang === 'ar'
                  ? 'جاري الترحيل...'
                  : 'Handing Off...'
                : lang === 'ar'
                  ? `تأكيد ترحيل ${preview?.newPlayersToCreate.length ?? 0} لاعب جديد`
                  : `Confirm Handoff (${preview?.newPlayersToCreate.length ?? 0} New)`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
