'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
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
import { cn, formatNumber, localizeText } from '@/lib/utils';
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
import { PlayerAvatar } from '@/components/brand';

type FeedTab = 'all' | 'scores' | 'buzzes';

type TimelineRow =
  | { type: 'score'; createdAt: string; event: ScoreEvent }
  | { type: 'buzz'; createdAt: string; event: BuzzEvent };

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
  const [busy, setBusy] = useState<boolean>(false);

  // Add retroactive/manual score entry state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [addPlayerId, setAddPlayerId] = useState<string>(game.playerIds[0] ?? '');
  const [addSegmentId, setAddSegmentId] = useState<string>(
    game.segmentIds[game.currentSegmentIndex] ?? game.segmentIds[0] ?? ''
  );
  const [addDelta, setAddDelta] = useState<string>('10');
  const [addNote, setAddNote] = useState<string>('');

  // Inline edit score event state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDelta, setEditDelta] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editSegmentId, setEditSegmentId] = useState<string>('');

  // Confirm dialogs for destructive/history actions
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<ScoreEvent | null>(
    null
  );
  const [confirmRevertEvent, setConfirmRevertEvent] = useState<ScoreEvent | null>(
    null
  );

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
        rows.push({ type: 'score', createdAt: ev.createdAt, event: ev });
      }
    }
    if (tab === 'all' || tab === 'buzzes') {
      for (const b of buzzEvents) {
        rows.push({ type: 'buzz', createdAt: b.createdAt, event: b });
      }
    }
    rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return rows;
  }, [scoreEvents, buzzEvents, tab]);

  const beginEdit = (ev: ScoreEvent) => {
    setEditingId(ev.id);
    setEditDelta(String(ev.delta));
    setEditNote(ev.note ?? '');
    setEditSegmentId(ev.segmentId);
  };

  const handleSaveEdit = async (ev: ScoreEvent) => {
    const parsed = parseInt(editDelta, 10);
    if (Number.isNaN(parsed) || parsed === 0) {
      toast({
        variant: 'negative',
        title:
          lang === 'ar'
            ? 'أدخل قيمة نقاط صحيحة غير الصفر'
            : 'Enter a valid non-zero point value',
      });
      return;
    }
    setBusy(true);
    try {
      await scoreRepo.editScoreEvent(
        ev.id,
        {
          delta: parsed,
          note: editNote.trim() || undefined,
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
    } finally {
      setBusy(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(addDelta, 10);
    if (!addPlayerId || !addSegmentId || Number.isNaN(parsed) || parsed === 0) {
      toast({
        variant: 'negative',
        title:
          lang === 'ar'
            ? 'أكمل اللاعب والفقرة وقيمة نقاط غير الصفر'
            : 'Select a player, segment, and non-zero points',
      });
      return;
    }
    setBusy(true);
    try {
      await scoreRepo.applyScore({
        gameId: game.id,
        segmentId: addSegmentId,
        playerId: addPlayerId,
        delta: parsed,
        note: addNote.trim() || undefined,
        kind: 'custom',
        byUserId: user?.id ?? 'user-admin',
      });
      setAddNote('');
      setShowAddForm(false);
      await onChanged();
      toast({
        variant: parsed > 0 ? 'positive' : 'negative',
        title:
          lang === 'ar'
            ? 'تمت إضافة حركة النقاط للسجل'
            : 'Score adjustment added to history',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleNumericSign = (current: string, setter: (v: string) => void) => {
    const trimmed = current.trim();
    if (!trimmed) {
      setter('-');
      return;
    }
    if (trimmed.startsWith('-')) {
      setter(trimmed.slice(1));
    } else if (trimmed.startsWith('+')) {
      setter(`-${trimmed.slice(1)}`);
    } else {
      setter(`-${trimmed}`);
    }
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
            <DialogDescription>
              {localizeText(lang, game.tableName, game.tableNameAr)} ·{' '}
              {lang === 'ar'
                ? `${formatNumber(scoreEvents.length, { useArabicIndicDigits })} حركة نقاط و ${formatNumber(buzzEvents.length, { useArabicIndicDigits })} جرس`
                : `${scoreEvents.length} score events · ${buzzEvents.length} buzzes`}
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
                onClick={() => setShowAddForm((prev) => !prev)}
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
                    onChange={(e) => setAddPlayerId(e.target.value)}
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
                    onChange={(e) => setAddSegmentId(e.target.value)}
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
                  onClick={() => toggleNumericSign(addDelta, setAddDelta)}
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
                    value={addDelta}
                    onChange={(e) => setAddDelta(e.target.value)}
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
            </form>
          )}

          {/* Filter Tabs */}
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

          {/* Chronological Timeline List */}
          <div className="max-h-[46dvh] space-y-2.5 overflow-y-auto pe-1">
            {timeline.length === 0 ? (
              <div className="rounded-input border-2 border-dashed border-border-paper bg-paper p-6 text-center text-sm font-medium text-ink-muted">
                {lang === 'ar'
                  ? 'لا توجد حركات مسجلة في هذه الجلسة بعد.'
                  : 'No events recorded in this session yet.'}
              </div>
            ) : (
              timeline.map((row) => {
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
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900">
                          <Zap className="h-4 w-4 fill-current" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-sm text-ink">
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
                              <span>
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
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted tabular-nums">
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
                          <span className="text-xs font-extrabold text-red-900">
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
                            onClick={() => toggleNumericSign(editDelta, setEditDelta)}
                            aria-label={lang === 'ar' ? 'تبديل الإشارة' : 'Toggle sign'}
                          >
                            ±
                          </Button>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={editDelta}
                            onChange={(e) => setEditDelta(e.target.value)}
                            aria-label={lang === 'ar' ? 'قيمة النقاط' : 'Point delta'}
                          />
                          <Input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder={
                              lang === 'ar' ? 'ملاحظة اختيارية' : 'Optional note'
                            }
                            aria-label={lang === 'ar' ? 'الملاحظة' : 'Note'}
                          />
                        </div>
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
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2.5">
                          {player && (
                            <PlayerAvatar
                              name={localizeText(lang, player.fullName, player.fullNameAr)}
                              avatarSeed={player.avatarSeed}
                              size="sm"
                              isHost={player.isHost}
                              className="mt-0.5 h-9 w-9"
                            />
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-0.5 rounded-pill border-2 border-outline px-2.5 py-0.5 font-score text-base font-black tabular-nums leading-none',
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
                              <span className="text-sm font-bold text-ink">
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
                              <p className="text-xs font-medium text-ink">
                                “{ev.note}”
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                              {seg && (
                                <span>
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
              })
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
              ? `سيتم تسجيل حركة تراجع معاكسة بقيمة ${confirmRevertEvent.delta > 0 ? `−${confirmRevertEvent.delta}` : `+${Math.abs(confirmRevertEvent.delta)}`} نقطة مع الاحتفاظ بالحركة الأصلية في السجل.`
              : `This will add a compensating ${confirmRevertEvent.delta > 0 ? `−${confirmRevertEvent.delta}` : `+${Math.abs(confirmRevertEvent.delta)}`} pts undo record while preserving the original entry in the audit log.`
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
              ? `سيتم حذف الحركة (${confirmDeleteEvent.delta > 0 ? `+${confirmDeleteEvent.delta}` : confirmDeleteEvent.delta} نقطة) وإعادة احتساب مجموع اللاعب فوراً مع تسجيل الحذف في سجل المراجعة.`
              : `This permanently removes the ${confirmDeleteEvent.delta > 0 ? `+${confirmDeleteEvent.delta}` : confirmDeleteEvent.delta} pts entry, recalculates standings immediately, and logs the deletion in the Audit Log.`
            : ''
        }
        confirmLabel={lang === 'ar' ? 'حذف نهائي' : 'Delete Entry'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
