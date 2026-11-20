import React, { Suspense } from 'react';
import { PlayerHistoryView } from '@/components/player/PlayerHistoryView';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlayerHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-content-wide px-safe py-10 space-y-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PlayerHistoryView />
    </Suspense>
  );
}
