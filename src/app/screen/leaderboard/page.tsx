import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function BigScreenLeaderboardPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-night-gradient">
      <PublicHeader />
      <main className="flex-1 min-w-0 mx-auto w-full max-w-stage px-safe">
        <RouteShellPlaceholder
          titleEn="Venue Big Screen — Live Tournament Standings"
          titleAr="شاشة العرض العملاقة — الترتيب العام المباشر"
          subtitleEn="Broadcast-ready leaderboard with animated rank transitions as scores change."
          subtitleAr="لوحة الترتيب العام للبث المباشر مع تحريك المراكز تلقائياً عند تغير النقاط."
          phaseNoteEn="Connected to scoreRepo.getLeaderboard() and BroadcastChannel."
          phaseNoteAr="مرتبط بمستودع النقاط والبث الفوري."
        />
      </main>
    </div>
  );
}
