# AGENTS.md — Project Context (READ THIS FIRST, EVERY SESSION)

> Also read `DESIGN.md` before building any UI.
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
| Points plus / minus | Scorer adds or subtracts points: presets per segment + free input, with note |
| Time | A timer per segment/game, and a date and time on every record |
| History tracker | (a) Player history across games, (b) Admin audit log of every action |
| Every result reaches me in order with date + time | Results feed, newest first, with date and time, visible to admins |
| Session | A "Game" = one 3-player session with a scorer, made of ordered segments |
| Profile | Player profile with stats and history; manager profile |

A separate **registration quiz** (20 questions, 10 seconds each, randomized) was mentioned. **It is OUT OF SCOPE for now.** Do not build it. Do not leave dead links for it. A later project will handle it.

## 3. Current direction (decided so far; the product owner can change or add to any of it at any time)

> This list is the **starting point, not a cage**. The scope is still growing. When the product owner asks for something new or different, do it: update this file and `ASSUMPTIONS.md` to match, then continue. Do not refuse a change because it contradicts this list.

- **Every game has exactly 3 players and 1 scorer.** The winner is whoever has the **highest total points across segments**.
- **The final = 2 finalists + Marwan Serry** (still a 3-player game).
- **Bracket is flexible.** The admin sets the number of players, group/game sizes (default 3 per game) and how many advance each round. Default demo: **27 players**: Round 1 = 9 games, winners advance (9) → Round 2 = 3 games, winners advance (3) → Semi = 1 game, **top 2 advance** → Final with Marwan.
- **Players are added by admins** (create accounts, optionally bulk import from CSV).
- **Buzzing:** the **scorer taps who buzzed first**. No phone buzzers.
- **Each game has its own scorer** (several games can run at the same time, each with their own scorer).
- **Points:** presets per segment (like +10, +5, -5) **plus** free number input, with an optional note and an undo.
- **Language:** English first, **Arabic toggle with full RTL**.
- **Public spectator pages** exist: bracket, live leaderboard, schedule, rules, sponsors, the final.
- **Look:** Ramadan casino night. See `DESIGN.md`.
- **Pitch page** order: final-night showcase hero, then live demo, then sponsor tiers.

## 4. Roles and permissions

| Role | Can do | Cannot do |
|---|---|---|
| Super admin | Everything: players, managers, bracket, segments, settings, audit log, results feed | n/a |
| Scorer | See assigned games, run a game, tap buzz, add or subtract points, undo own last action, move to next segment | Edit bracket, players, settings, other scorers' games |
| Check-in staff | See today's games and players, mark players as checked in or absent | Change scores, bracket, settings |
| Content manager | Edit schedule, announcements, sponsors, rules text, segment descriptions | Change scores, bracket or players |

Players (login) see only their profile, history and upcoming games. Visitors see only public pages.
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

## 6. Data architecture (most important rule)

**No component or page may import mock data directly.** All reads and writes go through repository modules in `/lib/repos`:

```
/lib/schemas     Zod schemas + inferred TS types (single source of truth)
/lib/repos       playerRepo, gameRepo, roundRepo, segmentRepo, scoreRepo,
                 userRepo, auditRepo, sponsorRepo, contentRepo, settingsRepo
/lib/seed        seed data used to initialise storage on first load
/lib/storage     storage adapter (localStorage by default)
/lib/realtime    cross-window sync using BroadcastChannel (+ storage event fallback)
```

- Repos expose async functions (`list`, `get`, `create`, `update`, `remove`, plus domain methods like `applyScore`) so they can later be replaced by real database calls **without touching UI code**.
- Persist changes to localStorage so the demo feels real across refreshes.
- Provide a **"Reset demo data"** action in admin settings.
- Realtime: when the scorer changes a score, any open Big Screen or leaderboard window updates immediately (BroadcastChannel). Structure the realtime layer behind an interface so a hosted realtime service can replace it later for multi-device demos.

### Entities

- `Player`: id, fullName, nickname, avatarSeed, phone, email, status (registered | checkedIn | active | eliminated | finalist), seed, stats (gamesPlayed, wins, totalPoints), createdAt
- `User`: id, name, email, role (superAdmin | scorer | checkIn | content | player), playerId?, language
- `Round`: id, name (en, ar), order, advancePerGame, status (upcoming | live | done)
- `Game` (the "session"): id, roundId, tableName, scheduledAt, status (scheduled | live | finished), scorerUserId, playerIds[3], currentSegmentIndex, segmentIds[], winnerPlayerId?, isFinal, startedAt?, finishedAt?
- `Segment`: id, nameEn, nameAr, category (music | wordplay | popculture | general | special), descriptionEn, descriptionAr, durationSec?, presetPoints number[] (e.g. [10, 5, -5]), order
- `ScoreEvent`: id, gameId, segmentId, playerId, delta, note?, kind (preset | custom | undo), byUserId, createdAt (ISO). Every score change creates one. The leaderboard and history are derived from this table.
- `BuzzEvent`: id, gameId, segmentId, playerId, byUserId, createdAt
- `AuditEntry`: id, actorUserId, action (e.g. score.add, game.start, player.create, bracket.update, role.change), entityType, entityId, summary, before?, after?, createdAt
- `Sponsor`: id, name, tier, logoText (no real logos), blurb
- `ContentItem`: announcements, rules text, schedule blurbs
- `Settings`: eventName, eventDates (placeholder), venue (placeholder), prizeText (placeholder), language defaults, bracket config

## 7. Segments (draft library, confirm with client)

Seed these as editable `Segment` records (English / Arabic names). Default `presetPoints` = [10, 5, -5]; timers optional.

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
`/` pitch and landing · `/final` final night showcase · `/bracket` · `/leaderboard` · `/schedule` · `/rules` · `/segments` · `/sponsors`

**Auth (mock)**
`/login` with demo account picker per role

**Player**
`/player` (profile, stats, next game) · `/player/history`

**Scorer**
`/scorer` (my games) · `/scorer/[gameId]` (the scorer console, the core screen)

**Big screen**
`/screen/[gameId]` (live game for venue/stream) · `/screen/leaderboard`

**Admin**
`/admin` dashboard · `/admin/players` · `/admin/managers` · `/admin/bracket` · `/admin/games` · `/admin/segments` · `/admin/results` (results feed) · `/admin/audit` · `/admin/check-in` · `/admin/content` · `/admin/sponsors` · `/admin/settings`

### Scorer console requirements (the heart of the product)
- Shows the 3 players (name, nickname, avatar, running total), current segment name, segment timer (start/pause/reset), and segment progress (e.g. 4 of 12).
- **Big "Buzzed first" tap target per player.** Tapping records a `BuzzEvent`, highlights that player.
- **Preset point buttons** (from the segment) for the selected player: one tap applies. **Custom amount** input (positive or negative) with optional note. **Undo last action.**
- Next / previous segment, finish game (computes winner, handles tie by opening a Tie-Breaker segment), and confirm dialogs for destructive actions.
- Works well on a tablet in landscape and on a phone.
- Every action writes `ScoreEvent` / `BuzzEvent` + `AuditEntry` and broadcasts in realtime.

### Big screen requirements
- Broadcast-style layout: three player panels with animated score counters, current segment title (EN/AR), timer, and "buzzed first" highlight.
- Final mode: special styling with Marwan Serry's panel (name only, no photo) and the two finalists.
- Leaderboard view with animated rank changes.

### Results feed (admin)
Chronological (newest first, toggle oldest first) list of every finished game and every score event with **date and time**, filter by game, round, player, scorer. Export to CSV.

### Audit log (super admin)
Who did what, to what, when, with before/after for edits. Filter and export.

## 9. Demo seed data

- 27 players with original fictional names and nicknames (use these, adjust freely): Omar Hassan "The Fox", Youssef Adel "Joe", Mostafa Gamal "Tofa", Karim Nabil "K-Nab", Ahmed Samir "Sammoora", Mahmoud Fathy "Abu Fathy", Ali Tarek "Ali Baba", Hossam Ragab "Hoss", Ibrahim Zaki "Brahim", Khaled Mansour "Khaldoon", Tamer Essam "Timo", Sherif Magdy "Sheriff", Amr Wael "Amoora", Hany Salah "Hanoon", Walid Anwar "Wally", Mina Girgis "Mino", Fady Samy "Fadi", Nour El-Din Hesham "Nouro", Salma Reda "Salsabeel", Mariam Hatem "Mimi", Dina Yasser "Dodo", Farida Ashraf "Fofo", Nada Ehab "Nody", Yasmin Mourad "Yaso", Laila Kamel "Lulu", Rana Sherif "Rouny", Habiba Osama "Bibo". Demo managers: Super Admin "Admin", Scorers "Scorer 1" to "Scorer 4", Check-in "Gate Staff", Content "Content Editor", rounds as in section 3, 9 + 3 + 1 games, plus the final.
- State the demo story so every screen is populated: Round 1 mostly finished, Round 2 partly finished, one game **live**, others scheduled.
- A few history events per finished game so the feed and audit log look real.
- Placeholder event info: "Ramadan 2027", dates, venue and prize clearly marked as placeholders and editable in settings.

## 10. Legal and brand safety

- Use Marwan Serry's **name only** as text. **Do not use his photo or any photo of real people.**
- **Do not use the real show's logo, artwork, or text.** Do not use copyrighted images. Use original CSS/SVG graphics and generic icons.
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
7. **Definition of done for any screen:** no console errors, no lint or type errors, keyboard accessible, readable contrast, works in EN and AR, works at 390px and 1440px width, empty and loading states handled.
8. **Never invent real data** about real people or real prices. Placeholders must look like placeholders where it matters.
9. Do not build the registration quiz.
10. Ask the product owner a question only when a decision would be expensive to undo. Otherwise decide, document, continue.

## 12. Creative latitude and evolving scope (important)

- **Be a creative partner, not just an order-taker.** In every phase, add at least one idea the product owner did not ask for that would make the prototype more impressive or the event better (a delightful interaction, a smarter feature, a stronger visual moment, a better pitch touch). Build small ideas directly and mark them "Bonus idea" in `ASSUMPTIONS.md`. For bigger ideas, describe them in 2 to 3 lines and offer them as options.
- **Delighters are a separate FINAL phase (Phase 10).** The product owner will first show the client the complete base version, then add the wow layer. **Do not build anything from `DESIGN.md` section 11 (signature moments, 3D cards, confetti, sound, haptics, easter eggs, scroll storytelling, page transitions, etc.) until the product owner says "start Delighters".** Phases 1 to 9 should still look polished, premium and professional, using the baseline motion in `DESIGN.md` section 7.
- **Prepare hook points now so Delighters can be added later without rewrites:** wrap animatable UI in small reusable components (e.g. `AnimatedNumber`, `ChipBadge`, `PlayerPanel`), emit named events for key moments (`score.changed`, `buzz.recorded`, `segment.changed`, `game.finished`, `final.revealed`) through the realtime layer, add a no-op `feedback` service (`/lib/feedback`) with `play(name)` and `haptic(name)` stubs, and add a `delighters` setting (on/off) that defaults to **off** in Phases 1 to 9.
- **The scope will grow.** Expect new features, screens, roles, game formats and visual changes during the project. Design the code so additions are easy: modular components, repo layer, configurable bracket and segments.
- **Challenge and improve.** If you see a better approach than what is written here (UX, structure, naming, game flow), say so briefly and propose it. The product owner decides.
- **Everything marked "out of scope" or "decided" can be reopened** when the product owner asks. Until then, do not build the registration quiz.
- **Change protocol:** when scope changes, (1) update `AGENTS.md` sections affected, (2) note it in `ASSUMPTIONS.md` with the date, (3) check that existing screens, seed data and repos still work, (4) continue.
- The legal and brand-safety rules in section 10 stay, because they protect the product owner. Everything else is flexible.
