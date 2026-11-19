'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScoreChip, type ScoreChipTone } from '@/components/brand';

export interface AdminPageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Calm, scan-first header for Operate-mode Admin surfaces (DESIGN.md §8).
 * Intentionally avoids micro-eyebrows above the heading so the page title carries primary weight.
 */
export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border-paper pb-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl sm:text-[1.875rem] leading-tight ltr:tracking-tight rtl:tracking-normal text-red-900">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="max-w-[68ch] text-sm text-ink-muted leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export interface StatChipItem {
  id: string;
  value: number | string;
  label: string;
  detail?: string;
  tone: ScoreChipTone;
  useArabicIndicDigits?: boolean;
}

/**
 * Key tournament numbers rendered in classic casino poker-chip badges (DESIGN.md §8)
 * seated on calm Paper cards for instant glanceability.
 */
export function AdminStatChipStrip({
  items,
  className,
}: {
  items: StatChipItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-3 grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="flex min-w-0 flex-col items-center gap-2 rounded-card border border-border-paper bg-white p-3 text-center shadow-soft sm:flex-row sm:items-center sm:gap-3.5 sm:p-4 sm:text-start"
        >
          <ScoreChip
            value={item.value}
            tone={item.tone}
            size="md"
            useArabicIndicDigits={item.useArabicIndicDigits}
          />
          <div className="min-w-0 w-full flex-1">
            <div className="text-xs sm:text-sm font-bold text-red-900 leading-snug">
              {item.label}
            </div>
            {item.detail && (
              <div className="line-clamp-2 sm:truncate text-[11px] sm:text-xs text-ink-muted mt-0.5 leading-snug">
                {item.detail}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card border border-negative bg-negative-soft p-4 text-ink sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
        <p className="text-sm font-semibold text-red-900">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          <span>{retryLabel}</span>
        </Button>
      )}
    </div>
  );
}
