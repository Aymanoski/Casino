'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Eye, History, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Match, Player } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PlayerCombobox } from '@/components/ui/player-combobox';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';

export interface PlayerPortalChromeProps {
  players: Player[];
  matches?: Match[];
  activePlayerId: string;
  onSelectPreviewPlayer?: (playerId: string) => void;
  useArabicIndicDigits?: boolean;
}

export function PlayerPortalChrome({
  players,
  matches = [],
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
      label:
        lang === 'ar'
          ? 'ملفي الشخصي والمباراة القادمة'
          : 'My Profile & Next Match',
      Icon: UserIcon,
    },
    {
      href: `/player/history${querySuffix}`,
      matchExact: false,
      basePath: '/player/history',
      label:
        lang === 'ar'
          ? 'سجل مبارياتي'
          : 'My Match History',
      Icon: History,
    },
  ];

  const contestants = useMemo(
    () =>
      players
        .filter((p) => !p.isHost && !p.isGuest)
        .sort((a, b) => a.seed - b.seed),
    [players]
  );

  // Dynamically pick 4 showcase presets (1 with upcoming KO/Group match, 1 LIVE now, 1 Group Winner, 1 Pre-Debut)
  const featuredPresets = useMemo(() => {
    const liveMatch = matches.find(
      (m) => !m.isDemo && (m.status === 'live' || m.status === 'needsTieBreak')
    );
    const livePlayerId =
      liveMatch?.participants.find((pt) => pt.playerId)?.playerId ?? 'player-38';

    const list: Array<{ id: string; tagEn: string; tagAr: string }> = [
      { id: 'player-1', tagEn: 'Upcoming Knockout', tagAr: 'إقصائيات قادمة' },
      { id: livePlayerId, tagEn: 'LIVE Now', tagAr: 'مباشر الآن' },
      { id: 'player-19', tagEn: 'Group 7 Winner', tagAr: 'متصدر مجموعة ٧' },
      { id: 'player-46', tagEn: 'Upcoming Group', tagAr: 'مباراة مجموعة قادمة' },
    ];

    const seen = new Set<string>();
    return list.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return contestants.some((c) => c.id === item.id);
    });
  }, [matches, contestants]);

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
              <span>
                {lang === 'ar'
                  ? 'معاينة بوابة المتسابق باسم:'
                  : 'Previewing Contestant Portal as:'}
              </span>
            </div>

            <div className="w-full lg:w-96">
              <PlayerCombobox
                players={contestants}
                value={activePlayerId}
                onChange={(id) => {
                  if (id) onSelectPreviewPlayer(id);
                }}
                useArabicIndicDigits={useArabicIndicDigits}
                ariaLabel={
                  lang === 'ar'
                    ? 'اختر متسابقاً للمعاينة'
                    : 'Select contestant to preview'
                }
              />
            </div>
          </div>

          {/* 1-Click Quick Showcase Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {featuredPresets.map((preset) => {
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
                    'inline-flex max-w-full min-w-0 min-h-[44px] items-center gap-2 rounded-pill border-2 px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    isSelected
                      ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                      : 'border-outline/30 bg-white text-red-900 hover:border-outline'
                  )}
                >
                  <PlayerAvatar
                    name={localizeText(lang, p.fullName, p.fullNameAr)}
                    playerId={p.id}
                    avatarSeed={p.avatarSeed}
                    avatar={p.avatar}
                    size="xs"
                    className="h-6 w-6"
                  />
                  <span className="truncate">
                    {localizeText(lang, p.fullName, p.fullNameAr)}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-extrabold',
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
