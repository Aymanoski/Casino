#!/usr/bin/env node
/**
 * Audio Asset Pipeline for Casino El Al3ab Pitch Video (`video/scripts/generate-audio.mjs`)
 *
 * Generates:
 * 1. Studio-grade Neural TTS Narration in BOTH English (`en-US-AndrewNeural`) AND
 *    Egyptian Arabic (`ar-EG-ShakirNeural`) for every Main & Teaser scene, with automatic
 *    drop-in support: if you record your own voice and save `<sceneId>.mp3` or `<sceneId>.wav`
 *    into `video/public/audio/narration/custom/{en,ar}/`, this script automatically uses YOUR
 *    recording instead of TTS!
 * 2. 100% original synthesized royalty-free Ramadan TV Game-Show Background Music
 *    (`video/public/audio/music/gameshow-ramadan-bed.wav` — warm pentatonic/Hijaz groove,
 *    darbuka-inspired percussive pulse, upbeat bass & game-show chord stabs).
 * 3. 100% original synthesized royalty-free UI & Game-Show SFX:
 *    `buzzer.wav`, `point-plus.wav`, `point-minus.wav`, `card-whistle.wav`,
 *    `whoosh.wav`, `tiebreak-alarm.wav`, `victory-fanfare.wav`, `chime.wav`.
 * 4. Measures exact audio durations and writes `video/src/audio-manifest.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFfmpeg, findFfprobe } from './bin-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(__dirname, '..');
const PUBLIC_AUDIO = path.join(VIDEO_ROOT, 'public', 'audio');
const NARRATION_DIR = path.join(PUBLIC_AUDIO, 'narration');
const CUSTOM_NARRATION_DIR = path.join(NARRATION_DIR, 'custom');
const MUSIC_DIR = path.join(PUBLIC_AUDIO, 'music');
const SFX_DIR = path.join(PUBLIC_AUDIO, 'sfx');
const FORCE_TTS = process.argv.includes('--force');

for (const d of [
  path.join(NARRATION_DIR, 'en'),
  path.join(NARRATION_DIR, 'ar'),
  path.join(CUSTOM_NARRATION_DIR, 'en'),
  path.join(CUSTOM_NARRATION_DIR, 'ar'),
  MUSIC_DIR,
  SFX_DIR,
]) {
  fs.mkdirSync(d, { recursive: true });
}

const FFMPEG = findFfmpeg(VIDEO_ROOT);
const FFPROBE = findFfprobe(VIDEO_ROOT);

function getAudioDurationSec(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  try {
    if (FFPROBE) {
      const out = execFileSync(
        FFPROBE,
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          filePath,
        ],
        { encoding: 'utf8' }
      ).trim();
      const val = parseFloat(out);
      if (Number.isFinite(val)) return val;
    }
    // Fallback parse from ffmpeg -i stderr
    try {
      execFileSync(FFMPEG, ['-i', filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      const stderr = String(err.stderr || '');
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

// Parse storyboard scenes cleanly using TypeScript compiler API or regex-free dynamic eval via node
// Node 24 supports native TS stripping (`--experimental-strip-types`), or we import via ts!
// Even simpler: parse storyboard.ts via dynamic import (Node 24 natively imports .ts files!).
const storyboard = await import('../src/storyboard.ts');
const ALL_SCENES = [
  ...storyboard.MAIN_SCENES.map((s) => ({ ...s, format: 'main' })),
  ...storyboard.TEASER_SCENES.map((s) => ({ ...s, format: 'teaser' })),
];

// ============================================================================
// 1. PURE PCM WAV WRITER & ORIGINAL PROCEDURAL MUSIC / SFX SYNTHESIS
//    (100% original code — zero external copyrighted samples!)
// ============================================================================

const SAMPLE_RATE = 44100;

function writeWavStereo(filePath, leftFloat, rightFloat) {
  const numFrames = leftFloat.length;
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = numFrames * blockAlign;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-0.98, Math.min(0.98, leftFloat[i]));
    const r = Math.max(-0.98, Math.min(0.98, rightFloat[i]));
    buf.writeInt16LE(Math.round(l * 32767), offset);
    buf.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }
  fs.writeFileSync(filePath, buf);
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Deterministic pseudo-random noise for crisp percussion synthesis
function makeRng(seed = 2027) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function synthMusicBed(durationSec = 200) {
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const rng = makeRng(202703);

  // Upbeat 116 BPM TV Game-Show + Warm Ramadan (D Hijaz / D Major flavor)
  const bpm = 116;
  const beatSec = 60 / bpm;
  const stepSec = beatSec / 4; // 16th-note grid
  const totalSteps = Math.ceil(durationSec / stepSec);

  // 4-bar chord progression (Dm/Hijaz-infused game-show energy: D -> Eb -> C -> A7 -> D)
  // Using warm D Hijaz scale: D(62), Eb(63), F#(66), G(67), A(69), Bb(70), C(72), D(74)
  const bassRootByBar = [38, 39, 36, 45]; // D2, Eb2, C2, A2
  const chordByBar = [
    [62, 66, 69], // D major (Hijaz tonic!)
    [63, 67, 70], // Eb major (authentic Ramadan/Egyptian warmth)
    [60, 64, 67], // C major (upbeat lift)
    [57, 61, 64, 67], // A7 (game-show turnaround)
  ];

  // Catchy playful 32-step (2-bar) plucked oud/marimba motif
  const motif = [
    74, 0, 72, 70, 69, 0, 66, 69, 70, 0, 69, 67, 66, 0, 62, 0,
    62, 66, 69, 0, 74, 0, 72, 70, 69, 70, 72, 69, 74, 0, 0, 0,
  ];

  // Classic Maksoum / Baladi-inspired upbeat darbuka percussion pattern (16 steps per bar)
  // D = Dum (warm low darbuka), T = Tek (crisp rim), K = Ka (soft ghost)
  const percPattern = [
    'D', 'k', 'T', 'k', 'T', 'k', 'D', 'k',
    'D', 'k', 'T', 'k', 'T', 'k', 'T', 'k',
  ];

  const addPluck = (startSample, freq, durSec, amp, pan = 0) => {
    const len = Math.min(Math.floor(durSec * SAMPLE_RATE), totalSamples - startSample);
    if (len <= 0) return;
    const lGain = amp * Math.cos(((pan + 1) * Math.PI) / 4);
    const rGain = amp * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.006) * Math.exp(-t * 6.5);
      // Warm oud-like harmonic blend (fundamental + 2nd + soft 3rd)
      const sig =
        (Math.sin(2 * Math.PI * freq * t) * 0.65 +
          Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 +
          Math.sin(2 * Math.PI * freq * 3 * t) * 0.1) *
        env;
      L[startSample + i] += sig * lGain;
      R[startSample + i] += sig * rGain;
    }
  };

  const addWarmPad = (startSample, notes, durSec, amp) => {
    const len = Math.min(Math.floor(durSec * SAMPLE_RATE), totalSamples - startSample);
    if (len <= 0) return;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.12);
      const release = Math.min(1, (durSec - t) / 0.25);
      const env = attack * release;
      let sL = 0;
      let sR = 0;
      for (let n = 0; n < notes.length; n++) {
        const f = midiToHz(notes[n]);
        sL += Math.sin(2 * Math.PI * f * t + n * 0.4) * 0.32;
        sR += Math.sin(2 * Math.PI * (f * 1.002) * t + n * 0.9) * 0.32;
      }
      L[startSample + i] += sL * env * amp;
      R[startSample + i] += sR * env * amp;
    }
  };

  const addBass = (startSample, freq, durSec, amp) => {
    const len = Math.min(Math.floor(durSec * SAMPLE_RATE), totalSamples - startSample);
    if (len <= 0) return;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 4.2);
      const sig =
        (Math.sin(2 * Math.PI * freq * t) * 0.78 +
          Math.sin(2 * Math.PI * freq * 2 * t) * 0.22) *
        env *
        amp;
      L[startSample + i] += sig;
      R[startSample + i] += sig;
    }
  };

  const addDarbuka = (startSample, kind, amp) => {
    const dur = kind === 'D' ? 0.22 : kind === 'T' ? 0.085 : 0.045;
    const len = Math.min(Math.floor(dur * SAMPLE_RATE), totalSamples - startSample);
    if (len <= 0) return;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      let sig = 0;
      if (kind === 'D') {
        // Low resonant Dum (pitch drop 145Hz -> 72Hz)
        const freq = 72 + 75 * Math.exp(-t * 28);
        sig = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 14) * amp;
      } else if (kind === 'T') {
        // Crisp high Tek (metallic ring + filtered slap)
        const tone =
          Math.sin(2 * Math.PI * 520 * t) * 0.45 +
          Math.sin(2 * Math.PI * 1180 * t) * 0.25;
        const noise = rng() * 0.4;
        sig = (tone + noise) * Math.exp(-t * 36) * amp * 0.6;
      } else {
        // Soft shaker / riq ghost
        sig = rng() * Math.exp(-t * 55) * amp * 0.22;
      }
      const panL = kind === 'T' ? 0.85 : 1.0;
      const panR = kind === 'T' ? 1.15 : 1.0;
      L[startSample + i] += sig * panL;
      R[startSample + i] += sig * panR;
    }
  };

  for (let step = 0; step < totalSteps; step++) {
    const startSample = Math.floor(step * stepSec * SAMPLE_RATE);
    const barIdx = Math.floor(step / 16) % 4;
    const stepInBar = step % 16;
    const stepIn2Bars = step % 32;
    const sectionBar = Math.floor(step / 16);

    // Warm chord pad on bar start
    if (stepInBar === 0) {
      addWarmPad(startSample, chordByBar[barIdx], stepSec * 16, 0.14);
    }

    // Punchy syncopated bass
    if (stepInBar === 0 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14) {
      const bMidi = bassRootByBar[barIdx] + (stepInBar === 14 ? 7 : 0);
      addBass(startSample, midiToHz(bMidi), stepSec * 3.5, 0.24);
    }

    // Darbuka + light kick pulse
    const pKind = percPattern[stepInBar];
    addDarbuka(startSample, pKind, pKind === 'D' ? 0.3 : 0.24);

    // Playful Ramadan/Game-Show plucked melody (alternates every 4 bars so it breathes under narration!)
    const motifNote = motif[stepIn2Bars];
    if (motifNote > 0 && sectionBar % 4 !== 2) {
      const pan = stepIn2Bars % 2 === 0 ? -0.35 : 0.35;
      addPluck(startSample, midiToHz(motifNote), stepSec * 2.4, 0.18, pan);
    }
  }

  // Gentle fade-in (1.2s) and fade-out (2.5s) + soft limiter
  const fadeInSamples = Math.floor(1.2 * SAMPLE_RATE);
  const fadeOutSamples = Math.floor(2.5 * SAMPLE_RATE);
  for (let i = 0; i < totalSamples; i++) {
    let gain = 1;
    if (i < fadeInSamples) gain = i / fadeInSamples;
    else if (i > totalSamples - fadeOutSamples) {
      gain = (totalSamples - i) / fadeOutSamples;
    }
    L[i] = Math.tanh(L[i] * gain * 1.15) * 0.85;
    R[i] = Math.tanh(R[i] * gain * 1.15) * 0.85;
  }

  const outPath = path.join(MUSIC_DIR, 'gameshow-ramadan-bed.wav');
  writeWavStereo(outPath, L, R);
  console.log(`  ✓ Synthesized original Ramadan game-show music bed (${durationSec}s)`);
}

function synthSfx() {
  const rng = makeRng(9911);

  // 1. Game-show Buzzer (punchy warm dual-tone brass chime)
  {
    const dur = 0.45;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.008) * Math.exp(-t * 6.5);
      const s =
        (Math.sin(2 * Math.PI * 587.33 * t) * 0.5 +
          Math.sin(2 * Math.PI * 880 * t) * 0.35 +
          Math.sin(2 * Math.PI * 1174.66 * t) * 0.2) *
        env *
        0.7;
      L[i] = s;
      R[i] = s;
    }
    writeWavStereo(path.join(SFX_DIR, 'buzzer.wav'), L, R);
  }

  // 2. Point Plus (+1 rising casino chip ding)
  {
    const dur = 0.38;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.005) * Math.exp(-t * 9);
      const freq = t < 0.09 ? 784 : 1046.5;
      const s =
        (Math.sin(2 * Math.PI * freq * t) * 0.7 +
          Math.sin(2 * Math.PI * freq * 2 * t) * 0.25) *
        env *
        0.65;
      L[i] = s;
      R[i] = s;
    }
    writeWavStereo(path.join(SFX_DIR, 'point-plus.wav'), L, R);
  }

  // 3. Card / Whistle Penalty (short crisp referee double-chirp)
  {
    const dur = 0.42;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 7);
      const vibrato = 1 + 0.04 * Math.sin(2 * Math.PI * 38 * t);
      const freq = (t < 0.16 ? 1950 : 1650) * vibrato;
      const s = Math.sin(2 * Math.PI * freq * t) * env * 0.45;
      L[i] = s;
      R[i] = s;
    }
    writeWavStereo(path.join(SFX_DIR, 'card-whistle.wav'), L, R);
  }

  // 4. Transition Whoosh (smooth filtered sweep)
  {
    const dur = 0.45;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const u = t / dur;
      const env = Math.sin(Math.PI * u) ** 1.6;
      const cutoff = 0.03 + 0.16 * Math.sin(Math.PI * u);
      lp += cutoff * (rng() - lp);
      const s = lp * env * 0.55;
      L[i] = s * (1 - u * 0.35);
      R[i] = s * (0.65 + u * 0.35);
    }
    writeWavStereo(path.join(SFX_DIR, 'whoosh.wav'), L, R);
  }

  // 5. Tie-Break Sudden Death Alarm (dramatic rising game-show sting)
  {
    const dur = 0.7;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    const notes = [440, 523.25, 659.25, 880];
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const idx = Math.min(notes.length - 1, Math.floor(t / 0.14));
      const localT = t - idx * 0.14;
      const env = Math.min(1, localT / 0.008) * Math.exp(-localT * 6);
      const f = notes[idx];
      const s =
        (Math.sin(2 * Math.PI * f * t) * 0.55 +
          Math.sin(2 * Math.PI * f * 1.5 * t) * 0.25) *
        env *
        0.65;
      L[i] = s;
      R[i] = s;
    }
    writeWavStereo(path.join(SFX_DIR, 'tiebreak-alarm.wav'), L, R);
  }

  // 6. Victory Fanfare (warm golden major-chord arpeggio shimmer)
  {
    const dur = 1.4;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    const chord = [587.33, 739.99, 880, 1174.66]; // D major
    for (let n = 0; n < chord.length; n++) {
      const start = Math.floor(n * 0.09 * SAMPLE_RATE);
      for (let i = start; i < len; i++) {
        const t = (i - start) / SAMPLE_RATE;
        const env = Math.min(1, t / 0.012) * Math.exp(-t * 2.6);
        const f = chord[n];
        const sig =
          (Math.sin(2 * Math.PI * f * t) * 0.55 +
            Math.sin(2 * Math.PI * f * 2 * t) * 0.22 +
            Math.sin(2 * Math.PI * f * 3 * t) * 0.08) *
          env *
          0.32;
        L[i] += sig * (n % 2 === 0 ? 1.05 : 0.9);
        R[i] += sig * (n % 2 === 0 ? 0.9 : 1.05);
      }
    }
    writeWavStereo(path.join(SFX_DIR, 'victory-fanfare.wav'), L, R);
  }

  // 7. Crisp UI Chime (for Role Recap Cards & Consistency Check 9/9 Pass)
  {
    const dur = 0.35;
    const len = Math.floor(dur * SAMPLE_RATE);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.005) * Math.exp(-t * 9.5);
      const s =
        (Math.sin(2 * Math.PI * 880 * t) * 0.55 +
          Math.sin(2 * Math.PI * 1318.5 * t) * 0.35) *
        env *
        0.55;
      L[i] = s;
      R[i] = s;
    }
    writeWavStereo(path.join(SFX_DIR, 'chime.wav'), L, R);
  }

  console.log('  ✓ Synthesized 7 original game-show SFX clips');
}

// ============================================================================
// 2. NEURAL TTS NARRATION (EN + EGYPTIAN ARABIC) WITH CUSTOM DROP-IN OVERRIDES
// ============================================================================

async function synthesizeEdgeTts(text, voice, outMp3Path, rate = '+4%') {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate });
  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });
  fs.writeFileSync(outMp3Path, Buffer.concat(chunks));
}

function fitAudioToMaxDuration(inPath, maxSec) {
  const dur = getAudioDurationSec(inPath);
  if (dur <= 0 || dur <= maxSec) {
    return dur;
  }
  // Gently speed up using ffmpeg atempo (clamped safely to <= 1.28 so voice stays natural)
  const tempo = Math.min(1.28, dur / maxSec);
  const tmpPath = `${inPath}.fitted.mp3`;
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-i',
      inPath,
      '-filter:a',
      `atempo=${tempo.toFixed(3)}`,
      '-b:a',
      '128k',
      tmpPath,
    ],
    { stdio: 'ignore' }
  );
  fs.renameSync(tmpPath, inPath);
  return getAudioDurationSec(inPath);
}

async function generateNarration() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    voices: {
      en: 'en-US-AndrewNeural',
      ar: 'ar-EG-ShakirNeural',
    },
    music: 'audio/music/gameshow-ramadan-bed.wav',
    sfx: {
      buzzer: 'audio/sfx/buzzer.wav',
      pointPlus: 'audio/sfx/point-plus.wav',
      cardWhistle: 'audio/sfx/card-whistle.wav',
      whoosh: 'audio/sfx/whoosh.wav',
      tiebreakAlarm: 'audio/sfx/tiebreak-alarm.wav',
      victoryFanfare: 'audio/sfx/victory-fanfare.wav',
      chime: 'audio/sfx/chime.wav',
    },
    narration: { en: {}, ar: {} },
  };

  for (const lang of ['en', 'ar']) {
    const voice = lang === 'en' ? 'en-US-AndrewNeural' : 'ar-EG-ShakirNeural';
    const baseRate = lang === 'en' ? '+4%' : '+6%';

    for (const scene of ALL_SCENES) {
      const text = lang === 'en' ? scene.narrationEn : scene.narrationAr;
      if (!text || !text.trim()) continue;

      // Check for user custom voice drop-in override first!
      const customMp3 = path.join(CUSTOM_NARRATION_DIR, lang, `${scene.id}.mp3`);
      const customWav = path.join(CUSTOM_NARRATION_DIR, lang, `${scene.id}.wav`);
      const targetMp3 = path.join(NARRATION_DIR, lang, `${scene.id}.mp3`);

      let sourceType = 'tts';
      let publicRelPath = `audio/narration/${lang}/${scene.id}.mp3`;

      if (fs.existsSync(customMp3)) {
        sourceType = 'custom';
        publicRelPath = `audio/narration/custom/${lang}/${scene.id}.mp3`;
        const dur = getAudioDurationSec(customMp3);
        manifest.narration[lang][scene.id] = {
          path: publicRelPath,
          durationSec: Number(dur.toFixed(2)),
          source: sourceType,
        };
        console.log(`  ★ Using custom voice recording: ${publicRelPath} (${dur.toFixed(2)}s)`);
        continue;
      }

      if (fs.existsSync(customWav)) {
        sourceType = 'custom';
        publicRelPath = `audio/narration/custom/${lang}/${scene.id}.wav`;
        const dur = getAudioDurationSec(customWav);
        manifest.narration[lang][scene.id] = {
          path: publicRelPath,
          durationSec: Number(dur.toFixed(2)),
          source: sourceType,
        };
        console.log(`  ★ Using custom voice recording: ${publicRelPath} (${dur.toFixed(2)}s)`);
        continue;
      }

      // Generate neural TTS (skip if already cached and non-empty unless --force)
      let ok = !FORCE_TTS && fs.existsSync(targetMp3) && fs.statSync(targetMp3).size > 2000;
      if (!ok) {
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            await synthesizeEdgeTts(text, voice, targetMp3, baseRate);
            if (fs.existsSync(targetMp3) && fs.statSync(targetMp3).size > 2000) {
              ok = true;
              break;
            }
          } catch (err) {
            if (attempt === 4) {
              console.warn(
                `  ⚠ Edge TTS failed for ${lang}/${scene.id} after 4 attempts: ${err.message}`
              );
            } else {
              await new Promise((r) => setTimeout(r, 900 * attempt));
            }
          }
        }
      }

      if (ok && fs.existsSync(targetMp3)) {
        const maxDur = Math.max(2, scene.durationSec - 0.55);
        const finalDur = fitAudioToMaxDuration(targetMp3, maxDur);
        manifest.narration[lang][scene.id] = {
          path: publicRelPath,
          durationSec: Number(finalDur.toFixed(2)),
          source: sourceType,
        };
        console.log(
          `  ✓ TTS [${lang}] ${scene.id.padEnd(22)} → ${finalDur.toFixed(2)}s / ${scene.durationSec}s`
        );
      }
    }
  }

  // Write manifest for Remotion
  const manifestPath = path.join(VIDEO_ROOT, 'src', 'audio-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\n✓ Audio manifest written to ${path.relative(VIDEO_ROOT, manifestPath)}`);
}

console.log('=== Generating Audio Assets (Music, SFX & Bilingual Neural TTS) ===');
synthMusicBed(205);
synthSfx();
await generateNarration();
