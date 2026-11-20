'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Eye, History, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Player } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface PlayerPortalChromeProps {
  players: Player[];
  activePlayerId: string;
  onSelectPreviewPlayer?: (playerId: string) => void;
  useArabicIndicDigits?: boolean;
}

const FEATURED_PREVIEW_IDS: Array<{
  id: string;
  tagEn: string;
  tagAr: string;
}> = [
  { id: 'player-1', tagEn: 'Semi-Finalist', tagAr: 'نصف النهائي' },
  { id: 'player-4', tagEn: 'LIVE Now', tagAr: 'مباشر الآن' },
  { id: 'player-19', tagEn: 'Upcoming R2', tagAr: 'قادمة د٢' },
  { id: 'player-25', tagEn: 'Pre-Debut', tagAr: 'قبل أول مباراة' },
];

export function PlayerPortalChrome({
  players,
  activePlayerId,
  onSelectPreviewPlayer,
  useArabicIndicDigits = false,
}: PlayerPortalChromeProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { lang } = useI18n();

  const isSuperAdmin = user?.role === 'superAdmin';
  const querySuffix =
    isSuperAdmin && activePlayerId
      ? `?player=${encodeURIComponent(activePlayerId)}`
      : '';

  const navTabs = [
    {
      href: `/player${querySuffix}`,
      matchExact: true,
      basePath: '/player',
      label: lang === 'ar' ? 'ملفي الشخصي والمباراة القادمة' : 'My Profile & Next Game',
      Icon: UserIcon,
    },
    {
      href: `/player/history${querySuffix}`,
      matchExact: false,
      basePath: '/player/history',
      label: lang === 'ar' ? 'سجل مبارياتي ونقاط الفقرات' : 'My Game History',
      Icon: History,
    },
  ];

  const contestants = players
    .filter((p) => !p.isHost)
    .sort((a, b) => a.seed - b.seed);

  return (
    <div className="space-y-4">
      {/* Sub-navigation between /player and /player/history */}
      <nav
        aria-label={lang === 'ar' ? 'تنقل بوابة المتسابق' : 'Player portal navigation'}
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-paper bg-white p-2 shadow-soft"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {navTabs.map((tab) => {
            const isActive = tab.matchExact
              ? pathname === tab.basePath
              : pathname.startsWith(tab.basePath);
            const Icon = tab.Icon;
            return (
              <Link
                key={tab.basePath}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-2 rounded-button border-2 px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                  isActive
                    ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                    : 'border-transparent bg-paper text-ink hover:border-border-paper hover:bg-paper-2'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        <Badge variant={isSuperAdmin ? 'gold' : 'info'}>
          {isSuperAdmin
            ? lang === 'ar'
              ? 'معاينة مدير البطولة'
              : 'Super Admin Preview'
            : lang === 'ar'
              ? 'بوابة المتسابق الخاصة'
              : 'Private Contestant View'}
        </Badge>
      </nav>

      {/* Super Admin Contestant Preview Switcher (NEVER rendered for player accounts) */}
      {isSuperAdmin && onSelectPreviewPlayer && contestants.length > 0 && (
        <div className="rounded-card border-2 border-outline bg-gold-200/45 p-4 text-ink shadow-sticker-sm space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-red-900">
              <Eye className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <label htmlFor="admin-player-preview-select">
                {lang === 'ar'
                  ? 'معاينة بوابة المتسابق باسم:'
                  : 'Previewing Contestant Portal as:'}
              </label>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto">
              <select
                id="admin-player-preview-select"
                value={activePlayerId}
                onChange={(e) => onSelectPreviewPlayer(e.target.value)}
                className="min-h-[44px] w-full max-w-full min-w-0 sm:w-auto sm:min-w-[230px] rounded-input border-2 border-outline bg-white px-3 py-2 text-base font-bold text-ink focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {contestants.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{formatNumber(p.seed, { useArabicIndicDigits })}{' '}
                    {localizeText(lang, p.fullName, p.fullNameAr)} — “
                    {localizeText(lang, p.nickname, p.nicknameAr)}”
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1-Click Quick Showcase Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FEATURED_PREVIEW_IDS.map((preset) => {
              const p = contestants.find((c) => c.id === preset.id);
              if (!p) return null;
              const isSelected = activePlayerId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPreviewPlayer(p.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    isSelected
                      ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                      : 'border-outline/30 bg-white text-red-900 hover:border-outline'
                  )}
                >
                  <span>{localizeText(lang, p.fullName, p.fullNameAr)}</span>
                  <span
                    className={cn(
                      'rounded-pill px-1.5 py-0.5 text-[10px] font-extrabold',
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-paper-2 text-ink-muted'
                    )}
                  >
                    {lang === 'ar' ? preset.tagAr : preset.tagEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
