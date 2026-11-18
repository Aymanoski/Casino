import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { SkipLink } from '@/components/layout/SkipLink';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-paper flex min-h-dvh flex-col bg-paper text-ink">
      <SkipLink />
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 outline-none">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
