import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function ScorerDashboardPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Scorer Dashboard — My Assigned Tables"
      titleAr="لوحة الحكم — الطاولات المخصصة لي"
      subtitleEn="Role-gated scorer workspace displaying assigned live, scheduled, and completed games."
      subtitleAr="مساحة عمل الحكم المخصصة لعرض المباريات المباشرة والمجدولة والمكتملة."
      phaseNoteEn="Scorer sidebar layout & role guard active."
      phaseNoteAr="شريط الحكم الجانبي وحماية الصلاحيات مفعلان."
    />
  );
}
