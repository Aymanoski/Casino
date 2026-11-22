 # AGENTS.md — Project Context (READ THIS FIRST, EVERY SESSION)

> Also read `DESIGN.md` before building any UI.
> **Section 15 (Change Request 1, from client feedback after Phase 9) and Section 16 (Quiz Module Demo) OVERRIDE any earlier section they conflict with** (sections 2, 3, 4, 6, 8, 9, 11 and 12 especially).
> If your tool prefers `GEMINI.md` or a rules folder, copy this file there too.

## 1. What we are building

A web platform for a **Ramadan tournament inspired by "Casino El Al3ab"**, an Egyptian comedy/game show hosted by **Marwan Serry**. The tournament runs in groups and knockout rounds. **The last 2 finalists play the final against Marwan Serry himself.**

This is also a **pitch prototype**. It will be shown to Marwan Serry to convince him to **sponsor the event and attend the final to play**. It must look impressive AND have all the functionality of the final product. The only differences from production:

- **No database yet.** All data is dummy data behind a swappable repository layer.
- Many details are not finalised (player count, dates, venue, prizes, sponsor tiers). Treat them as placeholders and make them editable.

The product owner is not the end client. The end client's original request was vague, so see section 2 for the interpretation. When something is unclear: **pick a sensible default, record it in `ASSUMPTIONS.md`, and continue.** Do not stall.

## 2. Original client request (Franco-Arab, as received) and how we interpret it

Original messages (kept verbatim for reference):

```
Access lel managers mokhtalefa
System lel event
Adkhal el part. K users
Point plus minus
Time
Tracker lel history
Kol e natega btgeli ana b2a bel tarteb w date + time
Session
Profile
```

Interpretation:

| Client said | We build |
|---|---|
| Different access for managers | Role-based access: Super admin, Scorer, Check-in staff, Content manager |
| System for the event | Full event management system (players, games, bracket, scoring, results) |
| Enter the participants as users | Admins create player accounts (no public self-registration) |
| Points plus / minus | Scorer applies +1, −1, Yellow card (−1), or Red card (−2), each with optional note |
| Time | A timer per segment/game, and a date and time on every record |
| History tracker | (a) Player history across games, (b) Admin audit log of every action |
| Every result reaches me in order with date + time | Results feed, newest first, with date and time, visible to admins |
| Session | A "Game" = one 3-player session with a scorer, made of ordered segments |
| Profile | Player profile with stats and history; manager profile |

A **registration quiz** (20 questions, 10 seconds each, randomized) was originally deferred, and is now in scope as a **frontend-only demo module** (see **Section 16**).

## 3. Current direction (aligned with Section 15 / Change Request 1)

> This list is the **starting point, not a cage**. The scope is still growing. When the product owner asks for something new or different, do it: update this file and `ASSUMPTIONS.md` to match, then continue. Do not refuse a change because it contradicts this list.

- **Group Stage + Single-Elimination Knockouts + 1v1v1 Grand Final.** All parameters are adjustable in `Settings.tournament` (defaults: `totalPlayers: 720`, `groupSize: 3`, `advancePerGroup: 1`, `pointsPerGroupWin: 3`, `tablesCount: 12`, `slotMinutes: 30`).
- **Groups:** players are split into numbered groups (`1..N`) of `groupSize` (default 240 groups of 3). Group matches are **1v1 round-robin** (`n(n-1)/2` matches per group). A win gives 3 group points; draws are forbidden (tie-break required → status `needsTieBreak`).
- **Knockouts:** all **1v1 single-elimination**, seeded automatically by group number (1 vs 2, 3 vs 4, pairing by rank within group pairs when `advancePerGroup > 1`). Non-power-of-two qualifier counts grant visible BYE nodes to the best group winners (ranked by group points, points difference, then fewer cards).
- **The final = 2 finalists + Marwan Serry** (the only 3-player / 1v1v1 match). Highest total points wins; tie goes to tie-break. Marwan Serry is a special **guest participant** excluded from groups, rankings, standings, and player stats.
- **Players are added by admins** (create accounts, bulk import CSV, procedural presets for 12 / 48 / 720 players).
- **Buzzing:** the **judge/scorer taps who buzzed first**. No phone buzzers.
- **Each match has an assigned table number, time slot, and judge (scorer)** produced by a conflict-free auto-scheduler (no double-booked player, table, or judge) with manual overrides.
- **Scoring v2:** **+1**, **−1**, **Yellow card (−1)**, and **Red card (−2)** with optional note, Undo, and **Mark absent** (immediate walkover in 1v1; `void` if both absent; admin prompt in Final). Card counts are derived separately from the event log.
- **Player privacy & avatars:** players never see segments of upcoming or live matches (enforced at repo/permission layer); upcoming match view shows opponent, table number, date/time, round/group, and judge contact card; profiles support photo upload (cropped/compressed <= 300KB) or deterministic 24-avatar 3D library fallback.
- **Language:** English first, **Arabic toggle with full RTL**.
- **Public spectator pages** exist: bracket, live leaderboard, schedule, rules, sponsors, the final.
- **Look:** bold "Casino El Al3ab" game-show theme: red sunburst stages, gold-to-orange outlined lettering, white as a primary surface and text color, and a hint of electric blue where it fits. Playful sticker style with dice, cards and chips, and Ramadan lanterns/crescent as a secondary accent. See `DESIGN.md`.
- **Pitch page** order: final-night showcase hero, then live demo, then sponsor tiers.

## 4. Roles and permissions

| Role | Can do | Cannot do |
|---|---|---|
| Super admin | Everything: players, avatars, groups/draw, knockouts, managers, segments, settings, overrides, absence reversal, Impact Preview cascades, Consistency check & Repair by recomputation, audit log, results feed, all contacts, **full Quiz admin (dashboard, question bank, settings, results, attempt resets, tournament handoff)** | n/a |
| Judge / Scorer | See assigned matches, run a match, tap buzz, apply +1/−1 points and Yellow/Red cards, undo own last action, mark player absent, move segments, view contact info ONLY for players in assigned matches (audited) | Edit bracket, players, settings, other judges' matches, reverse absences, override results, view unassigned player contacts, access Quiz admin |
| Check-in staff | See today's matches and players, view player contacts for check-in, record arrival check-in (`registered`, `checkedIn`, `absent`) | Change scores, cards, bracket, settings, derived tournament status, or access Quiz admin |
| Content manager | Edit schedule blurbs, announcements, sponsors, rules text, segment descriptions, **and edit the Quiz question bank (`/admin/quiz/questions` only)** | Change scores, bracket, players, view contacts, or view Quiz results/settings/resets/handoff |

Players (login) see only their profile, avatar editor, post-match history, and upcoming match details (including their assigned judge's contact card, with NO upcoming/live segment details). Visitors see only public pages (general "how it works", no upcoming match segments).
Auth is **mocked** for the prototype: a login screen with demo accounts per role. Structure it so real auth drops in later.

## 5. Tech stack

- **Next.js (App Router) + TypeScript**
- **Tailwind CSS** with design tokens from `DESIGN.md`
- **shadcn/ui** (Radix) as the component base, restyled completely to the design system
- **Framer Motion** for animation
- **Zod** for all schemas and validation
- **i18n:** simple dictionary based (e.g. next-intl or a light custom provider), `en` and `ar`, with `dir="rtl"` for Arabic
- **Icons:** Lucide
- **Fonts:** see `DESIGN.md`
- **No backend. No database.**

## 6. Data architecture (most important rule — aligned with §15.4 & §15.5)

**No component or page may import mock data or storage directly, and NOTHING outside `/lib/engine` and `/lib/commands` may write derived fields (`winner`, `rank`, `status`, `result`, `stats`, `advancingPlayerIds`).** Enforced by `scripts/check-derived-writes.mjs` in `npm run lint`.

```
/lib/schemas     Zod schemas + inferred TS types (single source of truth)
/lib/engine      Pure deterministic tournament engine (ZERO UI/storage/realtime imports):
                 computeMatchResult, computeGroupStandings, computeQualifiers,
                 generateKnockout, resolveByes, propagateWinners, computePlayerStatus,
                 computeAllPlayerStats, computeLeaderboard, autoScheduleMatches,
                 previewCascadeImpact, checkInvariants
/lib/commands    Atomic command pipeline (permission -> validate -> version check ->
                 append events -> engine recompute -> cascade + Impact Preview ->
                 audit entries -> checkInvariants -> atomic IDB commit -> broadcast)
/lib/repos       Thin read & command-delegating repositories:
                 matchRepo (gameRepo alias), groupRepo, playerRepo, roundRepo,
                 segmentRepo, scoreRepo, userRepo, auditRepo, sponsorRepo,
                 contentRepo, settingsRepo, permissions (with player segment redaction)
/lib/seed        Procedural seed generator (presets for 12, 48, and default 720 players)
/lib/storage     IndexedDB storage adapter (`idb`, indexed object stores + atomic delta
                 commits handling 1,000+ matches & 100,000+ events smoothly)
/lib/realtime    Cross-window sync using BroadcastChannel (+ storage event fallback),
                 publishing strictly AFTER IndexedDB commit resolves
```

- **Single source of truth:** append-only event log (`ScoreEvent`, `AbsenceEvent`, `BuzzEvent`, `MatchLifecycleEvent`, `CheckInEvent`). Reverts append compensating events; past events are never deleted.
- **Derived projections:** match winners/results/statuses, group standings, qualifiers, knockout participants, round statuses, player stats/statuses, and leaderboards are derived purely by `/lib/engine` and verified by 9 invariants (`checkInvariants`).
- **Optimistic concurrency:** `Match.version` increments on every command; stale writes throw `VersionConflictError`.
- Provide a **"Reset demo data"** action in admin settings and a **"Consistency check"** page (`/admin/consistency`) with **"Repair by recomputation"**.

### Entities

- `Player`: id, fullName, fullNameAr, nickname, nicknameAr, seed, isGuest (true for Marwan Serry), `contact: PlayerContact` (`phone`, `whatsapp`, `email`), `avatar: Avatar` (`photoUrl?`, `avatarKey`), createdAt. Derived projections: `status` (`registered | checkedIn | absent | active | eliminated | finalist`), `stats` (`matchesPlayed`, `wins`, `losses`, `totalPoints`, `groupPoints`, `yellowCards`, `redCards`, `absences`).
- `User`: id, name, nameAr, email, phone?, whatsapp?, role (`superAdmin | scorer | checkIn | content | player`), playerId?, language
- `Group`: id, number (1..N), nameEn, nameAr, roundId, playerIds[]
- `Round`: id, name (en, ar), order, stage (`group | knockout | final`), advancePerGame, derived `status` (`upcoming | live | done`)
- `Match` (replaces `Game`): id, type (`group | knockout | final`), groupId?, roundId, round, slot, isGroupTieBreak?, participants[] (with `guest`, `isBye`, and `feeder` metadata), tableNumber, tableName, scheduledAt, judgeUserId, segmentIds[], currentSegmentIndex, timer?, replayEpoch, `version`. Derived projections: `status` (`scheduled | live | needsTieBreak | finished | void | needsReview`), `result` (`{ type: normal | walkover | void, winnerId?, reason?, overridden? }`), activeBuzzPlayerId?, startedAt?, finishedAt?, needsReviewReason?.
- `Segment`: id, nameEn, nameAr, category (`music | wordplay | popculture | general | special`), descriptionEn, descriptionAr, durationSec?, order
- `ScoreEvent`: id, matchId, segmentId, playerId, delta, note?, `kind` (`point | yellow | red | undo`), byUserId, targetEventId?, replayEpoch, createdAt
- `AbsenceEvent`: id, matchId, playerId, action (`marked | reversed`), reason?, byUserId, replayEpoch, createdAt
- `BuzzEvent`: id, matchId, segmentId, playerId, byUserId, cleared?, replayEpoch, createdAt
- `MatchLifecycleEvent`: id, matchId, type (`started | finished | reopened | tieBreakerOpened | segmentChanged | overrideResult | markedNeedsReview | reviewResolved | invalidatedForReplay`), byUserId, reason?, payload?, replayEpoch, createdAt
- `CheckInEvent`: id, playerId, status (`registered | checkedIn | absent`), byUserId, createdAt
- `AuditEntry`: id, actorUserId, action, entityType, entityId, summary, summaryAr?, before?, after?, automatic?, createdAt
- `Sponsor`: id, name, tier, logoText (no real logos), blurb
- `ContentItem`: announcements, rules text, schedule blurbs
- `Settings`: eventName, eventDates (placeholder), venue (placeholder), prizeText (placeholder), language defaults, `tournament` (`totalPlayers`, `groupSize`, `advancePerGroup`, `pointsPerGroupWin`, `tablesCount`, `slotMinutes`, `includeFinalWithMarwan`)

## 7. Segments (draft library, confirm with client)

Seed these as editable `Segment` records (English / Arabic names); timers optional. All segments use the uniform Scorer Console v2 scoring controls (`+1`, `−1`, Yellow card `−1`, Red card `−2`).

**Music and singing**
1. A Song by the Artist: أغنية للفنان / للفنانة
2. A Song by a Famous Band: أغنية لفرقة مشهورة
3. Put the Word in a Song: حط الكلمة في أغنية
4. Reversed / Unreversed Song: أغنية معكوسة / غير معكوسة
5. Guess the Singer / Track: تخمين المغني أو الأغنية

**Wordplay and speed**
6. Reversed Words: كلمات معكوسة
7. A Word Takes You, A Word Brings You: كلمة توديك وكلمة تجيبك
8. The Description: الوصف
9. Name / List It: اذكر / عدّد

**Pop culture, cinema and characters**
10. Egyptian Cinema and Series Trivia: أسئلة أفلام ومسلسلات مصرية
11. International Cinema: السينما العالمية
12. Famous Figure / A Place Lived In: شخصية شهيرة / مكان يسكن فيه
13. Who Said the Quote?: مين قال المقولة

**General and special**
14. General Knowledge: معلومات عامة
15. Audience and Fan Questions: فقرة الجمهور / السوشيال ميديا
16. Tie-Breaker and Penalty Challenge: جولة التحدي / الحسم

Descriptions: short and original (write them yourself). **Do not copy text from the real show or any website.**

## 8. Screens and routes

**Public**
`/` pitch and landing · `/final` final night showcase · `/groups` · `/bracket` · `/leaderboard` · `/schedule` · `/rules` · `/segments` · `/sponsors`

**Registration Quiz (public applicant flow, demo mode, Arabic-first RTL default with EN toggle)**
`/quiz` · `/quiz/register` · `/quiz/rules` · `/quiz/play` · `/quiz/result` · `/quiz/how-it-works`

**Auth (mock)**
`/login` with demo account picker per role

**Player**
`/player` (profile, stats, next game) · `/player/history`

**Scorer**
`/scorer` (my games) · `/scorer/[gameId]` (the scorer console, the core screen)

**Big screen**
`/screen/[gameId]` (live game for venue/stream) · `/screen/leaderboard`

**Admin**
`/admin` dashboard · `/admin/players` · `/admin/managers` · `/admin/groups` (Group draw, manual moves, standings) · `/admin/bracket` · `/admin/matches` (redirect from `/admin/games`) · `/admin/segments` · `/admin/results` (results feed) · `/admin/audit` · `/admin/consistency` (Consistency check & Repair by recomputation) · `/admin/check-in` · `/admin/content` · `/admin/sponsors` · `/admin/settings` · **`/admin/quiz` (dashboard) · `/admin/quiz/questions` · `/admin/quiz/settings` · `/admin/quiz/results`**

### Scorer console requirements (the heart of the product — aligned with §15.2)
- Adapts to **2 players** (all group & knockout 1v1 matches) or **3 participants** (the Final with two finalists + Marwan Serry).
- Shows each participant (name, nickname, avatar, running total, yellow/red card icons), current segment name, segment timer (start/pause/reset), and segment progress.
- **Big "Buzzed first" tap target per player.** Tapping records a `BuzzEvent`, highlights that player.
- **Scoring controls per player:** **+1**, **−1**, **Yellow card (−1)**, **Red card (−2)** with optional note, plus **Undo** (compensating event, never deletes) and **Mark absent** (with confirm dialog; immediate walkover in 1v1, `void` if both absent, admin prompt in Final).
- **Contact button beside each player** opening a role-scoped contact dialog (phone/WhatsApp/email/copy) logging `contact.viewed`.
- Next / previous segment, finish match (draws forbidden → `needsTieBreak` / Tie-Breaker segment), Impact Preview dialog on cascade-affecting edits/reverts/reopens, and optimistic concurrency protection (`Match.version`).
- Works well on a tablet in landscape and on a phone.
- Every action runs through `/lib/commands` (atomic commit + invariant check + audit entry + post-commit realtime broadcast).

### Big screen requirements
- Broadcast-style layout: 2 player panels for standard 1v1 matches, or 3 player panels in Final mode (Marwan Serry centered, name only, no photo, plus the two finalists) with animated score counters, card badges, current segment title (EN/AR), timer, and "buzzed first" highlight.
- Leaderboard view with animated rank changes (excluding guest participant Marwan Serry).

### Results feed (admin)
Chronological (newest first, toggle oldest first) list of every finished match and every score/card event ("Yellow card (−1)", "Red card (−2)") with **date and time**, filter by match, round, player, judge. Export to CSV.

### Audit log & Consistency check (super admin)
- Audit log: who did what, to what, when, with before/after diffs, including automatic cascade entries (`automatic: true`). Filter and export.
- Consistency check (`/admin/consistency`): checks all 9 invariants from §15.4 and provides one-click **Repair by recomputation**.

## 9. Demo seed data (aligned with §15.1 & §15.5)

- **Procedural seed generator** with presets for **12**, **48**, and **720** players (default **720** players = 240 groups of 3, 720 group matches, 256-slot knockout bracket with 16 BYE nodes + 1v1v1 Grand Final with Marwan Serry = 975 tournament matches + 1 isolated exhibition demo match).
- The original 27 fictional names/nicknames seed the first 27 entries of the deterministic EN/AR name pool (Omar Hassan "The Fox" through Habiba Osama "Bibo"), followed by procedurally generated Egyptian names, clearly fake contacts (`010-0000-0001`..`010-0000-0720`), and deterministic 24-avatar library keys.
- Demo managers: Super Admin "Admin", Judges/Scorers "Scorer 1" to "Scorer 4" (with fake judge contact phones), Check-in "Gate Staff", Content "Content Editor", plus sample player login accounts.
- Demo story: groups drawn and auto-scheduled conflict-free across 12 tables, first 12 groups completed (36 group matches including a 3-way group cycle and an absence walkover), 3 group matches currently **live** with active scores/cards/buzzes, remaining groups scheduled, and the full knockout skeleton generated with TBD placeholders ("Winner of Group 7") and visible BYE nodes.
- All derived values in the seed are computed through `propagateWinners()` and verified to pass `checkInvariants()` with 0 violations.
- Placeholder event info: "Ramadan 2027", dates, venue and prize clearly marked as placeholders and editable in settings.

## 10. Legal and brand safety

- Use Marwan Serry's **name only** as text. **Do not use his photo or any photo of real people.**
- **Do not use the real show's logo, lettering, artwork, or text.** The theme takes inspiration from the show's brand colors and energy only. Draw original dice, cards, chips, swirls and sunbursts, and create sticker-style lettering with fonts plus outlines. Do not trace or recreate the show's logo. Do not use copyrighted images. Use original CSS/SVG graphics and generic icons. (If the client later provides the official logo with Marwan Serry's permission, it can be added as an asset.)
- Avatars are generated (initials or abstract patterns).
- Write all copy yourself. Segment descriptions are original.
- Sponsor tiers and prices are placeholders ("Contact us" instead of prices).

## 11. Rules of work for the agent

1. **Plan first, then build.** For each phase, produce a short plan, then implement. Do not build everything in one pass.
2. **Use `DESIGN.md` as the creative foundation.** Keep the overall mood and palette, but you are encouraged to push it further. No generic AI look and no unthemed default shadcn styling.
3. **Keep a `ASSUMPTIONS.md`** and update it whenever you decide something not covered here.
4. **Keep a `TODO.md`** for things to do when the real database and auth are added (list every place a repo will be swapped).
5. **Commit after every phase** with a clear message.
6. **Verify with the browser.** After each screen: run the dev server, open it, screenshot, compare to `DESIGN.md`, fix the 3 biggest gaps. Check both **English (LTR)** and **Arabic (RTL)**, and a phone-width viewport.
7. **Definition of done for any screen:** no console errors, no lint or type errors, keyboard accessible, readable contrast, works in EN and AR, works across the full device matrix in section 13 (320px phones up to 2560px monitors), empty and loading states handled.
8. **Never invent real data** about real people or real prices. Placeholders must look like placeholders where it matters.
9. Keep the registration quiz strictly within its documented frontend-only demo scope (Section 16) with clear DEMO MODE honesty pills and backend handoff notes in `TODO.md`.
10. Ask the product owner a question only when a decision would be expensive to undo. Otherwise decide, document, continue.

## 12. Creative latitude and evolving scope (important)

- **Be a creative partner, not just an order-taker.** In every phase, add at least one idea the product owner did not ask for that would make the prototype more impressive or the event better (a delightful interaction, a smarter feature, a stronger visual moment, a better pitch touch). Build small ideas directly and mark them "Bonus idea" in `ASSUMPTIONS.md`. For bigger ideas, describe them in 2 to 3 lines and offer them as options.
- **Delighters are a separate FINAL phase (Phase 10).** The product owner will first show the client the complete base version, then add the wow layer. **Do not build anything from `DESIGN.md` section 11 (signature moments, 3D cards, confetti, sound, haptics, easter eggs, scroll storytelling, page transitions, etc.) until the product owner says "start Delighters".** Phases 1 to 9 should still look polished, premium and professional, using the baseline motion in `DESIGN.md` section 7.
- **Prepare hook points now so Delighters can be added later without rewrites:** wrap animatable UI in small reusable components (e.g. `AnimatedNumber`, `ChipBadge`, `PlayerPanel`), emit named events for key moments (`score.changed`, `buzz.recorded`, `segment.changed`, `game.finished`, `final.revealed`) through the realtime layer, add a no-op `feedback` service (`/lib/feedback`) with `play(name)` and `haptic(name)` stubs, and add a `delighters` setting (on/off) that defaults to **off** in Phases 1 to 9.
- **The scope will grow.** Expect new features, screens, roles, game formats and visual changes during the project. Design the code so additions are easy: modular components, repo layer, configurable bracket and segments.
- **Challenge and improve.** If you see a better approach than what is written here (UX, structure, naming, game flow), say so briefly and propose it. The product owner decides.
- **Everything marked "out of scope" or "decided" can be reopened** when the product owner asks (as done for the Registration Quiz demo in Section 16).
- **Change protocol:** when scope changes, (1) update `AGENTS.md` sections affected, (2) note it in `ASSUMPTIONS.md` with the date, (3) check that existing screens, seed data and repos still work, (4) continue.
- The legal and brand-safety rules in section 10 stay, because they protect the product owner. Everything else is flexible.

## 13. Responsive and device support (REQUIRED in every phase, for every screen)

The site must be **optimized for mobile web, tablet, laptop and desktop web, at all sizes**. Not just "it doesn't break": each size should feel designed for it.

**Approach**
- **Mobile-first** CSS with Tailwind breakpoints, then enhance upward. Define and use consistent breakpoints (suggested: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`, plus a custom `3xl 1920` for big screens).
- **Fluid everything:** fluid typography and spacing with `clamp()`, flexible grids, container queries for components that live in different-width containers, images and SVG that scale, no fixed pixel widths for layout.
- **Use `dvh`/`svh` instead of `vh`** for full-height sections (mobile browser bars), respect **safe-area insets** (notches, home indicator), and handle both portrait and landscape.
- **Touch vs mouse:** hover effects only under `@media (hover: hover)`. Touch targets at least 44px (scorer console 56px+). Inputs at least 16px font so iOS doesn't auto-zoom. No hover-only functionality.
- **No horizontal page scroll** at any width. Long text, tables and numbers must wrap or scroll inside their own container.
- Works with browser zoom 100% to 200% and Windows display scaling (125%, 150%), and with short laptop screens (for example 1366x768).

**Device matrix to test (every screen, before it is "done")**
- Phones: 320, 360, 390, 430 px wide (portrait) and one phone landscape
- Tablets: 768, 820, 1024 px wide (portrait and landscape)
- Laptops: 1280, 1366, 1440, 1536 px wide
- Desktops and large monitors: 1920 and 2560 px wide
- Big screen / TV view (`/screen/*`): scales proportionally up to 4K and stays legible from 10 meters
- Browsers: Chrome, Safari (iOS and macOS), Firefox, Edge
- Each of the above in **English (LTR) and Arabic (RTL)**

**Layout patterns per screen type**
- **Navigation:** public header collapses into a drawer menu on small screens (mirrors in RTL). Admin and scorer sidebars become a bottom bar or drawer on phones and a collapsible rail on tablets. The language toggle is always reachable.
- **Tables (admin):** on small screens become card lists or scroll horizontally inside a container with a sticky first column. Filters move into a sheet.
- **Dialogs and menus:** become bottom sheets on phones.
- **Scorer console:** phone portrait = stacked player panels with a sticky action bar; tablet landscape and up = 3 columns side by side with the segment/timer panel. It must be usable one-handed on a phone.
- **Big screen:** layout scales with the viewport (use `vw`/`clamp`), never scrolls, and keeps 3 players plus the segment title visible at any aspect ratio (16:9, 16:10, 21:9).
- **Landing page:** hero, live demo, bracket and sponsor tiers each have a deliberate mobile layout (not just stacked desktop). The live demo section simplifies to a vertical flow on phones.
- **Bracket:** scrolls and zooms horizontally on small screens, with a clear current-round focus.
- **Forms:** single column on phones, sensible multi-column on larger screens.

**Performance on mid-range phones:** lazy-load heavy components and images, avoid layout shift, keep animations GPU friendly, and keep the main thread light.

## 14. Impeccable design skill (if installed) and precedence rules

The project may use the **Impeccable** design skill (by Paul Bakaus), installed in the agent environment. If it is installed:
- **Use it for craft quality:** typography scale, spacing rhythm, contrast, accessibility, responsive behavior, motion quality, UX writing, and its audit/polish commands after each screen.
- **`DESIGN.md` wins on brand and identity:** palette, fonts, motifs, mood, and the page-by-page direction. If Impeccable flags something `DESIGN.md` intentionally specifies (for example gold gradients or glows), keep the `DESIGN.md` choice and note the exception in `ASSUMPTIONS.md`.
- **`AGENTS.md` wins on product decisions** (scope, roles, data, phases). Skills never override it.
- **Phase rule:** Delighters (DESIGN.md section 11) stay in Phase 10. Do not use Impeccable's more extreme "go bigger" commands (such as overdrive) before Phase 10.
- When Impeccable asks for project design context, use `AGENTS.md` and `DESIGN.md` as the source. Do not invent a different brand direction.

## 15. CHANGE REQUEST 1: client feedback after Phase 9 (Nov 21, 2026)

**This section overrides earlier sections where they conflict.** When implementing, also rewrite the superseded parts of sections 3, 4, 6, 8 and 9 so the whole file is consistent. Where the client's wording was ambiguous, the interpretation below is the default; record each in `ASSUMPTIONS.md` as "to confirm with client".

### 15.1 Tournament structure (replaces the 3-player games and the 27-player ladder)

All numbers are **adjustable in admin settings** (defaults in brackets):
`totalPlayers` (720), `groupSize` (3), `advancePerGroup` (1), `pointsPerGroupWin` (3), `tablesCount`, `slotMinutes`.

- **Groups:** players are split into groups of `groupSize` (720 players = 240 groups of 3). Default assignment is a random draw, with a re-draw option and manual moves before the tournament starts. Groups are numbered 1..N. Inside a group the players are A, B, C.
- **Group matches are all 1v1 round-robin:** for a group of 3 that is A vs B, B vs C, A vs C (generalize to n(n-1)/2 matches for other sizes).
- **A win gives 3 group points** (loss 0). **Draws are not allowed:** if scores are level at the end, the match cannot finish; a tie-break (sudden-death segment) is required. The match status is `needsTieBreak` until resolved.
- **Group ranking order:** (1) group points, (2) if exactly two are tied, head-to-head, (3) total match points scored (difference), (4) fewer red cards, then fewer yellow cards, (5) an admin-triggered tie-break match, created automatically. A 3-way cycle (everyone has 3 points) is resolved by rule 3 and onward.
- **Qualification:** the top `advancePerGroup` (1) players of each group go to the knockouts. A group is complete only when all of its matches are finished.
- **Knockouts are all 1v1, single elimination, seeded automatically by group number:** group 1's qualifier plays group 2's, group 3's plays group 4's, and so on. When `advancePerGroup` > 1, pair by rank within the group pair (1st of group 1 vs 1st of group 2, 2nd vs 2nd, etc.). Later rounds follow bracket order (winner of match 1 vs winner of match 2). Knockout draws are not allowed (tie-break).
- **Byes:** if the qualifier count is not a power of two (240 qualifiers need a 256 bracket), give byes to the best group winners ranked by group points, then points difference, then fewer cards. Show BYE nodes. Handle odd group counts.
- **The final is the only non-1v1 match:** the last two finalists plus **Marwan Serry** play one 3-player match (1v1v1). Highest total points wins; a tie goes to a tie-break. Marwan is a special **guest participant**, not one of the 720 players: he is excluded from rankings, standings and player stats.
- **Scale:** 720 players is about 240 groups, 720 group matches and about 240 knockout matches. The app must stay fast: **virtualized tables, pagination, search and filters, group and match jump-to**, an interactive zoomable bracket, and **storage moved from localStorage to IndexedDB** behind the same repo interface (localStorage cannot hold this much). Seed data is generated procedurally from name pools, with presets for 12, 48 and 720 players.
- **Scheduling:** every match gets a **table number**, a time slot and an assigned judge (the scorer). An auto-scheduler assigns tables and slots from `tablesCount` and `slotMinutes`, never double-booking a player, a table or a judge, with manual overrides.
- **Naming:** the "Game" entity becomes **Match** (types: group, knockout, final). Update code and docs consistently.

### 15.2 Scorer console v2 (replaces preset points and custom amounts)

- Panels adapt to the match: **2 players** (all matches), or **3 participants** in the final (two finalists plus Marwan).
- **Scoring controls per player, nothing else:** a **+1** button, a **−1** button, a **Yellow card** button (backend delta −1) and a **Red card** button (backend delta −2), each with the **optional note** field. **Remove preset values and the custom amount input.** Keep Undo, the buzz tap, the segment timer and next/previous segment as they are.
- **Cards are counted as cards.** Show each player's yellow count and red count as card icons (not as "−1"s and "−2"s). The counts are derived from the event log by kind.
- Every card also changes the score (yellow −1, red −2). `ScoreEvent.kind` is `point | yellow | red | undo`, and the log text says "Yellow card (−1)" or "Red card (−2)" everywhere: results feed, audit log, player history, scorer history. Card totals show per match and per tournament in player stats and in the group tie-breaks.
- **Mark absent:** a "Mark absent" action per player (with a confirmation). In a 1v1 the match **ends immediately as a walkover**, the other player wins and **qualifies automatically** (group: +3 points; knockout: advances). If both are marked absent, the match becomes `void` and needs a super admin decision (choose who advances, or replay). In the final, marking a finalist absent does not auto-end the match: show a prompt and let the super admin decide. Absences are recorded in player stats and the audit log, and can be reversed by the super admin (which triggers the cascade in 15.4).
- **Contact button beside each player:** a clickable button opening a **dialog with the player's contact info** (name, phone with tap-to-call, a WhatsApp link, email, copy buttons), so the judge can call a late player. Visible only to the assigned scorer, check-in staff and super admin. Log a light `contact.viewed` audit entry.

### 15.3 Player side: privacy, schedule view and avatars

- **Players must NOT see the segments of upcoming or live matches.** Remove any segment names, order, categories or match-specific rules from the player profile, the upcoming match view and the schedule, so players cannot study ahead; it stays a surprise. Enforce this in the **repository and permission layer**, not only the UI: player-role reads cannot return segment data for matches that are not finished. Public pages show only general "how it works" information, and segment details appear only live on the big screen or after the match is finished (history).
- **Upcoming match view shows:** opponent (name and avatar), date and time, round and group, the **table number** (new), and a **judge contact card** (judge name plus tap-to-call and WhatsApp buttons) for players who cannot find their table or need help.
- **Avatars:** the profile has a **photo**. Players can upload from the camera or gallery, with square crop, compression (about 300KB maximum) and a file type check. If no photo is provided, use a **preselected 3D-style avatar from a library of at least 24 options**, assigned deterministically by player id and changeable by the player or an admin. Avatars must be original or permissively licensed (record each source and license in `ASSUMPTIONS.md`), never real people or celebrity likenesses. The same avatar component is used everywhere (scoreboards, bracket, big screen, admin). Admins can remove or replace any photo.

### 15.4 Data integrity, automation and orchestration (CRITICAL)

**Reported bug:** an admin reverted entries so the winner had fewer points than second place. The rank tag updated but the "winner" tag stayed on the original winner. **Root cause:** derived values (winner, status, qualification) were stored and not recomputed. The client is rightly worried about orchestration across the whole site, so fix the architecture, not just this symptom.

- **Single source of truth:** the append-only event log (score events, card events, absence events, buzz events, match lifecycle events, admin overrides). **Everything else is derived**: totals, ranks, winner, group standings, qualifiers, bracket participants, player status (active, eliminated, finalist), stats (cards, wins, absences), leaderboards. Never store a derived value that cannot be recomputed from events.
- **Pure engine in `/lib/engine`** (no UI, no storage): functions such as `computeMatchResult`, `computeGroupStandings`, `computeQualifiers`, `generateKnockout`, `resolveByes`, `propagateWinners`, `computePlayerStatus`. Fully unit tested.
- **Command pipeline:** every mutation goes through a command (`applyPoint`, `applyCard`, `markAbsent`, `finishMatch`, `reopenMatch`, `revertEvent`, `overrideResult`, `updateSettings`, ...). Each command: check permission, validate, append events, recompute the affected derived state, run the cascade, write audit entries (including automatic ones that explain cascades), commit **atomically (all or nothing)**, then broadcast realtime events **after** the commit. UI code and repos never set winner, rank or status directly.
- **Cascade rules:** when a result changes (revert, correction, reopen), recompute the match winner (a tie means `needsTieBreak` and no winner), then the group standings, qualifiers and knockout slots. For downstream matches: **not started** means update participants automatically (audited); **live or finished** means never silently rewrite history: mark `needsReview`, show an **Impact Preview** ("this change affects N matches: ...") and require super admin confirmation, then apply the chosen policy (default: invalidate the downstream matches and mark them for replay).
- **Invariants** checked after every command in development and available in admin as **Consistency check**: one winner per finished match and the winner has the most points; no finished match is tied; finished groups have complete standings; qualifiers equal the top N of the standings; knockout participants match their feeder results; a player is in at most one live match; stored stats equal stats recomputed from events; no orphan events. On violation: fail loudly in development, and repair by recomputation and log it in production.
- **Concurrency:** version numbers on matches, reject stale writes with a friendly message, and make every open window re-render from derived data after a realtime event.
- **Reversibility:** a revert appends compensating events, it never deletes. The audit log shows who, when and why, including the automatic cascade entries.
- **Tests (Vitest):** unit and scenario tests including the reported bug (a revert makes second place lead, the winner tag must move), ties and tie-breaks, walkover, both absent, absent reversed, card accumulation, the 3-way group cycle, byes and odd group counts, other settings (not just 720/3/1), the 1v1v1 final with Marwan, a revert after a downstream match has started, and undo.

### 15.5 Permissions, data model and seed changes

- **Permissions:** scorers see contact info only for players in their assigned matches. Check-in staff see contact info for check-in. Players see only the judge contact for their own upcoming match. Super admin has overrides, the Impact Preview and the Consistency check.
- **Model changes:** `Settings.tournament` (the adjustable numbers above), `Group`, `Match` (type group | knockout | final; groupId?; round; slot; participants with a `guest` flag for Marwan; status scheduled | live | needsTieBreak | finished | void | needsReview; result {type normal | walkover | void, winnerId?}; tableNumber; scheduledAt; judgeUserId; version), `PlayerContact` (phone, whatsapp, email), `Avatar` (photoUrl or avatarKey), `ScoreEvent.kind` (point | yellow | red | undo), `AbsenceEvent`. Standings, winners and stats are **derived view models**, not stored.
- **Seed:** generate procedurally (default 720 players with clearly fake contact numbers such as 010-0000-0001). Demo story: groups drawn, a few dozen group matches finished, some groups complete, a few matches live, and the knockout skeleton generated with TBD placeholders ("Winner of Group 7"). The 27-name list in section 9 is now only a source for the first entries of the name pool.

### 15.6 Phase order

Change Request 1 is built before the Delighters (Phase 10). The Delighters work must then use the new 2-player and 3-player match model.

---

## 16. Quiz Module (Demo) — Registration Qualification Filter (Nov 22, 2026)

A **frontend-only demo** of the registration quiz module that screens applicants before the tournament begins. It runs in the browser on IndexedDB behind the existing repository, pure engine, command pipeline, realtime, feedback, and audit log architecture so a real backend can drop in later with **zero screen rewrites**.

### 16.1 Rules & adjustable settings (stored in `Settings.quiz`)

All parameters are editable in `/admin/quiz/settings` with these defaults:
- `questionsPerAttempt`: **20** (drawn randomly without replacement from the bank).
- `secondsPerQuestion`: **10** seconds per question.
- `syncCutoffWithTournament`: **true** — effective top-N cutoff follows `Settings.tournament.totalPlayers` (**720**), with an option to disable sync and set a custom `customCutoffN`.
- `verificationChannel`: `'whatsapp_or_sms'` (wording shows WhatsApp / SMS verification code; configurable to `'whatsapp'`, `'sms'`, or `'email'`; demo mode displays visible test code `123456`).
- `showRankImmediately`: **false** — applicants see their score and total response time right away, and official rank/qualification is announced once the quiz window closes (when the window is closed or the admin enables instant rank preview, `/quiz/result` reveals rank and cutoff status).
- `windowStartsAt` / `windowEndsAt`: open right now by default (opened **48 hours ago**, closes **5 days from now**), with quick admin presets to switch between *Open*, *Upcoming*, and *Closed* during a pitch.
- `retakePolicy`: `'single_attempt'` — strictly **one attempt per verified person** (normalized phone or email). Only the **Super Admin** can reset an attempt (requires a reason, appends a `reset` event without deleting prior events, and writes an `AuditEntry`).
- **Deterministic seeded randomization:** Each attempt stores a `shuffleSeed`. Pure engine functions shuffle both the 20 selected questions and each question's 4 answer options deterministically from `(attemptId, shuffleSeed)` so resuming or inspecting an attempt always reproduces the exact same order.
- **Strict play flow:** No going back, no pause. Selecting an answer moves on immediately without revealing whether it was right or wrong. A timeout counts as a wrong answer and records the full `secondsPerQuestion` (10,000 ms) response time. Refreshing mid-attempt resumes using stored per-question deadline timestamps (never restarting the clock).
- **Scoring & ranking:**
  - `score` = count of correct answers (`0..questionsPerAttempt`).
  - Ranking order: (1) `score` descending, (2) `totalResponseTimeMs` ascending, (3) earlier `submittedAt` timestamp ascending, (4) deterministic `attemptId` tie-breaker.
  - Cutoff line: top `N` finished attempts qualify (`qualified`); remaining finished attempts are `waitlisted`; unsubmitted attempts are `in_progress` or `abandoned`; reset attempts are superseded (`reset`) so a fresh attempt can start.
- **Arabic-first applicant experience:** Question bank is authored Arabic-first with English translations (`questionAr`/`questionEn`, `optionsAr`/`optionsEn`). Entering `/quiz*` defaults the quiz experience to **Arabic RTL** (while keeping the `EN | عربي` toggle always reachable, and locking language switch or clearly confirming mid-attempt so reading time isn't disrupted).
- **Draft vs. approved questions in Demo Mode:** All 60+ seeded original questions start with `reviewStatus: 'draft'` so a human must review factual accuracy and Arabic phrasing before production. In Demo Mode, `/quiz/play` draws from `approved` questions when at least `questionsPerAttempt` are approved, and falls back to `draft` questions with a clear Demo Mode notice in `/admin/quiz/questions`.

### 16.2 Screens & navigation

**Applicant side (phone-first, no login, Stage theme for play/hero + Paper for details, EN & AR RTL, persistent `DEMO MODE` pill):**
- `/quiz` — Landing: what the quiz is, 3-step overview, live time window status/countdown, link to `/quiz/how-it-works`, and Start CTA (plus link from Public Header, Footer, and a compact callout card on `/` without displacing Marwan Serry's Hero).
- `/quiz/register` — Full name, phone, email, mock verification step (visible demo notice with test code `123456`), consent checkbox, and duplicate-attempt guard.
- `/quiz/rules` — Plain-language rules summary + 3-2-1 get-ready countdown before starting the clock.
- `/quiz/play` — Stage theme, huge circular gold-on-crimson 10-second countdown (crisp whole seconds `10 → 0`, high-urgency pulse + white flash border in final 3 seconds, `prefers-reduced-motion` safe), progress through 20, four large thumb-friendly answer buttons (desktop keyboard `1`–`4`), instant neutral confirmation without revealing correct answers, automatic advance, clear timeout state, and refresh-safe deadline resumption.
- `/quiz/result` — Score, total response time, rank/qualification message per `showRankImmediately` & window status, and link to tournament overview.
- `/quiz/how-it-works` — Plain-language pitch explainer contrasting this browser Demo Mode with the production server architecture (server-side deadlines, per-applicant randomization, verified one-attempt enforcement, secure answer secrecy, ranking/cutoff, and tournament handoff).

**Admin side (Paper theme, persistent `DEMO MODE` pill):**
- `/admin/quiz` — Dashboard (Super Admin): applicants, attempts, completion rate, average score, score histogram with cutoff line, window status, and quick handoff CTA.
- `/admin/quiz/questions` — Question bank (Super Admin + **Content Manager**): CRUD, CSV import with row validation & preview, 4 categories (`general`, `egyptian_cinema`, `music`, `wordplay_logic`), difficulty (`easy | medium | hard`), `reviewStatus` (`draft | approved`), Arabic & English fields, shuffled applicant-view preview, and `"Needs human review"` filter.
- `/admin/quiz/settings` — Settings (Super Admin): `questionsPerAttempt`, `secondsPerQuestion`, top-N cutoff (synced with `Settings.tournament.totalPlayers` or custom), time window + quick status presets, verification channel wording, rank reveal toggle, and retake policy.
- `/admin/quiz/results` — Virtualized results table for 1,200+ applicants (Super Admin): rank, score, total time, status, client-side integrity signals, visible cutoff line, search & filters, CSV export, per-question timeline drawer, audited Super Admin attempt reset, and **"Send qualified applicants to the tournament"** handoff button.

### 16.3 Connection to the tournament (handoff & sync)

1. **Cutoff sync:** When `Settings.quiz.syncCutoffWithTournament` is enabled, changing `Settings.tournament.totalPlayers` automatically updates the derived quiz cutoff line without mutating quiz events.
2. **Idempotent handoff command (`handoffQualifiedToTournament`):**
   - Super Admin previews exact impact via pure `previewQuizHandoff()`: qualified count, new `Player` records to create, already handed-off applicants skipped, existing tournament phone/email matches/conflicts.
   - Upon explicit Super Admin confirmation, creates `Player` records through the existing command pipeline (carrying `contact: { phone, whatsapp, email }` and deterministic 3D `avatar` keys via `deterministicAvatarKey`), records immutable `QuizHandoffEvent` links (`applicantId <-> playerId`), logs `AuditEntry` records, and runs `checkInvariants()`.
   - Safely repeatable: re-running creates **zero duplicate players** (verified by engine invariants and Vitest tests).
3. **Contact privacy:** Applicant phone/email details are strictly admin-only (`superAdmin`) and never exposed on public routes, `/quiz/*` after submission, or Content Manager views.

### 16.4 Event-sourced data architecture, integrity signals & invariants (extends §15.4)

- **Append-only source of truth:** `QuizAttemptEvent` (`started`, `question_shown`, `answered`, `timed_out`, `finished`, `reset`, `integrity_signal`) + `QuizHandoffEvent` stored in dedicated IndexedDB object stores behind async `quizRepo`.
- **Pure engine (`/lib/engine/quiz.ts`):** Deterministically derives `shuffledQuestionIds`, `shuffledOptionOrder`, per-question deadlines, `score`, `totalResponseTimeMs`, `status`, `rank`, `cutoffRank`, `qualified`, `histogram`, `integrityFlags`, `previewQuizHandoff`, and quiz invariants. Zero UI/storage/realtime imports; zero stored derived fields outside engine/commands.
- **Consistency check invariants (added to `checkInvariants()` & `/admin/consistency`):**
  - At most one active/non-reset attempt per verified applicant (normalized phone/email).
  - Derived ranks are strictly consistent with `(score DESC, totalResponseTimeMs ASC, submittedAt ASC)`.
  - Qualified count matches top-N finished attempts within cutoff.
  - Every `QuizHandoffEvent` references a valid existing `Player` and no duplicate tournament players exist for the same handed-off applicant.
  - No orphan `QuizAttemptEvent` records.
- **Honest client-side integrity signals:** Real browser listeners record `visibility_hidden` (`visibilitychange` / tab switch), `page_refresh` (session resume reload), and `copy_attempt` (`copy` / `contextmenu`) events. Surfaced in `/admin/quiz/results` explicitly labeled as **"Client-side signals (demo)"**.
- **Delighter hooks (no Delighters built yet):** Emit `quiz.started`, `quiz.answered`, `quiz.timedOut`, `quiz.finished` through `/lib/realtime` and `/lib/feedback` stubs (`delightersEnabled` stays `false`).
- **Seed data:** 1,200 procedural applicants with realistic Egyptian EN/AR names, `010-0000-xxxx` phone numbers, realistic score distribution, response times, ~40 incomplete attempts, ~50 client-side flagged attempts, plus 64 original bilingual questions (16 per category, all `reviewStatus: 'draft'`).
- **Demo honesty:** Persistent `"DEMO MODE"` pill on all applicant and admin quiz routes clearly noting that timer, verification, and anti-cheat signals run in-browser here and are server-enforced in production. Every production replacement point is itemized in `TODO.md`.
