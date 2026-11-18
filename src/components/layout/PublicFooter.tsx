'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Globe, Mail, MapPin } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { settingsRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Settings } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
import {
  FanousIcon,
  GoldHairlineDivider,
} from '@/components/motifs/RamadanMotifs';
import { Badge } from '@/components/ui/badge';

export function PublicFooter() {
  const { lang, t, toggleLang } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const s = await settingsRepo.get();
      if (mounted) setSettings(s);
    };
    loadSettings();

    const unsub1 = realtime.subscribe('settings.updated', loadSettings);
    const unsub2 = realtime.subscribe('data.reset', loadSettings);
    return () => {
      mounted = false;
      unsub1();
      unsub2();
    };
  }, []);

  const contactEmail = settings?.contactEmail ?? 'partnerships@casinoelal3ab-pitch.com';
  const venueLabel = settings
    ? localizeText(lang, settings.venue, settings.venueAr)
    : lang === 'ar'
      ? 'استوديو النيل الكبير، القاهرة (موقع مبدئي)'
      : 'Grand Nile Studio, Cairo (Placeholder Venue)';
  const datesLabel = settings
    ? localizeText(lang, settings.eventDates, settings.eventDatesAr)
    : lang === 'ar'
      ? 'رمضان ٢٠٢٧ · الليالي ١٤ إلى ١٨ (موعد مبدئي)'
      : 'Ramadan 2027 · Nights 14–18 (Placeholder)';

  return (
    <footer className="theme-stage mt-auto border-t-[3px] border-outline bg-red-800 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-white">
      <div className="mx-auto max-w-content-wide px-4 md:px-6">
        <GoldHairlineDivider className="mb-8" />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand Column */}
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white shadow-sticker-sm">
                <FanousIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display text-2xl text-gold-sticker">
                  {t.brandName}
                </div>
                <div className="text-xs font-semibold text-white/90">
                  {t.brandSubtitle}
                </div>
              </div>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">
              {t.common.footerTagline}
            </p>
            <Badge variant="gold">{t.common.placeholderBadge}</Badge>

            <ul className="space-y-1.5 pt-2 text-xs text-white/90">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden="true" />
                <a
                  href={`mailto:${contactEmail}`}
                  className="underline decoration-gold-300/70 underline-offset-4 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-highlight"
                >
                  {contactEmail}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden="true" />
                <span>{datesLabel}</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden="true" />
                <span>{venueLabel}</span>
              </li>
            </ul>
          </div>

          {/* Public Spectator Pages */}
          <div className="space-y-2">
            <div className="inline-block rounded-pill border-2 border-outline bg-white px-3 py-0.5 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900 shadow-sticker-sm">
              {t.nav.pitch}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm font-semibold text-white/90">
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.pitch}
              </Link>
              <Link
                href="/final"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.finalNight}
              </Link>
              <Link
                href="/bracket"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.bracket}
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.leaderboard}
              </Link>
              <Link
                href="/schedule"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.schedule}
              </Link>
              <Link
                href="/segments"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.segments}
              </Link>
              <Link
                href="/rules"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.rules}
              </Link>
              <Link
                href="/sponsors"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.sponsors}
              </Link>
            </div>
          </div>

          {/* Role Portals & Language Toggle */}
          <div className="space-y-3">
            <div className="inline-block rounded-pill border-2 border-outline bg-white px-3 py-0.5 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900 shadow-sticker-sm">
              {lang === 'ar'
                ? `${t.nav.adminArea} و${t.nav.scorerConsole}`
                : `${t.nav.adminArea} & ${t.nav.scorerConsole}`}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm font-semibold text-white/90">
              <Link
                href="/scorer/game-11"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.scorerConsole}
              </Link>
              <Link
                href="/screen/game-11"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.bigScreen}
              </Link>
              <Link
                href="/admin"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.adminArea}
              </Link>
              <Link
                href="/player"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.playerPortal}
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-button px-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t.nav.login}
              </Link>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={toggleLang}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border-2 border-outline bg-gold-400 px-4 py-2 text-xs font-black text-red-900 shadow-sticker-sm sticker-press hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Globe className="h-3.5 w-3.5 text-red-900" />
                <span>{t.common.switchLanguage}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/20 pt-6 text-center text-xs text-white/85">
          {t.common.footerDisclaimer}
        </div>
      </div>
    </footer>
  );
}
