import React from 'react';
import { cn } from '@/lib/utils';

export function FanousIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-gold-400', className)}
      aria-hidden="true"
    >
      <line x1="18" y1="0" x2="18" y2="6" stroke="#4F0716" strokeWidth="2" />
      <circle cx="18" cy="8.5" r="2.5" stroke="#4F0716" strokeWidth="2" fill="#FFE899" />
      <path
        d="M11 16C11 12.5 14 11 18 11C22 11 25 12.5 25 16H11Z"
        stroke="#4F0716"
        strokeWidth="2"
        fill="#FFC12B"
      />
      <path
        d="M8 16H28L25 20H11L8 16Z"
        stroke="#4F0716"
        strokeWidth="2"
        fill="#C4163A"
      />
      <path
        d="M11 20H25L27 34H9L11 20Z"
        stroke="#4F0716"
        strokeWidth="2"
        fill="#FFF9F0"
      />
      <path
        d="M18 23.5C19.8 25.8 20.5 27.4 20.5 28.8C20.5 30.3 19.4 31.5 18 31.5C16.6 31.5 15.5 30.3 15.5 28.8C15.5 27.4 16.2 25.8 18 23.5Z"
        fill="#FF9F1C"
        stroke="#4F0716"
        strokeWidth="1.2"
      />
      <path
        d="M9 34H27L23 40H13L9 34Z"
        stroke="#4F0716"
        strokeWidth="2"
        fill="#FFC12B"
      />
      <path
        d="M15 40H21L18 44L15 40Z"
        fill="#C4163A"
        stroke="#4F0716"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function CrescentStarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-gold-400', className)}
      aria-hidden="true"
    >
      <path
        d="M18.5 15.5C17.1 16.2 15.5 16.5 13.8 16.2C9.4 15.4 6.5 11.2 7.3 6.8C7.6 5.2 8.4 3.8 9.5 2.7C5.4 3.6 2.3 7.2 2.3 11.6C2.3 16.7 6.4 20.8 11.5 20.8C15.1 20.8 18.2 18.7 19.7 15.7C19.3 15.6 18.9 15.6 18.5 15.5Z"
        stroke="#4F0716"
        strokeWidth="1.8"
        fill="#FFC12B"
      />
      <path
        d="M17.5 5L18.3 6.8L20.2 7.1L18.8 8.4L19.2 10.3L17.5 9.3L15.8 10.3L16.2 8.4L14.8 7.1L16.7 6.8L17.5 5Z"
        fill="#FFE899"
        stroke="#4F0716"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function PokerChipIcon({
  className,
  label = '★',
  tone = 'gold',
}: {
  className?: string;
  label?: string;
  tone?: 'gold' | 'red' | 'blue' | 'white';
}) {
  const toneClasses = {
    gold: 'bg-gold-400 border-outline text-red-900',
    red: 'bg-red-600 border-outline text-white',
    blue: 'bg-blue-500 border-white ring-2 ring-outline text-white',
    white: 'bg-white border-outline text-ink',
  }[tone];

  return (
    <div
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-pill border-2 shadow-sticker-sm p-0.5',
        toneClasses,
        className
      )}
    >
      <span className="flex h-full w-full items-center justify-center rounded-pill border border-dashed border-current/60 text-xs font-extrabold tabular-nums">
        {label}
      </span>
    </div>
  );
}

export function GoldHairlineDivider({ className }: { className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center py-4', className)}>
      <div className="show-hairline w-full" />
      <div className="mx-3 flex items-center gap-1.5 rounded-pill border-2 border-outline bg-white px-2.5 py-0.5 text-red-900 shadow-sticker-sm">
        <span className="text-[11px] text-red-600">♦</span>
        <CrescentStarIcon className="h-4 w-4" />
        <span className="text-[11px]">♠</span>
      </div>
      <div className="show-hairline w-full" />
    </div>
  );
}
