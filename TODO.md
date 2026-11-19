# TODO.md — Production Readiness & Database / Auth Swap Checklist

> This document tracks every mock adapter, repository module, and UI consumer that will be swapped when moving from the `localStorage` pitch prototype to a production backend, database, and realtime infrastructure.

---

## 1. Storage & Repository Modules (`src/lib/repos/*` → Database / ORM)

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
  - `roundRepo.update(id, patch, actorUserId)` → `UPDATE rounds SET ... WHERE id = $1`
- [ ] **`src/lib/repos/segmentRepo.ts`**:
  - `segmentRepo.list()` → `SELECT * FROM segments ORDER BY "order" ASC`
  - `segmentRepo.get(id)` → `SELECT * FROM segments WHERE id = $1`
  - `segmentRepo.create(input, actorUserId)` → `INSERT INTO segments ...`
  - `segmentRepo.update(id, patch, actorUserId)` → `UPDATE segments SET ... WHERE id = $1`
  - `segmentRepo.remove(id, actorUserId)` → `DELETE FROM segments WHERE id = $1`
- [ ] **`src/lib/repos/gameRepo.ts`**:
  - `gameRepo.list({ roundId, scorerUserId, status })` → filtered `SELECT * FROM games`
  - `gameRepo.get(id)` / `gameRepo.getByRound` / `gameRepo.getByScorer` / `gameRepo.getLiveGames` → indexed queries on `games`
  - `gameRepo.create(input, actorUserId)` / `gameRepo.update(id, patch, actorUserId)` → `INSERT` / `UPDATE games`
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
  - `sponsorRepo.list` / `get` / `create` / `update` / `remove` → CRUD on `sponsors` table
- [ ] **`src/lib/repos/contentRepo.ts`**:
  - `contentRepo.list` / `getByKey` / `create` / `update` / `remove` → CRUD on `content_items` table
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
- `src/components/layout/RouteShellPlaceholder.tsx` → calls `playerRepo.list()`, `segmentRepo.list()`, `roundRepo.list()`, `gameRepo.list()`, `scoreRepo.list()`, `scoreRepo.applyScore()`, `auditRepo.list()`, `settingsRepo.get()`, `settingsRepo.resetDemoData()`
- `src/app/(public)/page.tsx` & `src/components/landing/*` → calls `settingsRepo.get()`, `playerRepo.list()` / `playerRepo.get()`, `gameRepo.list()` / `gameRepo.get()` / `gameRepo.changeSegment()` / `gameRepo.updateTimer()` / `gameRepo.resetDemoGame()`, `roundRepo.list()`, `segmentRepo.list()`, `scoreRepo.list()` / `scoreRepo.getGameTotals()` / `scoreRepo.applyScore()` / `scoreRepo.undoLastScore()` / `scoreRepo.recordBuzz()` / `scoreRepo.clearBuzz()`, `sponsorRepo.list()`
- `src/app/(public)/styleguide/page.tsx` → calls `playerRepo.list()`, `segmentRepo.list()`, `settingsRepo.get()`

---

## 3. Realtime Synchronization (`src/lib/realtime/index.ts` → Hosted WebSockets)

- [ ] Replace `BrowserRealtimeTransport` (`BroadcastChannel` + `localStorage` fallback) with a hosted WebSocket/Realtime transport implementing `RealtimeTransport` (`publish`, `subscribe`) so multi-device venue setups (Scorer iPad → Big Screen projector PC) sync over the network.

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

