import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

/**
 * Input
 * Per DESIGN.md §4 & §6:
 * surface-2 background, 12px radius (rounded-input), gold focus border,
 * clear labels, inline validation in casino ruby (--negative), helper text in muted.
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
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-gold-300"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {startIcon && (
            <span className="pointer-events-none absolute start-3.5 flex items-center text-text-muted">
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
              'flex h-11 w-full rounded-input border bg-surface-2 px-3.5 py-2 text-sm text-ivory placeholder:text-text-faint transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-negative focus-visible:border-negative focus-visible:ring-negative'
                : 'border-border hover:border-border-strong focus-visible:border-gold-500',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              className
            )}
            {...props}
          />

          {endIcon && (
            <span className="absolute end-3.5 flex items-center text-text-muted">
              {endIcon}
            </span>
          )}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs font-medium text-negative"
          >
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
