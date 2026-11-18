import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns at sm/md+ breakpoints; always single-column on phones (< sm) */
  columns?: 1 | 2 | 3;
}

/**
 * FormGrid
 * Enforces single-column layout on phones (< 640px) and expands cleanly
 * on tablets/laptops/desktops per AGENTS.md §13.
 */
export function FormGrid({
  columns = 2,
  className,
  ...props
}: FormGridProps) {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  }[columns];

  return (
    <div
      className={cn('grid gap-4 sm:gap-5', colClass, className)}
      {...props}
    />
  );
}
