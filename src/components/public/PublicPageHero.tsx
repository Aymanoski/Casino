'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LanternCluster } from '@/components/brand/Lantern';
import { Spotlight } from '@/components/brand/Spotlight';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';

export interface PublicPageHeroProps {
  title: string;
  goldHighlight?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  dividerVariant?: 'zigzag' | 'angled' | 'scallop';
  showLanterns?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * PublicPageHero
 * Stage sunburst header band for all public spectator pages.
 * Follows DESIGN.md §1–§4 (red sunburst stage, gold-outlined display title, white text)
 * and craft floor discipline (zero eyebrow/kicker labels above the h1, instant visible LCP).
 */
export function PublicPageHero({
  title,
  goldHighlight,
  subtitle,
  actions,
  meta,
  children,
  dividerVariant = 'zigzag',
  showLanterns = false,
  compact = false,
  className,
}: PublicPageHeroProps) {
  const renderTitle = () => {
    if (!goldHighlight) {
      return <span className="text-gold-sticker-lg">{title}</span>;
    }
    const idx = title.indexOf(goldHighlight);
    if (idx === -1) {
      return <span className="text-gold-sticker-lg">{title}</span>;
    }
    const before = title.slice(0, idx);
    const after = title.slice(idx + goldHighlight.length);
    return (
      <>
        {before && <span>{before}</span>}
        <span className="text-gold-sticker-lg">{goldHighlight}</span>
        {after && <span>{after}</span>}
      </>
    );
  };

  return (
    <div className={cn('relative', className)}>
      <SunburstStage
        variant="stage"
        className={cn(
          compact
            ? 'pt-7 pb-9 sm:pt-10 sm:pb-12'
            : 'pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-16'
        )}
      >
        <Spotlight intensity="medium" beams="dual" overlayOnly />

        {showLanterns && (
          <div
            className="pointer-events-none absolute -top-2 end-6 z-0 hidden xl:block opacity-85"
            aria-hidden="true"
          >
            <LanternCluster />
          </div>
        )}

        <div className="mx-auto max-w-content-wide px-safe space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl space-y-3 text-start">
              <h1 className="font-display text-fluid-4xl sm:text-fluid-hero text-white [text-shadow:0_4px_0_var(--red-900)] ltr:tracking-tight ltr:leading-[1.08] rtl:tracking-normal rtl:leading-[1.32] [text-wrap:balance] break-words">
                {renderTitle()}
              </h1>

              {subtitle && (
                <p className="max-w-[62ch] text-fluid-base sm:text-fluid-lg leading-relaxed text-white/95">
                  {subtitle}
                </p>
              )}

              {meta && (
                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5 pt-1">
                  {meta}
                </div>
              )}
            </div>

            {actions && (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-end">
                {actions}
              </div>
            )}
          </div>

          {children}
        </div>
      </SunburstStage>

      <StageDivider variant={dividerVariant} from="stage" to="paper" />
    </div>
  );
}
