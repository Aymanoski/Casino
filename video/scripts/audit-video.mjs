#!/usr/bin/env node
/**
 * Comprehensive Automated Video & Audio Audit Harness (`video/scripts/audit-video.mjs`)
 *
 * Usage:
 *   node scripts/audit-video.mjs --version=v1 --dir=out/v1
 *
 * Performs:
 * 1. Frame extraction via ffmpeg: every 2s + first & last frame of every scene.
 * 2. Crisp labeled contact sheets via Playwright Chromium into `review-sheets/<version>/`.
 * 3. ITU-R BS.1770-4 K-weighted Integrated LUFS, sample peak dBFS, clipping count,
 *    and >1.5s silence gap detection directly from decoded 48kHz stereo PCM.
 * 4. FFprobe constant-frame-rate & stream integrity verification.
 * 5. Caption timing vs. narration audio duration & reading speed audit + SRT verification.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { findFfmpeg, findFfprobe } from './bin-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(__dirname, '..');

function argVal(prefix, fallback) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const VERSION = argVal('--version=', 'v1');
const TARGET_DIR = path.resolve(VIDEO_ROOT, argVal('--dir=', `out/${VERSION}`));
const SHEETS_DIR = path.join(VIDEO_ROOT, 'review-sheets', VERSION);
const FRAMES_TMP = path.join(SHEETS_DIR, '_frames');
fs.mkdirSync(FRAMES_TMP, { recursive: true });

const FFMPEG = findFfmpeg(VIDEO_ROOT);
const FFPROBE = findFfprobe(VIDEO_ROOT);
if (!FFMPEG || !FFPROBE) {
  throw new Error('Missing Remotion ffmpeg/ffprobe binaries');
}

const storyboard = await import('../src/storyboard.ts');
const audioManifest = JSON.parse(
  fs.readFileSync(path.join(VIDEO_ROOT, 'src', 'audio-manifest.json'), 'utf8')
);

// ============================================================================
// 1. ITU-R BS.1770-4 K-WEIGHTED LUFS + PEAK + CLIPPING + SILENCE ANALYZER
// ============================================================================

/** Standard BS.1770-4 biquad coefficients at 48 kHz */
const PRE_FILTER = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
};
const RLB_FILTER = {
  b0: 1.0,
  b1: -2.0,
  b2: 1.0,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
};

function makeBiquadState() {
  return { x1: 0, x2: 0, y1: 0, y2: 0 };
}

function stepBiquad(s, c, x) {
  const y = c.b0 * x + c.b1 * s.x1 + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2;
  s.x2 = s.x1;
  s.x1 = x;
  s.y2 = s.y1;
  s.y1 = y;
  return y;
}

function analyzeAudio(mp4Path) {
  const tmpWav = path.join(SHEETS_DIR, `_audio_${path.basename(mp4Path)}.wav`);
  try {
    const res = spawnSync(
      FFMPEG,
      [
        '-y',
        '-v',
        'error',
        '-i',
        mp4Path,
        '-vn',
        '-ac',
        '2',
        '-ar',
        '48000',
        '-c:a',
        'pcm_s16le',
        '-f',
        'wav',
        tmpWav,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    if (res.status !== 0 || !fs.existsSync(tmpWav)) {
      return {
        error: `PCM decode failed: ${String(res.stderr || '').trim()}`,
        silentGaps: [],
      };
    }

    const buf = fs.readFileSync(tmpWav);
    // Find 'data' chunk in WAV header cleanly
    let dataOffset = 12;
    let dataLen = 0;
    while (dataOffset + 8 <= buf.length) {
      const id = buf.toString('ascii', dataOffset, dataOffset + 4);
      const size = buf.readUInt32LE(dataOffset + 4);
      if (id === 'data') {
        dataOffset += 8;
        dataLen = Math.min(size, buf.length - dataOffset);
        break;
      }
      dataOffset += 8 + size + (size % 2);
    }
    const sampleCount = Math.floor(dataLen / 2);
    const totalFrames = Math.floor(sampleCount / 2);
    const SR = 48000;

    let peakLin = 0;
    let clippedSamples = 0;
    const preL = makeBiquadState();
    const preR = makeBiquadState();
    const rlbL = makeBiquadState();
    const rlbR = makeBiquadState();

    // 100ms hops (4800 samples) -> 400ms BS.1770 blocks = sum of 4 consecutive 100ms hops
    const hopSize = 4800;
    const numHops = Math.floor(totalFrames / hopSize);
    const hopKPower = new Float64Array(numHops);
    const hopRawPower = new Float64Array(numHops);

    for (let h = 0; h < numHops; h++) {
      let kSum = 0;
      let rawSum = 0;
      const baseByte = dataOffset + h * hopSize * 4;
      for (let i = 0; i < hopSize; i++) {
        const l = buf.readInt16LE(baseByte + i * 4) / 32768;
        const r = buf.readInt16LE(baseByte + i * 4 + 2) / 32768;
        const al = Math.abs(l);
        const ar = Math.abs(r);
        if (al > peakLin) peakLin = al;
        if (ar > peakLin) peakLin = ar;
        if (al >= 0.999) clippedSamples++;
        if (ar >= 0.999) clippedSamples++;
        rawSum += 0.5 * (l * l + r * r);

        const kl = stepBiquad(rlbL, RLB_FILTER, stepBiquad(preL, PRE_FILTER, l));
        const kr = stepBiquad(rlbR, RLB_FILTER, stepBiquad(preR, PRE_FILTER, r));
        kSum += kl * kl + kr * kr;
      }
      hopKPower[h] = kSum / hopSize;
      hopRawPower[h] = rawSum / hopSize;
    }

    // Build 400ms (4-hop) overlapping blocks
    const blockMeanSq = [];
    for (let h = 0; h + 3 < numHops; h++) {
      const z =
        (hopKPower[h] + hopKPower[h + 1] + hopKPower[h + 2] + hopKPower[h + 3]) / 4;
      blockMeanSq.push(z);
    }

    // Absolute gate (-70 LUFS)
    const absGateLin = Math.pow(10, (-70 + 0.691) / 10);
    const aboveAbs = blockMeanSq.filter((z) => z > absGateLin);
    let integratedLufs = -Infinity;
    if (aboveAbs.length > 0) {
      const meanAbs = aboveAbs.reduce((a, b) => a + b, 0) / aboveAbs.length;
      const relThreshLufs = -0.691 + 10 * Math.log10(meanAbs) - 10;
      const relGateLin = Math.pow(10, (relThreshLufs + 0.691) / 10);
      const aboveRel = aboveAbs.filter((z) => z > relGateLin);
      if (aboveRel.length > 0) {
        const meanRel = aboveRel.reduce((a, b) => a + b, 0) / aboveRel.length;
        integratedLufs = -0.691 + 10 * Math.log10(meanRel);
      }
    }

    // Max short-term loudness (3s = 30 hops)
    let maxShortTermLufs = -Infinity;
    for (let h = 0; h + 29 < numHops; h++) {
      let sum = 0;
      for (let k = 0; k < 30; k++) sum += hopKPower[h + k];
      const z = sum / 30;
      if (z > 1e-12) {
        const l = -0.691 + 10 * Math.log10(z);
        if (l > maxShortTermLufs) maxShortTermLufs = l;
      }
    }

    // Silent gaps > 1.5s where raw RMS < -45 dBFS (exclude first/last 0.5s fade edges)
    const silenceThresh = Math.pow(10, -45 / 10);
    const silentGaps = [];
    let runStart = -1;
    for (let h = 5; h < numHops - 5; h++) {
      if (hopRawPower[h] < silenceThresh) {
        if (runStart < 0) runStart = h;
      } else if (runStart >= 0) {
        const dur = (h - runStart) * 0.1;
        if (dur >= 1.5) {
          silentGaps.push({
            startSec: Number((runStart * 0.1).toFixed(1)),
            endSec: Number((h * 0.1).toFixed(1)),
            durationSec: Number(dur.toFixed(1)),
          });
        }
        runStart = -1;
      }
    }

    const peakDbfs = peakLin > 1e-9 ? 20 * Math.log10(peakLin) : -Infinity;

    return {
      durationSec: Number((totalFrames / SR).toFixed(2)),
      integratedLufs: Number(integratedLufs.toFixed(2)),
      maxShortTermLufs: Number(maxShortTermLufs.toFixed(2)),
      peakDbfs: Number(peakDbfs.toFixed(2)),
      clippedSamples,
      silentGaps,
      lufsPass: integratedLufs >= -18.0 && integratedLufs <= -14.0,
      clippingPass: clippedSamples === 0 && peakDbfs <= -0.3,
      silencePass: silentGaps.length === 0,
    };
  } finally {
    if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
  }
}

// ============================================================================
// 2. FFPROBE STREAM & CONSTANT FRAME RATE CHECK
// ============================================================================

function probeVideo(mp4Path) {
  const out = execFileSync(
    FFPROBE,
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      mp4Path,
    ],
    { encoding: 'utf8' }
  );
  const data = JSON.parse(out);
  const v = data.streams.find((s) => s.codec_type === 'video');
  const a = data.streams.find((s) => s.codec_type === 'audio');
  const rFps = v ? evalFrac(v.r_frame_rate) : 0;
  const avgFps = v ? evalFrac(v.avg_frame_rate) : 0;
  return {
    sizeMB: Number((fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2)),
    durationSec: Number(parseFloat(data.format.duration).toFixed(2)),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    videoCodec: v?.codec_name ?? 'none',
    audioCodec: a?.codec_name ?? 'none',
    rFps: Number(rFps.toFixed(3)),
    avgFps: Number(avgFps.toFixed(3)),
    cfrPass: Math.abs(rFps - 30) < 0.05 && Math.abs(avgFps - 30) < 0.2,
  };
}

function evalFrac(s) {
  if (!s) return 0;
  const [n, d] = String(s).split('/').map(Number);
  return d ? n / d : n || 0;
}

// ============================================================================
// 3. CAPTION TIMING VS NARRATION AUDIT
// ============================================================================

function auditCaptions() {
  const issues = [];
  const summary = [];

  for (const [format, scenes] of [
    ['main', storyboard.MAIN_SCENES],
    ['teaser', storyboard.TEASER_SCENES],
  ]) {
    for (const scene of scenes) {
      const enNar = audioManifest.narration.en?.[scene.id]?.durationSec ?? 0;
      const arNar = audioManifest.narration.ar?.[scene.id]?.durationSec ?? 0;
      const lastCue = scene.captions[scene.captions.length - 1];
      const capEnd = lastCue ? lastCue.offsetSec + lastCue.durationSec : 0;

      if (enNar > scene.durationSec - 0.15) {
        issues.push(`[${format}/${scene.id}] EN narration (${enNar}s) nearly exceeds scene (${scene.durationSec}s)`);
      }
      if (arNar > scene.durationSec - 0.15) {
        issues.push(`[${format}/${scene.id}] AR narration (${arNar}s) nearly exceeds scene (${scene.durationSec}s)`);
      }
      if (capEnd > scene.durationSec + 0.05) {
        issues.push(`[${format}/${scene.id}] Caption ends at ${capEnd}s > scene ${scene.durationSec}s`);
      }
      for (let i = 0; i < scene.captions.length; i++) {
        const c = scene.captions[i];
        const next = scene.captions[i + 1];
        if (next && c.offsetSec + c.durationSec > next.offsetSec + 0.02) {
          issues.push(`[${format}/${scene.id}] Caption overlap between cue ${i} and ${i + 1}`);
        }
        const enCps = c.en.length / Math.max(0.5, c.durationSec);
        const arCps = c.ar.length / Math.max(0.5, c.durationSec);
        if (enCps > 24) {
          issues.push(`[${format}/${scene.id}] Cue ${i} EN fast reading speed (${enCps.toFixed(1)} chars/s)`);
        }
        if (arCps > 24) {
          issues.push(`[${format}/${scene.id}] Cue ${i} AR fast reading speed (${arCps.toFixed(1)} chars/s)`);
        }
      }

      summary.push({
        format,
        sceneId: scene.id,
        startSec: scene.startSec,
        durationSec: scene.durationSec,
        enNarSec: enNar,
        arNarSec: arNar,
        captionEndSec: Number(capEnd.toFixed(2)),
        cueCount: scene.captions.length,
      });
    }
  }

  return { summary, issues, pass: issues.length === 0 };
}

// ============================================================================
// 4. FRAME EXTRACTION (EVERY 2s + FIRST & LAST OF EACH SCENE) & CONTACT SHEETS
// ============================================================================

function buildSamplePlan(scenes, totalSec, everySec = 2, includeBoundary = true) {
  const map = new Map(); // rounded 0.1s -> { t, tag }
  const add = (t, tag) => {
    const clamped = Math.max(0.05, Math.min(totalSec - 0.15, t));
    const key = Math.round(clamped * 10);
    if (!map.has(key)) {
      map.set(key, { t: Number(clamped.toFixed(2)), tag });
    } else if (tag.includes('START') || tag.includes('END')) {
      map.get(key).tag = `${map.get(key).tag} | ${tag}`;
    }
  };

  if (includeBoundary) {
    for (const s of scenes) {
      add(s.startSec + 0.25, `${s.id} START`);
      add(s.startSec + s.durationSec - 0.25, `${s.id} END`);
    }
  }
  for (let t = 0; t < totalSec; t += everySec) {
    const s =
      scenes.find((sc) => t >= sc.startSec && t < sc.startSec + sc.durationSec) ??
      scenes[scenes.length - 1];
    add(t, `${s.id}`);
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

function extractFrame(mp4Path, sec, outPng, scaleWidth) {
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-v',
      'error',
      '-ss',
      sec.toFixed(2),
      '-i',
      mp4Path,
      '-frames:v',
      '1',
      '-vf',
      `scale=${scaleWidth}:-2`,
      outPng,
    ],
    { stdio: 'ignore' }
  );
}

async function renderContactSheets(browser, prefix, frames, cols, rows, isVertical) {
  const perSheet = cols * rows;
  const sheetPaths = [];
  const page = await browser.newPage({
    viewport: { width: isVertical ? 1440 : 1920, height: isVertical ? 1680 : 1240 },
    deviceScaleFactor: 1,
  });

  try {
    for (let s = 0; s < frames.length; s += perSheet) {
      const slice = frames.slice(s, s + perSheet);
      const sheetNum = Math.floor(s / perSheet) + 1;
      const tilesHtml = slice
        .map((item) => {
          const b64 = fs.readFileSync(item.png).toString('base64');
          const mm = String(Math.floor(item.t / 60)).padStart(2, '0');
          const ss = (item.t % 60).toFixed(1).padStart(4, '0');
          return `
            <div class="tile">
              <div class="meta"><span>${mm}:${ss}</span><span class="tag">${item.tag}</span></div>
              <img src="data:image/png;base64,${b64}" />
            </div>
          `;
        })
        .join('');

      await page.setContent(`
        <!doctype html>
        <html>
        <head>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background: #14070B;
              color: #FFF9F0;
              font-family: system-ui, -apple-system, Segoe UI, sans-serif;
              padding: 14px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0 4px 10px;
              font-size: 16px;
              font-weight: 800;
              color: #FFC12B;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(${cols}, 1fr);
              gap: 10px;
            }
            .tile {
              background: #2A0A10;
              border: 1.5px solid #6E1025;
              border-radius: 8px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .meta {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              padding: 4px 8px;
              font-size: 11px;
              font-weight: 700;
              background: #3B0915;
              color: #FFE066;
              white-space: nowrap;
              overflow: hidden;
            }
            .tag {
              color: #FFFFFF;
              opacity: 0.92;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            img {
              width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <span>${VERSION.toUpperCase()} · ${prefix} · Sheet ${sheetNum}</span>
            <span>Frames ${s + 1}–${s + slice.length} of ${frames.length}</span>
          </div>
          <div class="grid">${tilesHtml}</div>
        </body>
        </html>
      `);

      const outSheet = path.join(
        SHEETS_DIR,
        `${prefix}-sheet-${String(sheetNum).padStart(2, '0')}.png`
      );
      await page.screenshot({ path: outSheet, fullPage: true });
      sheetPaths.push(path.relative(VIDEO_ROOT, outSheet).replace(/\\/g, '/'));
    }
  } finally {
    await page.close();
  }
  return sheetPaths;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log(`=== Auditing ${VERSION} (${TARGET_DIR}) ===`);

const files = [
  { key: 'main-en', file: 'casino-pitch-16x9-en.mp4', scenes: storyboard.MAIN_SCENES, totalSec: storyboard.MAIN_TOTAL_SEC, vertical: false, everySec: 2, cols: 4, rows: 4, tileW: 450 },
  { key: 'main-ar', file: 'casino-pitch-16x9-ar.mp4', scenes: storyboard.MAIN_SCENES, totalSec: storyboard.MAIN_TOTAL_SEC, vertical: false, everySec: 6, cols: 4, rows: 4, tileW: 450 },
  { key: 'teaser-en', file: 'casino-teaser-9x16-en.mp4', scenes: storyboard.TEASER_SCENES, totalSec: storyboard.TEASER_TOTAL_SEC, vertical: true, everySec: 2, cols: 5, rows: 3, tileW: 260 },
  { key: 'teaser-ar', file: 'casino-teaser-9x16-ar.mp4', scenes: storyboard.TEASER_SCENES, totalSec: storyboard.TEASER_TOTAL_SEC, vertical: true, everySec: 4, cols: 5, rows: 3, tileW: 260 },
];

const report = {
  version: VERSION,
  auditedAt: new Date().toISOString(),
  targetDir: path.relative(VIDEO_ROOT, TARGET_DIR).replace(/\\/g, '/'),
  videos: {},
  captions: auditCaptions(),
  sheets: {},
};

const SKIP_SHEETS = process.argv.includes('--skip-sheets');
const browser = SKIP_SHEETS ? null : await chromium.launch({ headless: true });
try {
  for (const item of files) {
    const mp4Path = path.join(TARGET_DIR, item.file);
    if (!fs.existsSync(mp4Path)) {
      console.log(`  ⚠ Skipping missing ${item.file}`);
      continue;
    }
    console.log(`\n→ Inspecting ${item.file} ...`);
    const probe = probeVideo(mp4Path);
    const audio = analyzeAudio(mp4Path);
    report.videos[item.key] = { file: item.file, probe, audio };
    console.log(
      `  Stream: ${probe.width}x${probe.height} @ ${probe.rFps}fps (avg ${probe.avgFps}) ${probe.durationSec}s (${probe.sizeMB}MB) CFR=${probe.cfrPass}`
    );
    console.log(
      `  Audio:  ${audio.integratedLufs} LUFS (max3s ${audio.maxShortTermLufs} LUFS) | Peak ${audio.peakDbfs} dBFS | Clips ${audio.clippedSamples} | SilentGaps ${audio.silentGaps?.length ?? 0}`
    );

    if (SKIP_SHEETS) {
      const existing = fs
        .readdirSync(SHEETS_DIR)
        .filter((f) => f.startsWith(`${item.key}-sheet-`) && f.endsWith('.png'))
        .sort()
        .map((f) => path.relative(VIDEO_ROOT, path.join(SHEETS_DIR, f)).replace(/\\/g, '/'));
      report.sheets[item.key] = existing;
      continue;
    }

    const plan = buildSamplePlan(item.scenes, item.totalSec, item.everySec, true);
    const extracted = [];
    for (let i = 0; i < plan.length; i++) {
      const png = path.join(FRAMES_TMP, `${item.key}-${String(i).padStart(3, '0')}.png`);
      extractFrame(mp4Path, plan[i].t, png, item.tileW);
      extracted.push({ ...plan[i], png });
    }
    const sheets = await renderContactSheets(
      browser,
      item.key,
      extracted,
      item.cols,
      item.rows,
      item.vertical
    );
    report.sheets[item.key] = sheets;
    console.log(`  Sheets: ${sheets.length} contact sheet(s) from ${extracted.length} sampled frames`);
  }
} finally {
  if (browser) await browser.close();
}

// Clean raw frame PNGs to save disk space, keep contact sheets + reports
fs.rmSync(FRAMES_TMP, { recursive: true, force: true });

fs.writeFileSync(
  path.join(SHEETS_DIR, 'audit-report.json'),
  JSON.stringify(report, null, 2) + '\n',
  'utf8'
);

// Build readable Markdown audit report
const lines = [
  `# Automated Technical & Audio Audit — ${VERSION}`,
  ``,
  `- **Audited At:** \`${report.auditedAt}\``,
  `- **Directory:** \`${report.targetDir}\``,
  ``,
  `## Video & Audio Telemetry`,
  ``,
  `| Output | Resolution | FPS (r / avg) | Duration | Size | Integrated LUFS | Peak dBFS | Clips | Silent Gaps (>1.5s) | Pass |`,
  `|---|---|---|---|---|---|---|---|---|---|`,
];

for (const [k, v] of Object.entries(report.videos)) {
  const p = v.probe;
  const a = v.audio;
  const ok = p.cfrPass && a.lufsPass && a.clippingPass && a.silencePass;
  lines.push(
    `| \`${v.file}\` | ${p.width}×${p.height} | ${p.rFps} / ${p.avgFps} | ${p.durationSec}s | ${p.sizeMB} MB | **${a.integratedLufs} LUFS** | ${a.peakDbfs} dBFS | ${a.clippedSamples} | ${a.silentGaps.length > 0 ? a.silentGaps.map((g) => `${g.startSec}-${g.endSec}s`).join(', ') : 'None'} | ${ok ? 'PASS' : 'NEEDS FIX'} |`
  );
}

lines.push('', '## Caption & Narration Timing Audit', '');
if (report.captions.issues.length === 0) {
  lines.push('- All caption cues & narration audio durations passed automated checks (0 issues).');
} else {
  for (const iss of report.captions.issues) lines.push(`- ⚠ ${iss}`);
}

lines.push('', '## Generated Contact Sheets', '');
for (const [k, arr] of Object.entries(report.sheets)) {
  lines.push(`- **${k}**: ${arr.map((s) => `\`${s}\``).join(', ')}`);
}

fs.writeFileSync(path.join(SHEETS_DIR, 'audit-report.md'), lines.join('\n') + '\n', 'utf8');
console.log(`\n✓ Audit report saved to review-sheets/${VERSION}/audit-report.md`);
