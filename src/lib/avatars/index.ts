import { AVATAR_LIBRARY_KEYS } from '@/lib/schemas';

export type AvatarLibraryKey = (typeof AVATAR_LIBRARY_KEYS)[number];

export interface Avatar3DDefinition {
  key: AvatarLibraryKey;
  number: number;
  nameEn: string;
  nameAr: string;
  backdropFrom: string;
  backdropVia: string;
  backdropTo: string;
  accentColor: string;
}

/**
 * 24 Original In-House 3D-Styled Game-Show & Ramadan Avatars (CC0 / MIT Project-Original)
 * - Consistent 3D studio lighting rig: top-left specular highlight, rim glow, and deep maroon grounding shadow
 * - Soft colored backdrops strictly derived from DESIGN.md palette tokens
 * - Zero real-person or celebrity likenesses (AGENTS.md §10 & §15.3)
 */
export const AVATAR_3D_LIBRARY: readonly Avatar3DDefinition[] = [
  {
    key: 'avatar-01',
    number: 1,
    nameEn: 'Golden Studio Mic',
    nameAr: 'ميكروفون الاستوديو الذهبي',
    backdropFrom: '#C4163A',
    backdropVia: '#A81233',
    backdropTo: '#4F0716',
    accentColor: '#FFD54A',
  },
  {
    key: 'avatar-02',
    number: 2,
    nameEn: 'Crimson Buzzer Dome',
    nameAr: 'قبة الجرس الحمراء',
    backdropFrom: '#FFE899',
    backdropVia: '#FFC12B',
    backdropTo: '#E8740C',
    accentColor: '#C4163A',
  },
  {
    key: 'avatar-03',
    number: 3,
    nameEn: 'Royal Ramadan Fanous',
    nameAr: 'فانوس رمضان الملكي',
    backdropFrom: '#7E0D26',
    backdropVia: '#4F0716',
    backdropTo: '#2A0A10',
    accentColor: '#FFC12B',
  },
  {
    key: 'avatar-04',
    number: 4,
    nameEn: 'Lucky Six 3D Die',
    nameAr: 'نرد الحظ الثلاثي',
    backdropFrom: '#2F6BFF',
    backdropVia: '#1F4FD8',
    backdropTo: '#14327F',
    accentColor: '#FFE899',
  },
  {
    key: 'avatar-05',
    number: 5,
    nameEn: 'Broadcast Headphones',
    nameAr: 'سماعة البث المباشر',
    backdropFrom: '#E5405C',
    backdropVia: '#C4163A',
    backdropTo: '#7E0D26',
    accentColor: '#FFFFFF',
  },
  {
    key: 'avatar-06',
    number: 6,
    nameEn: 'Golden Crescent & Star',
    nameAr: 'هلال ونجمة الذهب',
    backdropFrom: '#1F4FD8',
    backdropVia: '#14327F',
    backdropTo: '#2A0A10',
    accentColor: '#FFD54A',
  },
  {
    key: 'avatar-07',
    number: 7,
    nameEn: 'Champion Trophy Cup',
    nameAr: 'كأس البطولة الذهبي',
    backdropFrom: '#A81233',
    backdropVia: '#7E0D26',
    backdropTo: '#4F0716',
    accentColor: '#FFC12B',
  },
  {
    key: 'avatar-08',
    number: 8,
    nameEn: 'Royal Spade Emblem',
    nameAr: 'شعار البستوني الملكي',
    backdropFrom: '#FFD54A',
    backdropVia: '#FF9F1C',
    backdropTo: '#E8740C',
    accentColor: '#4F0716',
  },
  {
    key: 'avatar-09',
    number: 9,
    nameEn: 'Cinema Clapboard',
    nameAr: 'كلاكيت السينما',
    backdropFrom: '#C4163A',
    backdropVia: '#7E0D26',
    backdropTo: '#4F0716',
    accentColor: '#FFE899',
  },
  {
    key: 'avatar-10',
    number: 10,
    nameEn: 'Electric Trivia Bolt',
    nameAr: 'صاعقة السرعة',
    backdropFrom: '#7FA8FF',
    backdropVia: '#2F6BFF',
    backdropTo: '#14327F',
    accentColor: '#FFD54A',
  },
  {
    key: 'avatar-11',
    number: 11,
    nameEn: 'VIP Casino Chip',
    nameAr: 'فيشة الكازينو الذهبية',
    backdropFrom: '#7E0D26',
    backdropVia: '#4F0716',
    backdropTo: '#2A0A10',
    accentColor: '#FF9F1C',
  },
  {
    key: 'avatar-12',
    number: 12,
    nameEn: 'Comedy Stage Crown',
    nameAr: 'تاج المسرح الكوميدي',
    backdropFrom: '#E5405C',
    backdropVia: '#A81233',
    backdropTo: '#4F0716',
    accentColor: '#FFD54A',
  },
  {
    key: 'avatar-13',
    number: 13,
    nameEn: 'Golden Falcon Crest',
    nameAr: 'شعار الصقر الذهبي',
    backdropFrom: '#4F0716',
    backdropVia: '#7E0D26',
    backdropTo: '#A81233',
    accentColor: '#FFC12B',
  },
  {
    key: 'avatar-14',
    number: 14,
    nameEn: 'Clever Fox Mask',
    nameAr: 'قناع الثعلب الذكي',
    backdropFrom: '#FF9F1C',
    backdropVia: '#E8740C',
    backdropTo: '#7E0D26',
    accentColor: '#FFF9F0',
  },
  {
    key: 'avatar-15',
    number: 15,
    nameEn: 'Nile Lotus Jewel',
    nameAr: 'جوهرة لوتس النيل',
    backdropFrom: '#2F6BFF',
    backdropVia: '#1F4FD8',
    backdropTo: '#14327F',
    accentColor: '#FFD54A',
  },
  {
    key: 'avatar-16',
    number: 16,
    nameEn: 'Gold Vinyl Turntable',
    nameAr: 'أسطوانة الموسيقى الذهبية',
    backdropFrom: '#A81233',
    backdropVia: '#4F0716',
    backdropTo: '#2A0A10',
    accentColor: '#FFC12B',
  },
  {
    key: 'avatar-17',
    number: 17,
    nameEn: 'Sudden-Death Stopwatch',
    nameAr: 'ساعة الحسم السريعة',
    backdropFrom: '#C4163A',
    backdropVia: '#A81233',
    backdropTo: '#4F0716',
    accentColor: '#FFFFFF',
  },
  {
    key: 'avatar-18',
    number: 18,
    nameEn: 'Showtime Starburst',
    nameAr: 'نجمة الأضواء الساطعة',
    backdropFrom: '#7E0D26',
    backdropVia: '#C4163A',
    backdropTo: '#4F0716',
    accentColor: '#FFE899',
  },
  {
    key: 'avatar-19',
    number: 19,
    nameEn: 'Mystery Trivia Cube',
    nameAr: 'مكعب الأسرار الثلاثي',
    backdropFrom: '#1F4FD8',
    backdropVia: '#14327F',
    backdropTo: '#4F0716',
    accentColor: '#FFC12B',
  },
  {
    key: 'avatar-20',
    number: 20,
    nameEn: 'Golden Ramadan Dallah',
    nameAr: 'دلة الضيافة الذهبية',
    backdropFrom: '#A81233',
    backdropVia: '#7E0D26',
    backdropTo: '#4F0716',
    accentColor: '#FFD54A',
  },
  {
    key: 'avatar-21',
    number: 21,
    nameEn: 'Silver Screen Reel',
    nameAr: 'بكرة الشاشة الفضية',
    backdropFrom: '#4F0716',
    backdropVia: '#2A0A10',
    backdropTo: '#7E0D26',
    accentColor: '#FFE899',
  },
  {
    key: 'avatar-22',
    number: 22,
    nameEn: 'Diamond Shield',
    nameAr: 'درع الماس التنافسي',
    backdropFrom: '#2F6BFF',
    backdropVia: '#14327F',
    backdropTo: '#2A0A10',
    accentColor: '#FFFFFF',
  },
  {
    key: 'avatar-23',
    number: 23,
    nameEn: 'Stage Rocket',
    nameAr: 'صاروخ الصدارة',
    backdropFrom: '#C4163A',
    backdropVia: '#E8740C',
    backdropTo: '#7E0D26',
    accentColor: '#FFE899',
  },
  {
    key: 'avatar-24',
    number: 24,
    nameEn: 'Royal Lion Medallion',
    nameAr: 'وسام الأسد الذهبي',
    backdropFrom: '#FFD54A',
    backdropVia: '#FF9F1C',
    backdropTo: '#A81233',
    accentColor: '#4F0716',
  },
] as const;

const AVATAR_BY_KEY = new Map<string, Avatar3DDefinition>(
  AVATAR_3D_LIBRARY.map((item) => [item.key, item])
);

function fnv1aHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministically assigns one of the 24 3D avatars from a player ID, seed number, or explicit key.
 * For `player-N` or numeric seed `N`, maps directly to `(N - 1) % 24` so it aligns 1:1 with `deterministicAvatarKey(seed)`.
 */
export function resolveDeterministicAvatarKey(
  playerIdOrSeed?: string | number | null,
  explicitKey?: string | null
): AvatarLibraryKey {
  if (explicitKey && AVATAR_BY_KEY.has(explicitKey)) {
    return explicitKey as AvatarLibraryKey;
  }
  if (typeof playerIdOrSeed === 'number' && Number.isFinite(playerIdOrSeed)) {
    const idx =
      Math.abs(Math.floor(playerIdOrSeed) - 1) % AVATAR_LIBRARY_KEYS.length;
    return AVATAR_LIBRARY_KEYS[idx];
  }
  if (typeof playerIdOrSeed === 'string' && playerIdOrSeed.trim()) {
    const clean = playerIdOrSeed.trim();
    if (AVATAR_BY_KEY.has(clean)) {
      return clean as AvatarLibraryKey;
    }
    const playerNumMatch = clean.match(/^(?:player|seed)-(\d+)/i);
    if (playerNumMatch) {
      const num = parseInt(playerNumMatch[1], 10);
      if (num > 0) {
        return AVATAR_LIBRARY_KEYS[(num - 1) % AVATAR_LIBRARY_KEYS.length];
      }
    }
    const hash = fnv1aHash(clean);
    return AVATAR_LIBRARY_KEYS[hash % AVATAR_LIBRARY_KEYS.length];
  }
  return 'avatar-01';
}

export function getAvatar3DDefinition(key?: string | null): Avatar3DDefinition {
  const resolved = resolveDeterministicAvatarKey(key, key);
  return AVATAR_BY_KEY.get(resolved) ?? AVATAR_3D_LIBRARY[0];
}
