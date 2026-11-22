'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
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
    accentBg: 'bg-blue-600',
    iconBox: 'bg-blue-600 text-white border-outline',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((handle) => window.clearTimeout(handle));
      timers.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      timersRef.current.delete(id);
    }
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

      if (durationMs > 0 && typeof window !== 'undefined') {
        const handle = window.setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, durationMs);
        timersRef.current.set(id, handle);
      }

      return id;
    },
    []
  );

  // Stable context identity: firing/dismissing a toast never re-renders consumers of useToast()
  const value = useMemo(
    () => ({ toast, dismissToast }),
    [toast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Viewport — docked below header on phones (never covers Scorer Sticky Thumb Dock) and bottom-end on sm+ */}
      <div
        role="region"
        aria-label={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] bottom-auto z-[60] flex w-auto flex-col gap-2.5 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:end-4 sm:w-full sm:max-w-sm"
      >
        {toasts.map((item) => {
          const v = VARIANT_STYLES[item.variant ?? 'gold'];
          const Icon = v.Icon;
          return (
            <div
              key={item.id}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border-[2.5px] border-outline bg-white p-3.5 sm:p-4 text-ink shadow-sticker animate-in fade-in slide-in-from-bottom-3 duration-200 motion-reduce:animate-none"
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
                aria-hidden="true"
              >
                <Icon className="h-4 w-4 shrink-0" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-900 break-words">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-ink-muted leading-relaxed break-words">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label={lang === 'ar' ? 'إغلاق الإشعار' : 'Dismiss notification'}
                className="-m-1 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
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
