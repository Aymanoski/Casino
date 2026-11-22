#!/usr/bin/env node
/**
 * Real-App Playwright Recording Director (`video/scripts/record-all.mjs`)
 *
 * Records ONLY the real Next.js application (`next start`, zero dev overlays, zero faked UI):
 * - Restores deterministic Video Demo States (`fresh`, `main`, `final`) via `window.__casinoVideoDemo`.
 * - Runs the 5-perspective lifecycle inside ONE shared Chromium BrowserContext so IndexedDB
 *   and BroadcastChannel stay genuinely live-synced across Admin, Scorer, Big Screen, and Fan View
 *   using per-tab `?demoRole=` & `?tabLang=` sessionStorage overrides.
 * - Captures high-DPI Phone takes (`390x844`, `deviceScaleFactor: 3`) for Player & Fan phone frames
 *   in BOTH English LTR and Arabic RTL.
 * - Captures clean Big Screen broadcast takes in BOTH English LTR and Arabic RTL.
 * - Injects a visible pointer cursor + click-highlight ripple overlay on interactive screens.
 * - Transcodes & slices every clip to constant-30fps H.264 `.mp4` in `video/public/clips/`
 *   and writes `video/src/clips-manifest.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { findChromiumExe, findFfmpeg } from './bin-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(VIDEO_ROOT, '..');
const RAW_DIR = path.join(VIDEO_ROOT, 'recordings-raw');
const CLIPS_DIR = path.join(VIDEO_ROOT, 'public', 'clips');
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

fs.rmSync(RAW_DIR, { recursive: true, force: true });
fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(CLIPS_DIR, { recursive: true });

const FFMPEG = findFfmpeg(VIDEO_ROOT);
const CHROMIUM_EXE = findChromiumExe();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await sleep(400);
  }
  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

const DIST_DIR = '.next-video';

function ensureIsolatedProdBuild() {
  const buildIdPath = path.join(REPO_ROOT, DIST_DIR, 'BUILD_ID');
  if (!fs.existsSync(buildIdPath) || process.env.VIDEO_REBUILD === '1') {
    console.log(`  → Building isolated production Next.js bundle into ${DIST_DIR} ...`);
    const nextBin = path.join(REPO_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
    execFileSync(process.execPath, [nextBin, 'build'], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'production', NEXT_DIST_DIR: DIST_DIR },
      stdio: 'inherit',
    });
  }
}

function startNextServer() {
  ensureIsolatedProdBuild();
  const nextBin = path.join(REPO_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'production', NEXT_DIST_DIR: DIST_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.error(`[next] ${s}`);
  });
  return child;
}

function transcodeClip(inWebm, outMp4, opts = {}) {
  const args = ['-y'];
  if (opts.ss !== undefined && opts.ss > 0) {
    args.push('-ss', opts.ss.toFixed(3));
  }
  args.push('-i', inWebm);
  if (opts.t !== undefined && opts.t > 0) {
    args.push('-t', opts.t.toFixed(3));
  }
  if (opts.scale) {
    args.push('-vf', `scale=${opts.scale}`);
  }
  args.push(
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-an',
    '-movflags',
    '+faststart',
    outMp4
  );
  execFileSync(FFMPEG, args, { stdio: 'ignore' });
}

function getDurationSec(filePath) {
  try {
    execFileSync(FFMPEG, ['-i', filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const stderr = String(err.stderr || '');
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) {
      return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    }
  }
  return 0;
}

/**
 * Visible maroon-outlined golden demo cursor + expanding golden/blue click-ripple overlay.
 * Also hides Next.js dev badges & native scrollbars so every take looks broadcast-grade.
 */
const CURSOR_AND_CLEAN_UI_SCRIPT = () => {
  const style = document.createElement('style');
  style.id = '__casino-video-clean-style';
  style.textContent = `
    nextjs-portal, #__next-build-watcher, [data-nextjs-toast], [data-nextjs-dialog-overlay] {
      display: none !important;
      visibility: hidden !important;
    }
    *::-webkit-scrollbar { width: 0px !important; height: 0px !important; }
    * { scrollbar-width: none !important; }
    @keyframes __casinoRipple {
      0% { transform: translate(-50%, -50%) scale(0.35); opacity: 0.95; }
      100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
    }
  `;
  const mount = () => {
    if (!document.head || !document.body) return;
    if (!document.head.querySelector('#__casino-video-clean-style')) {
      document.head.appendChild(style);
    }
    if (window.__HIDE_DEMO_CURSOR__) return;
    if (document.getElementById('__casino-demo-cursor')) return;

    const cursor = document.createElement('div');
    cursor.id = '__casino-demo-cursor';
    cursor.style.cssText = `
      position: fixed; left: -100px; top: -100px; z-index: 2147483647;
      pointer-events: none; width: 32px; height: 32px;
      transform: translate(-4px, -3px); transition: transform 80ms ease-out;
      filter: drop-shadow(2px 3px 0 #4F0716);
    `;
    cursor.innerHTML = `
      <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
        <path d="M5 3L25 14.5L15.6 17.2L12.5 26.5L5 3Z"
          fill="#FFC12B" stroke="#4F0716" stroke-width="2.6" stroke-linejoin="round"/>
      </svg>
    `;
    document.body.appendChild(cursor);

    const spawnRipple = (x, y) => {
      const r = document.createElement('div');
      r.style.cssText = `
        position: fixed; left: ${x}px; top: ${y}px; z-index: 2147483646;
        pointer-events: none; width: 34px; height: 34px; border-radius: 9999px;
        border: 4px solid #FFC12B; box-shadow: 0 0 0 2px #4F0716, 0 0 18px rgba(47,107,255,0.65);
        animation: __casinoRipple 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      `;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 560);
    };

    window.addEventListener(
      'mousemove',
      (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      },
      { passive: true }
    );
    window.addEventListener(
      'pointerdown',
      (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        cursor.style.transform = 'translate(-4px, -3px) scale(0.84)';
        spawnRipple(e.clientX, e.clientY);
      },
      { passive: true }
    );
    window.addEventListener(
      'pointerup',
      () => {
        cursor.style.transform = 'translate(-4px, -3px) scale(1)';
      },
      { passive: true }
    );
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  const obs = new MutationObserver(() => {
    if (document.body && !window.__HIDE_DEMO_CURSOR__ && !document.getElementById('__casino-demo-cursor')) {
      mount();
    }
  });
  if (document.documentElement) {
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
};

const cursorPosByPage = new WeakMap();

async function glideTo(page, x, y, steps = 16) {
  const prev = cursorPosByPage.get(page) || { x: x - 120, y: y - 60 };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = 1 - Math.pow(1 - t, 3);
    const nx = prev.x + (x - prev.x) * ease;
    const ny = prev.y + (y - prev.y) * ease;
    await page.mouse.move(nx, ny);
    await sleep(16);
  }
  cursorPosByPage.set(page, { x, y });
}

async function humanClick(page, locator, opts = {}) {
  const target = typeof locator === 'string' ? page.locator(locator).first() : locator.first();
  await target.waitFor({ state: 'visible', timeout: 15_000 });
  await target.scrollIntoViewIfNeeded();
  await sleep(180);
  const box = await target.boundingBox();
  if (!box) {
    await target.click();
    await sleep(opts.afterMs ?? 380);
    return;
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await glideTo(page, cx, cy, opts.steps ?? 16);
  await sleep(opts.hoverPauseMs ?? 190);
  // Re-check bounding box right before clicking in case a banner/toast shifted layout
  const settled = await target.boundingBox();
  if (settled && (Math.abs(settled.x - box.x) > 4 || Math.abs(settled.y - box.y) > 4)) {
    await glideTo(page, settled.x + settled.width / 2, settled.y + settled.height / 2, 6);
  }
  await page.mouse.down();
  await sleep(75);
  await page.mouse.up();
  await sleep(opts.afterMs ?? 380);
}

async function smoothScroll(page, targetY, durationMs = 1200) {
  await page.evaluate(
    ({ y, dur }) =>
      new Promise((resolve) => {
        const startY = window.scrollY;
        const diff = y - startY;
        const t0 = performance.now();
        const step = (now) => {
          const u = Math.min(1, (now - t0) / dur);
          const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          window.scrollTo(0, startY + diff * ease);
          if (u < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { y: targetY, dur: durationMs }
  );
}

async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.__casinoVideoDemo), { timeout: 20_000 });
  await sleep(350);
}

async function loadDemoPreset(page, preset) {
  await waitForAppReady(page);
  const res = await page.evaluate(async (p) => window.__casinoVideoDemo.loadState(p), preset);
  if (res.violationsCount !== 0) {
    throw new Error(`Video demo preset "${preset}" reported ${res.violationsCount} invariant violations!`);
  }
  await sleep(350);
  return res;
}

async function savePageVideo(page, destWebm) {
  const v = page.video();
  await page.close();
  if (!v) throw new Error(`No video attached to page for ${destWebm}`);
  await v.saveAs(destWebm);
  return destWebm;
}

async function main() {
  console.log('=== Starting Real-App Playwright Recording Pipeline ===');
  const server = startNextServer();
  const pageErrors = [];
  const manifest = {
    recordedAt: new Date().toISOString(),
    clips: {},
  };

  let browser;
  try {
    await waitForServer(`${BASE_URL}/`);
    console.log(`  ✓ Production Next.js server ready at ${BASE_URL}`);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
        '--force-color-profile=srgb',
      ],
    });
    console.log(`  ✓ Launched Playwright Chromium`);

    const attachErrorTracker = (page, label) => {
      page.on('pageerror', (err) => {
        console.error(`  ✖ [${label}] pageerror: ${err.message}`);
        pageErrors.push(`${label}: ${err.message}`);
      });
    };

    // =========================================================================
    // TAKE 1: FINAL NIGHT SHOWCASE & LIVE 1v1v1 GRAND FINAL BIG SCREEN (EN+AR)
    // =========================================================================
    console.log('\n[Take 1/5] Recording Final Night (/final) & 1v1v1 Grand Final (/screen/match-final)...');
    {
      const ctx = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        recordVideo: { dir: RAW_DIR, size: { width: 1920, height: 1080 } },
      });
      await ctx.addInitScript(CURSOR_AND_CLEAN_UI_SCRIPT);

      // Load 'final' deterministic state
      const seedPage = await ctx.newPage();
      attachErrorTracker(seedPage, 'seed-final');
      await seedPage.goto(`${BASE_URL}/?demoRole=visitor&tabLang=en`);
      await loadDemoPreset(seedPage, 'final');
      await seedPage.close();

      // 1A. /final showcase
      const finalPage = await ctx.newPage();
      attachErrorTracker(finalPage, 'final');
      const finalRecStart = Date.now();
      await finalPage.goto(`${BASE_URL}/final?demoRole=visitor&tabLang=en`);
      await finalPage.waitForSelector('text=Marwan Serry', { timeout: 15_000 });
      await sleep(700);
      const finalReadySec = (Date.now() - finalRecStart) / 1000;
      await sleep(2200);
      await smoothScroll(finalPage, 520, 2600);
      await sleep(2400);
      await smoothScroll(finalPage, 1080, 2000);
      await sleep(1600);
      const rawFinal = await savePageVideo(finalPage, path.join(RAW_DIR, 'a1-final-showcase.webm'));
      const outFinal = path.join(CLIPS_DIR, 'a1-final-showcase.mp4');
      transcodeClip(rawFinal, outFinal, { ss: Math.max(0, finalReadySec - 0.15) });
      manifest.clips['a1-final-showcase'] = {
        path: 'clips/a1-final-showcase.mp4',
        durationSec: Number(getDurationSec(outFinal).toFixed(2)),
      };
      console.log(`  ✓ a1-final-showcase.mp4 (${manifest.clips['a1-final-showcase'].durationSec}s)`);

      // 1B. /screen/match-final (clean broadcast, EN + AR RTL)
      const screenFinal = await ctx.newPage();
      await screenFinal.addInitScript(() => {
        window.__HIDE_DEMO_CURSOR__ = true;
      });
      attachErrorTracker(screenFinal, 'screen-final');
      const sfRecStart = Date.now();
      await screenFinal.goto(`${BASE_URL}/screen/match-final?demoRole=visitor&tabLang=en`);
      await screenFinal.waitForSelector('text=Marwan Serry', { timeout: 15_000 });
      await sleep(700);
      const sfReadySec = (Date.now() - sfRecStart) / 1000;
      // Hold in EN
      await sleep(4800);
      // Click Arabic toggle cleanly inside PresenterControlPill
      const arBtn = screenFinal.getByRole('button', { name: /عربي/i }).first();
      if (await arBtn.isVisible()) {
        await arBtn.click();
        await sleep(5200);
      }
      const rawSf = await savePageVideo(screenFinal, path.join(RAW_DIR, 'a1-final-bigscreen.webm'));
      const outSf = path.join(CLIPS_DIR, 'a1-final-bigscreen.mp4');
      transcodeClip(rawSf, outSf, { ss: Math.max(0, sfReadySec - 0.1) });
      manifest.clips['a1-final-bigscreen'] = {
        path: 'clips/a1-final-bigscreen.mp4',
        durationSec: Number(getDurationSec(outSf).toFixed(2)),
      };
      console.log(`  ✓ a1-final-bigscreen.mp4 (${manifest.clips['a1-final-bigscreen'].durationSec}s)`);

      await ctx.close();
    }

    // =========================================================================
    // TAKE 2: ADMIN SETTINGS & UNLOCKED GROUP DRAW ('fresh' preset, 1920x1080)
    // =========================================================================
    console.log('\n[Take 2/5] Recording Admin Settings (720/3/1) & Unlocked Group Draw...');
    {
      const ctx = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        recordVideo: { dir: RAW_DIR, size: { width: 1920, height: 1080 } },
      });
      await ctx.addInitScript(CURSOR_AND_CLEAN_UI_SCRIPT);

      const page = await ctx.newPage();
      attachErrorTracker(page, 'admin-setup');
      const recStart = Date.now();
      await page.goto(`${BASE_URL}/admin/settings?demoRole=superAdmin&tabLang=en`);
      await loadDemoPreset(page, 'fresh');
      await page.goto(`${BASE_URL}/admin/settings?demoRole=superAdmin&tabLang=en`);
      await page.waitForSelector('text=720', { timeout: 15_000 });
      await sleep(500);
      const tSettingsStart = (Date.now() - recStart) / 1000;
      await smoothScroll(page, 260, 1400);
      await sleep(2200);
      await smoothScroll(page, 560, 1400);
      await sleep(1600);
      const tSettingsEnd = (Date.now() - recStart) / 1000;

      // Navigate to /admin/groups to show 240 groups + unlocked Random Re-Draw
      await page.goto(`${BASE_URL}/admin/groups?demoRole=superAdmin&tabLang=en`);
      await page.waitForSelector('text=Random Re-Draw', { timeout: 15_000 });
      await sleep(500);
      const tGroupsStart = (Date.now() - recStart) / 1000;
      await sleep(1400);
      await humanClick(page, page.getByRole('button', { name: /Random Re-Draw/i }), { afterMs: 900 });
      await humanClick(
        page,
        page.locator('[role="dialog"]').getByRole('button', { name: /Random Re-Draw/i }),
        { afterMs: 1400 }
      );
      await sleep(1800);
      const tGroupsEnd = (Date.now() - recStart) / 1000;

      const raw = await savePageVideo(page, path.join(RAW_DIR, 'b1-admin-setup.webm'));
      const outSettings = path.join(CLIPS_DIR, 'b1-admin-settings.mp4');
      const outGroups = path.join(CLIPS_DIR, 'b1-admin-groups.mp4');
      transcodeClip(raw, outSettings, {
        ss: Math.max(0, tSettingsStart),
        t: tSettingsEnd - tSettingsStart,
      });
      transcodeClip(raw, outGroups, {
        ss: Math.max(0, tGroupsStart),
        t: tGroupsEnd - tGroupsStart,
      });
      manifest.clips['b1-admin-settings'] = {
        path: 'clips/b1-admin-settings.mp4',
        durationSec: Number(getDurationSec(outSettings).toFixed(2)),
      };
      manifest.clips['b1-admin-groups'] = {
        path: 'clips/b1-admin-groups.mp4',
        durationSec: Number(getDurationSec(outGroups).toFixed(2)),
      };
      console.log(
        `  ✓ b1-admin-settings.mp4 (${manifest.clips['b1-admin-settings'].durationSec}s) & b1-admin-groups.mp4 (${manifest.clips['b1-admin-groups'].durationSec}s)`
      );
      await ctx.close();
    }

    // =========================================================================
    // TAKE 3: PLAYER PHONE VIEW (390x844 @ deviceScaleFactor: 3, EN + AR RTL)
    // =========================================================================
    console.log('\n[Take 3/5] Recording Player Phone (390x844 @3x: 24 Avatars, Table #1, Secrecy, Judge Help, AR RTL)...');
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: RAW_DIR, size: { width: 390, height: 844 } },
      });
      await ctx.addInitScript(CURSOR_AND_CLEAN_UI_SCRIPT);

      const seedPage = await ctx.newPage();
      await seedPage.goto(`${BASE_URL}/?demoRole=superAdmin&tabLang=en`);
      await loadDemoPreset(seedPage, 'main');
      await seedPage.close();

      const pPage = await ctx.newPage();
      attachErrorTracker(pPage, 'player-phone');
      const recStart = Date.now();
      await pPage.goto(`${BASE_URL}/player?demoRole=player&demoPlayerId=player-1&tabLang=en`);
      await pPage.locator('text=Omar Hassan >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await sleep(700);
      const tReady = (Date.now() - recStart) / 1000;

      // 1. Show profile header & open Avatar Studio (24 3D avatars + Upload/Camera crop)
      await sleep(1400);
      const editAvatarBtn = pPage.getByRole('button', { name: /Edit Avatar|Change Avatar|Avatar/i }).first();
      if (await editAvatarBtn.isVisible()) {
        await humanClick(pPage, editAvatarBtn, { afterMs: 1600 });
        // Click Upload Photo tab inside dialog to show crop & <=300KB studio
        const uploadTab = pPage.locator('[role="dialog"]').getByRole('tab', { name: /Upload|Photo/i }).first();
        if (await uploadTab.isVisible()) {
          await humanClick(pPage, uploadTab, { afterMs: 1400 });
        }
        // Switch back to 3D avatars briefly then close
        const libTab = pPage.locator('[role="dialog"]').getByRole('tab', { name: /3D|Library/i }).first();
        if (await libTab.isVisible()) {
          await humanClick(pPage, libTab, { afterMs: 900 });
        }
        await pPage.keyboard.press('Escape');
        await sleep(500);
      }

      // 2. Scroll to Upcoming Match Card (TABLE #1 + Surprise Segments lock)
      await smoothScroll(pPage, 470, 1400);
      await sleep(2800);

      // 3. Scroll to Judge Help Card & highlight contact buttons
      await smoothScroll(pPage, 920, 1200);
      await sleep(1600);
      const judgeWa = pPage.locator('[data-testid="judge-whatsapp-btn"]').first();
      if (await judgeWa.isVisible()) {
        const box = await judgeWa.boundingBox();
        if (box) {
          await glideTo(pPage, box.x + box.width / 2, box.y + box.height / 2, 16);
          await sleep(1200);
        }
      }

      // 4. Scroll back to top and switch to Arabic RTL (عربي)!
      await smoothScroll(pPage, 0, 900);
      await sleep(400);
      const arToggle = pPage.getByRole('button', { name: /عربي/i }).first();
      if (await arToggle.isVisible()) {
        await humanClick(pPage, arToggle, { afterMs: 1400 });
        await smoothScroll(pPage, 560, 1500);
        await sleep(2400);
      }

      const rawPhone = await savePageVideo(pPage, path.join(RAW_DIR, 'b2-player-phone.webm'));
      const outPhone = path.join(CLIPS_DIR, 'b2-player-phone.mp4');
      transcodeClip(rawPhone, outPhone, { ss: Math.max(0, tReady) });
      manifest.clips['b2-player-phone'] = {
        path: 'clips/b2-player-phone.mp4',
        durationSec: Number(getDurationSec(outPhone).toFixed(2)),
      };
      console.log(`  ✓ b2-player-phone.mp4 (${manifest.clips['b2-player-phone'].durationSec}s)`);
      await ctx.close();
    }

    // =========================================================================
    // TAKE 4: ONE SHARED BROWSER CONTEXT — LIVE MULTI-TAB SYNC LIFECYCLE
    //         (Admin + Scorer + Big Screen + Fan Sync Phone + Fan Laptop)
    // =========================================================================
    console.log('\n[Take 4/5] Recording ONE-CONTEXT Live Multi-Tab Lifecycle & Split-Screen Sync...');
    {
      const sharedCtx = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        recordVideo: { dir: RAW_DIR, size: { width: 1920, height: 1080 } },
      });
      await sharedCtx.addInitScript(CURSOR_AND_CLEAN_UI_SCRIPT);

      // 4.0 Admin Page boots deterministic 'main' state (shared across ALL tabs in sharedCtx!)
      const adminPage = await sharedCtx.newPage();
      attachErrorTracker(adminPage, 'shared-admin');
      const adminRecStart = Date.now();
      await adminPage.goto(`${BASE_URL}/admin/matches?demoRole=superAdmin&tabLang=en`);
      await loadDemoPreset(adminPage, 'main');
      await adminPage.goto(`${BASE_URL}/admin/matches?demoRole=superAdmin&tabLang=en`);
      await adminPage.locator('text=Group 1 >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await sleep(700);
      const tAdminSchedStart = (Date.now() - adminRecStart) / 1000;
      // Search "Group 1 · Match 3" or "Group 1" to highlight Table #1 & Judge Scorer 1
      const searchBox = adminPage.locator('input[type="search"], input[placeholder*="Search"]').first();
      if (await searchBox.isVisible()) {
        await humanClick(adminPage, searchBox, { afterMs: 250 });
        await searchBox.fill('Group 1 · Match 3');
        await sleep(2400);
      } else {
        await sleep(2600);
      }
      const tAdminSchedEnd = (Date.now() - adminRecStart) / 1000;

      // 4.1 Open Scorer, Big Screen, and Fan Sync Phone SIMULTANEOUSLY in the SAME sharedCtx!
      const scorerPage = await sharedCtx.newPage();
      attachErrorTracker(scorerPage, 'shared-scorer');
      const scorerRecStart = Date.now();
      await scorerPage.goto(`${BASE_URL}/scorer/match-g1-m3?demoRole=scorer&tabLang=en`);
      await scorerPage.locator('text=Omar Hassan >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });

      const bigScreenPage = await sharedCtx.newPage();
      await bigScreenPage.addInitScript(() => {
        window.__HIDE_DEMO_CURSOR__ = true;
      });
      attachErrorTracker(bigScreenPage, 'shared-bigscreen');
      const bigRecStart = Date.now();
      await bigScreenPage.goto(`${BASE_URL}/screen/match-g1-m3?demoRole=visitor&tabLang=en`);
      await bigScreenPage.locator('text=Omar Hassan >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });

      // Fan Sync tab inside the SAME BrowserContext so BroadcastChannel + IndexedDB sync live!
      const fanSyncPage = await sharedCtx.newPage();
      await fanSyncPage.addInitScript(() => {
        window.__HIDE_DEMO_CURSOR__ = true;
      });
      attachErrorTracker(fanSyncPage, 'shared-fansync');
      const fanSyncRecStart = Date.now();
      await fanSyncPage.goto(`${BASE_URL}/groups?group=1&demoRole=visitor&tabLang=en`);
      await fanSyncPage.locator('text=Omar Hassan >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await smoothScroll(fanSyncPage, 320, 500);
      await sleep(500);

      // Focus Scorer tab for B.3 live officiating!
      await scorerPage.bringToFront();
      await sleep(500);
      const tScorerStart = (Date.now() - scorerRecStart) / 1000;

      // Start Live Match
      const startLiveBtn = scorerPage.getByRole('button', { name: /Start Live Match/i }).first();
      if (await startLiveBtn.isVisible()) {
        await humanClick(scorerPage, startLiveBtn, { afterMs: 450 });
        const confirmStart = scorerPage
          .locator('[role="dialog"]')
          .getByRole('button', { name: /Start Live Now/i })
          .first();
        await humanClick(scorerPage, confirmStart, { afterMs: 850 });
      }

      // Open Contact Dialog beside Mostafa Gamal (late player check — logs contact.viewed!)
      await sleep(450);
      const contactBtn = scorerPage.getByRole('button', { name: /Contact Mostafa Gamal/i }).first();
      await humanClick(scorerPage, contactBtn, { afterMs: 350 });
      const contactDialog = scorerPage.locator('[role="dialog"]').first();
      if (!(await contactDialog.isVisible().catch(() => false))) {
        await contactBtn.click();
      }
      await contactDialog.waitFor({ state: 'visible', timeout: 8_000 });
      await sleep(2200);
      await scorerPage.keyboard.press('Escape');
      await sleep(450);

      // Scorer v2 live play: Buzz, +1, -1, Undo, Yellow card (-1) with note, Red card (-2) with note, Mark Absent preview
      const buzzOmar = scorerPage.locator('button:has-text("Buzzed First"):has-text("Omar Hassan")');
      const buzzMostafa = scorerPage.locator('button:has-text("Buzzed First"):has-text("Mostafa Gamal")');
      const plusOmar = scorerPage.getByRole('button', { name: 'Award +1 point to Omar Hassan' });
      const minusOmar = scorerPage.getByRole('button', { name: 'Deduct −1 point from Omar Hassan' });
      const plusMostafa = scorerPage.getByRole('button', { name: 'Award +1 point to Mostafa Gamal' });
      const yellowMostafa = scorerPage.getByRole('button', { name: 'Issue Yellow card (−1) to Mostafa Gamal' });
      const redMostafa = scorerPage.getByRole('button', { name: 'Issue Red card (−2) to Mostafa Gamal' });
      const noteInput = scorerPage.locator('input[placeholder*="note" i], input[aria-label*="note" i]').first();

      // Omar +1, +1, +1 (= 3)
      await humanClick(scorerPage, buzzOmar, { afterMs: 320 });
      await humanClick(scorerPage, plusOmar, { afterMs: 350 });
      await humanClick(scorerPage, plusOmar, { afterMs: 280 });
      await humanClick(scorerPage, plusOmar, { afterMs: 320 });

      // Demo -1 then compensating Undo on Omar (3 -> 2 -> 3)
      await humanClick(scorerPage, minusOmar, { afterMs: 550 });
      const undoBtn = scorerPage.getByRole('button', { name: /Undo/i }).first();
      await humanClick(scorerPage, undoBtn, { afterMs: 650 });

      // Mostafa +1 x5 (= 5)
      await humanClick(scorerPage, buzzMostafa, { afterMs: 300 });
      for (let i = 0; i < 5; i++) {
        await humanClick(scorerPage, plusMostafa, { steps: 8, hoverPauseMs: 90, afterMs: 220 });
      }

      // Yellow card (-1) with note "False buzz" (5 -> 4)
      if (await noteInput.isVisible()) {
        await humanClick(scorerPage, noteInput, { afterMs: 180 });
        await noteInput.fill('False buzz');
        await sleep(260);
      }
      await humanClick(scorerPage, yellowMostafa, { afterMs: 800 });

      // Red card (-2) with note "Disputed interruption" (4 -> 2)
      if (await noteInput.isVisible()) {
        await humanClick(scorerPage, noteInput, { afterMs: 180 });
        await noteInput.fill('Disputed interruption');
        await sleep(260);
      }
      await humanClick(scorerPage, redMostafa, { afterMs: 850 });

      // Preview Mark Absent confirmation dialog, wait for it to render clearly, then Cancel
      const markAbsentBtn = scorerPage.getByRole('button', { name: /Mark Absent/i }).nth(1);
      await humanClick(scorerPage, markAbsentBtn, { afterMs: 400 });
      await scorerPage
        .getByRole('button', { name: /Confirm Mark Absent/i })
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => {});
      const tScorerAbsentStart = (Date.now() - scorerRecStart) / 1000;
      await sleep(1900);
      await scorerPage.keyboard.press('Escape');
      await sleep(500);

      const tScorerEnd = (Date.now() - scorerRecStart) / 1000;

      // -----------------------------------------------------------------------
      // SYNCHRONIZED 3-WAY SPLIT-SCREEN MONEY SHOT (Omar 3 - Mostafa 2 -> 3 - 3!)
      // All 3 pages (scorerPage, bigScreenPage, fanSyncPage) are live in sharedCtx!
      // -----------------------------------------------------------------------
      await sleep(700);
      const syncWallStart = Date.now();
      const tSyncScorerStart = (syncWallStart - scorerRecStart) / 1000;
      const tSyncBigStart = (syncWallStart - bigRecStart) / 1000;
      const tSyncFanStart = (syncWallStart - fanSyncRecStart) / 1000;

      await sleep(1100);
      // TAP BUZZ ON MOSTAFA -> Big Screen flashes gold halo immediately!
      await humanClick(scorerPage, buzzMostafa, { steps: 14, hoverPauseMs: 200, afterMs: 950 });
      // TAP +1 ON MOSTAFA -> 2 -> 3 (TIED 3-3!) -> Big Screen & Fan Phone update on exact same beat!
      await humanClick(scorerPage, plusMostafa, { steps: 14, hoverPauseMs: 200, afterMs: 3200 });

      const syncWallEnd = Date.now();
      const syncDurSec = (syncWallEnd - syncWallStart) / 1000;
      console.log(`  ★ Captured synchronized 3-way split-screen money shot (${syncDurSec.toFixed(2)}s)!`);

      // -----------------------------------------------------------------------
      // B.4 BIG SCREEN: TIE-BREAK -> ARABIC RTL -> WINNER MOMENT -> LEADERBOARD
      // -----------------------------------------------------------------------
      const tBigTieStart = (Date.now() - bigRecStart) / 1000;

      // Scorer clicks Finish Match while tied 3-3 -> Draw blocked -> Tie-Breaker #16 opens!
      await humanClick(scorerPage, scorerPage.getByRole('button', { name: /Finish Match/i }).first(), {
        afterMs: 550,
      });
      await humanClick(
        scorerPage,
        scorerPage.getByRole('button', { name: /Open Tie-Breaker/i }).first(),
        { afterMs: 1400 }
      );

      // Bring Big Screen forward for 2.2s in English showing Sudden-Death Tie-Breaker #16
      await bigScreenPage.bringToFront();
      await sleep(2200);

      // Toggle Big Screen to Arabic RTL (عربي) — isolated to bigScreenPage via tabLang!
      const bigArBtn = bigScreenPage.getByRole('button', { name: /عربي/i }).first();
      if (await bigArBtn.isVisible()) {
        await bigArBtn.click();
        await sleep(2600);
      }

      // Now Scorer awards Omar's sudden-death +1 (4-3) & finishes match while Big Screen watches live!
      await buzzOmar.click();
      await sleep(900);
      await plusOmar.click();
      await sleep(1400);
      await scorerPage.getByRole('button', { name: /Finish Match/i }).first().click();
      await scorerPage
        .getByRole('button', { name: /Confirm Winner & Finish/i })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
      await scorerPage
        .getByRole('button', { name: /Confirm Winner & Finish/i })
        .first()
        .click();

      // Wait for Big Screen Victory Stage Celebration to appear & hold clearly in AR then EN!
      await bigScreenPage
        .locator('text=/الفائز|البطل|WINNER|CHAMPION|انتهت/i >> visible=true')
        .first()
        .waitFor({ state: 'visible', timeout: 12_000 })
        .catch(() => {});
      const tBigWinnerMoment = (Date.now() - bigRecStart) / 1000;
      await sleep(3200);
      const bigEnBtn = bigScreenPage.getByRole('button', { name: /^EN$/i }).first();
      if (await bigEnBtn.isVisible()) {
        await bigEnBtn.click();
        await sleep(3000);
      }
      const tBigTieEnd = (Date.now() - bigRecStart) / 1000;

      // Navigate Big Screen to /screen/leaderboard (Top-3 Podium + live board)
      await bigScreenPage.goto(`${BASE_URL}/screen/leaderboard?demoRole=visitor&tabLang=en`);
      await bigScreenPage.locator('text=Leaderboard >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
      await sleep(900);
      const tBigLbStart = (Date.now() - bigRecStart) / 1000;
      await sleep(4800);
      const tBigLbEnd = (Date.now() - bigRecStart) / 1000;

      // -----------------------------------------------------------------------
      // B.5 FAN LAPTOP: 256-SLOT ZOOMABLE BRACKET, 16 BYEs, MINIMAP, PLAYER PATH
      // -----------------------------------------------------------------------
      const fanLaptopPage = await sharedCtx.newPage();
      attachErrorTracker(fanLaptopPage, 'shared-fan-laptop');
      const fanLapRecStart = Date.now();
      await fanLaptopPage.goto(`${BASE_URL}/bracket?demoRole=visitor&tabLang=en`);
      await fanLaptopPage.locator('text=BYE >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
      await sleep(900);
      const tBracketStart = (Date.now() - fanLapRecStart) / 1000;
      await smoothScroll(fanLaptopPage, 220, 900);
      await sleep(1800);

      // Highlight Omar Hassan's path in the 720-player searchable combobox!
      const comboTrigger = fanLaptopPage.getByRole('button', { name: /Highlight player path/i }).first();
      if (await comboTrigger.isVisible()) {
        await humanClick(fanLaptopPage, comboTrigger, { afterMs: 400 });
        const comboInput = fanLaptopPage.locator('input[placeholder*="Search" i], input[type="text"]').last();
        if (await comboInput.isVisible()) {
          await comboInput.fill('Omar Hassan');
          await sleep(500);
          const opt = fanLaptopPage.locator('button:has-text("Omar Hassan")').first();
          if (await opt.isVisible()) {
            await humanClick(fanLaptopPage, opt, { afterMs: 1400 });
          }
        }
      }
      // Show Quarter 1 / Full region focus
      const q1Btn = fanLaptopPage.getByRole('button', { name: /Quarter 1|Full/i }).first();
      if (await q1Btn.isVisible()) {
        await humanClick(fanLaptopPage, q1Btn, { afterMs: 1800 });
      } else {
        await sleep(2000);
      }
      const tBracketEnd = (Date.now() - fanLapRecStart) / 1000;

      // E.1 SPONSORS on fanLaptopPage (before closing)
      await fanLaptopPage.goto(`${BASE_URL}/sponsors?demoRole=visitor&tabLang=en`);
      await fanLaptopPage.locator('text=YOUR BRAND HERE >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
      await sleep(700);
      const tSponsorsStart = (Date.now() - fanLapRecStart) / 1000;
      await smoothScroll(fanLaptopPage, 360, 1800);
      await sleep(2000);
      await smoothScroll(fanLaptopPage, 1080, 2200);
      await sleep(1800);
      const tSponsorsEnd = (Date.now() - fanLapRecStart) / 1000;

      // -----------------------------------------------------------------------
      // B.6 BACK TO ADMIN: RESULTS FEED -> AUDIT -> REVERT + IMPACT PREVIEW -> CONSISTENCY
      // -----------------------------------------------------------------------
      await adminPage.bringToFront();

      // 1. Results Feed (/admin/results) showing timestamped Yellow card (-1) & Red card (-2)
      await adminPage.goto(`${BASE_URL}/admin/results?demoRole=superAdmin&tabLang=en`);
      await adminPage.locator('text=Yellow card >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await sleep(700);
      const tResultsStart = (Date.now() - adminRecStart) / 1000;
      await smoothScroll(adminPage, 220, 1200);
      await sleep(2600);

      // 2. Audit Log (/admin/audit) showing contact.viewed & Inspect Diff
      await adminPage.goto(`${BASE_URL}/admin/audit?demoRole=superAdmin&tabLang=en`);
      await adminPage.locator('text=Inspect Diff >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
      await sleep(900);
      const diffBtn = adminPage.getByRole('button', { name: /Inspect Diff/i }).first();
      if (await diffBtn.isVisible()) {
        await humanClick(adminPage, diffBtn, { afterMs: 1600 });
        await adminPage.keyboard.press('Escape');
        await sleep(400);
      }
      const tResultsEnd = (Date.now() - adminRecStart) / 1000;

      // 3. Start downstream Round of 256 Match 17 so reverting triggers REAL ImpactPreviewDialog!
      await adminPage.evaluate(async () => {
        await window.__casinoVideoDemo.startMatch('match-ko-256-17', 'user-admin');
      });
      await sleep(300);

      // Open /scorer/match-g1-m3 as Super Admin (shows Finished Podium with Omar Hassan Winner)
      await adminPage.goto(`${BASE_URL}/scorer/match-g1-m3?demoRole=superAdmin&tabLang=en`);
      await adminPage.locator('text=Manage History >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await sleep(700);
      const tRevertStart = (Date.now() - adminRecStart) / 1000;
      await sleep(1100);

      // Open Manage History -> Revert Mostafa's Red card (-2) -> Impact Preview pops up!
      await humanClick(adminPage, adminPage.getByRole('button', { name: /Manage History/i }), {
        afterMs: 900,
      });

      // Find the Red card (-2) row inside SessionHistoryDrawer and click its Revert button
      const redRow = adminPage
        .locator('[role="dialog"] div')
        .filter({ hasText: /Disputed interruption|Red card/i })
        .filter({ has: adminPage.getByRole('button', { name: 'Revert this entry' }) })
        .last();
      await humanClick(adminPage, redRow.getByRole('button', { name: 'Revert this entry' }), {
        afterMs: 700,
      });

      // Confirm initial revert confirm dialog -> triggers ImpactPreviewDialog!
      const confirmRevBtn = adminPage
        .getByRole('button', { name: /Confirm Revert/i })
        .first();
      await humanClick(adminPage, confirmRevBtn, { afterMs: 2600 });

      // ImpactPreviewDialog is now visible! Wait clearly so viewers read it, then confirm
      const applyCascadeBtn = adminPage
        .getByRole('button', { name: /Confirm & Apply Change/i })
        .first();
      await applyCascadeBtn.waitFor({ state: 'visible', timeout: 12_000 });
      const tImpactShown = (Date.now() - adminRecStart) / 1000;
      await sleep(1400);
      await humanClick(adminPage, applyCascadeBtn, { afterMs: 1200 });
      await applyCascadeBtn.waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
      await sleep(500);

      // Close Session History Drawer & wait for the flipped score (5-4, Mostafa Winner!) to render clearly
      await adminPage.keyboard.press('Escape');
      await sleep(700);
      // Ensure drawer closed even if Escape hit inner focus
      const closeDrawerBtn = adminPage.locator('[role="dialog"] button[aria-label*="Close" i], [role="dialog"] button:has(svg.lucide-x)').first();
      if (await closeDrawerBtn.isVisible().catch(() => false)) {
        await closeDrawerBtn.click();
      }
      await adminPage.locator('text=5 >> visible=true').first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
      const tWinnerFlipped = (Date.now() - adminRecStart) / 1000;
      await sleep(2600);

      // Jump to Group 1 standings showing Mostafa Gamal now #1 Qualified!
      await adminPage.goto(`${BASE_URL}/groups?group=1&demoRole=superAdmin&tabLang=en`);
      await adminPage.locator('text=Mostafa Gamal >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await smoothScroll(adminPage, 320, 700);
      await sleep(2400);
      const tRevertEnd = (Date.now() - adminRecStart) / 1000;

      // 4. Consistency Check (/admin/consistency) -> 9/9 Invariants Pass!
      await adminPage.goto(`${BASE_URL}/admin/consistency?demoRole=superAdmin&tabLang=en`);
      await adminPage.locator('text=ALL 9 INVARIANTS PASS >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await sleep(600);
      const tConsStart = (Date.now() - adminRecStart) / 1000;
      await humanClick(adminPage, adminPage.getByRole('button', { name: /Re-Run Check/i }), {
        afterMs: 1400,
      });
      await smoothScroll(adminPage, 320, 1200);
      await sleep(1800);
      const tConsEnd = (Date.now() - adminRecStart) / 1000;

      // Save all 5 raw videos from the ONE shared BrowserContext!
      const rawAdmin = await savePageVideo(adminPage, path.join(RAW_DIR, 'shared-admin.webm'));
      const rawScorer = await savePageVideo(scorerPage, path.join(RAW_DIR, 'shared-scorer.webm'));
      const rawBig = await savePageVideo(bigScreenPage, path.join(RAW_DIR, 'shared-bigscreen.webm'));
      const rawFanSync = await savePageVideo(fanSyncPage, path.join(RAW_DIR, 'shared-fansync.webm'));
      const rawFanLap = await savePageVideo(fanLaptopPage, path.join(RAW_DIR, 'shared-fanlap.webm'));
      await sharedCtx.close();

      // Slice and transcode every clean clip!
      const slices = [
        ['b1-admin-schedule', rawAdmin, { ss: tAdminSchedStart, t: tAdminSchedEnd - tAdminSchedStart }],
        ['b3-scorer-console', rawScorer, { ss: tScorerStart, t: tScorerEnd - tScorerStart }],
        ['b3b-sync-scorer', rawScorer, { ss: tSyncScorerStart, t: syncDurSec }],
        ['b3b-sync-bigscreen', rawBig, { ss: tSyncBigStart, t: syncDurSec }],
        ['b3b-sync-fan', rawFanSync, { ss: tSyncFanStart, t: syncDurSec }],
        ['b4-bigscreen-tiebreak-win', rawBig, { ss: tBigTieStart, t: tBigTieEnd - tBigTieStart }],
        ['b4-bigscreen-leaderboard', rawBig, { ss: tBigLbStart, t: tBigLbEnd - tBigLbStart }],
        ['b5-fan-bracket', rawFanLap, { ss: tBracketStart, t: tBracketEnd - tBracketStart }],
        ['e1-sponsors', rawFanLap, { ss: tSponsorsStart, t: tSponsorsEnd - tSponsorsStart }],
        ['b6-admin-results-audit', rawAdmin, { ss: tResultsStart, t: tResultsEnd - tResultsStart }],
        ['b6-admin-revert-impact', rawAdmin, { ss: tRevertStart, t: tRevertEnd - tRevertStart }],
        ['b6-admin-consistency', rawAdmin, { ss: tConsStart, t: tConsEnd - tConsStart }],
      ];

      for (const [name, src, opts] of slices) {
        const outMp4 = path.join(CLIPS_DIR, `${name}.mp4`);
        transcodeClip(src, outMp4, opts);
        const dur = Number(getDurationSec(outMp4).toFixed(2));
        manifest.clips[name] = { path: `clips/${name}.mp4`, durationSec: dur };
        console.log(`  ✓ ${name}.mp4 (${dur}s)`);
      }

      // Store exact intra-clip beat cues so Remotion aligns highlight rings & jump cuts to the millisecond!
      manifest.cues = {
        scorerAbsentOffsetSec: Number(Math.max(0, tScorerAbsentStart - tScorerStart - 0.8).toFixed(2)),
        bigWinnerOffsetSec: Number(Math.max(0, tBigWinnerMoment - tBigTieStart - 1.2).toFixed(2)),
        impactDialogOffsetSec: Number(Math.max(0, tImpactShown - tRevertStart - 0.5).toFixed(2)),
        winnerFlippedOffsetSec: Number(Math.max(0, tWinnerFlipped - tRevertStart - 0.2).toFixed(2)),
      };
      console.log(`  ✓ Exact beat cues recorded:`, manifest.cues);
    }

    // =========================================================================
    // TAKE 5: PUBLIC FAN PHONE VIEW (390x844 @3x: Group 1 Standings + Schedule + AR RTL)
    // =========================================================================
    console.log('\n[Take 5/5] Recording Public Fan Phone (390x844 @3x: /groups, /schedule, AR RTL)...');
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: RAW_DIR, size: { width: 390, height: 844 } },
      });
      await ctx.addInitScript(CURSOR_AND_CLEAN_UI_SCRIPT);

      // Load 'final' state (where Group 1 is complete with Omar #1 Qualified!) or 'main'
      const seedPage = await ctx.newPage();
      await seedPage.goto(`${BASE_URL}/?demoRole=visitor&tabLang=en`);
      await loadDemoPreset(seedPage, 'final');
      await seedPage.close();

      const fanPhone = await ctx.newPage();
      attachErrorTracker(fanPhone, 'fan-phone');
      const recStart = Date.now();
      await fanPhone.goto(`${BASE_URL}/groups?group=1&demoRole=visitor&tabLang=en`);
      await fanPhone.locator('text=Omar Hassan >> visible=true').first().waitFor({ state: 'visible', timeout: 15_000 });
      await sleep(700);
      const tReady = (Date.now() - recStart) / 1000;

      // Group 1 standings on mobile
      await smoothScroll(fanPhone, 340, 1200);
      await sleep(2400);

      // Switch to Arabic RTL on phone!
      await smoothScroll(fanPhone, 0, 700);
      const arBtn = fanPhone.getByRole('button', { name: /عربي/i }).first();
      if (await arBtn.isVisible()) {
        await humanClick(fanPhone, arBtn, { afterMs: 1100 });
        await smoothScroll(fanPhone, 360, 1000);
        await sleep(2000);
      }

      // Navigate to /schedule (in EN so schedule times are crisp too)
      await fanPhone.goto(`${BASE_URL}/schedule?demoRole=visitor&tabLang=en`);
      await sleep(1100);
      await smoothScroll(fanPhone, 320, 1200);
      await sleep(1800);

      const raw = await savePageVideo(fanPhone, path.join(RAW_DIR, 'b5-fan-phone.webm'));
      const out = path.join(CLIPS_DIR, 'b5-fan-phone.mp4');
      transcodeClip(raw, out, { ss: Math.max(0, tReady) });
      manifest.clips['b5-fan-phone'] = {
        path: 'clips/b5-fan-phone.mp4',
        durationSec: Number(getDurationSec(out).toFixed(2)),
      };
      console.log(`  ✓ b5-fan-phone.mp4 (${manifest.clips['b5-fan-phone'].durationSec}s)`);
      await ctx.close();
    }

    // Write clips manifest for Remotion
    const manifestPath = path.join(VIDEO_ROOT, 'src', 'clips-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`\n✓ Clips manifest written to ${path.relative(VIDEO_ROOT, manifestPath)}`);

    if (pageErrors.length > 0) {
      throw new Error(`Uncaught page errors detected during recording:\n${pageErrors.join('\n')}`);
    }
    console.log('✓ Zero uncaught console/page errors across all recordings!');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error('\n✖ Recording pipeline failed:', err);
  process.exit(1);
});
