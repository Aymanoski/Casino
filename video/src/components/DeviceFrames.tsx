import React from 'react';
import { COLORS, SHADOWS } from '../designTokens';

/**
 * Original Smartphone Device Frame (ZERO brand logos!).
 * Styled with DESIGN.md deep maroon bezel, warm gold edge rim, and hard sticker shadow.
 */
export const OriginalPhoneFrame: React.FC<{
  width: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ width, children, style }) => {
  const aspect = 844 / 390; // Exact Playwright phone viewport ratio
  const innerWidth = width - 24;
  const innerHeight = Math.round(innerWidth * aspect);
  const frameHeight = innerHeight + 28;

  return (
    <div
      style={{
        width,
        height: frameHeight,
        borderRadius: Math.round(width * 0.115),
        background: `linear-gradient(160deg, #3D0712 0%, ${COLORS.red900} 55%, #2A050D 100%)`,
        border: `4px solid ${COLORS.gold400}`,
        boxShadow: `0 0 0 4px ${COLORS.red900}, 10px 12px 0 ${COLORS.red900}, 0 24px 54px rgba(0,0,0,0.45)`,
        padding: '14px 12px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Generic top speaker pill inside bezel (zero brand markings, never overlaps screen) */}
      <div
        style={{
          position: 'absolute',
          top: 5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: Math.round(width * 0.2),
          height: 5,
          borderRadius: 9999,
          backgroundColor: '#1A0308',
          border: '1px solid rgba(255,213,74,0.4)',
          zIndex: 10,
        }}
      />
      {/* Screen viewport */}
      <div
        style={{
          width: innerWidth,
          height: innerHeight,
          borderRadius: Math.round(width * 0.082),
          overflow: 'hidden',
          backgroundColor: COLORS.paper,
          border: `2px solid ${COLORS.red900}`,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Original Laptop Device Frame (ZERO brand logos!).
 * Clean 16:9 display housing with subtle webcam dot and maroon-gold base lip.
 */
export const OriginalLaptopFrame: React.FC<{
  width: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ width, children, style }) => {
  const bezelPad = 18;
  const screenW = width - bezelPad * 2;
  const screenH = Math.round((screenW * 9) / 16);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Top display lid */}
      <div
        style={{
          width,
          padding: `${bezelPad + 6}px ${bezelPad}px ${bezelPad}px`,
          borderRadius: '22px 22px 8px 8px',
          background: `linear-gradient(180deg, #3D0712 0%, ${COLORS.red900} 100%)`,
          border: `4px solid ${COLORS.gold400}`,
          boxShadow: `0 0 0 4px ${COLORS.red900}, ${SHADOWS.soft}`,
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Subtle generic camera dot */}
        <div
          style={{
            position: 'absolute',
            top: 9,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 8,
            height: 8,
            borderRadius: '9999px',
            backgroundColor: COLORS.gold300,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            width: screenW,
            height: screenH,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: COLORS.paper,
            border: `2px solid ${COLORS.red900}`,
            position: 'relative',
          }}
        >
          {children}
        </div>
      </div>

      {/* Laptop deck lip (zero logos) */}
      <div
        style={{
          width: Math.round(width * 1.07),
          height: 22,
          borderRadius: '4px 4px 16px 16px',
          background: `linear-gradient(180deg, ${COLORS.gold300} 0%, ${COLORS.gold500} 100%)`,
          border: `3.5px solid ${COLORS.red900}`,
          borderTop: 'none',
          boxShadow: `0 8px 0 ${COLORS.red900}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: Math.round(width * 0.14),
            height: 6,
            borderRadius: 9999,
            backgroundColor: COLORS.red900,
            opacity: 0.45,
          }}
        />
      </div>
    </div>
  );
};
