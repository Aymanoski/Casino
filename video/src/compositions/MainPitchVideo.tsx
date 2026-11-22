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
import { FPS, MAIN_SCENES, type SceneSpec, type VideoLang } from '../storyboard';
import {
  CasinoChip,
  FloatingStageAccents,
  GoldenSeatBadge,
  MarqueeBulbStrip,
  OriginalCardSvg,
  OriginalDieSvg,
  StickerHeading,
  SunburstBackdrop,
} from '../components/BrandPrimitives';
import {
  OriginalLaptopFrame,
  OriginalPhoneFrame,
} from '../components/DeviceFrames';
import {
  CaptionOverlay,
  ClipVideo,
  EntityLowerThird,
  FocusCalloutPill,
  HighlightRing,
} from '../components/Overlays';
import { RoleRecapSequence } from '../components/RoleRecapSequence';

type ClipKey = keyof typeof clipsManifest.clips;

function getClip(key: ClipKey) {
  const c = clipsManifest.clips[key];
  return c ?? { path: `clips/${key}.mp4`, durationSec: 10 };
}

function getCues() {
  const raw = (
    clipsManifest as unknown as {
      cues?: {
        scorerAbsentOffsetSec?: number;
        bigWinnerOffsetSec?: number;
        impactDialogOffsetSec?: number;
        winnerFlippedOffsetSec?: number;
      };
    }
  ).cues;
  return {
    scorerAbsentOffsetSec: raw?.scorerAbsentOffsetSec ?? 75,
    bigWinnerOffsetSec: raw?.bigWinnerOffsetSec ?? 19,
    impactDialogOffsetSec: raw?.impactDialogOffsetSec ?? 19,
    winnerFlippedOffsetSec: raw?.winnerFlippedOffsetSec ?? 25,
  };
}

function fitRate(clipDur: number, slotSec: number, minRate = 0.88, maxRate = 1.65) {
  if (!clipDur || clipDur <= 0) return 1;
  if (clipDur >= slotSec) {
    return Math.min(maxRate, Math.max(1, clipDur / slotSec));
  }
  return Math.max(minRate, clipDur / slotSec);
}

const SceneAudio: React.FC<{ scene: SceneSpec; lang: VideoLang }> = ({
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
    <Sequence from={Math.round(0.25 * FPS)}>
      <Audio src={staticFile(entry.path)} volume={1.0} />
    </Sequence>
  );
};

/** ACT A — Cold Open (18s = 540 frames) */
const SceneColdOpen: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';

  const titleEnter = spring({
    frame: Math.max(0, frame - 310),
    fps,
    config: { damping: 14, stiffness: 130 },
  });

  const finalShowcase = getClip('a1-final-showcase');
  const finalBig = getClip('a1-final-bigscreen');

  return (
    <AbsoluteFill>
      {/* 0–7.5s: Real /final Showcase */}
      <Sequence durationInFrames={225}>
        <ClipVideo
          src={finalShowcase.path}
          playbackRate={fitRate(finalShowcase.durationSec, 7.5, 1, 1.35)}
          zoomFrom={1.0}
          zoomTo={1.08}
          origin="50% 42%"
        />
        <div
          style={{
            position: 'absolute',
            top: 86,
            [isAr ? 'left' : 'right']: 36,
            padding: '10px 22px',
            borderRadius: 9999,
            backgroundColor: COLORS.gold400,
            color: COLORS.red900,
            border: `3px solid ${COLORS.red900}`,
            boxShadow: SHADOWS.sticker(isAr),
            fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          {isAr ? 'رمضان ٢٠٢٧ (مواعيد مبدئية)' : 'RAMADAN 2027 · EDITABLE PLACEHOLDERS'}
        </div>
      </Sequence>

      {/* 7.5–11.5s: Real 1v1v1 Big Screen highlighting Marwan Serry's Golden Seat (exact card coords) */}
      <Sequence from={225} durationInFrames={120}>
        <ClipVideo src={finalBig.path} startFromSec={0.5} />
        <HighlightRing
          x={668}
          y={382}
          width={584}
          height={568}
          label={isAr ? 'الكرسي الذهبي · مروان سري (الاسم فقط)' : 'GOLDEN SEAT · MARWAN SERRY (NAME ONLY)'}
          lang={lang}
          startFrame={16}
          endFrame={114}
        />
      </Sequence>

      {/* 11.5–18s: Bold Original Game-Show Title Slam */}
      <Sequence from={345} durationInFrames={195}>
        <SunburstBackdrop />
        <FloatingStageAccents />
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: '0 100px 96px',
            opacity: titleEnter,
            transform: `scale(${interpolate(titleEnter, [0, 1], [0.88, 1])})`,
          }}
        >
          <div
            style={{
              width: 1120,
              padding: '20px 0 28px',
              borderRadius: 32,
              backgroundColor: 'rgba(79, 7, 22, 0.72)',
              border: `5px solid ${COLORS.gold400}`,
              boxShadow: `${SHADOWS.stickerLg(isAr)}, ${SHADOWS.goldGlow}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <MarqueeBulbStrip count={22} />
            <StickerHeading lang={lang} size={isAr ? 92 : 84} tiltDeg={-1.5}>
              {isAr ? 'كازينو الألعاب' : 'CASINO EL AL3AB'}
            </StickerHeading>
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                fontSize: isAr ? 28 : 25,
                fontWeight: 800,
                color: COLORS.white,
                letterSpacing: isAr ? 0 : '0.11em',
                textTransform: 'uppercase',
                textAlign: 'center',
                padding: '0 36px',
              }}
            >
              {isAr
                ? 'بطولة رمضان الكبرى · ٧٢٠ لاعب · ٥ زوايا مباشرة'
                : 'RAMADAN TOURNAMENT · 720 PLAYERS · 5 LIVE PERSPECTIVES'}
            </div>
            <GoldenSeatBadge lang={lang} size="md" />
            <MarqueeBulbStrip count={22} />
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

/** ACT B Bumper (2s = 60 frames) */
const SceneBumper: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 170 } });

  return (
    <AbsoluteFill>
      <SunburstBackdrop />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`,
          opacity: pop,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <OriginalDieSvg size={64} tilt={-14} />
          <CasinoChip label="1v1" variant="gold" size={88} />
          <OriginalCardSvg size={58} tilt={14} />
        </div>
        <StickerHeading lang={lang} size={isAr ? 88 : 80}>
          {isAr ? 'مباراة واحدة · خمس زوايا' : 'ONE MATCH · FIVE PERSPECTIVES'}
        </StickerHeading>
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          style={{
            padding: '12px 32px',
            borderRadius: 9999,
            backgroundColor: COLORS.paper,
            color: COLORS.red900,
            border: `3.5px solid ${COLORS.red900}`,
            boxShadow: SHADOWS.sticker(isAr),
            fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          {isAr
            ? 'المجموعة ١ · مباراة ٣ · طاولة #١ — عمر حسن ضد مصطفى جمال'
            : 'Group 1 · Match 3 · Table #1 — Omar Hassan vs. Mostafa Gamal'}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** ACT B.1 — ADMIN: Settings, Group Draw & Conflict-Free Auto-Schedule (16s = 480f) */
const SceneAdminSetup: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  const sClip = getClip('b1-admin-settings');
  const gClip = getClip('b1-admin-groups');
  const mClip = getClip('b1-admin-schedule');

  return (
    <AbsoluteFill>
      <SunburstBackdrop dark />

      {/* 0–5.5s: /admin/settings inside original Laptop Frame */}
      <Sequence durationInFrames={165}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 44,
          }}
        >
          <OriginalLaptopFrame width={1440}>
            <ClipVideo
              src={sClip.path}
              playbackRate={fitRate(sClip.durationSec, 5.5)}
            />
          </OriginalLaptopFrame>
        </AbsoluteFill>
        <FocusCalloutPill
          label={isAr ? '٧٢٠ لاعب · مجموعات من ٣ · تأهل الأول · ١٢ طاولة' : '720 Players · Groups of 3 · Top 1 Advances · 12 Tables'}
          lang={lang}
          startFrame={12}
          endFrame={158}
        />
      </Sequence>

      {/* 5.5–11s: /admin/groups Random Re-Draw */}
      <Sequence from={165} durationInFrames={165}>
        <ClipVideo
          src={gClip.path}
          playbackRate={fitRate(gClip.durationSec, 5.5)}
        />
        <FocusCalloutPill
          label={isAr ? 'قرعة ٢٤٠ مجموعة بضغطة واحدة' : '1-Click 240-Group Draw'}
          lang={lang}
          startFrame={10}
          endFrame={155}
        />
      </Sequence>

      {/* 11–16s: /admin/matches Auto-Schedule (Table #1 & Judge Scorer 1) */}
      <Sequence from={330} durationInFrames={150}>
        <ClipVideo
          src={mClip.path}
          playbackRate={fitRate(mClip.durationSec, 5.0)}
        />
        <FocusCalloutPill
          label={isAr ? 'طاولة #١ + الحكم ١ · جدولة بدون تعارض' : 'Table #1 + Judge Scorer 1 · Zero Conflicts'}
          lang={lang}
          startFrame={12}
          endFrame={144}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** ACT B.2 — PLAYER inside Original Phone Frame (18s = 540f) */
const ScenePlayerPhone: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';
  const clip = getClip('b2-player-phone');

  const phoneSpring = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });

  const callouts = [
    {
      start: 15,
      end: 175,
      title: isAr ? '٢٤ أفاتار 3D + رفع صورة' : '24 Original 3D Avatars + Photo Crop',
      sub: isAr
        ? 'قص مربع وضغط تلقائي أقل من ٣٠٠ كيلوبايت'
        : 'Square crop & automatic <= 300KB compression',
      chip: '24',
    },
    {
      start: 175,
      end: 365,
      title: isAr ? 'طاولة #١ · الفقرات مفاجأة' : 'TABLE #1 · Segments Stay Secret',
      sub: isAr
        ? 'يعرف منافسه وطاولته — بدون أي تسريب للفقرات القادمة'
        : 'Sees opponent & Table #1 — zero upcoming segments (repo-enforced)',
      chip: '#1',
    },
    {
      start: 365,
      end: 535,
      title: isAr ? 'كارت مساعدة الحكم + عربي RTL' : 'Judge Help Card + Arabic RTL',
      sub: isAr
        ? 'اتصال أو واتساب فوري بالحكم مع تبديل كامل للغة العربية'
        : '1-tap Call / WhatsApp to assigned Judge + live Arabic RTL',
      chip: 'AR',
    },
  ];

  const activeCallout =
    callouts.find((c) => frame >= c.start && frame < c.end) ?? callouts[0];

  return (
    <AbsoluteFill>
      <SunburstBackdrop />
      <FloatingStageAccents />

      <AbsoluteFill
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 88,
          padding: '84px 100px 124px',
        }}
      >
        {/* Original logo-free Phone Frame */}
        <div
          style={{
            transform: `translateY(${interpolate(phoneSpring, [0, 1], [50, 0])}px)`,
            opacity: phoneSpring,
          }}
        >
          <OriginalPhoneFrame width={422}>
            <ClipVideo
              src={clip.path}
              playbackRate={fitRate(clip.durationSec, 18, 0.9, 1.4)}
              objectFit="cover"
            />
          </OriginalPhoneFrame>
        </div>

        {/* Descriptive Feature Stack beside the Phone */}
        <div
          style={{
            width: 760,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <StickerHeading lang={lang} size={56} align={isAr ? 'right' : 'left'}>
            {isAr ? 'بوابة المتسابق على الموبايل' : 'THE PLAYER PHONE VIEW'}
          </StickerHeading>

          {callouts.map((c, idx) => {
            const isActive = c === activeCallout;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '22px 26px',
                  borderRadius: 22,
                  backgroundColor: isActive ? COLORS.paper : 'rgba(255, 249, 240, 0.82)',
                  border: `4px solid ${isActive ? COLORS.gold400 : COLORS.red900}`,
                  boxShadow: isActive
                    ? `0 0 0 3px ${COLORS.red900}, ${SHADOWS.sticker(isAr)}`
                    : SHADOWS.sticker(isAr),
                  transform: isActive ? 'scale(1.03)' : 'scale(0.98)',
                  opacity: isActive ? 1 : 0.72,
                }}
              >
                <CasinoChip
                  label={c.chip}
                  variant={isActive ? 'gold' : 'white'}
                  size={68}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                      fontSize: 28,
                      fontWeight: 800,
                      color: COLORS.red900,
                    }}
                  >
                    {c.title}
                  </span>
                  <span
                    style={{
                      fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                      fontSize: 21,
                      fontWeight: 600,
                      color: COLORS.inkMuted,
                      lineHeight: 1.38,
                    }}
                  >
                    {c.sub}
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

/** ACT B.3 — SCORER: 1v1 Console v2 (20s = 600f) — 4 crisp rhythmic beats at natural speed */
const SceneScorerConsole: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  const clip = getClip('b3-scorer-console');
  const clipsMap = clipsManifest.clips as Record<string, { path: string; durationSec: number }>;
  const contactClip = clipsMap['b3-scorer-contact'];
  const cues = getCues();

  return (
    <AbsoluteFill>
      {/* Beat 1 (0–4.5s): Late Player Contact Dialog (exact DOM-measured modal coords) */}
      <Sequence durationInFrames={135}>
        <ClipVideo
          src={contactClip ? contactClip.path : clip.path}
          startFromSec={contactClip ? 0 : Math.max(0, (cues as Record<string, number>).scorerContactOffsetSec ?? 12.2)}
          playbackRate={contactClip ? fitRate(contactClip.durationSec, 4.5, 0.9, 1.25) : 1.15}
        />
        <HighlightRing
          x={732}
          y={265}
          width={456}
          height={550}
          label={isAr ? 'تواصل مع اللاعب المتأخر · مسجل في المراجعة' : 'Late Player Contact · Logged in Audit'}
          lang={lang}
          startFrame={42}
          endFrame={130}
        />
      </Sequence>

      {/* Beat 2 (4.5–10s): Buzzed First + +1 + -1 + Compensating Undo (exact Omar card coords) */}
      <Sequence from={135} durationInFrames={165}>
        <ClipVideo src={clip.path} startFromSec={26.0} playbackRate={1.85} />
        <HighlightRing
          x={384}
          y={468}
          width={712}
          height={498}
          label={isAr ? 'ضغط الجرس · +١ · −١ · تراجع بدون حذف السجل' : 'Buzzed First · +1 · −1 · Compensating Undo'}
          lang={lang}
          startFrame={14}
          endFrame={155}
        />
      </Sequence>

      {/* Beat 3 (10–16s): Yellow card (-1) & Red card (-2) (exact Mostafa card coords) */}
      <Sequence from={300} durationInFrames={180}>
        <ClipVideo src={clip.path} startFromSec={61.5} playbackRate={1.9} />
        <HighlightRing
          x={1108}
          y={468}
          width={720}
          height={498}
          label={isAr ? 'بطاقة صفراء (−١) وبطاقة حمراء (−٢) بأيقونات كروت حقيقية' : 'Yellow (−1) & Red (−2) Cards · Real Card Icons'}
          lang={lang}
          startFrame={14}
          endFrame={170}
        />
      </Sequence>

      {/* Beat 4 (16–20s): Mark Absent Confirmation Dialog (exact centered ConfirmDialog coords) */}
      <Sequence from={480} durationInFrames={120}>
        <ClipVideo
          src={clip.path}
          startFromSec={Math.max(0, cues.scorerAbsentOffsetSec)}
          playbackRate={1.0}
        />
        <HighlightRing
          x={700}
          y={372}
          width={520}
          height={336}
          label={isAr ? 'تسجيل الغياب = فوز انسحابي فوري في ١ ضد ١' : 'Mark Absent = Immediate 1v1 Walkover (with Confirm)'}
          lang={lang}
          startFrame={18}
          endFrame={112}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** ACT B.3b — SPLIT-SCREEN MONEY SHOT: Scorer + Big Screen + Fan View in Real Sync (10s = 300f) */
const SceneSplitMoneyShot: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const isAr = lang === 'ar';

  const scorerClip = getClip('b3b-sync-scorer');
  const bigClip = getClip('b3b-sync-bigscreen');
  const fanClip = getClip('b3b-sync-fan');

  // Pulse indicator right around the synchronized tap beat
  const pulseGlow = 0.5 + 0.5 * Math.sin(frame * 0.35);

  return (
    <AbsoluteFill>
      <SunburstBackdrop dark />

      {/* 3 Synchronized Real-App Live Feeds */}
      <AbsoluteFill
        style={{
          padding: '104px 36px 118px',
          display: 'flex',
          flexDirection: 'row',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT PANE (46%): Scorer Console */}
        <div
          style={{
            flex: '0 0 46%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              padding: '6px 18px',
              borderRadius: 9999,
              backgroundColor: COLORS.red600,
              color: COLORS.white,
              border: `3px solid ${COLORS.red900}`,
              fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {isAr ? '١ · لوحة الحكم (ضغطة مباشرة)' : '1 · SCORER CONSOLE (LIVE TAP)'}
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: 20,
              overflow: 'hidden',
              border: `4px solid ${COLORS.gold400}`,
              boxShadow: `0 0 ${14 + pulseGlow * 18}px rgba(255, 193, 43, 0.7), ${SHADOWS.sticker(false)}`,
            }}
          >
            <ClipVideo
              src={scorerClip.path}
              playbackRate={fitRate(scorerClip.durationSec, 10, 0.72, 1.05)}
              objectFit="cover"
            />
          </div>
        </div>

        {/* RIGHT COLUMN (54%): Top = Big Screen, Bottom = Fan Phone + Live Sync Badge */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Top-Right: Venue Big Screen */}
          <div
            style={{
              flex: '0 0 58%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '6px 18px',
                borderRadius: 9999,
                backgroundColor: COLORS.gold400,
                color: COLORS.red900,
                border: `3px solid ${COLORS.red900}`,
                fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {isAr ? '٢ · شاشة العرض العملاقة (رد فعل لحظي)' : '2 · VENUE BIG SCREEN (INSTANT REACTION)'}
            </div>
            <div
              style={{
                flex: 1,
                borderRadius: 20,
                overflow: 'hidden',
                border: `4px solid ${COLORS.gold400}`,
                boxShadow: `0 0 ${16 + pulseGlow * 22}px rgba(255, 193, 43, 0.8), ${SHADOWS.sticker(false)}`,
              }}
            >
              <ClipVideo
                src={bigClip.path}
                playbackRate={fitRate(bigClip.durationSec, 10, 0.72, 1.05)}
                objectFit="cover"
              />
            </div>
          </div>

          {/* Bottom-Right: Public Fan View (same BrowserContext!) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                alignItems: 'center',
                gap: 10,
                padding: '6px 18px',
                borderRadius: 9999,
                backgroundColor: COLORS.blue500,
                color: COLORS.white,
                border: `3px solid ${COLORS.white}`,
                boxShadow: `0 0 0 2.5px ${COLORS.red900}`,
                fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              <span>●</span>
              <span>
                {isAr
                  ? '٣ · عرض الجمهور المباشر (تحديث تلقائي بدون Refresh)'
                  : '3 · PUBLIC FAN VIEW (LIVE SYNC · ZERO REFRESH)'}
              </span>
            </div>
            <div
              style={{
                flex: 1,
                borderRadius: 20,
                overflow: 'hidden',
                border: `4px solid ${COLORS.white}`,
                boxShadow: `0 0 0 3px ${COLORS.blue500}, ${SHADOWS.sticker(false)}`,
                backgroundColor: COLORS.paper,
              }}
            >
              <ClipVideo
                src={fanClip.path}
                playbackRate={fitRate(fanClip.durationSec, 10, 0.72, 1.05)}
                objectFit="cover"
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** ACT B.4 — BIG SCREEN: Tie-Break, Arabic RTL, Winner Moment & Leaderboard (16s = 480f) */
const SceneBigScreen: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  const tieWin = getClip('b4-bigscreen-tiebreak-win');
  const lb = getClip('b4-bigscreen-leaderboard');
  const cues = getCues();

  return (
    <AbsoluteFill>
      {/* 0–6s: Sudden-Death Tie-Breaker #16 + Arabic RTL Flip */}
      <Sequence durationInFrames={180}>
        <ClipVideo
          src={tieWin.path}
          startFromSec={11.0}
          playbackRate={1.35}
        />
        <FocusCalloutPill
          label={isAr ? 'التعادل ممنوع ← جولة حسم تلقائية + عربي RTL' : 'Draws Forbidden → Auto Tie-Breaker #16 + Arabic RTL'}
          lang={lang}
          startFrame={12}
          endFrame={172}
        />
      </Sequence>

      {/* 6–11.5s: Deciding +1 -> Victory Stage Winner Celebration! */}
      <Sequence from={180} durationInFrames={165}>
        <ClipVideo
          src={tieWin.path}
          startFromSec={Math.max(0, cues.bigWinnerOffsetSec)}
          playbackRate={1.15}
          zoomFrom={1.0}
          zoomTo={1.04}
        />
      </Sequence>

      {/* 11.5–16s: Live Venue Leaderboard (/screen/leaderboard) */}
      <Sequence from={345} durationInFrames={135}>
        <ClipVideo
          src={lb.path}
          playbackRate={fitRate(lb.durationSec, 4.5)}
          zoomFrom={1.0}
          zoomTo={1.05}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** ACT B.5 — PUBLIC FAN VIEW: Phone (Groups & Schedule) + Laptop (256-Slot Bracket & 16 BYEs) (12s = 360f) */
const SceneFanView: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  const phoneClip = getClip('b5-fan-phone');
  const bracketClip = getClip('b5-fan-bracket');

  return (
    <AbsoluteFill>
      <SunburstBackdrop />
      <FloatingStageAccents />

      {/* Dual Device Showcase: Phone + Laptop */}
      <AbsoluteFill
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 54,
          padding: '84px 60px 118px',
        }}
      >
        <OriginalPhoneFrame width={356}>
          <ClipVideo
            src={phoneClip.path}
            playbackRate={fitRate(phoneClip.durationSec, 12, 0.9, 1.4)}
          />
        </OriginalPhoneFrame>

        <OriginalLaptopFrame width={1260}>
          <ClipVideo
            src={bracketClip.path}
            playbackRate={fitRate(bracketClip.durationSec, 12, 0.85, 1.4)}
            zoomFrom={1.0}
            zoomTo={1.05}
            origin="48% 55%"
          />
        </OriginalLaptopFrame>
      </AbsoluteFill>

      <FocusCalloutPill
        label={isAr ? 'شجرة ٢٥٦ مقعد · ١٦ تأهل تلقائي (BYE) · تتبع المسار' : '256-Slot Zoomable Bracket · 16 BYEs · Player Path'}
        lang={lang}
        startFrame={15}
        endFrame={350}
      />
    </AbsoluteFill>
  );
};

/** ACT B.6 — BACK TO ADMIN: The Fairness Moment (18s = 540f) */
const SceneAdminFairness: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  const resAudit = getClip('b6-admin-results-audit');
  const revertClip = getClip('b6-admin-revert-impact');
  const consClip = getClip('b6-admin-consistency');
  const cues = getCues();

  return (
    <AbsoluteFill>
      {/* 0–5s: Timestamped Results Feed ("Yellow card −1") + Audit Log */}
      <Sequence durationInFrames={150}>
        <ClipVideo
          src={resAudit.path}
          playbackRate={fitRate(resAudit.durationSec, 5.0, 1.0, 2.2)}
        />
        <FocusCalloutPill
          label={isAr ? 'نتائج مرتبة بالوقت والتاريخ · "بطاقة صفراء (−١)"' : 'Timestamped Feed · "Yellow card (−1)" & Audit Diff'}
          lang={lang}
          startFrame={12}
          endFrame={144}
        />
      </Sequence>

      {/* 5–9.5s: Revert Red Card -> REAL ImpactPreviewDialog (exact centered modal coords) */}
      <Sequence from={150} durationInFrames={135}>
        <ClipVideo
          src={revertClip.path}
          startFromSec={Math.max(0, cues.impactDialogOffsetSec - 0.8)}
          playbackRate={1.05}
        />
        <HighlightRing
          x={622}
          y={175}
          width={676}
          height={730}
          label={isAr ? 'معاينة الأثر: حماية الجولات التي بدأت بالفعل!' : 'Impact Preview: Protects Live Downstream Match!'}
          lang={lang}
          startFrame={18}
          endFrame={128}
        />
      </Sequence>

      {/* 9.5–13.8s: Winner Tag Flips (Omar -> Mostafa 5-4) + Group 1 Standings Flip Mostafa #1! */}
      <Sequence from={285} durationInFrames={129}>
        <ClipVideo
          src={revertClip.path}
          startFromSec={Math.max(0, cues.winnerFlippedOffsetSec)}
          playbackRate={1.35}
        />
        <FocusCalloutPill
          label={isAr ? 'الفائز والترتيب والشجرة يتصححوا تلقائياً!' : 'Winner Tag, Group #1 & Bracket Slot Self-Correct!'}
          lang={lang}
          startFrame={8}
          endFrame={122}
        />
      </Sequence>

      {/* 13.8–18s: 9-Invariant Consistency Check (/admin/consistency) */}
      <Sequence from={414} durationInFrames={126}>
        <ClipVideo
          src={consClip.path}
          playbackRate={fitRate(consClip.durationSec, 4.2, 0.9, 1.7)}
        />
        <FocusCalloutPill
          label={isAr ? 'فحص التناسق: نجاح جميع الـ ٩ فحوصات (٠ أخطاء)' : 'ALL 9 INVARIANTS PASS · 0 Violations'}
          lang={lang}
          startFrame={10}
          endFrame={120}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** ACT D — MARWAN'S MOMENT: Live 1v1v1 Grand Final (16s = 480f) */
const SceneMarwanFinal: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  const finalShowcase = getClip('a1-final-showcase');
  const finalBig = getClip('a1-final-bigscreen');

  return (
    <AbsoluteFill>
      {/* 0–5.5s: /final 3-seat showcase */}
      <Sequence durationInFrames={165}>
        <ClipVideo
          src={finalShowcase.path}
          startFromSec={1.5}
          playbackRate={1.1}
          zoomFrom={1.03}
          zoomTo={1.09}
        />
      </Sequence>

      {/* 5.5–16s: Live 1v1v1 Grand Final Big Screen (EN + AR RTL!) — exact Golden Seat ring */}
      <Sequence from={165} durationInFrames={315}>
        <ClipVideo
          src={finalBig.path}
          playbackRate={fitRate(finalBig.durationSec, 10.5, 0.9, 1.3)}
        />
        <HighlightRing
          x={668}
          y={382}
          width={584}
          height={568}
          label={isAr ? 'مروان سري في الوسط · ضيف شرف معزول عن الترتيب' : 'Marwan Serry Centered · Guest Participant (Name Only)'}
          lang={lang}
          startFrame={20}
          endFrame={220}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** ACT E — CLOSE: Placeholder Sponsor Tiers & Closing CTA (14s = 420f) */
const SceneCloseCta: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';
  const sponsors = getClip('e1-sponsors');

  const ctaSpring = spring({
    frame: Math.max(0, frame - 210),
    fps,
    config: { damping: 14, stiffness: 130 },
  });

  return (
    <AbsoluteFill>
      {/* 0–7s: /sponsors clearly labeled placeholder tiers */}
      <Sequence durationInFrames={210}>
        <ClipVideo
          src={sponsors.path}
          playbackRate={fitRate(sponsors.durationSec, 7.0, 0.9, 1.4)}
        />
        <div
          style={{
            position: 'absolute',
            top: 86,
            [isAr ? 'left' : 'right']: 36,
            padding: '10px 22px',
            borderRadius: 9999,
            backgroundColor: COLORS.gold400,
            color: COLORS.red900,
            border: `3px solid ${COLORS.red900}`,
            boxShadow: SHADOWS.sticker(isAr),
            fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          {isAr ? 'باقات رعاية مبدئية · بدون أسعار ثابتة' : 'PLACEHOLDER SPONSOR TIERS · CONTACT US'}
        </div>
      </Sequence>

      {/* 7–14s: Bold Gold-Framed Closing CTA Card */}
      <Sequence from={210} durationInFrames={210}>
        <SunburstBackdrop />
        <FloatingStageAccents />
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 120px 120px',
            opacity: ctaSpring,
            transform: `scale(${interpolate(ctaSpring, [0, 1], [0.9, 1])})`,
          }}
        >
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            style={{
              width: 1240,
              padding: '32px 54px 36px',
              borderRadius: 34,
              backgroundColor: 'rgba(79, 7, 22, 0.85)',
              border: `5px solid ${COLORS.gold400}`,
              boxShadow: `${SHADOWS.stickerLg(isAr)}, ${SHADOWS.goldGlow}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 22,
              textAlign: 'center',
            }}
          >
            <MarqueeBulbStrip count={24} />
            <StickerHeading lang={lang} size={isAr ? 86 : 78}>
              {isAr ? 'الكرسي الذهبي مستنّيك' : 'TAKE THE GOLDEN SEAT'}
            </StickerHeading>
            <GoldenSeatBadge lang={lang} size="md" />
            <div
              style={{
                fontFamily: isAr ? FONTS.bodyAr : FONTS.bodyEn,
                fontSize: 26,
                fontWeight: 700,
                color: COLORS.white,
              }}
            >
              {isAr
                ? 'كازينو الألعاب — بطولة رمضان ٢٠٢٧ (المواعيد والمكان والباقات مبدئية وقابلة للتعديل)'
                : 'Casino El Al3ab — Ramadan 2027 (Dates, Venue & Sponsor Tiers are Editable Placeholders)'}
            </div>
            <div
              style={{
                padding: '12px 30px',
                borderRadius: 9999,
                backgroundColor: COLORS.paper,
                color: COLORS.red900,
                border: `3px solid ${COLORS.red900}`,
                fontFamily: FONTS.bodyEn,
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              partnerships@casinoelal3ab-demo.com · {isAr ? 'تواصل مبدئي' : 'Placeholder Contact'}
            </div>
            <MarqueeBulbStrip count={24} />
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export const MainPitchVideo: React.FC<{ lang: VideoLang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Duck background music cleanly during narration and rise during open/bumper/close!
  const isBumperOrOutro =
    (frame >= 18 * FPS && frame < 20 * FPS) ||
    frame < 0.8 * FPS ||
    frame > durationInFrames - 3.5 * FPS;
  const musicVol = interpolate(
    frame,
    [0, 30, durationInFrames - 60, durationInFrames],
    [0.02, isBumperOrOutro ? 0.34 : 0.14, isBumperOrOutro ? 0.32 : 0.14, 0.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const renderSceneBody = (scene: SceneSpec) => {
    switch (scene.id) {
      case 'a1-cold-open':
        return <SceneColdOpen lang={lang} />;
      case 'b0-bumper':
        return <SceneBumper lang={lang} />;
      case 'b1-admin-setup':
        return <SceneAdminSetup lang={lang} />;
      case 'b2-player-phone':
        return <ScenePlayerPhone lang={lang} />;
      case 'b3-scorer-console':
        return <SceneScorerConsole lang={lang} />;
      case 'b3b-split-money-shot':
        return <SceneSplitMoneyShot lang={lang} />;
      case 'b4-big-screen':
        return <SceneBigScreen lang={lang} />;
      case 'b5-fan-view':
        return <SceneFanView lang={lang} />;
      case 'b6-admin-fairness':
        return <SceneAdminFairness lang={lang} />;
      case 'c1-role-recap':
        return <RoleRecapSequence lang={lang} />;
      case 'd1-marwan-final':
        return <SceneMarwanFinal lang={lang} />;
      case 'e1-close-cta':
        return <SceneCloseCta lang={lang} />;
      default:
        return null;
    }
  };

  // Timed subtle game-show SFX accents
  const sfxCues = [
    { sec: 18.0, file: audioManifest.sfx.whoosh, vol: 0.32 },
    { sec: 75.5, file: audioManifest.sfx.buzzer, vol: 0.36 },
    { sec: 76.7, file: audioManifest.sfx.pointPlus, vol: 0.36 },
    { sec: 84.5, file: audioManifest.sfx.tiebreakAlarm, vol: 0.34 },
    { sec: 92.2, file: audioManifest.sfx.victoryFanfare, vol: 0.42 },
    { sec: 126.2, file: audioManifest.sfx.chime, vol: 0.36 },
    { sec: 130.0, file: audioManifest.sfx.whoosh, vol: 0.3 },
    { sec: 162.0, file: audioManifest.sfx.whoosh, vol: 0.32 },
    { sec: 185.0, file: audioManifest.sfx.victoryFanfare, vol: 0.36 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.red900 }}>
      {/* Original Ramadan Game-Show Background Music Bed */}
      <Audio src={staticFile(audioManifest.music)} volume={musicVol} loop />

      {/* Crisp SFX Stings */}
      {sfxCues.map((c, idx) => (
        <Sequence key={idx} from={Math.round(c.sec * FPS)} durationInFrames={60}>
          <Audio src={staticFile(c.file)} volume={c.vol} />
        </Sequence>
      ))}

      {/* Sequential Storyboard Acts A–E */}
      {MAIN_SCENES.map((scene) => {
        const from = Math.round(scene.startSec * FPS);
        const dur = Math.round(scene.durationSec * FPS);
        const entity = lang === 'ar' ? scene.entityAr : scene.entityEn;
        const roleLine = lang === 'ar' ? scene.roleLineAr : scene.roleLineEn;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur}>
            {renderSceneBody(scene)}
            {entity && roleLine && (
              <EntityLowerThird
                entity={entity}
                roleLine={roleLine}
                lang={lang}
                accent={
                  scene.id.includes('player') || scene.id.includes('fan')
                    ? 'blue'
                    : scene.id.includes('scorer')
                      ? 'red'
                      : 'gold'
                }
              />
            )}
            <CaptionOverlay cues={scene.captions} lang={lang} />
            <SceneAudio scene={scene} lang={lang} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
