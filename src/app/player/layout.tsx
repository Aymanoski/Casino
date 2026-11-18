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
    <div className="flex min-h-dvh flex-col bg-night-gradient">
      <PublicHeader />
      <main className="flex-1 min-w-0">
        <RoleGuard>{children}</RoleGuard>
      </main>
      <PublicFooter />
    </div>
  );
}
