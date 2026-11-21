# TODO.md — Production Readiness & Database / Auth Swap Checklist

> This document tracks every mock adapter, repository module, and UI consumer that will be swapped when moving from the `localStorage` pitch prototype to a production backend, database, and realtime infrastructure.

---

## 1. Storage & Repository Modules (`src/lib/storage` + `src/lib/commands` + `src/lib/repos/*` → Database / ORM)

All UI components and pages read through `src/lib/repos/*` and execute all mutations exclusively through the atomic Command Pipeline (`src/lib/commands/index.ts`), backed by pure deterministic derivations in `src/lib/engine/*` and IndexedDB (`idb`) in `src/lib/storage/index.ts`. To connect a production database (e.g., PostgreSQL with Prisma or Drizzle, or Supabase):

- [ ] **`src/lib/storage/index.ts`**: Replace IndexedDB (`casino_el_al3ab_idb_v1` with 15 indexed object stores & atomic `commitDelta` transactions) with a PostgreSQL/ORM transaction adapter implementing `StorageAdapter`.
- [ ] **`src/lib/commands/index.ts`**: Move `executeCommand` / `commands.*` into Next.js Server Actions / API route handlers wrapped in `BEGIN ... COMMIT` SQL transactions using optimistic row locking (`WHERE id = $1 AND version = $expectedVersion`), preserving the exact pure `/lib/engine` recomputation, cascade Impact Preview, automatic audit entries, and `checkInvariants()` pipeline.
- [ ] **`src/lib/repos/matchRepo.ts` (`gameRepo` alias) & `groupRepo.ts`**: Replace IndexedDB indexed queries (`by-roundId`, `by-groupId`, `by-judgeUserId`, `by-status`) with SQL queries, keeping `redactMatchForRole()` enforced server-side so `player`-role reads never return `segmentIds` for unfinished matches.
- [ ] **`src/lib/repos/scoreRepo.ts`**: Replace IndexedDB `scoreEvents`, `absenceEvents`, `buzzEvents` index queries (`by-matchId`, `by-playerId`, `by-createdAt`) with append-only SQL tables (`INSERT`-only, no `UPDATE`/`DELETE` grants on event tables).
- [ ] **`src/lib/repos/playerRepo.ts` & `userRepo.ts`**: Enforce `contact.viewPlayer` / `contact.viewJudge` and `contact.viewed` audit logging server-side; store uploaded player avatar photos (<= 300KB cropped square) in object storage (S3 / Supabase Storage / R2) instead of data URLs.
- [ ] **`src/lib/repos/auditRepo.ts`, `roundRepo.ts`, `segmentRepo.ts`, `contentRepo.ts`, `sponsorRepo.ts`, `settingsRepo.ts`**: Back each store with PostgreSQL tables; gate `resetDemoData` behind non-production environment flag.
- [ ] **`src/lib/repos/permissions.ts`**: Mirror `assertRepoPermission`, `redactMatchForRole`, and contact visibility rules in server middleware + PostgreSQL RLS policies.

### Change Request 1 — Step 1 Completion Checklist (`v0.1.1-cr1-engine`)
- [x] Full codebase audit of derived writes + failing Vitest reproduction of reported winner-tag bug before fixing.
- [x] Updated CR1 data model (`Match`, `Group`, `MatchResult`, `version`, `replayEpoch`, `ScoreEvent.kind` = `point | yellow | red | undo`, `AbsenceEvent`, `MatchLifecycleEvent`, `CheckInEvent`, `PlayerContact`, `Avatar`, `Settings.tournament`) + procedural seed generator (`12` / `48` / default `720` players).
- [x] Pure engine in `src/lib/engine/` (`computeMatchResult`, `computeGroupStandings`, `computeQualifiers`, `generateKnockout`, `resolveByes`, `propagateWinners`, `computePlayerStatus`, `computeAllPlayerStats`, `computeLeaderboard`, `autoScheduleMatches`, `previewCascadeImpact`, `checkInvariants`) with zero UI/storage imports.
- [x] Atomic Command Pipeline in `src/lib/commands/` + refactored all existing write paths + AST lint guard (`scripts/check-derived-writes.mjs`) wired into `npm run lint`.
- [x] Cascade rules (`scheduled` auto-update vs live/finished `needsReview` / `invalidateForReplay`) + bilingual `ImpactPreviewDialog` wired into `SessionHistoryDrawer` and `ScorerConsoleView`.
- [x] 9 engine invariants enforced after every command in dev/test + Admin Consistency Check page (`/admin/consistency`) with one-click **Repair by recomputation**.
- [x] IndexedDB storage (`idb`) with 15 indexed object stores, atomic delta commits, cross-tab sync, Reset Demo Data, and verified 1,000+ matches / 100,000+ events scale test.
- [x] Vitest suite (`18/18` passing) covering reported bug, ties/tie-breaks, walkover, both absent, absence reversed, card accumulation/undo, 3-way group cycle & deadlock tie-break, BYEs & odd group counts, alternate settings (48/4/2, 16/4/2), 1v1v1 Marwan Final, downstream cascade after match started, permissions/privacy, consistency repair, post-commit realtime, and 100k-event scale.

### Change Request 1 — Step 2 Completion Checklist (`v0.1.1-cr2-structure`)
- [x] Pure engine additions: `computeTournamentBlueprint`, `validateTournamentSettings`, `getTournamentProgress`, `detectScheduleConflicts`, `detectConflictsForMatch`, `findNextFreeSlotForMatch`, partial `autoScheduleMatches({ onlyScheduled })`, O(N) indexed `propagateWinners` / `computeQualifiers`, tie-break reason labeling (`h2h` / `pointsDiff` / `cards` / `tieBreakMatch` / `deadlock`), and exact rank-matched odd-group BYE pairing.
- [x] Command pipeline extensions: `redrawGroups`, `movePlayerBetweenGroups` (pre-tournament swap/move lock), `autoScheduleAll`, `previewSettingsImpact` + tiered `updateSettings`, and automatic deadlock group tie-break match spawning (`cascade.groupTieBreakCreated`) + revert pruning.
- [x] Admin UI at 720-player scale: `/admin/settings` (all 6 parameters + validation + live resulting numbers preview + tiered Impact Preview + 12/48/720 presets), `/admin/groups` (Draw, Re-Draw, 2-step Swap/Move, virtualized 240-group cards, Jump to Group #, Standings & 1v1 Matches Inspector), `/admin/bracket` (Generator + BYE allocation tracker + 60fps `KnockoutCanvas` with Region Focus & Minimap), and `/admin/matches` (renamed from `/admin/games` with redirect, Conflict Health Banner, Auto-Schedule Upcoming, and `MatchEditorDialog` with live conflict warnings & 1-click Find Next Free Slot).
- [x] Public spectator UI at 720-player scale: dedicated `/groups` page, upgraded `/bracket` (Stage Switcher `Knockout Bracket | Group Stage`, pan/zoom `KnockoutCanvas`, searchable 720-player `PlayerCombobox` path trace, Jump to Match #), `/leaderboard` (Jump to Rank # + Virtualized All 720 scroll mode, Marwan excluded), and `/schedule` (Table # badges & filter, Stage filter, Group/Slot # jump, zero upcoming segments leaked).
- [x] Vitest suite (`26/26` passing across 4 files) including new `tournament-structure-cr2.test.ts` testing `720/3/1`, `48/3/2`, `12/4/1`, odd group counts & non-divisible remainders, BYEs, pre-tournament draw/swaps & post-start lock, automatic 3-way 3-3-3 deadlock tie-break match, schedule conflict detection & partial auto-schedule, and tiered mid-tournament settings Impact Preview.
- [x] Zero TypeScript errors, zero `check-derived-writes.mjs` violations, zero `impeccable detect` findings, and clean Next.js production build (`34/34` routes).

---

## 1b. Legacy Reference: Per-Repo SQL Mapping

All UI components and pages call async functions in `src/lib/repos/*` and never touch `localStorage` or `src/lib/seed` directly. To connect a production database (e.g., PostgreSQL with Prisma or Drizzle, or Supabase):

- [ ] **`src/lib/storage/index.ts`**: Replace `storage.readSnapshot`, `storage.writeSnapshot`, and `storage.resetToSeed` with database connection pool / ORM client.
- [ ] **`src/lib/repos/playerRepo.ts`**:
  - `playerRepo.list({ includeHost })` → `SELECT * FROM players WHERE ... ORDER BY seed ASC`
  - `playerRepo.get(id)` → `SELECT * FROM players WHERE id = $1`
  - `playerRepo.create(input, actorUserId)` → `INSERT INTO players ...` + audit entry
  - `playerRepo.bulkCreate(rows, actorUserId)` → transactional bulk `INSERT INTO players`
  - `playerRepo.update(id, patch, actorUserId)` → `UPDATE players SET ... WHERE id = $1`
  - `playerRepo.updateStatus(id, status, actorUserId)` → `UPDATE players SET status = $2 WHERE id = $1`
  - `playerRepo.remove(id, actorUserId)` → `DELETE FROM players WHERE id = $1 AND is_host = false`
- [ ] **`src/lib/repos/userRepo.ts`**:
  - `userRepo.list({ role })` → `SELECT * FROM users`
  - `userRepo.get(id)` / `userRepo.getByEmail(email)` → `SELECT * FROM users WHERE ...`
  - `userRepo.create(input, actorUserId)` → `INSERT INTO users ...`
  - `userRepo.update(id, patch, actorUserId)` → `UPDATE users SET ... WHERE id = $1`
  - `userRepo.remove(id, actorUserId)` → `DELETE FROM users WHERE id = $1`
- [ ] **`src/lib/repos/roundRepo.ts`**:
  - `roundRepo.list()` → `SELECT * FROM rounds ORDER BY "order" ASC`
  - `roundRepo.get(id)` → `SELECT * FROM rounds WHERE id = $1`
  - `roundRepo.create(input, actorUserId)` / `update(id, patch, actorUserId)` / `remove(id, actorUserId)` → transactional round CRUD + audit
- [ ] **`src/lib/repos/segmentRepo.ts`**:
  - `segmentRepo.list()` → `SELECT * FROM segments ORDER BY "order" ASC`
  - `segmentRepo.get(id)` → `SELECT * FROM segments WHERE id = $1`
  - `segmentRepo.create(input, actorUserId)` → `INSERT INTO segments ...`
  - `segmentRepo.update(id, patch, actorUserId)` → `UPDATE segments SET ... WHERE id = $1` (enforces copy-only scope for `content` role)
  - `segmentRepo.reorder(orderedIds, actorUserId)` → transactional order update + audit
  - `segmentRepo.remove(id, actorUserId)` → `DELETE FROM segments WHERE id = $1` (protects `seg-16`)
- [ ] **`src/lib/repos/gameRepo.ts`**:
  - `gameRepo.list({ roundId, scorerUserId, status })` → filtered `SELECT * FROM games`
  - `gameRepo.get(id)` / `gameRepo.getByRound` / `gameRepo.getByScorer` / `gameRepo.getLiveGames` → indexed queries on `games`
  - `gameRepo.create(input, actorUserId)` / `update(id, patch, actorUserId)` / `remove(id, actorUserId)` → `INSERT` / `UPDATE` / `DELETE` games
  - `gameRepo.generateBracket(config, actorUserId)` → transactional replacement of tournament `rounds` + `games`, seating players & Marwan Serry Final + updating `settings.bracketConfig` + audit entry
  - `gameRepo.startGame(id, actorUserId)` → sets `status = 'live'`, `started_at = NOW()`, initializes segment timer
  - `gameRepo.changeSegment(id, nextIndex, actorUserId)` → updates `current_segment_index`, resets `active_buzz_player_id` and segment timer
  - `gameRepo.updateTimer(id, timer)` → updates `timer` JSONB state and broadcasts `timer.updated`
  - `gameRepo.openTieBreaker(id, actorUserId)` → appends `'seg-16'` to `segment_ids` and advances `current_segment_index`
  - `gameRepo.finishGame(id, actorUserId, { autoOpenTieBreaker })` → DB transaction computing totals, checking for Qualifying Ties across `round.advancePerGame` (auto-inserting `'seg-16'` when enabled), marking non-advancing players `'eliminated'`, and advancing winners
  - `gameRepo.reopenGame(id, actorUserId)` → restores a finished game back to `'live'`, clears winner/advancing locks, restores player statuses to `'active'`, and logs `game.reopen`
- [ ] **`src/lib/repos/scoreRepo.ts`**:
  - `scoreRepo.list(filters)` / `listByGame` / `listByPlayer` → `SELECT * FROM score_events WHERE ... ORDER BY created_at DESC`
  - `scoreRepo.listBuzzByGame(gameId)` → `SELECT * FROM buzz_events WHERE game_id = $1 ORDER BY created_at DESC`
  - `scoreRepo.getGameTotals(gameId)` → `SELECT player_id, SUM(delta) FROM score_events WHERE game_id = $1 GROUP BY player_id`
  - `scoreRepo.getLeaderboard(options)` → aggregated SQL query joining `players`, `score_events`, and `games`
  - `scoreRepo.applyScore(input)` → transactional `INSERT INTO score_events` + `audit_entries` + realtime publish (`score.changed`)
  - `scoreRepo.undoLastScore(gameId, byUserId, { onlyOwn })` / `scoreRepo.undoScoreEventById(gameId, targetEventId, byUserId)` → transactional compensating `INSERT INTO score_events (kind = 'undo', delta = -target.delta)` + marks `undone_by_event_id` on target event
  - `scoreRepo.editScoreEvent(eventId, patch, byUserId)` → updates `score_events` (`delta`, `note`, `segment_id`), recomputes player stats, writes `before`/`after` `audit_entries`, publishes `score.changed`
  - `scoreRepo.deleteScoreEvent(eventId, byUserId)` → deletes `score_events` row (and restores/cleans undo links), recomputes player stats, writes `before` `audit_entries`, publishes `score.changed`
  - `scoreRepo.recordBuzz(input)` / `scoreRepo.clearBuzz(gameId, byUserId)` → `INSERT INTO buzz_events` + updates `games.active_buzz_player_id`
- [ ] **`src/lib/repos/auditRepo.ts`**:
  - `auditRepo.list(options)` → `SELECT * FROM audit_entries ORDER BY created_at DESC`
  - `auditRepo.record(input)` → append-only `INSERT INTO audit_entries`
- [ ] **`src/lib/repos/sponsorRepo.ts`**:
  - `sponsorRepo.list` / `get` / `create` / `update` / `reorder` / `remove` → CRUD on `sponsors` table
- [ ] **`src/lib/repos/contentRepo.ts`**:
  - `contentRepo.list` / `getByKey` / `create` / `update` / `reorder` / `remove` → CRUD on `content_items` table
- [ ] **`src/lib/repos/permissions.ts`**:
  - Mirror `assertRepoPermission` and `MANAGER_ROLE_SPECS` inside server-side API route handlers / Server Actions + PostgreSQL RLS policies when moving off `localStorage`.
- [ ] **`src/lib/repos/settingsRepo.ts`**:
  - `settingsRepo.get()` / `settingsRepo.update(patch, actorUserId)` → `SELECT` / `UPDATE settings`
  - `settingsRepo.resetDemoData()` → disable or gate behind development environment flag in production

---

## 2. UI Components & Pages Calling Repositories (Zero UI Changes Needed When Repos Swap)

- `src/lib/auth/index.tsx` → calls `userRepo.list()`, `userRepo.get()`
- `src/components/layout/PublicHeader.tsx` → calls `gameRepo.getLiveGames()` + subscribes to `realtime`
- `src/components/layout/PublicFooter.tsx` → calls `settingsRepo.get()` + subscribes to `realtime`
- `src/components/layout/StudioSidebarShell.tsx` → calls `gameRepo.list()`, `settingsRepo.resetDemoData()` + subscribes to `realtime`
- `src/app/scorer/page.tsx`, `src/app/scorer/[gameId]/page.tsx` & `src/components/scorer/*` → calls `gameRepo.list()` / `get()` / `startGame()` / `changeSegment()` / `updateTimer()` / `finishGame()` / `reopenGame()`, `playerRepo.list()`, `roundRepo.list()` / `get()`, `segmentRepo.list()`, `userRepo.list()`, `settingsRepo.get()`, `scoreRepo.getGameTotals()` / `listByGame()` / `listBuzzByGame()` / `applyScore()` / `undoLastScore()` / `undoScoreEventById()` / `editScoreEvent()` / `deleteScoreEvent()` / `recordBuzz()` / `clearBuzz()` + subscribes to `realtime`
- `src/app/screen/[gameId]/page.tsx`, `src/app/screen/leaderboard/page.tsx` & `src/components/screen/*` → calls `gameRepo.get()` / `list({ includeDemo: true })`, `playerRepo.list({ includeHost: true })`, `roundRepo.get()` / `list()`, `segmentRepo.list()`, `scoreRepo.getGameTotals()` / `getLeaderboard()`, `settingsRepo.get()` + subscribes to `realtime` and `realtime.onStatusChange()`
- `src/app/admin/**/page.tsx` & `src/components/admin/*` → calls `playerRepo`, `userRepo`, `roundRepo`, `gameRepo`, `segmentRepo`, `scoreRepo`, `auditRepo`, `sponsorRepo`, `contentRepo`, `settingsRepo` (passing `user.id` for repo-level RBAC + audit trail) + subscribes to `realtime`
- `src/app/(public)/page.tsx` & `src/components/landing/*` → calls `settingsRepo.get()`, `playerRepo.list()` / `playerRepo.get()`, `gameRepo.list()` / `gameRepo.get()` / `gameRepo.changeSegment()` / `gameRepo.updateTimer()` / `gameRepo.resetDemoGame()`, `roundRepo.list()`, `segmentRepo.list()`, `scoreRepo.list()` / `scoreRepo.getGameTotals()` / `scoreRepo.applyScore()` / `scoreRepo.undoLastScore()` / `scoreRepo.recordBuzz()` / `scoreRepo.clearBuzz()`, `sponsorRepo.list()`
- `src/app/(public)/{final,bracket,leaderboard,schedule,rules,segments,sponsors}/page.tsx` & `src/components/public/*` → calls `gameRepo.list()` / `getLiveGames()`, `playerRepo.list()`, `roundRepo.list()`, `segmentRepo.list()`, `userRepo.list()`, `scoreRepo.list()` / `getGameTotals()` / `getLeaderboard()`, `contentRepo.list()`, `sponsorRepo.list()`, `settingsRepo.get()` + subscribes to `realtime` and `realtime.onStatusChange()`
- `src/app/player/page.tsx`, `src/app/player/history/page.tsx` & `src/components/player/*` → calls `playerRepo.list()`, `gameRepo.list()`, `roundRepo.list()`, `segmentRepo.list()`, `scoreRepo.list()` / `getLeaderboard()`, `settingsRepo.get()` + subscribes to `realtime`
- `src/app/(public)/styleguide/page.tsx` → calls `playerRepo.list()`, `segmentRepo.list()`, `settingsRepo.get()`

---

## 3. Realtime Synchronization (`src/lib/realtime/index.ts` → Hosted Multi-Device WebSockets)

All repositories and UI screens communicate exclusively through the `realtime` singleton (`RealtimeBroker`) implementing the `RealtimeTransport` interface (`name`, `connect`, `disconnect`, `getStatus`, `onStatusChange`, `publish`, `subscribe`) with typed payloads (`RealtimeEventPayloadMap`) and message-ID deduplication.

To upgrade from same-browser multi-window sync (`BrowserRealtimeTransport` via `BroadcastChannel` + `storage` fallback) to **multi-device venue sync** (e.g., Scorer iPad → Projector Big Screen PC → Spectator phones):

- [ ] Implement a hosted adapter class (`SupabaseRealtimeTransport`, `AblyRealtimeTransport`, `PusherRealtimeTransport`, or `WebSocketRealtimeTransport`) satisfying `RealtimeTransport` in `src/lib/realtime/`.
- [ ] Wire the new driver inside `createRealtimeTransport(config: HostedRealtimeConfig)` in `src/lib/realtime/index.ts` (keyed off `NEXT_PUBLIC_REALTIME_DRIVER` / `NEXT_PUBLIC_REALTIME_URL` env vars), or hot-swap at runtime via `setRealtimeTransport(adapter)` without losing active component subscriptions.
- [ ] Pair with the database swap in §1 so receiving a `score.changed` / `buzz.recorded` / `segment.changed` / `timer.updated` / `game.finished` message causes Big Screens to read canonical state from the shared backend rather than device-local `localStorage`.
- [ ] Optional: emit `final.revealed` from server/admin workflow when unlocking the Grand Final broadcast reveal (Phase 10 Delighters hook).

---

## 4. Authentication & Server-Side Route Guards (`src/lib/auth/index.tsx`)

- [ ] Replace `AuthProvider` mock `localStorage` session and `/login` demo account picker with NextAuth / Auth.js or Supabase Auth.
- [ ] Enforce `canAccessPath` role permissions in Next.js server middleware and server actions.

---

## 5. Responsive Checklist (Device Matrix & Browser Verification)

> Every route shell (`/`, `/styleguide`, `/login`, `/admin`, `/scorer/game-11`, `/player`, `/screen/game-11`) and component must pass with zero horizontal page scroll, >= 44px touch targets (56px+ for scorer actions), >= 16px input font size, hover gated under `(hover: hover)`, safe-area & `dvh`/`svh` support, and proper EN (LTR) + AR (RTL) mirroring.

### Foundations & Components
- [x] Mobile-first breakpoints in `tailwind.config.ts` (`xs: 360px`, `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`, `3xl: 1920px`) + container queries (`@container`, `@2xs`..`@3xl`)
- [x] Fluid typography (`text-fluid-*`) & spacing (`section-y`, `card-pad`, `gutter`, `header-h`) with `clamp()`, `dvh`/`svh`, `viewport-fit=cover` + `env(safe-area-inset-*)`
- [x] Hover effects gated under `@media (hover: hover)` (`future.hoverOnlyWhenSupported: true` + CSS)
- [x] Touch targets >= 44px globally (`Button`, `TabsTrigger`, `SelectItem`, `ScoreChip` interactive, header/drawer/toast close buttons) & >= 56px on Scorer actions (`PlayerPanel` buzz & presets, `Button` `size="scorer"`)
- [x] Inputs / Selects / Textareas >= 16px (`text-base`) font size
- [x] `PublicHeader` slide-over drawer on `< xl` (mirrored in RTL), always-reachable language toggle
- [x] `StudioSidebarShell` (Admin & Scorer) mobile bottom bar + drawer on `< md`, collapsible icon rail on tablets `md..xl` (mirrored in RTL), always-reachable language toggle
- [x] `DataTable` responsive mobile card list + horizontal scroll with sticky first column + mobile filter bottom sheet
- [x] `Dialog` & `ConfirmDialog` bottom sheet on phones (`< sm`), centered modal on `sm+`
- [x] `PlayerPanel`, `ScoreboardRow`, `TimerRing`, `BracketNode` & `BracketTrack` scaling cleanly + `FormGrid` single-column on phones

### Device Matrix — English (LTR) & Arabic (RTL)
- [x] **320px** Phone XS Portrait (`320x568`) — EN & AR RTL (verified with screenshots)
- [x] **360px** Phone SM Portrait (`360x780`) — EN & AR RTL (verified with screenshots)
- [x] **390px** Phone MD Portrait (`390x844`) — EN & AR RTL (verified with screenshots)
- [x] **430px** Phone LG Portrait (`430x932`) — EN & AR RTL (verified with screenshots)
- [x] **Phone Landscape** (`667x375` / `844x390`) — EN & AR RTL (verified with screenshots)
- [x] **768px** Tablet Portrait (`768x1024`) — EN & AR RTL, collapsible tablet rail (verified with screenshots)
- [x] **820px** Tablet Air Portrait (`820x1180`) — EN & AR RTL, collapsible tablet rail (verified with screenshots)
- [x] **1024px** Tablet Landscape (`1024x768`) — EN & AR RTL, collapsible tablet rail (verified with screenshots)
- [x] **1280px** Laptop (`1280x800`) — EN & AR RTL (verified with screenshots)
- [x] **1366px** Short Laptop (`1366x768`) — EN & AR RTL (verified with screenshots)
- [x] **1440px** Desktop (`1440x900`) — EN & AR RTL (verified with screenshots)
- [x] **1536px** Hi-DPI Laptop (`1536x864`) — EN & AR RTL (verified with screenshots)
- [x] **1920px** Full HD Monitor (`1920x1080`, `3xl` tier) — EN & AR RTL (verified with screenshots)
- [x] **2560px** QHD / Big Monitor (`2560x1440`) — EN & AR RTL (verified with screenshots)
- [x] **Browser Zoom 125% & 150%** (`1366x768` & `1440x900` scaled) — EN & AR RTL (verified with screenshots)

---

## 6. Phase 4 Test Checklist — Scorer Dashboard (`/scorer`) & Scorer Console (`/scorer/[gameId]`)

- [x] **Role Access & Assignment Isolation:** `Scorer 1` sees only their assigned tables on `/scorer` (4 tables) and is blocked from opening `Scorer 2`'s table (`/scorer/game-10`) with a clear guard message; `Super Admin` sees all 14 tables with scorer filters and can open any table (including `game-14` Final vs. Marwan Serry).
- [x] **Scheduled Game Gate & Start Flow:** Opening a scheduled table (`/scorer/game-14`) displays the 3 seated players (including Marwan Serry's Golden Seat, name only, zero photos) and segment lineup behind a confirmed **Start Live Session** action before unlocking live scoring.
- [x] **3 Player Panels & "Buzzed First":** `/scorer/game-11` renders 3 player panels with running totals, avatars, tie-aware ranks, and 56px+ **Buzzed First** buttons; tapping Buzz highlights the player in gold, selects them (white-buffered electric-blue ring), records a `BuzzEvent` + `AuditEntry`, and allows **Clear Buzz**.
- [x] **Presets, Custom `±` + Note & Undo:** Tapping segment preset (`+10`, `+5`, `−5`) applies in one tap to the selected player; custom positive/negative amount (with `±` toggle) + optional note applies cleanly; **Undo** button previews the last action inline and reverts it cleanly via a compensating `ScoreEvent`.
- [x] **Segment Navigation & Timer (Final 5s Warning):** Current segment displays both EN and AR titles + progress bar + Prev/Next steppers (with confirmation when stepping back or while running); timer Start/Pause/Reset (56px+ controls) counts down accurately and flashes a pulsing white-border visual warning in the final 5 seconds.
- [x] **Finish Game & Automatic Tie-Breaker #16:** When top qualifying players are tied and the scorer confirms **Finish Game**, Segment #16 (`Tie-Breaker and Penalty Challenge`, 30s) is inserted automatically with a tie-breaker banner; once broken, confirming **Finish Game** computes the winner, locks final standings, and updates player statuses.
- [x] **Full Scoring History Control & Reopen (Authorized Manager):** Opening **History & Control** as `Super Admin` allows adding a manual adjustment, editing an existing score entry's delta/note, reverting a specific entry, deleting an entry (with destructive confirm), and reopening a finished session (with destructive confirm)—each logged in `auditRepo`; `Scorer` sees the history drawer in read-only inspection mode.
- [x] **Realtime BroadcastChannel Sync:** Updating buzz/score/segment/timer on `/scorer/game-11` immediately syncs across a second open browser tab listening to realtime updates.
- [x] **Responsive & Bilingual RTL + Touch Targets (`>= 56px`):** Verified in **EN (LTR)** and **AR (RTL)** across **Tablet Landscape (`1024×768`)**, **Phone Portrait (`390×844` & `360×780`)**, and **Desktop (`1440×900`)** with zero horizontal overflow, zero console errors, and all primary scorer controls `>= 56px` tall (`32/32` Playwright assertions passed + screenshots visually inspected).

---

## 7. Phase 5 Test Checklist — Venue Big Screen (`/screen/[gameId]`) & Broadcast Leaderboard (`/screen/leaderboard`)

- [x] **Broadcast Stage Layout & 10-Meter Legibility (`1920×1080` & `1366×768`):** Full-bleed crimson `SunburstStage` framed inside chasing gold perimeter `MarqueeBulbs` with swaying Ramadan `Lantern` corner accents, pulsing `LIVE` pill, giant dual-language EN + AR segment titles (`>= 52px`), `TimerRing` countdown, and 3 equal-height player broadcast panels with massive glossy-gold tabular `AnimatedNumber` scores (`>= 80px`) and floating `+`/`−` delta badges (`Plus`/`Minus` icons). Locked `100dvh` TV frame with zero vertical/horizontal scroll on desktop/TV and clean scrollable stack on phones (`320px`, `390px`).
- [x] **Two-Window Side-by-Side Realtime Sync (`/scorer/[gameId]` → `/screen/[gameId]` & `/screen/leaderboard`):** Verified simultaneous live sync across open windows via `/lib/realtime` (`storage`-ordered primary delivery + `BroadcastChannel` fallback with message-ID deduplication): Buzz highlight (`BUZZED FIRST!`), `+10` preset score + floating delta + Broadcast Lower-Third Event Ribbon, live `/screen/leaderboard` rank overtake (`#5 65 → #4 75` with `↑1`/`↓1` pills and Framer Motion `layout` animation), Timer Start/Pause countdown, and Segment Next dual EN/AR title transition.
- [x] **Grand Final Mode (`game-14` vs. Marwan Serry) & Winner Celebration:** Verified Scheduled `"Coming Up Next / VS Lineup"` slate → automatic live flip when started from Scorer Console → center **Golden Seat** boss layout for Marwan Serry (name only, zero real-person `<img>` photos) → baseline Framer Motion **Victory Stage Champion Celebration** when finished (`delightersEnabled: false` respected for Phase 10).
- [x] **Presenter Mode & Auto-Hiding Control Pill:** Verified **Presenter Mode** toggle (button + `F` shortcut + `Esc` exit) hides mouse cursor (`cursor-none`) and fades out the floating control pill after 2.2s inactivity and immediately restores both on mouse movement, with Feed Switcher, Leaderboard/Live jump, Realtime Sync dot, and always-reachable `EN | عربي` toggle (`>= 44px × 44px` touch targets).
- [x] **EN (LTR) & AR (RTL) Parity + Clean Diagnostics:** Verified `74/74` automated Playwright assertions (0 failures, 0 console errors, 0 uncaught page errors), `0` Impeccable detector violations across all new screen files, clean `tsc --noEmit` and `next build`, and visual screenshot inspection across EN/AR desktop, short laptop, mobile, live sync, rank overtake, Final Mode, and Victory Stage.

---

## 8. Phase 6 Test Checklist — Admin Studio (`/admin/*`) & Dual-Layer RBAC

- [x] **`/admin` Dashboard:** Live game cards (Quarter-Final B with active buzzer highlight, running scores, Big Screen & Scorer deep links), classic 4-color poker-chip key stat badges (Players, Games Done, Live Now, Pending Check-In), chronological recent results feed, and role-aware quick actions (`superAdmin`, `checkIn`, `content`).
- [x] **`/admin/players` Roster, CSV Import & Profile Drawer:** Search, status filter, sortable columns, inline status control, create/edit/delete with Zod validation and destructive confirm, RFC-4180 CSV bulk import with live row-by-row validation preview (3 valid + 1 invalid sample verified), and slide-over Profile Drawer with stats chips, assigned tables, and chronological `ScoreEvent` history.
- [x] **`/admin/managers` & Role Capability Matrix:** Create/edit/remove staff managers (`superAdmin`, `scorer`, `checkIn`, `content`), live sync to Quick Role Switcher via `user.updated`, 1-click **Test Role**, and authoritative Can-Do / Cannot-Do permission cards synced with `src/lib/repos/permissions.ts`.
- [x] **`/admin/bracket` & `/admin/games`:** Flexible bracket generator (configurable player count, game size 2–4 default 3, per-round advancement, Grand Final vs. Marwan Serry), live advancement topology preview, auto-generation of rounds & games, drag-and-drop + tap-to-assign player seeding, scorer/table/time/segment/Final editor modal, and interactive pan/zoom visual `BracketTrack` preview.
- [x] **`/admin/segments`, `/admin/content`, `/admin/sponsors`:** Full CRUD, Up/Down + drag reorder, category filtering, preset point chip editor, optional timer toggle, bilingual EN/AR copy, brand-safety text-only sponsor lockups (`Contact us` instead of prices), and enforced Copy-Edit Scope on `/admin/segments` for `content` role.
- [x] **`/admin/results` & `/admin/audit`:** Chronological results feed (newest/oldest toggle, game/round/player/scorer filters, UTF-8 BOM CSV export) and Super Admin–only Audit Log with entity/actor filters, Before/After structured diff modal, and UTF-8 BOM CSV export.
- [x] **`/admin/check-in` & `/admin/settings`:** Fast Gate Check-In console (Today's/Upcoming tables + All Players walk-up lookup, 1-tap emerald Check In / Absent / Reset) and Settings form (editable Ramadan 2027 placeholders, bracket defaults, language & Arabic-Indic numeral toggles, Phase 10 Delighters status, and confirmed Reset Demo Data).
- [x] **Dual-Layer RBAC, RTL, Responsive & Visual Verification:** `47/47` repo-level `PermissionDeniedError` assertions passed, `88/88` Playwright end-to-end assertions passed across all 12 admin routes in EN (LTR) & AR (RTL) at `1440px`, `768px`, `390px`, and `320px` (0 horizontal overflow, 0 console/page errors, `0` Impeccable detector findings), plus post-polish visual screenshot confirmation.
- [x] **Impeccable Audit, Layout & Hardening Pass (`/admin/*`):** Raised Admin Studio Audit Health Score from `16/20` to `20/20` (`39/39` Playwright A11y/hardening assertions + `10/10` AR RTL checks at `1024px`/`390px`, `0` console/page errors, `[]` from `impeccable detect` and `--scope layout`): associated all `<label htmlFor>` / `aria-label` pairs, enforced `>= 44px` touch targets across all visible buttons/selects/pills, added WCAG focus management + `Escape` focus restoration on Player Profile Drawer, added keyboard seat assignment + `blur`/`pointercancel`/`Escape` drag cleanup, built-in `DataTable` pagination (30/page default, verified on 600+ rows), Arabic/Persian Yeh/Kaf/Alef search normalization & Arabic-Indic preset entry, CSV formula-injection neutralization, compact `ScoreChip` formatting for `>= 10,000`, `@container` Live Table responsive layout + 12-col Bracket generator + structured 4-col `filterLayout="bar"` filter rows, and async `loadSeqRef`/double-submit guards across all 12 admin views.

---

## 9. Phase 7 Test Checklist — Public Spectator Suite & Contestant Portal

- [x] **`/final` Final Night Showcase:** Live countdown (placeholder date badge) or live/finished takeover, symmetrical 3-seat Marquee Spotlight (`Finalist #1` · Marwan Serry's name-only Golden Seat with geometric avatar · `Finalist #2`), dynamic Live Road to the Final (`IN PROGRESS` / `LIVE NOW` / `UPCOMING` / `GRAND FINAL`), 8 championship Final segments linking into `/segments?segment=<id>`, editable venue/prize placeholder strip, and direct launch to `/screen/game-14`.
- [x] **`/bracket` Interactive Bracket:** Full 4-round connected tree fitting cleanly at `1440px` without clipping Marwan's Grand Final (`BracketTrack` pan/zoom + mobile round-focus tabs on `< lg`), glowing gold-ringed live game nodes (`Quarter-Final B`), **Highlight Player Path** trace selector (`?player=<id>`), and click/keyboard **Game Detail Modal / Bottom Sheet** (`?game=<id>`) with live standings, segment-by-segment score breakdown, and Big Screen / Scorer deep links.
- [x] **`/leaderboard` Live Leaderboard:** Stage Top-3 Podium spotlight + Framer Motion `LayoutGroup` reordering Paper rows (`ScoreboardRow`), Round filter tabs, Status filter, Arabic-normalized search, live sync indicator, and verified cross-window realtime score & rank updates from `/scorer/game-11` (`85 → 95 → 85` on Undo without reload).
- [x] **`/schedule` Schedule (by Day & Round):** Editable `scheduleBlurb` & live `announcement` banners from `contentRepo`, **By Day** (`Night 1`–`Night 6`) and **By Round** (`Round 1`–`Grand Final`) grouping tabs, Status filter chips (`All`, `Live Now`, `Upcoming`, `Finished`), bilingual table/player search, and Big Screen / Bracket links.
- [x] **`/rules` Official Rules:** Live `contentRepo` rule articles with sticky desktop TOC & mobile jump pills, dynamic bracket progression derived from `settings.bracketConfig` & `roundRepo`, signed `+10`/`+5`/`−5` `ScoreChip` visual scoring explainer, Sudden-Death Tie-Breaker #16 callout, and Skill & Trivia (no gambling) fair play statement.
- [x] **`/segments` Segment Library & Detail Inspector:** All 16 original segments with category tabs & Arabic-normalized search, live per-segment table usage counts, and deep-linkable **Segment Detail Sheet (`?segment=seg-X`)** displaying both EN & AR titles, signed preset chips, 3-step stage flow, tournament tables featuring that segment, and Prev/Next browsing controls.
- [x] **`/sponsors` Partnership Deck:** Editable placeholder sponsor tier cards from `sponsorRepo` with text-only `logoText` lockups, zero fixed currency prices (`Contact us` `mailto:` links + 1-click Copy Contact Email toast), and responsive **Tier Deliverables Comparison Matrix** (scannable mobile cards on `< md`, full sticky-column table on `md+`).
- [x] **`/player` & `/player/history` Contestant Portal:** Role-enforced portal (`RoleGuard` blocks Scorer/staff; real `player` accounts lock strictly to `user.playerId` with no switcher; `superAdmin` gets persistent `?player=` Contestant Preview bar with quick presets for Semi-Finalist, LIVE Now, Upcoming, and Pre-Debut players), 4 poker-chip stats, featured Live/Next Game spotlight card with table/date/time/venue/opponents/segments, and expandable **Segment-by-Segment Match History** with individual timestamps, `+`/`−` deltas, kinds, notes, and running subtotals (smart-expanding the latest played match by default).
- [x] **Polish Loop, Bilingual RTL & Full Responsive Verification:** `422/422` automated Playwright assertions passed across all 9 routes in **EN (LTR)** & **AR (RTL)** across `1440px`, `1024px`, `768px`, `390px`, and `320px` (0 horizontal overflow, 0 real-person `<img>` tags, all inputs/selects `>= 16px`, all visible buttons `>= 44px`, 0 console/page errors, `[]` from `impeccable detect`, clean `tsc --noEmit` & `next build`), plus visual screenshot review across desktop, mobile, modals, and RTL.

---

## 10. Pitch Release (`v0.1-pitch`) Final Verification Checklist

- [x] **Full End-to-End Tournament Story (`49/49` Playwright assertions passed, `0` console/page errors):** Verified Create Players (manual + CSV bulk import with validation) → Generate Flexible Bracket (`18P` topology & `9P` full playthrough) → Scorer Role Isolation → Two-Window Start Live Sync → Buzz Sync → Preset `+10`/`+5`/`−5` → Custom `+15` + Note → Compensating Undo → Qualifying 1st-Place Tie auto-opening **Tie-Breaker #16** → Finish & **Automatic Advancement** into Semi-Final → Round status `'done'` sync → Semi-Final 2nd/3rd cutoff tie triggering **Tie-Breaker #16** → Top-2 **Automatic Advancement** into **Grand Final vs. Marwan Serry** → Grand Final live scoring & Victory Stage celebration → `/final`, `/admin/results`, and `/admin/audit` (including entity filtering).
- [x] **Reset Demo Data Verification:** Verified full restoration to factory 27-player Ramadan 2027 seed (`27` contestants + `player-marwan`, `4` rounds, `14` games + `game-demo`, `game-11` LIVE, `game-14` scheduled Final, restored editable settings) surviving full page reload with zero console errors.
- [x] **Final Visual Screenshot Review Against `DESIGN.md` (`20/20` screens inspected):** Visually reviewed `/`, `/final`, `/bracket`, `/leaderboard`, `/scorer/game-11` (`1024px` EN/AR & `390px`), `/screen/game-11` (`1920px` EN/AR), `/screen/game-14` (`1920px`), `/screen/leaderboard` (`1920px`), `/admin` (`1440px` EN/AR), `/admin/bracket`, `/admin/results`, `/player`, and `/sponsors` — `0` horizontal overflow, `0` real-person `<img>` tags, `0` console errors, `[]` from `impeccable detect`.
- [x] **Deployment & Pitch Documentation:** Added `vercel.json`, `netlify.toml`, `.env.example`, `README.md`, and `DEMO_SCRIPT.md` (5-minute pitch script + offline fallback plan); verified clean `tsc --noEmit` and production `next build`.




