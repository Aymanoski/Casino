# Pitch Video Review Log (`/video/REVIEW_LOG.md`)

> Tracks every iteration's objective telemetry, blind independent reviewer scores (`1–10`), top defects, and verified improvements on branch `video-overnight`.

---

## Rubric Reference
- **(a) Role clarity:** Can a stranger clearly describe what Admin, Scorer, Player, Big Screens, and Public Fan View each **see**, **do**, and are **responsible for**?
- **(b) Accuracy to real product:** Claims match on-screen proof; placeholders labeled; Marwan Serry text-only; zero real photos/copied logo.
- **(c) Visual polish & theme consistency:** Matches `DESIGN.md` (red sunburst, gold-to-orange outlined sticker lettering, white surfaces, chips/dice/cards, lanterns, recurring entity motifs, transitions).
- **(d) Arabic quality, RTL & phone legibility:** Authentic Egyptian-friendly Arabic, clean RTL mirroring, zero orphan/split wraps, readable on a phone screen with safe margins.
- **(e) Pacing & story flow:** Punchy cold open, tight cuts, zero dead/skeleton frames, strong CTA.
- **(f) Audio balance:** Integrated loudness near `-16 LUFS` (`-18` to `-14 LUFS`), peak `<= -0.3 dBFS`, `0` clipped samples, `0` silent gaps `> 1.5s`.
- **(g) Delight & tasteful humor:** Fun, lively, sponsor-safe personality tailored to Marwan Serry (no dry dev jargon).
- **(h) Technical cleanliness:** Constant `30 fps`, zero glitches, zero loading skeletons/footer leaks, zero occluding overlays, zero clipped modals.

---

## Version `video-v1` (Baseline — Audited `2026-11-22 08:22 +02:00`)

### Technical & Audio Telemetry (`video/review-sheets/v1/audit-report.md`)
| Output | Resolution | FPS | Duration | Integrated LUFS | Peak dBFS | Clips | Silent Gaps | Status |
|---|---|---|---|---|---|---|---|---|
| `casino-pitch-16x9-en.mp4` | `1920×1080` | `30 / 30` | `192.0s` | **-20.41 LUFS** | `-4.63 dBFS` | `0` | None | NEEDS FIX (too quiet) |
| `casino-pitch-16x9-ar.mp4` | `1920×1080` | `30 / 30` | `192.0s` | **-20.72 LUFS** | `-6.64 dBFS` | `0` | None | NEEDS FIX (too quiet) |
| `casino-teaser-9x16-en.mp4` | `1080×1920` | `30 / 30` | `68.0s` | **-20.17 LUFS** | `-5.47 dBFS` | `0` | None | NEEDS FIX (too quiet) |
| `casino-teaser-9x16-ar.mp4` | `1080×1920` | `30 / 30` | `68.0s` | **-20.64 LUFS** | `-7.51 dBFS` | `0` | None | NEEDS FIX (too quiet) |

### Blind Independent Reviewer Scores (`video-v1`)
| Criterion | Score | Key Evidence |
|---|---:|---|
| (a) Role clarity | **6 / 10** | Strong 5-role spine & Act C structure, but Fan View cropped unreadable in 3-screen split (`01:14.3`–`01:23.8`), absent from 9:16 teaser, and role colors repeat without distinct visual motifs. |
| (b) Accuracy to real product | **5 / 10** | Brand safety & placeholders pass cleanly, but teaser split-screen goes out of sync (`00:28–00:33.8`), Results Feed shows `Final Match Result` instead of `"Yellow card (−1)"` (`01:54`), `02:04` hides standings flip behind a loading skeleton, teaser `t4-fairness` claims Results/Audit without showing them, teaser `t2` claims Arabic RTL while staying English. |
| (c) Visual polish & DESIGN.md | **5 / 10** | Big Screen looks great, but Remotion titles feel flat, zero thematic transitions, zero desktop camera zooms on dense Admin/Bracket tables, top pills collide with real page headers (`01:36`, `02:58.3`), Act C spends 32s on plain white cards. |
| (d) Arabic, RTL & phone legibility | **4 / 10** | Arabic fonts & RTL chrome work, but ~85% of `main-ar`/`teaser-ar` captured UI is still English; Arabic caption orphan/split wraps (`(-٢).`, `(٩/٩ / سليم).`); dev leaks (`بدون Refresh`, `عربي RTL`); shrunken 1920×1080 desktop panes illegible on 9:16 phone; props collide with captions. |
| (e) Pacing & story flow | **5 / 10** | Cold open begins on loading skeleton (`00:00.1`), 8s spent on static title/bumper (`00:12–00:19.8`), split-screen sits static at `3–2` for 8s, Act C drags at 32s, Grand Final replays identical `19S PAUSED` footage in Act A & Act D. |
| (f) Audio balance | **5 / 10** | Zero clips & zero silent gaps, but all 4 exports are `-20.2` to `-20.7 LUFS` (4.2–4.7 dB quieter than `-16 LUFS` target). |
| (g) Delight & tasteful humor | **4 / 10** | Clean & respectful, but too dry/corporate: exposes dev jargon (`"(repo-enforced)"`, `"9 automated data-integrity invariants"`), frozen Final stage, no playful game-show personality or tasteful nod to Marwan Serry. |
| (h) Technical cleanliness | **4 / 10** | Constant 30fps, but 6 loading skeletons/footer leaks (`00:00.1`, `00:52`, `01:40`, `01:51.8`, `02:04`, `teaser 00:19.8`), blank transition frames (`00:18`, `teaser 00:44`), clipped mobile Avatar modal (`00:40–00:42`), header-occluding top pills. |
| **Average** | **4.75 / 10** | **Action:** Execute major `video-v2` upgrade pass fixing all 10 priority defects. |

### Top 10 Defects Identified in `video-v1` (Strict Priority Order)
1. **[Accuracy & Glitches]** Loading skeletons, site footers, and blank frames at `00:00.1`, `00:18.0`, `00:52.0`, `01:40.0`, `01:51.8`, `02:04.0`, `teaser 00:19.8`, `teaser 00:44.0`.
2. **[Accuracy & Glitches]** Out-of-sync teaser split-screen (`00:28–00:33.8`), sluggish 3-screen sync (`01:14–01:23.8`), missing `"Yellow card (−1)"` Score Events filter & Audit Diff (`01:54–01:56`), missing Results/Audit in `t4-fairness`, missing Arabic phone flip in `t2-scale-player`.
3. **[Accuracy & Glitches]** Horizontally clipped Avatar Studio modal on 390px phone (`00:40–00:42`) & untranslated `"OFFICIAL FINAL STANDINGS"` on Arabic Big Screen Victory (`01:32`).
4. **[Role Clarity]** No dynamic zooms on dense Admin/Bracket tables; Public Fan View completely absent from 9:16 teaser; no distinct per-entity recurring visual icon motifs.
5. **[Visual Polish]** Top overlay pills collide with real page headers (`00:26`, `01:36`, `02:58.3`), orphan single-word wraps (`"moment"`, `"together"`), and pill lingers on closing CTA (`03:06–03:11.8`).
6. **[Visual Polish]** Flat yellow title text instead of bold glossy gold-to-orange outlined sticker lettering; zero thematic transitions (sunburst wipe / card flip / dice roll); static 32s PowerPoint-style Act C.
7. **[Arabic & Phone Legibility]** `main-ar` & `teaser-ar` show mostly English app UI; orphan/split Arabic caption wraps (`(-٢).`, `(٩/٩ / سليم).`); mixed dev English (`بدون Refresh`, `عربي RTL`); stiff `"بطاقة صفراء"` instead of Egyptian `"كارت أصفر"`.
8. **[Arabic & Phone Legibility]** Shrunken 1920×1080 desktop frames illegible inside 9:16 vertical cards; caption/corner-prop overlaps in teaser (`00:08`, `00:20`, `00:54`).
9. **[Pacing & Audio]** All 4 exports fail `-16 LUFS` target (`-20.2` to `-20.7 LUFS`); recycled frozen `19S PAUSED` Final clip in Act A & Act D; overly long static title holds.
10. **[Delight & Humor]** Dev jargon (`"(repo-enforced)"`, `"9 automated data-integrity invariants"`), zero live Grand Final action, zero playful sponsor-safe game-show reactions or Marwan-tailored wit.
