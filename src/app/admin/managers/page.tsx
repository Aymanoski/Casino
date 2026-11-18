import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminManagersPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin — Managers & Role Access"
      titleAr="الإدارة — المديرون وصلاحيات الوصول"
      subtitleEn="Manage Super Admin, Table Scorers, Check-In Staff, and Content Manager accounts."
      subtitleAr="إدارة حسابات وصلاحيات المديرين والحكام وموظفي الاستقبال والمحتوى."
      phaseNoteEn="Connected to userRepo."
      phaseNoteAr="مرتبط بمستودع المستخدمين."
    />
  );
}
