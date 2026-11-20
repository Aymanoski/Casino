'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-red-900/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    destructive?: boolean;
  }
>(({ className, children, destructive = false, ...props }, ref) => {
  const { lang } = useI18n();
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Bottom sheet on phones (< sm), centered sticker modal on sm+ (AGENTS.md §13 & DESIGN.md §6)
          'fixed inset-x-0 bottom-0 top-auto z-50 grid w-full max-h-[88dvh] overflow-y-auto gap-4 rounded-t-[24px] rounded-b-none border-t-[3px] border-x-[3px] border-b-0 bg-white px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-sticker-lg duration-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          'sm:inset-auto sm:left-[50%] sm:top-[50%] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:max-h-[90dvh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:gap-5 sm:rounded-card sm:border-[3px] sm:p-6 md:p-8 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
          destructive ? 'border-negative' : 'border-outline',
          className
        )}
        {...props}
      >
        {/* Mobile Bottom Sheet Handle Indicator */}
        <span
          className="mx-auto -mt-1.5 mb-0.5 block h-1.5 w-12 rounded-pill bg-red-900/25 sm:hidden"
          aria-hidden="true"
        />

        {/* Top Accent Bar */}
        <span
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-1.5',
            destructive ? 'bg-negative' : 'bg-gold-gradient'
          )}
          aria-hidden="true"
        />

        {children}

        <DialogPrimitive.Close
          aria-label={lang === 'ar' ? 'إغلاق النافذة' : 'Close dialog'}
          className="absolute end-3 top-3.5 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-outline bg-paper text-ink shadow-sticker-sm transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 text-start pe-12', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-border-paper pt-4 [&>*]:w-full sm:[&>*]:w-auto',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'font-display text-fluid-xl leading-tight ltr:tracking-tight rtl:tracking-normal text-red-900 [text-wrap:balance]',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-ink-muted leading-relaxed [text-wrap:pretty]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * ConfirmDialog
 * Per DESIGN.md §6:
 * White surface, maroon sticker outline, concise copy.
 * Destructive confirmations require an explicit confirm button.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent destructive={destructive}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            {destructive && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-negative text-white shadow-sticker-sm" aria-hidden="true">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
            <DialogTitle className={cn(destructive && 'text-negative')}>
              {title}
            </DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="md">
              {cancelLabel}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant={destructive ? 'destructiveSolid' : 'red'}
              size="md"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
