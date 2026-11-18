import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function PlayerProfilePage() {
  return (
    <RouteShellPlaceholder
      titleEn="Contestant Portal — My Profile & Next Table"
      titleAr="بوابة المتسابق — ملفي الشخصي ومباراتي القادمة"
      subtitleEn="Personal stats, tournament status, seed rank, and upcoming session schedule."
      subtitleAr="إحصائيات اللاعب، حالة التأهل، التصنيف، وموعد الطاولة القادمة."
      phaseNoteEn="Protected by RoleGuard (accessible to Player & Super Admin roles)."
      phaseNoteAr="محمي بنظام الصلاحيات (متاح للاعب ومدير البطولة)."
    />
  );
}
