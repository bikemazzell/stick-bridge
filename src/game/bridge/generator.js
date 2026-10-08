import { createModel } from '../model.js';
import { makeRng, rngHelpers } from '../rng.js';
import { buildFlat } from './flat.js';
import { buildTruss } from './truss.js';
import { buildSuspension } from './suspension.js';

const BUILDERS = {
  flat: buildFlat,
  truss: buildTruss,
  suspension: buildSuspension,
};

export function generateBridge({ type, seed, budget, stickLen, span, rng }) {
  const builder = BUILDERS[type];
  if (!builder) throw new Error(`unknown bridge type: ${type}`);
  const model = createModel(type, seed, budget, stickLen, span);
  const helpers = rng ?? rngHelpers(makeRng(seed));
  builder(model, helpers, stickLen);
  return model;
}
