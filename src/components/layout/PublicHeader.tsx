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

  // Close drawer / popover on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setRoleMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setRoleMenuOpen(false);
  }, [pathname]);

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
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/90 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-header-h max-w-content-wide items-center justify-between gap-1.5 xs:gap-2 px-2.5 xs:px-4 md:px-6">
          {/* Brand Identity */}
          <Link
            href="/"
            className="group flex min-h-[44px] min-w-0 shrink xl:shrink-0 items-center gap-1.5 xs:gap-2 sm:gap-2.5 py-1 focus-visible:rounded-button"
          >
            <div className="relative flex h-9 w-9 xs:h-10 xs:w-10 shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface shadow-glow-gold transition-transform duration-200 group-hover:scale-105">
              <FanousIcon className="h-5 w-5 xs:h-6 xs:w-6" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate xl:whitespace-nowrap font-display text-sm xs:text-base sm:text-lg font-bold ltr:tracking-tight rtl:tracking-normal text-gold-gradient">
                {t.brandName}
              </span>
              <span className="hidden sm:block truncate xl:whitespace-nowrap text-[10px] uppercase tracking-widest text-text-muted">
                {t.brandSubtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Primary Navigation (xl: 1280px+) */}
          <nav
            aria-label="Main Navigation"
            className="hidden xl:flex items-center gap-0.5 2xl:gap-1.5"
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
                    'relative inline-flex min-h-[44px] items-center whitespace-nowrap px-2 2xl:px-2.5 py-2 text-xs 2xl:text-sm font-medium transition-colors',
                    isActive
                      ? 'text-gold-300'
                      : 'text-text-muted hover:text-ivory'
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 bg-gold-gradient shadow-glow-gold" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right / End Controls: Live Pill, Role Switcher Badge, Language Toggle, Drawer Trigger */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Live Game Quick-Jump Pill on md+ (also available in mobile drawer) */}
            {liveGame && (
              <Link
                href={`/screen/${liveGame.id}`}
                className="hidden md:inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border border-live/50 bg-live/15 px-3 py-1.5 text-xs font-semibold text-ivory transition-all hover:border-live hover:bg-live/25"
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
                aria-label={`${t.common.switchRoleQuick}: ${
                  user ? localizeText(lang, user.name, user.nameAr) : roleLabel
                }`}
                className="inline-flex min-h-[44px] min-w-[44px] h-11 items-center justify-center gap-1.5 rounded-pill border border-border-strong bg-surface px-2.5 xs:px-3 text-xs font-medium text-ivory transition-colors hover:border-gold-500 hover:bg-surface-2"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold-500" />
                <span className="hidden sm:inline max-w-[140px] truncate">
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
                    className="fixed inset-x-3 top-[calc(var(--header-h)+var(--sat)+0.5rem)] z-50 max-h-[75dvh] overflow-y-auto rounded-card border border-border-strong bg-surface p-3 shadow-glow-gold sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-80"
                  >
                    <div className="mb-2 flex items-center justify-between border-b border-border pb-2 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                        {t.common.switchRoleQuick}
                      </span>
                      <Link
                        href="/login"
                        onClick={() => setRoleMenuOpen(false)}
                        className="inline-flex min-h-[44px] items-center px-2 text-xs text-text-muted underline hover:text-gold-300"
                      >
                        {t.nav.login}
                      </Link>
                    </div>

                    {/* Quick Workspace Shortcuts */}
                    <div className="mb-2 grid grid-cols-2 gap-1.5">
                      <Link
                        href="/scorer/game-11"
                        onClick={() => setRoleMenuOpen(false)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                      >
                        <Tablet className="h-3.5 w-3.5 shrink-0 text-gold-500" />
                        <span className="truncate">{t.nav.scorerConsole}</span>
                      </Link>
                      <Link
                        href="/screen/game-11"
                        onClick={() => setRoleMenuOpen(false)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                      >
                        <MonitorPlay className="h-3.5 w-3.5 shrink-0 text-gold-500" />
                        <span className="truncate">{t.nav.bigScreen}</span>
                      </Link>
                      <Link
                        href="/admin"
                        onClick={() => setRoleMenuOpen(false)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-gold-500" />
                        <span className="truncate">{t.nav.adminArea}</span>
                      </Link>
                      <Link
                        href="/player"
                        onClick={() => setRoleMenuOpen(false)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-xs text-ivory hover:border-gold-500"
                      >
                        <UserCheck className="h-3.5 w-3.5 shrink-0 text-gold-500" />
                        <span className="truncate">{t.nav.playerPortal}</span>
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
                              'flex min-h-[44px] w-full items-center justify-between rounded-input px-2.5 py-2 text-start text-xs transition-colors',
                              isCurrent
                                ? 'border border-gold-500/50 bg-gold-500/15 text-gold-100'
                                : 'text-text-muted hover:bg-surface-2 hover:text-ivory'
                            )}
                          >
                            <div className="min-w-0 truncate pe-2">
                              <div className="truncate font-medium text-ivory">
                                {localizeText(lang, demoAcc.name, demoAcc.nameAr)}
                              </div>
                              <div className="text-[11px] text-text-faint">
                                {t.roles[demoAcc.role]}
                              </div>
                            </div>
                            {isCurrent && (
                              <Badge variant="gold" className="shrink-0 px-2 py-0.5 text-[10px]">
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
                        className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-input border border-border px-2.5 py-2 text-center text-xs text-text-muted hover:border-negative/50 hover:text-negative"
                      >
                        {t.nav.logout}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Language Toggle (EN | عربي) — Always visible & reachable */}
            <button
              type="button"
              onClick={toggleLang}
              aria-label="Toggle Language (English / Arabic)"
              className="inline-flex min-h-[44px] min-w-[44px] h-11 shrink-0 items-center justify-center gap-1.5 rounded-pill border border-border-strong bg-surface-2 px-2.5 xs:px-3.5 text-xs font-semibold text-gold-300 transition-all hover:border-gold-500 hover:bg-gold-500/15"
            >
              <Globe className="h-3.5 w-3.5 shrink-0 text-gold-500" />
              <span>{t.common.switchLanguage}</span>
            </button>

            {/* Mobile / Tablet Drawer Menu Trigger (< xl) */}
            <Button
              variant="surface"
              size="icon"
              className="xl:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="public-nav-drawer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Slide-over Navigation Drawer for Phones & Tablets (Mirrors natively in RTL via end-0 / border-s) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" id="public-nav-drawer">
          <div
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 end-0 z-50 flex w-[min(88vw,360px)] flex-col border-s border-border-strong bg-bg-raised pt-safe pb-safe pe-safe shadow-glow-gold-lg">
            {/* Drawer Header */}
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface shadow-glow-gold">
                  <FanousIcon className="h-5 w-5" />
                </div>
                <span className="truncate font-display text-base font-bold text-gold-gradient">
                  {t.brandName}
                </span>
              </div>
              <Button
                variant="surface"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close Navigation Drawer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Live Table Banner */}
              {liveGame && (
                <Link
                  href={`/screen/${liveGame.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[48px] items-center justify-between gap-2 rounded-card border border-live/50 bg-live/15 px-4 py-2.5 text-xs font-semibold text-ivory"
                >
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-live opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-pill bg-live" />
                    </span>
                    <span className="text-live font-bold">{t.common.liveNow}</span>
                  </span>
                  <span className="truncate text-ivory">
                    {localizeText(lang, liveGame.tableName, liveGame.tableNameAr)}
                  </span>
                </Link>
              )}

              {/* Primary Public Pages */}
              <nav aria-label="Mobile Navigation" className="grid grid-cols-1 xs:grid-cols-2 gap-2">
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
                        'flex min-h-[44px] items-center rounded-input border px-3.5 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-gold-500 bg-gold-500/15 text-gold-300 shadow-glow-gold'
                          : 'border-border bg-surface text-ivory hover:border-border-strong'
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Workspace Portals */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gold-300">
                  {t.nav.adminArea} & {t.nav.scorerConsole}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Link
                    href="/scorer/game-11"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-input border border-border-strong bg-surface px-3.5 py-2.5 text-sm font-medium text-gold-300"
                  >
                    <Tablet className="h-4 w-4 shrink-0" />
                    <span>{t.nav.scorerConsole}</span>
                  </Link>
                  <Link
                    href="/screen/game-11"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-input border border-border-strong bg-surface px-3.5 py-2.5 text-sm font-medium text-gold-300"
                  >
                    <MonitorPlay className="h-4 w-4 shrink-0" />
                    <span>{t.nav.bigScreen}</span>
                  </Link>
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-input border border-border-strong bg-surface px-3.5 py-2.5 text-sm font-medium text-gold-300"
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>{t.nav.adminArea}</span>
                  </Link>
                  <Link
                    href="/player"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-input border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-ivory"
                  >
                    <UserCheck className="h-4 w-4 shrink-0 text-gold-500" />
                    <span>{t.nav.playerPortal}</span>
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-input border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-ivory"
                  >
                    <LogIn className="h-4 w-4 shrink-0 text-gold-500" />
                    <span>{t.nav.login}</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Drawer Footer with Language Toggle */}
            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={toggleLang}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-pill border border-border-strong bg-surface-2 px-4 py-2 text-xs font-semibold text-gold-300 hover:border-gold-500"
              >
                <Globe className="h-4 w-4 text-gold-500" />
                <span>{t.common.switchLanguage}</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
