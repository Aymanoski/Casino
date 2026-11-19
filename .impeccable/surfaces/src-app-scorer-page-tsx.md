---
version: 1
slug: "src-app-scorer-page-tsx"
primary_target: "src/app/scorer/page.tsx"
related_targets: ["src/app/scorer/[gameId]/page.tsx"]
---

# Surface Brief — Scorer Dashboard (`/scorer`) & Live Scorer Console (`/scorer/[gameId]`)

- **Visitor Mode:** Operate
- **Audience & Job:** Table Scorers (`Scorer 1`–`Scorer 4`) running live 3-player game sessions on landscape tablets or phones, plus Super Admin supervising any table and exercising full scoring history control.
- **Confirmed Choices:**
  - Scoring interaction: Single Selected-Player Action Dock — tapping a player card or "Buzzed First" selects that player (white-buffered electric-blue ring), and segment presets, custom +/- with optional note, and Undo all target them (sticky bottom bar on phones for one-handed use).
  - Tie-Breaker trigger: On Confirm Finish, if a qualifying tie exists across `round.advancePerGame`, automatically insert Segment #16 (`Tie-Breaker and Penalty Challenge`), jump straight to it with a 30s timer, and show a prominent banner naming the tied players.
  - Scoring history & game lifecycle control: Inline "Last Action" preview on the Undo button + 1-tap Session History & Control Drawer (chronological score + buzz feed, plus centralized role-gated controls `canManageScoreHistory` / `canReopenFinishedGame` for revert-by-id, edit delta/note, delete/void, retroactive add, and reopening finished games — defaulting to Super Admin so manager roles can be expanded later in one place). Scheduled games open behind a "Start Live Session" gate; finished games open read-only for standard scorers.
- **Constraints:** EN (LTR) & AR (RTL) parity, `320px`–`2560px` responsive fidelity, `>= 56px` scorer touch targets (`>= 44px` secondary chrome), `>= 16px` inputs, no Phase 10 Delighters (`delightersEnabled: false`), no real photos, no copied show logo/text, no eyebrow kickers above headings.

## Direction contract

- **THESIS:** Refuse cluttered 9-button grids and generic admin forms; build a broadcast-grade Stage-Dark live scoring console where selecting/buzzing on 3 clear player arenas feeds one unambiguous Selected-Player Action Dock, keeping live tempo fast while isolating full history edits behind an audit-logged drawer.
- **OWN-WORLD:** Established "Casino El Al3ab — Stage-Dark" palette (`#4F0716` deep maroon ground, `#7E0D26` elevated panels, `#FFFFFF` high-contrast typography, `#FFD54A`/`#FFC12B` gold tabular scores and buzz highlights, white-buffered `#2F6BFF`/`#1F4FD8` selection/focus rings, `#E6F8F0`/`#0D6A43` positive and `#B3001B` negative chips always paired with `+`/`−` icons and signs, `Lilita One`/`Lalezar` headings, `Bebas Neue`/`Cairo` 900 tabular scores/timers, `Inter`/`Cairo` UI).
- **STORY:** A scorer opens `/scorer`, immediately spots their active LIVE table at the top (or filters scheduled/finished tables), launches `/scorer/[gameId]`, runs the segment countdown, taps who buzzed first (auto-selecting them), fires a single preset or custom delta with note, relies on the live Undo preview for zero-stress recovery, steps across segments, and finishes the table (auto-spawning Tie-Breaker #16 when tied) while any open Big Screen syncs instantaneously.
- **FIRST VIEWPORT:** On `/scorer`, crisp Stage-Dark header with status counts and filter pills leading directly into the LIVE table hero card and grouped Scheduled/Finished table cards. On `/scorer/[gameId]` at 1024×768 tablet landscape: compact top session strip (table title, round, Big Screen link, History & Controls trigger), slim Segment & Timer command band (dual EN/AR segment name, progress stepper, `TimerRing` with 56px+ controls and 5s pulsing white-border warning), 3 equal-width side-by-side `PlayerPanel` arenas with big 56px+ "Buzzed First" buttons, and the anchored Selected-Player Action Dock below (target badge, 56px+ presets, custom `±` + note, Undo with last-event preview, Finish Game). On 390×844 phones: stacked player panels above a one-handed sticky bottom Action Dock with expandable Custom/Note sheet.
- **FORM:** Two-route Operate workspace (`/scorer` queue + `/scorer/[gameId]` 3-zone live console + History & Control Drawer); seed: none (pinned) — `"Build /scorer (list of the scorer's assigned games with status and time) and /scorer/[gameId] (the scorer console) exactly as specified in AGENTS.md section 8."`
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
