import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';
import { SkipLink } from '@/components/layout/SkipLink';
import { SunburstStage } from '@/components/brand/SunburstStage';

export default function BigScreenLeaderboardPage() {
  return (
    <div className="theme-stage flex min-h-dvh flex-col bg-red-600 text-white">
      <SkipLink />
      <PublicHeader />
      <SunburstStage as="div" className="flex-1">
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-stage px-safe py-6 outline-none">
          <RouteShellPlaceholder
            titleEn="Venue Big Screen — Live Tournament Standings"
            titleAr="شاشة العرض العملاقة — الترتيب العام المباشر"
            subtitleEn="Broadcast-ready leaderboard with animated rank transitions as scores change."
            subtitleAr="لوحة الترتيب العام للبث المباشر مع تحريك المراكز تلقائياً عند تغير النقاط."
            phaseNoteEn="Connected to scoreRepo.getLeaderboard() and BroadcastChannel."
            phaseNoteAr="مرتبط بمستودع النقاط والبث الفوري."
          />
        </main>
      </SunburstStage>
    </div>
  );
}
