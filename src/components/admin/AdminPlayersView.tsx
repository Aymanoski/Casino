'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  gameRepo,
  playerRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import {
  PlayerStatusSchema,
  type Game,
  type Player,
  type PlayerStatus,
  type ScoreEvent,
  type Segment,
  type Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
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
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { ScoreChip } from '@/components/brand/ScoreChip';
import {
  CardCounterGroup,
  DisciplinaryCardIcon,
  formatScoreEventDisplay,
} from '@/components/brand/DisciplinaryCards';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import {
  formatAdminDateTime,
  formatAdminTimeShort,
  getGameStatusMeta,
  getPlayerStatusMeta,
} from './adminFormatters';
import {
  downloadCsvFile,
  parseAndValidatePlayerCsv,
  SAMPLE_PLAYERS_CSV,
} from './csvUtils';

const PlayerFormSchema = z.object({
  fullName: z.string().trim().min(2),
  fullNameAr: z.string().trim().optional(),
  nickname: z.string().trim().min(1),
  nicknameAr: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(5),
  status: PlayerStatusSchema,
  seed: z.coerce.number().int().min(1).max(999),
});

interface PlayerFormState {
  fullName: string;
  fullNameAr: string;
  nickname: string;
  nicknameAr: string;
  email: string;
  phone: string;
  status: PlayerStatus;
  seed: string;
}

const ALL_STATUSES: PlayerStatus[] = [
  'registered',
  'checkedIn',
  'absent',
  'active',
  'eliminated',
  'finalist',
];

export function AdminPlayersView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PlayerStatus>('all');

  // Create / Edit Dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [formState, setFormState] = useState<PlayerFormState>({
    fullName: '',
    fullNameAr: '',
    nickname: '',
    nicknameAr: '',
    email: '',
    phone: '+20 100 555 ',
    status: 'registered',
    seed: '28',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // CSV Bulk Import Dialog
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // Profile Drawer
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [profileHistory, setProfileHistory] = useState<ScoreEvent[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const statusSelectId = React.useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const closeProfileDrawer = useCallback(() => {
    setProfilePlayer(null);
    const prev = previousFocusRef.current;
    previousFocusRef.current = null;
    if (prev && typeof prev.focus === 'function') {
      window.requestAnimationFrame(() => prev.focus());
    }
  }, []);

  // Trap Escape key, lock body scroll, and move initial focus into Profile Drawer (WCAG 2.1.1 / 2.4.3)
  useEffect(() => {
    if (!profilePlayer) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.requestAnimationFrame(() => {
      drawerCloseBtnRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeProfileDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [profilePlayer, closeProfileDrawer]);

  const loadData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [allPlayers, allGames, allSegments, appSettings] = await Promise.all([
        playerRepo.list(),
        gameRepo.list(),
        segmentRepo.list(),
        settingsRepo.get(),
      ]);
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setPlayers(allPlayers);
      setGames(allGames);
      setSegments(allSegments);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل قائمة اللاعبين.'
          : 'Failed to load tournament players.'
      );
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'player.updated' ||
        msg.event === 'score.changed' ||
        msg.event === 'game.finished' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'data.reset'
      ) {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  // Keep open profile drawer in sync with latest player stats/status
  useEffect(() => {
    if (!profilePlayer) return;
    const latest = players.find((p) => p.id === profilePlayer.id);
    if (latest) {
      setProfilePlayer(latest);
    }
  }, [players, profilePlayer]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const segmentMap = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  const filteredPlayers = useMemo(() => {
    if (statusFilter === 'all') return players;
    return players.filter((p) => p.status === statusFilter);
  }, [players, statusFilter]);

  const existingEmails = useMemo(
    () => new Set(players.map((p) => p.email.toLowerCase())),
    [players]
  );

  const csvPreviewRows = useMemo(
    () => parseAndValidatePlayerCsv(csvText, existingEmails),
    [csvText, existingEmails]
  );

  const validCsvRows = useMemo(
    () => csvPreviewRows.filter((r) => r.valid),
    [csvPreviewRows]
  );
  const invalidCsvRows = useMemo(
    () => csvPreviewRows.filter((r) => !r.valid),
    [csvPreviewRows]
  );

  const openCreateDialog = () => {
    const nextSeed = players.reduce((max, p) => Math.max(max, p.seed), 0) + 1;
    setEditingPlayer(null);
    setFormState({
      fullName: '',
      fullNameAr: '',
      nickname: '',
      nicknameAr: '',
      email: '',
      phone: `+20 100 555 ${String(1000 + nextSeed)}`,
      status: 'registered',
      seed: String(nextSeed),
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditDialog = (player: Player) => {
    setEditingPlayer(player);
    setFormState({
      fullName: player.fullName,
      fullNameAr: player.fullNameAr,
      nickname: player.nickname,
      nicknameAr: player.nicknameAr,
      email: player.email,
      phone: player.phone,
      status: player.status,
      seed: String(player.seed),
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openProfileDrawer = async (player: Player) => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setProfilePlayer(player);
    setProfileLoading(true);
    try {
      const history = await scoreRepo.listByPlayer(player.id);
      if (mountedRef.current) setProfileHistory(history);
    } finally {
      if (mountedRef.current) setProfileLoading(false);
    }
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = PlayerFormSchema.safeParse(formState);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? 'form');
        errs[key] =
          lang === 'ar'
            ? 'يرجى التحقق من هذا الحقل'
            : issue.message;
      });
      setFormErrors(errs);
      return;
    }

    const emailLower = parsed.data.email.toLowerCase();
    const duplicate = players.find(
      (p) => p.email.toLowerCase() === emailLower && p.id !== editingPlayer?.id
    );
    if (duplicate) {
      setFormErrors({
        email:
          lang === 'ar'
            ? 'هذا البريد مسجل بالفعل للاعب آخر'
            : 'Email is already assigned to another player.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const arrivalOnly = (
        ['registered', 'checkedIn', 'absent'] as const
      ).includes(parsed.data.status as 'registered' | 'checkedIn' | 'absent')
        ? (parsed.data.status as 'registered' | 'checkedIn' | 'absent')
        : 'registered';

      if (editingPlayer) {
        await playerRepo.update(
          editingPlayer.id,
          {
            fullName: parsed.data.fullName,
            fullNameAr: parsed.data.fullNameAr || parsed.data.fullName,
            nickname: parsed.data.nickname,
            nicknameAr: parsed.data.nicknameAr || parsed.data.nickname,
            email: emailLower,
            phone: parsed.data.phone,
            seed: parsed.data.seed,
          },
          user.id
        );
        if (
          arrivalOnly !== editingPlayer.status &&
          (['registered', 'checkedIn', 'absent'] as const).includes(
            editingPlayer.status as 'registered' | 'checkedIn' | 'absent'
          )
        ) {
          await playerRepo.recordCheckIn(editingPlayer.id, arrivalOnly, user.id);
        }
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم تحديث بيانات اللاعب' : 'Player updated',
          description: localizeText(
            lang,
            parsed.data.fullName,
            parsed.data.fullNameAr || parsed.data.fullName
          ),
        });
      } else {
        await playerRepo.create(
          {
            fullName: parsed.data.fullName,
            fullNameAr: parsed.data.fullNameAr || parsed.data.fullName,
            nickname: parsed.data.nickname,
            nicknameAr: parsed.data.nicknameAr || parsed.data.nickname,
            email: emailLower,
            phone: parsed.data.phone,
            initialCheckInStatus: arrivalOnly,
            seed: parsed.data.seed,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تمت إضافة اللاعب' : 'Player added to roster',
          description: localizeText(
            lang,
            parsed.data.fullName,
            parsed.data.fullNameAr || parsed.data.fullName
          ),
        });
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل الحفظ' : 'Save failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (
    player: Player,
    nextStatus: 'registered' | 'checkedIn' | 'absent'
  ) => {
    if (!user || busyPlayerId === player.id) return;
    setBusyPlayerId(player.id);
    try {
      await playerRepo.recordCheckIn(player.id, nextStatus, user.id);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم تحديث الحضور' : 'Check-in status recorded',
        description: `${localizeText(lang, player.fullName, player.fullNameAr)} → ${getPlayerStatusMeta(nextStatus, lang).label}`,
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر تحديث الحالة' : 'Unable to update status',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyPlayerId(null);
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    if (!user) return;
    try {
      await playerRepo.remove(player.id, user.id);
      if (profilePlayer?.id === player.id) setProfilePlayer(null);
      toast({
        variant: 'info',
        title: lang === 'ar' ? 'تم حذف اللاعب' : 'Player removed',
        description: localizeText(lang, player.fullName, player.fullNameAr),
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حذف اللاعب' : 'Failed to remove player',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleCommitCsvImport = async () => {
    if (!user || validCsvRows.length === 0) return;
    setImporting(true);
    try {
      const created = await playerRepo.bulkCreate(
        validCsvRows.map((r) => ({
          fullName: r.fullName,
          fullNameAr: r.fullNameAr,
          nickname: r.nickname,
          nicknameAr: r.nicknameAr,
          phone: r.phone,
          email: r.email,
          initialCheckInStatus: (
            ['registered', 'checkedIn', 'absent'] as const
          ).includes(r.status as 'registered' | 'checkedIn' | 'absent')
            ? (r.status as 'registered' | 'checkedIn' | 'absent')
            : 'registered',
        })),
        user.id
      );
      toast({
        variant: 'positive',
        title:
          lang === 'ar'
            ? `تم استيراد ${created.length} متسابقين بنجاح`
            : `Imported ${created.length} players`,
        description:
          invalidCsvRows.length > 0
            ? lang === 'ar'
              ? `تم تجاهل ${invalidCsvRows.length} صفوف غير صالحة.`
              : `Skipped ${invalidCsvRows.length} invalid row(s).`
            : undefined,
      });
      setCsvText('');
      setCsvOpen(false);
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'فشل استيراد CSV' : 'CSV import failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    downloadCsvFile(
      'casino-players-template.csv',
      ['fullName', 'fullNameAr', 'nickname', 'nicknameAr', 'phone', 'email', 'status'],
      [
        ['Ziad Tarek', 'زياد طارق', 'Zizo', 'زيزو', '+20 100 555 2001', 'ziad.tarek@players.casino', 'registered'],
        ['Malak Hossam', 'ملك حسام', 'Moka', 'موكا', '+20 100 555 2002', 'malak.hossam@players.casino', 'checkedIn'],
      ]
    );
  };

  const statItems = useMemo(
    () => [
      {
        id: 'total',
        value: players.length,
        label: lang === 'ar' ? 'المتسابقون المسجلون' : 'Total Contestants',
        detail: lang === 'ar' ? 'بدون مقعد مروان سري' : 'Excluding Marwan host seat',
        tone: 'red' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'active',
        value: players.filter((p) => p.status === 'active' || p.status === 'finalist').length,
        label: lang === 'ar' ? 'نشط / متأهل' : 'Active & Finalists',
        detail: lang === 'ar' ? 'مستمرون في التصفيات' : 'Still in contention',
        tone: 'gold' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'checked-in',
        value: players.filter((p) => p.status === 'checkedIn').length,
        label: lang === 'ar' ? 'تم تسجيل الحضور' : 'Checked In',
        detail: lang === 'ar' ? 'جاهزون للطاولات' : 'Verified at gate',
        tone: 'white' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'registered',
        value: players.filter((p) => p.status === 'registered').length,
        label: lang === 'ar' ? 'بانتظار الوصول' : 'Awaiting Arrival',
        detail:
          lang === 'ar'
            ? `${players.filter((p) => p.status === 'absent').length} غائب`
            : `${players.filter((p) => p.status === 'absent').length} marked absent`,
        tone: 'blue' as const,
        useArabicIndicDigits: useArabicIndic,
      },
    ],
    [players, lang, useArabicIndic]
  );

  const columns = useMemo<DataTableColumn<Player>[]>(
    () => [
      {
        key: 'seed',
        header: lang === 'ar' ? 'التصنيف' : 'Seed',
        sortable: true,
        sortAccessor: (p) => p.seed,
        mobileRole: 'badge',
        render: (p) => (
          <span className="inline-flex h-8 min-w-[2.25rem] items-center justify-center rounded-pill border border-border-paper bg-paper-2 px-2 font-score text-base font-black tabular-nums text-red-900">
            #{formatNumber(p.seed, { useArabicIndicDigits: useArabicIndic })}
          </span>
        ),
      },
      {
        key: 'player',
        header: lang === 'ar' ? 'المتسابق' : 'Contestant',
        sortable: true,
        sortAccessor: (p) => localizeText(lang, p.fullName, p.fullNameAr).toLowerCase(),
        mobileRole: 'title',
        render: (p) => (
          <button
            type="button"
            onClick={() => openProfileDrawer(p)}
            className="flex min-h-[44px] items-center gap-3 text-start group focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 rounded-input pe-2"
          >
            <PlayerAvatar
              name={localizeText(lang, p.fullName, p.fullNameAr)}
              avatarSeed={p.avatarSeed}
              size="sm"
            />
            <div className="min-w-0">
              <div className="truncate font-bold text-ink group-hover:text-red-600 transition-colors">
                {localizeText(lang, p.fullName, p.fullNameAr)}
              </div>
              <div className="truncate text-xs text-ink-muted">
                “{localizeText(lang, p.nickname, p.nicknameAr)}” · {p.email}
              </div>
            </div>
          </button>
        ),
      },
      {
        key: 'status',
        header: lang === 'ar' ? 'الحالة' : 'Status',
        sortable: true,
        sortAccessor: (p) => p.status,
        render: (p) => {
          const isArrivalOnly =
            p.status === 'registered' ||
            p.status === 'checkedIn' ||
            p.status === 'absent';
          if (!isArrivalOnly) {
            const meta = getPlayerStatusMeta(p.status, lang);
            return <Badge variant={meta.variant}>{meta.label}</Badge>;
          }
          return (
            <select
              aria-label={`${lang === 'ar' ? 'حضور' : 'Arrival status for'} ${p.fullName}`}
              value={p.status}
              onChange={(e) =>
                handleQuickStatusChange(
                  p,
                  e.target.value as 'registered' | 'checkedIn' | 'absent'
                )
              }
              className="min-h-[44px] rounded-input border border-border-paper bg-white px-2.5 py-1.5 text-base sm:text-xs font-bold text-ink focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/25"
            >
              {(['registered', 'checkedIn', 'absent'] as const).map((st) => (
                <option key={st} value={st}>
                  {getPlayerStatusMeta(st, lang).label}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        key: 'points',
        header: lang === 'ar' ? 'النقاط' : 'Points',
        sortable: true,
        sortAccessor: (p) => p.stats.totalPoints,
        render: (p) => (
          <span className="font-score text-xl font-black tabular-nums text-red-900">
            {formatNumber(p.stats.totalPoints, { useArabicIndicDigits: useArabicIndic })}
          </span>
        ),
      },
      {
        key: 'record',
        header: lang === 'ar' ? 'الفوز / اللعب' : 'W / G',
        sortable: true,
        sortAccessor: (p) => p.stats.wins * 100 + p.stats.gamesPlayed,
        render: (p) => (
          <span className="text-xs font-bold tabular-nums text-ink-muted">
            {formatNumber(p.stats.wins, { useArabicIndicDigits: useArabicIndic })}W ·{' '}
            {formatNumber(p.stats.gamesPlayed, { useArabicIndicDigits: useArabicIndic })}G
          </span>
        ),
      },
      {
        key: 'phone',
        header: lang === 'ar' ? 'الهاتف' : 'Phone',
        render: (p) => (
          <span className="whitespace-nowrap text-xs text-ink-muted tabular-nums" dir="ltr">
            {p.phone}
          </span>
        ),
      },
      {
        key: 'actions',
        header: lang === 'ar' ? 'إجراءات' : 'Actions',
        render: (p) => (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="calm"
              size="icon"
              onClick={() => openProfileDrawer(p)}
              aria-label={lang === 'ar' ? `عرض سجل ${p.fullNameAr}` : `View history for ${p.fullName}`}
              title={lang === 'ar' ? 'الملف والسجل' : 'Profile & History'}
            >
              <Eye className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              type="button"
              variant="calm"
              size="icon"
              onClick={() => openEditDialog(p)}
              aria-label={lang === 'ar' ? `تعديل ${p.fullNameAr}` : `Edit ${p.fullName}`}
              title={lang === 'ar' ? 'تعديل' : 'Edit'}
            >
              <Pencil className="h-4 w-4 text-ink" />
            </Button>
            <ConfirmDialog
              destructive
              title={lang === 'ar' ? 'حذف المتسابق؟' : 'Remove Contestant?'}
              description={
                lang === 'ar'
                  ? `سيتم حذف ${p.fullNameAr} نهائياً من قائمة البطولة وتسجيل العملية في سجل المراجعة.`
                  : `Remove ${p.fullName} ("${p.nickname}") from the roster? This action is recorded in the audit log.`
              }
              confirmLabel={lang === 'ar' ? 'حذف اللاعب' : 'Remove Player'}
              cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
              onConfirm={() => handleDeletePlayer(p)}
              trigger={
                <Button
                  type="button"
                  variant="calm"
                  size="icon"
                  aria-label={lang === 'ar' ? `حذف ${p.fullNameAr}` : `Delete ${p.fullName}`}
                  title={lang === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 className="h-4 w-4 text-negative" />
                </Button>
              }
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, useArabicIndic, players]
  );

  const profileGames = useMemo(() => {
    if (!profilePlayer) return [];
    return games.filter((g) => g.playerIds.includes(profilePlayer.id));
  }, [games, profilePlayer]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} shape="card" className="h-24 w-full" />
          ))}
        </div>
        <div className="rounded-card border border-border-paper bg-white overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRowSkeleton key={i} columns={5} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'إدارة اللاعبين' : 'Players Roster'}
        description={
          lang === 'ar'
            ? 'إضافة وتعديل حسابات المتسابقين (لا يوجد تسجيل عام)، الاستيراد الجماعي عبر CSV، ومتابعة سجل النقاط.'
            : 'Admin-managed contestant accounts (no public self-registration), CSV bulk import with validation, and player score history.'
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCsvOpen(true)}
            >
              <Upload className="h-4 w-4" />
              <span>{lang === 'ar' ? 'استيراد CSV' : 'Bulk CSV Import'}</span>
            </Button>
            <Button
              type="button"
              variant="red"
              size="sm"
              onClick={openCreateDialog}
            >
              <UserPlus className="h-4 w-4" />
              <span>{lang === 'ar' ? 'إضافة لاعب' : 'Add Player'}</span>
            </Button>
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      <DataTable
        data={filteredPlayers}
        columns={columns}
        getRowKey={(p) => p.id}
        searchPlaceholder={
          lang === 'ar'
            ? 'ابحث بالاسم أو اللقب أو البريد أو الهاتف...'
            : 'Search by name, nickname, email, or phone...'
        }
        searchFilter={(p, q) =>
          normalizeSearchText(p.fullName).includes(q) ||
          normalizeSearchText(p.fullNameAr).includes(q) ||
          normalizeSearchText(p.nickname).includes(q) ||
          normalizeSearchText(p.nicknameAr).includes(q) ||
          normalizeSearchText(p.email).includes(q) ||
          normalizeSearchText(p.phone).includes(q)
        }
        filterLabel={lang === 'ar' ? 'تصفية بالحالة' : 'Status Filter'}
        filterSlot={
          <select
            aria-label={lang === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | PlayerStatus)
            }
            className="min-h-[44px] h-11 w-full md:w-auto rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/25"
          >
            <option value="all">
              {lang === 'ar' ? 'جميع الحالات' : 'All Statuses'}
            </option>
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {getPlayerStatusMeta(st, lang).label}
              </option>
            ))}
          </select>
        }
        emptyTitle={lang === 'ar' ? 'لا يوجد لاعبون مطابقون' : 'No matching players'}
        emptyDescription={
          lang === 'ar'
            ? 'جرّب تغيير البحث أو تصفية الحالة، أو أضف لاعباً جديداً.'
            : 'Adjust your search or status filter, or create a new contestant.'
        }
      />

      {/* Create / Edit Player Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlayer
                ? lang === 'ar'
                  ? 'تعديل بيانات المتسابق'
                  : 'Edit Contestant'
                : lang === 'ar'
                  ? 'إضافة متسابق جديد'
                  : 'Add New Contestant'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'أدخل الاسم واللقب باللغتين الإنجليزية والعربية مع بيانات التواصل.'
                : 'Enter bilingual display names, nickname, contact info, and initial seed.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePlayer} className="space-y-4">
            <FormGrid columns={2}>
              <Input
                label={lang === 'ar' ? 'الاسم الكامل (إنجليزي)' : 'Full Name (EN)'}
                value={formState.fullName}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, fullName: e.target.value }))
                }
                error={formErrors.fullName}
                placeholder="Omar Hassan"
                required
              />
              <Input
                label={lang === 'ar' ? 'الاسم الكامل (عربي)' : 'Full Name (AR)'}
                value={formState.fullNameAr}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, fullNameAr: e.target.value }))
                }
                placeholder="عمر حسن"
                dir="rtl"
              />
              <Input
                label={lang === 'ar' ? 'اللقب (إنجليزي)' : 'Nickname (EN)'}
                value={formState.nickname}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, nickname: e.target.value }))
                }
                error={formErrors.nickname}
                placeholder="The Fox"
                required
              />
              <Input
                label={lang === 'ar' ? 'اللقب (عربي)' : 'Nickname (AR)'}
                value={formState.nicknameAr}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, nicknameAr: e.target.value }))
                }
                placeholder="الثعلب"
                dir="rtl"
              />
              <Input
                label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                type="email"
                value={formState.email}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, email: e.target.value }))
                }
                error={formErrors.email}
                placeholder="player@players.casino"
                required
              />
              <Input
                label={lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
                value={formState.phone}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, phone: e.target.value }))
                }
                error={formErrors.phone}
                placeholder="+20 100 555 1028"
                required
              />
              <Input
                label={lang === 'ar' ? 'رقم التصنيف (Seed)' : 'Tournament Seed'}
                type="number"
                min={1}
                max={999}
                value={formState.seed}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, seed: e.target.value }))
                }
                error={formErrors.seed}
                required
              />
              <div className="space-y-1.5">
                <label
                  htmlFor={statusSelectId}
                  className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink"
                >
                  {lang === 'ar' ? 'الحالة' : 'Status'}
                </label>
                <select
                  id={statusSelectId}
                  value={formState.status}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      status: e.target.value as PlayerStatus,
                    }))
                  }
                  className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3.5 text-base text-ink focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/25"
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {getPlayerStatusMeta(st, lang).label}
                    </option>
                  ))}
                </select>
              </div>
            </FormGrid>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" variant="red" disabled={submitting}>
                {submitting
                  ? lang === 'ar'
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : editingPlayer
                    ? lang === 'ar'
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : lang === 'ar'
                      ? 'إنشاء المتسابق'
                      : 'Create Player'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Bulk Import Dialog */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ar'
                ? 'استيراد جماعي للاعبين (CSV)'
                : 'Bulk Import Players via CSV'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'ارفع ملف CSV أو الصق البيانات أدناه للتحقق الفوري من كل صف قبل الاستيراد.'
                : 'Upload a .csv file or paste rows below to validate every entry and preview errors before importing.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-button border-2 border-outline bg-white px-4 py-2 text-xs sm:text-sm font-bold text-ink shadow-sticker-sm sticker-press hover:bg-paper">
                <FileSpreadsheet className="h-4 w-4 text-red-600" />
                <span>{lang === 'ar' ? 'اختيار ملف CSV' : 'Choose .csv File'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="sr-only"
                />
              </label>

              <Button
                type="button"
                variant="surface"
                size="sm"
                onClick={() => setCsvText(SAMPLE_PLAYERS_CSV)}
              >
                <span>
                  {lang === 'ar'
                    ? 'تحميل مثال تجريبي (٣ صالح + ١ خطأ)'
                    : 'Load Sample CSV (3 valid + 1 error)'}
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDownloadCsvTemplate}
              >
                <Download className="h-4 w-4" />
                <span>{lang === 'ar' ? 'تنزيل القالب' : 'Template'}</span>
              </Button>
            </div>

            <Textarea
              label={
                lang === 'ar'
                  ? 'محتوى CSV (الأعمدة: fullName, fullNameAr, nickname, nicknameAr, phone, email, status)'
                  : 'CSV Content (columns: fullName, fullNameAr, nickname, nicknameAr, phone, email, status)'
              }
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={5}
              placeholder="fullName,fullNameAr,nickname,nicknameAr,phone,email,status"
              dir="ltr"
            />

            {csvPreviewRows.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="positive">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {lang === 'ar'
                        ? `صفوف صالحة: ${validCsvRows.length}`
                        : `Valid rows: ${validCsvRows.length}`}
                    </span>
                  </Badge>
                  {invalidCsvRows.length > 0 && (
                    <Badge variant="negative">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>
                        {lang === 'ar'
                          ? `صفوف بها أخطاء: ${invalidCsvRows.length}`
                          : `Rows with errors: ${invalidCsvRows.length}`}
                      </span>
                    </Badge>
                  )}
                </div>

                <div className="max-h-60 overflow-auto rounded-input border border-border-paper">
                  <table className="w-full text-start text-xs">
                    <thead className="sticky top-0 bg-paper-2 text-red-900 font-extrabold">
                      <tr>
                        <th className="px-3 py-2 text-start">#</th>
                        <th className="px-3 py-2 text-start">
                          {lang === 'ar' ? 'الاسم' : 'Name'}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {lang === 'ar' ? 'اللقب' : 'Nickname'}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {lang === 'ar' ? 'البريد' : 'Email'}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {lang === 'ar' ? 'التحقق' : 'Validation'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-paper bg-white">
                      {csvPreviewRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={cn(!row.valid && 'bg-negative-soft/60')}
                        >
                          <td className="px-3 py-2 font-bold tabular-nums">
                            {row.rowNumber}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            {localizeText(lang, row.fullName, row.fullNameAr) || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {localizeText(lang, row.nickname, row.nicknameAr) || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {row.email || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 font-bold text-positive-ink">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{lang === 'ar' ? 'جاهز' : 'Ready'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-start gap-1 font-bold text-negative">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {(lang === 'ar' ? row.errorsAr : row.errorsEn).join(' ')}
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCsvOpen(false)}
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
            <Button
              type="button"
              variant="red"
              disabled={validCsvRows.length === 0 || importing}
              onClick={handleCommitCsvImport}
            >
              <Upload className="h-4 w-4" />
              <span>
                {importing
                  ? lang === 'ar'
                    ? 'جارٍ الاستيراد...'
                    : 'Importing...'
                  : lang === 'ar'
                    ? `استيراد ${validCsvRows.length} لاعب صالح`
                    : `Import ${validCsvRows.length} Valid Player(s)`}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player Profile & History Slide-Over Drawer */}
      {profilePlayer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-red-900/60 backdrop-blur-sm"
          onClick={closeProfileDrawer}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={localizeText(
              lang,
              profilePlayer.fullName,
              profilePlayer.fullNameAr
            )}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-lg flex-col border-s-[3px] border-outline bg-white text-ink shadow-sticker-lg overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border-paper bg-paper p-5">
              <div className="flex items-center gap-3.5 min-w-0">
                <PlayerAvatar
                  name={localizeText(
                    lang,
                    profilePlayer.fullName,
                    profilePlayer.fullNameAr
                  )}
                  avatarSeed={profilePlayer.avatarSeed}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="white">
                      #{formatNumber(profilePlayer.seed, { useArabicIndicDigits: useArabicIndic })}
                    </Badge>
                    <Badge
                      variant={getPlayerStatusMeta(profilePlayer.status, lang).variant}
                    >
                      {getPlayerStatusMeta(profilePlayer.status, lang).label}
                    </Badge>
                  </div>
                  <h2 className="mt-1 break-words font-display text-2xl text-red-900">
                    {localizeText(
                      lang,
                      profilePlayer.fullName,
                      profilePlayer.fullNameAr
                    )}
                  </h2>
                  <p className="break-words text-sm text-ink-muted">
                    “{localizeText(lang, profilePlayer.nickname, profilePlayer.nicknameAr)}”
                  </p>
                </div>
              </div>

              <Button
                ref={drawerCloseBtnRef}
                type="button"
                variant="calm"
                size="icon"
                onClick={closeProfileDrawer}
                aria-label={lang === 'ar' ? 'إغلاق الملف' : 'Close drawer'}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Poker-Chip Stats */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex flex-col items-center gap-1.5 rounded-card border border-border-paper bg-paper p-3 text-center">
                  <ScoreChip
                    value={profilePlayer.stats.totalPoints}
                    tone="gold"
                    size="sm"
                    useArabicIndicDigits={useArabicIndic}
                  />
                  <span className="text-[11px] font-bold text-ink-muted">
                    {lang === 'ar' ? 'إجمالي النقاط' : 'Total Points'}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-card border border-border-paper bg-paper p-3 text-center">
                  <ScoreChip
                    value={profilePlayer.stats.wins}
                    tone="red"
                    size="sm"
                    useArabicIndicDigits={useArabicIndic}
                  />
                  <span className="text-[11px] font-bold text-ink-muted">
                    {lang === 'ar' ? 'انتصارات' : 'Wins'}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-card border border-border-paper bg-paper p-3 text-center">
                  <ScoreChip
                    value={profilePlayer.stats.gamesPlayed}
                    tone="blue"
                    size="sm"
                    useArabicIndicDigits={useArabicIndic}
                  />
                  <span className="text-[11px] font-bold text-ink-muted">
                    {lang === 'ar' ? 'مباريات' : 'Games'}
                  </span>
                </div>
              </div>

              {/* Disciplinary Cards & Absences Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-border-paper bg-paper/60 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink-muted">
                    {lang === 'ar' ? 'البطاقات:' : 'Cards:'}
                  </span>
                  <CardCounterGroup
                    yellowCount={profilePlayer.stats.yellowCards}
                    redCount={profilePlayer.stats.redCards}
                    surface="light"
                    size="sm"
                    lang={lang}
                    useArabicIndicDigits={useArabicIndic}
                  />
                </div>
                <Badge
                  variant={profilePlayer.stats.absences > 0 ? 'negative' : 'muted'}
                >
                  {lang === 'ar'
                    ? `غياب: ${formatNumber(profilePlayer.stats.absences, { useArabicIndicDigits: useArabicIndic })}`
                    : `Absences: ${formatNumber(profilePlayer.stats.absences, { useArabicIndicDigits: useArabicIndic })}`}
                </Badge>
              </div>

              {/* Contact Metadata */}
              <div className="rounded-input border border-border-paper bg-paper/60 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-ink-muted">
                    {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </span>
                  <span className="font-semibold text-ink">{profilePlayer.email}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-ink-muted">
                    {lang === 'ar' ? 'الهاتف' : 'Phone'}
                  </span>
                  <span className="font-semibold text-ink tabular-nums" dir="ltr">
                    {profilePlayer.phone}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-ink-muted">
                    {lang === 'ar' ? 'تاريخ الإضافة' : 'Added'}
                  </span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatAdminDateTime(profilePlayer.createdAt, lang, useArabicIndic)}
                  </span>
                </div>
              </div>

              {/* Assigned Games */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                  {lang === 'ar' ? 'المباريات المسجل بها' : 'Tournament Tables'}
                </h3>
                {profileGames.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    {lang === 'ar'
                      ? 'لم يُعيَّن في أي طاولة بعد.'
                      : 'Not seated at any table yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {profileGames.map((g) => {
                      const meta = getGameStatusMeta(g.status, lang);
                      const won = g.winnerPlayerId === profilePlayer.id;
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-2 rounded-input border border-border-paper bg-white px-3 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-ink">
                              {won && (
                                <Trophy className="h-3.5 w-3.5 shrink-0 text-gold-600" />
                              )}
                              <span className="truncate">
                                {localizeText(lang, g.tableName, g.tableNameAr)}
                              </span>
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              {formatAdminTimeShort(g.scheduledAt, lang, useArabicIndic)}
                            </div>
                          </div>
                          <Badge variant={won ? 'gold' : meta.variant}>
                            {won ? (lang === 'ar' ? 'فائز' : 'Winner') : meta.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chronological Score History */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900">
                  {lang === 'ar' ? 'سجل النقاط التفصيلي' : 'Scoring History'}
                </h3>
                {profileLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : profileHistory.length === 0 ? (
                  <EmptyState
                    compact
                    title={lang === 'ar' ? 'لا توجد حركات نقاط' : 'No score events yet'}
                    description={
                      lang === 'ar'
                        ? 'ستظهر جميع النقاط المضافة أو المخصومة لهذا المتسابق هنا.'
                        : 'Points awarded or deducted across sessions will appear here.'
                    }
                  />
                ) : (
                  <ol className="divide-y divide-border-paper rounded-input border border-border-paper bg-white">
                    {profileHistory.map((ev) => {
                      const g = gameMap.get(ev.gameId);
                      const seg = segmentMap.get(ev.segmentId);
                      const isPos = ev.delta >= 0;
                      const display = formatScoreEventDisplay(ev, lang, useArabicIndic);
                      return (
                        <li
                          key={ev.id}
                          className="flex items-start justify-between gap-2.5 p-3 text-xs"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                              {display.cardType && (
                                <DisciplinaryCardIcon
                                  card={display.cardType}
                                  size="sm"
                                />
                              )}
                              <span className="truncate">
                                {seg
                                  ? localizeText(lang, seg.nameEn, seg.nameAr)
                                  : ev.segmentId}
                              </span>
                            </div>
                            <div className="text-ink-muted truncate">
                              {g ? localizeText(lang, g.tableName, g.tableNameAr) : ev.gameId}
                              {display.cardType ? (
                                <>
                                  {' · '}
                                  <strong className="text-ink">{display.kindLabel}</strong>
                                  {display.userNote ? ` — ${display.userNote}` : ''}
                                </>
                              ) : ev.note ? (
                                ` · ${ev.note}`
                              ) : (
                                ''
                              )}
                            </div>
                            <time className="block text-[11px] text-ink-faint tabular-nums">
                              {formatAdminDateTime(ev.createdAt, lang, useArabicIndic)}
                            </time>
                          </div>
                          {display.cardType ? (
                            <Badge
                              variant={display.cardType === 'yellow' ? 'gold' : 'negative'}
                              className="shrink-0 text-[11px] font-extrabold"
                            >
                              {display.kindLabel}
                            </Badge>
                          ) : (
                            <Badge
                              variant={isPos ? 'positive' : 'negative'}
                              className="shrink-0 font-score text-sm tabular-nums"
                            >
                              {isPos ? (
                                <Plus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                              ) : (
                                <Minus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                              )}
                              <span>
                                {formatNumber(Math.abs(ev.delta), {
                                  useArabicIndicDigits: useArabicIndic,
                                })}
                              </span>
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border-paper bg-paper p-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openEditDialog(profilePlayer)}
              >
                <Pencil className="h-4 w-4" />
                <span>{lang === 'ar' ? 'تعديل البيانات' : 'Edit Player'}</span>
              </Button>
              <Button
                type="button"
                variant="red"
                size="sm"
                onClick={closeProfileDrawer}
              >
                {lang === 'ar' ? 'تم' : 'Done'}
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
