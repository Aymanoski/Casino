import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function HomePage() {
  return (
    <RouteShellPlaceholder
      titleEn="Casino El Al3ab — Ramadan Tournament Pitch & Showcase"
      titleAr="كازينو الألعاب — العرض الرئيسي لبطولة رمضان الكبرى"
      subtitleEn="App shell, bilingual i18n (EN/AR RTL), Zod schemas, async repositories, localStorage persistence, and BroadcastChannel realtime sync are active."
      subtitleAr="تم تفعيل الهيكل العام، دعم اللغتين العربية والإنجليزية (RTL/LTR)، نماذج البيانات، المستودعات اللاتزامنية، والمزامنة الفورية."
      phaseNoteEn="Full Landing & Pitch Showcase (Final Night Hero, Embedded Live Mini Scorer + Big Screen Demo, 4-Step Chip Explainer, and Sponsor Tiers) will be built in its dedicated phase."
      phaseNoteAr="سيتم بناء محتوى صفحة العرض الرئيسية بالكامل في مرحلتها المخصصة."
    />
  );
}
