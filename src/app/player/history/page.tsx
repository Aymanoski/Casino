import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function PlayerHistoryPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Contestant Portal — My Score & Segment History"
      titleAr="بوابة المتسابق — سجل النقاط والفقرات"
      subtitleEn="Chronological log of every point earned or deducted across rounds and segments."
      subtitleAr="سجل زمني تفصيلي لجميع النقاط المكتسبة أو المخصومة عبر الجولات والفقرات."
      phaseNoteEn="Connected to scoreRepo.listByPlayer()."
      phaseNoteAr="مرتبط بمستودع نقاط اللاعب."
    />
  );
}
