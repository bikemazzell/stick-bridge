# Stick Bridge Simulator - Specification

A 2D educational web game. The player picks a popsicle stick bridge type, sets a stick budget and stick length, and presses Start. Randomly generated but physically simulated walkers then cross the bridge, from a fly up to a tank, until the bridge breaks or everything crosses. The game teaches why trusses and cables hold more weight than a flat beam.

## Goals

- Teach bridge physics: tension, compression, load paths, why triangles are strong.
- Keep it simple: no saving, no accounts, no levels, no scoring beyond the result screen.
- Fun low-poly colorful look with weather and day/night atmosphere.
- Physically plausible simulation: real truss geometry, real load transfer, breakage under overload.

## Non-goals

- Free-form building or editing. The player picks a type and parameters, the generator builds the bridge.
- Audio. Silent game.
- Persistence, leaderboards, multi-language, mobile-first layout (desktop-first, but canvas scales).

## Similar games researched

| Game | What it does | What we take or skip |
|---|---|---|
| Poly Bridge 1/2/3 | Material types, stress view coloring, budget limits, vehicles test the bridge, hydraulic plates | Take: stress colors, budget-as-stick-count, vehicle test. Skip: building UI, hydraulics, campaigns |
| Bridge Constructor series | Preset gap scenarios, material per member (wood/steel/cable), load ratings | Take: preset gap, per-member materials (stick vs cable). Skip: islands, story |
| Build a Bridge (BoomBit) | Low-poly cartoon look, star ratings | Take: low-poly color palette. Skip: ratings, ads |
| Bridge Designer (WPBD) | Pure truss analysis for classrooms, member force tables | Take: educational tone, truss naming (Warren/Pratt/Howe). Skip: numeric tables |
| Real popsicle stick contests | Howe truss with ~99 sticks spans 50 cm and holds 90+ kg | Take: realistic stick proportions, contest framing of the ladder test |

## Platform and stack

- Plain web app: HTML + Canvas 2D + ES modules. No framework.
- Build/dev: Vite. Tests: Vitest for units, puppeteer-core over Chrome DevTools Protocol for e2e.
- Physics: matter-js (2D rigid body engine). Sticks are rigid bodies joined by pin constraints. A member "snaps" when its strain exceeds its strength.
- Rendering is a custom canvas renderer, not the Matter debug renderer, to get the low-poly art style.

## Game flow

1. Menu: player picks bridge type (Flat Beam, Truss, Suspension), max sticks (slider, 20 to 300), stick length (slider, 40 to 120 px), canyon span (slider, 480 to 800 px), and a seed (random button included). The seed field starts fully randomized on every cold start of the page; when the player returns to the menu after a round (New Bridge or the in-game exit), the previous values (type, sliders, seed) are kept so tweaks are easy. A small preview sketch redraws on change.
2. Press Start. The generator builds the bridge with the seed's randomness and animates sticks flying into place. HUD shows sticks used vs budget.
3. The test ladder begins: walkers cross one at a time, left to right. HUD shows the current walker, its mass, and how many walkers have crossed.
4. Any stick or cable whose load exceeds its strength snaps, becomes falling debris, and the collapse cascade follows. The walker falls too.
5. Result screen: what broke it, the heaviest walker that crossed, and one educational fact about that bridge type. Buttons: Replay Same Bridge, New Bridge (back to menu). If a walker gets trapped by a sagging deck for too long (no progress, no fall), the round ends as a stuck deck, which also counts as a failure.
6. If the tank crosses and the bridge stands, the result screen declares the bridge indestructible.

## Bridge types

All bridges span one canyon gap. Anchor points (cliff edges) are fixed nodes. Deck nodes carry the walkers. The generator spends the stick budget: deck first, then structure. If the budget cannot cover the deck, the bridge gets fewer reinforcement members and is weaker, which is itself the lesson.

- Flat Beam: sticks laid end to end between the anchors, with slight joint jitter. Simple, weak in the middle. Optional doubling of sticks if budget allows (two layered beams), which doubles deck strength.
- Truss: deck plus a triangular truss above or below it. The seed picks Warren (equilateral triangles), Pratt (verticals plus diagonals sloping down toward the center), or Howe (verticals plus diagonals sloping up toward the center). Extra budget adds a second truss lane or denser panels.
- Suspension: two popsicle towers, a main cable sagging between tower tops (and anchored at the cliffs), vertical hanger cables down to the deck every panel. Deck is a light beam chain. Towers and hangers use sticks, the main cable is modeled as cable material. Extra budget means taller towers and more hangers.

Randomness (seeded, reproducible): panel count jitter, tower height, truss sub-style, joint position jitter of plus or minus 3 px, stick strength scatter of plus or minus 10 percent. The seed is shown on screen so a bridge can be replayed.

## Physics model

- Units: pixels and kg scaled down by a global factor for solver stability. Gravity 1g equivalent.
- Members: rigid stick bodies (thin rectangles) connected at nodes by constraints. Truss structure joints are pinned (one constraint, like a pinned truss). Deck joints are glued (two offset constraints per joint, like real glued popsicle laps), so the deck resists bending instead of sagging like a chain. Strength per stick: a break strain threshold (how far the joint stretches before the stick tears loose). Cables break only in tension and go slack in compression (constraint stiffness drops to zero while compressed).
- Collision design: bridge members never collide with each other. Walkers collide only with deck members and the ground, so trusses above the deck and suspension towers do not block them. This is the standard 2D bridge game convention.
- Strain check each tick: strain = (constraint current length minus rest length) / rest length. If strain magnitude exceeds the member threshold, remove the constraint, mark the member broken, spawn debris.
- Walkers are dynamic circle bodies with realistic relative masses, driven horizontally toward the far side, pressing load down into the deck. When the deck vanishes, they fall.
- Determinism: fixed timestep (60 Hz accumulator) and a seeded RNG so a given seed and choices produce the same bridge and the same ladder.

## Walker ladder

Order, name, mass, note:

| # | Walker | Mass | Note |
|---|---|---|---|
| 1 | Fly | 0.01 kg | a joke, the bridge cannot even feel it |
| 2 | Mouse | 0.05 kg | |
| 3 | Toy Car | 0.5 kg | first "real" test for weak decks |
| 4 | House Cat | 4 kg | |
| 5 | Dog | 15 kg | |
| 6 | Human | 70 kg | the classic contest benchmark |
| 7 | Horse | 400 kg | |
| 8 | Car | 1200 kg | |
| 9 | Elephant | 5000 kg | |
| 10 | Tank | 42000 kg | final boss |

Each walker has a distinct low-poly look and a simple two-leg or multi-leg walk cycle. Speed scales down with size. The next walker starts after the previous one exits the far side. If a walker is stuck in one spot for more than 5 seconds (300 ticks, from bridge design or breakage), a speech bubble appears above it with random expletive glyphs and angry emojis (for example `@$!`, `\u{1F621}\u{1F627}\u{1F92C}`), reshuffling while it stays stuck. The bubble is seeded fun: deterministic per seed and tick, no audio.

## Look and feel

- Low-poly: flat shaded triangles and rectangles, bold outlines optional, saturated but harmonious palette (paper-craft vibe).
- Scenery: layered canyon silhouette parallax, river at the canyon bottom, sparse low-poly trees, sun and clouds. The canyon scene varies per seed: jag count and amplitude of the cliff faces, the mountain ridge lines of both backdrop layers (point count, positions, heights), tree count per cliff, and river shimmer density all draw from the seed, so two seeds rarely look alike.
- Weather and time: a slow day/night sky gradient cycle; drifting clouds; occasional rain (seeded); birds passing. Rain is cosmetic, no physics effect.
- Stress view: sticks tint from green (safe) through yellow to red (about to snap), always on during the test. This is the main educational readout.
- Break moment: snapped sticks tumble as debris, small dust puff particles, brief camera shake.

## Screens

1. Menu screen (DOM overlay): type cards with mini canvas sketches, sliders for stick budget and length, seed field with dice button, Start button.
2. Test screen: full canvas game, HUD strip (current walker and mass, sticks used, stress max percent, seed, weather icon) plus an in-game speed button that cycles the simulation speed 1x, 4x, 8x, 16x and back to 1x, and an exit button that abandons the round and returns to the menu with the previous values kept. Bridge stands center.
3. Result overlay: outcome, heaviest walker crossed, break reason, one fact, buttons Replay and New Bridge.

## Educational content

One fact per bridge type shown on the result screen, plus a rotating hint line in the menu (for example: "Triangles do not bend like squares. That is why trusses are strong."). Facts mention tension vs compression roles of Warren/Pratt/Howe members and cable function in suspension bridges.

## Testing

- Unit tests (Vitest, headless Matter engine): RNG determinism and distribution, each generator's invariants (span hit, anchors fixed, deck present, member count within budget, connectivity from anchor to anchor), cable slack behavior, break threshold logic, ladder order and spawn logic, game state machine transitions, and two full headless simulations: a truss with a big budget survives a Human, and a flat minimal bridge breaks under a Human.
- E2E (puppeteer-core driving Brave over CDP 9222): load page, configure each bridge type, run the test until the result screen, assert HUD updates, no console errors, canvas animates, and screenshots captured per type.
- Definition of done: `npm test` green, `npm run e2e` green against Brave, `npm run build` clean.

## Performance

Target 60 fps on a 2015 laptop. Members are at most a few hundred bodies, walkers at most 1 live plus debris. Canvas draw calls kept simple: no shadows, no filters, particle caps.
