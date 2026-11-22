# Overnight Pitch Video Morning Report (`/video/MORNING_REPORT.md`)

> Continuously updated after every autonomous iteration on branch `video-overnight`.
> **Session Start:** `2026-11-22 07:48:31 +02:00` | **Status:** Phase 1 Complete (`video-v1` baseline audited; starting `video-v2` polish pass)

---

## 1. Current Deliverables (`/video/out/BEST/`)

| Deliverable | Path | Resolution / Specs | Status |
|---|---|---|---|
| Main Pitch 16:9 (EN) | `video/out/BEST/casino-pitch-16x9-en.mp4` | `1920×1080` · 30fps · `3:12` | `v1` baseline |
| Main Pitch 16:9 (AR) | `video/out/BEST/casino-pitch-16x9-ar.mp4` | `1920×1080` · 30fps · `3:12` | `v1` baseline |
| Vertical Teaser 9:16 (EN) | `video/out/BEST/casino-teaser-9x16-en.mp4` | `1080×1920` · 30fps · `1:08` | `v1` baseline |
| Vertical Teaser 9:16 (AR) | `video/out/BEST/casino-teaser-9x16-ar.mp4` | `1080×1920` · 30fps · `1:08` | `v1` baseline |
| Bilingual Subtitles (×4) | `video/out/BEST/*.srt` | UTF-8 EN & RTL AR | `v1` baseline |
| Pitch Thumbnail | `video/out/BEST/thumbnail-16x9.png` | `1920×1080` PNG | `v1` baseline |
| Narration Script | `video/NARRATION.md` | Exact `MM:SS` EN + Egyptian AR | Ready |

---

## 2. Rubric Scores Across Iterations (`1–10`, Blind Independent Reviewer)

| Criterion | `v1` (Baseline) |
|---|---:|
| (a) Role clarity | 6 |
| (b) Accuracy to real product | 5 |
| (c) Visual polish & DESIGN.md | 5 |
| (d) Arabic, RTL & phone legibility | 4 |
| (e) Pacing & story flow | 5 |
| (f) Audio balance (`-16 LUFS`) | 5 |
| (g) Delight & tasteful humor | 4 |
| (h) Technical cleanliness | 4 |
| **Average** | **4.75** |

---

## 3. Iteration Progress Log

- **`video-v1` (`07:48 – 08:23`):** Snapshotted existing full-1080p deliverables to `video/out/v1/` and `video/out/BEST/`. Built automated audit harness (`video/scripts/audit-video.mjs`) extracting 251 frames into 18 labeled contact sheets + exact ITU-R BS.1770-4 LUFS/peak/clipping/silence measurements. Ran independent blind reviewer subagent; identified 10 prioritized defects for `video-v2`.

---

## 4. Stage Timing Table (`video-v1`)

- **Main 16:9 (`192s`):** `a1-cold-open` (0:00–0:18), `b0-bumper` (0:18–0:20), `b1-admin-setup` (0:20–0:36), `b2-player-phone` (0:36–0:54), `b3-scorer-console` (0:54–1:14), `b3b-split-money-shot` (1:14–1:24), `b4-big-screen` (1:24–1:40), `b5-fan-view` (1:40–1:52), `b6-admin-fairness` (1:52–2:10), `c1-role-recap` (2:10–2:42), `d1-marwan-final` (2:42–2:58), `e1-close-cta` (2:58–3:12).
- **Teaser 9:16 (`68s`):** `t1-hook` (0:00–0:09), `t2-scale-player` (0:09–0:20), `t3-split-live` (0:20–0:34), `t4-fairness` (0:34–0:44), `t5-five-entities` (0:44–0:54), `t6-marwan-cta` (0:54–1:08).

---

## 5. Decisions Made & Things Skipped
- Logged in detail in [`video/DECISIONS.md`](./DECISIONS.md).
- Web app source files were strictly left untouched per overnight guardrails.

---

## 6. Next Planned Improvements (In Progress → `video-v2`)
1. Eliminate all 6 loading-skeleton & footer leaks + sync teaser split-screen + capture genuine Score Events `"Yellow card (−1)"`, live Grand Final gameplay (timer + Marwan buzz & score jump!), and native Arabic UI clips for `main-ar`/`teaser-ar`.
2. Normalize all audio mixes cleanly to `-16.0 LUFS ± 0.5 LU` with `-1.5 dBFS` true-peak headroom.
3. Add distinct recurring visual icon motifs for all 5 entities, zoomed-in desktop callouts, mobile-legible cropped vertical teaser frames, and clean non-overlapping header placement.
4. Add thematic transitions (Sunburst Wipe, Casino Card Flip, Rolling Die Wipe), kinetic counters, tasteful sponsor-safe Ramadan comedy sticker reactions, and remove all developer jargon.
5. Upgrade Act C Role Recap with embedded real-app thumbnails + tighter pacing and upgrade Arabic phrasing/caption line-breaking with zero orphans or English dev leaks.
