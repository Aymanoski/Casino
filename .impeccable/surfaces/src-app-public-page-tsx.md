---
version: 1
slug: "src-app-public-page-tsx"
primary_target: "src/app/(public)/page.tsx"
related_targets: []
---

# Surface Brief — Landing & Pitch Page (`/`)

- **Visitor Mode:** Persuade
- **Audience & Job:** Prospective celebrity sponsor & Grand Final host Marwan Serry, brand partners, and spectators evaluating whether the Ramadan tournament deserves sponsorship and Marwan's seat on Final Night.
- **Confirmed Choices:**
  - Hero 3-seat Final card: 2 open qualifier finalist slots (`Finalist #1 · Semi-Final Top 2` and `Finalist #2`) paired with Marwan Serry's Golden Seat (name only, no photo).
  - LIVE DEMO: Dedicated exhibition game (`game-demo`, `isDemo: true`) backed by real repos (`gameRepo`, `scoreRepo`, `segmentRepo`, `settingsRepo`, `realtime` BroadcastChannel) and isolated from the official 27-player bracket/leaderboard/audit stats; includes Buzz, `+10`/`+5`/`−5` presets, custom `+/-` input + note, segment switcher, live Timer controls, Undo, and Reset Demo Table.
  - Sponsor Tiers: 4 placeholder tier cards (`Presenting`, `Final Night`, `Segment`, `Community`) loaded from `sponsorRepo` with "Contact us" placeholder CTAs (no extra inquiry form/modal complexity at this stage).
- **Constraints:** EN (LTR) and AR (RTL) parity, `320px`–`2560px` responsive fidelity, `>= 44px` touch targets (`>= 56px` scorer), `>= 16px` inputs, no Phase 10 Delighters (`delightersEnabled: false`), no real photos, no copied show logo/text, no gambling imagery/prices.

## Direction contract

- **THESIS:** Refuse generic SaaS hero-plus-3-cards marketing; treat `/` as a live television game-show pitch stage where the visitor immediately sees the Final Night 3-seat stake and operates the real scoring-to-big-screen broadcast engine in-page.
- **OWN-WORLD:** Established "Casino El Al3ab — Stage & Paper" system: crimson conic-ray Stage sections (`#C4163A` / `#B21235` with maroon `#4F0716` sticker outlines and glossy gold-to-orange `#FFE066`–`#E8740C` display typography in `Lilita One` / `Lalezar`), alternating via zig-zag/angled/scalloped `StageDivider` seams with warm `#FFF9F0` Paper grounds, electric blue `#2F6BFF`/`#1F4FD8` focus/info chips inside crisp white borders, circular dashed casino `ScoreChip` tokens, `MarqueeBulbs`, `PlayingDice`, `PlayingCardFan`, and secondary `Lantern` accents.
- **STORY:** Marwan Serry arrives, immediately sees the Final Night countdown and two finalist seats waiting beside his Golden Seat, clicks down into the working LIVE DEMO where a buzz and `+10` tap animate the synced broadcast scoreboard in real time, traces the 4-step 27-player bracket path and 16 original challenge segments, reviews the 5 operational platform capabilities and placeholder sponsor tiers, and reaches the Final Night invitation CTA.
- **FIRST VIEWPORT:** Asymmetric 2-column Stage hero on a slowly rotating crimson sunburst: left/start column carries the giant glossy gold-outlined headline (`The Final. Two Finalists. One Marwan Serry.` / Arabic counterpart), concise pitch subtitle, live 4-unit countdown to `settings.finalNightIso` marked as placeholder, and two sticker buttons (`See the live demo` gold primary scrolling to `#live-demo`, `Sponsor the final` white secondary scrolling to `#sponsors`); right/end column anchors a `MarqueeBulbs`-framed 3-Seat Final Card elevating Marwan Serry's Golden Seat (name only) beside two open qualifier plaques, flanked by floating dice/cards and subtle hanging lanterns. Primary CTA sits visibly above the fold at 1440px and 390px without eyebrows above headings.
- **FORM:** 8-section alternating Stage/Paper pitch sequence (`Final Night Hero [Stage]` → `Live Demo Split [Paper + Stage-Dark/Stage]` → `How It Works & Bracket Preview [Stage]` → `Segments Grid [Paper]` → `Platform Features Bento [Stage]` → `Sponsor Tiers [Paper]` → `Closing CTA [Stage]` → `PublicFooter [Stage]`); seed: none (pinned) — `"Build the landing and pitch page at \"/\" following DESIGN.md section 8 exactly, in this order: Final Night hero, LIVE DEMO, how the tournament works with bracket preview, segments grid, platform features, sponsor tiers, closing CTA, footer."`
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
