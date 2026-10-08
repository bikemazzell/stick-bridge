import { worldFor } from '../config.js';
import { addNode, addMember, sticksUsed } from '../model.js';
import { buildDeck, strengthFor } from './deck.js';
import { addPiers } from './pier.js';

function deckRef(i) {
  return { deck: i };
}

function topRef(i, y) {
  return { top: i, y };
}

function scoreOf(ref, deck, centerX) {
  const i = ref.deck ?? ref.top;
  return Math.abs(deck.nodes[i].x - centerX);
}

function warrenCandidates(deck, h, deckY) {
  const n = deck.panels;
  const items = [];
  const last = n / 2 - 1;
  for (let k = 1; k <= last; k++) {
    const a = topRef(2 * k, deckY - h);
    items.push({ from: deckRef(2 * k - 1), to: a });
    items.push({ from: a, to: deckRef(2 * k + 1) });
    if (k < last) items.push({ from: a, to: topRef(2 * (k + 1), deckY - h) });
  }
  if (last >= 1) {
    items.push({ from: deckRef(0), to: topRef(2, deckY - h) });
    items.push({ from: topRef(2 * last, deckY - h), to: deckRef(n) });
  }
  return items;
}

function latticeCandidates(deck, h, flipped, deckY) {
  const n = deck.panels;
  const items = [];
  for (let i = 1; i <= n - 1; i++) items.push({ from: deckRef(i), to: topRef(i, deckY - h) });
  for (let i = 1; i <= n - 2; i++) items.push({ from: topRef(i, deckY - h), to: topRef(i + 1, deckY - h) });
  for (let i = 1; i <= n - 2; i++) {
    if (flipped) items.push({ from: topRef(i, deckY - h), to: deckRef(i + 1) });
    else items.push({ from: deckRef(i), to: topRef(i + 1, deckY - h) });
  }
  return items;
}

export function buildTruss(model, rng, stickLen) {
  const g = worldFor(model.span);
  const deck = buildDeck(model, rng, stickLen);
  const pierNodes = new Set();
  addPiers(model, rng, stickLen, deck, pierNodes, 2);
  const centerX = (g.gapX0 + g.gapX1) / 2;
  const substyle = rng.pick(['warren', 'pratt', 'howe']);
  const h = rng.range(40, 90);

  const withScores = (items) => items.map((it) => ({
    ...it,
    score: (scoreOf(it.from, deck, centerX) + scoreOf(it.to, deck, centerX)) / 2,
  }));
  const candidates =
    substyle === 'warren'
      ? withScores(warrenCandidates(deck, h, g.deckY))
      : withScores(latticeCandidates(deck, h, substyle === 'howe', g.deckY));
  candidates.sort((a, b) => a.score - b.score);

  const tops = new Map();
  const topNode = (key, y) => {
    if (!tops.has(key)) {
      const i = Number(key.slice(1));
      const base = deck.nodes[i];
      tops.set(key, addNode(model, base.x + rng.jitter(3), y + rng.jitter(3)));
    }
    return tops.get(key);
  };

  let remaining = model.budget - sticksUsed(model);
  for (const c of candidates) {
    if (remaining <= 0) break;
    const a = c.from.deck !== undefined ? deck.nodes[c.from.deck] : topNode(`t${c.from.top}`, c.from.y);
    const b = c.to.deck !== undefined ? deck.nodes[c.to.deck] : topNode(`t${c.to.top}`, c.to.y);
    addMember(model, a.id, b.id, 'stick', strengthFor(rng, "stick") * 3.5);
    remaining--;
  }

  // laminate the deck when sticks are left over: a second glued layer doubles
  // the walking surface strength
  addPiers(model, rng, stickLen, deck, pierNodes);
  remaining = model.budget - sticksUsed(model);
  for (let layer = 2; layer <= 4 && remaining >= deck.nodes.length - 1; layer++) { remaining -= deck.nodes.length - 1;
    for (let i = 1; i < deck.nodes.length; i++) {
      addMember(model, deck.nodes[i - 1].id, deck.nodes[i].id, 'stick', strengthFor(rng, 'stick'));
    }
    model.meta.deckLayers = 2;
  }
  model.meta.substyle = substyle;
}
