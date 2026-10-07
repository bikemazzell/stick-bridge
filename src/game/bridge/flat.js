import { addMember } from '../model.js';
import { buildDeck, strengthFor } from './deck.js';

export function buildFlat(model, rng, stickLen) {
  const deck = buildDeck(model, rng, stickLen);
  const deckCount = deck.nodes.length - 1;
  let layers = 1;
  if (model.budget >= deckCount * 2) {
    layers = 2;
    for (let i = 0; i < deck.nodes.length - 1; i++) {
      addMember(model, deck.nodes[i].id, deck.nodes[i + 1].id, 'stick', strengthFor(rng, 'stick'));
    }
  }
  model.meta.deckLayers = layers;
}
