# Casino El Al3ab — Ramadan Tournament Platform (`v0.1.2-quiz-demo`)

A full-featured, bilingual (**English LTR** & **Arabic RTL**) tournament operations platform, **Registration Quiz Demo module**, and sponsor pitch prototype for a **Ramadan trivia & skill game-show tournament** inspired by **"Casino El Al3ab"**, screening applicants through a 20-question × 10-second qualification quiz before running **720-player Groups (1v1 Round-Robin) → Single-Elimination Knockouts (with automatic BYEs) → a 1v1v1 Grand Final where the last 2 finalists compete against Marwan Serry**.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Radix UI**, **Framer Motion**, **Zod**, and **IndexedDB (`idb`)** — powered by a pure event-sourced engine (`/lib/engine`) and atomic command pipeline (`/lib/commands`) behind swappable async repositories (`/lib/repos`) and realtime transport (`/lib/realtime`), so a production PostgreSQL/Supabase backend, auth provider, and multi-device WebSockets drop in later with **zero UI rewrites**.

> **Pitch Prototype & Quiz Demo Note:** No backend or database is connected yet. All tournament and quiz data is stored locally in **IndexedDB** (`casino_el_al3ab_idb_v1`, schema v2 with 20 indexed object stores handling 1,200+ quiz applicants, 1,000+ matches, and 100,000+ events smoothly), and live updates synchronize across browser tabs via `BroadcastChannel` (+ `storage` fallback) strictly **after** commit. On quiz screens, a persistent **`DEMO MODE`** pill states clearly that timer deadlines and mock OTP (`123456`) run locally in the browser here and are strictly server-enforced in production. Dates (`Ramadan 2027`), venue, prizes, player counts, and sponsor packages are editable placeholders.

---

## Table of Contents

1. [Key Capabilities](#1-key-capabilities)
2. [How to Run Locally](#2-how-to-run-locally)
3. [Demo Accounts, Presets & Resetting Data](#3-demo-accounts-presets--resetting-data)
4. [Project Structure & Routes](#4-project-structure--routes)
5. [Event-Sourced Architecture & Data Integrity](#5-event-sourced-architecture--data-integrity)
6. [Swapping Storage & Commands for a Real Database](#6-swapping-storage--commands-for-a-real-database)
7. [Upgrading Realtime to Multi-Device Venue Sync](#7-upgrading-realtime-to-multi-device-venue-sync)
8. [Deployment (Vercel & Netlify)](#8-deployment-vercel--netlify)
9. [Brand Safety & Scope Guardrails](#9-brand-safety--scope-guardrails)

---

## 1. Key Capabilities

- **Registration Quiz Module (Frontend-Only Demo — `/quiz*` & `/admin/quiz*`)**:
  - **Applicant Flow (Phone-First, Arabic-First RTL Default with EN Toggle, Persistent `DEMO MODE` Pill):** `/quiz` landing (3 steps + live window countdown), `/quiz/register` (name, phone, email, configurable WhatsApp/SMS/Email mock OTP showing test code `123456`, consent, one-attempt guard), `/quiz/rules` (plain rules + 3-2-1 countdown), `/quiz/play` (Stage sunburst, huge circular 10s countdown `10 → 0` with final-3s urgency pulse/white border, 4 large thumb-friendly answer buttons + desktop `1`–`4` keys, neutral confirm without revealing answers, refresh-safe stored-deadline resume, real client-side `visibilitychange` / refresh / `copy` signals), `/quiz/result` (score + total time + window-aware rank disclosure), and `/quiz/how-it-works` (pitch explainer contrasting Browser Demo vs. Production Server Architecture).
  - **Admin Quiz Studio (Paper Theme):** `/admin/quiz` dashboard (KPIs, completion rate, average score, score histogram with cutoff line), `/admin/quiz/questions` (Super Admin + **Content Manager** CRUD, CSV import with Zod validation/preview, 64 original bilingual `draft` questions needing human review, `"Needs human review"` filter, shuffled applicant preview), `/admin/quiz/settings` (adjustable rules, cutoff synced with `Settings.tournament.totalPlayers` = 720, window presets, verification wording, rank visibility toggle), and `/admin/quiz/results` (virtualized 1,200+ applicant table, visible cutoff divider + Jump-to-Cutoff, honest "Client-side signals" badges, per-question timeline drawer, audited Super Admin reset, CSV export, and idempotent **"Send qualified applicants to the tournament"** handoff with Impact Preview).
- **720-Player Group Stage + Single-Elimination Knockouts + 1v1v1 Marwan Final**:
  - Configurable in `/admin/settings` (`totalPlayers: 720`, `groupSize: 3`, `advancePerGroup: 1`, `pointsPerGroupWin: 3`, `tablesCount: 12`, `slotMinutes: 30`, `includeFinalWithMarwan: true`) with one-click **12**, **48**, and **720** demo presets.
  - **Groups (`/groups`, `/admin/groups`)**: 240 virtualized groups of 3 playing 1v1 round-robin (`n(n-1)/2` matches/group), 3 group points per win, draws forbidden (`needsTieBreak`), full tie-break hierarchy (group points → head-to-head → net match-point diff → fewer red/yellow cards → auto-spawned deadlock tie-break match).
  - **Knockouts (`/bracket`, `/admin/bracket`)**: 256-slot single-elimination bracket with 16 visible **BYE** nodes awarded to the best group winners, interactive pan/zoom `KnockoutCanvas` with **Region Focus** (`Final 16 → Marwan`, `Quarter 1–4`, `Full`), clickable corner **Minimap**, viewport culling, searchable 720-player path trace, and Jump-to-Match `#`.
  - **Conflict-Free Auto-Scheduler (`/admin/matches`)**: Assigns table numbers (`1..12`), time slots, and judges with zero player/table/judge collisions, live Conflict Health Banner, manual overrides, and 1-click **Find Next Free Slot**.
- **Zero-Mistake Live Scorer Console v2 (`/scorer`, `/scorer/[matchId]`)**:
  - Adapts to **2 players** (all group & knockout 1v1 matches) or **3 participants** (the Grand Final with two finalists + Marwan Serry). Hybrid desktop/tablet direct buttons + one-handed phone Sticky Thumb Dock (`>= 56px` primary touch targets).
  - Exact 4 scoring controls per player: **`+1`**, **`−1`**, **Yellow card (`−1`)**, and **Red card (`−2`)** with optional note, original SVG card counters, manual **"Buzzed First"**, segment countdown timer, compensating **Undo**, and automatic **Tie-Breaker #16** on ties.
  - **Mark Absent**: Immediate 1v1 **Walkover** with automatic standings/bracket propagation, **`void`** + inline Super Admin decision panel if both absent, non-auto-ending Final absence prompt for Super Admin, and **Reverse Absence** with **Cascade Impact Preview**.
  - **Role-Gated Contact Dialog**: Tap the Contact icon beside any seated player (available to assigned judge, check-in staff, and Super Admin) to call (`tel:`), WhatsApp, or copy contact details — every view logged as `contact.viewed` in the audit log.
- **Contestant Portal, Segment Privacy & Shared Avatars (`/player`, `/player/history`)**:
  - **Strict segment secrecy**: Players and public visitors never see segment names, counts, order, or match-specific rules for upcoming or live matches (enforced in `matchRepo` & `scoreRepo` at the repository/permission layer).
  - **Upcoming Match Spotlight**: Shows opponent card, date & call time, round/group, prominent **Table Number (`TABLE #N`)**, and the **"Need help finding your table?" Judge Help Sticker Card** (judge name + 1-tap Call / WhatsApp, audited).
  - **24 Original 3D Avatars + Photo Crop Studio**: Deterministic 24-option 3D-lit SVG avatar library (`avatar-01`..`avatar-24`) plus interactive camera/gallery upload, drag/zoom square crop, and auto-compression (`<= 300KB`) rendered uniformly via one shared `PlayerAvatar` across the entire platform.
- **Venue Big Screen (`/screen/[gameId]`, `/screen/leaderboard`)**:
  - Full-bleed 10-meter-legible broadcast frame (up to 4K) with chasing perimeter marquee bulbs, dual EN+AR segment titles, real-time buzz highlights, animated scores + SVG card badges, **Grand Final Boss symmetry** (Marwan Serry dead-center, name only), **Victory Stage**, **Presenter Mode (`F`)**, and scalable auto-cycling broadcast leaderboard (`Page X / N` at 720-player scale).
- **Admin Studio (`/admin/*`) & Consistency Check**:
  - Complete operations suite across 14 routes: Overview, Players (720-row virtualized DataTable, CSV bulk import, Admin Avatar Studio, Profile Drawer), Gate Check-In (paginated Tables & Roster + Contact dialogs), Groups Draw & Standings, Knockout Bracket Canvas, Matches & Scheduler, 16-Segment Library, **Consistency Check (`/admin/consistency`)** verifying all 9 engine invariants with 1-click **Repair by recomputation**, Chronological Results Feed (+ CSV export), Super Admin Audit Log (including automatic cascade entries + before/after diffs + CSV export), Managers & Role Matrix, Content/Rules, Sponsors, and Settings.
- **First-Class Bilingual EN (LTR) / AR (RTL)**: Instant language toggle everywhere + `?lang=ar` / `?lang=en` deep links, full RTL mirroring, and optional Arabic-Indic numeral setting.

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

# 3. Run TypeScript type-check + AST derived-write & architecture guard
npm run lint

# 4. Run full Vitest engine, command, cascade, privacy & 12/48/720 E2E test suite
npm test

# 5. Create an optimized production build
npm run build

# 6. Run the production build locally (also works 100% offline for pitch backup)
npm run start
```

> **Windows / OneDrive tip:** If running inside a OneDrive-synced folder while `npm run dev` is already open, stop `npm run dev` and delete `.next` before running `npm run build` (or run `NEXT_DIST_DIR=.next-prod npm run build`) to avoid OneDrive `readlink` cache locks.

---

## 3. Demo Accounts, Presets & Resetting Data

Mock auth is pre-seeded in `src/lib/seed/index.ts` and defaults to **Super Admin** on first visit so presenters can explore immediately. Switch roles anytime from **`/login`** or the top-right **Role Switcher** menu.

| Role | Demo Account(s) | Email | Primary Workspace |
|---|---|---|---|
| **Super Admin** | `Admin` | `admin@casinoelal3ab.com` | `/admin`, `/admin/consistency`, `/scorer`, `/screen/*`, `/player` (preview mode) |
| **Judge / Scorer** | `Scorer 1` – `Scorer 4` | `scorer1@casinoelal3ab.com` … `scorer4@…` | `/scorer` (assigned tables + assigned player contacts only) |
| **Check-In Staff** | `Gate Staff` | `checkin@casinoelal3ab.com` | `/admin/check-in` (gate check-in + player contacts) |
| **Content Manager** | `Content Editor` | `content@casinoelal3ab.com` | `/admin/content`, `/admin/sponsors`, `/admin/segments` (copy-only), `/admin/quiz/questions` (question bank only) |
| **Contestant** | `Omar Hassan`, `Karim Nabil`, `Salma Reda` | `omar.hassan@players.casino`, etc. | `/player`, `/player/history` (own profile, avatar, table # & judge help card only) |
| **Public Visitor** | Sign out via Role Switcher | — | Public spectator pages & `/screen/*` only |

### Demo Presets & Resetting to Factory State

Open **`/admin/settings`** (or **`/admin/bracket`**) to load any procedural preset or reset demo data:

- **720 Players (Default):** 240 groups of 3, 720 1v1 group matches + 256-slot knockout bracket (16 BYE nodes) + 1v1v1 Grand Final vs. Marwan Serry (`975` tournament matches + `game-demo`), conflict-free scheduled across 12 tables, first 12 groups completed (including a 3-way cycle and a walkover), 3 group matches currently **LIVE**, all verified at **0 invariant violations**.
- **48 Players:** 16 groups of 3 (`advancePerGroup: 2` → 32-slot knockout → Grand Final vs. Marwan).
- **12 Players:** 4 groups of 3 (`advancePerGroup: 1` → Semi-Finals → Grand Final vs. Marwan) — ideal for rapid full-tournament demonstrations.

---

## 4. Project Structure & Routes

```text
src/
├── app/
│   ├── (public)/               # Public spectator & pitch routes
│   │   ├── page.tsx            # /            Pitch landing + embedded live demo
│   │   ├── final/              # /final       Final Night showcase vs. Marwan Serry
│   │   ├── groups/             # /groups      240-group standings & 1v1 fixtures
│   │   ├── bracket/            # /bracket     Interactive 256-slot KnockoutCanvas + Group Stage tab
│   │   ├── leaderboard/        # /leaderboard Live virtualized 720-player standings (Marwan excluded)
│   │   ├── schedule/           # /schedule    Table-numbered fixtures (no upcoming segments leaked)
│   │   ├── segments/           # /segments    16-segment library (finished-match stats only)
│   │   ├── rules/              # /rules       Official Groups/Knockout/Final & card scoring rules
│   │   ├── sponsors/           # /sponsors    Editable placeholder sponsor tiers & deliverables matrix
│   │   └── styleguide/         # /styleguide  Interactive Stage & Paper design system gallery
│   ├── login/                  # /login       Mock auth role picker
│   ├── player/                 # /player & /player/history   Contestant portal + Avatar Studio
│   ├── scorer/                 # /scorer & /scorer/[matchId] Scorer dashboard & live console v2
│   ├── screen/                 # /screen/[gameId] & /screen/leaderboard  Venue Big Screens
│   └── admin/                  # /admin/*     Admin Studio (14 routes)
│       ├── page.tsx            # Overview dashboard
│       ├── players/            # 720-player DataTable, CSV bulk import, Admin Avatar Studio & Drawer
│       ├── check-in/           # Paginated Gate Check-In Tables & Roster + Contact dialogs
│       ├── groups/             # Group draw, swaps/moves & standings inspector
│       ├── bracket/            # Knockout generator, BYE allocation & KnockoutCanvas
│       ├── matches/            # Conflict-free auto-scheduler & match editor (/admin/games redirects here)
│       ├── segments/           # 16-segment library & optional timers
│       ├── consistency/        # 9-invariant Consistency Check & Repair by recomputation
│       ├── results/            # Chronological Results Feed (+ cards/walkovers) + CSV export
│       ├── audit/              # Super Admin Audit Log (incl. automatic cascades) + diffs + CSV
│       ├── managers/           # Staff manager CRUD & role capability matrix
│       ├── content/            # Announcements, rules & schedule blurbs
│       ├── sponsors/           # Placeholder sponsor tiers CRUD
│       └── settings/           # Tournament parameters, presets & Reset Demo Data
├── components/
│   ├── ui/                     # Restyled Radix/shadcn primitives (DataTable, VirtualList, PlayerCombobox…)
│   ├── brand/                  # Game-show motifs, KnockoutCanvas, AvatarLibrary3D (24 SVGs), DisciplinaryCards, PlayerContactDialog…
│   ├── layout/                 # PublicHeader, PublicFooter, StudioSidebarShell, RoleGuard
│   ├── landing/                # 7 modular pitch landing sections
│   ├── public/                 # Spectator views
│   ├── scorer/                 # ScorerDashboardView, ScorerConsoleView, SessionHistoryDrawer
│   ├── screen/                 # BroadcastFrame, BigScreenGameView, BigScreenLeaderboardView, PresenterControlPill
│   ├── admin/                  # All Admin Studio views + ImpactPreviewDialog + MatchEditorDialog
│   └── player/                 # PlayerProfileView, PlayerHistoryView, AvatarEditorDialog
└── lib/
    ├── schemas/index.ts        # Zod schemas & inferred TS types (single source of truth)
    ├── engine/                 # Pure deterministic tournament engine (ZERO UI/storage/realtime imports)
    ├── commands/index.ts       # Atomic command pipeline (auth → validate → version → events → engine → invariants → commit → broadcast)
    ├── repos/                  # Thin read & command-delegating repositories + role-based segment redaction
    ├── storage/index.ts        # IndexedDB adapter (`idb`, 15 indexed stores + atomic delta commits)
    ├── seed/index.ts           # Deterministic procedural seed generator (12 / 48 / 720 presets)
    ├── realtime/index.ts       # Post-commit BroadcastChannel + storage fallback transport
    ├── auth/index.tsx          # Mock AuthProvider + route/action guards
    ├── i18n/index.tsx          # EN/AR dictionary provider with RTL dir management
    └── feedback/index.ts       # Phase 10 sound & haptics no-op hook stubs
```

---

## 5. Event-Sourced Architecture & Data Integrity

1. **Append-Only Event Log (Single Source of Truth):** Scores (`ScoreEvent`), absences (`AbsenceEvent`), buzzes (`BuzzEvent`), match transitions (`MatchLifecycleEvent`), and arrivals (`CheckInEvent`) are append-only. Reverts and admin edits append compensating events (`kind: 'undo'`, `action: 'reversed'`, `replayEpoch` increments) and **never delete past history**.
2. **Zero Direct Derived Writes (AST-Guarded):** Nothing outside `src/lib/engine` and `src/lib/commands` may write derived fields (`winnerPlayerId`, `winnerId`, `advancingPlayerIds`, `result`, `stats`, entity `status`/`rank`). Enforced on every check by `scripts/check-derived-writes.mjs` in `npm run lint`.
3. **Automatic Cascades & Impact Preview:** Reverting or editing a finished match recomputes the winner, rank, group standings, qualifiers, BYEs, and downstream slots automatically. If a downstream match has already started (`live`/`finished`), the pipeline throws `CascadeConfirmationRequiredError` and renders `ImpactPreviewDialog` so the Super Admin chooses **`invalidateForReplay`** or **`markNeedsReview`** explicitly.
4. **9 Engine Invariants & Consistency Check (`/admin/consistency`):** Every command verifies all 9 invariants (`FINISHED_MATCH_SINGLE_VALID_WINNER`, `NO_FINISHED_MATCH_TIED`, `FINISHED_GROUP_COMPLETE_STANDINGS`, `QUALIFIERS_MATCH_TOP_N`, `KNOCKOUT_PARTICIPANTS_MATCH_FEEDERS`, `PLAYER_AT_MOST_ONE_LIVE_MATCH`, `STORED_STATS_MATCH_RECOMPUTED`, `NO_ORPHAN_EVENTS`, `MARWAN_EXCLUDED_FROM_STANDINGS`). Admins can inspect status anytime at `/admin/consistency` and run **Repair by recomputation**.
5. **Optimistic Concurrency:** Every match carries `version: number`; stale writes reject with `VersionConflictError`.

---

## 6. Swapping Storage & Commands for a Real Database

**Golden architectural rule:** Zero UI pages or components import seed data or touch IndexedDB directly. Every read passes through `src/lib/repos/*` and every mutation flows through `src/lib/commands/index.ts`.

### Step-by-Step Swap Checklist

1. **Provision PostgreSQL tables** (Supabase / Prisma / Drizzle) matching `src/lib/schemas/index.ts`:
   - Entity tables: `players`, `users`, `groups`, `rounds`, `segments`, `matches` (with `version` optimistic-lock column & `replay_epoch`), `sponsors`, `content_items`, `settings`.
   - Append-only event tables (`INSERT`-only): `score_events`, `absence_events`, `buzz_events`, `match_lifecycle_events`, `check_in_events`, `audit_entries`.
2. **Keep `src/lib/engine/*` untouched (0 changes!):** Because `/lib/engine` is 100% pure TypeScript with zero browser/storage imports, run the exact same `propagateWinners()`, `previewCascadeImpact()`, `autoScheduleMatches()`, and `checkInvariants()` inside your server-side command handlers!
3. **Move `src/lib/commands/index.ts` to Server Actions / API Route Handlers** wrapped in SQL `BEGIN ... COMMIT` transactions using optimistic locking (`WHERE id = $1 AND version = $expectedVersion`), and swap `src/lib/storage/index.ts` from IndexedDB to your ORM/DB pool.
4. **Enforce server-side Auth, RBAC & Redaction:** Replace `src/lib/auth/index.tsx` with Auth.js / Supabase Auth, enforce `canAccessPath` in `middleware.ts`, and mirror `assertRepoPermission`, `redactMatchForRole`, and contact visibility in server handlers + PostgreSQL RLS. Store uploaded player avatar photos (`<= 300KB`) in S3 / R2 / Supabase Storage.

See [`TODO.md`](./TODO.md) for the full production swap checklist.

---

## 7. Upgrading Realtime to Multi-Device Venue Sync

During the single-browser pitch, `src/lib/realtime/index.ts` uses `BrowserRealtimeTransport` (`BroadcastChannel` + `storage` fallback with message-ID deduplication), publishing **strictly after IndexedDB commit resolves**.

For a **live multi-device venue** (table iPads → Main Stage LED Wall PC → spectator phones), implement one class satisfying `RealtimeTransport` (`SupabaseRealtimeTransport`, `AblyRealtimeTransport`, `PusherRealtimeTransport`, or `WebSocketRealtimeTransport`) and register it in `createRealtimeTransport()` via `NEXT_PUBLIC_REALTIME_DRIVER` — zero UI edits required.

---

## 8. Deployment (Vercel & Netlify)

This release (`v0.1.1-client-feedback-1`) is **zero-config ready** for both **Vercel** (`vercel.json`) and **Netlify** (`netlify.toml`) — no environment variables or external services are required for prototype mode.

- Prototype data persists **per browser** in IndexedDB (`casino_el_al3ab_idb_v1`). Every visitor starts cleanly on the 720-player Ramadan 2027 seed and can switch presets or reset anytime via **Admin → Settings**.
- **Google Fonts** (`Lilita One`, `Bebas Neue`, `Inter`, `Lalezar`, `Cairo`) are self-hosted by `next/font/google` at build time so the production build works **100% offline**.

---

## 9. Brand Safety & Scope Guardrails

- **No photos of real people in seed/host:** Marwan Serry appears by **name only** (`Marwan Serry` / `مروان سري`) with a generated golden crown emblem — zero photos or copyrighted show logos/artwork. Contestant photos are optional self/admin uploads (`<= 300KB` cropped square) backed by 24 original in-house 3D SVG avatars (`CC0/MIT`).
- **Skill & trivia positioning:** Zero real-money gambling terminology or fixed sponsor prices (`"Contact us"` placeholders).
- **Registration quiz (frontend demo):** Included under `/quiz*` and `/admin/quiz*` strictly as a browser demo with persistent **`DEMO MODE`** pills, 64 original seeded questions marked `draft` for human fact/Arabic review, and a complete backend swap checklist in [`TODO.md`](./TODO.md).
- **14 Engine Invariants:** `/admin/consistency` verifies all 9 tournament invariants + 5 registration quiz invariants (`QUIZ_ONE_ACTIVE_ATTEMPT_PER_APPLICANT`, `QUIZ_RANKING_ORDER_CONSISTENT`, `QUIZ_CUTOFF_CONSISTENT`, `QUIZ_HANDOFF_NO_DUPLICATE_PLAYERS`, `QUIZ_NO_ORPHAN_EVENTS`).
- **Phase 10 Delighters:** Kept off (`delightersEnabled: false`) for this client milestone, with reusable hook points (`AnimatedNumber`, `ChipBadge`, `PlayerPanel`, `/lib/feedback`, named realtime events including `quiz.started`, `quiz.answered`, `quiz.timedOut`, `quiz.finished`) ready for activation.
