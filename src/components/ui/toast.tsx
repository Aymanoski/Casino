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
  {
    accentBg: string;
    iconBox: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  gold: {
    accentBg: 'bg-gold-gradient',
    iconBox: 'bg-gold-400 text-red-900 border-outline',
    Icon: Sparkles,
  },
  positive: {
    accentBg: 'bg-positive',
    iconBox: 'bg-positive-soft text-positive-ink border-positive',
    Icon: CheckCircle2,
  },
  negative: {
    accentBg: 'bg-negative',
    iconBox: 'bg-negative text-white border-outline',
    Icon: AlertCircle,
  },
  info: {
    accentBg: 'bg-blue-500',
    iconBox: 'bg-blue-500 text-white border-outline',
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
      {/* Toast Viewport — clears mobile bottom bar & safe-area inset */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex w-auto flex-col gap-2.5 sm:inset-x-auto sm:bottom-4 sm:end-4 sm:w-full sm:max-w-sm"
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
                className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border-[2.5px] border-outline bg-white p-3.5 sm:p-4 text-ink shadow-sticker"
              >
                <span
                  className={cn('absolute inset-y-0 start-0 w-1.5', v.accentBg)}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'ms-1 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border-2',
                    v.iconBox
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-red-900">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(item.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                >
                  <X className="h-4 w-4" />
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
