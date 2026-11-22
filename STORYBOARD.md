# STORYBOARD.md — Pitch Video Blueprint ("Casino El Al3ab" Ramadan Tournament)

> **Status:** Awaiting Product Owner Approval (Step 1 — no code or recordings built yet)
> **App Baseline:** `v0.1.1-client-feedback-1` (Base Version — Phase 10 Delighters OFF, Change Request 1 complete)
> **Audience:** Marwan Serry (prospective sponsor & Grand Final guest participant)
> **Goal:** Standalone pitch video proving that the real platform runs a 720-player Ramadan championship end-to-end — showing clearly what **each of the 5 entities** (*Admin, Scorer, Player, Big Screens, Public Fan View*) **sees**, **does**, and **is responsible for**, while spotlighting Marwan Serry's **Golden Seat** (name only, zero photos).

---

## 1. Locked Production Decisions (from Step 0)

| Setting | Decision |
|---|---|
| **Narration** | **Both English & Egyptian Arabic** — separate narrated exports (`en` + `ar-EG`), generated via TTS now with clean drop-in audio slots (`/video/public/audio/narration/{en,ar}/`) so you can swap in your own voice recording anytime. |
| **Captions** | **Separate burned-in exports** (English burned-in on EN video; RTL Arabic burned-in on AR video) **plus** sidecar `.srt` files (`main-en.srt`, `main-ar.srt`, `teaser-en.srt`, `teaser-ar.srt`). |
| **Music & SFX** | Upbeat TV game-show groove with warm Ramadan percussion accent + crisp UI/buzzer/chip/chime SFX (all royalty-free or original synthesized, logged in `/video/LICENSES.md`). |
| **Deliverables & Ratios** | **Main Pitch:** `3:12` (`192s`) in **16:9 1080p** (`1920×1080`, 30fps) — EN + AR editions.<br>**Vertical Teaser:** `1:08` (`68s`) in **9:16** (`1080×1920`, 30fps, phone-safe margins) — EN + AR editions.<br>**Extras:** 4 `.srt` caption files + `1920×1080` thumbnail PNG. |
| **App Build Recorded** | Current base version (`v0.1.1-client-feedback-1`, `delightersEnabled: false`). Real app footage only — zero faked or mocked UI. |
| **Scope Boundary** | Strictly the **5 headline entities** (Admin, Scorer, Player, Big Screens, Public Fan View). **Check-in Staff** and **Content Manager** are excluded to keep focus razor-sharp. Registration quiz is not mentioned. |
| **Extra Real-App Highlights Included** | 1) 9-Invariant Consistency Check (`/admin/consistency`), 2) 24-Avatar 3D library + square photo crop studio (`/player`), 3) 256-slot zoomable bracket with 16 visible BYEs & minimap (`/bracket`), 4) Live EN → Arabic RTL switch on phone & big screen. |
| **Brand Safety & Placeholders** | Marwan Serry appears as **text name only** (zero real-person photos). Zero real show logo/artwork; original sunburst, dice, cards, chips, Ramadan lanterns, and sticker typography (`Lilita One` / `Bebas Neue` / `Inter` + `Lalezar` / `Cairo`). Original logo-free phone & laptop frames. All placeholder dates (`Ramadan 2027`), venue, prize, and sponsor packages (`"Contact us"`, zero prices) clearly labeled. |

---

## 2. Deterministic Video Demo State (Hero Match Story)

To make every recording repeatable with one command (`video:record`), Step 2 will create a deterministic video seed (`videoDemoState`) built through the **real pure engine (`propagateWinners`)** with **0 invariant violations**:

- **Tournament Scale:** `720` players · `240` groups of 3 · `advancePerGroup: 1` · `pointsPerGroupWin: 3` · `12` tables · `30` min slots · `256`-slot knockout bracket with `16` visible BYEs + `1v1v1` Grand Final (`match-final`) with **Marwan Serry** (`isGuest: true`).
- **The Hero Match followed end-to-end in Section B:**
  - **Match ID:** `match-g1-m3` (**Group 1 · Match 3**, **Table #1**, Judge **Scorer 1**)
  - **Contestants:** **Omar Hassan ("The Fox" / عمر حسن "الثعلب")** (`player-1`) vs. **Mostafa Gamal ("Tofa" / مصطفى جمال "توفة")** (`player-3`)
  - **Stakes:** Both already beat Youssef Adel (`player-2`), so the winner of `match-g1-m3` wins **Group 1** (6 group pts) and completes the Group Stage — unlocking all 240 qualifiers (including the 16 best-winner BYEs) and slotting the Group 1 winner directly into their **Round of 256** knockout match!
  - **Live Score Arc:** Starts `0–0` → Buzz & `+1` exchanges → Mostafa receives **`Yellow card (−1): False buzz`** and **`Red card (−2)`** → Scorer demos **`−1`** + **`Undo`** (compensating event) and previews **`Mark Absent`** confirm dialog → Split-screen money shot ties match **`3–3`** → Draw blocked → **Sudden-Death Tie-Breaker #16** → Omar scores **`+1`** to win **`4–3`** → Omar advances to Round of 256!
  - **Fairness Moment Revert (B.6):** After Omar's Round of 256 match has started (`live`), Super Admin reverts Mostafa's erroneous **`Red card (−2)`** in `match-g1-m3` → real **`ImpactPreviewDialog`** pops up → Admin confirms **`Invalidate & Mark for Replay`** → score flips to **`Mostafa 5 – 4 Omar`**, automatically moving the **Winner tag**, **Group 1 #1 rank**, and **Round of 256 bracket slot** from Omar to Mostafa, verified at `/admin/consistency` (**9/9 invariants pass**).
- **Grand Final Showcase State (Scenes A & D):** A second deterministic checkpoint (`videoFinalState`, built cleanly via the real engine) where the 2 surviving finalists (**Omar Hassan** & **Salma Reda**) are seated beside **Marwan Serry** in **`match-final`** so `/final` and `/screen/match-final` show a live 3-panel `1v1v1` Grand Final broadcast with Marwan centered in the Golden Seat.

### Multi-Tab Live Sync Strategy
All Playwright recordings for Section B run inside **ONE shared Chromium browser context** (sharing IndexedDB `casino_el_al3ab_idb_v1` and `BroadcastChannel`), using a demo-only per-tab `?demoRole=` override stored in `sessionStorage` so **Admin**, **Scorer**, **Player**, **Big Screen**, and **Public Fan** stay open and live-synced simultaneously.

---

## 3. Main Pitch Video — Scene-by-Scene Storyboard (`3:12` / 16:9 1080p)

> **Lower-Third Convention:** Every entity screen displays a crisp sticker lower-third pill (bottom-start, RTL-mirrored in Arabic) naming the entity + one-line role (e.g. `ADMIN · Runs the tournament` / `الإدارة · تدير البطولة بالكامل`). Animated gold highlight rings and smooth subtle zooms call attention to the exact control clicked.

---

### ACT A — COLD OPEN (`0:00 – 0:18` · 18s)

#### Scene A1 · Final Night & The Golden Seat (`0:00 – 0:18` · 18s)
- **Entity Shown:** Pitch Showcase / Brand Open (no role lower-third yet)
- **Real App Footage:**
  - `0:00–0:08`: **`/`** (Landing Hero Stage) & **`/final`** (Final Night Showcase — countdown placeholder `Ramadan 2027`, crimson sunburst, golden marquee card showing 2 finalist seats flanking **Marwan Serry's Golden Seat** — **name only, zero photo**).
  - `0:08–0:18`: Slow push-in on **`/screen/match-final`** in broadcast frame showing Marwan Serry's elevated center seat, transitioning into the bold Remotion title card: **"CASINO EL AL3AB · RAMADAN TOURNAMENT"** (`كازينو الألعاب · بطولة رمضان`) with original floating dice, chips, playing cards, and subtle Ramadan lanterns.
- **Visual Highlights:** Gold highlight ring sweeps around the Golden Seat name plate (`Marwan Serry` / `مروان سري`); subtle pill notes `Placeholder Dates · Ramadan 2027`.
- **Narration (EN — 40 words):**
  > "Imagine Ramadan night. Seven hundred and twenty players started this tournament. Only two survived. Waiting in the Golden Seat on Final Night… is Marwan Serry. This is the live platform built to run the entire championship — from draw to finale."
- **Narration (AR — Egyptian Arabic — 37 words):**
  > "تخيّل ليلة النهائي في رمضان. سبعمية وعشرين لاعب بدأوا البطولة، واتنين بس وصلوا للآخر. واللي مستنّيهم على الكرسي الذهبي… مروان سري. دي المنصة الحقيقية اللي هتدير البطولة كلها من أول قرعة لحد آخر نقطة."

---

### ACT B — "ONE MATCH, FIVE PERSPECTIVES" (`0:18 – 2:08` · 110s)

*Section bumper (`0:18–0:20`, 2s): Bold gold-on-crimson transition card — **"ONE MATCH · FIVE PERSPECTIVES"** (`مباراة واحدة · خمس زوايا`) introducing **Group 1 · Match 3 · Table #1 (Omar Hassan vs. Mostafa Gamal)**.*

---

#### Scene B.1 · ADMIN — Tournament Settings, Draw & Auto-Schedule (`0:20 – 0:36` · 16s)
- **Entity Shown:** **ADMIN** — Lower-third: `ADMIN · Configures rules, draws groups & schedules every table` / `الإدارة · تضبط القواعد، تسحب القرعة، وتجدول الطاولات`
- **Real App Footage (Desktop `1920×1080` inside original logo-free laptop frame → full bleed):**
  - `0:20–0:25`: **`/admin/settings`** — Highlight ring on adjustable parameters: `720 Players`, `Group Size: 3`, `Advance: Top 1`, `12 Tables`, `30-min Slots` + live blueprint preview (`240 Groups · 256-Slot KO · 16 BYEs`).
  - `0:25–0:31`: **`/admin/groups`** — Shows the 240-group grid, jumps directly to **Group 1** (Omar Hassan, Youssef Adel, Mostafa Gamal), highlighting round-robin 1v1 pairings.
  - `0:31–0:36`: **`/admin/matches`** — Highlights **Group 1 · Match 3** automatically assigned conflict-free to **Table #1**, time slot, and **Judge Scorer 1** (zero double-bookings).
- **Narration (EN — 35 words):**
  > "Everything starts with the Admin. Every number is adjustable — seven hundred and twenty players, groups of three, top one advances. One click draws all two hundred and forty groups and auto-schedules every table and judge without conflicts."
- **Narration (AR — Egyptian Arabic — 33 words):**
  > "كل حاجة بتبدأ من الإدارة. كل رقم قابل للتعديل: سبعمية وعشرين لاعب، مجموعات من تلاتة، والأول يتأهل. بضغطة واحدة بتتسحب القرعة، وتتوزع الماتشات على الطاولات والحكام تلقائي من غير أي تعارض في المواعيد."

---

#### Scene B.2 · PLAYER (Phone Frame) — Avatars, Table #, Surprise Segments & Judge Help (`0:36 – 0:54` · 18s)
- **Entity Shown:** **PLAYER** — Lower-third: `PLAYER · Checks table, keeps segments secret & calls the judge` / `المتسابق · يعرف طاولته، بدون تسريب الفقرات، ويتواصل مع الحكم`
- **Real App Footage (Phone `390×844 @3x` inside original logo-free phone frame on sunburst stage):**
  - `0:36–0:41`: **`/player`** (logged in as Omar Hassan via `?demoRole=player`) — Profile header with 3D avatar; brief tap on **Edit Avatar** showcasing the **24 original 3D avatars** + **Photo Upload / Camera** square crop (`<= 300KB`) studio, then closing back to profile.
  - `0:41–0:49`: Scrolls to **Upcoming Match Card** (`Group 1 · Match 3` vs. Mostafa Gamal) — Highlight rings on big casino-chip **`TABLE #1`**, date/time, and the clear **Segments Stay a Surprise** lock notice (zero upcoming segment names, enforced at the repository layer).
  - `0:49–0:54`: Taps the **"Need help finding your table?" Judge Help Card** (Call / WhatsApp buttons for Judge Scorer 1), followed by a crisp **EN → Arabic RTL (`عربي`)** toggle right on the phone!
- **Narration (EN — 40 words):**
  > "On his phone, the player picks from twenty-four 3D avatars or crops his own photo. He sees his opponent, call time, and Table One — never the upcoming segments, so every game stays a surprise — plus a Judge Help Card in English or Arabic."
- **Narration (AR — Egyptian Arabic — 38 words):**
  > "على موبايله، المتسابق بيختار من أربعة وعشرين أفاتار ثلاثي الأبعاد أو يرفع صورته. بيشوف منافسه، ميعاده، وطاولة رقم واحد — من غير ما يعرف الفقرات علشان تفضل مفاجأة — ومعاه كارت تواصل فوري مع الحكم، بالعربي أو بالإنجليزي."

---

#### Scene B.3 · SCORER — 1v1 Console v2, Cards, Buzz, Undo, Absent & Contact (`0:54 – 1:14` · 20s)
- **Entity Shown:** **SCORER** — Lower-third: `SCORER · Runs the table with fast, zero-mistake live controls` / `الحكم · يدير الطاولة بتحكم سريع ومنع الأخطاء`
- **Real App Footage (Desktop/Tablet `1920×1080`):**
  - `0:54–0:59`: **`/scorer/match-g1-m3`** (logged in as `user-scorer-1` via `?demoRole=scorer`) — Taps the **Contact button** beside Mostafa Gamal to call a late player → sticker **Player Contact Dialog** opens (Call, WhatsApp, Copy — automatically logged as `contact.viewed`), then closes.
  - `0:59–1:09`: Match is LIVE (`1v1` 2-panel console). Highlight rings trace each control as the judge taps: **Buzzed First** (gold glow), **`+1`**, **`−1`**, **Yellow card (`−1`)** with note `"False buzz"` (SVG yellow card icon increments), **Red card (`−2`)** (SVG red card icon increments), and **Undo** (appends compensating event without deleting history).
  - `1:09–1:14`: Quick tap on **Mark Absent** showing the confirmation dialog (explaining immediate walkover win in 1v1), then cancelling so the match plays on.
- **Narration (EN — 44 words):**
  > "At Table One, the Scorer runs a clean 1v1 console. Late player? Tap Contact — every view is audited. Live play has zero clutter: Buzzed First, plus one, minus one, Yellow and Red cards tracked as real card icons, one-tap Undo, and Mark Absent for walkovers."
- **Narration (AR — Egyptian Arabic — 42 words):**
  > "على طاولة واحد، الحكم شغّال على شاشة تحكم بسيطة وسريعة. لو لاعب اتأخر، بيدوس تواصل وكل عرض بيتسجل في السجل. وفي اللعب: مين داس الجرس الأول، زائد واحد، ناقص واحد، كارت أصفر وكارت أحمر بأيقونات واضحة، تراجع فوري، وتسجيل الغياب."

---

#### Scene B.3b · SPLIT-SCREEN MONEY SHOT — Instant Multi-Window Sync (`1:14 – 1:24` · 10s)
- **Entity Shown:** **SCORER + BIG SCREEN + PUBLIC FAN VIEW** (3 synchronized real recordings from ONE browser context, composited cleanly in a 3-pane broadcast layout!)
- **Real App Footage (Synchronized frame-locked capture via shared IndexedDB + `BroadcastChannel`):**
  - **Left pane (44%):** Scorer Console (`/scorer/match-g1-m3`)
  - **Top-right pane (56%):** Venue Big Screen (`/screen/match-g1-m3`)
  - **Bottom-right pane (Phone frame):** Public Fan View (`/groups?group=1`)
  - **Exact Synchronized Action:** Scorer taps **Buzzed First** on Mostafa Gamal, then taps **`+1`** (`2 → 3`, tying the match `3–3`). On the **exact same beat**:
    - Big Screen flashes Mostafa's golden **`BUZZED`** halo, ticks the giant score counter `2 → 3`, and slides in the broadcast lower-third ribbon!
    - Fan View on the phone updates live with zero page refresh!
- **Visual Highlights:** Animated electric-blue & gold pulse connectors arc from the Scorer tap outward to both the Big Screen and the Fan phone.
- **Narration (EN — 22 words):**
  > "Watch all three screens at once. One tap from the Scorer — the venue Big Screen and every fan's phone react instantaneously."
- **Narration (AR — Egyptian Arabic — 20 words):**
  > "شوف التلات شاشات مع بعض في نفس اللحظة. ضغطة واحدة من الحكم… شاشة المسرح وموبايل الجمهور بيتحدثوا فوراً في نفس الثانية."

---

#### Scene B.4 · BIG SCREEN — Arabic RTL, Sudden-Death Tie-Break, Winner & Leaderboard (`1:24 – 1:40` · 16s)
- **Entity Shown:** **BIG SCREENS** — Lower-third: `BIG SCREENS · Broadcasts live drama for the room & stream` / `شاشات العرض · تنقل حماس البث المباشر للجمهور والقاعة`
- **Real App Footage (Full-bleed `1920×1080` Broadcast Frame, Presenter Mode):**
  - `1:24–1:30`: **`/screen/match-g1-m3`** tied `3–3` → Scorer clicks Finish → Draw is blocked! Screen flips to **Sudden-Death Tie-Breaker #16 (`needsTieBreak`)**, and switches cleanly to **Arabic RTL (`عربي`)** showing **`جولة التحدي / الحسم`** with mirrored RTL layout and `Lalezar`/`Cairo` typography!
  - `1:30–1:35`: Omar scores the deciding **`+1`** (`4–3`) and match finishes → **Victory Stage Celebration** crowns **Omar Hassan** on the crimson-and-gold marquee screen!
  - `1:35–1:40`: Cuts to **`/screen/leaderboard`** — Top-3 Podium Spotlight + live auto-cycling ranked board (Marwan Serry excluded as guest).
- **Narration (EN — 35 words):**
  > "On the venue Big Screens, draws aren't allowed. A tied match automatically opens a sudden-death Tie-Breaker — fully mirrored in Arabic RTL — before crowning the winner and updating the live arena leaderboard."
- **Narration (AR — Egyptian Arabic — 33 words):**
  > "وعلى شاشات القاعة، التعادل ممنوع. أول ما النتيجة تتعادل، جولة الحسم الفاصلة بتتفتح تلقائياً — وبواجهة عربية كاملة من اليمين للشمال — لحد ما يتوَّج الفائز وتتحدث لوحة الصدارة قدام الجمهور."

---

#### Scene B.5 · PUBLIC FAN VIEW — Standings, Schedule & 256-Slot Zoomable Bracket (`1:40 – 1:52` · 12s)
- **Entity Shown:** **PUBLIC FAN VIEW** — Lower-third: `PUBLIC FAN VIEW · Live standings, schedule & interactive bracket` / `عرض الجمهور · متابعة الترتيب، الجدول، وشجرة البطولة مباشرة`
- **Real App Footage (Dual device composition: Phone `390×844 @3x` + Laptop `1920×1080`):**
  - `1:40–1:46`: **Phone frame** — **`/groups?group=1`** showing updated **Group 1 Standings** (Omar Hassan #1 Qualified with 6 pts, Mostafa #2 with 3 pts + card icons, Youssef #3) and a quick tap to **`/schedule`** (live conflict-free table times, zero segment spoilers).
  - `1:46–1:52`: **Laptop frame** — **`/bracket`** showing the **256-slot Zoomable Knockout Bracket** with **16 visible BYE nodes** for top group winners, smooth pan/zoom with the corner **Minimap**, and **Highlight Player Path** tracing Omar Hassan straight into Round of 256!
- **Narration (EN — 27 words):**
  > "Fans follow every update on phones and laptops: live group standings, the nightly schedule, and an interactive two-hundred-fifty-six-slot knockout bracket with visible BYEs and player-path tracking."
- **Narration (AR — Egyptian Arabic — 25 words):**
  > "والجمهور بيتابع كل جديد من الموبايل واللابتوب: ترتيب المجموعات، جدول الليالي، وشجرة تصفيات تفاعلية لمتين ستة وخمسين مقعد فيها التخطي التلقائي وتتبع مسار أي لاعب."

---

#### Scene B.6 · BACK TO ADMIN — The Fairness Moment, Impact Preview & 9 Invariants (`1:52 – 2:10` · 18s)
- **Entity Shown:** **ADMIN** — Lower-third: `ADMIN · Full audit trail, safe reverts & automated integrity` / `الإدارة · سجل مراجعة كامل، تعديل آمن، وفحص تناسق تلقائي`
- **Real App Footage (Desktop `1920×1080`):**
  - `1:52–1:57`: **`/admin/results`** (chronological newest-first Results Feed with exact **date & time**, clearly showing `"Yellow card (−1): False buzz"` and `"Red card (−2)"`) → quick cut to **`/admin/audit`** (`Inspect Diff` showing before/after + `contact.viewed`).
  - `1:57–2:05`: Super Admin opens **`match-g1-m3`** Session History Drawer and clicks **Revert** on Mostafa's erroneous **`Red card (−2)`** → real **`ImpactPreviewDialog`** immediately appears (*"Live Downstream Match Affected: Round of 256"* — *"History is never silently rewritten"*) → Admin confirms **`Invalidate & Mark for Replay`**!
    - Callout strip / fast verification cut shows the **Winner tag** (`Omar → Mostafa`), **Group 1 #1 rank**, AND **Round of 256 bracket slot** all correcting themselves automatically!
  - `2:05–2:10`: **`/admin/consistency`** — clicks **Run Consistency Check** → **`ALL 9 INVARIANTS PASS · 0 Violations`**!
- **Narration (EN — 42 words):**
  > "Back in Admin, every score and card arrives in order with exact date and time — like 'Yellow card, minus one.' If a mistake happens, reverting it triggers an Impact Preview, then automatically fixes the winner, standings, and bracket — verified by nine integrity checks."
- **Narration (AR — Egyptian Arabic — 40 words):**
  > "وعند الإدارة، كل نقطة وكارت بيوصلوا بالترتيب بالتاريخ والوقت، زي كارت أصفر ناقص واحد. ولو حصل خطأ، التراجع عنه بيطلعلك معاينة الأثر الأول، وبعدها بيصحّح الفائز والترتيب والشجرة تلقائياً، وتحت رقابة تسع فحوصات تناسق شغالة دايماً."

---

### ACT C — ROLE RECAP CARDS (`2:10 – 2:42` · 32s)

*Animated game-show showcase on crimson sunburst stage with crisp sticker cards, original casino-chip numbered markers (`01`–`05`), and clear 3-line structure per entity (**Sees** · **Does** · **Is responsible for**). Strictly the 5 core entities (Check-in Staff & Content Manager excluded per Step 0).*

| Timing | Entity Card | English Card Lines (`Sees` / `Does` / `Responsible for`) | Arabic Card Lines (`يرى` / `يفعل` / `مسؤول عن`) |
|---|---|---|---|
| `2:10–2:17` (7s) | **01 · ADMIN** (`الإدارة`) | **Sees:** Every player, match, live result with timestamp & full audit log.<br>**Does:** Sets rules, draws groups, schedules tables & runs safe Impact-Preview reverts.<br>**Responsible for:** Fair rules, zero double-bookings & 9/9 data integrity. | **يرى:** كل اللاعبين، المباريات، النتائج بالوقت والتاريخ، وسجل المراجعة.<br>**يفعل:** ضبط القواعد، سحب القرعة، الجدولة، والتعديل الآمن بمعاينة الأثر.<br>**مسؤول عن:** عدالة البطولة، منع التعارض، وسلامة البيانات بالكامل. |
| `2:17–2:23` (6s) | **02 · SCORER** (`الحكم`) | **Sees:** Assigned tables, live segments, timer & match-player contacts.<br>**Does:** Taps Buzz, `+1`/`−1`, Yellow/Red cards, Undo & Mark Absent.<br>**Responsible for:** Fast, accurate live officiating with zero scoring mistakes. | **يرى:** طاولاته المخصصة، الفقرات المباشرة، المؤقت، وتواصل لاعبي المباراة.<br>**يفعل:** تسجيل الجرس، `+1`/`−1`، الكروت الصفراء والحمراء، التراجع، والغياب.<br>**مسؤول عن:** تحكيم مباشر سريع ودقيق بدون أي أخطاء في النقاط. |
| `2:23–2:29` (6s) | **03 · PLAYER** (`المتسابق`) | **Sees:** Profile, avatar studio, opponent, Table #, call time & judge help card.<br>**Does:** Uploads photo or picks a 3D avatar, finds table & reviews finished history.<br>**Responsible for:** Showing up on time — with zero peeking at upcoming segments. | **يرى:** ملفه الشخصي، استوديو الأفاتار، المنافس، رقم الطاولة، وكارت الحكم.<br>**يفعل:** رفع صورة أو اختيار أفاتار 3D، الوصول للطاولة، ومراجعة نتائجه.<br>**مسؤول عن:** الالتزام بميعاد طاولته مع بقاء الفقرات مفاجأة للجميع. |
| `2:29–2:36` (7s) | **04 · BIG SCREENS** (`شاشات العرض`) | **Sees:** Real-time scores, card icons, buzz flash, tie-breaks & top podium.<br>**Does:** Broadcasts 1v1 and 1v1v1 matches in EN & Arabic RTL automatically.<br>**Responsible for:** 10-meter TV-show spectacle for the venue & livestream. | **يرى:** النقاط المباشرة، أيقونات الكروت، وميض الجرس، جولات الحسم، ومنصة التتويج.<br>**يفعل:** بث مباريات 1v1 والنهائي 1v1v1 بالعربي والإنجليزي تلقائياً.<br>**مسؤول عن:** إبهار الجمهور في القاعة والبث المباشر بوضوح تليفزيوني. |
| `2:36–2:42` (6s) | **05 · PUBLIC FAN VIEW** (`عرض الجمهور`) | **Sees:** Live 240-group standings, schedule, leaderboard & 256-slot bracket.<br>**Does:** Tracks favorite players & watches every round update live.<br>**Responsible for:** Keeping the whole Ramadan community hooked without spoilers. | **يرى:** ترتيب 240 مجموعة، الجدول، لوحة الصدارة، وشجرة 256 مقعد المباشرة.<br>**يفعل:** متابعة لاعبيه المفضلين ومشاهدة كل جولة لحظة بلحظة.<br>**مسؤول عن:** إشعال حماس الجمهور طوال رمضان بدون حرق للفقرات. |

- **Narration (EN — 66 words across 32s):**
  > "Five perspectives, one synchronized system. The Admin configures, audits, and protects tournament integrity. The Scorer delivers fast, mistake-free judging at every table. The Player gets their table and judge help while segments stay a surprise. Big Screens turn every tap into live broadcast drama. And the Public Fan View keeps everyone glued to live groups, schedules, and the bracket."
- **Narration (AR — Egyptian Arabic — 61 words across 32s):**
  > "خمس زوايا، ونظام واحد متكامل. الإدارة بتضبط القواعد وتراجع السجل وتحمي عدالة البطولة. الحكم بيدير طاولته بسرعة ودقة بدون أخطاء. المتسابق بيعرف طاولته وحكمه، والفقرات تفضل مفاجأة. شاشات العرض بتحوّل كل ضغطة لحماس تليفزيوني حي. وعرض الجمهور بيخلّي الكل متابع المجموعات والجدول والشجرة لحظة بلحظة."

---

### ACT D — MARWAN'S MOMENT (`2:42 – 2:58` · 16s)

#### Scene D1 · The 1v1v1 Grand Final on the Big Screen (`2:42 – 2:58` · 16s)
- **Entity Shown:** **BIG SCREENS · GRAND FINAL** — Lower-third: `GRAND FINAL · 2 Finalists + Marwan Serry (1v1v1)` / `النهائي الكبير · متأهلان + مروان سري (1 ضد 1 ضد 1)`
- **Real App Footage (Full-bleed `1920×1080` from `videoFinalState`):**
  - `2:42–2:48`: **`/final`** — Sweeps over the symmetrical 3-seat Marquee Spotlight (`Finalist #1` · **`Marwan Serry` Golden Seat centered, name only, zero photo** · `Finalist #2`) and the **"Surprise Championship Lineup"** card.
  - `2:48–2:58`: **`/screen/match-final`** — Live 3-panel `1v1v1` broadcast! Shows two surviving finalists flanking **Marwan Serry** dead-center with crowned golden medallion, chasing marquee bulbs, live buzz highlight, and a crisp **EN → Arabic RTL** moment (`النهائي الكبير · مروان سري`). Subtle callout badge notes *"Guest Participant — Excluded from Group & Player Rankings"*.
- **Narration (EN — 35 words):**
  > "Every match leads to one unforgettable night: the only three-player showdown in the tournament. Two finalists earn their way through seven hundred and twenty players to face you — Marwan Serry — centered in the Golden Seat."
- **Narration (AR — Egyptian Arabic — 33 words):**
  > "وكل الماتشات دي طريقها واحد: المواجهة الثلاثية الوحيدة في البطولة. اتنين بس يعدّوا من سبعمية وعشرين لاعب، علشان يقفوا قدامك يا مروان — في النص، على الكرسي الذهبي — في ليلة نهائي مش هتتنسي."

---

### ACT E — CLOSE (`2:58 – 3:12` · 14s)

#### Scene E1 · Sponsor Tiers & Call to Action (`2:58 – 3:12` · 14s)
- **Entity Shown:** **SPONSORSHIP & CTA**
- **Real App Footage + Remotion Closing Card:**
  - `2:58–3:05`: **`/sponsors`** — Smooth scroll across the 4 clearly labeled **Placeholder Sponsor Tiers** (*Presenting Title Partner*, *Final Night Partner*, *Segment Partner*, *Community Partner* — `"Contact us"`, zero fixed prices) and the Deliverables Matrix.
  - `3:05–3:12`: Remotion gold-framed closing CTA card on crimson sunburst with subtle Ramadan crescent & lanterns:
    - Headline: **"TAKE THE GOLDEN SEAT"** / **"الكرسي الذهبي مستنّيك"**
    - Subtitle: `Casino El Al3ab — Ramadan 2027 (Editable Placeholders)`
    - Contact line: `partnerships@casinoelal3ab-demo.com` (explicitly marked `Placeholder Contact`)
- **Narration (EN — 29 words):**
  > "Customizable sponsor tiers are ready to tailor together — from Final Night partner to branded segments. Every date, venue, and package is ready for your stamp. Ready to claim the Golden Seat?"
- **Narration (AR — Egyptian Arabic — 27 words):**
  > "وباقات الرعاية جاهزة تتفصّل مع بعض — من شريك ليلة النهائي لراعي الفقرات. المواعيد والمكان والباقات كلها جاهزة لبصمتك. جاهز تاخد مكانك على الكرسي الذهبي؟"

---

## 4. Vertical 9:16 Teaser Storyboard (`1:08` / `1080×1920`)

> **Safe Margins for Vertical Mobile Output:** Top `140px` clear, Bottom `260px` clear (captions sit cleanly in the safe lower-middle band above social player bars), Left/Right `64px` clear. Minimum readable text size `36px` (body/captions `44px–52px`).

| Time | Beat | Visual Composition (9:16) | Footage Source | Narration EN / AR (Egyptian) |
|---|---|---|---|---|
| `0:00–0:09` (9s) | **Hook: The Golden Seat** | Bold gold title slam + cropped hero focus on **Marwan Serry's Golden Seat** (name only, no photo) + `720 Players → 2 Finalists → 1 Seat`. | `/final` + `/screen/match-final` | **EN:** "Seven hundred and twenty players. One Ramadan tournament. Two finalists left to face Marwan Serry in the Golden Seat."<br>**AR:** "سبعمية وعشرين لاعب، بطولة رمضانية واحدة، واتنين بس هيوصلوا يواجهوا مروان سري على الكرسي الذهبي." |
| `0:09–0:20` (11s) | **Scale + Player Phone** | Top strip: `240 Groups · 256-Slot Bracket · 16 BYEs`. Center phone frame: Omar's **Table #1**, 3D avatars, **Surprise Segments** lock, Judge Help Card, quick **Arabic RTL** flip. | `/bracket` + `/player` (390×844 @3x) | **EN:** "Players see their table, 3D avatar, and judge contact — never the upcoming segments, in English or Arabic."<br>**AR:** "المتسابق يعرف طاولته، أفاتاره، وحكمه — من غير ما تتسرب الفقرات — بالعربي وبالإنجليزي." |
| `0:20–0:34` (14s) | **Vertical Split-Screen Money Shot** | **Top 48%:** Scorer 1v1 console taps **Buzz**, **`+1`**, **Yellow card (`−1`)**.<br>**Bottom 48%:** Big Screen reacts on the exact same beat → **Sudden-Death Tie-Breaker** → Winner celebration! | `/scorer/match-g1-m3` + `/screen/match-g1-m3` (same context) | **EN:** "One tap from the Scorer: Buzz, plus one, Yellow or Red card — the Big Screen and every fan phone react instantly, with sudden-death tie-breakers."<br>**AR:** "ضغطة واحدة من الحكم: الجرس، نقطة، أو كارت أصفر وأحمر — شاشة القاعة وموبايل الجمهور يتحدثوا فوراً، وجولة حسم تلقائية وقت التعادل." |
| `0:34–0:44` (10s) | **Fairness & 9 Invariants** | Admin Results Feed (`Yellow card −1` + timestamp) → **Impact Preview Dialog** on revert → Winner & Bracket self-correct → **`9/9 Invariants Pass`**. | `/admin/results` + `ImpactPreviewDialog` + `/admin/consistency` | **EN:** "Every action is timestamped. Revert a mistake, confirm the Impact Preview, and winners, standings, and the bracket fix themselves."<br>**AR:** "كل خطوة متسجلة بالوقت. لو حصل تعديل، معاينة الأثر تحمي الجولات، والفائز والترتيب والشجرة يتصححوا تلقائياً." |
| `0:44–0:54` (10s) | **5-Entity Rapid Flash** | Crisp 2-second stacked sticker cards: **Admin · Scorer · Player · Big Screens · Public Fan** (1 punchy line each). | Remotion motion cards | **EN:** "Admin runs it. Scorer calls it. Player plays blind. Big Screens ignite the room. Fans track every round live."<br>**AR:** "الإدارة تدير، الحكم يحكم، اللاعب يتفاجئ، الشاشات تشعلل القاعة، والجمهور متابع لحظة بلحظة." |
| `0:54–1:08` (14s) | **Marwan's 1v1v1 Final + CTA** | 1v1v1 Grand Final screen (Marwan centered, name only) → Placeholder Sponsor Tiers flash → Closing gold CTA: **"Take the Golden Seat"**. | `/screen/match-final` + `/sponsors` | **EN:** "All roads lead to your three-player Grand Final — with customizable sponsor tiers ready to build together. Ready for the Golden Seat?"<br>**AR:** "وكل ده بيوصل للنهائي الثلاثي معاك، مع باقات رعاية جاهزة تتفصّل مع بعض. جاهز للكرسي الذهبي؟" |

---

## 5. Planned Output Files (Steps 2–4)

Once you approve this storyboard, I will execute Steps 2–4 to deliver:

- **Main 16:9 1080p Exports:**
  - `/video/out/casino-pitch-16x9-en.mp4` (English narration + English burned-in captions)
  - `/video/out/casino-pitch-16x9-ar.mp4` (Egyptian Arabic narration + RTL Arabic burned-in captions)
- **Vertical 9:16 Teaser Exports (`1080×1920`, `1:08`):**
  - `/video/out/casino-teaser-9x16-en.mp4`
  - `/video/out/casino-teaser-9x16-ar.mp4`
- **Subtitles & Thumbnail:**
  - `/video/out/casino-pitch-en.srt`, `/video/out/casino-pitch-ar.srt`
  - `/video/out/casino-teaser-en.srt`, `/video/out/casino-teaser-ar.srt`
  - `/video/out/thumbnail-16x9.png`
- **Documentation & Scripts:**
  - `/video/LICENSES.md` (all music/SFX/font/voice licenses)
  - `/video/README.md` (how to swap your own voice files, re-record via `npm run video:record`, preview via `npm run video:preview`, and re-render via `npm run video:render`)
  - Git commit & tag: `v0.1.1-video`

---

## 6. Verification Checklist Before Approval

- [x] Every real app route exists in `v0.1.1-client-feedback-1` (`/`, `/final`, `/groups`, `/bracket`, `/schedule`, `/sponsors`, `/player`, `/scorer/[matchId]`, `/screen/[gameId]`, `/screen/leaderboard`, `/admin/settings`, `/admin/groups`, `/admin/matches`, `/admin/results`, `/admin/audit`, `/admin/consistency`).
- [x] Zero unbuilt features promised (no registration quiz, no Phase 10 Delighters confetti/3D flips).
- [x] Check-in Staff & Content Manager excluded per Step 0.
- [x] Marwan Serry appears strictly as text name only (zero photos); zero copied show logo/artwork; all placeholders clearly labeled.
- [x] Split-screen money shot uses ONE shared Playwright browser context so IndexedDB & `BroadcastChannel` sync authentically in real time.
- [x] Key phone (`/player`, `/groups`) and Big Screen (`/screen/match-g1-m3`, `/screen/match-final`) moments recorded in both English LTR and Arabic RTL.
