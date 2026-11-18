import React from 'react';
import { StudioSidebarShell } from '@/components/layout/StudioSidebarShell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudioSidebarShell mode="admin">{children}</StudioSidebarShell>;
}
