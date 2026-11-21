---
version: 2
slug: "src-app-scorer-page-tsx"
primary_target: "src/app/scorer/page.tsx"
related_targets: ["src/app/scorer/[matchId]/page.tsx"]
---

# Surface Brief — Scorer Dashboard (`/scorer`) & Live Scorer Console v2 (`/scorer/[matchId]`)

- **Visitor Mode:** Operate
- **Audience & Job:** Match Judges (`Scorer 1`–`Scorer 4`) running live 1v1 group/knockout matches (2 panels) or the 1v1v1 Grand Final with Marwan Serry (3 panels) on landscape tablets or one-handed on phones, plus Super Admin supervising any match, deciding void/Final-absence cases, reversing absences with Impact Preview, and managing full scoring history.
- **Confirmed Choices (CR1 Step 3):**
  - **Hybrid Scoring Ergonomics:** Direct 1-tap `>= 56px` **`+1`**, **`−1`**, **Yellow card (`−1`)**, and **Red card (`−2`)** buttons inside each `PlayerPanel` on tablet & desktop (`md+`) with a slim shared Optional Note + Undo + Finish dock below; one-handed **Sticky Thumb Dock** on phones (`< md`) with player toggle pills, the 4 big scoring buttons, collapsible Note field, Undo preview, and Finish. Zero preset point lists and zero custom numeric inputs anywhere.
  - **Disciplinary Cards & Absences:** Original SVG `DisciplinaryCardIcon` + `CardCounterGroup` per player (derived from `ScoreEvent.kind`). Mark Absent per player with confirmation dialog: immediate 1v1 walkover + engine cascade, both-absent `void` + inline Super Admin decision panel, non-auto-ending Grand Final absence prompt for Super Admin, and Super Admin Reverse Absence wired with `ImpactPreviewDialog`.
  - **Role-Gated Contact Dialog:** Round phone button (`44px+`) beside each player (visible only to assigned judge, check-in staff, and super admin; hidden for guest host Marwan) opening a sticker dialog with `tel:` tap-to-call, WhatsApp link, email, and 1-click copy, logging `contact.viewed` via `playerRepo.getContactForActor()`.
  - **Tie-Breaker & Result Type:** Confirming Finish Match on any tie requires/opens Segment #16 (`Tie-Breaker and Penalty Challenge`, `needsTieBreak`); finished matches display explicit `NORMAL` vs `WALKOVER` result type badges.
  - **Commands-Only Architecture:** Every mutation runs exclusively through `/lib/commands` with `expectedVersion` optimistic concurrency protection and `ImpactPreviewDialog` cascade confirmation.
- **Constraints:** EN (LTR) & AR (RTL) parity, `320px`–`2560px` responsive fidelity, `>= 56px` scorer touch targets (`>= 44px` secondary chrome), `>= 16px` inputs, no Phase 10 Delighters (`delightersEnabled: false`), no real photos, no copied show logo/text, no emoji icons, no eyebrow kickers above headings.

## Direction contract

- **THESIS:** Build a broadcast-grade Stage-Dark live scoring console optimized for sub-second zero-mistake operation: 2 spacious 1v1 player arenas (3 in the Final) with direct `+1 / −1 / Yellow / Red` actions on tablet/desktop and a thumb-zone sticky dock on phones, original SVG disciplinary card counters, instant walkover/contact flows, and inline Super Admin governance backed by atomic commands.
- **OWN-WORLD:** Established "Casino El Al3ab — Stage-Dark" palette (`#4F0716` deep maroon ground, `#7E0D26` elevated panels, `#FFFFFF` high-contrast typography, `#FFD54A`/`#FFC12B` gold tabular scores, yellow cards, and buzz highlights, `#B3001B` red cards and penalties, white-buffered `#2F6BFF`/`#1F4FD8` selection/focus rings, `#E6F8F0`/`#0D6A43` positive controls always paired with `+`/`−` icons and signs, `Lilita One`/`Lalezar` headings, `Bebas Neue`/`Cairo` 900 tabular scores/timers, `Inter`/`Cairo` UI).
- **STORY:** A judge opens `/scorer`, spots their active LIVE 1v1 table, launches `/scorer/[matchId]`, starts the segment timer, taps Buzzed First, fires `+1`, `−1`, Yellow (`−1`), or Red (`−2`) with an optional note (seeing live card counters and the Recent Plays ticker update immediately), taps Contact if a player is late or marks them Absent for an instant walkover cascade, relies on Undo for zero-stress recovery, and finishes cleanly (or triggers Tie-Breaker #16 on a draw) while Big Screen and Admin views sync in real time.
- **FIRST VIEWPORT:** On `/scorer`, Stage-Dark header with status counts and filter pills leading into LIVE sessions and Scheduled/Finished cards with Table # and Walkover badges. On `/scorer/[matchId]` at `1024×768` tablet landscape: compact session header (Table #, Round/Group, Result Type, Big Screen, History), Segment & Timer strip, 2 equal-width `PlayerPanel` cards (3 in Final) with SVG card counters, Contact button, Buzzed First, direct `+1 / −1 / Yellow / Red` buttons, and Mark Absent, plus Recent Plays ticker and shared Note/Undo/Finish bar below. On `390×844` phones: stacked player summary/buzz/contact cards above the fixed one-handed Sticky Thumb Dock.
- **FORM:** Two-route Operate workspace (`/scorer` queue + `/scorer/[matchId]` live console + `SessionHistoryDrawer` + `PlayerContactDialog` + `ImpactPreviewDialog`).
- **FINISH:** Zero TypeScript/lint/derived-write violations, full Vitest coverage (`scorer-v2-cr3.test.ts`), clean production build, `impeccable detect` verification, and real browser verification across EN/AR tablet & phone viewports before tagging `v0.1.1-cr3-scorer`.
