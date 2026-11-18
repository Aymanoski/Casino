import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminDashboardPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin Studio — Tournament Control Center"
      titleAr="استوديو الإدارة — مركز التحكم بالبطولة"
      subtitleEn="Executive overview of live tables, player check-in status, recent results feed, and role controls."
      subtitleAr="نظرة شاملة على الطاولات المباشرة، حالة تسجيل الحضور، وأحدث النتائج."
      phaseNoteEn="Admin sidebar layout & role-based navigation active."
      phaseNoteAr="القائمة الجانبية للإدارة ونظام الصلاحيات مفعلان."
    />
  );
}
