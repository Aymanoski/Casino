import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import audioManifest from '../audio-manifest.json';
import clipsManifest from '../clips-manifest.json';
import { COLORS, SHADOWS } from '../designTokens';
import { FONTS } from '../fonts';
import { FPS, TEASER_SCENES, type SceneSpec, type VideoLang } from '../storyboard';
import {
  FloatingStageAccents,
  GoldenSeatBadge,
  MarqueeBulbStrip,
  StickerHeading,
  SunburstBackdrop,
} from '../components/BrandPrimitives';
import { OriginalPhoneFrame } from '../components/DeviceFrames';
import {
  CaptionOverlay,
  ClipVideo,
  EntityLowerThird,
} from '../components/Overlays';
import { TeaserFiveFlash } from '../components/RoleRecapSequence';

type ClipKey = keyof typeof clipsManifest.clips;

function getClip(key: ClipKey) {
  const c = clipsManifest.clips[key];
  return c ?? { path: `clips/${key}.mp4`, durationSec: 10 };
}

function fitRate(clipDur: number, slotSec: number, minRate = 0.85, maxRate = 1.65) {
  if (!clipDur || clipDur <= 0) return 1;
  if (clipDur >= slotSec) {
    return Math.min(maxRate, Math.max(1, clipDur / slotSec));
  }
  return Math.max(minRate, clipDur / slotSec);
}

const TeaserAudio: React.FC<{ scene: SceneSpec; lang: VideoLang }> = ({
  scene,
  lang,
}) => {
  const map = audioManifest.narration[lang] as Record<
    string,
    { path: string; durationSec: number }
  >;
  const entry = map?.[scene.id];
  if (!entry?.path) return null;
  return (
    <Sequence from={Math.round(0.2 * FPS)}>
      <Audio src={staticFile(entry.path)} volume={1.0} />
    </Sequence>
  );
};

/** 9:16 Safe Vertical Frame Card Helper */
const VerticalWindowCard: React.FC<{
  label: string;
  lang: VideoLang;
  accent?: 'gold' | 'red' | 'blue';
  height: number;
  children: React.ReactNode;
}> = ({ label, lang, accent = 'gold', height, children }) => {
  const isAr = lang === 'ar';
  const bg =
    accent === 'red'
      ? COLORS.red600
      : accent === 'blue'
        ? COLORS.blue500
        : COLORS.gold400;
  const fg = accent === 'gold' ? COLORS.red900 : COLORS.white;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          alignSelf: isAr ? 'flex-end' : 'flex-start',
          padding: '8px 20px',
          borderRadius: 9999,
          backgroundColor: bg,
          color: fg,
          border: `3px solid ${COLORS.red900}`,
          fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: '100%',
          height,
          borderRadius: 24,
          overflow: 'hidden',
          border: `4px solid ${COLORS.gold400}`,
          boxShadow: SHADOWS.stickerLg(isAr),
          backgroundColor: COLORS.red900,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * 9:16 Vertical Teaser (1080x1920, 68s = 2040 frames).
 * Purpose-built for vertical phones with safe margins (top 140px, bottom 260px, sides 52px).
 */
export const TeaserVerticalVideo: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const isAr = lang === 'ar';

  const musicVol = interpolate(
    frame,
    [0, 20, durationInFrames - 45, durationInFrames],
    [0.02, 0.16, 0.16, 0.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const finalBig = getClip('a1-final-bigscreen');
  const playerPhone = getClip('b2-player-phone');
  const syncScorer = getClip('b3b-sync-scorer');
  const syncBig = getClip('b3b-sync-bigscreen');
  const tieWin = getClip('b4-bigscreen-tiebreak-win');
  const revertImpact = getClip('b6-admin-revert-impact');
  const consistency = getClip('b6-admin-consistency');
  const sponsors = getClip('e1-sponsors');

  const hookPop = spring({ frame, fps, config: { damping: 14, stiffness: 150 } });

  const renderBeat = (scene: SceneSpec) => {
    switch (scene.id) {
      case 't1-hook':
        return (
          <AbsoluteFill>
            <SunburstBackdrop />
            <FloatingStageAccents compact />
            <AbsoluteFill
              style={{
                padding: '155px 48px 445px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                transform: `scale(${interpolate(hookPop, [0, 1], [0.92, 1])})`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <StickerHeading lang={lang} size={isAr ? 88 : 78} tiltDeg={-1.5}>
                  {isAr ? 'كازينو الألعاب' : 'CASINO EL AL3AB'}
                </StickerHeading>
                <div
                  dir={isAr ? 'rtl' : 'ltr'}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 9999,
                    backgroundColor: COLORS.paper,
                    color: COLORS.red900,
                    border: `3px solid ${COLORS.red900}`,
                    fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                    fontSize: 26,
                    fontWeight: 800,
                  }}
                >
                  {isAr ? '٧٢٠ لاعب ← ٢ نهائي ← ١ كرسي ذهبي' : '720 PLAYERS → 2 FINALISTS → 1 SEAT'}
                </div>
              </div>

              <VerticalWindowCard
                label={isAr ? 'النهائي الكبير · بث مباشر' : 'GRAND FINAL · LIVE STAGE'}
                lang={lang}
                height={552}
              >
                <ClipVideo
                  src={finalBig.path}
                  startFromSec={0.5}
                  zoomFrom={1.0}
                  zoomTo={1.04}
                  origin="50% 50%"
                  objectFit="contain"
                />
              </VerticalWindowCard>

              <GoldenSeatBadge lang={lang} size="md" />
            </AbsoluteFill>
          </AbsoluteFill>
        );

      case 't2-scale-player':
        return (
          <AbsoluteFill>
            <SunburstBackdrop />
            <AbsoluteFill
              style={{
                padding: '268px 56px 390px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
              }}
            >
              <OriginalPhoneFrame width={540}>
                <ClipVideo
                  src={playerPhone.path}
                  startFromSec={3.0}
                  playbackRate={fitRate(Math.max(1, playerPhone.durationSec - 3), 11)}
                />
              </OriginalPhoneFrame>
            </AbsoluteFill>
          </AbsoluteFill>
        );

      case 't3-split-live':
        return (
          <AbsoluteFill>
            <SunburstBackdrop dark />
            <AbsoluteFill
              style={{
                padding: '275px 48px 395px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 24,
              }}
            >
              {/* Top half: Real Scorer tap */}
              <VerticalWindowCard
                label={isAr ? '١ · لوحة الحكم (١ ضد ١)' : '1 · SCORER CONSOLE (LIVE TAP)'}
                lang={lang}
                accent="red"
                height={530}
              >
                <ClipVideo
                  src={syncScorer.path}
                  playbackRate={fitRate(syncScorer.durationSec, 9, 0.72, 1.05)}
                />
              </VerticalWindowCard>

              {/* Bottom half: Big Screen simultaneous sync -> Tie-Break & Win */}
              <VerticalWindowCard
                label={isAr ? '٢ · شاشة القاعة (تزامن لحظي + حسم)' : '2 · BIG SCREEN (INSTANT SYNC + TIE-BREAK)'}
                lang={lang}
                accent="gold"
                height={530}
              >
                <Sequence durationInFrames={240}>
                  <ClipVideo
                    src={syncBig.path}
                    playbackRate={fitRate(syncBig.durationSec, 8, 0.72, 1.05)}
                  />
                </Sequence>
                <Sequence from={240} durationInFrames={180}>
                  <ClipVideo
                    src={tieWin.path}
                    startFromSec={Math.max(0, tieWin.durationSec - 6)}
                    playbackRate={1.1}
                  />
                </Sequence>
              </VerticalWindowCard>
            </AbsoluteFill>
          </AbsoluteFill>
        );

      case 't4-fairness':
        return (
          <AbsoluteFill>
            <SunburstBackdrop dark />
            <AbsoluteFill
              style={{
                padding: '280px 48px 395px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 24,
              }}
            >
              <VerticalWindowCard
                label={isAr ? 'تراجع آمن بمعاينة الأثر' : 'SAFE REVERT + IMPACT PREVIEW'}
                lang={lang}
                accent="gold"
                height={560}
              >
                <ClipVideo
                  src={revertImpact.path}
                  startFromSec={
                    (
                      clipsManifest as unknown as {
                        cues?: { impactDialogOffsetSec?: number };
                      }
                    ).cues?.impactDialogOffsetSec ?? 19
                  }
                  playbackRate={1.25}
                />
              </VerticalWindowCard>

              <VerticalWindowCard
                label={isAr ? '٩ / ٩ فحوصات تناسق سليمة' : 'ALL 9 DATA INVARIANTS PASS'}
                lang={lang}
                accent="blue"
                height={490}
              >
                <ClipVideo
                  src={consistency.path}
                  playbackRate={fitRate(consistency.durationSec, 10, 0.8, 1.2)}
                />
              </VerticalWindowCard>
            </AbsoluteFill>
          </AbsoluteFill>
        );

      case 't5-five-entities':
        return <TeaserFiveFlash lang={lang} />;

      case 't6-marwan-cta':
        return (
          <AbsoluteFill>
            <SunburstBackdrop />
            <FloatingStageAccents compact />

            {/* 0–6.5s: 1v1v1 Final + Placeholder Sponsors */}
            <Sequence durationInFrames={195}>
              <AbsoluteFill
                style={{
                  padding: '275px 48px 395px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 24,
                }}
              >
                <VerticalWindowCard
                  label={isAr ? 'النهائي الثلاثي مع مروان سري' : '1v1v1 GRAND FINAL · MARWAN SERRY'}
                  lang={lang}
                  accent="gold"
                  height={540}
                >
                  <ClipVideo
                    src={finalBig.path}
                    startFromSec={isAr ? 5.0 : 0.4}
                    zoomFrom={1.04}
                    zoomTo={1.12}
                  />
                </VerticalWindowCard>
                <VerticalWindowCard
                  label={isAr ? 'باقات رعاية مبدئية قابلة للتعديل' : 'EDITABLE PLACEHOLDER SPONSOR TIERS'}
                  lang={lang}
                  accent="blue"
                  height={510}
                >
                  <ClipVideo
                    src={sponsors.path}
                    playbackRate={fitRate(sponsors.durationSec, 6.5)}
                  />
                </VerticalWindowCard>
              </AbsoluteFill>
            </Sequence>

            {/* 6.5–14s: Bold Closing Gold CTA */}
            <Sequence from={195} durationInFrames={225}>
              <AbsoluteFill
                style={{
                  padding: '200px 56px 400px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  dir={isAr ? 'rtl' : 'ltr'}
                  style={{
                    width: '100%',
                    padding: '40px 36px',
                    borderRadius: 32,
                    backgroundColor: 'rgba(79, 7, 22, 0.86)',
                    border: `5px solid ${COLORS.gold400}`,
                    boxShadow: `${SHADOWS.stickerLg(isAr)}, ${SHADOWS.goldGlow}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 26,
                    textAlign: 'center',
                  }}
                >
                  <MarqueeBulbStrip count={14} />
                  <StickerHeading lang={lang} size={isAr ? 84 : 74}>
                    {isAr ? 'الكرسي الذهبي مستنّيك' : 'TAKE THE GOLDEN SEAT'}
                  </StickerHeading>
                  <GoldenSeatBadge lang={lang} size="md" />
                  <div
                    style={{
                      fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                      fontSize: 28,
                      fontWeight: 700,
                      color: COLORS.white,
                      lineHeight: 1.45,
                    }}
                  >
                    {isAr
                      ? 'رمضان ٢٠٢٧ (مواعيد وباقات مبدئية قابلة للتخصيص)'
                      : 'Ramadan 2027 (Editable Placeholder Dates & Sponsor Tiers)'}
                  </div>
                  <MarqueeBulbStrip count={14} />
                </div>
              </AbsoluteFill>
            </Sequence>
          </AbsoluteFill>
        );

      default:
        return null;
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.red900 }}>
      <Audio src={staticFile(audioManifest.music)} volume={musicVol} loop />

      {/* Punchy Teaser SFX */}
      <Sequence from={Math.round(21.5 * FPS)} durationInFrames={45}>
        <Audio src={staticFile(audioManifest.sfx.buzzer)} volume={0.38} />
      </Sequence>
      <Sequence from={Math.round(22.7 * FPS)} durationInFrames={45}>
        <Audio src={staticFile(audioManifest.sfx.pointPlus)} volume={0.38} />
      </Sequence>
      <Sequence from={Math.round(44.0 * FPS)} durationInFrames={45}>
        <Audio src={staticFile(audioManifest.sfx.whoosh)} volume={0.34} />
      </Sequence>
      <Sequence from={Math.round(60.5 * FPS)} durationInFrames={60}>
        <Audio src={staticFile(audioManifest.sfx.victoryFanfare)} volume={0.4} />
      </Sequence>

      {TEASER_SCENES.map((scene) => {
        const from = Math.round(scene.startSec * FPS);
        const dur = Math.round(scene.durationSec * FPS);
        const entity = lang === 'ar' ? scene.entityAr : scene.entityEn;
        const roleLine = lang === 'ar' ? scene.roleLineAr : scene.roleLineEn;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur}>
            {renderBeat(scene)}
            {entity && roleLine && (
              <EntityLowerThird
                entity={entity}
                roleLine={roleLine}
                lang={lang}
                vertical
                accent={
                  scene.id.includes('player')
                    ? 'blue'
                    : scene.id.includes('split')
                      ? 'red'
                      : 'gold'
                }
              />
            )}
            <CaptionOverlay cues={scene.captions} lang={lang} vertical />
            <TeaserAudio scene={scene} lang={lang} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
