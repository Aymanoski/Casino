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
  players: [BracketPlayerSlot, BracketPlayerSlot, BracketPlayerSlot] | BracketPlayerSlot[];
  useArabicIndicDigits?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * BracketNode
 * Per DESIGN.md §6 & AGENTS.md §13:
 * Container-query responsive 3-player game node.
 * Highlights winners, glows when LIVE, and renders Marwan Serry's Final Boss node
 * with warm chasing marquee bulbs. Scales smoothly inside bracket tracks or stacked mobile cards.
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
        '@container relative flex w-full min-w-0 flex-col gap-2.5 rounded-card border p-3.5 @xs:p-4 transition-all duration-200 shadow-card-inner',
        isFinal
          ? 'border-gold-300 bg-gradient-to-b from-[#241B0B] via-surface to-bg shadow-glow-gold'
          : status === 'live'
            ? 'border-live/70 bg-surface-2 shadow-[0_0_24px_rgba(255,77,77,0.22)] ring-1 ring-live/40'
            : status === 'finished'
              ? 'border-border-strong bg-surface'
              : 'border-border bg-bg-raised/90',
        onSelect &&
          'cursor-pointer hover:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
        className
      )}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2">
        <div className="min-w-0">
          {roundLabel && (
            <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-gold-300">
              {roundLabel}
            </div>
          )}
          <div className="flex items-center gap-1.5 truncate font-display text-sm @xs:text-base font-bold text-ivory">
            {isFinal && <Crown className="h-3.5 w-3.5 shrink-0 text-gold-300" />}
            <span className="truncate">{tableName}</span>
          </div>
        </div>

        <div className="shrink-0">
          {status === 'live' ? (
            <LiveBadge size="sm" />
          ) : status === 'finished' ? (
            <Badge variant="positive" className="px-2 py-0.5 text-[10px]">
              {lang === 'ar' ? 'منتهية' : 'DONE'}
            </Badge>
          ) : (
            <Badge variant="muted" className="px-2 py-0.5 text-[10px]">
              {lang === 'ar' ? 'مجدولة' : 'SCHED'}
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
                'flex min-h-[44px] items-center justify-between gap-2 rounded-input border px-2.5 py-1.5 transition-colors',
                slot.isHost
                  ? 'border-gold-300/75 bg-gold-500/15'
                  : highlighted
                    ? 'border-positive/55 bg-positive/12'
                    : slot.isPlaceholder
                      ? 'border-dashed border-border bg-bg/50 opacity-75'
                      : 'border-border bg-surface-2/75'
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
                  <div className="flex items-center gap-1 truncate text-xs @xs:text-sm font-semibold text-ivory">
                    {slot.isHost && (
                      <span className="text-gold-300" aria-hidden="true">
                        ♛
                      </span>
                    )}
                    {highlighted && !slot.isHost && (
                      <Trophy className="h-3 w-3 shrink-0 text-positive" />
                    )}
                    <span
                      className={cn(
                        'truncate',
                        slot.isHost && 'text-gold-gradient font-bold',
                        slot.isPlaceholder && 'italic text-text-faint font-normal'
                      )}
                    >
                      {slot.name}
                    </span>
                  </div>
                  {slot.nickname && !slot.isPlaceholder && (
                    <div className="hidden @xs:block truncate text-[10px] text-text-muted">
                      “{slot.nickname}”
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-end font-score text-base @xs:text-lg font-bold tabular-nums">
                {typeof slot.score === 'number' ? (
                  <span
                    className={cn(
                      slot.isHost
                        ? 'text-gold-300'
                        : highlighted
                          ? 'text-positive'
                          : 'text-ivory'
                    )}
                  >
                    {formatNumber(slot.score, { useArabicIndicDigits })}
                  </span>
                ) : (
                  <span className="text-xs text-text-faint">—</span>
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
 * Responsive horizontal pan + zoom container for bracket trees on phones & tablets
 * per AGENTS.md §13.
 */
export function BracketTrack({ children, title, className }: BracketTrackProps) {
  const { lang } = useI18n();
  const [zoom, setZoom] = useState<number>(1);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-300">
            {title}
          </span>
        ) : (
          <span />
        )}

        <div className="inline-flex items-center gap-1 rounded-button border border-border bg-bg-raised p-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            aria-label={lang === 'ar' ? 'تصغير الشجرة' : 'Zoom out bracket'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-text-muted hover:bg-surface-2 hover:text-ivory"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[48px] text-center text-xs font-semibold tabular-nums text-gold-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.15).toFixed(2))))}
            aria-label={lang === 'ar' ? 'تكبير الشجرة' : 'Zoom in bracket'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-text-muted hover:bg-surface-2 hover:text-ivory"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto overscroll-x-contain rounded-card border border-border bg-bg-raised/60 p-4 sm:p-6">
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
