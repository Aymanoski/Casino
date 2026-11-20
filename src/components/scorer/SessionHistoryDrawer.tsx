'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Edit3,
  History,
  Minus,
  Plus,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { canManageScoreHistory, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { scoreRepo } from '@/lib/repos';
import type {
  BuzzEvent,
  Game,
  Player,
  ScoreEvent,
  Segment,
  User,
} from '@/lib/schemas';
import {
  cn,
  formatArabicCount,
  formatNumber,
  localizeText,
  normalizeNumericInput,
  parseSignedIntegerInput,
} from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';

type FeedTab = 'all' | 'scores' | 'buzzes';

type TimelineRow =
  | { type: 'score'; createdAt: string; event: ScoreEvent }
  | { type: 'buzz'; createdAt: string; event: BuzzEvent };

const PAGE_SIZE = 25;
const NOTE_MAX_LENGTH = 140;
const DELTA_MIN = -10000;
const DELTA_MAX = 10000;

export interface SessionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
  players: Player[];
  segments: Segment[];
  users: User[];
  scoreEvents: ScoreEvent[];
  buzzEvents: BuzzEvent[];
  useArabicIndicDigits?: boolean;
  onChanged: () => Promise<void> | void;
}

function formatEventTime(
  iso: string,
  lang: 'en' | 'ar',
  useArabicIndicDigits: boolean
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

function getDeltaErrorMessage(
  reason: 'empty' | 'invalid' | 'zero' | 'range',
  lang: 'en' | 'ar',
  useArabicIndicDigits: boolean
): string {
  if (reason === 'range') {
    const maxStr = formatNumber(DELTA_MAX, { useArabicIndicDigits });
    return lang === 'ar'
      ? `القيمة يجب أن تكون بين -${maxStr} و +${maxStr}.`
      : `Value must be between -${maxStr} and +${maxStr}.`;
  }
  if (reason === 'zero') {
    return lang === 'ar'
      ? 'لا يمكن حفظ قيمة صفر — أدخل رقماً موجباً أو سالباً.'
      : 'Points cannot be 0 — enter a positive or negative whole number.';
  }
  return lang === 'ar'
    ? 'أدخل عدداً صحيحاً غير الصفر (مثال: 10 أو -5 أو ١٥).'
    : 'Enter a non-zero whole number (e.g. 10 or -5).';
}

export function SessionHistoryDrawer({
  open,
  onOpenChange,
  game,
  players,
  segments,
  users,
  scoreEvents,
  buzzEvents,
  useArabicIndicDigits = false,
  onChanged,
}: SessionHistoryDrawerProps) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const canManage = canManageScoreHistory(user?.role ?? null);

  const [tab, setTab] = useState<FeedTab>('all');
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [busy, setBusy] = useState<boolean>(false);

  // Add retroactive/manual score entry state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [addPlayerId, setAddPlayerId] = useState<string>(game.playerIds[0] ?? '');
  const [addSegmentId, setAddSegmentId] = useState<string>(
    game.segmentIds[game.currentSegmentIndex] ?? game.segmentIds[0] ?? ''
  );
  const [addDelta, setAddDelta] = useState<string>('10');
  const [addNote, setAddNote] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit score event state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDelta, setEditDelta] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editSegmentId, setEditSegmentId] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  // Confirm dialogs for destructive/history actions
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<ScoreEvent | null>(
    null
  );
  const [confirmRevertEvent, setConfirmRevertEvent] = useState<ScoreEvent | null>(
    null
  );

  // Reset transient editing/pagination state cleanly when drawer closes or game changes
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditError(null);
      setAddError(null);
      setVisibleCount(PAGE_SIZE);
    } else {
      setAddPlayerId((prev) =>
        prev && game.playerIds.includes(prev) ? prev : (game.playerIds[0] ?? '')
      );
      setAddSegmentId(
        game.segmentIds[game.currentSegmentIndex] ?? game.segmentIds[0] ?? ''
      );
    }
  }, [open, game.playerIds, game.segmentIds, game.currentSegmentIndex]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, playerFilter]);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const segmentMap = useMemo(
    () => new Map(segments.map((s) => [s.id, s])),
    [segments]
  );
  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

  const gameSegments = useMemo(() => {
    const uniqueIds = Array.from(new Set(game.segmentIds));
    return uniqueIds
      .map((sid) => segmentMap.get(sid))
      .filter((s): s is Segment => Boolean(s));
  }, [game.segmentIds, segmentMap]);

  const timeline = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = [];
    if (tab === 'all' || tab === 'scores') {
      for (const ev of scoreEvents) {
        if (playerFilter === 'all' || ev.playerId === playerFilter) {
          rows.push({ type: 'score', createdAt: ev.createdAt, event: ev });
        }
      }
    }
    if (tab === 'all' || tab === 'buzzes') {
      for (const b of buzzEvents) {
        if (playerFilter === 'all' || b.playerId === playerFilter) {
          rows.push({ type: 'buzz', createdAt: b.createdAt, event: b });
        }
      }
    }
    rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return rows;
  }, [scoreEvents, buzzEvents, tab, playerFilter]);

  const visibleTimeline = useMemo(
    () => timeline.slice(0, visibleCount),
    [timeline, visibleCount]
  );
  const remainingCount = Math.max(0, timeline.length - visibleTimeline.length);

  const beginEdit = (ev: ScoreEvent) => {
    setEditingId(ev.id);
    setEditDelta(String(ev.delta));
    setEditNote(ev.note ?? '');
    setEditSegmentId(ev.segmentId);
    setEditError(null);
  };

  const handleSaveEdit = async (ev: ScoreEvent) => {
    const parsed = parseSignedIntegerInput(editDelta, {
      min: DELTA_MIN,
      max: DELTA_MAX,
    });
    if (!parsed.ok) {
      setEditError(getDeltaErrorMessage(parsed.reason, lang, useArabicIndicDigits));
      return;
    }
    setEditError(null);
    setBusy(true);
    try {
      await scoreRepo.editScoreEvent(
        ev.id,
        {
          delta: parsed.value,
          note: editNote.trim().slice(0, NOTE_MAX_LENGTH) || undefined,
          segmentId: editSegmentId || ev.segmentId,
        },
        user?.id ?? 'user-admin'
      );
      setEditingId(null);
      await onChanged();
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? 'تم تعديل حركة النقاط وتسجيلها في المراجعة'
            : 'Score entry updated & logged to Audit',
      });
    } catch {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حفظ التعديل' : 'Could not save edit',
        description:
          lang === 'ar'
            ? 'حاول مرة أخرى للتحقق من حفظ التعديل.'
            : 'Please try saving the score adjustment again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteEvent || busy) return;
    setBusy(true);
    try {
      await scoreRepo.deleteScoreEvent(
        confirmDeleteEvent.id,
        user?.id ?? 'user-admin'
      );
      setConfirmDeleteEvent(null);
      await onChanged();
      toast({
        variant: 'negative',
        title:
          lang === 'ar'
            ? 'تم حذف حركة النقاط وتحديث الإجمالي'
            : 'Score entry deleted & totals recalculated',
      });
    } catch {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حذف الحركة' : 'Could not delete entry',
        description:
          lang === 'ar'
            ? 'حدث خطأ غير متوقع أثناء الحذف. حاول مجدداً.'
            : 'An unexpected error occurred while deleting. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRevert = async () => {
    if (!confirmRevertEvent || busy) return;
    setBusy(true);
    try {
      await scoreRepo.undoScoreEventById(
        game.id,
        confirmRevertEvent.id,
        user?.id ?? 'user-admin'
      );
      setConfirmRevertEvent(null);
      await onChanged();
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? 'تم إنشاء حركة تراجع معاكسة'
            : 'Compensating undo recorded',
      });
    } catch {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر عكس الحركة' : 'Could not revert entry',
        description:
          lang === 'ar'
            ? 'حاول مرة أخرى لعكس حركة النقاط.'
            : 'Please try reverting this score entry again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSignedIntegerInput(addDelta, {
      min: DELTA_MIN,
      max: DELTA_MAX,
    });
    if (!addPlayerId || !addSegmentId) {
      setAddError(
        lang === 'ar'
          ? 'اختر المتسابق والفقرة أولاً.'
          : 'Select both a contestant and a segment first.'
      );
      return;
    }
    if (!parsed.ok) {
      setAddError(getDeltaErrorMessage(parsed.reason, lang, useArabicIndicDigits));
      return;
    }
    setAddError(null);
    setBusy(true);
    try {
      await scoreRepo.applyScore({
        gameId: game.id,
        segmentId: addSegmentId,
        playerId: addPlayerId,
        delta: parsed.value,
        note: addNote.trim().slice(0, NOTE_MAX_LENGTH) || undefined,
        kind: 'custom',
        byUserId: user?.id ?? 'user-admin',
      });
      setAddNote('');
      setShowAddForm(false);
      await onChanged();
      toast({
        variant: parsed.value > 0 ? 'positive' : 'negative',
        title:
          lang === 'ar'
            ? 'تمت إضافة حركة النقاط للسجل'
            : 'Score adjustment added to history',
      });
    } catch {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر إضافة الحركة' : 'Could not add score entry',
        description:
          lang === 'ar'
            ? 'حاول الحفظ مرة أخرى.'
            : 'Please try saving the entry again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleNumericSign = (
    current: string,
    setter: (v: string) => void,
    clearErr: () => void
  ) => {
    clearErr();
    const normalized = normalizeNumericInput(current);
    if (!normalized) {
      setter('-');
      return;
    }
    if (normalized.startsWith('-')) {
      setter(normalized.slice(1));
    } else if (normalized.startsWith('+')) {
      setter(`-${normalized.slice(1)}`);
    } else {
      setter(`-${normalized}`);
    }
  };

  const formatSignedDelta = (delta: number) => {
    const absStr = formatNumber(Math.abs(delta), { useArabicIndicDigits });
    return delta > 0 ? `+${absStr}` : `−${absStr}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
                <History className="h-5 w-5" aria-hidden="true" />
              </span>
              <DialogTitle>
                {lang === 'ar'
                  ? 'سجل الجلسة والتحكم في النقاط'
                  : 'Session History & Score Control'}
              </DialogTitle>
            </div>
            <DialogDescription className="break-words [overflow-wrap:anywhere]">
              {localizeText(lang, game.tableName, game.tableNameAr)} ·{' '}
              {lang === 'ar'
                ? `${formatArabicCount(
                    scoreEvents.length,
                    {
                      zero: '٠ حركات نقاط',
                      one: 'حركة نقاط واحدة',
                      two: 'حركتا نقاط',
                      few: 'حركات نقاط',
                      many: 'حركة نقاط',
                    },
                    useArabicIndicDigits
                  )} و ${formatArabicCount(
                    buzzEvents.length,
                    {
                      zero: '٠ أجراس',
                      one: 'جرس واحد',
                      two: 'جرسان',
                      few: 'أجراس',
                      many: 'جرساً',
                    },
                    useArabicIndicDigits
                  )}`
                : `${scoreEvents.length} score ${scoreEvents.length === 1 ? 'event' : 'events'} · ${buzzEvents.length} ${buzzEvents.length === 1 ? 'buzz' : 'buzzes'}`}
            </DialogDescription>
          </DialogHeader>

          {/* Capability Role Notice + Add Entry Trigger */}
          <div className="flex flex-col gap-2.5 rounded-input border-2 border-border-paper bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs sm:text-sm text-ink">
              <ShieldCheck
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  canManage ? 'text-positive-ink' : 'text-ink-muted'
                )}
                aria-hidden="true"
              />
              <span>
                {canManage
                  ? lang === 'ar'
                    ? 'صلاحية التحكم الكامل مفعّلة: يمكنك تعديل أو عكس أو حذف أي حركة نقاط أو إضافة حركة تصحيحية مع تسجيل فوري في سجل المراجعة.'
                    : 'Full history control active: edit, revert, delete, or add entries. Every change recalculates totals and writes an AuditEntry.'
                  : lang === 'ar'
                    ? 'عرض السجل الزمني للجلسة (تعديل وحذف السجل محصور حالياً في الأدوار الإدارية المخوّلة — استخدم زر التراجع السريع لآخر حركة).'
                    : 'Read-only timeline view. Use quick Undo in the Action Dock for your last move; full history edits are restricted to authorized manager roles.'}
              </span>
            </div>

            {canManage && (
              <Button
                type="button"
                variant={showAddForm ? 'secondary' : 'red'}
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setShowAddForm((prev) => !prev);
                  setAddError(null);
                }}
              >
                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {showAddForm
                    ? lang === 'ar'
                      ? 'إغلاق الإضافة'
                      : 'Close Form'
                    : lang === 'ar'
                      ? 'إضافة حركة تصحيح'
                      : 'Add Entry'}
                </span>
              </Button>
            )}
          </div>

          {/* Add Manual / Retroactive Score Entry Form */}
          {canManage && showAddForm && (
            <form
              onSubmit={handleAddEntry}
              noValidate
              className="space-y-3 rounded-input border-2 border-outline bg-paper-2 p-3.5"
            >
              <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar'
                  ? 'إضافة حركة نقاط جديدة للسجل'
                  : 'Add Manual Score Adjustment'}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="hist-add-player"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    {lang === 'ar' ? 'اللاعب' : 'Contestant'}
                  </label>
                  <select
                    id="hist-add-player"
                    value={addPlayerId}
                    onChange={(e) => {
                      setAddPlayerId(e.target.value);
                      setAddError(null);
                    }}
                    className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base font-medium text-ink focus:border-blue-500 focus:outline-none"
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {localizeText(lang, p.fullName, p.fullNameAr)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="hist-add-segment"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    {lang === 'ar' ? 'الفقرة' : 'Segment'}
                  </label>
                  <select
                    id="hist-add-segment"
                    value={addSegmentId}
                    onChange={(e) => {
                      setAddSegmentId(e.target.value);
                      setAddError(null);
                    }}
                    className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base font-medium text-ink focus:border-blue-500 focus:outline-none"
                  >
                    {gameSegments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {localizeText(lang, s.nameEn, s.nameAr)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-[auto_110px_1fr_auto] items-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    toggleNumericSign(addDelta, setAddDelta, () => setAddError(null))
                  }
                  aria-label={lang === 'ar' ? 'تبديل الإشارة موجب/سالب' : 'Toggle plus/minus sign'}
                >
                  ±
                </Button>
                <div>
                  <label
                    htmlFor="hist-add-delta"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    {lang === 'ar' ? 'النقاط' : 'Points'}
                  </label>
                  <Input
                    id="hist-add-delta"
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    value={addDelta}
                    aria-invalid={Boolean(addError)}
                    aria-describedby={addError ? 'hist-add-error' : undefined}
                    onChange={(e) => {
                      setAddDelta(e.target.value);
                      if (addError) setAddError(null);
                    }}
                    placeholder="+10 / -5"
                  />
                </div>
                <div>
                  <label
                    htmlFor="hist-add-note"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    {lang === 'ar' ? 'سبب التصحيح (اختياري)' : 'Reason / Note'}
                  </label>
                  <Input
                    id="hist-add-note"
                    type="text"
                    maxLength={NOTE_MAX_LENGTH}
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'مثال: تصحيح إجابة متأخرة'
                        : 'e.g. Verified lyric bonus'
                    }
                  />
                </div>
                <Button type="submit" variant="red" size="md" disabled={busy}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                </Button>
              </div>

              {addError && (
                <p
                  id="hist-add-error"
                  role="alert"
                  className="flex items-center gap-1.5 text-xs font-bold text-negative"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{addError}</span>
                </p>
              )}
            </form>
          )}

          {/* Filter Tabs + Player Filter */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2" role="tablist">
              {(
                [
                  {
                    id: 'all',
                    label: lang === 'ar' ? 'الكل' : 'All',
                    count: scoreEvents.length + buzzEvents.length,
                  },
                  {
                    id: 'scores',
                    label: lang === 'ar' ? 'النقاط' : 'Scores',
                    count: scoreEvents.length,
                  },
                  {
                    id: 'buzzes',
                    label: lang === 'ar' ? 'الجرس' : 'Buzzes',
                    count: buzzEvents.length,
                  },
                ] as const
              ).map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'inline-flex min-h-[44px] items-center gap-2 rounded-button border-2 px-3.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                      active
                        ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                        : 'border-border-paper bg-paper text-ink hover:bg-paper-2'
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        'rounded-pill px-1.5 py-0.5 text-xs font-extrabold tabular-nums',
                        active
                          ? 'bg-red-900 text-white'
                          : 'bg-white text-ink-muted'
                      )}
                    >
                      {formatNumber(item.count, { useArabicIndicDigits })}
                    </span>
                  </button>
                );
              })}
            </div>

            {players.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={lang === 'ar' ? 'تصفية حسب اللاعب' : 'Filter by contestant'}
              >
                <button
                  type="button"
                  aria-pressed={playerFilter === 'all'}
                  onClick={() => setPlayerFilter('all')}
                  className={cn(
                    'inline-flex min-h-[44px] items-center rounded-pill border-2 px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    playerFilter === 'all'
                      ? 'border-outline bg-gold-400 text-red-900'
                      : 'border-border-paper bg-white text-ink hover:bg-paper'
                  )}
                >
                  {lang === 'ar' ? 'كل اللاعبين' : 'All Players'}
                </button>
                {players.map((p) => {
                  const active = playerFilter === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPlayerFilter(p.id)}
                      className={cn(
                        'inline-flex min-h-[44px] max-w-[180px] items-center rounded-pill border-2 px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                        active
                          ? 'border-outline bg-gold-400 text-red-900'
                          : 'border-border-paper bg-white text-ink hover:bg-paper'
                      )}
                    >
                      <span className="truncate">
                        {localizeText(lang, p.fullName, p.fullNameAr)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chronological Timeline List (Paginated for large datasets) */}
          <div className="max-h-[44dvh] space-y-2.5 overflow-y-auto pe-1">
            {visibleTimeline.length === 0 ? (
              <div className="rounded-input border-2 border-dashed border-border-paper bg-paper p-6 text-center text-sm font-medium text-ink-muted">
                {lang === 'ar'
                  ? 'لا توجد حركات مطابقة لهذه التصفية.'
                  : 'No events match this filter yet.'}
              </div>
            ) : (
              <>
                {visibleTimeline.map((row) => {
                  if (row.type === 'buzz') {
                    const b = row.event;
                    const player = playerMap.get(b.playerId);
                    const seg = segmentMap.get(b.segmentId);
                    const actor = userMap.get(b.byUserId);
                    return (
                      <div
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2.5 rounded-input border border-border-paper bg-paper px-3.5 py-3"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900">
                            <Zap className="h-4 w-4 fill-current" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="break-words text-sm font-bold text-ink">
                                {player
                                  ? localizeText(lang, player.fullName, player.fullNameAr)
                                  : b.playerId}
                              </span>
                              <Badge variant="gold" className="text-[11px] px-2 py-0">
                                {lang === 'ar' ? 'ضغط الجرس أولاً' : 'BUZZED FIRST'}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                              {seg && (
                                <span className="break-words">
                                  {localizeText(lang, seg.nameEn, seg.nameAr)}
                                </span>
                              )}
                              {actor && (
                                <span>
                                  · {localizeText(lang, actor.name, actor.nameAr)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-muted tabular-nums">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {formatEventTime(b.createdAt, lang, useArabicIndicDigits)}
                        </span>
                      </div>
                    );
                  }

                  const ev = row.event;
                  const player = playerMap.get(ev.playerId);
                  const seg = segmentMap.get(ev.segmentId);
                  const actor = userMap.get(ev.byUserId);
                  const isPos = ev.delta > 0;
                  const isUndo = ev.kind === 'undo';
                  const isUndone = Boolean(ev.undoneByEventId);
                  const isEditing = editingId === ev.id;

                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        'rounded-input border-2 px-3.5 py-3 transition-colors',
                        isEditing
                          ? 'border-blue-500 bg-blue-100/30'
                          : isUndone
                            ? 'border-border-paper bg-paper/60 opacity-75'
                            : 'border-border-paper bg-white'
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-extrabold text-red-900">
                              {lang === 'ar' ? 'تعديل حركة:' : 'Editing entry:'}{' '}
                              {player
                                ? localizeText(lang, player.fullName, player.fullNameAr)
                                : ev.playerId}
                            </span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[auto_96px_1fr]">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                toggleNumericSign(editDelta, setEditDelta, () =>
                                  setEditError(null)
                                )
                              }
                              aria-label={lang === 'ar' ? 'تبديل الإشارة' : 'Toggle sign'}
                            >
                              ±
                            </Button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              maxLength={7}
                              value={editDelta}
                              aria-invalid={Boolean(editError)}
                              aria-describedby={
                                editError ? `hist-edit-error-${ev.id}` : undefined
                              }
                              onChange={(e) => {
                                setEditDelta(e.target.value);
                                if (editError) setEditError(null);
                              }}
                              aria-label={lang === 'ar' ? 'قيمة النقاط' : 'Point delta'}
                            />
                            <Input
                              type="text"
                              maxLength={NOTE_MAX_LENGTH}
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder={
                                lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional note'
                              }
                              aria-label={lang === 'ar' ? 'الملاحظة' : 'Note'}
                            />
                          </div>
                          {editError && (
                            <p
                              id={`hist-edit-error-${ev.id}`}
                              role="alert"
                              className="flex items-center gap-1.5 text-xs font-bold text-negative"
                            >
                              <AlertCircle
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{editError}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <select
                              value={editSegmentId}
                              onChange={(e) => setEditSegmentId(e.target.value)}
                              aria-label={lang === 'ar' ? 'الفقرة' : 'Segment'}
                              className="min-h-[44px] flex-1 min-w-[160px] rounded-input border-2 border-border-paper bg-white px-2.5 text-base font-medium text-ink focus:border-blue-500 focus:outline-none"
                            >
                              {gameSegments.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {localizeText(lang, s.nameEn, s.nameAr)}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditError(null);
                                }}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                <span>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                              </Button>
                              <Button
                                type="button"
                                variant="red"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleSaveEdit(ev)}
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            {player && (
                              <PlayerAvatar
                                name={localizeText(lang, player.fullName, player.fullNameAr)}
                                avatarSeed={player.avatarSeed}
                                size="sm"
                                isHost={player.isHost}
                                className="mt-0.5 h-9 w-9 shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={cn(
                                    'inline-flex shrink-0 items-center gap-0.5 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-base font-black tabular-nums leading-none',
                                    isPos
                                      ? 'bg-positive-soft text-positive-ink'
                                      : 'bg-negative text-white'
                                  )}
                                >
                                  {isPos ? (
                                    <Plus
                                      className="h-3.5 w-3.5 stroke-[3]"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Minus
                                      className="h-3.5 w-3.5 stroke-[3]"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span>
                                    {formatNumber(Math.abs(ev.delta), {
                                      useArabicIndicDigits,
                                    })}
                                  </span>
                                </span>
                                <span className="break-words text-sm font-bold text-ink">
                                  {player
                                    ? localizeText(lang, player.fullName, player.fullNameAr)
                                    : ev.playerId}
                                </span>
                                {isUndo && (
                                  <Badge variant="info" className="px-2 py-0 text-[10px]">
                                    {lang === 'ar' ? 'تراجع' : 'UNDO'}
                                  </Badge>
                                )}
                                {isUndone && (
                                  <Badge variant="muted" className="px-2 py-0 text-[10px]">
                                    {lang === 'ar' ? 'تم التراجع عنه' : 'REVERTED'}
                                  </Badge>
                                )}
                              </div>

                              {ev.note && (
                                <p className="break-words [overflow-wrap:anywhere] text-xs font-medium text-ink">
                                  “{ev.note}”
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                                {seg && (
                                  <span className="break-words">
                                    {localizeText(lang, seg.nameEn, seg.nameAr)}
                                  </span>
                                )}
                                {actor && (
                                  <span>
                                    · {localizeText(lang, actor.name, actor.nameAr)}
                                  </span>
                                )}
                                <span className="tabular-nums">
                                  ·{' '}
                                  {formatEventTime(
                                    ev.createdAt,
                                    lang,
                                    useArabicIndicDigits
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Full Control Row Actions (Gated by canManageScoreHistory) */}
                          {canManage && (
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                              {!isUndo && !isUndone && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setConfirmRevertEvent(ev)}
                                  title={lang === 'ar' ? 'عكس هذه الحركة' : 'Revert this entry'}
                                  aria-label={lang === 'ar' ? 'عكس هذه الحركة' : 'Revert this entry'}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-button border-2 border-border-paper bg-paper px-2.5 text-xs font-bold text-ink transition-colors hover:border-blue-500 hover:bg-blue-100/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                                >
                                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                                  <span className="sm:hidden">
                                    {lang === 'ar' ? 'عكس' : 'Revert'}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => beginEdit(ev)}
                                title={lang === 'ar' ? 'تعديل الحركة' : 'Edit entry'}
                                aria-label={lang === 'ar' ? 'تعديل الحركة' : 'Edit entry'}
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-button border-2 border-border-paper bg-paper px-2.5 text-xs font-bold text-ink transition-colors hover:border-blue-500 hover:bg-blue-100/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                              >
                                <Edit3 className="h-4 w-4" aria-hidden="true" />
                                <span className="sm:hidden">
                                  {lang === 'ar' ? 'تعديل' : 'Edit'}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmDeleteEvent(ev)}
                                title={lang === 'ar' ? 'حذف الحركة' : 'Delete entry'}
                                aria-label={lang === 'ar' ? 'حذف الحركة' : 'Delete entry'}
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-button border-2 border-negative/40 bg-red-100 px-2.5 text-xs font-bold text-negative transition-colors hover:bg-negative hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                <span className="sm:hidden">
                                  {lang === 'ar' ? 'حذف' : 'Delete'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {remainingCount > 0 && (
                  <div className="pt-1 text-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      className="w-full"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? `عرض المزيد (${formatNumber(remainingCount, { useArabicIndicDigits })} متبقية)`
                          : `Load More (${remainingCount} remaining)`}
                      </span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Revert Single Event */}
      <ConfirmDialog
        open={Boolean(confirmRevertEvent)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirmRevertEvent(null);
        }}
        title={lang === 'ar' ? 'عكس حركة النقاط؟' : 'Revert this score entry?'}
        description={
          confirmRevertEvent
            ? lang === 'ar'
              ? `سيتم تسجيل حركة تراجع معاكسة بقيمة ${formatSignedDelta(-confirmRevertEvent.delta)} نقطة مع الاحتفاظ بالحركة الأصلية في السجل.`
              : `This will add a compensating ${formatSignedDelta(-confirmRevertEvent.delta)} pts undo record while preserving the original entry in the audit log.`
            : ''
        }
        confirmLabel={lang === 'ar' ? 'تأكيد العكس' : 'Confirm Revert'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={handleConfirmRevert}
      />

      {/* Confirm Delete Score Event (Destructive) */}
      <ConfirmDialog
        open={Boolean(confirmDeleteEvent)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirmDeleteEvent(null);
        }}
        destructive
        title={lang === 'ar' ? 'حذف حركة النقاط نهائياً؟' : 'Delete this score record?'}
        description={
          confirmDeleteEvent
            ? lang === 'ar'
              ? `سيتم حذف الحركة (${formatSignedDelta(confirmDeleteEvent.delta)} نقطة) وإعادة احتساب مجموع اللاعب فوراً مع تسجيل الحذف في سجل المراجعة.`
              : `This permanently removes the ${formatSignedDelta(confirmDeleteEvent.delta)} pts entry, recalculates standings immediately, and logs the deletion in the Audit Log.`
            : ''
        }
        confirmLabel={lang === 'ar' ? 'حذف نهائي' : 'Delete Entry'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
