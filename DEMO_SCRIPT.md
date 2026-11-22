# 6-Minute Pitch & Operations Walkthrough — Casino El Al3ab Ramadan Tournament (`DEMO_SCRIPT.md`)

> **Version:** `v0.1.2-quiz-demo` (Registration Quiz Demo Module + Change Request 1 720-player scale, Groups + 1v1 Knockouts + 1v1v1 Marwan Final, Scorer Console v2, Player Privacy & Avatars, Event-Sourced Engine & 14-Invariant Consistency Check)
> **Audience:** Marwan Serry & tournament operations team
> **Goal:** Prove in 6 minutes that the platform combines **broadcast-grade TV energy** with **bulletproof 720-player operations**, zero-mistake live judging (`+1`/`−1`/Yellow/Red/Walkover/Contact), strict player segment secrecy, automatic data consistency, and a show-stopping **Grand Final seat waiting for Marwan Serry**.

---

## Pre-Pitch 2-Minute Setup Checklist

Complete these steps **before** walking into the room:

1. **Open Two Browser Windows (same browser profile so post-commit `BroadcastChannel` syncs):**
   - **Window A (Presenter Laptop):** Open `/` (your deployed URL, or `http://localhost:3000` if offline).
   - **Window B (2nd Display / Projector — or side-by-side split screen):** Open `/scorer` to note the first **LIVE** Group 13 match ID (e.g. `/screen/<liveMatchId>`) and press **`F`** to enter chromeless **Presenter Mode** (auto-hides cursor & control pill after 2.2s; move mouse or press `Esc` to bring controls back).
2. **Reset to Factory 720-Player Demo State:**
   - Visit `/admin/settings` → click **720 Players (Default)** or **Reset Demo Data** → confirm.
   - Verify **240 groups**, **975 tournament matches** scheduled conflict-free across **12 tables**, Groups 1–12 completed (including a 3-way group cycle and an absence walkover), and **3 Group matches LIVE** right now.
   - *(Tip: If you want to play through an entire tournament end-to-end live in 90 seconds during Q&A, load the **12 Players** preset in `/admin/settings`.)*
3. **Confirm Starting State:**
   - Active role in top-right badge: **Admin (Super Admin)** (lets you switch to Judge, Gate Staff, or Contestant in 1 click).
   - Language: **English (`EN`)** on `/` (you will toggle live to **Arabic RTL (`عربي`)** during the demo).

---

## Minute-by-Minute Walkthrough (6:00 Total)

### 0:00 – 0:45 · The Hook: Final Night Showcase & Embedded Live Demo (`/` → `/#live-demo`)

- **Screen:** Start at **`/`**, then click **"See the live demo"** (`/#live-demo`).
- **Do these 3 clicks live (15 seconds):**
  1. Tap **"Buzzed First"** on a contestant → watch the right **Mini Big Screen** flash the gold buzzer alert instantaneously.
  2. Tap **`+1`** and **`Yellow (−1)`** → point out the crisp SVG card counter and instant score update.
  3. Tap **`Undo`** → watch it revert cleanly via a compensating event without deleting history.
- **What to say:**
  > *"Marwan, this isn't a slide deck — this is the live platform built to run a full 720-player Ramadan Casino El Al3ab championship. Players battle through 240 groups and a 256-slot knockout tree until the last two survivors take the stage to face **you** in the Golden Seat. Every date, venue, and sponsor package is an editable placeholder we finalize together."*

---

### 0:45 – 1:45 · 720-Player Scale: Groups, Standings & 256-Slot Knockout Tree (`/groups` → `/bracket`)

- **Click path:**
  1. Open **`/groups`**: Scroll smoothly through **240 virtualized groups of 3**, type `12` in **Jump to Group #**, and open a completed group to show 1v1 round-robin standings, tie-break indicators (Group Points → H2H → Net Diff → Fewer Cards), and the qualifier badge.
  2. Open **`/bracket`**: Switch between **Knockout Bracket** and **Group Stage** tabs. Demonstrate **Region Focus** (`Final 16 → Marwan`, `Quarter 1–4`, `Full (256-Slot)`), drag to pan with the corner **Minimap**, point out the **16 visible BYE nodes** awarded to the best group winners, and type a player name into **Highlight Player Path** (searchable 720-player combobox).
- **What to say:**
  > *"Even at 720 players and 975 matches across 12 tables, every screen stays silky smooth on phones and laptops. Groups run 1v1 round-robin, draws are forbidden, and non-power-of-two knockouts automatically award visible BYEs to the strongest group winners."*

---

### 1:45 – 3:15 · Scorer Console v2: `+1`/`−1`, Yellow & Red Cards, Contact Dialog, Walkover & Tie-Breaker (`/scorer/[matchId]` ↔ `/screen/[matchId]`)

- **Action (Window A on `/scorer/[liveMatchId]`, Window B on `/screen/[liveMatchId]`):**
  1. **Scoring v2 & Cards:** Tap **"Buzzed First"**, then tap **`+1`**, **`−1`**, **Yellow card (`−1`)**, and **Red card (`−2`)** (add an optional note like `"Late answer"`). Point out:
     - Exact 4 controls — zero custom number clutter, `>= 56px` touch targets, one-handed Sticky Thumb Dock on phones.
     - Original **SVG Yellow & Red card counters** updating live on both the Scorer Console and the Venue Big Screen!
  2. **Role-Gated Contact Dialog:** Tap the **Contact** icon beside either player → show the sticker contact dialog (phone `tel:`, WhatsApp, email, 1-click copy). Point out that only the assigned judge, check-in staff, and Super Admin can open this — and every view is automatically logged in the audit trail as `contact.viewed`.
  3. **Arabic RTL Toggle:** Click **`عربي`** → show full RTL mirroring, `Lalezar` + `Cairo` Arabic typography, and `"بطاقة صفراء (−١)"` / `"بطاقة حمراء (−٢)"` labels live on both windows.
  4. **Tie-Breaker & Automatic Revert Cascade (Fixing the Client's Bug):**
     - Finish a match with a tie → watch the console block the draw and automatically trigger **Tie-Breaker #16 (`needsTieBreak`)**. Break the tie and finish → winner badge & group standing update immediately.
     - Open **History** (as Super Admin) → **Revert** the winner's points so second place takes the lead → watch the **Winner tag, Group Standing, Qualifier, and Bracket Slot** move automatically in real time! *(If a downstream knockout match already started, show the **Cascade Impact Preview** modal asking whether to `Invalidate for Replay` or `Mark Needs Review` — never silently corrupting history.)*
  5. **Walkover (`Mark Absent`):** Open any scheduled 1v1 match → tap **Mark Absent** on one player → confirm → show the immediate **`WALKOVER`** badge, `+3` group points awarded to the present opponent, and automatic standings update (with Super Admin **Reverse Absence** available if the player arrives late).

---

### 3:15 – 4:15 · Contestant Portal: Table #, Judge Help Card, Segment Secrecy & 3D/Photo Avatars (`/player`)

- **Click path:**
  1. Open the top-right **Role Switcher** → switch to a **Contestant** (or stay as Super Admin using the Contestant Preview bar at **`/player`**) and select a player with an **Upcoming** match.
  2. Point out all 4 client requirements in one glance:
     - **Prominent Table Number (`TABLE #N`)** + Date/Call Time + Round/Group + Opponent card.
     - **"Need help finding your table?" Judge Help Sticker Card** with their assigned judge's name and 1-tap **Call / WhatsApp** buttons.
     - **Strict Segment Secrecy:** Zero upcoming or live segment names, counts, or rules appear anywhere on the player view (enforced in the repository layer — segments only reveal after a match finishes in `/player/history`).
     - **Avatar Studio:** Click **Edit Avatar** → showcase the **24 original 3D game-show & Ramadan avatars** AND the **Photo Upload / Camera tab** with interactive drag/zoom square crop & automatic `<= 300KB` compression.

---

### 4:15 – 5:15 · Admin Operations, Results Feed & 9-Invariant Consistency Check (`/admin/*`)

- **Click path (15-second stops):**
  1. **`/admin/check-in`**: Show paginated Today's Tables + All 720 Players search with 1-tap Check In / Absent + Contact icon.
  2. **`/admin/results`**: Point out every finished match (`NORMAL` / `WALKOVER`) and every score/card event (`Yellow card (−1)`, `Red card (−2)`) ordered chronologically with exact **date, time, note, and judge** + searchable player filter + **Export CSV**.
  3. **`/admin/consistency`**: Click **Run Consistency Check** → show **`ALL 9 INVARIANTS PASS · 0 Violations`** (with 1-click **Repair by recomputation** ready if ever needed).
  4. **`/admin/audit`**: Open **Inspect Diff** on an automatic cascade or `contact.viewed` record to show full accountability.

---

### 5:15 – 6:00 · The Close: Grand Final vs. Marwan Serry & Sponsor Tiers (`/final` → `/screen/[finalMatchId]` → `/sponsors`)

- **Click path:**
  1. Navigate to **`/final`**: Show the Final Night showcase with countdown, Marwan Serry centered in the **Golden Seat** (name only, zero real-person photos), live **Road to the Final**, and the **"Surprise Championship Lineup"** card (protecting Final segment secrecy until played).
  2. Click **"Launch Final Big Screen"** (`→ /screen/[finalMatchId]`): Pause on the crimson-and-gold marquee broadcast frame placing **Marwan Serry** dead-center between the two finalists (`1v1v1`).
  3. Switch to **`/sponsors`**: Show the 4 editable placeholder sponsor tiers (**Presenting**, **Final Night**, **Segment**, **Community**) + deliverables comparison matrix (`"Contact us"`, zero hardcoded prices).
- **Closing line:**
  > *"Everything you just saw runs end-to-end at 720-player scale with zero manual spreadsheet math, zero leaked segments, full Arabic RTL, and 9 automated data-integrity checks on every single tap. All that's left is plugging in our production database, confirming the Ramadan 2027 dates and sponsor tiers, and putting you in that Golden Seat on Final Night."*

---

## Bonus Module Demo (2:00) · Registration Qualification Quiz (`/quiz` → `/admin/quiz*`)

Use this flow when showing the client how **1,200+ public applicants** are screened fairly into the **720-player Ramadan tournament** (note the persistent **`DEMO MODE`** honesty pill on every quiz screen):

1. **Applicant Sprint (Phone-First, Arabic-First RTL — `/quiz` → `/quiz/play`):**
   - Open **`/quiz`** (defaults to **Arabic RTL**, with `EN | عربي` toggle in the header). Point out the live time window countdown, `20 Questions × 10s`, `Top 720 Qualify`, and the **`DEMO MODE`** pill.
   - Click **"ابدأ الاختبار الآن" / "Start Qualification Quiz"** → register a test applicant → point out the WhatsApp/SMS verification wording and visible Demo OTP **`123456`** (1-tap **Fill Code**) → review the plain rules → trigger the **3-2-1 countdown**.
   - On **`/quiz/play`**: show the huge circular **10-second Stage countdown** (shifts to white flash pulse in final 3 seconds), 4 large thumb-friendly answer buttons (or desktop keys `1`–`4`), neutral **"Answer recorded"** feedback (never reveals right/wrong), and **hit F5 refresh** mid-question to prove the clock resumes from the stored deadline without restarting to 10s!
   - Point to **`/quiz/how-it-works`** as a 1-page pitch explainer contrasting Browser Demo Mode vs. Production Server Architecture.
2. **Admin Quiz Studio & Idempotent Handoff (`/admin/quiz` → `/admin/quiz/questions` → `/admin/quiz/results`):**
   - Open **`/admin/quiz`**: Show **1,200 seeded applicants**, completion rate, average score, and the **Score Distribution Histogram** with the dashed **Cutoff #720** line.
   - Open **`/admin/quiz/questions`**: Show all **64 original bilingual questions** marked **`Draft · Needs Human Review`** (also accessible to the **Content Manager** role, who is blocked from seeing applicant contacts/results), click **Preview** to demonstrate deterministic option shuffling, and click **Import CSV → Load Sample CSV** to show row-by-row validation.
   - Open **`/admin/quiz/results`**: Click **"Jump to Cutoff (#720)"** to snap straight to the visible cutoff divider inside the 1,200-row virtualized table; click **Timeline** on a flagged applicant to show honest **"Client-side signals (demo)"** counts, the 20-question event timeline, and the audited Super Admin **Reset Attempt** action.
   - Click **"Send Qualified to Tournament"**: Show the **Impact Preview** (`715 new players`, `5 existing roster duplicates skipped`, `0 conflicts`), confirm handoff, then click it a **second time** to prove **0 new players / 720 already handed off** (100% idempotent) and check **`/admin/consistency`** (`ALL 14 INVARIANTS PASS · 0 Violations`).

---

## Quick Q&A Cheat Sheet

| If Marwan / his team asks… | Show & Say |
|---|---|
| **"What if we run 12, 48, 300, or 720 players, or advance 2 per group?"** | Open **`/admin/settings`** → adjust `Total Players`, `Group Size`, `Advance per Group`, `Tables`, or `Slot Minutes` to preview live group/knockout/BYE math, or load the **12 / 48 / 720** presets in one click. |
| **"What if a judge made a scoring mistake after the match finished?"** | Open **History** in `/scorer/[matchId]` as Super Admin → **Revert** or **Edit** the entry. Winner, group standings, qualifiers, and scheduled bracket slots update automatically — and if a downstream match already started, **Impact Preview** protects it instead of corrupting history. |
| **"Can players peek at the questions or segments before their match?"** | No — `matchRepo` and `scoreRepo` strip all segment data for unfinished matches at the permission layer across `/player`, `/schedule`, `/bracket`, `/groups`, `/segments`, and `/final`. |
| **"How fast does it move from prototype to production?"** | The entire pure tournament engine (`/lib/engine`) and UI stay unchanged; only IndexedDB storage, server command handlers, auth, and hosted WebSockets swap in (documented in `README.md` and `TODO.md`). |
| **"Can you add TV confetti, sound effects, and 3D card flips later?"** | Yes — **Phase 10 Delighters** is pre-wired behind `settings.delightersEnabled` (currently `off` for this clean base milestone) with `/lib/feedback` and animation hooks ready. |

---

## Offline / Internet-Failure Fallback Plan

Because `v0.1.1-client-feedback-1` uses **zero backend API calls**, persists all 720 players & 975 matches locally in **IndexedDB** (`casino_el_al3ab_idb_v1`), and self-hosts its Google Fonts inside the Next.js production build, the **entire platform runs 100% offline** from your laptop!

### Before You Leave for the Meeting (1-Time Prep on Wi-Fi)

```bash
npm install
npm run build
```

Verify once offline (`npm run start` → `http://localhost:3000`): every route, font, 3D avatar, IndexedDB store, and two-window `BroadcastChannel` sync works 100% offline.

### Instant Recovery Table

| Failure Scenario | Instant Fallback Action |
|---|---|
| **1. Venue Wi-Fi fails mid-pitch** | Switch browser tab to **`http://localhost:3000`** (keep `npm run start` running in a minimized terminal). 100% of features work identically offline. |
| **2. Second display / projector HDMI drops** | Snap windows side-by-side (`Win + Left` for `/scorer/[matchId]`, `Win + Right` for `/screen/[matchId]`) or use the single-screen embedded demo at **`/#live-demo`**. |
| **3. Demo state gets messy during Q&A** | Click **`Reset Demo Data`** (or load `12` / `48` / `720` preset) in `/admin/settings` → clean state restored in ~1 second with 0 invariant violations. |
| **4. Browser tab refreshed or closed** | IndexedDB (`casino_el_al3ab_idb_v1`) preserves exact state across refreshes and restarts automatically. |
