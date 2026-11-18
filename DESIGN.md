# DESIGN.md — "Casino El Al3ab": Bold Red, Gold, White and Blue

The site should feel like **a loud, joyful, premium TV game show**: crimson sunburst stages, glossy gold-to-orange lettering with chunky dark outlines, crisp white surfaces, and a hint of electric blue for contrast. Playful and confident, with dice, cards and chips, but still polished enough to pitch a celebrity sponsor. Ramadan appears as a warm secondary accent (lanterns, crescent), because the event runs in Ramadan.

The look is inspired by the show's brand colors and energy only. **Do not copy the show's logo, lettering or artwork.** Create original graphics, and use a font plus an outline treatment for the sticker-like lettering.

## 0. How to use this document

This is a **creative foundation, not a rulebook.** Keep the overall feeling (red stage, golden lettering, white clarity, blue sparks, game-show energy) and the quality bar, but **you are encouraged to go beyond it**: invent new motifs, layouts and moments that make the site feel unique. If a better idea conflicts with a detail here, propose it or build it as an option, and update this file when the product owner approves. The design will evolve as scope grows.

## 1. Principles

1. **Red is the stage, white is the page.** Red sunburst "Stage" sections carry drama. White "Paper" sections carry information and tools. Alternate them for rhythm.
2. **Gold is the star.** Gold-to-orange gradients with a dark maroon outline are used for headlines, key numbers, primary actions and winners. The most important thing on screen is the most golden.
3. **Blue is the spark.** A hint of electric blue appears where it adds contrast and meaning (links, focus, selection, info, "upcoming", special chips). Never overused, never fighting the red.
4. **Sticker energy.** Thick outlines, hard offset shadows, rounded shapes and slight playful tilts, like die-cut stickers on a TV set.
5. **Show energy.** Scoreboards, counters, rays and confetti give the "live TV" feeling. Be bold: the site should make people smile (the full wow layer comes later, see section 11).
6. **Bilingual by design.** Arabic (RTL) is a first-class layout, not an afterthought. Test everything in both languages.

## 2. Color tokens

Define as CSS variables and in the Tailwind config. Use tokens only, never ad-hoc hex values in components.

```css
:root {
  /* Brand red (the stage) */
  --red-100:  #FDE7EB;
  --red-400:  #E5405C;
  --red-600:  #C4163A;  /* primary brand red, stage background */
  --red-700:  #A81233;  /* sunburst dark rays */
  --red-800:  #7E0D26;
  --red-900:  #4F0716;  /* deep maroon: outlines, ink on gold, dark surfaces */

  /* Gold / orange (the star) */
  --gold-200: #FFE899;
  --gold-300: #FFD54A;
  --gold-400: #FFC12B;  /* logo-like yellow */
  --gold-500: #FF9F1C;  /* orange */
  --gold-600: #E8740C;

  /* White (primary surface and text color) */
  --white:    #FFFFFF;
  --paper:    #FFF9F0;  /* warm off-white page background */
  --paper-2:  #FBEFE0;  /* subtle section or table zebra */

  /* Blue (the hint, use where it fits) */
  --blue-100: #E6EEFF;
  --blue-300: #7FA8FF;
  --blue-500: #2F6BFF;  /* electric blue accent */
  --blue-600: #1F4FD8;
  --blue-800: #14327F;

  /* Ink (text on white/paper) */
  --ink:       #2A0A10;
  --ink-muted: #6B4A50;
  --ink-faint: #9A7C82;

  /* Status */
  --positive:  #1FA971;  /* points added */
  --negative:  #B3001B;  /* points removed (always paired with a minus sign/icon, never color alone) */
  --live:      #FFFFFF;  /* LIVE badge: white pill with a red pulsing dot on stage surfaces */

  /* Borders and shadows (the sticker look) */
  --outline:        var(--red-900);          /* thick outline on stickers */
  --border-paper:   rgba(79, 7, 22, 0.14);
  --shadow-sticker: 4px 4px 0 var(--red-900);       /* hard offset shadow */
  --shadow-sticker-lg: 8px 8px 0 var(--red-900);
  --shadow-soft:    0 10px 30px rgba(79, 7, 22, 0.18);
  --glow-gold:      0 0 28px rgba(255, 193, 43, 0.55);
}
```

**Gradients**
- **Gold gradient** (headlines, key numbers, primary buttons): `linear-gradient(180deg, #FFE066 0%, #FFC12B 40%, #FF9F1C 75%, #E8740C 100%)`, always paired with a dark maroon outline (text stroke or layered text-shadow) to get the glossy sticker lettering look.
- **Sunburst** (stage backgrounds): `repeating-conic-gradient(from 0deg at 50% 50%, #C4163A 0deg 10deg, #B21235 10deg 20deg)`, with a soft radial light at the focal point and a vignette at the edges. Rotate slowly if animated.
- **Blue spark gradient** (rare): `linear-gradient(135deg, #7FA8FF, #2F6BFF 60%, #1F4FD8)` for a single highlight element per section at most.

**Two surface themes**
| Theme | Used for | Background | Text | Primary action |
|---|---|---|---|---|
| **Stage** | Hero, final night, big screen, live and winner moments, scorer console (deep maroon variant) | Red sunburst (or `--red-900` deep variant) | White, with gold display headings | Gold gradient button with maroon outline |
| **Paper** | Admin, tables, forms, rules, schedule, player pages, long reading | White / `--paper` | `--ink` | Red fill, white text |

**Color rules (important for readability)**
- White text on `--red-600` is fine for all sizes. **Gold text on red only for large display text** (24px+ bold). Body text on gold uses `--red-900`.
- **Do not place blue text or blue elements directly on red backgrounds.** Blue goes on white/paper, or inside a white-bordered chip when it must sit on red.
- Positive and negative points never rely on color alone: always show **+ / −** signs and an icon or shape, because red is also the brand color.
- All text meets WCAG AA contrast on its actual background.

## 3. Typography

| Use | English | Arabic |
|---|---|---|
| Display / headlines | **Lilita One** (or Bowlby One) | **Lalezar** |
| Scores / big numbers / timers | **Bebas Neue** or **Oswald** | **Lalezar** or **Cairo** (900) |
| Body / UI | **Inter** | **Cairo** or **Tajawal** |

Load via `next/font` (Google Fonts). Rules:
- Display headlines are chunky and tightly tracked, filled with the gold gradient and outlined in maroon (stroke 2 to 4px, scaled with size) on Stage sections. On Paper sections, headlines use `--red-900` or `--red-600`, with one gold-underlined or gold-highlighted keyword.
- Slight playful tilt (−2° to 2°) is allowed on hero titles and stickers, never on body text or data.
- Score numerals use **tabular figures** so counters don't jitter.
- Arabic text gets slightly larger size (about +1px) and generous line-height (1.7). Do not letter-space Arabic.
- Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / 96 (hero and big-screen scores go up to 160+). Use fluid `clamp()` sizes.
- **Do not imitate the show's logo lettering.** Use the fonts above and the outline treatment.

## 4. Layout, spacing, shape

- **8px spacing grid.** Section vertical padding 96 to 128px on desktop, 56 to 64px on mobile.
- Max content width 1200px (wider on 1920px+ screens), with full-bleed Stage sections.
- **Alternate Stage and Paper sections.** Use angled, zig-zag, scalloped or sunburst-ray dividers between them instead of flat lines.
- **Fully responsive, mobile-first.** Every layout, type size and spacing value scales fluidly (`clamp()`, container queries) from 320px phones to 2560px monitors. The full requirements and device test matrix are in AGENTS.md section 13. Each size should feel designed, not merely stacked or shrunk.
- **Shape system:** cards 20px radius, buttons 14px, chips and pills fully round, inputs 12px.
- **Sticker style** for hero cards, buttons, chips and key panels: 2 to 3px `--outline` border plus the hard offset shadow (`--shadow-sticker`). **Calm style** for admin and dense data: 1px `--border-paper` and `--shadow-soft`, with only primary buttons keeping the sticker look.
- Real negative space. Never fill every gap.
- **RTL:** logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) everywhere. Mirror directional layouts and icons, including the hard shadow direction. Western digits by default.

## 5. Signature motifs (original SVG/CSS, no copied artwork)

- **Sunburst rays** behind heroes, the big screen and the final, slowly rotating or pulsing.
- **Sticker outline** treatment: thick maroon outline with a lighter inner highlight on gold elements.
- **Dice and playing cards** (original drawings, not the show's): floating, tilting, used as bullets, dividers and decorations. Card suits as watermarks.
- **Casino chips** in the classic four colors (red, white, blue, gold) as score badges, step markers and decorative piles.
- **Swirl and spiral ornaments** (original) as small doodle accents around titles and stickers.
- **Confetti, stars and sparks** in red, gold, white and blue.
- **Ramadan accents (secondary):** lanterns (fanous), crescent and star in gold and white, used in the hero, the final and seasonal sections. Keep them elegant and secondary to the game-show look.
- **Marquee bulbs:** a row of warm bulbs around key panels (final card, big screen) with a chase animation.
- **Spotlight beams** and a soft light bloom behind the focal point.

## 6. Components

**Buttons**
- **Primary on Stage:** gold gradient fill, `--red-900` text, 3px maroon outline, hard shadow. Pressed state moves down and right and the shadow collapses (tactile). Large size for scorer actions (minimum 56px tall).
- **Primary on Paper:** `--red-600` fill, white text, same outline and shadow style.
- **Secondary:** white fill with maroon outline (on red) or red outline (on paper). **Info / link buttons** use blue.
- **Destructive:** maroon fill with a clear icon and a confirm step.
- Focus ring: 3px **blue** (`--blue-500`) with 2px white offset on all interactive elements (also visible on red).

**Cards:** white or `--paper` on red sections, with sticker outline and hard shadow. On paper sections: calm style. "Premium" variant (final, golden seat) adds marquee bulbs and a gold corner ribbon.

**Casino chip (score chip):** circular, dashed inner ring, tabular number. Colors: positive = green chip with a "+" sign, negative = deep red chip with a "−" sign, neutral = gold, info = blue, plain = white.

**Player panel:** generated avatar in a thick outlined ring, name, nickname in muted text, big score in gold display type, rank pill, and a "BUZZED" state (gold glow ring with pulse). Selected player = blue ring.

**Scoreboard row:** rank chip, avatar, name, score with animated counter, floating delta (+10 in green with a plus icon, −5 in maroon with a minus icon).

**Timer:** large numeric with a circular progress ring: gold on Stage, red on Paper. Last 5 seconds: pulse and a white flash border.

**Live badge:** white pill with a pulsing red dot and "LIVE" ("مباشر"), on Stage surfaces. On Paper surfaces: red pill with a white dot.

**Status and category chips:** upcoming = blue, live = red/white pulse, finished = neutral, winner = gold. Segment categories get distinct chip colors from the palette (red, gold, blue, white/outline), always with a label.

**Bracket:** connected nodes with thick lines, each game node a mini sticker card with 3 players, winners highlighted in gold, live node pulsing, Marwan's final node a distinct "boss" node with marquee bulbs and the golden seat.

**Tables (admin):** Paper theme, compact, sticky headers, zebra with `--white`/`--paper-2`, row hover tint, sortable, searchable, empty states with a playful original illustration (dice or a card).

**Forms:** white inputs, 2px `--border-paper` that turns blue on focus, clear labels, inline validation in `--negative` with an icon, helper text muted.

**Toasts and dialogs:** white surface, sticker outline, concise copy. Destructive confirmations require an explicit confirm button.

**Navigation:** public header is red (Stage) with a gold active underline, or white (Paper) with red active state, plus an always-visible language toggle (EN | عربي) and a role badge when logged in. Admin uses a Paper layout with a deep red sidebar (right side in RTL). Scorer uses the Stage-dark layout.

## 7. Motion (baseline)

- Library: Framer Motion. Easing `easeOut`, durations 200 to 600ms. Springs for counters and chips.
- Scroll reveals: fade and rise 16px, staggered by 80ms.
- **Score counters** count up/down smoothly; **delta flashes** float and fade.
- **Leaderboard** rows reorder with layout animation when ranks change.
- Sunburst rays rotate very slowly. Dice and cards float gently. Marquee bulbs chase slowly.
- Hover (only where hover exists): lift 2px and the hard shadow grows. Press: sink and shadow collapses.
- **Respect `prefers-reduced-motion`:** disable rotations, floats and chases.
- No auto-playing sound.

## 8. Page-specific direction

### Landing / pitch (`/`)
Section order:
1. **Hero (Stage):** red sunburst, giant gold outlined headline (e.g. "The Final. Two Finalists. One Marwan Serry." with an Arabic counterpart), countdown to the final (placeholder date), a premium card with 3 seats (two finalist seats and a golden seat with "Marwan Serry", name only, no photo), floating dice and cards, subtle lanterns. Primary CTA "See the live demo", secondary "Sponsor the final".
2. **Live demo (Paper or split):** an embedded interactive mini scorer console and mini big screen that actually work on the page. This is the wow moment.
3. **How the tournament works (Stage):** 4 steps as casino-chip markers (Players enter, Groups of 3, Knockouts, The Final with Marwan) with the bracket preview.
4. **The segments (Paper):** a card grid of the segments grouped by category with colored chips and icons.
5. **Platform features (Stage or Paper):** roles, scorer console, big screen, results feed, audit log. Short and visual.
6. **Sponsor tiers (Paper):** 3 to 4 sticker cards (Presenting Partner, Final Night Partner, Segment Partner, Community Partner) with benefits and "Contact us" instead of prices. Placeholders.
7. **Closing CTA (Stage):** big gold-framed card inviting Marwan to take the final seat.
Footer with language toggle and placeholder contact details.

### Scorer console (Stage-dark)
Deep maroon background, white text, gold and blue actions, high contrast, big touch targets, minimal decoration. Priority: speed and zero mistakes. Three large player panels, one obvious selected state (blue ring), big preset buttons, undo always visible, no distracting animation.

### Big screen (Stage)
Maximum drama: red sunburst, huge numerals, gold outlined segment title in both languages, marquee border, legible from 10 meters.

### Admin (Paper)
Calm, dense, data first. Red sidebar, white content, sticker look only on primary actions and key stat chips. Dashboard with live-game cards, key numbers in casino chips and a recent results feed.

## 9. Imagery and icons

- No photos of real people. No stock casino photos. **No real show logo, lettering or artwork.**
- Avatars: generated geometric patterns or initials in thick outlined rings.
- Icons: Lucide, 1.75px stroke, in ink, white or gold. Custom original SVG for dice, cards, chips, swirls, lantern and crescent.
- Illustrations: bold, flat, sticker-style with thick maroon outlines.

## 10. Defaults to avoid (a starting list that can grow, not a limit on creativity)

- Purple-to-blue gradients, neon cyberpunk glow, glassmorphism everywhere.
- Centered hero + three identical feature cards as the main layout.
- Default unthemed shadcn components or default Tailwind blue.
- Real-money gambling language or imagery (slot machines, 777, "JACKPOT", cash). **This is a skill and trivia game show, not gambling.**
- Blue text or blue shapes directly on the red background.
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
1. **Opening sequence (landing):** a curtain-lights-on reveal. The stage is dark, spotlights snap on, the sunburst spins up, dice and cards fly in, and the gold title slams into place. 3 to 4 seconds, skippable, plays once per session.
2. **The Golden Seat:** Marwan Serry's seat as a 3D-tilting premium card with a foil shimmer, light sweep, floating sparkles and parallax that follows the cursor (or phone gyroscope). Name only, no photo.
3. **Cards, dice and chips:** segments revealed as playing cards that fan out, flip in 3D and stack. Dice that tumble and land on a result. Score changes toss casino chips that land and stack with a satisfying settle.
4. **Mechanical scoreboard:** score digits roll or flip like a vintage split-flap board, with a glow pulse and a flash on the screen edge for big swings.
5. **The Buzz moment:** radial shockwave ripple from the buzzed player, a spotlight snaps onto them while others dim, a "BUZZ!" sticker slams in.
6. **Winner celebration:** confetti burst in red, gold, white and blue, lanterns released floating upward, slow-motion zoom on the winner's name, rankings slam into place with a screen shake.
7. **Final night VS reveal:** a dramatic game-show style reveal: three silhouettes with name plates revealed one by one, the golden seat last, with a pulsing countdown.
8. **Living bracket:** lines draw themselves with an energy pulse when a winner advances, and a glowing token travels along the path to the next node.
9. **Scroll storytelling:** pinned sections, scroll-linked animation, a horizontal card-deck carousel for segments, parallax layers (rays, dice, lanterns).
10. **Cursor and hover magic:** a soft spotlight following the cursor on Stage sections, magnetic buttons, tilt-on-hover cards, sparkle trails on interactive elements.
11. **Page transitions:** a sunburst wipe or shared-element transitions between pages.
12. **Custom loaders:** a card shuffle, tumbling dice or a spinning chip instead of generic spinners.
13. **Easter eggs:** tapping a lantern lights it, tapping the logo shuffles a deck, a hidden chip-rain on a secret gesture or the Konami code. Playful and harmless.
14. **Sound (optional, user-initiated):** a visible "Sound on" toggle, off by default (never autoplay). Tasteful effects: chip clink, buzzer, card flip, dice roll, applause for winners. Short original or royalty-free clips.
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
- Allowed tools: Framer Motion, GSAP + ScrollTrigger, canvas-confetti, react-three-fiber / drei (for 3D cards, dice and chips), Lottie or Rive, Howler (sound), CSS 3D transforms. Choose what gives the best result.
- Test the wow in **both English and Arabic (RTL)**: motion directions mirror correctly.

## 12. Accessibility and quality bar

- WCAG AA contrast on every real background (see the color rules in section 2), visible blue focus states, full keyboard navigation, semantic HTML and ARIA labels.
- Touch targets at least 44px (scorer console 56px+).
- Works across the full device matrix in AGENTS.md section 13: phones (320 to 430px), tablets (768 to 1024px), laptops (1280 to 1536px), desktops (1920px), large monitors (2560px) and the big-screen view.
- Works in English LTR and Arabic RTL, with no layout breakage and correct font fallbacks.
- Loading skeletons, empty states and error states on every data view.
