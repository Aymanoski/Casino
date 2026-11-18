'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    error?: boolean;
  }
>(({ className, children, error, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex min-h-[44px] h-11 w-full min-w-0 items-center justify-between gap-2 rounded-input border-2 bg-white px-3.5 py-2 text-base leading-normal text-ink data-[placeholder]:text-ink-muted transition-colors duration-150 focus:outline-none focus:ring-[3px] focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>span]:text-start',
      error
        ? 'border-negative focus:ring-negative'
        : 'border-border-paper hover:border-red-900/35 focus:border-blue-500',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-red-700" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-[min(20rem,70dvh)] min-w-[8rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-input border-2 border-outline bg-white text-ink shadow-sticker data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1.5 text-red-700">
        <ChevronUp className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport
        className={cn(
          'p-1.5',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1.5 text-red-700">
        <ChevronDown className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-2.5 py-1.5 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-700',
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex min-h-[44px] w-full cursor-pointer select-none items-center rounded-[8px] py-2.5 ps-9 pe-3 text-base sm:text-sm text-ink outline-none transition-colors focus:bg-blue-100 focus:text-blue-800 data-[state=checked]:bg-paper-2 data-[state=checked]:font-bold data-[state=checked]:text-red-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute start-2.5 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-blue-600" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label?: string;
  helperText?: string;
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: SelectFieldOption[];
  dir?: 'ltr' | 'rtl';
  labelTone?: 'paper' | 'stage';
  className?: string;
}

export function SelectField({
  label,
  helperText,
  error,
  value,
  onValueChange,
  placeholder,
  options,
  dir,
  labelTone = 'paper',
  className,
}: SelectFieldProps) {
  const id = React.useId();
  return (
    <div className={cn('w-full min-w-0 space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal',
            labelTone === 'stage' ? 'text-white' : 'text-ink'
          )}
        >
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onValueChange} dir={dir}>
        <SelectTrigger id={id} error={Boolean(error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p
          role="alert"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-negative"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p
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
