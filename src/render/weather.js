import { makeRng, rngHelpers } from '../game/rng.js';
import { WORLD } from '../game/config.js';
import { shade } from './sky.js';

export function createWeather(seed) {
  const rng = rngHelpers(makeRng(`${seed}:weather`));
  const kind = rng.chance(0.3) ? 'rain' : 'clear';
  const clouds = [];
  const n = rng.int(5, 8);
  for (let i = 0; i < n; i++) {
    const puffs = [];
    const pc = rng.int(3, 5);
    for (let p = 0; p < pc; p++) {
      puffs.push({ dx: (p - pc / 2) * rng.range(14, 22), dy: rng.range(-8, 4), r: rng.range(12, 24) });
    }
    clouds.push({
      x0: rng.range(0, WORLD.width + 400),
      y: rng.range(40, 200),
      s: rng.range(0.7, 1.6),
      v: rng.range(0.12, 0.35),
      puffs,
    });
  }
  const drops = [];
  if (kind === 'rain') {
    for (let i = 0; i < 220; i++) {
      drops.push({
        x0: rng.range(0, WORLD.width + 40),
        y0: rng.range(0, WORLD.height + 40),
        len: rng.range(10, 18),
        v: rng.range(9, 13),
      });
    }
  }
  const flocks = [];
  for (let i = 0; i < 2; i++) {
    flocks.push({ y: rng.range(70, 170), offset: rng.int(0, 2400), dir: rng.pick([-1, 1]) });
  }
  return { kind, clouds, drops, flocks };
}

export function weatherLabel(weather) {
  return weather.kind === 'rain' ? 'Rain' : 'Clear';
}

export function drawClouds(ctx, weather, tick, light) {
  ctx.save();
  for (const c of weather.clouds) {
    const x = ((c.x0 + tick * c.v) % (WORLD.width + 400)) - 200;
    ctx.fillStyle = shade('#f4f7fb', Math.max(light, 0.25));
    ctx.globalAlpha = 0.85;
    for (const p of c.puffs) {
      ctx.beginPath();
      ctx.arc(x + p.dx * c.s, c.y + p.dy * c.s, p.r * c.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawRain(ctx, weather, tick) {
  if (weather.kind !== 'rain') return;
  ctx.save();
  ctx.strokeStyle = 'rgba(157, 184, 217, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const d of weather.drops) {
    const x = ((d.x0 + tick * 2.2) % (WORLD.width + 40)) - 20;
    const y = ((d.y0 + tick * d.v) % (WORLD.height + 40)) - 20;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.4, y + d.len);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBirds(ctx, weather, tick) {
  ctx.save();
  ctx.strokeStyle = '#2f3542';
  ctx.lineWidth = 2;
  for (const f of weather.flocks) {
    const cycle = ((tick + f.offset) % 2400) / 2400;
    if (cycle > 0.25) continue;
    const p = cycle / 0.25;
    const bx = f.dir > 0 ? -100 + p * (WORLD.width + 200) : WORLD.width + 100 - p * (WORLD.width + 200);
    for (let i = 0; i < 5; i++) {
      const wing = Math.sin(tick * 0.35 + i * 0.7) * 5;
      const x = bx + f.dir * (i - 2) * 26;
      const y = f.y + Math.abs(i - 2) * 9;
      ctx.beginPath();
      ctx.moveTo(x - 7, y + wing);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 7, y + wing);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawWeather(ctx, weather, tick, light, layer) {
  if (layer === 'back') {
    drawClouds(ctx, weather, tick, light);
    drawBirds(ctx, weather, tick);
  } else {
    drawRain(ctx, weather, tick);
  }
}
