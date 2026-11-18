'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { PlayingCardMotif, PlayingDice } from '@/components/brand/GameMotifs';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

/**
 * EmptyState
 * Per DESIGN.md §6:
 * Playful original illustration (dice & playing card) on crisp Paper surface,
 * headline in deep maroon, muted description, and optional primary action.
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
        'flex flex-col items-center justify-center rounded-card border-2 border-dashed border-red-900/25 bg-white text-center text-ink shadow-soft',
        compact ? 'px-5 py-8' : 'px-6 py-12 md:py-16',
        className
      )}
      {...props}
    >
      <div className="mb-4 flex items-center justify-center gap-1 rounded-card border-2 border-outline bg-paper-2 px-5 py-3 shadow-sticker-sm">
        <PlayingDice value={5} size={compact ? 'sm' : 'md'} tilt={-10} />
        <PlayingCardMotif
          suit="star"
          cornerText="★"
          tone="gold"
          size={compact ? 'sm' : 'md'}
          tilt={8}
        />
      </div>

      <h3 className="font-display text-xl md:text-2xl text-red-900">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-md text-sm text-ink-muted leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
