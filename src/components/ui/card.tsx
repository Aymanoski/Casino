'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Premium variant adds gold corner ribbon, gold shimmer, and optional marquee bulbs */
  premium?: boolean;
  /** Optional custom ribbon label for premium cards */
  ribbonLabel?: string;
  /** Force sticker style (2.5px maroon outline + hard offset shadow) or calm Paper style */
  appearance?: 'auto' | 'sticker' | 'calm';
  /** Wrap or crown the card with warm chasing marquee bulbs */
  marquee?: boolean | 'strip' | 'perimeter';
  bulbCount?: number;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      premium = false,
      ribbonLabel,
      appearance = 'auto',
      marquee = false,
      bulbCount = 12,
      children,
      ...props
    },
    ref
  ) => {
    const cardInner = (
      <div
        ref={ref}
        className={cn(
          '@container relative min-w-0 overflow-hidden rounded-card p-card-pad transition-all duration-200',
          appearance === 'sticker'
            ? 'bg-white text-ink border-[2.5px] border-outline shadow-sticker'
            : appearance === 'calm'
              ? 'bg-white text-ink border border-border-paper shadow-soft'
              : 'card-surface',
          premium &&
            'border-[2.5px] border-outline shadow-sticker-lg bg-gradient-to-b from-gold-200/35 via-paper to-white text-ink',
          className
        )}
        {...props}
      >
        {/* Gold Corner Ribbon on Premium Cards (DESIGN.md §6) */}
        {premium && (
          <span
            className="pointer-events-none absolute top-0 end-5 z-20 rounded-b-[10px] border-x-2 border-b-2 border-outline bg-gold-gradient px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-900 shadow-sticker-sm"
            aria-hidden="true"
          >
            {ribbonLabel ?? '★ PREMIUM'}
          </span>
        )}

        {/* Top Marquee Strip if marquee === 'strip' */}
        {marquee === 'strip' && (
          <div className={cn('mb-4 sm:mb-5', premium && 'mt-4')}>
            <MarqueeBulbs variant="strip" bulbCount={bulbCount} />
          </div>
        )}

        {children}
      </div>
    );

    if (marquee === true || marquee === 'perimeter') {
      return (
        <MarqueeBulbs variant="perimeter" bulbCount={bulbCount}>
          {cardInner}
        </MarqueeBulbs>
      );
    }

    return cardInner;
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-display text-fluid-xl leading-tight ltr:tracking-tight rtl:tracking-normal text-red-900',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm card-muted leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-wrap items-center justify-between gap-3 border-t border-border-paper pt-4 mt-4',
      className
    )}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';
