import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminContentPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Content Manager — Announcements, Rules & Schedule Copy"
      titleAr="مدير المحتوى — الإعلانات والقوانين ونصوص الجدول"
      subtitleEn="Edit bilingual tournament announcements, rule cards, and schedule blurbs."
      subtitleAr="تحرير النصوص الثنائية اللغة للإعلانات والقوانين."
      phaseNoteEn="Connected to contentRepo."
      phaseNoteAr="مرتبط بمستودع المحتوى."
    />
  );
}
