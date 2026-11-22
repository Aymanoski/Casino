import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, SHADOWS } from '../designTokens';
import { FONTS } from '../fonts';
import {
  CasinoChip,
  GoldenSeatBadge,
  MarqueeBulbStrip,
  OriginalCardSvg,
  OriginalDieSvg,
  RamadanLanternSvg,
  StickerHeading,
  SunburstBackdrop,
} from '../components/BrandPrimitives';

/**
 * 1920x1080 Pitch Video Thumbnail Still (`out/thumbnail-16x9.png`).
 * Brand-safe: original sunburst, dice, cards, chips, Ramadan lanterns,
 * and Marwan Serry's Golden Seat strictly as text (ZERO photos, ZERO real show logo).
 */
export const ThumbnailStill: React.FC = () => {
  return (
    <AbsoluteFill>
      <SunburstBackdrop speedDegPerFrame={0} />

      {/* Corner Ramadan Lanterns & Original Dice/Card Motifs */}
      <div style={{ position: 'absolute', top: 36, left: 68 }}>
        <RamadanLanternSvg size={72} sway={-4} />
      </div>
      <div style={{ position: 'absolute', top: 36, right: 68 }}>
        <RamadanLanternSvg size={72} sway={4} />
      </div>
      <div style={{ position: 'absolute', bottom: 72, left: 76 }}>
        <OriginalDieSvg size={94} tilt={-16} />
      </div>
      <div style={{ position: 'absolute', bottom: 68, right: 76 }}>
        <OriginalCardSvg size={86} tilt={15} />
      </div>

      <AbsoluteFill
        style={{
          padding: '62px 130px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <MarqueeBulbStrip count={26} />

        {/* Center Hero Lockup */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 26,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <CasinoChip label="720" variant="gold" size={92} />
            <div
              style={{
                padding: '12px 28px',
                borderRadius: 9999,
                backgroundColor: COLORS.paper,
                color: COLORS.red900,
                border: `4px solid ${COLORS.red900}`,
                boxShadow: SHADOWS.sticker(false),
                fontFamily: FONTS.bodyEn,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '0.08em',
              }}
            >
              RAMADAN 2027 · LIVE TOURNAMENT PLATFORM
            </div>
            <CasinoChip label="5X" variant="blue" size={92} />
          </div>

          <StickerHeading lang="en" size={118} tiltDeg={-1.5}>
            CASINO EL AL3AB
          </StickerHeading>

          <div
            style={{
              fontFamily: FONTS.bodyEn,
              fontSize: 36,
              fontWeight: 800,
              color: COLORS.white,
              textShadow: `0 4px 0 ${COLORS.red900}`,
            }}
          >
            ADMIN · SCORER · PLAYER · BIG SCREENS · PUBLIC FAN VIEW
          </div>

          <GoldenSeatBadge lang="en" size="lg" />
        </div>

        <MarqueeBulbStrip count={26} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
