'use client';

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, UserCheck, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Player } from '@/lib/schemas';
import { cn, formatNumber, localizeText, normalizeSearchText } from '@/lib/utils';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';

export interface PlayerComboboxProps {
  players: Player[];
  value: string;
  onChange: (playerId: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  excludePlayerIds?: Set<string>;
  includeGuest?: boolean;
  useArabicIndicDigits?: boolean;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

const MAX_VISIBLE_OPTIONS = 48;

/**
 * Searchable Combobox built for 720+ contestants (replaces slow 720-option native selects).
 * Arabic-normalized search by fullName, fullNameAr, nickname, nicknameAr, seed #, or ID.
 */
export function PlayerCombobox({
  players,
  value,
  onChange,
  placeholder,
  emptyOptionLabel,
  excludePlayerIds,
  includeGuest = false,
  useArabicIndicDigits = false,
  ariaLabel,
  className,
  disabled = false,
}: PlayerComboboxProps) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pool = useMemo(() => {
    return players.filter((p) => {
      if (!includeGuest && (p.isGuest || p.isHost)) return false;
      if (excludePlayerIds?.has(p.id) && p.id !== value) return false;
      return true;
    });
  }, [players, includeGuest, excludePlayerIds, value]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === value) ?? null,
    [players, value]
  );

  const filtered = useMemo(() => {
    const q = normalizeSearchText(deferredQuery);
    if (!q) return pool.slice(0, MAX_VISIBLE_OPTIONS);
    const out: Player[] = [];
    for (const p of pool) {
      const hay = normalizeSearchText(
        `${p.fullName} ${p.fullNameAr} ${p.nickname} ${p.nicknameAr} #${p.seed} ${p.seed} ${p.id}`
      );
      if (hay.includes(q)) {
        out.push(p);
        if (out.length >= MAX_VISIBLE_OPTIONS) break;
      }
    }
    return out;
  }, [pool, deferredQuery]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const defaultPlaceholder =
    placeholder ??
    (lang === 'ar' ? 'ابحث واختر لاعباً (720)...' : 'Search & pick a player (720)...');

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? defaultPlaceholder}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-input border-2 border-border-paper bg-white px-3 py-2 text-start text-base sm:text-sm text-ink transition-colors hover:border-red-600/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50',
          open && 'border-blue-500'
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedPlayer ? (
            <>
              <PlayerAvatar
                name={localizeText(lang, selectedPlayer.fullName, selectedPlayer.fullNameAr)}
                playerId={selectedPlayer.id}
                avatarSeed={selectedPlayer.avatarSeed}
                avatar={selectedPlayer.avatar}
                size="xs"
                isHost={selectedPlayer.isGuest || selectedPlayer.isHost}
              />
              <span className="truncate font-bold text-red-900">
                {selectedPlayer.seed > 0 && (
                  <span className="me-1 font-score text-xs text-ink-muted tabular-nums">
                    #{formatNumber(selectedPlayer.seed, { useArabicIndicDigits })}
                  </span>
                )}
                {localizeText(lang, selectedPlayer.fullName, selectedPlayer.fullNameAr)}
              </span>
            </>
          ) : (
            <span className="truncate text-ink-muted">{defaultPlaceholder}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label={lang === 'ar' ? 'مسح الاختيار' : 'Clear selection'}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setQuery('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                  setQuery('');
                }
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-paper-2 hover:text-red-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-ink-muted transition-transform',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel ?? defaultPlaceholder}
          className="absolute start-0 top-full z-50 mt-1.5 w-full min-w-[260px] rounded-card border-2 border-outline bg-white p-2 shadow-sticker-lg"
        >
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'اكتب الاسم، اللقب، أو الرقم...'
                  : 'Type name, nickname, or #seed...'
              }
              className="min-h-[44px] w-full rounded-input border-2 border-border-paper bg-paper ps-9 pe-3 text-base sm:text-sm text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain space-y-1">
            {emptyOptionLabel && (
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex min-h-[44px] w-full items-center gap-2 rounded-input px-2.5 py-1.5 text-start text-sm font-semibold transition-colors',
                  value === ''
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-ink-muted hover:bg-paper-2'
                )}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{emptyOptionLabel}</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-ink-muted">
                {lang === 'ar' ? 'لا يوجد لاعب مطابق.' : 'No matching player found.'}
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-input px-2.5 py-1.5 text-start text-sm transition-colors',
                      isSelected
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'text-ink hover:bg-paper-2'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar
                        name={localizeText(lang, p.fullName, p.fullNameAr)}
                        playerId={p.id}
                        avatarSeed={p.avatarSeed}
                        avatar={p.avatar}
                        size="xs"
                        isHost={p.isGuest || p.isHost}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-red-900">
                          {p.seed > 0 && (
                            <span className="me-1 font-score text-xs text-ink-muted tabular-nums">
                              #{formatNumber(p.seed, { useArabicIndicDigits })}
                            </span>
                          )}
                          {localizeText(lang, p.fullName, p.fullNameAr)}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          “{localizeText(lang, p.nickname, p.nicknameAr)}”
                        </span>
                      </span>
                    </span>
                    {isSelected && (
                      <UserCheck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-1.5 border-t border-border-paper pt-1.5 text-center text-[11px] font-medium text-ink-muted">
            {lang === 'ar'
              ? `عرض ${filtered.length} من أصل ${pool.length} لاعب — ابحث لتضييق النتائج`
              : `Showing ${filtered.length} of ${pool.length} players — type to narrow`}
          </div>
        </div>
      )}
    </div>
  );
}
