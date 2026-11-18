import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminPlayersPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin — Players Directory (27 Contestants)"
      titleAr="الإدارة — سجل اللاعبين (٢٧ متسابقاً)"
      subtitleEn="Create player accounts, bulk import from CSV, edit seeds, and inspect player history."
      subtitleAr="إنشاء حسابات اللاعبين، الاستيراد الجماعي CSV، وتعديل التصنيف."
      phaseNoteEn="Connected to playerRepo."
      phaseNoteAr="مرتبط بمستودع اللاعبين."
    />
  );
}
