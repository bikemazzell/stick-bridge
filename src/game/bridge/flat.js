import { buildDeck } from './deck.js';

export function buildFlat(model, rng, stickLen) {
  buildDeck(model, rng, stickLen);
  model.meta.deckLayers = 1;
}
