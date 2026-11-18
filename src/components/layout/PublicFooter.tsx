'use client';

import React from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  FanousIcon,
  GoldHairlineDivider,
} from '@/components/motifs/RamadanMotifs';
import { Badge } from '@/components/ui/badge';

export function PublicFooter() {
  const { t, toggleLang } = useI18n();

  return (
    <footer className="mt-auto border-t border-border bg-bg-raised pt-8 pb-12">
      <div className="mx-auto max-w-content px-4 md:px-6">
        <GoldHairlineDivider className="mb-8" />

        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-button border border-border-strong bg-surface">
                <FanousIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-gold-gradient">
                  {t.brandName}
                </div>
                <div className="text-xs text-text-muted">{t.brandSubtitle}</div>
              </div>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              {t.common.footerTagline}
            </p>
            <Badge variant="gold">{t.common.placeholderBadge}</Badge>
          </div>

          {/* Public Spectator Pages */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
              {t.nav.pitch}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-text-muted">
              <Link href="/" className="hover:text-gold-300">
                {t.nav.pitch}
              </Link>
              <Link href="/final" className="hover:text-gold-300">
                {t.nav.finalNight}
              </Link>
              <Link href="/bracket" className="hover:text-gold-300">
                {t.nav.bracket}
              </Link>
              <Link href="/leaderboard" className="hover:text-gold-300">
                {t.nav.leaderboard}
              </Link>
              <Link href="/schedule" className="hover:text-gold-300">
                {t.nav.schedule}
              </Link>
              <Link href="/segments" className="hover:text-gold-300">
                {t.nav.segments}
              </Link>
              <Link href="/rules" className="hover:text-gold-300">
                {t.nav.rules}
              </Link>
              <Link href="/sponsors" className="hover:text-gold-300">
                {t.nav.sponsors}
              </Link>
            </div>
          </div>

          {/* Role Portals & Language Toggle */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
              {t.nav.adminArea} & {t.nav.scorerConsole}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-text-muted">
              <Link href="/scorer/game-11" className="hover:text-gold-300">
                {t.nav.scorerConsole}
              </Link>
              <Link href="/screen/game-11" className="hover:text-gold-300">
                {t.nav.bigScreen}
              </Link>
              <Link href="/admin" className="hover:text-gold-300">
                {t.nav.adminArea}
              </Link>
              <Link href="/player" className="hover:text-gold-300">
                {t.nav.playerPortal}
              </Link>
              <Link href="/login" className="hover:text-gold-300">
                {t.nav.login}
              </Link>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={toggleLang}
                className="inline-flex items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-gold-300 hover:border-gold-500"
              >
                <Globe className="h-3.5 w-3.5 text-gold-500" />
                <span>{t.common.switchLanguage}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-text-faint">
          {t.common.footerDisclaimer}
        </div>
      </div>
    </footer>
  );
}
