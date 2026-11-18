import React from 'react';
import { cn } from '@/lib/utils';

export function FanousIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-gold-500', className)}
      aria-hidden="true"
    >
      {/* Hanging chain & ring */}
      <line x1="18" y1="0" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Dome */}
      <path
        d="M11 16C11 12.5 14 11 18 11C22 11 25 12.5 25 16H11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="rgba(232,184,75,0.15)"
      />
      {/* Upper rim */}
      <path d="M8 16H28L25 20H11L8 16Z" stroke="currentColor" strokeWidth="1.5" />
      {/* Glass body */}
      <path
        d="M11 20H25L27 34H9L11 20Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="rgba(251,235,181,0.12)"
      />
      {/* Inner glow flame */}
      <path
        d="M18 23.5C19.8 25.8 20.5 27.4 20.5 28.8C20.5 30.3 19.4 31.5 18 31.5C16.6 31.5 15.5 30.3 15.5 28.8C15.5 27.4 16.2 25.8 18 23.5Z"
        fill="currentColor"
      />
      {/* Base */}
      <path
        d="M9 34H27L23 40H13L9 34Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="rgba(232,184,75,0.18)"
      />
      <path d="M15 40H21L18 44L15 40Z" fill="currentColor" />
    </svg>
  );
}

export function CrescentStarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-gold-500', className)}
      aria-hidden="true"
    >
      <path
        d="M18.5 15.5C17.1 16.2 15.5 16.5 13.8 16.2C9.4 15.4 6.5 11.2 7.3 6.8C7.6 5.2 8.4 3.8 9.5 2.7C5.4 3.6 2.3 7.2 2.3 11.6C2.3 16.7 6.4 20.8 11.5 20.8C15.1 20.8 18.2 18.7 19.7 15.7C19.3 15.6 18.9 15.6 18.5 15.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="rgba(232,184,75,0.16)"
      />
      <path
        d="M17.5 5L18.3 6.8L20.2 7.1L18.8 8.4L19.2 10.3L17.5 9.3L15.8 10.3L16.2 8.4L14.8 7.1L16.7 6.8L17.5 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PokerChipIcon({
  className,
  label = '★',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-pill border-2 border-dashed border-gold-500 bg-surface-2 text-xs font-bold text-gold-300 shadow-glow-gold tabular-nums',
        className
      )}
    >
      {label}
    </div>
  );
}

export function GoldHairlineDivider({ className }: { className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center py-4', className)}>
      <div className="gold-hairline w-full" />
      <div className="mx-3 flex items-center gap-1.5 text-gold-500">
        <span className="text-[10px] opacity-60">♦</span>
        <CrescentStarIcon className="h-4 w-4" />
        <span className="text-[10px] opacity-60">♠</span>
      </div>
      <div className="gold-hairline w-full" />
    </div>
  );
}
