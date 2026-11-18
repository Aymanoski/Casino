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
    <div className="flex min-h-screen flex-col bg-night-gradient">
      <PublicHeader />
      <main className="flex-1">
        <RoleGuard>{children}</RoleGuard>
      </main>
      <PublicFooter />
    </div>
  );
}
