import { worldFor } from '../config.js';
import { addNode, addMember, sticksUsed } from '../model.js';
import { strengthFor } from './deck.js';

// Under-deck support columns (piers): glued stick stacks from interior deck
// nodes down to the canyon floor. Candidates are ordered center-out so the
// guaranteed minimum pair sits symmetric about midspan. Nodes already carrying
// a pier are tracked in `placed`. Returns the number of piers built.
export function addPiers(model, rng, stickLen, deck, placed, maxCount = Infinity) {
  const g = worldFor(model.span);
  const centerX = (g.gapX0 + g.gapX1) / 2;
  const interior = deck.nodes.slice(1, -1).filter((n) => !placed.has(n.id));
  interior.sort((a, b) => Math.abs(a.x - centerX) - Math.abs(b.x - centerX));

  let built = 0;
  for (const node of interior) {
    if (built >= maxCount) break;
    const segs = Math.max(1, Math.ceil((g.groundY - node.y) / stickLen));
    if (sticksUsed(model) + segs > model.budget) continue;
    const base = addNode(model, node.x, g.groundY, true);
    let prev = base;
    for (let s = 1; s <= segs; s++) {
      const top = s === segs ? node : addNode(model, node.x, node.y + ((g.groundY - node.y) * (segs - s)) / segs);
      const seg = addMember(model, prev.id, top.id, 'stick', strengthFor(rng, 'stick') * 3.5);
      seg.glued = true;
      prev = top;
    }
    placed.add(node.id);
    built++;
  }
  model.meta.piers = (model.meta.piers ?? 0) + built;
  return built;
}
