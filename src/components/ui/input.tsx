import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  /** Label color mode if placed directly on dark/stage surface */
  labelTone?: 'paper' | 'stage';
}

/**
 * Input
 * Per DESIGN.md §4 & §6:
 * - Crisp white fill, 12px radius (rounded-input), 2px --border-paper that turns electric blue on focus
 * - Minimum 16px font size (text-base) to prevent iOS Safari auto-zoom
 * - Minimum 44px touch height
 * - Inline validation in --negative with AlertCircle icon (never color alone)
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      helperText,
      error,
      startIcon,
      endIcon,
      labelTone = 'paper',
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full min-w-0 space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal',
              labelTone === 'stage' ? 'text-white' : 'text-ink'
            )}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {startIcon && (
            <span className="pointer-events-none absolute start-3.5 flex items-center text-ink-muted">
              {startIcon}
            </span>
          )}

          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            className={cn(
              'flex min-h-[44px] h-11 w-full min-w-0 rounded-input border-2 bg-white px-3.5 py-2 text-base leading-normal text-ink placeholder:text-ink-faint transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-negative focus-visible:border-negative focus-visible:ring-negative'
                : 'border-border-paper hover:border-red-900/35 focus-visible:border-blue-500',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              className
            )}
            {...props}
          />

          {endIcon && (
            <span className="absolute end-3.5 flex items-center text-ink-muted">
              {endIcon}
            </span>
          )}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-bold',
              labelTone === 'stage'
                ? 'rounded-pill bg-white px-2.5 py-0.5 text-negative'
                : 'text-negative'
            )}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p
            id={`${inputId}-helper`}
            className={cn(
              'text-xs',
              labelTone === 'stage' ? 'text-white/90' : 'text-ink-muted'
            )}
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
