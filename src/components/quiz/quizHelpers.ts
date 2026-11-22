import type {
  Language,
  QuizCategory,
  QuizDifficulty,
  QuizIntegritySignalType,
  QuizVerificationChannel,
} from '@/lib/schemas';
import type { DerivedQualificationStatus, QuizWindowStatus } from '@/lib/engine';

export const QUIZ_SESSION_STORAGE_KEY = 'casino_quiz_applicant_session_v1';
export const QUIZ_MOUNT_MARKER_PREFIX = 'casino_quiz_attempt_mounted_';

export interface StoredApplicantSession {
  applicantId: string;
  updatedAt: string;
}

export function readStoredApplicantSession(): StoredApplicantSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredApplicantSession>;
    if (typeof parsed.applicantId === 'string' && parsed.applicantId.length > 0) {
      return {
        applicantId: parsed.applicantId,
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredApplicantSession(applicantId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredApplicantSession = {
      applicantId,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredApplicantSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const QUIZ_CATEGORY_LABELS: Record<
  QuizCategory,
  { en: string; ar: string; badgeVariant: 'gold' | 'info' | 'neutral' | 'positive' }
> = {
  general: {
    en: 'General Knowledge',
    ar: 'معلومات عامة',
    badgeVariant: 'info',
  },
  egyptian_cinema: {
    en: 'Egyptian Cinema & Series',
    ar: 'سينما ودراما مصرية',
    badgeVariant: 'gold',
  },
  music: {
    en: 'Music & Songs',
    ar: 'موسيقى وأغاني',
    badgeVariant: 'neutral',
  },
  wordplay_logic: {
    en: 'Wordplay & Logic',
    ar: 'ألغاز ومنطق سريع',
    badgeVariant: 'positive',
  },
};

export const QUIZ_DIFFICULTY_LABELS: Record<
  QuizDifficulty,
  { en: string; ar: string }
> = {
  easy: { en: 'Easy', ar: 'سهل' },
  medium: { en: 'Medium', ar: 'متوسط' },
  hard: { en: 'Hard', ar: 'صعب' },
};

export const QUIZ_VERIFICATION_CHANNEL_COPY: Record<
  QuizVerificationChannel,
  { labelEn: string; labelAr: string; promptEn: string; promptAr: string }
> = {
  whatsapp_or_sms: {
    labelEn: 'WhatsApp or SMS',
    labelAr: 'واتساب أو رسالة SMS',
    promptEn: 'We sent a 6-digit verification code via WhatsApp / SMS to',
    promptAr: 'أرسلنا رمز التحقق المكوّن من ٦ أرقام عبر واتساب أو رسالة SMS إلى',
  },
  whatsapp: {
    labelEn: 'WhatsApp',
    labelAr: 'واتساب',
    promptEn: 'We sent a 6-digit verification code to your WhatsApp number',
    promptAr: 'أرسلنا رمز التحقق المكوّن من ٦ أرقام إلى رقم واتساب الخاص بك',
  },
  sms: {
    labelEn: 'SMS',
    labelAr: 'رسالة نصية SMS',
    promptEn: 'We sent a 6-digit verification SMS to',
    promptAr: 'أرسلنا رمز التحقق في رسالة نصية SMS إلى',
  },
  email: {
    labelEn: 'Email',
    labelAr: 'البريد الإلكتروني',
    promptEn: 'We sent a 6-digit verification code to your email',
    promptAr: 'أرسلنا رمز التحقق المكوّن من ٦ أرقام إلى بريدك الإلكتروني',
  },
};

export const QUIZ_SIGNAL_LABELS: Record<
  QuizIntegritySignalType,
  { en: string; ar: string }
> = {
  visibility_hidden: {
    en: 'Left tab / window',
    ar: 'مغادرة التبويب / النافذة',
  },
  page_refresh: {
    en: 'Page refresh mid-attempt',
    ar: 'إعادة تحميل الصفحة أثناء الاختبار',
  },
  copy_attempt: {
    en: 'Copy / context-menu attempt',
    ar: 'محاولة نسخ أثناء السؤال',
  },
};

export function getQuizStatusBadge(
  status: DerivedQualificationStatus,
  lang: Language
): {
  label: string;
  variant: 'positive' | 'gold' | 'info' | 'negative' | 'neutral';
} {
  switch (status) {
    case 'qualified':
      return {
        label: lang === 'ar' ? 'متأهل للبطولة' : 'Qualified',
        variant: 'positive',
      };
    case 'waitlisted':
      return {
        label: lang === 'ar' ? 'قائمة الانتظار' : 'Waitlisted',
        variant: 'neutral',
      };
    case 'in_progress':
      return {
        label: lang === 'ar' ? 'قيد الحل' : 'In Progress',
        variant: 'info',
      };
    case 'abandoned':
      return {
        label: lang === 'ar' ? 'غير مكتمل' : 'Incomplete',
        variant: 'negative',
      };
    default:
      return {
        label: lang === 'ar' ? 'لم يبدأ' : 'Not Started',
        variant: 'neutral',
      };
  }
}

export function getWindowStatusCopy(
  status: QuizWindowStatus,
  lang: Language
): {
  label: string;
  tone: 'positive' | 'info' | 'negative';
} {
  if (status === 'open') {
    return {
      label: lang === 'ar' ? 'باب الاختبار مفتوح الآن' : 'Quiz Window Open Now',
      tone: 'positive',
    };
  }
  if (status === 'upcoming') {
    return {
      label: lang === 'ar' ? 'يفتح قريباً' : 'Opens Soon',
      tone: 'info',
    };
  }
  return {
    label: lang === 'ar' ? 'أُغلق باب الاختبار' : 'Quiz Window Closed',
    tone: 'negative',
  };
}

/**
 * Formats total response time cleanly with tenths of a second (e.g. "01:24.3" or "42.7s").
 */
export function formatResponseTimeMs(ms: number, lang: Language): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSec = safeMs / 1000;
  if (totalSec >= 60) {
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1).padStart(4, '0');
    return lang === 'ar' ? `${mins}د ${secs}ث` : `${mins}m ${secs}s`;
  }
  return lang === 'ar' ? `${totalSec.toFixed(1)} ث` : `${totalSec.toFixed(1)}s`;
}

/**
 * Formats a window countdown cleanly into Days / Hours / Mins / Secs.
 */
export function formatWindowRemaining(ms: number, lang: Language): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (lang === 'ar') {
    if (days > 0) return `${days} يوم · ${hours} ساعة · ${mins} دقيقة`;
    if (hours > 0) return `${hours} ساعة · ${mins} دقيقة · ${secs} ث`;
    return `${mins} دقيقة · ${secs} ثانية`;
  }
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function formatQuizTimestamp(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}
