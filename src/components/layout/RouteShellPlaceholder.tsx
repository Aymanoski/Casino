'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  Database,
  Radio,
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
    <div className="mx-auto max-w-content space-y-8 py-8 px-4 md:px-6">
      <Card premium className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <PokerChipIcon label="P1" />
            <Badge variant="gold">{t.common.phaseShellReady}</Badge>
          </div>
          <Badge variant="live">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>{lastRtEvent}</span>
          </Badge>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-gold-gradient md:text-5xl">
            {localizeText(lang, titleEn, titleAr)}
          </h1>
          <p className="max-w-3xl text-base text-text-muted">
            {localizeText(lang, subtitleEn, subtitleAr)}
          </p>
        </div>

        <div className="rounded-input border border-border bg-surface-2 p-4 text-xs text-gold-100">
          <span className="font-semibold text-gold-300">
            {lang === 'ar' ? 'حالة المرحلة الحالية: ' : 'Phase Roadmap Note: '}
          </span>
          {localizeText(lang, phaseNoteEn, phaseNoteAr)}
        </div>

        {/* Live Repository Layer Verification Grid */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-input border border-border bg-bg-raised p-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{lang === 'ar' ? 'اللاعبون (playerRepo)' : 'Seeded Players (playerRepo)'}</span>
                <Users className="h-4 w-4 text-gold-500" />
              </div>
              <div className="mt-2 font-score text-3xl text-ivory tabular-nums">
                {formatNumber(stats.playerCount, {
                  useArabicIndicDigits: stats.useArabicIndic,
                })}{' '}
                <span className="text-sm text-gold-300">+ Marwan Serry</span>
              </div>
            </div>

            <div className="rounded-input border border-border bg-bg-raised p-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{lang === 'ar' ? 'المباريات (gameRepo)' : 'Tournament Games (gameRepo)'}</span>
                <Activity className="h-4 w-4 text-gold-500" />
              </div>
              <div className="mt-2 font-score text-3xl text-ivory tabular-nums">
                {stats.finishedGames} Done ·{' '}
                <span className="text-live">{stats.liveGames} Live</span> ·{' '}
                {stats.scheduledGames} Sched
              </div>
            </div>

            <div className="rounded-input border border-border bg-bg-raised p-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{lang === 'ar' ? 'فقرات البرنامج (segmentRepo)' : 'Show Segments (segmentRepo)'}</span>
                <Database className="h-4 w-4 text-gold-500" />
              </div>
              <div className="mt-2 font-score text-3xl text-ivory tabular-nums">
                {stats.segmentCount}{' '}
                <span className="text-sm text-text-muted">
                  ({stats.roundCount} Rounds)
                </span>
              </div>
            </div>

            <div className="rounded-input border border-border bg-bg-raised p-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{lang === 'ar' ? 'الأحداث والسجل (scoreRepo)' : 'Events & Audit (scoreRepo)'}</span>
                <CheckCircle2 className="h-4 w-4 text-positive" />
              </div>
              <div className="mt-2 font-score text-3xl text-ivory tabular-nums">
                {stats.scoreEventCount} Scores · {stats.auditCount} Audits
              </div>
            </div>
          </div>
        )}

        {/* Interactive Realtime & Reset Verification Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleTestScorePing}>
              <Sparkles className="h-4 w-4" />
              <span>
                {lang === 'ar'
                  ? 'اختبار البث المباشر (+٥ نقاط لطاولة ب)'
                  : 'Test Realtime Broadcast (+5 pts on Live Game)'}
              </span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              <span>{t.common.resetDemoData}</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/login"
              className="text-gold-300 underline hover:text-gold-100"
            >
              {t.nav.login}
            </Link>
            <span className="text-text-faint">·</span>
            <Link
              href="/scorer/game-11"
              className="text-gold-300 underline hover:text-gold-100"
            >
              {t.nav.scorerConsole}
            </Link>
            <span className="text-text-faint">·</span>
            <Link
              href="/admin"
              className="text-gold-300 underline hover:text-gold-100"
            >
              {t.nav.adminArea}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
