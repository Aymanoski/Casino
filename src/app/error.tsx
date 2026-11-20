'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useI18n();

  return (
    <div className="theme-paper flex min-h-dvh items-center justify-center bg-paper px-safe py-12 text-ink">
      <Card appearance="sticker" className="w-full max-w-lg space-y-5 bg-white text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill border-2 border-outline bg-negative text-white shadow-sticker-sm">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-fluid-2xl text-red-900">
            {lang === 'ar'
              ? 'حدث خطأ غير متوقع في الشاشة'
              : 'Something Went Off-Script'}
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted break-words">
            {error?.message ||
              (lang === 'ar'
                ? 'تعذر عرض هذا القسم مؤقتاً. أعد المحاولة أو عد إلى الصفحة الرئيسية.'
                : 'This view encountered an unexpected error. Retry the view or return to the main stage.')}
          </p>
        </div>

        <div className="flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center justify-center gap-3 pt-1">
          <Button variant="red" size="md" onClick={reset}>
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Try Again'}</span>
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/">
              <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{lang === 'ar' ? 'الصفحة الرئيسية' : 'Back to Pitch Home'}</span>
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
