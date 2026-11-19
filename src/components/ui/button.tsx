import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex max-w-full items-center justify-center gap-2 whitespace-normal text-center leading-snug sm:whitespace-nowrap rounded-button text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Context-aware primary: Gold gradient on Stage / Stage-Dark, Brand Red on Paper
        primary:
          '[background:var(--btn-primary-bg)] text-[color:var(--btn-primary-fg)] border-[2.5px] border-outline shadow-sticker sticker-press',
        // Explicit Stage primary (Gold gradient + maroon outline)
        gold:
          'bg-gold-gradient text-red-900 border-[2.5px] border-outline shadow-sticker sticker-press',
        // Explicit Paper primary (Brand red fill + white text)
        red:
          'bg-red-600 text-white border-[2.5px] border-outline shadow-sticker sticker-press hover:bg-red-700',
        // Secondary: white fill with maroon/red outline
        secondary:
          'bg-white text-[color:var(--btn-secondary-fg)] border-[2.5px] border-[color:var(--btn-secondary-border)] shadow-sticker sticker-press hover:bg-paper',
        // Info / link action: electric blue with white buffer ring so it never touches red directly (blue-600 gives 7.1:1 AA/AAA white text contrast)
        info:
          'bg-blue-600 text-white border-[2.5px] border-white ring-2 ring-outline shadow-sticker sticker-press hover:bg-blue-800',
        // Destructive: deep maroon fill per DESIGN.md §6
        destructive:
          'bg-red-900 text-white border-[2.5px] border-outline shadow-sticker sticker-press hover:bg-negative',
        // Destructive solid confirmation button
        destructiveSolid:
          'bg-negative text-white border-[2.5px] border-outline shadow-sticker sticker-press hover:bg-red-900',
        // Clean white surface sticker button
        surface:
          'bg-white text-ink border-2 border-outline shadow-sticker-sm sticker-press hover:bg-paper',
        // Calm Paper utility button for dense admin tables & toolbars (DESIGN.md §4 & §8)
        calm:
          'bg-white text-ink border border-border-paper hover:bg-paper-2 hover:border-red-900/30 active:bg-paper-2',
        // Subtle ghost button adapting to active surface theme
        ghost:
          'text-[color:var(--theme-fg)] hover:bg-red-900/10 border border-transparent',
      },
      size: {
        sm: 'min-h-[44px] px-4 py-2 text-xs sm:text-sm',
        md: 'min-h-[44px] px-5 py-2.5 text-sm',
        lg: 'min-h-[48px] px-6 py-3 text-base',
        scorer:
          'min-h-[56px] px-5 sm:px-7 py-3.5 text-base md:text-lg font-extrabold tracking-wide',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 p-0',
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
