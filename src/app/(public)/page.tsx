'use client';

import React, { useEffect, useState } from 'react';
import { playerRepo, settingsRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Player, Settings } from '@/lib/schemas';
import {
  ClosingCtaSection,
  FeaturesSection,
  HeroFinalSection,
  HowItWorksSection,
  LiveDemoSection,
  SegmentsSection,
  SponsorsSection,
} from '@/components/landing';

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

      {/* 2. Embedded Interactive LIVE DEMO (Paper Split: Mini Scorer + Mini Big Screen) */}
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
