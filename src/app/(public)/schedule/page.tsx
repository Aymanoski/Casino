import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function SchedulePage() {
  return (
    <RouteShellPlaceholder
      titleEn="Ramadan Tournament Schedule"
      titleAr="جدول ومواعيد مباريات البطولة"
      subtitleEn="Chronological schedule of all 14 tournament sessions across 4 nights."
      subtitleAr="الجدول الزمني لجميع جلسات ومباريات البطولة الأربعة عشر."
      phaseNoteEn="Route shell active and connected to gameRepo and roundRepo."
      phaseNoteAr="مسار الجدول مفعل ومرتبط بمستودع المباريات."
    />
  );
}
