# 5-Minute Pitch Walkthrough — Casino El Al3ab Ramadan Tournament (`DEMO_SCRIPT.md`)

> **Audience:** Marwan Serry & team (prospective celebrity sponsor and Final Night 3rd player)
> **Goal:** Convince Marwan in 5 minutes that the tournament has broadcast-grade energy, zero-mistake live operations, bilingual (EN + Arabic RTL) polish, and a show-stopping **Grand Final seat waiting for him**.

---

## Pre-Pitch 2-Minute Setup Checklist

Complete these steps **before** walking into the room:

1. **Open Two Browser Windows (same browser profile so `BroadcastChannel` syncs):**
   - **Window A (Main Presenter Screen / Laptop):** Open `/` (your deployed Vercel URL, or `http://localhost:3000` if offline).
   - **Window B (Optional 2nd Display / Projector — or side-by-side split screen):** Open `/screen/game-11` and press **`F`** to enter chromeless **Presenter Mode** (hides cursor & control pill after 2s; move mouse or press `Esc` to bring controls back).
2. **Reset to Factory Demo State:**
   - Visit `/admin/settings` → click **Reset Demo Data** → confirm.
   - Verify **Quarter-Final B (`game-11`)** is **LIVE** (`Karim Nabil 30`, `Khaled Mansour 15`, `Nour El-Din Hesham 15`, Karim buzzed first).
3. **Confirm Starting State:**
   - Active role in top-right badge: **Admin (Super Admin)** (lets you jump into any view without login friction).
   - Language: **English (`EN`)** on `/` (you will flip live to **Arabic RTL (`عربي`)** during the pitch).
   - Disable browser notifications / Do Not Disturb ON.

---

## Minute-by-Minute Pitch Script (5:00 Total)

### 0:00 – 0:45 · The Hook: Final Night Showcase & The Golden Seat (`/`)

- **Screen:** Start at **`/`** (above the fold).
- **What to point at:**
  - The crimson sunburst Stage hero headline: **"The Final. Two Finalists. One Marwan Serry."**
  - The countdown timer (`PLACEHOLDER DATE` badge clearly shown) and the **3-Seat Final Card** with marquee bulbs placing **Marwan Serry in the Golden Seat** opposite two open Semi-Finalist qualifiers.
- **What to say:**
  > *"Marwan, this isn't a slide deck — this is the live tournament platform we built for the Ramadan Casino El Al3ab championship. Twenty-seven challengers battle across 3-player trivia, music, and speed tables all Ramadan — and the entire bracket funnels into one Finale: the last two survivors take the stage to play **against you** in the Golden Seat. Every date, venue, and prize you see is an editable placeholder we finalize together."*

---

### 0:45 – 1:45 · Instant Wow: Embedded Live Demo Right on the Landing Page (`/#live-demo`)

- **Click:** Click the gold **"See the live demo"** button (smooth-scrolls to **`#live-demo`**).
- **Do these 3 clicks live (takes 20 seconds):**
  1. On the left **Mini Scorer Console**, tap **"Buzzed First"** on **Omar Hassan** → point to the right **Mini Big Screen** flashing **`Omar Hassan BUZZED FIRST!`** instantaneously.
  2. Tap **`+1`** (emerald plus) or **`Yellow (−1)`** → watch Omar's score and SVG card counters update live and reorder the board.
  3. Tap **`Undo`** → watch it cleanly revert in one tap. *(Optional: click **"Pop Out Big Screen Tab"** if presenting on two monitors.)*
- **What to say:**
  > *"Every match table runs on this exact engine. There are no fragile phone buzzers to break on set — each table has one dedicated judge on an iPad. The moment they tap who buzzed first and award +1, −1, or a Yellow/Red card, the venue Big Screen and live leaderboard react in real time. And if a judge makes a mistake under studio pressure, Undo reverts it cleanly without erasing history."*

---

### 1:45 – 3:00 · The Core Product: Real Scorer Console ↔ Venue Big Screen + Arabic RTL + Tie-Breaker

- **Action (Window A + Window B side-by-side, or switch tabs):**
  1. In Window A, open the top-right **Role Switcher** → click **Scorer Console** (opens **`/scorer/game-11`**, **Quarter-Final B — LIVE**).
  2. Put Window B (**`/screen/game-11`**) beside Window A (or on the room TV/projector).
  3. **Demonstrate live scoring + sync:**
     - Tap **"Buzzed First"** on **Khaled Mansour** → Window B immediately highlights Khaled in gold with the broadcast lower-third ribbon!
     - Tap **`+10`** and **`+5`** → Khaled jumps from `15` → `30`, tying Karim Nabil (`30 vs 30`)!
  4. **Demonstrate Arabic RTL live:**
     - Click **`عربي`** in the top-right pill on **both** windows (or Window B alone) → point out instant full RTL mirroring, `Lalezar` + `Cairo` Arabic game-show typography, and dual-language segment titles (`أسئلة أفلام ومسلسلات مصرية`).
     - Switch back to **`EN`** (or stay in Arabic if Marwan prefers!).
  5. **Demonstrate Automatic Sudden-Death Tie-Breaker (#16):**
     - With Karim (`30`) and Khaled (`30`) tied for 1st, click **`Finish Game`** → confirm!
     - **Boom:** Instead of letting a tie slip through, the system **automatically inserts Segment #16 (`Tie-Breaker and Penalty Challenge`, 30s)** and fires the **`SUDDEN-DEATH TIE-BREAKER!`** alert across the Big Screen!
     - Tap **Buzzed First** on **Karim** → tap **`+15`** → click **`Finish Game`** → confirm!
     - Watch the Big Screen explode into the **Victory Stage Champion Celebration** AND note the toast confirming Karim **automatically advanced to the Semi-Final**!
- **What to say:**
  > *"Here's the real production console running Quarter-Final B in real time with the 10-meter Venue Big Screen. Notice we can switch the entire studio between English and full Arabic RTL in one tap. Watch what happens if two players tie for first when we finish the match: the system blocks any human error, automatically injects a 30-second Sudden-Death Tie-Breaker segment on both screens, and the moment we break the tie, it crowns the winner and advances them straight into the Semi-Final."*

---

### 3:00 – 4:00 · Tournament Operations, Roles & Audit Accountability (`/bracket` → `/admin`)

- **Click path (rapid 15-second stops):**
  1. **`/bracket`**: Show the full 27-player connected bracket (Karim's advancement already reflected live!). Click any table node to show the segment-by-segment score modal, or pick **Omar Hassan** in **Highlight Player Path**.
  2. **`/screen/leaderboard`** *(quick 5-second peek)*: Show the 10m-legible Top-3 Podium + auto-cycling Ranks #4–#27 broadcast screen.
  3. **`/admin`** (Overview Dashboard): Show the calm Paper control room — casino-chip counters, live stage status, and recent results feed.
  4. **Click `/admin/results`**: Point out every finished game and every `+`/`−` score event ordered chronologically with exact **date, time, segment, note, and scorer** + 1-click **Export CSV**.
  5. **Click `/admin/audit`**: Click **Inspect Diff** on any entry to show the before/after record. Briefly open the **Role Switcher** dropdown to show the 4 distinct manager roles (`Super Admin`, `Table Scorer`, `Gate Check-In`, `Content Editor`) + `Contestant` portal.
- **What to say:**
  > *"Behind the scenes, you and your producers have complete operational control. Every role only sees what they need — Scorers can't touch other tables or the bracket, Gate Staff only mark check-ins, Content Editors update announcements and sponsors, and every single result reaches the Admin Results Feed in exact chronological order with date, time, and a tamper-evident audit trail."*

---

### 4:00 – 5:00 · The Close: Final Night Spotlight & Sponsor Tiers (`/final` → `/screen/game-14` → `/sponsors`)

- **Click path:**
  1. Navigate to **`/final`**: Show the dedicated Final Night showcase — countdown, Marwan Serry centered in the Golden Seat, live **Road to the Final**, and the 8 championship segments.
  2. Click **"Launch Final Big Screen"** (`→ /screen/game-14`): Pause for 5 seconds on the crimson-and-gold marquee broadcast screen reading **`THE GRAND FINAL vs. MARWAN SERRY / النهائي الكبير ضد مروان سري`** with Marwan dead-center between the two finalists.
  3. Switch to **`/sponsors`**: Show the 4 editable placeholder partnership tiers (**Presenting Partner**, **Final Night Partner**, **Segment Partner**, **Community Partner**) + deliverables comparison matrix — zero hardcoded prices, `"Contact us"` CTAs ready for his brand partners.
- **Closing line:**
  > *"Everything you just saw is already working end-to-end — players, flexible brackets for any size, live scoring, big screens, Arabic and English, results tracking, and full sponsor integration. All that's left is plugging in our database, locking the Ramadan 2027 dates and sponsor tiers, and putting you in that Golden Seat on Final Night. What would you want to customize first?"*

---

## Quick Q&A Cheat Sheet

| If Marwan / his team asks… | Show & Say |
|---|---|
| **"Can we run 18, 27, or 36 players instead?"** | Open **`/admin/bracket`** → click `18P`, `27P`, or `36P` presets to show the live round topology calculator and 1-click bracket generation. |
| **"What if a scorer awards points to the wrong player 3 segments ago?"** | Open **`History`** inside `/scorer/game-11` as Super Admin → show inline Edit, Revert, Delete, and Reopen Finished Session (every override logged in `/admin/audit`). |
| **"Can our team edit dates, venue, rules, and sponsors ourselves?"** | Open **`/admin/settings`**, **`/admin/content`**, and **`/admin/sponsors`** — every placeholder text updates live across the entire site in EN and AR. |
| **"How fast does it go from prototype to live production?"** | All UI screens talk exclusively to `/lib/repos` and `/lib/realtime`. Swapping to PostgreSQL/Supabase + hosted WebSockets requires zero UI rewrites (documented in `README.md` and `TODO.md`). |
| **"Can you add even more TV spectacle later (confetti, sound, 3D cards)?"** | Point to **`Phase 10 Delighters`** in `/admin/settings` — intentionally held off for this clean base review, with animation/sound/haptic hooks already wired. |

---

## Offline / Internet-Failure Fallback Plan

Never let venue Wi-Fi ruin a celebrity pitch. Because `v0.1-pitch` uses **zero backend API calls** and self-hosts its Google Fonts inside the Next.js build, the **entire platform runs 100% offline** from your laptop!

### Before You Leave for the Meeting (1-Time Prep on Wi-Fi)

```bash
# Run once while online so dependencies and production assets are cached on disk
npm install
npm run build
```

Verify once offline (turn Wi-Fi off temporarily):

```bash
npm run start
# Open http://localhost:3000 — every route, font, SVG, repo, and BroadcastChannel works 100% offline!
```

### Failure Scenarios & Instant Recovery

| Failure Scenario | Instant Fallback Action |
|---|---|
| **1. Venue Wi-Fi fails or drops mid-pitch** | Switch your browser tab from the Vercel URL to **`http://localhost:3000`** (keep `npm run start` running in a minimized terminal before entering the room). 100% of features — including two-window `BroadcastChannel` sync, Arabic RTL, CSV export, and Reset Demo Data — work identically offline. |
| **2. Second display / projector HDMI drops** | Use **Window Snap (Side-by-Side)** on your laptop screen (`Win + Left` for `/scorer/game-11`, `Win + Right` for `/screen/game-11`), OR fall back to the embedded split-screen Live Demo right on **`/#live-demo`** which puts both the Mini Scorer and Mini Big Screen on a single screen. |
| **3. Demo state gets messy during Q&A / improvisation** | Click **`Reset Demo Data`** at the bottom of the Admin sidebar (or `/admin/settings`) → confirm → in **2 seconds** all 27 players, Quarter-Final B live scores, and the Grand Final return to the spotless pitch state. |
| **4. External Google Fonts blocked on corporate firewall** | `next/font/google` bundles the WOFF2 font files directly into `.next/static/media` at build time, so **Lilita One, Bebas Neue, Inter, Lalezar, and Cairo** still render cleanly with zero external network calls. |
| **5. Browser tab accidentally closed or refreshed** | All data persists in `localStorage` (`casino_el_al3ab_db_v1`), so reopening the URL restores the exact match state immediately without losing your place. |
