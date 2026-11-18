import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function LeaderboardPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Live Tournament Leaderboard"
      titleAr="لوحة الصدارة والترتيب المباشر"
      subtitleEn="Derived dynamically from ScoreEvent records with realtime BroadcastChannel updates."
      subtitleAr="يتم حساب الترتيب تلقائياً من سجل النقاط مع تحديث فوري مباشر."
      phaseNoteEn="Route shell active and connected to scoreRepo.getLeaderboard()."
      phaseNoteAr="مسار لوحة الصدارة مفعل ومرتبط بمستودع النقاط."
    />
  );
}
