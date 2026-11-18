'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Lantern } from '@/components/brand/Lantern';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

/**
 * EmptyState
 * Per DESIGN.md §6 & §9:
 * Midnight panel with flat gold line-art swaying Lantern illustration,
 * headline, muted description, and optional CTA.
 */
export function EmptyState({
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-surface/65 text-center shadow-card-inner',
        compact ? 'px-5 py-8' : 'px-6 py-12 md:py-16',
        className
      )}
      {...props}
    >
      <div className="mb-4 flex items-center justify-center rounded-pill border border-border bg-bg-raised/90 p-4 shadow-glow-gold">
        <Lantern size={compact ? 'sm' : 'md'} chainLength={4} />
      </div>

      <h3 className="font-display text-xl md:text-2xl font-bold text-gold-100">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-md text-sm text-text-muted leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
