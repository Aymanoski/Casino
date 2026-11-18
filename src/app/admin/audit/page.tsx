import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminAuditPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Super Admin — System Audit Log"
      titleAr="مدير البطولة — سجل المراجعة والتعديلات (Audit Log)"
      subtitleEn="Immutable log of who did what, to what entity, and when, including before/after snapshots."
      subtitleAr="سجل شامل لكل إجراء وتعديل مع بيانات قبل وبعد والتصدير."
      phaseNoteEn="Connected to auditRepo."
      phaseNoteAr="مرتبط بمستودع سجل المراجعة."
    />
  );
}
