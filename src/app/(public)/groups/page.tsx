import React, { Suspense } from 'react';
import { GroupsStandingsView } from '@/components/public/GroupsStandingsView';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicGroupsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-content-wide px-safe py-12 space-y-6">
          <Skeleton className="h-14 w-72" />
          <Skeleton shape="card" className="h-96 w-full" />
        </div>
      }
    >
      <GroupsStandingsView />
    </Suspense>
  );
}
