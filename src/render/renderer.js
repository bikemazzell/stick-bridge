import { makeRng, rngHelpers } from '../game/rng.js';
import { WORLD } from '../game/config.js';
import { skyState, celestial, starField, drawSky, drawCelestial, drawStars, lerpColor } from './sky.js';
import { createWeather, drawWeather, weatherLabel } from './weather.js';
import { createScenery, drawScenery } from './scenery.js';
import { drawWalker } from './characters.js';
import { walkerPhase } from '../game/walkers.js';

const WOOD = '#d9a066';
const STRESS_LOW = '#7ac74f';
const STRESS_MID = '#ffd166';
const STRESS_HIGH = '#ef4b4b';

function stressColor(ratio) {
  const a = Math.min(1, Math.abs(ratio));
  return a < 0.5 ? lerpColor(STRESS_LOW, STRESS_MID, a * 2) : lerpColor(STRESS_MID, STRESS_HIGH, (a - 0.5) * 2);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let seed = null;
  let weather = null;
  let scenery = null;
  let stars = null;
  let dust = [];

  function ensureAssets(newSeed) {
    if (newSeed === seed) return;
    seed = newSeed;
    weather = createWeather(String(seed));
    scenery = createScenery(String(seed));
    stars = starField(String(seed));
    dust = [];
  }

  function burst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sp = 1.5 + (i % 3) * 0.4;
      dust.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8, life: 1 });
    }
  }

  function drawDust() {
    ctx.save();
    for (const p of dust) {
      ctx.fillStyle = `rgba(160, 130, 100, ${p.life * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * p.life + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function stepDust() {
    dust = dust.filter((p) => p.life > 0);
    for (const p of dust) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.life -= 0.04;
    }
  }

  function bodyStrain(sim) {
    const strain = new Map();
    for (const j of sim.joints) {
      if (j.broken) continue;
      const r = Math.abs(j.ratio);
      for (const b of [j.constraint.bodyA, j.constraint.bodyB]) {
        if (!b) continue;
        strain.set(b, Math.max(strain.get(b) ?? 0, r));
      }
    }
    return strain;
  }

  function drawStickBody(body, fill) {
    const v = body.vertices;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    // grain lines along the long axis (v0 -> v1 is a long edge of the rect)
    const ex = v[1].x - v[0].x;
    const ey = v[1].y - v[0].y;
    const edge = Math.hypot(ex, ey) || 1;
    const ux = ex / edge;
    const uy = ey / edge;
    const tx = v[2].x - v[1].x;
    const ty = v[2].y - v[1].y;
    const thick = Math.hypot(tx, ty) || 6;
    const half = edge / 2;
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.5)';
    ctx.lineWidth = 1;
    for (const off of [-thick / 4, thick / 4]) {
      const ox = -uy * off;
      const oy = ux * off;
      ctx.beginPath();
      ctx.moveTo(body.position.x - ux * half * 0.92 + ox, body.position.y - uy * half * 0.92 + oy);
      ctx.lineTo(body.position.x + ux * half * 0.92 + ox, body.position.y + uy * half * 0.92 + oy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBridge(sim) {
    const strain = bodyStrain(sim);
    for (const body of sim.bodies.values()) {
      if (body.plugin && body.plugin.debris) continue;
      const r = strain.get(body) ?? 0;
      const a = Math.min(1, r * 1.4);
      const fill = a === 0 ? WOOD : lerpColor('d9a066', 'ef4b4b', a * 0.65);
      drawStickBody(body, fill);
    }
    for (const body of sim.debris) {
      const age = sim.time - (body.plugin.brokeAt ?? 0);
      const flash = Math.max(0, 1 - age / 20);
      const fill = lerpColor('d9a066', 'ef4b4b', 0.4 + flash * 0.6);
      drawStickBody(body, fill);
    }
    // cable lines
    ctx.save();
    ctx.strokeStyle = '#4a4a55';
    ctx.lineWidth = 3;
    for (const c of sim.cables) {
      if (c.broken) continue;
      const pA = worldEnd(c.constraint, 'A');
      const pB = worldEnd(c.constraint, 'B');
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      const mx = (pA.x + pB.x) / 2;
      const my = (pA.y + pB.y) / 2 + 3;
      ctx.quadraticCurveTo(mx, my, pB.x, pB.y);
      ctx.stroke();
    }
    // joint pins
    ctx.fillStyle = '#5d4037';
    for (const j of sim.joints) {
      if (j.broken) continue;
      const pA = worldEnd(j.constraint, 'A');
      const pB = worldEnd(j.constraint, 'B');
      ctx.beginPath();
      ctx.arc((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function worldEnd(constraint, which) {
    const body = which === 'A' ? constraint.bodyA : constraint.bodyB;
    const point = which === 'A' ? constraint.pointA : constraint.pointB;
    if (!body) return { x: point.x, y: point.y };
    const cos = Math.cos(body.angle - (which === 'A' ? constraint.angleA : constraint.angleB));
    const sin = Math.sin(body.angle - (which === 'A' ? constraint.angleA : constraint.angleB));
    return { x: body.position.x + point.x * cos - point.y * sin, y: body.position.y + point.x * sin + point.y * cos };
  }

  function drawBuilding(model, progress) {
    const total = model.members.length;
    model.members.forEach((m, i) => {
      const appear = i / total;
      const local = Math.max(0, Math.min(1, (progress - appear) * total * 0.5));
      if (local <= 0) return;
      const a = model.nodes[m.a];
      const b = model.nodes[m.b];
      const drop = (1 - local) * 180;
      ctx.save();
      ctx.globalAlpha = local;
      ctx.strokeStyle = m.material === 'cable' ? '#4a4a55' : WOOD;
      ctx.lineWidth = m.material === 'cable' ? 3 : 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - drop);
      ctx.lineTo(b.x, b.y - drop);
      ctx.stroke();
      ctx.restore();
    });
  }

  function draw(frameState) {
    const { sim, model, tickCount, walkers = [], cameraShake = null, buildProgress = null, seed: frameSeed = 'default' } = frameState;
    ensureAssets(frameSeed);
    const state = skyState(tickCount);

    drawSky(ctx, state);
    drawStars(ctx, stars, tickCount, state.light);
    drawCelestial(ctx, celestial(tickCount));
    drawWeather(ctx, weather, tickCount, state.light, 'back');

    ctx.save();
    if (cameraShake) {
      const age = tickCount - cameraShake.tick;
      if (age >= 0 && age < 20) {
        const amp = 6 * (1 - age / 20);
        ctx.translate(amp * Math.sin(tickCount * 1.7), amp * Math.cos(tickCount * 2.3));
      }
    }
    drawScenery(ctx, scenery, tickCount, state.light);

    if (buildProgress !== null && buildProgress < 1) {
      drawBuilding(model, buildProgress);
    } else if (sim) {
      drawBridge(sim);
    }

    for (const w of walkers) {
      const phase = w.phase ?? walkerPhase(w.x, w.def.speed);
      drawWalker(ctx, w.def, w.x, w.y, phase);
    }

    drawDust();
    stepDust();
    ctx.restore();

    drawWeather(ctx, weather, tickCount, state.light, 'front');
  }

  return { draw, burst, get weather() { return weather; }, weatherLabel };
}
