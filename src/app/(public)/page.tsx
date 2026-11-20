'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { playerRepo, settingsRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Player, Settings } from '@/lib/schemas';
import { HeroFinalSection } from '@/components/landing/HeroFinalSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { SegmentsSection } from '@/components/landing/SegmentsSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { SponsorsSection } from '@/components/landing/SponsorsSection';
import { ClosingCtaSection } from '@/components/landing/ClosingCtaSection';
import { Skeleton } from '@/components/ui/skeleton';

const LiveDemoSection = dynamic(
  () =>
    import('@/components/landing/LiveDemoSection').then((m) => ({
      default: m.LiveDemoSection,
    })),
  {
    ssr: false,
    loading: () => (
      <section
        id="live-demo"
        className="theme-paper bg-paper paper-pattern py-section-y scroll-mt-20"
        aria-busy="true"
      >
        <div className="mx-auto max-w-content-wide px-safe space-y-6">
          <Skeleton className="mx-auto h-12 w-80 max-w-full" />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton className="h-[520px] w-full lg:col-span-6" />
            <Skeleton className="h-[520px] w-full lg:col-span-6" />
          </div>
        </div>
      </section>
    ),
  }
);

export default function HomePage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [marwanPlayer, setMarwanPlayer] = useState<Player | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadSharedPitchData = async () => {
      const [s, host] = await Promise.all([
        settingsRepo.get(),
        playerRepo.get('player-marwan'),
      ]);
      if (!mounted) return;
      setSettings(s);
      setMarwanPlayer(host);
    };

    loadSharedPitchData();
    const unsub1 = realtime.subscribe('settings.updated', loadSharedPitchData);
    const unsub2 = realtime.subscribe('data.reset', loadSharedPitchData);

    return () => {
      mounted = false;
      unsub1();
      unsub2();
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* 1. Final Night Hero (Stage) */}
      <HeroFinalSection settings={settings} marwanPlayer={marwanPlayer} />

      {/* 2. Embedded Interactive LIVE DEMO (Code-split Paper Split: Mini Scorer + Mini Big Screen) */}
      <LiveDemoSection settings={settings} />

      {/* 3. How the Tournament Works + Live Bracket Preview (Stage) */}
      <HowItWorksSection settings={settings} />

      {/* 4. The 16 Original Show Segments Grid (Paper) */}
      <SegmentsSection settings={settings} />

      {/* 5. Platform Operational Features (Stage) */}
      <FeaturesSection />

      {/* 6. Sponsor Tiers (Paper) */}
      <SponsorsSection settings={settings} />

      {/* 7. Closing CTA Inviting Marwan Serry to the Golden Seat (Stage) */}
      <ClosingCtaSection marwanPlayer={marwanPlayer} />
    </div>
  );
}
