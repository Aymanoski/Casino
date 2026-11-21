import type {
  GameStatus,
  Language,
  PlayerStatus,
  RoundStatus,
  SegmentCategory,
  SponsorTier,
  UserRole,
} from '@/lib/schemas';
import type { BadgeProps } from '@/components/ui/badge';

export function formatAdminDateTime(
  iso: string | undefined | null,
  lang: Language,
  useArabicIndicDigits = false
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

export function formatAdminTimeShort(
  iso: string | undefined | null,
  lang: Language,
  useArabicIndicDigits = false
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

export function toDateTimeLocalInput(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocalInput(localStr: string): string {
  if (!localStr) return new Date().toISOString();
  const d = new Date(localStr);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function getPlayerStatusMeta(
  status: PlayerStatus,
  lang: Language
): { label: string; variant: BadgeProps['variant'] } {
  switch (status) {
    case 'checkedIn':
      return {
        label: lang === 'ar' ? 'تم الحضور' : 'Checked In',
        variant: 'positive',
      };
    case 'active':
      return {
        label: lang === 'ar' ? 'نشط بالبطولة' : 'Active',
        variant: 'info',
      };
    case 'finalist':
      return {
        label: lang === 'ar' ? 'متأهل للنهائي' : 'Finalist',
        variant: 'gold',
      };
    case 'absent':
      return {
        label: lang === 'ar' ? 'غائب' : 'Absent',
        variant: 'negative',
      };
    case 'eliminated':
      return {
        label: lang === 'ar' ? 'خرج من المنافسة' : 'Eliminated',
        variant: 'muted',
      };
    case 'registered':
    default:
      return {
        label: lang === 'ar' ? 'مسجّل' : 'Registered',
        variant: 'white',
      };
  }
}

export function getGameStatusMeta(
  status: GameStatus,
  lang: Language
): { label: string; variant: BadgeProps['variant'] } {
  switch (status) {
    case 'live':
      return {
        label: lang === 'ar' ? 'مباشر' : 'LIVE',
        variant: 'red',
      };
    case 'needsTieBreak':
      return {
        label: lang === 'ar' ? 'جولة حسم' : 'Tie-Break',
        variant: 'gold',
      };
    case 'needsReview':
      return {
        label: lang === 'ar' ? 'تحتاج مراجعة' : 'Needs Review',
        variant: 'negative',
      };
    case 'void':
      return {
        label: lang === 'ar' ? 'ملغاة (غياب)' : 'Void',
        variant: 'muted',
      };
    case 'finished':
      return {
        label: lang === 'ar' ? 'منتهية' : 'Finished',
        variant: 'muted',
      };
    case 'scheduled':
    default:
      return {
        label: lang === 'ar' ? 'مجدولة' : 'Scheduled',
        variant: 'info',
      };
  }
}

export function getRoundStatusMeta(
  status: RoundStatus,
  lang: Language
): { label: string; variant: BadgeProps['variant'] } {
  switch (status) {
    case 'live':
      return { label: lang === 'ar' ? 'جارية' : 'Live', variant: 'red' };
    case 'done':
      return { label: lang === 'ar' ? 'مكتملة' : 'Done', variant: 'muted' };
    case 'upcoming':
    default:
      return { label: lang === 'ar' ? 'قادمة' : 'Upcoming', variant: 'info' };
  }
}

export function getSegmentCategoryMeta(
  category: SegmentCategory,
  lang: Language
): { label: string; variant: BadgeProps['variant'] } {
  switch (category) {
    case 'music':
      return {
        label: lang === 'ar' ? 'موسيقى وغناء' : 'Music & Singing',
        variant: 'red',
      };
    case 'wordplay':
      return {
        label: lang === 'ar' ? 'ألعاب كلمات وسرعة' : 'Wordplay & Speed',
        variant: 'gold',
      };
    case 'popculture':
      return {
        label: lang === 'ar' ? 'سينما وثقافة فنية' : 'Cinema & Pop Culture',
        variant: 'info',
      };
    case 'special':
      return {
        label: lang === 'ar' ? 'جولة خاصة / حسم' : 'Special / Tie-Breaker',
        variant: 'negative',
      };
    case 'general':
    default:
      return {
        label: lang === 'ar' ? 'معلومات عامة' : 'General Knowledge',
        variant: 'white',
      };
  }
}

export function getSponsorTierMeta(
  tier: SponsorTier,
  lang: Language
): { label: string; variant: BadgeProps['variant'] } {
  switch (tier) {
    case 'presenting':
      return {
        label: lang === 'ar' ? 'الراعي الرسمي الرئيسي' : 'Presenting Partner',
        variant: 'gold',
      };
    case 'finalNight':
      return {
        label: lang === 'ar' ? 'شريك ليلة النهائي' : 'Final Night Partner',
        variant: 'red',
      };
    case 'segment':
      return {
        label: lang === 'ar' ? 'راعي الفقرات' : 'Segment Partner',
        variant: 'info',
      };
    case 'community':
    default:
      return {
        label: lang === 'ar' ? 'شريك المجتمع' : 'Community Partner',
        variant: 'white',
      };
  }
}

export function getRoleBadgeVariant(role: UserRole): BadgeProps['variant'] {
  switch (role) {
    case 'superAdmin':
      return 'gold';
    case 'scorer':
      return 'red';
    case 'checkIn':
      return 'positive';
    case 'content':
      return 'info';
    case 'player':
    default:
      return 'muted';
  }
}
