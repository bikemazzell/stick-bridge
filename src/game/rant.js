import { makeRng, rngHelpers } from './rng.js';

export const GLYPHS = [
  '@', '#', '$', '!', '?', '%', '&',
  '\u{1F621}', // rage
  '\u{1F627}', // anguish
  '\u{1F92C}', // cursing
  '\u{1F624}', // steam from nose
  '\u{1F4A2}', // anger symbol
  '\u{1F4A5}', // collision
];

const WINDOW_TICKS = 45;

// Frustration bubble text for a stuck walker: deterministic per seed and
// 45-tick window, so replays show the same rants while it still shuffles.
export function rantFor(seed, tick) {
  const window = Math.floor(Math.max(0, tick) / WINDOW_TICKS);
  const rng = rngHelpers(makeRng(`${seed}:rant:${window}`));
  const len = rng.int(3, 4);
  let out = '';
  for (let i = 0; i < len; i++) out += rng.pick(GLYPHS);
  return out;
}
