'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  Crown,
  HelpCircle,
  History,
  Layers,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  MonitorPlay,
  Phone,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  groupRepo,
  matchRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
  userRepo,
  type LeaderboardEntry,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Group,
  Match,
  Player,
  Round,
  ScoreEvent,
  Segment,
  Settings,
  User,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { AnimatedNumber } from '@/components/brand/AnimatedNumber';
import { getAvatar3DDefinition } from '@/components/brand/AvatarLibrary3D';
import {
  CardCounterGroup,
  DisciplinaryCardIcon,
  formatScoreEventDisplay,
} from '@/components/brand/DisciplinaryCards';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { getPlayerStatusMeta } from '@/components/admin/adminFormatters';
import {
  computeGameTotalsFromEvents,
  formatPublicDateTime,
  formatPublicFullDateTime,
  resolvePlayerDisplay,
} from '@/components/public/publicFormatters';
import { PublicErrorBanner } from '@/components/public/PublicErrorBanner';
import { AvatarEditorDialog } from './AvatarEditorDialog';
import { PlayerPortalChrome } from './PlayerPortalChrome';

interface PlayerPortalDataset {
  players: Player[];
  matches: Match[];
  groups: Group[];
  rounds: Round[];
  segments: Segment[];
  users: User[];
  leaderboard: LeaderboardEntry[];
  allScoreEvents: ScoreEvent[];
  settings: Settings;
}

export function PlayerProfileView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PlayerPortalDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPlayerId, setPreviewPlayerId] = useState<string>('player-1');
  const [avatarStudioOpen, setAvatarStudioOpen] = useState<boolean>(false);
  const [removingPhoto, setRemovingPhoto] = useState<boolean>(false);

  const loadSeqRef = useRef(0);
  const initializedQueryRef = useRef(false);

  const loadAll = useCallback(
    async (showSpinner = false) => {
      const seq = ++loadSeqRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        // Strictly enforce viewerRole: 'player' on matchRepo & scoreRepo reads
        // so unfinished match segments are redacted at the repository boundary (AGENTS.md §15.3)
        const [
          players,
          matches,
          groups,
          rounds,
          segments,
          users,
          leaderboard,
          allScoreEvents,
          settings,
        ] = await Promise.all([
          playerRepo.list({ includeHost: true }),
          matchRepo.list({ viewerRole: 'player' }),
          groupRepo.list(),
          roundRepo.list(),
          segmentRepo.list(),
          userRepo.list(),
          scoreRepo.getLeaderboard(),
          scoreRepo.list({ order: 'newest', viewerRole: 'player' }),
          settingsRepo.get(),
        ]);

        if (seq !== loadSeqRef.current) return;
        setData({
          players,
          matches,
          groups,
          rounds,
          segments,
          users,
          leaderboard,
          allScoreEvents,
          settings,
        });
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'تعذّر تحميل ملف المتسابق.'
              : 'Failed to load contestant profile.'
        );
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void loadAll(true);
    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)?.gameId;
      if (payloadGameId === 'game-demo') return;
      if (
        msg.event === 'score.changed' ||
        msg.event === 'game.started' ||
        msg.event === 'match.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'match.finished' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'player.updated' ||
        msg.event === 'segment.updated' ||
        msg.event === 'settings.updated' ||
        msg.event === 'data.reset'
      ) {
        void loadAll(false);
      }
    });
    return () => unsub();
  }, [loadAll]);

  // Resolve initial preview player from URL query for Super Admin only
  useEffect(() => {
    if (!data || initializedQueryRef.current) return;
    if (user?.role === 'superAdmin') {
      const qPlayer = searchParams.get('player');
      if (
        qPlayer &&
        data.players.some((p) => p.id === qPlayer && !p.isHost && !p.isGuest)
      ) {
        setPreviewPlayerId(qPlayer);
      } else {
        const firstReal = data.players.find((p) => !p.isHost && !p.isGuest);
        if (firstReal) setPreviewPlayerId(firstReal.id);
      }
    }
    initializedQueryRef.current = true;
  }, [data, user, searchParams]);

  const handleSelectPreviewPlayer = useCallback((nextId: string) => {
    setPreviewPlayerId(nextId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('player', nextId);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const activePlayerId = useMemo(() => {
    if (user?.role === 'player' && user.playerId) {
      return user.playerId;
    }
    return previewPlayerId;
  }, [user, previewPlayerId]);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const viewModel = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const roundMap = new Map(data.rounds.map((r) => [r.id, r]));
    const groupMap = new Map(data.groups.map((g) => [g.id, g]));
    const segmentMap = new Map(data.segments.map((s) => [s.id, s]));
    const userMap = new Map(data.users.map((u) => [u.id, u]));
    const matchMap = new Map(data.matches.map((m) => [m.id, m]));

    const player = playerMap.get(activePlayerId) ?? null;
    if (!player) {
      return {
        player: null,
        playerMap,
        roundMap,
        groupMap,
        segmentMap,
        userMap,
        matchMap,
      };
    }

    const lbEntry =
      data.leaderboard.find((e) => e.player.id === player.id) ?? null;
    const totalContestants = data.leaderboard.length;

    const myMatches = data.matches
      .filter(
        (m) =>
          m.playerIds.includes(player.id) ||
          m.participants.some((pt) => pt.playerId === player.id)
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );

    // Priority: LIVE / needsTieBreak match first, then earliest SCHEDULED match
    const liveMatch =
      myMatches.find(
        (m) => m.status === 'live' || m.status === 'needsTieBreak'
      ) ?? null;
    const nextScheduledMatch =
      myMatches.find((m) => m.status === 'scheduled') ?? null;
    const spotlightMatch = liveMatch ?? nextScheduledMatch;

    const spotlightTotals = spotlightMatch
      ? computeGameTotalsFromEvents(
          spotlightMatch.id,
          spotlightMatch.playerIds,
          data.allScoreEvents
        )
      : {};

    const spotlightRound = spotlightMatch
      ? (roundMap.get(spotlightMatch.roundId) ?? null)
      : null;

    const spotlightGroup =
      spotlightMatch?.groupId
        ? (groupMap.get(spotlightMatch.groupId) ?? null)
        : (data.groups.find((g) => g.playerIds.includes(player.id)) ?? null);

    const spotlightJudge = spotlightMatch
      ? (userMap.get(spotlightMatch.judgeUserId) ?? null)
      : null;

    // Resolve opponents for the upcoming / live match
    const opponents = spotlightMatch
      ? spotlightMatch.participants
          .map((part, idx) => ({ part, idx }))
          .filter(({ part }) => part.playerId !== player.id)
          .map(({ part, idx }) => {
            if (part.isBye) {
              return {
                id: `bye-${idx}`,
                name: lang === 'ar' ? 'تأهل تلقائي (BYE)' : 'BYE',
                nickname: undefined,
                avatarSeed: `bye-${idx}`,
                avatar: null,
                seed: undefined,
                isHost: false,
                isPlaceholder: true,
                isBye: true,
              };
            }
            if (part.playerId) {
              const resolved = resolvePlayerDisplay(
                part.playerId,
                playerMap,
                lang,
                idx
              );
              return {
                ...resolved,
                seed: resolved.player?.seed,
                isBye: false,
              };
            }
            return {
              id: `tbd-${idx}`,
              name:
                lang === 'ar'
                  ? part.placeholderLabelAr ?? `متأهل #${idx + 1} (TBD)`
                  : part.placeholderLabelEn ?? `Qualifier #${idx + 1} (TBD)`,
              nickname: undefined,
              avatarSeed: `tbd-${idx}`,
              avatar: null,
              seed: undefined,
              isHost: Boolean(part.guest),
              isPlaceholder: true,
              isBye: false,
            };
          })
      : [];

    const recentEvents = data.allScoreEvents
      .filter((ev) => ev.playerId === player.id)
      .slice(0, 5);

    return {
      player,
      playerMap,
      roundMap,
      groupMap,
      segmentMap,
      userMap,
      matchMap,
      lbEntry,
      totalContestants,
      myMatches,
      spotlightMatch,
      spotlightTotals,
      spotlightRound,
      spotlightGroup,
      spotlightJudge,
      opponents,
      recentEvents,
    };
  }, [data, activePlayerId, lang]);

  // Log audited contact.viewed when player taps Call or WhatsApp on the Judge Help Card
  const handleJudgeContactAction = useCallback(
    (judgeId: string, matchId: string) => {
      const actorId = user?.id ?? 'user-player-1';
      void userRepo.getJudgeContactForActor(judgeId, actorId, matchId).catch(() => {
        // Non-blocking audit call
      });
    },
    [user]
  );

  const handleQuickRemovePhoto = async (targetPlayer: Player) => {
    if (!user || removingPhoto) return;
    setRemovingPhoto(true);
    try {
      await playerRepo.updateAvatar(
        targetPlayer.id,
        {
          photoUrl: null,
          avatarKey: targetPlayer.avatar.avatarKey,
        },
        user.id
      );
      toast({
        variant: 'info',
        title:
          lang === 'ar'
            ? 'تم حذف الصورة الشخصية'
            : 'Profile photo removed',
        description:
          lang === 'ar'
            ? 'تمت استعادة الأفاتار ثلاثي الأبعاد.'
            : 'Reverted to 3D game-show avatar.',
      });
      await loadAll(false);
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذّر حذف الصورة' : 'Could not remove photo',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRemovingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-8 space-y-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-44 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data || !viewModel) {
    return (
      <div className="py-section-y px-safe">
        <PublicErrorBanner
          message={error ?? undefined}
          onRetry={() => void loadAll(true)}
        />
      </div>
    );
  }

  const { settings } = data;
  const querySuffix =
    user?.role === 'superAdmin'
      ? `?player=${encodeURIComponent(activePlayerId)}`
      : '';

  if (!viewModel.player) {
    return (
      <div className="mx-auto max-w-content-wide px-safe py-8 space-y-6">
        <PlayerPortalChrome
          players={data.players}
          matches={data.matches}
          activePlayerId={activePlayerId}
          onSelectPreviewPlayer={handleSelectPreviewPlayer}
          useArabicIndicDigits={useArabicIndic}
        />
        <EmptyState
          title={
            lang === 'ar'
              ? 'لم يتم العثور على ملف المتسابق'
              : 'Contestant profile not found'
          }
          description={
            lang === 'ar'
              ? 'هذا الحساب غير مرتبط بسجل متسابق نشط في البطولة الحالية.'
              : 'This account is not linked to an active contestant record in the current tournament.'
          }
        />
      </div>
    );
  }

  const {
    player,
    segmentMap,
    matchMap,
    lbEntry,
    totalContestants,
    spotlightMatch,
    spotlightTotals,
    spotlightRound,
    spotlightGroup,
    spotlightJudge,
    opponents,
    recentEvents,
  } = viewModel;

  const statusMeta = getPlayerStatusMeta(player.status, lang);
  const currentRank = lbEntry?.rank ?? player.seed;
  const avatar3DDef = getAvatar3DDefinition(player.avatar?.avatarKey);
  const canEditThisProfile =
    user?.role === 'superAdmin' ||
    (user?.role === 'player' && user.playerId === player.id);

  const judgePhone = spotlightJudge?.phone || '010-9000-0001';
  const judgeWaDigits = (
    spotlightJudge?.whatsapp ||
    judgePhone
  ).replace(/[^\d]/g, '');

  return (
    <div className="mx-auto max-w-content-wide px-safe py-6 sm:py-10 space-y-6">
      <PlayerPortalChrome
        players={data.players}
        matches={data.matches}
        activePlayerId={player.id}
        onSelectPreviewPlayer={handleSelectPreviewPlayer}
        useArabicIndicDigits={useArabicIndic}
      />

      {/* 1. CONTESTANT IDENTITY & AVATAR STUDIO HERO CARD */}
      <section className="rounded-card border-[3px] border-outline bg-red-600 p-5 sm:p-7 text-white shadow-sticker-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col xs:flex-row xs:items-center gap-4 min-w-0">
            <div className="relative self-start xs:self-center shrink-0">
              <PlayerAvatar
                name={localizeText(lang, player.fullName, player.fullNameAr)}
                playerId={player.id}
                avatarSeed={player.avatarSeed}
                avatar={player.avatar}
                size="xl"
                className="h-20 w-20 sm:h-24 sm:w-24"
              />
              {canEditThisProfile && (
                <button
                  type="button"
                  onClick={() => setAvatarStudioOpen(true)}
                  aria-label={
                    lang === 'ar'
                      ? 'تغيير الصورة الشخصية أو الأفاتار'
                      : 'Change profile photo or 3D avatar'
                  }
                  className="absolute -bottom-1.5 -end-1.5 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm sticker-press hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="min-w-0 space-y-1.5">
              <h1 className="font-display text-fluid-3xl text-gold-sticker leading-tight break-words">
                {localizeText(lang, player.fullName, player.fullNameAr)}
              </h1>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                <Badge variant="white" className="tabular-nums">
                  {lang === 'ar' ? 'تصنيف #' : 'Seed #'}
                  {formatNumber(player.seed, {
                    useArabicIndicDigits: useArabicIndic,
                  })}
                </Badge>
                {spotlightGroup && (
                  <Badge variant="gold">
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {localizeText(
                        lang,
                        spotlightGroup.nameEn,
                        spotlightGroup.nameAr
                      )}
                    </span>
                  </Badge>
                )}
                <Badge variant="white">
                  <Sparkles
                    className="h-3.5 w-3.5 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                  <span>
                    {player.avatar?.photoUrl
                      ? lang === 'ar'
                        ? 'صورة شخصية مرفوعة'
                        : 'Custom Profile Photo'
                      : localizeText(
                          lang,
                          avatar3DDef.nameEn,
                          avatar3DDef.nameAr
                        )}
                  </span>
                </Badge>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-white/95">
                <span className="max-w-full truncate">
                  “{localizeText(lang, player.nickname, player.nicknameAr)}”
                </span>
                <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs font-semibold text-white/85">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{player.email}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canEditThisProfile && (
              <Button
                type="button"
                variant="gold"
                size="md"
                onClick={() => setAvatarStudioOpen(true)}
                data-testid="open-avatar-studio-btn"
              >
                <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'تغيير الصورة / الأفاتار 3D'
                    : 'Photo & 3D Avatar'}
                </span>
              </Button>
            )}

            {canEditThisProfile && player.avatar?.photoUrl && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={removingPhoto}
                onClick={() => void handleQuickRemovePhoto(player)}
                data-testid="quick-remove-photo-btn"
              >
                <Trash2
                  className="h-4 w-4 shrink-0 text-negative"
                  aria-hidden="true"
                />
                <span>
                  {lang === 'ar' ? 'حذف الصورة' : 'Remove Photo'}
                </span>
              </Button>
            )}

            <Button variant="secondary" size="md" asChild>
              <Link href={`/player/history${querySuffix}`}>
                <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'سجل مبارياتي' : 'Match History'}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. CAREER STATS POKER CHIPS + DISCIPLINARY CARDS */}
      <section
        aria-label={lang === 'ar' ? 'إحصائيات المتسابق' : 'Contestant statistics'}
        className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <div className="flex min-w-0 items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={`#${formatNumber(currentRank, { useArabicIndicDigits: useArabicIndic })}`}
            tone="gold"
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'الترتيب العام' : 'Overall Rank'}
            </div>
            <div className="text-sm font-bold text-ink tabular-nums">
              {lang === 'ar'
                ? `من أصل ${formatNumber(totalContestants, { useArabicIndicDigits: useArabicIndic })}`
                : `of ${formatNumber(totalContestants, { useArabicIndicDigits: useArabicIndic })} players`}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={player.stats.totalPoints}
            tone={player.stats.totalPoints < 0 ? 'negative' : 'red'}
            useArabicIndicDigits={useArabicIndic}
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'إجمالي النقاط' : 'Total Points'}
            </div>
            <div className="text-sm font-bold text-ink tabular-nums">
              {formatNumber(player.stats.groupPoints, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'نقاط مجموعات' : 'group pts'}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3.5 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <ScoreChip
            value={player.stats.matchesPlayed}
            tone="blue"
            useArabicIndicDigits={useArabicIndic}
            size="md"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'المباريات' : 'Matches Played'}
            </div>
            <div className="text-sm font-bold text-ink tabular-nums">
              {formatNumber(player.stats.wins, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'فوز' : 'W'} ·{' '}
              {formatNumber(player.stats.losses, {
                useArabicIndicDigits: useArabicIndic,
              })}{' '}
              {lang === 'ar' ? 'خسارة' : 'L'}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 rounded-card border border-border-paper bg-white p-4 shadow-soft">
          <div className="min-w-0 space-y-1">
            <div className="text-xs font-extrabold uppercase text-ink-muted">
              {lang === 'ar' ? 'البطاقات والانضباط' : 'Cards & Fair Play'}
            </div>
            <CardCounterGroup
              yellowCount={player.stats.yellowCards}
              redCount={player.stats.redCards}
              surface="light"
              size="sm"
              lang={lang}
              useArabicIndicDigits={useArabicIndic}
            />
          </div>
          {player.stats.absences > 0 && (
            <Badge variant="negative" className="shrink-0">
              {lang === 'ar'
                ? `غياب: ${formatNumber(player.stats.absences, { useArabicIndicDigits: useArabicIndic })}`
                : `Abs: ${formatNumber(player.stats.absences, { useArabicIndicDigits: useArabicIndic })}`}
            </Badge>
          )}
        </div>
      </section>

      {/* 3. UPCOMING / LIVE MATCH VIEW + JUDGE HELP CARD + RECENT ACTIVITY */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Upcoming / Live Match Spotlight Card (ZERO segment info per §15.3) */}
        <section
          className="min-w-0 lg:col-span-7 space-y-3"
          data-testid="upcoming-match-section"
        >
          <h2 className="font-display text-fluid-2xl text-red-900">
            {spotlightMatch?.status === 'live' ||
            spotlightMatch?.status === 'needsTieBreak'
              ? lang === 'ar'
                ? 'مباراتك المباشرة الآن'
                : 'Your Live Match Right Now'
              : lang === 'ar'
                ? 'مباراتك القادمة ورقم الطاولة'
                : 'Your Upcoming Match & Table Assignment'}
          </h2>

          {spotlightMatch ? (
            <div
              className={cn(
                'rounded-card bg-white p-5 sm:p-6 text-ink space-y-5',
                spotlightMatch.status === 'live' ||
                  spotlightMatch.status === 'needsTieBreak'
                  ? 'border-[3px] border-outline ring-[3px] ring-gold-400 shadow-sticker-lg'
                  : spotlightMatch.isFinal
                    ? 'border-[3px] border-outline bg-gradient-to-b from-gold-200/45 via-white to-white shadow-sticker'
                    : 'border-[2.5px] border-outline shadow-sticker'
              )}
            >
              {/* Top Row: Status + Round & Group + Table Number Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper pb-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {spotlightMatch.status === 'live' ||
                  spotlightMatch.status === 'needsTieBreak' ? (
                    <LiveBadge surface="paper" size="sm" />
                  ) : (
                    <Badge variant="upcoming">
                      {lang === 'ar' ? 'المباراة القادمة' : 'UPCOMING MATCH'}
                    </Badge>
                  )}

                  {spotlightRound && (
                    <Badge variant="gold">
                      {localizeText(
                        lang,
                        spotlightRound.name.en,
                        spotlightRound.name.ar
                      )}
                    </Badge>
                  )}

                  {spotlightMatch.type === 'group' && spotlightGroup && (
                    <Badge variant="red">
                      {localizeText(
                        lang,
                        spotlightGroup.nameEn,
                        spotlightGroup.nameAr
                      )}
                    </Badge>
                  )}

                  {spotlightMatch.isFinal && (
                    <Badge variant="gold">
                      <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'النهائي الكبير' : 'GRAND FINAL'}
                      </span>
                    </Badge>
                  )}
                </div>

                {/* Prominent Table Number Pill */}
                <span
                  data-testid="upcoming-table-number-badge"
                  className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-red-600 px-3.5 py-1 font-score text-base font-black tracking-wide text-white shadow-sticker-sm tabular-nums"
                >
                  <span>
                    {lang === 'ar'
                      ? `طاولة رقم #${formatNumber(spotlightMatch.tableNumber, { useArabicIndicDigits: useArabicIndic })}`
                      : `TABLE #${formatNumber(spotlightMatch.tableNumber, { useArabicIndicDigits: useArabicIndic })}`}
                  </span>
                </span>
              </div>

              {/* Match Title, Date & Call Time, Round/Group & Venue */}
              <div className="min-w-0 space-y-3">
                <h3 className="font-display text-2xl text-red-900 leading-snug break-words">
                  {localizeText(
                    lang,
                    spotlightMatch.tableName,
                    spotlightMatch.tableNameAr
                  )}
                </h3>

                <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5 rounded-input border border-border-paper bg-paper px-3.5 py-2.5">
                    <Calendar
                      className="h-4 w-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase text-ink-muted">
                        {lang === 'ar' ? 'التاريخ والوقت' : 'Date & Call Time'}
                      </div>
                      <div className="font-bold text-ink tabular-nums break-words">
                        {formatPublicDateTime(
                          spotlightMatch.scheduledAt,
                          lang,
                          useArabicIndic
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-2.5 rounded-input border border-border-paper bg-paper px-3.5 py-2.5">
                    <MapPin
                      className="h-4 w-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase text-ink-muted">
                        {lang === 'ar'
                          ? 'الجولة / المجموعة والمقر'
                          : 'Round / Group & Venue'}
                      </div>
                      <div className="font-bold text-ink truncate">
                        {spotlightMatch.type === 'group' && spotlightGroup
                          ? `${localizeText(lang, spotlightGroup.nameEn, spotlightGroup.nameAr)} · `
                          : spotlightRound
                            ? `${localizeText(lang, spotlightRound.name.en, spotlightRound.name.ar)} · `
                            : ''}
                        {localizeText(lang, settings.venue, settings.venueAr)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gate Check-In Readiness Pill */}
                {spotlightMatch.status === 'scheduled' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-ink-muted pt-0.5">
                    <CheckCircle2
                      className={cn(
                        'h-4 w-4 shrink-0',
                        player.status === 'checkedIn' ||
                          player.status === 'active' ||
                          player.status === 'finalist'
                          ? 'text-positive-ink'
                          : 'text-ink-faint'
                      )}
                      aria-hidden="true"
                    />
                    <span>
                      {player.status === 'checkedIn' ||
                      player.status === 'active' ||
                      player.status === 'finalist'
                        ? lang === 'ar'
                          ? 'تم تأكيد حضورك وجاهزيتك للجلوس على الطاولة.'
                          : 'You are checked in and cleared for table seating.'
                        : lang === 'ar'
                          ? 'يرجى التوجه إلى مكتب الاستقبال قبل الموعد بـ ١٥ دقيقة لتسجيل الحضور.'
                          : 'Please check in at the venue gate 15 minutes before call time.'}
                    </span>
                  </div>
                )}
              </div>

              {/* OPPONENT SPOTLIGHT (Name & Shared Avatar per AGENTS.md §15.3) */}
              <div className="space-y-2.5" data-testid="upcoming-opponent-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase text-red-900">
                    {opponents.length > 1
                      ? lang === 'ar'
                        ? 'منافسوك في النهائي (١ ضد ١ ضد ١)'
                        : 'Your Final Opponents (1v1v1)'
                      : lang === 'ar'
                        ? 'منافسك في المباراة (١ ضد ١)'
                        : 'Your Opponent (1v1 Matchup)'}
                  </span>
                  <span className="text-xs font-bold text-ink-muted">
                    {lang === 'ar' ? 'أنت ضد المنافس' : 'Head-to-Head'}
                  </span>
                </div>

                <div
                  className={cn(
                    'grid gap-3',
                    opponents.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                  )}
                >
                  {opponents.map((opp) => {
                    const isBuzzed =
                      spotlightMatch.status === 'live' &&
                      spotlightMatch.activeBuzzPlayerId === opp.id;
                    const oppScore = spotlightTotals[opp.id] ?? 0;

                    return (
                      <div
                        key={opp.id}
                        className={cn(
                          'flex items-center justify-between gap-3.5 rounded-card border-2 p-4',
                          opp.isHost
                            ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
                            : 'border-outline bg-paper text-ink shadow-sticker-sm'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <PlayerAvatar
                            name={opp.name}
                            playerId={opp.id}
                            avatarSeed={opp.avatarSeed}
                            avatar={opp.avatar}
                            size="lg"
                            isHost={opp.isHost}
                            buzzed={isBuzzed}
                          />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-black uppercase text-red-700">
                                {opp.isHost
                                  ? lang === 'ar'
                                    ? 'المقعد الذهبي · المضيف'
                                    : 'GOLDEN SEAT · HOST'
                                  : lang === 'ar'
                                    ? 'المنافس'
                                    : 'OPPONENT'}
                              </span>
                              {typeof opp.seed === 'number' && opp.seed > 0 && (
                                <Badge variant="white" className="px-2 py-0 text-[10px] tabular-nums">
                                  #{formatNumber(opp.seed, { useArabicIndicDigits: useArabicIndic })}
                                </Badge>
                              )}
                              {isBuzzed && (
                                <Badge variant="red" className="px-2 py-0.5 text-[10px]">
                                  <Zap className="h-3 w-3" aria-hidden="true" />
                                  <span>{lang === 'ar' ? 'الجرس!' : 'BUZZED!'}</span>
                                </Badge>
                              )}
                            </div>

                            <div className="truncate font-display text-xl text-red-900">
                              {opp.name}
                            </div>

                            {opp.nickname && !opp.isPlaceholder && (
                              <div className="truncate text-xs font-bold text-ink-muted">
                                “{opp.nickname}”
                              </div>
                            )}
                          </div>
                        </div>

                        {spotlightMatch.status === 'live' && (
                          <div className="text-end shrink-0">
                            <div className="text-[10px] font-extrabold uppercase text-ink-muted">
                              {lang === 'ar' ? 'نقاطه' : 'SCORE'}
                            </div>
                            <AnimatedNumber
                              value={oppScore}
                              useArabicIndicDigits={useArabicIndic}
                              className="font-score text-3xl font-black text-red-900"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* JUDGE CONTACT & TABLE HELP STICKER CARD (DESIGN.md §6 & AGENTS.md §15.3) */}
              <div
                data-testid="judge-help-card"
                className="rounded-card border-[2.5px] border-outline bg-gradient-to-br from-gold-200/60 via-paper to-white p-4 sm:p-5 text-ink shadow-sticker space-y-3.5"
              >
                <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ScoreChip
                      value={`#${formatNumber(spotlightMatch.tableNumber, {
                        useArabicIndicDigits: useArabicIndic,
                      })}`}
                      tone="gold"
                      size="lg"
                      className="shrink-0"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-red-700">
                        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar'
                            ? 'تحتاج مساعدة للوصول إلى طاولتك؟'
                            : 'Need help finding your table?'}
                        </span>
                      </div>
                      <h4 className="font-display text-lg sm:text-xl text-red-900 leading-tight break-words">
                        {lang === 'ar'
                          ? `طاولة رقم ${formatNumber(spotlightMatch.tableNumber, { useArabicIndicDigits: useArabicIndic })} — الحكم: ${
                              spotlightJudge
                                ? localizeText(
                                    lang,
                                    spotlightJudge.name,
                                    spotlightJudge.nameAr
                                  )
                                : 'حكم الطاولة'
                            }`
                          : `Table #${formatNumber(spotlightMatch.tableNumber, { useArabicIndicDigits: useArabicIndic })} — Judge: ${
                              spotlightJudge
                                ? localizeText(
                                    lang,
                                    spotlightJudge.name,
                                    spotlightJudge.nameAr
                                  )
                                : 'Stage Judge'
                            }`}
                      </h4>
                      <p className="text-xs font-semibold text-ink-muted">
                        {lang === 'ar'
                          ? 'تواصل مباشرة مع حكم طاولتك عبر الاتصال أو واتساب إذا واجهت صعوبة في الوصول للطاولة.'
                          : 'Tap to call or WhatsApp your assigned table judge directly if you need directions or arrival help.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 border-t border-outline/15 pt-3">
                  <a
                    href={`tel:${judgePhone}`}
                    onClick={() =>
                      handleJudgeContactAction(
                        spotlightMatch.judgeUserId,
                        spotlightMatch.id
                      )
                    }
                    data-testid="judge-call-btn"
                    className="inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-button border-2 border-outline bg-red-600 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-sticker-sm sticker-press hover:bg-red-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                  >
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'اتصال بحكم الطاولة' : 'Call Table Judge'}
                    </span>
                    <span className="font-mono text-xs opacity-90" dir="ltr">
                      ({judgePhone})
                    </span>
                  </a>

                  <a
                    href={`https://wa.me/${judgeWaDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleJudgeContactAction(
                        spotlightMatch.judgeUserId,
                        spotlightMatch.id
                      )
                    }
                    data-testid="judge-whatsapp-btn"
                    className="inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-button border-2 border-outline bg-positive-soft px-4 py-2 text-xs sm:text-sm font-extrabold text-positive-ink shadow-sticker-sm sticker-press hover:bg-positive hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                  >
                    <MessageCircle
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {lang === 'ar' ? 'مراسلة عبر واتساب' : 'WhatsApp Judge'}
                    </span>
                  </a>
                </div>
              </div>

              {/* Surprise Segments Confidentiality Pill (NO segment names/order/categories!) */}
              <div className="flex items-center gap-2.5 rounded-input border border-border-paper bg-paper px-3.5 py-2.5 text-xs font-semibold text-ink-muted">
                <Lock
                  className="h-4 w-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <span>
                  {lang === 'ar'
                    ? 'فقرات المباراة سرية وتبقى مفاجأة حتى تُلعب مباشرة على المسرح وتنتهي المباراة.'
                    : 'Match segments stay a surprise until played live on stage and the match concludes.'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2.5 border-t border-border-paper pt-4">
                {spotlightMatch.status === 'live' ||
                spotlightMatch.status === 'needsTieBreak' ? (
                  <Button variant="red" size="md" asChild>
                    <Link href={`/screen/${spotlightMatch.id}`}>
                      <MonitorPlay
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {lang === 'ar'
                          ? 'متابعة شاشة العرض المباشرة'
                          : 'Watch Live Big Screen'}
                      </span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="red" size="md" asChild>
                    <Link
                      href={
                        spotlightMatch.type === 'group' && spotlightGroup
                          ? `/groups?group=${spotlightGroup.number}`
                          : `/bracket?match=${encodeURIComponent(spotlightMatch.id)}`
                      }
                    >
                      <Radio className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {spotlightMatch.type === 'group'
                          ? lang === 'ar'
                            ? 'عرض ترتيب مجموعتي'
                            : 'View My Group Standings'
                          : lang === 'ar'
                            ? 'عرض المباراة في الشجرة'
                            : 'Inspect Match on Bracket'}
                      </span>
                    </Link>
                  </Button>
                )}
                <Button variant="secondary" size="md" asChild>
                  <Link href="/rules">
                    <span>
                      {lang === 'ar' ? 'قوانين البطولة العامة' : 'General Rules'}
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title={
                player.status === 'eliminated'
                  ? lang === 'ar'
                    ? 'اكتملت مشاركتك في هذه البطولة'
                    : 'Your tournament run has concluded'
                  : lang === 'ar'
                    ? 'لا توجد طاولة قادمة مجدولة حالياً'
                    : 'No upcoming table scheduled right now'
              }
              description={
                player.status === 'eliminated'
                  ? lang === 'ar'
                    ? 'شكراً لمشاركتك المميزة! يمكنك مراجعة كامل سجل مبارياتك المنتهية فقرة بفقرة.'
                    : 'Thank you for competing! Review your completed matches and segment-by-segment score history.'
                  : lang === 'ar'
                    ? 'بانتظار تحديد جدول الجولة التالية من مدير البطولة.'
                    : 'Awaiting the next round bracket assignment from the Tournament Director.'
              }
              action={
                <Button variant="red" asChild>
                  <Link href={`/player/history${querySuffix}`}>
                    <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'مراجعة سجل مبارياتي'
                        : 'View My Match History'}
                    </span>
                  </Link>
                </Button>
              }
            />
          )}
        </section>

        {/* Recent Score Events Snapshot (Redacts segment names for unfinished matches!) */}
        <section className="min-w-0 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-fluid-2xl text-red-900">
              {lang === 'ar' ? 'آخر حركات النقاط' : 'Recent Scoring Activity'}
            </h2>
            <Link
              href={`/player/history${querySuffix}`}
              className="inline-flex min-h-[44px] items-center gap-1 text-xs font-extrabold text-blue-600 underline underline-offset-4 hover:text-blue-800"
            >
              <span>{lang === 'ar' ? 'السجل الكامل' : 'See All'}</span>
              <ArrowRight
                className="h-3.5 w-3.5 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="rounded-card border border-border-paper bg-white p-6 text-center text-sm text-ink-muted shadow-soft space-y-2">
              <Trophy
                className="mx-auto h-7 w-7 text-ink-faint"
                aria-hidden="true"
              />
              <p className="font-bold text-ink">
                {lang === 'ar'
                  ? 'لم تُسجّل نقاط بعد'
                  : 'No score events recorded yet'}
              </p>
              <p>
                {lang === 'ar'
                  ? 'ستظهر هنا كل نقاطك فور بدء أول مباراة لك على المسرح.'
                  : 'Your live points and cards will appear here as soon as your first table begins.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-paper rounded-card border border-border-paper bg-white shadow-soft overflow-hidden">
              {recentEvents.map((ev) => {
                const evMatch = matchMap.get(ev.matchId);
                const isMatchFinished = evMatch?.status === 'finished';
                const seg =
                  isMatchFinished && ev.segmentId
                    ? segmentMap.get(ev.segmentId)
                    : null;
                const isPos = ev.delta >= 0;
                const display = formatScoreEventDisplay(
                  ev,
                  lang,
                  useArabicIndic
                );

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-3 p-3.5 text-sm"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 truncate font-bold text-ink">
                        {display.cardType && (
                          <DisciplinaryCardIcon
                            card={display.cardType}
                            size="sm"
                          />
                        )}
                        <span className="truncate">
                          {seg
                            ? localizeText(lang, seg.nameEn, seg.nameAr)
                            : isMatchFinished
                              ? localizeText(
                                  lang,
                                  evMatch?.tableName ?? 'Completed Match',
                                  evMatch?.tableNameAr ?? 'مباراة منتهية'
                                )
                              : lang === 'ar'
                                ? 'حركة نقاط مباشرة (تُكشف الفقرة بعد انتهاء المباراة)'
                                : 'Live Match Play (Segment revealed after match)'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <span className="tabular-nums">
                          {formatPublicFullDateTime(
                            ev.createdAt,
                            lang,
                            useArabicIndic
                          )}
                        </span>
                        {display.cardType ? (
                          <span className="truncate font-semibold text-red-800">
                            · {display.kindLabel}
                            {display.userNote ? ` — ${display.userNote}` : ''}
                          </span>
                        ) : ev.note ? (
                          <span className="truncate font-medium text-ink">
                            · {ev.note}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {display.cardType ? (
                      <Badge
                        variant={
                          display.cardType === 'yellow' ? 'gold' : 'negative'
                        }
                        className="shrink-0 text-xs font-extrabold"
                      >
                        <DisciplinaryCardIcon
                          card={display.cardType}
                          size="xs"
                        />
                        <span>{display.kindLabel}</span>
                      </Badge>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-0.5 rounded-pill border px-2.5 py-1 font-score text-base font-black tabular-nums',
                          isPos
                            ? 'border-positive bg-positive-soft text-positive-ink'
                            : 'border-outline bg-negative text-white'
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
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* AVATAR & PROFILE STUDIO MODAL */}
      <AvatarEditorDialog
        open={avatarStudioOpen}
        onOpenChange={setAvatarStudioOpen}
        player={player}
        actorUserId={user?.id ?? 'user-player-1'}
        allowNicknameEdit={canEditThisProfile}
        useArabicIndicDigits={useArabicIndic}
        onSaved={() => void loadAll(false)}
      />
    </div>
  );
}
