import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function BracketPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Tournament Bracket — 27 Players to the Golden Seat"
      titleAr="شجرة البطولة — ٢٧ لاعباً نحو المقعد الذهبي"
      subtitleEn="9 Round 1 tables -> 3 Quarter-Final tables -> 1 Semi-Final (top 2 advance) -> The Grand Final with Marwan Serry."
      subtitleAr="٩ طاولات في الدور الأول -> ٣ في ربع النهائي -> نصف النهائي (يتأهل ٢) -> النهائي مع مروان سري."
      phaseNoteEn="Route shell active and connected to roundRepo and gameRepo."
      phaseNoteAr="مسار شجرة البطولة مفعل ومرتبط بمستودعات الجولات والمباريات."
    />
  );
}
