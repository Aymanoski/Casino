import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, SHADOWS } from '../designTokens';
import { FONTS } from '../fonts';
import { ROLE_RECAP_CARDS, type VideoLang } from '../storyboard';
import {
  CasinoChip,
  FloatingStageAccents,
  StickerHeading,
  SunburstBackdrop,
} from './BrandPrimitives';

/**
 * Act C (Main 16:9, 32s = 960 frames):
 * Five animated game-show cards (Admin, Scorer, Player, Big Screens, Public Fan View),
 * each displaying three clear lines: "Sees", "Does", "Is responsible for".
 * Strictly the 5 core entities (Check-in Staff & Content Manager excluded per Step 0).
 */
export const RoleRecapSequence: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const isAr = lang === 'ar';

  const cardFrames = Math.floor(durationInFrames / ROLE_RECAP_CARDS.length);
  const activeIdx = Math.min(
    ROLE_RECAP_CARDS.length - 1,
    Math.floor(frame / cardFrames)
  );
  const localFrame = frame - activeIdx * cardFrames;
  const activeCard = ROLE_RECAP_CARDS[activeIdx];

  const cardSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 140, mass: 0.9 },
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.9, 1]);
  const cardY = interpolate(cardSpring, [0, 1], [44, 0]);

  const rows = [
    {
      tag: isAr ? 'يرى' : 'SEES',
      tagBg: COLORS.blue500,
      tagFg: COLORS.white,
      text: isAr ? activeCard.seesAr : activeCard.seesEn,
      delay: 6,
    },
    {
      tag: isAr ? 'يفعل' : 'DOES',
      tagBg: COLORS.gold400,
      tagFg: COLORS.red900,
      text: isAr ? activeCard.doesAr : activeCard.doesEn,
      delay: 14,
    },
    {
      tag: isAr ? 'مسؤول عن' : 'RESPONSIBLE FOR',
      tagBg: COLORS.red600,
      tagFg: COLORS.white,
      text: isAr ? activeCard.responsibleAr : activeCard.responsibleEn,
      delay: 22,
    },
  ];

  return (
    <AbsoluteFill>
      <SunburstBackdrop />
      <FloatingStageAccents />

      <AbsoluteFill
        style={{
          padding: '54px 96px 136px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Top header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <StickerHeading lang={lang} size={58}>
            {isAr ? 'خمس زوايا · نظام واحد متكامل' : 'FIVE ROLES · ONE LIVE SYSTEM'}
          </StickerHeading>

          {/* 5-Entity progress pill bar */}
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
            }}
          >
            {ROLE_RECAP_CARDS.map((c, idx) => {
              const isActive = idx === activeIdx;
              const isPast = idx < activeIdx;
              return (
                <div
                  key={c.number}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 9999,
                    backgroundColor: isActive
                      ? COLORS.gold400
                      : isPast
                        ? COLORS.paper
                        : 'rgba(79, 7, 22, 0.65)',
                    color: isActive || isPast ? COLORS.red900 : COLORS.white,
                    border: `3px solid ${COLORS.red900}`,
                    boxShadow: isActive ? SHADOWS.sticker(isAr) : undefined,
                    fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                    fontSize: 20,
                    fontWeight: 800,
                    transform: isActive ? 'scale(1.06)' : 'scale(1)',
                  }}
                >
                  {c.number} · {isAr ? c.entityAr : c.entityEn}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hero Active Role Card */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          style={{
            width: '100%',
            maxWidth: 1440,
            borderRadius: 28,
            backgroundColor: COLORS.paper,
            border: `5px solid ${COLORS.red900}`,
            boxShadow: SHADOWS.stickerLg(isAr),
            padding: '40px 52px',
            transform: `translateY(${cardY}px) scale(${cardScale})`,
            opacity: cardSpring,
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              borderBottom: `3px solid rgba(79, 7, 22, 0.14)`,
              paddingBottom: 22,
            }}
          >
            <CasinoChip label={activeCard.number} variant={activeCard.accent} size={86} />
            <div>
              <div
                style={{
                  fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                  fontSize: 19,
                  fontWeight: 800,
                  color: COLORS.red600,
                  textTransform: 'uppercase',
                  letterSpacing: isAr ? 0 : '0.12em',
                }}
              >
                {isAr ? `الكيان ${activeCard.number} من ٠٥` : `ENTITY ${activeCard.number} OF 05`}
              </div>
              <div
                style={{
                  fontFamily: isAr ? FONTS.displayAr : FONTS.displayEn,
                  fontSize: 60,
                  color: COLORS.red900,
                  lineHeight: 1.08,
                }}
              >
                {isAr ? activeCard.entityAr : activeCard.entityEn}
              </div>
            </div>
          </div>

          {/* 3 structured lines: Sees / Does / Is responsible for */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {rows.map((r) => {
              const rowEnter = spring({
                frame: Math.max(0, localFrame - r.delay),
                fps,
                config: { damping: 16, stiffness: 160 },
              });
              return (
                <div
                  key={r.tag}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 22,
                    padding: '18px 24px',
                    borderRadius: 18,
                    backgroundColor: COLORS.white,
                    border: `2.5px solid rgba(79, 7, 22, 0.16)`,
                    opacity: rowEnter,
                    transform: `translateX(${interpolate(rowEnter, [0, 1], [isAr ? 28 : -28, 0])}px)`,
                  }}
                >
                  <span
                    style={{
                      minWidth: isAr ? 170 : 250,
                      textAlign: 'center',
                      padding: '10px 18px',
                      borderRadius: 14,
                      backgroundColor: r.tagBg,
                      color: r.tagFg,
                      border: `2.5px solid ${COLORS.red900}`,
                      fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: isAr ? 0 : '0.06em',
                      flexShrink: 0,
                    }}
                  >
                    {r.tag}
                  </span>
                  <span
                    style={{
                      fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                      fontSize: 30,
                      fontWeight: 700,
                      color: COLORS.ink,
                      lineHeight: isAr ? 1.5 : 1.28,
                    }}
                  >
                    {r.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Rapid Vertical 9:16 5-Entity Recap Flash (Teaser Beat 5, 10s = 300 frames)
 */
export const TeaserFiveFlash: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';

  const punchlines = [
    {
      num: '01',
      title: isAr ? 'الإدارة' : 'ADMIN',
      line: isAr ? 'تضبط القواعد، القرعة، والتناسق ٩/٩' : 'Sets rules, draw & 9/9 integrity',
      accent: 'gold' as const,
    },
    {
      num: '02',
      title: isAr ? 'الحكم' : 'SCORER',
      line: isAr ? 'تحكيم فوري بدون أخطاء (+١ / كروت)' : 'Zero-mistake live table officiating',
      accent: 'red' as const,
    },
    {
      num: '03',
      title: isAr ? 'المتسابق' : 'PLAYER',
      line: isAr ? 'طاولته وحكمه — بدون حرق الفقرات' : 'Table # & Judge Help — surprise segments',
      accent: 'blue' as const,
    },
    {
      num: '04',
      title: isAr ? 'شاشات العرض' : 'BIG SCREENS',
      line: isAr ? 'إبهار مباشر بالقاعة والبث بالعربي والإنجليزي' : 'Live 10m arena & stream spectacle',
      accent: 'gold' as const,
    },
    {
      num: '05',
      title: isAr ? 'عرض الجمهور' : 'PUBLIC FAN VIEW',
      line: isAr ? '٢٤٠ مجموعة وشجرة ٢٥٦ مقعد لحظة بلحظة' : 'Live groups, schedule & 256-slot bracket',
      accent: 'blue' as const,
    },
  ];

  return (
    <AbsoluteFill>
      <SunburstBackdrop />
      <AbsoluteFill
        style={{
          padding: '150px 56px 390px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <StickerHeading lang={lang} size={64}>
          {isAr ? 'خمس زوايا · نظام واحد' : '5 ROLES · 1 SYSTEM'}
        </StickerHeading>

        <div
          dir={isAr ? 'rtl' : 'ltr'}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {punchlines.map((item, idx) => {
            const delay = idx * 14;
            const pop = spring({
              frame: Math.max(0, frame - delay),
              fps,
              config: { damping: 14, stiffness: 160 },
            });
            return (
              <div
                key={item.num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '22px 26px',
                  borderRadius: 22,
                  backgroundColor: COLORS.paper,
                  border: `4px solid ${COLORS.red900}`,
                  boxShadow: SHADOWS.sticker(isAr),
                  opacity: pop,
                  transform: `translateY(${interpolate(pop, [0, 1], [32, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
                }}
              >
                <CasinoChip label={item.num} variant={item.accent} size={74} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: isAr ? FONTS.displayAr : FONTS.displayEn,
                      fontSize: 40,
                      color: COLORS.red900,
                      lineHeight: 1.06,
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                      fontSize: 27,
                      fontWeight: 700,
                      color: COLORS.ink,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.line}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
