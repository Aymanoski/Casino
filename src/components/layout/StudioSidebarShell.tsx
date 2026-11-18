'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Award,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  Globe,
  Home,
  LayoutDashboard,
  Layers,
  Menu,
  MonitorPlay,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Tablet,
  Users,
  X,
} from 'lucide-react';
import { canAccessPath, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { settingsRepo } from '@/lib/repos';
import { cn, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FanousIcon } from '@/components/motifs/RamadanMotifs';
import { RoleGuard } from './RoleGuard';

interface SidebarLinkItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * StudioSidebarShell
 * Responsive Admin & Scorer Studio Shell per AGENTS.md §13:
 * - Phones (< 768px): Bottom quick-action bar + logical-start slide-over Drawer
 * - Tablets (768px–1279px): Collapsible Icon Rail (expands to full overlay panel; mirrors in RTL)
 * - Desktops (1280px+): Full docked sidebar (also collapsible to rail for extra data-table room)
 * - Language toggle is always visible and reachable at every width
 */
export function StudioSidebarShell({
  mode,
  children,
}: {
  mode: 'admin' | 'scorer';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { lang, toggleLang, t } = useI18n();
  const { user, demoUsers, loginAs } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    setMobileDrawerOpen(false);
    setTabletExpanded(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setTabletExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const adminLinks: SidebarLinkItem[] = [
    { href: '/admin', label: t.adminNav.dashboard, shortLabel: t.adminNav.dashboard, icon: LayoutDashboard },
    { href: '/admin/players', label: t.adminNav.players, shortLabel: lang === 'ar' ? 'اللاعبون' : 'Players', icon: Users },
    { href: '/admin/check-in', label: t.adminNav.checkIn, shortLabel: lang === 'ar' ? 'الحضور' : 'Check-In', icon: CheckSquare },
    { href: '/admin/bracket', label: t.adminNav.bracket, shortLabel: lang === 'ar' ? 'الشجرة' : 'Bracket', icon: GitBranch },
    { href: '/admin/games', label: t.adminNav.games, shortLabel: lang === 'ar' ? 'المباريات' : 'Games', icon: Calendar },
    { href: '/admin/segments', label: t.adminNav.segments, shortLabel: lang === 'ar' ? 'الفقرات' : 'Segments', icon: Layers },
    { href: '/admin/results', label: t.adminNav.results, shortLabel: lang === 'ar' ? 'النتائج' : 'Results', icon: Activity },
    { href: '/admin/audit', label: t.adminNav.audit, shortLabel: lang === 'ar' ? 'المراجعة' : 'Audit', icon: Shield },
    { href: '/admin/managers', label: t.adminNav.managers, shortLabel: lang === 'ar' ? 'المديرون' : 'Managers', icon: Users },
    { href: '/admin/content', label: t.adminNav.content, shortLabel: lang === 'ar' ? 'المحتوى' : 'Content', icon: FileText },
    { href: '/admin/sponsors', label: t.adminNav.sponsors, shortLabel: lang === 'ar' ? 'الرعاة' : 'Sponsors', icon: Award },
    { href: '/admin/settings', label: t.adminNav.settings, shortLabel: lang === 'ar' ? 'الإعدادات' : 'Settings', icon: Settings },
  ];

  const scorerLinks: SidebarLinkItem[] = [
    { href: '/scorer', label: t.scorerNav.myGames, shortLabel: lang === 'ar' ? 'طاولاتي' : 'Tables', icon: Tablet },
    {
      href: '/scorer/game-11',
      label: `${t.scorerNav.liveConsole} (G11)`,
      shortLabel: lang === 'ar' ? 'التحكيم' : 'Console',
      icon: Sparkles,
    },
    {
      href: '/screen/game-11',
      label: t.scorerNav.bigScreenPreview,
      shortLabel: lang === 'ar' ? 'الشاشة' : 'Screen',
      icon: MonitorPlay,
    },
  ];

  const rawLinks = mode === 'admin' ? adminLinks : scorerLinks;
  const visibleLinks = rawLinks.filter((item) =>
    item.href.startsWith('/screen')
      ? true
      : canAccessPath(user?.role ?? null, item.href)
  );

  // Mobile bottom-bar quick links (3 primary links + More drawer button)
  const bottomBarLinks =
    mode === 'scorer'
      ? visibleLinks.slice(0, 3)
      : visibleLinks.slice(0, 3);

  const handleResetDemo = async () => {
    await settingsRepo.resetDemoData(user?.id ?? 'user-admin');
    setResetMessage(t.common.resetConfirm);
    setTimeout(() => setResetMessage(null), 4000);
  };

  const isLinkActive = (href: string) =>
    href === '/admin' || href === '/scorer'
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ivory md:flex-row">
      {/* Mobile Drawer Backdrop (< md) & Tablet Expanded Rail Backdrop (md..xl) */}
      {(mobileDrawerOpen || tabletExpanded) && (
        <div
          className={cn(
            'fixed inset-0 z-40 bg-bg/75 backdrop-blur-sm',
            mobileDrawerOpen ? 'md:hidden' : 'hidden md:block xl:hidden'
          )}
          onClick={() => {
            setMobileDrawerOpen(false);
            setTabletExpanded(false);
          }}
        />
      )}

      {/* Spacer for fixed Tablet Rail when expanded as overlay on md..xl */}
      <div
        className={cn(
          'hidden shrink-0 transition-all duration-200 md:block xl:hidden',
          'w-[88px]'
        )}
        aria-hidden="true"
      />

      {/* Sidebar / Collapsible Tablet Rail / Mobile Drawer */}
      <aside
        aria-label={mode === 'admin' ? 'Admin Navigation' : 'Scorer Navigation'}
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex flex-col border-e border-border bg-bg-raised pt-safe pb-safe ps-safe transition-all duration-200',
          // Mobile (< md): slide-over drawer mirrored in RTL
          mobileDrawerOpen
            ? 'w-[min(85vw,300px)] translate-x-0 visible shadow-glow-gold-lg'
            : 'w-[min(85vw,300px)] -translate-x-full rtl:translate-x-full invisible md:visible',
          // Tablet (md..xl): persistent collapsible rail at start-0
          'md:translate-x-0 md:rtl:translate-x-0',
          tabletExpanded ? 'md:w-72 md:shadow-glow-gold-lg' : 'md:w-[88px]',
          // Desktop (xl+): static docked sidebar (collapsible if desired)
          'xl:static xl:shadow-none',
          desktopCollapsed ? 'xl:w-[88px]' : 'xl:w-64 2xl:w-72'
        )}
      >
        {/* Sidebar / Rail Header */}
        <div className="flex h-header-h items-center justify-between border-b border-border px-3.5">
          <Link
            href="/"
            className={cn(
              'flex min-h-[44px] items-center gap-3 overflow-hidden',
              !tabletExpanded && 'md:justify-center md:w-full',
              desktopCollapsed ? 'xl:justify-center xl:w-full' : 'xl:justify-start'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface shadow-glow-gold">
              <FanousIcon className="h-6 w-6" />
            </div>
            <div
              className={cn(
                'min-w-0',
                !tabletExpanded && 'md:hidden',
                desktopCollapsed ? 'xl:hidden' : 'xl:block'
              )}
            >
              <div className="truncate font-display text-base font-bold text-gold-gradient">
                {t.brandName}
              </div>
              <div className="truncate text-[11px] uppercase tracking-wider text-text-muted">
                {mode === 'admin' ? t.nav.adminArea : t.nav.scorerConsole}
              </div>
            </div>
          </Link>

          {/* Mobile Drawer Close (< md) */}
          <Button
            variant="surface"
            size="icon"
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tablet & Desktop Rail Collapse Toggle Bar */}
        <div className="hidden md:flex items-center justify-center border-b border-border/60 px-2.5 py-2">
          {/* Tablet expand/collapse button */}
          <button
            type="button"
            onClick={() => setTabletExpanded((prev) => !prev)}
            aria-label={tabletExpanded ? 'Collapse navigation rail' : 'Expand navigation rail'}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border border-border bg-surface/80 px-2 text-xs font-medium text-gold-300 transition-colors hover:border-gold-500 xl:hidden"
          >
            {tabletExpanded ? (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0 rtl:rotate-180" />
                <span>{lang === 'ar' ? 'طي القائمة' : 'Collapse'}</span>
              </>
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" />
            )}
          </button>

          {/* Desktop collapse/expand button */}
          <button
            type="button"
            onClick={() => setDesktopCollapsed((prev) => !prev)}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden xl:flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border border-border bg-surface/80 px-2.5 text-xs font-medium text-gold-300 transition-colors hover:border-gold-500"
          >
            {desktopCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0 rtl:rotate-180" />
                <span>{lang === 'ar' ? 'طي الشريط الجانبي' : 'Collapse Rail'}</span>
              </>
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto p-2.5 sm:p-3">
          {visibleLinks.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setTabletExpanded(false);
                }}
                className={cn(
                  'flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium transition-all',
                  !tabletExpanded && 'md:justify-center md:px-0',
                  desktopCollapsed ? 'xl:justify-center xl:px-0' : 'xl:justify-start xl:px-3.5',
                  active
                    ? 'border border-gold-500/50 bg-gold-500/15 text-gold-300 shadow-glow-gold'
                    : 'text-text-muted hover:bg-surface hover:text-ivory'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-gold-500" />
                <span
                  className={cn(
                    'truncate',
                    !tabletExpanded && 'md:hidden',
                    desktopCollapsed ? 'xl:hidden' : 'xl:inline'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sidebar Controls: Reset Demo Data & Return to Public Site */}
        <div className="space-y-2 border-t border-border p-3">
          <button
            type="button"
            onClick={handleResetDemo}
            title={t.common.resetDemoData}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border border-border-strong bg-surface px-3 py-2 text-xs font-medium text-gold-300 transition-colors hover:border-gold-500 hover:bg-gold-500/10',
              !tabletExpanded && 'md:px-0',
              desktopCollapsed && 'xl:px-0'
            )}
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                'truncate',
                !tabletExpanded && 'md:hidden',
                desktopCollapsed ? 'xl:hidden' : 'xl:inline'
              )}
            >
              {t.common.resetDemoData}
            </span>
          </button>

          <Link
            href="/"
            title={t.common.backToHome}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted hover:text-ivory',
              !tabletExpanded && 'md:px-0',
              desktopCollapsed && 'xl:px-0'
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                'truncate',
                !tabletExpanded && 'md:hidden',
                desktopCollapsed ? 'xl:hidden' : 'xl:inline'
              )}
            >
              {t.common.backToHome}
            </span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Studio Bar */}
        <header className="sticky top-0 z-30 flex h-header-h items-center justify-between gap-2 border-b border-border bg-bg/90 px-3 xs:px-4 pt-safe backdrop-blur-md md:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="surface"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open Sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Badge variant="gold" className="hidden sm:inline-flex shrink-0">
              {user ? t.roles[user.role] : t.roles.visitor}
            </Badge>
            {user && (
              <span className="hidden lg:inline truncate text-sm font-medium text-ivory">
                {localizeText(lang, user.name, user.nameAr)}
              </span>
            )}
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Quick Role Selector (min 16px font so iOS doesn't zoom, min 44px touch target) */}
            <select
              aria-label={t.common.switchRoleQuick}
              value={user?.id ?? ''}
              onChange={(e) => {
                if (e.target.value) loginAs(e.target.value);
              }}
              className="min-h-[44px] h-11 min-w-0 max-w-[155px] xs:max-w-[190px] sm:max-w-[235px] rounded-input border border-border-strong bg-surface-2 px-2.5 sm:px-3 text-base text-ivory focus:border-gold-500"
            >
              {demoUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {localizeText(lang, u.name, u.nameAr)} ({t.roles[u.role]})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleLang}
              aria-label="Toggle Language (English / Arabic)"
              className="inline-flex min-h-[44px] min-w-[44px] h-11 shrink-0 items-center justify-center gap-1.5 rounded-pill border border-border-strong bg-surface-2 px-3 sm:px-3.5 text-xs font-semibold text-gold-300 hover:border-gold-500"
            >
              <Globe className="h-3.5 w-3.5 shrink-0 text-gold-500" />
              <span>{t.common.switchLanguage}</span>
            </button>
          </div>
        </header>

        {resetMessage && (
          <div className="border-b border-positive/40 bg-positive/15 px-4 py-2.5 text-center text-xs font-semibold text-positive">
            {resetMessage}
          </div>
        )}

        <main className="flex-1 px-3 py-4 xs:px-4 md:p-6 xl:p-8 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-8">
          <div className="mx-auto w-full max-w-content-wide">
            <RoleGuard>{children}</RoleGuard>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< md, hides on ultra-short landscape phones where drawer trigger stays in top bar) */}
      <nav
        aria-label={mode === 'admin' ? 'Mobile Admin Bar' : 'Mobile Scorer Bar'}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-bg-raised/95 pb-safe backdrop-blur-md md:hidden [@media(max-height:460px)]:hidden"
      >
        <div className="grid grid-flow-col auto-cols-fr gap-1 px-2 py-1.5">
          {bottomBarLinks.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-button px-1 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-gold-500/15 text-gold-300'
                    : 'text-text-muted hover:text-ivory'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-gold-500" />
                <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-button px-1 py-1 text-[11px] font-medium text-text-muted hover:text-ivory"
            aria-label="More navigation links"
          >
            <Menu className="h-4 w-4 shrink-0 text-gold-500" />
            <span>{lang === 'ar' ? 'المزيد' : 'More'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
