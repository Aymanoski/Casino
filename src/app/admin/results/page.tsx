import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminResultsPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin — Chronological Results Feed"
      titleAr="الإدارة — سجل النتائج الفوري بالتاريخ والوقت"
      subtitleEn="Newest-first feed of every finished game and score event with date/time filters and CSV export."
      subtitleAr="سجل زمني مرتب لكل نتيجة ونقطة مع التاريخ والوقت والتصدير إلى CSV."
      phaseNoteEn="Connected to scoreRepo and gameRepo."
      phaseNoteAr="مرتبط بمستودعات النقاط والمباريات."
    />
  );
}
