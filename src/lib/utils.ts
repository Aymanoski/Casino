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

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Normalizes Eastern Arabic-Indic (٠-٩), Persian (۰-۹), and Unicode minus/plus
 * characters to ASCII so Arabic-keyboard numeric input works seamlessly.
 */
export function normalizeNumericInput(raw: string): string {
  let out = raw.trim();
  out = out.replace(/[−–—﹣－]/g, '-').replace(/[＋﹢]/g, '+');
  out = out.replace(/[٠-٩]/g, (ch) => String(ARABIC_INDIC_DIGITS.indexOf(ch)));
  out = out.replace(/[۰-۹]/g, (ch) => String(PERSIAN_DIGITS.indexOf(ch)));
  return out;
}

export type ParsedSignedIntResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'zero' | 'range' };

/**
 * Strictly validates a signed integer input (supports Arabic-Indic & Persian digits,
 * rejects decimals, trailing letters, zero when disallowed, and out-of-range spikes).
 */
export function parseSignedIntegerInput(
  raw: string,
  options?: { min?: number; max?: number; allowZero?: boolean }
): ParsedSignedIntResult {
  const min = options?.min ?? -10000;
  const max = options?.max ?? 10000;
  const allowZero = options?.allowZero ?? false;

  const normalized = normalizeNumericInput(raw);
  if (!normalized) {
    return { ok: false, reason: 'empty' };
  }
  if (!/^[+-]?\d+$/.test(normalized)) {
    return { ok: false, reason: 'invalid' };
  }
  const value = Number(normalized);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, reason: 'range' };
  }
  if (!allowZero && value === 0) {
    return { ok: false, reason: 'zero' };
  }
  if (value < min || value > max) {
    return { ok: false, reason: 'range' };
  }
  return { ok: true, value };
}

/**
 * Proper Arabic count pluralization (singular, dual, 3-10 plural, 11+ singular accusative).
 */
export function formatArabicCount(
  count: number,
  forms: { zero?: string; one: string; two: string; few: string; many: string },
  useArabicIndicDigits = false
): string {
  const abs = Math.abs(count);
  const numStr = formatNumber(count, { useArabicIndicDigits });
  if (abs === 0 && forms.zero) return forms.zero;
  if (abs === 1) return forms.one;
  if (abs === 2) return forms.two;
  const mod100 = abs % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${numStr} ${forms.few}`;
  return `${numStr} ${forms.many}`;
}
