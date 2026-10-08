import { describe, it, expect } from 'vitest';
import { createGameState, transition } from '../src/game/state.js';
import { FACTS } from '../src/game/config.js';

const CFG = { type: 'truss', seed: 'state-test', budget: 120, stickLen: 80 };

function started() {
  return transition(createGameState(), 'START', CFG);
}

describe('game state machine', () => {
  it('starts in menu state', () => {
    const gs = createGameState();
    expect(gs.state).toBe('menu');
    expect(gs.heaviestCrossedKg).toBe(0);
    expect(gs.walkerIndex).toBe(0);
  });

  it('START with config moves menu -> building', () => {
    const gs = transition(createGameState(), 'START', CFG);
    expect(gs.state).toBe('building');
    expect(gs.config).toEqual(CFG);
  });

  it('BUILT moves building -> testing', () => {
    const gs = transition(started(), 'BUILT');
    expect(gs.state).toBe('testing');
  });

  it('WALKER_EXIT tracks heaviest crossed', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'WALKER_EXIT', { name: 'cat', massKg: 4 });
    expect(gs.state).toBe('testing');
    expect(gs.heaviestCrossedName).toBe('cat');
    expect(gs.heaviestCrossedKg).toBe(4);
    expect(gs.walkerIndex).toBe(1);
    gs = transition(gs, 'WALKER_EXIT', { name: 'human', massKg: 70 });
    expect(gs.heaviestCrossedName).toBe('human');
    expect(gs.heaviestCrossedKg).toBe(70);
    gs = transition(gs, 'WALKER_EXIT', { name: 'mouse', massKg: 0.05 });
    expect(gs.heaviestCrossedName).toBe('human');
    expect(gs.heaviestCrossedKg).toBe(70);
  });

  it('BROKE records broken members without transitioning', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'BROKE', { memberId: 3 });
    gs = transition(gs, 'BROKE', { memberId: 7 });
    expect(gs.state).toBe('testing');
    expect(gs.brokenMembers).toEqual([3, 7]);
  });

  it('WALKER_FALL ends round collapsed with brokeBy and fact', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'WALKER_EXIT', { name: 'cat', massKg: 4 });
    gs = transition(gs, 'WALKER_FALL', { name: 'human', massKg: 70 });
    expect(gs.state).toBe('result');
    expect(gs.resultReason).toBe('collapsed');
    expect(gs.brokeBy).toEqual({ name: 'human', massKg: 70 });
    expect(gs.heaviestCrossedName).toBe('cat');
    expect(FACTS.truss).toContain(gs.fact);
  });

  it('WALKER_FALL picks fact matching bridge type', () => {
    for (const type of Object.keys(FACTS)) {
      let gs = transition(createGameState(), 'START', { ...CFG, type });
      gs = transition(gs, 'BUILT');
      gs = transition(gs, 'WALKER_FALL', { name: 'human', massKg: 70 });
      expect(FACTS[type]).toContain(gs.fact);
    }
  });

  it('DONE survives ladder completion', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'WALKER_EXIT', { name: 'tank', massKg: 42000 });
    gs = transition(gs, 'DONE');
    expect(gs.state).toBe('result');
    expect(gs.resultReason).toBe('survived');
    expect(gs.brokeBy).toBe(null);
    expect(gs.heaviestCrossedKg).toBe(42000);
  });

  it('DONE with stuck reason records it', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'DONE', { reason: 'stuck' });
    expect(gs.state).toBe('result');
    expect(gs.resultReason).toBe('stuck');
  });

  it('REPLAY keeps config and goes building, NEW returns to menu', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'WALKER_FALL', { name: 'human', massKg: 70 });
    gs = transition(gs, 'REPLAY');
    expect(gs.state).toBe('building');
    expect(gs.config).toEqual(CFG);
    gs = transition(gs, 'BUILT');
    gs = transition(gs, 'WALKER_FALL', { name: 'horse', massKg: 400 });
    gs = transition(gs, 'NEW');
    expect(gs.state).toBe('menu');
    expect(gs.heaviestCrossedKg).toBe(0);
    expect(gs.config).toBe(null);
  });

  it('EXIT abandons a round from building or testing back to a fresh menu', () => {
    const fromBuilding = transition(started(), 'EXIT');
    expect(fromBuilding).toEqual(createGameState());

    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'WALKER_EXIT', { name: 'cat', massKg: 4 });
    gs = transition(gs, 'BROKE', { memberId: 2 });
    const fromTesting = transition(gs, 'EXIT');
    expect(fromTesting).toEqual(createGameState());
  });

  it('EXIT is ignored in menu and result states', () => {
    const menu = createGameState();
    expect(transition(menu, 'EXIT')).toBe(menu);
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'DONE');
    expect(transition(gs, 'EXIT')).toBe(gs);
  });

  it('REPLAY resets round tracking but keeps heaviest of the session? no: resets it', () => {
    let gs = transition(started(), 'BUILT');
    gs = transition(gs, 'WALKER_EXIT', { name: 'cat', massKg: 4 });
    gs = transition(gs, 'WALKER_FALL', { name: 'human', massKg: 70 });
    gs = transition(gs, 'REPLAY');
    expect(gs.heaviestCrossedKg).toBe(0);
    expect(gs.heaviestCrossedName).toBe(null);
    expect(gs.walkerIndex).toBe(0);
    expect(gs.brokenMembers).toEqual([]);
    expect(gs.brokeBy).toBe(null);
  });

  it('fact is stable for the same seed and varies across seeds', () => {
    const facts = new Set();
    for (let i = 0; i < 8; i++) {
      let gs = transition(createGameState(), 'START', { ...CFG, seed: `s-${i}` });
      gs = transition(gs, 'BUILT');
      gs = transition(gs, 'WALKER_FALL', { name: 'human', massKg: 70 });
      facts.add(gs.fact);
    }
    expect(facts.size).toBeGreaterThan(1);
    let a = transition(createGameState(), 'START', CFG);
    a = transition(a, 'BUILT');
    a = transition(a, 'WALKER_FALL', { name: 'human', massKg: 70 });
    let b = transition(createGameState(), 'START', CFG);
    b = transition(b, 'BUILT');
    b = transition(b, 'WALKER_FALL', { name: 'human', massKg: 70 });
    expect(a.fact).toBe(b.fact);
  });

  it('ignores unknown events and events out of place', () => {
    const gs = started();
    expect(transition(gs, 'SOMETHING').state).toBe('building');
    expect(transition(createGameState(), 'BUILT').state).toBe('menu');
    expect(transition(createGameState(), 'WALKER_EXIT', { name: 'cat', massKg: 4 }).state).toBe('menu');
    const t = transition(gs, 'BUILT');
    expect(transition(t, 'START', CFG).state).toBe('testing');
  });

  it('transition is pure: input state not mutated', () => {
    const gs = started();
    const snapshot = JSON.stringify(gs);
    transition(gs, 'BUILT');
    transition(gs, 'WALKER_EXIT', { name: 'cat', massKg: 4 });
    expect(JSON.stringify(gs)).toBe(snapshot);
  });
});
