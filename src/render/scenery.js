import { makeRng, rngHelpers } from '../game/rng.js';
import { WORLD } from '../game/config.js';
import { shade } from './sky.js';

const { gapX0, gapX1, deckY, groundY } = WORLD;

export function createScenery(seed = 'scenery') {
  const rng = rngHelpers(makeRng(`${seed}:scenery`));
  const trees = [];
  for (let i = 0; i < 4; i++) {
    trees.push({ x: rng.range(60, gapX0 - 60), h: rng.range(40, 80), w: rng.range(14, 26), tone: rng.pick([0, 1]) });
  }
  for (let i = 0; i < 4; i++) {
    trees.push({ x: rng.range(gapX1 + 60, WORLD.width - 60), h: rng.range(40, 80), w: rng.range(14, 26), tone: rng.pick([0, 1]) });
  }
  const wallJags = { left: [], right: [] };
  for (let i = 0; i < 6; i++) {
    wallJags.left.push(rng.range(8, 52));
    wallJags.right.push(rng.range(8, 52));
  }
  const riverSticks = [];
  for (let i = 0; i < 7; i++) {
    riverSticks.push({ x: rng.range(0, 200), y: rng.range(4, 12), w: rng.range(20, 60), v: rng.range(0.2, 0.6) });
  }
  return { trees, wallJags, riverSticks };
}

function poly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, tree, light) {
  const { x, h, w, tone } = tree;
  ctx.fillStyle = shade('#6d4c33', light);
  ctx.fillRect(x - 2, deckY - h * 0.3, 4, h * 0.3);
  const leaf = tone === 0 ? '#2e8b57' : '#3cb371';
  for (let i = 0; i < 3; i++) {
    const ty = deckY - h * 0.3 - i * h * 0.22;
    const tw = (w - i * 3) / 2;
    ctx.fillStyle = shade(leaf, light);
    poly(ctx, [
      [x, ty - h * 0.4],
      [x - tw, ty],
      [x + tw, ty],
    ]);
  }
}

export function drawScenery(ctx, scenery, tick, light) {
  const far = shade('#b08d7a', light);
  const mid = shade('#9a7a6a', light);
  const rock = shade('#5d4037', light);
  const rockDark = shade('#4a322b', light);

  // far canyon backdrop
  ctx.fillStyle = far;
  ctx.globalAlpha = 0.55;
  poly(ctx, [
    [gapX0 - 30, 560], [gapX0 + 90, 505], [gapX0 + 220, 545], [640, 495],
    [gapX1 - 220, 545], [gapX1 - 90, 505], [gapX1 + 30, 560], [gapX1 + 30, groundY + 20], [gapX0 - 30, groundY + 20],
  ]);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = mid;
  poly(ctx, [
    [gapX0 - 20, 600], [gapX0 + 130, 560], [400, 585], [640, 555], [880, 585], [gapX1 - 130, 560], [gapX1 + 20, 600],
    [gapX1 + 20, groundY + 20], [gapX0 - 20, groundY + 20],
  ]);
  ctx.globalAlpha = 1;

  // canyon walls with jagged faces
  const leftPts = [[0, deckY], [gapX0, deckY]];
  const ly0 = deckY, ly1 = groundY + 20;
  const step = (ly1 - ly0) / (scenery.wallJags.left.length + 1);
  scenery.wallJags.left.forEach((j, i) => {
    leftPts.push([gapX0 - j, ly0 + step * (i + 1)]);
  });
  leftPts.push([0, ly1]);
  ctx.fillStyle = rock;
  poly(ctx, leftPts);

  const rightPts = [[WORLD.width, deckY], [gapX1, deckY]];
  scenery.wallJags.right.forEach((j, i) => {
    rightPts.push([gapX1 + j, ly0 + step * (i + 1)]);
  });
  rightPts.push([WORLD.width, ly1]);
  ctx.fillStyle = rock;
  poly(ctx, rightPts);

  // darker base band
  ctx.fillStyle = rockDark;
  ctx.fillRect(0, groundY - 6, WORLD.width, 26);

  // river shimmering at the canyon floor
  ctx.fillStyle = shade('#4a90d9', light);
  ctx.fillRect(gapX0 - 15, groundY + 14, gapX1 - gapX0 + 30, 18);
  ctx.fillStyle = `rgba(220, 240, 255, ${0.35 + 0.15 * light})`;
  for (const s of scenery.riverSticks) {
    const x = gapX0 + ((s.x + tick * s.v) % (gapX1 - gapX0 - 40));
    ctx.fillRect(x, groundY + 14 + s.y, s.w, 2);
  }

  // grass on the cliff tops
  ctx.fillStyle = shade('#6ab04c', light);
  ctx.fillRect(0, deckY - 5, gapX0, 7);
  ctx.fillRect(gapX1, deckY - 5, WORLD.width - gapX1, 7);

  for (const t of scenery.trees) drawTree(ctx, t, light);
}
