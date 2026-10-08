import { describe, it, expect } from 'vitest';
import { WORLD, MATERIAL, MASS_SCALE, LADDER, FACTS, HINTS, DEFAULTS, SPAN, worldFor, STUCK_BUBBLE_TICKS } from '../src/game/config.js';

describe('WORLD', () => {
  it('has a sane canyon layout', () => {
    expect(WORLD.gapX0).toBeLessThan(WORLD.gapX1);
    expect(WORLD.deckY).toBeLessThan(WORLD.groundY);
    expect(WORLD.width).toBeGreaterThan(WORLD.gapX1);
    expect(WORLD.height).toBeGreaterThan(WORLD.groundY);
  });
});

describe('MATERIAL', () => {
  it('sticks break at lower stretch than cables', () => {
    expect(MATERIAL.stick.breakStretch).toBeLessThan(MATERIAL.cable.breakStretch);
  });
  it('has physical props for sticks', () => {
    expect(MATERIAL.stick.thickness).toBeGreaterThan(0);
    expect(MATERIAL.stick.density).toBeGreaterThan(0);
    expect(MATERIAL.stick.stiffness).toBeGreaterThan(0);
  });
});

describe('LADDER', () => {
  it('has 10 walkers', () => {
    expect(LADDER).toHaveLength(10);
  });
  it('masses strictly increase', () => {
    for (let i = 1; i < LADDER.length; i++) {
      expect(LADDER[i].massKg).toBeGreaterThan(LADDER[i - 1].massKg);
    }
  });
  it('ids are unique', () => {
    expect(new Set(LADDER.map((w) => w.id)).size).toBe(LADDER.length);
  });
  it('speds are positive and sizes positive', () => {
    for (const w of LADDER) {
      expect(w.speed).toBeGreaterThan(0);
      expect(w.size).toBeGreaterThan(0);
    }
  });
  it('starts with a fly and ends with a tank', () => {
    expect(LADDER[0].id).toBe('fly');
    expect(LADDER[LADDER.length - 1].id).toBe('tank');
  });
});

describe('FACTS and HINTS', () => {
  it('covers all three bridge types', () => {
    for (const type of ['flat', 'truss', 'suspension']) {
      expect(Array.isArray(FACTS[type])).toBe(true);
      expect(FACTS[type].length).toBeGreaterThan(0);
      expect(FACTS[type][0].length).toBeGreaterThan(10);
    }
  });
  it('has hint lines', () => {
    expect(HINTS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('DEFAULTS', () => {
  it('is inside slider ranges', () => {
    expect(DEFAULTS.budget).toBeGreaterThanOrEqual(20);
    expect(DEFAULTS.budget).toBeLessThanOrEqual(300);
    expect(DEFAULTS.stickLen).toBeGreaterThanOrEqual(40);
    expect(DEFAULTS.stickLen).toBeLessThanOrEqual(120);
    expect(DEFAULTS.span).toBeGreaterThanOrEqual(SPAN.min);
    expect(DEFAULTS.span).toBeLessThanOrEqual(SPAN.max);
    expect(['flat', 'truss', 'suspension']).toContain(DEFAULTS.type);
  });
});

describe('SPAN and worldFor', () => {
  it('default span matches the fixed WORLD layout', () => {
    const g = worldFor(SPAN.default);
    expect(g).toEqual(WORLD);
  });

  it('builds a centered gap of the requested width', () => {
    const g = worldFor(800);
    expect(g.gapX1 - g.gapX0).toBe(800);
    expect(g.gapX0).toBe((g.width - 800) / 2);
    expect(g.deckY).toBe(WORLD.deckY);
    expect(g.groundY).toBe(WORLD.groundY);
  });

  it('clamps spans outside the allowed range', () => {
    expect(worldFor(100).gapX1 - worldFor(100).gapX0).toBe(SPAN.min);
    expect(worldFor(9999).gapX1 - worldFor(9999).gapX0).toBe(SPAN.max);
    expect(worldFor(undefined).gapX1 - worldFor(undefined).gapX0).toBe(SPAN.default);
  });

  it('keeps room for spawn and cliffs at the widest span', () => {
    const g = worldFor(SPAN.max);
    expect(g.gapX0).toBeGreaterThan(120);
    expect(g.width - g.gapX1).toBeGreaterThan(120);
  });
});

describe('MASS_SCALE', () => {
  it('scales masses down', () => {
    expect(MASS_SCALE).toBeGreaterThan(0);
    expect(MASS_SCALE).toBeLessThan(1);
  });
});

describe('STUCK_BUBBLE_TICKS', () => {
  it('is five seconds at 60 ticks per second', () => {
    expect(STUCK_BUBBLE_TICKS).toBe(300);
  });
});
