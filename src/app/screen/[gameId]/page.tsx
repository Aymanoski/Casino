import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default async function BigScreenGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <div className="flex min-h-dvh flex-col bg-night-gradient">
      <PublicHeader />
      <main className="flex-1 min-w-0 mx-auto w-full max-w-stage px-safe">
        <RouteShellPlaceholder
          titleEn={`Venue Big Screen Broadcast — ${gameId.toUpperCase()}`}
          titleAr={`شاشة العرض العملاقة للاستوديو — ${gameId.toUpperCase()}`}
          subtitleEn="10-meter legible stage scoreboard with animated counters, delta flashes, buzzer spotlight, and Final Boss mode."
          subtitleAr="شاشة عرض مسرحية واضحة من مسافة ١٠ أمتار مع عدادات متحركة وإضاءة الجرس الفورية."
          phaseNoteEn="Listening to BroadcastChannel ('score.changed', 'buzz.recorded', 'segment.changed', 'timer.updated')."
          phaseNoteAr="متصل مباشرة بقناة التحديث الفوري عبر النوافذ."
        />
      </main>
    </div>
  );
}
