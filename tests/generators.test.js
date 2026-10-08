import { describe, it, expect } from 'vitest';
import { generateBridge } from '../src/game/bridge/generator.js';
import { validate, isConnected, deckPath, sticksUsed } from '../src/game/model.js';
import { WORLD, MATERIAL, worldFor } from '../src/game/config.js';

const { gapX0, gapX1, deckY } = WORLD;
const TYPES = ['flat', 'truss', 'suspension'];

function anchors(model) {
  const left = model.nodes.find((n) => Math.abs(n.x - gapX0) <= 0.01 && Math.abs(n.y - deckY) <= 0.01);
  const right = model.nodes.find((n) => Math.abs(n.x - gapX1) <= 0.01 && Math.abs(n.y - deckY) <= 0.01);
  return { left, right };
}

function spanAnchors(model, span) {
  const g = worldFor(span);
  const left = model.nodes.find((n) => Math.abs(n.x - g.gapX0) <= 0.01 && Math.abs(n.y - g.deckY) <= 0.01);
  const right = model.nodes.find((n) => Math.abs(n.x - g.gapX1) <= 0.01 && Math.abs(n.y - g.deckY) <= 0.01);
  return { left, right };
}

describe('generator dispatch', () => {
  it('generates a valid connected model for every type', () => {
    for (const type of TYPES) {
      const model = generateBridge({ type, seed: 'gen-' + type, budget: 120, stickLen: 80 });
      expect(model.type).toBe(type);
      expect(validate(model)).toEqual([]);
      expect(isConnected(model)).toBe(true);
    }
  });

  it('is reproducible for the same seed and differs across seeds', () => {
    const a = generateBridge({ type: 'truss', seed: 'same', budget: 120, stickLen: 80 });
    const b = generateBridge({ type: 'truss', seed: 'same', budget: 120, stickLen: 80 });
    expect(a).toEqual(b);

    const c = generateBridge({ type: 'truss', seed: 'other', budget: 120, stickLen: 80 });
    const coordsA = a.nodes.map((n) => `${n.x},${n.y}`).join('|');
    const coordsC = c.nodes.map((n) => `${n.x},${n.y}`).join('|');
    expect(coordsA).not.toBe(coordsC);
  });

  it('throws on unknown type', () => {
    expect(() => generateBridge({ type: 'monorail', seed: 'x', budget: 120, stickLen: 80 })).toThrow(
      /unknown bridge type/,
    );
  });
});

describe('shared invariants (all types, many budgets and stick lengths)', () => {
  const cases = [];
  for (const type of TYPES) {
    for (const budget of [20, 45, 120, 300]) {
      for (const stickLen of [40, 80, 120]) {
        cases.push([type, budget, stickLen]);
      }
    }
  }

  it.each(cases)('%s budget=%i stickLen=%i is valid', (type, budget, stickLen) => {
    const model = generateBridge({ type, seed: `inv-${type}-${budget}-${stickLen}`, budget, stickLen });
    expect(validate(model)).toEqual([]);
    expect(isConnected(model)).toBe(true);
    expect(sticksUsed(model)).toBeLessThanOrEqual(budget);

    const { left, right } = anchors(model);
    expect(left, 'left anchor exists').toBeTruthy();
    expect(right, 'right anchor exists').toBeTruthy();
    expect(left.fixed).toBe(true);
    expect(right.fixed).toBe(true);

    const deck = deckPath(model);
    expect(deck.nodes.length).toBeGreaterThanOrEqual(2);
    expect(deck.members.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < deck.nodes.length; i++) {
      const d = Math.hypot(deck.nodes[i].x - deck.nodes[i - 1].x, deck.nodes[i].y - deck.nodes[i - 1].y);
      expect(d).toBeLessThanOrEqual(stickLen + 7);
    }
  });
});

describe('flat generator', () => {
  it('spends at most the deck count when budget is tight', () => {
    const model = generateBridge({ type: 'flat', seed: 'f1', budget: 20, stickLen: 40 });
    const deck = deckPath(model);
    expect(sticksUsed(model)).toBe(deck.nodes.length - 1);
    expect(model.meta.deckLayers).toBe(1);
  });

  it('spends leftover budget on nothing: a flat beam is a single stick layer', () => {
    const model = generateBridge({ type: 'flat', seed: 'f2', budget: 300, stickLen: 80 });
    const deck = deckPath(model);
    expect(model.meta.deckLayers).toBe(1);
    expect(sticksUsed(model)).toBe(deck.nodes.length - 1);
  });
});

describe('truss generator', () => {
  it('produces every substyle across 50 seeds', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const model = generateBridge({ type: 'truss', seed: `sub-${i}`, budget: 200, stickLen: 80 });
      expect(['warren', 'pratt', 'howe']).toContain(model.meta.substyle);
      seen.add(model.meta.substyle);
    }
    expect(seen.has('warren')).toBe(true);
    expect(seen.has('pratt')).toBe(true);
    expect(seen.has('howe')).toBe(true);
  });

  it('builds top chord above the deck', () => {
    const model = generateBridge({ type: 'truss', seed: 'top', budget: 200, stickLen: 80 });
    const deckNodes = deckPath(model).nodes;
    const deckXs = deckNodes.map((n) => n.x);
    const minX = Math.min(...deckXs);
    const maxX = Math.max(...deckXs);
    const tops = model.nodes.filter((n) => n.x > minX + 5 && n.x < maxX - 5 && n.y < deckY - 30);
    expect(tops.length).toBeGreaterThanOrEqual(1);
  });

  it('has structure beyond the deck when budget allows', () => {
    const model = generateBridge({ type: 'truss', seed: 'rich', budget: 200, stickLen: 80 });
    const deckCount = deckPath(model).members.length;
    expect(sticksUsed(model)).toBeGreaterThan(deckCount);
  });
});

describe('suspension generator', () => {
  const model = generateBridge({ type: 'suspension', seed: 'sus', budget: 120, stickLen: 80 });

  it('uses cables and towers', () => {
    const cables = model.members.filter((m) => m.material === 'cable');
    expect(cables.length).toBeGreaterThanOrEqual(4);
    expect(model.meta.towerHeight).toBeGreaterThanOrEqual(40);
    expect(model.meta.sag).toBeGreaterThan(0);
  });

  it('places tower tops above the deck within the gap', () => {
    const tops = model.nodes.filter(
      (n) => n.y < deckY - model.meta.towerHeight + 10 && n.x > gapX0 && n.x < gapX1,
    );
    expect(tops.length).toBeGreaterThanOrEqual(2);
  });

  it('hangs hangers straight down to deck nodes', () => {
    const deckNodes = deckPath(model).nodes;
    const cableNodes = model.nodes.filter((n) => n.y < deckY - 40 && !n.fixed);
    let straight = 0;
    for (const cn of cableNodes) {
      const below = deckNodes.find((dn) => Math.abs(dn.x - cn.x) <= 5 && dn.y > cn.y);
      if (below) straight++;
    }
    expect(straight).toBeGreaterThanOrEqual(2);
  });

  it('shortens towers when budget is tight instead of exceeding it', () => {
    const tight = generateBridge({ type: 'suspension', seed: 'tight', budget: 22, stickLen: 40 });
    expect(sticksUsed(tight)).toBeLessThanOrEqual(22);
    expect(tight.meta.towerHeight).toBeLessThan(120);
  });
});

describe('variable span', () => {
  const cases = [];
  for (const type of TYPES) {
    for (const span of [480, 800]) {
      for (const budget of [20, 200]) {
        cases.push([type, span, budget]);
      }
    }
  }

  it.each(cases)('%s span=%i budget=%i anchors the deck at the span gap', (type, span, budget) => {
    const model = generateBridge({ type, seed: `span-${type}-${span}-${budget}`, budget, stickLen: 80, span });
    expect(model.span).toBe(span);
    expect(validate(model)).toEqual([]);
    expect(isConnected(model)).toBe(true);
    expect(sticksUsed(model)).toBeLessThanOrEqual(budget);

    const { left, right } = spanAnchors(model, span);
    expect(left, 'left anchor at span gapX0').toBeTruthy();
    expect(right, 'right anchor at span gapX1').toBeTruthy();
    expect(left.fixed).toBe(true);
    expect(right.fixed).toBe(true);

    const deck = deckPath(model);
    expect(deck.nodes[0].id).toBe(left.id);
    expect(deck.nodes[deck.nodes.length - 1].id).toBe(right.id);
    for (let i = 1; i < deck.nodes.length; i++) {
      const d = Math.hypot(deck.nodes[i].x - deck.nodes[i - 1].x, deck.nodes[i].y - deck.nodes[i - 1].y);
      expect(d).toBeLessThanOrEqual(80 + 7);
    }
  });

  it('completes a max-span deck at the minimum budget', () => {
    const model = generateBridge({ type: 'flat', seed: 'wide', budget: 20, stickLen: 40, span: 800 });
    const g = worldFor(800);
    const deck = deckPath(model);
    expect(deck.nodes).toHaveLength(21);
    expect(Math.abs(deck.nodes[0].x - g.gapX0)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(deck.nodes[deck.nodes.length - 1].x - g.gapX1)).toBeLessThanOrEqual(0.01);
    expect(sticksUsed(model)).toBeLessThanOrEqual(20);
  });

  it('is reproducible for the same seed at a custom span', () => {
    const a = generateBridge({ type: 'truss', seed: 'wSame', budget: 200, stickLen: 80, span: 800 });
    const b = generateBridge({ type: 'truss', seed: 'wSame', budget: 200, stickLen: 80, span: 800 });
    expect(a).toEqual(b);
  });

  it('suspension skips towers when only the deck fits the budget', () => {
    const model = generateBridge({ type: 'suspension', seed: 'wTight', budget: 20, stickLen: 40, span: 800 });
    expect(sticksUsed(model)).toBeLessThanOrEqual(20);
    expect(model.meta.towerHeight).toBe(0);
    expect(validate(model)).toEqual([]);
    expect(isConnected(model)).toBe(true);
  });
});

describe('strength scatter', () => {
  it('varies member strength around the base value', () => {
    const model = generateBridge({ type: 'truss', seed: 'str', budget: 120, stickLen: 80 });
    const deckIds = new Set(deckPath(model).members.map((m) => m.id));
    const sticks = model.members.filter((m) => m.material === 'stick');
    for (const m of sticks) {
      if (deckIds.has(m.id)) {
        expect(m.strength).toBeGreaterThanOrEqual(MATERIAL.stick.breakStretch * 0.9 - 1e-9);
        expect(m.strength).toBeLessThanOrEqual(MATERIAL.stick.breakStretch * 1.1 + 1e-9);
      } else {
        // bracing carries axial loads: stronger than the walking surface
        expect(m.strength).toBeGreaterThan(MATERIAL.stick.breakStretch);
      }
    }
    const strengths = new Set(sticks.map((m) => m.strength));
    expect(strengths.size).toBeGreaterThan(1);
  });
});
