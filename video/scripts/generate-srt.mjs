#!/usr/bin/env node
/**
 * Generates timed SubRip (.srt) caption files for both EN and RTL Arabic,
 * for both the Main 16:9 Pitch Video and the 9:16 Vertical Teaser.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(VIDEO_ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const storyboard = await import('../src/storyboard.ts');

function formatSrtTime(totalSec) {
  const safe = Math.max(0, totalSec);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(Math.min(999, ms), 3)}`;
}

function buildSrt(scenes, lang) {
  const blocks = [];
  let idx = 1;
  for (const scene of scenes) {
    for (const cue of scene.captions) {
      const start = scene.startSec + cue.offsetSec;
      const end = start + cue.durationSec;
      const rawText = lang === 'ar' ? cue.ar : cue.en;
      // Wrap Arabic lines with RLE (U+202B) + PDF (U+202C) so every video player renders RTL cleanly
      const text = lang === 'ar' ? `\u202B${rawText}\u202C` : rawText;
      blocks.push(`${idx}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}`);
      idx++;
    }
  }
  return blocks.join('\n\n') + '\n';
}

const files = [
  ['casino-pitch-en.srt', buildSrt(storyboard.MAIN_SCENES, 'en')],
  ['casino-pitch-ar.srt', buildSrt(storyboard.MAIN_SCENES, 'ar')],
  ['casino-teaser-en.srt', buildSrt(storyboard.TEASER_SCENES, 'en')],
  ['casino-teaser-ar.srt', buildSrt(storyboard.TEASER_SCENES, 'ar')],
];

for (const [name, content] of files) {
  const outPath = path.join(OUT_DIR, name);
  // Write UTF-8 with BOM for Arabic SRTs so Windows Media Player / VLC / Premiere decode Arabic flawlessly
  const payload = name.includes('-ar.') ? `\uFEFF${content}` : content;
  fs.writeFileSync(outPath, payload, 'utf8');
  console.log(`  ✓ Exported out/${name}`);
}
