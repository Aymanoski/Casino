'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { localizeText } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, demoUsers, canAccess, loginAs, isLoading } = useAuth();
  const { lang, t } = useI18n();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="h-10 w-10 animate-spin rounded-pill border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  if (canAccess(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card premium className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill border border-border-strong bg-gold-500/15 text-gold-300">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <Badge variant="gold">
            {user ? t.roles[user.role] : t.roles.visitor}
          </Badge>
          <h1 className="font-display text-3xl font-bold text-ivory">
            {t.common.accessRestricted}
          </h1>
          <p className="text-sm text-text-muted">
            {t.common.accessRestrictedDesc}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-start">
          {demoUsers.map((demoAcc) => (
            <button
              key={demoAcc.id}
              type="button"
              onClick={() => loginAs(demoAcc.id)}
              className="flex items-center justify-between rounded-input border border-border bg-surface-2 p-3 transition-all hover:border-gold-500 hover:bg-gold-500/10"
            >
              <div>
                <div className="text-sm font-semibold text-ivory">
                  {localizeText(lang, demoAcc.name, demoAcc.nameAr)}
                </div>
                <div className="text-xs text-gold-300">
                  {t.roles[demoAcc.role]}
                </div>
              </div>
              <UserCheck className="h-4 w-4 text-gold-500" />
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button asChild variant="secondary">
            <Link href="/login">{t.common.goToLogin}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">{t.common.backToHome}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
