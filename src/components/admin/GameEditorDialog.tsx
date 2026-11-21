'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Crown,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  detectConflictsForMatch,
  findNextFreeSlotForMatch,
  type ScheduleConflict,
} from '@/lib/engine';
import {
  MARWAN_PLAYER_ID,
  type Match,
  type Player,
  type Round,
  type Segment,
  type TournamentSettings,
  type User,
} from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
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
import { FormGrid } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { PlayerCombobox } from '@/components/ui/player-combobox';
import {
  fromDateTimeLocalInput,
  getGameStatusMeta,
  toDateTimeLocalInput,
} from './adminFormatters';

export interface MatchEditorPayload {
  roundId: string;
  tableNumber?: number;
  tableName: string;
  tableNameAr: string;
  scheduledAt: string;
  judgeUserId: string;
  scorerUserId: string;
  playerIds: string[];
  segmentIds: string[];
  isFinal: boolean;
}

export interface GameEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Match | null;
  rounds: Round[];
  players: Player[];
  scorers: User[];
  segments: Segment[];
  /** Pass all matches + tournament settings to enable live conflict detection & Find Next Free Slot */
  allMatches?: Match[];
  tournamentSettings?: TournamentSettings;
  defaultPlayersPerGame?: number;
  onSave: (
    payload: MatchEditorPayload,
    existingGameId?: string
  ) => Promise<void>;
}

export function GameEditorDialog({
  open,
  onOpenChange,
  game,
  rounds,
  players,
  scorers,
  segments,
  allMatches = [],
  tournamentSettings,
  defaultPlayersPerGame = 2,
  onSave,
}: GameEditorDialogProps) {
  const { lang } = useI18n();

  const [roundId, setRoundId] = useState('');
  const [tableNumber, setTableNumber] = useState(1);
  const [tableName, setTableName] = useState('');
  const [tableNameAr, setTableNameAr] = useState('');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [judgeUserId, setJudgeUserId] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const roundSelectId = React.useId();
  const judgeSelectId = React.useId();

  const nonHostPlayers = useMemo(
    () => players.filter((p) => !p.isGuest && !p.isHost),
    [players]
  );

  const effectiveSettings: TournamentSettings = useMemo(
    () =>
      tournamentSettings ?? {
        totalPlayers: 720,
        groupSize: 3,
        advancePerGroup: 1,
        pointsPerGroupWin: 3,
        tablesCount: 12,
        slotMinutes: 30,
        includeFinalWithMarwan: true,
      },
    [tournamentSettings]
  );

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (game) {
      setRoundId(game.roundId);
      setTableNumber(game.tableNumber ?? 1);
      setTableName(game.tableName);
      setTableNameAr(game.tableNameAr);
      setScheduledAtLocal(toDateTimeLocalInput(game.scheduledAt));
      setJudgeUserId(game.judgeUserId || game.scorerUserId);
      setIsFinal(Boolean(game.isFinal));
      setPlayerIds(
        game.participants.map((p, idx) => p.playerId ?? `tbd-seat-${idx + 1}`)
      );
      setSegmentIds([...game.segmentIds]);
    } else {
      const defaultRound = rounds[0]?.id ?? 'round-groups';
      const defaultJudge = scorers[0]?.id ?? 'user-scorer-1';
      const defaultSegs = segments
        .filter((s) => s.id !== 'seg-16')
        .slice(0, 6)
        .map((s) => s.id);
      const seatCount = Math.max(2, defaultPlayersPerGame);
      const initialSeats = Array.from({ length: seatCount }, (_, idx) => {
        return nonHostPlayers[idx]?.id ?? `tbd-seat-${idx + 1}`;
      });
      setRoundId(defaultRound);
      setTableNumber(1);
      setTableName(`Table 1 — Studio Match`);
      setTableNameAr('طاولة 1 — مباراة استوديو');
      setScheduledAtLocal(
        toDateTimeLocalInput(new Date(Date.now() + 3600_000).toISOString())
      );
      setJudgeUserId(defaultJudge);
      setIsFinal(false);
      setPlayerIds(initialSeats);
      setSegmentIds(defaultSegs.length > 0 ? defaultSegs : ['seg-1']);
    }
  }, [open, game, rounds, scorers, segments, nonHostPlayers, defaultPlayersPerGame]);

  const participantsLocked = Boolean(game && game.status !== 'scheduled');

  // Build live candidate Match object to detect real-time player/table/judge schedule conflicts
  const candidateMatch = useMemo<Match | null>(() => {
    if (!open) return null;
    const iso = fromDateTimeLocalInput(scheduledAtLocal);
    const id = game?.id ?? '__draft_match__';
    return {
      id,
      type: isFinal ? 'final' : game?.type ?? 'group',
      groupId: game?.groupId,
      roundId: roundId || 'round-groups',
      round: game?.round ?? 1,
      slot: game?.slot ?? 1,
      participants: playerIds.map((pid, idx) => ({
        slotIndex: idx,
        playerId: pid.startsWith('tbd-') ? null : pid,
        guest: pid === MARWAN_PLAYER_ID,
      })),
      playerIds,
      tableNumber: Math.max(1, tableNumber || 1),
      tableName: tableName || 'Draft Match',
      tableNameAr: tableNameAr || tableName || 'مباراة',
      scheduledAt: iso,
      judgeUserId,
      scorerUserId: judgeUserId,
      segmentIds: segmentIds.length ? segmentIds : ['seg-1'],
      currentSegmentIndex: game?.currentSegmentIndex ?? 0,
      status: game?.status ?? 'scheduled',
      result: game?.result ?? null,
      isFinal,
      isDemo: false,
      replayEpoch: game?.replayEpoch ?? 0,
      version: game?.version ?? 1,
    };
  }, [
    open,
    game,
    scheduledAtLocal,
    isFinal,
    roundId,
    playerIds,
    tableNumber,
    tableName,
    tableNameAr,
    judgeUserId,
    segmentIds,
  ]);

  const liveConflicts = useMemo<ScheduleConflict[]>(() => {
    if (!candidateMatch || allMatches.length === 0) return [];
    return detectConflictsForMatch(candidateMatch, allMatches, effectiveSettings);
  }, [candidateMatch, allMatches, effectiveSettings]);

  const handleFindNextFreeSlot = () => {
    if (!candidateMatch) return;
    const free = findNextFreeSlotForMatch(
      candidateMatch,
      allMatches,
      scorers,
      effectiveSettings
    );
    setTableNumber(free.tableNumber);
    setJudgeUserId(free.judgeUserId);
    setScheduledAtLocal(toDateTimeLocalInput(free.scheduledAt));
  };

  const handleToggleFinal = (checked: boolean) => {
    setIsFinal(checked);
    if (checked) {
      const nonMarwan = playerIds
        .filter((pid) => pid !== MARWAN_PLAYER_ID)
        .slice(0, 2);
      while (nonMarwan.length < 2) {
        nonMarwan.push(`tbd-final-${nonMarwan.length + 1}`);
      }
      setPlayerIds([...nonMarwan, MARWAN_PLAYER_ID]);
      const finalRound = rounds.find(
        (r) => r.stage === 'final' || r.id === 'round-final'
      );
      if (finalRound) setRoundId(finalRound.id);
    } else {
      setPlayerIds((prev) =>
        prev.filter((pid) => pid !== MARWAN_PLAYER_ID).slice(0, 2)
      );
    }
  };

  const handleSeatChange = (idx: number, nextPid: string) => {
    setPlayerIds((prev) =>
      prev.map((p, i) => (i === idx ? nextPid || `tbd-seat-${idx + 1}` : p))
    );
  };

  const handleToggleSegment = (segId: string) => {
    setSegmentIds((prev) =>
      prev.includes(segId) ? prev.filter((id) => id !== segId) : [...prev, segId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tableName.trim()) {
      setFormError(
        lang === 'ar' ? 'اسم المباراة مطلوب.' : 'Match title is required.'
      );
      return;
    }
    if (segmentIds.length === 0) {
      setFormError(
        lang === 'ar'
          ? 'اختر فقرة واحدة على الأقل.'
          : 'Select at least one segment.'
      );
      return;
    }

    const assignedReal = playerIds.filter((pid) => !pid.startsWith('tbd-'));
    if (new Set(assignedReal).size !== assignedReal.length) {
      setFormError(
        lang === 'ar'
          ? 'لا يمكن تكرار نفس اللاعب في أكثر من مقعد.'
          : 'A player cannot occupy more than one seat in the same match.'
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          roundId,
          tableNumber: Math.max(1, tableNumber || 1),
          tableName: tableName.trim(),
          tableNameAr: tableNameAr.trim() || tableName.trim(),
          scheduledAt: fromDateTimeLocalInput(scheduledAtLocal),
          judgeUserId,
          scorerUserId: judgeUserId,
          playerIds: participantsLocked ? game!.playerIds : playerIds,
          segmentIds,
          isFinal,
        },
        game?.id
      );
      onOpenChange(false);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذر حفظ المباراة.'
            : 'Could not save match.'
      );
    } finally {
      setSaving(false);
    }
  };

  const statusMeta = game ? getGameStatusMeta(game.status, lang) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-2xl text-red-900">
            <span>
              {game
                ? lang === 'ar'
                  ? 'تعديل بيانات وجدولة المباراة'
                  : 'Edit Match & Schedule Override'
                : lang === 'ar'
                  ? 'إنشاء مباراة جديدة'
                  : 'Create New Match'}
            </span>
            {statusMeta && (
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ar'
              ? 'عيّن رقم الطاولة والوقت والحكم. يراقب النظام تلقائياً أي تعارض في مواعيد اللاعبين أو الطاولات أو الحكام.'
              : 'Override table number, time slot, judge, or segments. Real-time conflict checks warn immediately on player, table, or judge double-bookings.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div
              role="alert"
              className="rounded-input border-2 border-negative bg-red-100 px-3.5 py-2.5 text-sm font-bold text-negative"
            >
              {formError}
            </div>
          )}

          {/* LIVE SCHEDULE CONFLICT WARNING BANNER */}
          {liveConflicts.length > 0 && (
            <div
              role="alert"
              className="rounded-card border-2 border-gold-500 bg-gold-200/45 p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-extrabold text-red-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? `تحذير: ${liveConflicts.length} تعارض في الجدول!`
                      : `Schedule Conflict Warning (${liveConflicts.length})`}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="red"
                  size="sm"
                  onClick={handleFindNextFreeSlot}
                  className="gap-1.5"
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'اختر أقرب موعد متاح' : 'Find Next Free Slot'}
                  </span>
                </Button>
              </div>
              <ul className="space-y-1 text-xs font-semibold text-red-900/90 list-disc ps-5">
                {liveConflicts.slice(0, 5).map((c, i) => (
                  <li key={`${c.kind}-${c.conflictingMatchId}-${i}`}>
                    {lang === 'ar' ? c.messageAr : c.messageEn}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] font-medium text-ink-muted">
                {lang === 'ar'
                  ? 'يمكنك حفظ التعديل اليدوي رغم التعارض، أو الضغط على «اختر أقرب موعد متاح» لحله فوراً.'
                  : 'You may still save this manual override if intentional, or click "Find Next Free Slot" to resolve automatically.'}
              </p>
            </div>
          )}

          <FormGrid columns={2}>
            <Input
              label={lang === 'ar' ? 'اسم المباراة (EN)' : 'Match Title (EN)'}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              required
            />
            <Input
              label={lang === 'ar' ? 'اسم المباراة (AR)' : 'Match Title (AR)'}
              value={tableNameAr}
              onChange={(e) => setTableNameAr(e.target.value)}
              dir="rtl"
            />
            <Input
              label={lang === 'ar' ? 'رقم الطاولة' : 'Table Number'}
              type="number"
              min={1}
              max={Math.max(64, effectiveSettings.tablesCount)}
              value={tableNumber}
              onChange={(e) => setTableNumber(parseInt(e.target.value || '1', 10))}
            />
            <Input
              label={lang === 'ar' ? 'الموعد (التاريخ والوقت)' : 'Scheduled Time Slot'}
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
            />
            <div className="space-y-1.5">
              <label htmlFor={roundSelectId} className="text-sm font-bold text-ink">
                {lang === 'ar' ? 'الجولة' : 'Round'}
              </label>
              <select
                id={roundSelectId}
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {localizeText(lang, r.name.en, r.name.ar)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={judgeSelectId} className="text-sm font-bold text-ink">
                {lang === 'ar' ? 'الحكم المكلّف (Judge)' : 'Assigned Judge'}
              </label>
              <select
                id={judgeSelectId}
                value={judgeUserId}
                onChange={(e) => setJudgeUserId(e.target.value)}
                className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none"
              >
                {scorers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {localizeText(lang, s.name, s.nameAr)}
                  </option>
                ))}
              </select>
            </div>
          </FormGrid>

          {!participantsLocked && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-input border border-border-paper bg-paper px-3 py-2">
              <input
                type="checkbox"
                checked={isFinal}
                onChange={(e) => handleToggleFinal(e.target.checked)}
                className="h-5 w-5 accent-red-600"
              />
              <span className="flex items-center gap-1.5 text-sm font-bold text-red-900">
                <Crown className="h-4 w-4 text-gold-600" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'تعيين كـ النهائي الكبير (1 ضد 1 ضد 1 مع مروان سري)'
                    : 'Grand Final 1v1v1 Match (2 Finalists + Marwan Serry Guest)'}
                </span>
              </span>
            </label>
          )}

          {/* Participants (Searchable 720-player Comboboxes) */}
          <div className="space-y-2.5 rounded-card border border-border-paper bg-paper p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase text-red-900">
                {lang === 'ar' ? 'المشاركون في المباراة' : 'Match Participants'}
              </span>
              {participantsLocked ? (
                <Badge variant="muted">
                  {lang === 'ar' ? 'مقفول بعد البدء' : 'Locked after start'}
                </Badge>
              ) : (
                !isFinal &&
                playerIds.length < 4 && (
                  <Button
                    type="button"
                    variant="calm"
                    size="sm"
                    onClick={() =>
                      setPlayerIds((prev) => [...prev, `tbd-seat-${prev.length + 1}`])
                    }
                    className="gap-1 min-h-[36px] h-9 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'إضافة مقعد' : 'Add Seat'}</span>
                  </Button>
                )
              )}
            </div>

            <div className="space-y-2">
              {playerIds.map((pid, idx) => {
                const isMarwanSlot = pid === MARWAN_PLAYER_ID;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-bold text-ink-muted">
                      {lang === 'ar' ? `مقعد ${idx + 1}` : `Seat ${idx + 1}`}
                    </span>
                    {isMarwanSlot ? (
                      <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-input border-2 border-outline bg-gold-gradient px-3 font-bold text-red-900 text-sm">
                        <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar'
                            ? 'مروان سري (ضيف النهائي — مقعد ثابت)'
                            : 'Marwan Serry (Guest Finalist — Locked)'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <PlayerCombobox
                          players={players}
                          value={pid.startsWith('tbd-') ? '' : pid}
                          disabled={participantsLocked}
                          onChange={(next) => handleSeatChange(idx, next)}
                          emptyOptionLabel={
                            lang === 'ar' ? 'قريباً (TBD)' : 'Open Qualifier Slot (TBD)'
                          }
                          placeholder={
                            lang === 'ar'
                              ? 'اختر لاعباً من الـ 720 أو اتركه TBD'
                              : 'Pick player (or leave TBD)...'
                          }
                        />
                      </div>
                    )}
                    {!participantsLocked && !isFinal && playerIds.length > 2 && !isMarwanSlot && (
                      <Button
                        type="button"
                        variant="calm"
                        size="icon"
                        onClick={() =>
                          setPlayerIds((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={lang === 'ar' ? 'حذف المقعد' : 'Remove seat'}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segments Selection */}
          <div className="space-y-2 rounded-card border border-border-paper bg-paper p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-red-900">
                {lang === 'ar'
                  ? `الفقرات المختارة (${segmentIds.length})`
                  : `Match Segments (${segmentIds.length})`}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
                <Sparkles className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                {lang === 'ar' ? 'مخفية عن اللاعبين قبل البث' : 'Hidden from players until live'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto pe-1">
              {segments.map((seg) => {
                const checked = segmentIds.includes(seg.id);
                return (
                  <label
                    key={seg.id}
                    className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-input border border-border-paper bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-red-600/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleSegment(seg.id)}
                      className="h-4 w-4 accent-red-600"
                    />
                    <span className="truncate">
                      {seg.order}. {localizeText(lang, seg.nameEn, seg.nameAr)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="calm"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" variant="red" disabled={saving}>
              {saving
                ? lang === 'ar'
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : liveConflicts.length > 0
                  ? lang === 'ar'
                    ? 'حفظ التجاوز اليدوي رغم التعارض'
                    : 'Save Override Despite Conflict'
                  : lang === 'ar'
                    ? 'حفظ المباراة'
                    : 'Save Match'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { GameEditorDialog as MatchEditorDialog };
