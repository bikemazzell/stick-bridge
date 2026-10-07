import { describe, it, expect } from 'vitest';
import { WORLD, MATERIAL, MASS_SCALE, LADDER, FACTS, HINTS, DEFAULTS } from '../src/game/config.js';

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
    expect(['flat', 'truss', 'suspension']).toContain(DEFAULTS.type);
  });
});

describe('MASS_SCALE', () => {
  it('scales masses down', () => {
    expect(MASS_SCALE).toBeGreaterThan(0);
    expect(MASS_SCALE).toBeLessThan(1);
  });
});
