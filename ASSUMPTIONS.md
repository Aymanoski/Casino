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
