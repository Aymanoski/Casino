'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type {
  Game,
  GameStatus,
  Player,
  Round,
  Segment,
  User,
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
import {
  fromDateTimeLocalInput,
  getGameStatusMeta,
  toDateTimeLocalInput,
} from './adminFormatters';

export interface GameEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  rounds: Round[];
  players: Player[];
  scorers: User[];
  segments: Segment[];
  defaultPlayersPerGame?: number;
  onSave: (
    payload: Omit<Game, 'id'>,
    existingGameId?: string
  ) => Promise<void>;
}

const GAME_STATUSES: GameStatus[] = ['scheduled', 'live', 'finished'];

export function GameEditorDialog({
  open,
  onOpenChange,
  game,
  rounds,
  players,
  scorers,
  segments,
  defaultPlayersPerGame = 3,
  onSave,
}: GameEditorDialogProps) {
  const { lang } = useI18n();

  const [roundId, setRoundId] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableNameAr, setTableNameAr] = useState('');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [scorerUserId, setScorerUserId] = useState('');
  const [status, setStatus] = useState<GameStatus>('scheduled');
  const [isFinal, setIsFinal] = useState(false);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nonHostPlayers = useMemo(
    () => players.filter((p) => !p.isHost),
    [players]
  );

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (game) {
      setRoundId(game.roundId);
      setTableName(game.tableName);
      setTableNameAr(game.tableNameAr);
      setScheduledAtLocal(toDateTimeLocalInput(game.scheduledAt));
      setScorerUserId(game.scorerUserId);
      setStatus(game.status);
      setIsFinal(Boolean(game.isFinal));
      setPlayerIds([...game.playerIds]);
      setSegmentIds([...game.segmentIds]);
    } else {
      const defaultRound = rounds[0]?.id ?? 'round-1';
      const defaultScorer = scorers[0]?.id ?? 'user-scorer-1';
      const defaultSegs = segments
        .filter((s) => s.id !== 'seg-16')
        .slice(0, 6)
        .map((s) => s.id);
      const seatCount = Math.max(2, defaultPlayersPerGame);
      const initialSeats = Array.from({ length: seatCount }, (_, idx) => {
        return nonHostPlayers[idx]?.id ?? `tbd-seat-${idx + 1}`;
      });
      setRoundId(defaultRound);
      setTableName(`Table ${Math.floor(Math.random() * 20) + 10} — Show Stage`);
      setTableNameAr('طاولة جديدة — المسرح');
      setScheduledAtLocal(
        toDateTimeLocalInput(new Date(Date.now() + 3600_000).toISOString())
      );
      setScorerUserId(defaultScorer);
      setStatus('scheduled');
      setIsFinal(false);
      setPlayerIds(initialSeats);
      setSegmentIds(defaultSegs.length > 0 ? defaultSegs : ['seg-1']);
    }
  }, [open, game, rounds, scorers, segments, nonHostPlayers, defaultPlayersPerGame]);

  const handleToggleFinal = (checked: boolean) => {
    setIsFinal(checked);
    if (checked) {
      const nonMarwan = playerIds.filter((pid) => pid !== 'player-marwan').slice(0, 2);
      while (nonMarwan.length < 2) {
        nonMarwan.push(`tbd-final-${nonMarwan.length + 1}`);
      }
      setPlayerIds([...nonMarwan, 'player-marwan']);
      const finalRound = rounds.find(
        (r) => r.id === 'round-final' || r.name.en.toLowerCase().includes('final')
      );
      if (finalRound) setRoundId(finalRound.id);
    } else {
      setPlayerIds((prev) =>
        prev.map((pid, idx) =>
          pid === 'player-marwan' ? `tbd-seat-${idx + 1}` : pid
        )
      );
    }
  };

  const handleSeatChange = (idx: number, nextPid: string) => {
    setPlayerIds((prev) => prev.map((p, i) => (i === idx ? nextPid : p)));
  };

  const handleAddSeat = () => {
    if (isFinal || playerIds.length >= 6) return;
    setPlayerIds((prev) => [...prev, `tbd-seat-${prev.length + 1}`]);
  };

  const handleRemoveSeat = (idx: number) => {
    if (isFinal || playerIds.length <= 2) return;
    setPlayerIds((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleSegment = (segId: string) => {
    setSegmentIds((prev) => {
      if (prev.includes(segId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== segId);
      }
      return [...prev, segId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      setFormError(
        lang === 'ar' ? 'اسم الطاولة مطلوب.' : 'Table name is required.'
      );
      return;
    }
    if (playerIds.length < 2) {
      setFormError(
        lang === 'ar'
          ? 'يجب تعيين لاعبين على الأقل لكل مباراة.'
          : 'At least 2 seats are required per game.'
      );
      return;
    }
    if (segmentIds.length === 0) {
      setFormError(
        lang === 'ar'
          ? 'اختر فقرة واحدة على الأقل.'
          : 'Select at least 1 segment.'
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<Game, 'id'> = {
        roundId,
        tableName: tableName.trim(),
        tableNameAr: tableNameAr.trim() || tableName.trim(),
        scheduledAt: fromDateTimeLocalInput(scheduledAtLocal),
        status,
        scorerUserId,
        playerIds,
        currentSegmentIndex: game
          ? Math.min(game.currentSegmentIndex, segmentIds.length - 1)
          : 0,
        segmentIds,
        winnerPlayerId: game?.winnerPlayerId,
        advancingPlayerIds: game?.advancingPlayerIds,
        isFinal,
        startedAt: game?.startedAt,
        finishedAt: game?.finishedAt,
        activeBuzzPlayerId: game?.activeBuzzPlayerId ?? null,
        timer: game?.timer ?? { status: 'idle', durationSec: 45, remainingSec: 45 },
        podOrder: game?.podOrder,
        isDemo: false,
      };
      await onSave(payload, game?.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {game
              ? lang === 'ar'
                ? 'تعديل بيانات المباراة والطاولة'
                : 'Edit Game Session'
              : lang === 'ar'
                ? 'إنشاء مباراة جديدة'
                : 'Create New Game Session'}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ar'
              ? 'عيّن اسم الطاولة، التوقيت، الحكم، المتسابقين، والفقرات أو فعّل وضع النهائي الكبير ضد مروان سري.'
              : 'Assign table name, schedule time, scorer, seated players, segment lineup, or mark as the Grand Final vs. Marwan Serry.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-input border border-negative bg-negative-soft px-3.5 py-2.5 text-xs font-bold text-negative"
            >
              {formError}
            </div>
          )}

          {/* Mark as Final Toggle Banner */}
          <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-card border-2 border-outline bg-gold-200/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Crown className="h-5 w-5 shrink-0 text-gold-600" />
              <div>
                <div className="text-sm font-extrabold text-red-900">
                  {lang === 'ar'
                    ? 'تعيين هذه المباراة كـ «النهائي الكبير» (متأهلان + مروان سري)'
                    : 'Mark as Grand Final (2 Finalists + Marwan Serry)'}
                </div>
                <div className="text-xs text-ink-muted">
                  {lang === 'ar'
                    ? 'يتم حجز المقعد الذهبي لمروان سري تلقائياً وتفعيل إطار البث النهائي.'
                    : 'Automatically locks Marwan Serry into Seat 3 (Golden Seat) and activates Final Night mode.'}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isFinal}
              onChange={(e) => handleToggleFinal(e.target.checked)}
              className="h-5 w-5 accent-red-600 shrink-0"
            />
          </label>

          <FormGrid columns={2}>
            <Input
              label={lang === 'ar' ? 'اسم الطاولة (إنجليزي)' : 'Table Name (EN)'}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              required
            />
            <Input
              label={lang === 'ar' ? 'اسم الطاولة (عربي)' : 'Table Name (AR)'}
              value={tableNameAr}
              onChange={(e) => setTableNameAr(e.target.value)}
              dir="rtl"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                {lang === 'ar' ? 'الجولة' : 'Round'}
              </label>
              <select
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {localizeText(lang, r.name.en, r.name.ar)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                {lang === 'ar' ? 'حكم الطاولة' : 'Assigned Scorer'}
              </label>
              <select
                value={scorerUserId}
                onChange={(e) => setScorerUserId(e.target.value)}
                className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none"
              >
                {scorers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {localizeText(lang, u.name, u.nameAr)}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label={lang === 'ar' ? 'التاريخ والوقت' : 'Scheduled Date & Time'}
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                {lang === 'ar' ? 'حالة المباراة' : 'Game Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GameStatus)}
                className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3 text-base text-ink focus:border-blue-500 focus:outline-none"
              >
                {GAME_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {getGameStatusMeta(st, lang).label}
                  </option>
                ))}
              </select>
            </div>
          </FormGrid>

          {/* Seated Contestants */}
          <div className="space-y-2.5 rounded-input border border-border-paper bg-paper p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar'
                  ? `مقاعد الطاولة (${playerIds.length})`
                  : `Seated Contestants (${playerIds.length})`}
              </span>
              {!isFinal && playerIds.length < 6 && (
                <Button
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={handleAddSeat}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ar' ? 'إضافة مقعد' : 'Add Seat'}</span>
                </Button>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {playerIds.map((pid, idx) => {
                const isMarwanSlot = isFinal && pid === 'player-marwan';
                return (
                  <div key={`seat-${idx}`} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-ink-muted">
                      <span>
                        {isMarwanSlot
                          ? lang === 'ar'
                            ? 'المقعد الذهبي'
                            : 'Golden Seat'
                          : `${lang === 'ar' ? 'المقعد' : 'Seat'} ${idx + 1}`}
                      </span>
                      {!isFinal && playerIds.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSeat(idx)}
                          className="text-negative hover:underline"
                          aria-label={lang === 'ar' ? 'إزالة المقعد' : 'Remove seat'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isMarwanSlot ? (
                      <div className="flex min-h-[44px] items-center gap-2 rounded-input border-2 border-outline bg-gold-gradient px-3 text-xs font-extrabold text-red-900">
                        <Crown className="h-4 w-4 shrink-0" />
                        <span>
                          {lang === 'ar' ? 'مروان سري (المضيف)' : 'Marwan Serry (Host)'}
                        </span>
                      </div>
                    ) : (
                      <select
                        value={pid}
                        onChange={(e) => handleSeatChange(idx, e.target.value)}
                        className="flex min-h-[44px] h-11 w-full rounded-input border border-border-paper bg-white px-2.5 text-base sm:text-xs font-semibold text-ink focus:border-blue-500 focus:outline-none"
                      >
                        <option value={`tbd-seat-${idx + 1}`}>
                          {lang === 'ar' ? '— مقعد متأهل قادم (TBD) —' : '— Open Qualifier Slot (TBD) —'}
                        </option>
                        {pid.startsWith('tbd-') && pid !== `tbd-seat-${idx + 1}` && (
                          <option value={pid}>
                            {lang === 'ar' ? 'مقعد متأهل (TBD)' : 'Open Qualifier Slot (TBD)'}
                          </option>
                        )}
                        {nonHostPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.seed} {localizeText(lang, p.fullName, p.fullNameAr)} (“{localizeText(lang, p.nickname, p.nicknameAr)}”)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segments Lineup */}
          <div className="space-y-2 rounded-input border border-border-paper bg-paper p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                {lang === 'ar'
                  ? `فقرات المباراة (${segmentIds.length} مختارة)`
                  : `Segment Lineup (${segmentIds.length} selected)`}
              </span>
              <Badge variant="white">
                {lang === 'ar' ? 'اضغط للتحديد' : 'Tap to toggle'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {segments.map((seg) => {
                const selected = segmentIds.includes(seg.id);
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => toggleSegment(seg.id)}
                    className={`min-h-[38px] rounded-pill border px-3 py-1 text-xs font-bold transition-colors ${
                      selected
                        ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                        : 'border-border-paper bg-white text-ink hover:bg-paper-2'
                    }`}
                  >
                    #{seg.order} {localizeText(lang, seg.nameEn, seg.nameAr)}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" variant="red" disabled={saving}>
              {saving
                ? lang === 'ar'
                  ? 'جارٍ الحفظ...'
                  : 'Saving...'
                : game
                  ? lang === 'ar'
                    ? 'حفظ المباراة'
                    : 'Save Session'
                  : lang === 'ar'
                    ? 'إنشاء المباراة'
                    : 'Create Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
