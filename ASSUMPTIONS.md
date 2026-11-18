# ASSUMPTIONS.md — Product, Design & Architecture Decisions

> Whenever a detail in `AGENTS.md` or `DESIGN.md` is ambiguous, missing, or contradictory, we document the chosen default here with the date and rationale so we never stall. Any decision here can be changed by the product owner at any time.

---

## Initial Architecture & Spec Alignment (2026-11-18)

### 1. Marwan Serry's Representation in the Data Model
- **Gap / Contradiction:** `AGENTS.md` §3 and §9 state there are 27 tournament players, and the Final is "2 finalists + Marwan Serry (still a 3-player game)". Meanwhile, `Game.playerIds` is a 3-tuple of player IDs (`playerIds[3]`), and `ScoreEvent` / `BuzzEvent` reference `playerId`.
- **Decision:** Seed a special host `Player` record (`id: "player-marwan"`, `fullName: "Marwan Serry"`, `fullNameAr: "مروان سري"`, `status: "finalist"`, `isHost: true`) in `playerRepo`. Standard player lists and the 27-player bracket seeding filter out `isHost: true`, while the Final game's `playerIds[3]` includes `"player-marwan"` alongside the 2 semi-final winners (or placeholder slots until the semi-final completes). UI components inspect `isHost` / `isFinal` to render the "Golden Seat" boss card (name only, no photo).

### 2. Qualifying Ties & Tie-Breaker Segment Flow
- **Gap / Contradiction:** `AGENTS.md` §8 states finishing a game "computes winner, handles tie by opening a Tie-Breaker segment", while §3 notes Round 1 & 2 advance 1 winner per game and the Semi-final advances the **top 2** players. A tie for 1st in the Semi-final still advances both tied players, whereas a tie between 2nd and 3rd blocks advancement. Furthermore, `Game.segmentIds` is pre-configured per game and may not initially include Segment #16 (`Tie-Breaker and Penalty Challenge`).
- **Decision:** Define a **Qualifying Tie** as any score tie across the advancement cutoff boundary (`round.advancePerGame`—i.e., a tie for 1st when `advancePerGame === 1`, or a tie for 2nd/3rd when `advancePerGame === 2`). If the scorer clicks "Finish Game" while a Qualifying Tie exists, the console blocks completion and prompts the scorer with a one-tap **"Open Tie-Breaker Segment"** action that dynamically appends Segment #16 to `game.segmentIds` and advances `currentSegmentIndex` to it.

### 3. Score Undo vs. Buzz Undo Semantics
- **Gap / Contradiction:** `AGENTS.md` §4 and §8 allow the scorer to "undo own last action", and §6 defines `ScoreEvent.kind` as `'preset' | 'custom' | 'undo'`. It is not specified whether Undo deletes the prior `ScoreEvent` or appends an inverse event, nor how undoing a `BuzzEvent` works.
- **Decision:**
  - **Score Undo:** Appends an immutable compensating `ScoreEvent` (`kind: 'undo'`, `delta: -previousEvent.delta`, `note: 'Undo: ...'`) and marks the target `ScoreEvent` with `undoneByEventId` so it cannot be undone twice. This preserves a complete, tamper-evident history in the Admin Results Feed and Audit Log.
  - **Buzz Clear / Undo:** Adds a "Clear Buzz" control on the Scorer Console that clears the active buzzed player for the current segment and writes an `AuditEntry` (`buzz.clear`).

### 4. Live Segment Timer & Active Buzz State in `Game` Schema
- **Gap / Contradiction:** `AGENTS.md` §8 requires a segment timer (`start / pause / reset`) and a highlighted "Buzzed first" player on both the Scorer Console (`/scorer/[gameId]`) and the Big Screen (`/screen/[gameId]`), synchronized via `BroadcastChannel`. However, the `Game` entity in §6 only lists `currentSegmentIndex` and `segmentIds[]`, omitting timer and active-buzz state.
- **Decision:** Extend `Game` in `/lib/schemas` with:
  - `timer: { status: 'idle' | 'running' | 'paused'; durationSec: number; remainingSec: number; endsAt?: string | null }`
  - `activeBuzzPlayerId?: string | null`
  This ensures the Big Screen can join mid-segment or refresh at any moment and still render exact countdown progress and buzz highlights.

### 5. Bilingual (`EN` / `AR`) Fields Across All Entities
- **Gap / Contradiction:** `AGENTS.md` §6 explicitly defines `en`/`ar` fields on `Round` and `Segment`, but leaves `Player` (`fullName`, `nickname`), `Game` (`tableName`), `Sponsor` (`name`, `blurb`), `ContentItem`, and `Settings` with single-language fields, despite `DESIGN.md` §1 requiring Arabic (RTL) to be a first-class experience everywhere.
- **Decision:** Provide bilingual fields (`*En` and `*Ar` or `{ en, ar }` localized strings) across `Player` (`fullNameAr`, `nicknameAr`), `Game` (`tableNameAr`), `Sponsor` (`nameAr`, `tierAr`, `blurbAr`), `ContentItem` (`titleEn/Ar`, `bodyEn/Ar`), and `Settings` (`eventNameEn/Ar`, `venueEn/Ar`, `prizeTextEn/Ar`, `eventDatesEn/Ar`). Seed all 27 players with natural Egyptian Arabic names and nicknames alongside their English names.

### 6. Check-in Staff "Absent" Status in `Player.status`
- **Gap / Contradiction:** `AGENTS.md` §4 says Check-in staff can "mark players as checked in or absent", but §6 defines `Player.status` as `registered | checkedIn | active | eliminated | finalist` (missing `absent`).
- **Decision:** Include `'absent'` in the `Player.status` Zod enum (`'registered' | 'checkedIn' | 'absent' | 'active' | 'eliminated' | 'finalist'`).

### 7. Derived Leaderboard & `Player.stats` Consistency
- **Gap / Contradiction:** `AGENTS.md` §6 includes `stats: { gamesPlayed, wins, totalPoints }` on `Player`, while also stating "Every score change creates one [`ScoreEvent`]. The leaderboard and history are derived from this table."
- **Decision:** `ScoreEvent` is the single source of truth for points. Whenever `scoreRepo.applyScore` or `gameRepo.finishGame` runs, `playerRepo` recalculates and caches `Player.stats` from `ScoreEvent` and `Game` records so both direct player reads and derived leaderboard queries are 100% consistent.

### 8. Locked Typography Choices from `DESIGN.md` Options
- **Gap / Contradiction:** `DESIGN.md` §3 provides "or" options for several font roles.
- **Decision:** Lock the following `next/font/google` pairings:
  - **English Display / Headlines:** `Cormorant Garamond` (weights 600, 700)
  - **English Scores / Big Numerals / Timers:** `Bebas Neue` (weight 400, `tabular-nums`)
  - **English Body / UI:** `Inter` (weights 400, 500, 600)
  - **Arabic Display / Headlines:** `Reem Kufi` (weights 600, 700)
  - **Arabic Body / UI & Arabic Scores:** `Cairo` (weights 400, 600, 700, `tabular-nums`)

### 9. Demo Story & Pre-Populated Tournament State
- **Gap / Contradiction:** `AGENTS.md` §9 asks for "Round 1 mostly finished, Round 2 partly finished, one game live, others scheduled", while traditionally Round 2 pairings depend on all Round 1 games finishing.
- **Decision:** Seed the 27-player bracket in groups of 3 games per bracket Pod (Pod A: Games 1–3 → R2 Game 10; Pod B: Games 4–6 → R2 Game 11; Pod C: Games 7–9 → R2 Game 12):
  - **Round 1:** 8 of 9 games (`G1`–`G8`) are **finished** with realistic segment score events; `G9` is **scheduled** later tonight.
  - **Round 2:** Because Pods A and B finished Round 1, `G10` (Pod A winners) is **finished**, and `G11` (Pod B winners) is currently **LIVE** (at Segment 4 of 6, with active scores and recent buzz events—making the Scorer Console and Big Screen immediately exciting out of the box). `G12` awaits the winner of `G9`.
  - **Semi-Final (`G13`) & Final (`G14` with Marwan Serry):** **Scheduled**, with `G13` already showing the winner of `G10` in Seat 1 and awaiting `G11` and `G12` winners.

### 10. Delighters Hook Points (Phases 1–9 vs. Phase 10)
- **Decision:** Per `AGENTS.md` §12 and `DESIGN.md` §11, `settings.delightersEnabled` defaults to `false` in Phases 1–9. All animatable primitives (`AnimatedNumber`, `ChipBadge`, `PlayerPanel`, `MarqueeFrame`) and `/lib/feedback` (`play(name)`, `haptic(name)`) plus realtime event emitters (`score.changed`, `buzz.recorded`, `segment.changed`, `game.finished`, `final.revealed`) will be wired from Phase 1/2 so Phase 10 can activate the spectacle layer cleanly.

---

## Phase 1 Bonus Ideas & Decisions (2026-11-18)

### 11. Bonus Idea: Presenter Quick Role Switcher & Live Table Pill in Top Header
- **Context:** During the live pitch to Marwan Serry, navigating away to `/login` every time the presenter wants to demonstrate how a Scorer, Gate Check-in Staff, Contestant, or Super Admin experiences the platform interrupts the flow.
- **Built in Phase 1:** Added an interactive **Quick Role Switcher Popover** directly on the Header's Role Badge (plus a Studio Role selector in the Admin/Scorer header) alongside the full `/login` page, and a pulsing **"LIVE · Live Table B"** pill in the top bar that jumps straight to the active live game (`game-11`).
- **Default Initial Session:** On first load, the mock auth defaults to `Super Admin` (`user-admin`) so the reviewer can immediately inspect any route without hitting an access wall first, while still allowing 1-click switching to restricted roles (`Scorer`, `Check-In`, `Content`, `Player`, or `Public Visitor`) to verify `RoleGuard` enforcement.

---

## Phase 2 Design System Decisions & Bonus Ideas (2026-11-18)

### 12. Deterministic Geometric Avatar Patterns (`PlayerAvatar`)
- **Context:** `AGENTS.md` §10 strictly forbids photos of real people, and `DESIGN.md` §6 & §9 specify generated geometric patterns or initials in gold rings.
- **Decision:** `PlayerAvatar` hashes `avatarSeed` (or `name`) via FNV-1a into 6 distinct Islamic/casino geometric SVG line-art patterns (octagram Khatam stars, diamond rosettes, hexagonal lattices, intersecting circles) inside a dual gold ring with initials, plus a crowned `isHost` Golden Seat medallion (`♛`) for Marwan Serry.

### 13. Bilingual Display Typography Tracking & Line-Height (`SectionHeading`)
- **Context:** `DESIGN.md` §3 specifies tight tracking for English display headlines (`Cormorant Garamond`), whereas negative letter-spacing in Arabic `Reem Kufi` causes adjacent glyphs to crowd.
- **Decision:** `SectionHeading` applies `ltr:tracking-tight ltr:leading-[1.15]` for English LTR and `rtl:tracking-normal rtl:leading-[1.38]` for Arabic RTL, automatically highlighting the specified `goldKeyword` (or the final word when omitted) in `--gold-gradient`.

### 14. Bonus Idea: Interactive Broadcast Table Sandbox & Dual EN/AR Specimen Inspector in `/styleguide`
- **Built in Phase 2:** Instead of a static component gallery, `/styleguide` includes a sticky **Inspector Bar** (`EN · LTR` / `عربي · RTL` toggle, Western `123` vs. Arabic-Indic `١٢٣` numeral toggle, and a **Dual EN/AR Specimen** side-by-side preview) plus a live **Broadcast Table Sandbox** where clicking `+10`, `+5`, `-5`, or `Buzzed First` on any `PlayerPanel` updates `ScoreboardRow` animated counters, triggers floating emerald/ruby delta flashes, reorders ranks with Framer Motion layout animations, and fires themed `Toast` notifications.

---

## Responsive Retrofit Decisions (2026-11-18)

### 15. Built-In Container Queries, Hover Gating & `overflow-x: clip`
- **Context:** `AGENTS.md §13` requires mobile-first breakpoints including a `1920px+` tier, container queries, hover effects gated under `@media (hover: hover)`, `44px+` (`56px+` scorer) touch targets, `16px+` inputs, and zero horizontal page scroll.
- **Decisions:**
  - Configured strict ascending `theme.screens` (`xs: 360px` through `3xl: 1920px`), `future: { hoverOnlyWhenSupported: true }`, and an inline zero-dependency container-query Tailwind plugin (`@container`, `@2xs`..`@3xl`) in `tailwind.config.ts`.
  - Replaced `body { overflow-x: hidden }` with `html, body { overflow-x: clip }` in `globals.css` so `position: sticky` headers and sticky table first-columns work reliably without masking layout regressions.
  - Added `BracketNode` and `BracketTrack` (`src/components/brand/BracketNode.tsx`) alongside `FormGrid` (`src/components/ui/form-grid.tsx`) so responsive bracket trees (pan + zoom + mobile round stack) and single-column-on-phone forms are ready for Phases 3–9 by default.
  - **Bonus Idea:** Added an on-device mobile `Cards | Table` view switcher and bottom-sheet `filterSlot` inside `DataTable`, allowing admins on phones to browse either stacked cards or the full sticky-first-column scrollable table with a single tap.


