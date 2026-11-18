import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface ArabesqueBackgroundProps
  extends React.HTMLAttributes<HTMLDivElement> {
  opacity?: number;
  radialFade?: boolean;
  overlayOnly?: boolean;
  tone?: 'stage' | 'paper';
}

/**
 * ArabesqueBackground
 * Low-opacity geometric tessellation overlay that works subtly on Stage (white/gold)
 * or Paper (deep maroon) surfaces without competing with foreground sticker elements.
 */
export function ArabesqueBackground({
  opacity = 0.08,
  radialFade = true,
  overlayOnly = false,
  tone = 'stage',
  className,
  children,
  ...props
}: ArabesqueBackgroundProps) {
  const patternId = useId().replace(/:/g, '');
  const strokePrimary = tone === 'paper' ? '#4F0716' : '#FFE899';
  const strokeSecondary = tone === 'paper' ? '#C4163A' : '#FFFFFF';

  const patternSvg = (
    <svg
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full select-none',
        radialFade &&
          '[mask-image:radial-gradient(ellipse_85%_80%_at_50%_50%,#000_45%,transparent_100%)]'
      )}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`arabesque-${patternId}`}
          x="0"
          y="0"
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="32,4 40,24 60,32 40,40 32,60 24,40 4,32 24,24"
            fill="none"
            stroke={strokePrimary}
            strokeWidth="1.1"
          />
          <polygon
            points="12,12 32,20 52,12 44,32 52,52 32,44 12,52 20,32"
            fill="none"
            stroke={strokePrimary}
            strokeWidth="0.9"
          />
          <circle
            cx="32"
            cy="32"
            r="6"
            fill="none"
            stroke={strokeSecondary}
            strokeWidth="0.9"
          />
          <path
            d="M0,12 L12,12 L12,0 M52,0 L52,12 L64,12 M64,52 L52,52 L52,64 M12,64 L12,52 L0,52"
            fill="none"
            stroke={strokePrimary}
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#arabesque-${patternId})`} />
    </svg>
  );

  if (overlayOnly) {
    return patternSvg;
  }

  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      {patternSvg}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
