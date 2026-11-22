# Casino El Al3ab — Standalone Pitch Video Pipeline (`/video`)

This directory contains the standalone **Remotion + Playwright** video production project for pitching the **Casino El Al3ab Ramadan Tournament** platform to **Marwan Serry**. It is completely isolated from the Next.js web application's build and dependencies.

---

## Outputs Produced (`/video/out/`)

| File | Resolution & Aspect | Duration | Contents |
|---|---|---|---|
| `out/casino-pitch-16x9-en.mp4` | `1920×1080` (16:9, 30fps) | `3:12` | English narrated pitch + burned-in EN captions |
| `out/casino-pitch-16x9-ar.mp4` | `1920×1080` (16:9, 30fps) | `3:12` | Egyptian Arabic narrated pitch + burned-in RTL AR captions |
| `out/casino-teaser-9x16-en.mp4` | `1080×1920` (9:16, 30fps) | `1:08` | Vertical phone teaser (EN, mobile safe margins) |
| `out/casino-teaser-9x16-ar.mp4` | `1080×1920` (9:16, 30fps) | `1:08` | Vertical phone teaser (Egyptian AR, RTL, mobile safe margins) |
| `out/casino-pitch-en.srt` | SubRip UTF-8 | `3:12` | English captions sidecar for Main Pitch |
| `out/casino-pitch-ar.srt` | SubRip UTF-8 BOM (RTL) | `3:12` | Arabic RTL captions sidecar for Main Pitch |
| `out/casino-teaser-en.srt` | SubRip UTF-8 | `1:08` | English captions sidecar for Vertical Teaser |
| `out/casino-teaser-ar.srt` | SubRip UTF-8 BOM (RTL) | `1:08` | Arabic RTL captions sidecar for Vertical Teaser |
| `out/thumbnail-16x9.png` | `1920×1080` PNG | Still | Pitch video thumbnail (brand-safe, name-only Golden Seat) |

---

## Quick Commands (Run from Repository Root)

```bash
# 0. On a fresh clone, install video deps and generate original music, SFX & TTS audio:
npm --prefix video install
npm --prefix video run audio

# 1. Re-record all real-app clips after any UI change (builds isolated `.next-video` prod bundle safely without affecting `npm run dev`):
npm run video:record

# 2. Preview and tweak timings interactively in Remotion Studio:
npm run video:preview

# 3. Re-render all 4 MP4 videos, 4 SRT files, and the 16:9 thumbnail:
npm run video:render
```

### Advanced / Granular Commands (Inside `/video`)

```bash
# Regenerate music bed, SFX, and neural TTS narration (skips existing TTS unless --force):
npm --prefix video run audio
npm --prefix video run audio -- --force

# Export SRT subtitle files only:
npm --prefix video run srt

# Extract 20 key review frames across EN/AR 16:9 & 9:16 into video/.verify-frames/:
npm --prefix video run verify

# Typecheck the Remotion project independently from the Next.js app:
npm --prefix video run typecheck
```

---

## Replacing TTS with Your Own Voice Recording

Every scene has a clean drop-in override slot so you can record your own voice (in English, Egyptian Arabic, or both) without editing any Remotion code:

1. Read the exact scene script in [`../STORYBOARD.md`](../STORYBOARD.md) (or `video/src/storyboard.ts`).
2. Save your voice clip per scene as `.mp3` or `.wav` inside:
   - English: `video/public/audio/narration/custom/en/<sceneId>.mp3` (or `.wav`)
   - Arabic: `video/public/audio/narration/custom/ar/<sceneId>.mp3` (or `.wav`)
   - Scene IDs:
     - Main: `a1-cold-open`, `b1-admin-setup`, `b2-player-phone`, `b3-scorer-console`, `b3b-split-money-shot`, `b4-big-screen`, `b5-fan-view`, `b6-admin-fairness`, `c1-role-recap`, `d1-marwan-final`, `e1-close-cta`
     - Teaser: `t1-hook`, `t2-scale-player`, `t3-split-live`, `t4-fairness`, `t5-five-entities`, `t6-marwan-cta`
3. Run `npm --prefix video run audio` (it automatically detects custom files and updates `src/audio-manifest.json`), then run `npm run video:render`.

---

## Deterministic Demo State & Multi-Tab Live Sync

- The Playwright director (`scripts/record-all.mjs`) restores deterministic, 0-violation snapshots (`fresh`, `main`, `final`) via `window.__casinoVideoDemo.loadState(...)` backed by `src/lib/seed/videoDemo.ts` and pure `/lib/engine`.
- You can also restore any video demo state manually in a running browser by visiting `http://localhost:3000/?videoDemo=main` (or `fresh` / `final`).
- During the live 5-perspective take and Split-Screen Money Shot, **Admin**, **Scorer**, **Big Screen**, and **Public Fan View** run simultaneously inside **one shared Chromium BrowserContext** using per-tab `?demoRole=` and `?tabLang=` `sessionStorage` overrides — ensuring IndexedDB and `BroadcastChannel` sync authentically with zero faked UI.

---

## Re-Recording After UI Changes or Phase 10 Delighters

1. Run `npm run build` at the repo root so `next start` serves your latest production bundle (hidden dev UI).
2. Run `npm run video:record` — Playwright automatically re-captures every desktop (`1920×1080`), phone (`390×844 @3x`), and split-screen clip into `video/public/clips/`.
3. Run `npm run video:render` — Remotion re-renders all 4 MP4s, 4 SRTs, and the thumbnail into `video/out/`.
4. Run `npm --prefix video run verify` to inspect fresh frame snapshots across every scene.
