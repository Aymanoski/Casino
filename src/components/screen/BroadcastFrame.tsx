'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Lantern, MarqueeBulbs, SunburstStage } from '@/components/brand';

export interface BroadcastFrameProps {
  /** Final mode enriches stage lighting with warmer golden top aura & denser marquee bulbs */
  isFinal?: boolean;
  /** Hides cursor during Presenter Mode inactivity */
  cursorHidden?: boolean;
  /** Keep decorative corner Ramadan lanterns visible */
  showLanterns?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * BroadcastFrame
 * Full-bleed Egyptian TV game-show proscenium for `/screen/[gameId]` and `/screen/leaderboard`:
 * - Deep maroon outer bezel + chasing gold `MarqueeBulbs` perimeter frame
 * - Rotating crimson `SunburstStage` inner canvas
 * - Subtle swaying Ramadan `Lantern` corner accents (secondary to show energy)
 * - Locks cleanly to 100dvh without scroll on TV / desktop screens (1024px+ & tall enough),
 *   while unlocking comfortable vertical scroll on phones & short landscape viewports.
 */
export function BroadcastFrame({
  isFinal = false,
  cursorHidden = false,
  showLanterns = true,
  children,
  className,
}: BroadcastFrameProps) {
  return (
    <div
      className={cn(
        'theme-stage relative flex min-h-dvh w-full flex-col bg-red-900 p-1 sm:p-2 lg:p-3 3xl:p-4 text-white pt-safe pb-safe ps-safe pe-safe',
        '[@media(max-height:520px)]:p-1',
        'lg:[@media(min-height:660px)]:h-dvh lg:[@media(min-height:660px)]:overflow-hidden',
        cursorHidden && 'cursor-none [&_*]:cursor-none',
        className
      )}
    >
      <MarqueeBulbs
        variant="perimeter"
        size="stage"
        bulbCount={isFinal ? 24 : 20}
        tone="gold"
        chase
        className="flex flex-1 min-h-0 w-full flex-col [@media(max-height:520px)]:p-2.5"
      >
        <SunburstStage
          as="div"
          variant="stage"
          animateRays
          vignette
          className={cn(
            'relative flex flex-1 min-h-0 w-full flex-col rounded-[16px] sm:rounded-[20px] border-[3px] border-outline',
            '[&>div:last-child]:flex [&>div:last-child]:flex-1 [&>div:last-child]:min-h-0 [&>div:last-child]:flex-col',
            isFinal &&
              'ring-[3px] ring-gold-300/80 shadow-[inset_0_0_80px_rgba(255,193,43,0.28)]'
          )}
        >
          {/* Extra golden top focal spotlight wash in Grand Final mode */}
          {isFinal && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 select-none"
              style={{
                background:
                  'radial-gradient(ellipse 70% 65% at 50% 0%, rgba(255, 224, 102, 0.30) 0%, rgba(255, 193, 43, 0.10) 48%, transparent 78%)',
              }}
            />
          )}

          {/* Subtle Ramadan Lantern Corner Accents (hidden on tiny phones & short landscape < 560px) */}
          {showLanterns && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 start-2 sm:start-4 xl:start-6 z-10 hidden sm:[@media(min-height:560px)]:flex items-start gap-2 opacity-90"
              >
                <Lantern
                  size={isFinal ? 'lg' : 'md'}
                  chainLength={10}
                  swayDuration={4.4}
                  swayDelay={0}
                />
                <div className="hidden 2xl:block">
                  <Lantern
                    size="sm"
                    chainLength={22}
                    swayDuration={3.8}
                    swayDelay={0.5}
                  />
                </div>
              </div>

              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 end-2 sm:end-4 xl:end-6 z-10 hidden sm:[@media(min-height:560px)]:flex items-start gap-2 opacity-90"
              >
                <div className="hidden 2xl:block">
                  <Lantern
                    size="sm"
                    chainLength={24}
                    swayDuration={4.1}
                    swayDelay={0.35}
                  />
                </div>
                <Lantern
                  size={isFinal ? 'lg' : 'md'}
                  chainLength={12}
                  swayDuration={4.7}
                  swayDelay={0.2}
                />
              </div>
            </>
          )}

          <main
            id="main-content"
            tabIndex={-1}
            className="relative z-20 mx-auto flex flex-1 min-h-0 w-full max-w-[2240px] flex-col px-3 py-2.5 sm:px-5 sm:py-3.5 lg:px-8 lg:py-4 xl:px-10 xl:py-5 3xl:px-14 3xl:py-7 [@media(max-height:520px)]:py-2 outline-none"
          >
            {children}
          </main>
        </SunburstStage>
      </MarqueeBulbs>
    </div>
  );
}
