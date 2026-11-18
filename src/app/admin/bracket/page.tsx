import React from 'react';
import { RouteShellPlaceholder } from '@/components/layout/RouteShellPlaceholder';

export default function AdminBracketPage() {
  return (
    <RouteShellPlaceholder
      titleEn="Admin — Flexible Bracket Configuration"
      titleAr="الإدارة — إعدادات شجرة البطولة والتأهل"
      subtitleEn="Configure player count, group size (3 per game), and advancement rules per round."
      subtitleAr="ضبط عدد اللاعبين وحجم الطاولات وعدد المتأهلين في كل جولة."
      phaseNoteEn="Connected to roundRepo, gameRepo, and settingsRepo."
      phaseNoteAr="مرتبط بمستودعات الجولات والمباريات والإعدادات."
    />
  );
}
