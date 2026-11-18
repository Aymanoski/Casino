import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Language } from '@/lib/schemas';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number | string,
  options?: { useArabicIndicDigits?: boolean; sign?: boolean }
): string {
  const num = typeof value === 'string' ? Number(value) : value;
  const prefix = options?.sign && num > 0 ? '+' : '';
  const raw = `${prefix}${value}`;

  if (!options?.useArabicIndicDigits) {
    return raw;
  }

  const arabicIndicMap = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return raw.replace(/\d/g, (digit) => arabicIndicMap[Number(digit)] ?? digit);
}

export function localizeText(
  lang: Language,
  enText: string,
  arText?: string | null
): string {
  if (lang === 'ar' && arText && arText.trim().length > 0) {
    return arText;
  }
  return enText;
}
