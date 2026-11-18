import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;

    return (
      <div className="w-full min-w-0 space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold uppercase tracking-wider text-gold-300"
          >
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : helperText
                ? `${textareaId}-helper`
                : undefined
          }
          className={cn(
            'flex min-h-[112px] w-full min-w-0 rounded-input border bg-surface-2 px-3.5 py-2.5 text-base leading-relaxed text-ivory placeholder:text-text-faint transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-negative focus-visible:border-negative focus-visible:ring-negative'
              : 'border-border hover:border-border-strong focus-visible:border-gold-500',
            className
          )}
          {...props}
        />

        {error ? (
          <p
            id={`${textareaId}-error`}
            role="alert"
            className="text-xs font-medium text-negative"
          >
            {error}
          </p>
        ) : helperText ? (
          <p id={`${textareaId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
