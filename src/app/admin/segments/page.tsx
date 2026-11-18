import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminSegmentsPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin — Show Segments Library (16 Segments)"
      titleAr="الإدارة — مكتبة فقرات البرنامج (١٦ فقرة)"
      subtitleEn="Edit bilingual titles, original descriptions, point presets (+10, +5, -5), and timers."
      subtitleAr="تعديل أسماء الفقرات باللغتين، الأوصاف، النقاط الافتراضية، والمؤقتات."
      phaseNoteEn="Connected to segmentRepo."
      phaseNoteAr="مرتبط بمستودع الفقرات."
    />
  );
}
