'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  RotateCcw,
  Search,
  UserX,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  gameRepo,
  playerRepo,
  roundRepo,
  settingsRepo,
} from '@/lib/repos';
import type {
  Game,
  Player,
  PlayerStatus,
  Round,
  Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { LiveBadge } from '@/components/brand/LiveBadge';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';
import {
  ContactIconButton,
  PlayerContactDialog,
} from '@/components/brand/PlayerContactDialog';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import {
  formatAdminTimeShort,
  getGameStatusMeta,
  getPlayerStatusMeta,
} from './adminFormatters';

export function AdminCheckInView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [players, setPlayers] = useState<Player[]>([]);
  const [hostPlayer, setHostPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [contactPlayer, setContactPlayer] = useState<Player | null>(null);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [allPlayersWithHost, allGames, allRounds, appSettings] =
        await Promise.all([
          playerRepo.list({ includeHost: true }),
          gameRepo.list(),
          roundRepo.list(),
          settingsRepo.get(),
        ]);

      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setPlayers(allPlayersWithHost.filter((p) => !p.isHost));
      setHostPlayer(allPlayersWithHost.find((p) => p.isHost) ?? null);
      setGames(allGames);
      setRounds(allRounds);
      setSettings(appSettings);
      setError(null);
    } catch {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل بيانات بوابة الحضور.'
          : 'Failed to load check-in gate roster.'
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
        msg.event === 'bracket.updated' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'data.reset'
      ) {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    if (hostPlayer) map.set(hostPlayer.id, hostPlayer);
    return map;
  }, [players, hostPlayer]);

  const roundMap = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);

  const activeAndUpcomingGames = useMemo(() => {
    return games
      .filter((g) => g.status === 'live' || g.status === 'scheduled')
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });
  }, [games]);

  const filteredRoster = useMemo(() => {
    const q = normalizeSearchText(search);
    if (!q) return players;
    return players.filter(
      (p) =>
        normalizeSearchText(p.fullName).includes(q) ||
        normalizeSearchText(p.fullNameAr).includes(q) ||
        normalizeSearchText(p.nickname).includes(q) ||
        normalizeSearchText(p.nicknameAr).includes(q) ||
        normalizeSearchText(p.phone).includes(q)
    );
  }, [players, search]);

  const handleSetArrival = async (
    player: Player,
    nextStatus: Extract<PlayerStatus, 'checkedIn' | 'absent' | 'registered'>
  ) => {
    if (!user || player.isHost) return;
    setBusyPlayerId(player.id);
    try {
      await playerRepo.updateStatus(player.id, nextStatus, user.id);
      toast({
        variant:
          nextStatus === 'checkedIn'
            ? 'positive'
            : nextStatus === 'absent'
              ? 'negative'
              : 'info',
        title: localizeText(lang, player.fullName, player.fullNameAr),
        description: getPlayerStatusMeta(nextStatus, lang).label,
      });
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر تحديث الحضور' : 'Check-in update failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (mountedRef.current) setBusyPlayerId(null);
    }
  };

  const statItems = useMemo(
    () => [
      {
        id: 'checked-in',
        value: players.filter((p) => p.status === 'checkedIn').length,
        label: lang === 'ar' ? 'تم تسجيل الحضور' : 'Checked In',
        detail: lang === 'ar' ? 'جاهزون عند البوابة' : 'Verified at arrival desk',
        tone: 'white' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'pending',
        value: players.filter((p) => p.status === 'registered').length,
        label: lang === 'ar' ? 'بانتظار الوصول' : 'Pending Arrival',
        detail: lang === 'ar' ? 'مسجل ولم يحضر بعد' : 'Registered, not arrived',
        tone: 'blue' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'absent',
        value: players.filter((p) => p.status === 'absent').length,
        label: lang === 'ar' ? 'غائب' : 'Marked Absent',
        detail: lang === 'ar' ? 'يحتاج متابعة فورية' : 'Requires gate follow-up',
        tone: 'red' as const,
        useArabicIndicDigits: useArabicIndic,
      },
      {
        id: 'upcoming-tables',
        value: activeAndUpcomingGames.length,
        label: lang === 'ar' ? 'طاولات اليوم' : 'Active Tables',
        detail: lang === 'ar' ? 'مباشرة ومجدولة' : 'Live and scheduled sessions',
        tone: 'gold' as const,
        useArabicIndicDigits: useArabicIndic,
      },
    ],
    [players, activeAndUpcomingGames.length, lang, useArabicIndic]
  );

  const renderArrivalControls = (p: Player) => {
    const busy = busyPlayerId === p.id;
    const isCheckedIn = p.status === 'checkedIn';
    const isAbsent = p.status === 'absent';
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <ContactIconButton
          playerName={localizeText(lang, p.fullName, p.fullNameAr)}
          surface="light"
          onClick={() => setContactPlayer(p)}
        />
        <Button
          type="button"
          variant="calm"
          size="sm"
          disabled={busy}
          onClick={() => handleSetArrival(p, 'checkedIn')}
          className={cn(
            isCheckedIn &&
              'border-2 border-positive bg-positive text-white hover:bg-positive-ink hover:border-positive-ink shadow-sm'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{lang === 'ar' ? 'حاضر' : 'Check In'}</span>
        </Button>

        <Button
          type="button"
          variant={isAbsent ? 'destructiveSolid' : 'calm'}
          size="sm"
          disabled={busy}
          onClick={() => handleSetArrival(p, 'absent')}
        >
          <UserX className="h-4 w-4" />
          <span>{lang === 'ar' ? 'غائب' : 'Absent'}</span>
        </Button>

        {(isCheckedIn || isAbsent) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={() => handleSetArrival(p, 'registered')}
            title={lang === 'ar' ? 'إعادة إلى مسجل' : 'Reset to Registered'}
            aria-label={lang === 'ar' ? 'إعادة الحالة إلى مسجل' : 'Reset status'}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} shape="card" className="h-24 w-full" />
          ))}
        </div>
        <Skeleton shape="card" className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'بوابة تسجيل حضور اللاعبين' : 'Gate Check-In Desk'}
        description={
          lang === 'ar'
            ? 'عرض طاولات اليوم والمباريات القادمة وتسجيل حضور المتسابقين أو غيابهم بضغطة واحدة.'
            : "Review today's active and scheduled tables and mark contestants as checked in or absent in a single tap."
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      <Tabs defaultValue="tables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tables">
            {lang === 'ar'
              ? `طاولات اليوم والقادمة (${formatNumber(activeAndUpcomingGames.length, { useArabicIndicDigits: useArabicIndic })})`
              : `Today's & Upcoming Tables (${activeAndUpcomingGames.length})`}
          </TabsTrigger>
          <TabsTrigger value="roster">
            {lang === 'ar'
              ? `كل اللاعبين (${formatNumber(players.length, { useArabicIndicDigits: useArabicIndic })})`
              : `All Players (${players.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4">
          {activeAndUpcomingGames.length === 0 ? (
            <EmptyState
              compact
              title={
                lang === 'ar'
                  ? 'لا توجد مباريات مجدولة أو مباشرة'
                  : 'No live or upcoming tables'
              }
              description={
                lang === 'ar'
                  ? 'كل مباريات البطولة الحالية مكتملة.'
                  : 'All currently scheduled tables have already finished.'
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {activeAndUpcomingGames.map((game) => {
                const round = roundMap.get(game.roundId);
                const gMeta = getGameStatusMeta(game.status, lang);

                return (
                  <div
                    key={game.id}
                    className="rounded-card border border-border-paper bg-white p-4 sm:p-5 shadow-soft space-y-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-paper pb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {game.status === 'live' ? (
                            <LiveBadge size="sm" surface="paper" />
                          ) : (
                            <Badge variant={gMeta.variant}>{gMeta.label}</Badge>
                          )}
                          {round && (
                            <Badge variant="white">
                              {localizeText(lang, round.name.en, round.name.ar)}
                            </Badge>
                          )}
                        </div>
                        <h2 className="mt-1.5 flex items-center gap-1.5 font-display text-lg text-red-900">
                          {game.isFinal && (
                            <Crown className="h-4 w-4 shrink-0 text-gold-600" />
                          )}
                          <span className="truncate">
                            {localizeText(lang, game.tableName, game.tableNameAr)}
                          </span>
                        </h2>
                      </div>

                      <div className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-red-600" />
                        <span>
                          {formatAdminTimeShort(game.scheduledAt, lang, useArabicIndic)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {game.playerIds.map((pid, sIdx) => {
                        const p = playerMap.get(pid);
                        if (!p) {
                          return (
                            <div
                              key={`${game.id}-tbd-${sIdx}`}
                              className="flex min-h-[52px] items-center justify-between rounded-input border border-dashed border-border-paper bg-paper px-3 py-2 text-xs text-ink-muted italic"
                            >
                              <span>
                                {lang === 'ar'
                                  ? `مقعد متأهل ${sIdx + 1} (TBD)`
                                  : `Open Qualifier Slot ${sIdx + 1} (TBD)`}
                              </span>
                            </div>
                          );
                        }

                        if (p.isHost) {
                          return (
                            <div
                              key={p.id}
                              className="flex min-h-[52px] items-center justify-between gap-2 rounded-input border-2 border-outline bg-gold-gradient px-3 py-2 text-red-900"
                            >
                              <div className="flex items-center gap-2 font-extrabold text-sm">
                                <Crown className="h-4 w-4 shrink-0" />
                                <span>
                                  {localizeText(lang, p.fullName, p.fullNameAr)}
                                </span>
                              </div>
                              <Badge variant="white">
                                {lang === 'ar' ? 'المقعد الذهبي' : 'VIP Host'}
                              </Badge>
                            </div>
                          );
                        }

                        const stMeta = getPlayerStatusMeta(p.status, lang);
                        return (
                          <div
                            key={p.id}
                            className="flex flex-col gap-2.5 rounded-input border border-border-paper bg-paper p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <PlayerAvatar
                                name={localizeText(lang, p.fullName, p.fullNameAr)}
                                avatarSeed={p.avatarSeed}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-bold text-ink">
                                    {localizeText(lang, p.fullName, p.fullNameAr)}
                                  </span>
                                  <Badge variant={stMeta.variant} className="text-[11px]">
                                    {stMeta.label}
                                  </Badge>
                                </div>
                                <div className="truncate text-xs text-ink-muted" dir="ltr">
                                  “{localizeText(lang, p.nickname, p.nicknameAr)}” · {p.phone}
                                </div>
                              </div>
                            </div>

                            {renderArrivalControls(p)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="roster" className="space-y-4">
          <div className="max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="h-4 w-4" />}
              aria-label={
                lang === 'ar'
                  ? 'ابحث باسم المتسابق أو اللقب أو الهاتف'
                  : 'Search walk-up contestant by name, nickname, or phone'
              }
              placeholder={
                lang === 'ar'
                  ? 'ابحث باسم المتسابق أو اللقب أو الهاتف...'
                  : 'Search walk-up contestant by name, nickname, or phone...'
              }
            />
          </div>

          <div className="grid gap-2.5 md:grid-cols-2">
            {filteredRoster.map((p) => {
              const stMeta = getPlayerStatusMeta(p.status, lang);
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-card border border-border-paper bg-white p-3.5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar
                      name={localizeText(lang, p.fullName, p.fullNameAr)}
                      avatarSeed={p.avatarSeed}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-ink">
                          #{p.seed} {localizeText(lang, p.fullName, p.fullNameAr)}
                        </span>
                        <Badge variant={stMeta.variant} className="text-[11px]">
                          {stMeta.label}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-ink-muted">
                        “{localizeText(lang, p.nickname, p.nicknameAr)}” ·{' '}
                        <span dir="ltr">{p.phone}</span>
                      </div>
                    </div>
                  </div>

                  {renderArrivalControls(p)}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {user && (
        <PlayerContactDialog
          open={Boolean(contactPlayer)}
          onOpenChange={(open) => {
            if (!open) setContactPlayer(null);
          }}
          player={contactPlayer}
          actorUserId={user.id}
        />
      )}
    </div>
  );
}
