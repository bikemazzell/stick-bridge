# Stick Bridge Simulator - Implementation Plan

> **For agentic workers:** Execute tasks in order, TDD style. Steps use checkbox (`- [ ]`) syntax for tracking. After each task: tests green, tick boxes, commit.

**Goal:** Build the game specified in `docs/spec.md`: seeded bridge generation (flat/truss/suspension), Matter.js load testing with a walker ladder up to a tank, low-poly canvas rendering with weather, and CDP e2e tests against Brave.

**Architecture:** Pure ES modules, no framework. A `BridgeModel` (nodes + members, plain data) is produced by seeded generators, consumed by a physics simulator (Matter.js, headless-testable), driven by a plain FSM (`menu -> building -> testing -> result`). Rendering and DOM UI are thin layers over the model + simulator state and carry no game logic, so all logic is unit-testable in Node.

**Tech Stack:** Vite, matter-js, Vitest, puppeteer-core (Brave over CDP), Canvas 2D.

---

## Conventions

- World coordinates: logical 1280x720. Canyon gap from x=320 to x=960 (span 640), deck line y=400, canyon ground y=700.
- Every module is pure logic unless it imports DOM/canvas. Logic modules must run in Node without a DOM.
- Fixed timestep 1000/60 ms. All randomness goes through the seeded RNG; never call `Math.random()` in game logic.
- Physics constants below are initial values. The physics invariant tests in Task 5 are the source of truth; tune constants until those pass.

### Task 0: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `index.html`, `src/style.css`, `tests/sanity.test.js`
- Modify: none

- [x] **Step 1: Create package.json**

```json
{
  "name": "pop-bridge",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "e2e": "node e2e/run.mjs"
  },
  "dependencies": {
    "matter-js": "^0.20.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "puppeteer-core": "^23.0.0"
  }
}
```

- [x] **Step 2: Create .gitignore**

```
node_modules/
dist/
e2e/shots/
```

- [x] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
});
```

- [x] **Step 4: Create index.html** with `<div id="app">`, `<canvas id="game">`, mounts `src/main.js`, links `src/style.css`. Minimal shell; menu/result overlays are built by UI code in Task 9.

- [x] **Step 5: Create src/style.css** skeleton (full-screen canvas, overlay base classes). Filled out in Task 9.

- [x] **Step 6: Sanity test** `tests/sanity.test.js`: `expect(1 + 1).toBe(2)`.

- [x] **Step 7: Verify:** `npm install` succeeds, `npx vitest run` passes 1 test, `npm run build` produces `dist/`.

- [x] **Step 8: Commit** `chore: project scaffold`

### Task 1: Seeded RNG

**Files:**
- Create: `src/game/rng.js`
- Test: `tests/rng.test.js`

**API:**
```js
export function hashSeed(str) // xmur3 string hash -> 32-bit int
export function makeRng(seed) // mulberry32 -> () => float [0,1)
export function rngHelpers(rng) // { int(min,max), range(min,max), pick(arr), jitter(amount), chance(p) }
```

- [x] **Step 1: Failing tests.** Determinism: two `makeRng(42)` streams produce identical first 100 values; different seeds differ; `range` stays in bounds over 1000 draws; `pick` returns array elements; `int` inclusive bounds; `hashSeed('')` does not throw and is stable.
- [x] **Step 2: Run** `npx vitest run tests/rng.test.js` — expect FAIL (module missing).
- [x] **Step 3: Implement** xmur3 + mulberry32 (reference implementations, no license issue).
- [x] **Step 4: Tests pass.**
- [x] **Step 5: Commit** `feat: seeded rng`

### Task 2: Game config and walker ladder

**Files:**
- Create: `src/game/config.js`
- Test: `tests/config.test.js`

**Contents:**
```js
export const WORLD = { width: 1280, height: 720, gapX0: 320, gapX1: 960, deckY: 400, groundY: 700 };
export const MATERIAL = {
  stick: { breakStretch: 3.0, stiffness: 0.9, damping: 0.08, thickness: 6, density: 0.0012 },
  cable: { breakStretch: 14.0, stiffness: 0.06, damping: 0.02, thickness: 3 },
};
export const MASS_SCALE = 0.002; // kg -> matter mass units
export const LADDER = [ /* {id,name,massKg,speed, size} x10: fly, mouse, toy car, cat, dog, human, horse, car, elephant, tank */ ];
export const FACTS = { flat: [...], truss: [...], suspension: [...] };
export const HINTS = [...];
export const DEFAULTS = { type: 'truss', budget: 120, stickLen: 80 };
```

Ladder masses: fly 0.01, mouse 0.05, toy car 0.5, cat 4, dog 15, human 70, horse 400, car 1200, elephant 5000, tank 42000. Walker speed px/tick: small 2.0 down to tank 0.9.

- [x] **Step 1: Failing tests:** LADDER strictly increasing massKg; 10 entries; unique ids; FACTS has all 3 bridge types with 1+ strings each; MATERIAL breakStretch(stick) < breakStretch(cable); DEFAULTS in slider ranges (budget 20..300, stickLen 40..120).
- [x] **Step 2:** Run, expect FAIL.
- [x] **Step 3: Implement config.**
- [x] **Step 4:** Tests pass.
- [x] **Step 5: Commit** `feat: config and walker ladder`

### Task 3: Bridge model

**Files:**
- Create: `src/game/model.js`
- Test: `tests/model.test.js`

**API:**
```js
export function createModel(type, seed, budget, stickLen) // -> {type, seed, budget, stickLen, nodes: [], members: [], meta: {}}
export function addNode(model, x, y, fixed) // -> node {id,x,y,fixed}
export function addMember(model, aId, bId, material, strength) // -> member {id,a,b,material,strength}
export function sticksUsed(model) // count members with material 'stick'
export function validate(model) // -> array of error strings
export function isConnected(model) // BFS: every node reachable from first fixed node
export function deckPath(model) // ordered deck member chain from left anchor to right anchor (deck members = members whose both endpoints have y === deckY within epsilon)
```

- [x] **Step 1: Failing tests:** addNode/addMember id refs; validate catches dangling refs, duplicate ids, zero-length members; sticksUsed counts only sticks; isConnected true for chain, false for orphan; deckPath returns ordered left-to-right chain covering the full gap for a hand-built chain.
- [x] **Step 2:** Run, expect FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4:** Tests pass.
- [x] **Step 5: Commit** `feat: bridge model`

### Task 4: Bridge generators

**Files:**
- Create: `src/game/bridge/generator.js`, `src/game/bridge/flat.js`, `src/game/bridge/truss.js`, `src/game/bridge/suspension.js`
- Test: `tests/generators.test.js`

**API:**
```js
// generator.js
export function generateBridge(type, seedStr, budget, stickLen) // dispatch -> validated model (throws on invalid)
// flat.js / truss.js / suspension.js
export function generateFlat(rng, helpers, budget, stickLen) // etc, all return model via model.js builders
```

**Generator invariants (all tested):**
1. Anchors: fixed nodes at (gapX0, deckY) and (gapX1, deckY).
2. Deck: continuous member chain at deckY from left anchor to right anchor; consecutive deck node spacing <= stickLen + 7 px (jitter included).
3. Budget: sticksUsed <= budget. If budget < deck stick count, deck is thinned to alternate longer spans? No: deck always full (deck count = ceil(span/stickLen) which is <= 300 max panels; if budget < deck, remaining members simply absent and validate still passes because deck uses its own sticks first). So: deck is built first, structure second, stop when budget hits.
4. Reproducible: same seed + params -> deep-equal models. Different seeds -> different node jitter (compare node coords).
5. Truss: `meta.substyle` in {warren, pratt, howe}; across 50 seeds all three appear; every member endpoint is an existing node; top chord nodes above deck (y < deckY) with height 40..90 px; diagonals only connect deck node -> top node or top -> top.
6. Suspension: two towers (x = gapX0 + towerInset, gapX1 - towerInset) with height 120..200; main cable nodes follow parabola sag between tower tops to anchor points at deck level at the cliff edges; hangers (material cable) from cable nodes down to nearest deck node; all members valid; sticks = towers + deck + tower cross-braces only.

Jitter: node positions +/-3 px (never on anchors), member strength = base * (0.9..1.1).

- [x] **Step 1: Failing tests** for all invariants above (parametrize over types and 50 seeds; use a deterministic loop of seeds like `seed-${i}`).
- [x] **Step 2:** Run, expect FAIL.
- [x] **Step 3: Implement** the three generators and dispatcher. Keep geometry math simple: Warren = apex over every 2nd panel node; Pratt/Howe = verticals at panel nodes + diagonals per panel (direction flips between pratt/howe); suspension parabola: y = topY + sag * (1 - ((x - cx) / halfW)^2) inverted, use catenary-approx parabola sampled every panel. Flat generator: if budget >= 2x deck count, double the deck (two glued layers, doubles deck strength).
- [x] **Step 4:** Tests pass.
- [x] **Step 5: Commit** `feat: bridge generators`

### Task 5: Physics simulation

**Files:**
- Create: `src/game/physics/sim.js`
- Test: `tests/sim.test.js`

**API:**
```js
export function createSim(model, hooks) // -> sim
// sim: { world, bodies, joints, cables, tick(dtMs), spawnWalker(walkerDef), activeWalker, brokenCount, maxStrainRatio() , walkerCrossed(), walkerFell() }
// joints: [{memberId, constraint, bodies, strength}]
// hooks: { onBreak(memberId), onWalkerExit(name), onWalkerFall(name) }
```

**Implementation contract:**
- Matter Engine with gravity {x:0, y:1}. Ground body (static rectangle at groundY spanning world width).
- Collision groups/categories: all bridge bodies `collisionFilter.group = -1` (members never collide with each other). Deck member bodies get category `0x0002`, structure bodies `0x0004`, ground keeps `0x0001`. Walker: group 0, category `0x0008`, mask `0x0003` (collides with ground + deck only, so trusses and towers never block walkers).
- Sticks: rectangle bodies between node pairs, chamfered. Joint types: deck-to-deck joints are glued (two constraints per joint, offsets +/-(stick thickness) perpendicular, high stiffness) modeling glued popsicle laps; structure and truss joints are pinned (single constraint, pointA/pointB at node). Node itself is not a body. Build a joint map: node id -> list of (member, body); for each node, connect the member bodies pairwise.
- Cables: constraint-only members (no body), except cable nodes need tiny bodies (circles r=2, density tiny, collisionFilter.group = -1).
- Break check each tick (after Engine.update): for every live joint, stretch = distance(worldA, worldB); strainRatio = stretch / member.strength. Ratio >= 1 -> remove constraint, mark broken, call onBreak. Cable slack: if cable compressed (distance < restLength), set stiffness 0 this tick; else restore.
- Walkers: circle body, radius by size, mass = massKg * MASS_SCALE via density; spawn at x = gapX0 - 60, y = deckY - radius - 10. Drive: set horizontal velocity toward gapX1 + 80, keep gravity. Crossed when x > gapX1 + 60; fell when y > deckY + 120.
- maxStrainRatio(): max over live joints of strainRatio, for HUD stress colors.
- Fixed stepping: tick(1000/60) calls Engine.update(engine, 1000/60) exactly once. No wall clock inside sim.

- [x] **Step 1: Failing tests:**
  1. Flat bridge, budget 30 (deck only), fly walker: survives 300 ticks, walker crossed.
  2. Flat bridge, minimal deck, human walker: breaks within 600 ticks (brokenCount > 0), onWalkerFall fired.
  3. Truss, budget 200, stickLen 80, human walker: survives (brokenCount === 0) and crosses within 1500 ticks.
  4. Tank on any bridge: breaks within 300 ticks.
  5. Cable slack unit: two anchored bodies joined by cable, push together -> cable constraint stiffness 0, pull apart -> restored; overstretch cable breaks.
  6. Determinism: two sims same model, same op sequence -> same broken member ids in same order.
  7. strainRatio: loaded flat bridge mid-deck joint has higher ratio than near-anchor joint under walker at center.
- [x] **Step 2:** Run, expect FAIL.
- [x] **Step 3: Implement.** Calibrate MATERIAL.breakStretch / densities until invariants hold. If test 3 will not pass with any threshold, weaken walker masses via MASS_SCALE first (document final values in config).
- [x] **Step 4:** Tests pass.
- [x] **Step 5: Commit** `feat: physics simulation with breaking joints`

**Calibration notes (final design):**
- Parallel stick members sharing both endpoints merge into ONE laminate rect body (thickness 6*n, strength = sum of member strengths). Deck laminate top-aligned with cliff surface.
- Structure bracing and tower members get strength bonus x3.5 (axial-load argument). Deck lamination (up to 4 layers) lives in truss.js/suspension.js generators; flat stays single-layer.
- Engine: gravity scale 0.0005, constraintIterations 10 (4 diverges on pratt/howe triangulation).
- One pin joint per adjacent laminate pair per node, stiffness 0.95, damping 0.05. No glue offset constraints (over-constrained). Matter self-rotates constraint offsets by (body.angle - angleA); compute offsets from creation-time world position and read stretch via Constraint.pointAWorld/pointBWorld.
- Settle: 450 ticks at first spawnWalker, then one-time velocity zeroing and per-joint baseline capture; ratio = (stretch - baseline)/strength. Walker drive = smooth accel toward speed (max dv 0.08/tick).
- Cables: damping 0 (damping brakes light clamp bodies), slack check each tick, pure-cable nodes get r=2 clamp circles.
- Final constants in config.js: stick breakStretch 0.6 / density 0.0002, cable stiffness 0.06 / breakStretch 14.0, MASS_SCALE 0.05.

### Task 6: Game state machine

**Files:**
- Create: `src/game/state.js`
- Test: `tests/state.test.js`

**API:**
```js
export function createGameState() // -> { state: 'menu', data }
export function transition(gs, event, payload) // pure-ish reducer, returns gs
// events: START(cfg), BUILT, WALKER_EXIT(name,massKg), WALKER_FALL(name,massKg), BROKE(memberId), DONE, REPLAY, NEW
// states: menu, building, testing, result
// tracks: heaviestCrossedKg, heaviestCrossedName, brokeBy {name}, resultReason, fact (from FACTS by type), walkerIndex
```

- [x] **Step 1: Failing tests:** menu + START(cfg) -> building; building + BUILT -> testing; testing + WALKER_EXIT updates heaviest; testing + WALKER_FALL(name) -> result with reason 'collapsed', brokeBy=name, fact present; testing + DONE (tank crossed) -> result 'survived'; result + REPLAY -> building; result + NEW -> menu; unknown event in state throws or is ignored (assert ignored).
- [x] **Step 2:** Run FAIL. **Step 3: Implement. Step 4:** Pass.
- [x] **Step 5: Commit** `feat: game state machine`

Notes: reducer is pure (returns new state, input untouched); fact picked deterministically via hashSeed(config.seed) % FACTS[type].length; REPLAY resets round tracking and keeps config; DONE accepts optional payload.reason ('survived' default, 'stuck' for ladder stalls); BROKE appends to brokenMembers for HUD.

### Task 7: Walker ladder driver

**Files:**
- Create: `src/game/walkers.js`
- Test: `tests/walkers.test.js`

**API:**
```js
export function ladderSequence() // -> LADDER copy
export function nextWalker(index) // -> def | null
export function walkerPhase(x, speed) // gait phase for render
```

Driver logic lives in a small controller `createLadderController(sim, hooks)` in walkers.js: spawns walker i, on exit/fall advances or finishes. Stall rule: if a walker neither crosses nor falls within 1800 ticks (30 s sim), the round ends with reason 'stuck'. Unit-test with a fake sim (object with recorded calls): spawn order matches LADDER, stops after tank, fall stops the ladder, stall ends with 'stuck'.

- [x] **Step 1: Failing tests** (order, termination, fall stops). **Step 2:** FAIL. **Step 3: Implement. Step 4:** Pass.
- [x] **Step 5: Commit** `feat: walker ladder controller`

Notes: controller exposes start/tick/onExit/onFall; main loop wires sim hooks to onExit/onFall and ticks the controller each frame. onFinish(reason, def) fires once with reason 'survived' (def null) | 'collapsed' | 'stuck'. Stall rule: ticksSinceProgress >= 1800 where progress = walker x advancing > 2px. readX prefers sim.activeWalker.position.x, falls back to sim.walkerX (test seam).

### Task 8: Renderer (canvas art)

**Files:**
- Create: `src/render/renderer.js`, `src/render/sky.js`, `src/render/weather.js`, `src/render/scenery.js`, `src/render/characters.js`
- No unit tests (visual); e2e covers smoke.

**Contracts:**
- `createRenderer(canvas) -> { draw(frameState, dtMs) }`. frameState = { sim, model, tickCount, walkersToDraw, cameraShake, speed }.
- sky.js: day/night cycle over 240 in-game minutes (1 game hour = 900 ticks). Gradient from palette keyframes (dawn, noon, dusk, night); sun and moon arc; stars at night (seeded positions).
- weather.js: 5-8 drifting clouds (seeded), rain system toggled by seed chance 30% (600 particles max), 2 bird flocks passing. Rain drawn as short streaks, wind slant.
- scenery.js: 3 parallax canyon layers, river at bottom with animated shimmer bands, low-poly trees on cliffs.
- Bridge draw: stick bodies as rotated rounded rects, wood tan with 2 grain lines, stress tint lerp green->yellow->red by joint strainRatio; cables as dark curved lines (sag from body positions); broken members flash red then tumble (they keep simulating as debris).
- characters.js: one draw fn per ladder entry `(ctx, x, y, phase, scale)`. Low-poly style: 3-8 polygons each, distinct silhouettes (fly wings flap, cat tail sway, human two legs swinging, tank treads roll marks). Fun colors, googly eyes on animals.
- Camera shake: on onBreak, shake amplitude 6 px decaying over 20 ticks. Dust particles at break point (12 puffs max).
- Draw order: sky, stars/sun/moon, clouds, far canyon, river, near canyon, bridge, walkers, rain, HUD-canvas extras none (HUD is DOM).

- [x] **Step 1: Implement modules** (pure draw functions, no state machine logic).
- [x] **Step 2: Smoke via** a scratch `?drawtest=1` mode in main.js later; verified in e2e. Added tests/render.test.js: pure helper assertions (sky keyframes, celestial swap, seeded weather/stars/scenery) + proxy-ctx smoke of every character drawer and full renderer draw with a live sim (building phase, live bridge, camera shake, dust).
- [x] **Step 3: Commit** `feat: low-poly renderer, sky, weather, characters`

Notes: broken members stay in the physics world as debris (mask flipped to ground-only so they tumble onto the canyon floor, never block walkers; tracked in sim.debris with plugin.brokeAt for the red flash fade). Stress tint lerps wood tan -> red by joint |ratio|. Day cycle = 3600 ticks (4 game hours). Weather rain chance 30% per seed. Stick bodies drawn from exact world vertices (AABBs are wrong for rotated sticks).

### Task 9: UI overlays

**Files:**
- Create: `src/ui/menu.js`, `src/ui/hud.js`, `src/ui/result.js`; Modify: `src/style.css`

**Contracts:**
- menu.js: `createMenu(root, onStart)` renders 3 type cards (with mini canvas sketch drawn from generator output), budget slider (20..300, default 120), stickLen slider (40..120, default 80), seed input + dice button, hint line rotating from HINTS, Start button. Calls `onStart(cfg)`.
- hud.js: `createHud(root)` -> `{ setWalker(def, index, total), setSticks(used, budget), setStress(ratio), setSeed(seedStr), setWeather(text) }`. DOM strip, data-test attributes: `data-hud="walker"`, `"stress"`, `"sticks"`.
- result.js: `createResult(root, onReplay, onNew)` -> `{ show(payload), hide() }`. Payload: title (Collapsed! / Indestructible!), heaviest crossed line, broke-by line, fact, buttons Replay / New Bridge. `data-screen="result"`.
- All overlays absolute-positioned over canvas; CSS fun rounded cards, no external fonts.

- [x] **Step 1: Implement.** **Step 2:** Verified via jsdom unit tests (tests/ui.test.js): card selection + Start emits config, live slider outputs, dice, hint rotation, HUD pill setters incl. stress clamping and ton formatting, result show/hide + button handlers. Browser verification in e2e (Task 11).
- [x] **Step 3: Commit** `feat: menu, hud, result overlays`

Notes: menu cards include mini canvas sketches (src/ui/sketch.js drawTypeSketch, null-ctx guard for jsdom); seed defaults 'pop-1'; hint rotates every 5 s; result panel data-screen="result" starts hidden.

### Task 10: Main wiring

**Files:**
- Create: `src/main.js`; Modify: `index.html` (script tag)

**Contract:**
- Boot: create menu; on Start: generate model, transition START->building; build animation 60 ticks (sticks fly from offscreen to joints, lerp), then BUILT -> testing: create sim, ladder controller, HUD live.
- rAF loop with 1000/60 accumulator; each fixed step: sim.tick; ladder controller update; FSM events forwarded. Render each frame with interpolated camera. Pause when tab hidden (visibilitychange stops accumulator drift).
- Query params for tests: `?seed=`, `?type=`, `?budget=`, `?stickLen=`, `?speed=` (sim steps per frame multiplier, default 1). Debug handle `window.__game = { getState, getConfig, skipToWalker(i) }` for e2e.
- Resize: scale canvas CSS size, keep 1280x720 logical, letterbox.

- [x] **Step 1: Implement.**
- [x] **Step 2: Smoke:** `npm run build` clean; `npm run preview` serves; `curl localhost:4173` returns HTML.
- [x] **Step 3: Commit** `feat: main game loop and wiring`

Notes: query-param auto-start added (src/game/params.js parseParams, unit-tested; merges with DEFAULTS); ladder controller gained skip(index) for `skipToWalker`; sim keeps rendering during result state (frozen collapse scene); HUD updates every 10 ticks incl. weather label from renderer weather.

### Task 11: E2E suite (Brave CDP)

**Files:**
- Create: `e2e/run.mjs`
- Test: run via `npm run e2e`

**Contract:**
- Launch `/usr/bin/brave-browser-stable --headless=new --remote-debugging-port=<port> --no-sandbox --disable-gpu --user-data-dir=/tmp/opencode/brave-e2e` via `child_process.spawn`; pick a free port at runtime (net server listen(0) trick, so reruns never conflict); wait for `http://127.0.0.1:<port>/json/version`; connect puppeteer-core.
- Start preview server (spawn `npm run preview`, wait for 200).
- Scenarios (each its own page):
  1. Load `/`: no console errors (collect `page.on('console'|'pageerror')`), canvas exists, menu visible (`[data-screen="menu"]`).
  2. Flat + budget 30 + seed `e2e-flat`: click Start, expect result screen within 60 s wall time, expect `brokeBy` populated (weak bridge must fall), screenshot `e2e/shots/flat.png`.
  3. Truss + budget 200: use `?speed=4` and `skipToWalker` to jump to human; expect no errors; screenshot `truss.png`.
  4. Suspension + budget 100: run with `?speed=6` until walker HUD updates at least twice; screenshot `suspension.png`; assert stress HUD element text matches `/^\d+%/`.
  5. Replay button: after result, click Replay, expect testing state again with same seed.
  6. Day/night: two screenshots 5 s apart in a running game differ in pixel data (canvas readback via `canvas.toDataURL` in page).
- Exit code 0 only if all scenarios pass; kill spawned processes in `finally`.

- [x] **Step 1: Implement runner.** **Step 2:** Run `npm run e2e`, fix app bugs it finds (this is the real integration test). **Step 3:** All green, screenshots exist.
- [x] **Step 4: Commit** `test: brave cdp e2e suite`

Bugs e2e caught and fixed: (1) Replay used START from result state which the FSM ignores -> split beginRound/startRound, Replay path transitions REPLAY first; (2) HUD sticks showed `undefined/200` because main.js read `model.sticksUsed` (a function in model.js) -> import + call sticksUsed(model), plus new S4 sticks-format assertion; (3) favicon 404 -> inline SVG data URI. Runner details: builds dist first (preview serves built files), dynamic free ports for both CDP and preview (--host 127.0.0.1 because vite binds IPv6 ::1 otherwise), killTree SIGTERM->SIGKILL in finally. Vision check of screenshots confirmed scene + overlay render correctly.

### Task 12: Final gate

- [x] `npm test` green. (149/149, 11 files)
- [x] `npm run build` clean.
- [x] `npm run e2e` green with screenshots. (17 PASS, flat/truss/suspension.png)
- [x] Update all checkboxes in this plan; verify spec coverage one last time.
- [x] Commit `chore: final gate and plan checkboxes`

Spec coverage verified: menu (3 type cards with sketches, budget 20-300, stickLen 40-120, seed + dice, rotating hints), build animation, walker ladder (10 walkers fly->tank), stuck rule (1800 ticks), collapse result overlay (heaviest crossed / broke under / fact / Replay / New Bridge), seeded determinism everywhere in game logic, stress HUD %, day/night cycle, seeded weather (rain 30%), canyon + river + trees scenery, camera shake + dust on break, tumbling debris, query params + window.__game debug hooks for e2e. No audio, as specified.

---

## Feature: Variable canyon span (4th round setting)

The canyon gap is currently fixed at 640 px (`WORLD.gapX0/gapX1`). This feature makes the span a 4th round setting: menu slider 480-800 (step 20, default 640) plus `?span=` query param. Geometry becomes per-round: `worldFor(span)` derives a centered gap (`gapX0 = (1280 - span) / 2`) and every span-dependent module (model deckPath, generators, physics cliffs, scenery) reads geometry from the model's span instead of the `WORLD` constant. `WORLD` itself stays as the fixed canvas-size/world reference (= `worldFor(640)` values) for full-canvas consumers (sky, weather, resize).

Budget safety: at span max 800 and stickLen min 40 the deck needs ceil(800/40) = 20 panels = 20 sticks = budget slider minimum, so a complete deck is always affordable. Suspension gets a degenerate guard: when fewer than 2 sticks remain after the deck, towers/cables are skipped (a towerless cable-less deck) so `sticksUsed <= budget` holds everywhere.

### Task 13: Span config + model geometry

**Files:**
- Modify: `src/game/config.js`
- Modify: `src/game/model.js`
- Test: `tests/config.test.js`, `tests/model.test.js`

- [x] **Step 1: Failing tests.** Config: `worldFor(640)` matches WORLD values; `worldFor(800)` has `gapX1 - gapX0 === 800` and is centered; clamps outside `[480, 800]`; `DEFAULTS.span` within SPAN range. Model: `createModel` stores span, defaults 640; `deckPath` resolves anchors for a hand-built span-700 chain at `worldFor(700)` anchors.
- [x] **Step 2: Implement.** config.js: add `SPAN = { min: 480, max: 800, default: 640 }`, `worldFor(span)` (clamp + round + centered gap), `DEFAULTS.span`. model.js: `createModel(type, seed, budget, stickLen, span)` sets `span: span ?? 640`; `deckPath` uses `worldFor(model.span)`.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: variable span config and model geometry`

### Task 14: Span-aware generators

**Files:**
- Modify: `src/game/bridge/deck.js`, `src/game/bridge/truss.js`, `src/game/bridge/suspension.js`, `src/game/bridge/generator.js`
- Test: `tests/generators.test.js`

- [x] **Step 1: Failing tests.** Parametrized (3 types x spans [480, 800] x budgets [20, 200]): `validate` empty, connected, `sticksUsed <= budget`, anchors fixed at exact `worldFor(span)` corners, deck chain complete with spacing `<= stickLen + 7`, reproducible per seed. Suspension degenerate: span 800 / budget 20 / stickLen 40 stays within budget (no towers).
- [x] **Step 2: Implement.** deck.js: drop `WORLD` destructure + `spanWidth()`, use `worldFor(model.span)`; same for truss.js (score via `deck.nodes[i].x`, candidates take `deckY` param) and suspension.js (geometry per model; `remaining < 2` skips towers/cables, `meta.towerHeight = 0`). generator.js: accept + forward `span`.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: span-aware bridge generators`

### Task 15: Span-aware physics

**Files:**
- Modify: `src/game/physics/sim.js`
- Test: `tests/sim.test.js`

- [x] **Step 1: Failing tests.** Flat span 800 + fly: walker spawns left of the new gap (`x < worldFor(800).gapX0`), crosses within 900 ticks (proves cliffs + crossed threshold moved). Truss span 480 budget 200 + human: survives (seed n1; seed sim-narrow at 6 panels is a 2-apex warren that legitimately snaps 2 sticks yet still crosses).
- [x] **Step 2: Implement.** sim.js: compute `const { width, height, gapX0, gapX1, deckY, groundY } = worldFor(model.span)` inside `createSim`; delete module-level `WORLD` destructure.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: span-aware physics world`

### Task 16: Span in scenery, menu, params, e2e

**Files:**
- Modify: `src/render/scenery.js`, `src/render/renderer.js`, `src/ui/menu.js`, `src/game/params.js`, `src/main.js`, `e2e/run.mjs`
- Test: `tests/render.test.js`, `tests/ui.test.js`, `tests/params.test.js`

- [x] **Step 1: Failing tests.** Scenery: `createScenery(seed, 800)` trees all inside the new cliffs; renderer/menu/params: span slider exists with default, `onStart` payload includes span, `parseParams` reads `span`.
- [x] **Step 2: Implement.** scenery.js: `createScenery(seed, span)` stores span, `drawScenery` uses `worldFor(scenery.span)` (backdrop midpoints center-relative). renderer.js: `ensureAssets(seed, span)` resets on span change. menu.js: slider 480-800 step 20 + payload. params.js: `span` numeric key. main.js: pass `span` in draw frameState.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: E2e scenario S7:** `?seed=e2e-span&type=truss&budget=200&span=800&speed=4` reaches testing, `getConfig().span === 800`, screenshot `span.png`; run `npm run e2e` green.
- [x] **Step 5: Commit** `feat: span setting in scenery, menu and e2e`

### Task 17: Final gate (span feature)

- [x] `npm test` green.
- [x] `npm run build` clean.
- [x] `npm run e2e` green (all scenarios incl. span).
- [x] Tick all checkboxes above; commit `chore: span feature final gate`

---

## Feature: Random cold-start seed, menu memory, in-game speed and exit

Three UX behaviors: (1) every cold start of the page randomizes the menu seed (UI-level `Math.random`, never game logic); (2) returning to the menu after a round (result screen New Bridge or the new in-game exit) keeps the previous type, sliders, and seed; (3) during building/testing the HUD strip gets a speed button cycling 1x -> 4x -> 8x -> 16x -> 1x and an exit button that abandons the round back to the menu.

### Task 18: FSM EXIT event

**Files:**
- Modify: `src/game/state.js`
- Test: `tests/state.test.js`

- [x] **Step 1: Failing tests.** EXIT from building and from testing returns a fresh menu state (createGameState equal); EXIT in menu/result state is ignored (same object returned).
- [x] **Step 2: Implement.** Add `EXIT: () => createGameState()` to the building and testing handler maps.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: fsm exit event`

### Task 19: Menu cold-start random seed + prefill

**Files:**
- Modify: `src/ui/menu.js`
- Test: `tests/ui.test.js`

- [x] **Step 1: Failing tests.** Cold start: seed input matches /^[a-z]+-\d{3}$/ and differs across two menus. Prefill: createMenu(root, cb, {type:'suspension', seed:'keep-1', budget:66, stickLen:100, span:760}) shows those values (selected card, slider values + outputs, seed input), and Start emits them unchanged.
- [x] **Step 2: Implement.** Extract `randomSeed()` (SEED_WORDS + Math.random); third `initial` param: type/s budget/stickLen/span baked into template, seed assigned via input.value after render (avoids HTML injection from query params); dice reuses randomSeed.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: menu random cold seed and prefill`

### Task 20: HUD speed and exit buttons

**Files:**
- Modify: `src/ui/hud.js`, `src/style.css`
- Test: `tests/ui.test.js`

- [x] **Step 1: Failing tests.** createHud renders `[data-action="speed"]` (label `1x`) and `[data-action="menu"]`; `setSpeed(8)` shows `8x`; clicking the buttons fires the onSpeed/onMenu callbacks passed to createHud(root, {onSpeed, onMenu}).
- [x] **Step 2: Implement.** Append two buttons to the pill row; setSpeed(n) writes `${n}x`; wire click listeners; style as HUD buttons.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: hud speed and exit buttons`

### Task 21: Main wiring + e2e

**Files:**
- Modify: `src/main.js`, `e2e/run.mjs`

- [x] **Step 1: Implement.** main.js: `let speed` (was const); SPEEDS = [1,4,8,16]; hud created with onSpeed (cycle, hud.setSpeed) and onMenu (exitToMenu: keep gs.config copy, destroy hud/result, transition EXIT, null sim/ctl/model, createMenu(app, startRound, prevConfig)); onNew passes previous config to createMenu the same way; hud.setSpeed(speed) after creation.
- [x] **Step 2: E2e S8 (cold seed):** two fresh page loads produce different menu seeds matching the pattern. **S9 (speed + exit):** `?seed=e2e-exit&type=flat&budget=40&speed=1`, click speed button -> `4x`, click menu -> menu screen visible with seed `e2e-exit`, budget `40`, flat card selected; Start -> testing again. `npm run e2e` green.
- [x] **Step 3: Commit** `feat: in-game speed and exit wiring with e2e`

### Task 22: Final gate (menu memory feature)

- [x] `npm test` green.
- [x] `npm run build` clean.
- [x] `npm run e2e` green (all scenarios incl. cold seed, speed, exit).
- [x] Tick all checkboxes above; commit `chore: menu memory final gate`

### Task 23: Fix suspension bridges collapsing upside down (bugfix, done before Tasks 18-22)

**Bug:** every suspension bridge rendered with the cable system hanging below the deck. Root causes: (1) the sim modeled tower stacks as pin-jointed segment chains, which buckle during settle (tower tops rotated ~140 degrees and fell to y~540), dragging the main cable and hangers under the deck; (2) generator edge case: `sag` (40-80) could exceed the budget-clamped `towerHeight` (min 40) on tight budgets, placing main-cable nodes below the deck line in the model itself.

**Fix (TDD):** failing tests first - sim test asserts tower bodies reach model height (+-25 px) and all cable clamps stay above deckY after settle for seeds sus/e2e-susp/x2; generator test sweeps budget 22-60 x stickLen 40-45 x span 800 asserting no cable-incident node sits below the deck line. Then: suspension.js marks tower members `glued: true` and clamps `sag = min(rng(40,80), max(10, towerHeight - 20))`; sim.js merges each glued chain into ONE rigid column body (registerGroup/bodyOpts refactor; parallel laminate grouping skips chain members) - a glued popsicle stack is a solid column, and pin+weld constraint pairs were still solver-soft under cable load (148 px lean). Weld world anchors at fixed tower bases remain as the base attachment.

- [x] Failing tests written and confirmed failing (tower top off by 311 px pre-fix; cable below deck in 6/480 generator combos).
- [x] `npx vitest run` green (175/175).
- [x] `npm run e2e` green; suspension.png vision check: towers above deck, cable arcs over towers sagging above deck, hangers visible, nothing below deck.
- [x] Commit `fix: suspension towers buckle and cables hang below deck`

---

## Feature: Stuck-walker speech bubbles + randomized canyon scene

Two additions: (1) a walker stuck in one spot for more than 5 seconds (300 ticks) shows a speech bubble of random expletive glyphs/angry emojis above its head, reshuffling every 45 ticks while stuck - deterministic per seed+tick (never Math.random in game logic); (2) the canyon scenery varies per seed - cliff jag count/amplitude, backdrop mountain ridge lines (both layers), tree count per cliff, river shimmer density - instead of the same fixed jaggy silhouette every round.

### Task 24: Rant module + stuck-bubble constant

**Files:**
- Create: `src/game/rant.js`
- Modify: `src/game/config.js` (export `STUCK_BUBBLE_TICKS = 300`)
- Test: `tests/rant.test.js`, `tests/config.test.js`

- [x] **Step 1: Failing tests.** rantFor(seed, tick): deterministic (same seed+tick = same string), glyphs-only from the exported GLYPHS set, length 3-4, changes when the 45-tick window advances, same string across the window. Config: STUCK_BUBBLE_TICKS is 300.
- [x] **Step 2: Implement.** `GLYPHS` array ('@','#','$','!','?','%','&' + angry emojis), `rantFor(seed, tick)` builds `rngHelpers(makeRng(seed + ':rant:' + floor(tick/45)))`, picks int(3,4) glyphs.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: deterministic rant generator for stuck walkers`

### Task 25: Speech bubble rendering + stuck wiring

**Files:**
- Modify: `src/render/characters.js` (export `drawSpeechBubble(ctx, x, y, text)`), `src/render/renderer.js` (draw w.rant bubbles), `src/main.js` (attach rant when `ctl.ticksSinceProgress >= STUCK_BUBBLE_TICKS`)
- Test: `tests/render.test.js`

- [x] **Step 1: Failing test.** drawSpeechBubble smoke with the fake ctx (no throw, calls beginPath/fillText); renderer smoke frameState with a walker carrying `rant` draws without throwing.
- [x] **Step 2: Implement.** Bubble: rounded rect + tail above the walker head, text via fillText; renderer draws it for walkers with a rant; main.js computes `rantFor(gs.config.seed, tickCount)` when stuck >= 300 ticks (exposed `ctl.ticksSinceProgress` already public).
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: stuck walkers show angry speech bubbles`

### Task 26: Randomized canyon scene

**Files:**
- Modify: `src/render/scenery.js`
- Test: `tests/render.test.js`

- [x] **Step 1: Failing tests.** createScenery: wallJags.left/right length in 4..7 and varies across seeds (>= 2 distinct counts over 10 seeds); ridge1/ridge2 arrays of 3..6 seeded points {xFrac in 0..1, h > 0}, varying across seeds; trees length in 6..10 (3-5 per cliff); riverSticks length 5..9; same seed still fully deterministic (existing test). drawScenery smoke with fake ctx does not throw.
- [x] **Step 2: Implement.** Draw both backdrop layers from ridge points (x = gapX0 - 30 + xFrac * (span + 60), peaks subtract h from the layer base line); jag count/amplitude from seed; tree and river counts from seed.
- [x] **Step 3: `npx vitest run` green.**
- [x] **Step 4: Commit** `feat: per-seed randomized canyon and backdrop`

### Task 27: Final gate (bubbles + scenery feature)

- [x] `npm test` green.
- [x] `npm run build` clean.
- [x] `npm run e2e` green (full suite).
- [x] Manual visual check of a stuck-bubble round via dev server; tick all checkboxes above; commit `chore: bubbles and scenery final gate`

Notes: a genuinely-stuck round needed the exit hooks wired in the probe (fly crossing on flat/300/120 was a probe artifact); the real stall is the elephant (walker 8) on suspension/300/120 seed stuck-0. Headless screenshot at 3x confirmed the white tailed bubble above the stuck elephant with bold glyph text (symbols render everywhere; emoji legibility depends on system emoji fonts, fine in desktop Brave). 194/194 unit, build clean, e2e 32/32.
