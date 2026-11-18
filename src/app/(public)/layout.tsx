import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-paper flex min-h-dvh flex-col bg-paper text-ink">
      <PublicHeader />
      <main className="flex-1 min-w-0">{children}</main>
      <PublicFooter />
    </div>
  );
}
