import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary:
          'bg-gold-gradient text-bg font-semibold shadow-glow-gold hover:-translate-y-0.5 hover:brightness-105',
        secondary:
          'border border-border-strong bg-transparent text-ivory hover:bg-gold-500/10 hover:border-gold-500 hover:-translate-y-0.5',
        surface:
          'border border-border bg-surface text-ivory hover:bg-surface-2 hover:border-border-strong',
        destructive:
          'border border-negative/60 bg-negative/10 text-negative hover:bg-negative hover:text-ivory',
        ghost:
          'text-text-muted hover:text-ivory hover:bg-surface/60',
      },
      size: {
        sm: 'h-9 px-3.5 text-xs',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
        scorer: 'min-h-[56px] px-6 text-base font-semibold',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
