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

- [ ] **Step 1: Create package.json**

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

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
e2e/shots/
```

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
});
```

- [ ] **Step 4: Create index.html** with `<div id="app">`, `<canvas id="game">`, mounts `src/main.js`, links `src/style.css`. Minimal shell; menu/result overlays are built by UI code in Task 9.

- [ ] **Step 5: Create src/style.css** skeleton (full-screen canvas, overlay base classes). Filled out in Task 9.

- [ ] **Step 6: Sanity test** `tests/sanity.test.js`: `expect(1 + 1).toBe(2)`.

- [ ] **Step 7: Verify:** `npm install` succeeds, `npx vitest run` passes 1 test, `npm run build` produces `dist/`.

- [ ] **Step 8: Commit** `chore: project scaffold`

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

- [ ] **Step 1: Failing tests.** Determinism: two `makeRng(42)` streams produce identical first 100 values; different seeds differ; `range` stays in bounds over 1000 draws; `pick` returns array elements; `int` inclusive bounds; `hashSeed('')` does not throw and is stable.
- [ ] **Step 2: Run** `npx vitest run tests/rng.test.js` — expect FAIL (module missing).
- [ ] **Step 3: Implement** xmur3 + mulberry32 (reference implementations, no license issue).
- [ ] **Step 4: Tests pass.**
- [ ] **Step 5: Commit** `feat: seeded rng`

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

- [ ] **Step 1: Failing tests:** LADDER strictly increasing massKg; 10 entries; unique ids; FACTS has all 3 bridge types with 1+ strings each; MATERIAL breakStretch(stick) < breakStretch(cable); DEFAULTS in slider ranges (budget 20..300, stickLen 40..120).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement config.**
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat: config and walker ladder`

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

- [ ] **Step 1: Failing tests:** addNode/addMember id refs; validate catches dangling refs, duplicate ids, zero-length members; sticksUsed counts only sticks; isConnected true for chain, false for orphan; deckPath returns ordered left-to-right chain covering the full gap for a hand-built chain.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat: bridge model`

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

- [ ] **Step 1: Failing tests** for all invariants above (parametrize over types and 50 seeds; use a deterministic loop of seeds like `seed-${i}`).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement** the three generators and dispatcher. Keep geometry math simple: Warren = apex over every 2nd panel node; Pratt/Howe = verticals at panel nodes + diagonals per panel (direction flips between pratt/howe); suspension parabola: y = topY + sag * (1 - ((x - cx) / halfW)^2) inverted, use catenary-approx parabola sampled every panel. Flat generator: if budget >= 2x deck count, double the deck (two glued layers, doubles deck strength).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat: bridge generators`

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

- [ ] **Step 1: Failing tests:**
  1. Flat bridge, budget 30 (deck only), fly walker: survives 300 ticks, walker crossed.
  2. Flat bridge, minimal deck, human walker: breaks within 600 ticks (brokenCount > 0), onWalkerFall fired.
  3. Truss, budget 200, stickLen 80, human walker: survives (brokenCount === 0) and crosses within 1500 ticks.
  4. Tank on any bridge: breaks within 300 ticks.
  5. Cable slack unit: two anchored bodies joined by cable, push together -> cable constraint stiffness 0, pull apart -> restored; overstretch cable breaks.
  6. Determinism: two sims same model, same op sequence -> same broken member ids in same order.
  7. strainRatio: loaded flat bridge mid-deck joint has higher ratio than near-anchor joint under walker at center.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement.** Calibrate MATERIAL.breakStretch / densities until invariants hold. If test 3 will not pass with any threshold, weaken walker masses via MASS_SCALE first (document final values in config).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat: physics simulation with breaking joints`

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

- [ ] **Step 1: Failing tests:** menu + START(cfg) -> building; building + BUILT -> testing; testing + WALKER_EXIT updates heaviest; testing + WALKER_FALL(name) -> result with reason 'collapsed', brokeBy=name, fact present; testing + DONE (tank crossed) -> result 'survived'; result + REPLAY -> building; result + NEW -> menu; unknown event in state throws or is ignored (assert ignored).
- [ ] **Step 2:** Run FAIL. **Step 3: Implement. Step 4: Pass.**
- [ ] **Step 5: Commit** `feat: game state machine`

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

- [ ] **Step 1: Failing tests** (order, termination, fall stops). **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Pass.
- [ ] **Step 5: Commit** `feat: walker ladder controller`

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

- [ ] **Step 1: Implement modules** (pure draw functions, no state machine logic).
- [ ] **Step 2: Smoke via** a scratch `?drawtest=1` mode in main.js later; verified in e2e.
- [ ] **Step 3: Commit** `feat: low-poly renderer, sky, weather, characters`

### Task 9: UI overlays

**Files:**
- Create: `src/ui/menu.js`, `src/ui/hud.js`, `src/ui/result.js`; Modify: `src/style.css`

**Contracts:**
- menu.js: `createMenu(root, onStart)` renders 3 type cards (with mini canvas sketch drawn from generator output), budget slider (20..300, default 120), stickLen slider (40..120, default 80), seed input + dice button, hint line rotating from HINTS, Start button. Calls `onStart(cfg)`.
- hud.js: `createHud(root)` -> `{ setWalker(def, index, total), setSticks(used, budget), setStress(ratio), setSeed(seedStr), setWeather(text) }`. DOM strip, data-test attributes: `data-hud="walker"`, `"stress"`, `"sticks"`.
- result.js: `createResult(root, onReplay, onNew)` -> `{ show(payload), hide() }`. Payload: title (Collapsed! / Indestructible!), heaviest crossed line, broke-by line, fact, buttons Replay / New Bridge. `data-screen="result"`.
- All overlays absolute-positioned over canvas; CSS fun rounded cards, no external fonts.

- [ ] **Step 1: Implement.** **Step 2: Verify in browser via e2e (Task 11).**
- [ ] **Step 3: Commit** `feat: menu, hud, result overlays`

### Task 10: Main wiring

**Files:**
- Create: `src/main.js`; Modify: `index.html` (script tag)

**Contract:**
- Boot: create menu; on Start: generate model, transition START->building; build animation 60 ticks (sticks fly from offscreen to joints, lerp), then BUILT -> testing: create sim, ladder controller, HUD live.
- rAF loop with 1000/60 accumulator; each fixed step: sim.tick; ladder controller update; FSM events forwarded. Render each frame with interpolated camera. Pause when tab hidden (visibilitychange stops accumulator drift).
- Query params for tests: `?seed=`, `?type=`, `?budget=`, `?stickLen=`, `?speed=` (sim steps per frame multiplier, default 1). Debug handle `window.__game = { getState, getConfig, skipToWalker(i) }` for e2e.
- Resize: scale canvas CSS size, keep 1280x720 logical, letterbox.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Smoke:** `npm run build` clean; `npm run preview` serves; `curl localhost:4173` returns HTML.
- [ ] **Step 3: Commit** `feat: main game loop and wiring`

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

- [ ] **Step 1: Implement runner.** **Step 2:** Run `npm run e2e`, fix app bugs it finds (this is the real integration test). **Step 3:** All green, screenshots exist.
- [ ] **Step 4: Commit** `test: brave cdp e2e suite`

### Task 12: Final gate

- [ ] `npm test` green.
- [ ] `npm run build` clean.
- [ ] `npm run e2e` green with screenshots.
- [ ] Update all checkboxes in this plan; verify spec coverage one last time.
- [ ] Commit `chore: final gate and plan checkboxes`
