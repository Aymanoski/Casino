#!/usr/bin/env node
/**
 * Extracts key review frames from all rendered videos into `video/.verify-frames/`
 * so we can inspect every scene, Arabic RTL layout, split-screen sync, Impact Preview,
 * and mobile safe margins frame by frame!
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFfmpeg } from './bin-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(VIDEO_ROOT, 'out');
const VERIFY_DIR = path.join(VIDEO_ROOT, '.verify-frames');

fs.rmSync(VERIFY_DIR, { recursive: true, force: true });
fs.mkdirSync(VERIFY_DIR, { recursive: true });

const FFMPEG = findFfmpeg(VIDEO_ROOT);

const snapshots = [
  // Main EN key moments across Acts A-E
  ['casino-pitch-16x9-en.mp4', 4, 'main-en-01-coldopen-final.png'],
  ['casino-pitch-16x9-en.mp4', 14, 'main-en-02-coldopen-title.png'],
  ['casino-pitch-16x9-en.mp4', 22, 'main-en-03-admin-settings.png'],
  ['casino-pitch-16x9-en.mp4', 44, 'main-en-04-player-phone.png'],
  ['casino-pitch-16x9-en.mp4', 64, 'main-en-05-scorer-console.png'],
  ['casino-pitch-16x9-en.mp4', 78, 'main-en-06-splitscreen-sync.png'],
  ['casino-pitch-16x9-en.mp4', 90, 'main-en-07-bigscreen-rtl-tiebreak.png'],
  ['casino-pitch-16x9-en.mp4', 107, 'main-en-08-fan-bracket.png'],
  ['casino-pitch-16x9-en.mp4', 122, 'main-en-09-admin-impact-revert.png'],
  ['casino-pitch-16x9-en.mp4', 127, 'main-en-10-admin-consistency.png'],
  ['casino-pitch-16x9-en.mp4', 140, 'main-en-11-role-recap.png'],
  ['casino-pitch-16x9-en.mp4', 171, 'main-en-12-marwan-final.png'],
  ['casino-pitch-16x9-en.mp4', 188, 'main-en-13-close-cta.png'],
  // Main AR RTL checks
  ['casino-pitch-16x9-ar.mp4', 14, 'main-ar-01-title-rtl.png'],
  ['casino-pitch-16x9-ar.mp4', 78, 'main-ar-02-splitscreen-rtl.png'],
  ['casino-pitch-16x9-ar.mp4', 140, 'main-ar-03-role-recap-rtl.png'],
  // Teaser 9:16 safe-margin checks (EN & AR)
  ['casino-teaser-9x16-en.mp4', 5, 'teaser-en-01-hook.png'],
  ['casino-teaser-9x16-en.mp4', 25, 'teaser-en-02-split-vertical.png'],
  ['casino-teaser-9x16-ar.mp4', 48, 'teaser-ar-03-five-roles-rtl.png'],
  ['casino-teaser-9x16-ar.mp4', 64, 'teaser-ar-04-cta-rtl.png'],
];

for (const [videoName, sec, outPng] of snapshots) {
  const inPath = path.join(OUT_DIR, videoName);
  if (!fs.existsSync(inPath)) {
    console.warn(`  ⚠ Skipping missing ${videoName}`);
    continue;
  }
  execFileSync(
    FFMPEG,
    ['-y', '-ss', String(sec), '-i', inPath, '-frames:v', '1', path.join(VERIFY_DIR, outPng)],
    { stdio: 'ignore' }
  );
  console.log(`  ✓ Extracted .verify-frames/${outPng}`);
}
