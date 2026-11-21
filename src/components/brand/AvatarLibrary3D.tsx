import React from 'react';
import {
  AVATAR_3D_LIBRARY,
  getAvatar3DDefinition,
  resolveDeterministicAvatarKey,
  type Avatar3DDefinition,
  type AvatarLibraryKey,
} from '@/lib/avatars';

export {
  AVATAR_3D_LIBRARY,
  getAvatar3DDefinition,
  resolveDeterministicAvatarKey,
  type Avatar3DDefinition,
  type AvatarLibraryKey,
};

function render3DGlyph(idx: number): React.ReactNode {
  switch (idx) {
    case 1: // Golden Studio Mic
      return (
        <g>
          <rect x="24" y="13" width="16" height="23" rx="8" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.2" />
          <line x1="25" y1="20" x2="39" y2="20" stroke="#4F0716" strokeWidth="1.6" strokeOpacity="0.45" />
          <line x1="25" y1="25" x2="39" y2="25" stroke="#4F0716" strokeWidth="1.6" strokeOpacity="0.45" />
          <path d="M19 27C19 34.2 24.8 40 32 40C39.2 40 45 34.2 45 27" stroke="url(#g3d-silver)" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M32 40V50M23 50H41" stroke="url(#g3d-gold)" strokeWidth="3.4" strokeLinecap="round" />
          <ellipse cx="29" cy="18" rx="2.5" ry="4" fill="#FFFFFF" fillOpacity="0.65" />
        </g>
      );
    case 2: // Crimson Buzzer Dome
      return (
        <g>
          <ellipse cx="32" cy="46" rx="20" ry="6.5" fill="#4F0716" />
          <rect x="14" y="38" width="36" height="8" rx="4" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2" />
          <path d="M17 38C17 25 23 18 32 18C41 18 47 25 47 38Z" fill="url(#g3d-red)" stroke="#4F0716" strokeWidth="2.3" />
          <ellipse cx="27" cy="25" rx="5.5" ry="3" transform="rotate(-18 27 25)" fill="#FFFFFF" fillOpacity="0.65" />
        </g>
      );
    case 3: // Royal Ramadan Fanous
      return (
        <g>
          <circle cx="32" cy="12" r="3" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="1.8" />
          <polygon points="32,15 44,23 20,23" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2" />
          <polygon points="21,23 43,23 40,43 24,43" fill="url(#g3d-warm)" stroke="#4F0716" strokeWidth="2.2" />
          <circle cx="32" cy="33" r="5" fill="#FFFFFF" fillOpacity="0.85" />
          <polygon points="22,43 42,43 46,50 18,50" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2" />
        </g>
      );
    case 4: // Lucky Six 3D Die
      return (
        <g>
          <rect x="14" y="14" width="36" height="36" rx="8" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="2.4" />
          <circle cx="23" cy="22" r="3.1" fill="#C4163A" />
          <circle cx="41" cy="22" r="3.1" fill="#C4163A" />
          <circle cx="23" cy="32" r="3.1" fill="#4F0716" />
          <circle cx="41" cy="32" r="3.1" fill="#4F0716" />
          <circle cx="23" cy="42" r="3.1" fill="#C4163A" />
          <circle cx="41" cy="42" r="3.1" fill="#C4163A" />
        </g>
      );
    case 5: // Broadcast Headphones
      return (
        <g>
          <path d="M15 34V29C15 19.6 22.6 12 32 12C41.4 12 49 19.6 49 29V34" stroke="url(#g3d-gold)" strokeWidth="4.2" strokeLinecap="round" />
          <rect x="11" y="31" width="9" height="16" rx="4.5" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2.2" />
          <rect x="44" y="31" width="9" height="16" rx="4.5" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2.2" />
          <circle cx="32" cy="34" r="6" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2" />
        </g>
      );
    case 6: // Golden Crescent & Star
      return (
        <g>
          <path d="M36 14C25.5 14 17 22.5 17 33C17 43.5 25.5 52 36 52C40.5 52 44.6 50.4 47.8 47.7C40.2 48.2 33.8 42.2 33.8 34.4C33.8 26.8 39.8 20.8 47.2 20.8C44 16.6 40.2 14 36 14Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.2" />
          <polygon points="44,24 46,29 51,29.5 47,33 48.3,38 44,35.2 39.7,38 41,33 37,29.5 42,29" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="1.6" />
        </g>
      );
    case 7: // Champion Trophy Cup
      return (
        <g>
          <path d="M20 15H44V27C44 34 38.6 39 32 39C25.4 39 20 34 20 27V15Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.3" />
          <path d="M20 19H14C14 26 17 29 20 29M44 19H50C50 26 47 29 44 29" stroke="url(#g3d-gold)" strokeWidth="2.8" strokeLinecap="round" />
          <rect x="29" y="39" width="6" height="8" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2" />
          <rect x="21" y="47" width="22" height="5" rx="2.5" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2" />
          <ellipse cx="27" cy="22" rx="2.3" ry="5" fill="#FFFFFF" fillOpacity="0.6" />
        </g>
      );
    case 8: // Royal Spade Emblem
      return (
        <g>
          <path d="M32 12C24 22 15 27.5 15 35.5C15 41 19.4 45 24.5 45C27.5 45 30 43.5 32 41C34 43.5 36.5 45 39.5 45C44.6 45 49 41 49 35.5C49 27.5 40 22 32 12Z" fill="url(#g3d-maroon)" stroke="#4F0716" strokeWidth="2.2" />
          <polygon points="32,40 25,51 39,51" fill="url(#g3d-maroon)" stroke="#4F0716" strokeWidth="2" />
          <ellipse cx="26" cy="31" rx="2.8" ry="4.5" transform="rotate(-20 26 31)" fill="#FFFFFF" fillOpacity="0.38" />
        </g>
      );
    case 9: // Cinema Clapboard
      return (
        <g>
          <rect x="14" y="25" width="36" height="25" rx="4" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="2.3" />
          <path d="M14 17L48 13L50 21L15 25Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.2" />
          <line x1="22" y1="16" x2="26" y2="23" stroke="#4F0716" strokeWidth="2.5" />
          <line x1="32" y1="15" x2="36" y2="22" stroke="#4F0716" strokeWidth="2.5" />
          <line x1="42" y1="14" x2="46" y2="21" stroke="#4F0716" strokeWidth="2.5" />
          <polygon points="28,32 28,44 39,38" fill="#C4163A" stroke="#4F0716" strokeWidth="1.6" />
        </g>
      );
    case 10: // Electric Trivia Bolt
      return (
        <g>
          <polygon points="36,10 17,34 30,34 26,54 47,28 34,28" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.4" strokeLinejoin="round" />
          <polygon points="34,15 22,31 30,31" fill="#FFFFFF" fillOpacity="0.55" />
        </g>
      );
    case 11: // VIP Casino Chip
      return (
        <g>
          <circle cx="32" cy="32" r="19" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.4" />
          <circle cx="32" cy="32" r="14" fill="url(#g3d-red)" stroke="#4F0716" strokeWidth="1.8" strokeDasharray="4 3" />
          <polygon points="32,21 35,28 42,29 37,34 38,41 32,37.5 26,41 27,34 22,29 29,28" fill="url(#g3d-cream)" />
        </g>
      );
    case 12: // Comedy Stage Crown
      return (
        <g>
          <path d="M13 43L16 21L26 30L32 16L38 30L48 21L51 43Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.3" strokeLinejoin="round" />
          <rect x="13" y="43" width="38" height="6" rx="3" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2" />
          <circle cx="32" cy="34" r="3" fill="#C4163A" />
          <circle cx="22" cy="36" r="2.3" fill="#2F6BFF" />
          <circle cx="42" cy="36" r="2.3" fill="#2F6BFF" />
        </g>
      );
    case 13: // Golden Falcon Crest
      return (
        <g>
          <path d="M32 13L49 24L42 48L32 42L22 48L15 24Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.3" />
          <polygon points="32,19 41,28 32,37 23,28" fill="url(#g3d-red)" stroke="#4F0716" strokeWidth="1.8" />
          <circle cx="32" cy="28" r="3" fill="#FFFFFF" />
        </g>
      );
    case 14: // Clever Fox Mask
      return (
        <g>
          <polygon points="15,15 25,23 39,23 49,15 46,38 32,50 18,38" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="2.3" strokeLinejoin="round" />
          <polygon points="18,20 24,25 20,31" fill="#C4163A" />
          <polygon points="46,20 40,25 44,31" fill="#C4163A" />
          <circle cx="25" cy="33" r="2.6" fill="#4F0716" />
          <circle cx="39" cy="33" r="2.6" fill="#4F0716" />
          <polygon points="29,42 35,42 32,46" fill="#4F0716" />
        </g>
      );
    case 15: // Nile Lotus Jewel
      return (
        <g>
          <path d="M32 13C37 22 40 31 32 45C24 31 27 22 32 13Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.2" />
          <path d="M32 45C21 42 14 33 15 22C23 25 28 33 32 45Z" fill="url(#g3d-warm)" stroke="#4F0716" strokeWidth="2" />
          <path d="M32 45C43 42 50 33 49 22C41 25 36 33 32 45Z" fill="url(#g3d-warm)" stroke="#4F0716" strokeWidth="2" />
          <rect x="20" y="45" width="24" height="5" rx="2.5" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="1.8" />
        </g>
      );
    case 16: // Gold Vinyl Turntable
      return (
        <g>
          <circle cx="32" cy="32" r="19" fill="url(#g3d-maroon)" stroke="url(#g3d-gold)" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="13" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.4" />
          <circle cx="32" cy="32" r="7" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2" />
          <circle cx="32" cy="32" r="2.2" fill="#4F0716" />
        </g>
      );
    case 17: // Sudden-Death Stopwatch
      return (
        <g>
          <rect x="28" y="10" width="8" height="5" rx="2" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="1.8" />
          <circle cx="32" cy="34" r="17" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="2.4" />
          <circle cx="32" cy="34" r="13" fill="none" stroke="#C4163A" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M32 34V24M32 34L40 38" stroke="#4F0716" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="32" cy="34" r="2.6" fill="#C4163A" />
        </g>
      );
    case 18: // Showtime Starburst
      return (
        <g>
          <polygon points="32,10 37.5,24 52,25 41,35 44.5,49 32,41.5 19.5,49 23,35 12,25 26.5,24" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.3" strokeLinejoin="round" />
          <circle cx="32" cy="32" r="5.5" fill="url(#g3d-cream)" />
        </g>
      );
    case 19: // Mystery Trivia Cube
      return (
        <g>
          <polygon points="32,12 50,22 32,32 14,22" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.1" strokeLinejoin="round" />
          <polygon points="14,22 32,32 32,52 14,42" fill="url(#g3d-warm)" stroke="#4F0716" strokeWidth="2.1" strokeLinejoin="round" />
          <polygon points="50,22 32,32 32,52 50,42" fill="url(#g3d-red)" stroke="#4F0716" strokeWidth="2.1" strokeLinejoin="round" />
          <circle cx="32" cy="22" r="3.2" fill="#FFFFFF" />
        </g>
      );
    case 20: // Golden Ramadan Dallah
      return (
        <g>
          <path d="M24 22H40L38 46H26Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M24 27C17 27 14 22 14 19C18 19 21 22 24 24" fill="none" stroke="url(#g3d-gold)" strokeWidth="3" strokeLinecap="round" />
          <path d="M40 26C45 26 47 31 45 36C43 39 40 39 39 39" fill="none" stroke="url(#g3d-gold)" strokeWidth="2.8" strokeLinecap="round" />
          <polygon points="32,13 38,22 26,22" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2" />
          <rect x="23" y="46" width="18" height="4" rx="2" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="1.8" />
        </g>
      );
    case 21: // Silver Screen Reel
      return (
        <g>
          <circle cx="32" cy="32" r="18" fill="url(#g3d-silver)" stroke="#4F0716" strokeWidth="2.4" />
          <circle cx="32" cy="21" r="3.8" fill="#4F0716" />
          <circle cx="32" cy="43" r="3.8" fill="#4F0716" />
          <circle cx="21" cy="32" r="3.8" fill="#4F0716" />
          <circle cx="43" cy="32" r="3.8" fill="#4F0716" />
          <circle cx="32" cy="32" r="4" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="1.8" />
        </g>
      );
    case 22: // Diamond Shield
      return (
        <g>
          <path d="M32 11L49 18V31C49 41.5 41.5 49 32 53C22.5 49 15 41.5 15 31V18L32 11Z" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2.4" strokeLinejoin="round" />
          <polygon points="32,19 41,31 32,43 23,31" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="1.8" />
        </g>
      );
    case 23: // Stage Rocket
      return (
        <g>
          <path d="M32 11C39 18 41 28 40 41H24C23 28 25 18 32 11Z" fill="url(#g3d-cream)" stroke="#4F0716" strokeWidth="2.3" />
          <path d="M24 33L16 41L24 41Z" fill="url(#g3d-red)" stroke="#4F0716" strokeWidth="2" />
          <path d="M40 33L48 41L40 41Z" fill="url(#g3d-red)" stroke="#4F0716" strokeWidth="2" />
          <circle cx="32" cy="27" r="4.5" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="2" />
          <polygon points="28,41 36,41 32,52" fill="url(#g3d-gold)" />
        </g>
      );
    case 24: // Royal Lion Medallion
    default:
      return (
        <g>
          <circle cx="32" cy="32" r="18" fill="url(#g3d-maroon)" stroke="#4F0716" strokeWidth="2.4" />
          <polygon points="32,14 36,22 45,20 41,28 48,34 40,38 42,46 32,42 22,46 24,38 16,34 23,28 19,20 28,22" fill="url(#g3d-gold)" stroke="#4F0716" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="28" cy="30" r="2.2" fill="#4F0716" />
          <circle cx="36" cy="30" r="2.2" fill="#4F0716" />
          <polygon points="29,36 35,36 32,39.5" fill="#C4163A" />
        </g>
      );
  }
}

export interface Avatar3DArtworkProps {
  avatarKey?: string | null;
  isHost?: boolean;
  className?: string;
}

/**
 * Renders the 3D-lit SVG artwork for any of the 24 library avatars (or Marwan's Golden Seat host emblem).
 */
export const Avatar3DArtwork = React.memo(function Avatar3DArtwork({
  avatarKey,
  isHost = false,
  className,
}: Avatar3DArtworkProps) {
  const def = getAvatar3DDefinition(avatarKey);

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-full w-full'}
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id={`bg3d-${isHost ? 'host' : def.key}`}
          cx="30%"
          cy="24%"
          r="78%"
        >
          <stop offset="0%" stopColor={isHost ? '#FFE899' : def.backdropFrom} />
          <stop offset="55%" stopColor={isHost ? '#FFC12B' : def.backdropVia} />
          <stop offset="100%" stopColor={isHost ? '#E8740C' : def.backdropTo} />
        </radialGradient>
        <linearGradient id="g3d-gold" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF3B8" />
          <stop offset="40%" stopColor="#FFC12B" />
          <stop offset="80%" stopColor="#FF9F1C" />
          <stop offset="100%" stopColor="#C85A00" />
        </linearGradient>
        <linearGradient id="g3d-warm" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD54A" />
          <stop offset="50%" stopColor="#FF9F1C" />
          <stop offset="100%" stopColor="#C4163A" />
        </linearGradient>
        <linearGradient id="g3d-red" x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF758F" />
          <stop offset="45%" stopColor="#C4163A" />
          <stop offset="100%" stopColor="#4F0716" />
        </linearGradient>
        <linearGradient id="g3d-maroon" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A81233" />
          <stop offset="50%" stopColor="#7E0D26" />
          <stop offset="100%" stopColor="#2A0A10" />
        </linearGradient>
        <linearGradient id="g3d-silver" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E6EEFF" />
          <stop offset="100%" stopColor="#7FA8FF" />
        </linearGradient>
        <linearGradient id="g3d-cream" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#FFF9F0" />
          <stop offset="100%" stopColor="#FFE899" />
        </linearGradient>
      </defs>

      {/* 3D Studio Backdrop */}
      <rect
        width="64"
        height="64"
        fill={`url(#bg3d-${isHost ? 'host' : def.key})`}
      />

      {/* Ambient Top-Left Studio Rim Specular Glow */}
      <ellipse
        cx="22"
        cy="14"
        rx="22"
        ry="11"
        fill="#FFFFFF"
        fillOpacity={isHost ? '0.35' : '0.18'}
      />

      {/* Grounding Floor Shadow */}
      <ellipse
        cx="32"
        cy="54"
        rx="16"
        ry="4"
        fill="#2A0A10"
        fillOpacity="0.35"
      />

      {/* Main 3D Motif */}
      {isHost ? render3DGlyph(12) : render3DGlyph(def.number)}
    </svg>
  );
});
