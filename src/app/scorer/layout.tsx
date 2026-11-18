import React from 'react';
import { StudioSidebarShell } from '@/components/layout/StudioSidebarShell';

export default function ScorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudioSidebarShell mode="scorer">{children}</StudioSidebarShell>;
}
