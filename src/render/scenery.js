import { makeRng, rngHelpers } from '../game/rng.js';
import { worldFor } from '../game/config.js';
import { shade } from './sky.js';

export function createScenery(seed = 'scenery', span) {
  const g = worldFor(span);
  const rng = rngHelpers(makeRng(`${seed}:scenery`));
  const trees = [];
  for (let i = 0; i < rng.int(3, 5); i++) {
    trees.push({ x: rng.range(60, g.gapX0 - 60), h: rng.range(40, 80), w: rng.range(14, 26), tone: rng.pick([0, 1]) });
  }
  for (let i = 0; i < rng.int(3, 5); i++) {
    trees.push({ x: rng.range(g.gapX1 + 60, g.width - 60), h: rng.range(40, 80), w: rng.range(14, 26), tone: rng.pick([0, 1]) });
  }
  // jagged cliff faces: count and amplitude vary per seed
  const jagAmp = rng.range(0.7, 1.3);
  const wallJags = { left: [], right: [] };
  for (let i = 0; i < rng.int(4, 7); i++) {
    wallJags.left.push(rng.range(8, 52) * jagAmp);
  }
  for (let i = 0; i < rng.int(4, 7); i++) {
    wallJags.right.push(rng.range(8, 52) * jagAmp);
  }
  // seeded mountain ridge lines for the two backdrop layers (xFrac across the
  // gap, h above the layer base line)
  const ridge = (hMin, hMax) => {
    const pts = [];
    for (let i = 0; i < rng.int(3, 6); i++) {
      pts.push({ x: rng.range(0.08, 0.92), h: rng.range(hMin, hMax) });
    }
    pts.sort((a, b) => a.x - b.x);
    return pts;
  };
  const ridge1 = ridge(35, 85);
  const ridge2 = ridge(20, 60);
  const riverSticks = [];
  for (let i = 0; i < rng.int(5, 9); i++) {
    riverSticks.push({ x: rng.range(0, 200), y: rng.range(4, 12), w: rng.range(20, 60), v: rng.range(0.2, 0.6) });
  }
  return { span: g.gapX1 - g.gapX0, trees, wallJags, ridge1, ridge2, riverSticks };
}

function poly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, tree, deckY, light) {
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
  const { width, gapX0, gapX1, deckY, groundY } = worldFor(scenery.span);
  const far = shade('#b08d7a', light);
  const mid = shade('#9a7a6a', light);
  const rock = shade('#5d4037', light);
  const rockDark = shade('#4a322b', light);

  // far canyon backdrop drawn from the seeded ridge lines
  const ridgePoly = (ridge, baseY) => {
    const pts = [[gapX0 - 30, baseY]];
    for (const p of ridge) {
      pts.push([gapX0 - 30 + p.x * (gapX1 - gapX0 + 60), baseY - p.h]);
    }
    pts.push([gapX1 + 30, baseY], [gapX1 + 30, groundY + 20], [gapX0 - 30, groundY + 20]);
    return pts;
  };
  ctx.fillStyle = far;
  ctx.globalAlpha = 0.55;
  poly(ctx, ridgePoly(scenery.ridge1, 560));
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = mid;
  poly(ctx, ridgePoly(scenery.ridge2, 600));
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

  const rightPts = [[width, deckY], [gapX1, deckY]];
  scenery.wallJags.right.forEach((j, i) => {
    rightPts.push([gapX1 + j, ly0 + step * (i + 1)]);
  });
  rightPts.push([width, ly1]);
  ctx.fillStyle = rock;
  poly(ctx, rightPts);

  // darker base band
  ctx.fillStyle = rockDark;
  ctx.fillRect(0, groundY - 6, width, 26);

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
  ctx.fillRect(gapX1, deckY - 5, width - gapX1, 7);

  for (const t of scenery.trees) drawTree(ctx, t, deckY, light);
}
