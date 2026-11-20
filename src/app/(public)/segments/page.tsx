import React, { Suspense } from 'react';
import { SegmentsLibraryView } from '@/components/public';
import { Skeleton } from '@/components/ui/skeleton';

export default function SegmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-content-wide px-safe py-12 space-y-4">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <SegmentsLibraryView />
    </Suspense>
  );
}
