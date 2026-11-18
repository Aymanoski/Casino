'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'gold' | 'positive' | 'negative' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  { border: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  gold: {
    border: 'border-border-strong shadow-glow-gold',
    iconColor: 'text-gold-500',
    Icon: Sparkles,
  },
  positive: {
    border: 'border-positive/60 shadow-[0_0_24px_rgba(47,191,143,0.25)]',
    iconColor: 'text-positive',
    Icon: CheckCircle2,
  },
  negative: {
    border: 'border-negative/65 shadow-[0_0_24px_rgba(214,51,76,0.28)]',
    iconColor: 'text-negative',
    Icon: AlertCircle,
  },
  info: {
    border: 'border-info/60 shadow-[0_0_24px_rgba(91,140,255,0.25)]',
    iconColor: 'text-info',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const durationMs = item.durationMs ?? 4200;
      const next: ToastItem = {
        id,
        variant: 'gold',
        ...item,
      };
      setToasts((prev) => [...prev.slice(-3), next]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }

      return id;
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ toasts, toast, dismissToast }),
    [toasts, toast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Viewport */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((item) => {
            const v = VARIANT_STYLES[item.variant ?? 'gold'];
            const Icon = v.Icon;
            return (
              <motion.div
                key={item.id}
                layout={!prefersReducedMotion}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 16, scale: 0.96 }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, scale: 1 }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={cn(
                  'pointer-events-auto relative flex items-start gap-3 rounded-card border bg-surface p-4 text-ivory shadow-card-inner',
                  v.border
                )}
              >
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', v.iconColor)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ivory">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-text-muted leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(item.id)}
                  aria-label="Dismiss notification"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-text-muted hover:bg-surface-2 hover:text-ivory"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
