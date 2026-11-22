#!/usr/bin/env node
/**
 * Master Render Pipeline (`video/scripts/render-all.mjs`)
 *
 * Exports:
 * 1. out/casino-pitch-16x9-en.mp4  (1920x1080, 3:12, EN narration + burned-in EN captions)
 * 2. out/casino-pitch-16x9-ar.mp4  (1920x1080, 3:12, Egyptian AR narration + burned-in RTL AR captions)
 * 3. out/casino-teaser-9x16-en.mp4 (1080x1920, 1:08, EN vertical teaser)
 * 4. out/casino-teaser-9x16-ar.mp4 (1080x1920, 1:08, Egyptian AR vertical teaser)
 * 5. out/thumbnail-16x9.png        (1920x1080 pitch thumbnail)
 * 6. out/*.srt                     (4 bilingual SubRip caption files)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findChromiumExe } from './bin-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(VIDEO_ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CHROME = findChromiumExe();
const BINARIES_DIR = path.join(
  VIDEO_ROOT,
  'node_modules',
  '@remotion',
  'compositor-win32-x64-msvc'
);
const REMOTION_CLI = path.join(
  VIDEO_ROOT,
  'node_modules',
  '@remotion',
  'cli',
  'remotion-cli.js'
);

function runRemotion(args) {
  const fullArgs = [REMOTION_CLI, ...args];
  if (CHROME) {
    fullArgs.push('--browser-executable', CHROME);
  }
  if (process.platform === 'win32' && fs.existsSync(BINARIES_DIR)) {
    fullArgs.push('--binaries-directory', BINARIES_DIR);
  }
  execFileSync(process.execPath, fullArgs, {
    cwd: VIDEO_ROOT,
    stdio: 'inherit',
  });
}

console.log('=== Step 1/3: Exporting Bilingual SRT Caption Files ===');
execFileSync(process.execPath, [path.join(__dirname, 'generate-srt.mjs')], {
  cwd: VIDEO_ROOT,
  stdio: 'inherit',
});

console.log('\n=== Step 2/3: Rendering Thumbnail (1920x1080 PNG) ===');
runRemotion([
  'still',
  'src/index.ts',
  'Thumbnail-16x9',
  path.join(OUT_DIR, 'thumbnail-16x9.png'),
  '--image-format=png',
]);

const targets = [
  ['MainPitch-EN', 'casino-pitch-16x9-en.mp4'],
  ['MainPitch-AR', 'casino-pitch-16x9-ar.mp4'],
  ['TeaserVertical-EN', 'casino-teaser-9x16-en.mp4'],
  ['TeaserVertical-AR', 'casino-teaser-9x16-ar.mp4'],
];

console.log('\n=== Step 3/3: Rendering Main 16:9 & Vertical 9:16 Videos (EN + AR) ===');
for (const [compId, outName] of targets) {
  console.log(`\n→ Rendering ${compId} → out/${outName} ...`);
  runRemotion([
    'render',
    'src/index.ts',
    compId,
    path.join(OUT_DIR, outName),
    '--codec=h264',
    '--pixel-format=yuv420p',
    '--audio-codec=aac',
    '--audio-bitrate=192k',
    '--crf=20',
    '--x264-preset=veryfast',
    '--concurrency=10',
  ]);
  const stat = fs.statSync(path.join(OUT_DIR, outName));
  console.log(`  ✓ out/${outName} (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`);
}

console.log('\n✓ All videos, SRTs, and thumbnail rendered cleanly into /video/out!');
