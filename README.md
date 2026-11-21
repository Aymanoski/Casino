# Casino El Al3ab — Ramadan Tournament Platform (`v0.1-pitch`)

A full-featured, bilingual (**English LTR** & **Arabic RTL**) tournament operations platform and sponsor pitch prototype for a **Ramadan trivia & skill game-show tournament** inspired by **"Casino El Al3ab"**, culminating in a 3-seat **Grand Final where the last 2 finalists compete against Marwan Serry**.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Radix UI**, **Framer Motion**, and **Zod** — structured behind a clean async repository layer and swappable realtime broker so a production database, authentication provider, and multi-device WebSockets drop in later with **zero UI rewrites**.

> **Pitch Prototype Note:** No backend or database is connected yet. All data is seeded into `localStorage` via `/lib/repos` and `/lib/storage`, and live updates synchronize instantaneously across browser tabs/windows via `BroadcastChannel` (+ `storage` fallback). Dates (`Ramadan 2027`), venue, prizes, player counts, and sponsor packages are editable placeholders.

---

## Table of Contents

1. [Key Capabilities](#1-key-capabilities)
2. [How to Run Locally](#2-how-to-run-locally)
3. [Demo Accounts & Resetting Data](#3-demo-accounts--resetting-data)
4. [Project Structure & Routes](#4-project-structure--routes)
5. [Swapping Repositories for a Real Database](#5-swapping-repositories-for-a-real-database)
6. [Upgrading Realtime to Multi-Device Venue Sync](#6-upgrading-realtime-to-multi-device-venue-sync)
7. [Deployment (Vercel & Netlify)](#7-deployment-vercel--netlify)
8. [Brand Safety & Scope Guardrails](#8-brand-safety--scope-guardrails)

---

## 1. Key Capabilities

- **Sponsor Pitch Landing (`/`) & Final Night Showcase (`/final`)**: Crimson sunburst Stage & warm Paper visual system, live countdown, Marwan Serry's **Golden Seat** (name only, zero real-person photos), an **embedded interactive Live Demo** (real repos + `BroadcastChannel` on an isolated `game-demo` table), bracket preview, 16 original segments, and editable placeholder sponsor tiers.
- **Zero-Mistake Live Scorer Console (`/scorer`, `/scorer/[matchId]`)**: Designed for tablets in landscape and one-handed phone operation (`56px+` touch targets). Adapts to 2 players (all group/knockout 1v1 matches) or 3 participants (Grand Final vs. Marwan Serry). Supports manual **"Buzzed First"**, exact **`+1`**, **`−1`**, **Yellow card (`−1`)**, and **Red card (`−2`)** controls with optional note, card-shaped SVG counters, **Mark Absent** (immediate 1v1 walkover, both-absent `void`, Final admin prompt) with Super Admin reversal & Impact Preview, role-gated **Contact** dialog (`contact.viewed` audited), compensating **Undo**, segment countdown timer with final-5-second warning, keyboard shortcuts (`1`/`2`/`3`, `B`, `+`/`-`, `Y`, `R`, `Space`, `Ctrl+Z`), and automatic **Sudden-Death Tie-Breaker (#16)** on ties.
- **Venue Big Screen (`/screen/[gameId]`, `/screen/leaderboard`)**: Full-bleed 10-meter-legible broadcast frame (up to 4K) with chasing perimeter marquee bulbs, dual EN+AR segment titles, real-time buzz highlights, animated score counters + floating deltas, **Grand Final Boss symmetry** (Marwan Serry dead-center), **Victory Stage** winner celebration, **Presenter Mode (`F`)** with auto-hiding controls, and an auto-cycling 27-player broadcast leaderboard.
- **Admin Studio (`/admin/*`) & Dual-Layer RBAC**: Complete tournament management across 12 studio screens — Players (CRUD + RFC-4180 CSV bulk import with row validation + Profile Drawer), Flexible Bracket Builder (configurable player count, table size, advancement rules, drag/tap seeding), Games & Scorers, 16-Segment Library, Gate Check-In, Chronological Results Feed (newest/oldest + filters + CSV export), Super Admin Audit Log (before/after diffs + CSV export), Managers & Role Matrix, Content/Rules, Sponsors, and editable Settings + **Reset Demo Data**.
- **Public Spectator Suite & Contestant Portal**: Interactive `/bracket` (with Highlight Player Path & segment breakdown modal), live `/leaderboard`, `/schedule`, `/segments` inspector, `/rules`, `/sponsors` deliverables matrix, and `/player` + `/player/history`.
- **First-Class Bilingual EN (LTR) / AR (RTL)**: Instant language toggle in every header/sidebar/Big Screen pill plus `?lang=ar` / `?lang=en` deep-link support, mirrored layouts & sticker shadows, and Western digits by default (with an optional Arabic-Indic numeral setting).

---

## 2. How to Run Locally

### Prerequisites

- **Node.js** `20.x` or newer (tested on Node `20+` / `24`)
- **npm** `10.x` or newer

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (http://localhost:3000)
npm run dev

# 3. Type-check the entire project (strict TypeScript)
npm run typecheck

# 4. Create an optimized production build
npm run build

# 5. Run the production build locally (also recommended for offline pitch backup)
npm run start
```

> **Windows / OneDrive tip:** If running inside a OneDrive-synced folder while `npm run dev` is already open, delete `.next` before running `npm run build` (or run `NEXT_DIST_DIR=.next-prod npm run build` for an isolated build) to avoid OneDrive `readlink` cache locks.

---

## 3. Demo Accounts & Resetting Data

Mock auth is pre-seeded in `src/lib/seed/index.ts` and defaults to **Super Admin** on first visit so presenters can explore immediately. Switch roles anytime from **`/login`**, the top-right **Role Switcher** menu on public pages, or the role dropdown inside Admin/Scorer headers.

| Role | Demo Account(s) | Email | Primary Workspace |
|---|---|---|---|
| **Super Admin** | `Admin` | `admin@casinoelal3ab.com` | `/admin`, `/scorer`, `/screen/*`, `/player` (preview mode) |
| **Table Scorer** | `Scorer 1` – `Scorer 4` | `scorer1@casinoelal3ab.com` … `scorer4@…` | `/scorer` (strictly scoped to assigned tables) |
| **Check-In Staff** | `Gate Staff` | `checkin@casinoelal3ab.com` | `/admin/check-in` (attendance statuses only) |
| **Content Manager** | `Content Editor` | `content@casinoelal3ab.com` | `/admin/content`, `/admin/sponsors`, `/admin/segments` (copy-only) |
| **Contestant** | `Omar Hassan`, `Karim Nabil`, `Salma Reda` | `omar.hassan@players.casino`, etc. | `/player`, `/player/history` (own profile only) |
| **Public Visitor** | Sign out via Role Switcher | — | Public spectator pages & `/screen/*` only |

### Resetting to the Polished Demo State

Click **Reset Demo Data** in **`/admin/settings`** (or the bottom of the Admin sidebar) and confirm. This wipes all mutations and restores the curated Ramadan 2027 demo story:

- **27 seeded players** + **Marwan Serry** (`player-marwan`, host seat)
- **Round 1**: Tables 1–8 finished with realistic score history, Table 9 scheduled
- **Round 2**: Quarter-Final A finished, **Quarter-Final B (`game-11`) LIVE** at Segment 4/6 with active buzz & live scores, Quarter-Final C scheduled
- **Semi-Final (`game-13`)** & **Grand Final vs. Marwan Serry (`game-14`)** scheduled
- **Exhibition Demo Table (`game-demo`)** live and isolated for the `/` landing page

---

## 4. Project Structure & Routes

```text
src/
├── app/
│   ├── (public)/               # Public spectator & pitch routes
│   │   ├── page.tsx            # /           Pitch & landing page + embedded live demo
│   │   ├── final/              # /final      Final Night showcase vs. Marwan Serry
│   │   ├── bracket/            # /bracket    Interactive 27-player bracket & match modal
│   │   ├── leaderboard/        # /leaderboard Live animated tournament standings
│   │   ├── schedule/           # /schedule   Matches grouped by night or round
│   │   ├── segments/           # /segments   16-segment library & detail inspector
│   │   ├── rules/              # /rules      Official format, scoring & tie-breaker rules
│   │   ├── sponsors/           # /sponsors   Editable placeholder sponsor deck & matrix
│   │   └── styleguide/         # /styleguide Interactive Stage & Paper design system gallery
│   ├── login/                  # /login      Mock auth role picker
│   ├── player/                 # /player & /player/history   Contestant portal
│   ├── scorer/                 # /scorer & /scorer/[matchId]  Scorer dashboard & live console
│   ├── screen/                 # /screen/[gameId] & /screen/leaderboard  Venue Big Screens
│   ├── admin/                  # /admin/*    Admin Studio
│   │   ├── page.tsx            # Overview dashboard
│   │   ├── players/            # Roster CRUD, CSV bulk import & profile drawer
│   │   ├── check-in/           # Venue arrival gate check-in & player contacts
│   │   ├── groups/             # Group draw, swaps & standings (720-player scale)
│   │   ├── bracket/            # Knockout bracket canvas & BYE allocation
│   │   ├── matches/            # Tables, judges, conflict-free auto-schedule & Final
│   │   ├── segments/           # Segment library, optional timers & reorder
│   │   ├── consistency/        # 9-invariant engine verifier & repair by recomputation
│   │   ├── results/            # Chronological Results Feed + CSV export
│   │   ├── audit/              # Super Admin Audit Log (before/after diffs) + CSV
│   │   ├── managers/           # Staff manager CRUD & capability matrix
│   │   ├── content/            # Announcements, rules & schedule blurbs
│   │   ├── sponsors/           # Placeholder sponsor tiers CRUD
│   │   └── settings/           # Editable event placeholders & Reset Demo Data
│   ├── error.tsx & not-found.tsx
│   ├── globals.css             # DESIGN.md Stage & Paper CSS tokens & utilities
│   └── layout.tsx              # Fonts (Lilita One, Bebas Neue, Inter, Lalezar, Cairo)
├── components/
│   ├── ui/                     # Restyled Radix/shadcn primitives (Button, Dialog, Table, Toast…)
│   ├── brand/                  # Game-show motifs (SunburstStage, MarqueeBulbs, PlayerPanel, ScoreChip, TimerRing, BracketNode…)
│   ├── layout/                 # PublicHeader, PublicFooter, StudioSidebarShell, RoleGuard
│   ├── landing/                # 7 modular landing page sections
│   ├── public/                 # Spectator views
│   ├── scorer/                 # ScorerDashboardView, ScorerConsoleView, SessionHistoryDrawer
│   ├── screen/                 # BroadcastFrame, BigScreenGameView, BigScreenLeaderboardView, PresenterControlPill
│   ├── admin/                  # All 12 Admin Studio views + GameEditorDialog + CSV utils
│   └── player/                 # Contestant portal views
└── lib/
    ├── schemas/index.ts        # Zod schemas & inferred TS types (single source of truth)
    ├── repos/                  # Async repositories (ONLY data boundary used by UI)
    │   ├── playerRepo.ts
    │   ├── userRepo.ts
    │   ├── roundRepo.ts
    │   ├── segmentRepo.ts
    │   ├── gameRepo.ts         # Bracket generation, start, timer, tie-breaker, finish + auto-advance, reopen
    │   ├── scoreRepo.ts        # Immutable ScoreEvent ledger, derived leaderboard, buzz, undo/edit/delete
    │   ├── auditRepo.ts        # Tamper-evident AuditEntry log
    │   ├── sponsorRepo.ts
    │   ├── contentRepo.ts
    │   ├── settingsRepo.ts
    │   └── permissions.ts      # Dual-layer RBAC assertions & capability catalog
    ├── storage/index.ts        # Versioned localStorage adapter with raw-string memo cache
    ├── seed/index.ts           # Deterministic 27-player + Marwan Serry demo seed
    ├── realtime/index.ts       # Pluggable RealtimeTransport broker (BroadcastChannel default)
    ├── auth/index.tsx          # Mock AuthProvider + route/action guards
    ├── i18n/index.tsx          # EN/AR dictionary provider with RTL dir management
    └── feedback/index.ts       # Phase 10 sound & haptics no-op hook stubs
```

---

## 5. Swapping Repositories for a Real Database

**Golden architectural rule:** Zero UI pages or components import mock seed data or touch `localStorage` directly. Every read and write flows through async functions in `src/lib/repos/*` typed by `src/lib/schemas/index.ts`.

### Recommended Production Stack

PostgreSQL via **Supabase** or **Prisma / Drizzle ORM**, paired with Next.js **Route Handlers** (`/app/api/*`) or **Server Actions** and **Auth.js / Supabase Auth**.

### Step-by-Step Swap Checklist

1. **Provision database tables** matching `src/lib/schemas/index.ts`:
   - `players`, `users`, `rounds`, `segments`, `games`, `score_events` (append-only ledger; leaderboard & `player.stats` derive from this table), `buzz_events`, `audit_entries`, `sponsors`, `content_items`, and `settings`.
   - Keep `player-marwan` (`is_host = true`) protected from deletion and excluded from standard contestant queries unless `includeHost: true`.
2. **Swap `src/lib/repos/*` implementations** (keep the exact exported method signatures and return types so zero UI components change):
   - Either call thin `/api/...` route handlers from the client repo modules, or convert repo writes into Next.js Server Actions validated with the existing Zod schemas in `src/lib/schemas/index.ts`.
   - Wrap multi-step domain operations in SQL transactions:
     - `scoreRepo.applyScore` / `undoScoreEventById` / `editScoreEvent` / `deleteScoreEvent` → mutate `score_events` + insert `audit_entries` + publish realtime event.
     - `gameRepo.finishGame` → compute totals, check qualifying tie across `round.advancePerGame`, auto-append `seg-16` or finalize winner + advance into next-round scheduled game + sync `rounds.status` + update `players.status` + insert `audit_entries`.
     - `gameRepo.generateBracket` → replace non-demo rounds/games + sync `settings.bracketConfig` + insert `audit_entries`.
3. **Move RBAC & Auth to the server**:
   - Replace `src/lib/auth/index.tsx` mock `localStorage` session with **Auth.js / NextAuth** or **Supabase Auth**.
   - Enforce `canAccessPath` in Next.js `middleware.ts` and mirror `assertRepoPermission` (`src/lib/repos/permissions.ts`) inside every API handler / Server Action + PostgreSQL Row-Level Security (RLS) policies.
   - Disable or guard `settingsRepo.resetDemoData()` behind a non-production flag.
4. **Remove `src/lib/storage/index.ts` and `src/lib/seed/index.ts`** from runtime paths (repurpose `createSeedSnapshot()` as a one-time DB seed script).

See [`TODO.md`](./TODO.md) for the complete method-by-method SQL mapping across all 11 repository files.

---

## 6. Upgrading Realtime to Multi-Device Venue Sync

During the single-browser pitch, `src/lib/realtime/index.ts` uses `BrowserRealtimeTransport` (`BroadcastChannel` + strictly ordered `window.storage` fallback with message-ID deduplication) so actions in a Scorer Console tab immediately animate on an open Big Screen or Leaderboard tab.

For a **live multi-device venue** (e.g., 4 Scorer iPads → Main Stage LED Wall PC → Spectator mobile phones), every screen and repository already talks exclusively to the `realtime` singleton (`RealtimeBroker`) implementing the `RealtimeTransport` interface:

```ts
export interface RealtimeTransport {
  readonly name: string;
  connect: () => Promise<void> | void;
  disconnect: () => Promise<void> | void;
  getStatus: () => RealtimeConnectionStatus;
  onStatusChange: (listener: RealtimeStatusListener) => () => void;
  publish: <T = Record<string, unknown>>(event: RealtimeEventName, payload: T) => void;
  subscribe: (event: RealtimeEventName | '*', listener: RealtimeListener) => () => void;
}
```

### Upgrade Steps (Zero UI Component Edits)

1. **Create a hosted driver** in `src/lib/realtime/` (for example `SupabaseRealtimeTransport`, `AblyRealtimeTransport`, `PusherRealtimeTransport`, or a custom `WebSocketRealtimeTransport`) implementing `RealtimeTransport`:
   - Map `publish(event, payload)` to channel broadcast (or let server-side DB writes emit broadcasts directly on commit).
   - Map incoming socket messages to local listeners registered via `subscribe(event | '*', listener)`.
   - Forward connection lifecycle states (`connecting` → `connected` → `reconnecting` → `disconnected`) to `onStatusChange` so the Big Screen's `SYNC` status dot reflects live network health automatically.
2. **Register the driver** inside `createRealtimeTransport(config)` in `src/lib/realtime/index.ts` (selecting via `process.env.NEXT_PUBLIC_REALTIME_DRIVER`), or hot-swap at runtime via `setRealtimeTransport(adapter)` — `RealtimeBroker` automatically migrates all active UI subscriptions.
3. **Named Events Already Emitted**:
   - `score.changed`, `buzz.recorded`, `buzz.cleared`, `segment.changed`, `timer.updated`, `game.started`, `game.finished`, `final.revealed`, `player.updated`, `user.updated`, `segment.updated`, `content.updated`, `sponsor.updated`, `bracket.updated`, `settings.updated`, `data.reset`.

---

## 7. Deployment (Vercel & Netlify)

This release (`v0.1-pitch`) is **zero-config ready** for both **Vercel** and **Netlify** — no environment variables or external services are required to deploy the pitch prototype.

### Deploy to Vercel (Recommended)

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import the repository in [Vercel](https://vercel.com/new):
   - **Framework Preset:** `Next.js` (auto-detected via `vercel.json`)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next` (default)
   - **Environment Variables:** None required for prototype mode (see [`.env.example`](./.env.example) for future production vars).
3. Click **Deploy**. Every route (28 static + 2 dynamic App Router routes) builds cleanly with security headers configured in [`vercel.json`](./vercel.json).

### Deploy to Netlify

1. Push the repository and select **Add new site → Import an existing project** in [Netlify](https://app.netlify.com/).
2. Netlify reads [`netlify.toml`](./netlify.toml) automatically (`npm run build`, `.next`, `@netlify/plugin-nextjs`, and security headers).
3. **Environment Variables:** None required for prototype mode. Click **Deploy site**.

### Environment Notes

- Prototype data is stored **per browser** in `localStorage` (`casino_el_al3ab_db_v1`). Each visitor or demo laptop starts fresh from the curated 27-player Ramadan 2027 seed and can reset anytime via **Admin → Settings → Reset Demo Data**.
- **Google Fonts** (`Lilita One`, `Bebas Neue`, `Inter`, `Lalezar`, `Cairo`) are optimized at build time by `next/font/google` and self-hosted in the Next.js bundle — meaning fonts render reliably even if the client blocks external font CDNs during a pitch.

---

## 8. Brand Safety & Scope Guardrails

- **No photos of real people:** Marwan Serry appears by **name only** (`Marwan Serry` / `مروان سري`) with a generated geometric crown emblem — zero photos or copyrighted show logos/artwork.
- **Skill & trivia positioning:** Zero real-money gambling terminology, slot-machine imagery, or pricing claims (sponsor tiers display editable placeholder benefits and `"Contact us"` links).
- **Registration quiz:** Intentionally out of scope for this phase (no dead links or placeholders).
- **Phase 10 Delighters:** Kept off (`delightersEnabled: false`) for this client base-review milestone, with hook points (`AnimatedNumber`, `ChipBadge`, `PlayerPanel`, `/lib/feedback`, and named realtime events) pre-wired for activation in Phase 10.
