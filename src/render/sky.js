import { makeRng, rngHelpers } from '../game/rng.js';
import { WORLD } from '../game/config.js';

export const CYCLE_TICKS = 3600;

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToCss(rgb) {
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}

export function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return rgbToCss([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
}

export function shade(hex, light) {
  const rgb = hexToRgb(hex);
  const k = 0.35 + 0.65 * light;
  return rgbToCss(rgb.map((v) => Math.min(255, v * k)));
}

const KEYS = [
  { t: 0.0, top: '#3a3f7a', bot: '#ff9e6d', light: 0.55 },
  { t: 0.25, top: '#4da6ff', bot: '#c9ecff', light: 1.0 },
  { t: 0.5, top: '#452b66', bot: '#ff8a5c', light: 0.5 },
  { t: 0.75, top: '#0b1030', bot: '#232c54', light: 0.12 },
];

export function skyState(tick) {
  const t = (((tick % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS) / CYCLE_TICKS;
  let a = KEYS[KEYS.length - 1];
  let b = KEYS[0];
  let tEnd = 1;
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    const next = KEYS[(i + 1) % KEYS.length];
    const end = i === KEYS.length - 1 ? 1 : next.t;
    if (t >= k.t && t < end) {
      a = k;
      b = next;
      tEnd = end;
      break;
    }
  }
  const k = (t - a.t) / (tEnd - a.t);
  return {
    t,
    top: lerpColor(a.top, b.top, k),
    bottom: lerpColor(a.bot, b.bot, k),
    light: lerp(a.light, b.light, k),
  };
}

export function celestial(tick) {
  const state = skyState(tick);
  const t = state.t;
  if (t < 0.5) {
    const p = t / 0.5;
    return { type: 'sun', x: lerp(140, 1140, p), y: 340 - Math.sin(p * Math.PI) * 250, r: 38 };
  }
  const p = (t - 0.5) / 0.5;
  return { type: 'moon', x: lerp(140, 1140, p), y: 340 - Math.sin(p * Math.PI) * 250, r: 30 };
}

export function starField(seed, count = 90) {
  const { range } = rngHelpers(makeRng(`${seed}:stars`));
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({ x: range(10, WORLD.width - 10), y: range(10, 420), r: range(0.6, 1.8), tw: range(0, Math.PI * 2) });
  }
  return stars;
}

export function drawSky(ctx, state) {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  grad.addColorStop(0, state.top);
  grad.addColorStop(1, state.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

export function drawCelestial(ctx, c) {
  if (!c) return;
  ctx.save();
  if (c.type === 'sun') {
    ctx.fillStyle = 'rgba(255, 215, 94, 0.25)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#e8ecf5';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9d1e0';
    ctx.beginPath();
    ctx.arc(c.x - 8, c.y - 5, 5, 0, Math.PI * 2);
    ctx.arc(c.x + 9, c.y + 7, 7, 0, Math.PI * 2);
    ctx.arc(c.x + 3, c.y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawStars(ctx, stars, tick, light) {
  const night = Math.max(0, 1 - light * 2.2);
  if (night <= 0.02) return;
  ctx.save();
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const twinkle = 0.5 + 0.5 * Math.sin(tick * 0.05 + s.tw);
    ctx.fillStyle = `rgba(255, 255, 255, ${night * twinkle * 0.9})`;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.restore();
}
