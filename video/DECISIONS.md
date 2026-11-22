# Autonomous Decisions Log (`/video/DECISIONS.md`)

> Maintained automatically during Overnight Autonomous Mode (`video-overnight` branch). Every judgment call made without interrupting the user is logged here with rationale.

---

## Session Metadata
- **Branch:** `video-overnight` (branched from `v0.1.1-video` / `90faf69`)
- **Session Start:** `2026-11-22 07:48:31 +02:00`
- **Hard Iteration Cutoff:** `2 hours` from start (`09:48:31 +02:00`) — stops earlier if all 8 rubric dimensions reach `>= 8/10` and all technical checks pass, or after 3 consecutive non-improving iterations.
- **File Scope Guardrail:** All edits strictly confined to `/video/` (zero changes outside `/video/`, zero deletions outside `/video/`, zero external network calls).

---

## Decisions Made

### D1. Baseline (`video-v1`) Preservation & Versioning Layout
- **Decision:** Snapshotted the verified full-1080p `v0.1.1-video` exports (`casino-pitch-16x9-en.mp4`, `casino-pitch-16x9-ar.mp4`, `casino-teaser-9x16-en.mp4`, `casino-teaser-9x16-ar.mp4`, 4 `.srt`s, `thumbnail-16x9.png`) into `video/out/v1/` and `video/out/BEST/` before any overnight modifications.
- **Why:** Guarantees Phase 1 starts from a verified, working end-to-end baseline and guarantees `video/out/BEST/` is never degraded or empty. Added `video/.gitignore` (strictly inside `/video/`) so large iteration `.mp4` renders and contact sheets stay on disk without bloating git commits.

### D2. Audio & TTS Policy (Zero External Network Calls)
- **Decision:** Kept the already-generated local neural TTS narration files (`en-US-AndrewNeural` + `ar-EG-ShakirNeural` cached on disk in `video/public/audio/narration/{en,ar}/`), original synthesized Ramadan TV game-show music bed (`gameshow-ramadan-bed.wav`), and original synthesized SFX (`video/public/audio/sfx/*.wav`) — zero external network calls during overnight mode. Also created `/video/NARRATION.md` with exact scene-by-scene timecodes so the user can record their own voice later into `video/public/audio/narration/custom/{en,ar}/`.
- **Why:** Complies with both the zero-external-network guardrail and the local-audio preference, while allowing us to remix/normalize audio locally via FFmpeg + Remotion to hit `-16 LUFS` broadcast loudness with zero clipping and smooth ducking.

### D3. Half-Scale Fast Preview Renders + Full-Scale `BEST` Promotion
- **Decision:** Use half-scale (`--scale=0.5`, `--x264-preset=ultrafast`, `--concurrency=10`) preview renders during rapid defect-discovery passes, and full `1920×1080` / `1080×1920` (`--crf=20 --x264-preset=veryfast --concurrency=10`) renders for every promoted `vN` candidate copied to `/video/out/BEST/`.
- **Why:** On Windows ARM64 Prism emulation, a full 4-video 1080p render takes ~45–55 minutes, whereas a half-scale preview completes in ~6–9 minutes, enabling thorough visual contact-sheet + blind-reviewer iteration within the 2-hour autonomous window while ensuring `/video/out/BEST/` always contains full-resolution broadcast deliverables.

### D4. Blind Independent Reviewer Subagent
- **Decision:** Launch a fresh read-only `research` subagent with zero knowledge of how the video was authored to inspect the extracted contact sheets, `STORYBOARD.md`, audio telemetry, and caption timing report blind and score rubric `(a)–(h)`.
- **Why:** Eliminates author confirmation bias and surfaces genuine first-time viewer (Marwan Serry) friction points.

### D5. Local ITU-R BS.1770-4 Loudness, Peak & Silence Analyzer
- **Decision:** Built `video/scripts/audit-video.mjs` using Remotion's bundled `ffmpeg.exe`/`ffprobe.exe` (decoding stereo PCM to compute exact K-weighted integrated LUFS, sample peak dBFS, clipping counts, and >1.5s silent gaps) + Playwright HTML contact-sheet rendering.
- **Why:** Remotion's minimal `ffmpeg.exe` omits `ebur128`, `volumedetect`, and `tile` filters; decoding raw `f32le` PCM in Node gives exact broadcast loudness measurements with zero system-wide software installation.
