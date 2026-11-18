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
 * Per DESIGN.md §6 & §8 and AGENTS.md §13:
 * - Admin (`mode === 'admin'`): Paper layout (`theme-paper bg-paper text-ink`) with a deep red sidebar (right side in RTL via `start-0`).
 * - Scorer (`mode === 'scorer'`): Stage-Dark layout (`theme-stage-dark bg-red-900 text-white`), deep maroon background, high contrast.
 * - Responsive: mobile bottom bar + drawer (< md), collapsible icon rail on tablets (md..xl), docked sidebar on xl+.
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

  const isScorer = mode === 'scorer';

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

  const bottomBarLinks = visibleLinks.slice(0, 3);

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
    <div
      className={cn(
        'flex min-h-dvh flex-col md:flex-row',
        isScorer
          ? 'theme-stage-dark bg-red-900 text-white'
          : 'theme-paper bg-paper text-ink'
      )}
    >
      {/* Mobile Drawer & Tablet Expanded Rail Backdrop */}
      {(mobileDrawerOpen || tabletExpanded) && (
        <div
          className={cn(
            'fixed inset-0 z-40 bg-red-900/70 backdrop-blur-sm',
            mobileDrawerOpen ? 'md:hidden' : 'hidden md:block xl:hidden'
          )}
          onClick={() => {
            setMobileDrawerOpen(false);
            setTabletExpanded(false);
          }}
        />
      )}

      {/* Spacer for fixed Tablet Rail */}
      <div
        className="hidden w-[88px] shrink-0 transition-all duration-200 md:block xl:hidden"
        aria-hidden="true"
      />

      {/* Deep Red Sidebar (Right side in RTL via start-0) */}
      <aside
        aria-label={mode === 'admin' ? 'Admin Navigation' : 'Scorer Navigation'}
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex flex-col border-e-[3px] border-outline pt-safe pb-safe ps-safe text-white transition-all duration-200',
          isScorer ? 'bg-red-800' : 'bg-red-800',
          mobileDrawerOpen
            ? 'w-[min(85vw,300px)] translate-x-0 visible shadow-sticker-lg'
            : 'w-[min(85vw,300px)] -translate-x-full rtl:translate-x-full invisible md:visible',
          'md:translate-x-0 md:rtl:translate-x-0',
          tabletExpanded ? 'md:w-72 md:shadow-sticker-lg' : 'md:w-[88px]',
          'xl:static xl:shadow-none',
          desktopCollapsed ? 'xl:w-[88px]' : 'xl:w-64 2xl:w-72'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-header-h items-center justify-between border-b-2 border-outline bg-red-700 px-3.5">
          <Link
            href="/"
            className={cn(
              'flex min-h-[44px] items-center gap-3 overflow-hidden rounded-button focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              !tabletExpanded && 'md:justify-center md:w-full',
              desktopCollapsed ? 'xl:justify-center xl:w-full' : 'xl:justify-start'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-white shadow-sticker-sm">
              <FanousIcon className="h-6 w-6" />
            </div>
            <div
              className={cn(
                'min-w-0',
                !tabletExpanded && 'md:hidden',
                desktopCollapsed ? 'xl:hidden' : 'xl:block'
              )}
            >
              <div className="truncate py-0.5 leading-tight font-display text-lg text-gold-sticker">
                {t.brandName}
              </div>
              <div className="truncate text-[11px] font-bold uppercase ltr:tracking-wider rtl:tracking-normal text-white/90">
                {mode === 'admin' ? t.nav.adminArea : t.nav.scorerConsole}
              </div>
            </div>
          </Link>

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

        {/* Collapse / Expand Rail Button */}
        <div className="hidden md:flex items-center justify-center border-b-2 border-outline/40 px-2.5 py-2">
          <button
            type="button"
            onClick={() => setTabletExpanded((prev) => !prev)}
            aria-label={tabletExpanded ? 'Collapse navigation rail' : 'Expand navigation rail'}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-2 border-outline bg-white px-2 text-xs font-extrabold text-red-900 shadow-sticker-sm transition-colors hover:bg-paper xl:hidden focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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

          <button
            type="button"
            onClick={() => setDesktopCollapsed((prev) => !prev)}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden xl:flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-2 border-outline bg-white px-2.5 text-xs font-extrabold text-red-900 shadow-sticker-sm transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
        <nav className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto p-2.5 sm:p-3">
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
                  'flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-button px-3 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  !tabletExpanded && 'md:justify-center md:px-0',
                  desktopCollapsed ? 'xl:justify-center xl:px-0' : 'xl:justify-start xl:px-3.5',
                  active
                    ? 'border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                    : 'border-2 border-transparent text-white/90 hover:bg-red-700 hover:text-white'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-red-900' : 'text-white'
                  )}
                />
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

        {/* Bottom Sidebar Controls */}
        <div className="space-y-2 border-t-2 border-outline/40 bg-red-900/40 p-3">
          <button
            type="button"
            onClick={handleResetDemo}
            title={t.common.resetDemoData}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-2 border-outline bg-white px-3 py-2 text-xs font-extrabold text-red-900 shadow-sticker-sm sticker-press hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              !tabletExpanded && 'md:px-0',
              desktopCollapsed && 'xl:px-0'
            )}
          >
            <RotateCcw className="h-4 w-4 shrink-0 text-red-600" />
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
              'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-2 border-white/25 bg-red-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-white/50 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
        <header
          className={cn(
            'sticky top-0 z-30 flex h-header-h items-center justify-between gap-2 px-3 xs:px-4 pt-safe backdrop-blur-md md:px-6 xl:px-8',
            isScorer
              ? 'border-b-2 border-red-800 bg-red-900/95 text-white'
              : 'border-b border-border-paper bg-white/95 text-ink shadow-sm'
          )}
        >
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
              <span
                className={cn(
                  'hidden lg:inline truncate text-sm font-bold',
                  isScorer ? 'text-white' : 'text-red-900'
                )}
              >
                {localizeText(lang, user.name, user.nameAr)}
              </span>
            )}
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Quick Role Selector (min 16px font, min 44px touch height) */}
            <select
              aria-label={t.common.switchRoleQuick}
              value={user?.id ?? ''}
              onChange={(e) => {
                if (e.target.value) loginAs(e.target.value);
              }}
              className="min-h-[44px] h-11 min-w-0 max-w-[155px] xs:max-w-[190px] sm:max-w-[235px] rounded-input border-2 border-border-paper bg-white px-2.5 sm:px-3 text-base font-medium text-ink focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/25"
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
              className={cn(
                'inline-flex min-h-[44px] min-w-[44px] h-11 shrink-0 items-center justify-center gap-1.5 rounded-pill border-2 border-outline px-3 sm:px-3.5 text-xs font-extrabold shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                isScorer
                  ? 'bg-gold-400 text-red-900'
                  : 'bg-red-600 text-white'
              )}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span>{t.common.switchLanguage}</span>
            </button>
          </div>
        </header>

        {resetMessage && (
          <div className="border-b-2 border-positive bg-positive-soft px-4 py-2.5 text-center text-xs font-bold text-positive-ink">
            {resetMessage}
          </div>
        )}

        <main className="flex-1 px-3 py-4 xs:px-4 md:p-6 xl:p-8 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-8">
          <div className="mx-auto w-full max-w-content-wide">
            <RoleGuard>{children}</RoleGuard>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< md) */}
      <nav
        aria-label={mode === 'admin' ? 'Mobile Admin Bar' : 'Mobile Scorer Bar'}
        className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-outline bg-red-800 pb-safe text-white md:hidden [@media(max-height:460px)]:hidden"
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
                  'flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-button px-1 py-1 text-[11px] font-bold transition-colors',
                  active
                    ? 'border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm'
                    : 'text-white/90 hover:bg-red-700 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-button px-1 py-1 text-[11px] font-bold text-white/90 hover:bg-red-700 hover:text-white"
            aria-label="More navigation links"
          >
            <Menu className="h-4 w-4 shrink-0" />
            <span>{lang === 'ar' ? 'المزيد' : 'More'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
