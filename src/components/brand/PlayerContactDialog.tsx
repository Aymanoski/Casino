'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { playerRepo } from '@/lib/repos';
import type { Player, PlayerContact } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';
import { canViewPlayerContactForMatch } from '@/lib/utils/scorerFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { PlayerAvatar } from './PlayerAvatar';

export { canViewPlayerContactForMatch };

/**
 * Round phone trigger button rendered beside a player (DESIGN.md §6).
 * Enforces >= 44px touch target & explicit screen-reader label.
 */
export function ContactIconButton({
  playerName,
  onClick,
  surface = 'dark',
  className,
}: {
  playerName: string;
  onClick: () => void;
  surface?: 'dark' | 'light';
  className?: string;
}) {
  const { lang } = useI18n();
  const label =
    lang === 'ar'
      ? `عرض بيانات التواصل مع ${playerName}`
      : `Contact ${playerName}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill border-2 border-outline shadow-sticker-sm sticker-press transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        surface === 'dark'
          ? 'bg-white text-blue-600 hover:bg-blue-100'
          : 'bg-blue-100 text-blue-800 hover:bg-blue-600 hover:text-white',
        className
      )}
    >
      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
    </button>
  );
}

function buildWhatsAppUrl(whatsapp: string, playerName: string, lang: 'en' | 'ar'): string {
  const digits = whatsapp.replace(/[^\d]/g, '');
  const message =
    lang === 'ar'
      ? `مرحباً ${playerName}، ننتظرك على طاولة بطولة كازينو الألعاب الآن.`
      : `Hi ${playerName}, your table at Casino El Al3ab is ready now!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function buildTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export interface PlayerContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  actorUserId: string | null | undefined;
  matchId?: string;
  tableLabel?: string;
}

/**
 * Role-gated sticker Contact Dialog (DESIGN.md §6 & AGENTS.md §15.2).
 * Fetches contact strictly through `playerRepo.getContactForActor`, which enforces
 * repository-level RBAC and logs a light `contact.viewed` audit entry.
 */
export function PlayerContactDialog({
  open,
  onOpenChange,
  player,
  actorUserId,
  matchId,
  tableLabel,
}: PlayerContactDialogProps) {
  const { lang } = useI18n();
  const { toast } = useToast();

  const [contact, setContact] = useState<PlayerContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'phone' | 'whatsapp' | 'email' | null>(
    null
  );

  useEffect(() => {
    if (!open || !player || !actorUserId) {
      setContact(null);
      setError(null);
      setCopiedField(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    playerRepo
      .getContactForActor(player.id, actorUserId, matchId)
      .then((res) => {
        if (cancelled) return;
        setContact(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
              ? 'ليس لديك صلاحية عرض بيانات التواصل لهذا اللاعب.'
              : 'You do not have permission to view this player’s contact details.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, player, actorUserId, matchId, lang]);

  const handleCopy = useCallback(
    async (field: 'phone' | 'whatsapp' | 'email', value: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        }
        setCopiedField(field);
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم النسخ للحافظة' : 'Copied to clipboard',
          description: value,
          durationMs: 1800,
        });
        window.setTimeout(() => {
          setCopiedField((prev) => (prev === field ? null : prev));
        }, 1800);
      } catch {
        toast({
          variant: 'negative',
          title: lang === 'ar' ? 'تعذر النسخ' : 'Could not copy',
        });
      }
    },
    [lang, toast]
  );

  const playerName = player
    ? localizeText(lang, player.fullName, player.fullNameAr)
    : '';
  const playerNick = player
    ? localizeText(lang, player.nickname, player.nicknameAr)
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {player && (
              <PlayerAvatar
                name={playerName}
                playerId={player.id}
                avatarSeed={player.avatarSeed}
                avatar={player.avatar}
                size="md"
              />
            )}
            <div className="min-w-0">
              <DialogTitle className="truncate">{playerName}</DialogTitle>
              <DialogDescription className="truncate">
                {playerNick ? `“${playerNick}”` : ''}
                {tableLabel ? ` · ${tableLabel}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-input border-2 border-negative bg-negative-soft p-3.5 text-sm font-bold text-negative"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && contact && (
          <div className="space-y-3">
            {/* Primary Tap-to-Call & WhatsApp Big Action Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <Button asChild variant="red" size="lg" className="min-h-[52px]">
                <a href={buildTelHref(contact.phone)}>
                  <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'اتصال مباشر' : 'Call Now'}</span>
                </a>
              </Button>
              <Button asChild variant="gold" size="lg" className="min-h-[52px]">
                <a
                  href={buildWhatsAppUrl(contact.whatsapp, playerName, lang)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
                </a>
              </Button>
            </div>

            {/* Individual Copyable Contact Rows */}
            <div className="divide-y divide-border-paper rounded-input border-2 border-outline bg-paper overflow-hidden">
              {/* Phone */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase text-ink-muted">
                    {lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
                  </div>
                  <a
                    href={buildTelHref(contact.phone)}
                    dir="ltr"
                    className="block truncate text-base font-bold text-ink underline decoration-red-600/50 underline-offset-2 tabular-nums hover:text-red-600"
                  >
                    {contact.phone}
                  </a>
                </div>
                <Button
                  type="button"
                  variant="calm"
                  size="sm"
                  onClick={() => handleCopy('phone', contact.phone)}
                  aria-label={lang === 'ar' ? 'نسخ رقم الهاتف' : 'Copy phone number'}
                >
                  {copiedField === 'phone' ? (
                    <Check className="h-4 w-4 text-positive-ink" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {copiedField === 'phone'
                      ? lang === 'ar'
                        ? 'نُسخ'
                        : 'Copied'
                      : lang === 'ar'
                        ? 'نسخ'
                        : 'Copy'}
                  </span>
                </Button>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase text-ink-muted">
                    {lang === 'ar' ? 'واتساب' : 'WhatsApp'}
                  </div>
                  <a
                    href={buildWhatsAppUrl(contact.whatsapp, playerName, lang)}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="block truncate text-base font-bold text-ink underline decoration-positive/60 underline-offset-2 tabular-nums hover:text-positive-ink"
                  >
                    {contact.whatsapp}
                  </a>
                </div>
                <Button
                  type="button"
                  variant="calm"
                  size="sm"
                  onClick={() => handleCopy('whatsapp', contact.whatsapp)}
                  aria-label={lang === 'ar' ? 'نسخ رقم واتساب' : 'Copy WhatsApp number'}
                >
                  {copiedField === 'whatsapp' ? (
                    <Check className="h-4 w-4 text-positive-ink" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {copiedField === 'whatsapp'
                      ? lang === 'ar'
                        ? 'نُسخ'
                        : 'Copied'
                      : lang === 'ar'
                        ? 'نسخ'
                        : 'Copy'}
                  </span>
                </Button>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase text-ink-muted">
                    {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </div>
                  <a
                    href={`mailto:${contact.email}`}
                    dir="ltr"
                    className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-bold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{contact.email}</span>
                  </a>
                </div>
                <Button
                  type="button"
                  variant="calm"
                  size="sm"
                  onClick={() => handleCopy('email', contact.email)}
                  aria-label={lang === 'ar' ? 'نسخ البريد الإلكتروني' : 'Copy email address'}
                >
                  {copiedField === 'email' ? (
                    <Check className="h-4 w-4 text-positive-ink" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {copiedField === 'email'
                      ? lang === 'ar'
                        ? 'نُسخ'
                        : 'Copied'
                      : lang === 'ar'
                        ? 'نسخ'
                        : 'Copy'}
                  </span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-input bg-paper-2 px-3 py-2 text-xs font-semibold text-ink-muted">
              <ShieldCheck className="h-4 w-4 shrink-0 text-positive-ink" aria-hidden="true" />
              <span>
                {lang === 'ar'
                  ? 'بيانات محمية بالصلاحية — تم تسجيل عرض هذه البيانات في سجل المراجعة (contact.viewed).'
                  : 'Role-protected contact access — logged in the Audit trail (contact.viewed).'}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
