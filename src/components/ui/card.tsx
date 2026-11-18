import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  premium?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, premium = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-card border bg-surface p-6 md:p-8 shadow-card-inner transition-all duration-200',
        premium
          ? 'border-border-strong shadow-glow-gold'
          : 'border-border hover:border-border-strong',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';
