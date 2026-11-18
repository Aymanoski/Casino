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
  - `gameRepo.finishGame(id, actorUserId)` → DB transaction computing totals, checking for Qualifying Ties across `round.advancePerGame`, marking non-advancing players `'eliminated'`, and advancing winners
- [ ] **`src/lib/repos/scoreRepo.ts`**:
  - `scoreRepo.list(filters)` / `listByGame` / `listByPlayer` → `SELECT * FROM score_events WHERE ... ORDER BY created_at DESC`
  - `scoreRepo.listBuzzByGame(gameId)` → `SELECT * FROM buzz_events WHERE game_id = $1 ORDER BY created_at DESC`
  - `scoreRepo.getGameTotals(gameId)` → `SELECT player_id, SUM(delta) FROM score_events WHERE game_id = $1 GROUP BY player_id`
  - `scoreRepo.getLeaderboard(options)` → aggregated SQL query joining `players`, `score_events`, and `games`
  - `scoreRepo.applyScore(input)` → transactional `INSERT INTO score_events` + `audit_entries` + realtime publish (`score.changed`)
  - `scoreRepo.undoLastScore(gameId, byUserId)` → transactional compensating `INSERT INTO score_events (kind = 'undo', delta = -target.delta)` + marks `undone_by_event_id` on target event
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
- `src/components/layout/StudioSidebarShell.tsx` → calls `settingsRepo.resetDemoData()`
- `src/components/layout/RouteShellPlaceholder.tsx` → calls `playerRepo.list()`, `segmentRepo.list()`, `roundRepo.list()`, `gameRepo.list()`, `scoreRepo.list()`, `scoreRepo.applyScore()`, `auditRepo.list()`, `settingsRepo.get()`, `settingsRepo.resetDemoData()`

---

## 3. Realtime Synchronization (`src/lib/realtime/index.ts` → Hosted WebSockets)

- [ ] Replace `BrowserRealtimeTransport` (`BroadcastChannel` + `localStorage` fallback) with a hosted WebSocket/Realtime transport implementing `RealtimeTransport` (`publish`, `subscribe`) so multi-device venue setups (Scorer iPad → Big Screen projector PC) sync over the network.

---

## 4. Authentication & Server-Side Route Guards (`src/lib/auth/index.tsx`)

- [ ] Replace `AuthProvider` mock `localStorage` session and `/login` demo account picker with NextAuth / Auth.js or Supabase Auth.
- [ ] Enforce `canAccessPath` role permissions in Next.js server middleware and server actions.
