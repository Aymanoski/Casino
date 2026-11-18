import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-bold ltr:tracking-wide rtl:tracking-normal transition-colors',
  {
    variants: {
      variant: {
        // Winner / primary highlight
        gold: 'border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm',
        // Red brand badge (Paper LIVE or Red category)
        red: 'border-2 border-outline bg-red-600 text-white shadow-sticker-sm',
        // Live pill (Stage default: white pill + red text)
        live: 'border-2 border-outline bg-white text-red-600 shadow-sticker-sm',
        // Positive delta / status (always paired with + or icon)
        positive:
          'border-2 border-positive bg-positive-soft text-positive-ink',
        // Negative delta / status (always paired with − or icon)
        negative:
          'border-2 border-outline bg-negative text-white',
        // Upcoming / Blue info (2px white halo so it never sits directly on red)
        info: 'border-2 border-blue-600 bg-blue-100 text-blue-800 shadow-[0_0_0_2px_#FFFFFF]',
        upcoming:
          'border-2 border-blue-600 bg-blue-100 text-blue-800 shadow-[0_0_0_2px_#FFFFFF]',
        // Neutral / finished
        muted: 'border border-border-paper bg-paper-2 text-ink',
        neutral: 'border-2 border-outline bg-white text-ink shadow-sticker-sm',
        // White outline sticker badge
        white: 'border-2 border-outline bg-white text-red-900 shadow-sticker-sm',
      },
    },
    defaultVariants: {
      variant: 'gold',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
