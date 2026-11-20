'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GitBranch } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { gameRepo, playerRepo, roundRepo, scoreRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Game, Player, Round, Settings } from '@/lib/schemas';
import { formatNumber, localizeText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BracketNode,
  type BracketPlayerSlot,
} from '@/components/brand/BracketNode';
import { ScoreChip } from '@/components/brand/ScoreChip';
import { SectionHeading } from '@/components/brand/SectionHeading';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';

export interface HowItWorksSectionProps {
  settings: Settings | null;
}

export function HowItWorksSection({ settings }: HowItWorksSectionProps) {
  const { lang } = useI18n();
  const useArabicIndic = settings?.useArabicIndicDigits ?? false;
  const totalPlayers = settings?.bracketConfig.totalPlayers ?? 27;
  const perGame = settings?.bracketConfig.playersPerGame ?? 3;
  const semiAdvance = settings?.bracketConfig.semiAdvanceCount ?? 2;

  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [totalsMap, setTotalsMap] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [gList, rList, pList] = await Promise.all([
        gameRepo.list(),
        roundRepo.list(),
        playerRepo.list({ includeHost: true }),
      ]);
      const featured =
        gList.find((g) => g.id === 'game-11') ??
        gList.find((g) => g.status === 'live') ??
        gList.find((g) => !g.isFinal);
      const semi =
        gList.find((g) => g.id === 'game-13') ??
        gList.find((g) => g.roundId === 'round-semi');
      const final =
        gList.find((g) => g.isFinal) ??
        gList.find((g) => g.id === 'game-14');

      const targetIds = Array.from(
        new Set(
          [featured?.id, semi?.id, final?.id].filter((id): id is string => Boolean(id))
        )
      );
      const totalsEntries = await Promise.all(
        targetIds.map(async (gid) => [gid, await scoreRepo.getGameTotals(gid)] as const)
      );
      if (!mounted) return;
      setGames(gList);
      setRounds(rList);
      setPlayers(pList);
      setTotalsMap(Object.fromEntries(totalsEntries));
      setLoading(false);
    };
    load();

    const unsub = realtime.subscribe('*', (msg) => {
      const payloadGameId = (msg.payload as { gameId?: string } | undefined)?.gameId;
      if (payloadGameId === 'game-demo') return;
      if (
        msg.event === 'score.changed' ||
        msg.event === 'game.started' ||
        msg.event === 'game.finished' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'player.updated' ||
        msg.event === 'data.reset'
      ) {
        load();
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const steps = [
    {
      num: 1,
      tone: 'gold' as const,
      titleEn: 'Players Enter',
      titleAr: 'دخول المتسابقين',
      bodyEn: `Admins seed ${formatNumber(totalPlayers, { useArabicIndicDigits: useArabicIndic })} verified challengers directly into the official bracket—zero chaotic self-signup.`,
      bodyAr: `يُسجّل المنظمون ${formatNumber(totalPlayers, { useArabicIndicDigits: useArabicIndic })} متسابقاً معتمداً بتصنيفهم الرسمي داخل البطولة مباشرة.`,
    },
    {
      num: 2,
      tone: 'white' as const,
      titleEn: `Groups of ${formatNumber(perGame, { useArabicIndicDigits: useArabicIndic })}`,
      titleAr: `طاولات من ${formatNumber(perGame, { useArabicIndicDigits: useArabicIndic })} لاعبين`,
      bodyEn: `Every table pits ${perGame} contenders and 1 dedicated scorer across music, wordplay, and trivia segments. Highest score advances.`,
      bodyAr: `تجمع كل طاولة ${formatNumber(perGame, { useArabicIndicDigits: useArabicIndic })} متسابقين وحكماً مستقلاً عبر فقرات متنوعة، ويتأهل الأعلى نقاطاً.`,
    },
    {
      num: 3,
      tone: 'blue' as const,
      titleEn: 'Knockouts & Semi',
      titleAr: 'الإقصائيات ونصف النهائي',
      bodyEn: `Round winners clash in Quarter-Finals before one decisive Semi-Final where the top ${semiAdvance} advance together.`,
      bodyAr: `يتواجه أبطال الطاولات في ربع النهائي وصولاً إلى نصف النهائي الذي يتأهل منه أفضل ${formatNumber(semiAdvance, { useArabicIndicDigits: useArabicIndic })} معاً.`,
    },
    {
      num: 4,
      tone: 'red' as const,
      titleEn: 'Final vs. Marwan',
      titleAr: 'النهائي ضد مروان سري',
      bodyEn: 'The two surviving finalists step onto the Grand Final stage to challenge Marwan Serry in a 3-seat finale.',
      bodyAr: 'يصعد المتأهلان النهائيان إلى طاولة الحسم الكبرى لمواجهة مروان سري شخصياً على مقعد اللقب.',
    },
  ];

  const getPlayerSlot = (
    playerId: string,
    game: Game,
    forcePlaceholder = false,
    placeholderLabel?: string
  ): BracketPlayerSlot => {
    const player = players.find((p) => p.id === playerId);
    const isHost = Boolean(player?.isHost);
    if (forcePlaceholder && !isHost) {
      return {
        id: `placeholder-${playerId}`,
        name: placeholderLabel ?? (lang === 'ar' ? 'يتحدد من نصف النهائي' : 'Semi-Final Qualifier'),
        isPlaceholder: true,
      };
    }
    const gameTotals = totalsMap[game.id] ?? {};
    const hasStarted = game.status === 'live' || game.status === 'finished';
    return {
      id: playerId,
      name: player
        ? localizeText(lang, player.fullName, player.fullNameAr)
        : playerId,
      nickname: player
        ? localizeText(lang, player.nickname, player.nicknameAr)
        : undefined,
      avatarSeed: player?.avatarSeed,
      score: hasStarted ? (gameTotals[playerId] ?? 0) : undefined,
      isWinner: game.winnerPlayerId === playerId,
      isAdvancing: game.advancingPlayerIds?.includes(playerId),
      isHost,
    };
  };

  const liveGame =
    games.find((g) => g.id === 'game-11') ??
    games.find((g) => g.status === 'live') ??
    games.find((g) => !g.isFinal);
  const semiGame =
    games.find((g) => g.id === 'game-13') ??
    games.find((g) => g.roundId === 'round-semi');
  const finalGame =
    games.find((g) => g.isFinal) ??
    games.find((g) => g.id === 'game-14');

  const getRoundLabel = (roundId: string) => {
    const round = rounds.find((r) => r.id === roundId);
    return round ? localizeText(lang, round.name.en, round.name.ar) : '';
  };

  return (
    <div className="relative">
      <SunburstStage variant="stage" className="py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-10 sm:space-y-12">
          <SectionHeading
            surface="stage"
            align="center"
            size="lg"
            title={
              lang === 'ar'
                ? 'من ٢٧ متسابقاً إلى نهائي واحد كبير'
                : 'From 27 Challengers to One Grand Final'
            }
            goldKeyword={lang === 'ar' ? 'نهائي واحد' : 'Grand Final'}
            subtitle={
              lang === 'ar'
                ? 'نظام تصفيات مرن وشفاف من ٤ مراحل، حيث تتقدم الطاولات خطوة بخطوة نحو المواجهة الختامية مع مروان سري.'
                : 'A crisp four-stage knockout ladder built to keep every table thrilling—all leading toward the three-seat Final against Marwan Serry.'
            }
          />

          {/* 4 Casino-Chip Progression Milestones */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.num}
                className="flex flex-col gap-4 rounded-card border-[2.5px] border-outline bg-white p-5 text-ink shadow-sticker"
              >
                <div className="flex items-center justify-between gap-2">
                  <ScoreChip
                    value={`0${step.num}`}
                    tone={step.tone}
                    size="md"
                    useArabicIndicDigits={useArabicIndic}
                  />
                  <span className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink-muted">
                    {lang === 'ar'
                      ? `المرحلة ${formatNumber(step.num, { useArabicIndicDigits: useArabicIndic })}`
                      : `STAGE 0${step.num}`}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl text-red-900">
                    {lang === 'ar' ? step.titleAr : step.titleEn}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {lang === 'ar' ? step.bodyAr : step.bodyEn}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Live Bracket Preview */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-pill border-2 border-outline bg-white px-4 py-1.5 text-xs sm:text-sm font-extrabold text-red-900 shadow-sticker-sm">
                <GitBranch className="h-4 w-4 text-red-600" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'معاينة حية لمسار البطولة الحالي'
                    : 'LIVE BRACKET PREVIEW · TOURNAMENT IN PROGRESS'}
                </span>
              </div>

              <Button variant="gold" size="md" asChild>
                <Link href="/bracket">
                  <span>
                    {lang === 'ar'
                      ? 'استكشف شجرة البطولة الكاملة'
                      : 'Explore Full 27-Player Bracket'}
                  </span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="grid gap-5 lg:grid-cols-3">
                <Skeleton className="h-64 w-full bg-red-700/60" />
                <Skeleton className="h-64 w-full bg-red-700/60" />
                <Skeleton className="h-64 w-full bg-red-700/60" />
              </div>
            ) : (
              <div className="grid items-center gap-5 lg:grid-cols-3">
                {liveGame && (
                  <BracketNode
                    roundLabel={getRoundLabel(liveGame.roundId)}
                    tableName={localizeText(
                      lang,
                      liveGame.tableName,
                      liveGame.tableNameAr
                    )}
                    status={liveGame.status}
                    players={liveGame.playerIds.map((pid) =>
                      getPlayerSlot(pid, liveGame)
                    )}
                    useArabicIndicDigits={useArabicIndic}
                  />
                )}

                {semiGame && (
                  <BracketNode
                    roundLabel={getRoundLabel(semiGame.roundId)}
                    tableName={localizeText(
                      lang,
                      semiGame.tableName,
                      semiGame.tableNameAr
                    )}
                    status={semiGame.status}
                    players={semiGame.playerIds.map((pid, idx) =>
                      idx === 0
                        ? getPlayerSlot(pid, semiGame)
                        : getPlayerSlot(
                            pid,
                            semiGame,
                            true,
                            idx === 1
                              ? lang === 'ar'
                                ? 'الفائز من ربع النهائي ب (مباشر)'
                                : 'Winner of QF-B (Live Now)'
                              : lang === 'ar'
                                ? 'الفائز من ربع النهائي ج'
                                : 'Winner of QF-C'
                          )
                    )}
                    useArabicIndicDigits={useArabicIndic}
                  />
                )}

                {finalGame && (
                  <BracketNode
                    roundLabel={getRoundLabel(finalGame.roundId)}
                    tableName={localizeText(
                      lang,
                      finalGame.tableName,
                      finalGame.tableNameAr
                    )}
                    status={finalGame.status}
                    isFinal
                    players={finalGame.playerIds.map((pid, idx) =>
                      pid === 'player-marwan'
                        ? getPlayerSlot(pid, finalGame)
                        : getPlayerSlot(
                            pid,
                            finalGame,
                            semiGame?.status !== 'finished',
                            idx === 0
                              ? lang === 'ar'
                                ? 'المقعد الأول · متأهل ١'
                                : 'Finalist Seat 1'
                              : lang === 'ar'
                                ? 'المقعد الثاني · متأهل ٢'
                                : 'Finalist Seat 2'
                          )
                    )}
                    useArabicIndicDigits={useArabicIndic}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </SunburstStage>

      <StageDivider variant="scallop" from="stage" to="paper" />
    </div>
  );
}
