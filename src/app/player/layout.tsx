import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-paper flex min-h-dvh flex-col bg-paper text-ink">
      <PublicHeader />
      <main className="flex-1 min-w-0">
        <RoleGuard>{children}</RoleGuard>
      </main>
      <PublicFooter />
    </div>
  );
}
