import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  labelTone?: 'paper' | 'stage';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, label, helperText, error, labelTone = 'paper', id, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;

    return (
      <div className="w-full min-w-0 space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal',
              labelTone === 'stage' ? 'text-white' : 'text-ink'
            )}
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
            'flex min-h-[112px] w-full min-w-0 rounded-input border-2 bg-white px-3.5 py-2.5 text-base leading-relaxed text-ink placeholder:text-ink-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-negative focus-visible:border-negative focus-visible:ring-negative'
              : 'border-border-paper hover:border-red-900/35 focus-visible:border-blue-500',
            className
          )}
          {...props}
        />

        {error ? (
          <p
            id={`${textareaId}-error`}
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
            id={`${textareaId}-helper`}
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
Textarea.displayName = 'Textarea';
