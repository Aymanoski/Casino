'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  Clock,
  Crown,
  MapPin,
  Minus,
  MonitorPlay,
  Plus,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type {
  Game,
  Player,
  Round,
  Segment,
  Settings,
} from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AnimatedNumber,
  CrescentStar,
  LiveBadge,
  MarqueeBulbs,
  PlayerAvatar,
  PlayingCardFan,
  PlayingDice,
  SectionHeading,
  Spotlight,
  StageDivider,
  SunburstStage,
} from '@/components/brand';
import {
  computeCountdown,
  formatPublicDateTime,
  resolvePlayerDisplay,
  SEGMENT_CATEGORY_INFO,
} from './publicFormatters';
import { PublicErrorBanner } from './PublicErrorBanner';
import { PublicPageHero } from './PublicPageHero';

interface FinalData {
  settings: Settings;
  rounds: Round[];
  games: Game[];
  players: Player[];
  segments: Segment[];
  finalTotals: Record<string, number>;
}

export function FinalShowcaseView() {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const [data, setData] = useState<FinalData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const loadSeqRef = useRef(0);

  const loadAll = useCallback(async (showSpinner = false) => {
    const seq = ++loadSeqRef.current;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [settings, rounds, games, players, segments] = await Promise.all([
        settingsRepo.get(),
        roundRepo.list(),
        gameRepo.list(),
        playerRepo.list({ includeHost: true }),
        segmentRepo.list(),
      ]);

      const finalGame =
        games.find((g) => g.isFinal) ??
        games.find((g) => g.roundId === 'round-final') ??
        null;

      const finalTotals = finalGame
        ? await scoreRepo.getGameTotals(finalGame.id)
        : {};

      if (seq !== loadSeqRef.current) return;
      setData({ settings, rounds, games, players, segments, finalTotals });
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذّر تحميل بيانات النهائي.'
            : 'Failed to load Final Night data.'
      );
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [lang]);

  useEffect(() => {
    void loadAll(true);
    const unsub = realtime.subscribe('*', () => {
      void loadAll(false);
    });
    return () => unsub();
  }, [loadAll]);

  useEffect(() => {
    setNowMs(Date.now());
    const tid = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(tid);
  }, []);

  const useArabicIndic = data?.settings.useArabicIndicDigits ?? false;

  const derived = useMemo(() => {
    if (!data) return null;
    const playerMap = new Map(data.players.map((p) => [p.id, p]));
    const segmentMap = new Map(data.segments.map((s) => [s.id, s]));

    const finalGame =
      data.games.find((g) => g.isFinal) ??
      data.games.find((g) => g.roundId === 'round-final') ??
      null;

    const semiGame =
      data.games.find((g) => g.roundId === 'round-semi') ?? null;

    const liveGames = data.games.filter((g) => g.status === 'live');
    const marwan =
      data.players.find((p) => p.isHost) ?? playerMap.get('player-marwan') ?? null;

    const semiFinished = semiGame?.status === 'finished';

    // Determine symmetrical 3-seat lineup: [Finalist 1, Marwan Serry (center), Finalist 2]
    const rawFinalIds = finalGame?.playerIds ?? [
      'tbd-final-1',
      'tbd-final-2',
      'player-marwan',
    ];
    const hostId =
      rawFinalIds.find((pid) => playerMap.get(pid)?.isHost) ??
      marwan?.id ??
      'player-marwan';
    const challengerIds = rawFinalIds.filter((pid) => pid !== hostId);
    while (challengerIds.length < 2) {
      challengerIds.push(`tbd-final-${challengerIds.length + 1}`);
    }

    const buildSeat = (pid: string, slotIdx: number, isCenterHost: boolean) => {
      const resolved = resolvePlayerDisplay(pid, playerMap, lang, slotIdx);
      const isConfirmed =
        isCenterHost ||
        (!resolved.isPlaceholder &&
          (semiFinished ||
            finalGame?.status === 'live' ||
            finalGame?.status === 'finished'));
      const score =
        finalGame &&
        (finalGame.status === 'live' || finalGame.status === 'finished')
          ? (data.finalTotals[pid] ?? 0)
          : null;
      const isWinner = Boolean(
        finalGame?.status === 'finished' && finalGame.winnerPlayerId === pid
      );
      const isBuzzed = Boolean(
        finalGame?.status === 'live' && finalGame.activeBuzzPlayerId === pid
      );

      return {
        ...resolved,
        isCenterHost,
        isConfirmed,
        score,
        isWinner,
        isBuzzed,
        slotNumber: isCenterHost ? 3 : slotIdx + 1,
      };
    };

    const seatLeft = buildSeat(challengerIds[0], 0, false);
    const seatCenter = buildSeat(hostId, 2, true);
    const seatRight = buildSeat(challengerIds[1], 1, false);

    const finalSegments: Segment[] = finalGame
      ? finalGame.segmentIds
          .map((id) => segmentMap.get(id))
          .filter((s): s is Segment => Boolean(s))
      : [];

    const roadRounds = [...data.rounds]
      .sort((a, b) => a.order - b.order)
      .map((round) => {
        const rGames = data.games.filter((g) => g.roundId === round.id);
        const finishedCount = rGames.filter((g) => g.status === 'finished').length;
        const liveCount = rGames.filter((g) => g.status === 'live').length;
        const liveGame = rGames.find((g) => g.status === 'live') ?? null;
        return {
          round,
          totalGames: rGames.length,
          finishedCount,
          liveCount,
          liveGame,
        };
      });

    return {
      finalGame,
      semiGame,
      semiFinished,
      liveGames,
      seats: [seatLeft, seatCenter, seatRight] as const,
      finalSegments,
      roadRounds,
    };
  }, [data, lang]);

  const targetIso = data?.settings.finalNightIso ?? '2027-03-22T21:00:00.000Z';
  const countdown = nowMs === null ? null : computeCountdown(targetIso, nowMs);

  const countdownCells = [
    { key: 'days', val: countdown?.days ?? null, labelEn: 'DAYS', labelAr: 'يوم' },
    { key: 'hours', val: countdown?.hours ?? null, labelEn: 'HOURS', labelAr: 'ساعة' },
    { key: 'minutes', val: countdown?.minutes ?? null, labelEn: 'MINS', labelAr: 'دقيقة' },
    { key: 'seconds', val: countdown?.seconds ?? null, labelEn: 'SECS', labelAr: 'ثانية' },
  ];

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-red-600 py-14">
          <div className="mx-auto max-w-content-wide px-safe space-y-6">
            <Skeleton className="h-14 w-2/3 max-w-xl bg-white/25" />
            <Skeleton className="h-6 w-1/2 max-w-md bg-white/20" />
            <div className="grid gap-4 md:grid-cols-3 pt-4">
              <Skeleton className="h-60 w-full bg-white/20" />
              <Skeleton className="h-64 w-full bg-white/30" />
              <Skeleton className="h-60 w-full bg-white/20" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-content-wide px-safe grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !derived) {
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
  const { finalGame, semiFinished, seats, finalSegments, roadRounds } = derived;
  const isFinalLive = finalGame?.status === 'live';
  const isFinalFinished = finalGame?.status === 'finished';

  return (
    <div className="flex flex-col">
      {/* 1. STAGE SHOWCASE HERO + 3-SEAT GOLDEN SPOTLIGHT */}
      <PublicPageHero
        title={
          lang === 'ar'
            ? 'ليلة النهائي — المتأهلان أمام مروان سري'
            : 'The Final Night — Two Finalists vs. Marwan Serry'
        }
        goldHighlight={lang === 'ar' ? 'مروان سري' : 'Marwan Serry'}
        subtitle={
          lang === 'ar'
            ? 'طاولة واحدة من ٣ مقاعد تحت أضواء الاستوديو: بطلا نصف النهائي في مواجهة مروان سري عبر ٨ فقرات حاسمة لتتويج بطل رمضان.'
            : 'One three-seat championship stage under studio spotlights: the top two semi-finalists face Marwan Serry across eight decisive segments for the Ramadan crown.'
        }
        showLanterns
        dividerVariant="zigzag"
        meta={
          <>
            {isFinalLive ? (
              <LiveBadge
                surface="stage"
                label={lang === 'ar' ? 'النهائي مباشر الآن' : 'FINAL LIVE NOW'}
              />
            ) : isFinalFinished ? (
              <Badge variant="gold">
                <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'اكتمل النهائي الكبير' : 'CHAMPION CROWNED'}
                </span>
              </Badge>
            ) : (
              <Badge variant="white">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
                <span>
                  {localizeText(lang, settings.eventDates, settings.eventDatesAr)}
                </span>
              </Badge>
            )}
            <Badge variant="white">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
              <span>{localizeText(lang, settings.venue, settings.venueAr)}</span>
            </Badge>
          </>
        }
        actions={
          <>
            {finalGame && (
              <Button variant="gold" size="lg" asChild>
                <Link href={`/screen/${finalGame.id}`}>
                  <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'شاشة النهائي العملاقة' : 'Launch Final Big Screen'}
                  </span>
                </Link>
              </Button>
            )}
            <Button variant="secondary" size="lg" asChild>
              <Link href="/sponsors">
                <Sparkles className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'رعاية ليلة النهائي' : 'Sponsor Final Night'}
                </span>
              </Link>
            </Button>
          </>
        }
      >
        {/* Countdown / Live Bar + 3-Seat Marquee Stage */}
        <div className="space-y-6 pt-2">
          {!isFinalLive && !isFinalFinished && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-card border-[2.5px] border-outline bg-red-900/55 p-4 text-white">
              <div className="flex flex-wrap items-center gap-2.5">
                <CrescentStar size="sm" glow />
                <span className="text-sm font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal">
                  {lang === 'ar'
                    ? 'العد التنازلي لليلة النهائي'
                    : 'Countdown to Final Night'}
                </span>
                <span className="rounded-pill border border-outline bg-white px-2.5 py-0.5 text-xs font-bold text-red-900">
                  {lang === 'ar' ? 'موعد مبدئي' : 'Placeholder Date'}
                </span>
              </div>

              <div
                className="grid grid-cols-4 gap-2 sm:gap-2.5"
                role="timer"
                aria-label={
                  lang === 'ar'
                    ? 'العد التنازلي للنهائي الكبير'
                    : 'Countdown to Grand Final'
                }
              >
                {countdownCells.map((cell) => (
                  <div
                    key={cell.key}
                    className="flex min-w-[60px] flex-col items-center justify-center rounded-input border-2 border-outline bg-white px-2.5 py-1.5 text-center shadow-sticker-sm"
                  >
                    <span className="font-score text-2xl sm:text-3xl font-black leading-none text-red-600 tabular-nums">
                      {cell.val === null
                        ? '--'
                        : formatNumber(String(cell.val).padStart(2, '0'), {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                    </span>
                    <span className="mt-0.5 text-[11px] font-extrabold uppercase text-red-900">
                      {lang === 'ar' ? cell.labelAr : cell.labelEn}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-Seat Marquee Spotlight Stage */}
          <div className="relative pt-2">
            <div
              className="pointer-events-none absolute -top-5 -start-2 z-20 hidden lg:block"
              aria-hidden="true"
            >
              <PlayingDice value={6} size="md" tilt={-10} accent="gold" float />
            </div>
            <div
              className="pointer-events-none absolute -bottom-5 -end-2 z-20 hidden lg:block"
              aria-hidden="true"
            >
              <PlayingCardFan float />
            </div>

            <MarqueeBulbs variant="perimeter" bulbCount={18} className="w-full">
              <div className="rounded-card border-[3px] border-outline bg-white p-4 sm:p-6 lg:p-8 text-ink shadow-sticker-lg">
                {/* Matchup Strip Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-paper pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <LiveBadge
                      surface="paper"
                      size="sm"
                      pulse={Boolean(isFinalLive)}
                      label={
                        isFinalLive
                          ? lang === 'ar'
                            ? 'مباشر الآن · طاولة النهائي'
                            : 'LIVE NOW · FINAL TABLE'
                          : isFinalFinished
                            ? lang === 'ar'
                              ? 'النتيجة النهائية المعتمدة'
                              : 'OFFICIAL FINAL RESULT'
                            : lang === 'ar'
                              ? 'المقعد الذهبي · مواجهة ٣ لاعبين'
                              : 'THE GOLDEN SEAT · 3-PLAYER FINALE'
                      }
                    />
                    {finalGame && (
                      <span className="text-xs sm:text-sm font-bold text-ink-muted">
                        {formatPublicDateTime(
                          finalGame.scheduledAt,
                          lang,
                          useArabicIndic
                        )}
                      </span>
                    )}
                  </div>

                  <Badge variant="muted">
                    {formatNumber(finalSegments.length || 8, {
                      useArabicIndicDigits: useArabicIndic,
                    })}{' '}
                    {lang === 'ar' ? 'فقرات نهائية' : 'Final Segments'}
                  </Badge>
                </div>

                {/* 3 Symmetrical Seats (Marwan Center on md+, Top on Mobile) */}
                {!finalGame ? (
                  <div className="py-8">
                    <EmptyState
                      title={
                        lang === 'ar'
                          ? 'لم يتم تعيين مباراة النهائي بعد'
                          : 'No Grand Final table scheduled yet'
                      }
                      description={
                        lang === 'ar'
                          ? 'قم بتوليد شجرة البطولة أو تفعيل النهائي الكبير مع مروان سري من لوحة التحكم.'
                          : 'Generate a bracket or enable the Grand Final with Marwan Serry in Admin Bracket Config.'
                      }
                      action={
                        <Button variant="red" asChild>
                          <Link href="/bracket">
                            {lang === 'ar' ? 'استعراض شجرة البطولة' : 'View Bracket'}
                          </Link>
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3 md:gap-5">
                    {seats.map((seat, idx) => {
                      const isCenter = seat.isCenterHost;
                      const mobileOrder = isCenter
                        ? 'order-1 md:order-2'
                        : idx === 0
                          ? 'order-2 md:order-1'
                          : 'order-3 md:order-3';

                      return (
                        <motion.div
                          key={`${seat.id}-${idx}`}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.35,
                            delay: idx * 0.06,
                            ease: 'easeOut',
                          }}
                          className={cn(
                            'relative flex flex-col justify-between gap-4 rounded-card p-5 transition-transform',
                            mobileOrder,
                            isCenter
                              ? 'border-[3px] border-outline bg-gold-gradient text-red-900 shadow-sticker md:-my-2'
                              : seat.isWinner
                                ? 'border-[2.5px] border-outline bg-gold-200/70 text-red-900 shadow-sticker-sm'
                                : seat.isBuzzed
                                  ? 'border-[2.5px] border-outline bg-gold-200/60 text-red-900 ring-[3px] ring-gold-400'
                                  : 'border-2 border-dashed border-red-900/35 bg-paper text-ink'
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {isCenter ? (
                              <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-outline bg-red-900 px-3 py-1 text-xs font-black uppercase ltr:tracking-wider rtl:tracking-normal text-gold-200">
                                <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>
                                  {lang === 'ar'
                                    ? 'المقعد الذهبي · المضيف'
                                    : 'GOLDEN SEAT · HOST'}
                                </span>
                              </span>
                            ) : (
                              <Badge
                                variant={
                                  seat.isWinner
                                    ? 'gold'
                                    : seat.isConfirmed
                                      ? 'positive'
                                      : 'upcoming'
                                }
                              >
                                {seat.isWinner
                                  ? lang === 'ar'
                                    ? 'بطل النهائي'
                                    : 'CHAMPION'
                                  : seat.isConfirmed
                                    ? lang === 'ar'
                                      ? 'متأهل مؤكد'
                                      : 'CONFIRMED'
                                    : seat.isPlaceholder
                                      ? lang === 'ar'
                                        ? 'مقعد مفتوح'
                                        : 'OPEN SEAT'
                                      : lang === 'ar'
                                        ? 'مرشح نصف النهائي'
                                        : 'PROJECTED'}
                              </Badge>
                            )}

                            <span
                              className={cn(
                                'text-xs font-extrabold uppercase tabular-nums',
                                isCenter ? 'text-red-900' : 'text-ink-muted'
                              )}
                            >
                              {lang === 'ar'
                                ? `المقعد ${formatNumber(seat.slotNumber, { useArabicIndicDigits: useArabicIndic })}`
                                : `SEAT 0${seat.slotNumber}`}
                            </span>
                          </div>

                          <div className="flex flex-col items-center text-center gap-3 py-2">
                            <PlayerAvatar
                              name={seat.name}
                              avatarSeed={seat.avatarSeed}
                              size={isCenter ? 'xl' : 'lg'}
                              isHost={isCenter}
                            />

                            <div className="min-w-0 w-full space-y-1">
                              <h2
                                className={cn(
                                  'truncate font-display leading-tight',
                                  isCenter
                                    ? 'text-2xl sm:text-3xl text-red-900'
                                    : 'text-xl sm:text-2xl text-red-900'
                                )}
                              >
                                {seat.name}
                              </h2>
                              {seat.nickname && !seat.isPlaceholder ? (
                                <p
                                  className={cn(
                                    'text-sm font-bold',
                                    isCenter ? 'text-red-900/90' : 'text-ink-muted'
                                  )}
                                >
                                  “{seat.nickname}”
                                </p>
                              ) : (
                                <p className="text-xs font-medium text-ink-muted">
                                  {lang === 'ar'
                                    ? 'يتحدد من أول وثاني نصف النهائي'
                                    : 'Decided by Top 2 of the Semi-Final'}
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className={cn(
                              'flex items-center justify-between gap-2 border-t pt-3 text-xs font-bold',
                              isCenter
                                ? 'border-red-900/25 text-red-900'
                                : 'border-border-paper text-ink-muted'
                            )}
                          >
                            {seat.score !== null ? (
                              <>
                                <span className="inline-flex items-center gap-1">
                                  {seat.isBuzzed && (
                                    <Zap
                                      className="h-4 w-4 text-red-600 fill-gold-400"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span>
                                    {seat.isBuzzed
                                      ? lang === 'ar'
                                        ? 'ضغط الجرس أولاً!'
                                        : 'BUZZED FIRST!'
                                      : lang === 'ar'
                                        ? 'النقاط الحالية'
                                        : 'Live Total'}
                                  </span>
                                </span>
                                <AnimatedNumber
                                  value={seat.score}
                                  useArabicIndicDigits={useArabicIndic}
                                  className="font-score text-3xl font-black text-red-900"
                                />
                              </>
                            ) : isCenter ? (
                              <span className="w-full text-center">
                                {lang === 'ar'
                                  ? 'ينتظر المتأهلين على المسرح المباشر (الاسم فقط)'
                                  : 'Awaiting the Top 2 Challengers (Name-Only Stage Seat)'}
                              </span>
                            ) : (
                              <span className="w-full text-center">
                                {semiFinished
                                  ? lang === 'ar'
                                    ? 'تأهل رسمياً من نصف النهائي'
                                    : 'Officially qualified via Semi-Final'
                                  : lang === 'ar'
                                    ? 'يُحسم رسمياً بعد انتهاء نصف النهائي'
                                    : 'Locks automatically once Semi-Final finishes'}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </MarqueeBulbs>
          </div>
        </div>
      </PublicPageHero>

      {/* 2. PAPER BAND — LIVE ROAD TO THE FINAL */}
      <section className="theme-paper bg-paper py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              surface="paper"
              align="start"
              size="lg"
              title={
                lang === 'ar'
                  ? 'طريق التأهل المباشر إلى النهائي'
                  : 'Live Road to the Final'
              }
              goldKeyword={lang === 'ar' ? 'النهائي' : 'Final'}
              subtitle={
                lang === 'ar'
                  ? 'تابع تقدم كل جولة في البطولة مباشرة—يتأهل الأول من كل طاولة في الأدوار الأولى ثم أول لاعبين من نصف النهائي لمواجهة مروان سري.'
                  : 'Track tournament progress live across every round—table winners advance through knockouts until the Top 2 Semi-Finalists claim their Final seats.'
              }
            />

            <Button variant="red" size="md" asChild className="self-start lg:self-end">
              <Link href="/bracket">
                <span>
                  {lang === 'ar' ? 'فتح شجرة البطولة التفاعلية' : 'Explore Interactive Bracket'}
                </span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {roadRounds.map(({ round, totalGames, finishedCount, liveCount, liveGame }) => {
              const isFinalRound = round.id === 'round-final';
              return (
                <article
                  key={round.id}
                  className={cn(
                    'flex flex-col justify-between gap-4 rounded-card p-5 text-ink',
                    isFinalRound
                      ? 'border-[2.5px] border-outline bg-gradient-to-b from-gold-200/75 via-paper to-white shadow-sticker'
                      : liveCount > 0
                        ? 'border-[2.5px] border-outline bg-white ring-2 ring-gold-400 shadow-sticker-sm'
                        : 'border border-border-paper bg-white shadow-soft'
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge
                        variant={
                          isFinalRound
                            ? 'gold'
                            : liveCount > 0
                              ? 'red'
                              : finishedCount === totalGames && totalGames > 0
                                ? 'positive'
                                : finishedCount > 0
                                  ? 'gold'
                                  : 'upcoming'
                        }
                      >
                        {isFinalRound
                          ? lang === 'ar'
                            ? 'النهائي الكبير'
                            : 'GRAND FINAL'
                          : liveCount > 0
                            ? lang === 'ar'
                              ? 'مباشر الآن'
                              : 'LIVE NOW'
                            : finishedCount === totalGames && totalGames > 0
                              ? lang === 'ar'
                                ? 'مكتملة'
                                : 'COMPLETE'
                              : finishedCount > 0
                                ? lang === 'ar'
                                  ? 'جارية'
                                  : 'IN PROGRESS'
                                : lang === 'ar'
                                  ? 'قادمة'
                                  : 'UPCOMING'}
                      </Badge>
                      <span className="font-score text-lg font-black text-red-900 tabular-nums">
                        {formatNumber(finishedCount, { useArabicIndicDigits: useArabicIndic })}
                        /
                        {formatNumber(totalGames, { useArabicIndicDigits: useArabicIndic })}{' '}
                        <span className="font-sans text-xs font-bold text-ink-muted">
                          {lang === 'ar'
                            ? totalGames === 1
                              ? 'طاولة'
                              : 'طاولات'
                            : totalGames === 1
                              ? 'table'
                              : 'tables'}
                        </span>
                      </span>
                    </div>

                    <h3 className="font-display text-xl text-red-900 leading-snug">
                      {localizeText(lang, round.name.en, round.name.ar)}
                    </h3>

                    <p className="text-sm text-ink-muted leading-relaxed">
                      {isFinalRound
                        ? lang === 'ar'
                          ? 'المتأهلان من نصف النهائي + مروان سري على طاولة اللقب.'
                          : 'Top 2 Semi-Finalists + Marwan Serry in the 3-player finale.'
                        : lang === 'ar'
                          ? `يتأهل أفضل ${formatNumber(round.advancePerGame, { useArabicIndicDigits: useArabicIndic })} من كل طاولة.`
                          : `Top ${round.advancePerGame} per table advances to the next stage.`}
                    </p>
                  </div>

                  <div className="border-t border-border-paper pt-3">
                    {liveGame ? (
                      <Button variant="red" size="sm" className="w-full" asChild>
                        <Link href={`/screen/${liveGame.id}`}>
                          <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'ar' ? 'شاهد المباراة المباشرة' : 'Watch Live Table'}
                          </span>
                        </Link>
                      </Button>
                    ) : (
                      <Link
                        href="/bracket"
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-blue-600 underline underline-offset-4 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 rounded-button px-1"
                      >
                        <span>
                          {lang === 'ar' ? 'عرض الطاولات في الشجرة' : 'Inspect round tables'}
                        </span>
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <StageDivider variant="angled" from="paper" to="stageDark" />

      {/* 3. STAGE BAND — THE 8 CHAMPIONSHIP FINAL SEGMENTS */}
      <SunburstStage variant="stageDark" className="py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              surface="stage"
              align="start"
              size="lg"
              title={
                lang === 'ar'
                  ? 'فقرات ليلة النهائي الثماني'
                  : 'The Championship Final Lineup'
              }
              goldKeyword={lang === 'ar' ? 'النهائي' : 'Final Lineup'}
              subtitle={
                lang === 'ar'
                  ? 'ثماني فقرات مختارة من مكتبة البطولة تختبر سرعة البديهة والغناء وثقافة السينما، مع جولة الحسم تلقائياً عند أي تعادل.'
                  : 'Eight hand-picked segments testing music, wordplay speed, and cinema wit—with Sudden-Death Tie-Breaker #16 on standby if points tie.'
              }
            />

            <Button variant="secondary" size="md" asChild className="self-start lg:self-end">
              <Link href="/segments">
                <span>
                  {lang === 'ar' ? 'استعراض كل الـ ١٦ فقرة' : 'Browse All 16 Segments'}
                </span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {finalSegments.length === 0 ? (
            <EmptyState
              title={
                lang === 'ar'
                  ? 'لم يتم تحديد فقرات النهائي بعد'
                  : 'Final segments not configured yet'
              }
              description={
                lang === 'ar'
                  ? 'يمكن لمدير البطولة اختيار فقرات النهائي من لوحة إدارة المباريات.'
                  : 'Super Admin can assign the Final segment lineup from Admin Games.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {finalSegments.map((seg, idx) => {
                const cat = SEGMENT_CATEGORY_INFO[seg.category];
                const CatIcon = cat.Icon;

                return (
                  <Link
                    key={`${seg.id}-${idx}`}
                    href={`/segments?segment=${encodeURIComponent(seg.id)}`}
                    className="group flex flex-col justify-between gap-4 rounded-card border-[2.5px] border-outline bg-white p-5 text-ink shadow-sticker transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={cat.badgeVariant}>
                          <CatIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{lang === 'ar' ? cat.labelAr : cat.labelEn}</span>
                        </Badge>
                        <span className="font-score text-lg font-black text-red-900 tabular-nums">
                          #{formatNumber(String(idx + 1).padStart(2, '0'), {
                            useArabicIndicDigits: useArabicIndic,
                          })}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-lg text-red-900 leading-snug group-hover:text-red-600 transition-colors">
                          {localizeText(lang, seg.nameEn, seg.nameAr)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted line-clamp-3">
                          {localizeText(lang, seg.descriptionEn, seg.descriptionAr)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-paper pt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span>
                          {seg.durationSec
                            ? `${formatNumber(seg.durationSec, { useArabicIndicDigits: useArabicIndic })}s`
                            : lang === 'ar'
                              ? 'مرن'
                              : 'Flexible'}
                        </span>
                      </span>

                      <div className="flex flex-wrap items-center gap-1">
                        {seg.presetPoints.map((pts) => {
                          const isPos = pts > 0;
                          return (
                            <span
                              key={pts}
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-pill border px-2 py-0.5 font-score text-xs font-black tabular-nums',
                                isPos
                                  ? 'border-positive bg-positive-soft text-positive-ink'
                                  : 'border-outline bg-negative text-white'
                              )}
                            >
                              {isPos ? (
                                <Plus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                              ) : (
                                <Minus className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                              )}
                              <span>
                                {formatNumber(Math.abs(pts), {
                                  useArabicIndicDigits: useArabicIndic,
                                })}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </SunburstStage>

      <StageDivider variant="scallop" from="stageDark" to="paper" />

      {/* 4. PAPER BAND — VENUE, PRIZES & SPONSOR INVITATION */}
      <section className="theme-paper bg-paper py-section-y">
        <div className="mx-auto max-w-content-wide px-safe">
          <div className="rounded-card border-[3px] border-outline bg-gradient-to-b from-gold-200/40 via-white to-white p-6 sm:p-8 lg:p-10 text-ink shadow-sticker-lg">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="space-y-4 lg:col-span-7">
                <h2 className="font-display text-fluid-3xl text-red-900 leading-tight">
                  {lang === 'ar'
                    ? 'جاهز لإشعال مسرح النهائي الكبير؟'
                    : 'Ready to Light Up the Final Night Stage?'}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold">
                    <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'تفاصيل ليلة النهائي · قابلة للتعديل'
                        : 'Final Night Logistics · Editable Placeholders'}
                    </span>
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-1 text-sm">
                  <div className="rounded-input border border-border-paper bg-paper p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-red-700">
                      <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'الموعد والمكان' : 'Dates & Venue'}</span>
                    </div>
                    <p className="font-bold text-ink">
                      {localizeText(lang, settings.eventDates, settings.eventDatesAr)}
                    </p>
                    <p className="text-ink-muted">
                      {localizeText(lang, settings.venue, settings.venueAr)}
                    </p>
                  </div>

                  <div className="rounded-input border border-border-paper bg-paper p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-red-700">
                      <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'جائزة البطولة' : 'Championship Prize'}</span>
                    </div>
                    <p className="font-bold text-ink">
                      {localizeText(lang, settings.prizeText, settings.prizeTextAr)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {lang === 'ar'
                        ? 'بطولة معلومات وسرعة بديهة — بدون أي مراهنات.'
                        : 'Skill & trivia competition — no real-money gambling.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:col-span-5">
                {finalGame && (
                  <Button variant="red" size="lg" className="w-full" asChild>
                    <Link href={`/screen/${finalGame.id}`}>
                      <MonitorPlay className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? 'تشغيل شاشة النهائي العملاقة'
                          : 'Launch Final Big Screen'}
                      </span>
                    </Link>
                  </Button>
                )}
                <Button variant="gold" size="lg" className="w-full" asChild>
                  <Link href="/sponsors">
                    <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'استعراض باقات الرعاية والشراكة'
                        : 'Explore Sponsorship Packages'}
                    </span>
                  </Link>
                </Button>
                <Button variant="secondary" size="md" className="w-full" asChild>
                  <Link href="/schedule">
                    <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'جدول ليالي البطولة الكامل' : 'View Full Tournament Schedule'}
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
