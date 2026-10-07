import { WORLD, LADDER, DEFAULTS } from './game/config.js';
import { generateBridge } from './game/bridge/generator.js';
import { createSim } from './game/physics/sim.js';
import { createGameState, transition } from './game/state.js';
import { createLadderController } from './game/walkers.js';
import { parseParams } from './game/params.js';
import { createRenderer } from './render/renderer.js';
import { weatherLabel } from './render/weather.js';
import { createMenu } from './ui/menu.js';
import { createHud } from './ui/hud.js';
import { createResult } from './ui/result.js';

const BUILD_TICKS = 60;

const canvas = document.getElementById('game');
const app = document.getElementById('app');
const renderer = createRenderer(canvas);
const { cfg: cfgOverride, speed } = parseParams(window.location.search);

let gs = createGameState();
let model = null;
let sim = null;
let ctl = null;
let menu = null;
let hud = null;
let result = null;
let tickCount = 0;
let buildTick = 0;
let cameraShake = null;
let hudTick = 0;

function resize() {
  const scale = Math.min(window.innerWidth / WORLD.width, window.innerHeight / WORLD.height);
  canvas.style.width = `${Math.floor(WORLD.width * scale)}px`;
  canvas.style.height = `${Math.floor(WORLD.height * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

function completeCfg(cfg) {
  return { ...DEFAULTS, ...cfg };
}

function startRound(cfg) {
  const full = completeCfg(cfg);
  gs = transition(gs, 'START', full);
  model = generateBridge(full);
  sim = null;
  ctl = null;
  buildTick = 0;
  tickCount = 0;
  cameraShake = null;
  if (menu) menu.destroy();
  menu = null;
  if (hud) hud.destroy();
  if (result) result.hide();
  hud = createHud(app);
  hud.setSeed(full.seed);
  hud.setSticks(model.sticksUsed, full.budget);
}

function finishBuilding() {
  gs = transition(gs, 'BUILT');
  sim = createSim(model, {
    onBreak: (memberId) => {
      gs = transition(gs, 'BROKE', { memberId });
      cameraShake = { tick: tickCount };
      const body = sim.bodies.get(memberId);
      if (body) renderer.burst(body.position.x, body.position.y);
    },
    onWalkerExit: (id) => ctl.onExit(id),
    onWalkerFall: (id) => ctl.onFall(id),
  });
  ctl = createLadderController(sim, {
    onAdvance: (def) => {
      gs = transition(gs, 'WALKER_EXIT', { name: def.name, massKg: def.massKg });
    },
    onFinish: (reason, def) => {
      if (reason === 'collapsed') {
        gs = transition(gs, 'WALKER_FALL', { name: def.name, massKg: def.massKg });
      } else {
        gs = transition(gs, 'DONE', reason === 'stuck' ? { reason: 'stuck' } : undefined);
      }
      showResult();
    },
  });
  ctl.start();
}

function showResult() {
  const title =
    gs.resultReason === 'collapsed' ? 'Collapsed!' : gs.resultReason === 'stuck' ? 'Stuck!' : 'Indestructible!';
  const heaviestLine = gs.heaviestCrossedName
    ? `Heaviest crossed: ${gs.heaviestCrossedName} (${fmtMass(gs.heaviestCrossedKg)})`
    : 'Nothing crossed the bridge.';
  const brokeLine = gs.brokeBy
    ? `Broke under: ${gs.brokeBy.name} (${fmtMass(gs.brokeBy.massKg)})`
    : 'The bridge never broke.';
  if (!result) result = createResult(app, { onReplay, onNew });
  result.show({ title, heaviestLine, brokeLine, fact: gs.fact || '' });
}

function fmtMass(kg) {
  if (kg >= 1000) return `${kg / 1000}t`;
  return `${kg}kg`;
}

function onReplay() {
  result.hide();
  startRound(gs.config);
}

function onNew() {
  result.hide();
  result.destroy();
  result = null;
  if (hud) hud.destroy();
  hud = null;
  gs = transition(gs, 'NEW');
  sim = null;
  ctl = null;
  model = null;
  menu = createMenu(app, startRound);
}

function step() {
  tickCount++;
  if (gs.state === 'building') {
    buildTick++;
    if (buildTick >= BUILD_TICKS) finishBuilding();
    return;
  }
  if (gs.state !== 'testing' || !sim) return;
  for (let i = 0; i < speed; i++) {
    if (ctl.finished) break;
    sim.tick();
    ctl.tick();
  }
  if (hudTick++ % 10 === 0) updateHud();
}

function updateHud() {
  if (!hud || !sim || !ctl) return;
  if (ctl.current) hud.setWalker(ctl.current, ctl.index, LADDER.length);
  hud.setStress(sim.maxStrainRatio());
  hud.setSticks(model.sticksUsed, gs.config.budget);
  hud.setWeather(renderer.weather ? weatherLabel(renderer.weather) : '');
}

function render() {
  const walkers = [];
  if (gs.state === 'testing' && sim && ctl && ctl.current && sim.activeWalker) {
    const def = ctl.current;
    walkers.push({
      def,
      x: sim.activeWalker.position.x,
      y: sim.activeWalker.position.y + def.size,
    });
  }
  renderer.draw({
    sim,
    model,
    tickCount,
    walkers,
    cameraShake,
    buildProgress: gs.state === 'building' ? buildTick / BUILD_TICKS : null,
    seed: gs.config ? gs.config.seed : 'default',
  });
}

let last = null;
function frame(now) {
  if (last === null) last = now;
  let dt = now - last;
  last = now;
  if (dt > 100) dt = 100;
  acc += dt;
  while (acc >= 1000 / 60) {
    step();
    acc -= 1000 / 60;
  }
  render();
  requestAnimationFrame(frame);
}
let acc = 0;
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) last = null;
});

window.__game = {
  getState: () => ({ ...gs, brokenCount: sim ? sim.brokenCount : 0 }),
  getConfig: () => (gs.config ? { ...gs.config } : null),
  skipToWalker: (i) => ctl && ctl.skip(i),
};

if (cfgOverride) {
  startRound(cfgOverride);
} else {
  menu = createMenu(app, startRound);
}
