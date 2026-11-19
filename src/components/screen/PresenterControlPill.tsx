'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronUp,
  Crown,
  Gamepad2,
  Globe,
  Home,
  Maximize2,
  Minimize2,
  MonitorPlay,
  Radio,
  Trophy,
  Wifi,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { RealtimeConnectionStatus } from '@/lib/realtime';
import type { Game } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';

export interface PresenterControlPillProps {
  activeView: 'game' | 'leaderboard';
  activeGameId?: string;
  games: Game[];
  isPresenterMode: boolean;
  controlsVisible: boolean;
  onTogglePresenterMode: () => void;
  connectionStatus: RealtimeConnectionStatus;
  extraControls?: React.ReactNode;
}

/**
 * PresenterControlPill
 * Minimal auto-hiding floating broadcast toolbar docked at the screen edge.
 * Vanishes cleanly in Presenter Mode after cursor inactivity and reappears
 * immediately on mouse movement, touch, or Esc/F.
 */
export function PresenterControlPill({
  activeView,
  activeGameId,
  games,
  isPresenterMode,
  controlsVisible,
  onTogglePresenterMode,
  connectionStatus,
  extraControls,
}: PresenterControlPillProps) {
  const { lang, toggleLang } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popover when controls fade out or user clicks outside
  useEffect(() => {
    if (!controlsVisible) setSwitcherOpen(false);
  }, [controlsVisible]);

  useEffect(() => {
    if (!switcherOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setSwitcherOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [switcherOpen]);

  // Prioritize live games, then Grand Final, then Demo, then remaining tables
  const featuredGames = [...games].sort((a, b) => {
    const score = (g: Game) =>
      g.status === 'live' && !g.isDemo
        ? 0
        : g.isFinal
          ? 1
          : g.isDemo
            ? 2
            : g.status === 'scheduled'
              ? 3
              : 4;
    return score(a) - score(b);
  });

  const liveGame =
    games.find((g) => g.status === 'live' && !g.isDemo) ??
    games.find((g) => g.isFinal) ??
    games[0];

  const isConnected = connectionStatus === 'connected';

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed bottom-[max(0.85rem,env(safe-area-inset-bottom))] end-3 sm:end-5 z-50 max-w-[calc(100vw-1.5rem)] transition-all duration-300',
        controlsVisible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-3 opacity-0 pointer-events-none'
      )}
    >
      {/* Table / View Switcher Popover */}
      <AnimatePresence>
        {switcherOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mb-2.5 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-card border-[2.5px] border-outline bg-white text-ink shadow-sticker-lg"
            role="dialog"
            aria-label={lang === 'ar' ? 'تبديل شاشة العرض' : 'Switch broadcast feed'}
          >
            <div className="flex items-center justify-between border-b-2 border-border-paper bg-paper px-4 py-2.5">
              <span className="font-display text-sm text-red-900">
                {lang === 'ar' ? 'مصادر شاشة العرض' : 'Broadcast Feeds'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-outline bg-positive-soft px-2 py-0.5 text-[11px] font-bold text-positive-ink">
                <Wifi className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{lang === 'ar' ? 'تزامن فوري' : 'Live Sync'}</span>
              </span>
            </div>

            <div className="max-h-[55dvh] overflow-y-auto p-2 space-y-1">
              <Link
                href="/screen/leaderboard"
                onClick={() => setSwitcherOpen(false)}
                className={cn(
                  'flex min-h-[44px] items-center justify-between gap-2 rounded-input px-3 py-2 text-sm font-bold transition-colors',
                  activeView === 'leaderboard'
                    ? 'bg-red-600 text-white'
                    : 'text-ink hover:bg-paper'
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {lang === 'ar' ? 'لوحة الصدارة العملاقة' : 'Big Screen Leaderboard'}
                  </span>
                </span>
                <span
                  className={cn(
                    'rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase',
                    activeView === 'leaderboard'
                      ? 'bg-white text-red-600'
                      : 'bg-paper-2 text-red-900'
                  )}
                >
                  {lang === 'ar' ? 'الترتيب' : 'TOP 27'}
                </span>
              </Link>

              <div className="my-1.5 border-t border-border-paper" />

              {featuredGames.slice(0, 8).map((g) => {
                const isActive = activeView === 'game' && activeGameId === g.id;
                const label = localizeText(lang, g.tableName, g.tableNameAr);
                return (
                  <Link
                    key={g.id}
                    href={`/screen/${g.id}`}
                    onClick={() => setSwitcherOpen(false)}
                    className={cn(
                      'flex min-h-[44px] items-center justify-between gap-2 rounded-input px-3 py-2 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-red-900 text-white'
                        : 'text-ink hover:bg-paper'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {g.isFinal ? (
                        <Crown
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isActive ? 'text-gold-300' : 'text-gold-600'
                          )}
                          aria-hidden="true"
                        />
                      ) : g.status === 'live' ? (
                        <Radio
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isActive ? 'text-gold-300' : 'text-red-600'
                          )}
                          aria-hidden="true"
                        />
                      ) : (
                        <MonitorPlay
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isActive ? 'text-white/80' : 'text-ink-muted'
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{label}</span>
                    </span>

                    <span
                      className={cn(
                        'shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase',
                        g.isDemo
                          ? 'bg-blue-100 text-blue-800'
                          : g.status === 'live'
                            ? 'bg-red-600 text-white'
                            : g.isFinal
                              ? 'bg-gold-300 text-red-900'
                              : g.status === 'finished'
                                ? 'bg-paper-2 text-ink-muted'
                                : 'bg-blue-100 text-blue-800'
                      )}
                    >
                      {g.isDemo
                        ? lang === 'ar'
                          ? 'تجريبي'
                          : 'DEMO'
                        : g.status === 'live'
                          ? lang === 'ar'
                            ? 'مباشر'
                            : 'LIVE'
                          : g.isFinal
                            ? lang === 'ar'
                              ? 'النهائي'
                              : 'FINAL'
                            : g.status === 'finished'
                              ? lang === 'ar'
                                ? 'انتهت'
                                : 'DONE'
                              : lang === 'ar'
                                ? 'قريباً'
                                : 'NEXT'}
                    </span>
                  </Link>
                );
              })}

              <div className="my-1.5 border-t border-border-paper" />

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {activeView === 'game' && activeGameId && (
                  <Link
                    href={`/scorer/${activeGameId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSwitcherOpen(false)}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-input border-2 border-outline bg-paper px-2.5 text-xs font-bold text-red-900 hover:bg-gold-200 transition-colors"
                  >
                    <Gamepad2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'لوحة الحكم' : 'Open Scorer'}</span>
                  </Link>
                )}
                <Link
                  href="/"
                  onClick={() => setSwitcherOpen(false)}
                  className={cn(
                    'flex min-h-[44px] items-center justify-center gap-1.5 rounded-input border-2 border-border-paper bg-white px-2.5 text-xs font-bold text-ink hover:bg-paper transition-colors',
                    !(activeView === 'game' && activeGameId) && 'col-span-2'
                  )}
                >
                  <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'الرئيسية' : 'Exit Screen'}</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Auto-Hiding Broadcast Control Pill (always single-row, >= 44px touch targets) */}
      <nav
        aria-label={lang === 'ar' ? 'أدوات شاشة العرض' : 'Big Screen controls'}
        className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5 rounded-pill border-[2.5px] border-outline bg-red-900/95 p-1 sm:p-1.5 text-white shadow-sticker-lg backdrop-blur-sm"
      >
        {/* Realtime Sync Status Dot */}
        <span
          title={
            isConnected
              ? lang === 'ar'
                ? 'متصل بالتزامن الفوري'
                : 'Realtime sync active'
              : lang === 'ar'
                ? 'جاري الاتصال بالتزامن'
                : 'Sync connecting'
          }
          className="hidden sm:inline-flex min-h-[44px] items-center gap-1.5 rounded-pill bg-red-800 px-3 text-xs font-bold text-white"
        >
          <span
            aria-hidden="true"
            className={cn(
              'h-2.5 w-2.5 rounded-pill',
              isConnected ? 'bg-positive' : 'bg-gold-400 animate-pulse'
            )}
          />
          <span>{lang === 'ar' ? 'متزامن' : 'SYNC'}</span>
        </span>

        {/* Optional View-Specific Controls (e.g. Leaderboard Auto-Cycle) */}
        {extraControls}

        {/* Feed / Table Switcher Trigger */}
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-expanded={switcherOpen}
          aria-label={lang === 'ar' ? 'تبديل شاشة العرض' : 'Switch broadcast feed'}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-pill border-2 border-white/25 bg-red-800 px-3 sm:px-3.5 text-xs sm:text-sm font-bold text-white hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <MonitorPlay className="h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
          <span className="hidden xs:inline">
            {lang === 'ar' ? 'الشاشات' : 'Feeds'}
          </span>
          <ChevronUp
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              switcherOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>

        {/* Quick Toggle: Leaderboard <-> Live Match */}
        {activeView === 'game' ? (
          <Link
            href="/screen/leaderboard"
            aria-label={lang === 'ar' ? 'لوحة الصدارة' : 'Standings'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-pill border-2 border-white/25 bg-red-800 px-3 sm:px-3.5 text-xs sm:text-sm font-bold text-white hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Trophy className="h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
            <span className="hidden md:inline">
              {lang === 'ar' ? 'الصدارة' : 'Standings'}
            </span>
          </Link>
        ) : (
          liveGame && (
            <Link
              href={`/screen/${liveGame.id}`}
              aria-label={lang === 'ar' ? 'المباراة المباشرة' : 'Live Match'}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-pill border-2 border-white/25 bg-red-800 px-3 sm:px-3.5 text-xs sm:text-sm font-bold text-white hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <Radio className="h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
              <span className="hidden md:inline">
                {lang === 'ar' ? 'المباراة المباشرة' : 'Live Match'}
              </span>
            </Link>
          )
        )}

        {/* Always-Reachable EN | عربي Toggle */}
        <button
          type="button"
          onClick={toggleLang}
          aria-label={
            lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'
          }
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-pill border-2 border-outline bg-white px-3 sm:px-3.5 text-xs sm:text-sm font-extrabold text-red-900 shadow-sticker-sm hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <Globe className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        {/* Presenter Mode (Fullscreen + Hide Cursor) */}
        <button
          type="button"
          onClick={onTogglePresenterMode}
          aria-pressed={isPresenterMode}
          aria-label={
            isPresenterMode
              ? lang === 'ar'
                ? 'إنهاء وضع العرض'
                : 'Exit Presenter Mode'
              : lang === 'ar'
                ? 'وضع العرض (ملء الشاشة)'
                : 'Presenter Mode (Fullscreen)'
          }
          title={
            lang === 'ar'
              ? 'وضع العرض (ملء الشاشة وإخفاء المؤشر - F)'
              : 'Presenter Mode (Fullscreen & hide cursor — F)'
          }
          className={cn(
            'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-pill border-2 border-outline px-3 sm:px-4 text-xs sm:text-sm font-extrabold shadow-sticker-sm sticker-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
            isPresenterMode
              ? 'bg-white text-red-900'
              : 'bg-gold-gradient text-red-900'
          )}
        >
          {isPresenterMode ? (
            <Minimize2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {isPresenterMode
              ? lang === 'ar'
                ? 'إنهاء العرض'
                : 'Exit Presenter'
              : lang === 'ar'
                ? 'وضع العرض'
                : 'Presenter Mode'}
          </span>
        </button>
      </nav>
    </div>
  );
}
