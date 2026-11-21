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
  RotateCcw,
  ShieldCheck,
  Undo2,
  UserX,
  X,
  Zap,
} from 'lucide-react';
import { canManageScoreHistory, useAuth } from '@/lib/auth';
import {
  CascadeConfirmationRequiredError,
  commands,
  VersionConflictError,
  type CascadePolicy,
} from '@/lib/commands';
import type { CascadeImpact } from '@/lib/engine';
import { useI18n } from '@/lib/i18n';
import { ImpactPreviewDialog } from '@/components/admin/ImpactPreviewDialog';
import type {
  AbsenceEvent,
  BuzzEvent,
  Match,
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
import {
  DisciplinaryCardIcon,
  formatScoreEventDisplay,
  stripCardNotePrefix,
} from '@/components/brand/DisciplinaryCards';

type FeedTab = 'all' | 'scores' | 'absences' | 'buzzes';
type ScoringActionChoice = 'plus1' | 'minus1' | 'yellow' | 'red';

type TimelineRow =
  | { type: 'score'; createdAt: string; event: ScoreEvent }
  | { type: 'absence'; createdAt: string; event: AbsenceEvent }
  | { type: 'buzz'; createdAt: string; event: BuzzEvent };

const PAGE_SIZE = 25;
const NOTE_MAX_LENGTH = 140;

export interface SessionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Match;
  players: Player[];
  segments: Segment[];
  users: User[];
  scoreEvents: ScoreEvent[];
  absenceEvents: AbsenceEvent[];
  absentPlayerIds: string[];
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

function choiceFromScoreEvent(ev: ScoreEvent): ScoringActionChoice {
  if (ev.kind === 'yellow') return 'yellow';
  if (ev.kind === 'red') return 'red';
  return ev.delta < 0 ? 'minus1' : 'plus1';
}

export function SessionHistoryDrawer({
  open,
  onOpenChange,
  game,
  players,
  segments,
  users,
  scoreEvents,
  absenceEvents,
  absentPlayerIds,
  buzzEvents,
  useArabicIndicDigits = false,
  onChanged,
}: SessionHistoryDrawerProps) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const canManage = canManageScoreHistory(user?.role ?? null);
  const isSuperAdmin = user?.role === 'superAdmin';

  const [tab, setTab] = useState<FeedTab>('all');
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [busy, setBusy] = useState<boolean>(false);

  // Add entry state (strictly +1, -1, Yellow card, Red card — zero free-number inputs)
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [addPlayerId, setAddPlayerId] = useState<string>(game.playerIds[0] ?? '');
  const [addSegmentId, setAddSegmentId] = useState<string>(
    game.segmentIds[game.currentSegmentIndex] ?? game.segmentIds[0] ?? ''
  );
  const [addChoice, setAddChoice] = useState<ScoringActionChoice>('plus1');
  const [addNote, setAddNote] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit score event state (strictly +1, -1, Yellow card, Red card)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editChoice, setEditChoice] = useState<ScoringActionChoice>('plus1');
  const [editNote, setEditNote] = useState<string>('');
  const [editSegmentId, setEditSegmentId] = useState<string>('');

  // Confirm dialogs + Cascade Impact Preview
  const [confirmRevertEvent, setConfirmRevertEvent] = useState<ScoreEvent | null>(
    null
  );
  const [confirmReverseAbsentPlayer, setConfirmReverseAbsentPlayer] =
    useState<Player | null>(null);
  const [pendingImpact, setPendingImpact] = useState<{
    impact: CascadeImpact;
    retry: (policy: CascadePolicy) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
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
    if (tab === 'all' || tab === 'absences') {
      for (const ab of absenceEvents) {
        if (playerFilter === 'all' || ab.playerId === playerFilter) {
          rows.push({ type: 'absence', createdAt: ab.createdAt, event: ab });
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
  }, [scoreEvents, absenceEvents, buzzEvents, tab, playerFilter]);

  const visibleTimeline = useMemo(
    () => timeline.slice(0, visibleCount),
    [timeline, visibleCount]
  );
  const remainingCount = Math.max(0, timeline.length - visibleTimeline.length);

  const beginEdit = (ev: ScoreEvent) => {
    setEditingId(ev.id);
    setEditChoice(choiceFromScoreEvent(ev));
    setEditNote(stripCardNotePrefix(ev.note) ?? '');
    setEditSegmentId(ev.segmentId);
  };

  const handleSaveEdit = async (
    ev: ScoreEvent,
    cascadeOpts?: { confirmCascade?: boolean; cascadePolicy?: CascadePolicy }
  ) => {
    if (!user) return;
    setBusy(true);
    try {
      const kind: 'point' | 'yellow' | 'red' =
        editChoice === 'yellow'
          ? 'yellow'
          : editChoice === 'red'
            ? 'red'
            : 'point';
      const delta =
        editChoice === 'plus1' ? 1 : editChoice === 'red' ? -2 : -1;

      await commands.editScoreEvent({
        eventId: ev.id,
        delta,
        kind,
        note: editNote.trim().slice(0, NOTE_MAX_LENGTH) || undefined,
        segmentId: editSegmentId || ev.segmentId,
        byUserId: user.id,
        expectedVersion: game.version,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
      });
      setEditingId(null);
      setPendingImpact(null);
      await onChanged();
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? 'تم تعديل الحركة وإعادة حساب النتائج تلقائياً'
            : 'Entry updated, outcomes recomputed & logged to Audit',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        setPendingImpact({
          impact: err.impact,
          retry: (policy) =>
            handleSaveEdit(ev, { confirmCascade: true, cascadePolicy: policy }),
        });
        return;
      }
      if (err instanceof VersionConflictError) {
        await onChanged();
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? 'تم تحديث المباراة في نافذة أخرى'
              : 'Match Updated Elsewhere',
          description: err.message,
        });
        return;
      }
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حفظ التعديل' : 'Could not save edit',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRevert = async (
    cascadeOpts?: { confirmCascade?: boolean; cascadePolicy?: CascadePolicy }
  ) => {
    const targetEv = confirmRevertEvent;
    if (!targetEv || !user || busy) return;
    setBusy(true);
    try {
      await commands.revertEvent({
        matchId: game.id,
        targetEventId: targetEv.id,
        byUserId: user.id,
        expectedVersion: game.version,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
      });
      setConfirmRevertEvent(null);
      setPendingImpact(null);
      await onChanged();
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? 'تم تسجيل تراجع معاكس وإعادة حساب النتائج'
            : 'Compensating undo recorded & outcomes recomputed',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        setPendingImpact({
          impact: err.impact,
          retry: (policy) =>
            handleConfirmRevert({ confirmCascade: true, cascadePolicy: policy }),
        });
        return;
      }
      if (err instanceof VersionConflictError) {
        await onChanged();
        toast({
          variant: 'gold',
          title:
            lang === 'ar'
              ? 'تم تحديث المباراة في نافذة أخرى'
              : 'Match Updated Elsewhere',
          description: err.message,
        });
        return;
      }
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر عكس الحركة' : 'Could not revert entry',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReverseAbsence = async (
    cascadeOpts?: { confirmCascade?: boolean; cascadePolicy?: CascadePolicy }
  ) => {
    const targetPlayer = confirmReverseAbsentPlayer;
    if (!targetPlayer || !user || busy) return;
    setBusy(true);
    try {
      await commands.reverseAbsence({
        matchId: game.id,
        playerId: targetPlayer.id,
        byUserId: user.id,
        expectedVersion: game.version,
        confirmCascade: cascadeOpts?.confirmCascade,
        cascadePolicy: cascadeOpts?.cascadePolicy,
      });
      setConfirmReverseAbsentPlayer(null);
      setPendingImpact(null);
      await onChanged();
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? 'تم إلغاء الغياب وإعادة حساب المباراة'
            : 'Absence reversed & match recomputed',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        setPendingImpact({
          impact: err.impact,
          retry: (policy) =>
            handleConfirmReverseAbsence({
              confirmCascade: true,
              cascadePolicy: policy,
            }),
        });
        return;
      }
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر إلغاء الغياب' : 'Could not reverse absence',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddEntry = async (
    e?: React.FormEvent,
    cascadeOpts?: { confirmCascade?: boolean; cascadePolicy?: CascadePolicy }
  ) => {
    e?.preventDefault();
    if (!user) return;
    if (!addPlayerId || !addSegmentId) {
      setAddError(
        lang === 'ar'
          ? 'اختر المتسابق والفقرة أولاً.'
          : 'Select both a contestant and a segment first.'
      );
      return;
    }
    setAddError(null);
    setBusy(true);
    try {
      const noteClean = addNote.trim().slice(0, NOTE_MAX_LENGTH) || undefined;
      if (addChoice === 'yellow' || addChoice === 'red') {
        await commands.applyCard({
          matchId: game.id,
          segmentId: addSegmentId,
          playerId: addPlayerId,
          card: addChoice,
          note: noteClean,
          byUserId: user.id,
          expectedVersion: game.version,
          confirmCascade: cascadeOpts?.confirmCascade,
          cascadePolicy: cascadeOpts?.cascadePolicy,
        });
      } else {
        await commands.applyPoint({
          matchId: game.id,
          segmentId: addSegmentId,
          playerId: addPlayerId,
          delta: addChoice === 'plus1' ? 1 : -1,
          note: noteClean,
          byUserId: user.id,
          expectedVersion: game.version,
          confirmCascade: cascadeOpts?.confirmCascade,
          cascadePolicy: cascadeOpts?.cascadePolicy,
        });
      }
      setAddNote('');
      setShowAddForm(false);
      setPendingImpact(null);
      await onChanged();
      toast({
        variant: addChoice === 'plus1' ? 'positive' : 'negative',
        title:
          lang === 'ar'
            ? 'تمت إضافة الحركة للسجل'
            : 'Entry recorded in match log',
      });
    } catch (err) {
      if (err instanceof CascadeConfirmationRequiredError) {
        setPendingImpact({
          impact: err.impact,
          retry: (policy) =>
            handleAddEntry(undefined, {
              confirmCascade: true,
              cascadePolicy: policy,
            }),
        });
        return;
      }
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر إضافة الحركة' : 'Could not add entry',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const renderChoicePicker = (
    value: ScoringActionChoice,
    onChange: (next: ScoringActionChoice) => void
  ) => {
    const options: Array<{
      id: ScoringActionChoice;
      label: string;
      card?: 'yellow' | 'red';
      tone: string;
    }> = [
      {
        id: 'plus1',
        label: `+${formatNumber(1, { useArabicIndicDigits })}`,
        tone: 'bg-positive-soft text-positive-ink border-positive',
      },
      {
        id: 'minus1',
        label: `−${formatNumber(1, { useArabicIndicDigits })}`,
        tone: 'bg-white text-negative border-outline',
      },
      {
        id: 'yellow',
        label:
          lang === 'ar'
            ? `بطاقة صفراء (−${formatNumber(1, { useArabicIndicDigits })})`
            : 'Yellow card (−1)',
        card: 'yellow',
        tone: 'bg-gold-400 text-red-900 border-outline',
      },
      {
        id: 'red',
        label:
          lang === 'ar'
            ? `بطاقة حمراء (−${formatNumber(2, { useArabicIndicDigits })})`
            : 'Red card (−2)',
        card: 'red',
        tone: 'bg-negative text-white border-outline',
      },
    ];

    return (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="radiogroup"
        aria-label={lang === 'ar' ? 'نوع الحركة' : 'Scoring action'}
      >
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              className={cn(
                'flex min-h-[48px] items-center justify-center gap-1.5 rounded-button border-2 px-2.5 py-2 text-xs font-extrabold transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                opt.tone,
                active
                  ? 'ring-[3px] ring-blue-500 ring-offset-2 ring-offset-white shadow-sticker-sm'
                  : 'opacity-70 hover:opacity-100'
              )}
            >
              {opt.card ? (
                <DisciplinaryCardIcon card={opt.card} size="xs" />
              ) : opt.id === 'plus1' ? (
                <Plus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
              ) : (
                <Minus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
              )}
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
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
                  ? 'سجل المباراة والتحكم'
                  : 'Match History & Audit Control'}
              </DialogTitle>
            </div>
            <DialogDescription className="break-words [overflow-wrap:anywhere]">
              {localizeText(lang, game.tableName, game.tableNameAr)} ·{' '}
              {lang === 'ar'
                ? `${formatArabicCount(
                    scoreEvents.length,
                    {
                      zero: '٠ حركات نقاط وبطاقات',
                      one: 'حركة واحدة',
                      two: 'حركتان',
                      few: 'حركات',
                      many: 'حركة',
                    },
                    useArabicIndicDigits
                  )} · ${formatArabicCount(
                    absenceEvents.length,
                    {
                      zero: '٠ حالات غياب',
                      one: 'حالة غياب',
                      two: 'حالتا غياب',
                      few: 'حالات غياب',
                      many: 'حالة غياب',
                    },
                    useArabicIndicDigits
                  )}`
                : `${scoreEvents.length} score/card ${scoreEvents.length === 1 ? 'event' : 'events'} · ${absenceEvents.length} absence · ${buzzEvents.length} ${buzzEvents.length === 1 ? 'buzz' : 'buzzes'}`}
            </DialogDescription>
          </DialogHeader>

          {/* Role Notice + Add Entry Trigger */}
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
                    ? 'صلاحية مدير البطولة: يمكنك إضافة أو تعديل أو عكس حركات النقاط والبطاقات وإلغاء الغياب بسجل غير قابل للحذف (مع معاينة الأثر).'
                    : 'Super Admin history control: append +1/−1/cards, revert entries via compensating events, or reverse absences with Impact Preview.'
                  : lang === 'ar'
                    ? 'عرض السجل الزمني للمباراة فقط. استخدم زر التراجع السريع في لوحة التحكيم لعكس آخر حركة خاصة بك.'
                    : 'Read-only timeline view. Use quick Undo on the console for your own last scoring move.'}
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
                      ? 'إضافة حركة (+١ / −١ / بطاقة)'
                      : 'Add Entry'}
                </span>
              </Button>
            )}
          </div>

          {/* Add Entry Form (strictly +1, -1, Yellow, Red — zero custom amounts) */}
          {canManage && showAddForm && (
            <form
              onSubmit={handleAddEntry}
              noValidate
              className="space-y-3 rounded-input border-2 border-outline bg-paper-2 p-3.5"
            >
              <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar'
                  ? 'إضافة حركة نقاط أو بطاقة للسجل'
                  : 'Append Point or Disciplinary Card'}
              </div>

              {renderChoicePicker(addChoice, setAddChoice)}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="hist-add-player"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    {lang === 'ar' ? 'اللاعب' : 'Participant'}
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

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="hist-add-note"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    {lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional Note'}
                  </label>
                  <Input
                    id="hist-add-note"
                    type="text"
                    maxLength={NOTE_MAX_LENGTH}
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'مثال: تصحيح بعد المراجعة'
                        : 'e.g. Verified after review'
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
                    count:
                      scoreEvents.length +
                      absenceEvents.length +
                      buzzEvents.length,
                  },
                  {
                    id: 'scores',
                    label: lang === 'ar' ? 'النقاط والبطاقات' : 'Scores & Cards',
                    count: scoreEvents.length,
                  },
                  {
                    id: 'absences',
                    label: lang === 'ar' ? 'الغياب' : 'Absences',
                    count: absenceEvents.length,
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
                      'inline-flex min-h-[44px] items-center gap-1.5 rounded-button border-2 px-3 py-1.5 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
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
                aria-label={lang === 'ar' ? 'تصفية حسب اللاعب' : 'Filter by participant'}
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

          {/* Chronological Timeline List */}
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
                                {b.cleared
                                  ? lang === 'ar'
                                    ? 'مسح الجرس'
                                    : 'BUZZ CLEARED'
                                  : lang === 'ar'
                                    ? 'ضغط الجرس أولاً'
                                    : 'BUZZED FIRST'}
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

                  if (row.type === 'absence') {
                    const ab = row.event;
                    const player = playerMap.get(ab.playerId);
                    const actor = userMap.get(ab.byUserId);
                    const isCurrentlyAbsent = absentPlayerIds.includes(ab.playerId);
                    return (
                      <div
                        key={ab.id}
                        className="flex flex-wrap items-center justify-between gap-2.5 rounded-input border-2 border-border-paper bg-paper-2 px-3.5 py-3"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-2 border-outline',
                              ab.action === 'marked'
                                ? 'bg-negative text-white'
                                : 'bg-positive-soft text-positive-ink'
                            )}
                          >
                            {ab.action === 'marked' ? (
                              <UserX className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="break-words text-sm font-bold text-ink">
                                {player
                                  ? localizeText(lang, player.fullName, player.fullNameAr)
                                  : ab.playerId}
                              </span>
                              <Badge
                                variant={ab.action === 'marked' ? 'negative' : 'positive'}
                                className="text-[11px] px-2 py-0"
                              >
                                {ab.action === 'marked'
                                  ? lang === 'ar'
                                    ? 'تم تسجيل غياب'
                                    : 'MARKED ABSENT'
                                  : lang === 'ar'
                                    ? 'تم إلغاء الغياب'
                                    : 'ABSENCE REVERSED'}
                              </Badge>
                            </div>
                            {ab.reason && (
                              <p className="text-xs font-medium text-ink">“{ab.reason}”</p>
                            )}
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                              {actor && (
                                <span>{localizeText(lang, actor.name, actor.nameAr)}</span>
                              )}
                              <span className="tabular-nums">
                                · {formatEventTime(ab.createdAt, lang, useArabicIndicDigits)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isSuperAdmin && ab.action === 'marked' && isCurrentlyAbsent && player && (
                          <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirmReverseAbsentPlayer(player)}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'إلغاء الغياب' : 'Reverse'}</span>
                          </Button>
                        )}
                      </div>
                    );
                  }

                  const ev = row.event;
                  const player = playerMap.get(ev.playerId);
                  const seg = segmentMap.get(ev.segmentId);
                  const actor = userMap.get(ev.byUserId);
                  const display = formatScoreEventDisplay(
                    ev,
                    lang,
                    useArabicIndicDigits
                  );
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
                          <div className="text-xs font-extrabold text-red-900">
                            {lang === 'ar' ? 'تعديل حركة:' : 'Editing entry:'}{' '}
                            {player
                              ? localizeText(lang, player.fullName, player.fullNameAr)
                              : ev.playerId}
                          </div>

                          {renderChoicePicker(editChoice, setEditChoice)}

                          <div className="grid gap-2 sm:grid-cols-2">
                            <select
                              value={editSegmentId}
                              onChange={(e) => setEditSegmentId(e.target.value)}
                              aria-label={lang === 'ar' ? 'الفقرة' : 'Segment'}
                              className="min-h-[44px] rounded-input border-2 border-border-paper bg-white px-2.5 text-base font-medium text-ink focus:border-blue-500 focus:outline-none"
                            >
                              {gameSegments.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {localizeText(lang, s.nameEn, s.nameAr)}
                                </option>
                              ))}
                            </select>

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

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingId(null)}
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
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            {player && (
                              <PlayerAvatar
                                name={localizeText(
                                  lang,
                                  player.fullName,
                                  player.fullNameAr
                                )}
                                avatarSeed={player.avatarSeed}
                                size="sm"
                                isHost={player.isHost}
                                className="mt-0.5 h-9 w-9 shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {display.cardType ? (
                                  <span
                                    className={cn(
                                      'inline-flex shrink-0 items-center gap-1.5 rounded-pill border-2 border-outline px-2.5 py-0.5 text-xs font-extrabold',
                                      display.cardType === 'yellow'
                                        ? 'bg-gold-300 text-red-900'
                                        : 'bg-negative text-white'
                                    )}
                                  >
                                    <DisciplinaryCardIcon
                                      card={display.cardType}
                                      size="xs"
                                    />
                                    <span>{display.kindLabel}</span>
                                  </span>
                                ) : (
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
                                )}
                                <span className="break-words text-sm font-bold text-ink">
                                  {player
                                    ? localizeText(
                                        lang,
                                        player.fullName,
                                        player.fullNameAr
                                      )
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

                              {display.userNote && (
                                <p className="break-words [overflow-wrap:anywhere] text-xs font-medium text-ink">
                                  “{display.userNote}”
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

                          {/* Super Admin Row Actions (Revert / Edit — never delete) */}
                          {canManage && !isUndo && !isUndone && (
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
        open={Boolean(confirmRevertEvent) && !pendingImpact}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirmRevertEvent(null);
        }}
        title={lang === 'ar' ? 'عكس هذه الحركة؟' : 'Revert this entry?'}
        description={
          confirmRevertEvent
            ? (() => {
                const d = formatScoreEventDisplay(
                  confirmRevertEvent,
                  lang,
                  useArabicIndicDigits
                );
                return lang === 'ar'
                  ? `سيتم تسجيل حركة تراجع معاكسة لحركة (${d.kindLabel}) دون حذف السجل الأصلي، وإعادة حساب الفائز والبطاقات تلقائياً.`
                  : `This appends a compensating undo for "${d.kindLabel}" (never deletes) and automatically recomputes winners, card counts, and standings.`;
              })()
            : ''
        }
        confirmLabel={lang === 'ar' ? 'تأكيد العكس' : 'Confirm Revert'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={() => handleConfirmRevert()}
      />

      {/* Confirm Reverse Absence */}
      <ConfirmDialog
        open={Boolean(confirmReverseAbsentPlayer) && !pendingImpact}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirmReverseAbsentPlayer(null);
        }}
        title={lang === 'ar' ? 'إلغاء تسجيل الغياب؟' : 'Reverse Player Absence?'}
        description={
          confirmReverseAbsentPlayer
            ? lang === 'ar'
              ? `سيتم إلغاء غياب ${confirmReverseAbsentPlayer.fullNameAr} وإعادة حساب نتيجة المباراة والتأهل تلقائياً.`
              : `Reverse the absence for ${confirmReverseAbsentPlayer.fullName}? Match outcome and downstream slots will be recomputed automatically.`
            : ''
        }
        confirmLabel={lang === 'ar' ? 'إلغاء الغياب' : 'Reverse Absence'}
        cancelLabel={lang === 'ar' ? 'تراجع' : 'Cancel'}
        onConfirm={() => handleConfirmReverseAbsence()}
      />

      {/* Downstream Cascade Impact Preview Dialog */}
      <ImpactPreviewDialog
        open={Boolean(pendingImpact)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingImpact(null);
        }}
        impact={pendingImpact?.impact ?? null}
        busy={busy}
        onConfirm={async (policy) => {
          if (pendingImpact) {
            await pendingImpact.retry(policy);
          }
        }}
      />
    </>
  );
}
