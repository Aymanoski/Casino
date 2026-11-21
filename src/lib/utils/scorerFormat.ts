import type { Match, Player, ScoreEvent, User } from '@/lib/schemas';
import { formatNumber } from '@/lib/utils';

export type DisciplinaryCardType = 'yellow' | 'red';

const CARD_NOTE_PREFIX_RE =
  /^(?:Yellow card\s*\([−-]1\)|Red card\s*\([−-]2\)|بطاقة صفراء\s*\([−-][1١]\)|بطاقة حمراء\s*\([−-][2٢]\))\s*:?\s*/i;

/**
 * Strips any redundant stored prefix ("Yellow card (−1): ") from a ScoreEvent note
 * so UI components can display the canonical localized label + clean user note once.
 */
export function stripCardNotePrefix(note?: string): string | undefined {
  if (!note) return undefined;
  const cleaned = note.replace(CARD_NOTE_PREFIX_RE, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Canonical bilingual formatting for any ScoreEvent across Scorer Console, Session History,
 * Results Feed, Audit Log, and Player History (AGENTS.md §15.2).
 */
export function formatScoreEventDisplay(
  event: Pick<ScoreEvent, 'kind' | 'delta' | 'note'>,
  lang: 'en' | 'ar',
  useArabicIndicDigits = false
): {
  kindLabel: string;
  userNote?: string;
  fullLine: string;
  cardType: DisciplinaryCardType | null;
} {
  const num = (n: number) => formatNumber(n, { useArabicIndicDigits });

  if (event.kind === 'yellow') {
    const kindLabel =
      lang === 'ar' ? `بطاقة صفراء (−${num(1)})` : 'Yellow card (−1)';
    const userNote = stripCardNotePrefix(event.note);
    return {
      kindLabel,
      userNote,
      fullLine: userNote ? `${kindLabel}: ${userNote}` : kindLabel,
      cardType: 'yellow',
    };
  }

  if (event.kind === 'red') {
    const kindLabel =
      lang === 'ar' ? `بطاقة حمراء (−${num(2)})` : 'Red card (−2)';
    const userNote = stripCardNotePrefix(event.note);
    return {
      kindLabel,
      userNote,
      fullLine: userNote ? `${kindLabel}: ${userNote}` : kindLabel,
      cardType: 'red',
    };
  }

  if (event.kind === 'undo') {
    const signStr =
      event.delta > 0 ? `+${num(event.delta)}` : `−${num(Math.abs(event.delta))}`;
    const kindLabel =
      lang === 'ar' ? `تراجع (${signStr})` : `Undo (${signStr})`;
    const userNote = event.note?.trim() || undefined;
    return {
      kindLabel,
      userNote,
      fullLine: userNote ? `${kindLabel} · ${userNote}` : kindLabel,
      cardType: null,
    };
  }

  const signStr =
    event.delta > 0 ? `+${num(event.delta)}` : `−${num(Math.abs(event.delta))}`;
  const kindLabel =
    lang === 'ar'
      ? event.delta > 0
        ? `نقطة (${signStr})`
        : `خصم نقطة (${signStr})`
      : `${signStr} pt`;
  const userNote = event.note?.trim() || undefined;
  return {
    kindLabel,
    userNote,
    fullLine: userNote ? `${kindLabel} — ${userNote}` : kindLabel,
    cardType: null,
  };
}

/**
 * Helper to detect Yellow/Red card audit actions so Audit Log displays card icons cleanly.
 */
export function getCardTypeFromAuditAction(
  action: string
): DisciplinaryCardType | null {
  if (action === 'score.yellowCard') return 'yellow';
  if (action === 'score.redCard') return 'red';
  return null;
}

/**
 * Role visibility rule (AGENTS.md §15.2 & §15.5):
 * Contact button beside a player is visible ONLY to:
 * - Super Admin
 * - Check-In Staff
 * - The assigned Judge / Scorer for this match
 * Hidden for guest host Marwan Serry and all other roles.
 */
export function canViewPlayerContactForMatch(
  user: Pick<User, 'id' | 'role'> | null,
  match: Pick<Match, 'judgeUserId' | 'scorerUserId'> | null,
  player: Pick<Player, 'isGuest' | 'isHost'> | null
): boolean {
  if (!user || !player || player.isGuest || player.isHost) return false;
  if (user.role === 'superAdmin' || user.role === 'checkIn') return true;
  if (user.role === 'scorer' && match) {
    const assignedId = match.judgeUserId || match.scorerUserId;
    return assignedId === user.id;
  }
  return false;
}
