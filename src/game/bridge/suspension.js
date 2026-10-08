import { worldFor } from '../config.js';
import { addNode, addMember, sticksUsed } from '../model.js';
import { buildDeck, strengthFor } from './deck.js';

export function buildSuspension(model, rng, stickLen) {
  const { gapX0, gapX1, deckY } = worldFor(model.span);
  const deck = buildDeck(model, rng, stickLen);
  const span = gapX1 - gapX0;

  const remaining = model.budget - sticksUsed(model);
  // a tower needs at least one stick per side; with less left the suspension
  // degenerates to a plain deck so the budget invariant always holds
  if (remaining < 2) {
    model.meta.towerHeight = 0;
    model.meta.sag = 0;
    return;
  }
  const perTower = Math.floor(remaining / 2);
  const desired = rng.range(120, 200);
  const towerHeight = Math.max(40, Math.min(desired, perTower * stickLen * 0.95));

  const towerTopY = deckY - towerHeight;
  const towers = [gapX0 + span * 0.12, gapX1 - span * 0.12].map((tx) => {
    const base = addNode(model, tx + rng.jitter(4), deckY + rng.range(10, 30), true);
    const segs = Math.max(1, Math.ceil(towerHeight / stickLen));
    let prev = base;
    for (let s = 1; s <= segs; s++) {
      const y = base.y - (towerHeight * s) / segs;
      const top = s === segs ? addNode(model, base.x, towerTopY) : addNode(model, base.x, y);
      const seg = addMember(model, prev.id, top.id, 'stick', strengthFor(rng, "stick") * 3.5);
      seg.glued = true; // towers are glued stacks, not pinned chains
      prev = top;
    }
    return { x: base.x, top: prev };
  });

  // the main cable must stay above the deck even on budget-shortened towers
  const sag = Math.min(rng.range(40, 80), Math.max(10, towerHeight - 20));
  const [t0, t1] = towers;
  const cx = (t0.x + t1.x) / 2;
  const half = (t1.x - t0.x) / 2;
  const cableY = (x) => towerTopY + sag * (1 - ((x - cx) / half) ** 2);

  let prev = t0.top;
  const hung = deck.nodes.filter((n) => n.x > t0.x + 5 && n.x < t1.x - 5);
  for (const dn of hung) {
    const cn = addNode(model, dn.x, cableY(dn.x));
    addMember(model, prev.id, cn.id, 'cable', strengthFor(rng, 'cable'));
    addMember(model, cn.id, dn.id, 'cable', strengthFor(rng, 'cable'));
    prev = cn;
  }
  addMember(model, prev.id, t1.top.id, 'cable', strengthFor(rng, 'cable'));

  for (const [anchor, tower] of [
    [deck.nodes[0], t0],
    [deck.nodes[deck.nodes.length - 1], t1],
  ]) {
    let p = anchor;
    for (let s = 1; s <= 3; s++) {
      const frac = s / 3;
      const x = anchor.x + (tower.x - anchor.x) * frac;
      const y = anchor.y + (towerTopY - anchor.y) * frac + (s < 3 ? sag * 0.15 : 0);
      const node = s === 3 ? tower.top : addNode(model, x, y);
      addMember(model, p.id, node.id, 'cable', strengthFor(rng, 'cable'));
      p = node;
    }
  }

  // laminate the deck with any leftover stick budget
  let leftover = model.budget - sticksUsed(model);
  for (let layer = 2; layer <= 4 && leftover >= deck.nodes.length - 1; layer++) { leftover -= deck.nodes.length - 1;
    for (let i = 1; i < deck.nodes.length; i++) {
      addMember(model, deck.nodes[i - 1].id, deck.nodes[i].id, 'stick', strengthFor(rng, 'stick'));
    }
    model.meta.deckLayers = 2;
  }

  model.meta.towerHeight = towerHeight;
  model.meta.sag = sag;
}
