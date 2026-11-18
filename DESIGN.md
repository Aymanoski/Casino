# DESIGN.md — "Ramadan Casino Night"

The site should feel like **a luxurious, warm Ramadan evening inside a classic casino**: deep midnight blue, glowing gold, lantern light, playing-card and chip details, and the energy of a live TV game show. It must feel **premium and expensive**, not like a template and not like a cheap slot-machine site.

Reference mood (for feeling only, do not copy): a prestige game-show finale, a luxury Ramadan campaign, a dark editorial magazine layout, high-end casino branding with restraint.

## 0. How to use this document

This is a **creative foundation, not a rulebook.** Keep the overall feeling (midnight, gold, Ramadan warmth, game-show energy) and the quality bar, but **you are encouraged to go beyond it**: invent new motifs, layouts, transitions and moments of delight that make the site feel unique. If a better idea conflicts with a detail here, propose it or build it as an option, and update this file when the product owner approves. The design will evolve as scope grows.

## 1. Principles

1. **Dark, warm, glowing.** Midnight base, gold used sparingly so it feels precious.
2. **Hierarchy through light.** The most important thing on screen is the brightest and most golden.
3. **Show energy.** Scoreboards, counters, glows and marquee lights give the "live TV" feeling. Be bold: the site should make people smile, gasp and want to keep playing with it (the full wow layer comes later, in the Delighters phase, see section 11).
4. **Culture-first.** Ramadan motifs (lanterns, crescent, arabesque) are woven in elegantly, not slapped on as clip art.
5. **Bilingual by design.** Arabic (RTL) is a first-class layout, not an afterthought. Test everything in both.

## 2. Color tokens

Define these as CSS variables and in the Tailwind config. Use tokens only, never ad-hoc hex values in components.

```css
:root {
  /* Base */
  --bg:            #070B1A;  /* deepest midnight */
  --bg-raised:     #0C1230;  /* sections */
  --surface:       #111A3D;  /* cards */
  --surface-2:     #18234F;  /* elevated cards, inputs */
  --border:        rgba(232, 184, 75, 0.18);
  --border-strong: rgba(232, 184, 75, 0.40);

  /* Gold (the hero color) */
  --gold-100:      #FBEBB5;
  --gold-300:      #F3D27A;
  --gold-500:      #E8B84B;  /* primary accent */
  --gold-700:      #B8862B;
  --gold-900:      #6B4C14;

  /* Text */
  --text:          #F6F0E1;  /* ivory */
  --text-muted:    #A7B0CF;
  --text-faint:    #6F7AA3;

  /* Status */
  --positive:      #2FBF8F;  /* points added, emerald */
  --negative:      #D6334C;  /* points removed, casino ruby */
  --live:          #FF4D4D;  /* live indicator */
  --info:          #5B8CFF;

  /* Effects */
  --glow-gold:     0 0 24px rgba(232, 184, 75, 0.35);
  --glow-gold-lg:  0 0 60px rgba(232, 184, 75, 0.30);
}
```

Gradients (use sparingly):
- **Gold gradient** for primary buttons and key numbers: `linear-gradient(135deg, #FBEBB5 0%, #E8B84B 45%, #B8862B 100%)`
- **Night gradient** for hero backgrounds: radial navy-to-black with a soft gold glow behind the focal point.
- Subtle **vignette** at page edges.

**Contrast:** all body text must pass WCAG AA on its background. Gold text on midnight is fine for large text and accents; use ivory for body.

## 3. Typography

| Use | English | Arabic |
|---|---|---|
| Display / headlines | **Cormorant Garamond** (600/700) or **Playfair Display** | **Reem Kufi** (600/700) |
| Scores / big numbers / timers | **Bebas Neue** or **Oswald** | **Reem Kufi** or **Cairo** (700) |
| Body / UI | **Inter** | **Cairo** or **Tajawal** |

Load via `next/font` (Google Fonts). Rules:
- Headlines use tight tracking and large size, with a gold gradient fill on the single most important word per section.
- Score numerals use **tabular figures** so counters don't jitter.
- Arabic text gets slightly larger size (about +1px) and more generous line-height (1.7).
- Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / 96 (hero and big-screen scores go up to 160+).

## 4. Layout, spacing, shape

- **8px spacing grid.** Section vertical padding 96 to 128px on desktop, 64px on mobile.
- Max content width 1200px, with full-bleed hero sections.
- **One corner radius system:** cards 20px, buttons 14px, chips and pills fully round, inputs 12px.
- **Borders over shadows.** Cards have a 1px gold-tinted border (`--border`) and a soft inner highlight on top edge. Elevated cards get a faint gold glow on hover.
- Use real **negative space**. Never fill every gap.
- **RTL:** use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) everywhere. Mirror directional icons and layouts. Numbers stay Western digits by default; offer an Arabic-Indic digit option in settings if easy.

## 5. Signature motifs (original SVG/CSS, no stock art)

- **Lantern (fanous) silhouettes** hanging at varied heights with a soft flicker, used at the top of hero and section dividers.
- **Crescent and star** used as small accents (dividers, badges).
- **Arabesque pattern** as a very low-opacity (4 to 6%) background texture in sections.
- **Card suits** (♠ ♥ ♦ ♣) as subtle watermarks and bullet markers. **Poker chips** as score badges and step markers (circular, with dashed gold ring and inner number).
- **Marquee bulb border:** a row of small warm bulbs around key panels (hero final card, big screen) with a chase animation.
- **Spotlight beams** from above on the hero and the final section.
- **Gold hairline dividers** with a small ornament in the center.

## 6. Components

**Buttons**
- Primary: gold gradient fill, midnight text, 14px radius, soft gold glow on hover, slight lift. Large size for scorer console actions (minimum 56px tall).
- Secondary: transparent with gold border, ivory text, gold fill at 10% on hover.
- Destructive: ruby border and text; ruby fill for confirm.
- Focus ring: 2px gold with 2px offset on all interactive elements.

**Cards:** surface background, gold-tinted border, 20px radius, 24 to 32px padding. "Premium" variant adds marquee bulbs or a gold corner ornament.

**Score chip (poker chip):** circular badge with dashed ring, tabular number, color-coded (positive emerald, negative ruby, neutral gold).

**Player panel:** avatar (generated pattern or initials in a gold ring), name, nickname in muted text, big score, rank pill, "BUZZED" glow state (gold pulsing ring).

**Scoreboard row:** rank chip, avatar, name, score with animated counter, delta flash (+10 in emerald floating up, -5 in ruby floating down).

**Timer:** large numeric with a circular gold progress ring; turns ruby and pulses in the last 5 seconds.

**Live badge:** small ruby pill with pulsing dot and "LIVE" (and "مباشر" in Arabic).

**Bracket:** connected nodes with gold lines, each game node is a mini card with 3 players; winners highlighted; live node glows; Marwan's final node is a distinct "boss" node with marquee bulbs.

**Tables (admin):** compact, sticky headers, zebra with surface vs surface-2, row hover gold tint, sortable, searchable, with empty states that have a lantern illustration.

**Forms:** surface-2 inputs, gold focus border, clear labels, inline validation in ruby, helper text in muted.

**Toasts and dialogs:** midnight surface, gold border, concise copy. Destructive confirmations require an explicit confirm button.

**Navigation:** top bar translucent midnight with blur, gold underline on active item, language toggle (EN | عربي) always visible, role badge when logged in. Admin and scorer use a left sidebar (right sidebar in RTL).

## 7. Motion

- Library: Framer Motion. Easing: `easeOut`, durations 200 to 600ms. Spring for counters and chips.
- Scroll reveals: fade and rise 16px, staggered by 80ms.
- **Score counters** count up/down smoothly; **delta flashes** float and fade.
- **Leaderboard** rows reorder with layout animation when ranks change.
- Lanterns gently sway (3 to 5s loops, tiny amplitude). Marquee bulbs chase slowly.
- Hover: lift 2px, gold border brightens.
- **Respect `prefers-reduced-motion`:** disable sways, chases and large movements.
- No auto-playing sound.

## 8. Page-specific direction

### Landing / pitch (`/`)
Section order:
1. **Hero:** "Final Night" showcase. Large headline (e.g. "The Final. Two Finalists. One Marwan Serry." EN, with an Arabic counterpart), countdown to the final (placeholder date), lanterns and spotlight, a premium card showing the final's 3 seats (two finalist seats and a golden "Marwan Serry" seat, name only, no photo), primary CTA "See the live demo", secondary "Sponsor the final".
2. **Live demo:** an embedded interactive mini scorer console and mini big screen side by side that actually work on the page (tap buzz, add points, see the scoreboard update). This is the wow moment.
3. **How the tournament works:** 4 steps as poker-chip markers: Players enter, Groups of 3, Knockouts, The Final with Marwan. Include the bracket preview.
4. **The segments:** a card grid of the show-style segments grouped by category, with icons.
5. **Behind the scenes (platform features):** roles, scorer console, big screen, results feed, audit log, short and visual.
6. **Sponsor tiers:** 3 to 4 premium tier cards (Presenting Partner, Final Night Partner, Segment Partner, Community Partner) with benefits and "Contact us" instead of prices. Placeholders.
7. **Closing CTA:** big gold-framed card inviting Marwan to take the final seat.
Footer with language toggle and placeholder contact details.

### Scorer console
Dark, high-contrast, big touch targets, minimal decoration. Priority: speed and zero mistakes. Three large player panels, one obvious selected state, big preset buttons, undo always visible, no animation that could distract.

### Big screen
Maximum drama. Huge numerals, full-bleed night gradient, lanterns at top, marquee border, the segment title large in both languages. Must be legible from 10 meters.

### Admin
Calmer and denser. Same palette but fewer ornaments. Data first. Dashboard with live-game cards, key numbers in chips, recent results feed.

## 9. Imagery and icons

- No photos of real people. No stock casino photos. No real show or brand assets.
- Avatars: generated geometric patterns or initials in gold rings.
- Icons: Lucide, 1.5px stroke, gold or ivory. Custom SVG for lantern, crescent, chip, card suits.
- Illustrations: simple, flat, gold line-art on midnight.

## 10. Defaults to avoid (a starting list that can grow, not a limit on creativity)

- Purple-to-blue gradients, neon cyberpunk glow, glassmorphism everywhere.
- Centered hero + three identical feature cards as the main layout.
- Default unthemed shadcn components or default Tailwind blue.
- Slot-machine clichés overload (cherries, 777, flashing neon "JACKPOT").
- Real gambling imagery or language that implies real-money betting. **This is a skill and trivia game show, not gambling.** Keep copy about competition, prizes and entertainment.
- Lorem ipsum, "John Doe", placeholder gray boxes in final screens.
- Emojis used as icons.
- Hard-coded colors outside the tokens.

## 11. Delighters: delight, surprise and satisfaction (PHASE 10 ONLY)

> **Do NOT build anything from this section during Phases 1 to 9.** The base version is shown to the client first. Start this only when the product owner says "start Delighters". Until then, build the base experience polished and professional using the baseline motion in section 7, and leave clean hook points (see AGENTS.md section 12) so these can be added later without rewrites.

**Mandate (for Phase 10):** this prototype must make Marwan Serry say "wow" in the first 10 seconds and keep surprising him. Correct and clean is not enough. **Every key screen needs one signature moment people would show to a friend, and every primary action must feel physically satisfying.** Treat this section as a to-do list of ambition, and go beyond it.

### Satisfaction principles ("juice")
- **Instant feedback:** every tap responds visually in under 100ms.
- **Anticipation, action, reaction:** a small wind-up, a clear action, a satisfying settle (spring overshoot, squash and stretch).
- **Layered feedback:** combine visual + optional sound + haptic (phone vibration) in sync for key actions.
- **Consistent feel:** one timing curve family across the product so it feels designed, not assembled.
- **Surprise budget:** at least one unexpected delight per page that the user did not ask for.

### Signature moments (build these, or better versions of them)
1. **Opening sequence (landing):** lights-on reveal. The room is dark, lanterns ignite one by one, a spotlight sweeps across, the title assembles in gold. 3 to 4 seconds, skippable, plays once per session.
2. **The Golden Seat:** Marwan Serry's seat as a 3D-tilting premium card with a foil shimmer, light sweep, floating sparkles and parallax that follows the cursor (or phone gyroscope). Name only, no photo.
3. **Cards and chips:** segments revealed as playing cards that fan out, flip in 3D and stack. Score changes toss poker chips that land and stack with a satisfying settle.
4. **Mechanical scoreboard:** score digits roll or flip like a vintage split-flap board, with a glow pulse and a flash on the screen edge for big swings.
5. **The Buzz moment:** radial shockwave ripple from the buzzed player, a spotlight snaps onto them while others dim, a "BUZZ!" stamp slams in.
6. **Winner celebration:** gold confetti burst, lanterns released floating upward, slow-motion zoom on the winner's name, rankings slam into place with a screen shake.
7. **Final night VS reveal:** a dramatic game-show/fighting-game style reveal: three silhouettes with name plates revealed one by one, the golden seat last, with a pulsing countdown.
8. **Living bracket:** lines draw themselves with an energy pulse when a winner advances, and a glowing token travels along the path to the next node.
9. **Scroll storytelling:** pinned sections, scroll-linked animation, a horizontal card-deck carousel for segments, parallax layers (lanterns, stars, arabesque).
10. **Cursor and hover magic:** a soft gold spotlight following the cursor on dark sections, magnetic buttons, tilt-on-hover cards, glowing trails on interactive elements.
11. **Page transitions:** a gold curtain wipe or shared-element transitions between pages.
12. **Custom loaders:** a card shuffle or spinning chip instead of generic spinners.
13. **Easter eggs:** tapping a lantern lights it, tapping the logo shuffles a deck, a hidden chip-rain on a secret gesture or the Konami code. Keep them playful and harmless.
14. **Sound (optional, user-initiated):** a visible "Sound on" toggle, off by default (never autoplay). Tasteful effects: chip clink, buzzer, card flip, applause for winners. Use short original or royalty-free clips.
15. **Haptics:** on phones, short vibrations for buzz, points and winners (`navigator.vibrate`, with graceful fallback).

### Where to go big and where to stay calm
- **Landing page, big screen, final night, winner moments:** maximum drama and spectacle.
- **Scorer console:** instant, crisp micro-feedback only (button press, chip pop, counter tick, haptic). Never a distracting or slow animation that could cause a scoring mistake.
- **Admin:** subtle polish (smooth transitions, satisfying toasts, row highlights), speed first.

### Craft rules
- Keep **60fps**: animate transform and opacity, avoid layout thrash, use `will-change` sparingly.
- Lazy-load heavy libraries (3D, confetti) only on the pages that use them.
- Every effect has a **`prefers-reduced-motion`** fallback and every intro is skippable.
- Effects must never block a task, hide important info, or reduce legibility.
- Allowed tools: Framer Motion, GSAP + ScrollTrigger, canvas-confetti, react-three-fiber / drei (for 3D cards and chips), Lottie or Rive, Howler (sound), CSS 3D transforms. Choose what gives the best result.
- Test the wow in **both English and Arabic (RTL)**: motion directions mirror correctly.

## 12. Accessibility and quality bar

- WCAG AA contrast, visible focus states, full keyboard navigation, semantic HTML and ARIA labels.
- Touch targets at least 44px (scorer console 56px+).
- Works at 390px (phone), 820px (tablet), 1440px (desktop), and 1920px (big screen).
- Works in English LTR and Arabic RTL, with no layout breakage and correct font fallbacks.
- Loading skeletons, empty states and error states on every data view.
