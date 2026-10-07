import { describe, it, expect } from 'vitest';
import { hashSeed, makeRng, rngHelpers } from '../src/game/rng.js';

describe('hashSeed', () => {
  it('is stable for the same input', () => {
    expect(hashSeed('banana')).toBe(hashSeed('banana'));
  });
  it('differs for different inputs', () => {
    expect(hashSeed('banana')).not.toBe(hashSeed('apple'));
  });
  it('handles empty string', () => {
    const h = hashSeed('');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
  it('returns a 32-bit unsigned value', () => {
    for (const s of ['x', 'hello world', 'seed-42', '🦄']) {
      expect(hashSeed(s)).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('makeRng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });
  it('differs for different seeds', () => {
    const a = Array.from({ length: 10 }, () => makeRng(1)());
    const b = Array.from({ length: 10 }, () => makeRng(2)());
    expect(a).not.toEqual(b);
  });
  it('returns floats in [0, 1)', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rngHelpers', () => {
  it('range stays in bounds and covers the span', () => {
    const h = rngHelpers(makeRng(99));
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 1000; i++) {
      const v = h.range(-5, 5);
      min = Math.min(min, v);
      max = Math.max(max, v);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(min).toBeLessThan(-3);
    expect(max).toBeGreaterThan(3);
  });
  it('int is inclusive on both ends', () => {
    const h = rngHelpers(makeRng(1234));
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(h.int(1, 4));
    expect(seen).toEqual(new Set([1, 2, 3, 4]));
  });
  it('pick returns elements of the array', () => {
    const h = rngHelpers(makeRng(5));
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(h.pick(arr));
    const seen = new Set(Array.from({ length: 50 }, () => h.pick(arr)));
    expect(seen.size).toBe(3);
  });
  it('jitter stays within plus/minus amount', () => {
    const h = rngHelpers(makeRng(3));
    for (let i = 0; i < 500; i++) {
      const v = h.jitter(3);
      expect(Math.abs(v)).toBeLessThanOrEqual(3);
    }
  });
  it('chance returns booleans with both outcomes over many draws', () => {
    const h = rngHelpers(makeRng(11));
    const seen = new Set(Array.from({ length: 200 }, () => h.chance(0.5)));
    expect(seen).toEqual(new Set([true, false]));
  });
});
