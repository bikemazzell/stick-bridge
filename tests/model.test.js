import { describe, it, expect } from 'vitest';
import { createModel, addNode, addMember, sticksUsed, validate, isConnected, deckPath } from '../src/game/model.js';
import { WORLD } from '../src/game/config.js';

function chainModel() {
  const m = createModel('flat', 1, 100, 80);
  const a = addNode(m, WORLD.gapX0, WORLD.deckY, true);
  const b = addNode(m, 480, WORLD.deckY);
  const c = addNode(m, 640, WORLD.deckY);
  const d = addNode(m, 800, WORLD.deckY);
  const e = addNode(m, WORLD.gapX1, WORLD.deckY, true);
  addMember(m, a.id, b.id, 'stick');
  addMember(m, b.id, c.id, 'stick');
  addMember(m, c.id, d.id, 'stick');
  addMember(m, d.id, e.id, 'stick');
  return { m, a, e };
}

describe('createModel', () => {
  it('starts empty with params', () => {
    const m = createModel('truss', 's1', 120, 80);
    expect(m.type).toBe('truss');
    expect(m.seed).toBe('s1');
    expect(m.budget).toBe(120);
    expect(m.stickLen).toBe(80);
    expect(m.nodes).toEqual([]);
    expect(m.members).toEqual([]);
    expect(m.meta).toEqual({});
  });
});

describe('addNode / addMember', () => {
  it('assigns sequential ids', () => {
    const m = createModel('flat', 1, 50, 80);
    expect(addNode(m, 0, 0).id).toBe(0);
    expect(addNode(m, 1, 1).id).toBe(1);
    expect(addMember(m, 0, 1, 'stick').id).toBe(0);
  });
  it('members store strength based on material', () => {
    const m = createModel('flat', 1, 50, 80);
    addNode(m, 0, 0);
    addNode(m, 1, 0);
    const mem = addMember(m, 0, 1, 'stick', 2.5);
    expect(mem.strength).toBe(2.5);
    expect(addMember(m, 0, 1, 'stick').strength).toBeGreaterThan(0);
  });
});

describe('sticksUsed', () => {
  it('counts only sticks', () => {
    const { m } = chainModel();
    addMember(m, 0, 1, 'cable');
    expect(sticksUsed(m)).toBe(4);
  });
});

describe('validate', () => {
  it('accepts a valid chain', () => {
    const { m } = chainModel();
    expect(validate(m)).toEqual([]);
  });
  it('catches dangling member refs', () => {
    const m = createModel('flat', 1, 50, 80);
    addNode(m, 0, 0);
    addMember(m, 0, 99, 'stick');
    expect(validate(m)).toContain('member references missing node');
  });
  it('catches zero-length members', () => {
    const m = createModel('flat', 1, 50, 80);
    addNode(m, 5, 5);
    addNode(m, 5, 5);
    addMember(m, 0, 1, 'stick');
    expect(validate(m)).toContain('zero-length member');
  });
  it('catches duplicate node coordinates is not an error, but non-finite coords are', () => {
    const m = createModel('flat', 1, 50, 80);
    const n = addNode(m, 5, 5);
    addNode(m, 5, 5);
    expect(validate(m)).toEqual([]);
    n.x = NaN;
    expect(validate(m)).toContain('node has non-finite coordinates');
  });
});

describe('isConnected', () => {
  it('true for a chain', () => {
    const { m } = chainModel();
    expect(isConnected(m)).toBe(true);
  });
  it('false for an orphan node', () => {
    const { m } = chainModel();
    addNode(m, 500, 100);
    expect(isConnected(m)).toBe(false);
  });
});

describe('deckPath', () => {
  it('returns the ordered deck chain from left anchor to right anchor', () => {
    const { m, a, e } = chainModel();
    addNode(m, 640, 300);
    addMember(m, 1, 5, 'stick');
    const path = deckPath(m);
    expect(path.nodes.map((n) => n.id)).toEqual([a.id, 1, 2, 3, e.id]);
    expect(path.members).toHaveLength(4);
  });
  it('ignores y jitter within epsilon', () => {
    const m = createModel('flat', 1, 100, 80);
    const a = addNode(m, WORLD.gapX0, WORLD.deckY, true);
    const b = addNode(m, 480, WORLD.deckY + 2);
    const c = addNode(m, WORLD.gapX1, WORLD.deckY - 2, true);
    addMember(m, a.id, b.id, 'stick');
    addMember(m, b.id, c.id, 'stick');
    expect(deckPath(m).members).toHaveLength(2);
  });
  it('throws when deck is broken', () => {
    const m = createModel('flat', 1, 100, 80);
    const a = addNode(m, WORLD.gapX0, WORLD.deckY, true);
    const b = addNode(m, 480, WORLD.deckY);
    const c = addNode(m, WORLD.gapX1, WORLD.deckY, true);
    addMember(m, a.id, b.id, 'stick');
    expect(() => deckPath(m)).toThrow();
  });
});
