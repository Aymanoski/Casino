import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminGamesPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin — Game Sessions & Scorer Assignment"
      titleAr="الإدارة — جلسات اللعب وتوزيع الحكام"
      subtitleEn="Assign scorers, configure ordered segments per session, and manage table schedules."
      subtitleAr="تعيين حكم لكل طاولة، ترتيب الفقرات، وإدارة مواعيد الجلسات."
      phaseNoteEn="Connected to gameRepo, segmentRepo, and userRepo."
      phaseNoteAr="مرتبط بمستودعات المباريات والفقرات والحكام."
    />
  );
}
