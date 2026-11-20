import React, { Suspense } from 'react';
import { PlayerProfileView } from '@/components/player/PlayerProfileView';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlayerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-content-wide px-safe py-10 space-y-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PlayerProfileView />
    </Suspense>
  );
}
