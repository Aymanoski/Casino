import React from 'react';
import { cn } from '@/lib/utils';

export interface CrescentStarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
  xl: 'h-12 w-12',
};

/**
 * CrescentStar
 * Subtle secondary Ramadan motif in warm gold + maroon sticker outline.
 */
export function CrescentStar({
  size = 'md',
  glow = false,
  className,
}: CrescentStarProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'inline-block shrink-0',
        SIZE_CLASSES[size],
        glow && 'drop-shadow-[0_0_12px_rgba(255,193,43,0.55)]',
        className
      )}
      aria-hidden="true"
    >
      <path
        d="M24.6 20.8C22.7 21.8 20.5 22.2 18.2 21.8C12.3 20.8 8.4 15.1 9.5 9.2C9.9 7.1 10.9 5.2 12.4 3.7C6.9 4.9 2.8 9.7 2.8 15.6C2.8 22.4 8.3 27.9 15.1 27.9C19.9 27.9 24.1 25.1 26.1 21C25.6 20.9 25.1 20.9 24.6 20.8Z"
        stroke="#4F0716"
        strokeWidth="2.2"
        fill="#FFC12B"
      />
      <path
        d="M10.5 6.4C7.2 8.4 5.2 12 5.4 16.1"
        stroke="#FFE899"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M23.2 5.6L24.4 8.3L27.3 8.7L25.1 10.7L25.7 13.6L23.2 12.1L20.7 13.6L21.3 10.7L19.1 8.7L22 8.3L23.2 5.6Z"
        fill="#FFE899"
        stroke="#4F0716"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CardSuitWatermark({
  suit = 'spade',
  tone = 'stage',
  className,
}: {
  suit?: 'spade' | 'heart' | 'diamond' | 'club';
  tone?: 'stage' | 'paper';
  className?: string;
}) {
  const symbolMap = {
    spade: '♠',
    heart: '♥',
    diamond: '♦',
    club: '♣',
  };
  return (
    <span
      className={cn(
        'select-none font-display pointer-events-none',
        tone === 'paper' ? 'text-red-900/10' : 'text-white/15',
        className
      )}
      aria-hidden="true"
    >
      {symbolMap[suit]}
    </span>
  );
}
