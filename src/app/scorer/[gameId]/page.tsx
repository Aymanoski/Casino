import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default async function ScorerGameConsolePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <RouteShellPlaceholder
      titleEn={`Live Scorer Console — Session ${gameId.toUpperCase()}`}
      titleAr={`لوحة التحكيم المباشرة — الجلسة ${gameId.toUpperCase()}`}
      subtitleEn="56px+ touch targets, Buzzed First lock, segment presets, custom delta with notes, immutable Undo, and Qualifying Tie detector."
      subtitleAr="أزرار لمس كبيرة، تحديد ضاغط الجرس، نقاط الفقرات، الإدخال الحر مع ملاحظة، والتراجع الفوري."
      phaseNoteEn="Connected to scoreRepo, gameRepo, and BroadcastChannel realtime bus."
      phaseNoteAr="مرتبط بمستودعات النقاط والمباريات وقناة البث الفوري."
    />
  );
}
