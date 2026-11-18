'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Award,
  Calendar,
  CheckSquare,
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
  icon: React.ComponentType<{ className?: string }>;
}

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const adminLinks: SidebarLinkItem[] = [
    { href: '/admin', label: t.adminNav.dashboard, icon: LayoutDashboard },
    { href: '/admin/players', label: t.adminNav.players, icon: Users },
    { href: '/admin/check-in', label: t.adminNav.checkIn, icon: CheckSquare },
    { href: '/admin/bracket', label: t.adminNav.bracket, icon: GitBranch },
    { href: '/admin/games', label: t.adminNav.games, icon: Calendar },
    { href: '/admin/segments', label: t.adminNav.segments, icon: Layers },
    { href: '/admin/results', label: t.adminNav.results, icon: Activity },
    { href: '/admin/audit', label: t.adminNav.audit, icon: Shield },
    { href: '/admin/managers', label: t.adminNav.managers, icon: Users },
    { href: '/admin/content', label: t.adminNav.content, icon: FileText },
    { href: '/admin/sponsors', label: t.adminNav.sponsors, icon: Award },
    { href: '/admin/settings', label: t.adminNav.settings, icon: Settings },
  ];

  const scorerLinks: SidebarLinkItem[] = [
    { href: '/scorer', label: t.scorerNav.myGames, icon: Tablet },
    {
      href: '/scorer/game-11',
      label: `${t.scorerNav.liveConsole} (G11)`,
      icon: Sparkles,
    },
    {
      href: '/screen/game-11',
      label: t.scorerNav.bigScreenPreview,
      icon: MonitorPlay,
    },
  ];

  const rawLinks = mode === 'admin' ? adminLinks : scorerLinks;
  const visibleLinks = rawLinks.filter((item) =>
    item.href.startsWith('/screen')
      ? true
      : canAccessPath(user?.role ?? null, item.href)
  );

  const handleResetDemo = async () => {
    await settingsRepo.resetDemoData(user?.id ?? 'user-admin');
    setResetMessage(t.common.resetConfirm);
    setTimeout(() => setResetMessage(null), 4000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ivory lg:flex-row">
      {/* Sidebar — Left in LTR, Right in RTL natively via flex-row + dir="rtl" and border-e */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-border bg-bg-raised transition-transform duration-200 lg:static lg:translate-x-0',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-20 items-center justify-between border-b border-border px-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-button border border-border-strong bg-surface shadow-glow-gold">
              <FanousIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display text-base font-bold text-gold-gradient">
                {t.brandName}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-text-muted">
                {mode === 'admin' ? t.nav.adminArea : t.nav.scorerConsole}
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-input p-1.5 text-text-muted hover:text-ivory lg:hidden"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleLinks.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin' || item.href === '/scorer'
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-button px-3.5 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'border border-gold-500/50 bg-gold-500/15 text-gold-300 shadow-glow-gold'
                    : 'text-text-muted hover:bg-surface hover:text-ivory'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-gold-500" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sidebar Controls: Reset Demo Data & Return to Public Site */}
        <div className="space-y-2 border-t border-border p-4">
          <button
            type="button"
            onClick={handleResetDemo}
            className="flex w-full items-center justify-center gap-2 rounded-button border border-border-strong bg-surface px-3 py-2 text-xs font-medium text-gold-300 transition-colors hover:border-gold-500 hover:bg-gold-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.common.resetDemoData}</span>
          </button>

          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-button border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted hover:text-ivory"
          >
            <Home className="h-3.5 w-3.5" />
            <span>{t.common.backToHome}</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Studio Bar */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="surface"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open Sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Badge variant="gold">
              {user ? t.roles[user.role] : t.roles.visitor}
            </Badge>
            {user && (
              <span className="hidden sm:inline text-sm font-medium text-ivory">
                {localizeText(lang, user.name, user.nameAr)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Role Selector for Studio testing */}
            <select
              aria-label={t.common.switchRoleQuick}
              value={user?.id ?? ''}
              onChange={(e) => {
                if (e.target.value) loginAs(e.target.value);
              }}
              className="h-10 rounded-input border border-border-strong bg-surface-2 px-3 text-xs text-ivory focus:border-gold-500"
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
              className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-border-strong bg-surface-2 px-3.5 text-xs font-semibold text-gold-300 hover:border-gold-500"
            >
              <Globe className="h-3.5 w-3.5 text-gold-500" />
              <span>{t.common.switchLanguage}</span>
            </button>
          </div>
        </header>

        {resetMessage && (
          <div className="border-b border-positive/40 bg-positive/15 px-6 py-2.5 text-center text-xs font-semibold text-positive">
            {resetMessage}
          </div>
        )}

        <main className="flex-1 p-4 md:p-8">
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
    </div>
  );
}
