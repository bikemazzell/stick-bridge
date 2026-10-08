import { describe, it, expect } from 'vitest';
import { rantFor, GLYPHS } from '../src/game/rant.js';

describe('rantFor', () => {
  it('is deterministic for the same seed and tick', () => {
    expect(rantFor('pop-1', 0)).toBe(rantFor('pop-1', 0));
    expect(rantFor('pop-1', 451)).toBe(rantFor('pop-1', 451));
  });

  it('uses only glyphs from the exported set', () => {
    const glyphs = new Set(GLYPHS);
    for (const seed of ['a', 'b', 'c']) {
      for (const tick of [0, 45, 300, 1234]) {
        const rant = rantFor(seed, tick);
        const chars = [...rant];
        expect(chars.length).toBeGreaterThanOrEqual(3);
        expect(chars.length).toBeLessThanOrEqual(4);
        for (const ch of chars) {
          expect(glyphs.has(ch), `"${ch}" in "${rant}"`).toBe(true);
        }
      }
    }
  });

  it('holds the same rant inside a 45-tick window and changes across windows', () => {
    expect(rantFor('w', 300)).toBe(rantFor('w', 314));
    const across = new Set([rantFor('w', 0), rantFor('w', 45), rantFor('w', 90), rantFor('w', 135), rantFor('w', 180)]);
    expect(across.size).toBeGreaterThan(1);
  });

  it('includes both symbol and emoji glyphs in the pool', () => {
    expect(GLYPHS).toContain('@');
    expect(GLYPHS).toContain('!');
    expect(GLYPHS.some((g) => g.codePointAt(0) > 0x2000)).toBe(true);
  });

  it('varies across seeds at the same tick', () => {
    const across = new Set(['s1', 's2', 's3', 's4', 's5'].map((s) => rantFor(s, 0)));
    expect(across.size).toBeGreaterThan(1);
  });
});
