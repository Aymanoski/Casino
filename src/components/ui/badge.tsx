import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        gold: 'border border-border-strong bg-gold-500/15 text-gold-300',
        live: 'border border-live/50 bg-live/15 text-live font-semibold',
        positive: 'border border-positive/40 bg-positive/15 text-positive',
        negative: 'border border-negative/40 bg-negative/15 text-negative',
        info: 'border border-info/40 bg-info/15 text-info',
        muted: 'border border-border bg-surface-2 text-text-muted',
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
