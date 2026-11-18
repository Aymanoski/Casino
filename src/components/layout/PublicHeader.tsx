'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogIn,
  Menu,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Tablet,
  UserCheck,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getDefaultRouteForRole, useAuth } from '@/lib/auth';
import { gameRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';
import type { Game } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FanousIcon } from '@/components/motifs/RamadanMotifs';

export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, toggleLang, t } = useI18n();
  const { user, demoUsers, loginAs, logout } = useAuth();

  const [liveGame, setLiveGame] = useState<Game | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadLive = async () => {
      const games = await gameRepo.getLiveGames();
      if (mounted) {
        setLiveGame(games[0] ?? null);
      }
    };
    loadLive();

    const unsub = realtime.subscribe('*', () => {
      loadLive();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const navItems = [
    { href: '/', label: t.nav.pitch },
    { href: '/final', label: t.nav.finalNight },
    { href: '/bracket', label: t.nav.bracket },
    { href: '/leaderboard', label: t.nav.leaderboard },
    { href: '/schedule', label: t.nav.schedule },
    { href: '/segments', label: t.nav.segments },
    { href: '/rules', label: t.nav.rules },
    { href: '/sponsors', label: t.nav.sponsors },
  ];

  const roleLabel = user ? t.roles[user.role] : t.roles.visitor;

  const handleQuickRoleSwitch = async (userId: string, navigateToDefault = false) => {
    const loggedIn = await loginAs(userId);
    setRoleMenuOpen(false);
    if (navigateToDefault && loggedIn) {
      router.push(getDefaultRouteForRole(loggedIn.role));
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 sm:h-20 max-w-content items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        {/* Brand Identity */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 sm:gap-2.5 focus-visible:rounded-button"
        >
          <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface shadow-glow-gold transition-transform duration-200 group-hover:scale-105">
            <FanousIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex flex-col">
            <span className="whitespace-nowrap font-display text-base font-bold tracking-tight text-gold-gradient sm:text-lg">
              {t.brandName}
            </span>
            <span className="hidden sm:block whitespace-nowrap text-[10px] uppercase tracking-widest text-text-muted">
              {t.brandSubtitle}
            </span>
          </div>
        </Link>

        {/* Desktop Primary Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden xl:flex items-center gap-0.5"
        >
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative whitespace-nowrap px-2 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-gold-300'
                    : 'text-text-muted hover:text-ivory'
                )}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-2 -bottom-[19px] h-0.5 bg-gold-gradient shadow-glow-gold" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right / End Controls: Live Pill, Role Switcher Badge, Language Toggle */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          {/* Live Game Quick-Jump Pill (Bonus Pitch Feature) */}
          {liveGame && (
            <Link
              href={`/screen/${liveGame.id}`}
              className="hidden sm:inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border border-live/50 bg-live/15 px-3 py-1.5 text-xs font-semibold text-ivory transition-all hover:border-live hover:bg-live/25"
              title={localizeText(lang, liveGame.tableName, liveGame.tableNameAr)}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-live opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-pill bg-live" />
              </span>
              <span className="text-live">{t.common.live}</span>
              <span className="hidden 2xl:inline text-ivory/90">
                · {t.common.viewLiveGame}
              </span>
            </Link>
          )}

          {/* Role Badge + Quick Presenter Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoleMenuOpen((prev) => !prev)}
              aria-expanded={roleMenuOpen}
              aria-haspopup="menu"
              className="inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-2.5 sm:px-3 text-xs font-medium text-ivory transition-colors hover:border-gold-500 hover:bg-surface-2"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold-500" />
              <span className="max-w-[72px] truncate sm:max-w-[140px]">
                {user
                  ? localizeText(lang, user.name, user.nameAr)
                  : roleLabel}
                {user && (
                  <span className="hidden md:inline text-text-muted">
                    {' '}
                    ({roleLabel})
                  </span>
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            </button>

            {roleMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setRoleMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute end-0 mt-2 z-50 w-72 rounded-card border border-border-strong bg-surface p-3 shadow-glow-gold"
                >
                  <div className="mb-2 flex items-center justify-between border-b border-border pb-2 px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                      {t.common.switchRoleQuick}
                    </span>
                    <Link
                      href="/login"
                      onClick={() => setRoleMenuOpen(false)}
                      className="text-xs text-text-muted underline hover:text-gold-300"
                    >
                      {t.nav.login}
                    </Link>
                  </div>

                  {/* Quick Workspace Shortcuts */}
                  <div className="mb-2 grid grid-cols-2 gap-1.5">
                    <Link
                      href="/scorer/game-11"
                      onClick={() => setRoleMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                    >
                      <Tablet className="h-3.5 w-3.5 text-gold-500" />
                      <span>{t.nav.scorerConsole}</span>
                    </Link>
                    <Link
                      href="/screen/game-11"
                      onClick={() => setRoleMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                    >
                      <MonitorPlay className="h-3.5 w-3.5 text-gold-500" />
                      <span>{t.nav.bigScreen}</span>
                    </Link>
                    <Link
                      href="/admin"
                      onClick={() => setRoleMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 text-gold-500" />
                      <span>{t.nav.adminArea}</span>
                    </Link>
                    <Link
                      href="/player"
                      onClick={() => setRoleMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-gold-500" />
                      <span>{t.nav.playerPortal}</span>
                    </Link>
                  </div>

                  <div className="max-h-56 space-y-1 overflow-y-auto pt-1">
                    {demoUsers.map((demoAcc) => {
                      const isCurrent = user?.id === demoAcc.id;
                      return (
                        <button
                          key={demoAcc.id}
                          type="button"
                          onClick={() => handleQuickRoleSwitch(demoAcc.id, false)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-input px-2.5 py-1.5 text-start text-xs transition-colors',
                            isCurrent
                              ? 'border border-gold-500/50 bg-gold-500/15 text-gold-100'
                              : 'text-text-muted hover:bg-surface-2 hover:text-ivory'
                          )}
                        >
                          <div className="truncate pe-2">
                            <div className="font-medium text-ivory">
                              {localizeText(lang, demoAcc.name, demoAcc.nameAr)}
                            </div>
                            <div className="text-[11px] text-text-faint">
                              {t.roles[demoAcc.role]}
                            </div>
                          </div>
                          {isCurrent && (
                            <Badge variant="gold" className="px-2 py-0.5 text-[10px]">
                              ✓
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {user && (
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setRoleMenuOpen(false);
                      }}
                      className="mt-2 w-full rounded-input border border-border px-2.5 py-1.5 text-center text-xs text-text-muted hover:border-negative/50 hover:text-negative"
                    >
                      {t.nav.logout}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Language Toggle (EN | عربي) — Always visible per DESIGN.md §6 */}
          <button
            type="button"
            onClick={toggleLang}
            aria-label="Toggle Language (English / Arabic)"
            className="inline-flex h-9 sm:h-10 shrink-0 items-center gap-1 sm:gap-1.5 rounded-pill border border-border-strong bg-surface-2 px-2.5 sm:px-3.5 text-xs font-semibold text-gold-300 transition-all hover:border-gold-500 hover:bg-gold-500/15"
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-gold-500" />
            <span>{t.common.switchLanguage}</span>
          </button>

          {/* Mobile Menu Trigger */}
          <Button
            variant="surface"
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10 xl:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-bg-raised px-4 py-4 xl:hidden">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'rounded-input border px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                      : 'border-border bg-surface text-ivory'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <Link
              href="/scorer/game-11"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-3 py-1.5 text-xs text-gold-300"
            >
              <Tablet className="h-3.5 w-3.5" />
              {t.nav.scorerConsole}
            </Link>
            <Link
              href="/screen/game-11"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-3 py-1.5 text-xs text-gold-300"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              {t.nav.bigScreen}
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-3 py-1.5 text-xs text-gold-300"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t.nav.adminArea}
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-ivory"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t.nav.login}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
