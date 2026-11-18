import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function SegmentsPage() {
  return (
    <RouteShellPlaceholder
      titleEn="The 16 Show Segments Library"
      titleAr="مكتبة فقرات وتحديات البرنامج (١٦ فقرة)"
      subtitleEn="Music & Singing, Wordplay & Speed, Pop Culture & Cinema, General Knowledge, and the Sudden-Death Tie-Breaker."
      subtitleAr="فقرات الغناء والموسيقى، سرعة البديهة، السينما والثقافة الشعبية، المعلومات العامة، وجولة الحسم."
      phaseNoteEn="Route shell active and connected to segmentRepo."
      phaseNoteAr="مسار الفقرات مفعل ومرتبط بمستودع الفقرات."
    />
  );
}
