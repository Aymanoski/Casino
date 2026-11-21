'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { commands } from '@/lib/commands';
import type { ConsistencyReport, InvariantCode } from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';

interface StorageCounts {
  players: number;
  groups: number;
  matches: number;
  scoreEvents: number;
  absenceEvents: number;
  buzzEvents: number;
  matchEvents: number;
  auditEntries: number;
}

const INVARIANT_CATALOG: Array<{
  code: InvariantCode;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
}> = [
  {
    code: 'FINISHED_MATCH_SINGLE_VALID_WINNER',
    titleEn: 'Single Valid Winner per Finished Match',
    titleAr: 'فائز واحد صالح لكل مباراة منتهية',
    descEn: 'Every finished match has one valid winner who strictly holds the highest score.',
    descAr: 'كل مباراة منتهية لها فائز واحد صالح يمتلك أعلى رصيد نقاط فعلياً.',
  },
  {
    code: 'NO_FINISHED_MATCH_TIED',
    titleEn: 'No Tied Finished Matches',
    titleAr: 'لا توجد مباريات منتهية بالتعادل',
    descEn: 'Draws are never permitted; tied matches stay in needsTieBreak with no winner.',
    descAr: 'التعادل غير مسموح إطلاقاً؛ المباريات المتعادلة تبقى بحاجة لجولة حسم بدون فائز.',
  },
  {
    code: 'FINISHED_GROUP_COMPLETE_STANDINGS',
    titleEn: 'Complete Group Standings',
    titleAr: 'اكتمال ترتيب المجموعات المنتهية',
    descEn: 'Every completed group has complete standings matching its finished group matches.',
    descAr: 'كل مجموعة مكتملة لها جدول ترتيب كامل مطابق لمبارياتها المنتهية.',
  },
  {
    code: 'QUALIFIERS_MATCH_TOP_N',
    titleEn: 'Qualifiers Match Top N of Standings',
    titleAr: 'تطابق المتأهلين مع أعلى المراكز',
    descEn: 'Group qualifiers strictly match the top advancePerGroup rows of recomputed standings.',
    descAr: 'المتأهلون من كل مجموعة يطابقون تماماً أعلى المراكز في الترتيب المعاد حسابه.',
  },
  {
    code: 'KNOCKOUT_PARTICIPANTS_MATCH_FEEDERS',
    titleEn: 'Knockout Slots Match Feeder Results',
    titleAr: 'تطابق مقاعد الإقصائيات مع المباريات المغذّية',
    descEn: 'All scheduled knockout/final participants match their feeder group/match outcomes (or are flagged needsReview).',
    descAr: 'جميع المشاركين في الإقصائيات والنهائي يطابقون نتائج الجولات المغذّية لها.',
  },
  {
    code: 'PLAYER_AT_MOST_ONE_LIVE_MATCH',
    titleEn: 'At Most One Live Match per Player',
    titleAr: 'مباراة مباشرة واحدة كحد أقصى لكل لاعب',
    descEn: 'No contestant is simultaneously seated in two live or tie-break matches.',
    descAr: 'لا يوجد أي لاعب في مباراتين مباشرتين في الوقت نفسه.',
  },
  {
    code: 'STORED_STATS_MATCH_RECOMPUTED',
    titleEn: 'Stored Stats Equal Event-Log Recomputation',
    titleAr: 'تطابق الإحصائيات المخزّنة مع سجل الأحداث',
    descEn: 'Every player’s status, points, wins, cards, and absences match pure event-log recomputation.',
    descAr: 'حالة ونقاط وانتصارات وبطاقات وغياب كل لاعب تطابق تماماً إعادة الحساب من السجل.',
  },
  {
    code: 'NO_ORPHAN_EVENTS',
    titleEn: 'Zero Orphan or Double-Undone Events',
    titleAr: 'لا توجد أحداث يتيمة أو تراجعات مكررة',
    descEn: 'All score, absence, buzz, lifecycle, and check-in events reference valid entities with no double-undo.',
    descAr: 'جميع الأحداث مرتبطة بمباريات ولاعبين موجودين دون أي تراجع مكرر.',
  },
  {
    code: 'MARWAN_EXCLUDED_FROM_STANDINGS',
    titleEn: 'Guest Participant Isolation (Marwan Serry)',
    titleAr: 'عزل الضيف مروان سري عن المجموعات والترتيب',
    descEn: 'Marwan Serry appears only in the Grand Final and never in groups, standings, or player rankings.',
    descAr: 'يشارك مروان سري في النهائي فقط ولا يدخل في المجموعات أو الترتيب العام.',
  },
];

export function AdminConsistencyView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [counts, setCounts] = useState<StorageCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runCheck = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rep, stats] = await Promise.all([
        commands.runConsistencyCheck(user.id),
        commands.getStorageStats(user.id),
      ]);
      if (!mountedRef.current) return;
      setReport(rep);
      setCounts(stats);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذر تشغيل فحص التناسق.'
            : 'Could not run consistency check.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user, lang]);

  useEffect(() => {
    void runCheck();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'consistency.repaired' ||
        msg.event === 'score.changed' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'data.reset'
      ) {
        void runCheck();
      }
    });
    return unsub;
  }, [runCheck]);

  const handleRepair = async () => {
    if (!user || repairing) return;
    setRepairing(true);
    try {
      const res = await commands.repairByRecomputation(user.id);
      if (!mountedRef.current) return;
      setReport(res.afterReport);
      const stats = await commands.getStorageStats(user.id);
      setCounts(stats);
      toast({
        variant: res.afterReport.ok ? 'positive' : 'info',
        title:
          lang === 'ar'
            ? 'تمت إعادة الحساب وإصلاح البيانات'
            : 'Repair by recomputation complete',
        description:
          lang === 'ar'
            ? `تم إصلاح ${res.repairedCount} تعارض — المتبقي: ${res.afterReport.violations.length}.`
            : `Repaired ${res.repairedCount} violation(s) — ${res.afterReport.violations.length} remaining.`,
      });
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل الإصلاح' : 'Repair failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setRepairing(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} shape="card" className="h-24 w-full" />
          ))}
        </div>
        <Skeleton shape="card" className="h-80 w-full" />
      </div>
    );
  }

  const violationsByCode = new Map<InvariantCode, number>();
  for (const v of report?.violations ?? []) {
    violationsByCode.set(v.code, (violationsByCode.get(v.code) ?? 0) + 1);
  }

  const totalEvents = counts
    ? counts.scoreEvents +
      counts.absenceEvents +
      counts.buzzEvents +
      counts.matchEvents
    : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          lang === 'ar'
            ? 'فحص التناسق وسلامة البيانات'
            : 'Consistency Check & Integrity Engine'
        }
        description={
          lang === 'ar'
            ? 'التحقق من تطابق جميع النتائج، المراكز، المجموعات، الإقصائيات، وإحصائيات اللاعبين مع سجل الأحداث المصدري في IndexedDB.'
            : 'Verify every derived winner, group standing, qualifier, knockout feeder slot, and player stat against the append-only IndexedDB event log.'
        }
        badge={
          report?.ok ? (
            <Badge variant="positive">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'جميع الفحوصات سليمة' : 'ALL 9 INVARIANTS PASS'}</span>
            </Badge>
          ) : (
            <Badge variant="negative">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? `${report?.violations.length ?? 0} تعارض`
                  : `${report?.violations.length ?? 0} VIOLATION(S)`}
              </span>
            </Badge>
          )
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={runCheck}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'ar' ? 'إعادة الفحص' : 'Re-Run Check'}</span>
            </Button>

            <ConfirmDialog
              title={
                lang === 'ar'
                  ? 'إصلاح البيانات عبر إعادة الحساب؟'
                  : 'Repair by Recomputation?'
              }
              description={
                lang === 'ar'
                  ? 'سيتم إعادة اشتقاق جميع نتائج المباريات، ترتيب المجموعات، مقاعد الإقصائيات، وحالة وإحصائيات اللاعبين من سجل الأحداث المصدري مع تسجيل العملية في سجل المراجعة.'
                  : 'Recomputes every match winner/status, group standing, knockout slot, round status, and player stat purely from the append-only event log, commits atomically to IndexedDB, and logs a system audit entry.'
              }
              confirmLabel={
                lang === 'ar' ? 'تشغيل إعادة الحساب' : 'Repair by Recomputation'
              }
              cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
              onConfirm={handleRepair}
              trigger={
                <Button type="button" variant="red" size="sm" disabled={repairing}>
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {repairing
                      ? lang === 'ar'
                        ? 'جاري الإصلاح...'
                        : 'Repairing...'
                      : lang === 'ar'
                        ? 'إصلاح بإعادة الحساب'
                        : 'Repair by Recomputation'}
                  </span>
                </Button>
              }
            />
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={runCheck} />}

      {report && (
        <AdminStatChipStrip
          items={[
            {
              id: 'status',
              value: report.violations.length,
              label: lang === 'ar' ? 'تعارضات مكتشفة' : 'Violations Found',
              detail: report.ok
                ? lang === 'ar'
                  ? 'النظام متسق ١٠٠٪'
                  : '100% consistent'
                : lang === 'ar'
                  ? 'يتطلب إعادة حساب'
                  : 'Action recommended',
              tone: report.ok ? 'white' : 'red',
            },
            {
              id: 'matches',
              value: counts?.matches ?? report.summary.matchesChecked,
              label: lang === 'ar' ? 'المباريات (IndexedDB)' : 'Matches (IndexedDB)',
              detail: `${counts?.groups ?? report.summary.groupsChecked} ${lang === 'ar' ? 'مجموعة' : 'groups'}`,
              tone: 'gold',
            },
            {
              id: 'players',
              value: counts?.players ?? report.summary.playersChecked,
              label: lang === 'ar' ? 'اللاعبون' : 'Players Verified',
              detail: lang === 'ar' ? 'شاملاً مقعد الضيف' : 'Including guest host',
              tone: 'blue',
            },
            {
              id: 'events',
              value: totalEvents,
              label: lang === 'ar' ? 'سجل الأحداث المصدري' : 'Append-Only Events',
              detail: `${formatNumber(counts?.auditEntries ?? 0)} ${lang === 'ar' ? 'سجل مراجعة' : 'audit entries'}`,
              tone: 'red',
            },
          ]}
        />
      )}

      {/* Invariant Matrix */}
      <section className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-red-600" aria-hidden="true" />
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar' ? 'قواعد السلامة التسع (Invariants)' : '9 Engine Invariants'}
            </h2>
          </div>
          {report && (
            <span className="text-xs font-semibold text-ink-muted tabular-nums">
              {lang === 'ar' ? 'آخر فحص:' : 'Last checked:'}{' '}
              {new Date(report.checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {INVARIANT_CATALOG.map((inv) => {
            const failCount = violationsByCode.get(inv.code) ?? 0;
            const passed = failCount === 0;
            return (
              <div
                key={inv.code}
                className={
                  passed
                    ? 'rounded-input border border-border-paper bg-paper p-3.5 space-y-1.5'
                    : 'rounded-input border-2 border-negative bg-negative-soft p-3.5 space-y-1.5'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-extrabold text-ink">
                    {lang === 'ar' ? inv.titleAr : inv.titleEn}
                  </span>
                  {passed ? (
                    <Badge variant="positive" className="shrink-0">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'سليم' : 'PASS'}</span>
                    </Badge>
                  ) : (
                    <Badge variant="negative" className="shrink-0">
                      {failCount} {lang === 'ar' ? 'خطأ' : 'FAIL'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {lang === 'ar' ? inv.descAr : inv.descEn}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Violation Details (when present) */}
      {report && report.violations.length > 0 && (
        <section className="rounded-card border-2 border-negative bg-white p-5 shadow-soft space-y-3">
          <h2 className="font-display text-xl text-negative">
            {lang === 'ar'
              ? `تفاصيل التعارضات (${report.violations.length})`
              : `Detected Violations (${report.violations.length})`}
          </h2>
          <ul className="space-y-2">
            {report.violations.map((v, idx) => (
              <li
                key={`${v.code}-${v.entityId}-${idx}`}
                className="rounded-input border border-negative/30 bg-negative-soft p-3 text-xs space-y-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="negative">{v.code}</Badge>
                  <span className="font-mono font-bold text-ink">
                    {v.entityType}:{v.entityId}
                  </span>
                </div>
                <p className="font-semibold text-ink">
                  {lang === 'ar' ? v.messageAr : v.messageEn}
                </p>
                {v.details && (
                  <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[11px] text-ink-muted">
                    {JSON.stringify(v.details, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
