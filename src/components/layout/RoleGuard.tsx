'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, ShieldAlert, UserCheck } from 'lucide-react';
import { canAccessPath, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn, localizeText } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, demoUsers, canAccess, loginAs, isLoading } = useAuth();
  const { lang, t } = useI18n();

  const sortedAccounts = useMemo(() => {
    return [...demoUsers].sort((a, b) => {
      const aUnlock = canAccessPath(a.role, pathname) ? 1 : 0;
      const bUnlock = canAccessPath(b.role, pathname) ? 1 : 0;
      return bUnlock - aUnlock;
    });
  }, [demoUsers, pathname]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 p-8"
      >
        <div
          className="h-10 w-10 animate-spin motion-reduce:animate-none rounded-pill border-4 border-gold-400 border-t-red-600"
          aria-hidden="true"
        />
        <span className="text-xs font-bold text-ink-muted">
          {lang === 'ar' ? 'جاري التحقق من صلاحيات الدور...' : 'Checking role permissions...'}
        </span>
      </div>
    );
  }

  if (canAccess(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-8 sm:px-4 sm:py-16">
      <Card appearance="sticker" className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill border-2 border-outline bg-red-100 text-red-700 shadow-sticker-sm">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <Badge variant="gold">
            {user ? t.roles[user.role] : t.roles.visitor}
          </Badge>
          <h1 className="font-display text-fluid-2xl text-red-900">
            {t.common.accessRestricted}
          </h1>
          <p className="text-sm text-ink-muted">
            {t.common.accessRestrictedDesc}
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 text-start">
          {sortedAccounts.map((demoAcc) => {
            const unlocksPage = canAccessPath(demoAcc.role, pathname);
            return (
              <button
                key={demoAcc.id}
                type="button"
                onClick={() => loginAs(demoAcc.id)}
                className={cn(
                  'flex min-h-[52px] items-center justify-between gap-2 rounded-input border-2 p-3 transition-[border-color,background-color] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                  unlocksPage
                    ? 'border-positive/60 bg-positive-soft/45 hover:border-blue-500 hover:bg-blue-100/50'
                    : 'border-border-paper bg-paper opacity-75 hover:opacity-100 hover:border-outline'
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">
                    {localizeText(lang, demoAcc.name, demoAcc.nameAr)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-red-700">
                    <span className="truncate">{t.roles[demoAcc.role]}</span>
                    {unlocksPage && (
                      <span className="inline-flex items-center gap-0.5 rounded-pill bg-positive-soft px-1.5 py-0.5 text-[10px] font-extrabold text-positive-ink">
                        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{lang === 'ar' ? 'يفتح الصفحة' : 'Unlocks page'}</span>
                      </span>
                    )}
                  </div>
                </div>
                <UserCheck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col xs:flex-row flex-wrap justify-center gap-3 pt-2">
          <Button asChild variant="red">
            <Link href="/login">{t.common.goToLogin}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">{t.common.backToHome}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
