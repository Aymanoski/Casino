'use client';

import React, { useState } from 'react';
import { Crown, Trophy, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatCompactChipNumber, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { LiveBadge } from './LiveBadge';
import { MarqueeBulbs } from './MarqueeBulbs';
import { PlayerAvatar } from './PlayerAvatar';

export interface BracketPlayerSlot {
  id?: string;
  name: string;
  nickname?: string;
  avatarSeed?: string;
  score?: number;
  isWinner?: boolean;
  isAdvancing?: boolean;
  isHost?: boolean;
  isPlaceholder?: boolean;
}

export interface BracketNodeProps {
  tableName: string;
  roundLabel?: string;
  status: 'scheduled' | 'live' | 'finished';
  isFinal?: boolean;
  players:
    | [BracketPlayerSlot, BracketPlayerSlot, BracketPlayerSlot]
    | BracketPlayerSlot[];
  activeBuzzPlayerId?: string | null;
  highlightedPlayerId?: string | null;
  metaLabel?: string;
  useArabicIndicDigits?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * BracketNode
 * Per DESIGN.md §6:
 * Mini white sticker card with 3 players, winners highlighted in gold,
 * live node glowing & pulsing, and Marwan's final node a distinct "boss" node with
 * marquee bulbs and the golden seat.
 */
export const BracketNode = React.memo(function BracketNode({
  tableName,
  roundLabel,
  status,
  isFinal = false,
  players,
  activeBuzzPlayerId = null,
  highlightedPlayerId = null,
  metaLabel,
  useArabicIndicDigits = false,
  onSelect,
  className,
}: BracketNodeProps) {
  const { lang } = useI18n();
  const hasHighlightedPlayer = Boolean(
    highlightedPlayerId && players.some((p) => p.id === highlightedPlayerId)
  );

  const statusAria =
    status === 'live'
      ? lang === 'ar'
        ? 'مباشر الآن'
        : 'Live now'
      : status === 'finished'
        ? lang === 'ar'
          ? 'منتهية'
          : 'Finished'
        : lang === 'ar'
          ? 'قادمة'
          : 'Upcoming';

  const nodeAriaLabel = onSelect
    ? lang === 'ar'
      ? `${tableName} — ${statusAria}. اضغط لعرض التفاصيل`
      : `${tableName} — ${statusAria}. Open match details`
    : undefined;

  const innerNode = (
    <div
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={nodeAriaLabel}
      aria-haspopup={onSelect ? 'dialog' : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        '@container relative flex w-full min-w-0 flex-col gap-2.5 rounded-card border-[2.5px] border-outline bg-white p-3.5 @xs:p-4 text-ink transition-[box-shadow,border-color,transform] duration-200',
        isFinal
          ? 'bg-white bg-gradient-to-b from-gold-200/50 via-paper to-white shadow-sticker-lg'
          : status === 'live'
            ? 'ring-[3px] ring-gold-400 shadow-[0_0_28px_rgba(255,193,43,0.6),4px_4px_0_var(--red-900)]'
            : 'shadow-sticker',
        hasHighlightedPlayer &&
          'ring-[3px] ring-blue-500 ring-offset-2 ring-offset-white',
        onSelect &&
          'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        className
      )}
    >
      {/* Final Boss Gold Corner Ribbon */}
      {isFinal && (
        <span className="pointer-events-none absolute -top-0.5 end-4 inline-flex items-center gap-1 rounded-none border-x-2 border-b-2 border-outline bg-gold-gradient px-2.5 py-0.5 text-[11px] font-black uppercase ltr:tracking-wider rtl:tracking-normal text-red-900 shadow-sticker-sm">
          <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{lang === 'ar' ? 'المقعد الذهبي' : 'GOLDEN SEAT'}</span>
        </span>
      )}

      {/* Node Header */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b-2 border-border-paper pb-2',
          isFinal && 'pt-4'
        )}
      >
        <div className="min-w-0">
          {roundLabel && (
            <div className="truncate text-[11px] font-bold uppercase ltr:tracking-wider rtl:tracking-normal text-red-700">
              {roundLabel}
            </div>
          )}
          <div className="flex items-center gap-1.5 truncate font-display text-sm @xs:text-base text-red-900">
            {isFinal && <Crown className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />}
            <span className="truncate">{tableName}</span>
          </div>
          {metaLabel && (
            <div className="mt-0.5 truncate text-[11px] font-medium text-ink-muted">
              {metaLabel}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {status === 'live' ? (
            <LiveBadge size="sm" surface="paper" />
          ) : status === 'finished' ? (
            <Badge variant="muted" className="px-2.5 py-0.5 text-[11px]">
              {lang === 'ar' ? 'منتهية' : 'DONE'}
            </Badge>
          ) : (
            <Badge variant="info" className="px-2.5 py-0.5 text-[11px]">
              {lang === 'ar' ? 'قادمة' : 'UPCOMING'}
            </Badge>
          )}
        </div>
      </div>

      {/* 3 Contestant Rows */}
      <div className="space-y-1.5">
        {players.map((slot, idx) => {
          const highlighted = slot.isWinner || slot.isAdvancing;
          const isBuzzed = Boolean(
            status === 'live' && activeBuzzPlayerId && slot.id === activeBuzzPlayerId
          );
          const isPathMatch = Boolean(
            highlightedPlayerId && slot.id === highlightedPlayerId
          );
          return (
            <div
              key={slot.id ?? `slot-${idx}`}
              className={cn(
                'flex min-h-[44px] items-center justify-between gap-2 rounded-input border-2 px-2.5 py-1.5 transition-colors',
                slot.isHost
                  ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
                  : isBuzzed
                    ? 'border-outline bg-gold-300/75 text-red-900 shadow-sticker-sm'
                    : isPathMatch
                      ? 'border-blue-600 bg-blue-100/80 text-blue-800'
                      : highlighted
                        ? 'border-outline bg-gold-200/75 text-red-900'
                        : slot.isPlaceholder
                          ? 'border-dashed border-border-paper bg-paper-2/60 opacity-85'
                          : 'border-border-paper bg-paper text-ink'
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <PlayerAvatar
                  name={slot.name}
                  avatarSeed={slot.avatarSeed ?? slot.name}
                  size="xs"
                  isHost={slot.isHost}
                  className="hidden @2xs:inline-flex"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-xs @xs:text-sm font-bold">
                    {slot.isHost && (
                      <Crown className="h-3.5 w-3.5 shrink-0 text-red-900" aria-hidden="true" />
                    )}
                    {highlighted && !slot.isHost && (
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
                    )}
                    {isBuzzed && !slot.isHost && (
                      <Zap className="h-3.5 w-3.5 shrink-0 text-red-700 fill-gold-400" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        'truncate',
                        slot.isPlaceholder && 'italic text-ink-muted font-medium'
                      )}
                    >
                      {slot.name}
                    </span>
                  </div>
                  {slot.nickname && !slot.isPlaceholder && (
                    <div
                      className={cn(
                        'hidden @xs:block truncate text-xs',
                        slot.isHost ? 'text-red-900/80' : 'text-ink-muted'
                      )}
                    >
                      “{slot.nickname}”
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-end font-score text-base @xs:text-lg font-black tabular-nums">
                {typeof slot.score === 'number' ? (
                  <span
                    title={formatNumber(slot.score, { useArabicIndicDigits })}
                    className={cn(
                      slot.isHost || highlighted ? 'text-red-900' : 'text-ink'
                    )}
                  >
                    {Math.abs(slot.score) >= 100_000
                      ? `${slot.score < 0 ? '−' : ''}${formatCompactChipNumber(slot.score, useArabicIndicDigits)}`
                      : formatNumber(slot.score, { useArabicIndicDigits })}
                  </span>
                ) : (
                  <span className="text-xs text-ink-muted">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isFinal) {
    return (
      <MarqueeBulbs variant="perimeter" bulbCount={10} className="w-full">
        {innerNode}
      </MarqueeBulbs>
    );
  }

  return innerNode;
});

export interface BracketTrackProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/**
 * BracketTrack
 * Responsive horizontal pan + zoom container for bracket trees on phones & tablets.
 */
export function BracketTrack({ children, title, className }: BracketTrackProps) {
  const { lang } = useI18n();
  const [zoom, setZoom] = useState<number>(1);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <span className="rounded-pill border-2 border-outline bg-white px-3.5 py-1 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-red-900 shadow-sticker-sm">
            {title}
          </span>
        ) : (
          <span />
        )}

        <div className="inline-flex items-center gap-1 rounded-button border-2 border-outline bg-white p-1 shadow-sticker-sm">
          <button
            type="button"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            aria-label={lang === 'ar' ? 'تصغير الشجرة' : 'Zoom out bracket'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            aria-label={lang === 'ar' ? 'إعادة التكبير إلى ١٠٠٪' : 'Reset zoom to 100%'}
            className="inline-flex min-h-[44px] min-w-[52px] items-center justify-center rounded-[10px] px-2 text-center text-xs font-extrabold tabular-nums text-red-900 hover:bg-paper-2 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            disabled={zoom >= 1.25}
            onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.15).toFixed(2))))}
            aria-label={lang === 'ar' ? 'تكبير الشجرة' : 'Zoom in bracket'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y border-y-2 border-outline bg-paper-2/70 py-4 sm:py-6 px-2 sm:px-4">
        <div
          className="ltr:origin-top-left rtl:origin-top-right transition-transform duration-200"
          style={
            zoom !== 1
              ? {
                  transform: `scale(${zoom})`,
                  width: `${Math.round(100 / zoom)}%`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
