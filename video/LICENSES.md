# LICENSES.md — Pitch Video Audio, Font & Visual Asset Attributions

> Every visual asset, music track, sound effect, font, and voice file in `/video` is strictly original, open-licensed, or generated for this pitch prototype. Zero copyrighted show logos, zero third-party stock music without license, and zero photos of real people are used.

---

## 1. Background Music

| Asset | Source | License | Notes |
|---|---|---|---|
| `public/audio/music/gameshow-ramadan-bed.wav` | Original procedural PCM audio synthesized in `video/scripts/generate-audio.mjs` (116 BPM Hijaz/Ramadan game-show groove with synthesized oud pluck, darbuka pulse, bass, and warm chord pad) | **CC0 1.0 Universal / Project-Original** | 100% original code synthesis — royalty-free for pitch, presentation, and commercial broadcast use. |

---

## 2. Sound Effects (SFX)

| Asset | Source | License |
|---|---|---|
| `public/audio/sfx/buzzer.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |
| `public/audio/sfx/point-plus.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |
| `public/audio/sfx/card-whistle.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |
| `public/audio/sfx/whoosh.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |
| `public/audio/sfx/tiebreak-alarm.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |
| `public/audio/sfx/victory-fanfare.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |
| `public/audio/sfx/chime.wav` | Original procedural synthesis (`generate-audio.mjs`) | **CC0 1.0 Universal / Project-Original** |

---

## 3. Narration / Voiceover Tracks

| Asset | Source | License / Status |
|---|---|---|
| `public/audio/narration/en/*.mp3` | Synthesized via Microsoft Edge Neural TTS (`en-US-AndrewNeural`) through `msedge-tts` | **Pitch Prototype TTS Placeholder** — Designed with clean drop-in slots (`public/audio/narration/custom/en/<sceneId>.mp3` or `.wav`) so the product owner can replace with their own voice recording before public commercial distribution. |
| `public/audio/narration/ar/*.mp3` | Synthesized via Microsoft Edge Neural TTS (`ar-EG-ShakirNeural`, Egyptian Arabic) through `msedge-tts` | **Pitch Prototype TTS Placeholder** — Same drop-in slot (`public/audio/narration/custom/ar/<sceneId>.mp3` or `.wav`) for replacing with your own Egyptian Arabic voiceover. |

---

## 4. Typography (Google Fonts via `@remotion/google-fonts`)

| Font | Role | License |
|---|---|---|
| **Lilita One** | English Display / Headlines | **SIL Open Font License 1.1 (OFL)** |
| **Bebas Neue** | English Scores / Numerals | **SIL Open Font License 1.1 (OFL)** |
| **Inter** | English Body & Captions | **SIL Open Font License 1.1 (OFL)** |
| **Lalezar** | Arabic Display / Headlines (RTL) | **SIL Open Font License 1.1 (OFL)** |
| **Cairo** | Arabic Body, Scores & Captions (RTL) | **SIL Open Font License 1.1 (OFL)** |

---

## 5. Visuals, Device Frames, Avatars & Real App Footage

| Asset | Source | License / Brand Safety |
|---|---|---|
| Sunburst, Dice, Playing Cards, Casino Chips, Ramadan Lanterns, Marquee Bulbs (`BrandPrimitives.tsx`) | Original inline SVG/CSS created strictly from `DESIGN.md` | **Project-Original** — Zero traced or copied artwork from the real TV show. |
| Smartphone & Laptop Device Frames (`DeviceFrames.tsx`) | Original CSS/HTML device frames | **Project-Original** — Zero manufacturer/brand logos. |
| Contestant 3D Avatars (`AvatarLibrary3D.tsx` inside recorded app) | 24 original 3D-lit vector avatars | **CC0 1.0 Universal / Project-Original** — Zero real-person photos or celebrity likenesses. |
| Marwan Serry's Golden Seat | Text name only (`Marwan Serry` / `مروان سري`) | **Brand-Safe** — Zero photo or likeness used. |
| Screen Recordings (`public/clips/*.mp4`) | Captured live from this repository's production Next.js app (`v0.1.1-client-feedback-1`) via Playwright | **Project-Original** — Real app footage only. |
