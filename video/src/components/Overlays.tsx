import React from 'react';
import {
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, SHADOWS } from '../designTokens';
import { FONTS } from '../fonts';
import type { CaptionCue, VideoLang } from '../storyboard';

/**
 * Entity Lower-Third Sticker Pill.
 * Appears on every entity screen naming the entity + one-line role description.
 * Mirrors seamlessly in Arabic RTL (`dir="rtl"`).
 */
export const EntityLowerThird: React.FC<{
  entity: string;
  roleLine: string;
  lang: VideoLang;
  vertical?: boolean;
  accent?: 'gold' | 'blue' | 'red';
}> = ({ entity, roleLine, lang, vertical = false, accent = 'gold' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';

  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 150, mass: 0.8 },
  });
  const translateX = interpolate(enter, [0, 1], [isAr ? 64 : -64, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  const badgeBg =
    accent === 'blue'
      ? COLORS.blue500
      : accent === 'red'
        ? COLORS.red600
        : COLORS.gold400;
  const badgeFg = accent === 'gold' ? COLORS.red900 : COLORS.white;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        position: 'absolute',
        top: vertical ? 148 : 28,
        left: vertical ? 44 : isAr ? undefined : 36,
        right: vertical ? 44 : isAr ? 36 : undefined,
        zIndex: 40,
        opacity,
        transform: `translateX(${translateX}px)`,
        display: 'flex',
        justifyContent: vertical ? 'center' : 'flex-start',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: vertical ? 14 : 14,
          padding: vertical ? '12px 20px' : '10px 20px',
          borderRadius: 18,
          backgroundColor: COLORS.paper,
          border: `3.5px solid ${COLORS.red900}`,
          boxShadow: SHADOWS.sticker(isAr),
          maxWidth: vertical ? 992 : 980,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: vertical ? '7px 16px' : '6px 14px',
            borderRadius: 12,
            backgroundColor: badgeBg,
            color: badgeFg,
            border: `2.5px solid ${accent === 'blue' ? COLORS.white : COLORS.red900}`,
            boxShadow: accent === 'blue' ? `0 0 0 2.5px ${COLORS.red900}` : undefined,
            fontFamily: isAr ? FONTS.displayAr : FONTS.displayEn,
            fontSize: vertical ? 28 : 24,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {entity}
        </span>
        <span
          style={{
            fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
            fontSize: vertical ? 25 : 21,
            fontWeight: 800,
            color: COLORS.ink,
            lineHeight: isAr ? 1.35 : 1.2,
          }}
        >
          {roleLine}
        </span>
      </div>
    </div>
  );
};

/**
 * Animated Focus Callout Ring + Sticker Tag pointing at exact real UI controls.
 */
export const HighlightRing: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  lang?: VideoLang;
  startFrame?: number;
  endFrame?: number;
  labelPosition?: 'top' | 'bottom';
}> = ({
  x,
  y,
  width,
  height,
  label,
  lang = 'en',
  startFrame = 0,
  endFrame = 9999,
  labelPosition = 'top',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame || frame > endFrame) return null;

  const localF = frame - startFrame;
  const pop = spring({ frame: localF, fps, config: { damping: 14, stiffness: 180 } });
  const fadeOut =
    endFrame < 9000
      ? interpolate(frame, [endFrame - 10, endFrame], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;
  const pulse = 1 + Math.sin(localF * 0.2) * 0.025;
  const isAr = lang === 'ar';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: 18,
        border: `5px solid ${COLORS.gold400}`,
        boxShadow: `0 0 0 3px ${COLORS.red900}, 0 0 26px rgba(255, 193, 43, 0.85)`,
        transform: `scale(${pop * pulse})`,
        opacity: Math.min(pop, fadeOut),
        pointerEvents: 'none',
        zIndex: 35,
      }}
    >
      {label && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          style={{
            position: 'absolute',
            [labelPosition === 'top' ? 'bottom' : 'top']: 'calc(100% + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 18px',
            borderRadius: 9999,
            backgroundColor: COLORS.gold400,
            color: COLORS.red900,
            border: `3px solid ${COLORS.red900}`,
            boxShadow: SHADOWS.sticker(isAr),
            fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
            fontSize: 22,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

/**
 * Pinned Top-End Focus Callout Pill for scrolling or multi-view screens
 * where a fixed rectangle would drift across moving UI elements.
 * Mirrors automatically in Arabic RTL so it sits opposite EntityLowerThird.
 */
export const FocusCalloutPill: React.FC<{
  label: string;
  lang?: VideoLang;
  startFrame?: number;
  endFrame?: number;
  top?: number;
}> = ({ label, lang = 'en', startFrame = 0, endFrame = 9999, top = 28 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame || frame > endFrame) return null;

  const localF = frame - startFrame;
  const enter = spring({ frame: localF, fps, config: { damping: 16, stiffness: 160 } });
  const fadeOut =
    endFrame < 9000
      ? interpolate(frame, [endFrame - 10, endFrame], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;
  const isAr = lang === 'ar';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        position: 'absolute',
        top,
        [isAr ? 'left' : 'right']: 36,
        zIndex: 42,
        opacity: Math.min(enter, fadeOut),
        transform: `translateY(${interpolate(enter, [0, 1], [-14, 0])}px)`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 22px',
          borderRadius: 9999,
          backgroundColor: COLORS.gold400,
          color: COLORS.red900,
          border: `3.5px solid ${COLORS.red900}`,
          boxShadow: SHADOWS.sticker(isAr),
          fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
          fontSize: 21,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        <span>★</span>
        <span>{label}</span>
      </div>
    </div>
  );
};

/**
 * Burned-in Bilingual Caption Pill (EN LTR or Arabic RTL).
 * Respects mobile safe margins on 9:16 vertical exports (bottom >= 260px clear).
 */
export const CaptionOverlay: React.FC<{
  cues: CaptionCue[];
  lang: VideoLang;
  vertical?: boolean;
}> = ({ cues, lang, vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  const active = cues.find(
    (c) => sec >= c.offsetSec && sec <= c.offsetSec + c.durationSec
  );
  if (!active) return null;

  const localSec = sec - active.offsetSec;
  const alphaIn = interpolate(localSec, [0, 0.18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const alphaOut = interpolate(
    localSec,
    [active.durationSec - 0.18, active.durationSec],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(alphaIn, alphaOut);
  const isAr = lang === 'ar';
  const text = isAr ? active.ar : active.en;

  return (
    <div
      style={{
        position: 'absolute',
        left: vertical ? 52 : 120,
        right: vertical ? 52 : 120,
        bottom: vertical ? 268 : 34,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 60,
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          padding: vertical ? '18px 28px' : '14px 30px',
          borderRadius: 18,
          backgroundColor: 'rgba(42, 10, 16, 0.92)',
          border: `3px solid ${COLORS.gold400}`,
          boxShadow: `0 6px 24px rgba(0, 0, 0, 0.45)`,
          color: COLORS.white,
          fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
          fontSize: vertical ? 38 : 30,
          fontWeight: 700,
          lineHeight: isAr ? 1.55 : 1.32,
          textAlign: 'center',
          maxWidth: vertical ? 976 : 1540,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * Clean real-app clip player with optional gentle Ken Burns zoom & pan.
 */
export const ClipVideo: React.FC<{
  src: string;
  startFromSec?: number;
  playbackRate?: number;
  zoomFrom?: number;
  zoomTo?: number;
  origin?: string;
  objectFit?: 'cover' | 'contain';
  style?: React.CSSProperties;
}> = ({
  src,
  startFromSec = 0,
  playbackRate = 1,
  zoomFrom = 1,
  zoomTo = 1,
  origin = '50% 50%',
  objectFit = 'cover',
  style,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const scale =
    zoomFrom === zoomTo
      ? zoomFrom
      : interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [zoomFrom, zoomTo], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: COLORS.red900,
        ...style,
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        muted
        startFrom={Math.round(startFromSec * fps)}
        playbackRate={playbackRate}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: origin,
        }}
      />
    </div>
  );
};
