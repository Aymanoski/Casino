'use client';

import React, { useState } from 'react';
import { Crown, Trophy, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, formatNumber } from '@/lib/utils';
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
  useArabicIndicDigits?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * BracketNode
 * Per DESIGN.md §6:
 * Mini white sticker card with 3 players, winners highlighted in gold,
 * live node pulsing, and Marwan's final node a distinct "boss" node with
 * marquee bulbs and the golden seat.
 */
export function BracketNode({
  tableName,
  roundLabel,
  status,
  isFinal = false,
  players,
  useArabicIndicDigits = false,
  onSelect,
  className,
}: BracketNodeProps) {
  const { lang } = useI18n();

  const innerNode = (
    <div
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
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
        '@container relative flex w-full min-w-0 flex-col gap-2.5 rounded-card border-[2.5px] border-outline bg-white p-3.5 @xs:p-4 text-ink transition-all duration-200',
        isFinal
          ? 'bg-gradient-to-b from-gold-200/50 via-paper to-white shadow-sticker-lg'
          : status === 'live'
            ? 'ring-[3px] ring-red-600 shadow-sticker'
            : 'shadow-sticker',
        onSelect &&
          'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        className
      )}
    >
      {/* Final Boss Gold Corner Ribbon */}
      {isFinal && (
        <span className="pointer-events-none absolute -top-0.5 end-4 rounded-none border-x-2 border-b-2 border-outline bg-gold-gradient px-2.5 py-0.5 text-[11px] font-black uppercase ltr:tracking-wider rtl:tracking-normal text-red-900 shadow-sticker-sm">
          ★ {lang === 'ar' ? 'المقعد الذهبي' : 'GOLDEN SEAT'}
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
            {isFinal && <Crown className="h-4 w-4 shrink-0 text-gold-600" />}
            <span className="truncate">{tableName}</span>
          </div>
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
          return (
            <div
              key={slot.id ?? `slot-${idx}`}
              className={cn(
                'flex min-h-[44px] items-center justify-between gap-2 rounded-input border-2 px-2.5 py-1.5 transition-colors',
                slot.isHost
                  ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
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
                      <span aria-hidden="true">♛</span>
                    )}
                    {highlighted && !slot.isHost && (
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-red-700" />
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
                    className={cn(
                      slot.isHost || highlighted ? 'text-red-900' : 'text-ink'
                    )}
                  >
                    {formatNumber(slot.score, { useArabicIndicDigits })}
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
}

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
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            aria-label={lang === 'ar' ? 'تصغير الشجرة' : 'Zoom out bracket'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[48px] text-center text-xs font-extrabold tabular-nums text-red-900">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.15).toFixed(2))))}
            aria-label={lang === 'ar' ? 'تكبير الشجرة' : 'Zoom in bracket'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto overscroll-x-contain border-y-2 border-outline bg-paper-2/70 py-4 sm:py-6 px-2 sm:px-4">
        <div
          className="origin-top-start transition-transform duration-200"
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
