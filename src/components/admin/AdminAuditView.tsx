'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Code2,
  Download,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import { auditRepo, settingsRepo, userRepo } from '@/lib/repos';
import type {
  AuditEntityType,
  AuditEntry,
  Settings,
  User,
} from '@/lib/schemas';
import { localizeText, normalizeSearchText } from '@/lib/utils';
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
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { AdminErrorBanner, AdminPageHeader } from './AdminPageHeader';
import { formatAdminDateTime, getRoleBadgeVariant } from './adminFormatters';
import { downloadCsvFile } from './csvUtils';

const ENTITY_TYPES: AuditEntityType[] = [
  'score',
  'buzz',
  'game',
  'player',
  'bracket',
  'round',
  'segment',
  'user',
  'sponsor',
  'content',
  'settings',
  'system',
];

function renderDiffKeys(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): Array<{ key: string; beforeVal: string; afterVal: string; changed: boolean }> {
  const keys = Array.from(
    new Set([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ])
  );
  return keys.map((key) => {
    const b = before && key in before ? JSON.stringify(before[key], null, 2) : '—';
    const a = after && key in after ? JSON.stringify(after[key], null, 2) : '—';
    return {
      key,
      beforeVal: b,
      afterVal: a,
      changed: b !== a,
    };
  });
}

export function AdminAuditView() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const { toast } = useToast();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entityFilter, setEntityFilter] = useState<'all' | AuditEntityType>('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    const seq = ++loadSeqRef.current;
    try {
      const [allEntries, allUsers, appSettings] = await Promise.all([
        auditRepo.list({
          requesterUserId: user.id,
          order,
        }),
        userRepo.list(),
        settingsRepo.get(),
      ]);
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setEntries(allEntries);
      setUsers(allUsers);
      setSettings(appSettings);
      setError(null);
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذر تحميل سجل المراجعة.'
            : 'Unable to load audit log.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [user, order, lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', () => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (entityFilter !== 'all' && e.entityType !== entityFilter) return false;
      if (actorFilter !== 'all' && e.actorUserId !== actorFilter) return false;
      return true;
    });
  }, [entries, entityFilter, actorFilter]);

  const handleExportCsv = () => {
    downloadCsvFile(
      `casino-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Timestamp (ISO)',
        'Actor',
        'Role',
        'Action',
        'Entity Type',
        'Entity ID',
        'Summary (EN)',
        'Summary (AR)',
        'Before (JSON)',
        'After (JSON)',
      ],
      filteredEntries.map((e) => {
        const actor = userMap.get(e.actorUserId);
        return [
          e.createdAt,
          actor?.name ?? e.actorUserId,
          actor?.role ?? 'unknown',
          e.action,
          e.entityType,
          e.entityId,
          e.summary,
          e.summaryAr ?? '',
          e.before ? JSON.stringify(e.before) : '',
          e.after ? JSON.stringify(e.after) : '',
        ];
      })
    );
    toast({
      variant: 'positive',
      title: lang === 'ar' ? 'تم تصدير سجل المراجعة CSV' : 'Audit log exported',
      description:
        lang === 'ar'
          ? `${filteredEntries.length} سجل مراجعة تم تنزيله.`
          : `${filteredEntries.length} audit entry(s) downloaded.`,
    });
  };

  const columns = useMemo<DataTableColumn<AuditEntry>[]>(
    () => [
      {
        key: 'time',
        header: lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time',
        mobileRole: 'badge',
        render: (e) => (
          <time
            dateTime={e.createdAt}
            className="whitespace-nowrap text-xs font-bold tabular-nums text-red-900"
          >
            {formatAdminDateTime(e.createdAt, lang, useArabicIndic)}
          </time>
        ),
      },
      {
        key: 'summary',
        header: lang === 'ar' ? 'الإجراء والوصف' : 'Action & Summary',
        mobileRole: 'title',
        render: (e) => (
          <div className="min-w-0 max-w-md space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <code
                dir="ltr"
                className="rounded-chip-sm border border-border-paper bg-paper-2 px-2 py-0.5 text-[11px] font-bold text-red-900"
              >
                {e.action}
              </code>
              <Badge variant="white" className="text-[10px] px-2 py-0">
                {e.entityType}
              </Badge>
            </div>
            <div className="text-xs font-semibold text-ink leading-snug">
              {localizeText(lang, e.summary, e.summaryAr)}
            </div>
          </div>
        ),
      },
      {
        key: 'actor',
        header: lang === 'ar' ? 'المنفّذ' : 'Actor',
        render: (e) => {
          const actor = userMap.get(e.actorUserId);
          return (
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-ink">
                {actor
                  ? localizeText(lang, actor.name, actor.nameAr)
                  : e.actorUserId}
              </div>
              {actor && (
                <Badge
                  variant={getRoleBadgeVariant(actor.role)}
                  className="text-[10px] px-2 py-0"
                >
                  {t.roles[actor.role]}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        key: 'diff',
        header: lang === 'ar' ? 'قبل / بعد' : 'Before / After',
        render: (e) => {
          const hasPayload = Boolean(e.before || e.after);
          return hasPayload ? (
            <Button
              type="button"
              variant="calm"
              size="sm"
              onClick={() => setSelectedEntry(e)}
            >
              <Code2 className="h-4 w-4 text-blue-600" />
              <span>{lang === 'ar' ? 'عرض الفروق' : 'Inspect Diff'}</span>
            </Button>
          ) : (
            <span className="text-xs text-ink-faint">—</span>
          );
        },
      },
    ],
    [lang, useArabicIndic, userMap, t.roles]
  );

  const selectedDiffRows = useMemo(
    () =>
      selectedEntry
        ? renderDiffKeys(selectedEntry.before, selectedEntry.after)
        : [],
    [selectedEntry]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="rounded-card border border-border-paper bg-white overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRowSkeleton key={i} columns={4} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'سجل المراجعة الأمني' : 'Audit Log'}
        description={
          lang === 'ar'
            ? 'متاح لمدير البطولة فقط: توثيق فوري لكل إنشاء أو تعديل أو حذف أو احتساب نقاط مع مقارنة «قبل / بعد».'
            : 'Super Admin only: tamper-evident trail of who changed what and when across every entity, with before/after diff inspection and CSV export.'
        }
        badge={
          <Badge variant="gold">
            <Shield className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'مدير البطولة فقط' : 'Super Admin Only'}</span>
          </Badge>
        }
        actions={
          <>
            <Button
              type="button"
              variant="calm"
              size="sm"
              onClick={() =>
                setOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
              }
            >
              <ArrowDownUp className="h-4 w-4 text-red-600" />
              <span>
                {order === 'newest'
                  ? lang === 'ar'
                    ? 'الأحدث أولاً'
                    : 'Newest First'
                  : lang === 'ar'
                    ? 'الأقدم أولاً'
                    : 'Oldest First'}
              </span>
            </Button>
            <Button
              type="button"
              variant="red"
              size="sm"
              disabled={filteredEntries.length === 0}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </Button>
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <DataTable
        data={filteredEntries}
        columns={columns}
        getRowKey={(e) => e.id}
        searchPlaceholder={
          lang === 'ar'
            ? 'ابحث في الإجراءات أو الملخص أو معرف الكيان...'
            : 'Search action, summary, or entity ID...'
        }
        searchFilter={(e, q) =>
          normalizeSearchText(e.action).includes(q) ||
          normalizeSearchText(e.summary).includes(q) ||
          normalizeSearchText(e.summaryAr).includes(q) ||
          normalizeSearchText(e.entityId).includes(q) ||
          normalizeSearchText(e.entityType).includes(q)
        }
        filterLabel={lang === 'ar' ? 'تصفية السجل' : 'Filter Audit'}
        filterSlot={
          <>
            <select
              aria-label={lang === 'ar' ? 'نوع الكيان' : 'Entity type'}
              value={entityFilter}
              onChange={(e) =>
                setEntityFilter(e.target.value as 'all' | AuditEntityType)
              }
              className="min-h-[44px] h-11 w-full md:w-auto rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-xs font-semibold text-ink"
            >
              <option value="all">
                {lang === 'ar' ? 'كل الكيانات' : 'All Entities'}
              </option>
              {ENTITY_TYPES.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>

            <select
              aria-label={lang === 'ar' ? 'المنفّذ' : 'Actor'}
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="min-h-[44px] h-11 w-full md:w-auto rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-xs font-semibold text-ink"
            >
              <option value="all">{lang === 'ar' ? 'كل المنفذين' : 'All Actors'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {localizeText(lang, u.name, u.nameAr)} ({t.roles[u.role]})
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Before / After Diff Inspector Modal */}
      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ar' ? 'تفاصيل التغيير (قبل / بعد)' : 'Before / After Change Diff'}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry &&
                `${selectedEntry.action} · ${selectedEntry.entityType}:${selectedEntry.entityId} · ${formatAdminDateTime(selectedEntry.createdAt, lang, useArabicIndic)}`}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="rounded-input border border-border-paper bg-paper p-3 text-xs font-semibold text-ink">
                {localizeText(lang, selectedEntry.summary, selectedEntry.summaryAr)}
              </div>

              <div className="overflow-auto rounded-input border border-border-paper">
                <table className="w-full text-start text-xs">
                  <thead className="bg-paper-2 text-red-900 font-extrabold">
                    <tr>
                      <th className="px-3 py-2 text-start">
                        {lang === 'ar' ? 'الحقل' : 'Field'}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {lang === 'ar' ? 'قبل (Before)' : 'Before'}
                      </th>
                      <th className="px-3 py-2 text-start">
                        {lang === 'ar' ? 'بعد (After)' : 'After'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-paper bg-white">
                    {selectedDiffRows.map((row) => (
                      <tr
                        key={row.key}
                        className={row.changed ? 'bg-gold-200/25' : undefined}
                      >
                        <td className="px-3 py-2 font-mono font-bold text-red-900 align-top">
                          {row.key}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-ink-muted whitespace-pre-wrap break-all align-top" dir="ltr">
                          {row.beforeVal}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold text-positive-ink whitespace-pre-wrap break-all align-top" dir="ltr">
                          {row.afterVal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="red"
              onClick={() => setSelectedEntry(null)}
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
