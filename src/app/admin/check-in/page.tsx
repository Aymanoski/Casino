import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminCheckInPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Gate Staff — Contestant Check-In Console"
      titleAr="بوابة الاستقبال — تسجيل حضور وغياب اللاعبين"
      subtitleEn="Check in today’s players or mark absent no-shows at the studio gate."
      subtitleAr="تأكيد حضور لاعبي مباريات اليوم أو تسجيل الغياب عند البوابة."
      phaseNoteEn="Connected to playerRepo.updateStatus() and gameRepo."
      phaseNoteAr="مرتبط بمستودع حالة اللاعبين."
    />
  );
}
