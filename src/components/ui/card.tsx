'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MarqueeBulbs } from '@/components/brand/MarqueeBulbs';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Premium variant adds strong gold border, inner glow, corner ornaments, and optional marquee bulbs */
  premium?: boolean;
  /** Wrap or crown the card with warm chasing casino marquee bulbs */
  marquee?: boolean | 'strip' | 'perimeter';
  bulbCount?: number;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      premium = false,
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
          '@container relative min-w-0 overflow-hidden rounded-card border bg-surface p-card-pad shadow-card-inner transition-all duration-200',
          premium
            ? 'border-border-strong shadow-glow-gold bg-gradient-to-b from-surface-2/80 via-surface to-surface'
            : 'border-border hover:border-border-strong hover:shadow-[0_0_20px_rgba(232,184,75,0.12)]',
          className
        )}
        {...props}
      >
        {/* Subtle Gold Corner Filigree Accents on Premium Cards */}
        {premium && (
          <>
            <span
              className="pointer-events-none absolute top-2.5 start-2.5 h-3.5 w-3.5 border-t-2 border-s-2 border-gold-500/65 rounded-tl-[4px]"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute top-2.5 end-2.5 h-3.5 w-3.5 border-t-2 border-e-2 border-gold-500/65 rounded-tr-[4px]"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute bottom-2.5 start-2.5 h-3.5 w-3.5 border-b-2 border-s-2 border-gold-500/65 rounded-bl-[4px]"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute bottom-2.5 end-2.5 h-3.5 w-3.5 border-b-2 border-e-2 border-gold-500/65 rounded-br-[4px]"
              aria-hidden="true"
            />
          </>
        )}

        {/* Top Marquee Strip if marquee === 'strip' */}
        {marquee === 'strip' && (
          <div className="mb-4 sm:mb-5">
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
      'font-display text-fluid-xl font-bold leading-tight ltr:tracking-tight rtl:tracking-normal text-ivory',
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
    className={cn('text-sm text-text-muted leading-relaxed', className)}
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
      'flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 mt-4',
      className
    )}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';
