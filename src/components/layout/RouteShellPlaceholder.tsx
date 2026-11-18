'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  Database,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  auditRepo,
  gameRepo,
  playerRepo,
  roundRepo,
  scoreRepo,
  segmentRepo,
  settingsRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { formatNumber, localizeText } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PokerChipIcon } from '@/components/motifs/RamadanMotifs';
import { LiveBadge } from '@/components/brand/LiveBadge';

interface RouteShellPlaceholderProps {
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  phaseNoteEn: string;
  phaseNoteAr: string;
}

export function RouteShellPlaceholder({
  titleEn,
  titleAr,
  subtitleEn,
  subtitleAr,
  phaseNoteEn,
  phaseNoteAr,
}: RouteShellPlaceholderProps) {
  const { lang, t } = useI18n();
  const { user } = useAuth();

  const [stats, setStats] = useState<{
    playerCount: number;
    segmentCount: number;
    roundCount: number;
    finishedGames: number;
    liveGames: number;
    scheduledGames: number;
    scoreEventCount: number;
    auditCount: number;
    eventName: string;
    liveTableName: string;
    useArabicIndic: boolean;
  } | null>(null);

  const [lastRtEvent, setLastRtEvent] = useState<string>('Connected (BroadcastChannel)');

  useEffect(() => {
    let mounted = true;

    const loadRepoSummary = async () => {
      const [players, segments, rounds, games, scores, audits, settings] =
        await Promise.all([
          playerRepo.list({ includeHost: false }),
          segmentRepo.list(),
          roundRepo.list(),
          gameRepo.list(),
          scoreRepo.list(),
          auditRepo.list(),
          settingsRepo.get(),
        ]);

      if (!mounted) return;
      const liveG = games.find((g) => g.status === 'live');
      setStats({
        playerCount: players.length,
        segmentCount: segments.length,
        roundCount: rounds.length,
        finishedGames: games.filter((g) => g.status === 'finished').length,
        liveGames: games.filter((g) => g.status === 'live').length,
        scheduledGames: games.filter((g) => g.status === 'scheduled').length,
        scoreEventCount: scores.length,
        auditCount: audits.length,
        eventName: localizeText(lang, settings.eventName, settings.eventNameAr),
        liveTableName: liveG
          ? localizeText(lang, liveG.tableName, liveG.tableNameAr)
          : '—',
        useArabicIndic: settings.useArabicIndicDigits,
      });
    };

    loadRepoSummary();

    const unsub = realtime.subscribe('*', (msg) => {
      setLastRtEvent(`${msg.event} @ ${new Date(msg.timestamp).toLocaleTimeString()}`);
      loadRepoSummary();
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [lang]);

  const handleTestScorePing = async () => {
    await scoreRepo.applyScore({
      gameId: 'game-11',
      segmentId: 'seg-10',
      playerId: 'player-4',
      delta: 5,
      note: 'Phase 1 Realtime Verification Ping',
      kind: 'preset',
      byUserId: user?.id ?? 'user-scorer-1',
    });
  };

  const handleReset = async () => {
    await settingsRepo.resetDemoData(user?.id ?? 'user-admin');
  };

  return (
    <div className="mx-auto max-w-content-wide space-y-6 sm:space-y-8 py-4 sm:py-8 px-1 xs:px-3 md:px-6">
      <Card appearance="sticker" className="space-y-6 bg-white text-ink">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <PokerChipIcon label="★" tone="gold" />
            <Badge variant="gold">{t.common.phaseShellReady}</Badge>
          </div>
          <LiveBadge
            surface="paper"
            size="sm"
            label={lastRtEvent}
            className="max-w-full truncate"
          />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-fluid-3xl text-red-900">
            {localizeText(lang, titleEn, titleAr)}
          </h1>
          <p className="max-w-3xl text-fluid-base text-ink-muted">
            {localizeText(lang, subtitleEn, subtitleAr)}
          </p>
        </div>

        <div className="border-t border-border-paper pt-3 text-xs sm:text-sm text-ink">
          <span className="font-extrabold text-red-800">
            {lang === 'ar' ? 'حالة المرحلة الحالية: ' : 'Phase Roadmap Note: '}
          </span>
          {localizeText(lang, phaseNoteEn, phaseNoteAr)}
        </div>

        {/* Live Repository Layer Verification Grid (hairline-divided strip to avoid nested card boxes) */}
        {stats && (
          <dl className="grid divide-y sm:grid-cols-2 xl:grid-cols-4 xl:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-border-paper border-y border-border-paper bg-paper/50">
            <div className="p-4">
              <dt className="flex items-center justify-between gap-2 text-xs font-bold text-ink-muted">
                <span>{lang === 'ar' ? 'اللاعبون (playerRepo)' : 'Seeded Players (playerRepo)'}</span>
                <Users className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              </dt>
              <dd className="mt-2 font-score text-2xl sm:text-3xl font-black text-red-900 tabular-nums">
                {formatNumber(stats.playerCount, {
                  useArabicIndicDigits: stats.useArabicIndic,
                })}{' '}
                <span className="text-sm font-bold text-red-700">
                  {lang === 'ar' ? '+ مروان سري' : '+ Marwan Serry'}
                </span>
              </dd>
            </div>

            <div className="p-4">
              <dt className="flex items-center justify-between gap-2 text-xs font-bold text-ink-muted">
                <span>{lang === 'ar' ? 'المباريات (gameRepo)' : 'Tournament Games (gameRepo)'}</span>
                <Activity className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              </dt>
              <dd className="mt-2 font-score text-xl sm:text-2xl font-black text-red-900 tabular-nums">
                {lang === 'ar' ? (
                  <>
                    {stats.finishedGames} منتهية ·{' '}
                    <span className="text-red-600">{stats.liveGames} مباشر</span> ·{' '}
                    {stats.scheduledGames} مجدولة
                  </>
                ) : (
                  <>
                    {stats.finishedGames} Done ·{' '}
                    <span className="text-red-600">{stats.liveGames} Live</span> ·{' '}
                    {stats.scheduledGames} Sched
                  </>
                )}
              </dd>
            </div>

            <div className="p-4">
              <dt className="flex items-center justify-between gap-2 text-xs font-bold text-ink-muted">
                <span>{lang === 'ar' ? 'فقرات البرنامج (segmentRepo)' : 'Show Segments (segmentRepo)'}</span>
                <Database className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              </dt>
              <dd className="mt-2 font-score text-2xl sm:text-3xl font-black text-red-900 tabular-nums">
                {stats.segmentCount}{' '}
                <span className="text-sm font-bold text-ink-muted">
                  ({stats.roundCount} {lang === 'ar' ? 'جولات' : 'Rounds'})
                </span>
              </dd>
            </div>

            <div className="p-4">
              <dt className="flex items-center justify-between gap-2 text-xs font-bold text-ink-muted">
                <span>{lang === 'ar' ? 'الأحداث والسجل (scoreRepo)' : 'Events & Audit (scoreRepo)'}</span>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
              </dt>
              <dd className="mt-2 font-score text-xl sm:text-2xl font-black text-red-900 tabular-nums">
                {lang === 'ar'
                  ? `${stats.scoreEventCount} نتيجة · ${stats.auditCount} سجل`
                  : `${stats.scoreEventCount} Scores · ${stats.auditCount} Audits`}
              </dd>
            </div>
          </dl>
        )}

        {/* Interactive Realtime & Reset Verification Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-paper pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="red" size="sm" onClick={handleTestScorePing}>
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'اختبار البث المباشر (+٥ نقاط لطاولة ب)'
                  : 'Test Realtime Broadcast (+5 pts on Live Game)'}
              </span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>{t.common.resetDemoData}</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center text-blue-600 underline hover:text-blue-800"
            >
              {t.nav.login}
            </Link>
            <span className="text-ink-faint" aria-hidden="true">·</span>
            <Link
              href="/scorer/game-11"
              className="inline-flex min-h-[44px] items-center text-blue-600 underline hover:text-blue-800"
            >
              {t.nav.scorerConsole}
            </Link>
            <span className="text-ink-faint" aria-hidden="true">·</span>
            <Link
              href="/admin"
              className="inline-flex min-h-[44px] items-center text-blue-600 underline hover:text-blue-800"
            >
              {t.nav.adminArea}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
