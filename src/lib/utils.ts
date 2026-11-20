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
 * Normalizes text for resilient search matching across English, Arabic, and Persian keyboards.
 * - Preserves stored text untouched (caller uses this only for comparison).
 * - Unifies Arabic/Persian Yeh (ي/ى/ی), Kaf (ك/ک), Alef forms (أ/إ/آ -> ا), Teh Marbuta (ة -> ه).
 * - Strips optional Arabic tashkeel diacritics (U+064B–U+065F, U+0670).
 * - Normalizes Eastern Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII.
 * - Preserves Zero-Width Non-Joiner (U+200C) and CJK/emoji characters intact.
 */
export function normalizeSearchText(raw: string | undefined | null): string {
  if (!raw) return '';
  let out = raw.trim().toLowerCase();
  out = out.replace(/[\u064B-\u065F\u0670]/g, '');
  out = out
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه');
  out = out.replace(/[٠-٩]/g, (ch) => String(ARABIC_INDIC_DIGITS.indexOf(ch)));
  out = out.replace(/[۰-۹]/g, (ch) => String(PERSIAN_DIGITS.indexOf(ch)));
  return out;
}

/**
 * Formats large numeric values compactly for fixed-size circular poker chips
 * (e.g. 12500 -> "12.5K", 1200000 -> "1.2M") so extreme numbers never overflow.
 */
export function formatCompactChipNumber(
  value: number,
  useArabicIndicDigits = false
): string {
  const abs = Math.abs(value);
  let raw: string;
  if (abs >= 1_000_000_000) {
    raw = `${Number((abs / 1_000_000_000).toFixed(1))}B`;
  } else if (abs >= 1_000_000) {
    raw = `${Number((abs / 1_000_000).toFixed(1))}M`;
  } else if (abs >= 10_000) {
    raw = `${Number((abs / 1_000).toFixed(1))}K`;
  } else {
    raw = String(abs);
  }
  return formatNumber(raw, { useArabicIndicDigits });
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
