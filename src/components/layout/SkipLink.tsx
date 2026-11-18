'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  const { lang } = useI18n();

  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[100] focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-button focus:border-[2.5px] focus:border-outline focus:bg-gold-400 focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-red-900 focus:shadow-sticker focus:outline-none focus:ring-[3px] focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
    >
      {lang === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
    </a>
  );
}
