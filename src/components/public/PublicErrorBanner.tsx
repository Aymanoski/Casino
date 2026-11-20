'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PublicErrorBannerProps {
  message?: string;
  onRetry: () => void;
  className?: string;
}

export function PublicErrorBanner({
  message,
  onRetry,
  className,
}: PublicErrorBannerProps) {
  const { lang } = useI18n();

  return (
    <div
      role="alert"
      className={cn(
        'mx-auto max-w-2xl rounded-card border-[2.5px] border-negative bg-white p-6 text-ink shadow-sticker',
        className
      )}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border-2 border-outline bg-negative text-white shadow-sticker-sm">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-xl text-red-900">
              {lang === 'ar'
                ? 'تعذّر تحميل بيانات البطولة'
                : 'Unable to load tournament data'}
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              {message ||
                (lang === 'ar'
                  ? 'حدث خطأ غير متوقع أثناء قراءة السجلات المحلية. حاول إعادة التحميل الآن.'
                  : 'An unexpected error occurred while reading the local tournament records. Retry to refresh the view.')}
            </p>
          </div>
        </div>

        <Button
          variant="red"
          size="md"
          onClick={onRetry}
          className="shrink-0 w-full sm:w-auto"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
        </Button>
      </div>
    </div>
  );
}
