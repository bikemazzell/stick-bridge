import { WORLD } from '../config.js';
import { addNode, addMember, sticksUsed } from '../model.js';
import { buildDeck, strengthFor, spanWidth } from './deck.js';

const { gapX0, deckY } = WORLD;

function deckRef(i) {
  return { deck: i };
}

function topRef(i, y) {
  return { top: i, y };
}

function scoreOf(ref, n) {
  const i = ref.deck ?? ref.top;
  return Math.abs(gapX0 + i * (spanWidth() / n) - (gapX0 + spanWidth() / 2));
}

function warrenCandidates(deck, h) {
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
  return items.map((it) => ({
    ...it,
    score: (scoreOf(it.from, n) + scoreOf(it.to, n)) / 2,
  }));
}

function latticeCandidates(deck, h, flipped) {
  const n = deck.panels;
  const items = [];
  for (let i = 1; i <= n - 1; i++) items.push({ from: deckRef(i), to: topRef(i, deckY - h) });
  for (let i = 1; i <= n - 2; i++) items.push({ from: topRef(i, deckY - h), to: topRef(i + 1, deckY - h) });
  for (let i = 1; i <= n - 2; i++) {
    if (flipped) items.push({ from: topRef(i, deckY - h), to: deckRef(i + 1) });
    else items.push({ from: deckRef(i), to: topRef(i + 1, deckY - h) });
  }
  return items.map((it) => ({
    ...it,
    score: (scoreOf(it.from, n) + scoreOf(it.to, n)) / 2,
  }));
}

export function buildTruss(model, rng, stickLen) {
  const deck = buildDeck(model, rng, stickLen);
  const substyle = rng.pick(['warren', 'pratt', 'howe']);
  const h = rng.range(40, 90);

  const candidates =
    substyle === 'warren'
      ? warrenCandidates(deck, h)
      : latticeCandidates(deck, h, substyle === 'howe');
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
    addMember(model, a.id, b.id, 'stick', strengthFor(rng, 'stick'));
    remaining--;
  }
  model.meta.substyle = substyle;
}
