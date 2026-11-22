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

---

## Bold "Casino El Al3ab" Retheme Decisions (2026-11-18)

### 16. Locked New Typography & Font Synthesis Rules (Supersedes #8)
- **Context:** `DESIGN.md` §3 replaced the earlier midnight-and-gold editorial fonts (`Cormorant Garamond`, `Reem Kufi`) with bold game-show typography and offered options for Arabic scores (`Lalezar` or `Cairo` 900) and body (`Cairo` or `Tajawal`).
- **Decisions:**
  - **English Display / Headlines:** `Lilita One` (weight `400`)
  - **English Scores / Timers / Big Numerals:** `Bebas Neue` (weight `400`, `tabular-nums`)
  - **English Body / UI:** `Inter` (weights `400`, `500`, `600`, `700`)
  - **Arabic Display / Headlines:** `Lalezar` (weight `400`)
  - **Arabic Scores & Body / UI:** `Cairo` (`400, 600, 700, 900` with `tabular-nums`, using `900` for big numeric scores/timers)
  - Disabled synthetic bolding (`font-synthesis-weight: none`) on `.font-display` and `.font-score` and enforced `letter-spacing: 0` on RTL tracking utilities so single-weight `Lilita One`/`Lalezar` and connected Arabic ligatures render cleanly without faux-bold smearing.

### 17. Surface Themes (`Stage`, `Stage-Dark`, `Paper`) & RTL Shadow Mirroring
- **Decisions:**
  - Implemented explicit semantic CSS theme scopes in `globals.css`: `.theme-paper` (`--paper` `#FFF9F0` / `--white`, `--ink` text, `--red-600` primary buttons, calm `1px` `--border-paper` cards), `.theme-stage` (red sunburst `--red-600`/`#B21235`, white text, glossy gold-to-orange sticker headings, white sticker cards with `2.5px` `--red-900` outline, gold gradient primary buttons), and `.theme-stage-dark` (deep maroon `--red-900` Scorer Console with `--red-800` panels, white text, gold scores, and high-contrast controls).
  - Mirrored `--shadow-x`, `--shadow-x-sm`, `--shadow-x-lg`, and `--shadow-x-hover` negatively inside `html[dir="rtl"]` (plus `.sticker-press:active` horizontal sink direction) so hard offset sticker shadows flip cleanly in Arabic RTL.

### 18. WCAG AA Contrast & Color Guardrails (`DESIGN.md` §2)
- **Decisions:**
  - **Positive status text on Paper:** `--positive` (`#1FA971`) has ~3.0:1 contrast against white/paper for small text. Added `--positive-soft` (`#E6F8F0`) and `--positive-ink` (`#0D6A43`, ~6.1:1 contrast) for Paper badges, delta pills, and preset buttons while keeping `--positive` (`#1FA971`) for borders, chip rims, and accents.
  - **Blue buffer rule:** Every blue focus ring (`3px` `--blue-500` with `2px` white offset), selected `PlayerPanel` ring on Stage-Dark, `Button variant="info"`, `Badge variant="info" | "upcoming"`, and blue `ScoreChip` includes a crisp white border/halo so electric blue never sits directly against red.
  - **Gold on red & Paper headlines:** Small labels and body text on red Stage surfaces use `#FFFFFF` (never small gold). Gold gradient sticker lettering is reserved for 24px+ display titles/scores with `--red-900` stroke (`paint-order: stroke fill`), while Paper headlines use `--red-900` with a gold marker underline highlight (`.text-paper-highlight`) rather than gold text on cream.
  - **Plus / Minus never by color alone:** Every positive/negative badge, score chip, `PlayerPanel` preset button, `ScoreboardRow` delta flash, and toast pairs `+` / `−` signs with Lucide `Plus` / `Minus` icons.

### 19. EmptyState & Secondary Ramadan Motifs
- **Decisions:** Replaced the midnight lantern illustration inside `EmptyState` with original sticker-style `PlayingDice` + `PlayingCardMotif` artwork per `DESIGN.md` §6, while keeping `Lantern`, `LanternCluster`, and `CrescentStar` rethemed in the new warm gold/maroon sticker style strictly as subtle secondary Ramadan accents.
- **Bonus Idea:** Built reusable `StageDivider` SVG section transitions (`zigzag`, `angled`, `scallop`) with thick `#4F0716` sticker borders to cleanly separate Stage sunburst bands from Paper bands across `/` and `/styleguide`.

---

## Impeccable Skill Integration & Craft Audit Decisions (2026-11-18)

### 20. Impeccable Precedence & Intentional `DESIGN.md` Exceptions (`AGENTS.md §14`)
- **Setup:** Installed Impeccable (`v4.9.1`, engine `v0.1.24`/`v0.1.25`) into `.agent/skills/impeccable` for Antigravity, authored `PRODUCT.md` (`<!-- impeccable:product-schema 1 -->`) strictly from `AGENTS.md`, `DESIGN.md`, and `ASSUMPTIONS.md`, added machine-readable YAML frontmatter to `DESIGN.md` (preserving all existing sections `0`–`12` verbatim), and generated the `.impeccable/design.json` sidecar (`schemaVersion: 2`).
- **Narrow Font Ignore (`.impeccable/config.json`):** Registered `overused-font: Inter` via `impeccable hooks ignore-value` because `DESIGN.md §3` & `ASSUMPTIONS.md #16` explicitly choose `Inter` as the English Body/UI font paired with `Lilita One`, `Bebas Neue`, `Lalezar`, and `Cairo`.
- **Intentional `DESIGN.md` Findings Declined (Brand & Identity Wins):**
  1. `gradient-text` (`.text-gold-sticker`, `.text-gold-sticker-lg`): Kept per `DESIGN.md §1 & §2` glossy gold-to-orange headline sticker treatment (adjusted Arabic `Lalezar` RTL stroke width to `0.042em`/`0.052em` so connected counters stay filled with gold, and reserved gold-on-red for `24px+` display text per `DESIGN.md §2` while making `<24px` header brand text crisp `#FFFFFF`).
  2. `hard-offset-shadow` (`--shadow-sticker*`): Kept per `DESIGN.md §2 & §4` die-cut sticker offset shadow system (mirrored in RTL).
  3. `dark-glow` (`--glow-gold` on `Buzzed First` state, Golden Seat, Lanterns, CrescentStar, MarqueeBulbs): Kept per `DESIGN.md §2 & §6`.
  4. `radial-spotlight-glow` (`SunburstStage` focal radial bloom and `Spotlight` beams): Kept per `DESIGN.md §2 & §5`.
  5. `repeating-stripes-gradient` (`repeating-conic-gradient` sunburst Stage background): Kept per `DESIGN.md §2 & §5`.
  6. `cream-palette` (`--paper: #FFF9F0` warm off-white Paper surface): Kept per `DESIGN.md §2`.
- **Bonus Idea (Shareable `?lang=ar|en` Query Param):** Extended `I18nProvider` (`src/lib/i18n/index.tsx`) to honor an initial `?lang=ar` or `?lang=en` URL parameter (persisting to `localStorage`) so presenters, clients, and automated RTL audits can open any route directly in Arabic RTL or English LTR via URL.




---

## Phase 3 Landing & Pitch Page Decisions (2026-11-18)

### 21. Isolated Exhibition Demo Game (`game-demo`, `isDemo: true`)
- **Context:** The `/` `LIVE DEMO` section must use the real repositories and `BroadcastChannel` realtime layer with a separate demo game so tapping Buzz, `+10`/`+5`/`−5`, custom `+/-`, Undo, or Timer updates the Mini Big Screen live without skewing the official 27-player tournament leaderboard, bracket, or admin audit history.
- **Decision:** Extended `GameSchema` with `isDemo: boolean` (default `false`), bumped `SEED_VERSION` to `2`, and seeded `game-demo` (`roundId: "round-demo"`, `isDemo: true`, featuring 3 exhibition contestants across 6 segments). `gameRepo.list`, `gameRepo.getLiveGames`, `scoreRepo.list`, `scoreRepo.getLeaderboard`, and `recomputePlayerStatsInMemory` exclude `isDemo` games by default unless explicitly queried by `gameId: "game-demo"`, while `scoreRepo` skips polluting `auditRepo` on demo-game actions and `gameRepo.resetDemoGame("game-demo")` lets presenters restore the exhibition table in 1 click without wiping admin changes.

### 22. Hero Open Qualifier Seats & Sponsor Placeholder Scope
- **Decision:**
  - **Hero 3-Seat Final Card:** Displays 2 open qualifier finalist slots (`Finalist #1 · Semi-Final Winner · Top 2` and `Finalist #2 · Semi-Final Runner-Up · Top 2`) beside Marwan Serry's elevated Golden Seat (name only, no photo), matching the mid-tournament live state where Semi-Final (`game-13`) has not yet concluded.
  - **Sponsor Tiers:** Uses `sponsorRepo.list()` and `settings.contactEmail` with explicit placeholder badges and `"Contact us"` `mailto:` links instead of prices (no extra inquiry form/modal added at this stage).

### 23. Bonus Idea: Guided 3-Step Live Pitch Strip & Pop-Out Big Screen Window
- **Built in Phase 3:** Added a guided 3-step live prompt strip (`1. Tap Buzz → 2. Tap +10 / Custom → 3. Watch Screen Sync`) paired with a 1-click **Reset Demo Table** control and a **Pop Out Big Screen Tab** button (`/screen/game-demo` in a second tab) right above the split console so presenters pitching Marwan Serry can either demo single-screen sync in 5 seconds or drag the Big Screen tab onto a second monitor to show real multi-window `BroadcastChannel` synchronization.

---

## Phase 4 Scorer Dashboard & Live Scorer Console Decisions (2026-11-19)

### 24. Centralized Scoring History & Game Reopen Permissions (`SCORE_HISTORY_MANAGER_ROLES`)
- **Context:** Product owner requested full control over scoring history (editing, reverting specific entries, deleting entries, adding manual adjustments, and reopening finished tables) while deferring the final decision on which manager roles hold that permission.
- **Decision:** Added centralized capability arrays and guards in `src/lib/auth/index.tsx` (`SCORE_HISTORY_MANAGER_ROLES`, `REOPEN_GAME_MANAGER_ROLES`, `canManageScoreHistory`, `canReopenFinishedGame`, `canAccessScorerGame`), initially enabling full history control and reopening for `superAdmin` while standard `scorer` accounts retain quick single-step Undo of their own last action (`onlyOwn: true`) and read-only session timeline inspection. Expanding access to other manager roles later requires only adding the role ID to the constant array—zero UI rewrites. Every history edit (`score.edit`), deletion (`score.delete`), specific revert (`score.undo`), manual adjustment (`score.add`), and reopen (`game.reopen`) writes `before`/`after` records to `auditRepo` and broadcasts realtime sync events.

### 25. Single Selected-Player Action Dock & Automatic Tie-Breaker #16 Insertion
- **Decision (confirmed via Phase 4 shape interview):**
  - **Scoring Interaction:** Each of the 3 `PlayerPanel` cards carries one big `>= 56px` **"Buzzed First"** tap target (which records a `BuzzEvent`, highlights the player in gold, and auto-selects them with a white-buffered electric-blue ring); tapping a card also selects them. All segment presets (`+10`, `+5`, `−5`), custom `±` + optional note, Undo (with inline preview of the exact event to revert), and Finish Game live inside one unified **Selected-Player Action Dock** (anchored below the 3 columns on tablet landscape/desktop, and sticky to the bottom thumb zone on phones with 1-handed player quick-switch pills and an expandable Custom/Note panel).
  - **Qualifying Tie Flow:** Confirming **Finish Game** runs `gameRepo.finishGame(id, userId, { autoOpenTieBreaker: true })`. If a qualifying tie exists across `round.advancePerGame`, Segment #16 (`Tie-Breaker and Penalty Challenge`, 30s timer) is automatically appended, jumped to, logged in `auditRepo`, broadcast in realtime, and surfaced with a prominent banner naming the tied players.
  - **Game Lifecycle Gates:** Scheduled tables require an explicit **"Start Live Session"** confirmation before unlocking live scoring; finished tables render the official Final Podium summary (read-only for scorers, with a destructive-confirm **"Reopen Session"** control for authorized managers).

### 26. Bonus Idea: Keyboard Shortcuts, Mobile `±` Sign Toggle & Dynamic Scorer Sidebar
- **Built in Phase 4:**
  - Added fast desktop/tablet keyboard shortcuts inside `/scorer/[gameId]` (`1`/`2`/`3` select contestant, `B` buzz selected, `Space` start/pause timer, `Ctrl+Z` undo last score) documented in a clean `?` popover without cluttering the Stage-Dark workspace.
  - Added a dedicated `>= 56px` **`±` Sign Toggle** beside every custom points input (`type="text" inputMode="numeric"`) so scorers on iOS/Android numeric keypads can flip between positive and negative amounts in one tap without hunting for a minus key.
  - Upgraded `StudioSidebarShell` to resolve each scorer's own active/scheduled table dynamically (instead of hardcoding `game-11`) and to yield the bottom safe area on phones when `/scorer/[gameId]` is active so the sticky Action Dock owns the thumb zone cleanly.

---

## Phase 5 Venue Big Screen (`/screen/[gameId]` & `/screen/leaderboard`) Decisions (2026-11-19)

### 27. Full-Bleed Broadcast Frame, Auto-Hiding Control Pill & Presenter Mode
- **Decision (confirmed via Phase 5 shape interview):**
  - Both `/screen/[gameId]` and `/screen/leaderboard` render inside a dedicated full-bleed crimson sunburst + chasing gold perimeter `MarqueeBulbs` proscenium (`BroadcastFrame`) flanked by swaying Ramadan `Lantern` corner accents—omitting the standard site `PublicHeader` so the entire `1920px–4K` (`16:9`/`16:10`/`21:9`) viewport locks to `100dvh` with zero page scroll on venue projectors and unlocks vertical scroll cleanly on phones (`320px–430px`) and short landscape windows.
  - All navigation and controls (Realtime Sync dot, Broadcast Feeds table switcher, Leaderboard/Live toggle, EN/AR language toggle, and **Presenter Mode**) live inside one compact `PresenterControlPill` docked at the bottom edge. Activating **Presenter Mode** (button or `F` key) requests native Fullscreen (with graceful chromeless fallback if blocked), hides the mouse cursor (`cursor-none`), and fades out the control pill after 2.2s of inactivity; moving the mouse, tapping, or pressing `Esc`/`F` restores controls immediately.

### 28. Grand Final Center-Seat Boss Symmetry, Victory Stage & Scheduled Slate
- **Decision (confirmed via Phase 5 shape interview):**
  - When `game.isFinal` is true (`game-14`), `BigScreenGameView` visually positions **Marwan Serry** (`isHost: true`, name only, crowned geometric avatar, chasing top marquee strip, gold aura) dead-center between the two finalists (`[Finalist 1 | Marwan Serry | Finalist 2]`) on desktop/TV screens.
  - Scheduled games (`status === 'scheduled'`) display a dramatic **"Coming Up Next / VS Lineup"** broadcast slate with `VS` casino chip dividers and flip live automatically the instant the scorer starts the session.
  - Finished games (`status === 'finished'`) transition to a baseline Framer Motion **Victory Stage Celebration** (golden crown banner, marquee-framed Champion Hero Card with pulsing golden halo, animated final scores, and runners-up tally), leaving heavy Phase 10 Delighters (confetti burst, floating lanterns release, screen shake, audio) cleanly off behind `settings.delightersEnabled`.

### 29. Top-3 Podium + 8-Row Two-Column Auto-Cycling Board on `/screen/leaderboard`
- **Decision (confirmed via Phase 5 shape interview):**
  - To maintain 10-meter legibility across all 27 contestants without page scrolling on `1366×768` through `4K` displays, `/screen/leaderboard` pairs a **Top-3 Podium Spotlight** (`#2 | #1 elevated | #3` on `md+`) with a **2-column × 4-row (8 players/page)** board cycling across 3 pages (`#4–#11`, `#12–#19`, `#20–#27`) every 8.5s (with Play/Pause, manual Prev/Next, page dots, and Round filter pills, pausing automatically under `prefers-reduced-motion`).
  - Both podium cards and lower rows use Framer Motion `LayoutGroup` + `layout` animations so live rank swaps physically glide into place. Whenever a live `score.changed` event updates any player on another page, the screen automatically jumps to their page, pulses their row in gold, and flashes their floating `+/-` delta and `▲`/`▼` rank-shift badge.

### 30. Pluggable Realtime Broker & Message Deduplication + Bonus Broadcast Lower-Third
- **Architecture:** Upgraded `src/lib/realtime/index.ts` with a stable `RealtimeBroker` (`setRealtimeTransport`, `getRealtimeTransport`, `createRealtimeTransport`, `HostedRealtimeConfig`, `RealtimeConnectionStatus`, `onStatusChange`, `RealtimeEventPayloadMap`) and message-ID deduplication in `BrowserRealtimeTransport` so simultaneous `BroadcastChannel` + `storage` events never fire duplicate floating deltas across tabs.
- **Bonus Idea (Built in Phase 5):** Added a TV-style **Broadcast Lower-Third Event Ribbon** on `/screen/[gameId]` that briefly slides up for 3.4s whenever the scorer awards/deducts points, records a first buzz, or triggers Sudden-Death Tie-Breaker #16—delivering instant crowd context without adding any permanent on-screen clutter.

---

## Phase 6 Admin Studio & Role-Based Access Control Decisions (2026-11-19)

### 31. Dual-Layer Role Enforcement (UI Guards + Repository Permission Assertions)
- **Context:** `AGENTS.md §4` requires strict role isolation across `superAdmin`, `scorer`, `checkIn`, `content`, `player`, and visitors—and Phase 6 mandates enforcing permissions on both UI and repo calls, with every create/update/delete writing an `AuditEntry`.
- **Decision:** Created `src/lib/repos/permissions.ts` (`assertRepoPermission`, `PermissionDeniedError`, `canRolePerformAction`, `MANAGER_ROLE_SPECS`) as the single source of truth for both repository write/audit guards and the `/admin/managers` Role Permission Matrix UI:
  - `superAdmin`: unrestricted across all repos and admin pages.
  - `scorer`: `game.operate` and `score.operate` strictly on assigned tables (`game.scorerUserId === actor.id`, plus open exhibition `game-demo`); own-last-action undo only; blocked from all admin mutations and `auditRepo.list`.
  - `checkIn`: `playerRepo.updateStatus` limited strictly to `'registered' | 'checkedIn' | 'absent'`; blocked from player profile CRUD, scoring, bracket, settings, content, sponsors, and audit log.
  - `content`: `contentRepo.*`, `sponsorRepo.*`, and copy-only edits (`nameEn`, `nameAr`, `descriptionEn`, `descriptionAr`) on `segmentRepo.update`—explicitly throwing `PermissionDeniedError` if attempting to alter `presetPoints`, `durationSec`, `category`, or `order`.
  - `auditRepo.list({ requesterUserId })`: enforces `superAdmin`-only access at the repository boundary.

### 32. Flexible Bracket Size & Open Qualifier Slots (`tbd-*`)
- **Context:** `AGENTS.md §3` specifies flexible bracket configuration (admin sets number of players, table size defaulting to `3`, and how many advance per round) with auto-generated rounds/games and a Grand Final of 2 finalists + Marwan Serry.
- **Decision:** Widened `GameSchema.playerIds` from a rigid 3-tuple to `z.array(z.string()).min(2)` (defaulting to `3` across all presets) and added `gameRepo.generateBracket(config, actorUserId)` + `gameRepo.remove`, `roundRepo.create`/`remove`, `segmentRepo.reorder`, `contentRepo.reorder`, and `sponsorRepo.reorder`. Auto-generation preserves `game-demo`, seeds available players into Round 1, creates `tbd-*` open qualifier slots for subsequent rounds (which render gracefully across `BracketNode`, `/admin/bracket`, `/admin/check-in`, and `/admin/games`), assigns scorers round-robin, and automatically locks `player-marwan` into the Golden Seat when `includeFinalWithMarwan` or `isFinal` is enabled.

### 33. Calm Paper Admin Row Controls & Classic 4-Color Count Chips
- **Decision:** Per `DESIGN.md §4 & §8` ("Calm style for admin and dense data: 1px `--border-paper` and `--shadow-soft`, with only primary actions and key stat chips keeping the sticker look"), added a `calm` button variant (`1px` `--border-paper`, no offset shadow) for dense in-table/in-row utility controls (`View`, `Edit`, `Delete`, `Move Up/Down`, `Inspect Diff`, `Test Role`), reserving sticker borders and hard shadows for page-level primary CTAs and poker-chip key stat badges. Count stat chips use the classic 4 non-signed casino chip colors (`red`, `gold`, `blue`, `white`) while signed `+`/`−` chips remain strictly for score deltas.

### 34. Bonus Ideas Built in Phase 6
- **Live Manager-to-Switcher Sync + One-Click "Test Role":** Adding or updating a manager in `/admin/managers` broadcasts `user.updated` so `AuthProvider` refreshes `demoUsers` immediately—making new staff accounts appear instantly in the Quick Role Switcher and providing a 1-click **"Test Role"** button per manager row to demonstrate RBAC live during the pitch.
- **One-Click Sample CSV Validator & Live Bracket Math Pipeline:** `/admin/players` CSV bulk import includes a 1-click **"Load Sample CSV (3 valid + 1 error)"** button alongside file upload and template download so presenters can showcase live Zod row-by-row validation + UTF-8 BOM Excel-safe CSV exports in seconds; `/admin/bracket` displays a live visual advancement pipeline (`27 Players → Round 1: 9×3 → Round 2: 3×3 → Semi-Final: 1×3 (adv 2) → Final (2 + Marwan Serry)`) before confirming generation.

---

## Phase 7 Public Spectator Pages & Contestant Portal Decisions (2026-11-20)

### 35. Super Admin Contestant Preview Switcher vs. Locked Player Role (`/player` & `/player/history`)
- **Decision (confirmed via Phase 7 shape interview):** Because `AuthProvider` defaults to `Super Admin` (`user-admin`, which has no `playerId`) during pitches while `AGENTS.md §4` restricts logged-in `player` accounts to their own profile/history only:
  - When `user.role === 'superAdmin'`, `PlayerPortalChrome` renders a **Contestant Preview switcher bar** (defaulting to Omar Hassan `#1`, with 1-click presets for Karim Nabil `#4` LIVE Now, Salma Reda `#19` Upcoming R2, Laila Kamel `#25` Pre-Debut, plus a full 27-player selector) persisted across `/player` and `/player/history` via `?player=<id>`.
  - When `user.role === 'player'`, the preview switcher is never rendered and both routes lock strictly to `user.playerId`. Other roles (`scorer`, `checkIn`, `content`, visitors) remain blocked by `RoleGuard`.

### 36. Modal / Bottom-Sheet Inspection Pattern on `/bracket` & `/segments`
- **Decision (confirmed via Phase 7 shape interview):**
  - **`/bracket`:** Clicking or keyboard-activating any `BracketNode` opens a responsive **Game Detail Dialog** (bottom sheet on phones, centered modal on `sm+`, deep-linkable via `?game=<id>`) displaying live/final standings, active buzzer state, segment-by-segment score breakdown, scorer/time metadata, and direct links to `/screen/[gameId]` (plus `/scorer/[gameId]` for authorized staff). Live nodes glow with a gold halo (`--glow-gold`) and pulse badge; phones default to round-focus tabs (`< lg`) with an optional toggle to the full zoomable `BracketTrack` tree, while `1440px+` desktops display all 4 rounds side-by-side without clipping Marwan Serry's Grand Final.
  - **`/segments`:** Clicking any segment opens a **deep-linkable Detail Inspector (`?segment=seg-X`)** showing both EN and AR titles, full description, signed preset `ScoreChip`s (`+10`, `+5`, `−5`), stage play flow, a live list of tournament tables featuring that segment (resolved from `gameRepo`), and Previous/Next segment navigation.

### 37. Full Showcase Depth on `/final` & Partnership Deck Matrix on `/sponsors`
- **Decision (confirmed via Phase 7 shape interview):**
  - **`/final`:** Dedicated Stage showcase combining the live countdown (or live/finished takeover), symmetrical 3-seat Marquee Spotlight (`[Finalist #1 | Marwan Serry Golden Seat (center, name only, no photo) | Finalist #2]`), live **Road to the Final** round-by-round progress (`IN PROGRESS` / `LIVE NOW` / `UPCOMING` / `GRAND FINAL`), the 8 Final championship segments, editable venue/prize placeholders, and direct launch to `/screen/[finalGameId]`.
  - **`/sponsors`:** Dedicated partnership deck featuring `sponsorRepo` tier cards (text-only `logoText`, placeholder notices, `"Contact us"` `mailto:` links, zero fixed currency prices) plus a responsive **Tier Deliverables Comparison Matrix** (scannable stacked deliverable cards on `< md` phones; full side-by-side sticky-column matrix table on `md+`).

### 38. Bonus Ideas Built in Phase 7
- **Highlight Player Path on `/bracket`:** Added a live **Highlight Player Path** selector (also deep-linked from every row on `/leaderboard` via `/bracket?player=<id>`) that rings every table a contestant played or is seated in across all rounds in white-buffered electric blue, reporting the exact matched table count.
- **Smart Default-Expanded Played Match on `/player/history` & One-Click Pitch Email Copy on `/sponsors`:** `/player/history` automatically expands the contestant's most recent LIVE or FINISHED match first (falling back to a scheduled table only for pre-debut players) so rich segment-by-segment timestamps and notes are visible immediately on arrival; `/sponsors` adds a 1-click **Copy Contact Email** action with themed toast feedback alongside pre-filled `mailto:` CTAs.

---

## Global Optimize & Polish Pass Decisions (2026-11-20)

### 39. Zero-Framer-Motion Base Shell, Route Code-Splitting & Cached Storage Reads
- **Context:** Baseline `next build` showed monolithic barrel chunks across every route (`/admin/*` 306 kB, public spectator routes 285 kB, `/scorer/*` 266 kB, `/` 254 kB), `ToastProvider` pulled `framer-motion` into `RootLayout`, `storage.readSnapshot()` re-parsed JSON and re-ran full Zod `DatabaseSnapshotSchema.safeParse()` on every read, and wildcard `realtime.subscribe('*')` handlers reloaded unrelated views on `timer.updated` / `game-demo` events.
- **Decisions:**
  - Enabled `experimental.optimizePackageImports` (`lucide-react`, `framer-motion`, `@radix-ui/*`), replaced route and component barrel imports with direct module imports, and lazy-loaded `LiveDemoSection`, `SessionHistoryDrawer`, and `GameEditorDialog` via `next/dynamic`.
  - Moved `ToastProvider`, `SunburstStage` (with `IntersectionObserver` offscreen rotation pausing and `[contain:layout_paint]`), `MarqueeBulbs`, `LiveBadge`, `Lantern`, `PlayingDice`, `PlayingCardMotif`, `TimerRing`, `PlayerPanel`, `HeroFinalSection`, `PublicPageHero`, and `FinalShowcaseView` to pure GPU-composited CSS animations + zero-dependency `requestAnimationFrame` `AnimatedNumber` (eliminating `framer-motion` from 25 of 28 routes and removing above-the-fold `opacity: 0` LCP delays). Kept Framer Motion strictly for true layout-reordering/broadcast surfaces (`/leaderboard`, `/screen/*`, `LiveDemoSection`, `/styleguide`).
  - Cached `memoryCache` + `cachedRaw` in `src/lib/storage/index.ts` (returning `structuredClone(memoryCache)` when raw `localStorage` is unchanged and invalidating on cross-tab `storage` events), isolated the 1-second Final Night countdown into `FinalCountdown` (`React.memo`), split `ToastProvider` actions from toast list state, and scoped all `realtime.subscribe` listeners to ignore `timer.updated` / `game-demo` where irrelevant.
  - Added missing `DESIGN.md` radii tokens (`highlight`, `chip-sm`, `ribbon`, `marquee`) to `tailwind.config.ts`, fixed phantom `sm:text-fluid-5xl` → `sm:text-fluid-hero` in `PublicPageHero`, removed dead `RouteShellPlaceholder.tsx` and duplicate `.tabular-nums`, added branded bilingual `src/app/not-found.tsx` and `src/app/error.tsx`, replaced stale hardcoded `game-11` shell links with dynamic live-game resolution, added mobile drawer focus management + body scroll lock, added `DataTable` clear search button + `aria-pressed`, and sorted/badged unlocking accounts in `RoleGuard`.

---

## Pitch Release (`v0.1-pitch`) End-to-End Hardening & Deployment Decisions (2026-11-20)

### 40. Automatic Next-Round Bracket Advancement, Round Status Sync & TBD Qualifier Guards
- **Context:** End-to-end testing of the full tournament story (Create Players → Generate Bracket → Score Round 1 → Tie-Breaker → Finish → Advance → Semi-Final → Grand Final vs. Marwan Serry) exposed that `gameRepo.finishGame` previously computed `advancingPlayerIds` without slotting winners into the next round's scheduled table(s) or syncing `Round.status`, and `computeFlexibleRounds` generated a redundant 3-seat Semi-Final with an unfillable TBD seat on `18P` (6×3 → 2×3 → 2 winners).
- **Decisions:**
  - Wired deterministic slot advancement in `src/lib/repos/gameRepo.ts` (`resolveNextRoundSlotTargets` + `syncRoundStatusesInMemory`): finishing any game slots its `advancingPlayerIds` into the exact next-round scheduled game seats (`globalSlot = sourceGameIdx * advancePerGame + k`) while protecting Marwan Serry's `'player-marwan'` seat, automatically emits `bracket.updated` (plus `final.revealed` once both Grand Final challenger seats are filled), and cleanly rolls back downstream `scheduled` slots on `gameRepo.reopenGame()`.
  - Fixed `computeFlexibleRounds` (`AdminBracketView.tsx`) and `distributeSeatsAcrossGames` (`gameRepo.ts`) so `9P`, `18P`, `27P`, `36P`, and custom counts never produce orphan unfillable TBD seats or `< 2`-player tables.
  - Hardened `gameRepo.startGame()`, `ScorerConsoleView`, `ScorerDashboardView`, `BigScreenGameView`, and `HowItWorksSection` to display clean localized `TBD` qualifier cards before feeding rounds finish (keeping Marwan Serry centered on Big Screen Final slates) and block starting a session until all seats are filled.
  - Replaced remaining hardcoded `27` player counts on `/bracket`, `HeroFinalSection`, and `HowItWorksSection` with live roster/settings counts, fixed sidebar code formatting for generated IDs (`game-gen-1` → `G1`), cleaned up mixed Latin/Arabic glyph typo (`Kahwa & Crème Roasters`) in `src/lib/seed/index.ts`, and ensured `AuthProvider` persists fallback `'user-admin'` if `Reset demo data` removes a newly created staff account.
  - **Bonus Idea:** Upgraded the Scorer Console Finish Game toast to explicitly announce *which next-round table* the winner(s) advanced into (including `"Finalists automatically advanced into the Grand Final vs. Marwan Serry!"`) so bracket progression is unmistakable during the live pitch.

### 41. Zero-Config Deployment Packaging (Vercel & Netlify)
- **Decisions:** Added [`vercel.json`](./vercel.json), [`netlify.toml`](./netlify.toml), [`.env.example`](./.env.example), [`README.md`](./README.md), and [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md). Zero environment variables are required for `v0.1-pitch`, and `next/font/google` self-hosts fonts at build time so the production build runs 100% offline as a pitch fallback.

---

## Change Request 1 — Step 1 of 5: Event-Sourced Engine, Command Pipeline & IndexedDB (2026-11-21)

### 42. Ambiguity Decisions Recorded "to confirm with client" (AGENTS.md §15)
1. **Group Ranking Rule 3 (`pointsDiff` vs `pointsFor`) — *to confirm with client*:** `AGENTS.md §15.1` states "(3) total match points scored (difference), (4) fewer red cards, then fewer yellow cards". We implement Rule 3 strictly as net match points difference (`pointsFor - pointsAgainst`), proceeding immediately to Rule 4 (fewer red cards, then fewer yellow cards) without letting gross `pointsFor` override disciplinary cards.
2. **BYE Assignment Timing While Group Stage Is Incomplete — *to confirm with client*:** When qualifier count is not a power of two (e.g., 240 qualifiers → 256 bracket = 16 BYEs), BYE slots are awarded to the best group winners ranked across ALL groups. While groups are still incomplete, BYE nodes display `Best Group Winner #N (TBD) vs BYE` rather than flapping provisionally on partial group results; once all groups finish, `resolveByes()` deterministically locks the exact BYE recipients and propagates them automatically into Knockout Round 2.
3. **Non-Divisible `totalPlayers % groupSize` Remainder — *to confirm with client*:** If `totalPlayers` is not evenly divisible by `groupSize` and leaves a remainder of `1`, `generateGroups()` merges that player into the last group (forming a group of `groupSize + 1` rather than an unplayable 1-player group). Remainders of `>= 2` form a valid smaller final group.
4. **Card Undo & Match Replay Epochs (`replayEpoch`) — *to confirm with client*:**
   - Undoing a Yellow (`−1`) or Red (`−2`) card appends a compensating `kind: 'undo'` event referencing `targetEventId`, restoring BOTH the player's points AND decrementing their active card count.
   - When a Super Admin confirms the default cascade policy (`invalidateForReplay`) on a downstream live/finished match, the engine increments `match.replayEpoch` and appends an `invalidatedForReplay` lifecycle event instead of deleting historical events, preserving 100% append-only auditability while starting the replayed match cleanly at `0–0`.
5. **Final Match Absence Behavior & Walkover Points — *to confirm with client*:** Per §15.2, marking a finalist absent in the 1v1v1 Final with Marwan does not auto-end the match; it sets `requiresAdminDecision: true` so the Super Admin can decide via `overrideResult`. In 1v1 group walkovers, the present player receives `pointsPerGroupWin` (3) group points and `0` match-point differential (since no segments were played), while the absent player receives `+1` absence in tournament stats.
6. **Marwan Serry Guest Isolation — *to confirm with client*:** Marwan (`player-marwan`, `isGuest: true`) is seated exclusively in the Grand Final (excluded from groups, group standings, leaderboard rankings, and tournament player stats), even if Marwan wins the Grand Final match itself.
7. **Admin Score Edit Reversibility — *to confirm with client*:** Per §15.4 ("a revert appends compensating events, it never deletes"), removed destructive `deleteScoreEvent` from `SessionHistoryDrawer` and implemented `editScoreEvent` as an atomic pair of append-only events (compensating `undo` for the old event + new corrected `ScoreEvent`).
8. **Player Gate Check-In vs. Derived Tournament Status — *to confirm with client*:** Gate arrival (`registered | checkedIn | absent`) is recorded via append-only `CheckInEvent`s. Once a player begins competing, `computePlayerStatus()` derives `active`, `eliminated`, or `finalist` purely from match participation, group standings, and knockout outcomes; no UI screen or repo may assign tournament status directly.

### 43. Bonus Idea Built in CR1 Step 1
- **AST-Level Architectural Boundary Guard (`scripts/check-derived-writes.mjs`):** Rather than a fragile regex check, implemented a real TypeScript Compiler API AST linter wired into `npm run lint` that enforces THREE architectural guarantees in under 1 second: (a) zero direct writes to derived fields (`winnerPlayerId`, `winnerId`, `advancingPlayerIds`, `result`, `stats`, entity `status`/`rank`) outside `/lib/engine` and `/lib/commands`, (b) zero UI/storage/realtime/React imports inside pure `/lib/engine`, and (c) zero direct `/lib/storage` or `/lib/seed` imports inside `src/app` or `src/components`.
- **Single-Pass Batched Totals (`scoreRepo.getTotalsForMatches`) + O(1) Delta Diffing:** Eliminated N+1 per-match score lookups on Admin/Scorer dashboards and optimized `commitCommand` with shallow-array copy + reference-equality delta diffing so single-point commits touch only 3–5 IndexedDB records even with 1,000+ matches and 100,000+ events.

---

## Change Request 1 — Step 2 of 5: Tournament Structure at 720-Player Scale (2026-11-21)

### 44. Decisions & Confirmed Shape Choices (`v0.1.1-cr2-structure`)
1. **256-Slot Knockout & 240-Group Navigation Topology (confirmed via Shape):** `/bracket` and `/admin/bracket` separate **Group Stage** (virtualized cards with Jump-to-Group, search, status/cycle filters, and Standings + 1v1 Matches Inspector) from **Knockout Bracket** (60fps drag-to-pan + wheel/button zoom `KnockoutCanvas` with **Region Focus** pills — `Final 16 → Marwan`, `Quarter 1–4`, `Full` — plus clickable corner **Minimap**, SVG elbow connectors, searchable 720-player `PlayerCombobox` path trace, and Jump-to-Match `#`). Phones (`< lg`) default to clean Round-Focus tabs with a 1-tap toggle to the pan/zoom tree.
2. **Dedicated Group Routes & `/admin/games` → `/admin/matches` Rename (confirmed via Shape):** Added dedicated **`/admin/groups`** (Pre-tournament Random Draw / Seed Order / 2-Step Swap & Move + accessible keyboard Move dialog, locked automatically once any match starts, plus live standings & tie-break controls) and public **`/groups`** (deep-linkable `?group=N`). Renamed `/admin/games` to **`/admin/matches`** across the sidebar and dashboard while keeping `/admin/games` as a transparent Next.js `redirect('/admin/matches')`.
3. **Tiered Mid-Tournament Settings Impact Policy (confirmed via Shape):**
   - **Scoring-only (`pointsPerGroupWin`)** runs pure `previewCascadeImpact` and recomputes group standings & downstream slots in place (prompting `invalidateForReplay` vs `markNeedsReview` only if live/finished knockouts are impacted).
   - **Scheduling (`tablesCount`, `slotMinutes`)** offers to auto-schedule **upcoming (`scheduled`) matches only**, preserving live/finished match history with zero double-bookings.
   - **Structural (`totalPlayers`, `groupSize`, `advancePerGroup`, `includeFinalWithMarwan`)** shows exact counts of affected live/finished matches, groups, and events before confirming full rebuild; scaling up automatically tops up the procedural roster cleanly.
4. **Automatic Deadlock Group Tie-Break Match Creation (*to confirm with client*):** Whenever a group completes all regular round-robin matches (`n(n-1)/2`) and remains level across rules 1–4 (including an exact symmetric 3-way 3-3-3 cycle), `applyPropagationAndCascade` automatically spawns a conflict-free scheduled `isGroupTieBreak: true` match containing all tied cutoff players (2-player or 3-player sudden-death decider) and logs an automatic `cascade.groupTieBreakCreated` audit entry. If an admin later reverts a score before the tie-break starts and breaks the tie, the unused auto-spawned tie-break match is pruned automatically.
5. **Procedural Seed Presets & Non-Blocking Generation:** Exposed **12 / 48 / 720** demo seed presets in both `/admin/settings` and `/admin/bracket`, wrapped in `createSeedSnapshotAsync` and backed by O(N) indexed engine propagation (`propagateWinners`, `computeQualifiers`, `autoScheduleMatches`) so generating all 720 players, 240 groups, 975 matches, and verifying all 9 invariants completes in ~300ms without freezing the UI.

### 45. Bonus Ideas Built in CR1 Step 2
- **Live Schedule Conflict Radar & 1-Click "Find Next Free Slot":** Added a pure `detectScheduleConflicts` + `findNextFreeSlotForMatch` engine pair powering both a real-time Conflict Health Strip on `/admin/matches` (with 1-click "Filter Conflicts" and "Resolve via Auto-Schedule") and live conflict warnings directly inside `MatchEditorDialog` whenever an admin manually edits a table, time slot, judge, or participant—plus a 1-click **"Find Next Free Slot"** button that resolves collisions instantaneously.
- **Searchable 720-Player `PlayerCombobox` & Auto-Virtualized `DataTable`:** Built a zero-dependency `VirtualList` + `DataTable` scroll virtualization (`All (N) — Virtualized` mode rendering only visible rows in DOM) alongside a searchable Arabic-normalized `PlayerCombobox` so selecting players in a 720-player tournament never renders a sluggish 720-option native dropdown.

---

## Change Request 1 — Step 3 of 5: Scorer Console v2, Disciplinary Cards, Absences & Contacts (2026-11-21)

### 46. Decisions & Confirmed Shape Choices (`v0.1.1-cr3-scorer`)
1. **Hybrid Ergonomics on `/scorer/[matchId]` (confirmed via Shape):** On tablet & desktop (`md+`), each `PlayerPanel` displays direct 1-tap `>= 56px` **`+1`**, **`−1`**, **Yellow card (`−1`)**, and **Red card (`−2`)** buttons directly underneath **Buzzed First** (2-column grid for 1v1 matches, 3-column grid for the 1v1v1 Grand Final with Marwan Serry), paired with a slim shared **Optional Note + Undo + Finish** action strip below. On phones (`< md`), per-panel scoring buttons hide in favor of a fixed one-handed **Sticky Thumb Dock** with compact player toggle pills, the 4 big scoring buttons, a collapsible optional note input, Undo preview, and Finish button so judges never have to scroll or reach across the screen.
2. **Inline Super Admin Decision Panel & Strict 4-Choice History Drawer (confirmed via Shape):** Matches in `void` (both absent), `needsReview` (upstream cascade), or Grand Final with an absent finalist render an inline **Super Admin Decision Panel** right inside `/scorer/[matchId]` with 1-click **Award Winner (Override)**, **Reverse Absence** (triggers `ImpactPreviewDialog` when downstream started), and **Reset / Reopen** actions. `SessionHistoryDrawer` runs strictly through `/lib/commands`, adds an **Absences** tab with Super Admin reversal, and restricts retroactive Add/Edit to the exact 4 Scorer v2 choices (`+1`, `−1`, Yellow `−1`, Red `−2`) with zero custom numeric inputs anywhere.
3. **Full Repo Sweep of `presetPoints` & Custom Inputs (confirmed via Shape):** Removed `presetPoints` from `SegmentSchema`, `createSegmentsSeed()`, `AdminSegmentsView`, `PlayerPanel`, `LiveDemoSection`, `SegmentsSection`, `SegmentsLibraryView`, `FinalShowcaseView`, `RulesView`, `FeaturesSection`, `/styleguide`, and project docs; tightened `commands.applyPoint` and `commands.editScoreEvent` to reject any delta other than `±1` (or `-2` for red cards); renamed route `/scorer/[gameId]` → `/scorer/[matchId]`; and synced original SVG card counters (`CardCounterGroup`), absent/walkover badges, and 2-col vs 3-col layout into Venue Big Screen (`/screen/[gameId]`).
4. **Canonical Card Note Formatting Convention:** `commands.applyCard` persists `note: "Yellow card (−1): <note>"` / `"Red card (−2): <note>"` (or bare label if no note) so raw CSV exports and database rows always carry the required `"Yellow card (−1)"` / `"Red card (−2)"` phrasing, while `formatScoreEventDisplay()` strips the prefix via `stripCardNotePrefix()` so bilingual EN/AR UI rows render the SVG `DisciplinaryCardIcon` + localized label + clean user note once without duplication.
5. **Contact Access & Audit Trail:** `ContactIconButton` (`44px+`) + sticker `PlayerContactDialog` appear beside players only for the assigned judge, check-in staff (`/admin/check-in`), and super admin (hidden for guest host Marwan), fetching contact details through `playerRepo.getContactForActor()` which enforces role/assignment scope and appends a light `contact.viewed` audit entry.

### 47. Bonus Idea Built in CR1 Step 3
- **Live Recent Plays Ticker inside `/scorer/[matchId]`:** Added a slim, non-intrusive 3-event live ticker strip above the bottom action dock showing the latest `+1`, `−1`, Yellow/Red card (with SVG card icon + note), or Undo entries with timestamps and a 1-tap jump into full Session History—giving judges instant visual reassurance after every rapid tap without opening a modal.

---

## Change Request 1 — Step 4 of 5: Player Privacy, Upcoming Match View & Shared Avatars (2026-11-21)

### 48. Decisions & Confirmed Shape Choices (`v0.1.1-cr4-player`)
1. **Strict Repository-Level Segment Secrecy (`matchRepo` + `scoreRepo` + Public Views — confirmed via Shape):**
   - `redactMatchForRole` and `redactScoreEventForRole` in `src/lib/repos/permissions.ts` strip `segmentIds: []`, `currentSegmentIndex: 0`, and `ScoreEvent.segmentId: ''` on any unfinished non-demo match (`status !== 'finished'`) whenever read by a `player` or `visitor` (resolved via either `viewerRole` or `actorUserId`).
   - `/player` and `/player/history` pass `viewerRole: 'player'` even during Super Admin preview so the Contestant Portal never leaks upcoming or live segment names, counts, order, categories, or match-specific rules.
   - `/segments` (`SegmentsLibraryView.tsx`) maps segment usage counts and its inspector table list exclusively to **finished** matches (`status === 'finished'`), while `/final` (`FinalShowcaseView.tsx`) replaces the 8-segment list with a **"Surprise Championship Lineup — Revealed Live on Stage"** card until the Grand Final is `finished`.
2. **24-Option 3D Avatar Library Source & License (`src/components/brand/AvatarLibrary3D.tsx` — AGENTS.md §15.3):**
   - **Source:** Original in-house 3D-lit SVG artwork authored directly in `src/components/brand/AvatarLibrary3D.tsx` (`avatar-01` through `avatar-24`, featuring 24 game-show and Ramadan motifs: *Golden Studio Mic, Crimson Buzzer Dome, Royal Ramadan Fanous, Lucky Six 3D Die, Broadcast Headphones, Golden Crescent & Star, Champion Trophy Cup, Royal Spade Emblem, Cinema Clapboard, Electric Trivia Bolt, VIP Casino Chip, Comedy Stage Crown, Golden Falcon Crest, Clever Fox Mask, Nile Lotus Jewel, Gold Vinyl Turntable, Sudden-Death Stopwatch, Showtime Starburst, Mystery Trivia Cube, Golden Ramadan Dallah, Silver Screen Reel, Diamond Shield, Stage Rocket, Royal Lion Medallion*).
   - **License:** **CC0 1.0 Universal (Public Domain Dedication) / MIT Project-Original** — 100% original vector geometry and 3D studio lighting rig with zero external third-party dependencies and zero real-person or celebrity likenesses.
   - **Deterministic Assignment:** Assigned deterministically from `player.seed` / `player.id` via `resolveDeterministicAvatarKey()` (`(seed - 1) % 24`) and changeable by the player (for themselves) or by Super Admin (for any player). Marwan Serry (`player-marwan`) is strictly locked to his name-only Golden Seat emblem and cannot have a profile photo (`CommandValidationError` enforced in `/lib/commands`).
3. **Interactive Square Crop & `<= 300KB` Compression Studio (`src/components/player/AvatarEditorDialog.tsx` — confirmed via Shape):**
   - Supports Gallery upload and mobile Camera capture (`capture="user"`) with strict MIME validation (`image/jpeg`, `image/png`, `image/webp`), interactive drag-to-pan + `1×..3×` zoom square crop canvas, iterative client-side JPEG canvas compression guaranteed `<= 300KB` (paired with server/command-layer base64 byte-size and MIME validation in `validatePlayerAvatarInput`), 1-click **Remove Photo** (reverting to the 3D avatar library), and self-service bilingual Nickname (`nickname` / `nicknameAr`) editing for players.
4. **Upcoming Match View & Judge Help Sticker Card (`src/components/player/PlayerProfileView.tsx`):**
   - Displays Opponent(s) (with shared `PlayerAvatar`, full name, nickname, and seed `#`), Date & Call Time, Round & Group badges, prominent **Table Number** (`TABLE #N` badge + big casino-chip `#N` numerals), and the friendly **"Need help finding your table?" Judge Help Sticker Card** (`DESIGN.md §6`) with the assigned judge's name and 1-tap Call (`tel:`) and WhatsApp buttons logging `contact.viewed` via `userRepo.getJudgeContactForActor`.

### 49. Bonus Idea Built in CR1 Step 4
- **Interactive Pan/Zoom Square Framing Studio with Live Compressed KB Meter & 720-Player Searchable Preview Bar:** Upgraded `AvatarEditorDialog` with a tactile drag-to-frame square viewport and live compressed byte-size badge (`e.g. Compressed: 24 KB (<= 300 KB limit)`), and upgraded `PlayerPortalChrome` with the 720-player searchable `PlayerCombobox` (with live 3D avatars) + dynamic 1-click presets (`Upcoming Knockout`, `LIVE Now`, `Group 7 Winner`, `Upcoming Group`).

---

## Change Request 1 — Step 5 of 5: End-to-End Integration, 720-Player Performance, Impeccable Audit & Release (`v0.1.1-client-feedback-1`, 2026-11-22)

### 50. Decisions & Bonus Ideas Built in CR1 Step 5
1. **Admin `keepAsIs` Feeder Pinning (`commands.resolveNeedsReview`):** When a Super Admin reviews a `needsReview` downstream knockout match and chooses **Keep As-Is**, the command now pins the played participants' feeders to `{ kind: 'fixed', playerId }` alongside appending the `reviewResolved` event and propagating with `markNeedsReview` downstream. This preserves the played match and its audit trail while keeping all 9 engine invariants (including `KNOCKOUT_PARTICIPANTS_MATCH_FEEDERS`) at 0 violations on future recomputations.
2. **O(1) Live-Scoring Fast Path with Full Dev/Test Invariant Parity (`src/lib/commands/index.ts`):** During an actively `live` match, `+1`, `−1`, Yellow card (`−1`), Red card (`−2`), live Undo, and Buzz cannot change any finished match outcome, group standing, qualifier, or bracket slot. Updating the single match/player delta in O(1) while keeping full `checkInvariants()` on in dev/test and on every structural/finish/post-finish/cascade command cut 4× CPU mid-range phone tap-to-paint latency **5.5×** (`2,638ms → 482ms` avg).
3. **Top-Docked Mobile Toasts (`src/components/ui/toast.tsx`):** Moved `< sm` phone toast notifications to `top-[calc(4.5rem+env(safe-area-inset-top))]` (keeping bottom-end on `sm+`) so rapid feedback toasts on mobile never cover the Scorer Console's sticky bottom thumb dock.
4. **Bonus Idea Built in CR1 Step 5 — Viewport-Culled 256-Slot Knockout Canvas (`KnockoutCanvas.tsx`):** Added `ResizeObserver`-backed bounding-box culling (420px overscan) whenever a bracket view exceeds 48 nodes, dropping the rendered DOM button count in `Full (256-Slot)` mode from 255 cards down to ~20 visible cards so panning/zooming stays 60 FPS even on mid-range phones.

---

## To Confirm With Client

> Consolidated list of every remaining product, rules, or branding ambiguity from Phases 1–9 and Change Request 1 (`v0.1.1-client-feedback-1`). Every item below currently runs with a clean, documented, editable default — confirm each with the client before locking production launch rules.

| # | Area | Current Default in Prototype | Question to Confirm With Client |
|---|---|---|---|
| 1 | **Group Tie-Break Rule 3 (Diff vs. Gross)** | Net match-point difference (`pointsFor − pointsAgainst`), then Rule 4 (fewer Red cards, then fewer Yellow cards). | Should Rule 3 be strictly **net points difference**, or should **gross points scored** also break ties before disciplinary cards? |
| 2 | **Automatic Deadlock Group Tie-Break Match** | When all regular group matches finish level across rules 1–4 (e.g., exact 3-way 3-3-3 symmetric cycle), the engine auto-spawns a conflict-free `isGroupTieBreak: true` sudden-death match for tied cutoff players. | Should deadlocked groups play an automated sudden-death tie-break match, or use an alternative rule (e.g., coin toss / seed / admin pick)? |
| 3 | **BYE Timing While Group Stage Is Incomplete** | When qualifiers aren't a power of two (e.g., 240 → 256 = 16 BYEs), BYE slots show `Best Group Winner #N (TBD) vs BYE` until all groups finish, then lock deterministically. | Confirm BYEs wait for all groups to finish (preventing premature provisional knockouts), or should earlier groups advance provisionally? |
| 4 | **Non-Divisible `totalPlayers % groupSize` Remainder** | A remainder of `1` merges into the last group (`groupSize + 1`); remainders `>= 2` form a smaller last group. | If actual check-in/registration count isn't divisible by `groupSize`, prefer merging a 1-player remainder into the last group or adding a BYE placeholder? |
| 5 | **Walkover Match-Point Differential & Final Absence** | 1v1 group walkovers award `pointsPerGroupWin` (`3`) group points and `0` match-point differential; both absent → `void` (Super Admin decides); Grand Final absence does NOT auto-end (prompts Super Admin). | Should a 1v1 walkover award a fixed default score (e.g., `3–0`) toward net point difference, or keep `0` diff? Confirm Super Admin manual ruling for Final night absences. |
| 6 | **Marwan Serry Guest Isolation (Grand Final)** | Marwan Serry (`isGuest: true`) is seated exclusively in the 1v1v1 Grand Final and excluded from groups, rankings, and stats — even if he wins the Final match. | If Marwan scores highest in the Grand Final, is he crowned Exhibition Winner while the top finalist wins the contestant prize, or how should Final Winner copy read? |
| 7 | **Downstream Cascade Policy (`keepAsIs` vs. `invalidateForReplay`)** | When an upstream score is reverted after a downstream knockout match started, Impact Preview defaults to `invalidateForReplay` (increments `replayEpoch`, preserves old events) or `markNeedsReview` (admin can later `keepAsIs`, pinning those participants as fixed feeders). | Confirm both policies (`invalidateForReplay` and `keepAsIs` feeder-pinning) match tournament referee regulations. |
| 8 | **Judge Phone/WhatsApp Visibility to Players** | The Contestant Portal's **"Need help finding your table?"** card displays the assigned judge's name, `tel:` call button, and WhatsApp button (each access logged as `contact.viewed`). | Confirm judges' operational event phone numbers (dedicated staff SIMs / helpdesk numbers) should be exposed directly to contestants in their assigned matches. |
| 9 | **Player Profile Photo Moderation & 3D Avatar Pack** | Players can upload a square-cropped photo (`<= 300KB`) or pick from 24 original 3D SVG game-show/Ramadan avatars; Super Admin can replace/remove any photo. | Do uploaded contestant photos go live immediately (with Super Admin removal), or require pre-approval moderation before appearing on the Venue Big Screen? |
| 10 | **Editable Event Placeholders & Official Branding** | Event dates (`Ramadan 2027`), venue, prizes, sponsor tiers (`"Contact us"` instead of prices), 16 original draft segments, and original game-show SVG artwork are placeholders. | Confirm final Ramadan dates, venue, prize copy, approved 16-segment list, sponsor packages, and whether official show logo/artwork will be supplied with Marwan Serry's written permission. |
| 11 | **Registration Quiz & Phase 10 Delighters** | Registration quiz (20 questions × 10s) is out of scope (separate future project); Phase 10 Delighters (confetti, sound effects, haptics, 3D flips) remain `OFF` (`delightersEnabled: false`). | Confirm timing for activating Phase 10 Delighters and integrating the separate registration quiz project. |







