import type React from 'react';
import {
  Clapperboard,
  Globe,
  Music,
  Sparkles,
  Zap,
} from 'lucide-react';
import type {
  Language,
  Player,
  ScoreEvent,
  SegmentCategory,
} from '@/lib/schemas';
import type { BadgeProps } from '@/components/ui/badge';
import { localizeText } from '@/lib/utils';

export function formatPublicDateTime(
  iso: string | undefined | null,
  lang: Language,
  useArabicIndicDigits = false
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

export function formatPublicFullDateTime(
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

export function formatPublicTimeOnly(
  iso: string | undefined | null,
  lang: Language,
  useArabicIndicDigits = false
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

export function getLocalDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatPublicDayHeading(
  iso: string,
  lang: Language,
  useArabicIndicDigits = false
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    numberingSystem: useArabicIndicDigits ? 'arab' : 'latn',
  }).format(d);
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  reached: boolean;
}

export function computeCountdown(
  targetIso: string,
  nowMs: number
): CountdownParts {
  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, reached: false };
  }
  const diff = Math.max(0, targetMs - nowMs);
  if (diff === 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, reached: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    reached: false,
  };
}

export interface SegmentCategoryInfo {
  labelEn: string;
  labelAr: string;
  badgeVariant: BadgeProps['variant'];
  Icon: React.ComponentType<{ className?: string }>;
}

export const SEGMENT_CATEGORY_INFO: Record<
  SegmentCategory,
  SegmentCategoryInfo
> = {
  music: {
    labelEn: 'Music & Singing',
    labelAr: 'موسيقى وغناء',
    badgeVariant: 'red',
    Icon: Music,
  },
  wordplay: {
    labelEn: 'Wordplay & Speed',
    labelAr: 'ألعاب كلمات وسرعة',
    badgeVariant: 'info',
    Icon: Zap,
  },
  popculture: {
    labelEn: 'Cinema & Pop Culture',
    labelAr: 'سينما وثقافة شعبية',
    badgeVariant: 'gold',
    Icon: Clapperboard,
  },
  general: {
    labelEn: 'General Knowledge',
    labelAr: 'معلومات عامة',
    badgeVariant: 'neutral',
    Icon: Globe,
  },
  special: {
    labelEn: 'Special & Tie-Breaker',
    labelAr: 'فقرات خاصة وحاسمة',
    badgeVariant: 'positive',
    Icon: Sparkles,
  },
};

export interface ResolvedPlayerDisplay {
  id: string;
  name: string;
  nickname?: string;
  avatarSeed: string;
  isHost: boolean;
  isPlaceholder: boolean;
  player: Player | null;
}

export function resolvePlayerDisplay(
  playerId: string,
  playerMap: Map<string, Player>,
  lang: Language,
  slotIndex = 0
): ResolvedPlayerDisplay {
  const found = playerMap.get(playerId) ?? null;
  if (found) {
    return {
      id: found.id,
      name: localizeText(lang, found.fullName, found.fullNameAr),
      nickname: localizeText(lang, found.nickname, found.nicknameAr),
      avatarSeed: found.avatarSeed,
      isHost: Boolean(found.isHost),
      isPlaceholder: false,
      player: found,
    };
  }

  const isFinalTbd = playerId.includes('final');
  return {
    id: playerId,
    name: isFinalTbd
      ? lang === 'ar'
        ? `المتأهل النهائي #${slotIndex + 1}`
        : `Finalist #${slotIndex + 1}`
      : lang === 'ar'
        ? `مقعد تأهل #${slotIndex + 1}`
        : `Qualifier Seat #${slotIndex + 1}`,
    nickname: undefined,
    avatarSeed: playerId,
    isHost: false,
    isPlaceholder: true,
    player: null,
  };
}

export function computeGameTotalsFromEvents(
  gameId: string,
  playerIds: string[],
  events: ScoreEvent[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const pid of playerIds) {
    totals[pid] = 0;
  }
  for (const ev of events) {
    if (ev.gameId === gameId) {
      totals[ev.playerId] = (totals[ev.playerId] ?? 0) + ev.delta;
    }
  }
  return totals;
}
