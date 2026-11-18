import React from 'react';
import { cn } from '@/lib/utils';

export interface PlayerAvatarProps {
  name: string;
  avatarSeed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isHost?: boolean;
  buzzed?: boolean;
  rank?: number;
  className?: string;
}

const SIZE_CLASSES = {
  xs: { box: 'h-8 w-8', text: 'text-xs' },
  sm: { box: 'h-10 w-10', text: 'text-xs' },
  md: { box: 'h-13 w-13', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-lg' },
  xl: { box: 'h-22 w-22', text: 'text-2xl' },
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
 * Generated geometric pattern + initials in a gold ring per DESIGN.md §6 & §9.
 * Strictly zero photos of real people (AGENTS.md §10).
 */
export function PlayerAvatar({
  name,
  avatarSeed,
  size = 'md',
  isHost = false,
  buzzed = false,
  rank,
  className,
}: PlayerAvatarProps) {
  const seed = hashSeed(avatarSeed || name || 'casino');
  const patternVariant = seed % 6;
  const initials = getInitials(name);

  // Subtle midnight-and-gold background tint variations from token palette
  const bgAccents = [
    'from-[#18234F] via-[#111A3D] to-[#070B1A]',
    'from-[#1E2B5E] via-[#111A3D] to-[#070B1A]',
    'from-[#241E45] via-[#111A3D] to-[#070B1A]',
    'from-[#142D3E] via-[#111A3D] to-[#070B1A]',
    'from-[#2A2215] via-[#111A3D] to-[#070B1A]',
    'from-[#1A244D] via-[#0C1230] to-[#070B1A]',
  ];
  const bgGradient = isHost
    ? 'from-[#6B4C14] via-[#18234F] to-[#070B1A]'
    : bgAccents[patternVariant];

  const dims =
    size === 'md'
      ? { box: 'h-12 w-12', text: 'text-sm' }
      : size === 'xl'
        ? { box: 'h-20 w-20', text: 'text-xl' }
        : SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-pill select-none',
        dims.box,
        className
      )}
    >
      {/* Outer Gold Ring */}
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-pill border-2 bg-gradient-to-br transition-all duration-300',
          bgGradient,
          isHost
            ? 'border-gold-300 shadow-[0_0_24px_rgba(232,184,75,0.55)]'
            : buzzed
              ? 'border-gold-300 shadow-[0_0_22px_rgba(232,184,75,0.65)] ring-2 ring-gold-500/50'
              : 'border-gold-500/80 shadow-[0_0_12px_rgba(232,184,75,0.20)]'
        )}
      >
        {/* Generated Geometric SVG Pattern Overlay */}
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute inset-0 h-full w-full text-gold-500/30"
          aria-hidden="true"
        >
          {/* Inner recessed ring */}
          <circle
            cx="32"
            cy="32"
            r="27"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray={isHost ? '3 2' : '4 3'}
          />

          {patternVariant === 0 && (
            <>
              <polygon
                points="32,6 58,32 32,58 6,32"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <polygon
                points="14,14 50,14 50,50 14,50"
                stroke="currentColor"
                strokeWidth="1"
              />
            </>
          )}

          {patternVariant === 1 && (
            <>
              <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M32 4V60M4 32H60M12 12L52 52M52 12L12 52"
                stroke="currentColor"
                strokeWidth="0.9"
              />
            </>
          )}

          {patternVariant === 2 && (
            <>
              <polygon
                points="32,7 54,19 54,45 32,57 10,45 10,19"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <polygon
                points="32,57 54,19 10,19"
                stroke="currentColor"
                strokeWidth="0.9"
              />
            </>
          )}

          {patternVariant === 3 && (
            <>
              <circle cx="32" cy="18" r="14" stroke="currentColor" strokeWidth="1" />
              <circle cx="32" cy="46" r="14" stroke="currentColor" strokeWidth="1" />
              <circle cx="18" cy="32" r="14" stroke="currentColor" strokeWidth="1" />
              <circle cx="46" cy="32" r="14" stroke="currentColor" strokeWidth="1" />
            </>
          )}

          {patternVariant === 4 && (
            <>
              <polygon
                points="32,8 40,24 56,32 40,40 32,56 24,40 8,32 24,24"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="1" />
            </>
          )}

          {patternVariant === 5 && (
            <>
              <rect
                x="13"
                y="13"
                width="38"
                height="38"
                rx="6"
                stroke="currentColor"
                strokeWidth="1.1"
              />
              <rect
                x="13"
                y="13"
                width="38"
                height="38"
                rx="6"
                transform="rotate(45 32 32)"
                stroke="currentColor"
                strokeWidth="1.1"
              />
            </>
          )}
        </svg>

        {/* Initials or Host Crown */}
        <span
          className={cn(
            'relative z-10 font-display font-bold tracking-wider',
            dims.text,
            isHost ? 'text-gold-gradient' : 'text-gold-100'
          )}
        >
          {isHost ? '♛' : initials}
        </span>
      </div>

      {/* Optional Rank Badge on corner */}
      {typeof rank === 'number' && (
        <span
          className={cn(
            'absolute -bottom-1 -end-1 z-20 flex h-5 w-5 items-center justify-center rounded-pill border text-[10px] font-bold tabular-nums shadow-sm',
            rank === 1
              ? 'border-gold-100 bg-gold-gradient text-bg'
              : 'border-border-strong bg-surface-2 text-gold-300'
          )}
        >
          {rank}
        </span>
      )}
    </div>
  );
}
