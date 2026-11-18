import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: 'rect' | 'pill' | 'card';
}

export function Skeleton({
  shape = 'rect',
  className,
  ...props
}: SkeletonProps) {
  const radiusClass = {
    rect: 'rounded-input',
    pill: 'rounded-pill',
    card: 'rounded-card',
  }[shape];

  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse border border-border-paper bg-gradient-to-r from-paper-2 via-gold-200/45 to-paper-2',
        radiusClass,
        className
      )}
      {...props}
    />
  );
}

export function PlayerPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-card border border-border-paper bg-white p-6 space-y-5 shadow-soft',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton shape="pill" className="h-6 w-24" />
        <Skeleton shape="pill" className="h-6 w-20" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton shape="pill" className="h-16 w-16 shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border-paper pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({
  columns = 4,
}: {
  columns?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-between gap-4 border-b border-border-paper bg-white px-4 py-3.5"
    >
      {Array.from({ length: columns }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={cn(
            'h-5',
            idx === 0 ? 'w-12' : idx === columns - 1 ? 'w-20' : 'flex-1'
          )}
        />
      ))}
    </div>
  );
}
