import React from 'react';
import { cn } from '@/lib/utils';

export interface PlayerAvatarProps {
  name: string;
  avatarSeed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isHost?: boolean;
  buzzed?: boolean;
  selected?: boolean;
  rank?: number;
  className?: string;
}

const SIZE_CLASSES = {
  xs: { box: 'h-8 w-8', text: 'text-xs' },
  sm: { box: 'h-10 w-10', text: 'text-xs' },
  md: { box: 'h-12 w-12', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-lg' },
  xl: { box: 'h-20 w-20', text: 'text-2xl' },
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const cleaned = name
    .replace(/["'«»]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return '★';
  if (cleaned.length === 1) {
    return cleaned[0].slice(0, 2).toUpperCase();
  }
  return `${cleaned[0][0]}${cleaned[cleaned.length - 1][0]}`.toUpperCase();
}

/**
 * PlayerAvatar
 * Generated geometric SVG pattern + initials in a thick outlined ring per DESIGN.md §6 & §9.
 * Uses only brand palette colors (red, maroon, blue, gold) with zero real-person photos.
 */
export function PlayerAvatar({
  name,
  avatarSeed,
  size = 'md',
  isHost = false,
  buzzed = false,
  selected = false,
  rank,
  className,
}: PlayerAvatarProps) {
  const seed = hashSeed(avatarSeed || name || 'casino');
  const patternVariant = seed % 6;
  const initials = getInitials(name);

  // High-contrast brand gradients ensuring crisp white/maroon initials
  const bgAccents = [
    'from-red-600 via-red-700 to-red-900',
    'from-red-800 via-red-900 to-ink',
    'from-blue-600 via-blue-800 to-red-900',
    'from-red-400 via-red-600 to-red-800',
    'from-gold-500 via-gold-600 to-red-800',
    'from-red-700 via-red-800 to-red-900',
  ];

  const bgGradient = isHost
    ? 'from-gold-300 via-gold-500 to-gold-600'
    : bgAccents[patternVariant];

  const dims = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-pill select-none',
        dims.box,
        className
      )}
    >
      {/* Thick Outlined Ring */}
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-pill border-[2.5px] bg-gradient-to-br transition-all duration-200',
          bgGradient,
          isHost
            ? 'border-outline ring-2 ring-gold-300 shadow-glow-gold'
            : buzzed
              ? 'border-outline ring-[3px] ring-gold-300 shadow-glow-gold'
              : selected
                ? 'border-white ring-[3px] ring-blue-500 shadow-sticker-sm'
                : 'border-outline shadow-sticker-sm'
        )}
      >
        {/* Generated Geometric SVG Pattern Overlay */}
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full',
            isHost ? 'text-red-900/25' : 'text-white/25'
          )}
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r="27"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray={isHost ? '3 2' : '4 3'}
          />

          {patternVariant === 0 && (
            <>
              <polygon points="32,6 58,32 32,58 6,32" stroke="currentColor" strokeWidth="1.3" />
              <polygon points="14,14 50,14 50,50 14,50" stroke="currentColor" strokeWidth="1" />
            </>
          )}

          {patternVariant === 1 && (
            <>
              <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="1.3" />
              <path d="M32 4V60M4 32H60M12 12L52 52M52 12L12 52" stroke="currentColor" strokeWidth="1" />
            </>
          )}

          {patternVariant === 2 && (
            <>
              <polygon points="32,7 54,19 54,45 32,57 10,45 10,19" stroke="currentColor" strokeWidth="1.3" />
              <polygon points="32,57 54,19 10,19" stroke="currentColor" strokeWidth="1" />
            </>
          )}

          {patternVariant === 3 && (
            <>
              <circle cx="32" cy="18" r="14" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="32" cy="46" r="14" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="18" cy="32" r="14" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="46" cy="32" r="14" stroke="currentColor" strokeWidth="1.1" />
            </>
          )}

          {patternVariant === 4 && (
            <>
              <polygon points="32,8 40,24 56,32 40,40 32,56 24,40 8,32 24,24" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="1" />
            </>
          )}

          {patternVariant === 5 && (
            <>
              <rect x="13" y="13" width="38" height="38" rx="6" stroke="currentColor" strokeWidth="1.2" />
              <rect x="13" y="13" width="38" height="38" rx="6" transform="rotate(45 32 32)" stroke="currentColor" strokeWidth="1.2" />
            </>
          )}
        </svg>

        {/* Initials or Host Crown */}
        <span
          className={cn(
            'relative z-10 font-display tracking-wide',
            dims.text,
            isHost ? 'text-red-900 text-lg' : 'text-white drop-shadow-[0_1px_1px_rgba(79,7,22,0.85)]'
          )}
        >
          {isHost ? '♛' : initials}
        </span>
      </div>

      {/* Rank Corner Chip */}
      {typeof rank === 'number' && (
        <span
          className={cn(
            'absolute -bottom-1 -end-1 z-20 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-pill border-2 border-outline text-[11px] font-black leading-none tabular-nums shadow-sticker-sm',
            rank === 1
              ? 'bg-gold-400 text-red-900'
              : 'bg-white text-ink'
          )}
        >
          {rank}
        </span>
      )}
    </div>
  );
}
