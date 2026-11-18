import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function RulesPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Official Tournament Rules & Format"
      titleAr="قوانين ونظام البطولة الرسمي"
      subtitleEn="3 players per game, stage buzzer rules, segment presets, and Semi-Final top-2 advancement."
      subtitleAr="٣ لاعبين لكل طاولة، نظام الجرس، نقاط الفقرات، وتأهل أول وثاني نصف النهائي."
      phaseNoteEn="Route shell active and connected to contentRepo."
      phaseNoteAr="مسار القوانين مفعل ومرتبط بمستودع المحتوى."
    />
  );
}
