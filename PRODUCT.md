# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Prospective Celebrity Sponsor & Host (Marwan Serry):** Evaluating the live pitch prototype on `/` and `/final` to decide on sponsoring the tournament and attending the Grand Final as the 3rd player.
- **Super Admin:** Full operational oversight—manages players, staff managers/roles, bracket configuration, games, segments library, tournament settings, results feed, and the complete audit log.
- **Table Scorer (Judge):** Runs 1v1 group/knockout matches and the 3-participant Final on a tablet (landscape) or phone—operates the segment timer, records who buzzed first, applies `+1`, `−1`, Yellow card (`−1`), and Red card (`−2`) with optional notes, undoes their last action, marks absences, views assigned player contacts (audited), advances segments, and resolves tie-breakers.
- **Check-In Staff:** Views scheduled games and contestants for the day and marks players as checked in or absent at the venue gate.
- **Content Manager:** Edits tournament schedule blurbs, announcements, sponsor details, rules text, and segment descriptions without altering players, bracket, or scores.
- **Tournament Players (27 seeded contestants):** Log in to view their personal profile, tournament stats, upcoming table assignment, and score history.
- **Public Spectators:** Follow the pitch overview, final night showcase, tournament bracket, live leaderboard, schedule, segment library, rules, sponsors, and big-screen venue views.

## Product Purpose

An end-to-end tournament operations platform and sponsor pitch prototype for a Ramadan trivia and skill game-show tournament inspired by **"Casino El Al3ab"**, running in groups and knockout rounds and culminating in a 3-player Grand Final where the top 2 finalists compete against Marwan Serry himself.

## Positioning

Combines a broadcast-ready sponsor pitch with a working multi-role live event system—including a dedicated zero-mistake Scorer Console, real-time cross-window Big Screen synchronization, flexible 3-player bracket progression, chronological Results Feed, and tamper-evident Audit Log—built in both English and Arabic.

## Operating Context

- Runs across mobile web (320px–430px portrait and phone landscape), tablets (768px–1024px, including landscape scorer console operation), laptops (1280px–1536px), large desktop monitors (1920px–2560px), and venue/stream Big Screens (legible from 10 meters up to 4K).
- Current phase is a front-end pitch prototype with no backend or database: all reads/writes pass through an async repository layer backed by `localStorage` seed data and `BroadcastChannel` real-time cross-window sync, structured so real database and auth drop in later without UI rewrites.
- **Undecided / Editable Placeholders:** Final player count (default 27 + Marwan Serry), event dates ("Ramadan 2027" placeholder), venue, prize details, and sponsor tier packages ("Contact us" instead of prices) remain placeholders editable in Admin Settings.

## Capabilities and Constraints

- **3-Player Session Model:** Every game has exactly 3 players and 1 assigned scorer; multiple games can run concurrently on separate tables. Winner is determined by highest total points across ordered segments.
- **Grand Final Format:** 2 semi-finalists + Marwan Serry (`player-marwan`, host slot) in a 3-player Final.
- **Manual Buzzing:** The scorer taps who buzzed first on the Scorer Console; no contestant phone buzzers exist.
- **Scoring & Auditability:** Uniform Scorer v2 actions (`+1`, `−1`, Yellow card `−1`, Red card `−2`) with optional note and compensating undo; card counts derive separately from `ScoreEvent.kind`; every action writes an immutable event and `AuditEntry` with date and time and updates the leaderboard/results feed.
- **Flexible Bracket:** Admin-configurable player count, game size (default 3), and advancement per round (default demo: 27 players -> Round 1: 9 games, 1 advances each -> Round 2: 3 games, 1 advances each -> Semi-Final: 1 game, top 2 advance -> Final vs. Marwan Serry). Qualifying ties trigger an appended Tie-Breaker segment (#16).
- **No Public Registration & No Quiz:** Admins create/import player accounts; a separate randomized registration quiz is explicitly out of scope and must not appear anywhere.
- **Role-Based Access (Mock Auth):** Demo account picker per role (`/login` plus quick presenter switcher) enforcing `Super Admin`, `Scorer`, `Check-In Staff`, `Content Manager`, `Player`, and `Public Visitor` permissions.

## Brand Commitments

- **Show Energy & Ramadan Context:** Bold, joyful "Casino El Al3ab" game-show personality with subtle Ramadan seasonal touches (lanterns/crescent) secondary to the show energy.
- **Bilingual First-Class Parity:** English (LTR) default with full Arabic (`ar`, RTL) toggle and mirrored layouts/directions across every screen, using Western numerals by default with an optional Arabic-Indic numeral setting.
- **Legal & Brand Safety (Strict):**
  - Use **Marwan Serry's name only as text**—never use photos of Marwan Serry or any real people (player avatars use generated geometric patterns/initials).
  - Do not copy or trace the real show's logo, lettering, artwork, or copy; all visuals, graphics, and segment descriptions are original.
  - Skill and trivia game-show framing only—never use real-money gambling language or imagery (no slot machines, 777, jackpots, or cash prizes).
  - Never invent real sponsor prices or claims; keep sponsor tiers and unconfirmed logistics clearly marked as placeholders.

## Evidence on Hand

- Seeded dataset in `src/lib/seed/index.ts`: 27 original fictional contestants + Marwan Serry host slot, 6 demo staff/player accounts, 4 rounds, 16 original bilingual segments across 5 categories, 14 tournament games in a live mid-tournament story (Round 1 mostly finished, Game 11 live in Round 2, Semi-Final and Final scheduled), sample score events, buzz events, and audit entries.
- Design system specification in `DESIGN.md` and implementation decisions in `ASSUMPTIONS.md`.

## Product Principles

1. **Right Tone per Surface:** Dramatic game-show spectacle on public showcase and Big Screen routes; calm, data-dense clarity in Admin tools; high-contrast, mistake-proof speed in the Scorer Console.
2. **Real-Time Multi-Screen Sync:** Every score, buzz, timer change, or segment transition immediately updates connected Big Screens and leaderboards.
3. **Complete Bilingual RTL Parity:** English and Arabic layouts, typography, directional icons, and interactive controls receive equal craft.
4. **Swappable Repository Boundary:** UI components never touch seed data or storage directly—all data flows through async repository contracts.
5. **Responsive Across All Viewports:** Deliberately designed layouts and touch ergonomics from 320px phones to 2560px monitors and 10m Big Screens.

## Accessibility & Inclusion

- Meet WCAG AA contrast on all real backgrounds; never rely on color alone for positive/negative point changes (always pair with `+`/`−` signs and icons).
- Minimum `44px x 44px` touch targets everywhere (`56px+` height on Scorer Console actions); minimum `16px` font size on form controls to prevent mobile auto-zoom.
- Full keyboard navigation with visible high-contrast focus indicators and explicit confirmation dialogs for destructive actions.
- Respect `prefers-reduced-motion` while preserving clear functional state feedback; no auto-playing audio.
