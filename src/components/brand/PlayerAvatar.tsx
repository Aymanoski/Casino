'use client';

import React, { useEffect, useState } from 'react';
import type { Avatar as AvatarType } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import {
  Avatar3DArtwork,
  getAvatar3DDefinition,
  resolveDeterministicAvatarKey,
} from './AvatarLibrary3D';

export interface PlayerAvatarProps {
  name: string;
  /** Optional player ID for deterministic 24-avatar fallback assignment */
  playerId?: string;
  avatarSeed?: string;
  /** Player.avatar object ({ photoUrl, avatarKey }) */
  avatar?: AvatarType | null;
  /** Direct photo URL override */
  photoUrl?: string | null;
  /** Direct 3D avatar key override ('avatar-01'..'avatar-24') */
  avatarKey?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** True for Marwan Serry guest finalist (strictly name-only Golden Seat emblem, never a photo) */
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

/**
 * Shared Avatar / PlayerAvatar component (AGENTS.md §15.3 & DESIGN.md §6)
 * Used everywhere across scoreboards, bracket, groups, big screen, admin, scorer, and player portal:
 * - Renders the player's square-cropped uploaded photo (`<= 300KB`) when present (except Marwan Serry, who is always name-only)
 * - Falls back to the deterministic 24-option 3D-style game-show avatar library (`avatar-01`..`avatar-24`)
 * - Wrapped in the signature thick outlined ring with buzzed/selected/host states and optional rank chip
 */
export const PlayerAvatar = React.memo(function PlayerAvatar({
  name,
  playerId,
  avatarSeed,
  avatar,
  photoUrl,
  avatarKey,
  size = 'md',
  isHost = false,
  buzzed = false,
  selected = false,
  rank,
  className,
}: PlayerAvatarProps) {
  const candidatePhotoUrl = isHost
    ? null
    : (avatar?.photoUrl ?? photoUrl ?? null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [candidatePhotoUrl]);

  const resolvedKey = resolveDeterministicAvatarKey(
    playerId || avatarSeed || name || 'player-1',
    avatar?.avatarKey ?? avatarKey
  );
  const def = getAvatar3DDefinition(resolvedKey);
  const dims = SIZE_CLASSES[size];
  const showPhoto = Boolean(candidatePhotoUrl && !imgFailed && !isHost);

  return (
    <div
      data-avatar-key={isHost ? 'golden-seat-host' : resolvedKey}
      data-has-photo={showPhoto ? 'true' : 'false'}
      title={isHost ? name : `${name} (${def.nameEn})`}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-pill select-none',
        dims.box,
        className
      )}
    >
      {/* Thick Outlined Ring */}
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-pill border-[2.5px] bg-red-900 transition-[box-shadow,border-color] duration-200',
          isHost
            ? 'border-outline ring-2 ring-gold-300 shadow-glow-gold'
            : buzzed
              ? 'border-outline ring-[3px] ring-gold-300 shadow-glow-gold'
              : selected
                ? 'border-white ring-[3px] ring-blue-500 shadow-sticker-sm'
                : 'border-outline shadow-sticker-sm'
        )}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidatePhotoUrl!}
            alt={name}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Avatar3DArtwork
            avatarKey={resolvedKey}
            isHost={isHost}
            className="h-full w-full"
          />
        )}
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
});

/** Shared Avatar alias per Change Request 1 Step 4 */
export const Avatar = PlayerAvatar;
