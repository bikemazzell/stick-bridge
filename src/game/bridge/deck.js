import { WORLD, MATERIAL } from '../config.js';
import { addNode, addMember } from '../model.js';

const { gapX0, gapX1, deckY } = WORLD;

export function strengthFor(rng, material) {
  return MATERIAL[material].breakStretch * rng.range(0.9, 1.1);
}

export function spanWidth() {
  return gapX1 - gapX0;
}

export function buildDeck(model, rng, stickLen) {
  const span = spanWidth();
  let panels = Math.ceil(span / stickLen);
  if (panels % 2 === 1) panels += 1;
  if (panels < 2) panels = 2;
  const spacing = span / panels;

  const nodes = [];
  for (let i = 0; i <= panels; i++) {
    const isAnchor = i === 0 || i === panels;
    const x = gapX0 + i * spacing;
    const y = isAnchor ? deckY : deckY + rng.jitter(3);
    const node = addNode(model, x, y, isAnchor);
    nodes.push(node);
  }
  for (let i = 0; i < panels; i++) {
    addMember(model, nodes[i].id, nodes[i + 1].id, 'stick', strengthFor(rng, 'stick'));
  }
  return { nodes, panels, spacing };
}
